-- =====================================================================
-- ĐÓNG GÓI (Scan-to-Pack) + mô hình trạng thái mới của luồng xuất bán
--   Đơn bán:    0 Nháp → 1 Chờ nhặt hàng → 7 Chờ đóng gói → 8 Chờ xuất kho → 3 Đã xuất kho → 5 Hoàn thành
--               (2 = đã xuất một phần, 4 = Đã hủy, 6 = Bị hoàn trả — giữ nguyên nghĩa cũ)
--   Phiếu nhặt: cho_nhat → dang_nhat → da_nhat; da_huy (bỏ 'da_xuat')
--   Phiếu xuất bán hàng: 0 Nháp → 6 Chờ xuất (đã đóng gói) → 3 Đã xuất; 4 Đã hủy
--
-- THỨ TỰ TRIỂN KHAI: dừng backend cũ → chạy script này → chạy backend mới.
--   Backend mới đọc cột chi_tiet_phieu_xuat_kho.so_luong_da_dong_goi: thiếu cột là mọi màn phiếu xuất lỗi.
--   Chạy SAU hoan_ke_canh_bao_v1.sql. Chạy lại nhiều lần an toàn.
-- =====================================================================
SET NAMES utf8mb4;

-- 0) Xem trước (chỉ đọc)
SELECT trang_thai, COUNT(*) AS so_don FROM don_ban_hang WHERE loai_chung_tu = 'don_ban_hang' GROUP BY trang_thai;
SELECT trang_thai, COUNT(*) AS so_phieu FROM danh_sach_nhat_hang GROUP BY trang_thai;

-- ---------------------------------------------------------------------
-- 1) Cột lưu số lượng đã quét khi đóng gói (dòng gốc của phiếu xuất).
--    MySQL 8 không có ADD COLUMN IF NOT EXISTS nên kiểm tra trước rồi mới thêm.
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

CALL them_cot_neu_chua_co('chi_tiet_phieu_xuat_kho', 'so_luong_da_dong_goi',
    'decimal(15,3) DEFAULT ''0.000'' COMMENT ''Số lượng đã quét khi đóng gói (Scan-to-Pack), dòng gốc lo_hang_id IS NULL'' AFTER so_luong_xuat');
DROP PROCEDURE IF EXISTS them_cot_neu_chua_co;

-- MySQL Workbench bật "Safe Updates" sẽ chặn UPDATE không theo khóa chính
SET SQL_SAFE_UPDATES = 0;

-- ---------------------------------------------------------------------
-- 2) Đưa đơn đang chạy về trạng thái mới
--    a. Đơn nằm trong phiếu nhặt chưa nhặt xong (trước đây bị đặt 2 lúc tạo phiếu nhặt) → 1 Chờ nhặt hàng
--    b. Đơn đã gửi kho có phiếu xuất bán hàng NHÁP (đã nhặt xong / tạo phiếu tay) → 7 Chờ đóng gói
--       (phiếu nháp này phải đóng gói trước khi xuất kho)
-- ---------------------------------------------------------------------
UPDATE don_ban_hang d
JOIN danh_sach_nhat_hang n ON n.id = d.danh_sach_nhat_hang_id
SET d.trang_thai = 1
WHERE d.loai_chung_tu = 'don_ban_hang'
  AND d.trang_thai = 2
  AND n.trang_thai IN ('cho_nhat', 'dang_nhat')
  AND NOT EXISTS (SELECT 1 FROM phieu_xuat_kho p WHERE p.don_ban_hang_id = d.id AND p.trang_thai = 3);

UPDATE don_ban_hang d
SET d.trang_thai = 7
WHERE d.loai_chung_tu = 'don_ban_hang'
  AND d.trang_thai IN (1, 2)
  AND EXISTS (SELECT 1 FROM phieu_xuat_kho p
              WHERE p.don_ban_hang_id = d.id AND p.loai_xuat = 'ban_hang' AND p.trang_thai = 0);

-- ---------------------------------------------------------------------
-- 3) Phiếu nhặt: việc nhặt kết thúc ở 'da_nhat' (đóng gói / xuất kho theo dõi trên đơn và phiếu xuất)
-- ---------------------------------------------------------------------
UPDATE danh_sach_nhat_hang SET trang_thai = 'da_nhat' WHERE trang_thai = 'da_xuat';

ALTER TABLE danh_sach_nhat_hang
  MODIFY COLUMN trang_thai
  ENUM('cho_nhat','dang_nhat','da_nhat','da_huy')
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'cho_nhat';

SET SQL_SAFE_UPDATES = 1;

-- ---------------------------------------------------------------------
-- 4) Comment cột trạng thái khớp code (chỉ sửa comment, không đổi kiểu / dữ liệu)
-- ---------------------------------------------------------------------
ALTER TABLE don_ban_hang
    MODIFY COLUMN trang_thai tinyint(1) DEFAULT '0'
    COMMENT '0: Nháp, 1: Chờ nhặt hàng, 2: Đã xuất một phần, 3: Đã xuất kho, 4: Đã hủy, 5: Hoàn thành, 6: Bị hoàn trả, 7: Chờ đóng gói, 8: Chờ xuất kho (đã đóng gói)';

ALTER TABLE phieu_xuat_kho
    MODIFY COLUMN trang_thai tinyint(1) DEFAULT '0'
    COMMENT '0: Nháp, 1: Chờ duyệt, 2: Đã duyệt, 3: Đã xuất, 4: Đã hủy, 5: Hoàn tất, 6: Chờ xuất (đã đóng gói)';

-- 5) Kiểm tra lại
SHOW COLUMNS FROM chi_tiet_phieu_xuat_kho LIKE 'so_luong_da_dong_goi';
SHOW COLUMNS FROM danh_sach_nhat_hang LIKE 'trang_thai';
SELECT trang_thai, COUNT(*) AS so_don FROM don_ban_hang WHERE loai_chung_tu = 'don_ban_hang' GROUP BY trang_thai;
-- Phải ra 0: đơn còn ở 2 mà vẫn nằm trong phiếu nhặt chưa nhặt xong
SELECT COUNT(*) AS con_sai
FROM don_ban_hang d JOIN danh_sach_nhat_hang n ON n.id = d.danh_sach_nhat_hang_id
WHERE d.trang_thai = 2 AND n.trang_thai IN ('cho_nhat', 'dang_nhat')
  AND NOT EXISTS (SELECT 1 FROM phieu_xuat_kho p WHERE p.don_ban_hang_id = d.id AND p.trang_thai = 3);
