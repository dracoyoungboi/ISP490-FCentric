package com.dev.backend.constant.variables;

import java.util.List;

/**
 * Giá trị trạng thái đơn bán hàng (cột don_ban_hang.trang_thai).
 * Luồng kho: 0 Nháp → 1 Chờ nhặt hàng → 7 Chờ đóng gói → 8 Chờ xuất kho → 3 Đã xuất kho → 5 Hoàn thành.
 * KHÔNG đổi nghĩa số cũ (POS, báo cáo, đồng bộ sàn đọc các số này); trạng thái mới thì thêm số mới.
 * Tên cũ CHO_XUAT_KHO (= 1) đã đổi thành CHO_NHAT_HANG và không dùng lại cho số khác, để code cũ còn
 * dùng tên này báo lỗi biên dịch thay vì âm thầm đổi nghĩa.
 * Comment cột được chuẩn hóa trong Database/dong_goi_v1.sql.
 */
public interface ITrangThaiDonBanHang {
    int NHAP = 0;             // Nháp
    int CHO_NHAT_HANG = 1;    // Đã gửi kho, chờ nhặt hàng (kể cả khi đang nằm trong phiếu nhặt chưa nhặt xong)
    int DANG_XUAT_KHO = 2;    // Đã xuất một phần (còn hàng chưa xuất) / báo giá đã chốt
    int DA_XUAT_TOAN_BO = 3;  // Đã xuất toàn bộ (đang giao)
    int DA_HUY = 4;           // Đã hủy / từ chối
    int HOAN_THANH = 5;       // Hoàn thành (đơn POS kết thúc ở đây)
    int BI_HOAN_TRA = 6;      // Bị hoàn trả
    int CHO_DONG_GOI = 7;     // Đã nhặt xong, có phiếu xuất nháp, chờ đóng gói (Scan-to-Pack)
    int DA_DONG_GOI = 8;      // Đã đóng gói, phiếu xuất "Chờ xuất" — hiển thị "Chờ xuất kho"

    /** Đơn bán còn giữ hàng: chưa xuất hết, chưa hủy. Dùng cho mọi công thức tồn khả dụng. */
    List<Integer> DANG_GIU_HANG = List.of(NHAP, CHO_NHAT_HANG, DANG_XUAT_KHO, CHO_DONG_GOI, DA_DONG_GOI);
}
