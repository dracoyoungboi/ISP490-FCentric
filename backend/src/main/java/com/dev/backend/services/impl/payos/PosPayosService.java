package com.dev.backend.services.impl.payos;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.request.PosCheckoutCreating;
import com.dev.backend.dto.response.customize.PayosPaymentLinkDto;
import com.dev.backend.dto.response.customize.PosCheckoutResponse;
import com.dev.backend.dto.response.customize.PosPayosGiaoDichDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.PosPayosPayment;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.PosPayosPaymentRepository;
import com.dev.backend.services.impl.entities.PosCatalogService;
import com.dev.backend.services.impl.entities.PosConcurrencyRetry;
import com.dev.backend.websocket.PosWebSocketHandler;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    static final String CANCEL_UNCONFIRMED_MESSAGE = "Chưa hủy được mã QR vì payOS chưa xác nhận — khách vẫn có thể "
            + "đang chuyển khoản. Hóa đơn vẫn khóa: thử hủy lại sau ít phút hoặc chờ mã hết hạn.";

    private final PaymentConfigService configService;
    private final PayosClient payosClient;
    private final PosPayosTransaction tx;
    private final PosPayosPaymentRepository repository;
    private final PosCatalogService posCatalogService;
    private final PosWebSocketHandler posWebSocketHandler;
    private final KhoRepository khoRepository;
    private final NguoiDungRepository nguoiDungRepository;
    private final String frontendUrl;

    public PosPayosService(PaymentConfigService configService, PayosClient payosClient, PosPayosTransaction tx,
                           PosPayosPaymentRepository repository, PosCatalogService posCatalogService,
                           PosWebSocketHandler posWebSocketHandler, KhoRepository khoRepository,
                           NguoiDungRepository nguoiDungRepository,
                           @Value("${app.frontend-url:http://localhost:5173}") String frontendUrl) {
        this.configService = configService;
        this.payosClient = payosClient;
        this.tx = tx;
        this.repository = repository;
        this.posCatalogService = posCatalogService;
        this.posWebSocketHandler = posWebSocketHandler;
        this.khoRepository = khoRepository;
        this.nguoiDungRepository = nguoiDungRepository;
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

    /**
     * Thu ngân hủy QR. Nếu khách đã kịp trả thì không hủy mà hoàn tất đơn.
     * Chỉ đánh dấu đã hủy (và trả hàng giữ chỗ) khi payOS XÁC NHẬN link đã chết: link còn sống thì
     * khách vẫn chuyển khoản được trong lúc thu ngân đã thu tiền mặt bằng hóa đơn khác -> bán 2 lần.
     * 409 (không phải 5xx: Cloudflare thay nội dung lỗi 5xx) để màn POS hiện đúng câu báo.
     */
    public PayosPaymentLinkDto cancel(Long orderCode) {
        PosPayosPayment row = find(orderCode);
        authorize(row);
        if (!PosPayosPayment.PENDING.equals(row.getTrangThai())) {
            return toDto(row);
        }
        PayosCredentials cred = configService.credentialsForBackgroundJob();
        String status = syncWithPayos(orderCode, cred);
        if (!PosPayosPayment.PENDING.equals(find(orderCode).getTrangThai())) {
            return toDto(find(orderCode));
        }
        if (status == null) {
            throw new CommonException(CANCEL_UNCONFIRMED_MESSAGE, HttpStatus.CONFLICT, null);
        }
        PayosClient.PayosResult r = payosClient.cancelPaymentLink(cred, orderCode, "Thu ngan huy tai quay");
        if (!r.ok()) {
            log.warn("payOS chưa hủy được link {}: {}", orderCode, r.desc());
            // Hủy hỏng có thể vì khách vừa trả xong: hỏi lại để hoàn tất đơn thay vì báo lỗi.
            syncWithPayos(orderCode, cred);
            if (!PosPayosPayment.PENDING.equals(find(orderCode).getTrangThai())) {
                return toDto(find(orderCode));
            }
            throw new CommonException(CANCEL_UNCONFIRMED_MESSAGE, HttpStatus.CONFLICT, null);
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
        ghiNguoiChuyenAnToan(orderCode, data);
        finalizeSafely(orderCode, amount, data.path("reference").asText(null), false);
    }

    // ================= Quản lý xử lý giao dịch lỗi (PAID_ERROR) =================

    /** Danh sách giao dịch cho màn "Đối soát chuyển khoản"; ngày lọc theo giờ Việt Nam, đến hết ngày denNgay. */
    public Page<PosPayosGiaoDichDto> listTransactions(String trangThai, boolean chiQuanLyDaXuLy, Integer khoId,
                                                      LocalDate tuNgay, LocalDate denNgay, int page, int size) {
        Instant tu = tuNgay == null ? null : tuNgay.atStartOfDay(VN).toInstant();
        Instant den = denNgay == null ? null : denNgay.plusDays(1).atStartOfDay(VN).toInstant();
        String status = trangThai == null || trangThai.isBlank() ? null : trangThai.trim();
        Page<PosPayosPayment> rows = repository.timKiem(status, chiQuanLyDaXuLy, khoId, tu, den,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
        Set<Integer> khoIds = new HashSet<>();
        Set<Integer> userIds = new HashSet<>();
        rows.forEach(r -> {
            khoIds.add(r.getKhoId());
            userIds.add(r.getNguoiThuNganId());
            if (r.getNguoiXuLyId() != null) userIds.add(r.getNguoiXuLyId());
        });
        Map<Integer, String> tenKho = new HashMap<>();
        khoRepository.findAllById(khoIds).forEach(k -> tenKho.put(k.getId(), k.getTenKho()));
        Map<Integer, String> tenNguoi = new HashMap<>();
        nguoiDungRepository.findAllById(userIds).forEach(u -> tenNguoi.put(u.getId(), u.getHoTen()));
        return rows.map(r -> toGiaoDichDto(r, tenKho, tenNguoi));
    }

    /** Số giao dịch đã nhận tiền nhưng chưa có đơn — số đếm trên menu. */
    public long countNeedsAttention() {
        return repository.countByTrangThai(PosPayosPayment.PAID_ERROR);
    }

    public PosPayosGiaoDichDto createOrderFromPaidError(Long orderCode, String note) {
        Integer managerId = SecurityContextHolder.getUser().getId();
        // Deadlock / trùng số chứng từ với quầy khác -> thử lại transaction mới.
        PosConcurrencyRetry.call(() -> tx.createOrderFromPaidError(orderCode, managerId, note));
        pushPaymentNotification(orderCode);
        return giaoDich(orderCode);
    }

    public PosPayosGiaoDichDto markRefunded(Long orderCode, String note) {
        if (note == null || note.isBlank()) {
            throw new CommonException("Nhập ghi chú hoàn tiền (mã giao dịch hoàn hoặc lý do).");
        }
        Integer managerId = SecurityContextHolder.getUser().getId();
        PosConcurrencyRetry.call(() -> tx.markRefunded(orderCode, managerId, note));
        pushPaymentNotification(orderCode);
        return giaoDich(orderCode);
    }

    private PosPayosGiaoDichDto giaoDich(Long orderCode) {
        PosPayosPayment row = find(orderCode);
        Map<Integer, String> tenKho = new HashMap<>();
        khoRepository.findById(row.getKhoId()).ifPresent(k -> tenKho.put(k.getId(), k.getTenKho()));
        Map<Integer, String> tenNguoi = new HashMap<>();
        nguoiDungRepository.findAllById(row.getNguoiXuLyId() == null ? List.of(row.getNguoiThuNganId())
                        : List.of(row.getNguoiThuNganId(), row.getNguoiXuLyId()))
                .forEach(u -> tenNguoi.put(u.getId(), u.getHoTen()));
        return toGiaoDichDto(row, tenKho, tenNguoi);
    }

    /**
     * Lý do giao dịch cần quản lý xử lý (đang hoặc đã từng là PAID_ERROR), xét theo thứ tự: chưa rõ số tiền, sai số
     * tiền, tiền về khi mã QR đã hủy/hết hạn (cờ chốt lúc thành PAID_ERROR, không suy ngược), còn lại là lỗi tạo đơn.
     * Cờ tienVeSauHuy trả riêng: khoản vừa chuyển dư vừa về muộn vẫn phải bắt quản lý hỏi quầy trước khi bán.
     */
    static String lyDo(PosPayosPayment row) {
        boolean tungLoi = PosPayosPayment.PAID_ERROR.equals(row.getTrangThai())
                || PosPayosPayment.REFUNDED.equals(row.getTrangThai())
                || (PosPayosPayment.PAID.equals(row.getTrangThai()) && row.getNguoiXuLyId() != null);
        if (!tungLoi) return null;
        if (row.getSoTienDaNhan() == null) return "CHUA_RO_SO_TIEN";
        int ss = row.getSoTien() == null ? 0 : row.getSoTienDaNhan().compareTo(row.getSoTien());
        if (ss < 0) return "CHUYEN_THIEU";
        if (ss > 0) return "CHUYEN_DU";
        return row.isTienVeSauHuy() ? "TIEN_VE_MUON" : "LOI_TAO_DON";
    }

    private PosPayosGiaoDichDto toGiaoDichDto(PosPayosPayment row, Map<Integer, String> tenKho, Map<Integer, String> tenNguoi) {
        List<PosPayosGiaoDichDto.Dong> items = new ArrayList<>();
        try {
            Map<Integer, String> names = tx.productNames(row);
            for (PosCheckoutCreating.PosCheckoutItemCreating i : tx.payload(row).getItems()) {
                items.add(PosPayosGiaoDichDto.Dong.builder()
                        .bienTheSanPhamId(i.getBienTheSanPhamId())
                        .tenSanPham(names.get(i.getBienTheSanPhamId()))
                        .soLuong(i.getQuantity())
                        .donGia(i.getUnitPriceClient())
                        .build());
            }
        } catch (RuntimeException e) {
            log.warn("Không đọc được giỏ hàng của giao dịch payOS {}: {}", row.getOrderCode(), e.getMessage());
        }
        PosCheckoutResponse result = null;
        try {
            result = PosPayosPayment.PAID.equals(row.getTrangThai())
                    ? tx.read(row.getResultJson(), PosCheckoutResponse.class) : null;
        } catch (RuntimeException e) {
            // Một dòng dữ liệu hỏng không được làm hỏng cả danh sách
            log.warn("Không đọc được kết quả đơn của giao dịch payOS {}: {}", row.getOrderCode(), e.getMessage());
        }
        return PosPayosGiaoDichDto.builder()
                .orderCode(row.getOrderCode())
                .trangThai(row.getTrangThai())
                .khoId(row.getKhoId())
                .tenKho(tenKho.get(row.getKhoId()))
                .nguoiThuNganId(row.getNguoiThuNganId())
                .tenThuNgan(tenNguoi.get(row.getNguoiThuNganId()))
                .soTien(row.getSoTien())
                .soTienDaNhan(row.getSoTienDaNhan())
                .noiDungCk(row.getNoiDungCk())
                .maGiaoDichNganHang(row.getMaGiaoDichNganHang())
                .errorMessage(row.getErrorMessage())
                .lyDo(lyDo(row))
                .tienVeSauHuy(row.isTienVeSauHuy())
                .tenNguoiChuyen(row.getTenNguoiChuyen())
                .nganHangNguoiChuyen(row.getNganHangNguoiChuyen())
                .soTkNguoiChuyen(row.getSoTkNguoiChuyen())
                .dangGiuCho(row.isDangGiuCho())
                .ngayTao(row.getNgayTao())
                .hetHanLuc(row.getHetHanLuc())
                .thanhToanLuc(row.getThanhToanLuc())
                .donBanHangId(row.getDonBanHangId())
                .soDonHang(result == null ? null : result.getSoDonHang())
                .tenNguoiXuLy(row.getNguoiXuLyId() == null ? null : tenNguoi.get(row.getNguoiXuLyId()))
                .xuLyLuc(row.getXuLyLuc())
                .ghiChuXuLy(row.getGhiChuXuLy())
                .items(items)
                .build();
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
        JsonNode giaoDichDau = r.data().path("transactions").path(0);
        if (amountPaid > 0) ghiNguoiChuyenAnToan(orderCode, giaoDichDau);
        if ("PAID".equals(status) || (amount > 0 && amountPaid >= amount)) {
            String reference = null;
            JsonNode tx0 = giaoDichDau;
            if (!tx0.isMissingNode()) reference = tx0.path("reference").asText(null);
            finalizeSafely(orderCode, BigDecimal.valueOf(amountPaid > 0 ? amountPaid : amount), reference, true);
            return "PAID";
        }
        if (amountPaid > 0) {
            // Khách mới chuyển một phần (payOS báo UNDERPAID): KHÔNG hủy/hết hạn (tiền một phần sẽ không được ghi
            // ở đâu) mà chuyển cho quản lý xử lý; hàng vẫn giữ chỗ.
            JsonNode tx0 = giaoDichDau;
            tx.markPaidError(orderCode, "khách mới chuyển " + amountPaid + "đ / " + amount + "đ",
                    tx0.isMissingNode() ? null : tx0.path("reference").asText(null), BigDecimal.valueOf(amountPaid), true);
            pushPaymentNotification(orderCode);
            return "PARTIAL";
        }
        if ("CANCELLED".equals(status) || "EXPIRED".equals(status) || "FAILED".equals(status)) {
            tx.closeUnpaid(orderCode, "CANCELLED".equals(status) ? PosPayosPayment.CANCELLED : PosPayosPayment.EXPIRED,
                    "payOS báo giao dịch " + status);
        }
        return status;
    }

    /** Ghi tài khoản người chuyển; lỗi ở bước phụ này không được chặn việc tạo đơn. */
    private void ghiNguoiChuyenAnToan(Long orderCode, JsonNode giaoDich) {
        try {
            tx.ghiNguoiChuyen(orderCode, giaoDich);
        } catch (RuntimeException e) {
            log.warn("payOS: không ghi được tài khoản người chuyển của đơn {}: {}", orderCode, e.getMessage());
        }
    }

    /** @param laTongDaNhan amount là TỔNG payOS đã nhận (hỏi trạng thái), không phải một lần chuyển (webhook). */
    private void finalizeSafely(Long orderCode, BigDecimal amount, String reference, boolean laTongDaNhan) {
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
            if (row != null && PosPayosPayment.REFUNDED.equals(row.getTrangThai())) {
                // Quản lý đã hoàn tiền rồi mà payOS gửi lại webhook: không phải lỗi mới.
                log.warn("payOS: webhook cho đơn {} đã hoàn tiền — bỏ qua (kiểm tra nếu là lần chuyển mới của khách)", orderCode);
                return;
            }
            log.error("payOS: đã nhận tiền đơn {} nhưng không tạo được đơn hàng", orderCode, e);
            String reason = PosConcurrencyRetry.isRetryable(e)
                    ? "nhiều giao dịch chạy cùng lúc, đã thử lại nhưng chưa được"
                    : (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
            tx.markPaidError(orderCode, reason, reference, amount, laTongDaNhan);
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
                .soTienDaNhan(row.getSoTienDaNhan())
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
