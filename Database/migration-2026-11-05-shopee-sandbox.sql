-- Migration: Khởi tạo kênh bán hàng Shopee Sandbox (Môi trường Thử nghiệm)
-- Kiến trúc: Dual-Channel Isolated Engine cho phép chạy song song Shopee Production và Shopee Sandbox
-- Tương thích 100% MySQL 8.x và schema FCentric

INSERT INTO kenh_ban_hang (ma_kenh, ten_kenh, loai_kenh, api_url, trang_thai, ngay_tao, ngay_cap_nhat)
VALUES ('SHOPEE_SANDBOX', 'Shopee Sandbox (Môi trường Thử nghiệm)', 'online', 'https://partner.shopeemobile.com/api/v2', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE 
    ten_kenh = VALUES(ten_kenh),
    loai_kenh = VALUES(loai_kenh);
