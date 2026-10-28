/**
 * THẺ TRẠNG THÁI dùng chung toàn hệ thống (chốt 21/10/2026: H1 + khung của H4, "chỉ bọc khi cần").
 *
 * Màu chia theo GIAI ĐOẠN CỦA VIỆC, không theo màn hình: một nhãn chỉ có một nhóm màu ở mọi nơi.
 * Các bảng nhãn ở constants/* (donBanHang, phieuXuatKho…) chỉ khai báo TÊN; nhóm màu tra ở đây theo tên.
 *
 * Cách chọn nhóm cho một nhãn mới:
 *   1. Có lỗi, bị chặn hoặc quá hạn không?                          → loi     (Đỏ · Có vấn đề)
 *   2. Đã kết thúc chưa? Thành → xong (Xanh lá). Không thành        → dong    (Xám nhạt · Đã đóng)
 *   3. Đến lượt mình quyết định, hoặc có điểm cần để ý?             → canChuY (Cam · Cần chú ý)
 *   4. Đã có người bắt đầu làm, hoặc đã gửi đi chờ trả lời?         → dang    (Xanh dương · Đang làm)
 *   5. Còn lại (chưa bắt đầu, đang xếp hàng, tạm dừng)              → cho     (Xám · Chưa bắt đầu)
 *   Trạng thái bình thường, không cần ai để ý ("Còn hàng", "Bình thường", "Còn N ngày") → thuong:
 *   KHUNG VIỀN MẢNH xanh lá, không nền (chốt 21/10, phương án B): cùng cỡ khung nên thẳng cột với
 *   "Dư hàng" / "Hết hàng", nhưng không nền nên nhẹ hơn cảnh báo — mắt vẫn bắt cam/đỏ trước.
 *
 * Cách vẽ (xem layCachVe):
 *   - Chỉ Cần chú ý và Có vấn đề mới có KHUNG (ô nền nhạt + biểu tượng), ở mọi màn.
 *   - Bình thường → VIỀN (khung cùng cỡ, chỉ viền mảnh, không nền).
 *   - Chứng từ có quy trình (truyền `quyTrinh`) → VÒNG TIẾN TRÌNH lấp đầy theo bước, không nền.
 *   - Còn lại → BIỂU TƯỢNG nghiệp vụ tô màu + chữ, không nền. Việc đang chạy thật → chấm nhịp.
 *
 * Mã màu nằm ở src/index.css (--color-bo-tt-*). File này không import alias "@/…" để chạy được bằng `node --test`.
 */

/**
 * Bảy nhóm (đúng bản demo đã chốt). `boc`: có khung nền hay không. `vien`: khung chỉ viền, không nền (nhóm thuong).
 * `chu`: class chữ khi không khung.
 * `icon`: màu biểu tượng nghiệp vụ (tông đậm). `hinh`: màu vòng tiến trình / chấm (tông vừa).
 * `khung`: class ô (nền + chữ, hoặc viền + chữ với nhóm `vien`) khi có khung.
 */
export const NHOM_TRANG_THAI = {
  cho: { ten: "Chưa bắt đầu", mau: "Xám", boc: false, chu: "text-bo-foreground", icon: "text-bo-tt-cho-chu", hinh: "text-bo-tt-cho-hinh", khung: "bg-bo-tt-cho text-bo-tt-cho-chu" },
  dang: { ten: "Đang làm", mau: "Xanh dương", boc: false, chu: "text-bo-foreground", icon: "text-bo-tt-dang-chu", hinh: "text-bo-tt-dang-hinh", khung: "bg-bo-tt-dang text-bo-tt-dang-chu" },
  canChuY: { ten: "Cần chú ý", mau: "Cam", boc: true, chu: "text-bo-tt-chu-y-chu", icon: "text-bo-tt-chu-y-chu", hinh: "text-bo-tt-chu-y-hinh", khung: "bg-bo-tt-chu-y text-bo-tt-chu-y-chu" },
  xong: { ten: "Xong", mau: "Xanh lá", boc: false, chu: "text-bo-foreground", icon: "text-bo-tt-xong-chu", hinh: "text-bo-tt-xong-hinh", khung: "bg-bo-tt-xong text-bo-tt-xong-chu" },
  dong: { ten: "Đã đóng", mau: "Xám nhạt", boc: false, chu: "text-bo-muted", icon: "text-bo-muted", hinh: "text-bo-tt-dong-hinh", khung: "bg-bo-tt-dong text-bo-tt-dong-chu" },
  loi: { ten: "Có vấn đề", mau: "Đỏ", boc: true, chu: "text-bo-tt-loi-chu", icon: "text-bo-tt-loi-chu", hinh: "text-bo-tt-loi-hinh", khung: "bg-bo-tt-loi text-bo-tt-loi-chu" },
  thuong: { ten: "Bình thường", mau: "Xanh lá (viền mảnh)", boc: false, vien: true, chu: "text-bo-tt-thuong-chu", icon: "text-bo-tt-thuong-chu", hinh: "text-bo-tt-thuong-hinh", khung: "text-bo-tt-thuong-chu ring-1 ring-inset ring-bo-tt-thuong-vien" },
};

/** Nhóm → các nhãn thuộc nhóm. Thêm nhãn mới thì thêm vào đúng MỘT nhóm (test kiểm tra không trùng). */
export const NHAN_THEO_NHOM = {
  cho: [
    "Nháp",
    "Chờ nhặt hàng",
    "Chờ đóng gói",
    "Chờ xuất kho",
    "Chờ nhặt",
    "Chờ xuất",
    "Chờ xuất hàng",
    "Chờ nhập kho",
    "Chờ nhập",
    "Chờ kiểm đếm",
    "Chờ",
    "Bảo trì",
    "Tạm dừng",
    "Chưa kết nối",
    "Chưa liên kết",
    "Ngừng đồng bộ",
    "Ghép tay",
    "Dữ liệu mẫu",
    "Chưa có trạng thái",
    "Chưa có hạn giao",
  ],
  canChuY: [
    "Chờ duyệt",
    "Chờ báo giá",
    "Đã nhận báo giá",
    "Đã báo giá",
    "Chờ thanh toán",
    "Chưa thanh toán",
    "Thanh toán một phần",
    "Thiếu lô",
    "Hàng trả lại",
    "Đầy",
    "Còn thiếu",
    "Một phần",
    "Chưa đủ",
    "Chưa đủ bằng chứng",
    "Cất về kệ",
    "Sắp hết hàng",
    "Dư hàng",
    "Chờ thử lại",
    "Khách yêu cầu hủy",
    "Hoàn hàng",
    "Cần kiểm tra",
    "Chờ khóa lô",
    "Hạn hôm nay",
    "Chưa có email",
    "Chưa có kho",
    "Chưa đăng ký",
    "Chưa có ảnh",
    "Chưa có video",
  ],
  dang: [
    "Đã duyệt",
    "Đã gửi",
    "Đã gửi yêu cầu báo giá",
    "Đã gửi YC báo giá",
    "Chờ phản hồi",
    "Đang vận chuyển",
    "Đang kiểm đếm",
    "Đang nhặt",
    "Đang kiểm kê",
    "Đã xuất một phần",
    "Đã xuất kho",
    "Đang xử lý",
    "Đang kiểm tra...",
    "Đang giữ",
  ],
  xong: [
    "Đã chuyển thành đơn mua hàng",
    "Đã nhận đủ",
    "Đã nhập kho",
    "Đã kiểm xong",
    "Đủ hàng",
    "Đủ",
    "Còn chỗ",
    "Đã nhặt",
    "Đã lấy hết lô",
    "Đã xuất",
    "Đã đủ bằng chứng",
    "Hoàn thành",
    "Đã chốt đơn",
    "Đã gửi báo giá",
    "Đã thanh toán",
    "Đã bán cho khách",
    "Khớp SKU",
    "Hoạt động",
    "Đang hoạt động",
    "Thành công",
    "Đã liên kết",
    "Đang đồng bộ",
    "Đúng hạn",
    "Đã kết nối",
    "Đã đăng ký",
    "Đã có ảnh",
  ],
  dong: [
    "Đã hủy",
    "Đã xóa",
    "Từ chối",
    "Đã từ chối",
    "Bị từ chối",
    "Từ chối báo giá",
    "Không chấp nhận báo giá",
    "Bị hoàn trả",
    "Ngừng hoạt động",
    "Không hoạt động",
    "Bỏ qua",
    "Đã nhả",
    "Đã bỏ",
    "Đã trả lại tiền",
    "Hết hạn",
  ],
  loi: ["Lỗi", "Bị khóa", "Hết hạn khóa", "Hết hạn ủy quyền", "Hết hàng", "Thiếu hàng", "Vượt mức", "Vượt số đặt", "Xung đột hủy", "Chờ xử lý",
    "Cần hoàn tiền"],
  thuong: ["Còn hàng", "Bình thường"],
};

/** Nhãn có phần số thay đổi: tra theo mẫu khi không có trong bảng trên. */
export const NHOM_THEO_MAU_NHAN = [
  { mau: /^Quá hạn \d+ ngày$/, nhom: "loi" },
  { mau: /^Còn \d+ ngày$/, nhom: "thuong" },
  { mau: /^Không xác định/, nhom: "cho" },
  { mau: /^Đủ hàng \(/, nhom: "xong" },
  { mau: /^Thiếu hàng \(/, nhom: "loi" },
  { mau: /^Trễ \d+ ngày$/, nhom: "canChuY" },
  { mau: /^Đã có video/, nhom: "xong" },
];

/**
 * Biểu tượng nghiệp vụ theo nhãn (tên icon của lucide-react). StatusBadge đổi tên → component.
 * Nhãn không có ở đây vẽ chấm tròn màu nhóm.
 */
export const BIEU_TUONG_THEO_NHAN = {
  // Chứng từ, xếp hàng, duyệt
  "Nháp": "PencilLine",
  "Chờ": "Clock",
  "Chờ duyệt": "Hourglass",
  "Đã duyệt": "BadgeCheck",
  "Hoàn thành": "CircleCheckBig",
  "Đã hủy": "Ban",
  "Đã xóa": "Trash2",
  "Từ chối": "Ban",
  "Đã từ chối": "Ban",
  "Bị từ chối": "Ban",
  "Bị hoàn trả": "Undo2",
  // Nhặt, đóng gói, xuất
  "Chờ nhặt hàng": "ScanBarcode",
  "Chờ nhặt": "ScanBarcode",
  "Đang nhặt": "ScanBarcode",
  "Đã nhặt": "CircleCheckBig",
  "Chờ đóng gói": "Package",
  "Chờ xuất kho": "Truck",
  "Chờ xuất": "Truck",
  "Chờ xuất hàng": "Package",
  "Đã xuất một phần": "Truck",
  "Đã xuất kho": "Truck",
  "Đã xuất": "Truck",
  "Đang vận chuyển": "Truck",
  "Đủ": "CheckCheck",
  "Một phần": "NuaVong",
  "Chưa đủ": "NuaVong",
  "Vượt mức": "ChevronsUp",
  "Thiếu lô": "TriangleAlert",
  "Đã lấy hết lô": "CircleCheckBig",
  "Đã bỏ": "Ban",
  "Chưa đủ bằng chứng": "Camera",
  "Đã đủ bằng chứng": "Camera",
  "Cất về kệ": "KeHang",
  // Nhập kho, kiểm đếm, kiểm kê
  "Chờ nhập kho": "PackageOpen",
  "Chờ nhập": "PackageOpen",
  "Đã nhập kho": "PackageCheck",
  "Chờ kiểm đếm": "ClipboardList",
  "Đang kiểm đếm": "ScanBarcode",
  "Đã kiểm xong": "ClipboardCheck",
  "Đang kiểm kê": "ClipboardList",
  "Chờ khóa lô": "Lock",
  "Vượt số đặt": "ChevronsUp",
  "Hàng trả lại": "Undo2",
  "Dữ liệu mẫu": "Database",
  // Mua hàng, báo giá
  "Đã gửi": "Send",
  "Đã gửi yêu cầu báo giá": "Send",
  "Đã gửi YC báo giá": "Send",
  "Chờ phản hồi": "Send",
  "Chờ báo giá": "Receipt",
  "Đã nhận báo giá": "Receipt",
  "Đã báo giá": "Receipt",
  "Đã gửi báo giá": "Send",
  "Đã chốt đơn": "CircleCheckBig",
  "Đã chuyển thành đơn mua hàng": "CircleCheckBig",
  "Từ chối báo giá": "Ban",
  "Không chấp nhận báo giá": "Ban",
  "Còn thiếu": "TriangleAlert",
  "Đã nhận đủ": "PackageCheck",
  // Thanh toán, hàng khả dụng
  "Chưa thanh toán": "Banknote",
  "Chờ thanh toán": "Banknote",
  "Đã thanh toán": "Banknote",
  "Thanh toán một phần": "NuaVong",
  "Cần hoàn tiền": "Undo2",
  // Đối soát chuyển khoản: đã nhận tiền nhưng chưa tạo được đơn / quản lý đã hoàn tiền / mã QR hết hạn
  "Chờ xử lý": "OctagonAlert",
  "Đã bán cho khách": "CircleCheckBig",
  "Đã trả lại tiền": "Undo2",
  "Hết hạn": "Clock",
  "Đủ hàng": "PackageCheck",
  "Thiếu hàng": "PackageMinus",
  "Khớp SKU": "CheckCheck",
  "Ghép tay": "Hand",
  "Đang kiểm tra...": "Search",
  // Kênh bán: cờ, kết nối, đồng bộ, liên kết, giữ tồn
  "Khách yêu cầu hủy": "MessageSquareX",
  "Xung đột hủy": "OctagonAlert",
  "Hoàn hàng": "Undo2",
  "Cần kiểm tra": "Flag",
  "Đang hoạt động": "Radio",
  "Chưa kết nối": "Unlink",
  "Tạm dừng": "CirclePause",
  "Hết hạn khóa": "KeyRound",
  "Hết hạn ủy quyền": "KeyRound",
  "Lỗi": "OctagonAlert",
  "Đang xử lý": "RefreshCw",
  "Thành công": "CircleCheckBig",
  "Chờ thử lại": "RotateCcw",
  "Bỏ qua": "SkipForward",
  "Đã liên kết": "Link",
  "Chưa liên kết": "Unlink",
  "Đang đồng bộ": "RefreshCw",
  "Ngừng đồng bộ": "CirclePause",
  "Chưa có trạng thái": "CircleHelp",
  "Đang giữ": "Pin",
  "Đã nhả": "PinOff",
  // Đối tượng, kho, vị trí
  "Hoạt động": "CircleCheckBig",
  "Ngừng hoạt động": "CircleOff",
  "Không hoạt động": "CircleOff",
  "Bị khóa": "Lock",
  "Chưa có email": "Mail",
  "Chưa có kho": "Warehouse",
  "Bảo trì": "Wrench",
  "Còn chỗ": "Grid2x2",
  "Đầy": "Archive",
  // Tồn kho, hạn giao
  "Bình thường": "PackageCheck",
  "Còn hàng": "PackageCheck",
  "Sắp hết hàng": "TrendingDown",
  "Hết hàng": "PackageX",
  "Dư hàng": "TrendingUp",
  "Hạn hôm nay": "CalendarClock",
  "Chưa có hạn giao": "CalendarOff",
  "Đúng hạn": "CalendarCheck",
  "Đã kết nối": "Link",
  "Đã đăng ký": "BadgeCheck",
  "Chưa đăng ký": "TriangleAlert",
  "Đã có ảnh": "Camera",
  "Chưa có ảnh": "Camera",
  "Chưa có video": "Video",
};

/** Biểu tượng theo mẫu cho nhãn có số. */
const BIEU_TUONG_THEO_MAU = [
  { mau: /^(Quá hạn|Còn|Trễ) \d+ ngày$/, ten: "CalendarClock" },
  { mau: /^Không xác định/, ten: "CircleHelp" },
  { mau: /^Đủ hàng \(/, ten: "PackageCheck" },
  { mau: /^Thiếu hàng \(/, ten: "PackageMinus" },
  { mau: /^Đã có video/, ten: "Video" },
];

/**
 * Biểu tượng riêng theo loại đối tượng cho nhãn dùng chung (vd. "Hoạt động" của người dùng khác "Hoạt động" của kho).
 * Truyền `doiTuong` cho StatusBadge.
 */
export const BIEU_TUONG_THEO_DOI_TUONG = {
  nguoi: { "Hoạt động": "UserCheck" },
  kho: { "Hoạt động": "Warehouse" },
};

/** Việc đang chạy thật: vẽ chấm nhịp thay cho biểu tượng. */
export const NHAN_DANG_CHAY = ["Đang xử lý", "Đang kiểm tra..."];

/**
 * Quy trình của từng loại chứng từ: bước của mỗi nhãn trên tổng số bước (vòng tiến trình lấp theo tỉ lệ).
 * `nhap`: nhãn vẽ vòng đứt nét. `huy`: nhãn kết thúc không thành (vòng gạch chéo).
 * Nhãn không có trong quy trình (cờ như "Còn thiếu", "Chờ khóa lô") vẽ như thẻ thường.
 */
export const QUY_TRINH = {
  donBan: {
    ten: "Đơn bán hàng",
    tong: 5,
    buoc: { "Nháp": 0, "Chờ nhặt hàng": 1, "Chờ đóng gói": 2, "Chờ xuất kho": 3, "Đã xuất một phần": 3.5, "Đã xuất kho": 4, "Hoàn thành": 5 },
    nhap: ["Nháp"],
    huy: ["Đã hủy", "Bị hoàn trả"],
  },
  baoGiaBan: {
    ten: "Báo giá bán hàng",
    tong: 2,
    buoc: { "Chờ phản hồi": 1, "Đã chốt đơn": 2 },
    huy: ["Bị từ chối", "Đã từ chối"],
  },
  phieuNhat: {
    ten: "Phiếu nhặt hàng",
    tong: 2,
    buoc: { "Chờ nhặt": 0, "Đang nhặt": 1, "Đã nhặt": 2, "Đã xuất": 2, "Hoàn thành": 2 },
    huy: ["Đã hủy"],
  },
  phieuXuat: {
    ten: "Phiếu xuất kho",
    tong: 3,
    buoc: { "Nháp": 0, "Chờ duyệt": 1, "Đã duyệt": 2, "Chờ xuất": 2, "Đã xuất": 3 },
    nhap: ["Nháp"],
    huy: ["Đã hủy"],
  },
  chuyenKho: {
    ten: "Phiếu chuyển kho",
    tong: 4,
    buoc: { "Nháp": 0, "Chờ duyệt": 1, "Chờ xuất hàng": 2, "Đang vận chuyển": 3, "Hoàn thành": 4 },
    nhap: ["Nháp"],
    huy: ["Đã hủy"],
  },
  phieuNhap: {
    ten: "Phiếu nhập kho",
    tong: 3,
    buoc: { "Chờ nhập kho": 0, "Chờ nhập": 0, "Chờ duyệt": 1, "Đã duyệt": 2, "Đã nhập kho": 3 },
    huy: ["Đã hủy"],
  },
  kiemDem: {
    ten: "Kiểm đếm lô",
    tong: 2,
    buoc: { "Chờ kiểm đếm": 0, "Đang kiểm đếm": 1, "Đã kiểm xong": 2, "Đã nhập kho": 2 },
    huy: ["Đã hủy"],
  },
  kiemKe: {
    ten: "Kiểm kê",
    tong: 2,
    buoc: { "Đang kiểm kê": 1, "Hoàn thành": 2 },
  },
  yeuCauNhap: {
    ten: "Yêu cầu nhập hàng",
    tong: 4,
    buoc: { "Nháp": 0, "Chờ duyệt": 1, "Đã duyệt": 2, "Đã gửi yêu cầu báo giá": 3, "Đã chuyển thành đơn mua hàng": 4 },
    nhap: ["Nháp"],
    huy: ["Từ chối", "Đã từ chối"],
  },
  yeuCauBaoGia: {
    ten: "Yêu cầu báo giá nhà cung cấp",
    tong: 3,
    buoc: {
      "Đã gửi YC báo giá": 1, "Chờ báo giá": 1, "Đã nhận báo giá": 2, "Đã báo giá": 2,
      "Đã gửi báo giá": 2, "Đã chuyển thành đơn mua hàng": 3, "Đã nhận đủ": 3,
    },
    huy: ["Từ chối báo giá", "Không chấp nhận báo giá", "Đã xóa"],
  },
  donMua: {
    ten: "Đơn mua hàng",
    tong: 4,
    buoc: { "Đã gửi": 1, "Đã báo giá": 2, "Đang vận chuyển": 3, "Đã nhận đủ": 4, "Đã thanh toán": 4 },
    huy: ["Đã xóa", "Không chấp nhận báo giá"],
  },
};

/**
 * Dự phòng khi nhãn không có trong bảng (vd. chỉ số %, nhãn ghép động): đổi tone cũ sang nhóm.
 * Trạng thái thật luôn tra theo tên, không theo tone.
 */
export const NHOM_THEO_TONE = {
  neutral: "cho",
  info: "dang",
  success: "xong",
  warning: "canChuY",
  danger: "loi",
};

/** Nền khung lớn (banner trạng thái ở đầu trang chi tiết) theo nhóm, cùng tông với thẻ. */
export const KHUNG_THEO_NHOM = {
  cho: "border-bo-border bg-bo-surface-subtle",
  dang: "border-blue-200 bg-bo-tt-dang",
  canChuY: "border-orange-200 bg-bo-tt-chu-y",
  xong: "border-green-200 bg-bo-tt-xong",
  dong: "border-bo-border bg-bo-surface-subtle",
  loi: "border-red-200 bg-bo-tt-loi",
  thuong: "border-bo-tt-thuong-vien bg-bo-surface",
};

const NHOM_MAC_DINH = "cho";

function taoBangTra() {
  const bang = new Map();
  for (const [nhom, ds] of Object.entries(NHAN_THEO_NHOM)) {
    for (const nhan of ds) {
      if (!bang.has(nhan)) bang.set(nhan, nhom);
    }
  }
  return bang;
}

const BANG_TRA = taoBangTra();

/** Nhóm của một nhãn theo bảng (cả nhãn có số). `undefined` nếu chưa khai báo. */
export function nhomCuaNhan(nhan) {
  if (typeof nhan !== "string") return undefined;
  const chu = nhan.trim();
  if (BANG_TRA.has(chu)) return BANG_TRA.get(chu);
  const khop = NHOM_THEO_MAU_NHAN.find((m) => m.mau.test(chu));
  return khop?.nhom;
}

/**
 * Nhóm để tô thẻ. Thứ tự: `nhom` truyền thẳng → tên nhãn → tone cũ → Xám.
 * @param {unknown} nhan  tên hiển thị (chuỗi); ReactNode thì bỏ qua bước tra theo tên
 * @param {{ nhom?: string, tone?: string }} [tuyChon]
 */
export function layNhomTrangThai(nhan, { nhom, tone } = {}) {
  if (nhom && NHOM_TRANG_THAI[nhom]) return nhom;
  const theoNhan = nhomCuaNhan(nhan);
  if (theoNhan) return theoNhan;
  return NHOM_THEO_TONE[tone] ?? NHOM_MAC_DINH;
}

/** Tên icon lucide của nhãn, hoặc `undefined` (vẽ chấm). */
export function bieuTuongCuaNhan(nhan, doiTuong) {
  if (typeof nhan !== "string") return undefined;
  const chu = nhan.trim();
  return BIEU_TUONG_THEO_DOI_TUONG[doiTuong]?.[chu] ?? BIEU_TUONG_THEO_NHAN[chu] ?? BIEU_TUONG_THEO_MAU.find((m) => m.mau.test(chu))?.ten;
}

/**
 * Vị trí của nhãn trong quy trình chứng từ.
 * @returns {{ kieu: "nhap" | "vong" | "xong" | "huy", tiLe: number, buoc?: number, tong?: number } | undefined}
 */
export function viTriTrongQuyTrinh(quyTrinh, nhan) {
  const qt = QUY_TRINH[quyTrinh];
  if (!qt || typeof nhan !== "string") return undefined;
  const chu = nhan.trim();
  if (qt.huy?.includes(chu)) return { kieu: "huy", tiLe: 0 };
  if (!Object.hasOwn(qt.buoc, chu)) return undefined;
  if (qt.nhap?.includes(chu)) return { kieu: "nhap", tiLe: 0 };
  const tiLe = Math.max(0, Math.min(1, qt.buoc[chu] / qt.tong));
  return { kieu: tiLe >= 1 ? "xong" : "vong", tiLe, buoc: qt.buoc[chu], tong: qt.tong };
}

/**
 * Cách vẽ một thẻ (thuần dữ liệu, test được bằng node).
 * @returns {{ nhom: string, kieu: "khung" | "vong" | "bieuTuong" | "cham" | "nhip", bieuTuong?: string, quyTrinh?: object }}
 *   - khung: ô nền nhạt + biểu tượng (chỉ Cần chú ý / Có vấn đề)
 *   - vong: vòng tiến trình của chứng từ
 *   - bieuTuong: biểu tượng màu + chữ, không nền
 *   - nhip: chấm nhịp (việc đang chạy) + chữ
 *   - cham: chấm màu + chữ (nhãn chưa có biểu tượng)
 */
export function layCachVe(nhan, { nhom, tone, quyTrinh, doiTuong } = {}) {
  const nhomMau = layNhomTrangThai(nhan, { nhom, tone });
  const bieuTuong = bieuTuongCuaNhan(nhan, doiTuong);
  if (NHOM_TRANG_THAI[nhomMau].boc) return { nhom: nhomMau, kieu: "khung", bieuTuong };
  if (NHOM_TRANG_THAI[nhomMau].vien) return { nhom: nhomMau, kieu: "vien", bieuTuong };
  const viTri = quyTrinh ? viTriTrongQuyTrinh(quyTrinh, nhan) : undefined;
  if (viTri) return { nhom: nhomMau, kieu: "vong", quyTrinh: viTri };
  if (typeof nhan === "string" && NHAN_DANG_CHAY.includes(nhan.trim())) return { nhom: nhomMau, kieu: "nhip" };
  if (bieuTuong) return { nhom: nhomMau, kieu: "bieuTuong", bieuTuong };
  return { nhom: nhomMau, kieu: "cham" };
}
