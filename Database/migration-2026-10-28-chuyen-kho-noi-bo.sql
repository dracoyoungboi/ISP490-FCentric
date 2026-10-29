-- =====================================================================
-- Chuyển kho nội bộ theo đặc tả BA (UC-7.1, SDS Phần III) – 2026-10-28
--
-- MẶC ĐỊNH CHỈ XEM TRƯỚC: chạy nguyên tệp với @chay_that = 0 không đổi gì trong CSDL, chỉ in hiện trạng và việc
-- sẽ làm. Xem kỹ rồi đổi @chay_that = 1 và chạy lại. Chạy lại nhiều lần không lỗi: bước nào đã làm thì tự bỏ qua,
-- phần chép dữ liệu cũ chỉ chép phiếu chưa có (theo id và số phiếu).
--
-- Việc tệp làm:
--   a. Bảng phieu_chuyen_kho, chi_tiet_phieu_chuyen_kho (đúng SQL của BA) + cột người hủy, lý do hủy, ghi chú lệnh;
--      nguoi_tao_id cho phép trống (phiếu cũ không lưu người tạo); số lệnh điều động và cặp (ký hiệu, số) XKNB
--      không trùng.
--   b. phieu_xuat_kho.phieu_chuyen_kho_id, phieu_nhap_kho.phieu_chuyen_kho_id (đúng SQL của BA).
--   c. bien_ban_giao_nhan, chi_tiet_bien_ban_giao_nhan (SQL của BA) + lo_hang_id ở dòng biên bản (màn nhận hàng B.4
--      nhập theo lô; không có lô thì không trừ đúng tồn kho trung chuyển và không có giá vốn).
--   d. phieu_dieu_chinh_kho / chi_tiet_phieu_dieu_chinh nhận thêm nguồn "chuyển kho" (ghi giảm chênh lệch theo biên
--      bản, kể cả khi giao bù), giữ nguyên phiếu kiểm kê cũ.
--   e. Chép phiếu chuyển cũ (dòng phieu_xuat_kho loai_xuat = 'khac') sang phieu_chuyen_kho, GIỮ NGUYÊN id (đường dẫn
--      /transfer-tickets/:id cũ vẫn mở đúng phiếu); nối phiếu xuất con và phiếu nhập vào cột mới. Dữ liệu cũ KHÔNG bị
--      xóa ở tệp này (xem tệp dọn ...-don-phieu-cu.sql, chạy sau khi backend mới chạy ổn).
--      Đổi trạng thái: 1 → CHO_DUYET, 2 → DA_DUYET, 3 → DANG_VAN_CHUYEN, 4 → DA_HUY, 5 → HOAN_TAT.
--      Phiếu Nháp (0): BA không có trạng thái Nháp; mặc định chuyển sang DA_HUY kèm lý do (không tự đưa vào hàng chờ
--      duyệt và không giữ chỗ tồn). Muốn đưa sang Chờ duyệt thì đổi @nhap_cu_thanh = 'CHO_DUYET'.
--   e2. Cấu hình giấy đi đường: ký hiệu XKNB điền sẵn (trống), chế độ khi chưa có số = Chỉ cảnh báo.
--   g. Phiếu nhặt của phiếu chuyển kho (đặc tả bước 8–9): cột danh_sach_nhat_hang.phieu_xuat_kho_id (duy nhất, khóa
--      ngoại tới phieu_xuat_kho) nối một phiếu nhặt với một phiếu xuất PX-CK. Có giá trị = phiếu nhặt chuyển kho, trống =
--      phiếu nhặt gom đơn bán. KHÔNG tạo phiếu nhặt hàng loạt cho phiếu Đã duyệt cũ: kho xuất bấm "Mở phiếu nhặt" thì
--      backend tự tạo (phiếu đã chọn lô tay giữ đường chọn lô cũ).
--   h. Ảnh chụp đính kèm biên bản giao nhận (mockup B.4, ô "Ảnh chụp" không bắt buộc): bảng bien_ban_giao_nhan_anh, mỗi
--      dòng một ảnh (tệp ở MinIO bien-ban-giao-nhan/{id biên bản}/…, thông tin tệp ở tep_tin). Xóa biên bản thì xóa
--      theo dòng ảnh. Tệp đã chạy trước khi có bước này: chạy lại cả tệp, các bước cũ tự bỏ qua.
--
-- LƯU Ý SAU KHI CHẠY: phiếu Chờ duyệt / Đã duyệt bắt đầu GIỮ CHỖ tồn ở kho nguồn (BA, ma trận 3.2), nên số khả dụng
-- và số đẩy lên sàn của các mã đó giảm tương ứng.
--
-- THỨ TỰ KHI TRIỂN KHAI: (CSDL chưa có thì chạy migration-2026-10-27-ghi-nhan-thanh-toan-v2.sql trước) → DỪNG backend
-- cũ → tệp này → migration-2026-10-28-thong-bao.sql → backend mới → frontend mới. Chạy bằng MySQL Workbench: tệp tự tắt
-- SQL_SAFE_UPDATES trong phiên.
--
-- PHẢI DỪNG BACKEND CŨ (hoặc không ai thao tác chuyển kho) từ lúc chạy tệp này tới lúc backend mới lên: chạy lại chỉ
-- chép thêm phiếu cũ chưa có, KHÔNG cập nhật phiếu đã chép. Phiếu backend cũ đổi trạng thái sau bước chép thì bảng mới giữ
-- trạng thái cũ (vd. phiếu đã hủy ở bản cũ vẫn Chờ duyệt và giữ chỗ tồn); phiếu cũ trùng id với phiếu mới thì không chép
-- được. Hai bảng cuối mục f liệt kê các phiếu như vậy để xử lý tay.
--
-- Lỗi giữa chừng (vd. 1205 vì còn kết nối giữ bảng): tắt kết nối đó rồi chạy lại cả tệp trong cùng tab (bước đã làm tự bỏ
-- qua, cuối tệp trả lại cài đặt phiên), hoặc đóng tab và mở kết nối mới.
--
-- Tệp tự kiểm trước khi đổi gì: in các bảng mới đã có sẵn (lần chạy trước / bản nháp), và chỉ chạy thật khi cột số phiếu
-- cũ phieu_xuat_kho.so_phieu_xuat cùng collation utf8mb4_unicode_ci với bảng mới (khác thì so cột với cột báo lỗi 1267
-- giữa chừng) — không khớp thì chỉ xem trước và báo DỪNG.
-- =====================================================================

SET NAMES utf8mb4;           -- mysql CLI mặc định latin1 / cp850 thì chữ tiếng Việt trong COMMENT bị lỗi mã

USE fashion_system;          -- đổi nếu CSDL của bạn tên khác
SET @chay_that = 0;          -- 0 = CHỈ XEM TRƯỚC, không đổi gì · 1 = CHẠY THẬT
SET @nhap_cu_thanh = 'DA_HUY';   -- phiếu Nháp cũ: 'DA_HUY' (mặc định) hoặc 'CHO_DUYET'
SET @lam = 0;                -- đặt ở mục 0 sau khi kiểm collation

-- Chống treo hệ thống: chỉ chờ khóa tối đa 5 giây. Còn kết nối giữ bảng (backend cũ, máy localhost) thì lệnh đó báo lỗi
-- 1205 và KHÔNG đổi gì, thay vì đứng chờ kéo cả hệ thống đứng theo: tắt kết nối rồi chạy lại cả tệp (bước đã làm tự bỏ
-- qua).
-- Giờ Việt Nam cho ngày hủy phiếu Nháp cũ (NOW()): backend ghi giờ +07:00, máy chủ CSDL có thể để UTC.
SET @mui_gio_cu = IFNULL(@mui_gio_cu, @@SESSION.time_zone);
SET SESSION time_zone = '+07:00';
-- Giá trị gốc chỉ lưu khi chưa có, nên lần chạy lại sau lỗi giữa chừng vẫn trả về đúng giá trị ban đầu.
SET @cho_khoa_cu = IFNULL(@cho_khoa_cu, @@SESSION.lock_wait_timeout);
SET @cho_khoa_dong_cu = IFNULL(@cho_khoa_dong_cu, @@SESSION.innodb_lock_wait_timeout);
SET @an_toan_cu = IFNULL(@an_toan_cu, @@SESSION.sql_safe_updates);
SET SESSION lock_wait_timeout = 5;
SET SESSION innodb_lock_wait_timeout = 5;
-- Workbench mặc định bật Safe Updates: UPDATE không lọc theo cột khóa bị chặn (lỗi 1175) — tắt trong lúc chạy
SET SESSION sql_safe_updates = 0;

-- ---------------------------------------------------------------------
-- 0. Hiện trạng
-- ---------------------------------------------------------------------
SELECT trang_thai,
       CASE trang_thai WHEN 0 THEN CONCAT('Nháp → ', @nhap_cu_thanh) WHEN 1 THEN 'Chờ duyệt → CHO_DUYET'
            WHEN 2 THEN 'Chờ xuất hàng → DA_DUYET' WHEN 3 THEN 'Đang vận chuyển → DANG_VAN_CHUYEN'
            WHEN 4 THEN 'Đã hủy → DA_HUY' WHEN 5 THEN 'Hoàn thành → HOAN_TAT' ELSE 'KHÔNG RÕ' END AS doi_thanh,
       COUNT(*) AS so_phieu
FROM phieu_xuat_kho
WHERE loai_xuat = 'khac' AND parent_id IS NULL
GROUP BY trang_thai ORDER BY trang_thai;

SELECT (SELECT COUNT(*) FROM phieu_xuat_kho WHERE loai_xuat = 'khac' AND parent_id IS NULL AND kho_chuyen_den_id IS NULL) AS phieu_khac_thieu_kho_den,
       (SELECT COUNT(*) FROM phieu_xuat_kho WHERE loai_xuat = 'chuyen_kho' AND parent_id IS NOT NULL)                   AS phieu_xuat_con,
       (SELECT COUNT(*) FROM phieu_nhap_kho WHERE phieu_chuyen_id IS NOT NULL)                                          AS phieu_nhap_cua_phieu_chuyen;

-- Kiểm trước khi chạy: bảng mới đã có sẵn chưa, và collation cột số phiếu cũ (so với cột số phiếu của bảng mới)
SELECT TABLE_NAME AS bang_moi_da_co_san FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('phieu_chuyen_kho', 'chi_tiet_phieu_chuyen_kho', 'bien_ban_giao_nhan', 'chi_tiet_bien_ban_giao_nhan',
                      'bien_ban_giao_nhan_anh');
SET @collation_so_phieu = (SELECT COLLATION_NAME FROM information_schema.COLUMNS
                            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phieu_xuat_kho' AND COLUMN_NAME = 'so_phieu_xuat');
SET @lam = IF(@chay_that = 1 AND @collation_so_phieu = 'utf8mb4_unicode_ci', 1, 0);
SELECT @collation_so_phieu AS collation_so_phieu_xuat,
       IF(@collation_so_phieu = 'utf8mb4_unicode_ci', 'Khớp bảng mới',
          'DỪNG: khác utf8mb4_unicode_ci, tệp chỉ xem trước, không đổi gì') AS kiem_tra_collation;

SET @co_pck = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phieu_chuyen_kho');

-- ---------------------------------------------------------------------
-- a. phieu_chuyen_kho, chi_tiet_phieu_chuyen_kho
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_pck = 0,
  'CREATE TABLE phieu_chuyen_kho (
     id INT NOT NULL AUTO_INCREMENT,
     so_phieu_chuyen VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT ''Mã phiếu: PX-TRF-YYYYMMDDX'',
     kho_xuat_id INT NOT NULL COMMENT ''Kho nguồn'',
     kho_nhap_id INT NOT NULL COMMENT ''Kho đích'',
     trang_thai ENUM(''CHO_DUYET'', ''DA_DUYET'', ''DANG_VAN_CHUYEN'', ''CHO_XU_LY_LECH'', ''HOAN_TAT'', ''DA_HUY'')
       COLLATE utf8mb4_unicode_ci DEFAULT ''CHO_DUYET'',
     so_lenh_dieu_dong VARCHAR(50) COLLATE utf8mb4_unicode_ci NULL COMMENT ''Mã LĐĐ tự sinh: LDD-YYYYMMDD-XXX'',
     ngay_lenh_dieu_dong DATETIME NULL,
     nguoi_ra_lenh_id INT NULL COMMENT ''Quản lý phê duyệt LĐĐ'',
     ly_do_dieu_dong VARCHAR(100) COLLATE utf8mb4_unicode_ci NULL COMMENT ''BO_SUNG, CAN_BANG, TRA_VE, KHAC'',
     ghi_chu_lenh TEXT COLLATE utf8mb4_unicode_ci NULL COMMENT ''Lý do khi chọn Khác, ghi chú của lệnh'',
     hinh_thuc_van_chuyen ENUM(''XE_CONG_TY'', ''THUE_NGOAI'', ''CHUYEN_PHAT'') COLLATE utf8mb4_unicode_ci DEFAULT ''XE_CONG_TY'',
     nguoi_van_chuyen VARCHAR(100) COLLATE utf8mb4_unicode_ci NULL COMMENT ''Họ tên tài xế'',
     so_dien_thoai_van_chuyen VARCHAR(20) COLLATE utf8mb4_unicode_ci NULL,
     loai_phuong_tien VARCHAR(50) COLLATE utf8mb4_unicode_ci NULL COMMENT ''Xe tải 1.25 tấn, Xe máy...'',
     bien_so_xe VARCHAR(20) COLLATE utf8mb4_unicode_ci NULL COMMENT ''Biển kiểm soát'',
     don_vi_van_chuyen VARCHAR(150) COLLATE utf8mb4_unicode_ci NULL COMMENT ''Tên đơn vị nếu thuê ngoài/chuyển phát'',
     ma_van_don_hop_dong VARCHAR(50) COLLATE utf8mb4_unicode_ci NULL,
     ngay_du_kien_den DATETIME NULL,
     ngay_thuc_te_den DATETIME NULL,
     ky_hieu_xknb VARCHAR(20) COLLATE utf8mb4_unicode_ci NULL COMMENT ''Ký hiệu hóa đơn điện tử (VD: 6K26NAB)'',
     so_phieu_xknb VARCHAR(20) COLLATE utf8mb4_unicode_ci NULL COMMENT ''Số thứ tự phiếu XKNB (VD: 0000125)'',
     ngay_lap_xknb DATE NULL,
     ma_tra_cuu_xknb VARCHAR(100) COLLATE utf8mb4_unicode_ci NULL,
     phieu_goc_id INT NULL COMMENT ''ID phiếu chuyển gốc nếu đây là đợt giao bù'',
     ghi_chu TEXT COLLATE utf8mb4_unicode_ci,
     nguoi_tao_id INT NULL COMMENT ''Trống với phiếu tạo trước khi nâng cấp'',
     nguoi_huy_id INT NULL,
     ly_do_huy VARCHAR(255) COLLATE utf8mb4_unicode_ci NULL,
     ngay_huy DATETIME NULL,
     ngay_tao TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
     ngay_cap_nhat TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     PRIMARY KEY (id),
     UNIQUE KEY uk_so_phieu_chuyen (so_phieu_chuyen),
     UNIQUE KEY uk_pck_so_lenh (so_lenh_dieu_dong),
     UNIQUE KEY uk_pck_xknb (ky_hieu_xknb, so_phieu_xknb),
     KEY idx_pck_kho_xuat (kho_xuat_id),
     KEY idx_pck_kho_nhap (kho_nhap_id),
     KEY idx_pck_trang_thai (trang_thai),
     CONSTRAINT fk_pck_kho_xuat FOREIGN KEY (kho_xuat_id) REFERENCES kho (id),
     CONSTRAINT fk_pck_kho_nhap FOREIGN KEY (kho_nhap_id) REFERENCES kho (id),
     CONSTRAINT fk_pck_nguoi_tao FOREIGN KEY (nguoi_tao_id) REFERENCES nguoi_dung (id),
     CONSTRAINT fk_pck_nguoi_ra_lenh FOREIGN KEY (nguoi_ra_lenh_id) REFERENCES nguoi_dung (id),
     CONSTRAINT fk_pck_nguoi_huy FOREIGN KEY (nguoi_huy_id) REFERENCES nguoi_dung (id),
     CONSTRAINT fk_pck_phieu_goc FOREIGN KEY (phieu_goc_id) REFERENCES phieu_chuyen_kho (id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @co = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chi_tiet_phieu_chuyen_kho');
SET @sql = IF(@lam = 1 AND @co = 0,
  'CREATE TABLE chi_tiet_phieu_chuyen_kho (
     id INT NOT NULL AUTO_INCREMENT,
     phieu_chuyen_kho_id INT NOT NULL,
     bien_the_san_pham_id INT NOT NULL,
     so_luong_chuyen INT NOT NULL,
     ghi_chu VARCHAR(255) COLLATE utf8mb4_unicode_ci NULL,
     PRIMARY KEY (id),
     UNIQUE KEY uk_pck_bienthe (phieu_chuyen_kho_id, bien_the_san_pham_id),
     CONSTRAINT fk_ctpck_phieu FOREIGN KEY (phieu_chuyen_kho_id) REFERENCES phieu_chuyen_kho (id) ON DELETE CASCADE,
     CONSTRAINT fk_ctpck_bienthe FOREIGN KEY (bien_the_san_pham_id) REFERENCES bien_the_san_pham (id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- b. Nối phiếu xuất, phiếu nhập vào phiếu chuyển
-- ---------------------------------------------------------------------
SET @thieu = 1 - (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phieu_xuat_kho' AND COLUMN_NAME = 'phieu_chuyen_kho_id');
SET @sql = IF(@lam = 1 AND @thieu = 1,
  'ALTER TABLE phieu_xuat_kho
     ADD COLUMN phieu_chuyen_kho_id INT NULL COMMENT ''FK liên kết tới phieu_chuyen_kho khi loai_xuat = chuyen_kho'' AFTER don_ban_hang_id,
     ADD CONSTRAINT fk_pxk_phieu_chuyen FOREIGN KEY (phieu_chuyen_kho_id) REFERENCES phieu_chuyen_kho (id) ON DELETE SET NULL',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @thieu = 1 - (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phieu_nhap_kho' AND COLUMN_NAME = 'phieu_chuyen_kho_id');
SET @sql = IF(@lam = 1 AND @thieu = 1,
  'ALTER TABLE phieu_nhap_kho
     ADD COLUMN phieu_chuyen_kho_id INT NULL COMMENT ''FK liên kết tới phieu_chuyen_kho khi nhận hàng điều chuyển'' AFTER phieu_chuyen_id,
     ADD CONSTRAINT fk_pnk_phieu_chuyen_kho FOREIGN KEY (phieu_chuyen_kho_id) REFERENCES phieu_chuyen_kho (id) ON DELETE SET NULL',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- c. Biên bản giao nhận
-- ---------------------------------------------------------------------
SET @co = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bien_ban_giao_nhan');
SET @sql = IF(@lam = 1 AND @co = 0,
  'CREATE TABLE bien_ban_giao_nhan (
     id INT NOT NULL AUTO_INCREMENT,
     so_bien_ban VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT ''Mã: BBGN-YYYYMMDD-XXX'',
     phieu_chuyen_kho_id INT NOT NULL,
     ngay_lap DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     nguoi_lap_id INT NOT NULL COMMENT ''Thủ kho đích lập'',
     nguoi_van_chuyen VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT ''Lái xe ký nhận'',
     tong_so_luong_gui INT NOT NULL,
     tong_so_luong_nhan INT NOT NULL COMMENT ''SL thực nhận lành lặn'',
     tong_so_luong_thieu INT NOT NULL DEFAULT ''0'',
     tong_so_luong_hong INT NOT NULL DEFAULT ''0'',
     ghi_chu TEXT COLLATE utf8mb4_unicode_ci,
     phuong_an_xu_ly ENUM(''CHUA_XU_LY'', ''GHI_GIAM_HAO_HUT'', ''GIAO_BU_HANG'') COLLATE utf8mb4_unicode_ci DEFAULT ''CHUA_XU_LY'',
     nguoi_duyet_xu_ly_id INT DEFAULT NULL,
     ngay_duyet_xu_ly DATETIME DEFAULT NULL,
     PRIMARY KEY (id),
     UNIQUE KEY uk_so_bien_ban (so_bien_ban),
     CONSTRAINT fk_bbgn_pck FOREIGN KEY (phieu_chuyen_kho_id) REFERENCES phieu_chuyen_kho (id) ON DELETE CASCADE,
     CONSTRAINT fk_bbgn_nguoi_lap FOREIGN KEY (nguoi_lap_id) REFERENCES nguoi_dung (id),
     CONSTRAINT fk_bbgn_nguoi_duyet FOREIGN KEY (nguoi_duyet_xu_ly_id) REFERENCES nguoi_dung (id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @co = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chi_tiet_bien_ban_giao_nhan');
SET @sql = IF(@lam = 1 AND @co = 0,
  'CREATE TABLE chi_tiet_bien_ban_giao_nhan (
     id INT NOT NULL AUTO_INCREMENT,
     bien_ban_id INT NOT NULL,
     bien_the_san_pham_id INT NOT NULL,
     lo_hang_id INT NOT NULL COMMENT ''Lô của dòng lệch (màn nhận hàng nhập theo lô)'',
     so_luong_gui INT NOT NULL,
     so_luong_nhan INT NOT NULL,
     so_luong_thieu INT NOT NULL DEFAULT ''0'',
     so_luong_hong INT NOT NULL DEFAULT ''0'',
     ly_do_hong_thieu VARCHAR(255) COLLATE utf8mb4_unicode_ci NULL,
     PRIMARY KEY (id),
     UNIQUE KEY uk_ctbb_bienban_bienthe_lo (bien_ban_id, bien_the_san_pham_id, lo_hang_id),
     CONSTRAINT fk_ctbb_bien_ban FOREIGN KEY (bien_ban_id) REFERENCES bien_ban_giao_nhan (id) ON DELETE CASCADE,
     CONSTRAINT fk_ctbb_bienthe FOREIGN KEY (bien_the_san_pham_id) REFERENCES bien_the_san_pham (id),
     CONSTRAINT fk_ctbb_lo FOREIGN KEY (lo_hang_id) REFERENCES lo_hang (id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- d. Phiếu điều chỉnh kho: nguồn kiểm kê hoặc chuyển kho
-- ---------------------------------------------------------------------
SET @kk_bat_buoc = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phieu_dieu_chinh_kho' AND COLUMN_NAME = 'dot_kiem_ke_id' AND IS_NULLABLE = 'NO');
SET @sql = IF(@lam = 1 AND @kk_bat_buoc = 1,
  'ALTER TABLE phieu_dieu_chinh_kho MODIFY COLUMN dot_kiem_ke_id int NULL COMMENT ''Có khi nguon = kiem_ke''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @thieu = 1 - (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phieu_dieu_chinh_kho' AND COLUMN_NAME = 'nguon');
SET @sql = IF(@lam = 1 AND @thieu = 1,
  'ALTER TABLE phieu_dieu_chinh_kho
     ADD COLUMN nguon enum(''kiem_ke'',''chuyen_kho'') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''kiem_ke''
       COMMENT ''kiem_ke: theo đợt kiểm kê · chuyen_kho: ghi giảm chênh lệch theo biên bản giao nhận'' AFTER so_phieu,
     ADD COLUMN phieu_chuyen_kho_id int NULL AFTER dot_kiem_ke_id,
     ADD COLUMN bien_ban_giao_nhan_id int NULL AFTER phieu_chuyen_kho_id,
     ADD CONSTRAINT fk_pdck_phieu_chuyen FOREIGN KEY (phieu_chuyen_kho_id) REFERENCES phieu_chuyen_kho (id),
     ADD CONSTRAINT fk_pdck_bien_ban FOREIGN KEY (bien_ban_giao_nhan_id) REFERENCES bien_ban_giao_nhan (id),
     ADD UNIQUE KEY uk_pdck_bien_ban (bien_ban_giao_nhan_id),
     ADD CONSTRAINT chk_pdck_nguon CHECK (
       (nguon = ''kiem_ke''    AND dot_kiem_ke_id IS NOT NULL AND phieu_chuyen_kho_id IS NULL AND bien_ban_giao_nhan_id IS NULL)
    OR (nguon = ''chuyen_kho'' AND dot_kiem_ke_id IS NULL AND phieu_chuyen_kho_id IS NOT NULL AND bien_ban_giao_nhan_id IS NOT NULL))',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @kk_bat_buoc = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chi_tiet_phieu_dieu_chinh' AND COLUMN_NAME = 'chi_tiet_kiem_ke_id' AND IS_NULLABLE = 'NO');
SET @sql = IF(@lam = 1 AND @kk_bat_buoc = 1,
  'ALTER TABLE chi_tiet_phieu_dieu_chinh MODIFY COLUMN chi_tiet_kiem_ke_id int NULL COMMENT ''Dòng kiểm kê (phiếu nguồn kiểm kê)''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @thieu = 1 - (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chi_tiet_phieu_dieu_chinh' AND COLUMN_NAME = 'chi_tiet_bien_ban_id');
SET @sql = IF(@lam = 1 AND @thieu = 1,
  'ALTER TABLE chi_tiet_phieu_dieu_chinh
     ADD COLUMN chi_tiet_bien_ban_id int NULL COMMENT ''Dòng biên bản giao nhận (phiếu nguồn chuyển kho)'' AFTER chi_tiet_kiem_ke_id,
     ADD CONSTRAINT fk_ctpdc_ct_bien_ban FOREIGN KEY (chi_tiet_bien_ban_id) REFERENCES chi_tiet_bien_ban_giao_nhan (id),
     ADD CONSTRAINT chk_ctpdc_mot_nguon CHECK ((chi_tiet_kiem_ke_id IS NULL) <> (chi_tiet_bien_ban_id IS NULL))',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- e. Chép phiếu chuyển cũ. Từng bước tự bỏ qua phần đã chép (chạy lại sau khi dừng giữa chừng vẫn đủ): phiếu đã có
--    (cùng id hoặc cùng số) thì không chép lại; dòng hàng / nối chứng từ chỉ làm cho phiếu chép từ dòng cũ cùng số.
-- ---------------------------------------------------------------------
SET @chep = (@lam = 1);

SET @sql = IF(@chep = 1,
  'INSERT INTO phieu_chuyen_kho (id, so_phieu_chuyen, kho_xuat_id, kho_nhap_id, trang_thai, nguoi_ra_lenh_id, ghi_chu,
                                 nguoi_tao_id, ly_do_huy, ngay_huy, ngay_tao, ngay_cap_nhat, hinh_thuc_van_chuyen)
   SELECT p.id, p.so_phieu_xuat, p.kho_id, p.kho_chuyen_den_id,
          CASE p.trang_thai WHEN 0 THEN @nhap_cu_thanh WHEN 1 THEN ''CHO_DUYET'' WHEN 2 THEN ''DA_DUYET''
               WHEN 3 THEN ''DANG_VAN_CHUYEN'' WHEN 4 THEN ''DA_HUY'' WHEN 5 THEN ''HOAN_TAT'' END,
          IF(p.trang_thai IN (2, 3, 5), p.nguoi_duyet_id, NULL),
          p.ghi_chu,
          NULL,
          IF(p.trang_thai = 0 AND @nhap_cu_thanh = ''DA_HUY'', ''Phiếu nháp từ trước khi nâng cấp chuyển kho, chưa gửi duyệt'', NULL),
          IF(p.trang_thai = 0 AND @nhap_cu_thanh = ''DA_HUY'', NOW(), NULL),
          p.ngay_tao, p.ngay_cap_nhat,
          NULL
   FROM phieu_xuat_kho p
   WHERE p.loai_xuat = ''khac'' AND p.parent_id IS NULL AND p.kho_chuyen_den_id IS NOT NULL
     AND p.trang_thai IN (0, 1, 2, 3, 4, 5)
     AND NOT EXISTS (SELECT 1 FROM phieu_chuyen_kho x WHERE x.id = p.id OR x.so_phieu_chuyen = p.so_phieu_xuat)',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- Dòng hàng: dòng chưa chọn lô của phiếu chuyển, gộp theo biến thể (bảng mới khóa duy nhất theo phiếu + biến thể)
SET @sql = IF(@chep = 1,
  'INSERT INTO chi_tiet_phieu_chuyen_kho (phieu_chuyen_kho_id, bien_the_san_pham_id, so_luong_chuyen)
   SELECT ct.phieu_xuat_kho_id, ct.bien_the_san_pham_id, ROUND(SUM(ct.so_luong_xuat))
   FROM chi_tiet_phieu_xuat_kho ct
   JOIN phieu_xuat_kho cu ON cu.id = ct.phieu_xuat_kho_id AND cu.loai_xuat = ''khac''
   JOIN phieu_chuyen_kho pck ON pck.id = cu.id AND pck.so_phieu_chuyen = cu.so_phieu_xuat
   WHERE ct.lo_hang_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM chi_tiet_phieu_chuyen_kho x
                      WHERE x.phieu_chuyen_kho_id = pck.id AND x.bien_the_san_pham_id = ct.bien_the_san_pham_id)
   GROUP BY ct.phieu_xuat_kho_id, ct.bien_the_san_pham_id',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- Nối chứng từ cũ vào phiếu mới. Tự gán lại ngay_cap_nhat để cột ON UPDATE không nhảy về giờ chạy tệp
SET @sql = IF(@chep = 1,
  'UPDATE phieu_xuat_kho c
   JOIN phieu_xuat_kho cu ON cu.id = c.parent_id AND cu.loai_xuat = ''khac''
   JOIN phieu_chuyen_kho pck ON pck.id = cu.id AND pck.so_phieu_chuyen = cu.so_phieu_xuat
   SET c.phieu_chuyen_kho_id = pck.id, c.ngay_cap_nhat = c.ngay_cap_nhat
   WHERE c.loai_xuat = ''chuyen_kho'' AND c.phieu_chuyen_kho_id IS NULL',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@chep = 1,
  'UPDATE phieu_nhap_kho n
   JOIN phieu_xuat_kho cu ON cu.id = n.phieu_chuyen_id AND cu.loai_xuat = ''khac''
   JOIN phieu_chuyen_kho pck ON pck.id = cu.id AND pck.so_phieu_chuyen = cu.so_phieu_xuat
   SET n.phieu_chuyen_kho_id = pck.id, n.ngay_cap_nhat = n.ngay_cap_nhat
   WHERE n.phieu_chuyen_kho_id IS NULL',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- Đẩy bộ đếm id của phieu_chuyen_kho lên trên mọi id của phieu_xuat_kho: phiếu chuyển mới không trùng id với dòng cũ
-- nào, nên đường dẫn /transfer-tickets/:id cũ (kể cả phiếu backend cũ lỡ tạo sau bước chép) không mở nhầm phiếu mới.
-- Chạy lại: InnoDB không hạ bộ đếm dưới id lớn nhất đang có.
SET @id_tiep = NULL;
SET @sql = IF(@chep = 1,
  'SELECT GREATEST(COALESCE((SELECT MAX(id) FROM phieu_xuat_kho), 0), COALESCE((SELECT MAX(id) FROM phieu_chuyen_kho), 0)) + 1
   INTO @id_tiep',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;
SET @sql = IF(@chep = 1 AND @id_tiep IS NOT NULL, CONCAT('ALTER TABLE phieu_chuyen_kho AUTO_INCREMENT = ', @id_tiep), 'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- e2. Cấu hình giấy đi đường (Cấu hình > Chứng từ): ký hiệu XKNB điền sẵn (trống) và chế độ khi chưa có số phiếu
--     XKNB = CHI_CANH_BAO (xuất trước, ghi số sau); ai được xử lý chênh lệch (Cấu hình > Chuyển kho) = QL_KHO_TONG
--     (Quản trị viên hoặc Quản lý Kho tổng). Backend cũng tự thêm khi khởi động nếu thiếu; đã có thì giữ nguyên.
-- ---------------------------------------------------------------------
SET @co_bang_cau_hinh = (SELECT COUNT(*) FROM information_schema.tables
                          WHERE table_schema = DATABASE() AND table_name = 'cau_hinh_he_thong');
SET @sql = IF(@lam = 1 AND @co_bang_cau_hinh = 1,
  'INSERT IGNORE INTO cau_hinh_he_thong (ma_cau_hinh, gia_tri, kieu_du_lieu, mo_ta) VALUES
     (''XKNB_KY_HIEU_MAC_DINH'', '''', ''STRING'', ''Ký hiệu phiếu XKNB điền sẵn khi xác nhận xuất chuyển kho''),
     (''XKNB_CHE_DO'', ''CHI_CANH_BAO'', ''STRING'', ''Khi xác nhận xuất chuyển kho mà chưa có số phiếu XKNB''),
     (''CHUYEN_KHO_QUYEN_XU_LY_LECH'', ''QL_KHO_TONG'', ''STRING'', ''Ai được xử lý chênh lệch khi nhận hàng chuyển kho'')',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- f. Kiểm tra sau khi chạy
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1,
  'SELECT trang_thai, COUNT(*) AS so_phieu FROM phieu_chuyen_kho GROUP BY trang_thai ORDER BY trang_thai',
  'SELECT ''Xem trước: chưa tạo bảng'' AS phieu_chuyen_kho');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@lam = 1,
  'SELECT (SELECT COUNT(*) FROM phieu_xuat_kho WHERE loai_xuat = ''khac'' AND parent_id IS NULL AND kho_chuyen_den_id IS NOT NULL) AS phieu_cu,
          (SELECT COUNT(*) FROM phieu_chuyen_kho)                                                         AS phieu_moi,
          (SELECT COUNT(*) FROM chi_tiet_phieu_chuyen_kho)                                                AS dong_hang_moi,
          (SELECT COUNT(*) FROM phieu_xuat_kho WHERE loai_xuat = ''chuyen_kho'' AND parent_id IS NOT NULL AND phieu_chuyen_kho_id IS NULL) AS phieu_xuat_con_chua_noi,
          (SELECT COUNT(*) FROM phieu_nhap_kho WHERE phieu_chuyen_id IS NOT NULL AND phieu_chuyen_kho_id IS NULL)                          AS phieu_nhap_chua_noi',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- Phiếu chuyển cũ CHƯA được chép (trạng thái ngoài 0–5, trùng id / số với phiếu khác của bảng mới, hoặc backend cũ tạo
-- sau bước chép). Trống là đủ. Có dòng: xem từng phiếu, hủy ở bản cũ hoặc lập lại ở màn mới.
SET @sql = IF(@lam = 1,
  'SELECT p.id, p.so_phieu_xuat, p.trang_thai AS trang_thai_cu, p.ngay_tao, ''Chưa chép sang phieu_chuyen_kho'' AS kiem_tra
   FROM phieu_xuat_kho p
   WHERE p.loai_xuat = ''khac'' AND p.parent_id IS NULL AND p.kho_chuyen_den_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM phieu_chuyen_kho x WHERE x.id = p.id AND x.so_phieu_chuyen = p.so_phieu_xuat)
   ORDER BY p.id',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- Phiếu đã chép mà bản cũ đổi trạng thái sau đó (backend cũ còn chạy). Chỉ có ý nghĩa trước khi backend mới thao tác
-- trên phiếu: backend mới đã duyệt / xuất phiếu chép sang thì lệch ở đây là bình thường.
-- Giá trị @nhap_cu_thanh ghép vào câu dạng chuỗi hằng (QUOTE): so trực tiếp biến người dùng (collation của kết nối) với
-- cột ENUM (utf8mb4_unicode_ci) báo lỗi 1267 Illegal mix of collations và Workbench dừng tệp ở đây.
SET @sql = IF(@lam = 1,
  CONCAT('SELECT pck.id, pck.so_phieu_chuyen, pck.trang_thai AS trang_thai_moi, p.trang_thai AS trang_thai_cu,
          ''Bản cũ đổi trạng thái sau khi chép'' AS kiem_tra
   FROM phieu_chuyen_kho pck
   JOIN phieu_xuat_kho p ON p.id = pck.id AND p.so_phieu_xuat = pck.so_phieu_chuyen AND p.loai_xuat = ''khac''
   WHERE pck.trang_thai <> CASE p.trang_thai WHEN 0 THEN ', QUOTE(@nhap_cu_thanh), ' WHEN 1 THEN ''CHO_DUYET'' WHEN 2 THEN ''DA_DUYET''
                             WHEN 3 THEN ''DANG_VAN_CHUYEN'' WHEN 4 THEN ''DA_HUY'' WHEN 5 THEN ''HOAN_TAT'' END
   ORDER BY pck.id'),
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- Phiếu chuyển không có dòng hàng nào (vd. phiếu cũ chỉ có dòng đã chọn lô ở phiếu cha). Trống là đủ.
SET @sql = IF(@lam = 1,
  'SELECT pck.id, pck.so_phieu_chuyen, pck.trang_thai, ''Phiếu chuyển không có dòng hàng'' AS kiem_tra
   FROM phieu_chuyen_kho pck
   WHERE NOT EXISTS (SELECT 1 FROM chi_tiet_phieu_chuyen_kho ct WHERE ct.phieu_chuyen_kho_id = pck.id)
   ORDER BY pck.id',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- g. Phiếu nhặt của phiếu chuyển kho: danh_sach_nhat_hang.phieu_xuat_kho_id (1 phiếu nhặt ↔ 1 PX-CK)
-- ---------------------------------------------------------------------
SET @thieu = 1 - (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'danh_sach_nhat_hang' AND COLUMN_NAME = 'phieu_xuat_kho_id');
SET @sql = IF(@lam = 1 AND @thieu = 1,
  'ALTER TABLE danh_sach_nhat_hang
     ADD COLUMN phieu_xuat_kho_id INT NULL COMMENT ''Phiếu xuất PX-CK khi đây là phiếu nhặt của phiếu chuyển kho; trống = phiếu nhặt đơn bán'' AFTER kho_xuat_id',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @thieu = 1 - (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'danh_sach_nhat_hang' AND INDEX_NAME = 'uk_dsnh_phieu_xuat');
SET @sql = IF(@lam = 1 AND @thieu = 1,
  'ALTER TABLE danh_sach_nhat_hang ADD UNIQUE KEY uk_dsnh_phieu_xuat (phieu_xuat_kho_id)',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @thieu = 1 - (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'danh_sach_nhat_hang' AND CONSTRAINT_NAME = 'fk_dsnh_phieu_xuat'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql = IF(@lam = 1 AND @thieu = 1,
  'ALTER TABLE danh_sach_nhat_hang
     ADD CONSTRAINT fk_dsnh_phieu_xuat FOREIGN KEY (phieu_xuat_kho_id) REFERENCES phieu_xuat_kho (id)',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@lam = 1,
  'SELECT COUNT(*) AS co_cot_phieu_xuat_kho_id FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ''danh_sach_nhat_hang'' AND COLUMN_NAME = ''phieu_xuat_kho_id''',
  'SELECT ''Xem trước: chưa thêm cột danh_sach_nhat_hang.phieu_xuat_kho_id'' AS phieu_nhat_chuyen_kho');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- h. Ảnh chụp đính kèm biên bản giao nhận (tối đa 6 ảnh mỗi biên bản: backend kiểm; thêm / xóa khi biên bản còn
--    CHUA_XU_LY). Dòng tep_tin của ảnh do backend xóa cùng lúc xóa ảnh, nên khóa ngoại tới tep_tin không CASCADE.
-- ---------------------------------------------------------------------
SET @co = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bien_ban_giao_nhan_anh');
SET @sql = IF(@lam = 1 AND @co = 0,
  'CREATE TABLE IF NOT EXISTS bien_ban_giao_nhan_anh (
     id INT NOT NULL AUTO_INCREMENT,
     bien_ban_id INT NOT NULL,
     tep_tin_id INT NOT NULL,
     mo_ta VARCHAR(255) COLLATE utf8mb4_unicode_ci NULL COMMENT ''Mô tả ngắn, không bắt buộc'',
     nguoi_chup_id INT NOT NULL COMMENT ''Người tải ảnh lên'',
     ngay_chup DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT ''Lúc tải ảnh lên'',
     PRIMARY KEY (id),
     KEY idx_bbgn_anh_bien_ban (bien_ban_id),
     CONSTRAINT fk_bbgn_anh_bien_ban FOREIGN KEY (bien_ban_id) REFERENCES bien_ban_giao_nhan (id) ON DELETE CASCADE,
     CONSTRAINT fk_bbgn_anh_tep_tin FOREIGN KEY (tep_tin_id) REFERENCES tep_tin (id),
     CONSTRAINT fk_bbgn_anh_nguoi_chup FOREIGN KEY (nguoi_chup_id) REFERENCES nguoi_dung (id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@lam = 1,
  'SELECT COUNT(*) AS co_bang_bien_ban_giao_nhan_anh FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ''bien_ban_giao_nhan_anh''',
  'SELECT ''Xem trước: chưa tạo bảng bien_ban_giao_nhan_anh'' AS anh_bien_ban_giao_nhan');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SELECT IF(@lam = 1, 'ĐÃ CHẠY THẬT',
          IF(@chay_that = 1, 'DỪNG: collation cột số phiếu cũ khác bảng mới, chưa đổi gì',
             'CHỈ XEM TRƯỚC: chưa đổi gì. Đổi @chay_that = 1 để chạy thật.')) AS ket_qua;

SET SESSION lock_wait_timeout = @cho_khoa_cu;
SET SESSION innodb_lock_wait_timeout = @cho_khoa_dong_cu;
SET SESSION sql_safe_updates = @an_toan_cu;
SET SESSION time_zone = @mui_gio_cu;
SET @cho_khoa_cu = NULL, @cho_khoa_dong_cu = NULL, @an_toan_cu = NULL, @mui_gio_cu = NULL;
