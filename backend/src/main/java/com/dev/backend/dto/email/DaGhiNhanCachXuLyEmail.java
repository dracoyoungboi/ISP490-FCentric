package com.dev.backend.dto.email;

import java.util.List;

/**
 * M5 · Đã ghi nhận câu trả lời của nhà cung cấp cho biên bản trả hàng, hoặc ({@code tuDong}) quá hạn trả lời nên các dòng
 * chưa chọn cách bù đã chuyển trừ tiền, hoặc ({@code chonLai}) lúc nhập kho không trừ tiền được cho một số dòng nên mời
 * nhà cung cấp chọn lại. Không đính kèm (PDF biên bản đã gửi ở E7).
 *
 * @param hanTraLoi    "30/11/2026" (câu quá hạn); null thì bỏ
 * @param cachBu       "Giao bù hàng" | "Trừ tiền hàng" | "Theo từng sản phẩm"; null khi chưa có
 * @param moTaCachBu   "Trừ 1.820.000 ₫ khi thanh toán" | "Giao lại 4 sản phẩm đạt"…
 * @param hangLoi      "Nhận lại hàng lỗi" | "Đồng ý tiêu hủy" | "Theo từng sản phẩm"; null khi chưa chọn / hàng đã rời kho
 * @param moTaHangLoi  dòng phụ của ô hàng lỗi
 * @param soSanPham    tổng số lượng lỗi của biên bản ({@code tuDong}: số vừa chuyển trừ tiền)
 * @param nguoiXacNhan người bên nhà cung cấp vừa trả lời; null thì bỏ dòng
 * @param luc          "14:35 ngày 19/10/2026" = lúc ghi nhận
 * @param ghiChuDoi    câu về việc còn đổi / còn phải chọn
 * @param duongDanCong cổng nhà cung cấp kèm ?bienBan=&email=
 * @param dong         lựa chọn của từng dòng sản phẩm lỗi (bảng trong thư khi có từ 2 dòng, hoặc khi chọn lại)
 * @param chonLai      thư mời chọn lại cách bù cho các dòng {@link DongLuaChon#canChonLai()}
 */
public record DaGhiNhanCachXuLyEmail(String tenNhaCungCap, String maBienBan, String maDon, boolean tuDong, String hanTraLoi, String cachBu, String moTaCachBu,
                                     String hangLoi, String moTaHangLoi, long soSanPham, String nguoiXacNhan,
                                     String luc, List<String> ghiChuDoi, String duongDanCong, List<DongLuaChon> dong,
                                     boolean chonLai) {

    public DaGhiNhanCachXuLyEmail {
        ghiChuDoi = List.copyOf(ghiChuDoi);
        dong = dong == null ? List.of() : List.copyOf(dong);
    }

    /** Thư một lựa chọn cho cả biên bản (không có bảng từng dòng). */
    public DaGhiNhanCachXuLyEmail(String tenNhaCungCap, String maBienBan, String maDon, boolean tuDong, String hanTraLoi,
                                  String cachBu, String moTaCachBu, String hangLoi, String moTaHangLoi, long soSanPham,
                                  String nguoiXacNhan, String luc, List<String> ghiChuDoi, String duongDanCong) {
        this(tenNhaCungCap, maBienBan, maDon, tuDong, hanTraLoi, cachBu, moTaCachBu, hangLoi, moTaHangLoi, soSanPham,
                nguoiXacNhan, luc, ghiChuDoi, duongDanCong, List.of(), false);
    }

    /** Có bảng lựa chọn từng dòng trong thư. */
    public boolean coBangDong() {
        return dong.size() > 1 || chonLai;
    }

    /**
     * Một dòng trong bảng: "Áo Polo" + "Trắng · L", lý do lỗi, số lượng, cách bù ("Trừ tiền · 300.000 ₫", "Giao bù",
     * "Cần chọn lại"…), hàng lỗi ("Nhận lại", "Đồng ý tiêu hủy", "Đã giao trả"…; null: chưa chọn).
     */
    public record DongLuaChon(String tenSanPham, String phanLoai, String lyDo, int soLuong, String cachBu, String hangLoi,
                              boolean canChonLai) {
    }
}
