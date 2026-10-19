-- =====================================================================
-- Bỏ vai trò "khach_hang" khỏi bảng nguoi_dung – 2026-10-19 (bản 2)
--
-- MẶC ĐỊNH CHỈ XEM TRƯỚC: chạy nguyên tệp với @chay_that = 0 không đổi gì trong CSDL, chỉ in ra
-- việc sẽ làm, câu lệnh sẽ chạy và câu lệnh hoàn tác. Xem kỹ rồi mới đổi @chay_that = 1 và chạy lại.
--
-- Khi chạy thật:
--   1. Liệt kê tài khoản đang mang vai trò khach_hang.
--   2. Sao lưu đúng các dòng sắp đụng tới vào bảng bk_20261019_* (chỉ tạo khi có dòng).
--   3. Khóa các tài khoản đó (trang_thai = 0) và thu hồi phân quyền kho còn bật.
--   4. Xóa mẫu quyền của vai trò khach_hang (nếu có).
--   5. Bỏ giá trị 'khach_hang' khỏi ENUM nguoi_dung.vai_tro, CHỈ KHI không còn dòng nào mang giá trị này.
--      Giữ nguyên NOT NULL, mặc định, bảng mã, collation, chú thích và chỉ mục idx_vai_tro.
--
-- Không làm gì:
--   - Không xóa người dùng nào. Không đổi vai trò của ai.
--   - Không đụng lich_su_thay_doi (lịch sử cũ có chữ "khach_hang" trong JSON được giữ nguyên).
--
-- Chống treo hệ thống:
--   - Đổi cột cần khóa riêng bảng nguoi_dung trong chốc lát. Nếu có phiên khác đang mở giao dịch trên bảng
--     này, MySQL mặc định chờ tới 1 năm, và trong lúc chờ mọi truy vấn khác vào nguoi_dung (đăng nhập, kiểm tra
--     phiên ở mỗi request) phải xếp hàng sau nó: hệ thống như bị treo. Tệp này chỉ cho chờ tối đa 5 giây
--     (lock_wait_timeout = 5): quá 5 giây thì báo lỗi 1205, KHÔNG đổi gì, hệ thống chạy lại bình thường.
--   - Bảng nguoi_dung chỉ vài chục dòng: việc đổi cột xong trong chưa tới 1 giây. Trong lúc đổi, đọc vẫn chạy
--     (LOCK=SHARED), chỉ ghi vào nguoi_dung phải chờ chừng đó.
--   - Chạy nhiều lần vẫn được: lần sau chỉ làm phần còn thiếu, bảng sao lưu giữ nguyên bản lần đầu.
--   - Phiên chạy bật STRICT_ALL_TABLES: nếu lỡ còn dữ liệu không hợp lệ thì ALTER báo lỗi và không đổi gì.
--   - Không cần DELIMITER, chạy được trong MySQL Workbench và mysql CLI (MySQL 8).
--
-- Trước khi chạy thật: SAO LƯU (xem phụ lục A cuối tệp).
-- =====================================================================

USE fashion_system;          -- đổi nếu CSDL của bạn tên khác

SET @chay_that = 0;          -- 0 = CHỈ XEM TRƯỚC, không đổi gì · 1 = CHẠY THẬT

SET @sql_mode_cu = @@SESSION.sql_mode;
SET @safe_updates_cu = @@SESSION.sql_safe_updates;
SET @cho_khoa_cu = @@SESSION.lock_wait_timeout;
SET @cho_dong_cu = @@SESSION.innodb_lock_wait_timeout;
SET SESSION sql_mode = CONCAT_WS(',', NULLIF(@@SESSION.sql_mode, ''), 'STRICT_ALL_TABLES');
SET SESSION sql_safe_updates = 0;          -- Workbench bật mặc định, sẽ chặn UPDATE có JOIN
SET SESSION lock_wait_timeout = 5;         -- chờ khóa bảng tối đa 5 giây rồi bỏ (không làm treo hệ thống)
SET SESSION innodb_lock_wait_timeout = 10; -- chờ khóa dòng tối đa 10 giây

-- ---------------------------------------------------------------------
-- 1. Tài khoản đang mang vai trò khach_hang
-- ---------------------------------------------------------------------
SELECT nd.id, nd.ten_dang_nhap, nd.ho_ten, nd.email, nd.trang_thai,
       (SELECT COUNT(*) FROM phan_quyen_nguoi_dung_kho pq
         WHERE pq.nguoi_dung_id = nd.id AND pq.trang_thai = 1) AS so_kho_dang_bat
FROM nguoi_dung nd
WHERE nd.vai_tro = 'khach_hang'
ORDER BY nd.id;

SET @so_tai_khoan = (SELECT COUNT(*) FROM nguoi_dung WHERE vai_tro = 'khach_hang');

-- ---------------------------------------------------------------------
-- 2. Sao lưu (chỉ khi chạy thật và có dòng; đã có bảng sao lưu thì giữ nguyên bản cũ)
-- ---------------------------------------------------------------------
SET @sql = IF(@chay_that = 1 AND @so_tai_khoan > 0,
  'CREATE TABLE IF NOT EXISTS bk_20261019_nguoi_dung_khach_hang AS
     SELECT nd.* FROM nguoi_dung nd WHERE nd.vai_tro = ''khach_hang''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@chay_that = 1 AND @so_tai_khoan > 0,
  'CREATE TABLE IF NOT EXISTS bk_20261019_phan_quyen_khach_hang AS
     SELECT pq.* FROM phan_quyen_nguoi_dung_kho pq
     JOIN nguoi_dung nd ON nd.id = pq.nguoi_dung_id
     WHERE nd.vai_tro = ''khach_hang''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@chay_that = 1 AND @so_tai_khoan > 0,
  'CREATE TABLE IF NOT EXISTS bk_20261019_chi_tiet_quyen_khach_hang AS
     SELECT ct.* FROM chi_tiet_quyen_kho ct
     JOIN phan_quyen_nguoi_dung_kho pq ON pq.id = ct.phan_quyen_nguoi_dung_kho_id
     JOIN nguoi_dung nd ON nd.id = pq.nguoi_dung_id
     WHERE nd.vai_tro = ''khach_hang''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- 3. Khóa tài khoản và thu hồi phân quyền kho (một giao dịch; xem trước thì không dòng nào khớp)
-- ---------------------------------------------------------------------
START TRANSACTION;

UPDATE chi_tiet_quyen_kho ct
JOIN phan_quyen_nguoi_dung_kho pq ON pq.id = ct.phan_quyen_nguoi_dung_kho_id
JOIN nguoi_dung nd ON nd.id = pq.nguoi_dung_id
SET ct.trang_thai = 0
WHERE @chay_that = 1 AND nd.vai_tro = 'khach_hang' AND ct.trang_thai = 1;

UPDATE phan_quyen_nguoi_dung_kho pq
JOIN nguoi_dung nd ON nd.id = pq.nguoi_dung_id
SET pq.ngay_ket_thuc = IF(pq.ngay_ket_thuc IS NULL OR pq.ngay_ket_thuc > NOW(), NOW(), pq.ngay_ket_thuc),
    pq.trang_thai = 0
WHERE @chay_that = 1 AND nd.vai_tro = 'khach_hang' AND pq.trang_thai = 1;

UPDATE nguoi_dung
SET trang_thai = 0
WHERE @chay_that = 1 AND vai_tro = 'khach_hang' AND (trang_thai IS NULL OR trang_thai <> 0);

COMMIT;

-- ---------------------------------------------------------------------
-- 4. Mẫu quyền của vai trò khach_hang (bảng có từ 18/10; bình thường không có dòng nào)
-- ---------------------------------------------------------------------
SET @co_bang_mau = (SELECT COUNT(*) FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mau_quyen_vai_tro');
SET @sql = IF(@chay_that = 1 AND @co_bang_mau > 0,
  'DELETE FROM mau_quyen_vai_tro WHERE vai_tro = ''khach_hang''', 'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- 5. Bỏ 'khach_hang' khỏi ENUM (chỉ khi không còn dòng nào mang giá trị này)
-- ---------------------------------------------------------------------
SET @kieu = NULL, @cho_null = NULL, @mac_dinh = NULL, @bang_ma = NULL, @collation = NULL, @chu_thich = NULL;

SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_SET_NAME, COLLATION_NAME, COLUMN_COMMENT
INTO @kieu, @cho_null, @mac_dinh, @bang_ma, @collation, @chu_thich
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nguoi_dung' AND COLUMN_NAME = 'vai_tro';

SET @con_lai = (SELECT COUNT(*) FROM nguoi_dung WHERE vai_tro = 'khach_hang');
SET @kieu_moi = REPLACE(REPLACE(@kieu, ',''khach_hang''', ''), '''khach_hang'',', '');

-- Phần định nghĩa cột giữ nguyên (NOT NULL, mặc định, bảng mã, collation, chú thích)
SET @phan_giu = CONCAT(' CHARACTER SET ', @bang_ma, ' COLLATE ', @collation,
                       IF(@cho_null = 'NO', ' NOT NULL', ' NULL'),
                       IF(@mac_dinh IS NULL, '', CONCAT(' DEFAULT ', QUOTE(@mac_dinh))),
                       IF(IFNULL(@chu_thich, '') = '', '', CONCAT(' COMMENT ', QUOTE(@chu_thich))));

SET @con_trong_enum = (@kieu LIKE 'enum(%''khach_hang''%');
SET @du_dieu_kien = (@con_trong_enum
                     AND @con_lai = 0
                     AND @kieu_moi <> @kieu
                     AND (@mac_dinh IS NULL OR @mac_dinh <> 'khach_hang'));

SET @lenh_doi = IF(@du_dieu_kien,
  CONCAT('ALTER TABLE nguoi_dung MODIFY COLUMN vai_tro ', @kieu_moi, @phan_giu, ', ALGORITHM=COPY, LOCK=SHARED'),
  NULL);
SET @lenh_hoan_tac = IF(@du_dieu_kien,
  CONCAT('ALTER TABLE nguoi_dung MODIFY COLUMN vai_tro ', @kieu, @phan_giu),
  NULL);

SET @sql = IF(@chay_that = 1 AND @du_dieu_kien, @lenh_doi, 'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- 6. Kết quả (đọc theo từng dòng)
-- ---------------------------------------------------------------------
SET @kieu_bay_gio = (SELECT COLUMN_TYPE FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nguoi_dung' AND COLUMN_NAME = 'vai_tro');
SET @so_dang_mo = (SELECT COUNT(*) FROM nguoi_dung WHERE vai_tro = 'khach_hang' AND trang_thai = 1);

SELECT 1 AS stt, 'Chế độ' AS muc,
       IF(@chay_that = 1, 'CHẠY THẬT', 'XEM TRƯỚC (chưa đổi gì trong CSDL)') AS gia_tri
UNION ALL SELECT 2, 'Máy chủ · CSDL', CONCAT(@@hostname, ' · ', DATABASE(), ' · MySQL ', @@version)
UNION ALL SELECT 3, 'Tài khoản khach_hang', CONCAT(@con_lai, ' (đang mở: ', @so_dang_mo, ')')
UNION ALL SELECT 4, 'Cột vai_tro lúc bắt đầu', @kieu
UNION ALL SELECT 5, 'Cột vai_tro bây giờ', @kieu_bay_gio
UNION ALL SELECT 6, 'Lệnh đổi cột', IFNULL(@lenh_doi, 'Không có')
UNION ALL SELECT 7, 'Lệnh hoàn tác (chép lại để dành)', IFNULL(@lenh_hoan_tac, 'Không có')
UNION ALL SELECT 8, 'Kết quả',
  CASE
    WHEN @kieu IS NULL
      THEN 'DỪNG: không thấy cột nguoi_dung.vai_tro. Kiểm tra lại tên CSDL ở dòng USE.'
    WHEN NOT @con_trong_enum
      THEN 'CSDL đã không còn vai trò khach_hang từ trước. Không cần làm gì.'
    WHEN @kieu_bay_gio NOT LIKE '%''khach_hang''%'
      THEN 'XONG: đã bỏ khach_hang khỏi cột vai_tro. Lưu lại lệnh hoàn tác ở dòng 7.'
    WHEN @mac_dinh = 'khach_hang'
      THEN 'DỪNG: cột vai_tro đang có mặc định khach_hang, cần xem tay. Chưa đổi gì ở cột.'
    WHEN @con_lai > 0 AND @chay_that = 0
      THEN CONCAT('XEM TRƯỚC: có ', @con_lai, ' tài khoản khach_hang. Chạy thật sẽ khóa họ, cột chỉ đổi khi đã xử lý hết (phụ lục B).')
    WHEN @con_lai > 0
      THEN 'Đã khóa tài khoản khach_hang. Cột chưa đổi vì còn tài khoản: xử lý theo phụ lục B rồi chạy lại.'
    WHEN @chay_that = 0
      THEN 'XEM TRƯỚC: đủ điều kiện. Kiểm tra dòng 2 đúng máy chủ, chép lệnh hoàn tác ở dòng 7, rồi đổi @chay_that = 1 và chạy lại.'
    ELSE 'Chưa đổi được cột. Xem thông báo lỗi ở Output.'
  END;

COMMIT;  -- kết thúc giao dịch đọc nếu Workbench đang tắt Auto-commit (không để phiên giữ bảng)

SET SESSION sql_mode = @sql_mode_cu;
SET SESSION sql_safe_updates = @safe_updates_cu;
SET SESSION lock_wait_timeout = @cho_khoa_cu;
SET SESSION innodb_lock_wait_timeout = @cho_dong_cu;


-- =====================================================================
-- PHỤ LỤC (để chú thích, chỉ bỏ dấu "--" ở dòng cần dùng)
-- =====================================================================

-- A. Sao lưu trước khi chạy thật:
--    MySQL Workbench: Server > Data Export > tích fashion_system > Dump Structure and Data
--      > Export to Self-Contained File > Start Export.
--    Hoặc cửa sổ dòng lệnh trên máy có MySQL:
--    mysqldump -h <máy chủ> -P 3306 -u <tài khoản> -p --single-transaction --no-tablespaces fashion_system > fashion_system_truoc_bo_khach_hang.sql

-- B. Tài khoản khach_hang còn lại sau bước 3 (đã khóa). Xử lý từng người rồi chạy lại cả tệp:
--    B1. Nhân viên bị đổi nhầm sang khách hàng: trả về đúng vai trò (vẫn để khóa, mở khóa ở giao diện khi cần).
--        UPDATE nguoi_dung SET vai_tro = 'nhan_vien_kho' WHERE id = <id> AND vai_tro = 'khach_hang';
--    B2. Tài khoản thử, không cần giữ: xóa. Nếu người này đã đứng tên chứng từ, phiếu, lịch sử... thì
--        khóa ngoại sẽ báo lỗi 1451 và KHÔNG xóa gì; khi đó dùng B1. Phân quyền kho của họ xóa theo (ON DELETE CASCADE),
--        đã có trong bảng sao lưu.
--        DELETE FROM nguoi_dung WHERE id = <id> AND vai_tro = 'khach_hang';

-- C. Hoàn tác bước 3 (mở lại đúng như trước khi chạy):
--    UPDATE nguoi_dung nd JOIN bk_20261019_nguoi_dung_khach_hang bk ON bk.id = nd.id
--       SET nd.trang_thai = bk.trang_thai;
--    UPDATE phan_quyen_nguoi_dung_kho pq JOIN bk_20261019_phan_quyen_khach_hang bk ON bk.id = pq.id
--       SET pq.trang_thai = bk.trang_thai, pq.ngay_ket_thuc = bk.ngay_ket_thuc;
--    UPDATE chi_tiet_quyen_kho ct JOIN bk_20261019_chi_tiet_quyen_khach_hang bk ON bk.id = ct.id
--       SET ct.trang_thai = bk.trang_thai;

-- D. Hoàn tác bước 5 (thêm lại giá trị vào ENUM): chạy đúng câu ở dòng 7 "Lệnh hoàn tác" trong kết quả.
--    Với định nghĩa cột như Database/MyDB.sql, câu đó là:
--    ALTER TABLE nguoi_dung MODIFY COLUMN vai_tro
--      enum('quan_tri_vien','quan_ly_kho','nhan_vien_kho','nhan_vien_ban_hang','nhan_vien_mua_hang','khach_hang')
--      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

-- E. Dọn bảng sao lưu khi đã chắc chắn (vài ngày sau):
--    DROP TABLE IF EXISTS bk_20261019_nguoi_dung_khach_hang, bk_20261019_phan_quyen_khach_hang,
--                         bk_20261019_chi_tiet_quyen_khach_hang;
