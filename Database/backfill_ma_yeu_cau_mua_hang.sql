-- Bổ sung mã cho các yêu cầu nhập hàng CŨ chưa có mã (tạo trước khi backend
-- tự sinh mã lúc tạo phiếu). Cùng quy tắc với YeuCauMuaHangService.taoMaYeuCau:
--   PR + yyyyMMdd (ngày tạo) + id đệm đủ 4 chữ số, vd. PR202610080012
--
-- KHÔNG bắt buộc: backend tự bổ sung mã cho yêu cầu cũ khi duyệt / từ chối /
-- gửi yêu cầu báo giá. Chạy script này nếu muốn mọi phiếu cũ (kể cả phiếu đã
-- xử lý xong) đều có mã ngay. Chỉ cập nhật dòng chưa có mã nên chạy lại nhiều
-- lần không sao; mã dựa trên id nên không trùng (cột có UNIQUE).
-- Ngày trong mã lấy theo giờ của MySQL server (phiếu tạo sát nửa đêm có thể
-- lệch 1 ngày so với giờ Việt Nam — không ảnh hưởng tính duy nhất).

UPDATE yeu_cau_mua_hang
SET so_yeu_cau_mua_hang = CONCAT(
        'PR',
        DATE_FORMAT(COALESCE(ngay_tao, NOW()), '%Y%m%d'),
        IF(id >= 10000, CAST(id AS CHAR), LPAD(id, 4, '0'))
    )
WHERE so_yeu_cau_mua_hang IS NULL
   OR so_yeu_cau_mua_hang = '';
