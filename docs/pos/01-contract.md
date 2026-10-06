# Hợp đồng triển khai POS — FCentric (PHASE 01: Audit & Contract)

Ngày: 06/10/2026 (Việt Nam). Người thực hiện: AI + repo FCentric. Ngôn ngữ: Tiếng Việt.
Phạm vi phase này: **chỉ đọc** — kiểm tra working tree, đối chiếu source hiện tại, lập hợp đồng. **Chưa sửa code, chưa chạy SQL, chưa chạy backend, chưa commit/push.** Không thực hiện phases 02–07.

---

## 1. Trạng thái working tree & commit được kiểm tra

| Hạng mục | Giá trị |
|---|---|
| Nhánh hiện tại | `Khang` (đúng yêu cầu — không chuyển nhánh) |
| Commit HEAD | `320c67f` "Fix lưu ảnh Database" (2026-10-06 05:47:38 +0700) |
| Dirty tree | Chỉ có `?? FCentric-POS-React-Tailwind-Template/` (thư mục template chưa track). **Không có file staged/unstaged nào khác.** Không reset/stash/xóa gì. |
| AGENTS.md | Không tồn tại trong repo |
| Hợp đồng repo đã đọc | `docs/ai-redesign/DESIGN_CONTRACT.md` (danh sách file FROZEN — POS là ngoại lệ phạm vi hẹp được ghi ở mục 4.1), `docs/ai-redesign/MIGRATION_STATUS.md` (route matrix, validation gate) |
| Gói template | `FCentric-POS-React-Tailwind-Template/` — nhận diện đủ 3 dấu hiệu: `README.md`, `frontend/src/pages/pos/PosSalesPage.jsx`, `FCentric-POS-Integration-Plan.md`. Đã đọc `prompts/00-START-HERE.md` và kế hoạch tích hợp. **`PROJECT_ALIGNMENT_AUDIT.md` mô tả ZIP cũ — không dùng làm nguồn chân lý.** |

**Lưu ý dump SQL:** dump `fashion_system_2026-10-05_15-44.sql` **không có trong repo**. Trong repo chỉ có `Database/MyDB.sql` và `MyDB_v1.0..v1.3.sql` (bản `v1.3` là full dump có dữ liệu, ngày 05/10/2026). Mọi kiểm tra snapshot ở đây dùng `MyDB_v1.3.sql`, đọc-only.

### 1.1 Đối chiếu lại baseline snapshot (MyDB_v1.3.sql)

| Thực thể | Dữ liệu thực trong snapshot | Đối chiếu baseline kế hoạch |
|---|---|---|
| Sản phẩm | 2 bản ghi: id 58 (trangThai=2), id 59 "Áo Khoác Phối Lót Lông Giả Lông Cừu" (trangThai=1, giaBanMacDinh 120000, danhMuc 28, thuongHieu NULL) | Khớp kế hoạch (id58/59) |
| Biến thể | 5 bản ghi id 91–95. **id93** (sp59): maSku `AK2610051-CL005-1-MS-2691`, mau 25, size 19, chatLieu 5, giaVon 100000, giaBan **120000**, trangThai **1**. Các id 91/92/94/95: trangThai 0, giaBan 0. | Khớp: chỉ 93 hoạt động |
| Lô | id 69/70/71 đều thuộc biến thể 93, giaVon 100000, ngaySanXuat 07–09/10/2026 | Khớp |
| Tồn kho theo lô | id 72/73/74 tại **kho 1**: ton 3 + 1 + 1 = **5**, daDat 0 → khả dụng **5** | Khớp baseline (5 khả dụng) |
| Kho | id 1 KHO01 "Kho Hà Nội" (kho_tong), id 2 KHO02 "Kho Hồ Chí Minh" (cua_hang), id 20 KHO_TRANSIT | — |
| Đơn bán / phiếu xuất | **0 bản ghi** — không thể dùng snapshot chứng minh luồng xuất/giao cũ đã chạy | Khớp kế hoạch |
| Khách hàng | 15 bản ghi (không liệt kê giá trị — dữ liệu cá nhân) | Khớp; chưa có khách lẻ chính sách |

> Quy ước: baseline chỉ dùng làm fixture kiểm thử (kho1 + biến thể 93, giá 120000, tồn 5). **Không hardcode các giá trị này vào code production.**

---

## 2. Bản đồ API/dữ liệu hiện tại (đã xác minh từ source)

### 2.1 Cơ chế xác thực & envelope

- **Envelope chuẩn**: `ResponseData<T>` — `{status, data, error, message, timestamp, path}` (`backend/.../dto/response/ResponseData.java`). Exception mapping trong `RestControllerGlobalExceptionHandler`: CommonException→HTTP của exception (thường 400), AccessDenied→403, AuthenticationException→401, DataIntegrityViolation→409, còn lại→500.
- **3 tầng auth** (không dùng Spring Security authorization):
  1. `SecurityConfig`: `.requestMatchers("/**").permitAll()` — chặn thật ở tầng dưới.
  2. `AuthInterceptor`: parse JWT → `SecurityContextHolder.setUser`; **check lại `trangThai` user từ DB** (không tin claim), ném `AccountDisabledException` → `error: "ACCOUNT_DISABLED"`.
  3. `AuthorizationAspect` (`@Around @annotation(RequireAuth)`): admin bypass; check roles (OR/AND); `inWarehouse=true` → đọc header `kho_id`, `jwtService.inWorkspace` theo claim token; `permissions` → `hasAnyPermissionInWorkSpace` theo claim.
- **Role**: `IRoleType` — `quan_tri_vien`, `quan_ly_kho`, `nhan_vien_kho`, `nhan_vien_ban_hang`, `nhan_vien_mua_hang`, `khach_hang`.
- **Quyền theo kho**: `IPermissionType` (23 mã, gồm `tao_don_ban_hang`, `duyet_don_ban_hang`, `tao_phieu_xuat`…); bảng `phan_quyen_nguoi_dung_kho` + `chi_tiet_quyen_kho` + `quyen_han`.
- **Frontend**: `apiClient.js` gắn `Authorization: Bearer <access_token>` + `kho_id` (localStorage `access_token` / `role` / `selected_kho_id`); xử lý 401 (xóa session → /login) và ACCOUNT_DISABLED. Cờ `skipAuth`, `needToken:false`, `needKho:false`.

### 2.2 Đơn bán hàng (`/api/v1/don-ban-hang`)

`DonBanHangController` + `DonBanHangService` (`backend/.../services/impl/entities/DonBanHangService.java`):

| Endpoint | Vai trò | Ghi chú đã xác minh |
|---|---|---|
| `POST /filter` | 4 role nội bộ | Service tự lọc: admin tất cả; kho theo `phanQuyenNguoiDungKhos`; `nhan_vien_ban_hang` chỉ đơn mình tạo (filter dòng 83–129) |
| `GET /{id}/detail` | 4 role | Trả `DonBanHangDetailResponse{donBanHang, chiTiet, phieuXuatKhoList}` — đọc đơn đã lưu |
| `POST /create` | admin, nhan_vien_ban_hang | **Từ chối `loaiChungTu="don_ban_hang"`** (dòng 226–228); luôn lưu `bao_gia`, `trangThai=0`, `trangThaiThanhToan="chua_thanh_toan"` |
| `PUT /{id}/send-to-warehouse` | admin, nhan_vien_ban_hang | 0→1 |
| `PUT /{id}/convert-to-order` | admin, nhan_vien_ban_hang | Báo giá→đơn mới (trangThai 0), báo giá→2; check khả dụng `sumSoLuongKhaDungByKhoAndBienThe` — **không giữ hàng, không khóa** |
| `PUT /{id}/cancel` | admin, nhan_vien_ban_hang | Cấm khi 3/5 hoặc đã có phiếu xuất hoàn thành → 4 |
| `PUT /{id}/mark-delivered` | admin, nhan_vien_ban_hang | 3→5 (hoàn thành), set `soLuongDaGiao` |
| `PUT /{id}/return` | admin, nhan_vien_ban_hang | 2/3→6 — **chỉ đổi trạng thái**: không nhập lại hàng, không hoàn tiền |
| `GET /variants-for-create` | admin, quan_ly_kho, nhan_vien_ban_hang | `BienTheSanPhamSelectDto{id, maBienThe, tenSanPham, giaBan, tenMau, tenSize, tenChatLieu}` — **không ảnh, không tồn** |

- Entity `DonBanHang`: `khach_hang_id NOT NULL`; `trang_thai_thanh_toan` enum `chua_thanh_toan|da_thanh_toan` default `chua_thanh_toan`; unique `uk_don_ban_hang_so_don_hang`. **Backend chưa bao giờ gán `da_thanh_toan`** (grep = 0). **Không có trường "nguồn"** (dump có cột `kenh_ban_id`, `ma_don_hang_kenh` nhưng entity chưa map).
- Giá: `DonBanHangService.create` cấm giá bán < 10% giá niêm yết (dòng 288–293) — quy ước giảm giá hiện hữu, POS phải giữ.
- `ngay_giao_hang`: **không có chỗ nào trong backend gán giá trị** (grep `setNgayGiaoHang` = 0).

### 2.3 Trạng thái đơn — giá trị code vs comment SQL

**Giá trị thực thi trong code** (không có enum; literal + comment trong service):

| don_ban_hang.trang_thai | Ý nghĩa code | phieu_xuat_kho.trang_thai | Ý nghĩa code |
|---|---|---|---|
| 0 | Nháp | 0 | Nháp |
| 1 | Chờ xuất kho | 1 | Chờ duyệt (chuyển kho) |
| 2 | Đang xuất kho (một phần) / báo giá đã chốt | 2 | Đã duyệt (chuyển kho) |
| 3 | Đã xuất toàn bộ (đang giao) | 3 | Đã xuất |
| 4 | Đã hủy / từ chối | 4 | Đã hủy |
| 5 | Hoàn thành | 5 | Hoàn tất (phiếu chuyển kho gốc) |
| 6 | Bị hoàn trả | — | — |

Frontend khớp code (`DonBanHangList.jsx` STATUS_MAP, `donBanHangPrintAdapter.js` SALES_ORDER_STATUS, `PhieuXuatKhoList.jsx`).

**Lệch comment SQL** (tài liệu schema, không phải lỗi runtime): `Database/MyDB_v1.3.sql:716` mô tả đơn `4: Completed, 5: Cancelled` (không có 6); `MyDB_v1.3.sql:1400` mô tả phiếu xuất `0: Nháp, 1: Hoàn thành, 2: Đã hủy`. → **Giữ giá trị code; sửa comment/hằng khi có đợt chuẩn hóa; không đảo số trạng thái.** POS dùng đúng bộ số hiện hành.

### 2.4 Phiếu xuất kho & tồn kho

- `PhieuXuatKhoService.createFromSO` (dòng 78–171): **mẫu kiểm tra quyền kho chuẩn** — non-admin bắt có `PhanQuyenNguoiDungKho` theo (user, khoXuat), `trangThai=1` và chưa hết hạn (dòng 100–110) — **POS tái sử dụng đúng pattern này**.
- `complete` (dòng 173–266): check tồn thực tế rồi `setSoLuongTon(...subtract)` (dòng 209), ghi `LichSuGiaoDichKho` (`saveHistory`, loaiThamChieu `phieu_xuat_kho`), phiếu→3, gọi `updateTrangThaiDonBanHang` → đơn 1/2/3 theo tổng đã xuất.
- `pickLoHang` (dòng 322–401): **(a)** không kiểm tra `ctGoc.phieuXuatKho.id == phieuXuatKhoId` (dòng 338 chỉ findById); **(b)** không kiểm tra `loHang.bienTheSanPham == ctGoc.bienTheSanPham` (dòng 374–377 chỉ check tồn kho theo kho+lô) → có thể gắn lô của SKU khác. Check khả dụng khi pick chỉ áp **chuyển kho**; comment dòng 380 "SO đã giữ hàng từ trước" **sai với code** — luồng bán hàng không giữ hàng.
- `TonKhoTheoLo`: `so_luong_kha_dung` là **GENERATED STORED** `= ton − da_dat` trong MySQL; unique `(lo_hang_id, kho_id)`. Khả dụng tổng: `sumSoLuongKhaDungByKhoAndBienThe` (SUM(ton−dat)).
- **Thứ tự lô đã được repo dùng**: `findAvailableLots` `order by t.ngayNhapGanNhat asc` (FIFO theo ngày nhập gần nhất — `TonKhoTheoLoRepository.java:150–168`). LoHang không có cột ngày nhập/số lượng riêng; ngày nhập theo kho nằm ở `TonKhoTheoLo.ngayNhapGanNhat`.
- **Ghi tồn — 6 vị trí, tất cả không khóa**: `PhieuXuatKhoService.complete` (trừ), `.cancel` (nhả daDat chuyển kho), `.pickLoHang` (daDat +/− chuyển kho), `PhieuNhapKhoService.completePhieuNhap` (cộng), `.completeTransferReceipt` (chuyển transit→đích), `PhieuKiemKeService.complete` (ghi đè). Grep toàn backend: `@Lock` = 0, `@Version` = 0, `FOR UPDATE` = 0, `synchronized` = 0, isolation mặc định. `soLuongDaDat` **chỉ** bị ghi bởi luồng chuyển kho.

### 2.5 Sản phẩm / biến thể / ảnh

- `BienTheSanPham`: `sanPham`, `mauSac`, `size`, `chatLieu` (đều NOT NULL), `maSku`, `maVachSku`, `giaVon`, `giaBan`, `trangThai`, `anhBienThe` (1–1 `AnhBienThe`→`TepTin`). **Không có trường giới tính ở sản phẩm lẫn biến thể** — "Nam/Nữ" là dữ liệu demo của template; không thêm cột, không suy luận từ chuỗi SKU (size lấy qua quan hệ `size_id`).
- `SanPhamQuanAo`: `danhMuc` (NOT NULL), `thuongHieu` (nullable), `anhQuanAos` (có `anhChinh` 0/1), `trangThai`, `giaBanMacDinh`, `mucTonToiThieu`.
- **Cơ chế URL ảnh đã được dự án dùng**: `variant.anhBienThe?.tepTin?.duongDan`, fallback `product.anhQuanAos?.find(a => a.anhChinh === 1)?.tepTin?.duongDan || product.anhQuanAos?.[0]?.tepTin?.duongDan` (pattern tại `CreatePurchaseRequestPage.jsx:39,93–95`, `SkuBuilder.jsx:80`). POS dùng đúng pattern này.
- `variants-for-create` hiện không có ảnh/tồn → catalog POS phải là endpoint mới (mục 5.1).

### 2.6 Khách hàng & kho

- `KhachHang`: `maKhachHang` + `tenKhachHang` NOT NULL; `loai_khach_hang` enum `le|si|doanh_nghiep` **default 'le'** (schema `MyDB_v1.3.sql:902`). **Không tồn tại khái niệm khách lẻ mặc định/walk-in trong backend** (grep walkin/vãng lai = 0); frontend chỉ dùng "Khách lẻ" làm nhãn fallback hiển thị.
- `khachHangId` trong `DonBanHangCreating` không có annotation nhưng **bắt buộc thực tế**: `DonBanHangService.create` dòng 221–224 `entityManager.find` → ném lỗi nếu không tồn tại; cột DB NOT NULL. **Không dùng NULL, không dùng id demo.**
- `GET /api/v1/khach-hang/for-sales-order` (admin + nhan_vien_ban_hang): trả mọi khách `trangThai=1`, không phân trang — POS dùng được cho chọn khách.
- `POST /api/v1/khach-hang/create` hiện **không có @RequireAuth** (phát hiện phụ — không mở rộng phạm vi sửa trong phase POS, chỉ ghi nhận).
- `POST /api/v1/kho/mine`: admin → tất cả kho; còn lại → kho được phân quyền active (query `trangThai=1 AND (ngayKetThuc IS NULL OR > NOW)`). Lưu ý: `/mine` khai `inWarehouse=true` nên Aspect đòi header `kho_id` hợp lệ **trước khi** vào controller. UI phân quyền hiện theo quy tắc "1 người 1 kho".

### 2.7 Thu tiền, số chứng từ, báo cáo, in

- **Không có bảng/entity thu tiền bán hàng** (`GiaoDichDto` + endpoint `/don-mua-hang/thanh-toan|kiem-tra-thanh-toan` thuộc ĐƠN MUA HÀNG — không nối nhầm sang POS).
- **Sinh số chứng từ**: pattern `prefix + yyyyMMdd + (count+1)` + retry ≤5 khi `DataIntegrityViolationException` trùng unique (`generateMaChungTu` `DonBanHangService:412–417`, `generateSoPhieu` `PhieuXuatKhoService:530–533`). Yếu về đồng thời; đủ an toàn dữ liệu nhờ unique key, **không đủ** làm cơ chế chống lặp thanh toán.
- **Báo cáo doanh thu** `DoanhThuReportRepository` (5 query): filter `trang_thai = 3 AND ngay_giao_hang BETWEEN …` → (i) loại đơn hoàn thành (5)/hoàn trả (6); (ii) **luôn rỗng trong thực tế vì `ngayGiaoHang` không bao giờ được set**. Subquery giá vốn filter `pxk.trang_thai = 1` trong khi phiếu xuất hoàn thành = 3 → **giá vốn luôn 0**. `KhachHangReportRepository` cùng filter `= 3`. Ngược lại dashboard admin (`DonBanHangRepository.revenueFromDate`/`sumRevenueToday`) dùng `trangThai != 4` → **có tính** 5/6. → Nội bộ bất nhất; POS hoàn thành (5) sẽ hiện ở dashboard nhưng **không** ở báo cáo doanh thu.
- **In hóa đơn**: không có endpoint in ở backend. Route `/sales-orders/:id/invoice` (frontend-only, ngoài BackofficeLayout) → `PrintRoutePage` + `donBanHangService.getDetail(id)` → **đọc đơn đã lưu từ DB**; mẫu `sales_invoice` (A4/A5/K80, active map qua `mau_in_dang_ap_dung`). Không có chặn in theo trạng thái đơn (nút hiện khi `trangThai >= 0`); chặn lỗi lô chỉ có ở `PhieuXuatKhoPrint`. POS in receipt = điều hướng về route này sau khi checkout thành công.

---

## 3. Blockers đã xác nhận (file/method evidence)

| # | Blocker | Bằng chứng |
|---|---|---|
| B1 | **Tạo đơn trực tiếp bị chặn** | `DonBanHangService.create` dòng 226–228 ném lỗi khi `loaiChungTu="don_ban_hang"`; type luôn `bao_gia`. Không gửi payload template vào API này. |
| B2 | **Catalog hiện tại thiếu ảnh + tồn theo kho** | `variants-for-create` → `BienTheSanPhamSelectDto` chỉ id/sku/tên/giá/thuộc tính (`DonBanHangService:420–435`). `san-pham-quan-ao/theo-kho` trả sản phẩm cha. |
| B3 | **Không có nghiệp vụ thu tiền** | Không có bảng thu tiền bán; `trangThaiThanhToan` không bao giờ gán `da_thanh_toan` (grep backend = 0). QR thuộc đơn mua hàng. |
| B4 | **Comment SQL trạng thái lệch code** | `MyDB_v1.3.sql:716` (đơn: 4=Completed/5=Cancelled) và `:1400` (phiếu xuất: 0/1/2 khác code) — xem mục 2.3. Giữ code, sửa comment sau. |
| B5 | **Trả hàng chưa hoàn tiền/nhập lại hàng** | `returnOrder` (`DonBanHangService:470–489`) chỉ set trạng thái 6. Không nối modal trả hàng template vào đây; ẩn/khóa trả hàng POS đến khi có quy trình theo dòng. |
| B6 | **Không có khóa đồng thời trên tồn kho** | Grep `@Lock/@Version/FOR UPDATE/synchronized` = 0. `PhieuXuatKhoService.complete` check-then-act (dòng 205–209). Luồng bán hàng không ghi `soLuongDaDat` (comment dòng 380 sai thực tế). |
| B7 | **pickLoHang thiếu ràng buộc phiếu–dòng–SKU–lô** | `PhieuXuatKhoService.pickLoHang`: không check dòng thuộc phiếu (dòng 338–341), không check lô thuộc SKU của dòng (dòng 374–377). POS không gọi endpoint này mù quáng. |
| B8 | **Luồng bán hàng không kiểm tra quyền kho** | `DonBanHangService.create/convertToOrder` chỉ check kho tồn tại (dòng 232–236, 342–348). Pattern đúng có sẵn: `PhieuXuatKhoService.createFromSO:100–110`. POS phải kiểm tra server-side. |
| B9 | **Sinh số count+1 không an toàn đồng thời** | `generateMaChungTu:412–417`, `generateSoPhieu:530–533`; retry chỉ cứu trùng unique, không chống lặp thanh toán. Cần requestId idempotency riêng. |
| B10 | **Chưa có chính sách khách lẻ** | Không có bản ghi/khái niệm walk-in trong backend (mục 2.6). Phải chốt chính sách trước khi bật thanh toán. |
| B11 | **Báo cáo doanh thu không nhận đơn hoàn thành POS (5)** | `DoanhThuReportRepository` 5 query filter `trang_thai = 3 AND ngay_giao_hang BETWEEN`; `ngayGiaoHang` không được set; giá vốn lọc `pxk.trang_thai=1` (mã đúng là 3) → giá vốn 0. Dashboard dùng `!= 4` (tính cả 5/6). Cần quyết định sửa filter báo cáo. |
| B12 | `ngayGiaoHang` không bao giờ được set | grep `setNgayGiaoHang` = 0 toàn backend (kể cả `markAsDelivered`). |
| B13 | Entity `DonBanHang` không có trường nhận diện nguồn POS | Dump có cột `kenh_ban_id`, `ma_don_hang_kenh` nhưng entity chưa map. Nếu cần phân biệt nguồn → migration additive. |

---

## 4. Nguyên tắc chung của hợp đồng

1. **Phạm vi hẹp, không đụng luồng cũ**: giữ nguyên luồng báo giá/bán sỉ; **không sửa** điều kiện chặn trong `DonBanHangService.create`, không refactor auth/avatar/in/chuyển kho. POS có ranh giới riêng: endpoint + service + bảng mới; tái sử dụng entity `don_ban_hang`, `phieu_xuat_kho`, `lich_su_giao_dich_kho`.
2. **Ngoại lệ phạm vi với DESIGN_CONTRACT (FROZEN)**: `frontend/src/App.jsx` (thêm route `/pos`) và `frontend/src/components/backoffice/sidebar.config.js` (thêm mục "Bán hàng tại quầy") — ngoại lệ được phép duy nhất cho tính năng POS; mọi thay đổi khác ngoài 2 file này vẫn bị cấm. `frontend/src/services/**` chỉ thêm file mới `posService.js`, không sửa service cũ.
3. **Không đổi số trạng thái**: POS dùng bộ trạng thái hiện hành (đơn: 0→…→5 hoàn thành; phiếu xuất 0→3).
4. **Server là nguồn giá/tồn**: UI gửi giá để phát hiện lệch; server tính lại bằng `giaBan`; lệch giá → trả lỗi yêu cầu người bán xác nhận lại, không tự thu số tiền mới.
5. **Không dùng dữ liệu mẫu trong production**: bỏ giỏ khởi tạo mẫu, khách mẫu, hóa đơn mẫu, ảnh demo, QR mẫu; không copy `assets/products/*.webp` và `pos-demo-data.js` vào app thật (chỉ giữ `pos-format.js`).
6. **V1 chỉ tiền mặt**: chuyển khoản/Ví/trả hàng ẩn/khóa ở route thật cho tới khi nghiệp vụ tương ứng hoàn tất (theo `00-START-HERE.md`). Không hiện QR mẫu.
7. **Không hứa giao dịch nguyên tử với bên ngoài**: DB transaction không rollback được ngân hàng/máy in; in nằm ngoài transaction.
8. **Chưa chạy test/môi trường = chưa PASS**: mọi nghiệm thu cần backend chạy + đối chiếu DB thật trong môi trường thử; không ghi PASS chưa xác minh.

---

## 5. Hợp đồng đề xuất — phần MỚI (đánh dấu NEW)

### 5.1 Catalog POS (Phase 2 — UI đọc dữ liệu thật)

**NEW `GET /api/v1/pos/catalog?khoId=&q=&page=&size=`** — `@RequireAuth(roles={quan_tri_vien, quan_ly_kho, nhan_vien_kho, nhan_vien_ban_hang})`.

- **Kho**: `khoId` bắt buộc; service kiểm tra kho thuộc phân quyền người bán bằng đúng pattern `PhieuXuatKhoService.createFromSO:100–110` (DB check `PhanQuyenNguoiDungKho` active + chưa hết hạn; admin bỏ qua). Không hardcode kho1.
- **DTO `PosCatalogItemDto` (NEW)**: `bienTheSanPhamId, maSku, maVachSku, tenSanPham, tenMau, maMauHex, tenSize, tenChatLieu, giaBan, soLuongKhaDung (SUM(ton−dat) theo kho), anhUrl, danhMuc, trangThaiBienThe`.
  - Ảnh: `anhBienThe.tepTin.duongDan` → fallback `anhQuanAos[anhChinh=1] → anhQuanAos[0]` (pattern mục 2.5). `anhUrl=null` hợp lệ → card hiện ảnh rỗng, không crash.
  - Lọc: chỉ biến thể `trangThai=1`; sản phẩm cha `trangThai=1` (lưu ý snapshot có sp58 `trangThai=2` — giá trị ngoài comment; quy ước: chỉ 1 là bán được, không tự kích hoạt).
- **Phân trang server-side thật** (page/size) — phân trang 120/thẻ của template chỉ là tối ưu DOM; tìm theo `maSku`, `maVachSku`, `tenSanPham`, `maSanPham` (không phân tích chuỗi SKU). Bộ lọc nhóm: V1 chỉ "Tất cả"; sau này lấy `danhMuc` nếu được duyệt. **Không có bộ lọc giới tính.**
- **Giỏ**: key = `bienTheSanPhamId` (không phải id sản phẩm demo); hai size/màu khác nhau không gộp; số lượng nguyên dương. Tồn hiển thị là số khả dụng kho đang bán; thiếu dữ liệu hiện "Tồn: —" (không coi là 0); stock=0 → không chọn từ catalog — **chốt chặn thật vẫn là backend lúc checkout**.

### 5.2 Checkout POS tiền mặt (Phase 3 — NEW)

**NEW `POST /api/v1/pos/checkout`** — `@RequireAuth(roles={quan_tri_vien, nhan_vien_ban_hang})` (role mở rộng cho quan_ly_kho/nhan_vien_kho = quyết định kinh doanh, mục 7).

Request:
```json
{
  "requestId": "UUID do client sinh, giữ nguyên khi retry",
  "khoId": 1,
  "khachHangId": 0,            // theo chính sách khách lẻ (mục 6.1)
  "items": [{"bienTheSanPhamId": 93, "quantity": 1, "unitPriceClient": 120000}],
  "payment": {"method": "CASH", "tenderedAmount": 200000},
  "note": ""
}
```

Response: `{donBanHangId, soDonHang, soPhieuXuat, tongCong, tienThua, soLuongKhaDungMoi (per item), ngayGiaoHang}`.

**Một transaction DB duy nhất, tuần tự:**
1. Xác thực: user (AuthInterceptor đã check), kho thuộc quyền (pattern createFromSO), khách hàng tồn tại + `trangThai=1` (walk-in phải là bản ghi thật), giỏ không rỗng, số lượng nguyên dương, biến thể `trangThai=1` + sản phẩm cha bán được.
2. **Idempotency tại DB**: bảng NEW `pos_checkout_request(request_id UNIQUE, payload_hash, don_ban_hang_id, trang_thai PENDING/SUCCESS/FAILED, ngay_tao)`. Insert trước; trùng key + cùng hash → trả kết quả đã lưu; trùng key + khác hash → `CommonException` 409. Chống race bằng chính unique constraint (bắt `DataIntegrityViolationException` rồi đọc lại), không chỉ if-exists.
3. Giá/tổng: đọc `giaBan` server, tính `BigDecimal`; so khớp `unitPriceClient` — lệch → lỗi xác nhận lại (không tự thu). Giữ quy ước giá ≥10% giá niêm yết hiện hữu (không áp dụng với giá server chuẩn — POS bán đúng `giaBan`).
4. **Khóa tồn**: repository method NEW `@Lock(PESSIMISTIC_WRITE)` trên các dòng `TonKhoTheoLo` cần dùng, **thứ tự ổn định (kho, loHang.id ASC)** để tránh deadlock. Kiểm tra khả dụng **sau khóa**; thiếu → lỗi, rollback.
5. **Chọn lô theo chính sách FIFO đã chứng minh**: `ngayNhapGanNhat ASC`, tie-break `loHang.id ASC` (phần tie-break là NEW để xác định; cơ sở là `findAvailableLots` hiện hữu). Không bán tồn đã đặt (`ton−dat`).
6. **Tạo chứng từ trực tiếp** (không qua `DonBanHangService.create`, không qua `pickLoHang` để tránh B1/B7): `DonBanHang{loaiChungTu="don_ban_hang", soDonHang=generateMaChungTu("don_ban_hang") (reuse, kèm retry hiện hữu), trangThai cuối = 5, ngayGiaoHang=now (NEW trong phạm vi POS), trangThaiThanhToan="da_thanh_toan", tongCong}` + `ChiTietDonBanHang{soLuongDat, soLuongDaGiao=soLuongDat, donGia, thanhTien}` + `PhieuXuatKho{loaiXuat="ban_hang", soPhieuXuat=generateSoPhieu(), trangThai=3, nguoiXuat}` + `ChiTietPhieuXuatKho` gắn `loHang` theo allocation + trừ `soLuongTon` + `LichSuGiaoDichKho` (loaiThamChieu `phieu_xuat_kho`). **Ghi tồn đúng một lần, một chỗ duy nhất trong transaction** — không gọi helper vừa trừ tồn vừa trừ lần hai.
   - Lựa chọn trạng thái: đơn POS đi thẳng 0→(xuất)→3→5 trong cùng transaction. **Không tạo trạng thái mới, không thêm enum POS**; nhận diện nguồn (nếu cần) = migration additive cột/trường với default tương thích (B13 — chỉ làm nếu nghiệp vụ yêu cầu).
7. **Thu tiền**: bảng NEW `pos_payment(id, request_id, don_ban_hang_id, phuong_thuc='CASH', so_tien_thu, so_tien_thua, nguoi_thu_id, ngay_tao)` — chứng từ đối soát; `tienThua = tenderedAmount − tongCong` (≥0 mới chấp nhận); tiền thừa không cộng vào doanh thu.
8. Cập nhật `pos_checkout_request` → SUCCESS (ghi `don_ban_hang_id`), commit. Lỗi bất kỳ → rollback toàn bộ, request → FAILED.
9. **Tương thích kho cũ**: các dòng tồn POS khóa/ghi phải cùng cơ chế với mọi luồng khác cùng sửa các dòng đó. V1: POS tự khóa bằng PESSIMISTIC_WRITE; luồng cũ giữ nguyên (không refactor). Test đồng thời POS-vs-xuất-kho (Phase 5); nếu test phát hiện race với luồng cũ → mở rộng khóa sang `PhieuXuatKhoService.complete`/`PhieuNhapKhoService` **có test kèm** (không tự ý đổi trước).

### 5.3 Recovery khi mất phản hồi (Phase 4)

**NEW `GET /api/v1/pos/checkout-requests/{requestId}`** — trả kết quả đã lưu (`SUCCESS` → payload response đầy đủ để in/đóng tab; `FAILED` → lý do; không thấy → 404).
- Frontend: timeout → giữ tab + `requestId` cũ, poll endpoint này; **không sinh key mới** khi retry; thành công chỉ đóng đúng tab đã gửi; in lỗi không bán lại.
- Số hóa đơn trên tab (`HD000001`) chỉ là nhãn client; số chứng từ chính thức = `soDonHang` server trả.

### 5.4 In receipt

- Sau checkout thành công: điều hướng `/sales-orders/{id}/invoice` (đọc đơn đã lưu qua `GET /don-ban-hang/{id}/detail`, mẫu `sales_invoice` A4/A5/K80 hiện hữu) — thỏa "in đọc dữ liệu đã lưu". Không in từ state giỏ. In thất bại không ảnh hưởng đơn đã lưu.

### 5.5 Migration & rollback

- `ddl-auto=none` → mọi bảng mới phải có DDL. **Migration additive** theo convention repo (`Database/MyDB_vN.sql`): file mới `Database/MyDB_v1.4.sql` (hoặc delta `pos_checkout_migration.sql` — chọn theo convention, chỉ `CREATE TABLE` bảng mới: `pos_checkout_request`, `pos_payment`; không DROP, không ALTER bảng cũ; nếu cần cột nguồn thì `ALTER ADD COLUMN ... DEFAULT`).
- **Quy trình**: backup DB + xác minh khôi phục → chạy migration trên staging (bản sao dump) → backend → frontend có **feature flag POS tắt** (route/sidebar ẩn theo flag env, mặc định tắt) → nghiệm thu → mở một quầy/kho → đối chiếu đơn/tiền/tồn → mở rộng.
- **Rollback code**: gỡ route `/pos` + ẩn mục sidebar + tắt flag; luồng cũ không bị ảnh hưởng vì không sửa. Rollback dữ liệu: bảng mới có thể drop sau khi đối soát (chỉ khi không còn tham chiếu).

### 5.6 Đồng thời & chống lặp (thiết kế)

| Vấn đề | Cơ chế |
|---|---|
| Bán quá tồn (2 quầy chiếc cuối) | PESSIMISTIC_WRITE + check khả dụng sau khóa (5.2 bước 4) |
| Deadlock | Khóa các dòng theo thứ tự (kho, loHang.id) ổn định |
| Click đôi/timeout-retry | `pos_checkout_request.request_id` UNIQUE + payload hash (5.2 bước 2) |
| Sinh số trùng | Giữ retry unique hiện hữu + requestId chặn tạo đơn đúp |
| Lost update với luồng cũ | Test đồng thời Phase 5; mở rộng khóa có test nếu cần (5.2 bước 9) |

---

## 6. Chính sách bắt buộc

### 6.1 Chính sách khách lẻ (walk-in) — đề xuất cụ thể

- **Không** dùng khách NULL, không dùng id demo, không đoán bản ghi có sẵn là khách lẻ.
- **Đề xuất**: tạo **một** bản ghi khách lẻ thật qua migration additive: `ma_khach_hang` cố định (ví dụ `KHLE` — mã do nghiệp vụ chốt), `ten_khach_hang` "Khách lẻ", `loai_khach_hang='le'`, `trang_thai=1`. Backend phân giải bằng **mã/hằng cấu hình**, không hardcode id trong FE; checkout kiểm tra bản ghi tồn tại + active trước khi dùng.
- Màn POS mặc định chọn khách lẻ; người bán có thể chọn khách thật từ `/khach-hang/for-sales-order` (search tên/số điện thoại — chú ý quy tắc UI: **không dùng placeholder "090..."** ở ô SĐT theo phản hồi trước đây của người dùng).
- **Chưa chốt**: ai tạo bản ghi, mã/ tên chính xác, có cho tạo khách mới ngay tại quầy hay không (endpoint `/khach-hang/create` hiện không có @RequireAuth — phải thêm annotation nếu cho phép tạo tại quầy).

### 6.2 Chính sách lô — FIFO

- Thứ tự xuất: `TonKhoTheoLo.ngayNhapGanNhat` tăng dần (FIFO theo ngày nhập kho — chính là thứ tự `findAvailableLots` hiện hữu), tie-break `loHang.id` tăng dần để xác định. Không xuất lô có `ton − dat ≤ 0`.

---

## 7. Lựa chọn nghiệp vụ chưa chốt (cần quyết định trước Phase 3)

1. **Bản ghi khách lẻ**: mã/tên chính xác và người tạo (mục 6.1).
2. **Role được bán tại quầy**: V1 `quan_tri_vien` + `nhan_vien_ban_hang`; có mở cho `quan_ly_kho`/`nhan_vien_kho` không? (bán ở quầy thuộc cửa hàng — hiện UI phân quyền 1 người 1 kho).
3. **Báo cáo doanh thu**: có sửa filter `DoanhThuReportRepository`/`KhachHangReportRepository` từ `trang_thai=3` → `IN (3,5)` và sửa giá vốn `pxk.trang_thai=1`→`3` không? (B11 — ảnh hưởng báo cáo hiện hữu; nếu chưa duyệt thì nghiệm thu POS doanh thu qua dashboard `!=4` và ghi nợ kỹ thuật.)
4. **Nhận diện nguồn POS**: có cần cột nguồn/`kenh_ban` cho đơn POS không (B13)? (có thể dùng `loaiChungTu=don_ban_hang` + nguoiTao đã đủ phân biệt với luồng báo giá hiện tại).
5. **Tạo khách mới tại quầy**: cho phép hay bắt buộc tạo trước ở trang Khách hàng? (kèm bổ sung `@RequireAuth` cho `/khach-hang/create` nếu cho phép).
6. **Nháp sau refresh**: tab hóa đơn POS có lưu nháp không (template hiện không lưu; refresh mất tab) — chấp nhận hay lưu localStorage (client-only, V1 chấp nhận mất)?
7. **Giảm giá tại quầy**: V1 bán đúng `giaBan` (template đã bỏ discount); có cho phép giá thấp hơn trong phạm vi quy ước ≥10% hiện hữu không?

---

## 8. File dự kiến theo phase

### Phase 2 — Live catalog UI (không thu tiền)

| Loại | File | Ghi chú |
|---|---|---|
| Sửa | `frontend/src/App.jsx` | +route `/pos` (ngoại lệ FROZEN được ghi nhận) |
| Sửa | `frontend/src/components/backoffice/sidebar.config.js` | +mục "Bán hàng tại quầy" nhóm "Bán hàng" (ngoại lệ FROZEN) |
| Mới (copy+điều chỉnh) | `frontend/src/pages/pos/PosSalesPage.jsx`, `components/PosCartPanel.jsx`, `PosDialogs.jsx`, `PosInvoiceTabs.jsx`, `pos-invoice-tabs.css`, `PosModal.jsx`, `PosProductCard.jsx`, `PosProductCatalog.jsx`, `pos-format.js` | Bỏ `pos-demo-data.js` + `assets/`; ẩn/khóa chuyển khoản, Ví, trả hàng, QR mẫu; callback bắt buộc |
| Mới | `frontend/src/services/posService.js` | catalog + kho mine + khách for-sales-order |
| Mới (backend) | `PosController`, `PosCatalogService` (hoặc method trong service hiện hữu), `PosCatalogItemDto`, query catalog trong `TonKhoTheoLoRepository` (hoặc `BienTheSanPhamRepository`) | — |

### Phase 3 — Backend checkout tiền mặt

| Loại | File | Ghi chú |
|---|---|---|
| Mới (backend) | `PosCheckoutController`, `PosCheckoutService`, `PosCheckoutRequest`, `PosCheckoutResponse`, `PosCheckoutRequestDto`, `PosCheckoutItemDto` | — |
| Mới (backend) | entity + repository `PosCheckoutRequest` (idempotency), `PosPayment` | kèm `@Lock(PESSIMISTIC_WRITE)` query tồn trong `TonKhoTheoLoRepository` |
| Mới | `Database/MyDB_v1.4.sql` (additive: `pos_checkout_request`, `pos_payment`, seed khách lẻ nếu được duyệt) | không DROP/ALTER bảng cũ |
| Mới | test: unit service + integration checkout | — |

### Phase 4 — Frontend checkout + recovery

| Loại | File | Ghi chú |
|---|---|---|
| Sửa | `frontend/src/pages/pos/PosSalesPage.jsx` (+dialogs) | nối `onCompleteSale` → `posService.checkout`; giữ `requestId` khi retry; poll recovery; điều hướng in `/sales-orders/:id/invoice` |
| Mới | test UI (render/state/interaction) | — |

### Phase 5 — Integration & concurrency tests (không đổi logic sản xuất trừ khi test bắt lỗi)

Test backend MySQL thật + frontend build/lint theo gate `MIGRATION_STATUS.md` (build PASS, eslint không tăng, zero diff file FROZEN trừ 2 ngoại lệ).

### Phase 6 — Staging & pilot; Phase 7 — Chuyển khoản (sau, ngoài phạm vi hiện tại)

---

## 9. Test matrix (điều kiện nghiệm thu)

Fixture chuẩn: kho1 + biến thể 93 (giá 120000, khả dụng 5, 3 lô 3/1/1). Chỉ kết luận sau khi chạy backend và đối chiếu DB thật.

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| T1 | Bán 1 SKU93 thu 120000 | Đơn tạo `don_ban_hang` trangThai 5, `da_thanh_toan`, phiếu xuất 3, tồn 5→4, lô trừ đúng 1 theo FIFO (lô nhập sớm nhất), lịch sử kho 1 dòng |
| T2 | Đưa tiền 200000 | `tienThua` 80000; doanh thu ghi 120000 |
| T3 | Đưa tiền thiếu | Từ chối; DB không đổi (không đơn, không phiếu, không trừ tồn) |
| T4 | Mua 6 khi tồn 5 | Từ chối; DB không đổi |
| T5 | Hai quầy đồng thời mua chiếc cuối | Đúng 1 thành công; test cả POS-vs-`PhieuXuatKhoService.complete` cùng SKU |
| T6 | Cùng `requestId` gửi lặp (click đôi/timeout) | 1 đơn, 1 phiếu xuất, 1 payment, 1 lần trừ tồn |
| T7 | Cùng `requestId` khác payload | 409, không tạo đơn |
| T8 | SKU ngừng bán / giá đổi giữa lúc xem và thanh toán | Từ chối/yêu cầu xác nhận lại; server là nguồn giá |
| T9 | Kho không được phân quyền / phân quyền hết hạn | 403/lỗi nghiệp vụ, không bán |
| T10 | Khách lẻ chưa tồn tại/không active | Từ chối |
| T11 | Lỗi giữa các bước ghi | Rollback toàn bộ |
| T12 | In thất bại sau khi commit | Không nhân đôi đơn; có thể in lại từ `/sales-orders/:id/invoice` |
| T13 | Báo cáo: doanh thu/tồn nhận giao dịch POS | Sau khi chốt quyết định mục 7.3: đơn 5 được tính; tồn khớp; nhãn trạng thái không đảo hủy/hoàn thành |
| T14 | UI: đổi tab không lẫn giỏ/khách/SKU; đóng tab không mất tab khác; refresh theo chính sách nháp (mục 7.6); F3/Enter/barcode; quyền ẩn menu | Đúng theo hợp đồng |
| T15 | Không có dữ liệu mẫu (ảnh/khách/giỏ/receipt demo) trên route thật | Đúng |

---

## 10. Sẵn sàng cho phase tiếp theo & blockers còn tồn

**Sẵn sàng Phase 02** (Live catalog UI): đủ thông tin — route/sidebar, DTO catalog, pattern quyền kho, pattern ảnh, cơ chế khóa checkout đã thiết kế sẵn. Phase 02 không cần quyết định nghiệp vụ nào (chưa thu tiền).

**Blockers phải giải quyết trước khi bật thu tiền (Phase 03–04):**
1. B1 (chặn tạo đơn trực tiếp) — giải bằng endpoint POS riêng (đã thiết kế 5.2).
2. B6/B7 — giải bằng allocation + PESSIMISTIC_WRITE trong POS; cần test T5 với luồng cũ.
3. B10 — cần **quyết định nghiệp vụ khách lẻ** (mục 7.1) trước Phase 03.
4. B11 — cần **quyết định sửa filter báo cáo** (mục 7.3); không chặn checkout nhưng chặn nghiệm thu doanh thu.
5. B3 — cần bảng thu tiền mới + migration `MyDB_v1.4.sql` (đã thiết kế).
6. B5 — trả hàng: không triển khai V1; ẩn/khóa ở UI.
7. B9 — sinh số: chấp nhận pattern hiện hữu + requestId chống lặp (đã thiết kế); ghi nợ kỹ thuật chuẩn hóa sinh số an toàn.
8. Không có dump `fashion_system_2026-10-05` trong repo → môi trường staging cần chuẩn bị dump riêng (theo `00-START-HERE.md`: không import dump vào DB thật).

**Không được làm trong phase 02–07**: refactor auth/avatar/in; sửa `DonBanHangService.create`; đổi số trạng thái; dùng dữ liệu mẫu trong production; nối QR đơn mua hàng sang POS; bật chuyển khoản/Ví/trả hàng.

---

*Phạm vi đọc: source backend + frontend + `Database/MyDB_v1.3.sql` (read-only). Không chạy SQL, không sửa code, không commit. Mọi khẳng định "đã xác minh" trong tài liệu này đều có file/method/dòng kèm theo; phần đánh dấu NEW là thiết kế đề xuất, chưa tồn tại trong nhánh.*
