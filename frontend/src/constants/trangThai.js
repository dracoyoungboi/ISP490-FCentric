/**
 * Bảng màu THẺ TRẠNG THÁI dùng chung toàn hệ thống (kiểu R8 – lozenge, chốt 17/10/2026).
 *
 * Màu chia theo GIAI ĐOẠN CỦA VIỆC, không theo màn hình: một nhãn chỉ có một màu ở mọi nơi.
 * Các bảng nhãn ở constants/* (donBanHang, phieuXuatKho…) chỉ khai báo TÊN; màu tra ở đây theo tên.
 *
 * Cách chọn nhóm cho một nhãn mới:
 *   1. Có lỗi, bị chặn hoặc quá hạn không?                          → loi     (Đỏ · Có vấn đề)
 *   2. Đã kết thúc chưa? Thành → xong (Xanh lá). Không thành        → dong    (Xám nhạt · Đã đóng)
 *   3. Đến lượt mình quyết định, hoặc có điểm cần để ý?             → canChuY (Cam đậm · Cần chú ý)
 *   4. Đã có người bắt đầu làm, hoặc đã gửi đi chờ trả lời?         → dang    (Vàng · Đang làm)
 *   5. Còn lại (chưa bắt đầu, đang xếp hàng, tạm dừng)              → cho     (Xám · Chưa bắt đầu)
 *   Trạng thái bình thường không cần ai để ý ("Còn hàng", "Bình thường") → thuong (chữ thường, không thẻ).
 *
 * Mã màu nằm ở src/index.css (--color-bo-tt-*). File này không import alias "@/…" để chạy được bằng `node --test`.
 */

/** Sáu nhóm có thẻ và một nhóm chữ thường. `lop` là class Tailwind của thẻ (nền + chữ). */
export const NHOM_TRANG_THAI = {
  cho: { ten: "Chưa bắt đầu", mau: "Xám", lop: "bg-bo-tt-cho text-bo-tt-cho-chu" },
  dang: { ten: "Đang làm", mau: "Vàng", lop: "bg-bo-tt-dang text-bo-tt-dang-chu" },
  canChuY: { ten: "Cần chú ý", mau: "Cam đậm", lop: "bg-bo-tt-chu-y text-bo-tt-chu-y-chu" },
  xong: { ten: "Xong", mau: "Xanh lá", lop: "bg-bo-tt-xong text-bo-tt-xong-chu" },
  dong: { ten: "Đã đóng", mau: "Xám nhạt", lop: "bg-bo-tt-dong text-bo-tt-dong-chu" },
  loi: { ten: "Có vấn đề", mau: "Đỏ", lop: "bg-bo-tt-loi text-bo-tt-loi-chu" },
  thuong: { ten: "Bình thường", mau: "Không thẻ", lop: "" },
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
  ],
  canChuY: [
    "Chờ duyệt",
    "Đã nhận báo giá",
    "Đã báo giá",
    "Chờ báo giá",
    "Chờ thanh toán",
    "Chưa thanh toán",
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
    "Khớp SKU",
    "Hoạt động",
    "Đang hoạt động",
    "Thành công",
    "Đã liên kết",
    "Đang đồng bộ",
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
  ],
  loi: ["Lỗi", "Bị khóa", "Hết hạn khóa", "Hết hàng", "Thiếu hàng", "Vượt mức", "Vượt số đặt", "Xung đột hủy"],
  thuong: ["Còn hàng", "Bình thường", "Chưa có hạn giao"],
};

/** Nhãn có phần số thay đổi: tra theo mẫu khi không có trong bảng trên. */
export const NHOM_THEO_MAU_NHAN = [
  { mau: /^Quá hạn \d+ ngày$/, nhom: "loi" },
  { mau: /^Còn \d+ ngày$/, nhom: "thuong" },
  { mau: /^Không xác định/, nhom: "cho" },
];

/**
 * Dự phòng khi nhãn không có trong bảng (vd. chỉ số %, nhãn ghép động): đổi tone cũ của StatusBadge sang nhóm.
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
  dang: "border-yellow-200 bg-yellow-50",
  canChuY: "border-orange-200 bg-orange-50",
  xong: "border-green-200 bg-bo-success-soft",
  dong: "border-bo-border bg-bo-surface-subtle",
  loi: "border-red-200 bg-bo-danger-soft",
  thuong: "border-bo-border bg-bo-surface-subtle",
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
