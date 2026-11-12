-- Migration: Xóa dữ liệu 3 đơn hàng giả lập TikTok Shop Sandbox tồn đọng từ đợt thử nghiệm 31/10/2026
-- Mã đơn: TTS-579100234567801, TTS-579100234567802, TTS-579100234567803
-- Đảm bảo kênh TikTok Shop sạch 100% khi kết nối Production thật với TikTok Shop Partner API v202309

START TRANSACTION;

-- 1. Xóa chi tiết đơn hàng mẫu
DELETE FROM `chi_tiet_don_ban_hang`
WHERE `don_ban_hang_id` IN (175, 176, 177);

-- 2. Xóa đơn hàng mẫu
DELETE FROM `don_ban_hang`
WHERE `id` IN (175, 176, 177)
  AND `kenh_ban_id` = 5
  AND `so_don_hang` IN ('TTS-579100234567801', 'TTS-579100234567802', 'TTS-579100234567803');

COMMIT;
