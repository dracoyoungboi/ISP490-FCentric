-- =====================================================================
-- Kiểm kê khoanh vùng trên F Centric – 2026-11-03 (thiết kế 1.1)
--
-- Dựa trên tệp thiet-ke-kiem-ke-khoanh-vung.sql (thiết kế 1.0 của BA), giữ nguyên các bảng, cột, khóa và ràng buộc.
-- Các chỗ sửa so với bản 1.0 (đã đối chiếu dump fashion_system_2026-11-03_06-00):
--   a. Bỏ điều kiện "không còn đợt trang_thai IN (1,2)". Code cũ dùng 0 = đang kiểm, 1 = hoàn thành nên điều kiện này
--      luôn dừng. Thay bằng bước 1 đổi đợt cũ sang nghĩa mới (chốt Đ1):
--        đợt cũ 1 (đã hoàn thành, tồn đã ghi)   → 3 Đã duyệt, dòng → 3 Đã xác nhận, ngày duyệt = ngày hoàn thành
--        đợt cũ 0 (đang kiểm, chưa đổi tồn)      → 4 Đã hủy, lý do "Đóng khi nâng cấp kiểm kê khoanh vùng"
--   b. chi_tiet_kiem_ke.lan_kiem_dem đang NULL ở mọi dòng cũ: gán 1 trước khi đổi sang NOT NULL (bản 1.0 lỗi ở đây
--      sau khi các lệnh trước đã tự commit).
--   c. phan_bo_lo_nhat_hang_vi_tri xóa theo phân bổ cha (ON DELETE CASCADE): phiếu nhặt lưu lại phân bổ bằng cách xóa
--      dòng cũ rồi ghi dòng mới, không có cascade thì lệnh xóa đó lỗi khóa ngoại.
--   d. Kiểm phiên bản MySQL nhận cả 8.1 trở lên (bản 1.0 chỉ nhận 8.0.x).
--
-- THỨ TỰ KHI TRIỂN KHAI: dừng backend → tệp này → migration-2026-11-03-doi-soat-ton-theo-ke.sql → backend mới →
-- frontend mới. Backend cũ đọc trạng thái kiểm kê theo nghĩa cũ (3, 4 bị hiểu sai) nên không để backend cũ chạy sau
-- tệp này. Máy cá nhân chạy backend (IntelliJ) trên CSDL dùng chung cũng phải tắt trong lúc chạy.
-- Backend mới tự nhận ra khi tệp này chưa chạy: các luồng nhập / xuất / bán vẫn chạy bình thường, chỉ màn Kiểm kê
-- báo "chưa nâng cấp CSDL".
--
-- CHẠY MỘT LẦN. Chạy lại sẽ dừng ở bước kiểm tra (cột / bảng đích đã có) và không đổi gì.
-- MySQL tự commit sau mỗi lệnh đổi cấu trúc: lỗi giữa chừng thì KHÔNG chạy lại mù quáng; đối chiếu SHOW CREATE TABLE
-- các bảng ở bước 2–6, làm nốt các bước còn thiếu hoặc phục hồi bản sao lưu.
-- Cách chạy: mysql --default-character-set=utf8mb4 fashion_system < tệp này; Workbench: chạy cả tệp (có DELIMITER).
-- Không chạy với --force.
-- =====================================================================

SET NAMES utf8mb4;
USE fashion_system;          -- đổi nếu CSDL của bạn tên khác
-- MySQL Workbench bật sẵn "Safe Updates": UPDATE không lọc theo cột khóa (vd. WHERE trang_thai = 1) bị chặn, Error 1175.
-- Tắt cho riêng phiên chạy tệp này; cuối tệp trả lại như cũ.
SET @safe_updates_truoc = @@SESSION.sql_safe_updates;
SET SESSION sql_safe_updates = 0;

DROP PROCEDURE IF EXISTS migrate_kiem_ke_khoanh_vung_20261103;

DELIMITER $$
CREATE PROCEDURE migrate_kiem_ke_khoanh_vung_20261103()
BEGIN
  DECLARE n INT DEFAULT 0;
  DECLARE v_chinh INT DEFAULT 0;
  DECLARE v_phu INT DEFAULT 0;
  DECLARE v_va INT DEFAULT 0;

  -- ===== 0. Kiểm tra trước, chưa đổi gì =====
  SET v_chinh = CAST(SUBSTRING_INDEX(VERSION(), '.', 1) AS UNSIGNED);
  SET v_phu = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(VERSION(), '.', 2), '.', -1) AS UNSIGNED);
  SET v_va = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(VERSION(), '-', 1), '.', 3), '.', -1) AS UNSIGNED);
  IF v_chinh < 8 OR (v_chinh = 8 AND v_phu = 0 AND v_va < 16) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Can MySQL 8.0.16 tro len (CHECK constraint duoc thuc thi)';
  END IF;

  SELECT COUNT(*) INTO n FROM information_schema.tables
  WHERE table_schema = DATABASE() AND engine = 'InnoDB'
    AND table_name IN ('kho','khu_vuc_kho','vi_tri_kho','ton_kho_vi_tri',
      'lo_hang','bien_the_san_pham','danh_muc_quan_ao','nguoi_dung',
      'dot_kiem_ke','chi_tiet_kiem_ke','chi_tiet_phieu_dieu_chinh','phan_bo_lo_nhat_hang');
  IF n <> 12 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Thieu bang InnoDB phu thuoc; doi chieu schema truoc';
  END IF;

  SELECT COUNT(*) INTO n FROM information_schema.columns
  WHERE table_schema = DATABASE() AND column_name = 'id' AND data_type = 'int'
    AND column_type NOT LIKE '%unsigned%'
    AND table_name IN ('kho','khu_vuc_kho','vi_tri_kho','lo_hang',
      'bien_the_san_pham','danh_muc_quan_ao','nguoi_dung','dot_kiem_ke',
      'chi_tiet_kiem_ke','phan_bo_lo_nhat_hang');
  IF n <> 10 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khoa ngoai du kien INT signed; schema thuc te khong khop';
  END IF;

  SELECT COUNT(*) INTO n FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'chi_tiet_phieu_dieu_chinh'
    AND column_name IN ('chi_tiet_bien_ban_id','chi_tiet_kiem_ke_id') AND is_nullable = 'YES';
  IF n <> 2 OR NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE() AND table_name = 'chi_tiet_phieu_dieu_chinh'
      AND constraint_name = 'chk_ctpdc_mot_nguon' AND constraint_type = 'CHECK' AND enforced = 'YES'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Can migration chuyen kho 2026-10-28: hai nguon nullable va CHECK XOR';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'chi_tiet_kiem_ke'
      AND index_name = 'unique_dot_bien_the_lo' AND non_unique = 0
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Khong thay unique_dot_bien_the_lo; migration da chay hoac schema khac';
  END IF;

  SELECT COUNT(*) INTO n FROM information_schema.columns
  WHERE table_schema = DATABASE() AND (
    (table_name = 'dot_kiem_ke' AND column_name IN ('danh_muc_id','phien_ban','phien_ban_pham_vi','ngay_du_kien_bat_dau','nguoi_huy_id','ngay_huy','ly_do_huy'))
    OR (table_name = 'chi_tiet_kiem_ke' AND column_name IN ('vi_tri_kho_id','khoa_vi_tri','phien_ban'))
    OR (table_name = 'ton_kho_vi_tri' AND column_name = 'dang_kiem_ke'));
  IF n > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cot dich da ton tai: day la migration mot lan; doi chieu truoc';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name IN (
      'dot_kiem_ke_khu_vuc','dot_kiem_ke_danh_muc','dot_kiem_ke_vi_tri',
      'dot_kiem_ke_khoa_lo','kiem_ke_mutex_kho','kiem_ke_lan_dem',
      'kiem_ke_lenh','kiem_ke_outbox','phan_bo_lo_nhat_hang_vi_tri')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bang dich da ton tai: can doi chieu migration da chay mot phan';
  END IF;

  IF EXISTS (SELECT 1 FROM dot_kiem_ke WHERE trang_thai NOT IN (0, 1)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Co dot kiem ke trang_thai khac 0/1: khong phai du lieu cua code cu';
  END IF;

  -- ===== 1. Đổi đợt cũ sang nghĩa trạng thái mới (chốt Đ1) =====
  UPDATE chi_tiet_kiem_ke SET lan_kiem_dem = 1 WHERE lan_kiem_dem IS NULL;

  UPDATE chi_tiet_kiem_ke c JOIN dot_kiem_ke d ON d.id = c.dot_kiem_ke_id
  SET c.trang_thai = 3
  WHERE d.trang_thai = 1 AND c.trang_thai = 1;

  UPDATE dot_kiem_ke
  SET trang_thai = 3,
      ngay_duyet = COALESCE(ngay_duyet, ngay_hoan_thanh),
      ngay_ket_thuc = COALESCE(ngay_ket_thuc, ngay_hoan_thanh)
  WHERE trang_thai = 1;

  UPDATE dot_kiem_ke
  SET trang_thai = 4,
      ngay_ket_thuc = COALESCE(ngay_ket_thuc, CURRENT_TIMESTAMP)
  WHERE trang_thai = 0;

  -- ===== 2. Header và phạm vi lựa chọn =====
  ALTER TABLE dot_kiem_ke
    MODIFY COLUMN loai_kiem_ke ENUM('toan_bo','theo_danh_muc','theo_khu_vuc','theo_ke','dot_xuat')
      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'toan_bo',
    MODIFY COLUMN ngay_bat_dau TIMESTAMP NULL DEFAULT NULL COMMENT 'Thoi diem kich hoat thuc te',
    MODIFY COLUMN trang_thai TINYINT(1) DEFAULT '0' COMMENT '0: Nhap, 1: Dang kiem ke, 2: Cho duyet, 3: Da duyet, 4: Da huy',
    ADD COLUMN danh_muc_id INT NULL COMMENT 'Danh muc goc; tap hau due chot o bang rieng',
    ADD COLUMN ngay_du_kien_bat_dau TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN phien_ban BIGINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN phien_ban_pham_vi TINYINT NOT NULL DEFAULT 1 COMMENT '1: du lieu cu; backend moi gan 2',
    ADD COLUMN nguoi_huy_id INT NULL,
    ADD COLUMN ngay_huy TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN ly_do_huy TEXT NULL,
    ADD CONSTRAINT fk_stk_header_dm FOREIGN KEY (danh_muc_id) REFERENCES danh_muc_quan_ao(id),
    ADD CONSTRAINT fk_stk_header_huy FOREIGN KEY (nguoi_huy_id) REFERENCES nguoi_dung(id);

  UPDATE dot_kiem_ke
  SET ly_do_huy = 'Đóng khi nâng cấp kiểm kê khoanh vùng (đợt mở theo luồng cũ, chưa đổi tồn)',
      ngay_huy = ngay_ket_thuc
  WHERE trang_thai = 4 AND ly_do_huy IS NULL;

  CREATE TABLE dot_kiem_ke_khu_vuc (
    dot_kiem_ke_id INT NOT NULL,
    khu_vuc_kho_id INT NOT NULL,
    PRIMARY KEY (dot_kiem_ke_id, khu_vuc_kho_id),
    CONSTRAINT fk_stk_zone_dot FOREIGN KEY (dot_kiem_ke_id) REFERENCES dot_kiem_ke(id),
    CONSTRAINT fk_stk_zone_zone FOREIGN KEY (khu_vuc_kho_id) REFERENCES khu_vuc_kho(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Nhieu khu vuc; service kiem tra cung kho voi dot';

  CREATE TABLE dot_kiem_ke_danh_muc (
    dot_kiem_ke_id INT NOT NULL,
    danh_muc_id INT NOT NULL,
    PRIMARY KEY (dot_kiem_ke_id, danh_muc_id),
    KEY idx_stk_dm_lookup (danh_muc_id, dot_kiem_ke_id),
    CONSTRAINT fk_stk_dm_dot FOREIGN KEY (dot_kiem_ke_id) REFERENCES dot_kiem_ke(id),
    CONSTRAINT fk_stk_dm_dm FOREIGN KEY (danh_muc_id) REFERENCES danh_muc_quan_ao(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Tap danh muc goc + hau due de quy chot khi bat dau';

  -- ===== 3. Sở hữu khóa toàn kệ và khóa mịn =====
  CREATE TABLE dot_kiem_ke_vi_tri (
    id INT NOT NULL AUTO_INCREMENT,
    dot_kiem_ke_id INT NOT NULL,
    vi_tri_kho_id INT NOT NULL,
    che_do_khoa ENUM('toan_ke','theo_lo') NOT NULL,
    trang_thai_khoa TINYINT NOT NULL DEFAULT 0,
    trang_thai_truoc_khoa VARCHAR(30) NULL,
    thoi_diem_khoa TIMESTAMP NULL DEFAULT NULL,
    thoi_diem_mo_khoa TIMESTAMP NULL DEFAULT NULL,
    nguoi_mo_khoa_id INT NULL,
    ghi_chu VARCHAR(255) NULL,
    khoa_toan_ke_active TINYINT GENERATED ALWAYS AS
      (CASE WHEN trang_thai_khoa = 1 AND che_do_khoa = 'toan_ke' THEN 1 ELSE NULL END) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uk_stk_dot_bin (dot_kiem_ke_id, vi_tri_kho_id),
    UNIQUE KEY uk_stk_active_bin (vi_tri_kho_id, khoa_toan_ke_active),
    KEY idx_stk_bin_lock (vi_tri_kho_id, trang_thai_khoa),
    CONSTRAINT chk_stk_bin_flag CHECK (trang_thai_khoa IN (0,1)),
    CONSTRAINT fk_stk_bin_dot FOREIGN KEY (dot_kiem_ke_id) REFERENCES dot_kiem_ke(id),
    CONSTRAINT fk_stk_bin_bin FOREIGN KEY (vi_tri_kho_id) REFERENCES vi_tri_kho(id),
    CONSTRAINT fk_stk_bin_user FOREIGN KEY (nguoi_mo_khoa_id) REFERENCES nguoi_dung(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Danh sach bin va chu so huu khoa; theo_lo chi la tong hop theo bin';

  CREATE TABLE dot_kiem_ke_khoa_lo (
    id BIGINT NOT NULL AUTO_INCREMENT,
    dot_kiem_ke_id INT NOT NULL,
    vi_tri_kho_id INT NOT NULL,
    lo_hang_id INT NOT NULL,
    trang_thai_khoa TINYINT NOT NULL DEFAULT 1,
    thoi_diem_khoa TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    thoi_diem_mo_khoa TIMESTAMP NULL DEFAULT NULL,
    nguoi_mo_khoa_id INT NULL,
    khoa_active TINYINT GENERATED ALWAYS AS
      (CASE WHEN trang_thai_khoa = 1 THEN 1 ELSE NULL END) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uk_stk_dot_bin_lot (dot_kiem_ke_id, vi_tri_kho_id, lo_hang_id),
    UNIQUE KEY uk_stk_active_bin_lot (vi_tri_kho_id, lo_hang_id, khoa_active),
    CONSTRAINT chk_stk_lot_flag CHECK (trang_thai_khoa IN (0,1)),
    CONSTRAINT fk_stk_lot_scope FOREIGN KEY (dot_kiem_ke_id,vi_tri_kho_id)
      REFERENCES dot_kiem_ke_vi_tri(dot_kiem_ke_id,vi_tri_kho_id),
    CONSTRAINT fk_stk_lot_lot FOREIGN KEY (lo_hang_id) REFERENCES lo_hang(id),
    CONSTRAINT fk_stk_lot_user FOREIGN KEY (nguoi_mo_khoa_id) REFERENCES nguoi_dung(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Khoa min co chu so huu, ke ca blind find chua co dong ton';

  ALTER TABLE ton_kho_vi_tri
    ADD COLUMN dang_kiem_ke TINYINT NOT NULL DEFAULT 0 COMMENT 'Cache khoa min, khong thay the guard pham vi',
    ADD CONSTRAINT chk_stk_inventory_flag CHECK (dang_kiem_ke IN (0,1));

  -- ===== 4. Số chốt theo vị trí, giữ tương thích lịch sử chưa biết kệ =====
  ALTER TABLE chi_tiet_kiem_ke
    ADD COLUMN vi_tri_kho_id INT NULL AFTER loai_chenh_lech,
    ADD COLUMN khoa_vi_tri INT GENERATED ALWAYS AS (COALESCE(vi_tri_kho_id,0)) STORED,
    ADD COLUMN phien_ban BIGINT UNSIGNED NOT NULL DEFAULT 0,
    MODIFY COLUMN so_luong_thuc_te DECIMAL(15,3) NULL DEFAULT NULL COMMENT 'NULL = chua dem, 0 = da dem bang 0',
    MODIFY COLUMN chenh_lech_so_luong DECIMAL(15,3) NULL DEFAULT NULL COMMENT 'so_luong_thuc_te - so_luong_he_thong',
    MODIFY COLUMN ti_le_chenh_lech DECIMAL(18,2) NULL DEFAULT NULL,
    MODIFY COLUMN gia_tri_chenh_lech DECIMAL(15,2) NULL DEFAULT NULL,
    MODIFY COLUMN lan_kiem_dem INT UNSIGNED NOT NULL DEFAULT 1,
    DROP INDEX unique_dot_bien_the_lo,
    ADD UNIQUE KEY uk_stk_dot_sku_lot_bin (dot_kiem_ke_id,bien_the_san_pham_id,lo_hang_id,khoa_vi_tri),
    ADD CONSTRAINT fk_stk_line_bin FOREIGN KEY (vi_tri_kho_id) REFERENCES vi_tri_kho(id);

  CREATE TABLE kiem_ke_lan_dem (
    id BIGINT NOT NULL AUTO_INCREMENT,
    chi_tiet_kiem_ke_id INT NOT NULL,
    lan_kiem_dem INT UNSIGNED NOT NULL,
    so_luong_he_thong DECIMAL(15,3) NOT NULL,
    gia_von_he_thong DECIMAL(15,2) NOT NULL,
    so_luong_thuc_te DECIMAL(15,3) NOT NULL,
    ly_do_chenh_lech TEXT NULL,
    bien_phap_xu_ly TEXT NULL,
    nguoi_kiem_dem_id INT NULL,
    ngay_kiem_dem TIMESTAMP NULL DEFAULT NULL,
    nguoi_yeu_cau_id INT NOT NULL,
    ly_do_kiem_lai TEXT NOT NULL,
    ngay_yeu_cau TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    anh_tham_chieu JSON NULL COMMENT 'Danh sach ID anh cua lan dem; giu tep goc',
    PRIMARY KEY (id),
    UNIQUE KEY uk_stk_recount (chi_tiet_kiem_ke_id,lan_kiem_dem),
    CONSTRAINT fk_stk_recount_line FOREIGN KEY (chi_tiet_kiem_ke_id) REFERENCES chi_tiet_kiem_ke(id),
    CONSTRAINT fk_stk_recount_counter FOREIGN KEY (nguoi_kiem_dem_id) REFERENCES nguoi_dung(id),
    CONSTRAINT fk_stk_recount_requester FOREIGN KEY (nguoi_yeu_cau_id) REFERENCES nguoi_dung(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Luu ket qua truoc khi reset dong de dem lai; khong sua/xoa qua API';

  -- ===== 5. Phân bổ nhặt theo kệ =====
  CREATE TABLE phan_bo_lo_nhat_hang_vi_tri (
    id BIGINT NOT NULL AUTO_INCREMENT,
    phan_bo_lo_nhat_hang_id INT NOT NULL,
    vi_tri_kho_id INT NOT NULL,
    so_luong DECIMAL(15,3) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_stk_pick_bin (phan_bo_lo_nhat_hang_id,vi_tri_kho_id),
    KEY idx_stk_pick_bin (vi_tri_kho_id),
    CONSTRAINT chk_stk_pick_qty CHECK (so_luong > 0),
    CONSTRAINT fk_stk_pick_allocation FOREIGN KEY (phan_bo_lo_nhat_hang_id) REFERENCES phan_bo_lo_nhat_hang(id)
      ON DELETE CASCADE,
    CONSTRAINT fk_stk_pick_bin FOREIGN KEY (vi_tri_kho_id) REFERENCES vi_tri_kho(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Phan cua phan bo nam o ke; phan con lai lay o hang chua co ke';
  -- Phân bổ cũ chưa biết kệ KHÔNG tự điền từ lo_hang.vi_tri_kho_id: backend chặn bảo thủ theo lô cho tới khi
  -- phiếu nhặt hoàn tất hoặc lưu lại phân bổ.

  -- ===== 6. Mutex, idempotency và outbox =====
  CREATE TABLE kiem_ke_mutex_kho (
    kho_id INT NOT NULL,
    PRIMARY KEY (kho_id),
    CONSTRAINT fk_stk_mutex_kho FOREIGN KEY (kho_id) REFERENCES kho(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  INSERT INTO kiem_ke_mutex_kho(kho_id) SELECT id FROM kho;

  CREATE TABLE kiem_ke_lenh (
    id BIGINT NOT NULL AUTO_INCREMENT,
    kho_id INT NOT NULL,
    idempotency_key VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    loai_lenh VARCHAR(30) NOT NULL,
    payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    dot_kiem_ke_id INT NULL,
    ket_qua JSON NOT NULL,
    ngay_tao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_stk_command (kho_id,idempotency_key),
    CONSTRAINT fk_stk_command_kho FOREIGN KEY (kho_id) REFERENCES kho(id),
    CONSTRAINT fk_stk_command_dot FOREIGN KEY (dot_kiem_ke_id) REFERENCES dot_kiem_ke(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Luu ket qua lenh cung transaction; hash khac cung key thi 409';

  CREATE TABLE kiem_ke_outbox (
    id BIGINT NOT NULL AUTO_INCREMENT,
    dot_kiem_ke_id INT NOT NULL,
    kho_id INT NOT NULL,
    bien_the_san_pham_id INT NOT NULL,
    payload JSON NOT NULL COMMENT 'Ma phieu, delta, version; worker doc ton moi nhat truoc khi gui',
    uu_tien TINYINT NOT NULL DEFAULT 0,
    trang_thai ENUM('cho_gui','dang_gui','da_gui','loi') NOT NULL DEFAULT 'cho_gui',
    so_lan_thu INT UNSIGNED NOT NULL DEFAULT 0,
    thu_lai_luc TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lease_den TIMESTAMP NULL DEFAULT NULL,
    lease_token VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ket_qua_kenh JSON NULL COMMENT 'Ket qua tung kenh de retry kenh con loi',
    loi_cuoi TEXT NULL,
    ngay_tao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ngay_gui TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_stk_event (dot_kiem_ke_id,bien_the_san_pham_id),
    KEY idx_stk_dispatch (trang_thai,thu_lai_luc,uu_tien),
    CONSTRAINT fk_stk_event_dot FOREIGN KEY (dot_kiem_ke_id) REFERENCES dot_kiem_ke(id),
    CONSTRAINT fk_stk_event_kho FOREIGN KEY (kho_id) REFERENCES kho(id),
    CONSTRAINT fk_stk_event_sku FOREIGN KEY (bien_the_san_pham_id) REFERENCES bien_the_san_pham(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  SELECT 'OK - Cau truc kiem ke khoanh vung 1.1 da tao' AS ket_qua;
END$$
DELIMITER ;

CALL migrate_kiem_ke_khoanh_vung_20261103();
DROP PROCEDURE migrate_kiem_ke_khoanh_vung_20261103;
SET SESSION sql_safe_updates = @safe_updates_truoc;

-- ===== 7. Đối chiếu sau khi chạy (chỉ đọc) =====
SELECT id, ma_dot_kiem_ke, kho_id, trang_thai, ngay_hoan_thanh, ngay_duyet, ngay_huy, ly_do_huy
FROM dot_kiem_ke ORDER BY id;
SELECT COUNT(*) AS so_mutex, (SELECT COUNT(*) FROM kho) AS so_kho FROM kiem_ke_mutex_kho;
SHOW CREATE TABLE dot_kiem_ke_vi_tri;
SHOW CREATE TABLE dot_kiem_ke_khoa_lo;
SHOW CREATE TABLE chi_tiet_kiem_ke;
