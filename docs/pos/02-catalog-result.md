# Kết quả PHASE 02 — Catalog POS live (chỉ đọc)

Ngày: 06/10/2026 (Việt Nam). Nhánh `Khang`, HEAD `320c67f`. Không commit/push/reset; mọi thay đổi phase 01/02 được giữ nguyên trên working tree.

## 1. Tóm tắt

- Màn **Bán hàng tại quầy** (`/pos`) đã nằm trong shell backoffice hiện hữu (ProtectedRoute + BackofficeLayout), dùng toàn bộ token bo-* và shared UI của dự án. **Checkout bị khóa hoàn toàn** với trạng thái UI rõ ràng — không có endpoint/đường code nào tạo đơn, thu tiền hay trừ tồn.
- Endpoint catalog POS **chỉ đọc** đã được triển khai đúng hợp đồng `docs/pos/01-contract.md` mục 5.1: phân trang server-side, quyền kho server-side, tồn theo đúng kho, ảnh qua convention `PublicAssetUrl`, không N+1.
- Toàn bộ dữ liệu mẫu (fixture) bị loại khỏi bản live: không copy `pos-demo-data.js`, `assets/products/*`, PreviewShell, preview/package.json, node_modules. Lỗi API hiển thị ErrorState — **không fallback về fixture**.

## 2. File đã thay đổi chính xác

### Sửa (tracked, 6 file)

| File | Thay đổi |
|---|---|
| `frontend/src/App.jsx` | +import `PosPage`; +route `<Route path="/pos" element={<PosPage />} />` ngay sau block Sales-orders, bên trong `BackofficeLayout` (ngoại lệ FROZEN đã ghi trong hợp đồng — không thay route nào khác, giữ nguyên `/sales-orders/create`) |
| `frontend/src/components/backoffice/sidebar.config.js` | +mục con "Bán hàng tại quầy" (`to: "/pos"`) trong nhóm "Bán hàng", roles `quan_tri_vien` + `nhan_vien_ban_hang` (quyết định mở rộng role ở Phase 03+) |
| `frontend/src/components/backoffice/BackofficeLayout.jsx` | +entry `PAGE_META_CONFIG` key `POS` (title/subtitle cho header + document.title) — không đổi layout/scroll |
| `backend/.../repository/BienTheSanPhamRepository.java` | +3 query JPQL phân trang: `findPosCatalog` (q), `findPosCatalogBySkuPrefix`, `findPosCatalogByBarcode` — cùng 3 countQuery |
| `backend/.../repository/AnhBienTheRepository.java` | +`findActiveByBienTheIds` (1 query batch ảnh biến thể, join fetch tepTin) |
| `backend/.../repository/AnhQuanAoRepository.java` | +`findActiveByQuanAoIds` (1 query batch ảnh sản phẩm fallback, sort `anhChinh desc`) |

### Mới (untracked)

**Backend (4):**
- `backend/.../controller/PosController.java` — `GET /api/v1/pos/catalog` + `GET /api/v1/pos/lookup`, `@RequireAuth` 4 role nội bộ; **không có endpoint checkout**.
- `backend/.../dto/response/customize/PosCatalogItemDto.java` — constructor tường minh theo convention `TonKhoChiTietDTO`.
- `backend/.../services/impl/entities/PosCatalogService.java` — ủy quyền kho (pattern `PhieuXuatKhoService.createFromSO:100–110`), chuẩn hóa tham số (size clamp 120, q blank→null), gắn ảnh 2 query batch, `PublicAssetUrl.toHttps`.
- `backend/src/test/.../PosCatalogServiceTest.java` — 14 unit test (Mockito).

**Frontend (10):**
- `frontend/src/services/posService.js` — `getCatalog`/`lookup` (qua `apiClient`, hỗ trợ `signal` cho AbortController), `toPosProduct`, `toPosCustomer`, hằng `WALKIN_CUSTOMER_CODE = "KHLE"`.
- `frontend/src/pages/pos/index.jsx` — wrapper tải kho (`POST /api/v1/kho/mine`) + khách hàng (`GET /api/v1/khach-hang/for-sales-order`); trạng thái loading/error/không-có-kho.
- `frontend/src/pages/pos/PosSalesPage.jsx` — bản live viết lại: dữ liệu qua props, tab hóa đơn giữ riêng `warehouseId`/giỏ/khách/ghi chú, fetch catalog theo kho hiện hành (AbortController + seq chống stale), Enter SKU-only qua `/lookup`, quét mã vạch chính xác, checkout khóa.
- `frontend/src/pages/pos/components/PosProductCatalog.jsx` — bản live: server paging, loading/error/empty, giữ nguyên lưới full-width gap 12px (3/4/5/6 cột tại 1280/1600/1920), chế độ Danh sách, `localStorage fcentric.pos.productView`, cuộn độc lập, F3, Enter SKU-only, chỉ nhóm "Tất cả".
- `frontend/src/pages/pos/components/PosDialogs.jsx` — bản live: chọn khách thật (không có tạo khách tại quầy), thanh toán chỉ Tiền mặt với nút **khóa + thông báo Phase 03**, barcode, shortcuts, clear, close-invoice. **Đã loại bỏ**: trả hàng, chuyển khoản, Ví, FakeQr, đăng ký ngân hàng, máy in, receipt mẫu.
- `frontend/src/pages/pos/components/PosCartPanel.jsx` — copy template + guard `customer?.name || 'Chưa chọn khách hàng'` (khách lẻ có thể chưa được seed).
- Copy nguyên vẹn: `PosInvoiceTabs.jsx`, `pos-invoice-tabs.css`, `PosModal.jsx`, `PosProductCard.jsx` (bỏ `export` của helper nội bộ), `pos-format.js`.

**KHÔNG copy vào bản live:** `pos-demo-data.js`, `assets/products/*.webp` (40 ảnh demo), preview app — đã grep xác nhận 0 tham chiếu `POS_PRODUCTS/POS_CUSTOMERS/POS_INITIAL_CART/POS_INVOICES/FakeQr/NAM001/assets/products` trong `frontend/src/pages/pos`.

## 3. Endpoint & ánh xạ DTO thật

### `GET /api/v1/pos/catalog?khoId=&q=&page=&size=` (NEW)
- Auth: `@RequireAuth(quan_tri_vien | quan_ly_kho | nhan_vien_kho | nhan_vien_ban_hang)`.
- Ủy quyền kho **server-side**: admin mọi kho; người khác phải có `phan_quyen_nguoi_dung_kho` active + chưa hết hạn (giống `createFromSO`); kho không tồn tại/khoId thiếu → `CommonException` 400 kèm message tiếng Việt.
- Trả `ResponseData<Page<PosCatalogItemDto>>`; size clamp 1–120, mặc định 120.
- Lọc: biến thể `trangThai=1` + sản phẩm cha `trangThai=1`; `q` tìm theo `maSku`/`maVachSku`/`tenSanPham`/`maSanPham` (không phân tích chuỗi SKU).
- `soLuongKhaDung` = `CAST(COALESCE(SUM(tk.soLuongTon − tk.soLuongDaDat), 0) AS BIGDECIMAL)` với `LEFT JOIN TonKhoTheoLo … AND tk.kho.id = :khoId` → **tồn của ĐÚNG kho truy vấn**; không có lô nào → 0 (dữ liệu đã biết, không bịa). Không dùng tồn toàn hệ thống.
- Ảnh: `anh_bien_the` → fallback `anh_quan_ao` (ưu tiên `anhChinh=1`, query đã sort trước) → `null`; mọi URL qua `PublicAssetUrl.toHttps` (chống Mixed Content — convention của `TepTinMapper`).

### `GET /api/v1/pos/lookup?khoId=&skuPrefix=&barcode=` (NEW)
- `skuPrefix`: chỉ khớp mã **SKU/mã vạch SKU bắt đầu bằng** từ khóa (không khớp tên), `ORDER BY maSku, id`, trả **kết quả đầu tiên của toàn bộ truy vấn server-side** (size 1) → phím Enter không phụ thuộc trang đang tải.
- `barcode`: khớp **CHÍNH XÁC** (không phân biệt hoa thường) với `maSku`/`maVachSku`, trả tối đa 10 kết quả. Mã vạch cấp sản phẩm cha không khớp; client xử lý 0 kết quả (báo lỗi) và >1 kết quả (báo nhập nhằng — **không tự chọn biến thể**).
- Thiếu cả hai tham số → `CommonException`.

### API hiện hữu được tái sử dụng (không sửa)
- `POST /api/v1/kho/mine` → danh sách kho được phân quyền (admin: tất cả).
- `GET /api/v1/khach-hang/for-sales-order` → khách hàng active → `{id, code, name, phone, tier}` qua `toPosCustomer`.

### Giỏ hàng
- Key dòng giỏ = `bienTheSanPhamId` (không phải `productId` cha); tên hiển thị = `tenSanPham · tenMau · tenSize` → hai biến thể không nhìn giống hệt nhau; số lượng bị chặn ≤ tồn hiển thị (chốt thật vẫn là server ở Phase 03).

## 4. Chính sách kho / khách lẻ (đã xử lý trong code)

- **Kho theo hóa đơn**: mỗi tab giữ `warehouseId` riêng; catalog fetch theo kho của tab đang mở; đổi kho trên tab hiện tại → **xóa giỏ của tab đó** (toast giải thích), khách/ghi chú giữ nguyên; các tab khác không bị đụng. Không bao giờ hiển thị tồn kho A dưới kho B (AbortController + seq guard chặn response stale khi đổi kho/từ khóa/trang).
- **Khách lẻ**: chính sách = bản ghi thật có `ma_khach_hang = KHLE` (`WALKIN_CUSTOMER_CODE` trong `posService.js`). Nếu tồn tại trong danh sách API → hóa đơn mới mặc định chọn; nếu chưa (bản ghi được seed ở Phase 03 qua migration) → **không mặc định chọn khách nào**, hiển thị "Chưa chọn khách hàng" và checkout Phase 03 sẽ bắt chọn tường minh. Không dùng id demo/NULL.
- **Tạo khách tại quầy**: bị tắt — dialog ghi rõ "tạo ở trang Khách hàng" (endpoint `/khach-hang/create` hiện không có `@RequireAuth` nên không mở tại quầy trong phase này).

## 5. Bằng chứng checkout bị khóa (không ghi đơn/tiền/tồn)

1. Backend: `PosController` chỉ có 2 endpoint `@GetMapping` — không tồn tại POST/checkout nào; không thêm bảng/migration thanh toán (đúng phạm vi phase).
2. Frontend: `PosSalesPage` nhận `checkoutEnabled = false` mặc định (wrapper không truyền → false). `confirmPayment` guard đầu tiên `if (!checkoutEnabled || isSubmitting) return;` — kể cả khi callback được truyền.
3. Dialog Thanh toán: nút "Xác nhận thanh toán" → nhãn "Thanh toán chưa kích hoạt", `disabled`, kèm hộp thông báo amber: *"Chức năng thanh toán chưa được kích hoạt (giai đoạn 03). Sản phẩm trong giỏ được giữ nguyên; không có đơn hàng, phiếu thu hay giao dịch nào được tạo."*
4. Không có cuộc gọi nào tới `/don-ban-hang/create|convert-to-order`, `/phieu-xuat-kho` hay API báo giá từ code POS (grep xác nhận — `posService.js` chỉ gọi `/pos/catalog` + `/pos/lookup`).
5. Các luồng demo (trả hàng, chuyển khoản, Ví, QR, ngân hàng, máy in, receipt) không tồn tại trong cây component live — hành vi demo chỉ còn ở app preview riêng của template.

## 6. Test đã thực chạy

| # | Kiểm thử | Kết quả thật |
|---|---|---|
| 1 | Backend `mvnw test` (toàn bộ suite) | **65/65 PASS, BUILD SUCCESS** — gồm `PosCatalogServiceTest` 14 test: admin không cần phân quyền; kho không tồn tại/thiếu khoId; nhân viên không được phân quyền → lỗi; quyền hết hạn → lỗi; quyền active → thành công; size 999→clamp 120; q trắng→null; ảnh biến thể ưu tiên; fallback ảnh sản phẩm `anhChinh`; không ảnh→null; lookup skuPrefix size=1; lookup barcode; thiếu tham số→lỗi. Ngoài ra: context-load test **PASS** → Spring/Hibernate đã validate cả 3 JPQL + countQuery của catalog khi khởi tạo (lỗi constructor/CAST đã được phát hiện và sửa trong quá trình này). |
| 2 | Frontend `npm run build` (vite 7.3.1) | **PASS** (chỉ còn warning chunk-size 2.4MB — pre-existing baseline) |
| 3 | ESLint các file POS thay đổi | **0 vấn đề** |
| 4 | ESLint toàn dự án | 28 problems (25E/3W) — **không tăng** so với trước khi đổi (gate MIGRATION_STATUS: không tăng) |
| 5 | `git diff --check` | Clean (chỉ warning CRLF của Windows) |
| 6 | Grep demo data trong bản live | 0 tham chiếu (mục 2) |

**Chưa chạy được (hạn chế môi trường — không ghi PASS):** kiểm thử tích hợp với MySQL thật (backend cần DB/MinIO đang chạy + dump chuẩn bị riêng theo `00-START-HERE.md`), render trình duyệt thủ công (viewport 390–1920, quét mã vạch bằng máy quét thật, tab nhiều hóa đơn). Các kịch bản này thuộc nghiệm thu Phase 05/06 theo hợp đồng.

## 7. Hạn chế chưa giải quyết (nợ kỹ thuật / phụ thuộc phase sau)

1. **Bản ghi khách lẻ `KHLE` chưa tồn tại** — được seed qua migration additive ở Phase 03 (quyết định kinh doanh về mã/tên chính xác vẫn mở, mục 7.1 hợp đồng).
2. **Role bán tại quầy** chỉ admin + `nhan_vien_ban_hang` (sidebar + `/khach-hang/for-sales-order`); `quan_ly_kho`/`nhan_vien_kho` vào thẳng `/pos` sẽ gặp lỗi tải khách hàng (403) — hiển thị ErrorState có retry, không fallback.
3. **Báo cáo doanh thu** chưa sửa filter (B11 hợp đồng) — không thuộc phạm vi phase này; chốt ở Phase 03+.
4. **Sinh số chứng từ / khóa tồn kho / chống lặp thanh toán** — thuộc thiết kế Phase 03 (B6/B9); chưa triển khai, đúng phạm vi "không viết đơn/thanh toán/tồn".
5. Quirk có sẵn của repo được ghi nhận nhưng không sửa: `/kho/mine` khai `inWarehouse=true` (Aspect đòi header `kho_id` từ claim trước khi vào controller) — login đã set `selected_kho_id` từ claim nên luồng POS bình thường không vướng; người dùng không có kho nào sẽ thấy EmptyState "Chưa có kho bán hàng".
6. `soLuongKhaDung` từ snapshot có scale 3 (decimal 15,3) — hiển thị badge là số khả dụng; làm tròn/gom hiển thị có thể tinh chỉnh ở Phase 04 (không ảnh hưởng tính toán server).

## 8. Sẵn sàng Phase 03

Đủ điều kiện chuyển sang **03-CASH-CHECKOUT-BACKEND**: catalog/lookup đã có, chính sách kho-per-tab và khách lẻ đã định hình, frontend đã giữ `onCompleteSale`/`checkoutEnabled` đúng vị trí để nối. Trước khi bật thu tiền vẫn cần: quyết định 7 mục nghiệp vụ của hợp đồng (ít nhất: mã/tên khách lẻ, role, filter báo cáo), migration additive `MyDB_v1.4.sql`, bảng `pos_checkout_request`/`pos_payment`, khóa tồn PESSIMISTIC_WRITE và test đồng thời.
