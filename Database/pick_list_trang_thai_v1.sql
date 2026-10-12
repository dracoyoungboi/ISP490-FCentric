-- =====================================================================
-- Sửa lỗi "Hoàn tất nhặt" báo "Có lỗi xảy ra, vui lòng thử lại sau."
-- Nguyên nhân: cột danh_sach_nhat_hang.trang_thai là ENUM
--   ('cho_nhat','dang_nhat','hoan_tat','huy')
-- nhưng backend (NhatHangServiceImpl) và frontend (constants/outbound.js)
-- dùng bộ mã: cho_nhat → dang_nhat → da_nhat → da_xuat / da_huy.
-- Ghi 'da_nhat' vào ENUM không có giá trị này → MySQL báo
--   "Data truncated for column 'trang_thai'" → giao dịch rollback → 500.
-- Script này đưa DB về đúng bộ mã code đang dùng. Chạy 1 lần.
-- =====================================================================

-- 0) Kiểm tra trước (chỉ đọc)
SHOW COLUMNS FROM danh_sach_nhat_hang LIKE 'trang_thai';
SELECT trang_thai, COUNT(*) AS so_phieu FROM danh_sach_nhat_hang GROUP BY trang_thai;

-- MySQL Workbench bật "Safe Updates" sẽ chặn UPDATE không theo khóa chính
SET SQL_SAFE_UPDATES = 0;

-- 1) Mở rộng ENUM: giữ cả giá trị cũ để không mất dữ liệu đang có
ALTER TABLE danh_sach_nhat_hang
  MODIFY COLUMN trang_thai
  ENUM('cho_nhat','dang_nhat','da_nhat','da_xuat','da_huy','hoan_tat','huy')
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'cho_nhat';

-- 2) Đổi giá trị cũ sang bộ mã mới (thường là 0 dòng vì code chưa từng ghi 2 giá trị này)
UPDATE danh_sach_nhat_hang SET trang_thai = 'da_nhat' WHERE trang_thai = 'hoan_tat';
UPDATE danh_sach_nhat_hang SET trang_thai = 'da_huy'  WHERE trang_thai = 'huy';

-- 3) Thu gọn ENUM về đúng bộ mã code dùng
ALTER TABLE danh_sach_nhat_hang
  MODIFY COLUMN trang_thai
  ENUM('cho_nhat','dang_nhat','da_nhat','da_xuat','da_huy')
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'cho_nhat';

SET SQL_SAFE_UPDATES = 1;

-- 4) Kiểm tra lại
SHOW COLUMNS FROM danh_sach_nhat_hang LIKE 'trang_thai';
