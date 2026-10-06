# Kết quả PHASE 03 — Checkout POS tiền mặt (backend)

Ngày: 06/10/2026 (Việt Nam). Nhánh `Khang`, HEAD `320c67f`. Không commit/push/reset; thay đổi phase 01–03 giữ nguyên trên working tree. **Frontend không đổi trong phase này — nút thanh toán vẫn bị khóa (`checkoutEnabled=false`), chờ Phase 04.**

## 1. Tóm tắt

- Đã triển khai đúng hợp đồng `01-contract.md` mục 5.2/5.3: **POST /api/v1/pos/checkout** + **GET /api/v1/pos/checkout-requests/{requestId}** (phục hồi), bảng `pos_checkout_request` (neo idempotency) + `pos_payment` (sổ thu tiền mặt) qua migration additive, gate server-side `pos.checkout-enabled=false` mặc định **TẮT**.
- **KHÔNG sửa** điều kiện chặn trong `DonBanHangService.create` (dòng 226–228 giữ nguyên — luồng báo giá/sỉ không đổi). `loai_chung_tu` dùng giá trị enum hiện hữu `don_ban_hang`/`ban_hang` — **không thêm enum mới**.
- Số trạng thái giữ nguyên (đơn kết thúc ở 5 = Hoàn thành; phiếu xuất 3 = Đã xuất). Comment SQL trái ngược đã được chuẩn hóa trong migration (chỉ sửa COMMENT, không đổi dữ liệu). Hằng `ITrangThaiDonBanHang` mới dùng cho luồng POS.
- Báo cáo doanh thu/khách hàng đã sửa filter để nhận đơn hoàn thành (chi tiết mục 4).
- Toàn bộ luồng ghi tồn (POS + xuất kho + nhập kho + kiểm kê) giờ khóa cùng một thứ tự (PK) — thiết kế chống lost update; kiểm thử đồng thời DB thật thuộc Phase 05 (ghi nhãn trung thực ở mục 7).

## 2. API

### 2.1 Checkout — `POST /api/v1/pos/checkout`
Auth: `@RequireAuth(quan_tri_vien | nhan_vien_ban_hang)`. Gate: `pos.checkout-enabled=false` → **503** "Chức năng thanh toán POS chưa được kích hoạt trên hệ thống".

Request:
```json
{
  "requestId": "8f3c9a1e-4b2d-4e7a-9c6f-1d2e3f4a5b6c",
  "khoId": 1,
  "khachHangId": 12,
  "items": [
    { "bienTheSanPhamId": 93, "quantity": 1, "unitPriceClient": 120000 }
  ],
  "payment": { "method": "CASH", "tenderedAmount": 200000 },
  "note": ""
}
```

Response 200 (mọi số tiền do **server tính**):
```json
{
  "status": 200, "error": null, "message": "Thanh toán thành công",
  "data": {
    "donBanHangId": 501, "soDonHang": "SO2026100601", "soPhieuXuat": "PX2026100601",
    "tongTienHang": 120000, "tongCong": 120000,
    "soTienThu": 200000, "soTienThua": 80000,
    "ngayGiaoHang": "2026-10-06T01:30:00Z",
    "items": [{ "bienTheSanPhamId": 93, "maSku": "AK2610051-CL005-1-MS-2691",
                "soLuong": 1, "donGia": 120000, "thanhTien": 120000, "soLuongKhaDungSau": 4 }]
  }
}
```

Giá đã đổi so với màn hình → **409** có cấu trúc (không tự thu số tiền mới):
```json
{ "status": 409, "error": "Conflict",
  "message": "Giá sản phẩm đã thay đổi. Vui lòng xác nhận lại giá mới trước khi thanh toán.",
  "data": { "priceChanged": true, "items": [{ "bienTheSanPhamId": 93, "maSku": "AK...",
              "giaHienThi": 100000, "giaMoi": 120000 }] } }
```

Các lỗi nghiệp vụ khác → 400 `CommonException` (message tiếng Việt); trùng requestId khác payload → 409.

### 2.2 Phục hồi — `GET /api/v1/pos/checkout-requests/{requestId}`
Auth: `@RequireAuth(quan_tri_vien | nhan_vien_ban_hang | quan_ly_kho)` + phân quyền dữ liệu: chỉ **chủ sở hữu** (thu ngân tạo), **admin**, hoặc người có quyền kho của giao dịch (`authorizeWarehouse`) — không lộ giao dịch người khác qua id đoán. Trả `{requestId, trangThai, result?, errorMessage?}`; **không tìm thấy = 404** (kết quả chưa rõ → client được phép thử lại cùng key + cùng payload).

## 3. Thay đổi schema (migration additive)

`Database/pos_checkout_v1.sql` — **chỉ CREATE TABLE + sửa COMMENT**, không DROP, không ALTER dữ liệu cũ; chạy thủ công sau backup (ddl-auto=none). Nội dung:
1. `pos_checkout_request`: `request_id` **UNIQUE** (neo idempotency — race chặn tại DB), `request_hash` (SHA-256 payload chuẩn hóa), `kho_id`, `don_ban_hang_id`, `trang_thai` (PENDING/SUCCESS/FAILED), `result_json` (kết quả lưu để phục hồi), `error_message`, `nguoi_thu_ngan_id`, timestamps + FK.
2. `pos_payment`: `request_id` **UNIQUE** (mỗi request đúng 1 phiếu thu), `don_ban_hang_id`, `phuong_thuc='CASH'`, `so_tien_hang` (doanh thu), `so_tien_thu`, `so_tien_thua` (không phải doanh thu), `nguoi_thu_id` + FK.
3. Chuẩn hóa COMMENT trạng thái (đơn 0–6, phiếu xuất 0–5) cho khớp code — chỉ sửa comment.

## 4. File thay đổi chính xác

**Mới (backend):**
- `constant/variables/ITrangThaiDonBanHang.java` — hằng 0–6 có comment (luồng POS dùng; service cũ giữ literal).
- `dto/request/PosCheckoutCreating.java` — request + items + payment.
- `dto/response/customize/PosCheckoutResponse.java`, `PosPriceChangeInfo.java`, `PosCheckoutRecoveryResponse.java`.
- `entities/PosCheckoutRequest.java`, `entities/PosPayment.java`.
- `repository/PosCheckoutRequestRepository.java`, `repository/PosPaymentRepository.java`.
- `utils/PosCheckoutPayloadHash.java` — SHA-256 payload chuẩn hóa (items sort theo variant, tiền toPlainString, note trim).
- `services/impl/entities/PosCheckoutTransaction.java` — executor `@Transactional` (toàn bộ ghi trong 1 transaction).
- `services/impl/entities/PosCheckoutService.java` — orchestrator (idempotency + recovery, không tự gọi nội bộ để proxy transaction đúng).
- Test: `PosCheckoutServiceTest` (13), `PosCheckoutTransactionTest` (19).

**Sửa (backend, tối thiểu):**
- `controller/PosController.java` — +2 endpoint + gate `@Value("${pos.checkout-enabled:false}")`.
- `resources/application.properties` — +`pos.checkout-enabled=false` (comment ASCII — file .properties đọc ISO-8859-1).
- `exception/customize/CommonException.java` — +constructor `(message, httpStatus, data)` cho phản hồi 409 có cấu trúc.
- `services/impl/entities/PosCatalogService.java` — `authorizeWarehouse` private→public (checkout/recovery tái sử dụng đúng 1 cơ chế).
- `repository/TonKhoTheoLoRepository.java` — +2 query `@Lock(PESSIMISTIC_WRITE)` **sắp theo PK (t.id)**: `lockLotsForUpdateByKhoAndVariants`, `lockLotsForUpdateByLotIds`.
- `repository/DoanhThuReportRepository.java` — 5 query: `pxk.trang_thai = 1`→`3` (giá vốn — trước đây luôn 0 vì lọc nhầm) và `dbh.trang_thai = 3`→`IN (3, 5)` (đơn POS hoàn thành vào doanh thu). Số trạng thái không đổi.
- `repository/KhachHangReportRepository.java` — 5 cặp filter `trang_thai = 3`→`IN (3, 5)`.
- `services/impl/entities/PhieuXuatKhoService.java` — `complete()`: khóa các dòng tồn sẽ ghi (theo PK) trước vòng trừ tồn.
- `services/impl/entities/PhieuNhapKhoService.java` — `completePhieuNhap` + `completeTransferReceipt`: khóa theo lô (PK) trước khi ghi.
- `services/impl/entities/PhieuKiemKeService.java` — `complete()`: khóa theo lô (PK) trước khi ghi đè tồn.

**Mới (migration):** `Database/pos_checkout_v1.sql`.

**Frontend: không thay đổi** (nút thanh toán giữ `checkoutEnabled=false` + thông báo Phase 03 từ Phase 02).

## 5. Ranh giới transaction & thiết kế chống lặp/lost update

- **1 transaction DB** (`PosCheckoutTransaction.execute`): insert neo request (PENDING, flush để unique nổ sớm) → khóa tồn → kiểm tra khả dụng **sau khóa** → tạo `don_ban_hang` (loaiChungTu `don_ban_hang`, trangThai 5, `ngayGiaoHang=now`, `da_thanh_toan`) + dòng đơn → `phieu_xuat_kho` (loaiXuat `ban_hang`, trangThai 3) + dòng pick gắn lô (FIFO) → **trừ tồn + nhật ký kho** (ghi đúng 1 lần/chỗ duy nhất, không gọi helper trừ tồn nào của luồng cũ — tránh trừ 2 lần và tránh lỗ hổng `pickLoHang`) → `pos_payment` → chốt neo SUCCESS + `result_json`. Lỗi bất kỳ (toàn RuntimeException — không có checked exception) → rollback toàn bộ; neo biến mất = kết quả chưa rõ, được thử lại.
- **Idempotency**: unique constraint là chốt chặn race. Trùng key → `DataIntegrityViolationException` nổi lên **orchestrator (không transactional)** xử lý NGOÀI transaction hỏng: đọc bản ghi thắng trong transaction mới → cùng hash+SUCCESS trả chính xác kết quả đã lưu / cùng hash+FAILED trả lỗi đã lưu / khác hash 409 / không thấy (bên thắng rollback) → thử lại đúng 1 lần. Lỗi nghiệp vụ được ghi FAILED trong **REQUIRES_NEW** (transaction riêng) — phân biệt lỗi xác định với "chưa rõ". Không có chỗ nào retry mù trong transaction đã hỏng.
- **Khả dụng = ton − dat** tính từ các dòng đã khóa; chỉ lô đúng kho+SKU (query đã lọc); FIFO `ngayNhapGanNhat` tăng dần, tie-break `loHang.id`; lô có `ton−dat ≤ 0` bị bỏ qua; tổng khả dụng gộp nhiều lô.
- **Chống lost update giữa các luồng**: mọi nơi ghi `ton_kho_theo_lo` (POS, xuất kho, nhập kho, nhận chuyển kho, kiểm kê) đều khóa `PESSIMISTIC_WRITE` trước, **cùng thứ tự PK** — tránh deadlock lẫn nhau và chặn ghi đè lạc. Luồng `pickLoHang`/`cancel` (ghi `so_luong_da_dat` của chuyển kho) chưa nằm trong bộ khóa này — ghi nhận ở mục 7.
- **Không lộ tài liệu kho của người khác**: POS tự dựng phiếu xuất riêng trong transaction của chính nó; không gọi `pickLoHang`/`createFromSO`/`complete` của luồng cũ — không có đường cho cashier thao tác phiếu kho ngoài quyền.
- Sinh số chứng từ: `SO`/`PX` + yyyyMMdd + count+1, retry ≤5 trên unique (convention repo; IDENTITY khiến INSERT nổ ngay tại save nên vòng lặp hoạt động). Đơn đúp đã được neo requestId chặn trước.
- Khách lẻ: server chỉ nhận `khachHangId` tường minh, kiểm tra tồn tại + `trangThai=1`; không tự suy mã walk-in (bản ghi `KHLE` seed ở Phase 06 theo quyết định kinh doanh).

## 6. Test đã thực chạy

| Lệnh | Kết quả |
|---|---|
| `mvnw test` (toàn bộ suite) | **97/97 PASS, BUILD SUCCESS** (trước phase: 65) |
| `mvnw compile` | PASS (query JPQL/native không check lúc compile — context-load test đã validate JPQL + `@Lock` mới) |

Phân bổ test mới (32):
- `PosCheckoutServiceTest` (13): thành công; trùng key cùng payload → trả kết quả đã lưu (không gọi lại executor); trùng key khác payload → 409; trùng key + FAILED đã ghi → trả lỗi đã lưu; trùng key nhưng bên thắng rollback → thử lại đúng 1 lần; lỗi nghiệp vụ → ghi FAILED (REQUIRES_NEW) rồi ném lại; đua ghi FAILED gặp SUCCESS → trả kết quả thắng; recovery SUCCESS/FAILED/404/chủ sở hữu/admin/không quyền kho bị chặn.
- `PosCheckoutTransactionTest` (19): thành công ghi đủ đơn(loaiChungTu `don_ban_hang`, trangThai 5, `da_thanh_toan`, `ngayGiaoHang`) + phiếu xuất (`ban_hang`, 3) + phiếu thu (CASH, tiền thừa 80000 không vào doanh thu) + nhật ký (trước 3/sau 2) + neo PENDING→SUCCESS kèm result_json; FIFO theo ngày nhập (lô sớm trước, gộp 2 lô 2+1, giá vốn lô đúng); **trừ đặt hàng** (ton 3 dat 2 → chỉ bán 1, ton→2); thiếu tồn gộp nhiều lô → từ chối trước khi ghi đơn; thiếu tiền → từ chối; **giá đổi → 409 có cấu trúc** (trước khi ghi cả neo); SKU ngừng bán / sản phẩm cha ngừng bán / khách không tồn tại / khách không hoạt động / kho không phân quyền / trùng biến thể / số lượng lẻ 1.5 / phương thức TRANSFER / tiền lẻ đồng / vượt giới hạn 500M → từ chối đúng thông điệp; **lỗi ghi giữa chừng (nhật ký) → dừng ngay, không ghi phiếu thu, neo chỉ ở PENDING** (rollback thật do Spring `@Transactional` — xem mục 7); trùng số đơn → retry 1 lần rồi thành công; trùng số phiếu xuất → retry 1 lần.

**Chưa chạy được — KHÔNG ghi PASS (thuộc Phase 05):** test đồng thời với MySQL thật (2 quầy chiếc lô cuối; POS-vs-xuất kho; khóa `PESSIMISTIC_WRITE` là ngữ nghĩa DB — mock không thay thế được); test chạy migration trên DB thật; test báo cáo native SQL với dữ liệu thật.

## 7. Blocker / giới hạn còn lại

1. **Migration chưa chạy trên DB nào** — bảng mới cần được áp dụng (staging trước, theo `00-START-HERE`); chưa có DB chạy để kiểm thử tích hợp.
2. **Gate đang TẮT** (`pos.checkout-enabled=false`; `production/application.properties` không có key → mặc định false) — đúng yêu cầu "không bật POS production". Khi bật phải thêm key rõ ràng.
3. **Kiểm thử đồng thời DB thật** (Phase 05) — thiết kế khóa đã áp cho cả 4 luồng ghi tồn, nhưng ngữ nghĩa khóa MySQL chưa được xác minh bằng test thật. Luồng ghi `so_luong_da_dat` của chuyển kho (`pickLoHang`/`cancel`) chưa tham gia bộ khóa PK — ghi nhận, đánh giá ở Phase 05.
4. **Bản ghi khách lẻ `KHLE` chưa seed** (quyết định kinh doanh mở từ Phase 01 — mã/tên/người tạo).
5. **Báo cáo doanh thu**: đã mở `IN (3,5)` và sửa giá vốn `pxk=3`; đơn legacy hoàn thành vẫn không có `ngayGiaoHang` → không vào báo cáo theo ngày (giới hạn cũ, ngoài phạm vi). Đơn POS có `ngayGiaoHang` → được tính.
6. **Frontend chưa nối checkout** (Phase 04): giữ requestId khi retry, poll recovery, xử lý 409 price-change, điều hướng in.
7. Sinh số chứng từ vẫn là count+1+retry (convention repo) — ghi nợ chuẩn hóa sinh số an toàn tuyệt đối (bảng sequence), không chặn nghiệm thu vì unique + requestId đã chống đơn đúp.

## 8. Sẵn sàng Phase 04

Backend đã đủ: checkout + phục hồi + price-change có cấu trúc + gate tắt mặc định. Phase 04 nối frontend (`onCompleteSale`/`checkoutEnabled`), xử lý timeout bằng requestId cũ, hiển thị xác nhận giá mới khi 409, in qua `/sales-orders/{id}/invoice`. **Dừng tại đây — chưa bật thanh toán ở frontend, chưa chạy migration trên DB thật.**
