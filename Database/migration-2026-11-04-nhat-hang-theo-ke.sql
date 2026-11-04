-- =====================================================================
-- Nhặt hàng theo kệ trên F Centric – 2026-11-04
--
-- Phiếu nhặt chia phần phân bổ lô ra từng kệ (kiểm kê khoanh vùng mục 8.2): phần ở kệ ghi trong
-- phan_bo_lo_nhat_hang_vi_tri, phần còn lại lấy ở hàng chưa có kệ (không ghi dòng). Tệp này thêm cột đánh dấu
-- phan_bo_lo_nhat_hang.chia_ke để phân biệt hai trường hợp không có dòng kệ:
--   1 = phân bổ do backend mới chia kệ: không có dòng kệ nghĩa là lấy ở hàng chưa có kệ. Cờ giữ nguyên khi xuất kho
--       giảm dần các dòng kệ, nên phiếu xuất cuối cùng của phiếu nhặt vẫn trừ đúng chỗ.
--   0 = phân bổ đang có / do backend cũ ghi: chưa biết kệ. Xuất kho trừ theo thứ tự kệ như trước, Bắt đầu kiểm kê chặn
--       theo lô (chốt Đ4: không tự điền kệ cho phân bổ cũ).
--
-- ĐIỀU KIỆN: đã chạy migration-2026-11-03-kiem-ke-khoanh-vung.sql (có bảng phan_bo_lo_nhat_hang_vi_tri).
-- THỨ TỰ KHI TRIỂN KHAI: tệp này → backend mới → frontend mới. Không cần dừng backend: chỉ thêm một cột có giá trị mặc
-- định (MySQL 8 thêm tức thì, không chép lại bảng). Backend mới lên trước tệp này vẫn chạy, phiếu nhặt chưa chia kệ như
-- cũ cho tới khi thấy cột (kiểm lại mỗi 30 giây). Backend cũ (máy cá nhân) không đọc cột này, ghi phân bổ thì cột nhận
-- 0 = chưa biết kệ.
--
-- CHẠY MỘT LẦN. Chạy lại sẽ dừng ở bước kiểm tra và không đổi gì.
-- Cách chạy: mysql --default-character-set=utf8mb4 fashion_system < tệp này; Workbench: chạy cả tệp (có DELIMITER).
-- =====================================================================

DROP PROCEDURE IF EXISTS migrate_nhat_hang_theo_ke_20261104;

DELIMITER $$
CREATE PROCEDURE migrate_nhat_hang_theo_ke_20261104()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = DATABASE() AND table_name = 'phan_bo_lo_nhat_hang_vi_tri') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chua chay migration-2026-11-03-kiem-ke-khoanh-vung.sql';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = DATABASE() AND table_name = 'phan_bo_lo_nhat_hang' AND column_name = 'chia_ke') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cot phan_bo_lo_nhat_hang.chia_ke da co: migration nay da chay';
  END IF;

  ALTER TABLE phan_bo_lo_nhat_hang
    ADD COLUMN chia_ke TINYINT(1) NOT NULL DEFAULT 0
      COMMENT '1 = da chia ke (phan_bo_lo_nhat_hang_vi_tri, phan con lai o hang chua co ke); 0 = chua biet ke';
END$$
DELIMITER ;

CALL migrate_nhat_hang_theo_ke_20261104();
DROP PROCEDURE migrate_nhat_hang_theo_ke_20261104;

-- Kiểm tra: phải ra một dòng chia_ke tinyint(1) NOT NULL DEFAULT 0
SHOW COLUMNS FROM phan_bo_lo_nhat_hang LIKE 'chia_ke';
