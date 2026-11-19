-- =====================================================================
-- Chỉ bán lẻ: bỏ báo giá bán, khách sỉ / doanh nghiệp – 2026-11-19
--
-- Hệ thống thôi bán buôn. Backend mới đã bỏ báo giá bán (tạo, chốt thành đơn, từ chối), luật giá thỏa thuận 90–110%,
-- loại khách hàng, mã số thuế và người liên hệ của khách. Tệp này dọn dữ liệu mà code mới không còn đọc:
--   1. Xóa báo giá bán (don_ban_hang.loai_chung_tu = 'bao_gia') và dòng hàng của chúng. Đơn bán đã chốt từ báo giá
--      (SO…) giữ nguyên: là đơn thật, có phiếu xuất và thanh toán.
--   2. Xóa cấu hình mẫu in "Báo giá bán" (sales_quotation) ở cau_hinh_mau_in và mau_in_dang_ap_dung.
--   3. Đặt loai_khach_hang = 'le' cho khách sỉ / doanh nghiệp / chưa phân loại (cột giữ lại tới khi xóa cột, xem
--      migration-2026-11-19-chi-ban-le-xoa-cot.sql).
-- Dump production 19/11: 3 báo giá (không còn báo giá chờ khách), 1 mẫu in báo giá, 6 khách cần đặt lại loại.
--
-- THỨ TỰ: backend + frontend mới → tệp này. Backend cũ còn chạy (VPS hoặc localhost, chung một CSDL) vẫn tạo được
-- báo giá mới, nên lên bản mới hết rồi mới chạy. Không cần dừng backend.
-- MẶC ĐỊNH CHỈ XEM TRƯỚC: chạy cả tệp sẽ in những gì sẽ xóa / sửa, không đổi gì. Muốn làm thật: đổi dòng
--   SET @ap_dung = 0;  thành  SET @ap_dung = 1;  rồi chạy lại cả tệp.
-- Báo giá còn chứng từ khác trỏ tới (phiếu xuất, thanh toán, đơn tại quầy, trả hàng, bằng chứng đóng gói) thì dừng,
-- không xóa gì: báo giá như vậy là dữ liệu lỗi, cần xem tay.
-- Làm thật thì chép dữ liệu cũ vào các bảng bk_*_20261119 trước, rồi xóa / sửa trong một giao dịch: lỗi giữa chừng
-- (vd. chờ khóa quá lâu) thì dữ liệu hoàn tác hết nhưng 5 bảng bk_*_20261119 vẫn còn. Khi đó kiểm
--   SELECT COUNT(*) FROM don_ban_hang WHERE loai_chung_tu = 'bao_gia';
-- còn báo giá thì DROP 5 bảng bk_*_20261119 rồi chạy lại. Hoàn tác sau khi đã chạy xong:
--   INSERT INTO don_ban_hang SELECT * FROM bk_bao_gia_ban_20261119;
--   INSERT INTO chi_tiet_don_ban_hang (id, don_ban_hang_id, bien_the_san_pham_id, so_luong_dat, so_luong_da_giao, don_gia,
--          ghi_chu, tien_giam_gia)
--     SELECT id, don_ban_hang_id, bien_the_san_pham_id, so_luong_dat, so_luong_da_giao, don_gia, ghi_chu, tien_giam_gia
--       FROM bk_ct_bao_gia_ban_20261119;
--   INSERT INTO cau_hinh_mau_in SELECT * FROM bk_cau_hinh_mau_in_bao_gia_20261119;
--   INSERT INTO mau_in_dang_ap_dung SELECT * FROM bk_mau_in_dang_ap_dung_bao_gia_20261119;
--   UPDATE khach_hang k JOIN bk_loai_khach_20261119 b ON b.id = k.id SET k.loai_khach_hang = b.loai_khach_hang;
-- (chi_tiet_don_ban_hang.thanh_tien là cột tự tính nên không chép vào.)
-- Chạy thật lần hai khi bảng sao lưu đã có sẽ dừng, không đổi gì. Tệp dừng ở bất kỳ bước nào thì thủ tục tạm còn lại,
-- dọn bằng:
--   DROP PROCEDURE IF EXISTS migrate_chi_ban_le_20261119;
-- Cách chạy: Workbench chạy cả tệp (có DELIMITER); hoặc mysql --default-character-set=utf8mb4 fashion_system < tệp này.
-- =====================================================================

SET NAMES utf8mb4;
SET @ap_dung = 0;

DROP PROCEDURE IF EXISTS migrate_chi_ban_le_20261119;

DELIMITER $$
CREATE PROCEDURE migrate_chi_ban_le_20261119(IN p_ap_dung INT)
BEGIN
  DECLARE v_safe INT DEFAULT @@SESSION.sql_safe_updates;
  DECLARE v_bao_gia INT DEFAULT 0;
  DECLARE v_dong_hang INT DEFAULT 0;
  DECLARE v_mau_in INT DEFAULT 0;
  DECLARE v_khach INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET SESSION sql_safe_updates = v_safe;
    RESIGNAL;
  END;

  IF p_ap_dung = 1 AND EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = DATABASE() AND table_name = 'bk_bao_gia_ban_20261119') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bang bk_bao_gia_ban_20261119 da co: tep nay da chay that';
  END IF;

  DROP TEMPORARY TABLE IF EXISTS tmp_bao_gia_20261119;
  CREATE TEMPORARY TABLE tmp_bao_gia_20261119 (PRIMARY KEY (id)) AS
  SELECT d.id FROM don_ban_hang d WHERE d.loai_chung_tu = 'bao_gia';

  -- 1. Báo giá sẽ xóa
  SELECT d.so_don_hang AS `Báo giá`, kh.ten_khach_hang AS `Khách hàng`,
         CASE d.trang_thai WHEN 0 THEN 'Chờ phản hồi' WHEN 2 THEN 'Đã chốt đơn' WHEN 4 THEN 'Bị từ chối'
              ELSE CONCAT('Mã ', d.trang_thai) END AS `Trạng thái`,
         d.tong_cong AS `Tổng tiền`,
         (SELECT COUNT(*) FROM chi_tiet_don_ban_hang ct WHERE ct.don_ban_hang_id = d.id) AS `Số dòng hàng`
    FROM don_ban_hang d
    JOIN tmp_bao_gia_20261119 t ON t.id = d.id
    LEFT JOIN khach_hang kh ON kh.id = d.khach_hang_id
   ORDER BY d.id;

  -- Báo giá còn chứng từ khác trỏ tới: liệt kê rồi dừng, không xóa gì
  DROP TEMPORARY TABLE IF EXISTS tmp_vuong_20261119;
  CREATE TEMPORARY TABLE tmp_vuong_20261119 AS
  SELECT d.so_don_hang,
         (SELECT COUNT(*) FROM phieu_xuat_kho x WHERE x.don_ban_hang_id = d.id) AS phieu_xuat,
         (SELECT COUNT(*) FROM thanh_toan_don_ban x WHERE x.don_ban_hang_id = d.id) AS thanh_toan,
         (SELECT COUNT(*) FROM pos_payment x WHERE x.don_ban_hang_id = d.id)
           + (SELECT COUNT(*) FROM pos_payos_payment x WHERE x.don_ban_hang_id = d.id)
           + (SELECT COUNT(*) FROM pos_checkout_request x WHERE x.don_ban_hang_id = d.id) AS tai_quay,
         (SELECT COUNT(*) FROM phieu_tra_hang x WHERE x.don_ban_hang_id = d.id)
           + (SELECT COUNT(*) FROM yeu_cau_duyet_tra_hang x WHERE x.don_ban_hang_id = d.id) AS tra_hang,
         (SELECT COUNT(*) FROM bang_chung_dong_goi x WHERE x.don_ban_hang_id = d.id) AS bang_chung
    FROM don_ban_hang d
    JOIN tmp_bao_gia_20261119 t ON t.id = d.id;
  SET SESSION sql_safe_updates = 0;
  DELETE FROM tmp_vuong_20261119 WHERE phieu_xuat + thanh_toan + tai_quay + tra_hang + bang_chung = 0;
  SET SESSION sql_safe_updates = v_safe;
  IF EXISTS (SELECT 1 FROM tmp_vuong_20261119) THEN
    SELECT so_don_hang AS `Báo giá còn chứng từ trỏ tới`, phieu_xuat AS `Phiếu xuất`, thanh_toan AS `Thanh toán`,
           tai_quay AS `Bán tại quầy`, tra_hang AS `Trả hàng`, bang_chung AS `Bằng chứng đóng gói`
      FROM tmp_vuong_20261119;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Co bao gia con chung tu khac tro toi (xem bang ket qua): dung, khong xoa gi';
  END IF;
  DROP TEMPORARY TABLE IF EXISTS tmp_vuong_20261119;

  -- 2. Mẫu in báo giá bán sẽ xóa
  SELECT 'cau_hinh_mau_in' AS `Bảng`, template_id AS `Mẫu` FROM cau_hinh_mau_in WHERE document_type = 'sales_quotation'
  UNION ALL
  SELECT 'mau_in_dang_ap_dung', template_id FROM mau_in_dang_ap_dung WHERE document_type = 'sales_quotation';

  -- 3. Khách sẽ đặt lại loại khách lẻ
  SELECT ma_khach_hang AS `Mã khách`, ten_khach_hang AS `Tên khách`,
         COALESCE(loai_khach_hang, '(chưa phân loại)') AS `Loại cũ`, 'le' AS `Loại mới`
    FROM khach_hang
   WHERE loai_khach_hang IS NULL OR loai_khach_hang <> 'le'
   ORDER BY id;

  IF p_ap_dung = 1 THEN
    -- Sao lưu trước (CREATE TABLE tự kết thúc giao dịch nên làm ngoài giao dịch)
    CREATE TABLE bk_bao_gia_ban_20261119 AS
    SELECT d.* FROM don_ban_hang d JOIN tmp_bao_gia_20261119 t ON t.id = d.id;
    CREATE TABLE bk_ct_bao_gia_ban_20261119 AS
    SELECT ct.* FROM chi_tiet_don_ban_hang ct JOIN tmp_bao_gia_20261119 t ON t.id = ct.don_ban_hang_id;
    CREATE TABLE bk_cau_hinh_mau_in_bao_gia_20261119 AS
    SELECT * FROM cau_hinh_mau_in WHERE document_type = 'sales_quotation';
    CREATE TABLE bk_mau_in_dang_ap_dung_bao_gia_20261119 AS
    SELECT * FROM mau_in_dang_ap_dung WHERE document_type = 'sales_quotation';
    CREATE TABLE bk_loai_khach_20261119 AS
    SELECT id, ma_khach_hang, loai_khach_hang FROM khach_hang WHERE loai_khach_hang IS NULL OR loai_khach_hang <> 'le';

    SET SESSION sql_safe_updates = 0;
    START TRANSACTION;
    DELETE ct FROM chi_tiet_don_ban_hang ct JOIN tmp_bao_gia_20261119 t ON t.id = ct.don_ban_hang_id;
    -- Lấy ngay sau mỗi câu: câu kế tiếp đặt lại ROW_COUNT()
    SET v_dong_hang = ROW_COUNT();
    DELETE d FROM don_ban_hang d JOIN tmp_bao_gia_20261119 t ON t.id = d.id;
    SET v_bao_gia = ROW_COUNT();
    DELETE FROM cau_hinh_mau_in WHERE document_type = 'sales_quotation';
    SET v_mau_in = ROW_COUNT();
    DELETE FROM mau_in_dang_ap_dung WHERE document_type = 'sales_quotation';
    SET v_mau_in = v_mau_in + ROW_COUNT();
    UPDATE khach_hang SET loai_khach_hang = 'le' WHERE loai_khach_hang IS NULL OR loai_khach_hang <> 'le';
    SET v_khach = ROW_COUNT();
    COMMIT;
    SET SESSION sql_safe_updates = v_safe;

    SELECT v_bao_gia AS `Báo giá đã xóa`, v_dong_hang AS `Dòng hàng đã xóa`, v_mau_in AS `Dòng mẫu in đã xóa`,
           v_khach AS `Khách đã đặt lại loại`;
  END IF;

  DROP TEMPORARY TABLE IF EXISTS tmp_bao_gia_20261119;
END$$
DELIMITER ;

CALL migrate_chi_ban_le_20261119(@ap_dung);
DROP PROCEDURE IF EXISTS migrate_chi_ban_le_20261119;
