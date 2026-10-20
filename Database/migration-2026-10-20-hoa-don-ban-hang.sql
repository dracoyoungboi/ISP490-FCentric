-- =====================================================================
-- Hóa đơn bán hàng – 2026-10-20 (phần 1/2: cột mới)
--
-- MẶC ĐỊNH CHỈ XEM TRƯỚC: chạy nguyên tệp với @chay_that = 0 không đổi gì trong CSDL, chỉ in ra
-- việc sẽ làm. Xem kỹ rồi mới đổi @chay_that = 1 và chạy lại.
--
-- Khi chạy thật:
--   1. thong_tin_cong_ty.ma_so_thue  : mã số thuế cửa hàng, in dưới tên ở đầu hóa đơn / phiếu.
--   2. khach_hang.ma_so_thue         : mã số thuế khách sỉ / doanh nghiệp, in ở mục Người mua.
--   3. san_pham_quan_ao.don_vi_tinh  : đơn vị tính in cột ĐVT; sản phẩm đang có nhận "Cái".
--   (Mục 4 – tách mẫu in hóa đơn tại quầy "pos_invoice" – nằm ở tệp riêng
--    migration-2026-10-20-hoa-don-ban-hang-mau-tai-quay.sql, chạy SAU, xem thứ tự bên dưới.)
--
-- THỨ TỰ CHẠY KHI TRIỂN KHAI:
--   B1. Tệp này (mục 1–3) – TRƯỚC khi khởi động backend mới: spring.jpa.hibernate.ddl-auto=none nên
--       backend mới đọc cột ma_so_thue / don_vi_tinh mà chưa có cột thì lỗi SQL. Backend + frontend
--       CŨ vẫn chạy bình thường sau tệp này (cột mới cho phép NULL / có mặc định, không đổi mẫu in).
--   B2. Triển khai backend + frontend mới, rồi TẢI LẠI NGAY (F5) MỌI máy bán tại quầy: từ lúc lên bản mới,
--       màn bán tại quầy CŨ mở tab in hóa đơn bằng frontend MỚI theo mẫu sales_invoice -> in A4 ra máy in
--       nhiệt (chạy mục 4 hay chưa cũng vậy).
--   B3. Tệp ...-mau-tai-quay.sql (mục 4) – chạy NGAY sau B2, không cần chờ các quầy tải lại (không chạy
--       trước B2). Chi tiết rủi ro ở chú thích đầu tệp đó.
--   Code mới chạy đúng khi CHƯA chạy mục 4 (đã kiểm 20/10): xem chú thích đầu tệp ...-mau-tai-quay.sql.
--
-- Không làm gì:
--   - Không xóa dòng nào, không đổi mẫu in.
--   - Cột mới đều cho phép NULL (riêng don_vi_tinh có mặc định 'Cái'), không đổi dữ liệu đang có.
--
-- Chống treo hệ thống:
--   - ADD COLUMN có mặc định chạy INSTANT trên MySQL 8 (không chép lại bảng). Chỉ chờ khóa bảng tối đa
--     5 giây (lock_wait_timeout = 5): quá 5 giây thì báo lỗi 1205, KHÔNG đổi gì.
--   - Gặp lỗi bất kỳ: đóng tab / kết nối (tệp dừng trước dòng trả lock_wait_timeout về cũ) rồi mở tab mới
--     chạy lại. ALTER tự lưu ngay nên không có gì để ROLLBACK. Không đụng sql_safe_updates (ALTER không bị ảnh hưởng).
--   - Chạy nhiều lần vẫn được: cột đã có thì bỏ qua.
--   - Không cần DELIMITER, chạy được trong MySQL Workbench và mysql CLI (MySQL 8).
--
-- Trước khi chạy thật: SAO LƯU 3 bảng thong_tin_cong_ty, khach_hang, san_pham_quan_ao
-- (vd. mysqldump fashion_system <bảng> > bk_20261020.sql).
-- =====================================================================

USE fashion_system;          -- đổi nếu CSDL của bạn tên khác
SET NAMES utf8mb4;           -- mysql CLI mặc định latin1 thì DEFAULT 'Cái' / COMMENT tiếng Việt bị lỗi mã

SET @chay_that = 0;          -- 0 = CHỈ XEM TRƯỚC, không đổi gì · 1 = CHẠY THẬT

SET @cho_khoa_cu = @@SESSION.lock_wait_timeout;
SET SESSION lock_wait_timeout = 5;

-- ---------------------------------------------------------------------
-- 1–3. Cột mới (chỉ thêm khi chưa có)
-- ---------------------------------------------------------------------
SET @co_mst_cong_ty = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thong_tin_cong_ty' AND COLUMN_NAME = 'ma_so_thue');
SET @co_mst_khach = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'khach_hang' AND COLUMN_NAME = 'ma_so_thue');
SET @co_dvt = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'san_pham_quan_ao' AND COLUMN_NAME = 'don_vi_tinh');

SET @sql = IF(@chay_that = 1 AND @co_mst_cong_ty = 0,
  'ALTER TABLE thong_tin_cong_ty ADD COLUMN ma_so_thue VARCHAR(14) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
     COMMENT ''Mã số thuế cửa hàng: 10 số, 10 số + -3 số (đơn vị phụ thuộc) hoặc 12 số'' AFTER ten_cong_ty',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@chay_that = 1 AND @co_mst_khach = 0,
  'ALTER TABLE khach_hang ADD COLUMN ma_so_thue VARCHAR(14) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
     COMMENT ''Mã số thuế khách sỉ / doanh nghiệp (in ở mục Người mua của hóa đơn)'' AFTER ten_khach_hang',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@chay_that = 1 AND @co_dvt = 0,
  'ALTER TABLE san_pham_quan_ao ADD COLUMN don_vi_tinh VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT ''Cái''
     COMMENT ''Đơn vị tính in trên hóa đơn / phiếu kho'' AFTER ten_san_pham',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- Kết quả
-- ---------------------------------------------------------------------
SELECT IF(@chay_that = 1, 'ĐÃ CHẠY THẬT', 'CHỈ XEM TRƯỚC — chưa đổi gì') AS che_do,
       IF(@co_mst_cong_ty = 0, 'thêm', 'đã có') AS `thong_tin_cong_ty.ma_so_thue`,
       IF(@co_mst_khach = 0, 'thêm', 'đã có') AS `khach_hang.ma_so_thue`,
       IF(@co_dvt = 0, 'thêm (sản phẩm đang có nhận Cái)', 'đã có') AS `san_pham_quan_ao.don_vi_tinh`;

SET SESSION lock_wait_timeout = @cho_khoa_cu;

-- ---------------------------------------------------------------------
-- Hoàn tác (chạy tay nếu cần; chỉ sau khi đã trả backend về bản cũ – backend mới cần các cột này;
-- hoàn tác mục 4 trước, xem cuối tệp ...-mau-tai-quay.sql):
--   ALTER TABLE thong_tin_cong_ty DROP COLUMN ma_so_thue;
--   ALTER TABLE khach_hang DROP COLUMN ma_so_thue;
--   ALTER TABLE san_pham_quan_ao DROP COLUMN don_vi_tinh;
-- ---------------------------------------------------------------------
