-- =====================================================================
-- Bỏ số điện thoại / email giả của khách do đơn sàn tự tạo – 2026-11-06
--
-- Trước bản này, đồng bộ đơn Shopify, Lazada, TikTok tạo khách với SĐT giả 0900000000 và email giả
-- shopify@customer.com / lazada@customer.com khi sàn không gửi (hoặc che) SĐT, email. Backend mới để trống các trường
-- này. Tệp này đặt NULL cho các giá trị giả còn lại trên khách mã KH-SP- / KH-LZD- / KH-TTS- / KH-SHP- / KH-SHOPIFY.
-- Tên, địa chỉ, đơn hàng và lịch sử của khách giữ nguyên; không gộp khách nào vào Khách lẻ (KHLE).
--
-- THỨ TỰ: backend mới → tệp này (backend cũ còn chạy sẽ lại ghi giá trị giả). Không cần dừng backend.
-- MẶC ĐỊNH CHỈ XEM TRƯỚC: chạy cả tệp sẽ in danh sách khách sẽ sửa, không đổi gì. Muốn sửa thật: đổi dòng
--   SET @ap_dung = 0;  thành  SET @ap_dung = 1;  rồi chạy lại cả tệp.
-- Sửa thật thì giá trị cũ chép vào bảng bk_lien_he_gia_khach_20261106 trước. Hoàn tác:
--   UPDATE khach_hang k JOIN bk_lien_he_gia_khach_20261106 b ON b.id = k.id
--      SET k.so_dien_thoai = b.so_dien_thoai, k.email = b.email;
-- Chạy thật lần hai khi bảng sao lưu đã có sẽ dừng, không đổi gì; khi dừng như vậy thủ tục tạm còn lại, dọn bằng:
--   DROP PROCEDURE IF EXISTS migrate_bo_lien_he_gia_20261106;
-- Cách chạy: Workbench chạy cả tệp (có DELIMITER); hoặc mysql --default-character-set=utf8mb4 fashion_system < tệp này.
-- =====================================================================

SET NAMES utf8mb4;
SET @ap_dung = 0;

DROP PROCEDURE IF EXISTS migrate_bo_lien_he_gia_20261106;

DELIMITER $$
CREATE PROCEDURE migrate_bo_lien_he_gia_20261106(IN p_ap_dung INT)
BEGIN
  DECLARE v_safe INT DEFAULT @@SESSION.sql_safe_updates;
  DECLARE v_so_dong INT DEFAULT 0;

  IF p_ap_dung = 1 AND EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = DATABASE() AND table_name = 'bk_lien_he_gia_khach_20261106') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bang bk_lien_he_gia_khach_20261106 da co: tep nay da chay that';
  END IF;

  DROP TEMPORARY TABLE IF EXISTS tmp_lien_he_gia_20261106;
  CREATE TEMPORARY TABLE tmp_lien_he_gia_20261106 AS
  SELECT k.id, k.ma_khach_hang, k.ten_khach_hang, k.so_dien_thoai, k.email
    FROM khach_hang k
   -- KH-SHOPIFY: mã khách Shopify đời đầu; KH-SHP-: khách Shopee (nhánh PhanAnh, nếu đã gộp)
   WHERE (k.ma_khach_hang LIKE 'KH-SP-%' OR k.ma_khach_hang LIKE 'KH-LZD-%' OR k.ma_khach_hang LIKE 'KH-TTS-%'
          OR k.ma_khach_hang LIKE 'KH-SHP-%' OR k.ma_khach_hang = 'KH-SHOPIFY')
     AND (k.so_dien_thoai = '0900000000' OR k.email IN ('shopify@customer.com', 'lazada@customer.com'));

  -- Danh sách khách sẽ sửa (xem trước) / đã sửa
  SELECT ma_khach_hang AS `Mã khách`, ten_khach_hang AS `Tên khách`,
         so_dien_thoai AS `SĐT cũ`, IF(so_dien_thoai = '0900000000', NULL, so_dien_thoai) AS `SĐT mới`,
         email AS `Email cũ`, IF(email IN ('shopify@customer.com', 'lazada@customer.com'), NULL, email) AS `Email mới`
    FROM tmp_lien_he_gia_20261106 ORDER BY ma_khach_hang;

  IF p_ap_dung = 1 THEN
    CREATE TABLE bk_lien_he_gia_khach_20261106 AS
    SELECT k.id, k.ma_khach_hang, k.so_dien_thoai, k.email
      FROM khach_hang k JOIN tmp_lien_he_gia_20261106 t ON t.id = k.id;

    SET SESSION sql_safe_updates = 0;
    UPDATE khach_hang k JOIN tmp_lien_he_gia_20261106 t ON t.id = k.id
       SET k.so_dien_thoai = IF(k.so_dien_thoai = '0900000000', NULL, k.so_dien_thoai),
           k.email = IF(k.email IN ('shopify@customer.com', 'lazada@customer.com'), NULL, k.email);
    -- Lấy ngay sau UPDATE: câu SET kế tiếp đặt lại ROW_COUNT() về -1
    SET v_so_dong = ROW_COUNT();
    SET SESSION sql_safe_updates = v_safe;

    SELECT v_so_dong AS `Số khách đã sửa`;
  END IF;

  DROP TEMPORARY TABLE IF EXISTS tmp_lien_he_gia_20261106;
END$$
DELIMITER ;

CALL migrate_bo_lien_he_gia_20261106(@ap_dung);
DROP PROCEDURE IF EXISTS migrate_bo_lien_he_gia_20261106;
