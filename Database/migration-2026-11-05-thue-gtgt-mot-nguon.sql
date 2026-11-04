-- =====================================================================
-- Thuế GTGT một nguồn trên F Centric – 2026-11-05
--
-- Từ bản này hóa đơn bán hàng lấy thuế suất từ bảng thue_suat_gtgt (mức chung) — cùng bảng xuất kế toán dùng — thay cho
-- cấu hình VAT_LICH (bỏ, hàng cấu hình cũ để nguyên trong cau_hinh_he_thong, không còn đọc). Lịch VAT_LICH cũ đã đặt 10%
-- từ 15/07/2026 trong khi mức đúng là 8% tới hết 31/12/2026 (NQ 204/2025), nên một số đơn đã ghi 10%.
--
-- Tệp này đưa thuế đã ghi trên đơn (don_ban_hang.thue_suat_gtgt, tien_thue_gtgt) về đúng mức chung của bảng ở ngày
-- giao hàng (chưa giao thì ngày tạo đơn). Chỉ đơn ĐANG mang thuế; đơn không mang thuế (tắt in thuế, đơn sàn) không đụng.
-- Giá đã gồm thuế nên tổng tiền không đổi, chỉ đổi phần tách thuế khi in lại hóa đơn. Chứng từ đã giao kế toán lưu tệp
-- riêng, không đổi. Ngày nào bảng chưa có mức chung thì giữ nguyên đơn đó.
--
-- THỨ TỰ: backend mới → tệp này (backend cũ còn chạy sẽ lại ghi thuế theo VAT_LICH cũ). Không cần dừng backend.
-- MẶC ĐỊNH CHỈ XEM TRƯỚC: chạy cả tệp sẽ in danh sách đơn sẽ sửa, không đổi gì. Muốn sửa thật: đổi dòng
--   SET @ap_dung = 0;  thành  SET @ap_dung = 1;  rồi chạy lại cả tệp.
-- Sửa thật thì giá trị cũ chép vào bảng bk_thue_don_ban_20261105 trước. Hoàn tác:
--   UPDATE don_ban_hang d JOIN bk_thue_don_ban_20261105 b ON b.id = d.id
--      SET d.thue_suat_gtgt = b.thue_suat_gtgt, d.tien_thue_gtgt = b.tien_thue_gtgt;
-- Chạy lại khi bảng sao lưu đã có sẽ dừng, không đổi gì (xóa bảng sao lưu nếu thật sự muốn chạy lần nữa); khi dừng như vậy
-- thủ tục tạm còn lại, dọn bằng: DROP PROCEDURE IF EXISTS migrate_thue_gtgt_mot_nguon_20261105;
-- Cách chạy: Workbench chạy cả tệp (có DELIMITER); hoặc mysql --default-character-set=utf8mb4 fashion_system < tệp này.
-- =====================================================================

SET @ap_dung = 0;

-- Ngày giao / ngày tạo là TIMESTAMP: tính ngày theo giờ Việt Nam như backend (Workbench / mysql mặc định có thể là UTC)
SET @mui_gio_cu = @@SESSION.time_zone;
SET SESSION time_zone = '+07:00';

DROP PROCEDURE IF EXISTS migrate_thue_gtgt_mot_nguon_20261105;

DELIMITER $$
CREATE PROCEDURE migrate_thue_gtgt_mot_nguon_20261105(IN p_ap_dung INT)
BEGIN
  DECLARE v_safe INT DEFAULT @@SESSION.sql_safe_updates;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = DATABASE() AND table_name = 'thue_suat_gtgt') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chua co bang thue_suat_gtgt: chay migration-2026-10-26-xuat-ke-toan.sql truoc';
  END IF;

  IF p_ap_dung = 1 AND EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = DATABASE() AND table_name = 'bk_thue_don_ban_20261105') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bang bk_thue_don_ban_20261105 da co: tep nay da chay that';
  END IF;

  DROP TEMPORARY TABLE IF EXISTS tmp_thue_dung_20261105;
  CREATE TEMPORARY TABLE tmp_thue_dung_20261105 AS
  SELECT x.id, x.so_don_hang, x.ngay_tinh, x.tong_cong, x.thue_cu, x.tien_thue_cu, x.thue_moi,
         IF(x.tong_cong IS NULL OR x.thue_moi = 0, 0, ROUND(x.tong_cong * x.thue_moi / (100 + x.thue_moi), 0)) AS tien_thue_moi
    FROM (SELECT d.id, d.so_don_hang, DATE(COALESCE(d.ngay_giao_hang, d.ngay_tao)) AS ngay_tinh, d.tong_cong,
                 d.thue_suat_gtgt AS thue_cu, d.tien_thue_gtgt AS tien_thue_cu,
                 (SELECT t.ty_le FROM thue_suat_gtgt t
                   WHERE t.danh_muc_id IS NULL
                     AND t.hieu_luc_tu <= DATE(COALESCE(d.ngay_giao_hang, d.ngay_tao))
                     AND (t.hieu_luc_den IS NULL OR t.hieu_luc_den >= DATE(COALESCE(d.ngay_giao_hang, d.ngay_tao)))
                   ORDER BY t.hieu_luc_tu DESC LIMIT 1) AS thue_moi
            FROM don_ban_hang d
           WHERE d.thue_suat_gtgt IS NOT NULL) x
   WHERE x.thue_moi IS NOT NULL
     AND (x.thue_moi <> x.thue_cu
          OR x.tien_thue_cu IS NULL
          OR x.tien_thue_cu <> IF(x.tong_cong IS NULL OR x.thue_moi = 0, 0, ROUND(x.tong_cong * x.thue_moi / (100 + x.thue_moi), 0)));

  -- Danh sách đơn sẽ sửa (xem trước) / đã sửa
  SELECT so_don_hang AS `Số đơn`, ngay_tinh AS `Ngày tính thuế`, tong_cong AS `Tổng cộng`,
         thue_cu AS `Thuế cũ %`, tien_thue_cu AS `Tiền thuế cũ`, thue_moi AS `Thuế mới %`, tien_thue_moi AS `Tiền thuế mới`
    FROM tmp_thue_dung_20261105 ORDER BY ngay_tinh, so_don_hang;

  IF p_ap_dung = 1 THEN
    CREATE TABLE bk_thue_don_ban_20261105 AS
    SELECT d.id, d.so_don_hang, d.thue_suat_gtgt, d.tien_thue_gtgt
      FROM don_ban_hang d JOIN tmp_thue_dung_20261105 t ON t.id = d.id AND d.tong_cong <=> t.tong_cong;

    SET SESSION sql_safe_updates = 0;
    -- tong_cong <=>: bỏ qua đơn vừa bị sửa tổng tiền trong lúc chạy (backend không cần dừng)
    UPDATE don_ban_hang d JOIN tmp_thue_dung_20261105 t ON t.id = d.id AND d.tong_cong <=> t.tong_cong
       SET d.thue_suat_gtgt = t.thue_moi, d.tien_thue_gtgt = t.tien_thue_moi;
    SET SESSION sql_safe_updates = v_safe;

    SELECT CONCAT('DA SUA ', COUNT(*), ' don; gia tri cu o bk_thue_don_ban_20261105') AS `Kết quả` FROM bk_thue_don_ban_20261105;
  ELSE
    SELECT CONCAT('XEM TRUOC: ', COUNT(*), ' don se sua. Doi SET @ap_dung = 1 roi chay lai de sua that') AS `Kết quả`
      FROM tmp_thue_dung_20261105;
  END IF;

  DROP TEMPORARY TABLE tmp_thue_dung_20261105;
END$$
DELIMITER ;

CALL migrate_thue_gtgt_mot_nguon_20261105(@ap_dung);
DROP PROCEDURE migrate_thue_gtgt_mot_nguon_20261105;
SET SESSION time_zone = @mui_gio_cu;

-- Kiểm tra sau khi sửa thật: mọi đơn mang thuế khớp mức chung của bảng (phải ra 0)
-- SELECT COUNT(*) FROM don_ban_hang d
--  WHERE d.thue_suat_gtgt IS NOT NULL
--    AND d.thue_suat_gtgt <> (SELECT t.ty_le FROM thue_suat_gtgt t WHERE t.danh_muc_id IS NULL
--          AND t.hieu_luc_tu <= DATE(COALESCE(d.ngay_giao_hang, d.ngay_tao))
--          AND (t.hieu_luc_den IS NULL OR t.hieu_luc_den >= DATE(COALESCE(d.ngay_giao_hang, d.ngay_tao)))
--        ORDER BY t.hieu_luc_tu DESC LIMIT 1);
