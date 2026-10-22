package com.dev.backend.dto.email;

import java.util.List;

/**
 * M1 · Xác nhận đặt hàng. Khối Thông tin xuất hóa đơn lấy từ cửa hàng lúc gửi (không nằm trong record).
 *
 * @param ngayChapNhan    "19/10/2026"
 * @param tongTienBangChu null khi không đọc được (tổng có phần lẻ): bỏ cụm "Bằng chữ"
 */
public record XacNhanDatHangEmail(String tenNhaCungCap, String maDon, String thoiDiemBaoGia, String tenKho,
                                  String diaChiKho, String ngayCanGiao, String ngayChapNhan,
                                  List<DongSanPhamEmail> dong, String tongSoLuong, String tongTien,
                                  String tongTienBangChu, String ghiChuNhaCungCap) {
    public XacNhanDatHangEmail {
        dong = List.copyOf(dong);
    }
}
