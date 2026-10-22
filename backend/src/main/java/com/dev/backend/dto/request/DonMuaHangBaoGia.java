package com.dev.backend.dto.request;


import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.List;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class DonMuaHangBaoGia {
    /** id đơn mua; phải trùng đơn của phiên báo giá. */
    Integer id;
    /** Không dùng: trạng thái giữ 2, máy chủ quyết định. */
    Integer trangThai;
    /** Không dùng: máy chủ tự tính tổng tiền từ đơn giá. */
    BigDecimal tongTien;
    /** Ghi chú của nhà cung cấp cho cả báo giá (lưu ghi_chu_nha_cung_cap), tối đa 2.000 ký tự. */
    String ghiChu;
    List<ChiTietDonMuaHangBaoGia> chiTietDonMuaHangBaoGias;
}
