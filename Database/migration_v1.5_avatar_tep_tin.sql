-- ============================================================================
-- MIGRATION v1.5 — Ảnh đại diện người dùng lưu qua bảng tep_tin
-- ----------------------------------------------------------------------------
-- Thêm cột avatar_tep_tin_id (FK -> tep_tin, ON DELETE SET NULL) cho nguoi_dung,
-- chuẩn quản lý tệp giống logo thương hiệu & logo công ty (migration v1.4).
-- Chỉ THÊM CỘT MỚI, không đổi dữ liệu cũ: tài khoản chưa có ảnh vẫn hoạt động
-- bình thường (null -> FE hiển thị initials).
--
-- Script IDEMPOTENT: chạy lại nhiều lần không lỗi (guard qua information_schema
-- + NOT EXISTS). CHẠY TRÊN DB CHIA SẺ MỘT LẦN TRƯỚC KHI DEPLOY BACKEND MỚI.
-- ============================================================================

USE fashion_system;

-- ── 1. nguoi_dung: thêm cột avatar_tep_tin_id + index + FK ──────────────────
SET @db := DATABASE();
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'nguoi_dung' AND COLUMN_NAME = 'avatar_tep_tin_id');
SET @sql := IF(@col = 0,
    'ALTER TABLE `nguoi_dung`
       ADD COLUMN `avatar_tep_tin_id` INT NULL AFTER `must_change_password`,
       ADD KEY `idx_nguoi_dung_avatar_tep_tin` (`avatar_tep_tin_id`),
       ADD CONSTRAINT `fk_nguoi_dung_avatar_tep_tin`
         FOREIGN KEY (`avatar_tep_tin_id`) REFERENCES `tep_tin`(`id`) ON DELETE SET NULL',
    'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
