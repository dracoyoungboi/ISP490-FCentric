# BÁO CÁO PHÂN TÍCH TOÀN BỘ KIẾN TRÚC HỆ THỐNG FASHION MANAGEMENT (FSWMS)
> **Tác giả:** Senior Java Developer & Senior Frontend Developer  
> **Dự án:** Fashion Management System (Warehouse & Supply Chain Management)  
> **Ngày lập:** 18/09/2026  

---

## MỤC LỤC
1. [Tổng Quan Hệ Thống](#1-tổng-quan-hệ-thống)
2. [Cấu Trúc Toàn Diện Backend (Java Spring Boot)](#2-cấu-trúc-toàn-diện-backend-java-spring-boot)
   - 2.1. Tech Stack & Dependencies
   - 2.2. Mô hình kiến trúc phân lớp (Layered Architecture)
   - 2.3. Cơ chế Bảo mật, Phân quyền & AOP (`@RequireAuth`, JWT, Warehouse Permission)
   - 2.4. Danh mục 25 Controllers & Endpoints
   - 2.5. Tầng Service, Mapper, Repository & Database Entity Model
   - 2.6. Tích hợp ngoài: MinIO, Mail, Casso, Background Worker
3. [Cấu Trúc Toàn Diện Frontend (React + Vite)](#3-cấu-trúc-toàn-diện-frontend-react--vite)
   - 3.1. Tech Stack & Frontend Engineering Setup
   - 3.2. Cấu trúc thư mục & Modular Design
   - 3.3. Luồng Định tuyến (React Router v7) & ProtectedRoute
   - 3.4. Tầng Quản lý API (`apiClient.js` & Interceptors)
   - 3.5. Danh mục Pages & Components chức năng
4. [Phân Tích Chi Tiết: File Đóng Vai Trò Gọi Backend Reset Mật Khẩu Admin](#4-phân-tích-chi-tiết-file-đóng-vai-trò-gọi-backend-reset-mật-khẩu-admin)
   - 4.1. File Frontend chịu trách nhiệm gọi API
   - 4.2. File Component giao diện & Kích hoạt sự kiện
   - 4.3. File Backend tiếp nhận và xử lý nghiệp vụ
   - 4.4. Sơ đồ tuần tự End-to-End (Sequence Diagram)
   - 4.5. Chi tiết mã nguồn từng file liên quan
5. [Đánh Giá Chuyên Môn & Đề Xuất Tối Ưu Hóa](#5-đánh-giá-chuyên-môn--đề-xuất-tối-ưu-hóa)
6. [Khảo Sát Hiện Trạng & Kế Hoạch Triển Khai Tích Hợp Kênh Bán Lẻ Shopify (Mô Hình Đơn Doanh Nghiệp - Cấu Hình Token Tĩnh)](#6-khảo-sát-hiện-trạng--kế-hoạch-triển-khai-tích-hợp-kênh-bán-lẻ-shopify-mô-hình-đơn-doanh-nghiệp---cấu-hình-token-tĩnh)
   - 6.1. Đánh giá tính khả thi & Quyết định kiến trúc (Tinh giản bỏ SaaS, dùng Token tĩnh)
   - 6.2. Ma trận đối soát hiện trạng tinh gọn: Sẵn có vs Cần bổ sung
   - 6.3. Đặc tả kiến trúc kỹ thuật 4 khối cốt lõi tinh giản
   - 6.4. Thiết kế Cơ sở dữ liệu & Cấu hình hệ thống (Không dùng Multi-tenant)
   - 6.5. Kế hoạch và Lộ trình triển khai tinh gọn (4 Giai đoạn)

---

## 1. TỔNG QUAN HỆ THỐNG

Dự án **Fashion Management** là một hệ thống quản lý tổng thể chuỗi cung ứng - kho hàng thời trang (Fashion Warehouse Management System - FSWMS), bao gồm các phân hệ chính:
- **Quản trị người dùng & Phân quyền (RBAC + ABAC theo Kho)**: Quản trị viên, Quản lý kho, Nhân viên kho, Nhân viên bán hàng, Nhân viên mua hàng, Khách hàng, Nhà cung cấp.
- **Quản lý Danh mục & Sản phẩm thời trang đa biến thể**: Thuộc tính (Chất liệu, Màu sắc, Kích cỡ), Cây phân cấp danh mục quần áo, SKU Builder, Quản lý barcode/mã vạch.
- **Nghiệp vụ Quản lý Kho**: Quản lý lô hàng (Lot/Batch), Nhập kho (Goods Receipt), Xuất kho (Goods Issue), Điều chuyển nội bộ (Internal Transfer), Kiểm kê kho (Stocktaking), Điều chỉnh tồn kho, Lịch sử giao dịch kho (Stock Ledger/Card).
- **Quy trình Mua hàng (Procurement)**: Yêu cầu mua hàng, Yêu cầu báo giá tới nhà cung cấp, Cổng portal chào giá cho Nhà cung cấp (Supplier Quotation Portal), Đơn đặt mua hàng (Purchase Order).
- **Quy trình Bán hàng (Sales Order)**: Báo giá, Đơn bán hàng, Hóa đơn (Invoice), Quản lý khách hàng.
- **Báo cáo & Thống kê**: Doanh thu, Nhật ký xuất nhập tồn, Báo cáo theo khách hàng, Dashboard điều hành.

Hệ thống được thiết kế theo kiến trúc Client-Server phân tách hoàn toàn (Decoupled SPA & RESTful API), giao tiếp qua giao thức HTTPS/JSON và WebSocket/MinIO S3.

---

## 2. CẤU TRÚC TOÀN DIỆN BACKEND (JAVA SPRING BOOT)

### 2.1. Tech Stack & Dependencies
- **Core Framework:** Spring Boot 3.5.5, Java 17 (LTS).
- **Security:** Spring Security 6, Spring OAuth2 Resource Server, JJWT (`io.jsonwebtoken:jjwt-api:0.11.5`), BCrypt Password Encoder.
- **Persistence / ORM:** Spring Data JPA, Hibernate ORM, MySQL Connector/J.
- **Object Storage:** MinIO Java Client (`io.minio:minio:8.5.12`) để lưu trữ ảnh biến thể, file tài liệu, chứng từ kho.
- **Real-time & Communication:** Spring WebSocket, Spring Boot Mail (`JavaMailSender`).
- **Scheduling:** Spring `@Scheduled` worker job để dọn dẹp mã OTP và xử lý tiến trình ngầm.
- **API Documentation:** SpringDoc OpenAPI 3 / Swagger UI (`org.springdoc:springdoc-openapi-starter-webmvc-ui`).
- **Productivity & Mapping:** Lombok, MapStruct / Custom Mappers.

### 2.2. Mô hình kiến trúc phân lớp (Layered Architecture)
Mã nguồn backend nằm tại package gốc `com.dev.backend` được chia thành các package chuẩn Enterprise:

```
backend/src/main/java/com/dev/backend/
├── BackendApplication.java             # Entry point khởi chạy Spring Boot Application
├── config/                             # Cấu hình hạt nhân (Security, CORS, AOP, MinIO, OpenAPI, Mail)
├── constant/                           # Biến hằng, Enum định nghĩa vai trò, trạng thái, thao tác
│   ├── enums/                          # RoleType, FileType, FilterOperation, OtpType...
│   └── variables/                      # IRoleType, IPermissionType, ITable...
├── controller/                         # 25 REST Controllers tiếp nhận HTTP Requests
├── customizeanotation/                 # Custom Annotation (@RequireAuth)
├── dto/                                # Data Transfer Objects
│   ├── request/                        # Request Payloads (Filter, Login, Reset, DTO tạo mới...)
│   └── response/                       # Response Wrapper (ResponseData<T>, Entity DTOs...)
├── entities/                           # 38 JPA Entities ánh xạ CSDL quan hệ (MySQL)
├── exception/                          # Xử lý ngoại lệ toàn cục (@RestControllerAdvice)
├── mapper/                             # 26 Mapper chuyển đổi giữa Entity và DTO
├── repository/                         # 37 Spring Data JPA Repositories (CRUD & Querydsl/Native SQL)
├── services/                           # Interface & Implementation logic nghiệp vụ
│   ├── BaseService.java                # Base Service generic hỗ trợ dynamic filter/sort
│   ├── JwtService.java, MinioService.java, EmailService.java...
│   └── impl/
│       ├── BaseServiceImpl.java
│       ├── entities/                   # 32 Services tương ứng từng thực thể nghiệp vụ
│       ├── multitable/                 # Service tổng hợp báo cáo (Dashboard, Báo cáo DT...)
│       └── utils/                      # Service tiện ích (JWT, Mail, MinIO, Casso)
└── workers/                            # Background Scheduled Jobs
```

### 2.3. Cơ chế Bảo mật, Phân quyền & AOP (`@RequireAuth`, JWT, Warehouse Permission)
Hệ thống sử dụng cơ chế bảo mật kết hợp hai tầng:
1. **Spring Security Filter Chain (`SecurityConfig.java`)**:
   - `requestMatchers("/**").permitAll()`: Bỏ qua kiểm tra URL cứng ở security filter chain để ủy quyền toàn bộ cho tầng Aspect AOP.
   - Quản lý mã hóa mật khẩu thông qua bean `PasswordEncoder` (`BCryptPasswordEncoder`).
   - Cấu hình CORS mở rộng cho phép Web SPA Frontend giao tiếp.
2. **Dynamic RBAC & ABAC via Spring AOP (`AuthorizationAspect.java` + `@RequireAuth`)**:
   - Custom Annotation `@RequireAuth`:
     ```java
     @Target(ElementType.METHOD)
     @Retention(RetentionPolicy.RUNTIME)
     public @interface RequireAuth {
         String[] roles() default {};
         LogicType rolesLogic() default LogicType.OR;
         boolean inWarehouse() default false;
         String[] permissions() default {};
         LogicType permissionsLogic() default LogicType.OR;
     }
     ```
   - **Xác thực danh tính**: AOP Aspect bóc tách header `Authorization: Bearer <token>`, gọi `JwtService` để giải mã claims thành `NguoiDungAuthInfo`.
   - **Phân quyền vai trò (RBAC)**: Nếu vai trò là `quan_tri_vien`, mặc định Bypass toàn bộ quyền (Full System Access). Nếu là vai trò khác, đối chiếu danh sách `roles` quy định.
   - **Phân quyền theo kho (ABAC)**: Nếu `inWarehouse = true`, Aspect đọc header `kho_id`, xác thực người dùng có thuộc kho đó hay không và kiểm tra quyền chi tiết (Read/Write/Approve) trong `PhanQuyenNguoiDungKho`.

### 2.4. Danh mục 25 REST Controllers
Backend cung cấp 25 REST Controllers toàn diện:
1. `AdminController.java`: Quản trị User (danh sách, filter, thêm user, reset password, toggle status).
2. `AdminDashboardController.java`: Thống kê tổng hợp cho Admin và Quản lý kho.
3. `NguoiDungController.java`: Authentication (Login, Refresh token, Profile, Forgot/Change Password).
4. `KhoController.java`: Quản lý danh mục kho hàng, cấu hình kho.
5. `LichSuGiaoDichKhoController.java`: Sổ thẻ kho, nhật ký biến động kho.
6. `LoHangController.java`: Quản lý Lô sản xuất, ngày sản xuất, hạn sử dụng.
7. `SanPhamQuanAoController.java`: Quản lý sản phẩm gốc (Parent product).
8. `NghiepVuSanPhamController.java`: Quản lý biến thể sản phẩm, barcode, giá vốn/giá bán.
9. `DanhMucQuanAoController.java`: Cây danh mục sản phẩm đa cấp.
10. `ChatLieuController.java`: Thuộc tính chất liệu.
11. `MauSacController.java`: Thuộc tính màu sắc.
12. `SizeController.java`: Thuộc tính kích cỡ.
13. `PhieuNhapKhoController.java`: Quy trình nhập kho từ nhà cung cấp/chuyển kho.
14. `PhieuXuatKhoController.java`: Quy trình xuất kho bán hàng/xuất hủy/xuất chuyển.
15. `PhieuChuyenKhoController.java`: Điều chuyển hàng hóa liên kho.
16. `PhieuKiemKeController.java`: Đợt kiểm kê, đối soát số lượng thực tế & hệ thống.
17. `DonBanHangController.java`: Quản lý đơn hàng bán buôn/bán lẻ, xuất hóa đơn.
18. `DonMuaHangController.java`: Đơn đặt hàng nhà cung cấp (Purchase Order).
19. `YeuCauMuaHangController.java`: Yêu cầu mua sắm nội bộ (Purchase Request).
20. `NhaCungCapController.java`: Quản lý hồ sơ nhà cung cấp.
21. `KhachHangController.java`: Hồ sơ khách hàng, công nợ.
22. `KhachHangReportController.java`: Báo cáo hành vi và doanh số khách hàng.
23. `NhatKyNhapXuatController.java`: Báo cáo tổng hợp Nhập - Xuất - Tồn.
24. `ThongKeHeThongController.java`: Biểu đồ KPI và số liệu tài chính hệ thống.
25. `DieuHanhHeThongController.java`: Điều hành tiến trình phê duyệt, trạng thái chứng từ.

---

## 3. CẤU TRÚC TOÀN DIỆN FRONTEND (REACT + VITE)

### 3.1. Tech Stack & Frontend Engineering Setup
- **Framework & Build tool:** React 19.2.0, Vite 7.2.4 (ES Modules, HMR siêu tốc).
- **Styling & UI Kit:** Tailwind CSS v4, PostCSS, Radix UI Primitives (Accordion, Dialog, DropdownMenu, Popover, Select, Tabs...), Lucide React Icons.
- **Routing:** React Router v7 (`react-router-dom: ^7.12.0`).
- **HTTP Client:** Axios 1.13.2 với Interceptor hai chiều (Request/Response).
- **Form Management & Validation:** React Hook Form (`^7.70.0`), Zod / Yup resolvers.
- **Charts & Data Visualization:** Recharts (`^2.15.4`).
- **Notifications:** Sonner Toast (`sonner: ^2.0.7`), React Hot Toast.
- **Utility Libraries:** `jwt-decode`, `clsx`, `tailwind-merge`, `date-fns`, `react-to-print` (In phiếu kho/hóa đơn), `react-barcode`.

### 3.2. Cấu trúc thư mục & Modular Design
Mã nguồn frontend tại `frontend/src/` được tổ chức dạng Feature-driven & Component-based:

```
frontend/src/
├── App.jsx                             # Định nghĩa hệ thống Routing trung tâm & Protected Routes
├── main.jsx                            # Entry point khởi tạo React DOM
├── index.css                           # Toàn bộ Style Tailwind, tokens & theme CSS
├── components/                         # UI Components tái sử dụng
│   ├── admin/                          # Component dành riêng cho Admin (Phân quyền, Matrix...)
│   ├── auth/                           # ProtectedRoute, AuthShell, OtpInputs...
│   ├── backoffice/                     # Layout chính: Header, Sidebar, PageContainer...
│   ├── shared/                         # FilterBar, SearchInput, TableShell, StatusBadge, SurfaceCard
│   └── ui/                             # Bộ thư viện UI nguyên tử chuẩn Shadcn (Button, Input, Dialog...)
├── pages/                              # Các màn hình theo từng phân hệ chức năng
│   ├── admin/                          # 6 Màn hình Admin (User list, Add, Detail, Reset PW, Roles...)
│   ├── attribute/                      # Thuộc tính sản phẩm (Màu sắc, Size, Chất liệu)
│   ├── bao-cao/                        # Báo cáo doanh thu, NXT, Tồn kho tổng quan
│   ├── chuyenKhoNoiBo/                 # Phiếu chuyển kho
│   ├── customer/                       # Quản lý khách hàng
│   ├── danh-muc-quan-ao/               # Cây danh mục sản phẩm
│   ├── dashboard/                      # Dashboard tổng quan
│   ├── issue/                          # Phiếu xuất kho
│   ├── lich-su-giao-dich-kho/          # Lịch sử giao dịch kho
│   ├── order/                          # Mua hàng & Yêu cầu báo giá
│   ├── product/                        # Quản lý sản phẩm & SKU Builder
│   ├── receipt/                        # Phiếu nhập kho & Khai báo lô
│   ├── sales-orders/                   # Đơn bán hàng & Báo giá
│   ├── stock-take/                     # Phiếu kiểm kê
│   ├── supplier/                       # Quản lý Nhà cung cấp & Supplier Portal
│   ├── warehouse/                      # Quản lý Kho hàng
│   ├── ForgotPassword.jsx              # Quên mật khẩu cho người dùng
│   ├── Login.jsx                       # Đăng nhập hệ thống
│   └── UserDetail.jsx                  # Hồ sơ cá nhân người dùng
├── services/                           # 25 Files API Clients gọi Backend qua Axios
│   ├── apiClient.js                    # Cấu hình Axios Instance, token injection & error handler
│   ├── adminService.js                 # API Service dành riêng cho Admin
│   ├── nguoiDungService.js             # API Service Authentication & User Profile
│   └── ... (23 domain-specific services)
├── hooks/                              # Custom React Hooks
├── constants/                          # Cấu hình quyền hạn, biến tĩnh
└── utils/                              # Hàm định dạng tiền tệ, ngày tháng, token storage
```

### 3.3. Tầng Quản lý API (`apiClient.js` & Interceptors)
Tất cả các API calls đều đi qua `frontend/src/services/apiClient.js`:
- **Base URL:** Đọc từ `import.meta.env.VITE_API_URL` hoặc fallback về `http://localhost:8080`.
- **Request Interceptor:** Tự động kiểm tra `localStorage.getItem("access_token")` và `localStorage.getItem("selected_kho_id")`. Đính kèm tự động vào headers:
  - `Authorization: Bearer <access_token>`
  - `kho_id: <selected_kho_id>`
- **Response Interceptor:** Bắt lỗi trả về từ Backend. Nếu gặp lỗi `ACCOUNT_DISABLED` (tài khoản bị khóa), tự động dọn sạch session trong `localStorage`, hiển thị thông báo lỗi qua `sonner toast` và điều hướng về trang `/login`.

---

## 4. PHÂN TÍCH CHI TIẾT: FILE ĐÓNG VAI TRÒ GỌI BACKEND RESET MẬT KHẨU ADMIN

Đây là câu hỏi trọng tâm được yêu cầu. Dưới góc độ Senior Java & Frontend Developer, chúng tôi chỉ rõ chính xác từng file và vai trò trong luồng này:

### 4.1. File ĐÓNG VAI TRÒ GỌI BACKEND TRỰC TIẾP (API Caller):
👉 **CHÍNH XÁC LÀ FILE:**  
`Fashion-Management/frontend/src/services/adminService.js`

**Đoạn mã chịu trách nhiệm gọi HTTP Request:**
```javascript
// Đường dẫn: frontend/src/services/adminService.js (Dòng 31 - 33)
resetUserPasswordByAdmin(userId, payload) {
    return apiClient.post(`/api/v1/admin/users/${userId}/reset-password`, payload);
}
```
- **Phương thức:** `POST`
- **URL Path:** `/api/v1/admin/users/${userId}/reset-password`
- **Payload truyền vào:** `{ newPassword: "<mật_khẩu_mới>" }`
- **Header đính kèm:** `Authorization: Bearer <token_admin>`

---

### 4.2. File Component Giao Diện & Kích Hoạt Sự Kiện (Caller Invoker):
1. **File thực hiện gọi hàm service:**  
   `Fashion-Management/frontend/src/pages/admin/ResetUserPasswordByAdmin.jsx`  
   - Import `adminService` từ `@/services/adminService`.
   - Lấy `id` của user cần reset từ đường dẫn URL (`useParams()`).
   - Hàm `handleSubmit` (dòng 38 - 40):
     ```javascript
     await adminService.resetUserPasswordByAdmin(id, {
         newPassword: password
     });
     ```
   - Khi thành công, thông báo qua `toast.success("Reset mật khẩu thành công")` và chuyển trang về danh sách `/users`.

2. **File khởi nguồn điều hướng giao diện (UI Trigger):**  
   `Fashion-Management/frontend/src/pages/admin/ViewUserListByAdmin.jsx`  
   - Tại dòng 515 - 526: Nút **"Reset"** trên bảng danh sách người dùng bắt sự kiện `onClick`:
     ```javascript
     navigate(`/users/${u.id}/reset-password`);
     ```

3. **File cấu hình tuyến đường (Router):**  
   `Fashion-Management/frontend/src/App.jsx`  
   - Tại dòng 112 - 115:
     ```jsx
     <Route
       path="/users/:id/reset-password"
       element={<ResetUserPasswordByAdmin />}
     />
     ```

---

### 4.3. File Backend Tiếp Nhận & Xử Lý Nghiệp Vụ:
1. **Controller tiếp nhận HTTP Request:**  
   `Fashion-Management/backend/src/main/java/com/dev/backend/controller/AdminController.java`  
   - Endpoint: `@PostMapping("/users/{id}/reset-password")` (dòng 117 - 136).
   - Bảo mật AOP: `@RequireAuth(roles = {IRoleType.quan_tri_vien})`.
   - Gọi tiếp xuống tầng Service: `nguoiDungService.updateUserByAdmin(id, request)`.

2. **Request DTO hứng dữ liệu:**  
   `Fashion-Management/backend/src/main/java/com/dev/backend/dto/request/AdminUpdateRequest.java`  
   - Chứa thuộc tính: `private String newPassword;`.

3. **Service xử lý mã hóa mật khẩu & cập nhật CSDL:**  
   `Fashion-Management/backend/src/main/java/com/dev/backend/services/impl/entities/NguoiDungService.java`  
   - Phương thức: `updateUserByAdmin(Integer userId, AdminUpdateRequest request)` (dòng 379 - 393):
     ```java
     @Transactional
     public void updateUserByAdmin(Integer userId, AdminUpdateRequest request) {
         NguoiDung nguoiDung = nguoiDungRepository.findById(userId)
                 .orElseThrow(() -> new CommonException("Không tìm thấy người dùng"));

         // reset password
         if (request.getNewPassword() != null && !request.getNewPassword().isBlank()) {
             nguoiDung.setMatKhauHash(
                     passwordEncoder.encode(request.getNewPassword())
             );
         }

         nguoiDung.setNgayCapNhat(Instant.now());
         nguoiDungRepository.save(nguoiDung);
     }
     ```
   - Sử dụng `passwordEncoder.encode(...)` (BCrypt hashing) để mã hóa mật khẩu an toàn trước khi lưu vào CSDL MySQL.

4. **Entity & Repository tương tác CSDL:**  
   - Repository: `backend/src/main/java/com/dev/backend/repository/NguoiDungRepository.java`
   - Entity: `backend/src/main/java/com/dev/backend/entities/NguoiDung.java` (cập nhật cột `mat_khau_hash`, `ngay_cap_nhat`).

---

### 4.4. Sơ Đồ Tuần Tự End-to-End (Sequence Diagram)

```
[Admin User (Browser)]
       │
       │ 1. Click "Reset" tại bảng User
       ▼
[ViewUserListByAdmin.jsx]
       │
       │ 2. navigate('/users/:id/reset-password')
       ▼
[ResetUserPasswordByAdmin.jsx]
       │
       │ 3. Nhập mật khẩu mới & click "Cập nhật mật khẩu"
       │ 4. Gọi adminService.resetUserPasswordByAdmin(id, { newPassword })
       ▼
[adminService.js]  <======= FILE ĐÓNG VAI TRÒ GỌI BACKEND TRỰC TIẾP
       │
       │ 5. Gọi apiClient.post('/api/v1/admin/users/:id/reset-password', payload)
       ▼
[apiClient.js (Axios)]
       │
       │ 6. Gắn Header "Authorization: Bearer <JWT>" & "kho_id"
       │ 7. HTTP POST /api/v1/admin/users/:id/reset-password
       ▼
[Spring Boot: AuthorizationAspect.java]
       │
       │ 8. Kiểm tra JWT token, xác nhận vai trò: quan_tri_vien (Admin)
       ▼
[AdminController.java]
       │
       │ 9. Gọi nguoiDungService.updateUserByAdmin(id, request)
       ▼
[NguoiDungService.java]
       │
       │ 10. Tìm NguoiDung theo ID trong MySQL
       │ 11. BCryptPasswordEncoder.encode(newPassword)
       │ 12. nguoiDung.setMatKhauHash(...) & setNgayCapNhat(...)
       │ 13. nguoiDungRepository.save(nguoiDung)
       ▼
[MySQL: Bảng nguoi_dung]
       │
       │ 14. UPDATE `nguoi_dung` SET mat_khau_hash = '...', ngay_cap_nhat = '...'
       ▼
[Phản hồi HTTP 200 OK: ResponseData<Void>]
       │
       │ 15. { status: 200, message: "Admin reset mật khẩu cho người dùng thành công" }
       ▼
[ResetUserPasswordByAdmin.jsx]
       │
       │ 16. toast.success("Reset mật khẩu thành công") & navigate('/users')
```

---

## 5. ĐÁNH GIÁ CHUYÊN MÔN & ĐỀ XUẤT TỐI ƯU HÓA

### Điểm mạnh kiến trúc:
1. **Frontend**:
   - Sử dụng React 19 kết hợp Vite cho thời gian build cực nhanh.
   - Bố cục code theo Component và Service rõ ràng, tách bạch giữa UI logic và Network call.
   - Tận dụng sức mạnh của Radix UI + Tailwind CSS tạo ra giao diện chuẩn Backoffice Enterprise sắc nét, responsive tốt.
   - Cơ chế chặn tài khoản bị khóa (`ACCOUNT_DISABLED`) ngay tại Axios Interceptor rất chặt chẽ.
2. **Backend**:
   - Áp dụng Spring Boot 3 hiện đại với Java 17.
   - Thiết kế AOP `@RequireAuth` rất sáng tạo, tách biệt kiểm tra quyền ra khỏi nghiệp vụ cốt lõi, hỗ trợ phân quyền kép (Vai trò + Kho hàng).
   - Bảo mật mật khẩu chuẩn công nghiệp với BCrypt hashing.

### Điểm có thể nâng cấp thêm:
1. **Validation mật khẩu phía Backend**:
   - Hiện tại `AdminUpdateRequest` chỉ kiểm tra `!request.getNewPassword().isBlank()`. Nên bổ sung `@Pattern` hoặc validation kiểm tra độ mạnh mật khẩu (độ dài tối thiểu 8 ký tự, có chữ hoa, chữ số, ký tự đặc biệt) để tránh mật khẩu quá yếu.
2. **Audit Log (Nhật ký thay đổi)**:
   - Trong `NguoiDungService.updateUserByAdmin`, nên ghi thêm một bản ghi vào bảng `LichSuThayDoi` (Audit Log) ghi nhận: Admin nào đã thực hiện reset mật khẩu cho tài khoản nào vào thời điểm nào để phục vụ đối soát an toàn thông tin.

---

## 6. KHẢO SÁT HIỆN TRẠNG & KẾ HOẠCH TRIỂN KHAI TÍCH HỢP KÊNH BÁN LẺ SHOPIFY (MÔ HÌNH ĐƠN DOANH NGHIỆP - CẤU HÌNH TOKEN TĨNH)

> **Người lập:** Senior Enterprise System Architect & Fullstack Tech Lead  
> **Căn cứ điều chỉnh:** Tinh giản toàn bộ cơ chế SaaS / Multi-tenant, chuyển sang giải pháp tích hợp trực tiếp cho một cửa hàng Shopify duy nhất của doanh nghiệp. Sử dụng cơ chế cấu hình/hardcode Token tĩnh (Custom App Token) qua `application.properties` (Backend) và `.env` (Frontend).

### 6.1. Đánh giá Tính khả thi & Quyết định Kiến trúc (Tinh Giản Bỏ SaaS, Dùng Token Tĩnh)
- **Đánh giá chung:** Việc bỏ mô hình SaaS đa người thuê (Multi-tenant) và chuyển sang cấu hình Token tĩnh giúp hệ thống trở nên **gọn nhẹ, ổn định vượt trội, giảm thiểu 70% độ phức tạp** và rút ngắn đáng kể thời gian đưa vào vận hành thực tế.
- **Những lợi ích kỹ thuật then chốt sau khi tinh giản:**
  1. **Loại bỏ hoàn toàn Redis:** Không còn nhu cầu lưu trữ OAuth State tạm thời để chống CSRF trong luồng đăng nhập nhiều bên, tiết kiệm tài nguyên hạ tầng và không cần cài đặt thêm service Redis.
  2. **Không cần luồng OAuth 2.0 phức tạp:** Không cần xây dựng Redirect URL, Authorization Code exchange, không cần đăng ký ứng dụng lên Shopify Partner App Store. Doanh nghiệp chỉ cần tạo một **Custom App** trực tiếp trong trang quản trị Shopify Admin của cửa hàng và cấp quyền 1 lần duy nhất để lấy Token vĩnh viễn (`shpat_...`).
  3. **Không cần mã hóa đối xứng AES-256 động:** Do không phải lưu trữ và quản lý token của hàng nghìn khách hàng thuê bao trong database, token của cửa hàng được cấu hình trực tiếp trong `application.properties` (hoặc biến môi trường hệ thống), đảm bảo an toàn tuyệt đối ở tầng server.
  4. **Singleton Client hiệu năng cao:** Thay vì Dynamic Client Factory phức tạp giải mã token theo từng request, Backend chỉ cần một Spring Bean Singleton `ShopifyClient` duy nhất, sử dụng `RestClient` của Spring Boot 3.5 nạp sẵn cấu hình ngay khi ứng dụng khởi động.
  5. **Bảo toàn 100% nghiệp vụ lõi:** Vẫn đáp ứng trọn vẹn luồng tra cứu/giỏ hàng/thanh toán phía Storefront, mở Theme Editor ngoài tab mới, và pipeline tiếp nhận Webhook thời gian thực để trừ tồn kho tự động theo SKU.

---

### 6.2. Ma trận Đối soát Hiện trạng Tinh gọn: Sẵn Có vs Cần Bổ Sung

Dưới đây là bảng đối chiếu sau khi đã lược bỏ toàn bộ các yêu cầu thừa của SaaS:

| Khối Kiến Trúc | Hạng Mục Chi Tiết | Trạng Thái Codebase | Đánh Giá & Phương Án Triển Khai Tinh Gọn |
| :--- | :--- | :---: | :--- |
| **1. Phân quyền API & Kiến trúc Token** | **Storefront API Token** (Frontend React catalog, cart, checkout) | ❌ **CHƯA CÓ** | Cấu hình trực tiếp `VITE_SHOPIFY_STOREFRONT_TOKEN` trong `.env` của React. Tạo service gọi Shopify Storefront GraphQL (`cartCreate`, `cartLinesAdd`) lấy `checkoutUrl`. |
| | **Admin API Token** (Backend đồng bộ tồn kho, webhook, theme) | ❌ **CHƯA CÓ** | Cấu hình trực tiếp `shopify.admin-api-token` trong `application.properties`. Sử dụng token Custom App (`shpat_...`) cấp quyền vĩnh viễn. |
| | **Cơ chế Webhook thời gian thực** (Nhận trạng thái mua bán) | ❌ **CHƯA CÓ** | Cấu hình `shopify.webhook-secret` cố định. Xây dựng Controller tiếp nhận Webhook HTTP POST thời gian thực. |
| **2. Cấu hình Token Tĩnh & Client Service** | **Cấu hình Token tập trung** (Thay thế OAuth 2.0 & Redis) | ⚠️ **CẦN BỔ SUNG** | Khai báo cấu hình `shopify.*` trong `application.properties`. Không cần cài Redis, không cần viết luồng OAuth Redirect. |
| | **Shopify Singleton Client** (Thay thế Dynamic Factory) | ❌ **CHƯA CÓ** | Xây dựng bean `ShopifyClient` duy nhất dùng `RestClient` của Spring Boot 3.5, nạp sẵn Domain và Token cố định. |
| | **Đơn giản hóa Quản lý Tenant** (Bỏ hoàn toàn Multi-tenant) | ✅ **PHÙ HỢP HIỆN TRẠNG** | Giữ nguyên kiến trúc Đơn doanh nghiệp của FSWMS, không cần bổ sung cột `tenant_id` vào các bảng CSDL. |
| **3. Theme Customizer** | **Mở Theme Editor tab mới** (Khắc phục chặn CSP/iframe) | ❌ **CHƯA CÓ** | Backend dùng `ShopifyClient` gọi `GET /admin/api/{version}/themes.json` lọc theme có `role='main'`, trả URL editor cho React mở qua `window.open`. |
| **4. Xử lý Webhook & Database nội bộ** | **Xác thực chữ ký HMAC-SHA256** | ❌ **CHƯA CÓ** | Viết `ShopifyHmacValidator` tính HMAC-SHA256 trên raw body với `shopify.webhook-secret` cố định trong cấu hình. |
| | **Bảng log chống trùng lặp Webhook** | ❌ **CHƯA CÓ** | Tạo bảng `webhook_events_log` đơn giản lưu `event_id` để tránh xử lý trùng khi Shopify retry. |
| | **Bảng `don_ban_hang` & `chi_tiet_don_ban_hang`** | ✅ **ĐÃ CÓ SẴN (85%)** | Tận dụng 100% thực thể hiện tại. Chỉ cần thêm các cột đa kênh đơn giản: `channel = 'SHOPIFY'`, `external_order_id`, `financial_status`, `fulfillment_status`, `payment_method`. |
| | **Đối soát SKU & Trừ tồn kho DB** | ✅ **ĐÃ CÓ SẴN (90%)** | Đã có sẵn `BienTheSanPham.maSku`, `TonKhoTheoLo`, `LichSuGiaoDichKho`. Chỉ cần viết service bóc tách `line_items` để gọi hàm trừ kho có sẵn. |

---

### 6.3. Đặc tả Kiến trúc Kỹ thuật 4 Khối Cốt Lõi Tinh Giản

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      KIẾN TRÚC TÍCH HỢP SHOPIFY ĐƠN DOANH NGHIỆP                 │
└──────────────────────────────────────────────────────────────────────────────────┘

   [ KHÁCH HÀNG (BROWSER) ]                [ ADMIN DOANH NGHIỆP (REACT) ]
              │                                          │
    (1) Xem hàng / Giỏ hàng                    (A) Bấm "Chỉnh sửa Theme"
        Storefront GraphQL Token                   hoặc xem Đơn hàng
              │                                          │
              ▼                                          ▼
   [ Shopify Storefront API ]                 [ Spring Boot 3.5 Backend ]
              │                                          │
    (2) Lấy checkoutUrl                         - Đọc shopify.admin-api-token
    (3) Redirect thanh toán                     - Đọc shopify.webhook-secret
              │                                          │
              ▼                                          ▼
   [ Shopify Checkout (PCI-DSS) ]             [ Singleton ShopifyClient ]
              │                                          │
     Khách thanh toán thành công                         │ (B) Gọi GET themes.json
              │                                          │     lấy theme active
              ▼                                          ▼
    [ SHOPIFY WEBHOOK SERVICE ]                [ Shopify Admin REST API ]
              │
              │ HTTP POST /api/v1/webhooks/shopify
              │ (Kèm Header: X-Shopify-Hmac-Sha256)
              ▼
   [ Spring Boot: ShopifyWebhookController ]
              │
              ├─ 1. Xác thực HMAC với shopify.webhook-secret (Cố định)
              ├─ 2. Kiểm tra Idempotency qua webhook_events_log
              ├─ 3. TRẢ NGAY HTTP 200 OK (< 100ms)
              │
              ▼ (Bắn sang tiến trình ngầm @Async)
   [ WebhookOrderProcessor ]
              │
              ├─ 4. Bóc tách line_items: SKU, Số lượng, Giá
              ├─ 5. Tra cứu BienTheSanPham trong MySQL nội bộ qua ma_sku
              ├─ 6. Tạo DonBanHang (channel = 'SHOPIFY') & ChiTietDonBanHang
              └─ 7. Trừ tồn kho tổng qua TonKhoTheoLo & Ghi LichSuGiaoDichKho
```

#### Khối 1: Phân Quyền API & Kiến Trúc Token Cố Định
- **Storefront API Token (Frontend React):**
  - Cấu hình qua biến môi trường `.env`: `VITE_SHOPIFY_STORE_DOMAIN` và `VITE_SHOPIFY_STOREFRONT_TOKEN`.
  - Frontend dùng token này để truy vấn danh mục hiển thị công khai, xử lý giỏ hàng (`cartCreate`, `cartLinesAdd`) và lấy `checkoutUrl`.
  - Khách hàng bấm thanh toán sẽ được chuyển hướng trực tiếp sang trang thanh toán bảo mật của Shopify.
- **Admin API Token (Backend Spring Boot):**
  - Cấu hình trực tiếp trong `application.properties`: `shopify.admin-api-token=shpat_xxx`.
  - Sử dụng cho quản trị hệ thống, đồng bộ tồn kho hai chiều, lấy theme editor URL và thiết lập webhook.
- **Cơ chế nhận trạng thái mua bán:**
  - Hoàn toàn tự động thông qua **Webhooks** (HTTP POST) bắn từ Shopify về Spring Boot khi đơn hàng phát sinh, thanh toán hoặc hủy, tuyệt đối không dùng Storefront Token và không dùng polling.

#### Khối 2: Cấu Hình Token Tĩnh & Singleton Client Service (Không dùng SaaS / Redis)
- **Cấu hình tập trung trong `application.properties`:**
  - Token được sinh từ mục **Custom App** trong Shopify Admin của cửa hàng.
  - Không cần lưu vào database, không cần giải mã động, không cần refresh token định kỳ.
- **Singleton `ShopifyClient` Service:**
  - Sử dụng Spring Boot 3.5 `RestClient` tạo một bean singleton duy nhất khi khởi động ứng dụng:
  ```java
  @Component
  public class ShopifyClient {
      private final RestClient restClient;
      
      public ShopifyClient(@Value("${shopify.shop-domain}") String shopDomain,
                           @Value("${shopify.admin-api-token}") String adminToken,
                           @Value("${shopify.api-version:2024-01}") String apiVersion) {
          this.restClient = RestClient.builder()
                  .baseUrl("https://" + shopDomain + "/admin/api/" + apiVersion)
                  .defaultHeader("X-Shopify-Access-Token", adminToken)
                  .defaultHeader("Content-Type", "application/json")
                  .build();
      }
      // Các phương thức: getActiveThemeId(), updateInventory(), registerWebhook()...
  }
  ```

#### Khối 3: Tùy Chỉnh Giao Diện Bán Lẻ (Theme Customizer)
- **Vấn đề kỹ thuật:** Shopify chặn hoàn toàn việc nhúng giao diện admin/theme editor qua thẻ `<iframe>` bằng chính sách bảo mật HTTP (`Content-Security-Policy: frame-ancestors 'none'`).
- **Giải pháp xử lý:**
  1. Người quản trị bấm nút **"Chỉnh sửa giao diện Shopify"** trên giao diện React.
  2. React gửi request: `GET /api/v1/shopify/theme-editor-url`.
  3. Spring Boot dùng `ShopifyClient` gọi `GET /admin/api/2024-01/themes.json` của shop.
  4. Lọc theme có thuộc tính `role: "main"` (theme đang chạy chính thức), trích xuất `theme.id`.
  5. Backend trả về URL: `https://admin.shopify.com/store/{shop_name}/themes/{theme_id}/editor`.
  6. Frontend nhận URL và kích hoạt tab mới bằng `window.open(url, '_blank', 'noopener,noreferrer')`.

#### Khối 4: Xử Lý Webhook Đơn Hàng & Đồng Bộ Kho Nội Bộ
- **Đăng ký Webhook Topics:** `orders/create`, `orders/updated`, `orders/paid`.
- **Quy trình xử lý Webhook:**
  1. **Xác thực tính toàn vẹn (HMAC-SHA256):**
     - Đọc raw body bytes và header `X-Shopify-Hmac-Sha256`.
     - Tính `Base64(HmacSHA256(rawBody, shopify.webhook-secret))`. Nếu không trùng khớp, trả ngay HTTP 401 Unauthorized để chặn request giả mạo.
  2. **Chống trùng lặp (Idempotency):**
     - Đọc header `X-Shopify-Webhook-Id`. Kiểm tra xem ID này đã có trong bảng `webhook_events_log` chưa. Nếu đã có và xử lý xong, trả ngay HTTP 200 OK.
  3. **Phản hồi tức thì:**
     - Trả về ngay **HTTP 200 OK trong vòng < 100ms** để Shopify ghi nhận thành công (tránh bị Shopify gửi lại đơn hàng nhiều lần).
  4. **Xử lý ngầm bất đồng bộ (`@Async`):**
     - Đẩy payload sang `WebhookOrderProcessor`.
     - Bóc tách: mã đơn `name` (#1001), `id` (external order id), `financial_status`, `payment_gateway_names`, `shipping_address`.
     - Duyệt danh sách `line_items`: lấy `item.sku`, tìm kiếm bản ghi `BienTheSanPham` trong database FSWMS qua `ma_sku`.
     - Khởi tạo đơn bán hàng trong bảng `don_ban_hang` với `channel = 'SHOPIFY'`.
     - Trừ tồn kho thực tế qua `TonKhoTheoLo` và ghi nhận một bản ghi xuất bán trong `LichSuGiaoDichKho`.

---

### 6.4. Thiết Kế Cơ Sở Dữ Liệu & Cấu Hình Hệ Thống (Không Dùng Multi-tenant)

#### 1. Cấu hình Backend (`application.properties`)
```properties
# ==============================================
# 🛍️ SHOPIFY CUSTOM APP INTEGRATION (SINGLE STORE)
# ==============================================
shopify.shop-name=ten-shop-cua-ban
shopify.shop-domain=ten-shop-cua-ban.myshopify.com
shopify.admin-api-token=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
shopify.api-version=2024-01
shopify.webhook-secret=shpss_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 2. Cấu hình Frontend (`frontend/.env`)
```env
# Shopify Storefront Configuration
VITE_SHOPIFY_STORE_DOMAIN=ten-shop-cua-ban.myshopify.com
VITE_SHOPIFY_STOREFRONT_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 3. Bổ sung trường Đa kênh cho bảng `don_ban_hang` (Không có `tenant_id`)
Thay vì tạo bảng mới, tận dụng hoàn toàn bảng đơn bán hàng có sẵn:
```sql
ALTER TABLE `don_ban_hang`
ADD COLUMN `channel` VARCHAR(30) DEFAULT 'DIRECT' COMMENT 'DIRECT (Nội bộ), SHOPIFY' AFTER `loai_chung_tu`,
ADD COLUMN `external_order_id` VARCHAR(100) NULL COMMENT 'ID đơn hàng phía Shopify' AFTER `so_don_hang`,
ADD COLUMN `financial_status` VARCHAR(30) NULL COMMENT 'pending (COD/chờ thanh toán), paid (đã trả tiền)' AFTER `trang_thai_thanh_toan`,
ADD COLUMN `fulfillment_status` VARCHAR(30) NULL COMMENT 'unfulfilled, fulfilled' AFTER `trang_thai`,
ADD COLUMN `payment_method` VARCHAR(100) NULL COMMENT 'Phương thức thanh toán Shopify' AFTER `financial_status`,
ADD COLUMN `currency` VARCHAR(10) DEFAULT 'VND' AFTER `tong_cong`,
ADD INDEX `idx_channel_external` (`channel`, `external_order_id`);
```

#### 4. Bổ sung trường cho bảng `chi_tiet_don_ban_hang`
```sql
ALTER TABLE `chi_tiet_don_ban_hang`
ADD COLUMN `external_variant_id` VARCHAR(100) NULL COMMENT 'ID biến thể Shopify' AFTER `bien_the_san_pham_id`,
ADD COLUMN `sku` VARCHAR(100) NULL COMMENT 'Mã SKU tại thời điểm đặt hàng' AFTER `external_variant_id`;
```

#### 5. Bảng ghi nhận nhật ký Webhook tối giản (`webhook_events_log`)
```sql
CREATE TABLE `webhook_events_log` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `event_id` VARCHAR(100) NOT NULL COMMENT 'Shopify Webhook Delivery ID',
    `topic` VARCHAR(100) NOT NULL COMMENT 'orders/create, orders/updated...',
    `status` VARCHAR(20) DEFAULT 'PROCESSED' COMMENT 'PROCESSED, FAILED',
    `error_message` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_shopify_event` (`event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 6.5. Kế Hoạch & Lộ Trình Triển Khai Tinh Gọn (4 Giai Đoạn)

#### GIAI ĐOẠN 1: Cấu Hình Token Tĩnh & Cập Nhật Database (Ưu tiên số 1)
- **Mục tiêu:** Thiết lập các tham số kết nối cửa hàng Shopify và cập nhật schema CSDL để sẵn sàng nhận đơn hàng từ Shopify.
- **Nội dung công việc:**
  1. Hướng dẫn tạo **Custom App** trong Shopify Admin, cấp quyền (Scopes: `read_products, write_products, read_orders, write_orders, read_inventory, write_inventory, read_themes`) và lấy Admin Access Token (`shpat_...`) cùng Webhook Secret.
  2. Bổ sung các thuộc tính `shopify.*` vào file `backend/src/main/resources/application.properties`.
  3. Thực thi script Migration SQL bổ sung cột cho bảng `don_ban_hang`, `chi_tiet_don_ban_hang` và tạo bảng `webhook_events_log`.
  4. Cập nhật Entity `DonBanHang.java`, `ChiTietDonBanHang.java` và tạo Entity `WebhookEventsLog.java`.
- **Nghiệm thu:** Backend biên dịch thành công, JPA ánh xạ đúng các trường mới vào MySQL.

#### GIAI ĐOẠN 2: Xây Dựng Singleton ShopifyClient & Tính Năng Theme Customizer
- **Mục tiêu:** Backend giao tiếp thông suốt với Shopify Admin REST API và hỗ trợ người quản trị mở Theme Customizer chỉ với 1 click.
- **Nội dung công việc:**
  1. Xây dựng Bean `ShopifyClient.java` sử dụng Spring Boot 3.5 `RestClient` nạp cấu hình tĩnh từ `application.properties`.
  2. Xây dựng endpoint `GET /api/v1/shopify/theme-editor-url`:
     - Gọi `GET /admin/api/{version}/themes.json` của Shopify.
     - Lấy ID của theme có `role = 'main'`.
     - Trả về URL: `https://admin.shopify.com/store/{shop_name}/themes/{theme_id}/editor`.
  3. Frontend: Thêm nút **"Tùy biến Theme Shopify"** trên thanh công cụ hoặc trang Cấu hình Kênh bán hàng.
     - Viết hàm gọi API và mở tab mới bằng `window.open(url, '_blank')`.
- **Nghiệm thu:** Bấm nút trên giao diện React sẽ mở ra tab mới dẫn thẳng vào trang chỉnh sửa theme của shop trên Shopify mà không gặp bất kỳ lỗi bảo mật CSP nào.

#### GIAI ĐOẠN 3: Webhook Pipeline Tiếp Nhận Đơn Hàng & Tự Động Trừ Tồn Kho
- **Mục tiêu:** Khi khách hàng đặt mua trên Shopify, đơn hàng ngay lập tức được tạo trong hệ thống và tồn kho kho tổng tự động giảm.
- **Nội dung công việc:**
  1. Xây dựng `ShopifyHmacValidator`: Kiểm tra tính hợp lệ của chữ ký `X-Shopify-Hmac-Sha256` bằng `shopify.webhook-secret`.
  2. Xây dựng `ShopifyWebhookController`:
     - Endpoint `POST /api/v1/webhooks/shopify`.
     - Xác thực HMAC; nếu không hợp lệ trả HTTP 401.
     - Kiểm tra `X-Shopify-Webhook-Id` trong `webhook_events_log`; nếu đã tồn tại trả HTTP 200 OK ngay.
     - Trả về ngay **HTTP 200 OK (< 100ms)** cho Shopify.
  3. Xây dựng `ShopifyOrderSyncService` xử lý ngầm (`@Async`):
     - Lắng nghe các sự kiện `orders/create`, `orders/updated`, `orders/paid`.
     - Trích xuất: thông tin khách hàng, số điện thoại, địa chỉ giao hàng, phương thức thanh toán, `financial_status`.
     - Duyệt từng phần tử trong `line_items`: dùng mã `item.sku` truy vấn `BienTheSanPham` tương ứng.
     - Khởi tạo bản ghi trong `DonBanHang` và `ChiTietDonBanHang`.
     - Gọi service trừ số lượng tồn kho trong `TonKhoTheoLo` và tạo giao dịch xuất kho trong `LichSuGiaoDichKho`.
  4. Đăng ký Webhook URL trên Shopify Admin trỏ về server backend (hoặc qua ngrok/cloudflare tunnel khi chạy local test).
- **Nghiệm thu:** Tạo 1 đơn hàng thử nghiệm trên Shopify Admin, trong vòng 1-2 giây đơn hàng xuất hiện trong danh mục Đơn bán hàng của FSWMS và số lượng tồn kho giảm chính xác theo SKU.

#### GIAI ĐOẠN 4: Hoàn Thiện Giao Diện & Kiểm Thử Toàn Diện (End-to-End)
- **Mục tiêu:** Tích hợp giao diện hiển thị đơn hàng đa kênh trên Admin Dashboard và kiểm thử trơn tru toàn bộ luồng.
- **Nội dung công việc:**
  1. Frontend: Bổ sung badge hiển thị nguồn đơn hàng (Nội bộ / Shopify) trên màn hình Danh sách Đơn bán hàng (`ViewSalesOrderList`).
  2. Bổ sung filter theo kênh bán hàng (`channel = 'SHOPIFY'`).
  3. (Tùy chọn) Cấu hình file `.env` Frontend với `VITE_SHOPIFY_STOREFRONT_TOKEN` phục vụ gọi Storefront API giỏ hàng và thanh toán nếu có làm trang web bán lẻ cho khách hàng.
  4. Kiểm thử các tình huống ngoại lệ: SKU không tồn tại trong kho nội bộ, đơn hàng bị hủy (`orders/cancelled`), đơn COD vs đơn đã thanh toán online.
- **Nghiệm thu:** Toàn bộ chu trình hoạt động ổn định, tài liệu cấu hình được bàn giao rõ ràng, hệ thống sẵn sàng đưa vào sử dụng thực tế.

---
*Tài liệu này được cập nhật theo định hướng tinh giản tích hợp Đơn Doanh Nghiệp (Hardcoded / Config Token) bởi Senior Fullstack Engineer & Solution Architect.*

