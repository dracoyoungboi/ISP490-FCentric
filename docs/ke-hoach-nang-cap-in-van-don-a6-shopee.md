# KẾ HOẠCH NÂNG CẤP GIAO DIỆN IN VẬN ĐƠN SHOPEE A6 (PHƯƠNG ÁN A & B)

> **Tài liệu lưu trữ lộ trình nâng cấp tiếp theo** sau khi hoàn tất **Phương án C** (hiển thị gọn dạng khung A6 đồng nhất với `TikTokShopAwbDocument`).  
> **Quy chuẩn tham chiếu bắt buộc:** `.agents/rules/coding-standards.md`, `.agents/rules/omnichannel-standards.md`, `AGENTS.md`, `.agents/skills/api-design-principles/SKILL.md`.

---

## 1. Bối cảnh & Hạn chế của Phương án C (Hiện tại)

- **Hiện trạng Phương án C:**
  - Tại [ShopeeAwbDocument.jsx](file:///d:/ISP492-Do%20An/ISP490-FCentric/frontend/src/components/print/ShopeeAwbDocument.jsx), thanh thông báo/nút phụ phía trên khung PDF ở giữa màn hình đã được loại bỏ để chỉ còn khung xem trước vận đơn gọn gàng giống [TikTokShopAwbDocument.jsx](file:///d:/ISP492-Do%20An/ISP490-FCentric/frontend/src/components/print/TikTokShopAwbDocument.jsx).
  - Giao diện vẫn nằm bên trong tờ giấy mẫu A6 (`w-[100mm] min-h-[150mm]`) của [PrintLayout.jsx](file:///d:/ISP492-Do%20An/ISP490-FCentric/frontend/src/components/print/PrintLayout.jsx) và [paperStyles.js](file:///d:/ISP492-Do%20An/ISP490-FCentric/frontend/src/components/print/paperStyles.js).
- **Hạn chế cần khắc phục ở pha nâng cấp sau:**
  - Khi Shopee API (`ShopeeClient.downloadShippingDocument`) fallback từ `THERMAL_AIR_WAYBILL` sang `NORMAL_AIR_WAYBILL` (đặc biệt trên Shopee Sandbox), tệp PDF trả về thường có **kích thước trang A4** với tem vận đơn đặt ở **1/4 góc trên bên trái** (3/4 trang còn lại là khoảng trắng).
  - Do bị gói trong ô chiều rộng `100mm` (~378px), trình xem PDF của trình duyệt co nhỏ toàn bộ trang A4 xuống nên tem SPX hiển thị khá nhỏ khi xem trước.

---

## 2. Phương án A — Bung Full Khung Trình Duyệt PDF ở giữa màn hình (Full Workspace Viewer)

### Mục tiêu UX
- Biến toàn bộ vùng giữa màn hình bên dưới thanh công cụ (`Quay lại` | `Tên phiếu` | `In phiếu`) thành **khung trình duyệt xem PDF rộng toàn vùng**, bỏ hoàn toàn lớp giấy trắng thu nhỏ `w-[100mm] shadow-sm` và padding thừa xung quanh khung PDF.
- Giúp xem rõ cả tem A6 lẫn bản A4 (`NORMAL_AIR_WAYBILL`) ngay trong hệ thống FCentric mà không cần mở tab trình duyệt mới.

### Phương án triển khai kỹ thuật (không thêm thư viện ngoài)
1. **Nâng cấp [PrintLayout.jsx](file:///d:/ISP492-Do%20An/ISP490-FCentric/frontend/src/components/print/PrintLayout.jsx) & [PrintRoutePage.jsx](file:///d:/ISP492-Do%20An/ISP490-FCentric/frontend/src/components/print/PrintRoutePage.jsx):**
   - Bổ sung chế độ layout toàn vùng (vd. prop `fullFramePdf` hoặc nhận diện qua trạng thái dữ liệu từ document con) để khi hiển thị PDF sàn thật:
     - Gỡ bỏ `px-4 py-6` ở `.print-container`.
     - Gỡ bỏ `w-[100mm] min-h-[150mm] p-[3mm] bg-white shadow-sm` quanh `{children}`, thay bằng `w-full h-[calc(100dvh-57px)]`.
   - Nếu cần các thao tác phụ (tải PDF A6, xem tem nhiệt nội bộ A6 khi đối chiếu), đưa lên thanh header trên cùng qua prop `toolbarExtra` sẵn có của `PrintLayout.jsx` (dòng 29 & 84).
2. **Cập nhật [ShopeeAwbDocument.jsx](file:///d:/ISP492-Do%20An/ISP490-FCentric/frontend/src/components/print/ShopeeAwbDocument.jsx) (và cân nhắc đồng bộ [TikTokShopAwbDocument.jsx](file:///d:/ISP492-Do%20An/ISP490-FCentric/frontend/src/components/print/TikTokShopAwbDocument.jsx)):**
   - Gắn `#view=FitH` vào URL/tùy chọn xem PDF (nếu trình duyệt hỗ trợ trên Blob/URL) và cho `<iframe class="pdoc-pdf-frame">` giãn `width: 100%; height: 100%`.
   - Với bản `fallback` / lỗi chưa có PDF từ sàn, vẫn tự động quay về hiển thị khung tờ giấy `100mm × 150mm` của tem nhiệt `.sawb-card`.
3. **Tuân thủ `@media print`:**
   - Khi in qua nút **In phiếu**, `PrintRoutePage.handlePrint()` vẫn ưu tiên gọi `pdfFrame.contentWindow.print()` để đẩy đúng tệp PDF gốc sang máy in.

---

## 3. Phương án B — Tự động mở thẳng hộp thoại In trình duyệt (`autoPrint` sau khi tải PDF xong)

### Lưu ý giới hạn trình duyệt
- Trình duyệt Web **không thể nhúng** cửa sổ Print Preview hệ thống (`Ctrl+P` kèm danh sách máy in bên phải) vào trong một thẻ `<div>` HTML của trang web vì cơ chế sandbox bảo mật.
- Tuy nhiên, có thể tự động **bật thẳng hộp thoại In gốc của trình duyệt** ngay khi mở trang in vận đơn mà không bắt người dùng bấm thêm một bước nào.

### Phương án triển khai kỹ thuật
1. **Tận dụng cờ `autoPrint` có sẵn tại [PrintRoutePage.jsx](file:///d:/ISP492-Do%20An/ISP490-FCentric/frontend/src/components/print/PrintRoutePage.jsx#L183-L189):**
   - Hiện tại `PrintRoutePage` gọi `handlePrint()` sau 300ms khi `data` sẵn sàng — với Shopee/TikTok, việc này sớm hơn thời điểm `ShopeeAwbDocument` tải xong Blob PDF từ `/api/v1/don-ban-hang/{id}/van-don-san`.
2. **Đồng bộ thời điểm kích hoạt:**
   - Truyền callback `onPdfReady` xuống `PrintTemplateDocument` -> `ShopeeAwbDocument`: chỉ gọi `handlePrint()` (`pdfFrame.contentWindow.print()`) sau khi `<iframe onLoad>` của `pdfUrl` kích hoạt xong.
   - Bổ sung tùy chọn cấu hình (hoặc query param `?autoPrint=1` từ nút **"In nhanh"**) để tránh trường hợp nhân viên chỉ muốn mở lên xem mã vận đơn nhưng trình duyệt bật ngay dialog in mỗi lần mở trang.
   - Kiểm tra tương thích trình duyệt (Chrome/Edge có thể chặn popup in tự động nếu mất chuỗi thao tác người dùng khi fetch API lâu > vài giây — cần fallback giữ nút **In phiếu** trên thanh header).

---

## 4. Tùy chọn mở rộng Backend (nếu sau này được phép thêm thư viện PDF)

- Hiện tại theo [coding-standards.md](file:///d:/ISP492-Do%20An/ISP490-FCentric/.agents/rules/coding-standards.md), hệ thống **không tự ý thêm dependency mới** vào `pom.xml`.
- Nếu sau này được phê duyệt thêm thư viện xử lý PDF (ví dụ **Apache PDFBox**):
  - Tại [ShopeeClient.java](file:///d:/ISP492-Do%20An/ISP490-FCentric/backend/src/main/java/com/dev/backend/services/shopee/ShopeeClient.java), kiểm tra kích thước `MediaBox`/`CropBox` của tệp PDF tải về từ `downloadShippingDocument`: nếu phát hiện là trang A4 (`~595 × 842 pt`) thuộc `NORMAL_AIR_WAYBILL` chứa 1 tem ở góc trên-trái, có thể crop chuẩn về khổ A6 (`100 × 150 mm`) trước khi trả qua `/van-don-san`.
