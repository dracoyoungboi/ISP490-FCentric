# QUY CHUẨN ĐỒNG BỘ ĐA KÊNH & SÀN THƯƠNG MẠI ĐIỆN TỬ (OMNICHANNEL STANDARDS)
> Áp dụng bắt buộc cho toàn bộ mã nguồn Backend, Frontend và các Agent AI làm việc trên hệ thống FCentric (F-ORWMS).
> Tham chiếu các sàn: Shopify, Lazada, Shopee (Production & Sandbox), TikTok Shop Open Platform v202309.

---

## 1. QUY CHUẨN CẤU HÌNH KHO HÀNG (SINGLE VS MULTI-WAREHOUSE)
1. **Lazada (Single-Warehouse)**:
   - Áp dụng mô hình gian hàng 1 kho mặc định.
   - Giao diện `Cấu hình Lazada` BẮT BUỘC để `chiDoc: t("Kho mặc định")` (text tĩnh, không mở dropdown chọn kho) để người bán không phải thao tác thừa.
2. **TikTok Shop (Kiến trúc chuẩn hóa Single-Warehouse bán hàng)**:
   - TikTok Shop trả về nhiều kho từ API `GET /logistics/202309/warehouses`:
     - `SALES_WAREHOUSE`: Kho lấy hàng / bán hàng (nhận số tồn, bưu tá đến lấy).
     - `RETURN_WAREHOUSE`: Kho trả hàng (chỉ là địa chỉ hậu cần bưu phẩm nhận hàng hoàn, KHÔNG nhận tồn bán hàng).
   - **Quy tắc lọc Backend**: Backend BẮT BUỘC lọc bỏ 100% kho `RETURN_WAREHOUSE` khỏi danh sách kho bán hàng.
   - **Quy tắc hiển thị Frontend (Đồng nhất như Lazada)**: Khi gian hàng có 1 kho bán hàng duy nhất, giao diện hiển thị dạng văn bản chỉ đọc `Tên kho (Kho bán hàng mặc định)` (không mở dropdown chọn kho trùng tên gây nhầm lẫn). Hệ thống tự động gán và lưu `MA_KHO_SAN` của kho này. Chỉ hiển thị dropdown khi thực tế có trên 1 kho bán hàng (`SALES_WAREHOUSE`).
   - **Dòng chảy FCentric**: Xuất hàng từ Kho Tổng FCentric; khách hủy đơn hoặc hàng hoàn về thì nhập hoàn lại đúng Kho Tổng FCentric; số tồn khả dụng FCentric được đồng bộ trực tiếp vào `SALES_WAREHOUSE` của TikTok Shop.
3. **Shopee**:
   - Tương tự Lazada, kênh Shopee mặc định đẩy tồn vào kho mặc định của Shop (`chiDoc: t("Kho mặc định")`).

---

## 2. QUY CHUẨN BẢO VỆ HẠN MỨC GỌI API (QUOTA & DELTA SYNC STANDARDS)
*Tránh lặp lại sự cố Shopee gọi hơn 433 requests hay TikTok Shop bị cạn quota:*
1. **Delta Sync 100% khi tồn không đổi**:
   - Nếu `soLuongDaDay == soDay` VÀ trạng thái `thanh_cong`: Bỏ qua 100% không gọi API sàn.
2. **Chống lặp lỗi vô tận (Exponential Backoff cho SKU lỗi)**:
   - Nếu SKU ở trạng thái `that_bai` nhưng số tồn không đổi (`soLuongDaDay == soDay`) VÀ thời gian thử gần nhất chưa quá 60 phút: **BẮT BUỘC BỎ QUA** trong các đợt đồng bộ tự động định kỳ 5 phút.
   - Chỉ thử lại khi: số tồn thực tế thay đổi, hoặc đã quá 60 phút, hoặc người dùng chủ động bấm "Đẩy tồn lại".
3. **Bộ nhớ đệm danh mục (Catalog In-Memory Cache)**:
   - Nghiêm cấm gọi API tìm kiếm sản phẩm phân trang (`searchProducts`) ở mỗi lần đẩy tồn lẻ hoặc mỗi chu kỳ đẩy tồn.
   - Bắt buộc dùng `CatalogCache` (TTL 30 phút) để tra cứu ánh xạ `sku -> {productId, skuId}` trong RAM.
   - Chỉ gọi API sàn nạp lại cache khi cache hết hạn hoặc người dùng bấm "Tải sản phẩm từ sàn".
4. **Kiểm tra tính hợp lệ của Product ID trước khi gọi sàn**:
   - Chỉ gọi API cập nhật tồn khi `productId` là chuỗi số hợp lệ của sàn. Tuyệt đối không gửi chuỗi mã SKU vào endpoint `productId` rồi retry làm nghẽn thread.

---

## 3. QUY CHUẨN VÒNG ĐỜI & TRẠNG THÁI ĐƠN HÀNG ĐA SÀN
Mọi kênh bán (Shopify, Lazada, Shopee, TikTok Shop) khi quét đơn về phải xử lý đầy đủ các giai đoạn:
1. **Đơn mới**:
   - Lưu `DonBanHang` với mã đơn tiền tố (`TTS-` cho TikTok, `LZD-` cho Lazada, `SHP-` cho Shopee).
   - Khởi tạo chi tiết đơn hàng, trừ giữ chỗ tồn kho (Reserved Stock).
2. **Đơn đã tồn tại (`existingOpt.isPresent()`) - BẮT BUỘC XỬ LÝ 4 GIAI ĐOẠN**:
   - **Giai đoạn 1 - Hủy đơn (`CANCELLED`)**: Gọi `donBanHangService.huyDonTuSan` để hủy đơn và hoàn trả tồn kho.
   - **Giai đoạn 2 - Khách yêu cầu hủy (`laYeuCauHuy`)**: Gắn cờ `[KHÁCH YÊU CẦU HỦY]` vào ghi chú, chặn gom vào Pick List.
   - **Giai đoạn 3 - Đổi trạng thái thanh toán**: Cập nhật `trangThaiThanhToan = "da_thanh_toan"` khi sàn xác nhận thanh toán.
   - **Giai đoạn 4 - Đổi trạng thái vận chuyển**:
     - `IN_TRANSIT` / `shipped`: Chuyển đơn sang `DA_XUAT_TOAN_BO` (3).
     - `DELIVERED` / `COMPLETED` / `fulfilled`: Chuyển đơn sang `HOAN_THANH` (5).
     - `failed_delivery` / `returned`: Chuyển đơn sang `BI_HOAN_TRA` (6).
   - **Giai đoạn 5 - Mã vận đơn (Tracking Code)**: Luôn cập nhật bổ sung `tracking_number` và `shipping_provider` vào đơn hàng nếu trước đó chưa có.

---

## 4. QUY CHUẨN GIAO DIỆN SẢN PHẨM SÀN (CHANNEL MAPPINGS UI)
1. **Điều kiện `hoTroDuaLen`**:
   - Mọi kênh bán có hỗ trợ tính năng liên kết hoặc đẩy sản phẩm (Shopify, Lazada, Shopee, TikTok Shop) BẮT BUỘC phải được khai báo trong biến `hoTroDuaLen` tại `ChannelMappingsPage.jsx`.
   - Đảm bảo hiển thị đầy đủ 2 nút:
     - `Tải sản phẩm từ sàn`: Quét danh mục từ sàn về FCentric.
     - `Đưa sản phẩm FCentric lên sàn…` (hoặc `Tự động liên kết`): Tự động so khớp SKU trùng nhau và tạo liên kết.

---

## 5. QUY CHUẨN XÁC THỰC OAUTH2 & BẢO MẬT KHÓA
1. Cột `apiKey`, `apiSecret`, `token` lưu trữ JWT hoặc Access Token BẮT BUỘC là kiểu `TEXT` hoặc `VARCHAR(2048)` để chứa chuỗi mã hóa AES-GCM (tránh lỗi `Data truncation` / `Size must be between 0 and 255`).
2. Cột `token_expires_at` lưu `DATETIME(6)` hợp lệ trong khoảng 7–365 ngày. Tuyệt đối không lưu giá trị năm 2083 làm lỗi MySQL DATETIME.
3. TikTok Shop có trường định danh độc lập `shop_cipher` (dạng `ROW_...`). Không được ghi đè tên gian hàng vào `shop_cipher` (tránh lỗi "Hệ thống đang bảo trì").

---

## 6. QUY CHUẨN TẠO SẢN PHẨM & PHÂN TRANG TIKTOK SHOP (API v202309)
1. **Định dạng Struct cho đơn vị đo lường**:
   - `package_weight` BẮT BUỘC là struct `{"value": "0.3", "unit": "KILOGRAM"}` (hoặc `GRAM`), tuyệt đối không gửi String thô.
   - `package_dimensions` BẮT BUỘC là struct `{"length": "25", "width": "15", "height": "5", "unit": "CENTIMETER"}`.
2. **Quy tắc phân trang API**:
   - `page_size` và `page_token` của API tìm đơn hàng (`/order/202309/orders/search`) và tìm sản phẩm (`/product/202309/products/search`) BẮT BUỘC nằm ở **Query Parameter trên URL**, không để trong request body JSON.
3. **Phân loại biến thể đa SKU & Single SKU (`sales_attributes`)**:
   - Khi sản phẩm cha có từ 2 SKU biến thể trở lên, BẮT BUỘC gửi `sales_attributes` (mảng thuộc tính `name`, `custom_value`) cho từng SKU để TikTok Shop gom nhóm và hiển thị biến thể.
   - Khi sản phẩm chỉ có 1 SKU duy nhất (Single SKU product), BẮT BUỘC để `sales_attributes = null` (không gửi trường này trong JSON).
   - DTO request sử dụng `@JsonInclude(JsonInclude.Include.NON_NULL)` để loại bỏ hoàn toàn các trường null khỏi payload JSON gửi sang sàn.
4. **Tiêu đề & Thương hiệu**:
   - Tiêu đề sản phẩm bắt buộc có độ dài từ 25 đến 255 ký tự.
   - Mặc định đặt `brand_id = "0"` (No Brand) để vượt qua quy trình kiểm duyệt ủy quyền thương hiệu của sàn.
5. **Tải ảnh lên CDN TikTok (`/product/202309/images/upload`)**:
   - Bắt buộc tải tệp nhị phân lên qua `POST /product/202309/images/upload` dạng `multipart/form-data` để lấy chuỗi URI nội bộ (`tos-maliva-...`). Tuyệt đối không gửi URL ngoài hoặc chuỗi URI giả lập vào `main_images`.
   - **Bảo vệ Query Parameters**: Endpoint upload ảnh là API cấp Platform, TUYỆT ĐỐI **KHÔNG truyền `shop_cipher`** vào query parameters trên URL (chống lỗi HTTP 400 mã 36009004 "Unexpected identifier. The 'shop_cipher' query parameter is not required for this request").
   - **Tham số bắt buộc**: Form `multipart/form-data` BẮT BUỘC phải gửi kèm tham số `use_case = "MAIN_IMAGE"`.
   - Quét cả ảnh cấp sản phẩm (`AnhQuanAo`) và ảnh cấp biến thể (`AnhBienThe`). Khi sản phẩm không có ảnh, tự động sinh ảnh JPEG 800x800 chuẩn e-commerce (thương hiệu FCENTRIC + tên sản phẩm) và upload thật lên TikTok CDN để nhận URI hợp lệ (chống lỗi 12052300).
6. **Phiên bản danh mục V2 (Category Version v2)**:
   - Theo quy định API v202309 cho khu vực Đông Nam Á (Việt Nam) và All-Region, tham số `category_version` BẮT BUỘC có giá trị `"v2"` và phải hiện diện ở CẢ HAI NƠI: **Query Parameter trên URL** (`POST /product/202309/products?category_version=v2`) và **Request Body JSON** (`"category_version": "v2"`). Thiếu query param sẽ gây lỗi `code=12052217: Invalid Parameter. Parameter category_version is invalid because all-region shops must use V2 categories.`
   - `category_id` BẮT BUỘC là mã danh mục lá (`is_leaf: true`) của cây V2 7 tầng. Tuyệt đối không dùng mã V1 cũ (như `601234`).
   - Ưu tiên tự động xác định `category_id` qua AI Recommendation (`POST /product/202309/categories/recommend?category_version=v2`) dựa trên tiêu đề và mô tả, kết hợp tìm kiếm danh mục lá theo từ khóa (`GET /product/202309/categories?category_version=v2&locale=vi-VN`).


