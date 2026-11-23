package com.dev.backend.dto.email;

import java.util.List;

/**
 * M5 · Đã ghi nhận câu trả lời của nhà cung cấp cho biên bản trả hàng, hoặc ({@code tuDong}) quá hạn trả lời nên cách bù
 * đã chuyển trừ tiền. Không đính kèm (PDF biên bản đã gửi ở E7).
 *
 * @param hanTraLoi    "30/11/2026" (câu quá hạn); null thì bỏ
 * @param cachBu       "Giao bù hàng" | "Trừ tiền hàng"; null khi chưa có
 * @param moTaCachBu   "Trừ 1.820.000 ₫ khi thanh toán" | "Giao lại 4 sản phẩm đạt"…
 * @param hangLoi      "Nhận lại hàng lỗi" | "Đồng ý tiêu hủy"; null khi chưa chọn / hàng đã rời kho
 * @param moTaHangLoi  dòng phụ của ô hàng lỗi
 * @param soSanPham    tổng số lượng lỗi của biên bản
 * @param nguoiXacNhan người bên nhà cung cấp vừa trả lời; null thì bỏ dòng
 * @param luc          "14:35 ngày 19/10/2026" = lúc ghi nhận
 * @param ghiChuDoi    câu về việc còn đổi / còn phải chọn
 * @param duongDanCong cổng nhà cung cấp kèm ?bienBan=&email=
 */
public record DaGhiNhanCachXuLyEmail(String tenNhaCungCap, String maBienBan, String maDon, boolean tuDong, String hanTraLoi, String cachBu, String moTaCachBu,
                                     String hangLoi, String moTaHangLoi, long soSanPham, String nguoiXacNhan,
                                     String luc, List<String> ghiChuDoi, String duongDanCong) {

    public DaGhiNhanCachXuLyEmail {
        ghiChuDoi = List.copyOf(ghiChuDoi);
    }
}
