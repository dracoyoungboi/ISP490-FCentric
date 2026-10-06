# Báo cáo PHASE 06 — Bật checkout tiền mặt ở môi trường local/staging

Ngày: 06/10/2026 (Việt Nam). Nhánh `Khang`, HEAD `320c67f`. Không commit/push/reset; **không đụng production** (không probe 171.244.142.43; không sửa production/application.properties).

## 1. Chẩn đoán vì sao checkout bị tắt — và cách đã bật đúng cách

| Thành phần | Gate | Nguồn cấu hình | Giá trị hiệu dụng | Cách bật cho staging |
|---|---|---|---|---|
| Backend | `pos.checkout-enabled` (đọc qua `@Value("${pos.checkout-enabled:false}")` trong [PosController.java](../../backend/src/main/java/com/dev/backend/controller/PosController.java)) | `backend/src/main/resources/application.properties` = **false**; `production/.../application.properties` **không có key** → default false | **OFF** ở cả dev lẫn production | Biến môi trường `POS_CHECKOUT_ENABLED=true` (relaxed binding ghi đè application.properties — **không sửa file config nào**) |
| Frontend | `CHECKOUT_ENABLED = import.meta.env.VITE_POS_CHECKOUT === 'true'` trong [index.jsx](../../frontend/src/pages/pos/index.jsx) | Biến env khi chạy vite | **OFF** mặc định | `VITE_POS_CHECKOUT=true` khi chạy `npm run dev` |
| API base | `VITE_API_URL \|\| http://localhost:8080` trong [apiClient.js](../../frontend/src/services/apiClient.js) | Biến env vite | mặc định 8080 | `VITE_API_URL=http://localhost:8090` (vì **8080 đã bị process java khác của người dùng giữ** — không đụng; staging backend chạy cổng 8090) |
| DB | `spring.datasource.*` | application.properties dev trỏ dev server (160.25.81.94) | dev DB | Env `SPRING_DATASOURCE_URL/USERNAME/PASSWORD` → schema staging riêng |

**Không gỡ guard nào, không giả lập thành công**: mọi thay đổi đều qua env/khởi động, file config trong repo KHÔNG đổi (production default vẫn OFF). Callback checkout thật (`posService.checkout`), quyền thu ngân (phan_quyen kho), khách hàng bắt buộc (KHLE hoặc khách thật) đều được xác minh ở mục 5.

## 2. Môi trường staging (isolated, dùng lại được)

- **MySQL riêng**: instance mới từ `mysqld.exe` đã cài sẵn, datadir **cố định** `C:\Users\admin\.fcentric-pos-staging\mysql-data` (ngoài repo — không vào git), bind **127.0.0.1:3307**, `--default-time-zone=+00:00`. **Không đụng service MySQL80**.
- **Schema**: `fcentric_pos_test` ← snapshot `Database/MyDB_v1.3.sql` + migration `Database/pos_checkout_v1.sql` (tool kiểm tra `SHOW TABLES LIKE 'pos_%'` trước khi áp — idempotent).
- **User DB riêng**: `posstage` / `PosStage@123` chỉ có quyền trên `fcentric_pos_test` (tránh lỗi env password rỗng của PowerShell và không lộ credential dev).
- **Seed** (idempotent, trong tool ngoài repo `C:\Users\admin\.fcentric-pos-staging\ProvisionStagingDb.java`):
  - Khách lẻ **KHLE** (id 26) — `ma_khach_hang='KHLE'`, `loai_khach_hang='le'`, `trang_thai=1`, tên viết bằng UNHEX để không phụ thuộc encoding; **không sửa khách hàng có sẵn**.
  - Thu ngân demo **posdemo / Posdemo@123** (nhan_vien_ban_hang, trang_thai 1) + `phan_quyen_nguoi_dung_kho` kho 1 active — dùng được `/kho/mine`, catalog, checkout.

### Lệnh start/stop (đã tạo sẵn, ngoài repo)
```
C:\Users\admin\.fcentric-pos-staging\start-staging.cmd   # MySQL(3307) + backend(8090, gate ON) + frontend(vite, gate ON)
C:\Users\admin\.fcentric-pos-staging\stop-staging.cmd    # chỉ tắt process staging, giữ data
```
Khởi động thủ công (tương đương):
```
# MySQL
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --no-defaults --datadir="C:\Users\admin\.fcentric-pos-staging\mysql-data" --port=3307 --bind-address=127.0.0.1 --mysqlx=0 --default-time-zone=+00:00
# Backend (PowerShell, trong thư mục backend)
$env:POS_CHECKOUT_ENABLED='true'
$env:SPRING_DATASOURCE_URL='jdbc:mysql://127.0.0.1:3307/fcentric_pos_test?allowMultiQueries=true&useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true&characterEncoding=UTF-8'
$env:SPRING_DATASOURCE_USERNAME='posstage'; $env:SPRING_DATASOURCE_PASSWORD='PosStage@123'
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.arguments=--server.port=8090"
# Frontend (PowerShell, trong thư mục frontend)
$env:VITE_POS_CHECKOUT='true'; $env:VITE_API_URL='http://localhost:8090'; npm run dev
```

**URL ứng dụng**: frontend staging **http://localhost:5174/** (vite tự nhảy vì 5173 bận) → đăng nhập `posdemo / Posdemo@123` → menu **Bán hàng tại quầy**. Backend staging: `http://localhost:8090/api/v1/...`.

## 3. Xác minh rủi ro tinyint(1) — ĐÃ ĐÓNG (bằng chứng, không suy diễn)

Test `PosStagingDataVerificationTest` (đọc RAW qua JdbcTemplate = chính driver 9.4.0 của app, URL **giống dev — không flag**) so với entity Hibernate: biến thể/sản phẩm/khách/người dùng/phân quyền (0/1), tồn kho decimal — **7/7 khớp**; và test quyết định `donBanHang_trangThai5_quaEntity`: SQL ghi `trang_thai=5` rồi đọc qua entity → **entity trả đúng 5** (không bị ép Boolean). Kết luận: **không cần đổi URL/entity nào** cho staging hay dev. (Hiện tượng Boolean chỉ xảy ra với connector cũ 8.0.33 trong raw JDBC của TEST — test đã đọc bằng `getInt`; không phải hành vi của app.)

## 4. File thay đổi trong phase này

**Trong repo (chỉ test — không đổi code production/main):**
- `backend/src/test/java/com/dev/backend/pos/PosStagingDataVerificationTest.java` (NEW — xác minh tinyint read-only + test quyết định trangThai=5).
- `backend/src/test/java/com/dev/backend/pos/PosStagingE2eTest.java` (NEW — E2E chống backend staging đang chạy).
- `backend/src/test/java/com/dev/backend/pos/PosStagingSetupTool.java` (NEW — tool tạo BCrypt hash cho tài khoản demo; **đã gỡ ở đợt cleanup sau — hash đã nằm trong `ProvisionStagingDb.java` ngoài repo**, xem 07-browser-verification.md).

**Ngoài repo (không vào git — chứa credential staging):**
- `C:\Users\admin\.fcentric-pos-staging\` — `mysql-data/` (DB), `ProvisionStagingDb.java` (import dump + migration + seed idempotent), `CreateStagingUser.java`, `start-staging.cmd`, `stop-staging.cmd`.

## 5. Kiểm thử đã thực chạy

| # | Kiểm thử | Kết quả |
|---|---|---|
| 1 | Backend staging khởi động đầy đủ (gate env ON, DB staging, port 8090) | PASS — `Started BackendApplication`; login API 200 |
| 2 | **API integration test chống backend staging đang chạy** (HTTP thật, token thật — **KHÔNG phải browser E2E**): `mvnw test -Dtest=PosStagingE2eTest` | **8/8 PASS**: thanh toán thành công + đối chiếu DB (1 đơn `don_ban_hang` trạng thái 5 `da_thanh_toan` + 1 phiếu xuất 3 lô 69 + tồn 3→2/khả dụng 4 + 1 nhật ký + phiếu thu doanh thu 120000 thừa 80000 + neo SUCCESS); thiếu tiền 400 không side effect; **giá cũ 409 priceChanged**; **click đúp cùng requestId → cùng 1 đơn, tồn chỉ giảm 1**; cùng key khác payload → 409; recovery chủ sở hữu thấy SUCCESS; **KHLE walk-in** tồn tại + bán được; **báo cáo doanh thu hôm nay** chứa đơn POS (doanh thu 120000, giá vốn 100000) |
| 3 | Unit suite POS (không DB) | 46/46 PASS |
| 4 | Xác minh tinyint(1) | 8/8 PASS (mục 3) |
| 5 | Frontend `npm run build` (đã chạy ở phase trước, không đổi gì phase này) + dev server khởi động | PASS — vite ready, `GET /` 200 tại **http://localhost:5174/** |

**Chú thích số tồn trong báo cáo này** (đã điều tra, không phải lỗi code):
- **"Tồn: 5"** (mục 6) = tồn CẤP SKU ngay sau khi fixture reset của test (lô 69/70/71 = 3/1/1). **"tồn 3→2/khả dụng 4"** (bảng trên) = mô tả CẤP LÔ (lô 69: 3→2 trong một kịch bản) + khả dụng cấp SKU sau khi bán 1. Hai số đo hai phạm vi khác nhau nên tưởng mâu thuẫn.
- Số tồn hiện hành thay đổi sau mỗi lần bán thật (kể cả các lần bán trong kiểm thử trình duyệt) — badge trên màn hình luôn bằng giá trị API = giá trị DB (đã xác minh). Trạng thái hiện hành và bằng chứng xem [07-browser-verification.md](07-browser-verification.md).
- **Cảnh báo**: `PosStagingE2eTest` có `@BeforeEach` XÓA toàn bộ dữ liệu giao dịch staging (đơn/phiếu/thu/nhật ký) để tạo fixture độc lập — chỉ chạy suite này khi chấp nhận reset dữ liệu giao dịch staging.

**NOT RUN (đánh dấu trung thực):**
- **Click chuột trên trình duyệt thật** — đã thực hiện bằng Edge headless + CDP ở báo cáo [07-browser-verification.md](07-browser-verification.md); phần còn NOT RUN chỉ là máy quét/máy in vật lý.
- **Máy quét mã vạch thật** — NOT RUN (không có thiết bị).
- **In hóa đơn qua máy in thật** — NOT RUN (không có máy in); route in `/sales-orders/{id}/invoice` đã xác minh đọc đơn đã lưu ở Phase 01.
- Kịch bản mất mạng giữa chừng trên trình duyệt — NOT RUN (đã có test rollback DB thật ở Phase 05 t11 + luồng recovery xác minh qua API).

## 6. Hướng dẫn người dùng thực hiện giao dịch thật trên trình duyệt

1. Chạy `C:\Users\admin\.fcentric-pos-staging\start-staging.cmd` (nếu chưa chạy).
2. Mở **http://localhost:5174/** → đăng nhập `posdemo` / `Posdemo@123`.
3. Sidebar → **Bán hàng tại quầy** (`/pos`). Chọn kho "Kho Hà Nội (KHO01)".
4. Catalog hiển thị **Áo Khoác Phối Lót Lông Giả Lông Cừu · [màu] · M** (SKU `AK2610051-CL005-1-MS-2691`, giá 120.000) — bấm thẻ để thêm vào giỏ. **Số Tồn hiển thị là tồn khả dụng thật của kho**: fixture gốc 5, giảm dần sau mỗi lần bán trong kiểm thử (trạng thái hiện hành xem 07-browser-verification.md mục 3).
5. Khách hàng mặc định là **Khách lẻ** (KHLE) hoặc chọn khách khác (F4).
6. Bấm **Thanh toán** (F9) → nhập **200000** → **Xác nhận thanh toán**.
7. Dialog receipt hiện **số hóa đơn chính thức** (SO…), tổng 120.000, tiền thừa 80.000 → **In hóa đơn** (mở tab mới `/sales-orders/{id}/invoice`) → **Hoàn tất**.
8. Đối chiếu: trang Đơn bán hàng thấy đơn trạng thái **Hoàn thành**, Đã thanh toán; Báo cáo tồn kho giảm còn 4; Lịch sử giao dịch kho có dòng xuất POS; báo cáo doanh thu hôm nay +120.000 (giá vốn 100.000).
9. Thử lỗi: nhập tiền thiếu → báo lỗi giữ giỏ; bấm đúp nhanh → không tạo đơn trùng; tắt mạng rồi bấm → dialog "Giao dịch chưa rõ kết quả" → **Kiểm tra kết quả**.

## 7. Tắt checkout khi xong

```
C:\Users\admin\.fcentric-pos-staging\stop-staging.cmd
```
hoặc chỉ cần **khởi động lại không kèm biến env**: gate backend về `false` (file config repo vốn đã false) và frontend không set `VITE_POS_CHECKOUT` → nút thanh toán khóa lại như cũ. **Không cần sửa bất kỳ file nào để tắt.**

## 8. Blocker / hạn chế còn lại

1. **Production tuyệt đối chưa bật** — cả 2 gate ở production vẫn OFF; chưa chạy migration trên DB thật nào; chưa xác minh dev DB.
2. Browser-click checks + máy quét + máy in NOT RUN (mục 5).
3. Báo cáo doanh thu cần quyền admin để xem (posdemo là nhân viên bán — đúng phân quyền); test dùng token admin ký bằng signer key để xác minh.
4. Dữ liệu staging là snapshot 05/10/2026 — chỉ 1 SKU có tồn; thêm SKU mới cần nhập kho thật qua luồng hiện hữu.
5. Không tuyên bố hết bug hay sẵn sàng production.
