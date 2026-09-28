# KẾ HOẠCH TRIỂN KHAI: KẾT NỐI TOÀN DIỆN VÀ KÍCH HOẠT TƯƠNG TÁC BỘ PROTOTYPE HTML (FSWMS)

> **Dự án:** Fashion Management System (FSWMS)  
> **Thư mục lưu trữ Prototype:** `Fashion-Management/prototype/`  
> **Nguồn gốc Prototype:** Các màn hình xuất trực tiếp (Ctrl+S / Save Page As) từ React Frontend đang chạy thực tế (`http://localhost:5173`)  
> **Phạm vi Use Cases:** 17 Use Cases (FE-02.6 đến FE-06.3; đã loại bỏ FE-07.1 Manage Stock Transfers theo yêu cầu)  
> **Tổng số file màn hình:** 23 file HTML giao diện chi tiết (Không sử dụng trang trung gian `index.html`, toàn bộ các màn hình được nối trực tiếp với nhau theo trình tự nghiệp vụ)  
> **Mục tiêu cốt lõi:** **LOẠI BỎ TOÀN BỘ CÁC LIÊN KẾT `http://localhost:...`, NỐI TRỰC TIẾP CÁC FILE HTML VỚI NHAU THEO ĐÚNG TRÌNH TỰ NGHIỆP VỤ VÀ KÍCH HOẠT 100% NÚT BẤM (BUTTONS), TRƯỜNG NHẬP LIỆU (FIELDS), BỘ LỌC, MODAL/DIALOG VÀ ĐỒNG BỘ DỮ LIỆU LIÊN MÀN** theo đúng logic phân tích nghiệp vụ và hành vi vận hành thực tế của React Frontend.

---

## 1. BỐI CẢNH VÀ ĐẶC ĐIỂM BỘ PROTOTYPE HIỆN TẠI

### 1.1. Hiện trạng các file HTML lưu từ React Frontend (Ctrl+S)
- **Ưu điểm vượt trội:**
  - Giữ nguyên **100% giao diện pixel-perfect** của hệ thống thật: Bảng màu chuẩn FCentric (Navy `#0f172a`, Slate border `#e2e8f0`, Surface `#ffffff`), Tailwind CSS classes, inline SVG vector icons của `lucide-react`, Typography Google Fonts (`DM Sans`, `DM Mono`, `Playfair Display`).
  - Đầy đủ toàn bộ cấu trúc DOM thực tế: Sidebar 5 nhóm chức năng chuẩn `sidebar.config.js`, Top Header với chọn kho và user profile, Breadcrumbs, Bảng dữ liệu có sticky header, các Form fields, Badges trạng thái.
- **Vấn đề kỹ thuật cần khắc phục khi chuyển thành Prototype độc lập:**
  1. **Lỗi script phụ thuộc Vite dev server:** Trong code HTML chứa các thẻ `<script type="module" src="/@react-refresh">` và `<script type="module" src="./..._files/main.jsx">`. Khi mở tĩnh (không chạy Vite dev server), trình duyệt báo lỗi console (Failed to load module script / 404).
  2. **Đường dẫn liên kết tĩnh dính localhost (Dead Links):** Toàn bộ các thẻ liên kết `<a>` trong HTML được lưu dưới dạng `http://localhost:5173/...`, dẫn đến việc click chuột bị lỗi kết nối do không có Vite server chạy nền.
  3. **Nút bấm & Form chưa gắn xử lý tương tác:** Các nút bấm (`+ Thêm mới`, `Xem chi tiết`, `Chỉnh sửa`, `Xóa`, `Phê duyệt`, `Từ chối`, `Thanh toán`, `Nhập kho`, `Phân bổ lô`, `Xác nhận`) chỉ là DOM tĩnh, chưa có logic JavaScript để mở Dialog/Modal, chưa chuyển trang và chưa cập nhật trạng thái.
  4. **Dữ liệu phân mảnh, không chia sẻ trạng thái:** Một thao tác ở màn hình này (ví dụ: tạo PO mới, duyệt PO, nhập kho hoàn tất) không tự động phản ánh vào màn hình khác (Sổ kho, Báo cáo tồn kho, Danh sách đơn mua).

### 1.2. Mục tiêu giải pháp (The Solution Engine)
Xây dựng một **Thư viện Điều khiển Tương tác Tập trung (`prototype-engine.js`)** và **Kho Trạng thái Chia sẻ Client-Side (`localStorage Store`)** nhằm:
- Loại bỏ 100% các liên kết `http://localhost:5173` và thay thế bằng tên file HTML tương đối trực tiếp.
- Dọn sạch lỗi script Vite, đảm bảo mở trực tiếp bằng giao thức file (`file:///...`) trên mọi trình duyệt mà không cần cài Node.js.
- Nối toàn bộ điều hướng Sidebar, Breadcrumbs và các nút thao tác liên màn theo đúng trình tự nghiệp vụ liên hoàn.
- Kích hoạt toàn bộ Form, Input, Search, Filter, Modal Dialog, Toast notifications và In ấn (`window.print()`).
- Đảm bảo luồng dữ liệu xuyên suốt: **Tạo PO -> Duyệt PO -> Thanh toán -> Nhập kho -> Khai báo Lô -> Xác nhận Nhập -> Tăng Tồn kho -> Ghi Sổ kho -> Xuất kho -> Phân bổ Lô -> Xác nhận Xuất -> Giảm Tồn kho -> Ghi Sổ kho**.

---

## 2. MA TRẬN ÁNH XẠ: 17 USE CASES - REACT FRONTEND - 23 FILE PROTOTYPE HTML

| STT | Mã Use Case | Tên Use Case Nghiệp vụ | Tên File HTML Prototype | React Component gốc | URL Route React gốc |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **01** | `FE-02.6` | Manage Materials | `Manage Materials view.html` | `pages/attribute/ProductAttributeHub.jsx` | `/attributes` (Tab Chất liệu) |
| **02** | `FE-02.7` | Manage Barcodes | `Barcode Management.html` | `pages/product/SkuBuilder.jsx` & `BarcodePrint.jsx` | `/sku-builder` |
| **03** | `FE-03.1` | Manage Warehouses | `Warehouse Information Management.html` | `pages/warehouse/Warehouse.jsx` & `WarehouseDialog.jsx` | `/warehouse` |
| **04** | `FE-03.2` | Monitor Inventory | `Inventory Monitoring.html` | `pages/bao-cao/TonKhoTongQuan.jsx` | `/bao-cao/ton-kho` |
| **05** | `FE-03.3` | Monitor Low Stock | `Dashboard Warehouse Manager.html` | `DashboardWarehouseManager.jsx` & `TonKhoTongQuan.jsx` | `/dashboard/warehouse-manager` |
| **06** | `FE-03.4` | Review Inventory Transactions | `Inventory Transaction History.html` | `pages/lich-su-giao-dich-kho/LichSuGiaoDichKhoList.jsx` | `/lich-su-giao-dich-kho` |
| **07** | `FE-04.1` | Manage Suppliers (Danh sách) | `Supplier Management.html` | `pages/supplier/SupplierList.jsx` | `/supplier` |
| **08** | `FE-04.1` | Manage Suppliers (Thêm/Sửa) | `Supplier Management Update.html` | `pages/supplier/SupplierDetail.jsx` | `/supplier/new`, `/supplier/:id` |
| **09** | `FE-04.2` | Review Supplier Purchase History | `Supplier Management Detail.html` | `pages/supplier/SupplierDetailView.jsx` | `/supplier/view/:id` |
| **10** | `FE-04.3` | Purchase Request (Danh sách PR) | `Purchase Request Management.html` | `pages/purchase-oder-create-req/ApplicationRequestManagement.jsx` | `/application-requests` |
| **11** | `FE-04.3` | Purchase Request (Tạo PR) | `Purchase Request Management Create.html` | `pages/purchase-oder-create-req/PurchaseRequestCreate.jsx` | `/purchase-requests/create` |
| **12** | `FE-04.3` | Approve Purchase Order (Xét duyệt) | `Purchase Request Management Details.html` | `ApplicationRequestManagement.jsx` & `PurchaseRequestDetail.jsx` | `/application-requests/:id` |
| **13** | `FE-04.3` | Manage Purchase Orders (Danh sách PO)| `Purchase Order Management.html` | `pages/order/PurchaseOrder.jsx` | `/purchase-orders` |
| **14** | `FE-04.3` | Manage Purchase Orders (Tạo PO) | `Purchase Order Management Create.html` | `pages/order/PurchaseOrderCreateManual.jsx` | `/purchase-orders/create` |
| **15** | `FE-04.4` | Record Supplier Payment & PO Detail | `Purchase Order Management Details.html` | `pages/order/PurchaseOrderDetail.jsx` & `PurchaseOrderPayment.jsx` | `/purchase-orders/:id` |
| **16** | `FE-05.1` | Manage Goods Receipts (Danh sách NK) | `Goods Receipt Management.html` | `pages/receipt/PhieuNhapKhoList.jsx` | `/phieu-nhap-kho` |
| **17** | `FE-05.1` | Manage Goods Receipts (Tạo NK từ PO) | `Goods Receipt Management Create.html` | `pages/receipt/PhieuNhapKhoCreate.jsx` | `/phieu-nhap-kho/create` |
| **18** | `FE-05.1` | Manage Goods Receipts (Chi tiết NK) | `Goods Receipt Management Details.html` | `pages/receipt/PhieuNhapKhoDetail.jsx` | `/phieu-nhap-kho/:id` |
| **19** | `FE-05.2` | Record Receiving Lot Information | `Receiving Lot Management.html` | `pages/receipt/KhaiBaoLo.jsx` | `/phieu-nhap-kho/:id/khai-bao-lo` |
| **20** | `FE-05.3` | Confirm Goods Receipt (Xác nhận nhập)| `Goods Receipt Confirmation.html` | `PhieuNhapKhoDetail.jsx` & `PhieuNhapKhoPrint.jsx` | `/phieu-nhap-kho/:id/confirm` |
| **21** | `FE-06.1` | Manage Pick Lists (Danh sách XK) | `Goods Issue Management.html` | `pages/issue/PhieuXuatKhoList.jsx` | `/phieu-xuat-kho` |
| **22** | `FE-06.1` | Manage Pick Lists (Tạo XK từ SO) | `Goods Issue Management Create.html` | `pages/issue/PhieuXuatKhoCreate.jsx` | `/phieu-xuat-kho/create` |
| **23** | `FE-06.2` & `FE-06.3` | Prepare Picking & Confirm Issue | `Goods Issue Management Details.html` | `pages/issue/PickLot.jsx` & `PhieuXuatKhoDetail.jsx` | `/phieu-xuat-kho/:id` |

---

## 3. KIẾN TRÚC KỸ THUẬT NỀN TẢNG (PROTOTYPE INTERACTIVE ENGINE)

Để biến các snapshot HTML thành ứng dụng tương tác sống động mà không phá vỡ bất kỳ dòng HTML/CSS nào của React xuất ra, ta xây dựng giải pháp theo kiến trúc 3 lớp:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TẦNG TRÌNH DIỄN (HTML UI)                        │
│   23 File HTML Ctrl+S giữ nguyên 100% DOM, Tailwind CSS, Lucide Icons  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Bắt sự kiện Click, Input, Change, Submit
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             LÕI ĐIỀU HÀNH TƯƠNG TÁC (prototype-engine.js)              │
│  - Generic Event Delegator & UI Handlers (Modal, Dropdown, Tabs, Toast)│
│  - URL Query Parser & Router (Nối liên kết giữa 23 trang HTML)          │
│  - Table Filter, Live Search & Pagination Engine                       │
│  - Business Flow Controllers (PO Flow, Receipt Flow, Issue Flow)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Đọc / Ghi trạng thái (Reactive Sync)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             KHO DỮ LIỆU CHIA SẺ CLIENT-SIDE (localStorage Store)       │
│  - Seed Data: Suppliers, Warehouses, Materials, SKUs, Orders, Tickets  │
│  - Mutations: Add, Update, Approve, Pay, Allocate Lots, Confirm        │
│  - Transaction Ledger: Tự động ghi chép biến động sổ kho thời gian thực │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1. Dọn dẹp mã nguồn HTML tĩnh (HTML Sanitization & Baseline Hook)
- Thay thế các thẻ script dev Vite không khả dụng:
  - Loại bỏ `<script type="module">import { injectIntoGlobalHook } ...</script>`.
  - Thay thế `<script type="module" src="./..._files/main.jsx"></script>` bằng việc nhúng:
    ```html
    <script src="./assets/js/prototype-engine.js"></script>
    ```
- Đảm bảo thẻ `<meta charset="UTF-8">` đứng đầu thẻ `<head>` để hiển thị tiếng Việt hoàn hảo trên tất cả các trình duyệt.
- Chuẩn hóa đường dẫn tương đối cho tài nguyên ảnh, favicon và font.

### 3.2. Cấu trúc Kho dữ liệu chia sẻ `localStorage` (`fswms_prototype_db`)
Khi người dùng mở bất kỳ trang nào lần đầu, `prototype-engine.js` sẽ tự động khởi tạo dữ liệu mẫu phong phú trong `localStorage` nếu chưa tồn tại:
1. `suppliers`: Danh sách nhà cung cấp (mã, tên, liên hệ, SĐT, email, địa chỉ, trạng thái, đánh giá sao).
2. `warehouses`: Danh mục kho hàng (KHO01 - Kho Hà Nội, KHO02 - Kho TP.HCM, KHO03 - Kho Đà Nẵng, diện tích, sức chứa, thủ kho).
3. `materials`: Danh mục chất liệu vải (Cotton 100%, Polyester, Kaki thun, Vải lanh Linen, Vải lụa Tơ tằm, v.v.).
4. `skus`: Danh mục SKU sản phẩm thời trang (Áo thun chạy bộ, Quần jeans Slimfit, Đầm dạo phố, Áo sơ mi Oxford, kèm màu, size, chất liệu, barcode, tồn kho, giá nhập).
5. `purchase_requests`: Danh sách yêu cầu mua hàng (Mã PR, Người tạo, Ngày tạo, Kho đích, Trạng thái: `CHO_DUYET`, `DA_DUYET`, `TU_CHOI`, sản phẩm chi tiết).
6. `purchase_orders`: Danh sách đơn mua hàng (Mã PO, NCC, Ngày đặt, Dự kiến giao, Trạng thái duyệt: `CHO_DUYET` / `DA_DUYET`, Trạng thái thanh toán: `CHUA_THANH_TOAN` / `DA_THANH_TOAN`, Trạng thái nhập kho: `CHUA_NHAP` / `DANG_NHAP` / `HOAN_THANH`, Tổng tiền).
7. `goods_receipts`: Danh sách phiếu nhập kho (Mã NK, Mã PO liên kết, Kho nhập, Trạng thái: `CHO_KHAI_BAO_LO`, `DA_KHAI_BAO_LO`, `HOAN_THANH`, danh sách lô hàng).
8. `goods_issues`: Danh sách phiếu xuất kho (Mã XK, Mã SO, Khách hàng, Trạng thái: `CHO_LAY_HANG`, `DANG_LAY_HANG`, `DA_XUAT_KHO`, danh sách lô bốc hàng).
9. `inventory_stock`: Tồn kho theo từng SKU và Kho (Tồn thực tế On-hand, Tồn giữ chỗ Committed, Đang về Incoming, Khả dụng Free-to-use, Ngưỡng cảnh báo Min stock).
10. `inventory_transactions`: Sổ cái giao dịch kho (Mã GD, Mã chứng từ NK/XK, SKU, Loại GD, Số lượng biến động +/- , Tồn trước, Tồn sau, Thời gian, Người thực hiện).

---

## 4. CHI TIẾT KẾT NỐI TỪNG USE CASE VÀ MÀN HÌNH PROTOTYPE

### 4.1. Nhóm Quản trị Chất liệu & Tem nhãn Mã vạch (FE-02.6 & FE-02.7)

#### A. `Manage Materials view.html` (FE-02.6 Material Management)
- **Vị trí React:** `pages/attribute/ProductAttributeHub.jsx` (Tab Chất liệu).
- **Liên kết điều hướng:**
  - Sidebar: click "Chất liệu & Thuộc tính" đánh dấu active menu.
  - Chuyển Tab: Click giữa các tab "Chất liệu", "Màu sắc", "Kích cỡ", "Danh mục" -> Chuyển đổi nội dung bảng tương ứng mà không cần tải lại trang.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - **Ô Tìm kiếm (`Search Input`):** Lọc tức thời danh sách chất liệu theo tên hoặc mã.
  - **Nút "+ Thêm chất liệu":** Bật Modal `Dialog Thêm chất liệu mới` (Tên chất liệu, Mã chất liệu, Mô tả).
  - **Nút "Lưu" trong Modal Thêm:** Kiểm tra validate (không để trống tên), thêm 1 dòng mới vào bảng, lưu vào `localStorage`, hiển thị Toast: *"Thêm mới chất liệu thành công!"*, đóng Modal.
  - **Nút "Chỉnh sửa" (Icon bút) trên từng dòng:** Mở Modal `Chỉnh sửa chất liệu` với dữ liệu dòng đó điền sẵn -> bấm "Cập nhật" -> cập nhật lại dòng hiển thị và Toast thông báo.
  - **Nút "Xóa" (Icon thùng rác):** Mở Dialog xác nhận xóa -> Bấm "Xác nhận xóa" -> Xóa dòng khỏi bảng và hiển thị Toast *"Đã xóa chất liệu"*.
  - **Bộ phân trang:** Bấm nút chuyển trang 1, 2, Tiếp, Trước để xem các phân trang dữ liệu.

#### B. `Barcode Management.html` (FE-02.7 Barcode Management)
- **Vị trí React:** `pages/product/SkuBuilder.jsx` & `BarcodePrint.jsx`.
- **Liên kết điều hướng:**
  - Sidebar: click "Mã vạch & SKU".
- **Tương tác Nút bấm & Trường dữ liệu:**
  - **Thanh tìm kiếm & Dropdown danh mục:** Lọc danh sách SKU theo tên, mã SKU, danh mục áo/quần/váy.
  - **Checkbox từng dòng & Checkbox "Chọn tất cả" ở Header:** Checkbox phản hồi trực quan, hiển thị số lượng SKU đã chọn ở thanh công cụ dưới chân màn hình (ví dụ: *"Đã chọn 3 SKU"*).
  - **Nút "In mã vạch" (Barcode Print Button):**
    - Mở Modal Preview Tem In Barcode (`BarcodePrint Modal`).
    - Trong Modal: Hiển thị bản xem trước tem (Tên sản phẩm, Mã vạch Barcode 1D Code 128 vẽ bằng SVG/Canvas, Kích cỡ Size, Màu sắc, Giá bán).
    - Cấu hình kích thước tem: Dropdown chọn khổ tem (35x22mm, 50x30mm, 70x40mm) -> preview thay đổi kích thước theo tỉ lệ.
    - Nút "In ngay": Kích hoạt `window.print()` với định dạng in chuyên dụng cho máy in nhiệt / tem decal.
    - Nút "Đóng": Tắt Modal xem trước.
  - **Nút "Sinh mã Barcode tự động" (Generate Barcode):** Sinh chuỗi barcode EAN-13/Code 128 ngẫu nhiên hợp lệ và cập nhật vào ô dữ liệu SKU.

---

### 4.2. Nhóm Quản trị Kho bãi, Giám sát Tồn kho & Sổ kho (FE-03.1, FE-03.2, FE-03.3, FE-03.4)

#### A. `Warehouse Information Management.html` (FE-03.1 Warehouse Management)
- **Vị trí React:** `pages/warehouse/Warehouse.jsx` & `WarehouseDialog.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - **Thẻ chỉ số tổng quan (KPIs):** Tổng số kho (3 kho), Kho đang hoạt động (3), Tổng diện tích (12,500 m²), Tỉ lệ lấp đầy trung bình (68%).
  - **Nút "+ Thêm kho hàng":** Mở Modal `WarehouseDialog` gồm các trường:
    - Mã kho (ví dụ `KHO04`), Tên kho, Quản lý kho, Số điện thoại, Địa chỉ chi tiết, Diện tích (m²), Sức chứa (SKU), Trạng thái (Hoạt động / Tạm dừng).
    - Nút "Lưu kho": Validate dữ liệu -> Thêm kho mới vào danh sách -> Tăng KPI tổng số kho -> Toast thông báo thành công.
  - **Nút "Chỉnh sửa kho":** Mở Modal với dữ liệu kho hiện tại -> sửa tên/địa chỉ -> bấm "Cập nhật".
  - **Switch/Toggle trạng thái hoạt động:** Bật/tắt trạng thái Hoạt động / Ngừng hoạt động tức thời trên từng kho.
  - **Nút "Xem tồn kho tại kho này":** Điều hướng sang `Inventory Monitoring.html?warehouseId=KHO01`.

#### B. `Inventory Monitoring.html` (FE-03.2 Inventory Monitoring)
- **Vị trí React:** `pages/bao-cao/TonKhoTongQuan.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - **Dropdown chọn kho hàng (`Warehouse Selector`):** Chọn giữa "Tất cả các kho", "Kho Hà Nội (KHO01)", "Kho TP.HCM (KHO02)", "Kho Đà Nẵng (KHO03)" -> Lọc lại bảng số liệu theo kho tương ứng.
  - **Bộ lọc tình trạng tồn kho (`Stock Status Filter`):**
    - Tab `Tất cả`: Hiển thị toàn bộ SKU.
    - Tab `Còn hàng`: Tồn khả dụng > 10.
    - Tab `Sắp hết` (Low Stock): Tồn khả dụng <= Ngưỡng an toàn (Min stock).
    - Tab `Hết hàng` (Out of Stock): Tồn khả dụng = 0.
  - **Thanh tìm kiếm SKU:** Nhập tên sản phẩm hoặc mã SKU để tìm kiếm tức thời.
  - **Bảng dữ liệu đa cột trực quan:**
    - Cột: Mã SKU, Tên sản phẩm, Kho lưu trữ, Tồn thực tế (On-hand), Giữ chỗ (Committed), Đang về (Incoming từ PO), Khả dụng (Free-to-use = On-hand - Committed), Mức an toàn (Min Stock), Trạng thái Badge (Xanh / Vàng / Đỏ).
  - **Nút "Tạo yêu cầu mua hàng" (icon Giỏ hàng) trên dòng cảnh báo thiếu:**
    - Nhấp nút này sẽ tự động chuyển hướng sang `Purchase Order Management Create.html?sku=ABC-TIM-S` hoặc `Purchase Request Management Create.html` với thông tin SKU được chọn điền sẵn!
  - **Nút "Xuất báo cáo Excel":** Tạo file CSV/Excel mock và tải về máy.

#### C. `Dashboard Warehouse Manager.html` (FE-03.3 Low Stock Monitoring)
- **Vị trí React:** `DashboardWarehouseManager.jsx` kết hợp dữ liệu cảnh báo.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - **Các thẻ Cảnh báo khẩn cấp (Alert Cards):**
    - Thẻ "Cảnh báo hết/thiếu hàng": Bấm trực tiếp vào thẻ -> Điều hướng ngay sang `Inventory Monitoring.html?filter=low_stock`.
    - Thẻ "Đơn mua chờ nhập": Bấm vào thẻ -> Điều hướng sang `Goods Receipt Management.html?status=pending`.
    - Thẻ "Phiếu xuất chờ bốc hàng": Bấm vào thẻ -> Điều hướng sang `Goods Issue Management.html?status=pending`.
  - **Biểu đồ & Widget tiến độ xử lý:** Widget hiển thị các phiếu nhập/xuất trong ngày có thể bấm xem chi tiết từng phiếu.

#### D. `Inventory Transaction History.html` (FE-03.4 Inventory Transaction History)
- **Vị trí React:** `pages/lich-su-giao-dich-kho/LichSuGiaoDichKhoList.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - **4 Thẻ thống kê KPI giao dịch:** Tổng giao dịch (128), Nhập kho (64), Xuất kho (48), Điều chỉnh/Kiểm kê (16).
  - **Bộ lọc loại giao dịch (`Transaction Type Filter`):** Dropdown lọc Tất cả / Nhập kho mua hàng (PO) / Xuất kho bán hàng (SO) / Kiểm kê kho.
  - **Bộ lọc khoảng ngày (`Date Range`):** Từ ngày - Đến ngày.
  - **Liên kết chứng từ thông minh (Smart Voucher Linking):**
    - Trên bảng giao dịch, click vào Mã chứng từ dạng `NK-...` -> Mở trực tiếp màn hình `Goods Receipt Management Details.html?id=NK-...`.
    - Click vào Mã chứng từ dạng `XK-...` -> Mở trực tiếp màn hình `Goods Issue Management Details.html?id=XK-...`.
  - **Nút "Chi tiết giao dịch" (Icon con mắt):** Mở Modal xem chi tiết log giao dịch (Mã SKU, Số lượng thay đổi, Tồn trước, Tồn sau, Mã lô liên quan, Vị trí kho, Người thực hiện, Ghi chú nghiệp vụ).

---

### 4.3. Nhóm Quản trị Nhà cung cấp & Lịch sử mua hàng (FE-04.1 & FE-04.2)

#### A. `Supplier Management.html` (FE-04.1 Supplier Management List)
- **Vị trí React:** `pages/supplier/SupplierList.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - **Thanh tìm kiếm:** Lọc tức thời theo tên nhà cung cấp, mã NCC, email, số điện thoại.
  - **Bộ lọc trạng thái:** Dropdown Tất cả / Đang hoạt động / Ngừng hoạt động.
  - **Nút "+ Thêm nhà cung cấp":** Chuyển hướng sang `Supplier Management Update.html?mode=create`.
  - **Cột Thao tác trên từng dòng NCC:**
    - **Nút "Xem chi tiết" (Icon mắt):** Chuyển hướng sang `Supplier Management Detail.html?id=NCC001`.
    - **Nút "Chỉnh sửa" (Icon bút):** Chuyển hướng sang `Supplier Management Update.html?mode=edit&id=NCC001`.
    - **Nút "Xóa" (Icon thùng rác):** Mở Modal xác nhận xóa NCC -> Bấm "Xóa" -> Ẩn dòng NCC, cập nhật store, Toast thông báo.
  - **Phân trang:** Chuyển trang 1, 2, đổi số dòng hiển thị (5 dòng, 10 dòng).

#### B. `Supplier Management Update.html` (FE-04.1 Supplier Create/Edit Form)
- **Vị trí React:** `pages/supplier/SupplierDetail.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - **Tiêu đề trang động:** Tự động hiển thị "Thêm mới nhà cung cấp" hoặc "Cập nhật nhà cung cấp" dựa trên URL parameter `?mode=create` hoặc `?mode=edit`.
  - **Các trường biểu mẫu:** Mã NCC, Tên công ty, Người liên hệ, Chức vụ, Số điện thoại, Email, Địa chỉ, Mã số thuế, Đánh giá chất lượng, Ghi chú hợp đồng, Trạng thái (Hoạt động / Tạm ngừng).
  - **Nút "Hủy bỏ / Quay lại":** Quay trở lại trang `Supplier Management.html`.
  - **Nút "Lưu thông tin":** Validate form (bắt buộc tên công ty, email hợp lệ, SĐT) -> Lưu vào Store -> Toast: *"Lưu thông tin nhà cung cấp thành công!"* -> Tự động chuyển hướng về `Supplier Management.html`.

#### C. `Supplier Management Detail.html` (FE-04.2 Supplier Purchase History)
- **Vị trí React:** `pages/supplier/SupplierDetailView.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - **Thẻ hồ sơ NCC:** Hiển thị toàn bộ thông tin đối tác, địa chỉ, người liên hệ, hạn mức công nợ.
  - **Tab "Lịch sử mua hàng" (Supplier Purchase History):**
    - Bảng danh sách các đơn mua hàng (PO) đã từng đặt từ nhà cung cấp này (Mã PO, Ngày đặt, Tổng tiền, Trạng thái đơn, Trạng thái thanh toán, Trạng thái giao hàng).
    - Click vào Mã PO -> Chuyển thẳng sang `Purchase Order Management Details.html?poId=PO-2024-001`.
  - **Nút "+ Tạo đơn mua hàng mới cho NCC này":**
    - Chuyển hướng sang `Purchase Order Management Create.html?supplierId=NCC001` với trường Nhà cung cấp đã được tự động chọn sẵn!
  - **Nút "Chỉnh sửa hồ sơ":** Chuyển sang `Supplier Management Update.html?mode=edit&id=NCC001`.
  - **Nút "Quay lại danh sách":** Trở về `Supplier Management.html`.

---

### 4.4. Nhóm Quản trị Đơn mua hàng, Phê duyệt & Thanh toán (FE-04.3 & FE-04.4)

#### A. `Purchase Request Management.html` & `Purchase Request Management Create.html` (FE-04.3 Purchase Request Flow)
- **Vị trí React:** `ApplicationRequestManagement.jsx` & `PurchaseRequestCreate.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - `Purchase Request Management.html`:
    - Bảng danh sách các yêu cầu mua hàng (Mã PR, Ngày tạo, Người tạo, Kho đích, Trạng thái: `Chờ duyệt`, `Đã duyệt`, `Từ chối`).
    - Nút "+ Tạo yêu cầu mua hàng" -> Chuyển tới `Purchase Request Management Create.html`.
    - Click vào từng dòng yêu cầu -> Chuyển tới `Purchase Request Management Details.html?id=PR001`.
  - `Purchase Request Management Create.html`:
    - Chọn Kho nhận hàng, Lý do mua sắm.
    - Thêm sản phẩm: Nút "+ Thêm sản phẩm" -> Dropdown chọn SKU, nhập số lượng yêu cầu.
    - Nút "Gửi yêu cầu mua hàng": Validate -> Lưu yêu cầu mới vào store với trạng thái `Chờ duyệt` -> Toast: *"Gửi yêu cầu mua hàng thành công!"* -> Chuyển về danh sách PR.

#### B. `Purchase Request Management Details.html` (FE-04.3 Approve Purchase Order)
- **Vị trí React:** `ApplicationRequestManagement.jsx` & `PurchaseOrderDetail.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - Hiển thị đầy đủ thông tin: Người yêu cầu, Kho đích, Bảng chi tiết sản phẩm, màu sắc, size, số lượng.
  - **Nút "Phê duyệt" (Approve Button - Màu xanh lá):**
    - Mở Modal `Xác nhận phê duyệt yêu cầu`: Nhập ghi chú duyệt (tùy chọn).
    - Bấm "Xác nhận duyệt":
      - Cập nhật trạng thái yêu cầu thành `Đã phê duyệt` (Approved Badge).
      - Tự động sinh ra 1 Đơn mua hàng (PO) chính thức mới trong `Purchase Order Management.html` với thông tin sản phẩm này.
      - Toast: *"Phê duyệt yêu cầu thành công! Đã tạo đơn mua hàng PO tương ứng."*.
      - Ẩn cụm nút Duyệt/Từ chối, hiển thị Badge "Đã duyệt bởi Quản lý kho".
  - **Nút "Từ chối" (Reject Button - Màu đỏ):**
    - Mở Modal `Từ chối yêu cầu`: Bắt buộc nhập lý do từ chối.
    - Bấm "Xác nhận từ chối": Cập nhật trạng thái thành `Từ chối`, lưu lý do từ chối, Toast: *"Đã từ chối yêu cầu mua hàng."*.
  - **Nút "Quay lại":** Quay về `Purchase Request Management.html`.

#### C. `Purchase Order Management.html` (FE-04.3 Purchase Order List)
- **Vị trí React:** `pages/order/PurchaseOrder.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - Bộ lọc trạng thái đơn: Tất cả / Chờ duyệt / Đã duyệt / Đang giao / Hoàn thành.
  - Thanh tìm kiếm theo mã PO, tên Nhà cung cấp.
  - **Nút "+ Tạo đơn mua hàng":** Chuyển hướng sang `Purchase Order Management Create.html`.
  - **Cột Thao tác trên từng đơn hàng PO:**
    - **Nút "Xem chi tiết" (Icon mắt):** Mở `Purchase Order Management Details.html?poId=PO-2024-001`.
    - **Nút "Thanh toán" (Icon Thẻ tín dụng):** Mở Modal Ghi nhận thanh toán ngay lập tức hoặc điều hướng sang màn chi tiết tại tab Thanh toán (FE-04.4).
    - **Nút "Tạo phiếu nhập kho" (Icon Package-plus):** Chỉ sáng khi PO đã duyệt -> Click sẽ chuyển thẳng sang `Goods Receipt Management Create.html?poId=PO-2024-001`!
  - Phân trang đơn mua hàng.

#### D. `Purchase Order Management Create.html` (FE-04.3 Manual PO Creation)
- **Vị trí React:** `pages/order/PurchaseOrderCreateManual.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - Chọn Nhà cung cấp (Dropdown danh sách NCC từ store), Chọn Kho nhập hàng, Ngày giao dự kiến, Điều khoản thanh toán.
  - **Bảng Thêm sản phẩm vào PO:**
    - Nút "+ Thêm sản phẩm": Thêm dòng sản phẩm mới.
    - Dropdown chọn SKU -> Tự động điền Tên SP, Màu sắc, Size, Đơn giá nhập tham khảo.
    - Ô nhập "Số lượng đặt" và "Đơn giá mua" -> Tự động tính thành tiền dòng đó.
    - Nút Xóa dòng sản phẩm.
  - **Khung Tổng kết Tài chính (Tự động tính toán theo thời gian thực):**
    - Tổng tiền hàng = Tổng các dòng.
    - Thuế VAT (10%) = Tổng tiền hàng * 0.1.
    - Tổng thanh toán = Tổng tiền hàng + VAT.
  - **Nút "Tạo đơn hàng":** Validate đầy đủ thông tin -> Lưu đơn PO mới vào Store -> Toast thông báo -> Chuyển về `Purchase Order Management.html`.

#### E. `Purchase Order Management Details.html` (FE-04.4 Record Supplier Payment & PO Details)
- **Vị trí React:** `pages/order/PurchaseOrderDetail.jsx` & `PurchaseOrderPayment.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - Hiển thị đầy đủ thông tin đơn PO: Mã PO, Nhà cung cấp, Kho nhập, Trạng thái duyệt, Trạng thái thanh toán, Bảng sản phẩm và tổng tiền.
  - **FE-04.4 Ghi nhận Thanh toán Nhà cung cấp (Record Supplier Payment):**
    - **Nút "Ghi nhận thanh toán":**
      - Mở Modal `Ghi nhận thanh toán đơn mua hàng`.
      - Các trường trong Modal: Tổng số tiền đơn hàng (VND), Số tiền thực thanh toán, Phương thức thanh toán (Chuyển khoản ngân hàng, Tiền mặt, Thẻ tín dụng, Đối trừ công nợ), Mã giao dịch ngân hàng / Ủy nhiệm chi, Ngày thanh toán, File chứng từ đính kèm (giả lập), Ghi chú thanh toán.
      - **Nút "Xác nhận thanh toán":** Kiểm tra số tiền hợp lệ -> Cập nhật trạng thái PO thành `Đã thanh toán` (Paid) -> Cập nhật badge trên trang -> Toast: *"Ghi nhận thanh toán thành công!"* -> Lưu lịch sử thanh toán vào store.
  - **Nút "Tạo phiếu nhập kho":** Chuyển sang `Goods Receipt Management Create.html?poId=PO-2024-001`.
  - **Nút "In đơn mua hàng":** Gọi `window.print()` in phiếu PO chuẩn A4.

---

### 4.5. Nhóm Quản trị Nhập kho, Khai báo Lô & Xác nhận Nhập (FE-05.1, FE-05.2, FE-05.3)

#### A. `Goods Receipt Management.html` (FE-05.1 Goods Receipt List)
- **Vị trí React:** `pages/receipt/PhieuNhapKhoList.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - Bộ lọc trạng thái phiếu nhập: Tất cả / Chờ khai báo lô / Chờ kiểm tra / Hoàn thành.
  - Search theo Mã phiếu nhập (`NK-...`), Mã PO liên kết (`PO-...`), Nhà cung cấp.
  - **Nút "+ Tạo phiếu nhập kho":** Chuyển hướng sang `Goods Receipt Management Create.html`.
  - **Thao tác trên dòng phiếu nhập:**
    - Click vào mã phiếu hoặc icon Xem -> Chuyển sang `Goods Receipt Management Details.html?id=NK-2024-001`.
    - Nếu phiếu ở trạng thái `Chờ khai báo lô` -> Có nút "Khai báo lô" dẫn sang `Receiving Lot Management.html?id=NK-2024-001`.
    - Nếu phiếu đã khai báo lô -> Có nút "Xác nhận nhập kho" dẫn sang `Goods Receipt Confirmation.html?id=NK-2024-001`.

#### B. `Goods Receipt Management Create.html` (FE-05.1 Create Receipt from PO)
- **Vị trí React:** `pages/receipt/PhieuNhapKhoCreate.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - **Dropdown chọn Đơn mua hàng (PO Selector):** Chọn một đơn PO đã được duyệt (ví dụ `PO-2024-001`).
    - Ngay khi chọn PO: Tự động trích xuất và hiển thị Nhà cung cấp, Kho nhập, và toàn bộ danh sách SKU cùng số lượng đã đặt từ đơn PO đó!
  - Nhập thông tin vận chuyển: Đơn vị giao vận, Biển số xe, Tên tài xế, Người tiếp nhận tại kho.
  - **Nút "Tạo phiếu nhập":**
    - Sinh mã phiếu mới (ví dụ `NK-2024-001`).
    - Lưu vào Store với trạng thái `Chờ khai báo lô`.
    - Toast: *"Tạo phiếu nhập thành công! Chuyển sang bước khai báo lô hàng."*.
    - Tự động điều hướng ngay sang `Receiving Lot Management.html?receiptId=NK-2024-001`!

#### C. `Receiving Lot Management.html` (FE-05.2 Record Receiving Lot Information)
- **Vị trí React:** `pages/receipt/KhaiBaoLo.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - Hiển thị thông tin phiếu nhập liên kết và danh sách các SKU cần khai báo lô.
  - **Khung Khai báo Lô cho từng SKU:**
    - Nút "+ Thêm lô hàng": Bổ sung thêm 1 dòng lô cho SKU đó (hỗ trợ 1 sản phẩm nhập từ nhiều lô khác nhau).
    - Các trường trên mỗi dòng lô:
      - Mã lô (`Lot Code` - ví dụ `LOT-2409-A1`).
      - Ngày sản xuất (`MFG Date`).
      - Hạn sử dụng (`EXP Date` - tự động validate HSD phải sau Ngày SX).
      - Số lượng nhập của lô (`Quantity`).
      - Vị trí kệ dự kiến lưu kho (Aisle / Shelf / Bin, ví dụ `KỆ A-01-02`).
    - **Logic Kiểm tra Số lượng tự động (Auto Real-time Balance Checker):**
      - Hệ thống tự tính: `Tổng SL đã phân bổ vào các lô` so với `SL yêu cầu nhập`.
      - Nếu `Tổng SL lô == SL yêu cầu`: Badge hiển thị màu xanh lá *"Đủ số lượng (100%)"*.
      - Nếu `Tổng SL lô < SL yêu cầu`: Cảnh báo màu vàng *"Thiếu X sản phẩm chưa gán lô"*.
      - Nếu `Tổng SL lô > SL yêu cầu`: Cảnh báo màu đỏ *"Số lượng lô vượt quá SL đơn hàng"*.
  - **Nút "Lưu thông tin lô":**
    - Chỉ cho phép lưu khi tất cả sản phẩm đều đã được phân bổ lô hợp lệ và đủ số lượng.
    - Cập nhật trạng thái phiếu nhập thành `Đã khai báo lô`.
    - Toast: *"Khai báo thông tin lô thành công!"*.
    - Chuyển hướng sang màn hình Xác nhận nhập kho `Goods Receipt Confirmation.html?id=NK-2024-001` hoặc `Goods Receipt Management Details.html`.

#### D. `Goods Receipt Confirmation.html` & `Goods Receipt Management Details.html` (FE-05.3 Confirm Goods Receipt)
- **Vị trí React:** `pages/receipt/PhieuNhapKhoDetail.jsx` & `PhieuNhapKhoPrint.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - Hiển thị bảng đối soát đầy đủ: SKU, Thông tin các lô đã khai báo (Mã lô, NSX, HSD, Vị trí kho), Số lượng thực nhập.
  - **Nút "In phiếu nhập kho":** Mở bản in phiếu nhập kho chuẩn (có chữ ký Thủ kho, Người giao hàng, Kế toán kho) qua `window.print()`.
  - **Nút "Xác nhận nhập kho" (Confirm Receipt Action):**
    - Mở Modal `Xác nhận hoàn tất nhập kho`: Cảnh báo rõ: *"Sau khi xác nhận, số lượng hàng sẽ chính thức được cộng vào Tồn kho thực tế (On-hand) và không thể hoàn tác."*.
    - Bấm "Xác nhận hoàn thành":
      1. Cập nhật trạng thái phiếu nhập kho thành `Hoàn thành` (Completed Badge màu xanh).
      2. **Cập nhật Tồn kho (`Inventory Monitoring.html`):** Tăng tồn kho thực tế (`On-hand`) và tồn khả dụng (`Free-to-use`) của các SKU tương ứng theo đúng số lượng từng lô.
      3. **Ghi Sổ kho (`Inventory Transaction History.html`):** Tự động tạo mới 1 bản ghi giao dịch trong Sổ cái lịch sử với Loại = `Nhập kho PO`, Mã chứng từ = `NK-2024-001`, Số lượng biến động dương (`+XX`), kèm ngày giờ thực tế.
      4. **Cập nhật KPI:** Giảm số lượng đơn chờ nhập tại `Dashboard Warehouse Manager.html`.
      5. Toast thông báo thành công và cập nhật lại giao diện trang chi tiết với trạng thái "ĐÃ HOÀN TẤT NHẬP KHO".

---

### 4.6. Nhóm Quản trị Xuất kho, Chuẩn bị Bốc hàng & Xác nhận Xuất (FE-06.1, FE-06.2, FE-06.3)

#### A. `Goods Issue Management.html` (FE-06.1 Goods Issue List)
- **Vị trí React:** `pages/issue/PhieuXuatKhoList.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - Bộ lọc trạng thái: Tất cả / Chờ lấy hàng / Đang lấy hàng / Đã xuất kho.
  - Tìm kiếm theo Mã phiếu xuất (`XK-...`), Mã đơn bán hàng (`SO-...`), Tên khách hàng.
  - **Nút "+ Tạo phiếu xuất kho":** Chuyển hướng sang `Goods Issue Management Create.html`.
  - Click vào dòng phiếu xuất -> Mở `Goods Issue Management Details.html?id=XK-2024-001`.

#### B. `Goods Issue Management Create.html` (FE-06.1 Create Issue from Sales Order)
- **Vị trí React:** `pages/issue/PhieuXuatKhoCreate.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - Nhập Mã đơn bán hàng (SO), Khách hàng, Kho xuất (ví dụ Kho Hà Nội), Đơn vị vận chuyển (Giao Hàng Nhanh / Viettel Post / Nội bộ), Tên nhân viên bốc hàng.
  - Thêm sản phẩm cần xuất: Chọn SKU, số lượng yêu cầu xuất.
  - **Nút "Tạo phiếu xuất kho":** Sinh mã `XK-2024-001`, lưu vào store trạng thái `Chờ lấy hàng`, Toast: *"Tạo phiếu xuất kho thành công!"* -> Chuyển sang `Goods Issue Management Details.html?id=XK-2024-001`.

#### C. `Goods Issue Management Details.html` (FE-06.2 Prepare Picking & FE-06.3 Confirm Goods Issue)
- **Vị trí React:** `pages/issue/PickLot.jsx` & `PhieuXuatKhoDetail.jsx`.
- **Tương tác Nút bấm & Trường dữ liệu:**
  - **FE-06.2 Chuẩn bị Bốc hàng theo Lô (Prepare Picking / Pick Lot Allocation):**
    - Hiển thị danh sách SKU của đơn xuất.
    - **Nút "Phân bổ lô tự động (FEFO/FIFO)":**
      - Thuật toán tự động tìm trong kho các lô có hạn dùng gần nhất (FEFO) còn tồn khả dụng và gán vào đơn xuất.
      - Tự động điền Mã lô, Vị trí kệ lấy hàng (Aisle/Shelf), và Số lượng bốc từ từng lô.
    - **Nút "Chọn lô thủ công":** Mở Modal hiển thị toàn bộ các lô đang có sẵn của SKU đó trong kho để nhân viên tự tick chọn số lượng.
    - **Nút "In danh sách bốc hàng" (Print Pick List / Wave Picking Sheet):** Mở giao diện in phiếu bốc hàng chuyên dụng sắp xếp theo thứ tự lối đi/kệ hàng trong kho để nhân viên cầm đi bốc hàng.
    - Khi tất cả SKU đều đã được gán lô đủ 100%: Biến cờ `isAllPicked = true`, hiển thị Badge xanh lá *"Đã bốc đủ hàng sẵn sàng xuất kho"*, và kích hoạt làm sáng **Nút "Xác nhận xuất kho"**.
  - **FE-06.3 Xác nhận Xuất kho & Cập nhật Tồn kho (Confirm Goods Issue):**
    - **Nút "Xác nhận xuất kho" (Confirm Goods Issue Button):**
      - Mở Modal `Xác nhận xuất kho`: Hiển thị tóm tắt tổng số lượng sản phẩm và các lô xuất đi.
      - Bấm "Xác nhận hoàn tất xuất kho":
        1. Cập nhật trạng thái phiếu xuất thành `Đã xuất kho` (Issued Badge).
        2. **Trừ Tồn kho thực tế (`Inventory Monitoring.html`):** Giảm số lượng On-hand và trừ tồn của từng lô hàng tương ứng trong kho.
        3. **Ghi Sổ kho (`Inventory Transaction History.html`):** Tự động thêm 1 bản ghi giao dịch Loại = `Xuất kho SO`, Mã chứng từ = `XK-2024-001`, Số lượng biến động âm (`-XX`), thời gian thực tế.
        4. **Cập nhật KPI:** Cập nhật số lượng hoàn thành trên `Dashboard Warehouse Manager.html`.
        5. Toast: *"Xác nhận xuất kho thành công! Hàng đã rời kho và cập nhật sổ tồn."*.

---

### 4.7. Hệ thống Điều hướng Toàn cục & Kết nối Chu trình Liên hoàn

#### A. Điều hướng Sidebar và Topbar xuyên suốt 23 File HTML
Mỗi file HTML đều có Sidebar chuẩn 5 phân khu. Toàn bộ các thẻ `<a>` và button trong Sidebar được gán liên kết trực tiếp tới file prototype HTML tương ứng:

```
[FCentric Logo] -> "Dashboard Warehouse Manager.html"
├── TỔNG QUAN
│   └── Tổng quan kho -> "Dashboard Warehouse Manager.html"
├── QUẢN TRỊ
│   ├── Kho hàng -> "Warehouse Information Management.html"
│   ├── Thuộc tính & Chất liệu -> "Manage Materials view.html"
│   ├── Mã vạch & SKU -> "Barcode Management.html"
│   └── Nhà cung cấp -> "Supplier Management.html"
├── VẬN HÀNH
│   ├── Yêu cầu mua hàng (PR) -> "Purchase Request Management.html"
│   ├── Đơn mua hàng (PO) -> "Purchase Order Management.html"
│   ├── Phiếu nhập kho -> "Goods Receipt Management.html"
│   └── Phiếu xuất kho -> "Goods Issue Management.html"
├── GIÁM SÁT
│   ├── Báo cáo tồn kho -> "Inventory Monitoring.html"
│   └── Lịch sử giao dịch kho -> "Inventory Transaction History.html"
```

#### B. Nối Trực tiếp 100% Theo Trình tự Nghiệp vụ (Direct Sequential Chaining)
Không sử dụng trang trung gian `index.html`. Các màn hình được liên kết trực tiếp theo chuỗi thao tác thực tế:
- **Chu trình Mua hàng & Nhập kho:**
  - `Purchase Request Management Create.html` -> `Purchase Request Management.html` -> `Purchase Request Management Details.html` -> `Purchase Order Management.html` -> `Purchase Order Management Details.html` -> `Goods Receipt Management Create.html` -> `Receiving Lot Management.html` -> `Goods Receipt Confirmation.html` -> `Inventory Monitoring.html` & `Inventory Transaction History.html`.
- **Chu trình Xuất kho & Fulfillment:**
  - `Goods Issue Management Create.html` -> `Goods Issue Management.html` -> `Goods Issue Management Details.html` (Phân bổ lô FEFO & In Pick List) -> Xác nhận xuất kho -> Trừ tồn kho tại `Inventory Monitoring.html` & Ghi sổ tại `Inventory Transaction History.html`.
- **Nút "Reset Mock Data" nổi góc dưới bên phải** cho phép khôi phục dữ liệu mẫu ban đầu bất kỳ lúc nào để demo lại từ đầu.

---

## 5. KẾ HOẠCH TRIỂN KHAI TỪNG BƯỚC (STEP-BY-STEP ROADMAP)

### Bước 1: Dọn dẹp & Khử hoàn toàn Localhost trong 23 File HTML
- Quét qua toàn bộ 23 file HTML trong thư mục `prototype/`:
  - Thay thế toàn bộ các liên kết `http://localhost:5173/...` thành tên file HTML tương đối tương ứng.
  - Loại bỏ các khối thẻ script module lỗi của Vite dev server (`/@react-refresh`, `./..._files/main.jsx`, `./..._files/client`).
  - Thêm thẻ `<script src="./assets/js/prototype-engine.js"></script>` vào cuối thẻ `<body>`.
  - Kiểm tra và đảm bảo thẻ `<meta charset="UTF-8">` đứng đầu thẻ `<head>` để hiển thị font chữ tiếng Việt sắc nét.

### Bước 2: Xây dựng Lõi Điều hành Tương tác `prototype-engine.js`
- Xây dựng file `prototype/assets/js/prototype-engine.js` gồm các module:
  - `StoreModule`: Quản trị `localStorage`, nạp seed data chuẩn ban đầu, các hàm truy vấn và cập nhật trạng thái (CRUD).
  - `NavModule`: Tự động gắn link cho toàn bộ Sidebar, Topbar, Breadcrumbs và nút Quay lại dựa theo tên file hiện tại.
  - `UIModule`: Xử lý mở/đóng Modal Dialog, Dropdown menu, chuyển Tab, Toast notification container.
  - `FilterModule`: Tự động kích hoạt thanh tìm kiếm, bộ lọc trạng thái và phân trang cho các bảng dữ liệu.
  - `FlowModule`: Chứa các kịch bản logic nghiệp vụ liên trang theo đúng chuỗi trình tự.

### Bước 3: Hoàn thiện Tương tác Chi tiết cho Nhóm Mua hàng & Nhập kho (FE-04 & FE-05)
- Kết nối chuỗi liên kết:
  - `Purchase Request Management Create.html` -> `Purchase Request Management.html` -> `Purchase Request Management Details.html` (Duyệt/Từ chối).
  - `Purchase Order Management Create.html` -> `Purchase Order Management.html` -> `Purchase Order Management Details.html` (Thanh toán).
  - `Goods Receipt Management Create.html` (chọn PO) -> `Receiving Lot Management.html` (khai báo lô, validate đủ số lượng) -> `Goods Receipt Confirmation.html` (Xác nhận nhập kho, cộng tồn kho và ghi sổ giao dịch).

### Bước 4: Hoàn thiện Tương tác Chi tiết cho Nhóm Xuất kho & Tồn kho (FE-06 & FE-03)
- Kết nối chuỗi liên kết:
  - `Goods Issue Management Create.html` -> `Goods Issue Management Details.html` (Nút phân bổ lô FEFO tự động, in danh sách bốc hàng, nút xác nhận xuất kho).
  - Cập nhật trừ tồn kho tại `Inventory Monitoring.html` và sinh giao dịch xuất tại `Inventory Transaction History.html`.
  - Kết nối các thẻ cảnh báo tại `Dashboard Warehouse Manager.html` tới các danh sách tương ứng.

### Bước 5: Hoàn thiện Tương tác cho Nhóm Danh mục & Thuộc tính (FE-02 & FE-04.1)
- `Supplier Management.html` <-> `Supplier Management Update.html` <-> `Supplier Management Detail.html`.
- `Manage Materials view.html`: Chuyển tab, Modal thêm/sửa chất liệu, xóa chất liệu.
- `Barcode Management.html`: Checkbox chọn SKU, Modal Preview in mã vạch, `window.print()`.
- `Warehouse Information Management.html`: Modal thêm/sửa kho hàng.

### Bước 6: Kiểm thử Nghiệm thu Toàn diện các Chu trình Liên màn
- Thực hiện kiểm thử toàn bộ các kịch bản liên tiếp:
  1. Kịch bản 1: Mở trực tiếp bằng trình duyệt (file protocol).
  2. Kịch bản 2: Đi hết chu trình mua hàng -> nhập kho -> kiểm tra số liệu tồn kho tăng và sổ kho ghi nhận.
  3. Kịch bản 3: Đi hết chu trình xuất kho -> phân bổ lô -> kiểm tra số liệu tồn kho giảm và sổ kho ghi nhận.
  4. Kịch bản 4: Thao tác thêm/sửa/xóa nhà cung cấp, chất liệu, kho hàng.
  5. Kịch bản 5: Thử nghiệm in mã vạch, in phiếu nhập, in phiếu xuất.

---

## 6. TIÊU CHÍ ĐÁNH GIÁ VÀ NGHIỆM THU (ACCEPTANCE CRITERIA)

| Tiêu chí | Mô tả yêu cầu đạt chuẩn | Phương pháp kiểm chứng |
| :--- | :--- | :--- |
| **Bảo toàn Giao diện 100%** | Giữ nguyên toàn bộ layout, màu sắc, Tailwind classes, typography, biểu tượng SVG từ React frontend xuất ra. Không làm vỡ khung hay xô lệch thành phần. | So sánh trực quan cạnh nhau (Side-by-side) giữa màn React và Prototype HTML. |
| **Tất cả Nút bấm hoạt động** | Mọi nút bấm (Create, Edit, Delete, View, Filter, Search, Pagination, Approve, Reject, Pay, Allocate Lots, Confirm, Print) đều phản hồi chính xác khi click. | Click thử nghiệm từng nút trên tất cả 23 trang. |
| **Tất cả Trường nhập liệu hoạt động** | Các ô Text input, Number input, Date picker, Select dropdown, Checkbox, Radio button đều nhập liệu, chọn lựa và lưu trữ được giá trị. | Nhập form thử nghiệm trên các màn hình tạo/sửa. |
| **Tính Liên tục của Luồng nghiệp vụ** | Dữ liệu được truyền tải và cập nhật liền mạch giữa các màn hình (ví dụ: Tạo PO -> Duyệt PO -> Tạo phiếu nhập -> Khai báo lô -> Xác nhận nhập -> Tồn kho tăng -> Sổ kho có dòng ghi mới). | Thực hiện xuyên suốt kịch bản End-to-End từ bước đầu đến bước cuối. |
| **Hoạt động Độc lập (Zero Dependency)** | Chạy độc lập hoàn toàn, không cần Node.js, không cần npm start hay Vite server, mở trực tiếp qua `file:///` trên Google Chrome, Microsoft Edge, Firefox. | Mở trực tiếp các file HTML bằng trình duyệt mặc định trên máy tính. |
