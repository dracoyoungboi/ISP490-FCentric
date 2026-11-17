-- =====================================================================
-- Trần quyền theo vai trò (ma trận phân quyền SRS mục 4.4) – 2026-11-17
--
-- Mỗi vai trò chỉ được cấp một số quyền chi tiết tại kho (IPermissionType.TRAN_THEO_VAI_TRO ở backend). Từ bản này
-- máy chủ từ chối lưu quyền ngoài trần. Tệp này dọn dữ liệu cũ cho khớp:
--   1. Bỏ khỏi mẫu quyền (mau_quyen_vai_tro) các quyền ngoài trần của vai trò.
--   2. Thu hồi (trang_thai = 0, không xóa) các quyền ngoài trần đang cấp cho người dùng.
-- Ví dụ bị gỡ: quản lý kho mất "Cấp quyền nhân viên", "Quản lý nhân viên kho", "Xem báo cáo doanh thu"; nhân viên kho,
-- mua hàng, bán hàng mất "Xem báo cáo tồn kho". Quản trị viên không bị ảnh hưởng (toàn quyền, không dùng quyền chi tiết).
--
-- Người bị thu hồi quyền phải đăng nhập lại một lần ở lần bấm kế tiếp (máy chủ thấy token mang quyền không còn trong CSDL).
-- Lần thu hồi này không ghi vào "Lịch sử phân quyền" của từng người (chạy bằng SQL, không qua máy chủ).
--
-- THỨ TỰ KHI TRIỂN KHAI: chạy cùng lúc triển khai backend mới (trước hay sau vài phút đều được), rồi frontend mới.
-- Chạy lại nhiều lần được: lần sau không còn dòng nào để gỡ.
-- Cách chạy: mysql --default-character-set=utf8mb4 fashion_system < tệp này
-- =====================================================================

SET NAMES utf8mb4;
USE fashion_system;          -- đổi nếu CSDL của bạn tên khác

-- Trần quyền: phải trùng IPermissionType.TRAN_THEO_VAI_TRO
DROP TEMPORARY TABLE IF EXISTS tran_quyen_vai_tro;
CREATE TEMPORARY TABLE tran_quyen_vai_tro (
    vai_tro  VARCHAR(30) NOT NULL,
    ma_quyen VARCHAR(50) NOT NULL,
    PRIMARY KEY (vai_tro, ma_quyen)
) ENGINE=MEMORY DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tran_quyen_vai_tro (vai_tro, ma_quyen) VALUES
    ('quan_ly_kho', 'xem_ton_kho'), ('quan_ly_kho', 'xem_chi_tiet_lo'), ('quan_ly_kho', 'dieu_chinh_ton_kho'),
    ('quan_ly_kho', 'chuyen_kho'), ('quan_ly_kho', 'tao_don_mua_hang'), ('quan_ly_kho', 'duyet_don_mua_hang'),
    ('quan_ly_kho', 'tao_phieu_nhap'), ('quan_ly_kho', 'duyet_phieu_nhap'), ('quan_ly_kho', 'huy_phieu_nhap'),
    ('quan_ly_kho', 'tao_phieu_xuat'), ('quan_ly_kho', 'duyet_phieu_xuat'), ('quan_ly_kho', 'huy_phieu_xuat'),
    ('quan_ly_kho', 'xem_bao_cao_ton_kho'), ('quan_ly_kho', 'xem_bao_cao_nhap_xuat'), ('quan_ly_kho', 'xuat_bao_cao'),

    ('nhan_vien_kho', 'xem_ton_kho'), ('nhan_vien_kho', 'xem_chi_tiet_lo'), ('nhan_vien_kho', 'chuyen_kho'),
    ('nhan_vien_kho', 'tao_dot_kiem_ke'), ('nhan_vien_kho', 'tao_phieu_nhap'), ('nhan_vien_kho', 'duyet_phieu_nhap'),
    ('nhan_vien_kho', 'huy_phieu_nhap'), ('nhan_vien_kho', 'tao_phieu_xuat'), ('nhan_vien_kho', 'duyet_phieu_xuat'),
    ('nhan_vien_kho', 'xem_bao_cao_nhap_xuat'), ('nhan_vien_kho', 'xuat_bao_cao'),

    ('nhan_vien_mua_hang', 'xem_ton_kho'), ('nhan_vien_mua_hang', 'tao_don_mua_hang'),
    ('nhan_vien_mua_hang', 'duyet_don_mua_hang'), ('nhan_vien_mua_hang', 'quan_ly_nha_cung_cap'),
    ('nhan_vien_mua_hang', 'xuat_bao_cao'),

    ('nhan_vien_ban_hang', 'xem_ton_kho'), ('nhan_vien_ban_hang', 'tao_don_ban_hang'),
    ('nhan_vien_ban_hang', 'duyet_don_ban_hang'), ('nhan_vien_ban_hang', 'xem_bao_cao_doanh_thu'),
    ('nhan_vien_ban_hang', 'quan_ly_khach_hang'), ('nhan_vien_ban_hang', 'xuat_bao_cao');

-- Xem trước (chỉ đọc): những gì sắp bị gỡ
SELECT m.vai_tro, q.ma_quyen AS mau_quyen_se_go
FROM mau_quyen_vai_tro m
JOIN quyen_han q ON q.id = m.quyen_han_id
LEFT JOIN tran_quyen_vai_tro t ON t.vai_tro = m.vai_tro AND t.ma_quyen = q.ma_quyen
WHERE t.ma_quyen IS NULL
ORDER BY m.vai_tro, q.ma_quyen;

SELECT nd.id AS nguoi_dung_id, nd.ten_dang_nhap, nd.vai_tro, q.ma_quyen AS quyen_se_thu_hoi
FROM chi_tiet_quyen_kho ct
JOIN phan_quyen_nguoi_dung_kho pq ON pq.id = ct.phan_quyen_nguoi_dung_kho_id
JOIN nguoi_dung nd ON nd.id = pq.nguoi_dung_id
JOIN quyen_han q ON q.id = ct.quyen_han_id
LEFT JOIN tran_quyen_vai_tro t ON t.vai_tro = nd.vai_tro AND t.ma_quyen = q.ma_quyen
WHERE ct.trang_thai = 1 AND nd.vai_tro <> 'quan_tri_vien' AND t.ma_quyen IS NULL
ORDER BY nd.id, q.ma_quyen;

-- 1. Mẫu quyền
DELETE m FROM mau_quyen_vai_tro m
JOIN quyen_han q ON q.id = m.quyen_han_id
LEFT JOIN tran_quyen_vai_tro t ON t.vai_tro = m.vai_tro AND t.ma_quyen = q.ma_quyen
WHERE t.ma_quyen IS NULL;

-- 2. Quyền đang cấp (thu hồi, giữ dòng để còn dấu vết)
UPDATE chi_tiet_quyen_kho ct
JOIN phan_quyen_nguoi_dung_kho pq ON pq.id = ct.phan_quyen_nguoi_dung_kho_id
JOIN nguoi_dung nd ON nd.id = pq.nguoi_dung_id
JOIN quyen_han q ON q.id = ct.quyen_han_id
LEFT JOIN tran_quyen_vai_tro t ON t.vai_tro = nd.vai_tro AND t.ma_quyen = q.ma_quyen
SET ct.trang_thai = 0
WHERE ct.trang_thai = 1 AND nd.vai_tro <> 'quan_tri_vien' AND t.ma_quyen IS NULL;

-- Đối chiếu (chỉ đọc): phải ra 0 dòng
SELECT COUNT(*) AS con_ngoai_tran
FROM chi_tiet_quyen_kho ct
JOIN phan_quyen_nguoi_dung_kho pq ON pq.id = ct.phan_quyen_nguoi_dung_kho_id
JOIN nguoi_dung nd ON nd.id = pq.nguoi_dung_id
JOIN quyen_han q ON q.id = ct.quyen_han_id
LEFT JOIN tran_quyen_vai_tro t ON t.vai_tro = nd.vai_tro AND t.ma_quyen = q.ma_quyen
WHERE ct.trang_thai = 1 AND nd.vai_tro <> 'quan_tri_vien' AND t.ma_quyen IS NULL;

DROP TEMPORARY TABLE IF EXISTS tran_quyen_vai_tro;
