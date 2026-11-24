-- Migration: Dọn dẹp các kênh Sandbox thừa (SHOPEE_SANDBOX, LAZADA_SANDBOX)
-- và chuẩn hóa tên hiển thị của kênh SHOPEE_OFFICIAL thành 'Shopee'
-- Bảo toàn nguyên vẹn mã kênh SHOPEE_OFFICIAL, token OAuth, liên kết SKU và dữ liệu Shopee hiện hành.
-- Tương thích MySQL 8.x và chế độ idempotent (chạy lại nhiều lần an toàn).

-- 1. Chuẩn hóa tên mặc định của SHOPEE_OFFICIAL về 'Shopee' (giữ nguyên nếu đã là tên gian hàng thật khác)
UPDATE kenh_ban_hang
SET ten_kenh = 'Shopee',
    ngay_cap_nhat = NOW()
WHERE ma_kenh = 'SHOPEE_OFFICIAL'
  AND (
    ten_kenh IS NULL
    OR TRIM(ten_kenh) = ''
    OR ten_kenh IN ('Shopee Chính Thống', 'Shopee Chinh Thong', 'Shopee Official', 'Shopee Chính Thức', 'Gian hàng Shopee')
  );

-- 2. Gỡ tham chiếu FK fk_don_ban_kenh khỏi đơn hàng gắn kênh Sandbox (giữ nguyên lịch sử đơn hàng & kế toán)
UPDATE don_ban_hang d
JOIN kenh_ban_hang k ON k.id = d.kenh_ban_id
SET d.kenh_ban_id = NULL
WHERE k.ma_kenh IN ('SHOPEE_SANDBOX', 'LAZADA_SANDBOX');

-- 3. Xóa trạng thái đồng bộ SKU của các kênh Sandbox
DELETE t
FROM trang_thai_dong_bo_san_pham t
JOIN kenh_ban_hang k ON k.id = t.kenh_ban_id
WHERE k.ma_kenh IN ('SHOPEE_SANDBOX', 'LAZADA_SANDBOX');

-- 4. Xóa cấu hình hệ thống riêng của các kênh Sandbox
DELETE FROM cau_hinh_he_thong
WHERE ma_cau_hinh LIKE 'KENH_SHOPEE_SANDBOX_%'
   OR ma_cau_hinh LIKE 'KENH_LAZADA_SANDBOX_%';

-- 5. Xóa các bản ghi kênh Sandbox thừa khỏi bảng kenh_ban_hang
DELETE FROM kenh_ban_hang
WHERE ma_kenh IN ('SHOPEE_SANDBOX', 'LAZADA_SANDBOX');
