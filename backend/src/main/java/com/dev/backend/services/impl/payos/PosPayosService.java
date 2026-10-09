package com.dev.backend.services.impl.payos;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.PosCheckoutCreating;
import com.dev.backend.dto.response.customize.PayosPaymentLinkDto;
import com.dev.backend.dto.response.customize.PosCheckoutResponse;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.PosPayosPayment;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.PosPayosPaymentRepository;
import com.dev.backend.services.impl.entities.PosCatalogService;
import com.dev.backend.services.impl.entities.PosConcurrencyRetry;
import com.dev.backend.websocket.PosWebSocketHandler;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Điều phối thanh toán chuyển khoản payOS tại quầy (KHÔNG transactional — gọi API payOS
 * nằm ngoài transaction DB; các bước ghi nằm trong PosPayosTransaction).
 *
 * Luồng: tạo QR (giữ chỗ hàng) -> khách chuyển khoản -> payOS gọi webhook (hoặc màn POS
 * hỏi trạng thái) -> kiểm chữ ký + số tiền -> tạo đơn, trừ kho, ghi phiếu thu PAYOS.
 * Hủy / hết hạn -> trả lại hàng giữ chỗ.
 */
@Slf4j
@Service
public class PosPayosService {

    private static final long GRACE_SECONDS_WHEN_PAYOS_UNREACHABLE = 30 * 60;

    private final PaymentConfigService configService;
    private final PayosClient payosClient;
    private final PosPayosTransaction tx;
    private final PosPayosPaymentRepository repository;
    private final PosCatalogService posCatalogService;
    private final PosWebSocketHandler posWebSocketHandler;
    private final String frontendUrl;

    public PosPayosService(PaymentConfigService configService, PayosClient payosClient, PosPayosTransaction tx,
                           PosPayosPaymentRepository repository, PosCatalogService posCatalogService,
                           PosWebSocketHandler posWebSocketHandler,
                           @Value("${app.frontend-url:http://localhost:5173}") String frontendUrl) {
        this.configService = configService;
        this.payosClient = payosClient;
        this.tx = tx;
        this.repository = repository;
        this.posCatalogService = posCatalogService;
        this.posWebSocketHandler = posWebSocketHandler;
        this.frontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
    }

    public Map<String, Boolean> paymentMethods() {
        return Map.of("cash", true, "payos", configService.isPayosEnabled());
    }

    /** Tạo mã QR cho hóa đơn. Gọi lại với cùng requestId khi QR còn hạn -> trả lại đúng QR cũ. */
    public PayosPaymentLinkDto createLink(PosCheckoutCreating request) {
        PaymentConfigService.ActivePayos active = configService.activePayos();
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        if (request == null || request.getRequestId() == null || request.getRequestId().isBlank()) {
            throw new CommonException("Thiếu requestId cho giao dịch thanh toán");
        }
        PosPayosPayment existing = repository
                .findFirstByRequestIdAndTrangThaiOrderByIdDesc(request.getRequestId().trim(), PosPayosPayment.PENDING)
                .orElse(null);
        if (existing != null && existing.getQrCode() != null && existing.getHetHanLuc().isAfter(Instant.now())) {
            authorize(existing);
            return toDto(existing);
        }

        PosPayosPayment row = PosConcurrencyRetry.call(() -> tx.createPending(request, user.getId(), active.expiryMinutes()));
        try {
            List<PayosClient.Item> items = new ArrayList<>();
            Map<Integer, String> names = tx.productNames(row);
            for (PosCheckoutCreating.PosCheckoutItemCreating i : tx.payload(row).getItems()) {
                String name = names.getOrDefault(i.getBienTheSanPhamId(), "San pham");
                items.add(new PayosClient.Item(name.length() > 100 ? name.substring(0, 100) : name,
                        i.getQuantity().intValue(), i.getUnitPriceClient().longValue()));
            }
            PayosClient.PayosResult r = payosClient.createPaymentLink(active.credentials(), row.getOrderCode(),
                    row.getSoTien().longValueExact(), row.getNoiDungCk(),
                    frontendUrl + "/pos?payos=success", frontendUrl + "/pos?payos=cancel",
                    row.getHetHanLuc().getEpochSecond(), items);
            if (!r.ok() || r.data() == null) {
                String msg = "payOS không tạo được mã QR: " + (r.desc() == null ? "HTTP " + r.httpStatus() : r.desc());
                tx.closeUnpaid(row.getOrderCode(), PosPayosPayment.FAILED, msg);
                throw new CommonException(msg, HttpStatus.BAD_GATEWAY, null);
            }
            return toDto(tx.markLinkCreated(row.getOrderCode(), r.data()));
        } catch (CommonException e) {
            tx.closeUnpaid(row.getOrderCode(), PosPayosPayment.FAILED, e.getMessage());
            throw e;
        } catch (RuntimeException e) {
            log.error("Lỗi tạo QR payOS cho đơn {}", row.getOrderCode(), e);
            tx.closeUnpaid(row.getOrderCode(), PosPayosPayment.FAILED, "Lỗi hệ thống khi tạo mã QR");
            throw new CommonException("Không tạo được mã QR. Vui lòng thử lại.", HttpStatus.BAD_GATEWAY, null);
        }
    }

    /** Màn POS hỏi trạng thái (mỗi vài giây). Còn chờ -> hỏi thẳng payOS, phòng khi webhook chưa về. */
    public PayosPaymentLinkDto getStatus(Long orderCode) {
        PosPayosPayment row = find(orderCode);
        authorize(row);
        if (PosPayosPayment.PENDING.equals(row.getTrangThai())) {
            try {
                syncWithPayos(orderCode, configService.credentialsForBackgroundJob());
            } catch (CommonException e) {
                log.debug("Chưa hỏi được payOS cho đơn {}: {}", orderCode, e.getMessage());
            }
            row = find(orderCode);
        }
        return toDto(row);
    }

    /** Thu ngân hủy QR. Nếu khách đã kịp trả thì không hủy mà hoàn tất đơn. */
    public PayosPaymentLinkDto cancel(Long orderCode) {
        PosPayosPayment row = find(orderCode);
        authorize(row);
        if (!PosPayosPayment.PENDING.equals(row.getTrangThai())) {
            return toDto(row);
        }
        PayosCredentials cred = configService.credentialsForBackgroundJob();
        if (cred != null) {
            String status = syncWithPayos(orderCode, cred);
            if (!PosPayosPayment.PENDING.equals(find(orderCode).getTrangThai())) {
                return toDto(find(orderCode));
            }
            if (status != null) {
                PayosClient.PayosResult r = payosClient.cancelPaymentLink(cred, orderCode, "Thu ngan huy tai quay");
                if (!r.ok()) log.warn("payOS chưa hủy được link {}: {}", orderCode, r.desc());
            }
        }
        return toDto(tx.closeUnpaid(orderCode, PosPayosPayment.CANCELLED, "Thu ngân đã hủy mã QR"));
    }

    /**
     * Webhook payOS. Chữ ký sai -> từ chối (400). Đơn không có trong hệ thống (vd. dữ liệu mẫu khi
     * payOS kiểm tra webhook) -> vẫn trả 200. Xử lý lặp lại an toàn.
     */
    public void handleWebhook(JsonNode body) {
        if (body == null || body.get("data") == null) {
            throw new CommonException("Webhook thiếu dữ liệu");
        }
        String checksumKey = configService.checksumKeyOrNull();
        if (checksumKey == null) {
            throw new CommonException("Chưa cấu hình Checksum Key payOS", HttpStatus.SERVICE_UNAVAILABLE, null);
        }
        JsonNode data = body.get("data");
        if (!com.dev.backend.utils.PayosSignature.verifyData(data, body.path("signature").asText(null), checksumKey)) {
            log.warn("Từ chối webhook payOS: chữ ký không hợp lệ (orderCode={})", data.path("orderCode").asText());
            throw new CommonException("Chữ ký webhook không hợp lệ", HttpStatus.BAD_REQUEST, null);
        }
        if (!"00".equals(body.path("code").asText()) || !"00".equals(data.path("code").asText("00"))) {
            log.info("Webhook payOS không phải giao dịch thành công: {}", body.path("desc").asText());
            return;
        }
        long orderCode = data.path("orderCode").asLong(-1);
        if (orderCode <= 0 || repository.findByOrderCode(orderCode).isEmpty()) {
            log.info("Webhook payOS cho đơn {} không có trong hệ thống (có thể là dữ liệu kiểm tra)", orderCode);
            return;
        }
        BigDecimal amount = new BigDecimal(data.path("amount").asText("0"));
        finalizeSafely(orderCode, amount, data.path("reference").asText(null));
    }

    /** Job mỗi phút: QR quá hạn -> hỏi payOS lần cuối, chưa trả thì hủy + trả hàng giữ chỗ. */
    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void expireOverdueLinks() {
        List<PosPayosPayment> overdue;
        try {
            overdue = repository.findTop50ByTrangThaiAndHetHanLucBeforeOrderByIdAsc(PosPayosPayment.PENDING, Instant.now());
        } catch (RuntimeException e) {
            log.debug("Bỏ qua job hết hạn payOS: {}", e.getMessage());
            return;
        }
        if (overdue.isEmpty()) return;
        PayosCredentials cred;
        try {
            cred = configService.credentialsForBackgroundJob();
        } catch (RuntimeException e) {
            cred = null;
        }
        for (PosPayosPayment row : overdue) {
            try {
                String status = cred == null ? null : syncWithPayos(row.getOrderCode(), cred);
                if (!PosPayosPayment.PENDING.equals(find(row.getOrderCode()).getTrangThai())) continue;
                boolean payosReachable = status != null;
                boolean longOverdue = row.getHetHanLuc().plusSeconds(GRACE_SECONDS_WHEN_PAYOS_UNREACHABLE).isBefore(Instant.now());
                if (payosReachable) {
                    payosClient.cancelPaymentLink(cred, row.getOrderCode(), "Het han");
                    tx.closeUnpaid(row.getOrderCode(), PosPayosPayment.EXPIRED, "Mã QR đã hết hạn");
                } else if (longOverdue) {
                    tx.closeUnpaid(row.getOrderCode(), PosPayosPayment.EXPIRED,
                            "Mã QR đã hết hạn (không kiểm tra được payOS)");
                }
            } catch (RuntimeException e) {
                log.warn("Job hết hạn payOS lỗi ở đơn {}: {}", row.getOrderCode(), e.getMessage());
            }
        }
    }

    // ================= helpers =================

    /**
     * Hỏi payOS trạng thái đơn và cập nhật hệ thống. Trả về trạng thái payOS (PAID/PENDING/...)
     * hoặc null nếu không hỏi được.
     */
    private String syncWithPayos(Long orderCode, PayosCredentials cred) {
        if (cred == null) return null;
        PayosClient.PayosResult r = payosClient.getPaymentLink(cred, orderCode);
        if (!r.ok() || r.data() == null) return null;
        String status = r.data().path("status").asText("");
        long amountPaid = r.data().path("amountPaid").asLong(0);
        long amount = r.data().path("amount").asLong(0);
        if ("PAID".equals(status) || (amount > 0 && amountPaid >= amount)) {
            String reference = null;
            JsonNode tx0 = r.data().path("transactions").path(0);
            if (!tx0.isMissingNode()) reference = tx0.path("reference").asText(null);
            finalizeSafely(orderCode, BigDecimal.valueOf(amountPaid > 0 ? amountPaid : amount), reference);
            return "PAID";
        }
        if ("CANCELLED".equals(status) || "EXPIRED".equals(status) || "FAILED".equals(status)) {
            tx.closeUnpaid(orderCode, "CANCELLED".equals(status) ? PosPayosPayment.CANCELLED : PosPayosPayment.EXPIRED,
                    "payOS báo giao dịch " + status);
        }
        return status;
    }

    private void finalizeSafely(Long orderCode, BigDecimal amount, String reference) {
        try {
            // Deadlock / trùng số chứng từ với quầy khác -> thử lại transaction mới, không đánh PAID_ERROR oan.
            PosCheckoutResponse result = PosConcurrencyRetry.call(() -> tx.finalizePaid(orderCode, amount, reference));
            log.info("payOS: đơn {} đã thanh toán -> {}", orderCode, result == null ? "?" : result.getSoDonHang());
            pushPaymentNotification(orderCode);
        } catch (RuntimeException e) {
            PosPayosPayment row = tx.reload(orderCode).orElse(null);
            if (row != null && PosPayosPayment.PAID.equals(row.getTrangThai())) {
                pushPaymentNotification(orderCode);
                return;
            }
            log.error("payOS: đã nhận tiền đơn {} nhưng không tạo được đơn hàng", orderCode, e);
            String reason = PosConcurrencyRetry.isRetryable(e)
                    ? "nhiều giao dịch chạy cùng lúc, đã thử lại nhưng chưa được"
                    : (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
            tx.markPaidError(orderCode, reason, reference);
            pushPaymentNotification(orderCode);
        }
    }

    private void pushPaymentNotification(Long orderCode) {
        try {
            PosPayosPayment row = tx.reload(orderCode).orElse(null);
            if (row != null && posWebSocketHandler != null) {
                posWebSocketHandler.broadcastPayment(row.getOrderCode(), row.getKhoId(), toDto(row));
            }
        } catch (Exception e) {
            log.warn("WebSocket POS: Lỗi khi push notification cho đơn {}: {}", orderCode, e.getMessage());
        }
    }

    /** Luôn đọc trạng thái mới nhất (xem PosPayosTransaction.reload). */
    private PosPayosPayment find(Long orderCode) {
        return tx.reload(orderCode)
                .orElseThrow(() -> new CommonException("Không tìm thấy giao dịch chuyển khoản " + orderCode, HttpStatus.NOT_FOUND, null));
    }

    /** Thu ngân tạo giao dịch, admin, hoặc người có quyền kho của giao dịch. */
    private void authorize(PosPayosPayment row) {
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        if (user == null) {
            throw new CommonException("Chưa đăng nhập", HttpStatus.UNAUTHORIZED, null);
        }
        if (user.getVaiTro() != null && user.getVaiTro().contains(IRoleType.quan_tri_vien)) return;
        if (row.getNguoiThuNganId() != null && row.getNguoiThuNganId().equals(user.getId())) return;
        posCatalogService.authorizeWarehouse(row.getKhoId());
    }

    private PayosPaymentLinkDto toDto(PosPayosPayment row) {
        return PayosPaymentLinkDto.builder()
                .orderCode(row.getOrderCode())
                .requestId(row.getRequestId())
                .trangThai(row.getTrangThai())
                .soTien(row.getSoTien())
                .qrCode(row.getQrCode())
                .checkoutUrl(row.getCheckoutUrl())
                .bin(row.getBin())
                .soTaiKhoan(row.getSoTaiKhoan())
                .tenTaiKhoan(row.getTenTaiKhoan())
                .noiDungCk(row.getNoiDungCk())
                .hetHanLuc(row.getHetHanLuc())
                .errorMessage(row.getErrorMessage())
                .result(PosPayosPayment.PAID.equals(row.getTrangThai())
                        ? tx.read(row.getResultJson(), PosCheckoutResponse.class) : null)
                .build();
    }
}
