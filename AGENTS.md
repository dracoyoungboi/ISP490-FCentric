# Quy ước cho AI và người viết code — FCentric

Tệp này dành cho mọi trợ lý AI (Claude Code, Codex, Cursor, Copilot, Gemini…) và cho người viết code trong repo.
Đọc hết trước khi sửa giao diện hoặc câu thông báo của máy chủ.

> [!IMPORTANT]
> **Bộ quy chuẩn chuyên sâu bắt buộc tham chiếu:**
> - `.agents/rules/coding-standards.md`: Chuẩn lập trình Backend Spring Boot (`java-pro`), phân quyền `@RequireAuth` (`hunt-springboot`, `api-security`), RESTful API (`api-design-principles`).
> - `.agents/rules/omnichannel-standards.md`: Chuẩn tích hợp đa kênh Shopee, Lazada, TikTok Shop, Shopify (Single vs Multi-Warehouse, Delta Sync chống spam quota, vòng đời đơn hàng, OAuth token AES-GCM).

## Đa ngôn ngữ (tiếng Việt + tiếng Anh)

Ứng dụng chạy hai ngôn ngữ. **Tiếng Việt là ngôn ngữ gốc**, tiếng Anh là bản dịch. Mọi chữ người dùng nhìn thấy
phải đổi được sang tiếng Anh. Thêm hay sửa một câu mà không làm đủ các bước dưới đây là **chưa xong việc**.

### Frontend (`frontend/`)

**1. Khóa dịch chính là câu tiếng Việt.** Không đặt mã khóa kiểu `common.save`.

```jsx
import { t } from "@/i18n";

<Button>{t("Lưu thay đổi")}</Button>
toast.success(t("Đã xóa {{ten}}", { ten: sanPham.ten }));
```

**2. Mọi chữ hiện ra giao diện đều đi qua `t()`**, gồm: chữ trong JSX, `title`, `placeholder`, `aria-label`, `label`,
`description`, câu lỗi kiểm ô (cả câu thứ hai của yup `.test(ten, cau, ham)`), `toast`, giá trị mặc định của
`getApiErrorMessage(error, t("…"))`, nhãn nút truyền qua props.

**3. Có tham số thì dùng `{{ten}}`, không ghép chuỗi.**

```jsx
// Sai: không dịch được, thứ tự từ tiếng Anh khác tiếng Việt
`Đã liên kết Shop ID ${id}`
"Kho " + ten
// Đúng
t("Đã liên kết gian hàng Shopee (Shop ID: {{id}}).", { id })
t("Kho {{ten}}", { ten })
```

Số nhiều tiếng Anh: truyền `{ count }` và khai báo `"<câu>_one"` / `"<câu>_other"` trong tệp tiếng Anh.

**4. Thêm bản dịch tiếng Anh NGAY trong cùng thay đổi**, vào `frontend/src/i18n/en/<module>.json`
(chọn tệp đúng module: `kenh-ban.json`, `ban-hang.json`, `kho-nhap-kho.json`, `chung.json`…).
Tệp là object phẳng `"câu tiếng Việt": "English sentence"`. Trước khi thêm, tìm xem khóa đã có ở tệp khác chưa;
một khóa chỉ được có **một** bản dịch trong toàn bộ `en/`.

**5. Câu chia nhỏ để in đậm một phần:** dịch từng mảnh một cách tự nhiên, hoặc viết lại câu cho khỏi phải in đậm
giữa câu. Không bọc cả đoạn JSX có thẻ con vào một khóa.

```jsx
<li><strong>{t("Đẩy tồn theo lô:")}</strong> {t("mọi biến thể của một sản phẩm gửi trong một lần.")}</li>
```

**6. Những chỗ GIỮ tiếng Việt, không bọc `t()`:**
- Giá trị lưu vào cơ sở dữ liệu, gửi lên máy chủ, dùng làm khóa tra cứu hay so sánh
  (tên mặc định như `"Khách Shopee"`, `"Gian Hàng Shopee FCentric"`, mã trạng thái…).
- Mẫu in chứng từ (`components/print/`), tệp Excel xuất ra, nội dung email.
- `constants/`: khai báo nhãn bằng tiếng Việt ở đó, **dịch lúc hiện ra**: `t(TRANG_THAI[x].label)`.
  Nhãn trong `constants/` vẫn phải có bản dịch trong `en/`.
- Đánh dấu chỗ cố ý giữ tiếng Việt bằng chú thích `// i18n-giu-nguyen: <lý do>` trên dòng đó hoặc dòng ngay trên;
  cả tệp thì `/* i18n-giu-nguyen-ca-tep: <lý do> */` ở đầu tệp.

**7. Giá trị lấy từ máy chủ** (tên kênh, tên kho, tên khách… máy chủ tự đặt): dùng `tDuLieu(giaTri)`, không dùng `t()`.
`tDuLieu` chỉ dịch khi đúng một câu cố định có bản dịch, còn lại trả nguyên văn.
Nhãn tùy chọn có thể là phần tử React: dùng `tNeuChuoi(nhan)`.

**8. Số và tiền giữ kiểu Việt Nam** (`1.500.000 ₫`) ở cả hai ngôn ngữ. Tên tháng, thứ dùng `localeHienThi()`.

**9. Đổi ngôn ngữ = lưu lựa chọn rồi tải lại trang**, nên gọi `t()` ở hằng số cấp module vẫn đúng.

### Backend (`backend/`)

- Câu trả về người dùng (thông báo thành công, lỗi nghiệp vụ) lấy theo khóa từ
  `backend/src/main/resources/i18n/thong-diep/<nhom>.properties` (tiếng Việt) và **`<nhom>_en.properties`
  (tiếng Anh) — thêm cả hai tệp cùng lúc**.
- Ném lỗi bằng `new LoiChungException(ThongDiep.of("nhom.khoa", thamSo...))` (hoặc `LoiThamSoException`,
  `LoiTrangThaiException`, `TuChoiTruyCapException`), **không** `new RuntimeException("câu tiếng Việt")`.
- Cú pháp MessageFormat: tham số `{0}`, `{1}`; dấu nháy đơn viết đôi `''`. Tệp lưu UTF-8.

### Văn phong (cả hai ngôn ngữ)

- **Viết hoa kiểu câu**: chỉ viết hoa chữ đầu câu và tên riêng. Không viết "Cổng Ký Bên Thứ Ba", "Cập Nhật & Tiếp Tục".
- Không để lộ chữ kỹ thuật cho người dùng: tên hàm, tên API (`update_stock_batch`), "request", "OAuth2", "token"…
  Nói bằng việc người dùng làm: "đẩy tồn", "lấy đơn", "ủy quyền".
- Nút bắt đầu bằng động từ, ngắn: "Lưu Shop ID", "Bắt đầu liên kết". Không dùng "&" thay "và".
- Thông báo thành công không thêm "thành công!" khi câu đã nói rõ việc xong ("Đã lưu cấu hình").
- Câu lỗi nói điều gì sai và cách sửa: "Nhập Shop ID hoặc dán đường dẫn gian hàng Shopee."
- Ô số điện thoại không dùng placeholder kiểu "090…".
- Tiếng Anh: tự nhiên như sản phẩm SaaS (Shopify, Stripe), không dịch từng chữ. "e.g." cho "VD:".

### Tự kiểm trước khi commit

1. Soát mọi chữ có dấu tiếng Việt trong phần vừa sửa: hoặc nằm trong `t()` / `tDuLieu()` / `tNeuChuoi()`,
   hoặc có chú thích `i18n-giu-nguyen`.
2. Mỗi khóa `t("…")` mới đều có trong `frontend/src/i18n/en/*.json`.
3. Chạy script kiểm và sửa đến khi sạch (trợ lý AI có quyền chạy lệnh: tự chạy trước khi báo xong việc):

```bash
cd frontend
npm run i18n:kiem                                   # cả frontend
npm run i18n:kiem -- src/pages/channels --chi-tiet  # chỉ thư mục/tệp vừa sửa, kèm từng dòng lỗi
```

Script báo ba loại: CHƯA BỌC (chữ Việt chưa qua `t()`), THIẾU BẢN DỊCH (khóa chưa có trong `en/`),
LỆCH (một khóa hai bản dịch). Thoát mã 1 nếu còn lỗi. `--ghi-thieu <tep>` thêm khóa thiếu vào `en/<tep>.json`
với giá trị rỗng để điền bản dịch.

GitHub Actions (`.github/workflows/kiem-dich.yml`) chạy đúng lệnh này mỗi lần đẩy code có sửa `frontend/src` và mỗi PR
vào `Dev` / `main`. Báo đỏ thì xem log để biết dòng lỗi, sửa rồi đẩy lại.

4. Backend: mỗi khóa mới trong `<nhom>.properties` có dòng tương ứng trong `<nhom>_en.properties`.

## Quy chuẩn đồng bộ đa kênh & Sàn TMĐT (Omnichannel)

Áp dụng cho mọi module liên quan tới Shopify, Lazada, Shopee (Production & Sandbox), TikTok Shop:

### 1. Cấu hình kho (Single vs Multi-Warehouse)
- **Lazada**: Gian hàng 1 kho mặc định -> `chiDoc: t("Kho mặc định")` (chỉ đọc, không mở dropdown chọn kho).
- **TikTok Shop**: 
  - Mặc dù TikTok Shop có 2 kho nội bộ (`SALES_WAREHOUSE` kho bán hàng và `RETURN_WAREHOUSE` kho trả hàng bưu cục), nhưng kho nhận tồn bán hàng **DUY NHẤT** là `SALES_WAREHOUSE`.
  - Backend BẮT BUỘC lọc bỏ `RETURN_WAREHOUSE` khỏi danh sách kho bán hàng.
  - Khi gian hàng chỉ có 1 kho bán hàng (mô hình chuẩn nội địa), giao diện tự động hiển thị chỉ đọc `Tên kho (Kho bán hàng mặc định)` tương tự như Lazada, loại bỏ dropdown chọn kho trùng tên gây nhầm lẫn.
  - Luồng hàng FCentric: Hàng đi ra từ Kho Tổng FCentric; khi khách hủy/hoàn thì hàng nhập về đúng Kho Tổng FCentric; số tồn khả dụng FCentric được đồng bộ trực tiếp vào `SALES_WAREHOUSE` của TikTok Shop.
- **Shopee**: Áp dụng mô hình gian hàng 1 kho mặc định -> `chiDoc: t("Kho mặc định")`.

### 2. Bảo vệ Quota API và Delta Sync (Tránh lặp lỗi Shopee 433 reqs)
- **Delta Sync**: Bỏ qua 100% SKU có `soLuongDaDay == soDay` và trạng thái `thanh_cong`.
- **Chống lặp lỗi (Backoff 60 phút)**: Với SKU trạng thái `that_bai`, nếu số tồn không đổi và lần thử gần nhất chưa quá 60 phút -> BẮT BUỘC BỎ QUA trong đợt quét tự động 5 phút. Chỉ thử lại khi tồn kho thay đổi, quá 60 phút, hoặc người dùng bấm đẩy tồn lại.
- **Bộ nhớ đệm Catalog (TTL 30 phút)**: Lưu cache RAM ánh xạ `sku -> {productId, skuId}`. Tuyệt đối không gọi API phân trang `searchProducts` mỗi lần có SKU dirty hoặc khi đẩy lẻ.
- **Kiểm tra Product ID**: Chỉ gọi sàn khi `productId` là chuỗi số hợp lệ của sàn. Không gửi mã SKU vào endpoint `productId` rồi retry làm nghẽn thread.

### 3. Vòng đời đơn hàng đa sàn
Đơn hàng đã tồn tại (`existingOpt.isPresent()`) BẮT BUỘC xử lý đủ các giai đoạn:
1. `CANCELLED`: Gọi `huyDonTuSan`.
2. Khách yêu cầu hủy (`laYeuCauHuy`): Gắn cờ `[KHÁCH YÊU CẦU HỦY]` vào ghi chú.
3. Thanh toán: Cập nhật `trangThaiThanhToan = "da_thanh_toan"` khi sàn xác nhận thanh toán.
4. Giao hàng: Gọi `capNhatTrangThaiGiaoHangTuSan` khi sàn chuyển `shipped`/`in_transit` (Đã xuất) hoặc `delivered`/`completed`/`fulfilled` (Hoàn thành).
5. Vận đơn: Đồng bộ bổ sung `tracking_number` và `shipping_provider` vào ghi chú đơn hàng.

### 4. Giao diện Sản phẩm sàn (Channel Mappings)
- Biến `hoTroDuaLen` tại `ChannelMappingsPage.jsx` phải bao gồm cả `TIKTOK` / `TIKTOK_SHOP` để hiển thị nút "Đưa sản phẩm FCentric lên sàn" và "Tự động liên kết".

### 5. Xác thực & Khóa API
- Cột `apiKey`, `apiSecret`, `token` phải là kiểu `TEXT` để lưu token mã hóa AES-GCM.
- Hạn token `token_expires_at` phải là ngày giờ hợp lệ (7–365 ngày), không lưu năm 2083.
- `shop_cipher` của TikTok Shop phải lưu độc lập ở cột riêng, không ghi đè tên gian hàng vào cipher.

### 6. Tạo sản phẩm & Phân trang TikTok Shop (API v202309)
- **Đo lường (Struct)**: `package_weight` BẮT BUỘC là struct `{"value": "0.3", "unit": "KILOGRAM"}` (tuyệt đối không gửi String thô). `package_dimensions` BẮT BUỘC là struct kèm `"unit": "CENTIMETER"`.
- **Phân trang API**: `page_size` và `page_token` của API tìm đơn hàng (`/order/202309/orders/search`) và tìm sản phẩm BẮT BUỘC nằm ở **Query Parameter trên URL** (không để trong body JSON).
- **Phân loại biến thể & Single SKU**:
  - Với sản phẩm đơn (1 SKU duy nhất): BẮT BUỘC để `sales_attributes = null` (không gửi trường này).
  - Với sản phẩm nhiều biến thể: BẮT BUỘC bổ sung `sales_attributes` gồm CẢ `name`, `value_name` VÀ `custom_value` cho từng SKU để TikTok Shop nhận diện và hiển thị giá trị (chống lỗi `Resource Already Exists: Kích cỡ() Màu sắc() is already in use` mã `12052251`).
  - Đảm bảo tính đồng nhất số chiều thuộc tính giữa các SKU và cơ chế chống trùng lặp tổ hợp thuộc tính (tự động đệm mã SKU khi trùng).
  - Toàn bộ payload DTO sử dụng `@JsonInclude(JsonInclude.Include.NON_NULL)` để loại bỏ các trường rỗng/null, tránh lỗi schema sàn.
- **Tiêu đề**: Độ dài bắt buộc từ 25 đến 255 ký tự (nếu ngắn phải tự động đệm thông tin).
- **Hình ảnh & Upload CDN**:
  - Bắt buộc upload ảnh lên TikTok CDN qua `POST /product/202309/images/upload` để lấy `Image URI` nội bộ (`tos-maliva-...`). Tuyệt đối không truyền URL bên ngoài hoặc chuỗi URI giả lập (chống lỗi 12052300).
  - API upload ảnh là cấp Platform: TUYỆT ĐỐI **KHÔNG truyền `shop_cipher`** vào query parameters trên URL (chống lỗi HTTP 400 mã 36009004).
  - Body multipart của API upload ảnh BẮT BUỘC phải kèm tham số `use_case = "MAIN_IMAGE"`.
  - Khi sản phẩm không có ảnh trong DB, tự động sinh ảnh JPEG 800x800 chuẩn e-commerce (logo FCENTRIC + tên sản phẩm) và upload thật lên TikTok CDN.
- **Thương hiệu**: Mặc định `brand_id = "0"` (No Brand) để tránh bị từ chối phê duyệt bản quyền.
- **Danh mục V2**: `category_version = "v2"` bắt buộc ở cả URL Query Param và Body JSON. `category_id` phải là danh mục lá (Leaf Category) V2 xác định tự động qua AI recommend hoặc tìm kiếm từ khóa.
- **Thuộc tính sản phẩm bắt buộc (Product Attributes)**:
  - Bắt buộc kiểm tra và cung cấp các thuộc tính có `is_mandatory = true` qua API `GET /product/202309/categories/{category_id}/attributes`.
  - Thuộc tính **Quốc gia xuất xứ** (Attribute ID: `100149` / Country of Origin = "Việt Nam") BẮT BUỘC phải luôn có mặt trong `product_attributes` đối với ngành hàng thời trang để chống lỗi TikTok Shop mã `12052104`. Tự động ánh xạ `id` và `name` từ enum của sàn hoặc sử dụng fallback `Việt Nam`.

## Quy chuẩn Git Commit nguyên tử & Chiến lược đóng góp (~500 commits/tuần)

> **Mục tiêu**: Đạt KPI ~500 commits/tuần, tăng tính minh bạch của lịch sử Git, hỗ trợ bóc tách lỗi và tránh tuyệt đối monolithic commits.

### 1. Nguyên tắc cốt lõi (No Monolithic Commits)
- **Tuyệt đối không gom thay đổi**: Nghiêm cấm dùng `git add -A` rồi dồn tất cả thay đổi (Frontend + Backend + i18n + Docs) vào 1 commit to duy nhất rồi mới đẩy lên.
- **Mỗi commit = 1 đơn vị công việc logic nhỏ nhất (Single Logical Unit)**: Thay đổi nào độc lập được thì BẮT BUỘC phải commit riêng.

### 2. Quy tắc phân rã chuỗi commit bắt buộc khi triển khai tính năng / sửa lỗi
Khi thực hiện một luồng công việc, BẮT BUỘC chia nhỏ thành chuỗi commit tuần tự theo từng tầng:
1. **DTO / Entity**: `feat(dto)` / `feat(entity)`: Thêm hoặc chỉnh sửa Entity, DTO, Request/Response class, Record.
2. **Thông điệp Backend (i18n)**: `i18n(backend)`: Cập nhật tệp `.properties` (cả tiếng Việt và tiếng Anh song song).
3. **Tầng Client / Sàn bên ngoài**: `feat(client)` / `fix(client)`: Viết/sửa các hàm gọi API đối tác (TikTokShopClient, LazadaClient, ShopeeClient).
4. **Tầng Service Logic**: `feat(service)` / `fix(service)`: Viết xử lý nghiệp vụ trong Service.
5. **Tối ưu hiệu năng & Cache**: `perf(cache)` / `perf(sync)`: Bổ sung in-memory cache, rate-limiting guard, delta sync.
6. **Tầng Controller & API**: `feat(controller)`: Khai báo endpoint, phân quyền `@RequireAuth`, gắn `@Operation` Swagger.
7. **Đa ngôn ngữ Giao diện (Frontend i18n)**: `i18n(frontend)`: Thêm các khóa JSON trong `src/i18n/en/*.json`.
8. **Tầng Giao diện UI**: `feat(ui)` / `fix(ui)`: Tạo hoặc sửa Component React, trang JSX, CSS.
9. **Kiểm thử tự động**: `test(...)`: Bổ sung kiểm thử đơn vị, mock test, test coverage.
10. **Tài liệu & Quy chuẩn**: `docs(...)`: Cập nhật tài liệu, Swagger annotations, README hoặc rule files.

### 3. Cú pháp Conventional Commits
- Định dạng: `<loại>(<phạm vi>): <mô tả ngắn bằng tiếng Việt không viết hoa chữ đầu>`
- Các loại commit: `feat`, `fix`, `refactor`, `perf`, `i18n`, `style`, `test`, `docs`, `chore`.
- Sau mỗi cụm 2–4 commits nhỏ hoặc khi hoàn thành 1 bước logic đã kiểm thử thành công, push ngay lên cả `origin/PhanAnh` và `origin/Dev`.
