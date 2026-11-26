package com.dev.backend.dto.email;

import java.util.List;

/**
 * E4 · Yêu cầu báo giá (một nhà cung cấp, một đơn). Cũng dùng cho thư nhắc hạn ({@code nhacHan}).
 *
 * @param ngayCanGiao      "26/10/2026"; null thì bỏ dòng
 * @param tongSoLuong      "360 cái" chỉ khi mọi dòng cùng đơn vị tính; khác nhau thì null
 * @param duongDanCong     cổng nhà cung cấp kèm ?id=&email= (đã mã hóa)
 * @param duongDanCongGoc  cổng không kèm tham số (dòng "Hoặc mở …")
 * @param hanBaoGia        "01/12/2026": nhà cung cấp gửi được đến hết ngày này; null (đơn gửi trước khi có hạn) thì bỏ
 * @param nhacHan          true: thư nhắc còn một ngày tới hạn (tiêu đề, câu mở đầu khác)
 */
public record YeuCauBaoGiaEmail(String tenNhaCungCap, String maDon, String tenKho, String diaChiKho,
                                String ngayCanGiao, int soMatHang, List<DongSanPhamEmail> dong,
                                String tongSoLuong, String duongDanCong, String duongDanCongGoc,
                                String nhanDuongDanCong, String hanBaoGia, boolean nhacHan) {
    public YeuCauBaoGiaEmail {
        dong = List.copyOf(dong);
    }

    /** Thư E4 không có hạn (đơn gửi trước khi có hạn báo giá). */
    public YeuCauBaoGiaEmail(String tenNhaCungCap, String maDon, String tenKho, String diaChiKho,
                             String ngayCanGiao, int soMatHang, List<DongSanPhamEmail> dong,
                             String tongSoLuong, String duongDanCong, String duongDanCongGoc,
                             String nhanDuongDanCong) {
        this(tenNhaCungCap, maDon, tenKho, diaChiKho, ngayCanGiao, soMatHang, dong, tongSoLuong, duongDanCong,
                duongDanCongGoc, nhanDuongDanCong, null, false);
    }
}
