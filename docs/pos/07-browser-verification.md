# Báo cáo PHASE 06-B — Xác minh trình duyệt, in hóa đơn, chênh lệch tồn, cleanup & đường tắt checkout-OFF

Ngày: 06/10/2026 (Việt Nam). Nhánh `Khang`, HEAD `320c67f`. Không commit/push/reset; **không đụng production** (không probe 171.244.142.43; không sửa production config). Đây là đợt kiểm thử bổ sung sau [06-staging-report.md](06-staging-report.md) theo yêu cầu: xác minh luồng trình duyệt THẬT, in, điều tra chênh lệch số tồn trong báo cáo 06, audit cleanup và kiểm chứng đường khởi động checkout-OFF.

## 1. Tóm tắt kết quả

| Hạng mục | Kết quả |
|---|---|
| Browser E2E thật (Edge headless + CDP, click DOM thật) | **PASS toàn bộ kịch bản** (B0–B8, mục 4) — thanh toán tiền mặt, thiếu tiền, click đúp, đổi tab hóa đơn, mất mạng→recovery→retry cùng key, reload→phục hồi SUCCESS, receipt, in |
| Đối chiếu DB sau từng bước | PASS — đơn 5/`da_thanh_toan`, phiếu xuất 3, phiếu thu, nhật ký, tồn khớp từng bước |
| Chênh lệch "Tồn: 5" vs "3→2" trong báo cáo 06 | **Không phải lỗi code** — hai phạm vi đo khác nhau + số ví dụ cũ (mục 3); đã sửa văn bản báo cáo 06 |
| In hóa đơn | Trang invoice render đúng đơn qua 2 đường (route trực tiếp + nút "In hóa đơn" thật); **máy in vật lý NOT RUN** |
| Đường tắt checkout-OFF | **Đã kiểm chứng cả 2 gate tắt hiệu dụng** sau khởi động lại không kèm env, rồi khôi phục trạng thái ON (mục 7) |
| Cleanup | Đã gỡ 2 tệp tạm + dọn profile trình duyệt; giữ nguyên regression tests/fixture/migration/docs/script staging (mục 8) |
| Máy quét mã vạch thật | NOT RUN (không có thiết bị) |

## 2. Môi trường khi chạy

- MySQL staging 127.0.0.1:3307 (datadir `C:\Users\admin\.fcentric-pos-staging\mysql-data`, UTC) — **không đụng MySQL80**.
- Backend staging http://localhost:8090 — `POS_CHECKOUT_ENABLED=true`, DB staging qua env, **`SPRING_DEVTOOLS_RESTART_ENABLED=false`** (mới thêm — tránh devtools tự restart giữa chừng khi file đổi, xem mục 9).
- Frontend vite http://localhost:5174/ — `VITE_POS_CHECKOUT=true`, `VITE_API_URL=http://localhost:8090`.
- Trình duyệt: **Microsoft Edge 154 headless** điều khiển qua CDP bằng script Node 22 thuần (WebSocket/fetch nội tại — **không cài playwright/cypress/puppeteer**). Script tái sử dụng: `C:\Users\admin\.fcentric-pos-staging\browser\pos-browser-e2e.mjs` (chế độ: mặc định = đủ kịch bản; `--off-check` = kiểm gate frontend tắt; `--on-check` = kiểm gate bật).
- Chạy: `cd C:\Users\admin\.fcentric-pos-staging\browser && node pos-browser-e2e.mjs` (log chuẩn `run-log-9.txt`, log off/on gate `run-log-off.txt`/`run-log-on.txt`, ảnh chụp `shots\*.png`).

## 3. Điều tra chênh lệch "Tồn: 5" vs "tồn 3→2/khả dụng 4" trong báo cáo 06 — KHÔNG phải lỗi code

Báo cáo 06 viết: mục 5 dòng 2 "tồn 3→2/khả dụng 4"; mục 6 bước 4 "Tồn: 5". Điều tra:

- **"Tồn: 5"** = tồn khả dụng **cấp SKU** (SUM ton−dat của các lô) ngay sau khi fixture test reset tồn — lô 69/70/71 = 3/1/1.
- **"tồn 3→2"** = số lượng **cấp LÔ 69** trong một kịch bản test (bán 1 chiếc FIFO từ lô 69); **"khả dụng 4"** = cấp SKU sau kịch bản đó. Hai số đo hai phạm vi khác nhau nên đọc tưởng mâu thuẫn.
- **Số ví dụ "Tồn: 5" ở mục 6 đã cũ** so với thời điểm người dùng làm theo: trước đó suite API integration đã bán 1 và người dùng đã bán 1 (đơn SO202610062, requestId UUID `9d7ffe27…` — bằng chứng bán qua giao diện thật), nên badge thực tế là **3**.

**Bằng chứng đồng bộ 3 nguồn (browser badge = API = DB) qua 3 thời điểm** (đo bằng chính browser suite):

| Thời điểm | Browser badge (DOM thật) | API `GET /pos/catalog` (soLuongKhaDung) | DB `SUM(ton−dat)` |
|---|---|---|---|
| Trước browser test (sau 2 lần bán trước đó) | `Tồn: 3` | 3 | 3 |
| Sau B2 (bán 1) | `Tồn: 2` | 2 | 2 |
| Sau B6 (bán 1) | `Tồn: 1` | 1 | 1 |

Kết luận: **không có lỗi hiển thị/hạch toán** — chỉ sửa văn bản báo cáo 06 (đã sửa: chú thích mục 5 + mục 6).

## 4. Kết quả Browser E2E thật (Edge headless qua CDP)

Script bấm DOM thật (click nút, gõ input bằng native setter + sự kiện `input`, phím tắt F9/Escape), chặn request bằng CDP Fetch để mô phỏng mất mạng, reload thật. Đối chiếu DB qua mysql CLI sau mỗi bước. **Đây là kiểm thử trình duyệt (browser E2E) — khác với PosStagingE2eTest ở tầng HTTP (đã nhãn lại là API integration test, xem mục 6).**

| # | Kịch bản | Kết quả |
|---|---|---|
| B0 | Đăng nhập `posdemo` qua form thật → vào /dashboard | PASS |
| B1 | Vào /pos: badge tồn trên card = API = DB (3 nguồn khớp) | PASS |
| B2 | Thanh toán tiền mặt: thêm SKU → F9 → nhập 200000 → **click đúp** nút "Xác nhận thanh toán" → receipt hiện SO… + "Khách đưa 200,000 ₫ · Tiền thừa 80,000 ₫" | PASS — **đúng 1 đơn** (đơn 89 `SO202610063`, 5/`da_thanh_toan`), 1 phiếu thu 120000/200000/80000, lô 69 1→0, +1 nhật ký, neo SUCCESS, khách KHLE (26) |
| B2-in | Trang in hóa đơn `/sales-orders/89/invoice` render đúng: "MÃ HÓA ĐƠN SO202610063", "TRẠNG THÁI Hoàn thành", "THANH TOÁN Đã thanh toán", dòng sản phẩm "Áo Khoác Phối Lót Lông Giả Lông Cừu / Đen · 1 · 120.000 đ · 120.000 đ", TỔNG CỘNG 120.000 đ, người mua "Khách lẻ", người lập "Thu ngân Demo" (mẫu in không có cột SKU — hiển thị tên sản phẩm; đúng thiết kế mẫu) | PASS |
| B5 | Đổi tab hóa đơn: tab 2 mở rỗng; tab 1 giữ giỏ 1 món; đóng tab chưa đụng | PASS — giỏ từng tab độc lập |
| B6 | **Mất mạng giữa giao dịch**: chặn request checkout (CDP Fetch fail) → dialog "Giao dịch chưa rõ kết quả", draft **đóng băng** (tab/kho/giỏ khóa — kiểm tra attribute `disabled`); "Kiểm tra kết quả" → 404 → toast cho phép thử lại cùng mã; **"Thử lại với cùng mã giao dịch"** → SUCCESS | PASS — retry dùng **đúng requestId** đã đóng băng (khớp DB), đúng 1 đơn **SO202610064**, FIFO lô 70→0, metadata pending được dọn |
| B6-in | Nút **"In hóa đơn" thật** trong dialog receipt mở tab invoice đúng đơn | PASS |
| B3 | Thiếu tiền (50000 < 120000): báo lỗi "Số tiền khách thanh toán chưa đủ.", nút xác nhận khóa, đóng dialog giữ giỏ | PASS — DB không đổi |
| B7 | **Reload trang**: bơm requestId của đơn B2 vào `sessionStorage` (mô phỏng server đã lưu nhưng response mất) → reload → mount tự hỏi recovery (KHÔNG tự submit) → dialog "Giao dịch đã hoàn tất" hiện đúng SO202610063; metadata dọn sạch | PASS |
| B8 | Đối chiếu cuối: đơn 4, phiếu xuất 4, phiếu thu 4, nhật ký 4, khả dụng 1 (lô 71), neo 5 (4 SUCCESS + 1 FAILED từ probe gate — xem mục 9) | PASS |

Ảnh chụp minh chứng: `C:\Users\admin\.fcentric-pos-staging\browser\shots\` (b1-catalog-sau-ban, b2-invoice-don89, b5-invoice-tabs, b6-unknown-dialog, b6-retry-success-receipt, b6-invoice-page, b7-recovered-after-reload, on/off-frontend-gate…).

**Nhật ký kho (chuỗi bằng chứng lô 69 qua 3 lần bán liên tiếp):**
```
loai=xuat_kho  lô69  3.000 -> 2.000  (bán API integration test — Phase 06)
loai=xuat_kho  lô69  2.000 -> 1.000  (bán qua trình duyệt của người dùng — SO202610062)
loai=xuat_kho  lô69  1.000 -> 0.000  (B2 browser test — SO202610063)   giá vốn 100000
```

## 5. In hóa đơn — đã xác minh phần dữ liệu; máy in vật lý NOT RUN

- Nút "In hóa đơn" mở route hiện hữu `/sales-orders/{id}/invoice` (trang `DonBanHangInvoice` dùng `GET /api/v1/don-ban-hang/{id}/detail` + adapter in). Đã xác minh qua trình duyệt (B2-in qua route trực tiếp, B6-in qua nút thật trong dialog receipt): trang invoice render đầy đủ mã đơn, ngày lập, trạng thái Hoàn thành, trạng thái thanh toán "Đã thanh toán", bảng dòng hàng (tên SP/SL/đơn giá/thành tiền), tổng tiền hàng/phí vận chuyển/tổng cộng, người mua "Khách lẻ", người lập "Thu ngân Demo" — khớp dữ liệu đơn đã lưu. (Mẫu in không có cột SKU — đúng thiết kế mẫu hiện hành, không phải lỗi.)
- **Máy in vật lý: NOT RUN** (không có máy in) — hộp thoại in của trình duyệt không thể xác minh headless. In lỗi chỉ cần in lại từ đơn đã lưu (không chạy lại checkout — hành vi code đã rà soát Phase 04).
- **Máy quét mã vạch: NOT RUN** (không có thiết bị); lookup barcode server-side đã có test API (Phase 02/04).

## 6. Nhãn lại kiểm thử HTTP — API integration, không phải browser E2E

- `PosStagingE2eTest` (Phase 06) gọi HTTP thật tới backend staging — **đã nhãn lại trong báo cáo 06 là "API integration test"**, không phải browser E2E.
- **Cảnh báo khi chạy lại**: suite này có `@BeforeEach` XÓA toàn bộ dữ liệu giao dịch staging (đơn/phiếu/thu/nhật ký/neo) và reset tồn để tạo fixture — chỉ chạy khi chấp nhận reset dữ liệu giao dịch staging. Đợt này **không chạy lại** để giữ nguyên các đơn đã bán làm bằng chứng.

## 7. Đường tắt checkout-OFF — đã kiểm chứng hiệu dụng cả 2 gate, rồi khôi phục ON

Quy trình đã thực hiện (env-only, không sửa file repo nào):

1. Tắt backend/frontend staging đang chạy (gate ON).
2. Khởi động lại **không kèm env gate** (backend: không `POS_CHECKOUT_ENABLED`, vẫn DB staging, port 8090; frontend: không `VITE_POS_CHECKOUT`, `VITE_API_URL=http://localhost:8090`).
3. Xác minh gate BACKEND tắt: đăng nhập thật → `POST /api/v1/pos/checkout` (payload hợp lệ, đủ tiền) → **503 + message "Chức năng thanh toán POS chưa được kích hoạt trên hệ thống"**; `pos_checkout_request` giữ nguyên 5 dòng, `don_ban_hang` giữ nguyên 4 (gate nằm ở controller, trước service — không tạo neo/đơn).
4. Xác minh gate FRONTEND tắt — 2 tầng:
   - Module đã serve: env object vite inject khi OFF = `{"BASE_URL": "/", "DEV": true, "MODE": "development", "PROD": false, "SSR": false, "VITE_API_URL": "http://localhost:8090"}` — **không có** `VITE_POS_CHECKOUT` → `CHECKOUT_ENABLED = false` (khi ON = cùng object + `"VITE_POS_CHECKOUT": "true"`).
   - Trình duyệt thật (script `--off-check`): mở dialog thanh toán → hiện thông báo **"Chức năng thanh toán chưa được kích hoạt."**, nút xác nhận thành **"Thanh toán chưa kích hoạt" và bị khóa** (`disabled=true`), DB không đổi (ảnh `off-frontend-gate-locked.png`).
5. **Khôi phục trạng thái staging ON** (khởi động lại có env gate như mục 2): module lại có `"VITE_POS_CHECKOUT": "true"`; script `--on-check` trên trình duyệt: nút "Xác nhận thanh toán" **khả dụng** (không có thông báo khóa); backend login/catalog 200 (ảnh `on-frontend-gate-open.png`).

→ Đúng như mục 7 báo cáo 06: **tắt checkout chỉ cần khởi động lại không kèm env — không cần sửa file nào**. Production vẫn OFF tuyệt đối (application.properties false, production config không đổi).

## 8. Cleanup audit

**Đã xóa** (tệp tạm rõ ràng, không được service/code tham chiếu):
- `frontend/preview.log` — log cũ của `vite preview` (05/10), đã gitignore, không phải log của dev server đang chạy.
- Các thư mục profile Edge headless `profile-*` trong `C:\Users\admin\.fcentric-pos-staging\browser\` (sinh mỗi lần chạy).
- Các log của lần chạy browser suite bị lỗi giữa chừng (giữ `run-log-9.txt`, `run-log-off.txt`, `run-log-on.txt` + ảnh chụp làm bằng chứng).

**Đã cân nhắc rồi giữ lại**: `backend/src/test/java/com/dev/backend/pos/PosStagingSetupTool.java` (tool dùng-một-lần in BCrypt hash) — ban đầu đã gỡ, nhưng người dùng đang stage toàn bộ file POS qua GitHub Desktop nên file được khôi phục từ index (`git restore --worktree`) để tôn trọng thao tác của người dùng; nếu muốn bỏ hẳn, người dùng tự quyết khi commit.

**Giữ nguyên** (theo yêu cầu): toàn bộ regression test + fixture (`PosCheckoutIntegrationTest`, `PosStagingDataVerificationTest`, `PosStagingE2eTest`, unit suites), migration `Database/pos_checkout_v1.sql`, docs POS, script staging dùng lại được (`start-staging.cmd`, `stop-staging.cmd`, `ProvisionStagingDb.java`, `CreateStagingUser.java`, `pos-browser-e2e.mjs` + ảnh chụp + log).

**An toàn git**: toàn bộ thư mục staging (MySQL datadir, credential, script seed) nằm NGOÀI repo (`C:\Users\admin\.fcentric-pos-staging\`); `git grep` xác nhận **không có credential staging (`PosStage@123`, `Posdemo@123`, `posstage`) trong bất kỳ tệp nào được git track** (chúng chỉ nằm trong tệp untracked `PosStagingE2eTest.java` + báo cáo docs — cần cẩn trọng nếu sau này commit: nên chuyển sang env trước khi đưa vào git). Không có tệp DB (`.ibd`/datadir) nào trong repo; `.gitignore` đã phủ `target/`, `node_modules`, `dist`, `*.log`.

## 9. Sự cố vận hành trong đợt này (đã xử lý, ghi lại để tránh lặp)

1. **GitHub Desktop stash giữa chừng**: toàn bộ thay đổi POS bị đưa vào `stash@{0}` (dấu `!!GitHub_Desktop<Khang>`) ngay giữa lần chạy browser test — frontend mất source, test chết ở mở /pos. Đã hỏi người dùng và được duyệt `git stash pop` — khôi phục đủ 124 tệp. **Bài học**: trước khi chạy suite, xác nhận working tree còn đủ file POS.
2. **Spring devtools tự restart backend** khi file trở lại sau stash-pop — đúng lúc test bấm Đăng nhập (rơi vào cửa sổ 5s downtime). Đã khởi động lại backend staging với `SPRING_DEVTOOLS_RESTART_ENABLED=false` (env-only) — backend staging giờ không tự restart nữa.
3. **Cú pháp redirect nhầm giữa PowerShell và Bash**: `npm run dev *> log` (PowerShell) dán vào Bash bị glob-expand thành `vite Dockerfile README.md …` → serve sai root (404). Đã khởi động lại đúng cú pháp. **Bài học**: đừng dùng `*>` trong Bash.
4. **Probe gate bằng checkout rỗng tạo dòng FAILED**: 2 probe validation của đợt này để lại 1 dòng `pos_checkout_request` FAILED (dòng probe thứ nhất đã xóa trước khi quy tắc "không xóa bản ghi DB" được áp dụng; dòng `probe2` còn lại theo đúng quy tắc — FAILED, không đơn/không tiền, vô hại). **Bài học**: probe gate ON chỉ cần kiểm 503/400 ở response; nếu cần tránh ghi dòng neo, dùng chính kịch bản browser thay vì probe.
5. **Tên thu ngân seed bị mojibake** (`Thu ng??n Demo` — tool seed Phase 06 ghi nhầm encoding khi tạo `posdemo`): trang invoice lộ rõ lỗi dữ liệu staging. Đã sửa bản ghi bằng `UPDATE` (không xóa): `ho_ten = 'Thu ngân Demo'` qua UNHEX. Không phải lỗi code — chỉ lỗi dữ liệu seed staging.

## 10. Blocker còn lại trước pilot production giới hạn

1. **Production chưa chạy migration** `pos_checkout_v1.sql` trên DB thật nào — cần làm trên bản sao dump theo quy trình 00-START-HERE trước, có backup.
2. **Quyết định kinh doanh chưa chốt**: seed khách lẻ `KHLE` trên DB thật (đang chỉ có ở staging), chọn tài khoản thu ngân thật + phân quyền kho.
3. **Xác minh trên DB dev thật** (chỉ đọc) trước khi bật: dữ liệu SKU/khách/kho thật, hiệu năng catalog.
4. **Chưa có máy in/máy quét vật lý** để nghiệm thu phần cứng (NOT RUN — không chặn phần mềm).
5. Cả 2 gate production vẫn tắt — bật chỉ bằng env/config tại môi trường pilot, không đổi mặc định repo.

## 11. Checklist thủ công còn lại (cho người dùng, nếu muốn tự bấm)

Mọi mục dưới đây **đã được xác minh tự động bằng trình duyệt headless**; checklist để người dùng cảm nhận trực tiếp trên màn hình thật (http://localhost:5174/, `posdemo/Posdemo@123`):

- [ ] Mở /pos → catalog hiện SKU `AK2610051…`, badge Tồn bằng số khả dụng thật (hiện tại 1).
- [ ] Thêm món → F9 → nhập tiền đủ → Xác nhận → receipt hiện SO… + tiền thừa; bấm "In hóa đơn" → tab invoice hiện đơn → **Ctrl+P ra máy in thật** (nếu có máy in).
- [ ] Thử nhập tiền thiếu → báo lỗi, giỏ giữ nguyên.
- [ ] Bấm đúp nút xác nhận → chỉ 1 đơn.
- [ ] Mở 2 tab hóa đơn, mỗi tab giỏ riêng.
- [ ] Tắt mạng (hoặc dừng backend) rồi bấm thanh toán → dialog "chưa rõ kết quả" → bật lại → Kiểm tra kết quả → Thử lại cùng mã → 1 đơn duy nhất.
- [ ] Reload giữa giao dịch treo → hệ thống không tự gửi lại; nếu đơn đã lưu sẽ hiện "Giao dịch đã hoàn tất".
- [ ] Đối chiếu: Đơn bán hàng (Hoàn thành/Đã thanh toán), Lịch sử giao dịch kho (xuat_kho lô 71), Báo cáo tồn kho, Báo cáo doanh thu hôm nay.

*Không tuyên bố hết bug hay sẵn sàng production — kết luận GO/NO-GO vẫn theo mục 7 báo cáo 05.*
