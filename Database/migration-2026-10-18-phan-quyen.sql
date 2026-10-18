-- =====================================================================
-- Phân quyền người dùng – 2026-10-18
-- Máy chủ tự chạy phần này lúc khởi động (PhanQuyenTableInitializer).
-- File này để chạy tay khi cần (ví dụ CSDL dùng chung của nhóm).
-- Chạy nhiều lần vẫn an toàn: bảng/cột đã có thì bỏ qua, mẫu chỉ nạp khi bảng rỗng.
-- =====================================================================

-- 1. Mẫu quyền theo vai trò: quản trị viên sửa qua API, máy chủ không ghi đè.
CREATE TABLE IF NOT EXISTS mau_quyen_vai_tro (
    vai_tro      VARCHAR(30) NOT NULL,
    quyen_han_id INT         NOT NULL,
    PRIMARY KEY (vai_tro, quyen_han_id),
    INDEX idx_mqvt_quyen (quyen_han_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nạp mẫu ban đầu (chỉ khi bảng còn rỗng), theo mã quyền trong quyen_han.
SET @mau_rong = (SELECT COUNT(*) = 0 FROM mau_quyen_vai_tro);

INSERT INTO mau_quyen_vai_tro (vai_tro, quyen_han_id)
SELECT 'quan_ly_kho', id FROM quyen_han
WHERE @mau_rong AND ma_quyen IN ('xem_ton_kho','xem_chi_tiet_lo','dieu_chinh_ton_kho','chuyen_kho',
    'duyet_phieu_nhap','huy_phieu_nhap','duyet_phieu_xuat','huy_phieu_xuat',
    'xem_bao_cao_ton_kho','xem_bao_cao_nhap_xuat','xem_bao_cao_doanh_thu','xuat_bao_cao',
    'quan_ly_nhan_vien_kho','cap_quyen_nhan_vien');

INSERT INTO mau_quyen_vai_tro (vai_tro, quyen_han_id)
SELECT 'nhan_vien_kho', id FROM quyen_han
WHERE @mau_rong AND ma_quyen IN ('xem_ton_kho','xem_chi_tiet_lo','chuyen_kho',
    'tao_phieu_nhap','tao_phieu_xuat','xem_bao_cao_ton_kho');

INSERT INTO mau_quyen_vai_tro (vai_tro, quyen_han_id)
SELECT 'nhan_vien_mua_hang', id FROM quyen_han
WHERE @mau_rong AND ma_quyen IN ('xem_ton_kho','tao_don_mua_hang','xem_bao_cao_ton_kho','quan_ly_nha_cung_cap');

INSERT INTO mau_quyen_vai_tro (vai_tro, quyen_han_id)
SELECT 'nhan_vien_ban_hang', id FROM quyen_han
WHERE @mau_rong AND ma_quyen IN ('xem_ton_kho','tao_don_ban_hang','xem_bao_cao_ton_kho','quan_ly_khach_hang');

-- 2. Cờ quyền nhạy cảm (ngăn kéo phân quyền hiện nhãn "Nhạy cảm" và hỏi lại trước khi lưu).
--    MySQL 8 không có ADD COLUMN IF NOT EXISTS nên kiểm information_schema trước.
SET @co_cot = (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quyen_han' AND COLUMN_NAME = 'nhay_cam');
SET @sql = IF(@co_cot = 0,
    'ALTER TABLE quyen_han ADD COLUMN nhay_cam TINYINT(1) NOT NULL DEFAULT 0',
    'SELECT 1');
PREPARE lenh FROM @sql;
EXECUTE lenh;
DEALLOCATE PREPARE lenh;

-- Chỉ đánh dấu khi cột vừa được thêm, để không ghi đè lựa chọn đã sửa.
UPDATE quyen_han SET nhay_cam = 1
WHERE @co_cot = 0 AND ma_quyen IN ('dieu_chinh_ton_kho','duyet_don_mua_hang','duyet_phieu_nhap','huy_phieu_nhap',
    'duyet_don_ban_hang','duyet_phieu_xuat','huy_phieu_xuat','xem_bao_cao_doanh_thu','xuat_bao_cao',
    'quan_ly_nhan_vien_kho','cap_quyen_nhan_vien');
