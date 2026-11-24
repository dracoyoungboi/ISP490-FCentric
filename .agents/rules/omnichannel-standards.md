# QUY CHUẨN ĐỒNG BỘ ĐA KÊNH & SÀN THƯƠNG MẠI ĐIỆN TỬ (OMNICHANNEL STANDARDS)
> Áp dụng bắt buộc cho toàn bộ mã nguồn Backend, Frontend và các Agent AI làm việc trên hệ thống FCentric (F-ORWMS).
> Tham chiếu các sàn: Shopify, Lazada, Shopee (Production & Sandbox), TikTok Shop Open Platform v202309.

---

## 1. QUY CHUẨN CẤU HÌNH KHO HÀNG (SINGLE VS MULTI-WAREHOUSE — HƯỚNG B)
1. **Shopify (Sàn DUY NHẤT bật Đồng bộ đa kho phân tán / Multi-Location)**:
   - Giao diện `Cấu hình Shopify` sử dụng `BangMappingKhoSan` (`HO_TRO_DA_KHO = new Set(["SHOPIFY"])`) để ánh xạ nhiều Location trên Shopify với nhiều kho vật lý FCentric, tính buffer + Hamilton/Remainder phân bổ tồn và định tuyến đơn theo Location.
2. **Lazada, TikTok Shop, Shopee (Single-Warehouse tồn kho trên sàn — tách biệt Định tuyến kho xuất đơn FCentric)**:
   - Backend (`KenhBanHangDongBoServiceImpl.layCauHinhKhoMapping` / `luuCauHinhKhoMapping`) BẮT BUỘC giữ `cheDoDaKho = false` cho mọi kênh không phải Shopify (không mở `BangMappingKhoSan` chia tồn đa kho); `layDanhSachKhoShopee` KHÔNG được tự bơm kho ảo `fcentric-kho-*` khi gian hàng Shopee chưa nằm trong whitelist Multi-Warehouse.
   - **Định tuyến kho xuất đơn (`KhoXuatDonSan.jsx`, `KENH_<MA>_KHO_ID`, `KENH_<MA>_KHO_MAPPING` với `cheDoDaKho = false`)**: Cho phép chọn kho xuất đơn FCentric mặc định (khi sàn có 1 kho) hoặc ánh xạ 1–1 từng kho lấy hàng trên sàn sang kho xuất FCentric (khi sàn có ≥ 2 kho, vd TH1 Kho A → `Kho tổng`, TH2 Kho B → `Cửa hàng Hà Nội`). Tồn kho đồng bộ trực tiếp vào kho mặc định trên sàn; khi đồng bộ kho mặc định mới từ sàn (`dongBoKhoMacDinhKhiDocSan`) hoặc đồng bộ đơn qua `resolveKhoXuatChoDonSan`, hộp `HopGuiSangKho` tự động định tuyến đúng kho FCentric tương ứng mà không kích hoạt chia tồn đa kho.
   - **Minh bạch chính sách Seller Center (`laMacDinhSan` vs `laMacDinh`)**: Trên Lazada/Shopee/TikTok Shop/Shopify, cờ mặc định gốc trên sàn (`laMacDinhSan`) chỉ đọc từ API sàn và luôn được làm mới trong `layCauHinhKhoMapping`; cờ `laMacDinh` của Shopify là lựa chọn kho tiếp nhận đơn mặc định tại FCentric và KHÔNG được ghi đè lên nhãn `"Mặc định trên sàn"` trên UI (`DongKhoSan`, `KhoXuatDonSan`, `BangMappingKhoSan`). Với các sàn trừ Shopify (`!hoTroDaKhoSan`), `layCauHinhKhoMapping` giữ `laMacDinh` đồng bộ theo `laMacDinhSan`, bỏ nhãn `"Đang chọn đẩy tồn"` ở `KhoXuatDonSan`.
   - **Hiển thị chỉ đọc 1 kho mặc định tại `DongKhoSan.jsx` (tất cả sàn trừ Shopify)**: Lazada, Lazada Sandbox, Shopee, Shopee Sandbox và TikTok Shop KHÔNG mở dropdown chọn danh sách kho ở `DongKhoSan` (`ChannelSettingsPage`, `ChannelSetupWizard`) mà chỉ hiển thị chỉ đọc kho mặc định của sàn + nút `Tải lại từ sàn` (`forceRefresh = true` tự đồng bộ `MA_KHO_SAN`, `TEN_KHO_SAN` và cờ mặc định trong `KHO_MAPPING`).
   - **Loại trừ tuyệt đối kho trả hàng & kho vô hiệu hóa**: Cả 3 sàn (`xacDinhTikTokSalesWarehouseId`, `getLocations` TikTok, `parseLazadaWarehouses`, `layDanhSachKhoShopee`, `layCauHinhKhoMapping`, `luuCauHinhKhoMapping`, `dongBoCoMacDinhTrongKhoMapping`) BẮT BUỘC loại bỏ `customerreturn` / mã chứa `RETURN` hoặc `RMA` (kể cả khi `warehouse_name` là tên shop như `"FCentric"`), `RETURN_WAREHOUSE`, `FBT`, địa chỉ Shopee chỉ mang `RETURN_ADDRESS`, các kho có tên/loại `RETURN`/`Trả hàng` và các kho `DISABLED`/`INACTIVE`/`DELETED`.
   - **Lazada (Single-Warehouse tồn kho)**: Áp dụng mô hình kho mặc định / `GET /rc/warehouse/get` (`DongKhoSan`), khi các kho bán còn lại sau lọc `customerreturn` chưa có `is_default`, tự động ưu tiên `"dropshipping"` làm mặc định trước khi đánh dấu kho đầu tiên.
   - **TikTok Shop (Single-Warehouse bán hàng)**: BẮT BUỘC lọc bỏ 100% `RETURN_WAREHOUSE` khỏi danh sách kho bán hàng (`type == "SALES_WAREHOUSE"`), tuyệt đối không dùng `subType == "DOMESTIC_WAREHOUSE"` làm điều kiện OR (chống lỗi `12052532`). Khi shop có 1 `SALES_WAREHOUSE`, hiển thị gọn trên `DongKhoSan` + nút Tải lại từ sàn.
   - **Shopee**: Áp dụng mô hình kho mặc định / địa chỉ lấy hàng (`get_address_list`) trên `DongKhoSan`.
   - **Xuất kho 3 sàn không popup trừ khi lỗi API (và thiếu tồn vẫn gửi kho đơn)**: Đơn hàng từ Shopee, Lazada, TikTok Shop vẫn chờ nhân viên bấm nút **`Gửi sang kho`** (`NHAP`), nhưng mặc định gửi thẳng sang `don.khoXuat` và **chặn hiển thị popup `HopGuiSangKho` ở cả 2 lớp** (`DonBanHangDetail` + `HopGuiSangKho` qua `coTheMoHopGuiSangKho`).
     - Trường hợp `don.khoXuat` không đủ tồn khả dụng: Backend (`DonBanHangService.sendToWarehouse`) **vẫn gửi đơn sang `don.khoXuat` (`CHO_NHAT_HANG`)**, trả về `data = "CANH_BAO_THIEU_TON"` kèm `message` đúng chuẩn (`Kho {0} không đủ tồn khả dụng ({1}) cho đơn này. Vui lòng sau khi nhận đơn về kho thì sẽ phải chuyển kho nội bộ để đủ lượng tồn.`), và Frontend hiển thị popup thông báo chỉ-đọc (`Đã hiểu`), **không** mở hộp chọn chuyển kho.
     - Popup chọn kho thủ công `HopGuiSangKho` (`thuCongKhiLoi = true`) chỉ được mở (`nenMoHopGuiKhoThuCongKhiLoi`) khi và chỉ khi API gửi tự động bị lỗi (`don.khoXuat` null/ngừng hoạt động trả `409 DON_SAN_CAN_CHON_KHO_THU_CONG`, lỗi mạng `status == null`/`0`, `404`, hoặc lỗi `>= 500`); các lỗi nghiệp vụ khác (`400`, `401`, `403`, `409` khác) chỉ báo toast. Shopify và đơn bán trực tiếp giữ nguyên hộp chọn đa kho.

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
5. **Đồng bộ ngay (Manual Sync) & Ép đẩy toàn bộ tồn**:
   - Job định kỳ (`JOB-03`) giữ nguyên Delta Sync + backoff 60 phút cho SKU lỗi. Riêng thao tác chủ động **`Đồng bộ ngay`** (`DongBoNgayService`) luôn bật `boQuaBackoffLoi = true` để thử lại ngay các SKU `that_bai`, đồng thời ghi nhận `soBoQuaKhongDoi` để UI hiển thị `"{{so}} SKU không đổi"` / `"Không có biến động"`.
   - Tích hợp nút **`Đẩy lại toàn bộ tồn`** (`POST /api/v1/kenh-ban-hang/{maKenh}/dong-bo-ngay?epDayToanBo=true`) trong `NutDongBoNgay` (khi có SKU bị bỏ qua) và menu `⋯` (`ThaoTacDongBo`) để ép đẩy toàn bộ SKU bất kể số tồn chưa đổi across cả 4 sàn.

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
   - **Giai đoạn 4 - Đổi trạng thái vận chuyển (Tuân thủ tiến trình Phiếu xuất kho WMS)**:
     - `IN_TRANSIT` / `shipped`: Chuyển đơn sang `DA_XUAT_TOAN_BO` (3). **Ràng buộc bắt buộc**: Nếu đơn hàng có phiếu xuất kho đang trong quy trình xuất (`CHO_XUAT` hoặc `NHAP`), BẮT BUỘC giữ nguyên trạng thái kho của đơn (`DA_DONG_GOI` = 8 - Chờ xuất kho hoặc `CHO_DONG_GOI` = 7), TUYỆT ĐỐI KHÔNG tự ý chuyển sang `DA_XUAT_TOAN_BO` khi thủ kho chưa bấm xác nhận xuất kho thực tế.
     - `DELIVERED` / `COMPLETED`: Chuyển đơn sang `HOAN_THANH` (5) khi đã hoàn tất xuất kho (hoặc tự động xác nhận phiếu xuất đã đóng gói `CHO_XUAT`). Nếu kho chưa nhặt/chưa đóng gói (`CHO_NHAT_HANG` / `NHAP`) hoặc phiếu xuất đang ở `NHAP`, tuyệt đối giữ nguyên trạng thái kho để không trừ khống tồn, đồng thời gắn cờ `[CẢNH BÁO LỆCH SÀN:]` + bắn thông báo khẩn một lần qua `canhBaoLechTrangThaiSan`. Riêng Shopify, `fulfilled` chỉ tương ứng `DA_XUAT_TOAN_BO` (3), không phải đã giao.
     - `failed_delivery` / `returned`: Chuyển đơn sang `BI_HOAN_TRA` (6).
   - **Giai đoạn 5 - Vận đơn, Mã chia chọn tuyến & Phương thức thanh toán (Shopee / Đa sàn)**:
     - Tuyệt đối KHÔNG tự sinh mã vận đơn giả kiểu `"SPXVN" + orderSn`, KHÔNG ghi thẻ rỗng `[ĐƠN VỊ: ]` vào ghi chú đơn hàng, và KHÔNG hardcode mã tuyến giả `"1-SGN-HUB"` / `"SG100A-00-00-01"`.
     - Sử dụng `ShopeeClient.getTrackingNumber` và `POST /api/v2/logistics/get_shipping_document_data_info` (kèm `package_list.package_number`, có cooldown 15 phút/đơn) để đồng bộ mã vận đơn thật, đơn vị vận chuyển, mã chia chọn tuyến (`first_recipient_sort_code`), mã trạm phát (`second`/`third_recipient_sort_code`), `[PTTT: COD]` / `[PTTT: Ví ShopeePay...]` và `[COD: <amount>]` qua `ShopeeWaybillMetadataHelper` — đồng thời tự chữa (heal) các đơn cũ từng lưu `SPXVN<orderSn>` giả hoặc `[ĐƠN VỊ: ]` rỗng.
     - Phân biệt rạch ròi đơn **COD** (kể cả sau khi `COMPLETED` sang `da_thanh_toan`) với đơn **Ví điện tử / Online** (kể cả khi `UNPAID` — không nhầm thành COD).
     - Giao diện chi tiết đơn (`ThuocTinhDonBan.jsx`) ẩn nút sao chép đối với chuỗi ẩn danh PII (`****`), hiển thị rõ Vận chuyển, Mã vận đơn thật, Mã chia chọn tuyến, Mã trạm phát, Thanh toán sàn, và dọn sạch các thẻ hệ thống nội bộ khỏi ô `Ghi chú` qua `lamSachGhiChuDonSan`.

**Shopify — tiến trình xử lý đơn (AUDIT-105, 18/11/2026):** Chờ nhặt (1), chờ đóng gói (7), chờ xuất (8) phải đồng bộ trạng thái gốc `IN_PROGRESS` bằng `fulfillmentOrderReportProgress` từ API `2026-04`, đầu vào `progressReport.reasonNotes`; kho tự quản lý cần `write_merchant_managed_fulfillment_orders`. Phân tích JSON `errors` và `userErrors`, kiểm tra `supportedActions` và trạng thái trả về; không coi HTTP 200 hoặc tag là thành công. Không tạo fulfillment trước khi kho xuất thật. Theo dõi nghiệm thu tại `docs/tien-do-nghiem-thu.md`.

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
4. **URL ủy quyền TikTok Shop Custom App vs Partner App**: Custom App BẮT BUỘC dùng URL chuẩn `https://auth.tiktok-shops.com/oauth/authorize?app_key=<appKey>&state=<state>` (`TikTokShopClient.generateAuthUrl`). Chỉ dùng `AUTH_URL_PARTNER` (`generatePartnerAuthUrl`) khi cấu hình `service_id` dạng số thực sự khác với `appKey`.

---

## 6. QUY CHUẨN TẠO SẢN PHẨM & PHÂN TRANG TIKTOK SHOP (API v202309)
1. **Định dạng Struct cho đơn vị đo lường**:
   - `package_weight` BẮT BUỘC là struct `{"value": "0.3", "unit": "KILOGRAM"}` (hoặc `GRAM`), tuyệt đối không gửi String thô.
   - `package_dimensions` BẮT BUỘC là struct `{"length": "25", "width": "15", "height": "5", "unit": "CENTIMETER"}`.
2. **Quy tắc phân trang API**:
   - `page_size` và `page_token` của API tìm đơn hàng (`/order/202309/orders/search`) và tìm sản phẩm (`/product/202309/products/search`) BẮT BUỘC nằm ở **Query Parameter trên URL**, không để trong request body JSON.
3. **Phân loại biến thể đa SKU & Single SKU (`sales_attributes`)**:
   - Khi sản phẩm cha có từ 2 SKU biến thể trở lên, BẮT BUỘC gửi `sales_attributes` gồm CẢ `name`, `value_name` VÀ `custom_value` cho từng SKU để TikTok Shop nhận diện đúng giá trị (chống lỗi `Resource Already Exists: Kích cỡ() Màu sắc() is already in use` mã `12052251`).
   - Đảm bảo tính đồng nhất số chiều thuộc tính giữa các SKU và cơ chế chống trùng lặp tổ hợp thuộc tính (tự động đệm mã SKU khi trùng).
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
   - `category_id` BẮT BUỘC là mã danh mục lá (`is_leaf: true`) của cây V2 7 tầng. **TUYỆT ĐỐI KHÔNG** dùng mã giả định cũ `601234` hoặc ép danh mục Quần về từ khóa "áo".
   - **Quy trình xác định danh mục V2**:
     - Bước 1: Ưu tiên AI Recommendation (`POST /product/202309/categories/recommend?category_version=v2`). BẮT BUỘC lọc qua `isPhuHopThoiTrangNamVaUnisex` để loại bỏ triệt để mã `603729` (Áo ngực thể thao) và các danh mục nhạy cảm/nội y/đồ lót/váy đầm nữ mà AI nhận nhầm từ từ khóa "sportware" hay "áo". Nếu trả về danh mục lá hợp lệ có quyền bán (`AVAILABLE`) và phù hợp thời trang nam, sử dụng ngay.
     - Bước 2: Khi AI không khả dụng, chưa cấp quyền hoặc bị bộ lọc an toàn loại bỏ, tự động ánh xạ sang bảng danh mục lá V2 chuẩn thời trang nam TikTok Shop theo từ khóa:
       - Áo Polo nam: `960776`
       - Áo thun nam: `603720`
       - Áo sơ mi nam: `1203984`
       - Áo khoác & Jackets nam: `603706`
       - Áo hoodie & Sweater nam: `603726`
       - Quần jeans nam: `603713`
       - Quần short nam: `603715`
       - Quần dài / Kaki / Casual nam: `603716`
       - Đồ thể thao nam: Phân loại theo dáng áo/quần (Quần -> `603715`/`603716`, Áo khoác -> `603706`, Polo -> `960776`, Mặc định/Áo thun -> `603720`). **TUYỆT ĐỐI CẤM DÙNG `603729` (Áo ngực thể thao)**.
     - Bước 3: Fallback phân nhánh an toàn: Quần về `603713`, Áo về `960776`.
     - **Cập nhật danh mục tự động qua Product Signature**: Bắt buộc gắn `v2CategoryId` vào `productSignature` (`title + "||" + v2CategoryId + "||" + mainImagesSig + "||" + variantImagesSig`) để khi sửa danh mục, hệ thống nhận diện thay đổi và tự động gọi `PUT /product/202309/products/{id}` (`editProduct`) đồng bộ danh mục mới lên TikTok Shop mà không bị chặn bởi Delta Sync cache.
7. **Thuộc tính sản phẩm bắt buộc (Product Attributes & Quốc gia xuất xứ ID 100149)**:
   - Với các danh mục lá ngành thời trang và may mặc, TikTok Shop bắt buộc khai báo danh sách `product_attributes` trong payload tạo sản phẩm.
   - **Tên trường định danh thuộc tính BẮT BUỘC là `id`** (tuyệt đối không đặt tên `attribute_id` để tránh lỗi HTTP 400 mã `36009004: Id of ProductAttributes[0] is a required field and has not been provided`). Cấu trúc chuẩn: `[{"id": "100149", "values": [{"id": "1000854", "name": "Việt Nam"}]}]`.
   - Hệ thống tự động truy vấn `GET /product/202309/categories/{category_id}/attributes?category_version=v2&locale=vi-VN` để lấy danh mục thuộc tính:
     - Mọi thuộc tính có `is_mandatory = true` phải được gán giá trị hợp lệ (lấy từ enum giá trị có sẵn hoặc điền mặc định).
     - Thuộc tính **Quốc gia xuất xứ** (Attribute ID: `100149` / Country of Origin, Value ID: `1000854`) BẮT BUỘC phải luôn có mặt trong `product_attributes`. Giá trị mặc định là `"Việt Nam"`. Nếu API trả về danh sách `values`, ánh xạ đúng `id` và `name` tương ứng với "Việt Nam"; nếu không, dùng fallback `id = "100149"`, `id = "1000854"` và `name = "Việt Nam"` (ngăn chặn triệt để lỗi TikTok mã `12052104: Parameter 'Quốc gia xuất xứ' is invalid because the request is missing product attribute ID '100149'`).
     - Thuộc tính **Tên tổ chức chịu trách nhiệm hàng hóa** (Attribute ID: `101489` theo Nghị định 85/2021/NĐ-CP của Việt Nam) BẮT BUỘC phải luôn có mặt trong `product_attributes`. Tự động điền giá trị doanh nghiệp `"Công ty Cổ phần Thời trang FCentric"` để tránh lỗi TikTok Shop mã `12052104` (`missing product attribute ID '101489'`). Bổ sung kèm địa chỉ tổ chức chịu trách nhiệm nếu danh mục yêu cầu.
8. **Bảng quy đổi kích cỡ (Size Chart Image - `size_chart`)**:
   - Đối với ngành hàng may mặc và thời trang (như Áo Polo, Áo khoác, Đồ thể thao...), TikTok Shop BẮT BUỘC cung cấp trường `size_chart` chứa `image.uri` trong payload tạo sản phẩm (chống lỗi HTTP 400 mã `12052673: Missing Parameter. size_chart_image is required. Please provide it and retry.`).
   - Ảnh size chart BẮT BUỘC phải được upload lên TikTok Shop CDN qua `POST /product/202309/images/upload` với multipart parameter `use_case = "SIZE_CHART_IMAGE"` (tuyệt đối không dùng `MAIN_IMAGE` cho size chart để tránh lỗi `12052670: Invalid size chart image URI`).
   - Cấu trúc JSON chuẩn:
     ```json
     "size_chart": {
       "image": {
         "uri": "tos-maliva-i-o260ufnz6q-us/..."
       }
     }
     ```
   - Hệ thống tự động sinh ảnh bảng quy đổi kích cỡ chuẩn 800x800 cho thương hiệu FCentric và lưu bộ nhớ đệm URI theo `shop_cipher` để tối ưu số lần gọi API upload ảnh.

9. **Chuẩn hóa bắt lỗi trực quan kênh TikTok Shop (tương đương Shopify)**:
   - Toàn bộ phản hồi từ sàn TikTok Shop phải đi qua hàm phân loại `phanLoaiLoiTikTok`, ánh xạ triệt để các mã lỗi kỹ thuật sang thông điệp tiếng Việt và tiếng Anh thân thiện người dùng:
     - Xác thực/Ủy quyền (`105001`, `105002`, `401`, `403`): Báo lỗi cả kênh, yêu cầu kết nối lại gian hàng.
     - Giới hạn tần suất (`429`, `105003`): Báo lỗi cả kênh, hệ thống tự động thử lại.
     - Kho bán hàng (`12052532`): Hướng dẫn cấu hình kho bán hàng nội địa.
     - Bản quyền thương hiệu (`12052106`, `12052107`, bot từ chối nhãn hiệu): Hướng dẫn sửa tên sản phẩm hoặc nộp giấy phép đại lý chính hãng.
     - Thuộc tính Nghị định 85 (`101489`, `101490`): Hướng dẫn bổ sung đơn vị chịu trách nhiệm.
     - Quốc gia xuất xứ (`100149`): Hướng dẫn bổ sung xuất xứ hàng hóa.
     - Bảng quy đổi kích cỡ (`12052673`): Hướng dẫn bổ sung ảnh size chart.
     - Trùng biến thể (`12052251`): Hướng dẫn kiểm tra tổ hợp kích cỡ - màu sắc.
     - Trạng thái kiểm duyệt (`12052528`): Báo sản phẩm đang chờ duyệt hoặc bị từ chối niêm yết.
   - Khi sàn từ chối tạo bài trong `taoSanPhamLenTikTok`, BẮT BUỘC lưu trạng thái `that_bai` kèm lý do trực quan vào bảng `TrangThaiDongBoSanPham` cho toàn bộ biến thể của sản phẩm đó để hiển thị trực tiếp lên tab "Lỗi" của giao diện người dùng.




---

## 10. QUY CHUẨN PHÂN LẬP DANH MỤC NGÀNH HÀNG SHOPEE OFFICIAL VÀ SANDBOX
1. **Phân lập bộ nhớ đệm danh mục lá độc lập theo môi trường**:
   - Sử dụng `SHOPEE_LEAF_CATEGORIES_BY_ENV` với khóa `Boolean isSandbox` để cô lập hoàn toàn danh mục giữa môi trường Test Sandbox và Kênh Shopee Official (Production).
   - Tránh xung đột cache khi một môi trường được gọi trước khiến môi trường còn lại không thể nạp danh mục thực tế từ sàn.
2. **Ngăn chặn rò rỉ mã danh mục test Sandbox**:
   - Mã danh mục `106705L` (Áo Polo) là mã test nội bộ chỉ tồn tại trên hệ thống Sandbox Shopee SG.
   - **TUYỆT ĐỐI KHÔNG** dùng `106705L` làm fallback hoặc mã thử lại trên Shopee Official (Production), vì sẽ gây lỗi HTTP 400 `Invalid category ID`.
3. **Truy vết cây phân cấp danh mục Shopee (Multi-Level Hierarchy Tracing)**:
   - Khi tải toàn bộ danh mục từ `GET /api/v2/product/get_category`, hệ thống xây dựng cây quan hệ cha - con và truy ngược `parent_category_id` lên tới gốc để tính toán đường dẫn phân cấp đầy đủ (`fullPath`, ví dụ: `Thời Trang Nam > Quần Jeans > Ống rộng / Baggy`).
   - Tự động gắn cờ `isMenOrUnisex` cho các danh mục lá thuộc nhánh Thời Trang Nam và Unisex, loại trừ triệt để các ngành Thời trang nữ, Đồ ngủ/Kimonos, Mẹ & Bé, Thú cưng, Bảo hộ xe máy nhằm chống hoàn toàn lỗi nhận nhầm danh mục (như Áo khoác bị gán thành Áo choàng ngủ Kimono mã 100391 hay đồ bảo hộ mô tô mã 101701).
4. **Thuật toán so khớp danh mục thông minh đa ngôn ngữ**:
   - Kết hợp cả tên danh mục FCentric (`sp.getDanhMuc().getTenDanhMuc()`) và tên sản phẩm (`sp.getTenSanPham()`).
   - Ưu tiên tìm kiếm trong tập danh mục lá đã lọc `isMenOrUnisex` trước khi duyệt tập mở rộng.
   - Phân loại chính xác các tiểu mục:
     - Áo khoác gió / Windbreakers (`100144` cho Blouson cản gió), Áo khoác ngoài (`100370`), Áo khoác mùa đông (`100367`), Áo khoác bomber (`100147`).
     - Quần jeans Baggy / Ống rộng (`100174`), Ống suông (`100173`), Quần jeans nam chung (`100103`).
     - Áo polo nam (`100354` / `100187`).
     - Áo sơ mi nam (`100189`), Áo thun nam (`100188`).
5. **Cơ chế Fallback an toàn phân nhánh theo loại trang phục**:
   - Đối với Shopee Sandbox: Giữ nguyên `106705L` làm fallback tuyệt đối an toàn.
   - Đối với Shopee Official: Phân nhánh rõ ràng:
     - Nếu là Quần (Jeans, Shorts, Trousers): fallback về `100103L` (Quần jeans nam).
     - Nếu là Áo (Tops, Polo, T-shirts): fallback về `100187L` (Áo polo nam).
     - Tuyệt đối không để sản phẩm Quần bị fallback nhầm về danh mục Áo polo!
---

## 11. QUY CHUẨN ĐỒNG BỘ ẢNH BIẾN THỂ VÀ PHÂN LOẠI SHOPEE (TIER VARIATION IMAGES)
1. **Khắc phục lỗi toàn bộ biến thể nhận nhầm ảnh sản phẩm cha**:
   - Theo đặc tả Shopee OpenPlatform v2, API `v2.product.init_tier_variation` cho phép đính kèm thuộc tính `image: {"image_id": "..."}` vào từng phần tử trong `option_list` của Tier 1 (phân loại Màu sắc).
   - Nếu `option_list` chỉ gửi chuỗi `option` mà không gửi kèm `image`, sàn Shopee sẽ không gắn ảnh cho các biến thể và mặc định hiển thị duy nhất ảnh đại diện sản phẩm cha cho toàn bộ SKU.
2. **Quy tắc tải và ánh xạ ảnh phân loại biến thể (`AnhBienThe`)**:
   - Trước khi gọi `init_tier_variation`, hệ thống truy vấn `anhBienTheRepository.findActiveByBienTheIds` lấy ảnh thực tế của từng biến thể theo màu sắc.
   - Tải ảnh biến thể lên Shopee Media Space (`v2.media_space.upload_image`) với cơ chế in-memory và database cache (`SHP_IMG:...`).
   - Gán `image: {"image_id": ...}` cho từng màu sắc trong Tier 1 variation. Khi người mua bấm chọn Màu sắc trên Shopee, giao diện tự động chuyển đổi sang đúng ảnh thật của màu đó.
3. **Bổ sung ảnh biến thể vào album ảnh sản phẩm cha**:
   - Trong hàm `chuanBiVaUploadAnhShopee`, nếu album ảnh sản phẩm cha (`AnhQuanAo`) chưa đạt giới hạn 9 ảnh của Shopee, tự động nạp tiếp ảnh từ `AnhBienThe` để bộ sưu tập ảnh chính trên sàn hiển thị đầy đủ các gam màu thực tế.
4. **Hiển thị giao diện FCentric (`toLienKetDto`)**:
   - Luôn ưu tiên hiển thị ảnh riêng của biến thể (`AnhBienThe`), chỉ fallback về ảnh sản phẩm cha (`AnhQuanAo`) khi biến thể đó thực sự chưa có ảnh riêng.

---

## 12. QUY CHUẨN BẢNG QUY ĐỔI KÍCH CỠ (SIZE CHART) VÀ MÔ TẢ SẢN PHẨM SHOPEE (API v2)
1. **Bắt buộc cung cấp Size Chart cho ngành hàng thời trang**:
   - Shopee Open Platform v2 áp dụng chính sách bắt buộc có bảng quy đổi kích cỡ (`size_chart` hoặc `size_chart_info.size_chart`) đối với các ngành hàng thời trang (Áo Polo `11035592L`, Quần Jeans, Áo khoác...).
   - Thiếu tham số này sẽ bị Shopee từ chối với mã lỗi `Size Chart is required for selected category. Please fill in it or change the category.`
   - Hệ thống tự động sinh ảnh đồ họa bảng quy đổi kích cỡ 800x800 chuẩn e-commerce cho thương hiệu FCentric (phân loại riêng Tops và Pants/Bottoms), tải lên Shopee Media Space (`v2.media_space.upload_image`) và lưu bộ nhớ đệm RAM (`CACHED_SHOPEE_SIZE_CHART_ID_BY_SHOP`).
   - Đính kèm đồng thời `size_chart_info: {"size_chart": image_id}` và `size_chart: image_id` vào body của cả Single SKU và Multi-variant để tương thích tuyệt đối mọi phiên bản API của sàn.
2. **Quy chuẩn độ dài mô tả sản phẩm (100 đến 3000 ký tự)**:
   - Shopee Official yêu cầu độ dài mô tả bắt buộc từ 100 đến 3000 ký tự (`Product description length must be between 100 and 3000 characters. Please adjust it.`).
   - Mọi sản phẩm có mô tả `< 100` ký tự BẮT BUỘC tự động đệm thông tin tiêu chuẩn: Chất liệu, Kiểu dáng, Xuất xứ chính hãng FCentric, Hướng dẫn bảo quản và cam kết đổi trả Shopee.
3. **Chuẩn hóa thông điệp lỗi trực quan (`phanLoaiLoiShopee`)**:
   - Lọc và chuyển đổi toàn bộ mã lỗi kỹ thuật từ Shopee (Size Chart, Description length, Category, Access Token, Rate Limit, Image, Brand) thành thông điệp tiếng Việt thân thiện, rõ ràng, hướng dẫn cụ thể cho người bán.
4. **Định tuyến giao diện Shopee Official**:
   - Kênh Shopee Official sử dụng đường dẫn chuẩn `/channels/shopee` (thay vì `/channels/shopee-official`), hỗ trợ bí danh `shopee-official` để tự động chuyển hướng mượt mà không làm đứt gãy liên kết cũ.

---

## 13. QUY CHUẨN DANH MỤC VÀ THÍCH ỨNG THUỘC TÍNH SÀN LAZADA (XML ATTRIBUTES)
1. **Ánh xạ danh mục lá thời trang Lazada VN**:
   - Tuyệt đối không ép cứng danh mục 7930 (Áo thun) cho toàn bộ sản phẩm. Ánh xạ chính xác theo bảng danh mục chuẩn:
     - Quần Jeans nam: `6414` (Quần áo nam > Quần > Quần jeans)
     - Quần ngắn / Shorts nam: `10100765` (Quần áo nam > Quần > Quần ngắn)
     - Quần dài / Kaki / Tây nam: `7991` (Quần áo nam > Quần > Quần)
     - Áo khoác & Áo vest nam: `7953` (Quần áo nam > Áo > Áo khoác nhẹ & Áo vest)
     - Áo hoodies & sweater nam: `6424` (Quần áo nam > Áo > Áo hoodies & sweater nam)
     - Áo thun có cổ / Áo polo nam: `14275` (Quần áo nam > Áo > Áo thun có cổ nam)
     - Áo sơ mi nam: `7940` (Quần áo nam > Áo > Áo sơ mi)
     - Áo thun & Áo phông nam: `7930` (Quần áo nam > Áo > Áo thun & Áo phông)
2. **Thích ứng thuộc tính XML theo nhóm trang phục (Tops vs Bottoms)**:
   - Các thuộc tính chung bắt buộc: `<name>`, `<brand>`, `<description>` (bọc trong thẻ `<p>`), `<short_description>`, `<warranty_type>No Warranty</warranty_type>`, `<fa_pattern>Trơn</fa_pattern>`.
   - Đối với nhóm Áo (Tops - 7930, 14275, 7940, 7953, 6424): Bổ sung `<clothing_material>100% Cotton</clothing_material>` và `<Fit_Type>Slim Fit</Fit_Type>`.
   - Đối với nhóm Quần (Bottoms - 6414, 7991, 10100765): Gửi `<clothing_material>` tương ứng (`Denim` cho jeans, `100% Cotton` cho quần khác). **TUYỆT ĐỐI KHÔNG gửi `<Fit_Type>`** cho danh mục Quần để chống lỗi từ chối XML schema từ sàn Lazada.
