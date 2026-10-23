-- =====================================================================
-- Mẫu email mới: cột cho cổng nhà cung cấp, xét báo giá, thông tin cửa hàng – 2026-10-22
--
-- MẶC ĐỊNH CHỈ XEM TRƯỚC: chạy nguyên tệp với @chay_that = 0 không đổi gì trong CSDL, chỉ in ra
-- việc sẽ làm và danh sách dòng dữ liệu sẽ đổi. Xem kỹ rồi mới đổi @chay_that = 1 và chạy lại.
--
-- Khi chạy thật:
--   1. thong_tin_cong_ty
--      a. chưa có bảng thì tạo bảng (đủ cột như entity ThongTinCongTy, không thêm dòng nào);
--      b. thêm ten_dang_ky_kinh_doanh VARCHAR(255) NULL: tên trên giấy chứng nhận đăng ký kinh doanh
--         ("Công ty TNHH …", "Hộ kinh doanh …"), khác tên cửa hàng; in ở chân email gửi nhà cung cấp, hóa đơn;
--      c. ten_cong_ty bỏ DEFAULT 'FCentric', giữ NOT NULL, giữ dữ liệu đang có
--         (FCentric là tên phần mềm, không phải tên cửa hàng).
--      Không đụng ma_so_thue (đã thêm ở migration-2026-10-20-hoa-don-ban-hang.sql).
--   2. don_mua_hang thêm 4 cột, đều NULL, không tự cập nhật:
--      ngay_bao_gia (lần cuối nhà cung cấp gửi báo giá), ngay_gui_yeu_cau (lúc email yêu cầu báo giá gửi được),
--      ghi_chu_nha_cung_cap (ghi chú nhà cung cấp gửi kèm báo giá), ly_do_tu_choi (lý do không chấp nhận).
--   3. Index idx_dmh_yeu_cau (don_mua_hang.yeu_cau_mua_hang_id): xét báo giá khóa mọi đơn cùng yêu cầu
--      (SELECT … FOR UPDATE theo yeu_cau_mua_hang_id). Thiếu index thì câu khóa quét và khóa cả bảng don_mua_hang,
--      chặn luôn nhập kho, báo giá của yêu cầu khác. Không thêm khóa ngoại (dữ liệu cũ có đơn trỏ tới yêu cầu
--      không tồn tại).
--   4. Dữ liệu cũ (một giao dịch, giữ nguyên ngay_cap_nhat):
--      a. đơn đã có giá (COALESCE(tong_tien, 0) > 0) mà chưa có ngay_bao_gia: ngay_bao_gia = ngay_cap_nhat
--         (gần đúng; thiếu ngay_cap_nhat thì lấy ngay_tao, rồi ngay_dat_hang). Thiếu bước này thì đơn cũ đã có giá
--         không chấp nhận được, vì máy chủ mới chỉ cho xét báo giá khi có ngay_bao_gia;
--      b. yêu cầu nhập hàng đang ở 3 (đã gửi báo giá) mà đã có đơn mua được chấp nhận (3) hoặc đã nhận đủ (5):
--         chuyển sang 5 (đã chọn nhà cung cấp). Không đổi các đơn khác của yêu cầu, không gửi email;
--      c. đơn mua ở 5 còn dòng chưa nhận đủ (5 cũ mang nghĩa "đã thanh toán" của luồng thanh toán đã gỡ):
--         chuyển về 3 (đang vận chuyển, còn nhập kho được). Đơn 5 nhận đủ thật không bị đổi;
--      d. đơn có yêu cầu nhập hàng mà chưa có ngay_gui_yeu_cau: ngay_gui_yeu_cau = ngay_dat_hang (thiếu thì ngay_tao).
--         Luồng cũ gửi email yêu cầu báo giá ngay trong giao dịch tạo đơn, gửi lỗi thì cả đơn bị hoàn tác, nên đơn
--         nào còn trong CSDL thì email đã đi. Thiếu bước này thì mọi đơn cũ ở 2 chưa có giá đều bị báo nhầm
--         "Chưa gửi được email yêu cầu báo giá" (K11). Đơn không có yêu cầu (tạo tay kiểu cũ) không gửi email nên
--         để trống.
--
-- THỨ TỰ CHẠY KHI TRIỂN KHAI:
--   B1. migration-2026-10-20-don-mua-nhan-du.sql và migration-2026-10-20-hoa-don-ban-hang.sql phải chạy TRƯỚC
--       tệp này (nếu chưa, đơn nhận đủ cũ còn ở 4 và mục 4c đếm thiếu).
--   B2. Tệp này – TRƯỚC khi khởi động backend mới: spring.jpa.hibernate.ddl-auto=none nên backend mới đọc
--       cột ngay_bao_gia / ten_dang_ky_kinh_doanh mà chưa có cột thì lỗi SQL. Backend CŨ vẫn chạy sau tệp này
--       (cột mới đều cho phép NULL).
--   B3. Lên backend + frontend mới cùng lúc (cổng nhà cung cấp và màn xét báo giá đổi API cùng đợt).
--
-- Không làm gì:
--   - Không xóa dòng nào, không đổi số lượng, đơn giá, tổng tiền.
--   - Không thêm dòng vào thong_tin_cong_ty (dòng chỉ được tạo khi cửa hàng lưu thông tin có tên).
--
-- Chống treo hệ thống:
--   - Chỉ chờ khóa tối đa 5 giây (lock_wait_timeout = 5, innodb_lock_wait_timeout = 5): quá 5 giây thì báo lỗi
--     1205, lệnh đó KHÔNG đổi gì.
--   - ADD COLUMN NULL chạy INSTANT, ADD INDEX chạy trực tuyến trên MySQL 8 (không chép lại bảng).
--   - Chạy nhiều lần vẫn được: bảng, cột, index đã có thì bỏ qua; mục 4 chỉ đổi dòng còn khớp điều kiện.
--   - Không cần DELIMITER, chạy được trong MySQL Workbench và mysql CLI (MySQL 8). Câu nào nhắc tới cột mới đều
--     dựng bằng PREPARE, vì ở chế độ xem trước cột chưa có và câu viết thẳng sẽ lỗi ngay khi phân tích.
--   - Tắt sql_safe_updates trong phiên (mục 4 không lọc theo khóa chính, Workbench chế độ an toàn sẽ từ chối,
--     lỗi 1175). Các SET SESSION chỉ có hiệu lực trong kết nối đang chạy và được trả lại ở cuối tệp.
--   - GẶP LỖI giữa chừng: ALTER/CREATE tự lưu ngay nên không có gì để ROLLBACK ở mục 1–3. Lỗi ở mục 4: chạy
--     ROLLBACK; rồi chạy 3 lệnh SET SESSION khôi phục ở cuối tệp (hoặc Query › Reconnect to Server / đóng hẳn kết
--     nối). Chỉ đóng tab truy vấn là CHƯA đủ (các tab cùng kết nối dùng chung một phiên MySQL). Sửa xong thì chạy lại
--     cả tệp.
--
-- Trước khi chạy thật: SAO LƯU 3 bảng thong_tin_cong_ty, don_mua_hang, yeu_cau_mua_hang
-- (vd. mysqldump fashion_system thong_tin_cong_ty don_mua_hang yeu_cau_mua_hang > bk_mau_email_20261022.sql)
-- và GIỮ LẠI cột id của các danh sách 4a, 4b, 4c, 4d in ra (dùng để hoàn tác).
-- =====================================================================
SET NAMES utf8mb4;           -- mysql CLI mặc định latin1 thì COMMENT tiếng Việt bị lỗi mã

USE fashion_system;          -- đổi nếu CSDL của bạn tên khác

SET @chay_that = 0;          -- 0 = CHỈ XEM TRƯỚC, không đổi gì · 1 = CHẠY THẬT

SET @cho_khoa_cu = @@SESSION.lock_wait_timeout;
SET @cho_khoa_dong_cu = @@SESSION.innodb_lock_wait_timeout;
SET @safe_updates_cu = @@SESSION.sql_safe_updates;
SET SESSION lock_wait_timeout = 5;
SET SESSION innodb_lock_wait_timeout = 5;
SET SESSION sql_safe_updates = 0;

-- ---------------------------------------------------------------------
-- Hiện trạng (đọc trước khi đổi; dùng cho cả hai chế độ)
-- ---------------------------------------------------------------------
SET @co_bang_cty = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thong_tin_cong_ty');
SET @co_ten_dk = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thong_tin_cong_ty' AND COLUMN_NAME = 'ten_dang_ky_kinh_doanh');
SET @co_mst_cty = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thong_tin_cong_ty' AND COLUMN_NAME = 'ma_so_thue');
SET @ten_cty_co_mac_dinh = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thong_tin_cong_ty' AND COLUMN_NAME = 'ten_cong_ty'
    AND COLUMN_DEFAULT IS NOT NULL);
SET @co_ngay_bao_gia = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'don_mua_hang' AND COLUMN_NAME = 'ngay_bao_gia');
SET @co_ngay_gui_yc = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'don_mua_hang' AND COLUMN_NAME = 'ngay_gui_yeu_cau');
SET @co_ghi_chu_ncc = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'don_mua_hang' AND COLUMN_NAME = 'ghi_chu_nha_cung_cap');
SET @co_ly_do = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'don_mua_hang' AND COLUMN_NAME = 'ly_do_tu_choi');
-- Đã có index nào bắt đầu bằng yeu_cau_mua_hang_id thì dùng được cho câu khóa, không thêm nữa
SET @co_index_yc = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'don_mua_hang'
    AND COLUMN_NAME = 'yeu_cau_mua_hang_id' AND SEQ_IN_INDEX = 1);

-- ---------------------------------------------------------------------
-- 1. thong_tin_cong_ty
-- ---------------------------------------------------------------------
-- 1a. Chưa có bảng: tạo theo entity ThongTinCongTy (id luôn = 1, bảng một dòng). ten_cong_ty NOT NULL, không DEFAULT.
SET @sql = IF(@chay_that = 1 AND @co_bang_cty = 0,
  'CREATE TABLE thong_tin_cong_ty (
     id tinyint NOT NULL COMMENT ''Luôn bằng 1 — bảng một dòng duy nhất'',
     ten_cong_ty varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
       COMMENT ''Tên cửa hàng (tên trên biển hiệu): tên người gửi email, đầu email, đầu phiếu in'',
     ten_dang_ky_kinh_doanh varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
       COMMENT ''Tên đăng ký kinh doanh, ghi đúng giấy chứng nhận đăng ký'',
     ma_so_thue varchar(14) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
       COMMENT ''Mã số thuế cửa hàng: 10 số, 10 số + -3 số (đơn vị phụ thuộc) hoặc 12 số'',
     logo_duong_dan varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
     tep_tin_id int DEFAULT NULL,
     email varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
     so_dien_thoai varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
     dia_chi text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT ''Địa chỉ đăng ký (đúng giấy chứng nhận)'',
     version int NOT NULL DEFAULT ''1'',
     ngay_cap_nhat timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     PRIMARY KEY (id),
     KEY idx_cty_tep_tin (tep_tin_id),
     CONSTRAINT fk_cty_tep_tin FOREIGN KEY (tep_tin_id) REFERENCES tep_tin (id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- 1b. Bảng đã có, thiếu cột tên đăng ký kinh doanh
SET @sql = IF(@chay_that = 1 AND @co_bang_cty = 1 AND @co_ten_dk = 0,
  'ALTER TABLE thong_tin_cong_ty ADD COLUMN ten_dang_ky_kinh_doanh VARCHAR(255)
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
     COMMENT ''Tên đăng ký kinh doanh, ghi đúng giấy chứng nhận đăng ký'' AFTER ten_cong_ty',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- 1c. Bỏ DEFAULT 'FCentric' của ten_cong_ty (giữ NOT NULL và dữ liệu)
SET @sql = IF(@chay_that = 1 AND @co_bang_cty = 1 AND @ten_cty_co_mac_dinh = 1,
  'ALTER TABLE thong_tin_cong_ty ALTER COLUMN ten_cong_ty DROP DEFAULT',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- 2. don_mua_hang: 4 cột mới (thêm lần lượt, cột sau đứng sau cột trước)
-- ---------------------------------------------------------------------
SET @sql = IF(@chay_that = 1 AND @co_ngay_bao_gia = 0,
  'ALTER TABLE don_mua_hang ADD COLUMN ngay_bao_gia TIMESTAMP NULL DEFAULT NULL
     COMMENT ''Lần cuối nhà cung cấp gửi báo giá trên cổng; NULL = chưa báo giá'' AFTER ghi_chu',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@chay_that = 1 AND @co_ngay_gui_yc = 0,
  'ALTER TABLE don_mua_hang ADD COLUMN ngay_gui_yeu_cau TIMESTAMP NULL DEFAULT NULL
     COMMENT ''Lúc email yêu cầu báo giá gửi được tới nhà cung cấp; NULL = chưa gửi được'' AFTER ngay_bao_gia',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@chay_that = 1 AND @co_ghi_chu_ncc = 0,
  'ALTER TABLE don_mua_hang ADD COLUMN ghi_chu_nha_cung_cap TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
     COMMENT ''Ghi chú nhà cung cấp gửi kèm báo giá (khác ghi_chu là ghi chú của bên mua)'' AFTER ngay_gui_yeu_cau',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = IF(@chay_that = 1 AND @co_ly_do = 0,
  'ALTER TABLE don_mua_hang ADD COLUMN ly_do_tu_choi VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
     COMMENT ''Lý do không chấp nhận báo giá (không bắt buộc)'' AFTER ghi_chu_nha_cung_cap',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- 3. Index cho câu khóa các đơn cùng yêu cầu
-- ---------------------------------------------------------------------
SET @sql = IF(@chay_that = 1 AND @co_index_yc = 0,
  'ALTER TABLE don_mua_hang ADD INDEX idx_dmh_yeu_cau (yeu_cau_mua_hang_id)',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- 4. Dữ liệu cũ — danh sách in ra ở cả hai chế độ, TRƯỚC khi đổi
-- ---------------------------------------------------------------------
-- 4a. Đơn sẽ nhận ngay_bao_gia (chỉ lọc ngay_bao_gia IS NULL khi cột đã có; xem trước lúc chưa có cột thì mọi đơn có
--     giá đều sẽ nhận)
SET @co_ngay_bao_gia_nay = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'don_mua_hang' AND COLUMN_NAME = 'ngay_bao_gia');
SET @dk_4a = IF(@co_ngay_bao_gia_nay = 1,
  'COALESCE(dm.tong_tien, 0) > 0 AND dm.ngay_bao_gia IS NULL',
  'COALESCE(dm.tong_tien, 0) > 0');

SET @sql = CONCAT('SELECT ''4a'' AS muc, dm.id, dm.so_don_mua, dm.trang_thai, dm.tong_tien,
     COALESCE(dm.ngay_cap_nhat, dm.ngay_tao, dm.ngay_dat_hang) AS ngay_bao_gia_se_ghi
   FROM don_mua_hang dm WHERE ', @dk_4a, ' ORDER BY dm.id');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = CONCAT('SELECT COUNT(*) INTO @so_4a FROM don_mua_hang dm WHERE ', @dk_4a);
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- 4b. Yêu cầu ở 3 đã có đơn được chấp nhận / đã nhận đủ -> 5
SELECT '4b' AS muc, y.id, y.so_yeu_cau_mua_hang, y.trang_thai AS trang_thai_hien_tai, 5 AS trang_thai_sau,
       (SELECT GROUP_CONCAT(d.id ORDER BY d.id) FROM don_mua_hang d
         WHERE d.yeu_cau_mua_hang_id = y.id AND d.trang_thai IN (3, 5)) AS don_da_chon
FROM yeu_cau_mua_hang y
WHERE y.trang_thai = 3
  AND EXISTS (SELECT 1 FROM don_mua_hang d WHERE d.yeu_cau_mua_hang_id = y.id AND d.trang_thai IN (3, 5))
ORDER BY y.id;

SET @so_4b = (SELECT COUNT(*) FROM yeu_cau_mua_hang y
  WHERE y.trang_thai = 3
    AND EXISTS (SELECT 1 FROM don_mua_hang d WHERE d.yeu_cau_mua_hang_id = y.id AND d.trang_thai IN (3, 5)));

-- 4c. Đơn 5 cũ ("đã thanh toán") còn dòng chưa nhận đủ -> 3
SELECT '4c' AS muc, dm.id, dm.so_don_mua, dm.trang_thai AS trang_thai_hien_tai, 3 AS trang_thai_sau,
       (SELECT SUM(ct.so_luong_dat) FROM chi_tiet_don_mua_hang ct WHERE ct.don_mua_hang_id = dm.id) AS tong_so_dat,
       (SELECT SUM(COALESCE(ct.so_luong_da_nhan, 0)) FROM chi_tiet_don_mua_hang ct
         WHERE ct.don_mua_hang_id = dm.id) AS tong_da_nhan
FROM don_mua_hang dm
WHERE dm.trang_thai = 5
  AND EXISTS (SELECT 1 FROM chi_tiet_don_mua_hang ct
               WHERE ct.don_mua_hang_id = dm.id
                 AND (ct.so_luong_da_nhan IS NULL OR ct.so_luong_da_nhan < ct.so_luong_dat))
ORDER BY dm.id;

SET @so_4c = (SELECT COUNT(*) FROM don_mua_hang dm
  WHERE dm.trang_thai = 5
    AND EXISTS (SELECT 1 FROM chi_tiet_don_mua_hang ct
                 WHERE ct.don_mua_hang_id = dm.id
                   AND (ct.so_luong_da_nhan IS NULL OR ct.so_luong_da_nhan < ct.so_luong_dat)));

-- 4d. Đơn có yêu cầu sẽ nhận ngay_gui_yeu_cau = ngay_dat_hang (chỉ lọc ngay_gui_yeu_cau IS NULL khi cột đã có)
SET @co_ngay_gui_yc_nay = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'don_mua_hang' AND COLUMN_NAME = 'ngay_gui_yeu_cau');
SET @dk_4d = IF(@co_ngay_gui_yc_nay = 1,
  'dm.yeu_cau_mua_hang_id IS NOT NULL AND dm.ngay_gui_yeu_cau IS NULL',
  'dm.yeu_cau_mua_hang_id IS NOT NULL');

SET @sql = CONCAT('SELECT ''4d'' AS muc, dm.id, dm.so_don_mua, dm.trang_thai,
     COALESCE(dm.ngay_dat_hang, dm.ngay_tao) AS ngay_gui_yeu_cau_se_ghi
   FROM don_mua_hang dm WHERE ', @dk_4d, ' ORDER BY dm.id');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @sql = CONCAT('SELECT COUNT(*) INTO @so_4d FROM don_mua_hang dm WHERE ', @dk_4d);
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- 4. Đổi dữ liệu (chỉ khi @chay_that = 1), một giao dịch
--    Mọi câu đều gán lại ngay_cap_nhat = ngay_cap_nhat: MySQL không tự đặt NOW() cho cột ON UPDATE khi câu lệnh
--    đã gán cột đó, nên ngày cập nhật của đơn / yêu cầu giữ nguyên.
--    GẶP LỖI ở lệnh UPDATE: chạy ROLLBACK; rồi CHỈ chạy 3 lệnh SET SESSION khôi phục ở cuối tệp, không chạy COMMIT.
-- ---------------------------------------------------------------------
START TRANSACTION;

SET @sql = IF(@chay_that = 1,
  'UPDATE don_mua_hang dm
   SET dm.ngay_bao_gia = COALESCE(dm.ngay_cap_nhat, dm.ngay_tao, dm.ngay_dat_hang),
       dm.ngay_cap_nhat = dm.ngay_cap_nhat
   WHERE dm.ngay_bao_gia IS NULL AND COALESCE(dm.tong_tien, 0) > 0',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; SET @da_4a = IF(@chay_that = 1, ROW_COUNT(), 0); DEALLOCATE PREPARE lenh;

UPDATE yeu_cau_mua_hang y
SET y.trang_thai = 5,
    y.ngay_cap_nhat = y.ngay_cap_nhat
WHERE @chay_that = 1
  AND y.trang_thai = 3
  AND EXISTS (SELECT 1 FROM don_mua_hang d WHERE d.yeu_cau_mua_hang_id = y.id AND d.trang_thai IN (3, 5));
SET @da_4b = IF(@chay_that = 1, ROW_COUNT(), 0);

UPDATE don_mua_hang dm
SET dm.trang_thai = 3,
    dm.ngay_cap_nhat = dm.ngay_cap_nhat
WHERE @chay_that = 1
  AND dm.trang_thai = 5
  AND EXISTS (SELECT 1 FROM chi_tiet_don_mua_hang ct
               WHERE ct.don_mua_hang_id = dm.id
                 AND (ct.so_luong_da_nhan IS NULL OR ct.so_luong_da_nhan < ct.so_luong_dat));
SET @da_4c = IF(@chay_that = 1, ROW_COUNT(), 0);

SET @sql = IF(@chay_that = 1,
  'UPDATE don_mua_hang dm
   SET dm.ngay_gui_yeu_cau = COALESCE(dm.ngay_dat_hang, dm.ngay_tao),
       dm.ngay_cap_nhat = dm.ngay_cap_nhat
   WHERE dm.yeu_cau_mua_hang_id IS NOT NULL AND dm.ngay_gui_yeu_cau IS NULL',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; SET @da_4d = IF(@chay_that = 1, ROW_COUNT(), 0); DEALLOCATE PREPARE lenh;

COMMIT;

-- ---------------------------------------------------------------------
-- Kết quả
-- ---------------------------------------------------------------------
SELECT IF(@chay_that = 1, 'ĐÃ CHẠY THẬT', 'CHỈ XEM TRƯỚC — chưa đổi gì') AS che_do,
       IF(@co_bang_cty = 0, 'tạo bảng', 'đã có') AS `bảng thong_tin_cong_ty`,
       IF(@co_bang_cty = 0 OR @co_ten_dk = 0, 'thêm', 'đã có') AS `thong_tin_cong_ty.ten_dang_ky_kinh_doanh`,
       IF(@co_bang_cty = 1 AND @ten_cty_co_mac_dinh = 1, 'bỏ DEFAULT', 'không có DEFAULT') AS `thong_tin_cong_ty.ten_cong_ty`,
       IF(@co_bang_cty = 0, 'tạo cùng bảng',
          IF(@co_mst_cty = 0, 'THIẾU — chạy migration-2026-10-20-hoa-don-ban-hang.sql', 'có')) AS `thong_tin_cong_ty.ma_so_thue`;

SELECT IF(@co_ngay_bao_gia = 0, 'thêm', 'đã có') AS `don_mua_hang.ngay_bao_gia`,
       IF(@co_ngay_gui_yc = 0, 'thêm', 'đã có') AS `don_mua_hang.ngay_gui_yeu_cau`,
       IF(@co_ghi_chu_ncc = 0, 'thêm', 'đã có') AS `don_mua_hang.ghi_chu_nha_cung_cap`,
       IF(@co_ly_do = 0, 'thêm', 'đã có') AS `don_mua_hang.ly_do_tu_choi`,
       IF(@co_index_yc = 0, 'thêm idx_dmh_yeu_cau', 'đã có') AS `index yeu_cau_mua_hang_id`;

SELECT @so_4a AS `4a_don_se_nhan_ngay_bao_gia`, @da_4a AS `4a_da_ghi`,
       @so_4b AS `4b_yeu_cau_se_sang_5`, @da_4b AS `4b_da_doi`,
       @so_4c AS `4c_don_5_chua_nhan_du_se_ve_3`, @da_4c AS `4c_da_doi`,
       @so_4d AS `4d_don_se_nhan_ngay_gui_yeu_cau`, @da_4d AS `4d_da_ghi`;

SET SESSION lock_wait_timeout = @cho_khoa_cu;
SET SESSION innodb_lock_wait_timeout = @cho_khoa_dong_cu;
SET SESSION sql_safe_updates = @safe_updates_cu;

-- ---------------------------------------------------------------------
-- Hoàn tác (chạy tay nếu cần, theo đúng thứ tự).
-- A. Chỉ hoàn tác dữ liệu mục 4 (giữ cột, backend mới vẫn chạy). Thay <id 4a...>… bằng cột id của danh sách 4a, 4b,
--    4c, 4d đã in ra lúc CHẠY THẬT (danh sách in ở lần xem trước khi cột chưa có thì 4a, 4d có thể dài hơn):
--   SET SESSION sql_safe_updates = 0;
--   UPDATE don_mua_hang SET ngay_bao_gia = NULL, ngay_cap_nhat = ngay_cap_nhat WHERE id IN (<id 4a...>);
--   UPDATE yeu_cau_mua_hang SET trang_thai = 3, ngay_cap_nhat = ngay_cap_nhat
--     WHERE trang_thai = 5 AND id IN (<id 4b...>);
--   UPDATE don_mua_hang SET trang_thai = 5, ngay_cap_nhat = ngay_cap_nhat
--     WHERE trang_thai = 3 AND id IN (<id 4c...>);
--   UPDATE don_mua_hang SET ngay_gui_yeu_cau = NULL, ngay_cap_nhat = ngay_cap_nhat WHERE id IN (<id 4d...>);
-- B. Gỡ hẳn cột (chỉ sau khi đã trả backend về bản cũ – backend mới cần các cột này), chạy tiếp sau A:
--   ALTER TABLE don_mua_hang DROP INDEX idx_dmh_yeu_cau;      -- chỉ khi kết quả ghi "thêm idx_dmh_yeu_cau"
--   ALTER TABLE don_mua_hang DROP COLUMN ly_do_tu_choi, DROP COLUMN ghi_chu_nha_cung_cap,
--     DROP COLUMN ngay_gui_yeu_cau, DROP COLUMN ngay_bao_gia;  -- mục 4a, 4d mất theo cột
--   ALTER TABLE thong_tin_cong_ty ALTER COLUMN ten_cong_ty SET DEFAULT 'FCentric';
--   ALTER TABLE thong_tin_cong_ty DROP COLUMN ten_dang_ky_kinh_doanh;
--   -- Chỉ khi kết quả ghi "tạo bảng" và bảng chưa có dữ liệu cần giữ: DROP TABLE thong_tin_cong_ty;
-- hoặc nạp lại bản sao lưu bk_mau_email_20261022.sql.
-- ---------------------------------------------------------------------
