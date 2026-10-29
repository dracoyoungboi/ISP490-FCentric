package com.dev.backend.utils;

import com.dev.backend.constant.variables.ITrangThaiDonBanHang;

/**
 * Tiện ích ánh xạ trạng thái đơn hàng TikTok Shop sang FCentric DonBanHang (SRS 8.1.1).
 *
 * TikTok Shop v202309 order_status:
 * - UNPAID: Chưa thanh toán
 * - AWAITING_SHIPMENT: Chờ người bán đóng gói / gửi hàng
 * - AWAITING_COLLECTION: Đã đóng gói, chờ đơn vị vận chuyển lấy hàng
 * - IN_TRANSIT: Đang vận chuyển
 * - DELIVERED: Đã giao hàng
 * - COMPLETED: Đơn hoàn tất
 * - CANCELLED: Đơn đã hủy
 */
public final class TikTokOrderMapper {

    private TikTokOrderMapper() {}

    /**
     * Ánh xạ trạng thái TikTok Shop sang mã trạng thái FCentric DonBanHang (cột don_ban_hang.trang_thai).
     * 0 = Nháp / Chờ xử lý (AWAITING_SHIPMENT, AWAITING_COLLECTION, UNPAID)
     * 3 = Đã xuất toàn bộ / Đang giao (IN_TRANSIT)
     * 5 = Hoàn thành (DELIVERED, COMPLETED)
     * 4 = Đã hủy (CANCELLED)
     */
    public static int mapTrangThaiDonHang(String tiktokStatus) {
        if (tiktokStatus == null) return ITrangThaiDonBanHang.NHAP;
        String s = tiktokStatus.trim().toUpperCase();
        return switch (s) {
            case "IN_TRANSIT" -> ITrangThaiDonBanHang.DA_XUAT_TOAN_BO;
            case "DELIVERED", "COMPLETED" -> ITrangThaiDonBanHang.HOAN_THANH;
            case "CANCELLED" -> ITrangThaiDonBanHang.DA_HUY;
            default -> ITrangThaiDonBanHang.NHAP;
        };
    }

    /**
     * Ánh xạ trạng thái thanh toán từ TikTok Shop.
     * Trả về "da_thanh_toan" hoặc "chua_thanh_toan".
     */
    public static String mapTrangThaiThanhToan(String tiktokStatus, Long paidTime, String paymentMethod) {
        if ("UNPAID".equalsIgnoreCase(tiktokStatus)) {
            return "chua_thanh_toan";
        }
        if (paidTime != null && paidTime > 0) {
            return "da_thanh_toan";
        }
        if (paymentMethod != null && paymentMethod.toLowerCase().contains("cash")) {
            return "chua_thanh_toan";
        }
        return "da_thanh_toan";
    }
}
