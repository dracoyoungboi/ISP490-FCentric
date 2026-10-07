# Thanh toán chuyển khoản payOS tại quầy

Khách quét mã QR ở màn **Bán hàng tại quầy**. Khi tiền về, hệ thống tự kiểm tra chữ ký và số tiền, rồi tạo đơn và trừ kho.

## 1. Cài đặt một lần

1. **Chạy migration.** Chạy `Database/payos_v1.sql` lên DB, sau khi đã chạy `pos_checkout_v1.sql`. File này chỉ thêm 2 bảng mới và chạy lại nhiều lần vẫn an toàn.
2. **Cài thư viện frontend.** Mở thư mục `frontend` rồi chạy `npm install`. Bước này cài thêm `qrcode.react` để vẽ mã QR.
3. **Chạy lại backend và frontend.**
4. **Nhập khóa payOS.** Đăng nhập bằng tài khoản admin, vào **Cài đặt thanh toán**, nhập **Client ID**, **API Key**, **Checksum Key** (lấy ở my.payos.vn → Kênh thanh toán), bấm **Lưu cấu hình**, rồi **Kiểm tra kết nối**.
5. **Bật payOS** bằng công tắc "Cho phép thanh toán chuyển khoản ở POS".
6. **Webhook** (không bắt buộc khi dev):
    - Chạy `ngrok http 8080`.
    - Dán `https://<link-ngrok>/api/v1/payos/webhook` vào ô Webhook URL.
    - Bấm **Đăng ký webhook với payOS**.

   Nếu không có webhook, màn POS vẫn tự hỏi payOS mỗi 3 giây, nên vẫn chạy được.

## 2. Bán hàng

1. Thêm hàng vào giỏ, bấm **F9**, chọn **Chuyển khoản (QR)**, rồi **Tạo mã QR**.
2. Hàng trong giỏ được **giữ chỗ** (cột `so_luong_da_dat`) để kênh khác không bán mất.
3. Khách quét mã và chuyển tiền. Màn hình tự hiện **Thanh toán thành công** kèm số hóa đơn SO….
4. Bấm **Hủy mã QR**, hoặc để mã hết hạn (mặc định 15 phút): hàng giữ chỗ được trả lại kho.

## 3. Bảo mật

- Khóa payOS được mã hóa AES-256-GCM trước khi lưu DB. API chỉ trả về dạng che (`ed71••••••••0ec63`).
- **Production bắt buộc** đặt biến môi trường `PAYMENT_CONFIG_SECRET` (một chuỗi dài, ngẫu nhiên, bí mật). Dev dùng giá trị mặc định ghi trong `application.properties`.
- Webhook chỉ được chấp nhận khi chữ ký HMAC-SHA256 khớp với Checksum Key. Sai chữ ký thì trả 400 và không có đơn nào được tạo.
- Không bao giờ ghi khóa payOS vào code, file `.properties` hay Git.

## 4. Trạng thái giao dịch (bảng `pos_payos_payment`)

| Trạng thái | Ý nghĩa | Hàng giữ chỗ |
|---|---|---|
| PENDING | Đang chờ khách quét QR | Đang giữ |
| PAID | Đã nhận tiền, đã tạo đơn và trừ kho | Đã chuyển thành xuất kho |
| CANCELLED | Thu ngân đã hủy | Đã trả lại |
| EXPIRED | Hết hạn | Đã trả lại |
| FAILED | payOS không tạo được QR | Đã trả lại |
| PAID_ERROR | Đã nhận tiền nhưng không tạo được đơn (vd. sai số tiền) | **Vẫn giữ.** Quản lý xử lý tay, không thu tiền lại của khách |

## 5. API

| Phương thức | Đường dẫn | Ai gọi |
|---|---|---|
| GET/PUT | `/api/v1/cau-hinh-thanh-toan/payos` | Admin |
| POST | `/api/v1/cau-hinh-thanh-toan/payos/kiem-tra-ket-noi` | Admin |
| POST | `/api/v1/cau-hinh-thanh-toan/payos/dang-ky-webhook` | Admin |
| GET | `/api/v1/pos/payment-methods` | Thu ngân |
| POST | `/api/v1/pos/payos/payment-links` | Thu ngân (tạo QR + giữ chỗ) |
| GET | `/api/v1/pos/payos/payment-links/{orderCode}` | Thu ngân (hỏi trạng thái) |
| POST | `/api/v1/pos/payos/payment-links/{orderCode}/cancel` | Thu ngân |
| POST | `/api/v1/payos/webhook` | payOS (công khai, kiểm chữ ký) |
