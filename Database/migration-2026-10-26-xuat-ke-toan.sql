-- =====================================================================
-- Migration 26/10/2026 — Xuất dữ liệu kế toán, đợt 1 (AMIS Kế toán doanh nghiệp)
-- MẶC ĐỊNH CHỈ XEM TRƯỚC: tệp chỉ báo hiện trạng. Đổi @chay_that = 1 để chạy thật.
--
-- Thêm:
--   a. Bảng thue_suat_gtgt — thuế suất GTGT có ngày hiệu lực; danh_muc_id để trống là mức chung, có thì ghi đè cho
--      danh mục đó (và danh mục con). Có sẵn 2 dòng mức chung: 8% từ 01/07/2025 đến 31/12/2026 (NQ 204/2025/QH15,
--      NĐ 174/2025), 10% từ 01/01/2027. Chỉ thêm 2 dòng này khi bảng chưa có dòng nào.
--   b. Bảng cau_hinh_ke_toan — một dòng (id = 1): ngày mốc, tài khoản mặc định (theo hệ thống tài khoản TT 99 của
--      AMIS), mã dịch vụ phí vận chuyển, hình thức chuyển kho, số tài khoản ngân hàng nhận.
--   c. Bảng lo_xuat_ke_toan — mỗi lần tạo lô xuất một dòng, giữ tệp nén đã giao kèm mã băm SHA-256.
--   d. Bảng chung_tu_xuat_ke_toan — chứng từ đã vào lô; khoa_hieu_luc UNIQUE để một chứng từ chỉ thuộc một lô còn
--      hiệu lực (mở khóa thì khoa_hieu_luc thành NULL, lô sau xuất lại được).
--   e. Bảng hoa_don_dau_vao — hóa đơn nhà cung cấp của phiếu nhập (một-một).
--   f. Cột nha_cung_cap.ma_so_thue.
--   g. Cột chi_tiet_don_ban_hang.tien_giam_gia — giảm giá của dòng (đơn Shopify), tiền đã gồm thuế.
--
-- Không làm gì: không sửa dữ liệu chứng từ cũ, không xóa gì. Chạy lại bao nhiêu lần cũng được (thiếu gì thêm nấy).
--
-- Thứ tự triển khai:
--   B0. Đã chạy migration-2026-10-25-cuoc-van-chuyen-thuc-te.sql (backend mới cũng cần cột phieu_xuat_kho.
--       phi_van_chuyen_thuc_te). Cột kết quả "migration_25_10" bên dưới báo đã chạy hay chưa.
--   B1. Chạy tệp này với @chay_that = 1 TRƯỚC khi lên backend mới. Backend dùng ddl-auto=none, không kiểm cấu trúc
--       khi khởi động: thiếu bảng, cột là máy chủ vẫn chạy nhưng mọi lần đọc, ghi dòng đơn bán / nhà cung cấp báo
--       Unknown column — bán tại quầy bị hủy giao dịch, job kéo đơn Shopify để lại đơn không có dòng hàng.
--       Chạy tệp này trước rồi giữ backend cũ vẫn an toàn (cột mới cho phép trống hoặc có mặc định).
--   B2. Lên backend + frontend mới.
--   B3. Vào Cấu hình › Xuất kế toán đặt ngày mốc (trùng "Ngày bắt đầu dữ liệu" trên AMIS) trước lần xuất đầu tiên.
-- Thêm cột ở cuối bảng (ALGORITHM INSTANT của MySQL 8), không khóa lâu; vẫn nên chạy ngoài giờ bán hàng.
-- Sao lưu trước khi chạy thật: mysqldump fashion_system nha_cung_cap chi_tiet_don_ban_hang > bk_xuat_ke_toan_20261026.sql
-- =====================================================================
SET NAMES utf8mb4;           -- mysql CLI mặc định latin1 thì chữ tiếng Việt trong COMMENT bị lỗi mã

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
SET @co_thue = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thue_suat_gtgt');
SET @co_cau_hinh = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cau_hinh_ke_toan');
SET @co_lo = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lo_xuat_ke_toan');
SET @co_chung_tu = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chung_tu_xuat_ke_toan');
SET @co_hoa_don = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hoa_don_dau_vao');
SET @co_mst_ncc = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nha_cung_cap' AND COLUMN_NAME = 'ma_so_thue');
SET @co_giam_gia = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chi_tiet_don_ban_hang' AND COLUMN_NAME = 'tien_giam_gia');

-- ---------------------------------------------------------------------
-- a. thue_suat_gtgt
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_thue = 0,
  'CREATE TABLE thue_suat_gtgt (
     id int NOT NULL AUTO_INCREMENT,
     ty_le decimal(5,2) NOT NULL COMMENT ''Thuế suất GTGT (%): 0, 5, 8 hoặc 10'',
     hieu_luc_tu date NOT NULL COMMENT ''Áp dụng từ ngày (theo ngày hạch toán của chứng từ)'',
     hieu_luc_den date DEFAULT NULL COMMENT ''Áp dụng đến hết ngày; NULL = chưa hết hiệu lực'',
     danh_muc_id int DEFAULT NULL COMMENT ''NULL = mức chung; có = ghi đè cho danh mục này và các danh mục con'',
     ghi_chu varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT ''Căn cứ, vd. NQ 204/2025/QH15'',
     nguoi_cap_nhat_id int DEFAULT NULL,
     ngay_cap_nhat timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     PRIMARY KEY (id),
     KEY idx_thue_suat_danh_muc (danh_muc_id, hieu_luc_tu),
     CONSTRAINT fk_thue_suat_danh_muc FOREIGN KEY (danh_muc_id) REFERENCES danh_muc_quan_ao (id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
     COMMENT=''Thuế suất GTGT có ngày hiệu lực, dùng khi xuất dữ liệu kế toán''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- Mức chung có sẵn: chỉ thêm khi bảng (vừa tạo hoặc đã có) chưa có dòng nào
SET @sql = IF(@lam = 1,
  'INSERT INTO thue_suat_gtgt (ty_le, hieu_luc_tu, hieu_luc_den, danh_muc_id, ghi_chu)
   SELECT * FROM (
     SELECT 8.00 AS ty_le, DATE ''2025-07-01'' AS tu, DATE ''2026-12-31'' AS den, NULL AS dm,
            ''Giảm 2% thuế GTGT theo NQ 204/2025/QH15, NĐ 174/2025/NĐ-CP'' AS gc
     UNION ALL
     SELECT 10.00, DATE ''2027-01-01'', NULL, NULL, ''Mức thông thường''
   ) mac_dinh
   WHERE NOT EXISTS (SELECT 1 FROM thue_suat_gtgt)',
  'DO 0');
-- ROW_COUNT() phải đọc ngay sau EXECUTE (sau DEALLOCATE thì luôn ra 0)
PREPARE lenh FROM @sql; EXECUTE lenh; SET @da_them_thue = IF(@lam = 1, ROW_COUNT(), 0); DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- b. cau_hinh_ke_toan
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_cau_hinh = 0,
  'CREATE TABLE cau_hinh_ke_toan (
     id tinyint NOT NULL COMMENT ''Luôn bằng 1 — bảng một dòng'',
     ho_so varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''AMIS_DOANH_NGHIEP''
       COMMENT ''Phần mềm đích: bộ tệp mẫu dùng khi xuất'',
     ngay_moc date DEFAULT NULL
       COMMENT ''Ngày bắt đầu chuyển sang kế toán: tồn đầu kỳ tính tại đây, chứng từ trước ngày này không xuất'',
     tk_tien_mat varchar(20) NOT NULL DEFAULT ''111'',
     tk_ngan_hang varchar(20) NOT NULL DEFAULT ''112'',
     tk_phai_thu varchar(20) NOT NULL DEFAULT ''131'',
     tk_doanh_thu varchar(20) NOT NULL DEFAULT ''511'',
     tk_chiet_khau varchar(20) NOT NULL DEFAULT ''521'',
     tk_thue_dau_ra varchar(20) NOT NULL DEFAULT ''33311'',
     tk_kho varchar(20) NOT NULL DEFAULT ''156'',
     tk_gia_von varchar(20) NOT NULL DEFAULT ''632'',
     tk_phai_tra varchar(20) NOT NULL DEFAULT ''331'',
     tk_thue_dau_vao varchar(20) NOT NULL DEFAULT ''1331'',
     ma_dich_vu_van_chuyen varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''PVC''
       COMMENT ''Mã hàng (tính chất Dịch vụ) của dòng phí vận chuyển thu khách'',
     ten_dich_vu_van_chuyen varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''Phí vận chuyển'',
     hinh_thuc_chuyen_kho varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
       DEFAULT ''Xuất kho kiêm vận chuyển nội bộ'' COMMENT ''Hình thức của bước xuất chuyển kho trên AMIS'',
     so_tk_ngan_hang_nhan varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
       COMMENT ''Số tài khoản ngân hàng nhận tiền chuyển khoản tại quầy (cột Nộp vào TK), phải có trên AMIS'',
     version int NOT NULL DEFAULT ''1'',
     nguoi_cap_nhat_id int DEFAULT NULL,
     ngay_cap_nhat timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     PRIMARY KEY (id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
     COMMENT=''Cấu hình xuất dữ liệu kế toán (một dòng)''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@lam = 1, 'INSERT IGNORE INTO cau_hinh_ke_toan (id) VALUES (1)', 'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- c. lo_xuat_ke_toan
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_lo = 0,
  'CREATE TABLE lo_xuat_ke_toan (
     id int NOT NULL AUTO_INCREMENT,
     so_lo varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT ''KT-yyyyMMdd-n'',
     ho_so varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
     den_ngay date NOT NULL COMMENT ''Lô gồm mọi chứng từ chưa xuất có ngày hạch toán từ ngày mốc đến ngày này'',
     tu_ngay date DEFAULT NULL COMMENT ''Ngày hạch toán sớm nhất trong lô'',
     co_ton_dau_ky tinyint(1) NOT NULL DEFAULT ''0'',
     so_chung_tu int NOT NULL DEFAULT ''0'',
     tong_truoc_thue decimal(18,2) NOT NULL DEFAULT ''0.00'' COMMENT ''Bán hàng: doanh thu trước thuế, sau chiết khấu'',
     tong_thue decimal(18,2) NOT NULL DEFAULT ''0.00'' COMMENT ''Bán hàng: thuế GTGT đầu ra'',
     tong_cong decimal(18,2) NOT NULL DEFAULT ''0.00'' COMMENT ''Bán hàng: tổng tiền khách trả'',
     ten_tep varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
     tep longblob NOT NULL COMMENT ''Tệp nén đã giao cho kế toán'',
     kich_thuoc int NOT NULL,
     ma_bam char(64) CHARACTER SET ascii NOT NULL COMMENT ''SHA-256 của tệp nén'',
     ghi_chu varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
     nguoi_tao_id int NOT NULL,
     ngay_tao timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (id),
     UNIQUE KEY uq_lo_xuat_ke_toan_so_lo (so_lo),
     KEY idx_lo_xuat_ke_toan_nguoi_tao (nguoi_tao_id),
     CONSTRAINT fk_lo_xuat_ke_toan_nguoi_tao FOREIGN KEY (nguoi_tao_id) REFERENCES nguoi_dung (id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
     COMMENT=''Lô xuất dữ liệu kế toán''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- d. chung_tu_xuat_ke_toan
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_chung_tu = 0,
  'CREATE TABLE chung_tu_xuat_ke_toan (
     id int NOT NULL AUTO_INCREMENT,
     lo_xuat_id int NOT NULL,
     loai varchar(30) CHARACTER SET ascii NOT NULL
       COMMENT ''ban_hang (don_ban_hang.id), mua_hang (phieu_nhap_kho.id), chuyen_kho_xuat (phieu_xuat_kho.id),
                 chuyen_kho_nhan (phieu_nhap_kho.id), ton_dau_ky (0)'',
     id_nguon int NOT NULL,
     so_chung_tu varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
     ngay_hach_toan date NOT NULL,
     tong_tien decimal(18,2) NOT NULL DEFAULT ''0.00'',
     trang_thai varchar(20) CHARACTER SET ascii NOT NULL DEFAULT ''da_xuat'' COMMENT ''da_xuat · da_mo_khoa'',
     khoa_hieu_luc varchar(60) CHARACTER SET ascii
       GENERATED ALWAYS AS (IF(trang_thai = ''da_xuat'', CONCAT(loai, '':'', id_nguon), NULL)) STORED,
     nguoi_mo_khoa_id int DEFAULT NULL,
     mo_khoa_luc timestamp NULL DEFAULT NULL,
     ly_do_mo_khoa varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
     PRIMARY KEY (id),
     UNIQUE KEY uq_chung_tu_xuat_ke_toan_hieu_luc (khoa_hieu_luc),
     KEY idx_chung_tu_xuat_ke_toan_lo (lo_xuat_id),
     KEY idx_chung_tu_xuat_ke_toan_nguon (loai, id_nguon),
     CONSTRAINT fk_chung_tu_xuat_ke_toan_lo FOREIGN KEY (lo_xuat_id) REFERENCES lo_xuat_ke_toan (id),
     CONSTRAINT fk_chung_tu_xuat_ke_toan_nguoi_mo FOREIGN KEY (nguoi_mo_khoa_id) REFERENCES nguoi_dung (id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
     COMMENT=''Chứng từ đã vào lô xuất kế toán (khóa sau khi xuất)''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- e. hoa_don_dau_vao
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_hoa_don = 0,
  'CREATE TABLE hoa_don_dau_vao (
     id int NOT NULL AUTO_INCREMENT,
     phieu_nhap_kho_id int NOT NULL,
     co_hoa_don tinyint(1) NOT NULL DEFAULT ''1'' COMMENT ''0 = nhà cung cấp không xuất hóa đơn GTGT'',
     mau_so varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
     ky_hieu varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
     so_hoa_don varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
     ngay_hoa_don date DEFAULT NULL,
     thue_suat decimal(5,2) DEFAULT NULL COMMENT ''Thuế suất trên hóa đơn (%): 0, 5, 8, 10'',
     nguoi_cap_nhat_id int DEFAULT NULL,
     ngay_cap_nhat timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     PRIMARY KEY (id),
     UNIQUE KEY uq_hoa_don_dau_vao_phieu_nhap (phieu_nhap_kho_id),
     CONSTRAINT fk_hoa_don_dau_vao_phieu_nhap FOREIGN KEY (phieu_nhap_kho_id) REFERENCES phieu_nhap_kho (id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
     COMMENT=''Hóa đơn nhà cung cấp của phiếu nhập mua hàng''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- f, g. Cột mới
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_mst_ncc = 0,
  'ALTER TABLE nha_cung_cap ADD COLUMN ma_so_thue varchar(14) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
     COMMENT ''Mã số thuế: 10 số, 10 số + -3 số (đơn vị phụ thuộc) hoặc 12 số''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@lam = 1 AND @co_giam_gia = 0,
  'ALTER TABLE chi_tiet_don_ban_hang ADD COLUMN tien_giam_gia decimal(15,2) NOT NULL DEFAULT ''0.00''
     COMMENT ''Giảm giá của dòng (đơn Shopify), tiền đã gồm thuế''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- Kết quả: đọc lại information_schema sau khi chạy (một lệnh CREATE lỗi giữa chừng — khóa ngoại, chờ khóa quá 5 giây —
-- thì báo CHƯA CÓ chứ không báo "đã tạo"; gặp lỗi chờ khóa thì chạy lại tệp)
-- ---------------------------------------------------------------------
SET @sau_thue = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thue_suat_gtgt');
SET @sau_cau_hinh = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cau_hinh_ke_toan');
SET @sau_lo = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lo_xuat_ke_toan');
SET @sau_chung_tu = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chung_tu_xuat_ke_toan');
SET @sau_hoa_don = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hoa_don_dau_vao');
SET @sau_mst_ncc = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nha_cung_cap' AND COLUMN_NAME = 'ma_so_thue');
SET @sau_giam_gia = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chi_tiet_don_ban_hang' AND COLUMN_NAME = 'tien_giam_gia');
-- Bảng có sẵn (vd. còn từ bản nháp) chỉ được kiểm theo tên ở trên: kiểm thêm hai khóa duy nhất mà việc chống xuất trùng
-- dựa vào. Thiếu thì một chứng từ có thể vào hai lô mà không báo lỗi gì.
SET @sau_khoa_ct = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chung_tu_xuat_ke_toan' AND COLUMN_NAME = 'khoa_hieu_luc'
    AND NON_UNIQUE = 0 AND SEQ_IN_INDEX = 1);
SET @sau_khoa_hd = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hoa_don_dau_vao' AND COLUMN_NAME = 'phieu_nhap_kho_id'
    AND NON_UNIQUE = 0 AND SEQ_IN_INDEX = 1);
SET @co_phi_thuc_te = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phieu_xuat_kho' AND COLUMN_NAME = 'phi_van_chuyen_thuc_te');

SELECT CASE WHEN @ma_ok = 0
              THEN 'DỪNG — tệp bị đổi mã chữ, chưa đổi gì. Mở thẳng tệp trong Workbench hoặc chạy mysql --default-character-set=utf8mb4 < tệp'
            WHEN @chay_that = 1 THEN 'ĐÃ CHẠY THẬT'
            ELSE 'CHỈ XEM TRƯỚC — chưa đổi gì' END AS che_do,
       CASE WHEN @sau_thue = 0 THEN 'CHƯA CÓ' WHEN @co_thue = 1 THEN 'đã có' ELSE 'đã tạo' END AS a_thue_suat_gtgt,
       @da_them_thue AS a_dong_thue_suat_da_them,
       CASE WHEN @sau_cau_hinh = 0 THEN 'CHƯA CÓ' WHEN @co_cau_hinh = 1 THEN 'đã có' ELSE 'đã tạo' END AS b_cau_hinh_ke_toan,
       CASE WHEN @sau_lo = 0 THEN 'CHƯA CÓ' WHEN @co_lo = 1 THEN 'đã có' ELSE 'đã tạo' END AS c_lo_xuat_ke_toan,
       CASE WHEN @sau_chung_tu = 0 THEN 'CHƯA CÓ' WHEN @co_chung_tu = 1 THEN 'đã có' ELSE 'đã tạo' END AS d_chung_tu_xuat_ke_toan,
       CASE WHEN @sau_hoa_don = 0 THEN 'CHƯA CÓ' WHEN @co_hoa_don = 1 THEN 'đã có' ELSE 'đã tạo' END AS e_hoa_don_dau_vao,
       CASE WHEN @sau_mst_ncc = 0 THEN 'CHƯA CÓ' WHEN @co_mst_ncc = 1 THEN 'đã có' ELSE 'đã thêm' END AS f_nha_cung_cap_ma_so_thue,
       CASE WHEN @sau_giam_gia = 0 THEN 'CHƯA CÓ' WHEN @co_giam_gia = 1 THEN 'đã có' ELSE 'đã thêm' END AS g_dong_don_tien_giam_gia,
       CASE WHEN @sau_chung_tu = 0 OR @sau_hoa_don = 0 THEN '—'
            WHEN @sau_khoa_ct = 1 AND @sau_khoa_hd = 1 THEN 'đủ'
            ELSE 'THIẾU khóa duy nhất (khoa_hieu_luc hoặc phieu_nhap_kho_id) — bảng cũ khác bản này, chưa lên backend' END AS kiem_khoa_chong_trung,
       CASE WHEN @co_phi_thuc_te = 1 THEN 'đã chạy'
            ELSE 'CHƯA CHẠY migration-2026-10-25-cuoc-van-chuyen-thuc-te.sql — chạy trước khi lên backend' END AS migration_25_10;

SET SESSION lock_wait_timeout = @cho_khoa_cu;
SET SESSION innodb_lock_wait_timeout = @cho_khoa_dong_cu;
SET SESSION autocommit = @autocommit_cu;

-- ---------------------------------------------------------------------
-- Hoàn tác (chạy tay, chỉ khi đã quay về backend CŨ — backend mới cần các bảng, cột này).
-- Sao lưu trước: giảm giá Shopify kéo về sau khi lên bản mới chỉ nằm ở cột tien_giam_gia, xóa cột là mất.
--   mysqldump fashion_system thue_suat_gtgt cau_hinh_ke_toan lo_xuat_ke_toan chung_tu_xuat_ke_toan hoa_don_dau_vao > bk_ke_toan.sql
--   SELECT id, tien_giam_gia FROM chi_tiet_don_ban_hang WHERE tien_giam_gia <> 0;   -- lưu kết quả lại
--   ALTER TABLE chi_tiet_don_ban_hang DROP COLUMN tien_giam_gia;
--   ALTER TABLE nha_cung_cap DROP COLUMN ma_so_thue;
--   DROP TABLE hoa_don_dau_vao;
--   DROP TABLE chung_tu_xuat_ke_toan;
--   DROP TABLE lo_xuat_ke_toan;      -- mất cả tệp các lô đã giao: tải về giữ trước khi xóa
--   DROP TABLE cau_hinh_ke_toan;
--   DROP TABLE thue_suat_gtgt;
-- ---------------------------------------------------------------------
