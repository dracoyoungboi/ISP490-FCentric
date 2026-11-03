-- =====================================================================
-- Đối soát số tồn theo kệ (ton_kho_vi_tri) trên F Centric – 2026-11-03
--
-- Kiểm kê khoanh vùng chốt số tồn theo từng cặp kệ–lô từ ton_kho_vi_tri (chốt Đ2, PA 1). Trước bản này bảng chỉ được
-- cộng khi nhập hàng, không luồng nào trừ, nên một số dòng cao hơn tồn thật (dump 03/11: 4 dòng, vd. kệ 4 lô 98 ghi 100
-- trong khi Kho tổng còn 0). Backend mới cộng / trừ bảng này ở mọi luồng đổi tồn; tệp này đưa số cũ về đúng một lần:
--   - Lô có kệ (lo_hang.vi_tri_kho_id): số trên kệ = tồn của lô ở đúng kho của kệ (phần lẻ bỏ đi).
--   - Dòng của kệ không phải kệ của lô: không vượt tồn của lô ở kho đó.
-- Phần tồn của lô không nằm trên kệ nào là "hàng chưa có kệ" (vd. 93 cái lô 98 ở Cửa hàng Hà Nội): xếp kệ trên màn
-- Kiểm kê › Hàng chưa có kệ.
--
-- THỨ TỰ: chạy NGAY SAU migration-2026-11-03-kiem-ke-khoanh-vung.sql và TRƯỚC khi bật backend mới. Không chạy lại sau
-- khi backend mới đã chạy (bước kiểm tra dừng nếu đã có đợt kiểm kê theo luồng mới).
-- Bước 1 chỉ đọc, xem trước các dòng sẽ đổi. Bước 2 ghi trong một giao dịch.
-- =====================================================================

SET NAMES utf8mb4;
USE fashion_system;          -- đổi nếu CSDL của bạn tên khác
-- MySQL Workbench bật sẵn "Safe Updates": UPDATE có JOIN không lọc theo cột khóa bị chặn, Error 1175. Tắt cho riêng phiên
-- chạy tệp này; sau bước 2 trả lại như cũ.
SET @safe_updates_truoc = @@SESSION.sql_safe_updates;
SET SESSION sql_safe_updates = 0;

-- ===== 1. Xem trước (chỉ đọc) =====
SELECT v.kho_id, v.ma_vi_tri, t.lo_hang_id, l.ma_lo, t.so_luong AS so_tren_ke_cu,
       FLOOR(COALESCE(k.so_luong_ton, 0)) AS ton_lo_o_kho,
       CASE WHEN l.vi_tri_kho_id = t.vi_tri_kho_id THEN FLOOR(COALESCE(k.so_luong_ton, 0))
            ELSE LEAST(t.so_luong, FLOOR(COALESCE(k.so_luong_ton, 0))) END AS so_tren_ke_moi
FROM ton_kho_vi_tri t
JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id
JOIN lo_hang l ON l.id = t.lo_hang_id
LEFT JOIN ton_kho_theo_lo k ON k.lo_hang_id = t.lo_hang_id AND k.kho_id = v.kho_id
WHERE t.so_luong <> CASE WHEN l.vi_tri_kho_id = t.vi_tri_kho_id THEN FLOOR(COALESCE(k.so_luong_ton, 0))
                         ELSE LEAST(t.so_luong, FLOOR(COALESCE(k.so_luong_ton, 0))) END
ORDER BY v.kho_id, v.ma_vi_tri, t.lo_hang_id;

-- Lô có kệ mà chưa có dòng ton_kho_vi_tri (sẽ thêm)
SELECT v.kho_id, v.ma_vi_tri, l.id AS lo_hang_id, l.ma_lo, FLOOR(k.so_luong_ton) AS so_tren_ke_moi
FROM lo_hang l
JOIN vi_tri_kho v ON v.id = l.vi_tri_kho_id
JOIN ton_kho_theo_lo k ON k.lo_hang_id = l.id AND k.kho_id = v.kho_id
LEFT JOIN ton_kho_vi_tri t ON t.vi_tri_kho_id = l.vi_tri_kho_id AND t.lo_hang_id = l.id
WHERE t.id IS NULL AND k.so_luong_ton >= 1;

DROP PROCEDURE IF EXISTS doi_soat_ton_theo_ke_20261103;

DELIMITER $$
CREATE PROCEDURE doi_soat_ton_theo_ke_20261103()
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = DATABASE() AND table_name = 'ton_kho_vi_tri' AND column_name = 'dang_kiem_ke') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chay migration-2026-11-03-kiem-ke-khoanh-vung.sql truoc';
  END IF;
  IF EXISTS (SELECT 1 FROM dot_kiem_ke_vi_tri) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Da co dot kiem ke theo luong moi: khong doi soat lai';
  END IF;
  -- Một lô nằm trên hai kệ cùng kho: không tự chia được, cần xem tay
  IF EXISTS (SELECT 1 FROM ton_kho_vi_tri t JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id
             WHERE t.so_luong > 0 GROUP BY t.lo_hang_id, v.kho_id HAVING COUNT(*) > 1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Co lo nam tren hai ke cung kho: doi soat tay truoc';
  END IF;

  START TRANSACTION;

  UPDATE ton_kho_vi_tri t
  JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id
  JOIN lo_hang l ON l.id = t.lo_hang_id
  LEFT JOIN ton_kho_theo_lo k ON k.lo_hang_id = t.lo_hang_id AND k.kho_id = v.kho_id
  SET t.so_luong = CASE WHEN l.vi_tri_kho_id = t.vi_tri_kho_id THEN FLOOR(COALESCE(k.so_luong_ton, 0))
                        ELSE LEAST(t.so_luong, FLOOR(COALESCE(k.so_luong_ton, 0))) END
  WHERE t.so_luong <> CASE WHEN l.vi_tri_kho_id = t.vi_tri_kho_id THEN FLOOR(COALESCE(k.so_luong_ton, 0))
                           ELSE LEAST(t.so_luong, FLOOR(COALESCE(k.so_luong_ton, 0))) END;

  INSERT INTO ton_kho_vi_tri (vi_tri_kho_id, lo_hang_id, bien_the_san_pham_id, so_luong)
  SELECT l.vi_tri_kho_id, l.id, l.bien_the_san_pham_id, FLOOR(k.so_luong_ton)
  FROM lo_hang l
  JOIN vi_tri_kho v ON v.id = l.vi_tri_kho_id
  JOIN ton_kho_theo_lo k ON k.lo_hang_id = l.id AND k.kho_id = v.kho_id
  LEFT JOIN ton_kho_vi_tri t ON t.vi_tri_kho_id = l.vi_tri_kho_id AND t.lo_hang_id = l.id
  WHERE t.id IS NULL AND k.so_luong_ton >= 1;

  -- Chốt an toàn trước khi ghi hẳn: tổng trên kệ của mỗi lô ở mỗi kho không vượt tồn lô, không âm. Vd. kệ của lô ghi 0
  -- (hoặc chưa có dòng) trong khi một kệ khác cùng kho đang giữ hàng: bước trên gán đủ tồn cho kệ của lô, cộng với kệ
  -- kia thành gấp đôi. Gặp thì hoàn tác cả bước 2 để đối soát tay.
  IF EXISTS (SELECT 1 FROM ton_kho_vi_tri t
             JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id
             LEFT JOIN ton_kho_theo_lo k ON k.lo_hang_id = t.lo_hang_id AND k.kho_id = v.kho_id
             GROUP BY v.kho_id, t.lo_hang_id
             HAVING SUM(t.so_luong) > FLOOR(COALESCE(MAX(k.so_luong_ton), 0)) OR MIN(t.so_luong) < 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tong tren ke vuot ton lo sau doi soat: da hoan tac, doi soat tay (xem buoc 3)';
  END IF;

  COMMIT;
  SELECT 'OK - Da doi soat ton theo ke' AS ket_qua;
END$$
DELIMITER ;

CALL doi_soat_ton_theo_ke_20261103();
DROP PROCEDURE doi_soat_ton_theo_ke_20261103;
SET SESSION sql_safe_updates = @safe_updates_truoc;

-- ===== 3. Đối chiếu sau khi chạy (chỉ đọc): tổng trên kệ không vượt tồn lô, không âm =====
SELECT v.kho_id, t.lo_hang_id, SUM(t.so_luong) AS tong_tren_ke, COALESCE(MAX(k.so_luong_ton), 0) AS ton_lo
FROM ton_kho_vi_tri t
JOIN vi_tri_kho v ON v.id = t.vi_tri_kho_id
LEFT JOIN ton_kho_theo_lo k ON k.lo_hang_id = t.lo_hang_id AND k.kho_id = v.kho_id
GROUP BY v.kho_id, t.lo_hang_id
HAVING SUM(t.so_luong) > COALESCE(MAX(k.so_luong_ton), 0) OR MIN(t.so_luong) < 0;
