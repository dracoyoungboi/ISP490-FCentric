# NHẬT KÝ DỰ ÁN (PROJECT LOG)
## Phân Tích Chi Tiết Commit Revert: `d12b55c2f149b637ce5ac3da813e4df0a23e1225`

> **Nhánh thực hiện:** `main`  
> **Commit Hash:** `d12b55c2f149b637ce5ac3da813e4df0a23e1225`  
> **Tác giả:** `khangndhe186523 <khangndhe186523@fpt.edu.vn>`  
> **Thời gian:** `Fri Sep 18 03:16:34 2026 +0700`  
> **Commit Message:**  
> `Revert "feat: fix lại logic của reset-password, change password cả phần front-end lẫn back-end. Thêm otp khi đổi mật khẩu, thêm mật khẩu ban đầu random"`  
> `This reverts commit cfeb949ff0cdac21e28cd92cbc1225f3d7f32e1a.`  

---

## 1. TỔNG QUAN VỀ COMMIT REVERT

Commit **`d12b55c`** đã thực hiện **hủy bỏ hoàn toàn (revert)** tất cả các thay đổi được đưa vào từ commit trước đó là **`cfeb949`** (`feat: fix lại logic của reset-password, change password cả phần front-end lẫn back-end. Thêm otp khi đổi mật khẩu, thêm mật khẩu ban đầu random`).

### Thống kê khối lượng thay đổi:
* **Số file bị tác động:** 14 files
* **Số dòng code thay đổi:** `+43` dòng thêm vào, `-876` dòng bị loại bỏ.
* **Các file bị xóa bỏ hoàn toàn (Deleted):**
  1. `backend/src/main/resources/password-flow-migration.sql`
  2. `backend/src/main/resources/templates/password_flow.html`
  3. `password-flow-plan.md`

---

## 2. BA TÍNH NĂNG CHÍNH ĐÃ BỊ HỦY BỎ (REVERTED)

### 🔹 TÍNH NĂNG 1: Xác thực OTP qua Email khi Đổi Mật Khẩu (Change Password OTP)
* **Trước khi Revert (ở commit `cfeb949`):**
  - Quy trình đổi mật khẩu của người dùng đã đăng nhập chia làm 3 bước có bảo mật OTP:
    1. **Bước 1 (`REQUEST_OTP`):** Người dùng nhập mật khẩu hiện tại. Backend kiểm tra mật khẩu, nếu đúng thì sinh mã OTP ngẫu nhiên 6 số (`OtpType.CHANGE_PASSWORD`), lưu vào `GlobalCache` và gửi email chứa OTP qua template `password_flow.html`.
    2. **Bước 2 (`CONFIRM`):** Người dùng nhập 6 chữ số OTP qua component `OtpInputs.jsx` trên modal. Backend đối soát OTP.
    3. **Bước 3:** Nhập mật khẩu mới và xác nhận mật khẩu mới.
* **Sau khi Revert (về trạng thái ở commit `d12b55c`):**
  - Hủy bỏ hoàn toàn bước gửi và nhập OTP khi đổi mật khẩu.
  - Form đổi mật khẩu quay về dạng truyền thống (1 bước duy nhất): Nhập **Mật khẩu hiện tại** -> **Mật khẩu mới** -> **Xác nhận mật khẩu** -> Bấm **Đổi mật khẩu**.
  - Xóa bỏ enum `CHANGE_PASSWORD` trong `OtpType.java`.
  - Xóa 2 trường `step` và `otp` trong `ChangePasswordRequest.java`.

---

### 🔹 TÍNH NĂNG 2: Reset Mật Khẩu ngẫu nhiên khi Quên Mật Khẩu (Random Temporary Password)
* **Trước khi Revert (ở commit `cfeb949`):**
  - Khi người dùng bấm "Quên mật khẩu", sau khi xác thực mã OTP gửi về email thành công:
    - Frontend không yêu cầu người dùng nhập mật khẩu mới.
    - Backend tự động sinh một mật khẩu tạm thời ngẫu nhiên gồm 8 ký tự (`SecureRandom`), mã hóa BCrypt lưu vào DB, đồng thời gửi mật khẩu tạm thời này qua email của người dùng.
    - Cột `must_change_password` của tài khoản được đánh dấu thành `true`.
    - Giao diện `ForgotPassword.jsx` hiển thị thông báo: *"Mật khẩu tạm thời đã được gửi! Hãy kiểm tra email, đăng nhập bằng mật khẩu tạm thời và đổi lại mật khẩu mới."*
* **Sau khi Revert (về trạng thái ở commit `d12b55c`):**
  - Hủy bỏ hoàn toàn cơ chế sinh mật khẩu ngẫu nhiên và gửi mật khẩu tạm thời qua email.
  - Khôi phục lại luồng cũ: Người dùng sau khi nhập OTP hợp lệ sẽ chuyển sang Bước 3 trực tiếp trên màn hình `ForgotPassword.jsx` để tự đặt **Mật khẩu mới** và **Xác nhận mật khẩu**.
  - Payload gửi lên API `/api/v1/nguoi-dung/reset-password` bắt buộc phải có trường `password` do người dùng nhập.
  - Backend `ResetPasswordRequest.java` thêm lại trường `String password;`.
  - Xóa hàm `generateTemporaryPassword()` trong `NguoiDungService.java`.

---

### 🔹 TÍNH NĂNG 3: Bắt buộc đổi mật khẩu sau khi Đăng nhập (`must_change_password`)
* **Trước khi Revert (ở commit `cfeb949`):**
  - Hệ thống bổ sung cột `must_change_password BOOLEAN NOT NULL DEFAULT FALSE` vào bảng `nguoi_dung`.
  - Trong component layout chung `BackofficeLayout.jsx`, mỗi khi người dùng đăng nhập và load bất kỳ trang nào, hệ thống gọi API `nguoiDungService.getMe()`.
  - Nếu `response.data.mustChangePassword === true`, giao diện sẽ tự động bật `ChangePasswordModal` với prop `forceDirect={true}`, đồng thời khóa không cho người dùng bấm Hủy hay đóng modal (`onOpenChange={() => {}}`) cho đến khi đổi mật khẩu xong.
* **Sau khi Revert (về trạng thái ở commit `d12b55c`):**
  - Hủy bỏ hoàn toàn cơ chế cưỡng chế đổi mật khẩu:
    - Xóa bỏ cột `must_change_password` trong Entity `NguoiDung.java` và DTO `NguoiDungDto.java`.
    - Xóa file script migration `password-flow-migration.sql`.
    - Xóa bỏ `useEffect` gọi `getMe()` và component modal cưỡng chế đổi mật khẩu trong `BackofficeLayout.jsx`.

---

### 🔹 CẤU HÌNH & TÀI LIỆU PHỤ TRỢ:
* **Tệp tài liệu kế hoạch:** Xóa file `password-flow-plan.md` (chứa 553 dòng tài liệu kỹ thuật về luồng OTP & mật khẩu tạm).
* **Mẫu Email HTML:** Xóa file `backend/src/main/resources/templates/password_flow.html` dùng để gửi OTP và mật khẩu ngẫu nhiên.
* **Cấu hình CSDL:** `spring.datasource.password` trong `application.properties` được đổi từ `phanvilop6c` về lại `12345`.

---

## 3. DANH SÁCH CHI TIẾT 14 FILE BỊ TÁC ĐỘNG TRONG COMMIT REVERT

| STT | File thay đổi | Loại thay đổi | Chi tiết thay đổi cụ thể |
| :--- | :--- | :---: | :--- |
| 1 | `backend/src/main/java/com/dev/backend/constant/enums/OtpType.java` | **Modify** | Xóa enum `CHANGE_PASSWORD`, chỉ giữ lại `RESET_PASSWORD, VERIFY_ACCOUNT, SUPPLIER_MAIL_SIGN_KEY`. |
| 2 | `backend/src/main/java/com/dev/backend/dto/request/ChangePasswordRequest.java` | **Modify** | Xóa 2 trường `String step;` và `String otp;`. Chỉ giữ `currentPassword` và `newPassword`. |
| 3 | `backend/src/main/java/com/dev/backend/dto/request/ResetPasswordRequest.java` | **Modify** | Thêm lại trường `String password;` (bắt buộc người dùng gửi mật khẩu mới từ client). |
| 4 | `backend/src/main/java/com/dev/backend/dto/response/entities/NguoiDungDto.java` | **Modify** | Xóa trường `Boolean mustChangePassword;`. |
| 5 | `backend/src/main/java/com/dev/backend/entities/NguoiDung.java` | **Modify** | Xóa trường ánh xạ JPA `@Column(name = "must_change_password") Boolean mustChangePassword;`. |
| 6 | `backend/src/main/java/com/dev/backend/services/impl/entities/NguoiDungService.java` | **Modify (-134 lines)** | - Xóa hàm `generateTemporaryPassword()`.<br>- Xóa nhánh `REQUEST_OTP`, `CONFIRM` trong `changePassword()`.<br>- Xóa gửi mail mật khẩu tạm thời trong `resetPassword()`.<br>- Khôi phục logic lưu mật khẩu trực tiếp từ `rpRequest.getPassword()`. |
| 7 | `backend/src/main/resources/application.properties` | **Modify** | Đổi `spring.datasource.password` từ `phanvilop6c` về `12345`. |
| 8 | `backend/src/main/resources/password-flow-migration.sql` | **DELETED** | Xóa câu lệnh SQL: `ALTER TABLE nguoi_dung ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;`. |
| 9 | `backend/src/main/resources/templates/password_flow.html` | **DELETED** | Xóa template HTML email gửi OTP và mật khẩu ngẫu nhiên. |
| 10 | `frontend/src/components/ChangePasswordModal.jsx` | **Modify (-79 lines)** | - Xóa state `step` (`current-password`, `otp`, `new-password`).<br>- Xóa component `OtpInputs`.<br>- Xóa prop `forceDirect`.<br>- Quay về form nhập 1 lần 3 trường mật khẩu. |
| 11 | `frontend/src/components/backoffice/BackofficeLayout.jsx` | **Modify (-32 lines)** | Xóa hook kiểm tra `mustChangePassword` từ `nguoiDungService.getMe()` và xóa modal cưỡng chế. |
| 12 | `frontend/src/pages/ForgotPassword.jsx` | **Modify** | Khôi phục bước 3 (nhập `newPassword` & `confirmPassword`). Gửi kèm `password` trong payload gọi API reset. |
| 13 | `frontend/src/services/nguoiDungService.js` | **Modify** | Hàm `resetPassword({ username, otp, password })` nhận lại tham số `password` để truyền lên backend. |
| 14 | `password-flow-plan.md` | **DELETED (-553 lines)** | Xóa toàn bộ file kế hoạch thiết kế luồng đổi/quên mật khẩu. |

---

## 4. ĐÁNH GIÁ NGUYÊN NHÂN REVERT DƯỚI GÓC ĐỘ KỸ THUẬT

1. **Lỗi Không Đồng Bộ Cơ Sở Dữ Liệu:**  
   Commit `cfeb949` yêu cầu cột `must_change_password` trong bảng `nguoi_dung`, tuy nhiên JPA được cấu hình `ddl-auto=none` trong `application.properties`. Nếu người dùng hoặc môi trường dev chưa chạy tay file `password-flow-migration.sql`, toàn bộ câu truy vấn `SELECT` và `INSERT/UPDATE` liên quan đến `NguoiDung` sẽ ném ngoại lệ `BadSqlGrammarException: Unknown column 'must_change_password'`.
2. **Trải Nghiệm Người Dùng (UX Block):**  
   Việc nhúng kiểm tra `mustChangePassword` vào `BackofficeLayout.jsx` và chặn đóng modal (`onOpenChange={() => {}}`) dễ gây lỗi kẹt giao diện (UI lock) cho tất cả các tài khoản hiện có nếu dữ liệu cờ này bị `null` hoặc xử lý sai.
3. **Phụ Thuộc Cấu Hình Mail Server:**  
   Luồng đổi mật khẩu yêu cầu OTP gửi qua Email bắt buộc SMTP server phải hoạt động hoàn hảo. Nếu dịch vụ gửi email gặp sự cố, người dùng sẽ bị kẹt hoàn toàn và không thể đổi được mật khẩu.

---
*Ghi nhận bởi Senior Fullstack Developer - Ngày lập: 18/09/2026.*

