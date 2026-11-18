-- [AUDIT-108] Bổ sung cột cho_phep_dong_bo để chặn đẩy tồn/đồng bộ sàn khi người dùng đã tắt
ALTER TABLE trang_thai_dong_bo_san_pham ADD COLUMN IF NOT EXISTS cho_phep_dong_bo TINYINT(1) NOT NULL DEFAULT 1 AFTER trang_thai_dong_bo;

