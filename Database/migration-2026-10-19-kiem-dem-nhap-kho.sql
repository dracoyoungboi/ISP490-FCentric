-- =====================================================================
-- Kiểm đếm & khóa lô nhập hàng – 2026-10-19
--   1. Bảng chi_tiet_loi_lo_hang: hàng không đạt theo lý do của từng lô.
--      Biên bản trả hàng nhà cung cấp lấy dòng từ bảng này (trước đây lấy từ trình duyệt của người kiểm).
--   2. Cột ma_vach_nha_cung_cap.nguoi_lien_ket_id: người xác nhận liên kết mã vạch NCC lúc kiểm đếm.
--   3. Cấu hình KIEM_DEM_XAC_NHAN: cách xác nhận chất lượng khi kiểm đếm.
--
-- Máy chủ tự chạy phần 1, 2 lúc khởi động (InboundTableInitializer) và tự nạp phần 3 (DieuHanhHeThongServiceImpl).
-- File này để chạy tay khi cần (ví dụ CSDL dùng chung của nhóm). Chạy nhiều lần vẫn an toàn.
-- =====================================================================
SET NAMES utf8mb4;

-- 1. Hàng không đạt theo lý do của từng lô
CREATE TABLE IF NOT EXISTS chi_tiet_loi_lo_hang (
    id         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    lo_hang_id INT          NOT NULL,
    ly_do      VARCHAR(50)  NOT NULL COMMENT 'Lý do không đạt, VD Bung chỉ, Rách vải',
    so_luong   INT          NOT NULL COMMENT 'Số sản phẩm không đạt vì lý do này',
    ghi_chu    VARCHAR(255) NULL,
    ngay_tao   TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ctllh_lo (lo_hang_id),
    CONSTRAINT fk_ctllh_lo_hang FOREIGN KEY (lo_hang_id) REFERENCES lo_hang (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Người liên kết mã vạch NCC. MySQL 8 không có ADD COLUMN IF NOT EXISTS nên kiểm information_schema trước.
SET @co_cot = (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ma_vach_nha_cung_cap' AND COLUMN_NAME = 'nguoi_lien_ket_id');
SET @sql = IF(@co_cot = 0,
    'ALTER TABLE ma_vach_nha_cung_cap ADD COLUMN nguoi_lien_ket_id INT NULL',
    'SELECT 1');
PREPARE lenh FROM @sql;
EXECUTE lenh;
DEALLOCATE PREPARE lenh;

-- 3. Cấu hình (chỉ nạp khi chưa có, không ghi đè giá trị quản trị viên đã chọn)
INSERT IGNORE INTO cau_hinh_he_thong (ma_cau_hinh, gia_tri, kieu_du_lieu, mo_ta)
VALUES ('KIEM_DEM_XAC_NHAN', 'QUET_TIEP_LA_DAT', 'STRING', 'Cách xác nhận chất lượng khi kiểm đếm hàng nhập'),
       ('MA_LO_TIEN_TO', 'LO', 'STRING', 'Tiền tố mã lô gợi ý khi khóa lô');

-- Kiểm tra lại
SHOW COLUMNS FROM chi_tiet_loi_lo_hang;
SHOW COLUMNS FROM ma_vach_nha_cung_cap LIKE 'nguoi_lien_ket_id';
SELECT ma_cau_hinh, gia_tri FROM cau_hinh_he_thong WHERE ma_cau_hinh IN ('KIEM_DEM_XAC_NHAN', 'MA_LO_TIEN_TO');
