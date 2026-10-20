/**
 * Hằng số dùng chung cho luồng nhập kho theo lô (FO-094 → FO-100).
 * Đây là danh mục hiển thị; khi backend có bảng cấu hình tương ứng thì lấy từ máy chủ thay cho danh sách này.
 */

/**
 * Lý do không đạt khi kiểm đếm (FO-098). Thứ tự là số trên thẻ lệnh: lý do thứ n có mã FC-LD-n
 * (pages/receipt/kiemDem.js), nên chỉ thêm vào cuối, không đổi thứ tự khi thẻ đã in.
 */
export const LY_DO_LOI = ["Bung chỉ", "Rách vải", "Ố bẩn", "Sai màu / kích cỡ", "Lỗi phụ liệu", "Khác"];

/** Phương án xử lý trong biên bản trả hàng nhà cung cấp (FO-099). */
export const PHUONG_AN_TRA_HANG = [
  { ma: "DOI_HANG", ten: "Đổi hàng mới", moTa: "Nhà cung cấp giao bù hàng đạt ở đợt sau." },
  { ma: "TRU_CONG_NO", ten: "Trừ công nợ", moTa: "Giảm số tiền phải trả theo giá nhập." },
  { ma: "TRA_TAI_XE", ten: "Trả cho tài xế", moTa: "Giao hàng lỗi lại cho tài xế tại kho." },
];

/** Mã phương án Đổi hàng mới (nhà cung cấp giao bù): nhập kho chỉ tính hàng đạt là đã nhận. */
export const PHUONG_AN_DOI_HANG = "DOI_HANG";
/** Phương án mặc định khi lập biên bản. */
export const PHUONG_AN_MAC_DINH = PHUONG_AN_DOI_HANG;

/** Biên bản lập trước khi đổi tên phương án mang mã cũ DOI_HANG_MOI (cùng là Đổi hàng mới). */
const MA_PHUONG_AN_CU = { DOI_HANG_MOI: PHUONG_AN_DOI_HANG };

/** Mã phương án theo tên hiện hành (đổi mã cũ sang mã mới); trống thì null. */
export function chuanHoaPhuongAn(ma) {
  if (!ma) return null;
  return MA_PHUONG_AN_CU[ma] ?? ma;
}

/**
 * Đổi hàng: nhập kho chỉ cộng hàng đạt vào "đã nhận" của đơn mua (phần lỗi chờ giao bù).
 * Chưa có biên bản (không có hàng lỗi) cũng tính như Đổi hàng: không có phần lỗi nào được trừ.
 */
export function laDoiHang(ma) {
  return !ma || chuanHoaPhuongAn(ma) === PHUONG_AN_DOI_HANG;
}

/** Trạng thái kiểm đếm của một biến thể trong phiếu nhập, tính từ số đã kiểm so với số đặt. */
export const TRANG_THAI_KIEM_DEM = {
  CHO: { label: "Chờ kiểm đếm" },
  DANG: { label: "Đang kiểm đếm" },
  XONG: { label: "Đã kiểm xong" },
};

export function trangThaiKiemDem(daKiem, canNhap) {
  if (canNhap > 0 && daKiem >= canNhap) return TRANG_THAI_KIEM_DEM.XONG;
  if (daKiem > 0) return TRANG_THAI_KIEM_DEM.DANG;
  return TRANG_THAI_KIEM_DEM.CHO;
}

/**
 * Trạng thái vị trí kệ.
 * Người dùng chỉ chọn Hoạt động / Bảo trì; "Đầy" do hệ thống tự tính khi đang chứa ≥ sức chứa.
 */
export const TRANG_THAI_KE_CHON = [
  { ma: "HOAT_DONG", ten: "Hoạt động" },
  { ma: "BAO_TRI", ten: "Bảo trì" },
];

export const NHOM_TRANG_THAI_KE = {
  CON_CHO: { ma: "CON_CHO", label: "Còn chỗ" },
  DAY: { ma: "DAY", label: "Đầy" },
  BAO_TRI: { ma: "BAO_TRI", label: "Bảo trì" },
};

export function nhomTrangThaiKe(viTri) {
  if (!viTri) return NHOM_TRANG_THAI_KE.CON_CHO;
  if (viTri.trangThai === "BAO_TRI") return NHOM_TRANG_THAI_KE.BAO_TRI;
  const sucChua = Number(viTri.sucChua) || 0;
  if (sucChua > 0 && Number(viTri.dangChua || 0) >= sucChua) return NHOM_TRANG_THAI_KE.DAY;
  return NHOM_TRANG_THAI_KE.CON_CHO;
}

/** Mức đầy dùng để tô thanh: dưới 70% bình thường, từ 70% sắp đầy, 100% đầy. */
export const NGUONG_SAP_DAY = 0.7;

export function mucDay(dangChua, sucChua) {
  const tong = Number(sucChua) || 0;
  if (tong <= 0) return 0;
  return Math.max(0, Math.min(1, (Number(dangChua) || 0) / tong));
}

/** Tông màu thanh mức đầy (ThanhMuc): "" dưới ngưỡng, "warn" từ ngưỡng sắp đầy, "bad" khi đầy. */
export function toneMucDay(muc) {
  if (muc >= 1) return "bad";
  if (muc >= NGUONG_SAP_DAY) return "warn";
  return "";
}

/** Loại khu trên mặt bằng kho. */
export const LOAI_KHU = ["Lưu trữ", "Cách ly", "Đóng gói", "Khác"];

/** Hướng cửa trên mặt bằng kho. Chỉ đường bắt đầu từ cửa nhận hàng. */
export const HUONG_CUA = [
  { ma: "VAO", ten: "Cửa nhận hàng" },
  { ma: "RA", ten: "Cửa xuất hàng" },
];

/** Lưới mặt bằng: kích thước gợi ý khi tạo mới (người dùng đổi được) và giới hạn để lưới còn đọc được. */
export const LUOI_MAT_BANG = { cotGoiY: 24, hangGoiY: 12, toiThieu: 6, cotToiDa: 60, hangToiDa: 40 };

/** Tạo hàng loạt vị trí: tối đa một lần để tránh gõ nhầm khoảng (VD 1–100 thay vì 1–10). */
export const SO_VI_TRI_TOI_DA_MOI_LAN = 200;

const haiChuSo = (n) => String(n).padStart(2, "0");

/** Mã vị trí ghép từ Dãy - Hàng - Tầng; hàng và tầng 2 chữ số. VD: A-01-02. Tầng 01 là tầng sát sàn. */
export function maViTriKe(day, hang, tang) {
  return `${String(day ?? "").trim().toUpperCase()}-${haiChuSo(hang)}-${haiChuSo(tang)}`;
}

/** Tách khoảng "từ – đến" thành danh sách số; trả về [] nếu không hợp lệ. */
export function khoangSo(tu, den) {
  const a = Number(tu);
  const b = Number(den);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a) return [];
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

/** Chuỗi hiển thị hàng / tầng 2 chữ số (dữ liệu có thể là số hoặc chuỗi). */
export const soHang2 = (n) => haiChuSo(n);
