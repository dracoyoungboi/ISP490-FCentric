package com.dev.backend.dto.response;

/**
 * Số liệu tóm tắt của một kho cho popup Chi tiết kho (GET /api/v1/kho/{id}/tom-tat).
 * Cùng cách tính với khối Tồn kho của màn Tổng quan (TongQuanAdminRepository.CTE_TON_THEO_CAP),
 * nhưng không lọc trạng thái kho: kho ngừng hoạt động vẫn giữ tồn và vẫn xem được.
 *
 * @param soLuongTon        tổng tồn thực tế (Σ so_luong_ton)
 * @param soLuongKhaDung    tồn khả dụng (Σ so_luong_kha_dung = tồn − đang giữ)
 * @param soLuongDangGiu    đang giữ cho POS / phiếu xuất chuyển kho (Σ so_luong_da_dat)
 * @param giaTriTon         giá trị tồn theo giá vốn lô (Σ so_luong_ton × lo_hang.gia_von), đồng
 * @param soMaHang          số mã hàng (biến thể đang kinh doanh) đã từng có lô ở kho này
 * @param soMaHetHang       trong số đó, khả dụng ≤ 0
 * @param soMaSapHet        trong số đó, 0 < khả dụng ≤ ngưỡng (mức tồn tối thiểu của sản phẩm, chưa đặt thì
 *                          dùng cấu hình DEFAULT_MIN_STOCK_ALERT)
 * @param nguongSapHet      ngưỡng mặc định đang dùng (DEFAULT_MIN_STOCK_ALERT)
 * @param soNguoiPhanQuyen  số người đang được phân quyền ở kho (tài khoản hoạt động, quyền còn hiệu lực),
 *                          không tính người quản lý chính của kho
 */
public record KhoTomTatResponse(
        Integer khoId,
        long soLuongTon,
        long soLuongKhaDung,
        long soLuongDangGiu,
        long giaTriTon,
        long soMaHang,
        long soMaHetHang,
        long soMaSapHet,
        int nguongSapHet,
        long soNguoiPhanQuyen
) {
}
