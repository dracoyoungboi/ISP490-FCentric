-- =====================================================================
-- Migration 27/10/2026 — Ghi nhận thanh toán (bản gọn): tiền mặt + chuyển khoản cho đơn bán thường, trả kết hợp
-- tiền mặt + QR payOS tại quầy
-- MẶC ĐỊNH CHỈ XEM TRƯỚC: tệp chỉ báo hiện trạng và số dòng sẽ đổi. Đổi @chay_that = 1 để chạy thật.
--
-- Thêm:
--   a. Bảng thanh_toan_don_ban — phiếu thu (THU) / phiếu hoàn (HOAN) của đơn bán thường. Phiếu không sửa, không xóa:
--      ghi nhầm thì quản trị viên hủy (trang_thai = DA_HUY) có lý do. Bán tại quầy KHÔNG ghi vào bảng này (vẫn dùng sổ
--      thu pos_payment). Bảng có sẵn (đã chạy bản luồng thu tiền đầy đủ trước đây) thì chỉ thêm cột còn thiếu.
--   b. Giá trị mới cho don_ban_hang.trang_thai_thanh_toan: thanh_toan_mot_phan, can_hoan_tien (thêm vào cuối ENUM).
--   c. pos_payos_payment.tien_mat_truoc — tiền mặt khách trả trước tại quầy, mã QR chỉ mang phần còn lại;
--      tien_mat_tra_lai_luc, nguoi_tra_lai_tien_mat_id — quầy xác nhận đã trả lại khách số tiền mặt đó khi mã QR bị
--      hủy / hết hạn.
--   d. pos_payment.tien_mat_truoc — phần tiền mặt của lần trả kết hợp (dòng PAYOS); trống = không có.
--   f. don_ban_hang.thue_suat_gtgt, tien_thue_gtgt — thuế GTGT chụp lúc chốt đơn (giá đã gồm thuế); trống = hóa đơn không
--      in thuế. Bật / tắt và lịch thuế suất ở Cấu hình › Thuế GTGT (backend tự thêm 2 dòng cấu hình VAT_BAT = tắt,
--      VAT_LICH = 8% từ 01/07/2025, 10% từ 01/01/2027 khi khởi động).
-- Dữ liệu (chỉ khi chạy thật):
--   e. Đơn bán thường tạo trước ngày bắt đầu (không phải báo giá, không phải đơn sàn, không bán tại quầy, chưa có phiếu
--      thu nào) chuyển về trống = "Chưa theo dõi": không tính vào Còn phải thu. Gồm đơn "Chưa thanh toán" và đơn còn "Đã
--      thanh toán" / giá trị rỗng do bản luồng thu tiền đầy đủ để lại (phiếu thu của bản đó đã bị thu hồi 26–27/10).
--      Ghi phiếu thu cho đơn nào thì đơn đó bắt đầu được theo dõi.
--      Ngày bắt đầu lưu ở cấu hình THANH_TOAN_DON_THUONG_TU (lần chạy thật đầu tiên ghi = hôm nay theo giờ Việt Nam); chạy
--      lại vào ngày khác vẫn dùng ngày đã lưu, không đụng đơn tạo sau ngày đó.
--      Hoàn tác: UPDATE don_ban_hang SET trang_thai_thanh_toan = 'chua_thanh_toan'
--      WHERE trang_thai_thanh_toan IS NULL AND loai_chung_tu = 'don_ban_hang';
--
-- Không xóa dữ liệu. Chạy lại bao nhiêu lần cũng được (thiếu gì thêm nấy).
--
-- Thứ tự triển khai:
--   B0. Sao lưu: mysqldump fashion_system don_ban_hang pos_payment pos_payos_payment cau_hinh_he_thong > bk_thanh_toan_v2_20261027.sql
--   B1. Chạy tệp này với @chay_that = 1 TRƯỚC khi lên backend mới (backend dùng ddl-auto=none: thiếu bảng / cột thì
--       mọi lần đọc giao dịch payOS, thanh toán tại quầy, chi tiết đơn đều lỗi). Backend cũ vẫn chạy được sau B1 (bảng,
--       cột mới cho phép trống; đơn cũ "Chưa theo dõi" backend cũ hiện như chưa thanh toán).
--   B2. Lên backend + frontend mới.
-- =====================================================================
SET NAMES utf8mb4;           -- mysql CLI mặc định latin1 thì chữ tiếng Việt trong COMMENT bị lỗi mã

USE fashion_system;          -- đổi nếu CSDL của bạn tên khác

SET @chay_that = 0;          -- 0 = CHỈ XEM TRƯỚC, không đổi gì · 1 = CHẠY THẬT

-- Giờ Việt Nam cho ngày bắt đầu và so với ngay_tao (máy chủ CSDL có thể để UTC)
SET @mui_gio_cu = @@SESSION.time_zone;
SET SESSION time_zone = '+07:00';
-- Ngày bắt đầu: lấy ngày đã lưu ở lần chạy thật trước, chưa có thì hôm nay
SET @moc = COALESCE((SELECT STR_TO_DATE(gia_tri, '%Y-%m-%d') FROM cau_hinh_he_thong
                      WHERE ma_cau_hinh = 'THANH_TOAN_DON_THUONG_TU' LIMIT 1), CURDATE());

-- Tệp bị đổi mã chữ thì chữ "ư" không còn là 2 byte C6 B0: dừng, không đổi gì
SET @ma_ok = IF(HEX('ư') = 'C6B0', 1, 0);
SET @lam = IF(@chay_that = 1 AND @ma_ok = 1, 1, 0);

SET @cho_khoa_cu = @@SESSION.lock_wait_timeout;
SET @cho_khoa_dong_cu = @@SESSION.innodb_lock_wait_timeout;
SET @an_toan_cu = @@SESSION.sql_safe_updates;
SET SESSION lock_wait_timeout = 5;
SET SESSION innodb_lock_wait_timeout = 5;
-- Workbench mặc định bật Safe Updates: UPDATE không lọc theo cột khóa bị chặn (lỗi 1175) — tắt trong lúc chạy
SET SESSION sql_safe_updates = 0;

-- ---------------------------------------------------------------------
-- Hiện trạng
-- ---------------------------------------------------------------------
SET @co_phieu = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thanh_toan_don_ban');
SET @co_enum_moi = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'don_ban_hang' AND COLUMN_NAME = 'trang_thai_thanh_toan'
    AND COLUMN_TYPE LIKE '%can_hoan_tien%' AND COLUMN_TYPE LIKE '%thanh_toan_mot_phan%');
SET @kieu_cu = (SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'don_ban_hang' AND COLUMN_NAME = 'trang_thai_thanh_toan');

-- ---------------------------------------------------------------------
-- a. thanh_toan_don_ban
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_phieu = 0,
  'CREATE TABLE thanh_toan_don_ban (
     id bigint NOT NULL AUTO_INCREMENT,
     don_ban_hang_id int NOT NULL,
     loai varchar(10) CHARACTER SET ascii NOT NULL COMMENT ''THU = khách trả | HOAN = trả lại khách'',
     phuong_thuc varchar(20) CHARACTER SET ascii NOT NULL COMMENT ''TIEN_MAT | CHUYEN_KHOAN'',
     so_tien decimal(15,2) NOT NULL,
     ma_tham_chieu varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
       COMMENT ''Mã giao dịch trên sao kê (chuyển khoản)'',
     kho_id int DEFAULT NULL COMMENT ''Kho xuất của đơn lúc ghi (lọc theo cửa hàng)'',
     thoi_diem_thu datetime NOT NULL COMMENT ''Ngày khách trả (chuyển khoản ghi lùi: giữa trưa ngày đó)'',
     nguoi_thu_id int NOT NULL,
     trang_thai varchar(10) CHARACTER SET ascii NOT NULL DEFAULT ''HIEU_LUC'' COMMENT ''HIEU_LUC | DA_HUY'',
     ly_do_huy varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
     nguoi_huy_id int DEFAULT NULL,
     huy_luc datetime(6) DEFAULT NULL,
     ghi_chu varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
     ngay_tao datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
     khoa_chong_trung varchar(64) DEFAULT NULL COMMENT ''Khóa trình duyệt sinh cho một lần ghi: gửi lại cùng khóa không ghi phiếu thứ hai'',
     doi_chieu_luc datetime(6) DEFAULT NULL COMMENT ''Quản trị viên đối chiếu phiếu chuyển khoản với sao kê lúc này (trống = chưa)'',
     nguoi_doi_chieu_id int DEFAULT NULL,
     PRIMARY KEY (id),
     UNIQUE KEY uk_thanh_toan_khoa_chong_trung (khoa_chong_trung),
     KEY idx_thanh_toan_don (don_ban_hang_id),
     KEY idx_thanh_toan_thoi_diem (thoi_diem_thu, kho_id),
     KEY idx_thanh_toan_doi_chieu (phuong_thuc, doi_chieu_luc),
     KEY idx_thanh_toan_ma (ma_tham_chieu),
     CONSTRAINT fk_thanh_toan_don FOREIGN KEY (don_ban_hang_id) REFERENCES don_ban_hang (id),
     CONSTRAINT fk_thanh_toan_kho FOREIGN KEY (kho_id) REFERENCES kho (id),
     CONSTRAINT fk_thanh_toan_nguoi_thu FOREIGN KEY (nguoi_thu_id) REFERENCES nguoi_dung (id),
     CONSTRAINT fk_thanh_toan_nguoi_huy FOREIGN KEY (nguoi_huy_id) REFERENCES nguoi_dung (id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
     COMMENT=''Phiếu thu / phiếu hoàn tiền của đơn bán thường''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- Bảng có sẵn từ bản luồng thu tiền đầy đủ: thêm cột còn thiếu
SET @thieu = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thanh_toan_don_ban')
  - (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thanh_toan_don_ban' AND COLUMN_NAME = 'khoa_chong_trung');
SET @sql = IF(@lam = 1 AND @thieu = 1,
  'ALTER TABLE thanh_toan_don_ban ADD COLUMN khoa_chong_trung varchar(64) DEFAULT NULL, ADD UNIQUE KEY uk_thanh_toan_khoa_chong_trung (khoa_chong_trung)',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;
SET @thieu = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thanh_toan_don_ban')
  - (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thanh_toan_don_ban' AND COLUMN_NAME = 'doi_chieu_luc');
SET @sql = IF(@lam = 1 AND @thieu = 1,
  'ALTER TABLE thanh_toan_don_ban ADD COLUMN doi_chieu_luc datetime(6) DEFAULT NULL, ADD COLUMN nguoi_doi_chieu_id int DEFAULT NULL',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- b. Giá trị mới của trạng thái thanh toán (thêm vào cuối ENUM: MySQL đổi tức thì, không chép lại bảng)
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_enum_moi = 0,
  'ALTER TABLE don_ban_hang MODIFY COLUMN trang_thai_thanh_toan
     enum(''chua_thanh_toan'',''da_thanh_toan'',''thanh_toan_mot_phan'',''can_hoan_tien'')
     COLLATE utf8mb4_unicode_ci DEFAULT ''chua_thanh_toan''
     COMMENT ''Trống = chưa theo dõi (đơn trước khi có ghi nhận thanh toán)''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- c. pos_payos_payment: tiền mặt khách trả trước
-- ---------------------------------------------------------------------
SET @thieu = 1 - (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_payos_payment' AND COLUMN_NAME = 'tien_mat_truoc');
SET @sql = IF(@lam = 1 AND @thieu = 1,
  'ALTER TABLE pos_payos_payment
     ADD COLUMN tien_mat_truoc decimal(15,2) DEFAULT NULL COMMENT ''Tiền mặt khách trả trước tại quầy; mã QR mang phần còn lại'' AFTER so_tien',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;
SET @thieu = 1 - (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_payos_payment' AND COLUMN_NAME = 'tien_mat_tra_lai_luc');
SET @sql = IF(@lam = 1 AND @thieu = 1,
  'ALTER TABLE pos_payos_payment
     ADD COLUMN tien_mat_tra_lai_luc datetime DEFAULT NULL COMMENT ''Quầy xác nhận đã trả lại khách tiền mặt trả trước'' AFTER tien_mat_truoc,
     ADD COLUMN nguoi_tra_lai_tien_mat_id int DEFAULT NULL AFTER tien_mat_tra_lai_luc',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- d. pos_payment: phần tiền mặt của lần trả kết hợp
-- ---------------------------------------------------------------------
SET @thieu = 1 - (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_payment' AND COLUMN_NAME = 'tien_mat_truoc');
SET @sql = IF(@lam = 1 AND @thieu = 1,
  'ALTER TABLE pos_payment
     ADD COLUMN tien_mat_truoc decimal(15,2) DEFAULT NULL COMMENT ''Dòng PAYOS trả kết hợp: phần tiền mặt khách trả trước (đã gồm trong so_tien_hang)'' AFTER so_tien_thua',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- f. don_ban_hang: thuế GTGT chụp lúc chốt
-- ---------------------------------------------------------------------
SET @thieu = 1 - (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'don_ban_hang' AND COLUMN_NAME = 'thue_suat_gtgt');
SET @sql = IF(@lam = 1 AND @thieu = 1,
  'ALTER TABLE don_ban_hang
     ADD COLUMN thue_suat_gtgt decimal(5,2) DEFAULT NULL COMMENT ''Thuế suất GTGT (%) lúc chốt đơn; trống = không in thuế'' AFTER tong_cong,
     ADD COLUMN tien_thue_gtgt decimal(15,2) DEFAULT NULL COMMENT ''Tiền thuế GTGT đã gồm trong tong_cong'' AFTER thue_suat_gtgt',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- e. Đơn bán thường cũ: Chưa thanh toán -> trống (Chưa theo dõi)
-- ---------------------------------------------------------------------
SET @co_phieu_bang = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thanh_toan_don_ban');
SET @dk_phieu = IF(@co_phieu_bang = 1,
  'AND NOT EXISTS (SELECT 1 FROM thanh_toan_don_ban t WHERE t.don_ban_hang_id = d.id)', '');
SET @dk_don_cu = CONCAT(
  'd.loai_chung_tu = ''don_ban_hang'' AND d.trang_thai_thanh_toan IN (''chua_thanh_toan'', ''da_thanh_toan'', '''')',
  ' AND d.kenh_ban_id IS NULL AND (d.ma_don_hang_kenh IS NULL OR TRIM(d.ma_don_hang_kenh) = '''')',
  ' AND d.ngay_tao < ''', DATE_FORMAT(@moc, '%Y-%m-%d'), '''',
  ' AND NOT EXISTS (SELECT 1 FROM pos_payment p WHERE p.don_ban_hang_id = d.id)',
  ' AND NOT EXISTS (SELECT 1 FROM pos_checkout_request r WHERE r.don_ban_hang_id = d.id)',
  ' ', @dk_phieu);

SET @sql = CONCAT('SELECT COUNT(*) INTO @so_don_cu FROM don_ban_hang d WHERE ', @dk_don_cu);
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@lam = 1 AND @so_don_cu > 0,
  CONCAT('UPDATE don_ban_hang d SET d.trang_thai_thanh_toan = NULL WHERE ', @dk_don_cu),
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; SET @rc_don_cu = IF(@lam = 1, ROW_COUNT(), 0); DEALLOCATE PREPARE lenh;

-- Lưu ngày bắt đầu (lần chạy thật đầu tiên); backend đọc để đơn cũ hủy hết phiếu trở lại "Chưa theo dõi"
SET @sql = IF(@lam = 1,
  CONCAT('INSERT IGNORE INTO cau_hinh_he_thong (ma_cau_hinh, gia_tri, kieu_du_lieu, mo_ta) VALUES (''THANH_TOAN_DON_THUONG_TU'', ''',
         DATE_FORMAT(@moc, '%Y-%m-%d'), ''', ''STRING'', ''Ngày bắt đầu ghi nhận thanh toán đơn bán thường (đơn tạo trước là chưa theo dõi)'')'),
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- Kết quả
-- ---------------------------------------------------------------------
SELECT CASE WHEN @ma_ok = 0 THEN 'DỪNG — tệp bị đổi mã chữ, chưa đổi gì'
            WHEN @chay_that = 1 THEN 'ĐÃ CHẠY THẬT'
            ELSE 'CHỈ XEM TRƯỚC — chưa đổi gì' END AS che_do,
       IF(@co_phieu = 1, 'đã có từ trước', IF(@chay_that = 1, 'đã tạo', 'sẽ tạo')) AS bang_phieu_thu,
       IF(@co_enum_moi = 1, 'đã có', CONCAT(IF(@chay_that = 1, 'đã thêm', 'sẽ thêm'), ' (đang: ', @kieu_cu, ')')) AS trang_thai_moi,
       IF(@chay_that = 1, CONCAT('đã chuyển ', @rc_don_cu, ' đơn cũ sang Chưa theo dõi'),
          CONCAT(@so_don_cu, ' đơn cũ (tạo trước ', DATE_FORMAT(@moc, '%d/%m/%Y'), ') sẽ sang Chưa theo dõi')) AS don_cu,
       DATE_FORMAT(@moc, '%d/%m/%Y') AS ngay_bat_dau;

SELECT TABLE_NAME AS bang, COLUMN_NAME AS cot, COLUMN_TYPE AS kieu
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND ((TABLE_NAME = 'pos_payos_payment' AND COLUMN_NAME IN ('tien_mat_truoc', 'tien_mat_tra_lai_luc', 'nguoi_tra_lai_tien_mat_id'))
     OR (TABLE_NAME = 'pos_payment' AND COLUMN_NAME = 'tien_mat_truoc')
     OR (TABLE_NAME = 'don_ban_hang' AND COLUMN_NAME IN ('trang_thai_thanh_toan', 'thue_suat_gtgt', 'tien_thue_gtgt')))
 ORDER BY TABLE_NAME, ORDINAL_POSITION;

SET SESSION lock_wait_timeout = @cho_khoa_cu;
SET SESSION innodb_lock_wait_timeout = @cho_khoa_dong_cu;
SET SESSION sql_safe_updates = @an_toan_cu;
SET SESSION time_zone = @mui_gio_cu;
