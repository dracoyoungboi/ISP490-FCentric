-- Migration: Khởi tạo kênh bán hàng Lazada Sandbox (Môi trường Thử nghiệm)
-- Kiến trúc: Dual-Channel Isolated Engine cho phép chạy song song Lazada Production và Lazada Sandbox
-- Tương thích 100% MySQL 8.x và schema FCentric

INSERT INTO kenh_ban_hang (ma_kenh, ten_kenh, loai_kenh, api_url, trang_thai, ngay_tao, ngay_cap_nhat)
VALUES ('LAZADA_SANDBOX', 'Lazada Sandbox (Môi trường Thử nghiệm)', 'online', 'https://api.lazada.vn/rest', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE 
    ten_kenh = VALUES(ten_kenh),
    loai_kenh = VALUES(loai_kenh);
