-- =====================================================================
-- Cước vận chuyển thực tế lưu trên phiếu xuất + khôi phục phí vận chuyển của đơn bán buôn – 2026-10-25
--
-- MẶC ĐỊNH CHỈ XEM TRƯỚC: chạy nguyên tệp với @chay_that = 0 không đổi dữ liệu nào trong CSDL, chỉ in ra việc sẽ làm
-- và các dòng sẽ đổi. Xem kỹ rồi mới đổi @chay_that = 1 và chạy lại.
--
-- Bối cảnh: trước đây khi xác nhận xuất kho, cước thực tế shop trả đơn vị vận chuyển (ô "Cước thực tế" của hộp
-- Xác nhận xuất kho) được GHI ĐÈ vào don_ban_hang.phi_van_chuyen, tức phí vận chuyển THU CỦA KHÁCH, nhưng tong_cong
-- không tính lại. Hậu quả: tiền hàng + phí ≠ tổng cộng, hóa đơn bán hàng in sau khi xuất ghi sai phí, đơn xuất nhiều
-- đợt thì cước đợt sau đè đợt trước. Backend mới ghi cước vào phiếu xuất (cột mới), không đụng phí của đơn nữa.
-- Cước cũ còn ở hai nơi, đúng dạng backend cũ ghi:
--   - Ghi chú phiếu xuất: "[Vận chuyển: GHN - Vận đơn: ABC - Cước: 35000]". CHỈ có khi có nhập đơn vị vận chuyển
--     hoặc mã vận đơn.
--   - Nhật ký thao tác (lich_su_thay_doi, phieu_xuat_kho / xuat_kho): gia_tri_moi kết thúc bằng "| Cước: 35000".
--     Luôn có khi có nhập cước (trừ khi ghi nhật ký lỗi, việc này không chặn xuất kho).
--   Mẫu tìm phân biệt hoa thường và bám đúng hai dạng trên (dấu "]" sau số / số ở cuối nhật ký), để chữ "cước" gõ tay
--   trong ghi chú không bị đọc nhầm. Số tối đa 13 chữ số phần nguyên, 2 chữ số lẻ (vừa cột DECIMAL(15,2)); số khác
--   dạng (vd. "1E+21" của backend cũ) không đọc, chỉ liệt kê để xem tay.
--
-- Khi chạy thật:
--   a. Thêm cột phieu_xuat_kho.phi_van_chuyen_thuc_te DECIMAL(15,2) NULL (có rồi thì bỏ qua).
--   b. Điền cột đó cho phiếu cũ đang NULL: lấy cước trong ghi chú, không có thì trong nhật ký xuất kho mới nhất.
--   c. Khôi phục phí vận chuyển thu của khách cho ĐƠN BÁN BUÔN (đơn tạo tay / từ báo giá, kenh_ban_id NULL):
--      phi_van_chuyen = tong_cong − tien_hang. Chính xác vì với đơn bán buôn tong_cong = tien_hang + phí lúc tạo đơn
--      và không chỗ nào tính lại (DonBanHangService); chỉ lần xác nhận xuất kho ghi đè phí.
--      CHỈ sửa đơn có bằng chứng bị ghi đè: phí hiện tại BẰNG cước đã ghi của một phiếu xuất bán hàng đã xuất của đơn.
--      Đơn lệch mà không khớp cước nào: chỉ liệt kê ở 1b ("xem tay").
--      Trước khi sửa, lưu (đơn, phí cũ, phí mới, lúc chạy) vào bảng bk_phi_van_chuyen_20261025 để hoàn tác.
--
-- Không làm gì:
--   - Đơn sàn (Shopify…, kenh_ban_id có giá trị): KHÔNG tự sửa vì tổng cộng của sàn có thể gồm thuế, không suy ra được
--     phí gốc. Chỉ liệt kê ở mục 1d để xem tay (phí gốc lấy lại từ trang quản trị Shopify nếu cần).
--   - Đơn bán buôn lệch mà tong_cong − tien_hang < 0 (dữ liệu bất thường): chỉ liệt kê ở mục 1c.
--   - Báo giá (loai_chung_tu = 'bao_gia') từng có phiếu xuất đã xuất (trước 15/10/2026 có thể xảy ra): chỉ liệt kê 1f.
--   - Không xóa dòng nào, không đổi tong_cong, tien_hang, trạng thái. Giữ nguyên ngay_cap_nhat của các dòng sửa.
--   - Mục 1e chỉ ĐẾM đơn đã ghi nhận doanh thu (3, 5) mà thiếu ngày giao: Báo cáo doanh thu bỏ qua các đơn này
--     (màn Tổng quan thì lấy ngày phiếu xuất cuối). Tệp này không sửa chúng.
--
-- THỨ TỰ KHI TRIỂN KHAI:
--   B1. Tệp này với @chay_that = 1 (ít nhất bước a). Thêm cột rỗng không ảnh hưởng backend CŨ đang chạy.
--       Kết quả cuối tệp ghi "CHƯA CÓ" ở cột a thì CHƯA được lên backend mới.
--   B2. Lên backend mới (spring.jpa.hibernate.ddl-auto=none: backend mới đọc/ghi cột phi_van_chuyen_thuc_te, thiếu cột
--       thì mọi màn đọc phiếu xuất báo lỗi). Localhost dùng chung CSDL này: chạy backend mới ở máy cũng phải có B1.
--   B3. SAU B2 PHẢI chạy lại cả tệp (xem trước rồi chạy thật): giữa B1 và B2 backend cũ vẫn ghi đè phí và chưa ghi cột.
--       Chạy lại chỉ đổi dòng còn thiếu / còn lệch (đơn đã sửa không còn lệch; phiếu đã có cước thì giữ).
--   Nên chạy ngoài giờ bán hàng: bước b, c khóa ngắn các dòng phiếu xuất / đơn đang sửa.
--
-- Chống treo hệ thống và lỗi giữa chừng:
--   - KHÔNG gói trong một giao dịch: mỗi lệnh tự lưu (autocommit = 1 trong phiên, trả lại ở cuối tệp). Gặp lỗi ở bước
--     nào thì các bước trước đã lưu, không có khóa nào bị giữ lại chờ ROLLBACK. Đọc ERROR, sửa, rồi chạy lại cả tệp.
--   - Chỉ chờ khóa tối đa 5 giây (lock_wait_timeout = 5, innodb_lock_wait_timeout = 5): quá 5 giây thì báo lỗi 1205,
--     lệnh đó KHÔNG đổi gì.
--   - ADD COLUMN cột NULL ở cuối bảng: MySQL 8.0.12+ làm tức thì (INSTANT), không chép lại bảng; vẫn chờ khóa bảng
--     (metadata lock) tối đa 5 giây.
--   - Bảng tạm tam_cuoc_20261025, tam_phi_20261025 là TEMPORARY: chỉ phiên này thấy, xóa ở cuối tệp (hoặc khi đóng kết
--     nối). Lúc xem trước chỉ ghi vào hai bảng tạm này, không đổi bảng thật.
--   - Không cần DELIMITER, chạy được trong MySQL Workbench và mysql CLI (MySQL 8). Phải đọc tệp bằng UTF-8 (Workbench
--     mở thẳng tệp, hoặc mysql --default-character-set=utf8mb4 < tệp); tệp bị đổi mã chữ thì tệp tự DỪNG, không đổi gì.
--
-- Trước khi chạy thật: SAO LƯU 2 bảng phieu_xuat_kho, don_ban_hang
-- (vd. mysqldump fashion_system phieu_xuat_kho don_ban_hang > bk_cuoc_van_chuyen_20261025.sql).
-- Bảng bk_phi_van_chuyen_20261025 do tệp tạo ra giữ lại để hoàn tác bước c; xóa khi đã chắc chắn (xem cuối tệp).
--
-- Ghi chú kỹ thuật: số đọc ra phải qua CAST(… AS CHAR) rồi mới CAST sang DECIMAL: MySQL 8.0.43 ép thẳng kết quả
-- REGEXP_SUBSTR sang DECIMAL thì mất phần lẻ ("18000.50" → 18000.00; đã thử trên MySQL tạm). Mẫu tìm viết [.] và [|]
-- thay cho \. và \| để không phải thoát dấu gạch chéo. Mẫu tìm phải viết thẳng trong câu lệnh: để trong biến @ thì
-- MySQL báo lỗi 1267 (trộn bảng mã giữa biến của phiên và cột).
-- =====================================================================
SET NAMES utf8mb4;           -- mysql CLI mặc định latin1 thì chữ tiếng Việt trong ghi chú / mẫu tìm bị lỗi mã

USE fashion_system;          -- đổi nếu CSDL của bạn tên khác

SET @chay_that = 0;          -- 0 = CHỈ XEM TRƯỚC, không đổi gì · 1 = CHẠY THẬT

-- Tệp bị đổi mã chữ (vd. đọc qua công cụ không phải UTF-8) thì chữ "ư" không còn là 2 byte C6 B0: dừng, không đổi gì
SET @ma_ok = IF(HEX('ư') = 'C6B0', 1, 0);

SET @cho_khoa_cu = @@SESSION.lock_wait_timeout;
SET @cho_khoa_dong_cu = @@SESSION.innodb_lock_wait_timeout;
SET @safe_updates_cu = @@SESSION.sql_safe_updates;
SET @autocommit_cu = @@SESSION.autocommit;
SET @group_concat_cu = @@SESSION.group_concat_max_len;
SET @cach_ly_cu = @@SESSION.transaction_isolation;
SET SESSION lock_wait_timeout = 5;
-- READ COMMITTED: các lệnh INSERT … SELECT vào bảng tạm không khóa dòng phiếu xuất / đơn / nhật ký đang được bán hàng
-- ghi (REPEATABLE READ khóa S mọi dòng quét được). Giữ nguyên khi binlog dạng STATEMENT (MySQL không cho kết hợp).
SET SESSION transaction_isolation = IF(@@SESSION.binlog_format = 'STATEMENT', @@SESSION.transaction_isolation, 'READ-COMMITTED');
SET SESSION innodb_lock_wait_timeout = 5;
SET SESSION sql_safe_updates = 0;
SET SESSION autocommit = 1;
SET SESSION group_concat_max_len = 1000000;

SET @da_b = 0, @da_bk = 0, @da_c = 0, @chay_luc = NULL;

-- ---------------------------------------------------------------------
-- Hiện trạng (đọc trước khi đổi; dùng cho cả hai chế độ)
-- ---------------------------------------------------------------------
SET @co_cot = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phieu_xuat_kho' AND COLUMN_NAME = 'phi_van_chuyen_thuc_te');

-- Cước đọc được của từng phiếu (bảng tạm, chỉ phiên này thấy). nk = bản ghi nhật ký xuất kho mới nhất có "| Cước: ".
DROP TEMPORARY TABLE IF EXISTS tam_cuoc_20261025;
CREATE TEMPORARY TABLE tam_cuoc_20261025 (
  phieu_id     INT NOT NULL PRIMARY KEY,
  cuoc_ghi_chu DECIMAL(15,2) NULL,
  cuoc_nhat_ky DECIMAL(15,2) NULL
);
INSERT INTO tam_cuoc_20261025 (phieu_id, cuoc_ghi_chu, cuoc_nhat_ky)
SELECT p.id,
       CAST(CAST(REGEXP_SUBSTR(REGEXP_SUBSTR(p.ghi_chu, 'Cước: [0-9]{1,13}([.][0-9]{1,2})?]', 1, 1, 'c'),
                               '[0-9]+([.][0-9]+)?') AS CHAR) AS DECIMAL(15,2)),
       CAST(CAST(REGEXP_SUBSTR(REGEXP_SUBSTR(l.gia_tri_moi, '[|] Cước: [0-9]{1,13}([.][0-9]{1,2})?$', 1, 1, 'c'),
                               '[0-9]+([.][0-9]+)?') AS CHAR) AS DECIMAL(15,2))
FROM phieu_xuat_kho p
LEFT JOIN (SELECT id_tham_chieu, MAX(id) AS id_cuoi FROM lich_su_thay_doi
            WHERE loai_tham_chieu = 'phieu_xuat_kho' AND hanh_dong = 'xuat_kho'
              AND REGEXP_LIKE(gia_tri_moi, '[|] Cước: ', 'c')
            GROUP BY id_tham_chieu) nk ON nk.id_tham_chieu = p.id
LEFT JOIN lich_su_thay_doi l ON l.id = nk.id_cuoi
WHERE REGEXP_LIKE(p.ghi_chu, ' - Cước: ', 'c') OR nk.id_cuoi IS NOT NULL;

SET @so_phieu_doc_duoc = (SELECT COUNT(*) FROM tam_cuoc_20261025
  WHERE COALESCE(cuoc_ghi_chu, cuoc_nhat_ky) IS NOT NULL);
SET @so_phieu_khong_doc = (SELECT COUNT(*) FROM tam_cuoc_20261025
  WHERE cuoc_ghi_chu IS NULL AND cuoc_nhat_ky IS NULL);

-- Đơn bán buôn đang lệch (bảng tạm). khop = 1: phí hiện tại bằng cước đã ghi của một phiếu xuất bán hàng đã xuất của
-- đơn, tức bằng chứng bị ghi đè → bước c sửa. khop = 0: chỉ liệt kê.
DROP TEMPORARY TABLE IF EXISTS tam_phi_20261025;
CREATE TEMPORARY TABLE tam_phi_20261025 (
  don_id  INT NOT NULL PRIMARY KEY,
  phi_cu  DECIMAL(15,2) NULL,
  phi_moi DECIMAL(15,2) NOT NULL,
  khop    TINYINT NOT NULL
);
INSERT INTO tam_phi_20261025 (don_id, phi_cu, phi_moi, khop)
SELECT d.id, d.phi_van_chuyen, d.tong_cong - d.tien_hang,
       IF(EXISTS (SELECT 1 FROM phieu_xuat_kho p
                  JOIN tam_cuoc_20261025 t ON t.phieu_id = p.id
                  WHERE p.don_ban_hang_id = d.id AND p.loai_xuat = 'ban_hang' AND p.trang_thai = 3
                    AND (d.phi_van_chuyen = t.cuoc_ghi_chu OR d.phi_van_chuyen = t.cuoc_nhat_ky)), 1, 0)
FROM don_ban_hang d
WHERE d.loai_chung_tu = 'don_ban_hang'
  AND d.kenh_ban_id IS NULL
  AND d.tong_cong IS NOT NULL AND d.tien_hang IS NOT NULL
  AND d.tong_cong - d.tien_hang >= 0
  AND (d.phi_van_chuyen IS NULL OR d.phi_van_chuyen <> d.tong_cong - d.tien_hang)
  AND EXISTS (SELECT 1 FROM phieu_xuat_kho p
               WHERE p.don_ban_hang_id = d.id AND p.loai_xuat = 'ban_hang' AND p.trang_thai = 3);

SET @so_don_se_sua = (SELECT COUNT(*) FROM tam_phi_20261025 WHERE khop = 1);
SET @so_don_xem_tay = (SELECT COUNT(*) FROM tam_phi_20261025 WHERE khop = 0);

-- ---------------------------------------------------------------------
-- 1. Danh sách — in ra ở cả hai chế độ, TRƯỚC khi đổi
-- ---------------------------------------------------------------------
-- 1a. Phiếu xuất có cước cũ. cuoc_se_ghi = số bước b điền (chỉ vào phiếu đang NULL; chạy lại thì phiếu đã điền vẫn
--     hiện ở đây nhưng không đổi nữa).
SELECT '1a' AS muc, p.id, p.so_phieu_xuat, p.loai_xuat, p.trang_thai, d.so_don_hang,
       COALESCE(t.cuoc_ghi_chu, t.cuoc_nhat_ky) AS cuoc_se_ghi, t.cuoc_ghi_chu, t.cuoc_nhat_ky,
       CASE WHEN t.cuoc_ghi_chu IS NULL AND t.cuoc_nhat_ky IS NULL THEN 'KHÔNG đọc được số — không điền, xem tay'
            WHEN t.cuoc_ghi_chu <> t.cuoc_nhat_ky THEN 'ghi chú khác nhật ký — lấy theo ghi chú'
            ELSE '' END AS canh_bao
FROM tam_cuoc_20261025 t
JOIN phieu_xuat_kho p ON p.id = t.phieu_id
LEFT JOIN don_ban_hang d ON d.id = p.don_ban_hang_id
ORDER BY p.id;

-- 1b. Đơn bán buôn đang lệch. "SẼ SỬA" = bước c đổi phí về phi_se_khoi_phuc (có lưu bảng hoàn tác).
SELECT '1b' AS muc, d.id, d.so_don_hang, d.trang_thai, d.tien_hang, t.phi_cu AS phi_hien_tai, d.tong_cong,
       t.phi_moi AS phi_se_khoi_phuc,
       IF(t.khop = 1, 'SẼ SỬA (phí hiện tại = cước đã ghi của phiếu xuất)',
          'KHÔNG sửa — phí không khớp cước nào đã ghi, xem tay') AS xu_ly
FROM tam_phi_20261025 t
JOIN don_ban_hang d ON d.id = t.don_id
ORDER BY t.khop DESC, d.id;

-- 1c. Đơn bán buôn lệch nhưng tổng cộng < tiền hàng: KHÔNG tự sửa, xem tay
SELECT '1c' AS muc, d.id, d.so_don_hang, d.trang_thai, d.tien_hang, d.phi_van_chuyen AS phi_hien_tai, d.tong_cong
FROM don_ban_hang d
WHERE d.loai_chung_tu = 'don_ban_hang'
  AND d.kenh_ban_id IS NULL
  AND d.tong_cong - d.tien_hang < 0
ORDER BY d.id;

-- 1d. Đơn sàn có phiếu xuất bán hàng đã xuất ghi cước. KHÔNG tự sửa, xem tay (đối chiếu phí giao hàng trên trang
--     quản trị của sàn). dau_hieu: phí hiện tại bằng cước đã ghi → nhiều khả năng đã bị ghi đè.
SELECT '1d' AS muc, d.id, d.so_don_hang, k.ma_kenh, d.ma_don_hang_kenh, d.tien_hang,
       d.phi_van_chuyen AS phi_hien_tai, d.tong_cong, d.tong_cong - d.tien_hang AS tong_tru_tien_hang,
       IF(MAX(d.phi_van_chuyen = t.cuoc_ghi_chu OR d.phi_van_chuyen = t.cuoc_nhat_ky) = 1,
          'phí = cước đã ghi: nhiều khả năng đã bị ghi đè', '') AS dau_hieu
FROM don_ban_hang d
JOIN kenh_ban_hang k ON k.id = d.kenh_ban_id
JOIN phieu_xuat_kho p ON p.don_ban_hang_id = d.id AND p.loai_xuat = 'ban_hang' AND p.trang_thai = 3
JOIN tam_cuoc_20261025 t ON t.phieu_id = p.id
WHERE d.loai_chung_tu = 'don_ban_hang'
GROUP BY d.id, d.so_don_hang, k.ma_kenh, d.ma_don_hang_kenh, d.tien_hang, d.phi_van_chuyen, d.tong_cong
ORDER BY d.id;

-- 1e. Đơn đã ghi nhận doanh thu (3, 5) mà thiếu ngày giao: Báo cáo doanh thu bỏ qua. Chỉ đếm, không sửa.
SELECT '1e' AS muc, COUNT(*) AS so_don_3_5_thieu_ngay_giao,
       GROUP_CONCAT(so_don_hang ORDER BY id SEPARATOR ', ') AS cac_don
FROM don_ban_hang
WHERE loai_chung_tu = 'don_ban_hang' AND trang_thai IN (3, 5) AND ngay_giao_hang IS NULL;

-- 1f. Báo giá từng có phiếu xuất bán hàng đã xuất (phí có thể đã bị ghi đè). KHÔNG tự sửa, xem tay.
SELECT '1f' AS muc, d.id, d.so_don_hang, d.trang_thai, d.tien_hang, d.phi_van_chuyen AS phi_hien_tai, d.tong_cong
FROM don_ban_hang d
WHERE d.loai_chung_tu = 'bao_gia'
  AND EXISTS (SELECT 1 FROM phieu_xuat_kho p
               WHERE p.don_ban_hang_id = d.id AND p.loai_xuat = 'ban_hang' AND p.trang_thai = 3)
ORDER BY d.id;

SET @lam = IF(@chay_that = 1 AND @ma_ok = 1, 1, 0);

-- ---------------------------------------------------------------------
-- 2. Bước a: thêm cột (DDL tự lưu ngay)
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_cot = 0,
  'ALTER TABLE phieu_xuat_kho ADD COLUMN phi_van_chuyen_thuc_te DECIMAL(15,2) NULL DEFAULT NULL COMMENT ''Cước thực tế shop trả đơn vị vận chuyển cho chuyến hàng của phiếu (nhập lúc xác nhận xuất kho). Khác phí vận chuyển thu của khách ở don_ban_hang.phi_van_chuyen''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @co_cot_sau = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'phieu_xuat_kho' AND COLUMN_NAME = 'phi_van_chuyen_thuc_te');

-- ---------------------------------------------------------------------
-- 3. Bước b: điền cước cho phiếu cũ (qua PREPARE: lúc xem trước cột mới có thể chưa có, câu viết thẳng sẽ lỗi ngay khi
--    phân tích). ROW_COUNT() phải đọc ngay sau EXECUTE (sau DEALLOCATE thì nó là của lệnh DEALLOCATE = 0).
--    Gán lại ngay_cap_nhat = ngay_cap_nhat: MySQL không tự đặt NOW() cho cột ON UPDATE khi câu lệnh đã gán cột đó.
-- ---------------------------------------------------------------------
SET @sql = IF(@lam = 1 AND @co_cot_sau = 1,
  'UPDATE phieu_xuat_kho p
     JOIN tam_cuoc_20261025 t ON t.phieu_id = p.id
      SET p.phi_van_chuyen_thuc_te = COALESCE(t.cuoc_ghi_chu, t.cuoc_nhat_ky),
          p.ngay_cap_nhat = p.ngay_cap_nhat
    WHERE p.phi_van_chuyen_thuc_te IS NULL
      AND COALESCE(t.cuoc_ghi_chu, t.cuoc_nhat_ky) IS NOT NULL',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; SET @da_b = IF(@lam = 1 AND @co_cot_sau = 1, ROW_COUNT(), 0); DEALLOCATE PREPARE lenh;

-- ---------------------------------------------------------------------
-- 4. Bước c: lưu bảng hoàn tác rồi khôi phục phí (bảng hoàn tác qua PREPARE vì lúc xem trước có thể chưa có).
--    Lưu hoàn tác lỗi (@da_bk < 0) thì không sửa phí.
--    Bảng TEMPORARY trùng tên (tạo tay trong cùng phiên) sẽ che bảng thật: INSERT vào bảng tạm, đóng phiên là mất bản
--    hoàn tác. Xóa bảng tạm đó trước (lệnh này không đụng bảng thật).
-- ---------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS bk_phi_van_chuyen_20261025;
SET @sql = IF(@lam = 1,
  'CREATE TABLE IF NOT EXISTS bk_phi_van_chuyen_20261025 (
     id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
     don_ban_hang_id INT NOT NULL,
     phi_cu DECIMAL(15,2) NULL,
     phi_moi DECIMAL(15,2) NOT NULL,
     chay_luc DATETIME NOT NULL,
     KEY idx_bk_phi_don (don_ban_hang_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
     COMMENT=''Hoàn tác migration-2026-10-25-cuoc-van-chuyen-thuc-te bước c; xóa khi đã chắc chắn''',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; DEALLOCATE PREPARE lenh;

SET @chay_luc = IF(@lam = 1, NOW(), NULL);
SET @sql = IF(@lam = 1,
  'INSERT INTO bk_phi_van_chuyen_20261025 (don_ban_hang_id, phi_cu, phi_moi, chay_luc)
   SELECT t.don_id, t.phi_cu, t.phi_moi, @chay_luc FROM tam_phi_20261025 t WHERE t.khop = 1',
  'DO 0');
PREPARE lenh FROM @sql; EXECUTE lenh; SET @da_bk = IF(@lam = 1, ROW_COUNT(), 0); DEALLOCATE PREPARE lenh;

UPDATE don_ban_hang d
JOIN tam_phi_20261025 t ON t.don_id = d.id
SET d.phi_van_chuyen = t.phi_moi,
    d.ngay_cap_nhat = d.ngay_cap_nhat
WHERE @lam = 1 AND @da_bk >= 0
  AND t.khop = 1
  AND d.phi_van_chuyen <=> t.phi_cu
  AND d.tong_cong - d.tien_hang = t.phi_moi;
SET @da_c = IF(@lam = 1 AND @da_bk >= 0, ROW_COUNT(), 0);

-- ---------------------------------------------------------------------
-- Kết quả
-- ---------------------------------------------------------------------
SELECT CASE WHEN @ma_ok = 0
              THEN 'DỪNG — tệp bị đổi mã chữ, chưa đổi gì. Mở thẳng tệp trong Workbench hoặc chạy mysql --default-character-set=utf8mb4 < tệp'
            WHEN @lam = 1 AND (@da_b < 0 OR @da_bk < 0 OR @da_c < 0)
              THEN 'CÓ LỖI — xem ERROR phía trên, sửa rồi chạy lại cả tệp'
            WHEN @chay_that = 1 THEN 'ĐÃ CHẠY THẬT'
            ELSE 'CHỈ XEM TRƯỚC — chưa đổi gì' END AS che_do,
       CASE WHEN @co_cot = 1 THEN 'đã có'
            WHEN @co_cot_sau = 1 THEN 'đã thêm'
            ELSE 'CHƯA CÓ — chưa được lên backend mới; chạy lại với @chay_that = 1' END AS a_cot_phi_van_chuyen_thuc_te,
       @so_phieu_doc_duoc AS `1a_phieu_doc_duoc_cuoc`, @so_phieu_khong_doc AS `1a_phieu_khong_doc_duoc`,
       @da_b AS b_phieu_da_dien_cuoc,
       @so_don_se_sua AS `1b_don_se_sua`, @so_don_xem_tay AS `1b_don_xem_tay`,
       @da_bk AS c_da_luu_hoan_tac, @da_c AS c_don_da_khoi_phuc_phi,
       DATE_FORMAT(IF(@da_bk > 0, @chay_luc, NULL), '%Y-%m-%d %H:%i:%s') AS chay_luc_de_hoan_tac;

DROP TEMPORARY TABLE IF EXISTS tam_cuoc_20261025;
DROP TEMPORARY TABLE IF EXISTS tam_phi_20261025;

SET SESSION lock_wait_timeout = @cho_khoa_cu;
SET SESSION innodb_lock_wait_timeout = @cho_khoa_dong_cu;
SET SESSION sql_safe_updates = @safe_updates_cu;
SET SESSION autocommit = @autocommit_cu;
SET SESSION group_concat_max_len = @group_concat_cu;
SET SESSION transaction_isolation = @cach_ly_cu;

-- ---------------------------------------------------------------------
-- Hoàn tác (chạy tay nếu cần, theo thứ tự). <chay_luc> = cột chay_luc_de_hoan_tac của lần CHẠY THẬT cần hoàn tác
-- (nhiều lần chạy thì hoàn tác lần gần nhất trước).
--   SET SESSION sql_safe_updates = 0;
--   -- Bước c: trả phí cũ cho các đơn của lần chạy đó (đơn đã bị đổi phí lần nữa thì bỏ qua)
--   UPDATE don_ban_hang d
--   JOIN bk_phi_van_chuyen_20261025 b ON b.don_ban_hang_id = d.id AND b.chay_luc = '<chay_luc>'
--   SET d.phi_van_chuyen = b.phi_cu, d.ngay_cap_nhat = d.ngay_cap_nhat
--   WHERE d.phi_van_chuyen = b.phi_moi;
--   -- Bước b (chỉ khi số điền sai và backend CŨ còn chạy; backend mới tự ghi cột này cho phiếu mới):
--   UPDATE phieu_xuat_kho SET phi_van_chuyen_thuc_te = NULL, ngay_cap_nhat = ngay_cap_nhat WHERE id IN (<id ở 1a>);
--   -- Bước a: chỉ bỏ cột khi đã quay về backend CŨ (backend mới cần cột này):
--   ALTER TABLE phieu_xuat_kho DROP COLUMN phi_van_chuyen_thuc_te;
-- hoặc nạp lại bản sao lưu bk_cuoc_van_chuyen_20261025.sql.
-- Khi đã chắc không cần hoàn tác bước c: DROP TABLE bk_phi_van_chuyen_20261025;
-- ---------------------------------------------------------------------
