-- ============================================================================
-- KÍCH CỠ — sắp lại thứ tự hiển thị, v1
-- - Danh sách kích cỡ (GET /api/v1/size/all) giờ trả theo cột thu_tu_sap_xep.
-- - Dữ liệu cũ để S, M, L, XL cùng thứ tự 0 nên danh sách hiện lộn xộn (S, M, XL, L...).
--   File này gán thứ tự chuẩn: XS 10, S 20, M 30, L 40, XL 50, XXL 60, 3XL 70, 4XL 80.
-- Chỉ sửa các dòng đang để thứ tự mặc định 0; kích cỡ đã chỉnh tay thì giữ nguyên.
-- Không xóa dữ liệu. Chạy lại nhiều lần an toàn, trên CSDL fashion_system.
-- ============================================================================
SET NAMES utf8mb4;

UPDATE size SET thu_tu_sap_xep = 10 WHERE ma_size = 'XS'  AND thu_tu_sap_xep = 0;
UPDATE size SET thu_tu_sap_xep = 20 WHERE ma_size = 'S'   AND thu_tu_sap_xep = 0;
UPDATE size SET thu_tu_sap_xep = 30 WHERE ma_size = 'M'   AND thu_tu_sap_xep = 0;
UPDATE size SET thu_tu_sap_xep = 40 WHERE ma_size = 'L'   AND thu_tu_sap_xep = 0;
UPDATE size SET thu_tu_sap_xep = 50 WHERE ma_size = 'XL'  AND thu_tu_sap_xep = 0;
UPDATE size SET thu_tu_sap_xep = 60 WHERE ma_size = 'XXL' AND thu_tu_sap_xep = 0;
UPDATE size SET thu_tu_sap_xep = 70 WHERE ma_size = '3XL' AND thu_tu_sap_xep = 0;
UPDATE size SET thu_tu_sap_xep = 80 WHERE ma_size = '4XL' AND thu_tu_sap_xep = 0;

-- Kiểm tra lại
SELECT id, ma_size, ten_size, loai_size, thu_tu_sap_xep FROM size ORDER BY thu_tu_sap_xep, id;
