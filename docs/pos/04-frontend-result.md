# Kết quả PHASE 04 — Frontend POS nối checkout CASH + recovery

Ngày: 06/10/2026 (Việt Nam). Nhánh `Khang`, HEAD `320c67f`. Không commit/push/reset. Tiền đề Phase 03 đã xác minh (backend checkout/recovery tồn tại, 97/97 test PASS, gate `pos.checkout-enabled=false`).

## 1. Tóm tắt

- Màn `/pos` giờ nối **thật** vào `POST /api/v1/pos/checkout` + `GET /api/v1/pos/checkout-requests/{requestId}` qua `apiClient` hiện có — **không có nhánh giả thành công**: checkout chỉ chạy khi `checkoutEnabled=true` (env `VITE_POS_CHECKOUT`, mặc định tắt) và luôn gọi `posService.checkout`; không có đường nào gọi chuỗi báo giá cũ (`/don-ban-hang/create|convert-to-order`).
- Vòng đời attempt đầy đủ: **requestId sinh 1 lần cho mỗi lần đóng băng payload**; pending/unknown **đóng băng draft** (chặn sửa giỏ/khách/ghi chú/đổi kho/đóng tab/đổi tab + phím tắt); timeout/mạng/5xx = **CHƯA RÕ** → hỏi recovery bằng đúng key; refresh giữ **chỉ requestId** trong sessionStorage để phục hồi, **không tự gửi lại** khi mount.
- Giá đổi → dialog xem lại giá + tổng mới, **không tự thu số tiền mới**; sau thất bại xác định, mọi sửa draft hủy attempt cũ → lần sau **key mới**. Chỉ khi server xác nhận SUCCESS mới refetch tồn, hiện receipt **dữ liệu server** (`soDonHang` chính thức — nhãn tab `HD…` vẫn tách riêng) và đóng **đúng tab đã gửi**. In dùng route `/sales-orders/{id}/invoice` của dự án; in lỗi chỉ thử lại in.

## 2. File thay đổi chính xác (frontend)

| File | Thay đổi |
|---|---|
| `frontend/src/services/posService.js` | +`checkout(payload)` (POST, `timeout: 30000`), +`getCheckoutRequest(requestId)`; +helpers sessionStorage **tối thiểu**: `getPendingCheckoutIds/addPendingCheckoutId/removePendingCheckoutId` (chỉ lưu requestId — không token, không dữ liệu khách); +`newCheckoutRequestId()` (crypto.randomUUID + fallback) |
| `frontend/src/pages/pos/PosSalesPage.jsx` | Viết lại vòng đời thanh toán: invoice thêm `attempt {requestId, status: pending\|unknown\|failed\|succeeded, payload, result, error}`; `beginAttempt` đóng băng payload; `submitCheckout` (validate khách/tiền trước, chặn click đúp); `handleCheckoutSuccess/Error` (409 price-change có cấu trúc; 4xx+503 xác định; còn lại = unknown); `recoverCurrentAttempt`/`retrySameAttempt` (cùng key + payload đã đóng băng); recovery khi mount từ sessionStorage; receipt/recovered dialog; khóa mọi thao tác draft khi frozen; phím tắt F2/F4/F9 không vượt guard |
| `frontend/src/pages/pos/components/PosDialogs.jsx` | Payment dialog attempt-aware (pending → bận; gate tắt → thông báo); +dialog `checkout-unknown` (Kiểm tra kết quả / Thử lại cùng mã), `price-change` (danh sách giá cũ→mới + tổng mới + xác nhận), `receipt` (số đơn chính thức + tiền thừa + In hóa đơn / Hoàn tất), `recovered-result` (phục hồi sau refresh); khóa ô nhập tiền khi frozen |
| `frontend/src/pages/pos/components/PosCartPanel.jsx` | +prop `frozen`: khóa nút số lượng/xóa/khách/ghi chú + banner amber "giao dịch đang được xử lý"; nút Thanh toán vẫn mở để kiểm tra kết quả |
| `frontend/src/pages/pos/index.jsx` | +gate `CHECKOUT_ENABLED = import.meta.env.VITE_POS_CHECKOUT === 'true'` truyền xuống PosSalesPage |

Không đổi: `App.jsx`, `sidebar.config.js`, `BackofficeLayout.jsx`, backend — phase này thuần frontend.

## 3. Vòng đời request/recovery (đã cài trong code)

```
Người bán bấm "Xác nhận thanh toán"
  ├─ validate khách + tiền >= tổng (client; server vẫn là chốt thật)
  ├─ attempt rỗng/failed -> beginAttempt: sinh requestId MỚI, đóng băng payload
  │    {requestId, khoId, khachHangId, items[bienTheSanPhamId,quantity,unitPriceClient],
  │     payment{CASH, tenderedAmount}, note}   (discount 0, shipping 0 — backend không nhận)
  │    + ghi requestId vào sessionStorage
  ├─ pending/unknown -> DRAFT BỊ KHÓA (sửa/đổi kho/đóng tab/đổi tab/phím tắt F2,F4,F9)
  └─ POST /pos/checkout (timeout 30s)
       ├─ 200 -> SUCCESS: refetch catalog (tồn mới), dialog receipt dữ liệu server,
       │        Hoàn tất -> đóng ĐÚNG tab đã gửi; các tab khác giữ nguyên
       ├─ 409 priceChanged -> cập nhật giá cart về giá server, dialog xem lại giá+tổng mới,
       │        xác nhận -> lần gửi sau dùng key MỚI (payload đã đổi giá)
       ├─ 4xx/503 -> XÁC ĐỊNH thất bại: giữ draft, hiện message; sửa draft -> attempt bị hủy
       └─ timeout/mạng/5xx -> UNKNOWN: dialog "Giao dịch chưa rõ kết quả"
              ├─ "Kiểm tra kết quả" -> GET /pos/checkout-requests/{requestId}
              │     SUCCESS -> luồng thành công | FAILED -> mở khóa + hiện lỗi
              │     404 -> vẫn chưa rõ (server đã rollback) — được phép thử lại
              └─ "Thử lại cùng mã" -> POST lại CHÍNH XÁC payload đã đóng băng (cùng key)

Refresh trang trong lúc pending/unknown:
  -> sessionStorage chỉ còn requestId; mount GỌI recovery (KHÔNG tự submit)
     SUCCESS -> dialog "Giao dịch đã hoàn tất" + in lại | FAILED -> bỏ metadata | 404 -> giữ lại
```

Quy tắc khóa key: **không bao giờ tái dùng requestId cho payload đã sửa** (attempt failed bị xóa khi draft đổi); **không bao giờ âm thầm sinh key mới khi kết quả chưa rõ** (unknown buộc qua recovery/retry cùng key).

## 4. Kiểm thử đã thực chạy

| # | Kiểm thử | Kết quả thật |
|---|---|---|
| 1 | `npm run build` (vite 7.3.1) | **PASS** (chỉ warning chunk-size baseline cũ) |
| 2 | ESLint các file POS thay đổi | **0 vấn đề** |
| 3 | ESLint toàn dự án | 28 problems — **không tăng** so với baseline hiện tại |
| 4 | `git diff --check` | Clean |
| 5 | Backend suite (nền Phase 03 — không đổi gì phase này) | 97/97 PASS (đã chạy ở Phase 03, không chạy lại) |
| 6 | Rà soát tĩnh từng luồng tương tác (success/API failure/validation/duplicate click/timeout-after-commit/recovery-after-refresh/same-key retry/changed price/tab isolation/print failure) | Đã rà từng nhánh code — xem mục 5 |

## 5. Kiểm thử CHƯA chạy (ghi nhãn trung thực)

- **Không có test runner frontend** (không vitest/playwright/cypress) → các kịch bản tương tác ở mục 4.6 chỉ được xác minh bằng rà soát mã nguồn + test backend tương ứng, **chưa chạy trên trình duyệt thật**. Cần môi trường: backend chạy (đã áp migration `pos_checkout_v1.sql`) + DB/MinIO + bật `VITE_POS_CHECKOUT=true` (build dev) + `pos.checkout-enabled=true` (server) để chạy e2e trước khi nghiệm thu.
- Chưa chạy: click đúp thật trên browser, mất mạng giữa chừng (DevTools offline), refresh giữa pending, quét mã vạch bằng máy quét thật, in qua trình duyệt thật, hành vi `sessionStorage` khi storage bị chặn.
- UI test **không** chứng minh được backend đồng thời (Phase 05 lo).

## 6. Hạn chế / blocker còn lại

1. **Gate kép đang tắt**: server `pos.checkout-enabled=false` + frontend `VITE_POS_CHECKOUT` chưa set — đúng yêu cầu "chưa bật POS production"; khi mở phải bật cả hai có chủ đích.
2. Migration `Database/pos_checkout_v1.sql` **chưa chạy trên DB nào** — chưa có môi trường tích hợp để chạy e2e.
3. Bản ghi khách lẻ `KHLE` chưa seed — POS hiển thị "Chưa chọn khách hàng" và checkout bắt chọn tường minh (đúng chính sách, cần quyết định kinh doanh trước pilot).
4. `sessionStorage` lưu requestId là metadata phục hồi tối thiểu; mở lại trang ở tab mới (session mới) sẽ không thấy giao dịch cũ — chấp nhận ở phase này (đối soát qua trang đơn bán/phiếu thu khi cần).
5. 5xx từ server được xử lý như UNKNOWN (hỏi recovery) — nếu backend sau này trả 500 xác định cho lỗi đã rollback, vòng lặp recovery vẫn tự hội tụ về 404→thử lại.
6. In hóa đơn mở tab mới (cùng phiên đăng nhập); nếu bị popup-block, người bán có nút bấm lại — không ảnh hưởng giao dịch.

## 7. Sẵn sàng Phase 05

Frontend đã nối đủ: checkout + recovery + price-change + freeze/retry + receipt server + in từ đơn đã lưu. Phase 05 cần: chạy migration trên DB thật (staging), bật 2 gate ở môi trường thử, chạy e2e + test đồng thời (POS-vs-xuất kho/nhập kho/kiểm kê, 2 quầy lô cuối) và đối chiếu đơn/tiền/tồn. **Dừng tại đây — chưa deploy, chưa bật bất kỳ gate nào.**
