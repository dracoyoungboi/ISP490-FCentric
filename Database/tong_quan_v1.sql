-- ============================================================================
-- TỔNG QUAN QUẢN TRỊ — Migration bổ sung dữ liệu v1
-- Không tạo/xoá bảng, không đổi kiểu cột. Chạy lại nhiều lần an toàn.
-- Chạy thủ công trên DB mục tiêu (ddl-auto=none), sau khi backup.
-- ============================================================================
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- 1. Bù ngày giao cho đơn bán cũ.
--    Trước bản sửa này chỉ đơn bán tại quầy (POS) được ghi ngay_giao_hang, nên
--    Báo cáo doanh thu (lọc theo ngày giao) bỏ sót mọi đơn bán thường đã xuất kho.
--    Từ nay ngay_giao_hang được ghi khi đơn xuất đủ hàng (trạng thái 3) hoặc khi
--    xác nhận giao thành công (trạng thái 5). Đơn cũ: lấy thời điểm của phiếu xuất
--    hoàn tất (trạng thái 3) cuối cùng của đơn.
--    Giữ nguyên ngay_cap_nhat (cột có ON UPDATE CURRENT_TIMESTAMP).
-- ---------------------------------------------------------------------------
UPDATE don_ban_hang d
JOIN (
    SELECT p.don_ban_hang_id, MAX(p.ngay_xuat) AS ngay_xuat_cuoi
    FROM phieu_xuat_kho p
    WHERE p.trang_thai = 3
      AND p.don_ban_hang_id IS NOT NULL
      AND p.ngay_xuat IS NOT NULL
    GROUP BY p.don_ban_hang_id
) x ON x.don_ban_hang_id = d.id
SET d.ngay_giao_hang = x.ngay_xuat_cuoi,
    d.ngay_cap_nhat  = d.ngay_cap_nhat
WHERE d.ngay_giao_hang IS NULL
  AND d.loai_chung_tu = 'don_ban_hang'
  AND d.trang_thai IN (3, 5, 6);

-- ---------------------------------------------------------------------------
-- 2. Chỉ mục cho màn Tổng quan và Báo cáo doanh thu (lọc theo ngày giao, ngày đặt,
--    tính giá vốn theo đơn, đếm phiếu xuất chờ xử lý).
--    MySQL 8 không có CREATE INDEX IF NOT EXISTS nên kiểm tra trước rồi mới tạo.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS tao_chi_muc_neu_chua_co;
DELIMITER //
CREATE PROCEDURE tao_chi_muc_neu_chua_co(IN bang VARCHAR(64), IN ten VARCHAR(64), IN cot VARCHAR(255))
BEGIN
    IF (SELECT COUNT(*) FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = bang AND index_name = ten) = 0 THEN
        SET @lenh := CONCAT('CREATE INDEX ', ten, ' ON ', bang, ' (', cot, ')');
        PREPARE lenh_chi_muc FROM @lenh;
        EXECUTE lenh_chi_muc;
        DEALLOCATE PREPARE lenh_chi_muc;
    END IF;
END //
DELIMITER ;

CALL tao_chi_muc_neu_chua_co('don_ban_hang', 'idx_don_ban_hang_ngay_giao', 'ngay_giao_hang');
CALL tao_chi_muc_neu_chua_co('don_ban_hang', 'idx_don_ban_hang_ngay_dat', 'ngay_dat_hang');
CALL tao_chi_muc_neu_chua_co('phieu_xuat_kho', 'idx_phieu_xuat_kho_don_trang_thai', 'don_ban_hang_id, trang_thai');
CALL tao_chi_muc_neu_chua_co('phieu_xuat_kho', 'idx_phieu_xuat_kho_loai_trang_thai', 'loai_xuat, trang_thai');
CALL tao_chi_muc_neu_chua_co('chi_tiet_phieu_xuat_kho', 'idx_ct_phieu_xuat_kho_gia_von',
                             'phieu_xuat_kho_id, lo_hang_id, so_luong_xuat, gia_von');
DROP PROCEDURE IF EXISTS tao_chi_muc_neu_chua_co;

-- ---------------------------------------------------------------------------
-- 3. Kiểm tra sau khi chạy (chỉ đọc).
-- ---------------------------------------------------------------------------

-- 3a. Đơn đã giao/hoàn thành nhưng vẫn chưa có ngày giao: không có phiếu xuất hoàn tất
--     (thường là đơn mới nhặt xong đã bị chuyển trạng thái 3). Các đơn này chưa được
--     tính doanh thu cho tới khi xuất kho thật.
SELECT d.id, d.so_don_hang, d.trang_thai, d.ngay_dat_hang
FROM don_ban_hang d
WHERE d.loai_chung_tu = 'don_ban_hang'
  AND d.trang_thai IN (3, 5)
  AND d.ngay_giao_hang IS NULL;

-- 3b. Kho tổng: màn Tổng quan dùng cột kho.loai_kho = 'kho_tong' để đề xuất chuyển hàng
--     từ Kho tổng. Cần đúng một kho tổng đang hoạt động.
SELECT id, ma_kho, ten_kho, loai_kho, trang_thai
FROM kho
ORDER BY (loai_kho = 'kho_tong') DESC, id;
