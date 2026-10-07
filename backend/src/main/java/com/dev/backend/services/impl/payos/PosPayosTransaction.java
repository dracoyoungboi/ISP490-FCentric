package com.dev.backend.services.impl.payos;

import com.dev.backend.dto.request.PosCheckoutCreating;
import com.dev.backend.dto.response.customize.PosCheckoutResponse;
import com.dev.backend.entities.PosPayosPayment;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.PosPayosPaymentRepository;
import com.dev.backend.services.impl.entities.PosCheckoutTransaction;
import com.dev.backend.services.impl.entities.PosCheckoutTransaction.CheckoutContext;
import com.dev.backend.services.impl.entities.PosCheckoutTransaction.ReservedLot;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Các bước GHI của luồng payOS, mỗi bước một transaction. Dòng pos_payos_payment luôn
 * được khóa (SELECT ... FOR UPDATE) trước khi đổi trạng thái, nên webhook, polling của
 * màn POS và job hết hạn có chạy cùng lúc cũng chỉ một bên được xử lý.
 */
@Service
public class PosPayosTransaction {

    private final PosPayosPaymentRepository repository;
    private final PosCheckoutTransaction checkoutTransaction;
    private final ObjectMapper objectMapper;

    public PosPayosTransaction(PosPayosPaymentRepository repository, PosCheckoutTransaction checkoutTransaction,
                               ObjectMapper objectMapper) {
        this.repository = repository;
        this.checkoutTransaction = checkoutTransaction;
        this.objectMapper = objectMapper;
    }

    /** Giữ chỗ hàng + tạo giao dịch PENDING (chưa gọi payOS). */
    @Transactional
    public PosPayosPayment createPending(PosCheckoutCreating request, Integer cashierId, int expiryMinutes) {
        PosCheckoutTransaction.ReservationResult reservation = checkoutTransaction.reserveForTransfer(request);

        // Chốt giá + phương thức vào payload: lúc tiền về sẽ tạo đơn đúng số tiền khách đã trả.
        PosCheckoutCreating locked = PosCheckoutCreating.builder()
                .requestId(request.getRequestId().trim())
                .khoId(request.getKhoId())
                .khachHangId(request.getKhachHangId())
                .note(request.getNote())
                .items(request.getItems().stream().map(i -> PosCheckoutCreating.PosCheckoutItemCreating.builder()
                        .bienTheSanPhamId(i.getBienTheSanPhamId())
                        .quantity(i.getQuantity())
                        .unitPriceClient(reservation.unitPrices().get(i.getBienTheSanPhamId()))
                        .build()).toList())
                .payment(PosCheckoutCreating.PosCheckoutPaymentCreating.builder()
                        .method(CheckoutContext.METHOD_PAYOS)
                        .tenderedAmount(reservation.total())
                        .build())
                .build();

        long orderCode = newOrderCode();
        Instant now = Instant.now();
        PosPayosPayment row = PosPayosPayment.builder()
                .orderCode(orderCode)
                .requestId(locked.getRequestId())
                .khoId(request.getKhoId())
                .nguoiThuNganId(cashierId)
                .soTien(reservation.total())
                .trangThai(PosPayosPayment.PENDING)
                .noiDungCk(description(orderCode))
                .payloadJson(write(Map.of("payload", locked, "productNames", reservation.productNames())))
                .giuChoJson(write(reservation.reserved()))
                .hetHanLuc(now.plusSeconds(expiryMinutes * 60L))
                .ngayTao(now)
                .ngayCapNhat(now)
                .build();
        return repository.save(row);
    }

    @Transactional
    public PosPayosPayment markLinkCreated(Long orderCode, JsonNode data) {
        PosPayosPayment row = lock(orderCode);
        row.setPaymentLinkId(text(data, "paymentLinkId"));
        row.setCheckoutUrl(text(data, "checkoutUrl"));
        row.setQrCode(text(data, "qrCode"));
        row.setBin(text(data, "bin"));
        row.setSoTaiKhoan(text(data, "accountNumber"));
        row.setTenTaiKhoan(text(data, "accountName"));
        row.setNgayCapNhat(Instant.now());
        return repository.save(row);
    }

    /**
     * Đóng giao dịch chưa thanh toán (FAILED / CANCELLED / EXPIRED) và trả lại hàng giữ chỗ.
     * Chỉ tác động khi đang PENDING — gọi lặp lại không trả hàng 2 lần.
     */
    @Transactional
    public PosPayosPayment closeUnpaid(Long orderCode, String newStatus, String message) {
        PosPayosPayment row = lock(orderCode);
        if (!PosPayosPayment.PENDING.equals(row.getTrangThai())) {
            return row;
        }
        checkoutTransaction.releaseReservation(row.getKhoId(), reserved(row));
        row.setTrangThai(newStatus);
        row.setErrorMessage(truncate(message));
        row.setNgayCapNhat(Instant.now());
        return repository.save(row);
    }

    /**
     * Tiền đã về: tạo đơn + trừ kho bằng đúng luồng checkout POS (giá đã chốt), idempotent.
     * PAID rồi -> trả kết quả đã lưu. PENDING -> trả giữ chỗ rồi trừ kho trong CÙNG transaction.
     * EXPIRED/CANCELLED (khách vẫn kịp trả) -> vẫn tạo đơn nếu còn đủ hàng.
     */
    @Transactional
    public PosCheckoutResponse finalizePaid(Long orderCode, BigDecimal paidAmount, String bankReference) {
        PosPayosPayment row = lock(orderCode);
        if (PosPayosPayment.PAID.equals(row.getTrangThai())) {
            return read(row.getResultJson(), PosCheckoutResponse.class);
        }
        if (PosPayosPayment.PAID_ERROR.equals(row.getTrangThai())) {
            throw new CommonException(row.getErrorMessage(), HttpStatus.CONFLICT, null);
        }
        if (paidAmount == null || paidAmount.compareTo(row.getSoTien()) != 0) {
            throw new CommonException("Số tiền nhận được (" + (paidAmount == null ? "?" : paidAmount.toPlainString())
                    + "đ) khác số tiền hóa đơn (" + row.getSoTien().toPlainString() + "đ)");
        }
        boolean stillReserved = PosPayosPayment.PENDING.equals(row.getTrangThai());
        PosCheckoutCreating payload = payload(row);
        Map<Integer, BigDecimal> lockedPrices = new HashMap<>();
        payload.getItems().forEach(i -> lockedPrices.put(i.getBienTheSanPhamId(), i.getUnitPriceClient()));

        PosCheckoutResponse result = checkoutTransaction.executeWith(payload, CheckoutContext.payos(
                row.getNguoiThuNganId(), paidAmount, lockedPrices, stillReserved ? reserved(row) : null));

        row.setTrangThai(PosPayosPayment.PAID);
        row.setDonBanHangId(result.getDonBanHangId());
        row.setResultJson(write(result));
        row.setMaGiaoDichNganHang(bankReference);
        row.setThanhToanLuc(Instant.now());
        row.setErrorMessage(null);
        row.setNgayCapNhat(Instant.now());
        repository.save(row);
        return result;
    }

    /** Đã nhận tiền nhưng không tạo được đơn: giữ nguyên hàng giữ chỗ, đánh dấu để quản lý xử lý tay. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markPaidError(Long orderCode, String message, String bankReference) {
        PosPayosPayment row = lock(orderCode);
        if (PosPayosPayment.PAID.equals(row.getTrangThai())) return;
        row.setTrangThai(PosPayosPayment.PAID_ERROR);
        row.setErrorMessage(truncate("Đã nhận tiền nhưng chưa tạo được đơn: " + message));
        if (bankReference != null) row.setMaGiaoDichNganHang(bankReference);
        row.setThanhToanLuc(Instant.now());
        row.setNgayCapNhat(Instant.now());
        repository.save(row);
    }

    // ================= helpers =================

    private PosPayosPayment lock(Long orderCode) {
        return repository.lockByOrderCode(orderCode)
                .orElseThrow(() -> new CommonException("Không tìm thấy giao dịch chuyển khoản " + orderCode, HttpStatus.NOT_FOUND, null));
    }

    /** Mã đơn payOS: thời gian (giây) × 1000 + số ngẫu nhiên — duy nhất, < 2^53 để JS đọc an toàn. */
    private long newOrderCode() {
        for (int i = 0; i < 10; i++) {
            long code = (System.currentTimeMillis() / 1000L) * 1000L + ThreadLocalRandom.current().nextInt(1000);
            if (!repository.existsByOrderCode(code)) return code;
        }
        throw new IllegalStateException("Không sinh được mã đơn payOS duy nhất");
    }

    /** Nội dung chuyển khoản ≤ 9 ký tự (giới hạn payOS cho tài khoản chưa liên kết). */
    public static String description(long orderCode) {
        String digits = String.valueOf(orderCode);
        return "FC" + digits.substring(Math.max(0, digits.length() - 7));
    }

    public List<ReservedLot> reserved(PosPayosPayment row) {
        if (row.getGiuChoJson() == null) return List.of();
        try {
            return objectMapper.readValue(row.getGiuChoJson(), new TypeReference<List<ReservedLot>>() {
            });
        } catch (Exception e) {
            throw new IllegalStateException("Không đọc được dữ liệu giữ chỗ của giao dịch " + row.getOrderCode(), e);
        }
    }

    public PosCheckoutCreating payload(PosPayosPayment row) {
        try {
            JsonNode root = objectMapper.readTree(row.getPayloadJson());
            return objectMapper.treeToValue(root.get("payload"), PosCheckoutCreating.class);
        } catch (Exception e) {
            throw new IllegalStateException("Không đọc được giỏ hàng của giao dịch " + row.getOrderCode(), e);
        }
    }

    public Map<Integer, String> productNames(PosPayosPayment row) {
        try {
            JsonNode node = objectMapper.readTree(row.getPayloadJson()).get("productNames");
            if (node == null) return Map.of();
            return objectMapper.convertValue(node, new TypeReference<Map<Integer, String>>() {
            });
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Không ghi được dữ liệu giao dịch payOS", e);
        }
    }

    public <T> T read(String json, Class<T> type) {
        if (json == null) return null;
        try {
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            throw new IllegalStateException("Không đọc được kết quả giao dịch payOS", e);
        }
    }

    private static String text(JsonNode data, String field) {
        if (data == null || data.get(field) == null || data.get(field).isNull()) return null;
        return data.get(field).asText();
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() > 500 ? s.substring(0, 500) : s;
    }
}
