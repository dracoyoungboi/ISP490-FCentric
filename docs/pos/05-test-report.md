# Báo cáo PHASE 05 — Kiểm thử tích hợp & đồng thời (CASH POS)

Ngày: 06/10/2026 (Việt Nam). Nhánh `Khang`, HEAD `320c67f`. Không commit/push/reset. **Không chạm DB dev/production** (đã bị chặn chủ động: production `171.244.142.43` không probe; dev `160.25.81.94` chỉ kiểm tra TCP — user `fcentric` không có quyền CREATE DATABASE nên không dùng được; local MySQL80 của máy không dùng vì không biết mật khẩu root).

## 1. Môi trường test (disposable)

- **MySQL dùng-một-lần**: instance mới tạo từ `mysqld.exe` đã cài sẵn của máy, chạy **127.0.0.1:3307**, datadir riêng trong `%TEMP%\pos-mysql\data`, `--initialize-insecure` (root/mật khẩu rỗng), `--default-time-zone=+00:00` (khớp `serverTimezone=UTC` của URL app). Không đụng service MySQL80 đang chạy, không đụng server nào. Đã tắt + xóa toàn bộ temp sau khi test xong.
- **Schema**: `fcentric_pos_test` ← import `Database/MyDB_v1.3.sql` (snapshot có dữ liệu) + `Database/pos_checkout_v1.sql` (migration Phase 03). Baseline xác nhận: biến thể 93 giá 120000 hoạt động; kho1 SKU93 khả dụng 5.000 (lô 69/70/71 = 3/1/1); 15 khách, 12 người dùng, bảng `pos_checkout_request`/`pos_payment` tồn tại.
- **App**: `@SpringBootTest(webEnvironment=RANDOM_PORT)` khởi động **backend đầy đủ** (AuthInterceptor + AuthorizationAspect + gate `pos.checkout-enabled=true` chỉ trong test), HTTP thật qua `TestRestTemplate` (kết nối độc lập), token JWT sinh bằng chính `JwtServiceImpl` của app, transaction/lock **MySQL thật** — không mock, không H2.

## 2. Lệnh đã chạy chính xác

```
# 1. Khởi tạo instance dùng-một-lần (PowerShell)
mysqld --no-defaults --initialize-insecure --datadir=%TEMP%\pos-mysql\data
mysqld --no-defaults --datadir=%TEMP%\pos-mysql\data --port=3307 --bind-address=127.0.0.1 --mysqlx=0 --default-time-zone=+00:00

# 2. Import snapshot + migration (tool JDBC ngoài repo, allowMultiQueries)
#    ProvisionPosTestDb.java: CREATE DATABASE fcentric_pos_test -> exec MyDB_v1.3.sql -> exec pos_checkout_v1.sql

# 3. Chạy suite tích hợp (18 test, real HTTP + real MySQL)
cd backend
mvnw test -Dtest=PosCheckoutIntegrationTest
# => Tests run: 18, Failures: 0, Errors: 0, Skipped: 0 — BUILD SUCCESS

# 4. Toàn bộ suite backend (unit + integration)
mvnw test
# => Tests run: 115, Failures: 0, Errors: 0 — BUILD SUCCESS

# 5. Frontend: npm run build PASS; eslint file POS = 0; full lint 28 (không tăng); git diff --check clean

# 6. Dọn dẹp: stop mysqld tạm (port 3307 đóng), xóa %TEMP%\pos-mysql + %TEMP%\pos-test
```

## 3. Kịch bản đã chạy và kết quả (18/18 PASS)

| # | Kịch bản | Xác nhận |
|---|---|---|
| t01 | Fixture: kho1 SKU93 giá 120000, khả dụng 5 (catalog + SQL) | PASS |
| t02 | Bán 1 thu 200000: **1 đơn** (loai `don_ban_hang`, trạng thái **5**, `da_thanh_toan`, `ngay_giao_hang` có), **1 phiếu xuất** (loai `ban_hang`, trạng thái 3), dòng pick đúng lô **69 (FIFO)**, tồn 3→2 / khả dụng **4**, **1 nhật ký** (trước 3/sau 2, loại `xuat_kho`), **1 phiếu thu** (doanh thu 120000, thu 200000, **thừa 80000**), neo SUCCESS | PASS |
| t03 | Mua 6 khi tồn 5 (đủ tiền): 400 "không đủ"; **0 đơn/0 phiếu/0 thu/0 nhật ký**; neo FAILED (lỗi xác định) | PASS |
| t04 | Thiếu tiền (100000): 400; không side effect | PASS |
| t05 | Giá cũ 100000: **409 có cấu trúc** `priceChanged` + giaMoi 120000; không ghi gì | PASS |
| t06 | Trùng requestId + cùng payload (gửi 2 lần): cả 2 trả **cùng donBanHangId**; 1 đơn, 1 phiếu thu, tồn chỉ giảm 1 | PASS |
| t07 | Trùng requestId + khác payload: **409**, không tạo đơn thứ hai | PASS |
| t08 | Recovery: chủ sở hữu OK; admin OK; **thu ngân khác (kho 2) bị chặn**; id lạ 404 | PASS |
| t09 | **Hai thu ngân mua chiếc cuối ĐỒNG THỜI** (2 kết nối HTTP, CountDownLatch): **đúng 1 thành công**; 1 đơn/1 thu; tồn 0; không âm kho | PASS |
| t10 | **POS vs luồng xuất kho legacy ĐỒNG THỜI** (POS qua HTTP; `PhieuXuatKhoService.complete` thật ở thread riêng, cùng lô cuối): **đúng 1 bên thắng**, không âm kho — khóa PESSIMISTIC theo PK hoạt động | PASS |
| t11 | **Rollback giữa chừng** (trigger MySQL SIGNAL trên `lich_su_giao_dich_kho`): 500; **0 đơn/0 phiếu/0 thu/0 neo/0 nhật ký**; tồn không đổi | PASS |
| t12 | Nhiều lô + đặt hàng: ton69=3/dat2, ton70=1 → bán 2: phân bổ lô 69:1 + lô 70:1 (FIFO), tồn 2/0, dat giữ nguyên, 2 dòng nhật ký | PASS |
| t13 | Biến thể 94 ngừng bán → 400 "hoạt động" | PASS |
| t14 | Sản phẩm cha ngừng bán → 400; restore | PASS |
| t15 | Kho không phân quyền (thu ngân kho 2 bán kho 1) → 400 | PASS |
| t16 | Báo cáo doanh thu ngày (kho1) **chứa đơn POS**: doanh thu **120000**, giá vốn **100000** (đã sửa filter `IN (3,5)` + `pxk=3` + ngày `>=/< DATE_ADD`) | PASS |
| t17 | Chi tiết đơn POS qua `GET /don-ban-hang/{id}/detail`: trạng thái **5**, `da_thanh_toan` | PASS |
| t18 | Hồi quy legacy: tạo trực tiếp `don_ban_hang` **vẫn bị chặn** (500 kèm message — hành vi cũ giữ nguyên); báo giá tạo được; convert-to-order chạy được | PASS |

**Không có test nào chứng minh bằng mock** — tất cả assertion đều đếm/tính trên DB thật sau mỗi kịch bản.

## 4. Bug THẬT phát hiện bởi test — đã sửa (scoped)

| # | Bug | Bằng chứng | Fix | Regression test |
|---|---|---|---|---|
| B1 | **`pos_checkout_request.ngay_cap_nhat`/`pos_payment.ngay_tao` bị Hibernate ghi NULL** → mọi checkout fail 409 "Column 'ngay_cap_nhat' cannot be null" (entity thiếu `@Generated(INSERT)` như convention `DonBanHang`) | t02 fail lần đầu | Thêm `@Generated(event=INSERT)` + import `org.hibernate.annotations.Generated`/`org.hibernate.generator.EventType` vào 2 entity | t02…t18 toàn bộ |
| B2 | **`DonBanHang.trangThaiThanhToan` có `@Generated(INSERT)`** → Hibernate bỏ giá trị app ghi, cột luôn nhận default `chua_thanh_toan` — **đơn không bao giờ thành đã thanh toán** (kể cả luồng cũ, đúng với phát hiện Phase 01 "backend chưa từng gán da_thanh_toan") | t17: detail trả `chua_thanh_toan` dù checkout set `da_thanh_toan` | Bỏ `@Generated` khỏi field (app ghi tường minh ở mọi nơi: create → `chua_thanh_toan`, POS → `da_thanh_toan`; DB default chỉ dự phòng cho SQL thô) | t02 + t17 assert `da_thanh_toan` |
| B3 | **Báo cáo ngày lọc `ngay_giao_hang BETWEEN :tuNgay AND :denNgay`** — DATE bị ép thành nửa đêm nên mọi mốc giờ trong ngày bị loại (báo cáo theo ngày luôn rỗng) | t16: report trả `[]` dù đơn có `ngay_giao_hang` hôm nay | Đổi thành `>= :tuNgay AND < DATE_ADD(:denNgay, INTERVAL 1 DAY)` (DoanhThu ngày + KhachHang ngày); đồng thời sửa nốt 2 filter `= 3` còn sót trong `soSanhCungKy` (12-space indent) → `IN (3, 5)` | t16 |

## 5. Quan sát rủi ro (chưa sửa — cần xác minh riêng, KHÔNG suy diễn)

- **tinyint(1) qua MySQL connector**: với connector 8.0.33 mặc định (`tinyInt1isBit=true`), cột `tinyint(1)` được đọc qua `getObject` thành `Boolean`. Trong môi trường test, Hibernate (connector 9.4.0 của app) đọc entity `trangThai` (Integer) **không tin cậy** cho tới khi URL test thêm `tinyInt1isBit=false` và instance đặt `--default-time-zone=+00:00`. Sau khi chuẩn hóa, mọi check Java-side đọc đúng 0/1. **Cần xác minh trên DB dev thật (connector 9.4.0, URL hiện không có flag) rằng các check `trangThai` Java-side của luồng cũ vẫn đọc đúng** — đây là rủi ro nền tảng có sẵn, không phải code POS; không tự đổi URL/entity toàn hệ trong phase này.
- `recalculatePriceAndStatus` (legacy) có thể đổi trạng thái sản phẩm/biến thể theo tồn — suite test đã thêm restore baseline để deterministic; hành vi này là nghiệp vụ cũ, giữ nguyên.
- `pos.checkout-enabled` vẫn **false** trong `application.properties` (production config không đổi); test chỉ bật qua DynamicPropertySource.

## 6. CHƯA CHẠY — ghi nhãn trung thực

- **Frontend e2e trên trình duyệt thật**: không có test runner UI (không vitest/playwright) → các kịch bản UI (per-tab isolation, barcode máy quét thật, refresh giữa pending, in qua trình duyệt, click đúp chuột thật) **NOT RUN**; chỉ có build + lint + rà soát tĩnh (Phase 04) + backend tests tương ứng.
- **Xác minh hành vi tinyint(1) + report trên DB dev thật** (chỉ đọc) — chưa được phép/không có quyền tạo fixture trên dev; production tuyệt đối không đụng.
- Test đồng thời giữa POS với **phiếu nhập/kiểm kê/chuyển kho** (đã thêm khóa PK ở Phase 03 nhưng chưa chạy kịch bản đua trực tiếp từng luồng — chỉ đua với `PhieuXuatKhoService.complete` ở t10).
- Verify live route không có demo data: đã grep lại (0 tham chiếu `POS_PRODUCTS/FakeQr/NAM001/assets`) + build; render thật chưa chạy.

## 7. KẾT LUẬN GO/NO-GO

**NO-GO cho production / mở quầy bán thật** — lý do:
1. Chưa có e2e trình duyệt (máy quét, in, refresh) trên môi trường staging có DB đã chạy migration.
2. Chưa xác minh rủi ro tinyint(1) trên DB dev thật (mục 5).
3. Cả 2 gate vẫn tắt (đúng yêu cầu — chưa bật gì).
4. Khách lẻ `KHLE` chưa seed (quyết định kinh doanh).

**GO cho staging/pilot nội bộ khi**: chạy `pos_checkout_v1.sql` trên bản sao dump (đúng quy trình 00-START-HERE), bật 2 gate ở môi trường thử, chạy e2e 10 kịch bản UI (Phase 04 mục 4.6), xác minh tinyint trên dev, sau đó đối chiếu đơn/tiền/tồn 1 ngày trước khi mở rộng. Backend + frontend đã có bằng chứng tích hợp mạnh (115 test, trong đó 18 test HTTP thật trên MySQL thật với lock/transaction/idempotency/rollback thật).

*Không tuyên bố "không còn bug nào" — kiểm thử chỉ bao phủ các kịch bản đã liệt kê.*
