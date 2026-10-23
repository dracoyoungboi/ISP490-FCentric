package com.dev.backend.dto.response.congncc;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;

/** Kết quả POST /bao-gia: giờ máy chủ nhận báo giá (đã cắt về giây, đúng giá trị lưu CSDL) và tổng tiền máy chủ tính. */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class BaoGiaDaNhanDto implements Serializable {
    Instant ngayBaoGia;
    BigDecimal tongTien;
    /** true khi email Đã nhận báo giá (M3) đã được đưa vào hàng đợi gửi, tức nhà cung cấp có email nhận. */
    boolean daGuiEmailXacNhan;
    /** Địa chỉ M3 được xếp gửi tới; null nếu không gửi. Cổng hiện "Email xác nhận … tới {email}." theo trường này. */
    String emailXacNhan;
}
