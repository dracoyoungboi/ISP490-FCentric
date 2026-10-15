-- =====================================================================
-- SỐ TỒN SÀN ĐÃ NHẬN (màn Sản phẩm theo sàn, cột "Đã đẩy lên Shopify")
--   trang_thai_dong_bo_san_pham.so_luong_da_day   : số tồn sàn đã nhận ở lần đẩy thành công gần nhất
--   trang_thai_dong_bo_san_pham.ngay_day_ton_cuoi : thời điểm của lần đẩy đó
--   NULL cả hai = dòng chưa từng đẩy tồn thành công.
--
-- THỨ TỰ TRIỂN KHAI: chạy script này → chạy backend mới.
--   Backend mới đọc hai cột này: thiếu cột là màn Sản phẩm theo sàn và mọi lần đẩy tồn lỗi.
--   Chỉ thêm cột, không sửa dữ liệu cũ. Chạy lại nhiều lần an toàn.
-- =====================================================================
SET NAMES utf8mb4;

-- 0) Xem trước (chỉ đọc)
SELECT trang_thai_dong_bo, COUNT(*) AS so_dong FROM trang_thai_dong_bo_san_pham GROUP BY trang_thai_dong_bo;

-- ---------------------------------------------------------------------
-- 1) Hai cột mới. MySQL 8 không có ADD COLUMN IF NOT EXISTS nên kiểm tra trước rồi mới thêm.
--    Ghi rõ NULL DEFAULT NULL để cột timestamp không tự nhận ON UPDATE CURRENT_TIMESTAMP.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS them_cot_neu_chua_co;
DELIMITER //
CREATE PROCEDURE them_cot_neu_chua_co(IN bang VARCHAR(64), IN cot VARCHAR(64), IN dinh_nghia VARCHAR(500))
BEGIN
    IF (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = bang AND column_name = cot) = 0 THEN
        SET @lenh := CONCAT('ALTER TABLE ', bang, ' ADD COLUMN ', cot, ' ', dinh_nghia);
        PREPARE lenh_them_cot FROM @lenh;
        EXECUTE lenh_them_cot;
        DEALLOCATE PREPARE lenh_them_cot;
    END IF;
END //
DELIMITER ;

CALL them_cot_neu_chua_co('trang_thai_dong_bo_san_pham', 'so_luong_da_day',
    'int DEFAULT NULL COMMENT ''Số tồn sàn đã nhận ở lần đẩy thành công gần nhất; NULL = chưa đẩy'' AFTER chi_tiet_loi');
CALL them_cot_neu_chua_co('trang_thai_dong_bo_san_pham', 'ngay_day_ton_cuoi',
    'timestamp NULL DEFAULT NULL COMMENT ''Thời điểm đẩy tồn thành công gần nhất'' AFTER so_luong_da_day');
DROP PROCEDURE IF EXISTS them_cot_neu_chua_co;

-- 2) Kiểm tra lại
SHOW COLUMNS FROM trang_thai_dong_bo_san_pham LIKE 'so_luong_da_day';
SHOW COLUMNS FROM trang_thai_dong_bo_san_pham LIKE 'ngay_day_ton_cuoi';
