-- =====================================================================
-- Sửa lỗi hủy đơn đang nằm trong phiếu nhặt báo "Có lỗi xảy ra" (500)
-- Nguyên nhân: cột canh_bao.loai_canh_bao là ENUM('ton_kho_thap','ton_kho_qua_muc')
-- nhưng backend (NhatHangServiceImpl - xử lý đơn bị hủy trong phiếu nhặt) ghi
-- 'HOAN_KE_CHO_CAT' (lệnh cất hàng về kệ) → MySQL báo
--   "Data truncated for column 'loai_canh_bao'" → giao dịch hủy đơn rollback,
-- màn "Hàng cần hoàn kệ" không bao giờ có dữ liệu.
-- Script này thêm giá trị còn thiếu, giữ nguyên 2 giá trị cũ. Chạy 1 lần (chạy lại vẫn an toàn).
-- =====================================================================

-- 0) Kiểm tra trước (chỉ đọc).
--    Nếu cột KHÔNG còn là ENUM('ton_kho_thap','ton_kho_qua_muc') (vd. đã bị sửa tay thành VARCHAR
--    hoặc ENUM có thêm giá trị khác) thì DỪNG, đừng chạy bước 1 — báo lại để chỉnh script.
SHOW COLUMNS FROM canh_bao LIKE 'loai_canh_bao';
SELECT loai_canh_bao, COUNT(*) AS so_dong FROM canh_bao GROUP BY loai_canh_bao;

-- 1) Mở rộng ENUM
ALTER TABLE canh_bao
  MODIFY COLUMN loai_canh_bao
  ENUM('ton_kho_thap','ton_kho_qua_muc','HOAN_KE_CHO_CAT')
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

-- 2) Kiểm tra lại
SHOW COLUMNS FROM canh_bao LIKE 'loai_canh_bao';
