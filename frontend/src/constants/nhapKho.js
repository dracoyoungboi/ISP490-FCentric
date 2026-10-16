/**
 * Hằng số dùng chung cho luồng nhập kho theo lô (FO-094 → FO-100).
 * Đây là danh mục hiển thị; khi backend có bảng cấu hình tương ứng thì lấy từ máy chủ thay cho danh sách này.
 */

/** Lý do lỗi khi kiểm đếm (FO-098). */
export const LY_DO_LOI = ["Bung chỉ", "Rách vải", "Ố bẩn", "Sai màu / kích cỡ", "Lỗi phụ liệu", "Khác"];

/** Phương án xử lý trong biên bản trả hàng nhà cung cấp (FO-099). */
export const PHUONG_AN_TRA_HANG = [
  { ma: "DOI_HANG", ten: "Đổi hàng mới", moTa: "Nhà cung cấp giao bù hàng đạt ở đợt sau." },
  { ma: "TRU_CONG_NO", ten: "Trừ công nợ", moTa: "Giảm số tiền phải trả theo giá nhập." },
  { ma: "TRA_TAI_XE", ten: "Trả cho tài xế", moTa: "Giao hàng lỗi lại cho tài xế tại kho." },
];

/** Trạng thái kiểm đếm của một biến thể trong phiếu nhập, tính từ số đã kiểm so với số đặt. */
export const TRANG_THAI_KIEM_DEM = {
  CHO: { label: "Chờ kiểm đếm", tone: "neutral" },
  DANG: { label: "Đang kiểm đếm", tone: "info" },
  XONG: { label: "Đã kiểm xong", tone: "success" },
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
  CON_CHO: { ma: "CON_CHO", label: "Còn chỗ", tone: "success" },
  DAY: { ma: "DAY", label: "Đầy", tone: "warning" },
  BAO_TRI: { ma: "BAO_TRI", label: "Bảo trì", tone: "neutral" },
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

/** Mã lô gợi ý: <tiền tố>-<yyyyMMdd>-<số thứ tự 2 chữ số>, người dùng sửa được. */
export const TIEN_TO_MA_LO = "LO";

export function goiYMaLo(soThuTu, ngay = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = `${ngay.getFullYear()}${pad(ngay.getMonth() + 1)}${pad(ngay.getDate())}`;
  return `${TIEN_TO_MA_LO}-${ymd}-${pad(soThuTu)}`;
}
