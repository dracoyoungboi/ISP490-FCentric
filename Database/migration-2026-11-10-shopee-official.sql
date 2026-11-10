-- Migration: Khởi tạo kênh bán hàng Shopee Chính Thống (Shopee Open Platform v2 Official)
-- Tương thích 100% MySQL 8.x và schema FCentric

INSERT INTO kenh_ban_hang (ma_kenh, ten_kenh, loai_kenh, api_url, trang_thai, ngay_tao, ngay_cap_nhat)
VALUES ('SHOPEE_OFFICIAL', 'Shopee Chính Thống', 'online', 'https://partner.shopeemobile.com/api/v2', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE 
    ten_kenh = VALUES(ten_kenh),
    loai_kenh = VALUES(loai_kenh);

