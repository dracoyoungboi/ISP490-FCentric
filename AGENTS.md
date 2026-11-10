# Quy ước cho AI và người viết code — FCentric

Tệp này dành cho mọi trợ lý AI (Claude Code, Codex, Cursor, Copilot, Gemini…) và cho người viết code trong repo.
Đọc hết trước khi sửa giao diện hoặc câu thông báo của máy chủ.

## Đa ngôn ngữ (tiếng Việt + tiếng Anh)

Ứng dụng chạy hai ngôn ngữ. **Tiếng Việt là ngôn ngữ gốc**, tiếng Anh là bản dịch. Mọi chữ người dùng nhìn thấy
phải đổi được sang tiếng Anh. Thêm hay sửa một câu mà không làm đủ các bước dưới đây là **chưa xong việc**.

### Frontend (`frontend/`)

**1. Khóa dịch chính là câu tiếng Việt.** Không đặt mã khóa kiểu `common.save`.

```jsx
import { t } from "@/i18n";

<Button>{t("Lưu thay đổi")}</Button>
toast.success(t("Đã xóa {{ten}}", { ten: sanPham.ten }));
```

**2. Mọi chữ hiện ra giao diện đều đi qua `t()`**, gồm: chữ trong JSX, `title`, `placeholder`, `aria-label`, `label`,
`description`, câu lỗi kiểm ô (cả câu thứ hai của yup `.test(ten, cau, ham)`), `toast`, giá trị mặc định của
`getApiErrorMessage(error, t("…"))`, nhãn nút truyền qua props.

**3. Có tham số thì dùng `{{ten}}`, không ghép chuỗi.**

```jsx
// Sai: không dịch được, thứ tự từ tiếng Anh khác tiếng Việt
`Đã liên kết Shop ID ${id}`
"Kho " + ten
// Đúng
t("Đã liên kết gian hàng Shopee (Shop ID: {{id}}).", { id })
t("Kho {{ten}}", { ten })
```

Số nhiều tiếng Anh: truyền `{ count }` và khai báo `"<câu>_one"` / `"<câu>_other"` trong tệp tiếng Anh.

**4. Thêm bản dịch tiếng Anh NGAY trong cùng thay đổi**, vào `frontend/src/i18n/en/<module>.json`
(chọn tệp đúng module: `kenh-ban.json`, `ban-hang.json`, `kho-nhap-kho.json`, `chung.json`…).
Tệp là object phẳng `"câu tiếng Việt": "English sentence"`. Trước khi thêm, tìm xem khóa đã có ở tệp khác chưa;
một khóa chỉ được có **một** bản dịch trong toàn bộ `en/`.

**5. Câu chia nhỏ để in đậm một phần:** dịch từng mảnh một cách tự nhiên, hoặc viết lại câu cho khỏi phải in đậm
giữa câu. Không bọc cả đoạn JSX có thẻ con vào một khóa.

```jsx
<li><strong>{t("Đẩy tồn theo lô:")}</strong> {t("mọi biến thể của một sản phẩm gửi trong một lần.")}</li>
```

**6. Những chỗ GIỮ tiếng Việt, không bọc `t()`:**
- Giá trị lưu vào cơ sở dữ liệu, gửi lên máy chủ, dùng làm khóa tra cứu hay so sánh
  (tên mặc định như `"Khách Shopee"`, `"Gian Hàng Shopee FCentric"`, mã trạng thái…).
- Mẫu in chứng từ (`components/print/`), tệp Excel xuất ra, nội dung email.
- `constants/`: khai báo nhãn bằng tiếng Việt ở đó, **dịch lúc hiện ra**: `t(TRANG_THAI[x].label)`.
  Nhãn trong `constants/` vẫn phải có bản dịch trong `en/`.
- Đánh dấu chỗ cố ý giữ tiếng Việt bằng chú thích `// i18n-giu-nguyen: <lý do>` trên dòng đó hoặc dòng ngay trên;
  cả tệp thì `/* i18n-giu-nguyen-ca-tep: <lý do> */` ở đầu tệp.

**7. Giá trị lấy từ máy chủ** (tên kênh, tên kho, tên khách… máy chủ tự đặt): dùng `tDuLieu(giaTri)`, không dùng `t()`.
`tDuLieu` chỉ dịch khi đúng một câu cố định có bản dịch, còn lại trả nguyên văn.
Nhãn tùy chọn có thể là phần tử React: dùng `tNeuChuoi(nhan)`.

**8. Số và tiền giữ kiểu Việt Nam** (`1.500.000 ₫`) ở cả hai ngôn ngữ. Tên tháng, thứ dùng `localeHienThi()`.

**9. Đổi ngôn ngữ = lưu lựa chọn rồi tải lại trang**, nên gọi `t()` ở hằng số cấp module vẫn đúng.

### Backend (`backend/`)

- Câu trả về người dùng (thông báo thành công, lỗi nghiệp vụ) lấy theo khóa từ
  `backend/src/main/resources/i18n/thong-diep/<nhom>.properties` (tiếng Việt) và **`<nhom>_en.properties`
  (tiếng Anh) — thêm cả hai tệp cùng lúc**.
- Ném lỗi bằng `new LoiChungException(ThongDiep.of("nhom.khoa", thamSo...))` (hoặc `LoiThamSoException`,
  `LoiTrangThaiException`, `TuChoiTruyCapException`), **không** `new RuntimeException("câu tiếng Việt")`.
- Cú pháp MessageFormat: tham số `{0}`, `{1}`; dấu nháy đơn viết đôi `''`. Tệp lưu UTF-8.

### Văn phong (cả hai ngôn ngữ)

- **Viết hoa kiểu câu**: chỉ viết hoa chữ đầu câu và tên riêng. Không viết "Cổng Ký Bên Thứ Ba", "Cập Nhật & Tiếp Tục".
- Không để lộ chữ kỹ thuật cho người dùng: tên hàm, tên API (`update_stock_batch`), "request", "OAuth2", "token"…
  Nói bằng việc người dùng làm: "đẩy tồn", "lấy đơn", "ủy quyền".
- Nút bắt đầu bằng động từ, ngắn: "Lưu Shop ID", "Bắt đầu liên kết". Không dùng "&" thay "và".
- Thông báo thành công không thêm "thành công!" khi câu đã nói rõ việc xong ("Đã lưu cấu hình").
- Câu lỗi nói điều gì sai và cách sửa: "Nhập Shop ID hoặc dán đường dẫn gian hàng Shopee."
- Ô số điện thoại không dùng placeholder kiểu "090…".
- Tiếng Anh: tự nhiên như sản phẩm SaaS (Shopify, Stripe), không dịch từng chữ. "e.g." cho "VD:".

### Tự kiểm trước khi commit

1. Soát mọi chữ có dấu tiếng Việt trong phần vừa sửa: hoặc nằm trong `t()` / `tDuLieu()` / `tNeuChuoi()`,
   hoặc có chú thích `i18n-giu-nguyen`.
2. Mỗi khóa `t("…")` mới đều có trong `frontend/src/i18n/en/*.json`.
3. Chạy script kiểm và sửa đến khi sạch (trợ lý AI có quyền chạy lệnh: tự chạy trước khi báo xong việc):

```bash
cd frontend
npm run i18n:kiem                                   # cả frontend
npm run i18n:kiem -- src/pages/channels --chi-tiet  # chỉ thư mục/tệp vừa sửa, kèm từng dòng lỗi
```

Script báo ba loại: CHƯA BỌC (chữ Việt chưa qua `t()`), THIẾU BẢN DỊCH (khóa chưa có trong `en/`),
LỆCH (một khóa hai bản dịch). Thoát mã 1 nếu còn lỗi. `--ghi-thieu <tep>` thêm khóa thiếu vào `en/<tep>.json`
với giá trị rỗng để điền bản dịch.

GitHub Actions (`.github/workflows/kiem-dich.yml`) chạy đúng lệnh này mỗi lần đẩy code có sửa `frontend/src` và mỗi PR
vào `Dev` / `main`. Báo đỏ thì xem log để biết dòng lỗi, sửa rồi đẩy lại.

4. Backend: mỗi khóa mới trong `<nhom>.properties` có dòng tương ứng trong `<nhom>_en.properties`.
