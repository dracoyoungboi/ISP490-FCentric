-- =====================================================================
-- Nhật ký nghiệp vụ trên F Centric – 2026-11-05
--
-- Lịch sử thay đổi danh mục dữ liệu (người dùng, sản phẩm, giá bán, danh mục, thuộc tính, nhà cung cấp, kho, vị trí kệ,
-- khách hàng). ĐÃ CHẠY trên DB 05/11 — chỉ sửa chú thích, phần SQL giữ nguyên.
-- 1. lich_su_thay_doi.nguoi_thuc_hien_id cho phép trống: việc do hệ thống / job làm không có người đăng nhập (vd. đơn
--    sàn tự tạo khách hàng) — trước đây không ghi được dòng nào.
-- 2. Thêm cột nguon: ai / cái gì gây ra thay đổi — nguoi_dung (mặc định), he_thong, shopify, lazada, tiktok, shopee.
--    Dòng cũ để trống = người dùng.
-- 3. Thêm cột ma_doi_tuong: mã dễ đọc của đối tượng lúc ghi (mã sản phẩm, SKU, mã NCC, mã kho…); dòng cũ để trống.
-- 4. Chỉ mục (loai_tham_chieu, id_tham_chieu, ngay_thuc_hien) cho ngăn Lịch sử thay đổi.
--
-- THỨ TỰ: chạy tệp này TRƯỚC khi lên backend mới — kể cả backend chạy trên máy (localhost dùng chung DB thật).
-- Backend mới đọc / ghi cột nguon, ma_doi_tuong ở MỌI câu lệnh với lich_su_thay_doi; thiếu cột thì không chỉ thao tác
-- mới mà cả tính năng cũ cũng lỗi "Unknown column": chi tiết / danh sách phiếu chuyển kho, yêu cầu nhập hàng, lịch sử
-- mẫu in, đổi giá bán, phân quyền và job đồng bộ sàn.
-- Backend cũ vẫn chạy bình thường sau khi chạy tệp (không đọc cột mới, cột trống được phép).
-- Chạy lại nhiều lần không sao: bước nào đã có thì bỏ qua.
-- Cách chạy: Workbench chạy cả tệp (có DELIMITER); hoặc mysql --default-character-set=utf8mb4 fashion_system < tệp này.
-- =====================================================================

DROP PROCEDURE IF EXISTS migrate_nhat_ky_nghiep_vu_20261105;

DELIMITER $$
CREATE PROCEDURE migrate_nhat_ky_nghiep_vu_20261105()
BEGIN
  -- 1. Người thực hiện được phép trống
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = DATABASE() AND table_name = 'lich_su_thay_doi'
                AND column_name = 'nguoi_thuc_hien_id' AND is_nullable = 'NO') THEN
    ALTER TABLE lich_su_thay_doi MODIFY nguoi_thuc_hien_id INT NULL;
  END IF;

  -- 2. Cột nguồn
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = DATABASE() AND table_name = 'lich_su_thay_doi' AND column_name = 'nguon') THEN
    ALTER TABLE lich_su_thay_doi
      ADD COLUMN nguon VARCHAR(30) COLLATE utf8mb4_unicode_ci NULL
        COMMENT 'nguoi_dung / he_thong / shopify / lazada / tiktok / shopee / nha_cung_cap; trống = người dùng'
        AFTER nguoi_thuc_hien_id;
  END IF;

  -- 3. Mã đối tượng dễ đọc
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = DATABASE() AND table_name = 'lich_su_thay_doi' AND column_name = 'ma_doi_tuong') THEN
    ALTER TABLE lich_su_thay_doi
      ADD COLUMN ma_doi_tuong VARCHAR(100) COLLATE utf8mb4_unicode_ci NULL
        COMMENT 'Mã dễ đọc của đối tượng lúc ghi: số đơn, mã NCC, mã kho…'
        AFTER id_tham_chieu;
  END IF;

  -- 4. Chỉ mục cho lịch sử theo đối tượng
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics
                  WHERE table_schema = DATABASE() AND table_name = 'lich_su_thay_doi'
                    AND index_name = 'idx_lstd_tham_chieu') THEN
    CREATE INDEX idx_lstd_tham_chieu ON lich_su_thay_doi (loai_tham_chieu, id_tham_chieu, ngay_thuc_hien);
  END IF;
END$$
DELIMITER ;

CALL migrate_nhat_ky_nghiep_vu_20261105();
DROP PROCEDURE IF EXISTS migrate_nhat_ky_nghiep_vu_20261105;

-- Kiểm tra: phải thấy nguoi_thuc_hien_id YES, cột nguon, ma_doi_tuong, chỉ mục idx_lstd_tham_chieu
SELECT column_name, is_nullable, column_type FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'lich_su_thay_doi'
   AND column_name IN ('nguoi_thuc_hien_id', 'nguon', 'ma_doi_tuong');
SELECT DISTINCT index_name FROM information_schema.statistics
 WHERE table_schema = DATABASE() AND table_name = 'lich_su_thay_doi' AND index_name = 'idx_lstd_tham_chieu';
