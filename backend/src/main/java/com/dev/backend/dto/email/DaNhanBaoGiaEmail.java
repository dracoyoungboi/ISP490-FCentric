package com.dev.backend.dto.email;

import java.util.List;

/**
 * M3 · Đã nhận báo giá.
 *
 * @param thoiDiemBaoGia   "14:35 ngày 19/10/2026" = ngayBaoGia
 * @param tongTien         "51.400.000 ₫" = tổng các thành tiền tự tính
 * @param ghiChuNhaCungCap null thì bỏ khối ghi chú
 */
public record DaNhanBaoGiaEmail(String tenNhaCungCap, String maDon, String thoiDiemBaoGia,
                                List<DongSanPhamEmail> dong, String tongSoLuong, String tongTien,
                                String ghiChuNhaCungCap, String duongDanCong) {
    public DaNhanBaoGiaEmail {
        dong = List.copyOf(dong);
    }
}
