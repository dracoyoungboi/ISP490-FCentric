-- =====================================================================
-- Migration 14/11/2026 — Xuất dữ liệu kế toán, đợt 2 (theo kết quả nhập thử vào AMIS Kế toán doanh nghiệp TT 99/2025)
-- MẶC ĐỊNH CHỈ XEM TRƯỚC: tệp chỉ báo hiện trạng. Đổi @chay_that = 1 để chạy thật.
--
-- Căn cứ (nhập thử 14/11/2026 trên AMIS doanh nghiệp, hệ thống tài khoản TT 99 vừa khởi tạo):
--   * TK 511 có tài khoản con, AMIS từ chối: "TK Doanh thu/Có <511> là tài khoản tổng hợp. Bạn vui lòng nhập tài khoản
--     chi tiết." → doanh thu 5111, chiết khấu 5211 (đúng tệp mẫu của MISA). 111, 112, 156 không có tài khoản con, giữ nguyên.
--   * Hình thức "Xuất kho kiêm vận chuyển nội bộ" bị AMIS bỏ trống số chứng từ (chờ phát hành hóa đơn điện tử) →
--     mặc định "Xuất chuyển kho nội bộ" để giữ số phiếu đối chiếu được.
--
-- Thêm / đổi:
--   a. cau_hinh_ke_toan: 3 cột tài khoản mới — tk_tra_lai (hàng bán bị trả lại, 5212), tk_hang_thieu (tài sản thiếu chờ
--      xử lý, 1381), tk_hang_thua (tài sản thừa chờ giải quyết, 3381); đổi giá trị mặc định của cột tk_doanh_thu,
--      tk_chiet_khau, hinh_thuc_chuyen_kho.
--   b. Dòng cấu hình đang có (id = 1): CHỈ đổi ô còn đúng giá trị mặc định cũ (511 → 5111, 521 → 5211, "Xuất kho kiêm vận
--      chuyển nội bộ" → "Xuất chuyển kho nội bộ"). Ô kế toán đã tự sửa thì giữ nguyên.
--   d. cau_hinh_ke_toan.tu_dong_tu — mốc bắt đầu tự dựng phiếu nhập / xuất kho khác (kiểm kê, hao hụt chuyển kho) và
--      chứng từ trả hàng tại quầy. Tệp này chỉ thêm cột (NULL); backend mới tự chốt mốc ở lô đầu tiên nó tạo, bằng chỗ
--      danh sách "lập tay" của các lô cũ đã liệt kê tới (kể cả lô tạo bằng backend cũ sau khi chạy tệp này), nên biến
--      động kế toán đã lập tay không bị dựng lại.
--   e. chung_tu_xuat_ke_toan.ma_khach — mã khách ghi trên chứng từ AMIS (NULL = chứng từ của bản cũ, ghi mã riêng của
--      khách). Chứng từ trả lại của đơn đã giao kế toán ghi đúng mã khách của chứng từ bán.
--   c. lo_xuat_ke_toan: trạng thái lô (hieu_luc · da_huy), người hủy, lúc hủy, lý do hủy — cho chức năng Hủy lô.
--      Chứng từ của lô bị hủy chuyển trạng thái da_huy_lo (cột sinh khoa_hieu_luc tự thành NULL, không cần đổi cấu trúc).
--
-- Không làm gì: không sửa chứng từ, không xóa gì. Chạy lại bao nhiêu lần cũng được.
--
-- Thứ tự triển khai:
--   B0. Đã chạy migration-2026-10-26-xuat-ke-toan.sql và migration-2026-11-11-tra-hang-tai-quay.sql (tệp trả hàng tại
--       quầy 31 đọc bảng phieu_tra_hang). Cột kết quả bên dưới báo hai tệp này đã chạy hay chưa.
--   B1. Chạy tệp này với @chay_that = 1 TRƯỚC khi lên backend mới (backend mới map các cột mới; thiếu cột là mọi lần
--       đọc cấu hình / danh sách lô báo Unknown column). Backend cũ vẫn chạy được sau khi chạy tệp này.
--   B2. Lên backend + frontend mới.
--   B3. Vào Cấu hình › Xuất kế toán xem lại các tài khoản cho khớp hệ thống tài khoản trên AMIS của doanh nghiệp.
-- Sao lưu trước khi chạy thật: mysqldump fashion_system cau_hinh_ke_toan lo_xuat_ke_toan > bk_xuat_ke_toan_20261114.sql
-- =====================================================================

SET NAMES utf8mb4;           -- mysql CLI mặc định latin1 thì chữ tiếng Việt bị lỗi mã
USE fashion_system;          -- đổi nếu CSDL của bạn tên khác

SET @chay_that = 0;          -- 0 = CHỈ XEM TRƯỚC, không đổi gì · 1 = CHẠY THẬT

-- Tệp bị đổi mã chữ thì chữ "ư" không còn là 2 byte C6 B0: dừng, không đổi gì
SET @ma_ok = IF(HEX('ư') = 'C6B0', 1, 0);
SET @lam = IF(@chay_that = 1 AND @ma_ok = 1, 1, 0);

SET @cho_khoa_cu = @@SESSION.lock_wait_timeout;
SET @cho_khoa_dong_cu = @@SESSION.innodb_lock_wait_timeout;
SET @autocommit_cu = @@SESSION.autocommit;
SET SESSION lock_wait_timeout = 5;
SET SESSION innodb_lock_wait_timeout = 5;
SET SESSION autocommit = 1;

-- ---------------------------------------------------------------------
-- Hiện trạng
-- ---------------------------------------------------------------------
SET @co_cau_hinh = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cau_hinh_ke_toan');
SET @co_lo = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lo_xuat_ke_toan');
SET @co_tra_hang = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phieu_tra_hang');
SET @co_tk_tra_lai = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cau_hinh_ke_toan' AND COLUMN_NAME = 'tk_tra_lai');
SET @co_tk_hang_thieu = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cau_hinh_ke_toan' AND COLUMN_NAME = 'tk_hang_thieu');
SET @co_tk_hang_thua = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cau_hinh_ke_toan' AND COLUMN_NAME = 'tk_hang_thua');
SET @co_tu_dong_tu = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cau_hinh_ke_toan' AND COLUMN_NAME = 'tu_dong_tu');
SET @co_trang_thai_lo = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lo_xuat_ke_toan' AND COLUMN_NAME = 'trang_thai');
SET @co_nguoi_huy = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lo_xuat_ke_toan' AND COLUMN_NAME = 'nguoi_huy_id');
SET @co_huy_luc = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lo_xuat_ke_toan' AND COLUMN_NAME = 'huy_luc');
SET @co_ly_do_huy = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lo_xuat_ke_toan' AND COLUMN_NAME = 'ly_do_huy');
SET @co_bang_ct = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chung_tu_xuat_ke_toan');
SET @co_ma_khach = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chung_tu_xuat_ke_toan' AND COLUMN_NAME = 'ma_khach');

-- Giá trị hiện tại của dòng cấu hình (để báo trước khi đổi); chưa có dòng id = 1 thì giữ NULL
SET @dt_cu = NULL, @ck_cu = NULL, @htck_cu = NULL, @dt_moi = NULL, @ck_moi = NULL, @htck_moi = NULL;
SET @sql = IF(@co_cau_hinh = 1,
  'SELECT tk_doanh_thu, tk_chiet_khau, hinh_thuc_chuyen_kho INTO @dt_cu, @ck_cu, @htck_cu FROM cau_hinh_ke_toan WHERE id = 1',
  'SELECT NULL, NULL, NULL INTO @dt_cu, @ck_cu, @htck_cu');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- a. cau_hinh_ke_toan: cột mới + giá trị mặc định mới
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_cau_hinh = 1 AND @co_tk_tra_lai = 0,
  'ALTER TABLE cau_hinh_ke_toan ADD COLUMN tk_tra_lai varchar(20) NOT NULL DEFAULT ''5212''
     COMMENT ''Hàng bán bị trả lại (TK trả lại trên chứng từ Hàng bán trả lại)''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@lam = 1 AND @co_cau_hinh = 1 AND @co_tk_hang_thieu = 0,
  'ALTER TABLE cau_hinh_ke_toan ADD COLUMN tk_hang_thieu varchar(20) NOT NULL DEFAULT ''1381''
     COMMENT ''Tài sản thiếu chờ xử lý (TK Nợ của phiếu xuất kho khác: kiểm kê thiếu, hao hụt chuyển kho)''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@lam = 1 AND @co_cau_hinh = 1 AND @co_tk_hang_thua = 0,
  'ALTER TABLE cau_hinh_ke_toan ADD COLUMN tk_hang_thua varchar(20) NOT NULL DEFAULT ''3381''
     COMMENT ''Tài sản thừa chờ giải quyết (TK Có của phiếu nhập kho khác: kiểm kê thừa)''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@lam = 1 AND @co_cau_hinh = 1,
  'ALTER TABLE cau_hinh_ke_toan
     ALTER COLUMN tk_doanh_thu SET DEFAULT ''5111'',
     ALTER COLUMN tk_chiet_khau SET DEFAULT ''5211'',
     ALTER COLUMN hinh_thuc_chuyen_kho SET DEFAULT ''Xuất chuyển kho nội bộ''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- b. Dòng cấu hình đang có: chỉ đổi ô còn đúng giá trị mặc định cũ
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_cau_hinh = 1,
  'UPDATE cau_hinh_ke_toan
      SET tk_doanh_thu = IF(tk_doanh_thu = ''511'', ''5111'', tk_doanh_thu),
          tk_chiet_khau = IF(tk_chiet_khau = ''521'', ''5211'', tk_chiet_khau),
          hinh_thuc_chuyen_kho = IF(hinh_thuc_chuyen_kho = ''Xuất kho kiêm vận chuyển nội bộ'', ''Xuất chuyển kho nội bộ'', hinh_thuc_chuyen_kho),
          version = version + 1
    WHERE id = 1
      AND (tk_doanh_thu = ''511'' OR tk_chiet_khau = ''521'' OR hinh_thuc_chuyen_kho = ''Xuất kho kiêm vận chuyển nội bộ'')',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; SET @da_doi_cau_hinh = IF(@lam = 1, ROW_COUNT(), 0); DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- d. Mốc tự dựng (chỉ ghi khi vừa thêm cột, chạy lại tệp không đổi mốc)
-- ---------------------------------------------------------------------
SET @so_lo_cu = 0;
SET @sql = IF(@co_lo = 1, 'SELECT COUNT(*) INTO @so_lo_cu FROM lo_xuat_ke_toan', 'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@lam = 1 AND @co_cau_hinh = 1 AND @co_tu_dong_tu = 0,
  'ALTER TABLE cau_hinh_ke_toan ADD COLUMN tu_dong_tu timestamp NULL DEFAULT NULL
     COMMENT ''Mốc bắt đầu tự dựng phiếu kho khác và chứng từ trả hàng tại quầy; NULL = từ ngày mốc''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- e. chung_tu_xuat_ke_toan.ma_khach
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_bang_ct = 1 AND @co_ma_khach = 0,
  'ALTER TABLE chung_tu_xuat_ke_toan ADD COLUMN ma_khach varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
     COMMENT ''Mã khách ghi trên chứng từ AMIS; NULL = chứng từ trước 14/11/2026 (mã riêng của khách)''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- c. lo_xuat_ke_toan: hủy lô
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_lo = 1 AND @co_trang_thai_lo = 0,
  'ALTER TABLE lo_xuat_ke_toan ADD COLUMN trang_thai varchar(20) CHARACTER SET ascii NOT NULL DEFAULT ''hieu_luc''
     COMMENT ''hieu_luc · da_huy (hủy lô: chứng từ của lô quay về chưa xuất)''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- Tắt kiểm khóa ngoại khi thêm: cột mới toàn NULL nên không có gì để kiểm, và MySQL thêm khóa ngoại tại chỗ thay vì
-- dựng lại cả bảng (bảng giữ tệp nén của các lô)
SET @kiem_fk_cu = @@SESSION.foreign_key_checks;
SET SESSION foreign_key_checks = 0;
SET @sql = IF(@lam = 1 AND @co_lo = 1 AND @co_nguoi_huy = 0,
  'ALTER TABLE lo_xuat_ke_toan ADD COLUMN nguoi_huy_id int DEFAULT NULL,
     ADD CONSTRAINT fk_lo_xuat_ke_toan_nguoi_huy FOREIGN KEY (nguoi_huy_id) REFERENCES nguoi_dung (id)',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;
SET SESSION foreign_key_checks = @kiem_fk_cu;

SET @sql = IF(@lam = 1 AND @co_lo = 1 AND @co_huy_luc = 0,
  'ALTER TABLE lo_xuat_ke_toan ADD COLUMN huy_luc timestamp NULL DEFAULT NULL',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@lam = 1 AND @co_lo = 1 AND @co_ly_do_huy = 0,
  'ALTER TABLE lo_xuat_ke_toan ADD COLUMN ly_do_huy varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- Kết quả: đọc lại information_schema sau khi chạy (lệnh lỗi giữa chừng — chờ khóa quá 5 giây — thì báo CHƯA CÓ;
-- gặp lỗi chờ khóa thì chạy lại tệp)
-- ---------------------------------------------------------------------
SET @sau_tk = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cau_hinh_ke_toan'
    AND COLUMN_NAME IN ('tk_tra_lai', 'tk_hang_thieu', 'tk_hang_thua'));
SET @sau_tu_dong = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cau_hinh_ke_toan' AND COLUMN_NAME = 'tu_dong_tu');
SET @moc_tu_dong = NULL;
SET @sql = IF(@sau_tu_dong = 1, 'SELECT tu_dong_tu INTO @moc_tu_dong FROM cau_hinh_ke_toan WHERE id = 1', 'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;
SET @sau_ma_khach = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chung_tu_xuat_ke_toan' AND COLUMN_NAME = 'ma_khach');
SET @sau_lo = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lo_xuat_ke_toan'
    AND COLUMN_NAME IN ('trang_thai', 'nguoi_huy_id', 'huy_luc', 'ly_do_huy'));
SET @sql = IF(@co_cau_hinh = 1,
  'SELECT tk_doanh_thu, tk_chiet_khau, hinh_thuc_chuyen_kho INTO @dt_moi, @ck_moi, @htck_moi FROM cau_hinh_ke_toan WHERE id = 1',
  'SELECT NULL, NULL, NULL INTO @dt_moi, @ck_moi, @htck_moi');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SELECT CASE WHEN @ma_ok = 0
              THEN 'DỪNG — tệp bị đổi mã chữ, chưa đổi gì. Mở thẳng tệp trong Workbench hoặc chạy mysql --default-character-set=utf8mb4 < tệp'
            WHEN @chay_that = 1 THEN 'ĐÃ CHẠY THẬT'
            ELSE 'CHỈ XEM TRƯỚC — chưa đổi gì' END AS che_do,
       CASE WHEN @co_cau_hinh = 0 OR @co_lo = 0 THEN 'CHƯA CHẠY — chạy migration-2026-10-26-xuat-ke-toan.sql trước'
            ELSE 'đã chạy' END AS migration_26_10,
       CASE WHEN @co_tra_hang = 0 THEN 'CHƯA CHẠY — chạy migration-2026-11-11-tra-hang-tai-quay.sql trước'
            ELSE 'đã chạy' END AS migration_11_11,
       CONCAT(@sau_tk, '/3', IF(@sau_tk = 3, '', ' — CHƯA ĐỦ')) AS a_cot_tai_khoan_moi,
       CONCAT(IFNULL(@dt_cu, '—'), ' → ', IFNULL(@dt_moi, '—')) AS b_tk_doanh_thu,
       CONCAT(IFNULL(@ck_cu, '—'), ' → ', IFNULL(@ck_moi, '—')) AS b_tk_chiet_khau,
       CONCAT(IFNULL(@htck_cu, '—'), ' → ', IFNULL(@htck_moi, '—')) AS b_hinh_thuc_chuyen_kho,
       @da_doi_cau_hinh AS b_so_dong_cau_hinh_da_doi,
       CONCAT(@sau_lo, '/4', IF(@sau_lo = 4, '', ' — CHƯA ĐỦ')) AS c_cot_huy_lo,
       CASE WHEN @sau_tu_dong = 0 THEN 'CHƯA CÓ CỘT'
            WHEN @moc_tu_dong IS NULL THEN CONCAT('có cột, chưa chốt — backend mới chốt ở lô đầu tiên (', @so_lo_cu, ' lô cũ)')
            ELSE CONCAT('đã chốt ', @moc_tu_dong) END AS d_moc_tu_dong,
       IF(@sau_ma_khach = 1, 'có', 'CHƯA CÓ') AS e_cot_ma_khach;

SET SESSION lock_wait_timeout = @cho_khoa_cu;
SET SESSION innodb_lock_wait_timeout = @cho_khoa_dong_cu;
SET SESSION autocommit = @autocommit_cu;
