-- ============================================================================
-- KHO TỔNG — Tách Kho tổng (phân phối) và kho bán hàng, v1
-- - Tạo kho thật "Kho tổng" (mã KHO_TONG, loai_kho = 'kho_tong'): nhận hàng từ nhà cung cấp
--   và phân phối cho các kho bán hàng.
-- - Mọi kho còn lại (Kho Hà Nội, Kho Hồ Chí Minh...) là kho bán hàng (loai_kho = 'cua_hang').
-- - Kho Trung Chuyển (KHO_TRANSIT) GIỮ NGUYÊN là kho ảo chứa hàng đang đi đường khi chuyển kho;
--   không dùng kho này làm Kho tổng.
-- Không xoá dữ liệu, không chuyển tồn: hàng đang ở Kho Hà Nội vẫn ở Kho Hà Nội. Muốn đưa hàng về
-- Kho tổng thì lập phiếu chuyển kho trên hệ thống.
-- Chạy lại nhiều lần an toàn. Chạy bằng MySQL Workbench hoặc lệnh mysql (file có DELIMITER),
-- trên CSDL fashion_system, sau khi backup.
-- ============================================================================
SET NAMES utf8mb4;
SET @che_do_an_toan_cu := @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

-- ---------------------------------------------------------------------------
-- 1. Cột loai_kho: CSDL tạo từ bản MyDB.sql cũ chưa có cột này thì thêm vào.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS them_cot_loai_kho;
DELIMITER //
CREATE PROCEDURE them_cot_loai_kho()
BEGIN
    IF (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'kho' AND column_name = 'loai_kho') = 0 THEN
        ALTER TABLE kho
            ADD COLUMN loai_kho ENUM('kho_tong', 'cua_hang') COLLATE utf8mb4_unicode_ci DEFAULT 'cua_hang'
                COMMENT 'kho_tong: Kho tổng phân phối hàng; cua_hang: kho bán hàng' AFTER ten_kho;
    END IF;
END //
DELIMITER ;
CALL them_cot_loai_kho();
DROP PROCEDURE IF EXISTS them_cot_loai_kho;

-- ---------------------------------------------------------------------------
-- 2. Tạo Kho tổng (bỏ qua nếu đã có mã KHO_TONG).
--    Người quản lý tạm lấy theo Kho Hà Nội (KHO01); địa chỉ cập nhật sau trên màn Quản lý kho.
-- ---------------------------------------------------------------------------
SET @quan_ly_kho_tong := (SELECT quan_ly_id FROM kho WHERE ma_kho = 'KHO01' LIMIT 1);
SET @da_co_kho_tong := (SELECT COUNT(*) FROM kho WHERE ma_kho = 'KHO_TONG');

INSERT INTO kho (ma_kho, ten_kho, loai_kho, dia_chi, quan_ly_id, trang_thai)
SELECT 'KHO_TONG', 'Kho tổng', 'kho_tong', 'Chưa cập nhật địa chỉ', @quan_ly_kho_tong, 1
FROM DUAL
WHERE @da_co_kho_tong = 0;

-- ---------------------------------------------------------------------------
-- 3. Phân loại: chỉ KHO_TONG là Kho tổng, mọi kho khác là kho bán hàng.
-- ---------------------------------------------------------------------------
UPDATE kho SET loai_kho = 'kho_tong', trang_thai = 1 WHERE ma_kho = 'KHO_TONG';
UPDATE kho SET loai_kho = 'cua_hang'
WHERE ma_kho <> 'KHO_TONG' AND (loai_kho IS NULL OR loai_kho <> 'cua_hang');

SET SQL_SAFE_UPDATES = @che_do_an_toan_cu;

-- ---------------------------------------------------------------------------
-- 4. Kiểm tra (chỉ đọc): phải có đúng 1 dòng Kho tổng đang hoạt động.
-- ---------------------------------------------------------------------------
SELECT id, ma_kho, ten_kho,
       CASE
           WHEN ma_kho = 'KHO_TRANSIT' THEN 'Kho ảo (hàng đang chuyển)'
           WHEN loai_kho = 'kho_tong' THEN 'Kho tổng'
           ELSE 'Kho bán hàng'
       END AS loai,
       trang_thai
FROM kho
ORDER BY (loai_kho = 'kho_tong') DESC, (ma_kho = 'KHO_TRANSIT'), id;
