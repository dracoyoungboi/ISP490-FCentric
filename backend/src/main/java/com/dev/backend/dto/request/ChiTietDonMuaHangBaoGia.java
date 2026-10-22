package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class ChiTietDonMuaHangBaoGia {
    /** id dòng chi_tiet_don_mua_hang. Máy chủ ghép đơn giá theo id dòng, không theo thứ tự danh sách. */
    Integer chiTietDonMuaHangId;
    /** Trường cũ của cổng, cũng là id dòng: dùng khi thiếu chiTietDonMuaHangId (hai trường có mà khác nhau thì 400). */
    Integer id;
    BigDecimal donGia;
    /** Máy chủ tự tính thành tiền, bỏ qua giá trị client gửi. */
    BigDecimal thanhTien;
    /** Ghi chú theo dòng (cổng cũ): không lưu, chỉ có một ghi chú cho cả báo giá (DonMuaHangBaoGia.ghiChu). */
    String ghiChu;
}
