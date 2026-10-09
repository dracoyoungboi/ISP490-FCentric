package com.dev.backend.services;

public interface KenhBanHangSyncService {
    /**
     * Đẩy trạng thái giao hàng / xuất kho sang kênh bán hàng bên thứ ba (Shopify, Shopee, TikTok Shop...).
     * Chạy độc lập ngoài transaction chính để chống timeout/deadlock.
     */
    void pushOrderStatus(Integer donBanHangId, String channelStatus, String maVanDon, String donViVanChuyen);
}

