-- =====================================================================
-- Chỉ bán lẻ: xóa 3 cột khách hàng không còn dùng – 2026-11-19
--
-- Backend mới thôi đọc / ghi khach_hang.loai_khach_hang, ma_so_thue, nguoi_lien_he (bỏ khách sỉ / doanh nghiệp).
-- Tệp này xóa hẳn 3 cột đó.
--
-- CHỈ CHẠY KHI cả hai điều sau đã xong (CSDL production dùng chung cho mọi backend):
--   1. Thay đổi bỏ loại khách đã gộp vào mọi nhánh còn chạy với CSDL này (Dev, PhanAnh, main): backend build từ nhánh
--      chưa gộp vẫn ánh xạ các cột này và lỗi "Unknown column" ở mọi lần đọc khách hàng (kể cả mở đơn hàng).
--   2. Mọi backend đang chạy (VPS fcentric.net, backend chạy ở máy từng người) đã lên bản mới.
-- Chạy sau migration-2026-11-19-chi-ban-le.sql.
-- Các script tạo dữ liệu cũ (pos_checkout_v1.sql, MyDB*.sql) còn ghi loai_khach_hang: đừng chạy lại sau khi xóa cột.
--
-- Dữ liệu cũ chép vào bk_cot_khach_20261119 trước khi xóa. Hoàn tác:
--   ALTER TABLE khach_hang
--     ADD COLUMN ma_so_thue varchar(14) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER ten_khach_hang,
--     ADD COLUMN nguoi_lien_he varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER ma_so_thue,
--     ADD COLUMN loai_khach_hang enum('le','si','doanh_nghiep') COLLATE utf8mb4_unicode_ci DEFAULT 'le' AFTER dia_chi;
--   UPDATE khach_hang k JOIN bk_cot_khach_20261119 b ON b.id = k.id
--      SET k.ma_so_thue = b.ma_so_thue, k.nguoi_lien_he = b.nguoi_lien_he, k.loai_khach_hang = b.loai_khach_hang;
-- Loại khách lúc này đều là 'le' (tệp trước đã đặt lại). Loại gốc (sỉ / doanh nghiệp) nằm ở bk_loai_khach_20261119:
--   UPDATE khach_hang k JOIN bk_loai_khach_20261119 b ON b.id = k.id SET k.loai_khach_hang = b.loai_khach_hang;
-- Bảng sao lưu đã có (chạy lần hai) thì CREATE TABLE báo lỗi và tệp dừng trước khi xóa cột.
-- Cách chạy: Workbench chạy cả tệp; hoặc mysql --default-character-set=utf8mb4 fashion_system < tệp này.
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE bk_cot_khach_20261119 AS
SELECT id, ma_khach_hang, ma_so_thue, nguoi_lien_he, loai_khach_hang FROM khach_hang;

ALTER TABLE khach_hang
  DROP COLUMN ma_so_thue,
  DROP COLUMN nguoi_lien_he,
  DROP COLUMN loai_khach_hang;
