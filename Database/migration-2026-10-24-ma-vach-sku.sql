-- =====================================================================
-- Mã vạch SKU tự sinh + cấu hình tem sản phẩm – 2026-10-24
--
-- MẶC ĐỊNH CHỈ XEM TRƯỚC: chạy nguyên tệp với @chay_that = 0 không đổi gì trong CSDL, chỉ in ra việc sẽ làm và các
-- dòng sẽ đổi. Xem kỹ rồi mới đổi @chay_that = 1 và chạy lại.
--
-- Bối cảnh: mỗi biến thể cần một mã vạch ngắn, chỉ gồm chữ số, để in tem CODE128 khổ 35 × 22 mm (SKU dài kiểu
-- "AK2610234-CL001-S-MS-2691" mã hóa ra khoảng 77 mm, không vừa tem). CSDL ngày 24/10/2026: 83 biến thể đều chưa có
-- mã vạch (71 dòng là chuỗi rỗng '', 12 dòng NULL). Backend mới tự cấp mã cho biến thể tạo sau này; tệp này cấp mã cho
-- dữ liệu cũ theo ĐÚNG quy tắc của backend (utils/MaVachSku.java).
--
-- Quy tắc mã: tiền tố + id biến thể đệm 0 cho đủ 10 chữ số, VD "20" + "00000150" = "2000000150" (id dài hơn thì giữ đủ
-- chữ số của id). Tiền tố lấy từ cau_hinh_he_thong.MA_VACH_TIEN_TO nếu là đúng 2 chữ số, nếu không dùng "20"
-- (vùng 20–29 là vùng GS1 dành cho mã nội bộ; KHÔNG dùng 893 – mã GS1 Việt Nam, chỉ dùng khi đã đăng ký).
-- Đổi tiền tố về sau chỉ áp dụng cho mã sinh sau đó; mã đã cấp giữ nguyên.
--
-- Khi chạy thật:
--   a. Mã vạch là chuỗi rỗng hoặc toàn khoảng trắng → NULL (nhiều dòng '' sẽ làm hỏng ràng buộc không trùng).
--      Sau đó kiểm mã vạch đang trùng (mục 1b). CÓ TRÙNG THÌ DỪNG, không làm bước nào nữa.
--      Mã sẽ cấp mà đã bị nhập tay cho biến thể khác (mục 1d) cũng DỪNG.
--   b. Cấp mã cho mọi biến thể đang NULL theo quy tắc trên (giữ nguyên ngay_cap_nhat).
--   c. Thêm UNIQUE INDEX uq_bien_the_ma_vach (ma_vach_sku). MySQL cho phép nhiều dòng NULL. So trùng theo collation
--      của cột (utf8mb4_unicode_ci: không phân biệt hoa thường, bỏ khoảng trắng cuối), đúng như mục 1b.
--   d. Thêm 5 khóa cấu hình nếu chưa có (đã có thì GIỮ giá trị đang có):
--        MA_VACH_TIEN_TO      STRING  "20"     Tiền tố mã vạch SKU tự tạo
--        TEM_KHO_MAC_DINH     STRING  "35x22"  Khổ tem sản phẩm đang dùng (35x22 | 50x30)
--        TEM_IN_TEN_CUA_HANG  BOOLEAN "false"  In tên cửa hàng trên tem
--        TEM_IN_SKU           BOOLEAN "false"  In mã SKU trên tem
--        TEM_NGUONG_XAC_NHAN  INT     "200"    Số tem tối đa in không cần xác nhận (1–9999)
--      Backend mới cũng tự thêm các khóa này lúc khởi động nếu thiếu, nên bước d chạy trước hay sau backend đều được.
--
-- THỨ TỰ KHI TRIỂN KHAI:
--   B1. Lên backend + frontend mới (backend mới lưu mã vạch trống thành NULL và tự cấp mã cho biến thể mới).
--       Backend CŨ có thể lưu '' khi tạo biến thể; chạy tệp này khi backend cũ còn chạy thì lần tạo biến thể thứ hai
--       có '' sẽ vỡ khóa uq_bien_the_ma_vach.
--   B2. Tệp này, ngay sau B1 (trước đó màn In tem ghi "Thiếu mã vạch" cho biến thể cũ).
--   Lỡ chạy tệp này khi backend cũ còn chạy: gỡ tạm index
--     ALTER TABLE bien_the_san_pham DROP INDEX uq_bien_the_ma_vach;
--   (DB thật đã làm vậy ngày 25/10/2026). Lên backend mới xong chạy lại tệp này: biến thể tạo trong lúc đó (mã '')
--   được cấp mã và index được thêm lại.
--
-- Không làm gì:
--   - Không xóa dòng nào, không đổi mã vạch đang có giá trị (chỉ đổi dòng rỗng / NULL).
--   - Không đổi giá trị của khóa cấu hình đã có.
--
-- Chống treo hệ thống:
--   - Chỉ chờ khóa tối đa 5 giây (lock_wait_timeout = 5, innodb_lock_wait_timeout = 5): quá 5 giây thì báo lỗi 1205,
--     lệnh đó KHÔNG đổi gì.
--   - ADD UNIQUE INDEX chạy trực tuyến trên MySQL 8 (bảng ~100 dòng).
--   - Chạy nhiều lần vẫn được: chỉ đổi dòng còn rỗng / NULL, index và khóa cấu hình đã có thì bỏ qua.
--   - Không cần DELIMITER, chạy được trong MySQL Workbench và mysql CLI (MySQL 8).
--   - Tắt sql_safe_updates trong phiên (các UPDATE không lọc theo khóa chính); trả lại ở cuối tệp.
--   - GẶP LỖI ở bước a / b: chạy ROLLBACK; rồi chạy 3 lệnh SET SESSION khôi phục ở cuối tệp (hoặc Reconnect / đóng hẳn
--     kết nối). Sửa xong thì chạy lại cả tệp.
--   - GẶP LỖI ở bước c (thêm index, vd. lỗi 1205 chờ khóa): a + b đã lưu xong. Chạy 3 lệnh SET SESSION khôi phục ở cuối
--     tệp rồi chạy lại cả tệp (a, b không đổi gì nữa, chỉ làm tiếp bước c, d).
--
-- Trước khi chạy thật: SAO LƯU 2 bảng bien_the_san_pham, cau_hinh_he_thong
-- (vd. mysqldump fashion_system bien_the_san_pham cau_hinh_he_thong > bk_ma_vach_sku_20261024.sql)
-- và GIỮ LẠI cột id của danh sách 1a và 1c in ra (dùng để hoàn tác).
-- =====================================================================
SET NAMES utf8mb4;           -- mysql CLI mặc định latin1 thì COMMENT / chữ tiếng Việt bị lỗi mã

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
SET @tong_bien_the = (SELECT COUNT(*) FROM bien_the_san_pham);
SET @so_null = (SELECT COUNT(*) FROM bien_the_san_pham WHERE ma_vach_sku IS NULL);
SET @so_rong = (SELECT COUNT(*) FROM bien_the_san_pham
  WHERE ma_vach_sku IS NOT NULL AND ma_vach_sku REGEXP '^[[:space:]]*$');
SET @co_index = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bien_the_san_pham' AND INDEX_NAME = 'uq_bien_the_ma_vach');

-- Tiền tố: giá trị cấu hình nếu đúng 2 chữ số, nếu không "20" (giống MaVachSku.tienToDung của backend)
SET @tien_to_cau_hinh = (SELECT gia_tri FROM cau_hinh_he_thong WHERE ma_cau_hinh = 'MA_VACH_TIEN_TO');
-- Bỏ mọi ký tự trắng hai đầu (cả xuống dòng, tab) như String.trim() của Java; TRIM() của MySQL chỉ bỏ dấu cách
SET @tien_to_gon = REGEXP_REPLACE(COALESCE(@tien_to_cau_hinh, ''), '^[[:space:]]+|[[:space:]]+$', '');
SET @tien_to = IF(@tien_to_gon REGEXP '^[0-9]{2}$' AND CHAR_LENGTH(@tien_to_gon) = 2, @tien_to_gon, '20');

-- ---------------------------------------------------------------------
-- 1. Danh sách — in ra ở cả hai chế độ, TRƯỚC khi đổi
-- ---------------------------------------------------------------------
-- 1a. Mã vạch rỗng / toàn khoảng trắng sẽ thành NULL (rồi được cấp mã ở bước b)
SELECT '1a' AS muc, id, ma_sku, CONCAT('[', ma_vach_sku, ']') AS ma_vach_hien_tai
FROM bien_the_san_pham
WHERE ma_vach_sku IS NOT NULL AND ma_vach_sku REGEXP '^[[:space:]]*$'
ORDER BY id;

-- 1b. Mã vạch đang trùng (không tính dòng rỗng). Có dòng nào ở đây thì DỪNG: sửa tay các mã trùng rồi chạy lại.
SELECT '1b' AS muc, ma_vach_sku AS ma_vach, COUNT(*) AS so_dong,
       GROUP_CONCAT(CONCAT(id, ' (', ma_sku, ')') ORDER BY id SEPARATOR ', ') AS cac_bien_the
FROM bien_the_san_pham
WHERE ma_vach_sku IS NOT NULL AND ma_vach_sku NOT REGEXP '^[[:space:]]*$'
GROUP BY ma_vach_sku
HAVING COUNT(*) > 1
ORDER BY ma_vach_sku;

SET @so_trung = (SELECT COUNT(*) FROM (
  SELECT ma_vach_sku FROM bien_the_san_pham
  WHERE ma_vach_sku IS NOT NULL AND ma_vach_sku NOT REGEXP '^[[:space:]]*$'
  GROUP BY ma_vach_sku HAVING COUNT(*) > 1) AS trung);

-- 1c. Biến thể sẽ được cấp mã (đang NULL hoặc rỗng) và mã sẽ cấp
SELECT '1c' AS muc, id, ma_sku,
       CONCAT(@tien_to, LPAD(id, GREATEST(10 - CHAR_LENGTH(@tien_to), CHAR_LENGTH(id)), '0')) AS ma_vach_se_cap
FROM bien_the_san_pham
WHERE ma_vach_sku IS NULL OR ma_vach_sku REGEXP '^[[:space:]]*$'
ORDER BY id;

SET @so_se_cap = (SELECT COUNT(*) FROM bien_the_san_pham
  WHERE ma_vach_sku IS NULL OR ma_vach_sku REGEXP '^[[:space:]]*$');

-- 1d. Mã sẽ cấp đã bị nhập tay cho biến thể khác (COLLATE: chuỗi ghép từ biến @ mang bảng mã của phiên, ép về bảng mã cột). Có dòng nào ở đây thì DỪNG: đổi mã của biến thể đang giữ rồi chạy lại.
SELECT '1d' AS muc, m.id, m.ma_sku, m.ma_vach_se_cap, b.id AS id_dang_giu_ma, b.ma_sku AS sku_dang_giu_ma
FROM (
  SELECT id, ma_sku,
         CONCAT(@tien_to, LPAD(id, GREATEST(10 - CHAR_LENGTH(@tien_to), CHAR_LENGTH(id)), '0')) AS ma_vach_se_cap
  FROM bien_the_san_pham
  WHERE ma_vach_sku IS NULL OR ma_vach_sku REGEXP '^[[:space:]]*$'
) AS m
JOIN bien_the_san_pham b ON b.ma_vach_sku = m.ma_vach_se_cap COLLATE utf8mb4_unicode_ci AND b.id <> m.id
ORDER BY m.id;

SET @so_dung_cham = (SELECT COUNT(*) FROM (
  SELECT id, CONCAT(@tien_to, LPAD(id, GREATEST(10 - CHAR_LENGTH(@tien_to), CHAR_LENGTH(id)), '0')) AS ma_vach_se_cap
  FROM bien_the_san_pham
  WHERE ma_vach_sku IS NULL OR ma_vach_sku REGEXP '^[[:space:]]*$'
) AS m JOIN bien_the_san_pham b ON b.ma_vach_sku = m.ma_vach_se_cap COLLATE utf8mb4_unicode_ci AND b.id <> m.id);

-- 1e. Khóa cấu hình sẽ thêm (chưa có)
SELECT '1e' AS muc, moi.ma_cau_hinh, moi.gia_tri, moi.kieu_du_lieu
FROM (
  SELECT 'MA_VACH_TIEN_TO' AS ma_cau_hinh, '20' AS gia_tri, 'STRING' AS kieu_du_lieu
  UNION ALL SELECT 'TEM_KHO_MAC_DINH', '35x22', 'STRING'
  UNION ALL SELECT 'TEM_IN_TEN_CUA_HANG', 'false', 'BOOLEAN'
  UNION ALL SELECT 'TEM_IN_SKU', 'false', 'BOOLEAN'
  UNION ALL SELECT 'TEM_NGUONG_XAC_NHAN', '200', 'INT'
) AS moi
WHERE NOT EXISTS (SELECT 1 FROM cau_hinh_he_thong c WHERE c.ma_cau_hinh = moi.ma_cau_hinh);

SET @dung = IF(@so_trung > 0 OR @so_dung_cham > 0, 1, 0);
SET @lam = IF(@chay_that = 1 AND @dung = 0, 1, 0);

-- ---------------------------------------------------------------------
-- 2. Bước a + b (chỉ khi @chay_that = 1 và không phải dừng), một giao dịch.
--    Gán lại ngay_cap_nhat = ngay_cap_nhat: MySQL không tự đặt NOW() cho cột ON UPDATE khi câu lệnh đã gán cột đó.
--    GẶP LỖI: chạy ROLLBACK; rồi CHỈ chạy 3 lệnh SET SESSION khôi phục ở cuối tệp, không chạy COMMIT.
-- ---------------------------------------------------------------------
START TRANSACTION;

UPDATE bien_the_san_pham
SET ma_vach_sku = NULL,
    ngay_cap_nhat = ngay_cap_nhat
WHERE @lam = 1
  AND ma_vach_sku IS NOT NULL AND ma_vach_sku REGEXP '^[[:space:]]*$';
SET @da_a = IF(@lam = 1, ROW_COUNT(), 0);

UPDATE bien_the_san_pham
SET ma_vach_sku = CONCAT(@tien_to, LPAD(id, GREATEST(10 - CHAR_LENGTH(@tien_to), CHAR_LENGTH(id)), '0')),
    ngay_cap_nhat = ngay_cap_nhat
WHERE @lam = 1
  AND ma_vach_sku IS NULL;
SET @da_b = IF(@lam = 1, ROW_COUNT(), 0);

COMMIT;

-- ---------------------------------------------------------------------
-- 3. Bước c: khóa không trùng (DDL tự lưu ngay)
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_index = 0,
  'ALTER TABLE bien_the_san_pham ADD UNIQUE INDEX uq_bien_the_ma_vach (ma_vach_sku)',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- 4. Bước d: khóa cấu hình (đã có thì giữ nguyên giá trị đang có)
-- ---------------------------------------------------------------------
SET @so_khoa_truoc = (SELECT COUNT(*) FROM cau_hinh_he_thong WHERE ma_cau_hinh IN
  ('MA_VACH_TIEN_TO', 'TEM_KHO_MAC_DINH', 'TEM_IN_TEN_CUA_HANG', 'TEM_IN_SKU', 'TEM_NGUONG_XAC_NHAN'));

INSERT INTO cau_hinh_he_thong (ma_cau_hinh, gia_tri, kieu_du_lieu, mo_ta, ngay_cap_nhat)
SELECT moi.ma_cau_hinh, moi.gia_tri, moi.kieu_du_lieu, moi.mo_ta, NOW()
FROM (
  SELECT 'MA_VACH_TIEN_TO' AS ma_cau_hinh, '20' AS gia_tri, 'STRING' AS kieu_du_lieu,
         'Tiền tố mã vạch SKU tự tạo (2 chữ số, nên dùng 20–29 là vùng mã nội bộ). Đổi tiền tố chỉ áp dụng cho mã sinh sau đó, mã đã cấp giữ nguyên' AS mo_ta
  UNION ALL SELECT 'TEM_KHO_MAC_DINH', '35x22', 'STRING', 'Khổ tem sản phẩm đang dùng'
  UNION ALL SELECT 'TEM_IN_TEN_CUA_HANG', 'false', 'BOOLEAN', 'In tên cửa hàng trên tem sản phẩm'
  UNION ALL SELECT 'TEM_IN_SKU', 'false', 'BOOLEAN', 'In mã SKU trên tem sản phẩm'
  UNION ALL SELECT 'TEM_NGUONG_XAC_NHAN', '200', 'INT', 'Số tem tối đa in không cần xác nhận'
) AS moi
WHERE @lam = 1
ON DUPLICATE KEY UPDATE cau_hinh_he_thong.gia_tri = cau_hinh_he_thong.gia_tri;

SET @so_khoa_sau = (SELECT COUNT(*) FROM cau_hinh_he_thong WHERE ma_cau_hinh IN
  ('MA_VACH_TIEN_TO', 'TEM_KHO_MAC_DINH', 'TEM_IN_TEN_CUA_HANG', 'TEM_IN_SKU', 'TEM_NGUONG_XAC_NHAN'));

-- ---------------------------------------------------------------------
-- Kết quả
-- ---------------------------------------------------------------------
SELECT IF(@dung = 1,
          'DỪNG — có mã vạch trùng (1b) hoặc mã sẽ cấp đã có biến thể khác giữ (1d); chưa đổi gì',
          IF(@chay_that = 1, 'ĐÃ CHẠY THẬT', 'CHỈ XEM TRƯỚC — chưa đổi gì')) AS che_do,
       @tien_to AS tien_to_dung,
       IF(@tien_to_cau_hinh IS NULL, 'chưa có khóa (dùng 20)',
          IF(@tien_to_gon = @tien_to, 'theo cấu hình', CONCAT('cấu hình sai "', @tien_to_cau_hinh, '" (dùng ', @tien_to, ')'))) AS nguon_tien_to;

SELECT @tong_bien_the AS tong_bien_the,
       @so_null AS ma_vach_null_truoc, @so_rong AS ma_vach_rong_truoc,
       @so_trung AS `1b_ma_trung`, @so_dung_cham AS `1d_ma_se_cap_da_co_nguoi_giu`,
       @so_se_cap AS `1c_bien_the_se_cap_ma`,
       @da_a AS `a_rong_thanh_null`, @da_b AS `b_da_cap_ma`;

SELECT IF(@co_index = 1, 'đã có', IF(@lam = 1, 'đã thêm', 'sẽ thêm')) AS `c_uq_bien_the_ma_vach`,
       @so_khoa_truoc AS `d_khoa_cau_hinh_truoc`, @so_khoa_sau AS `d_khoa_cau_hinh_sau`;

SET SESSION lock_wait_timeout = @cho_khoa_cu;
SET SESSION innodb_lock_wait_timeout = @cho_khoa_dong_cu;
SET SESSION sql_safe_updates = @safe_updates_cu;

-- ---------------------------------------------------------------------
-- Hoàn tác (chạy tay nếu cần, theo đúng thứ tự). Thay <id 1a...>, <id 1c...> bằng cột id của danh sách 1a, 1c đã in
-- ra lúc CHẠY THẬT.
--   SET SESSION sql_safe_updates = 0;
--   ALTER TABLE bien_the_san_pham DROP INDEX uq_bien_the_ma_vach;   -- chỉ khi kết quả ghi "đã thêm"
--   UPDATE bien_the_san_pham SET ma_vach_sku = NULL, ngay_cap_nhat = ngay_cap_nhat WHERE id IN (<id 1c...>);
--   UPDATE bien_the_san_pham SET ma_vach_sku = '', ngay_cap_nhat = ngay_cap_nhat WHERE id IN (<id 1a...>);
--   -- Chỉ khi kết quả ghi d_khoa_cau_hinh_truoc = 0 (các khóa do tệp này thêm) và backend mới đã gỡ:
--   DELETE FROM cau_hinh_he_thong WHERE ma_cau_hinh IN
--     ('MA_VACH_TIEN_TO', 'TEM_KHO_MAC_DINH', 'TEM_IN_TEN_CUA_HANG', 'TEM_IN_SKU', 'TEM_NGUONG_XAC_NHAN');
-- hoặc nạp lại bản sao lưu bk_ma_vach_sku_20261024.sql.
-- Lưu ý: tem đã in mang mã vừa cấp; hoàn tác thì máy quét không còn tra được các tem đó.
-- ---------------------------------------------------------------------
