package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

/** Trạng thái một giao dịch chuyển khoản payOS cho màn POS (QR + kết quả). */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PayosPaymentLinkDto {
    Long orderCode;
    String requestId;
    String trangThai;
    /** Số tiền của mã QR (= hóa đơn − tiền mặt trả trước). */
    BigDecimal soTien;
    /** Tiền mặt khách trả trước tại quầy (null = không có, QR trọn hóa đơn). */
    BigDecimal tienMatTruoc;
    /** Lúc quầy xác nhận đã trả lại khách phần tiền mặt (mã QR không thành). */
    Instant tienMatTraLaiLuc;
    /** Số tiền payOS báo đã nhận (PAID / PAID_ERROR). */
    BigDecimal soTienDaNhan;
    String qrCode;
    String checkoutUrl;
    String bin;
    String soTaiKhoan;
    String tenTaiKhoan;
    String noiDungCk;
    Instant hetHanLuc;
    String errorMessage;
    /** Có khi trangThai = PAID: kết quả đơn hàng giống checkout tiền mặt. */
    PosCheckoutResponse result;
}
