package com.dev.backend.dto.email;

import java.util.List;

/**
 * E4 · Yêu cầu báo giá (một nhà cung cấp, một đơn).
 *
 * @param ngayCanGiao      "26/10/2026"; null thì bỏ dòng
 * @param tongSoLuong      "360 cái" chỉ khi mọi dòng cùng đơn vị tính; khác nhau thì null
 * @param duongDanCong     cổng nhà cung cấp kèm ?id=&email= (đã mã hóa)
 * @param duongDanCongGoc  cổng không kèm tham số (dòng "Hoặc mở …")
 */
public record YeuCauBaoGiaEmail(String tenNhaCungCap, String maDon, String tenKho, String diaChiKho,
                                String ngayCanGiao, int soMatHang, List<DongSanPhamEmail> dong,
                                String tongSoLuong, String duongDanCong, String duongDanCongGoc,
                                String nhanDuongDanCong) {
    public YeuCauBaoGiaEmail {
        dong = List.copyOf(dong);
    }
}
