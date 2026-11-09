# Hướng dẫn cho GitHub Copilot

Quy ước đầy đủ ở `AGENTS.md` (gốc repo). Đọc tệp đó trước khi sửa giao diện hoặc câu thông báo máy chủ.

Tóm tắt quy tắc đa ngôn ngữ (tiếng Việt gốc, tiếng Anh bản dịch):

- Frontend: khóa dịch chính là câu tiếng Việt, `t("Lưu thay đổi")` (import `t` từ `@/i18n`). Mọi chữ hiện ra giao diện
  (JSX, placeholder, title, aria-label, toast, câu lỗi kiểm ô, giá trị mặc định của `getApiErrorMessage`) đều qua `t()`.
- Có tham số thì `t("Kho {{ten}}", { ten })`, không ghép chuỗi bằng `+` hay template string.
- Thêm bản dịch tiếng Anh cùng lúc vào `frontend/src/i18n/en/<module>.json`; một khóa chỉ một bản dịch trong toàn bộ `en/`.
- Giữ tiếng Việt (không bọc `t()`): dữ liệu lưu DB / gửi máy chủ / khóa so sánh, mẫu in, Excel, email; ghi chú
  `// i18n-giu-nguyen: <lý do>`. Nhãn trong `constants/` khai báo tiếng Việt, dịch lúc hiện ra.
- Giá trị máy chủ trả về: `tDuLieu(giaTri)`.
- Backend: câu cho người dùng theo khóa trong `i18n/thong-diep/<nhom>.properties` và `<nhom>_en.properties` (thêm cả hai);
  ném lỗi bằng `LoiChungException(ThongDiep.of("nhom.khoa", ...))`, không `RuntimeException("câu tiếng Việt")`.
- Văn phong: viết hoa kiểu câu, không lộ chữ kỹ thuật (tên API, request, token), nút bắt đầu bằng động từ.
- Kiểm trước khi xong: `cd frontend && npm run i18n:kiem` phải sạch (GitHub Actions cũng chạy lệnh này).
