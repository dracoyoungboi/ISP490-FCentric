-- Nâng cấp kiểu dữ liệu các cột token và khóa của bảng kenh_ban_hang lên TEXT
-- Lý do: Access Token và Refresh Token của TikTok Shop, Lazada sau khi mã hóa AES-GCM (base64) vượt quá 255 ký tự.
ALTER TABLE `kenh_ban_hang` MODIFY COLUMN `api_key` TEXT NULL;
ALTER TABLE `kenh_ban_hang` MODIFY COLUMN `api_secret` TEXT NULL;
ALTER TABLE `kenh_ban_hang` MODIFY COLUMN `refresh_token` TEXT NULL;
ALTER TABLE `kenh_ban_hang` MODIFY COLUMN `api_url` TEXT NULL;
ALTER TABLE `kenh_ban_hang` MODIFY COLUMN `token_expires_at` DATETIME(6) NULL;

