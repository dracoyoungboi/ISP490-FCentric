-- ============================================================================
-- MIGRATION v1.4 — Logo thương hiệu & logo công ty lưu qua bảng tep_tin
-- ----------------------------------------------------------------------------
-- Trước đây: thuong_hieu.logo_url và thong_tin_cong_ty.logo_duong_dan lưu URL
-- MinIO trực tiếp (không có dòng tep_tin) -> không quản lý file chuẩn.
-- Nay: thêm cột tep_tin_id (FK -> tep_tin, ON DELETE SET NULL) cho cả 2 bảng.
-- Cột varchar cũ ĐƯỢC GIỮ (dormant, không drop) để an toàn cho SQL/report cũ.
--
-- Script IDEMPOTENT: chạy lại nhiều lần không lỗi (guard qua information_schema
-- + NOT EXISTS). CHẠY TRÊN DB CHIA SẺ MỘT LẦN TRƯỚC KHI DEPLOY BACKEND MỚI.
-- ============================================================================

USE fashion_system;

-- ── 1. thuong_hieu: thêm cột tep_tin_id + index + FK ───────────────────────
SET @db := DATABASE();
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'thuong_hieu' AND COLUMN_NAME = 'tep_tin_id');
SET @sql := IF(@col = 0,
    'ALTER TABLE `thuong_hieu`
       ADD COLUMN `tep_tin_id` INT NULL AFTER `logo_url`,
       ADD KEY `idx_thuong_hieu_tep_tin` (`tep_tin_id`),
       ADD CONSTRAINT `fk_thuong_hieu_tep_tin`
         FOREIGN KEY (`tep_tin_id`) REFERENCES `tep_tin`(`id`) ON DELETE SET NULL',
    'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 2. thong_tin_cong_ty: thêm cột tep_tin_id + index + FK ─────────────────
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'thong_tin_cong_ty' AND COLUMN_NAME = 'tep_tin_id');
SET @sql := IF(@col = 0,
    'ALTER TABLE `thong_tin_cong_ty`
       ADD COLUMN `tep_tin_id` INT NULL AFTER `logo_duong_dan`,
       ADD KEY `idx_cty_tep_tin` (`tep_tin_id`),
       ADD CONSTRAINT `fk_cty_tep_tin`
         FOREIGN KEY (`tep_tin_id`) REFERENCES `tep_tin`(`id`) ON DELETE SET NULL',
    'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 3. Migrate dữ liệu logo công ty hiện có sang tep_tin ───────────────────
-- Object MinIO ĐÃ tồn tại (URL cũ trỏ đúng object) -> chỉ tạo dòng tep_tin,
-- KHÔNG upload lại.
INSERT INTO `tep_tin` (`ten_tep_goc`, `ten_tai_len`, `ten_luu_tru`, `duong_dan`,
                       `loai_tep_tin`, `duoi_tep`, `trang_thai`, `ngay_tao`)
SELECT c.`logo_duong_dan`,
       c.`logo_duong_dan`,
       SUBSTRING_INDEX(c.`logo_duong_dan`, '/', -1),
       c.`logo_duong_dan`,
       'IMAGE',
       NULL,
       1,
       NOW()
FROM `thong_tin_cong_ty` c
WHERE c.`logo_duong_dan` IS NOT NULL
  AND c.`logo_duong_dan` <> ''
  AND NOT EXISTS (SELECT 1 FROM `tep_tin` t
                  WHERE t.`ten_luu_tru` = SUBSTRING_INDEX(c.`logo_duong_dan`, '/', -1));

UPDATE `thong_tin_cong_ty` c
LEFT JOIN `tep_tin` t ON t.`ten_luu_tru` = SUBSTRING_INDEX(c.`logo_duong_dan`, '/', -1)
SET c.`tep_tin_id` = t.`id`
WHERE c.`tep_tin_id` IS NULL
  AND c.`logo_duong_dan` IS NOT NULL
  AND c.`logo_duong_dan` <> ''
  AND t.`id` IS NOT NULL;

-- ── 4. Migrate dữ liệu logo thương hiệu hiện có (nếu có) sang tep_tin ───────
INSERT INTO `tep_tin` (`ten_tep_goc`, `ten_tai_len`, `ten_luu_tru`, `duong_dan`,
                       `loai_tep_tin`, `duoi_tep`, `trang_thai`, `ngay_tao`)
SELECT b.`logo_url`,
       b.`logo_url`,
       SUBSTRING_INDEX(b.`logo_url`, '/', -1),
       b.`logo_url`,
       'IMAGE',
       NULL,
       1,
       NOW()
FROM `thuong_hieu` b
WHERE b.`logo_url` IS NOT NULL
  AND b.`logo_url` <> ''
  AND NOT EXISTS (SELECT 1 FROM `tep_tin` t
                  WHERE t.`ten_luu_tru` = SUBSTRING_INDEX(b.`logo_url`, '/', -1));

UPDATE `thuong_hieu` b
LEFT JOIN `tep_tin` t ON t.`ten_luu_tru` = SUBSTRING_INDEX(b.`logo_url`, '/', -1)
SET b.`tep_tin_id` = t.`id`
WHERE b.`tep_tin_id` IS NULL
  AND b.`logo_url` IS NOT NULL
  AND b.`logo_url` <> ''
  AND t.`id` IS NOT NULL;
