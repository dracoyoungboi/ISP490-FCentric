-- Bổ sung loại cho các khách hàng CŨ bị lưu loai_khach_hang = NULL (tạo từ form
-- "Thêm khách hàng" trước khi backend ghi trường này — KhachHangService.create
-- bỏ sót loaiKhachHang nên Hibernate ghi NULL, không dùng DEFAULT 'le' của cột).
--
-- Gán về 'le' (khớp DEFAULT của cột). Sau khi chạy, tổng 3 thẻ Khách lẻ / Khách sỉ /
-- Doanh nghiệp ở màn /customers bằng đúng "Tổng khách hàng", và lọc "Khách lẻ"
-- thấy cả những khách này. Khách thực ra là sỉ / doanh nghiệp thì sửa lại ở màn
-- chỉnh sửa khách hàng (đã lưu được loại).
-- Chỉ cập nhật dòng chưa có loại nên chạy lại nhiều lần không sao.

UPDATE khach_hang
SET loai_khach_hang = 'le'
WHERE loai_khach_hang IS NULL
   OR loai_khach_hang = '';
