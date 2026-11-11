-- =====================================================================
-- Chuyển kệ nội bộ (UC-7.4 Internal Bin Relocation) trên F Centric – 2026-11-11
--
-- Đặc tả BA "Đặc tả chuyển kệ, trả hàng POS, xuất dữ liệu MISA", phần V:
--   * phieu_chuyen_ke            : phiếu chuyển kệ MV-YYYYMMDD-XXXX (một lượt Scan-to-Move trong một kho).
--   * chi_tiet_phieu_chuyen_ke   : từng dòng [biến thể – lô – kệ nguồn – kệ đích – số lượng]; một lô tách cất nhiều kệ
--                                  là nhiều dòng (BR-BIN-05).
--   * lich_su_giao_dich_kho      : thêm loại 'chuyen_ke_noi_bo' cho dòng kiểm toán (BA bước 9). Dòng loại này giữ
--                                  so_luong_truoc = so_luong_sau = tồn lô ở kho (BR-BIN-01: tồn kho không đổi); báo cáo
--                                  nhập xuất và xuất dữ liệu kế toán bỏ qua loại này.
--
-- Khác DDL của BA: khóa ngoại tới bảng kho là `kho` (BA ghi kho_hang — tên bảng trong hệ thống là kho); thêm tên khóa
-- duy nhất uk_phieu_chuyen_ke_ma để backend nhận ra trùng số khi hai người chốt cùng lúc và cấp lại số.
--
-- THỨ TỰ KHI TRIỂN KHAI: tệp này → backend mới → frontend mới. Không cần dừng backend: hai bảng mới chưa ai dùng; thêm
-- một giá trị vào cuối ENUM là đổi siêu dữ liệu, MySQL 8 làm tức thì. Backend mới lên trước tệp này thì màn Chuyển kệ
-- báo "máy chủ chưa nâng cấp" (kiểm lại mỗi 30 giây), các luồng khác chạy bình thường.
--
-- CHẠY MỘT LẦN. Chạy lại khi đã đủ sẽ dừng ở bước kiểm tra, không đổi gì; lần trước chạy dở thì làm nốt phần còn thiếu.
-- Cách chạy: mysql --default-character-set=utf8mb4 fashion_system < tệp này; Workbench: chạy cả tệp (có DELIMITER).
-- =====================================================================

DROP PROCEDURE IF EXISTS migrate_chuyen_ke_noi_bo_20261111;

DELIMITER $$
CREATE PROCEDURE migrate_chuyen_ke_noi_bo_20261111()
than_thu_tuc: BEGIN
  -- Ba phần độc lập: chạy dở (vd. lỗi ở bước ENUM) thì chạy lại làm nốt phần còn thiếu; đủ cả ba thì dừng
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = DATABASE() AND table_name = 'phieu_chuyen_ke')
     AND EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = DATABASE() AND table_name = 'chi_tiet_phieu_chuyen_ke')
     AND EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = DATABASE() AND table_name = 'lich_su_giao_dich_kho' AND column_name = 'loai_giao_dich'
                AND (data_type <> 'enum' OR column_type LIKE '%''chuyen_ke_noi_bo''%')) THEN
    -- Báo rồi thoát (không SIGNAL): client chạy tiếp tới DROP PROCEDURE cuối tệp, không để sót thủ tục
    SELECT 'Chuyen ke noi bo da co du bang va loai giao dich: migration nay da chay, khong doi gi' AS ket_qua;
    LEAVE than_thu_tuc;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = DATABASE() AND table_name = 'ton_kho_vi_tri') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chua co bang ton_kho_vi_tri (so ton theo ke)';
  END IF;

  CREATE TABLE IF NOT EXISTS phieu_chuyen_ke (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ma_phieu VARCHAR(50) NOT NULL COMMENT 'VD: MV-20261110-0001',
    kho_id INT NOT NULL COMMENT 'Kho / cua hang xay ra giao dich',
    loai_chuyen ENUM('TRUC_TIEP', 'THEO_KE_HOACH') NOT NULL DEFAULT 'TRUC_TIEP'
      COMMENT 'Scan-to-Move truc tiep hoac theo lenh gom hang',
    nguoi_thuc_hien_id INT NOT NULL,
    ngay_thuc_hien DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vuot_suc_chua TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = quan ly kho cho cat vuot suc chua ke dich (Manager Override)',
    ghi_chu VARCHAR(255) NULL,
    CONSTRAINT uk_phieu_chuyen_ke_ma UNIQUE (ma_phieu),
    KEY idx_pck_kho_ngay (kho_id, ngay_thuc_hien),
    CONSTRAINT fk_pck_kho FOREIGN KEY (kho_id) REFERENCES kho (id),
    CONSTRAINT fk_pck_user FOREIGN KEY (nguoi_thuc_hien_id) REFERENCES nguoi_dung (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Phieu chuyen vi tri luu tru noi bo trong kho';

  CREATE TABLE IF NOT EXISTS chi_tiet_phieu_chuyen_ke (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phieu_chuyen_ke_id INT NOT NULL,
    bien_the_san_pham_id INT NOT NULL,
    lo_hang_id INT NOT NULL COMMENT 'Bat buoc chi dinh lo de bao toan FIFO',
    ke_nguon_id INT NOT NULL COMMENT 'Khoa ngoai toi vi_tri_kho nguon',
    ke_dich_id INT NOT NULL COMMENT 'Khoa ngoai toi vi_tri_kho dich',
    so_luong DECIMAL(15,3) NOT NULL,
    CONSTRAINT ck_ct_pck_so_luong CHECK (so_luong > 0),
    KEY idx_ct_pck_lo (lo_hang_id),
    KEY idx_ct_pck_ke_dich (ke_dich_id),
    CONSTRAINT fk_ct_pck_master FOREIGN KEY (phieu_chuyen_ke_id) REFERENCES phieu_chuyen_ke (id) ON DELETE CASCADE,
    CONSTRAINT fk_ct_pck_variant FOREIGN KEY (bien_the_san_pham_id) REFERENCES bien_the_san_pham (id),
    CONSTRAINT fk_ct_pck_lot FOREIGN KEY (lo_hang_id) REFERENCES lo_hang (id),
    CONSTRAINT fk_ct_pck_src FOREIGN KEY (ke_nguon_id) REFERENCES vi_tri_kho (id),
    CONSTRAINT fk_ct_pck_des FOREIGN KEY (ke_dich_id) REFERENCES vi_tri_kho (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Dong chi tiet dich chuyen vi tri san pham theo lo';

  -- Thêm giá trị vào CUỐI enum đang có (giữ nguyên các giá trị và thứ tự cũ, kể cả giá trị ai đó đã thêm ngoài các tệp
  -- migration): đổi siêu dữ liệu, không chép lại bảng. Cột đã là VARCHAR thì không cần đổi.
  SELECT DATA_TYPE, COLUMN_TYPE, IS_NULLABLE INTO @kieu, @kieu_day_du, @cho_null
    FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'lich_su_giao_dich_kho' AND column_name = 'loai_giao_dich';
  IF @kieu = 'enum' AND @kieu_day_du NOT LIKE '%''chuyen_ke_noi_bo''%' THEN
    SET @sql_doi = CONCAT('ALTER TABLE lich_su_giao_dich_kho MODIFY COLUMN loai_giao_dich ',
                          LEFT(@kieu_day_du, CHAR_LENGTH(@kieu_day_du) - 1), ',''chuyen_ke_noi_bo'')',
                          ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
                          IF(@cho_null = 'NO', ' NOT NULL', ' NULL'));
    PREPARE lenh_doi FROM @sql_doi;
    EXECUTE lenh_doi;
    DEALLOCATE PREPARE lenh_doi;
  END IF;
END$$
DELIMITER ;

CALL migrate_chuyen_ke_noi_bo_20261111();
DROP PROCEDURE IF EXISTS migrate_chuyen_ke_noi_bo_20261111;
