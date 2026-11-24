/**
 * Hằng số dùng chung cho luồng nhập kho theo lô (FO-094 → FO-100).
 * Đây là danh mục hiển thị; khi backend có bảng cấu hình tương ứng thì lấy từ máy chủ thay cho danh sách này.
 */

/**
 * Lý do không đạt khi kiểm đếm (FO-098). Thứ tự là số trên thẻ lệnh: lý do thứ n có mã FC-LD-n
 * (pages/receipt/kiemDem.js), nên chỉ thêm vào cuối, không đổi thứ tự khi thẻ đã in.
 */
export const LY_DO_LOI = ["Bung chỉ", "Rách vải", "Ố bẩn", "Sai màu / kích cỡ", "Lỗi phụ liệu", "Khác"];

/*
 * Biên bản trả hàng nhà cung cấp (FO-099): hai việc tách riêng.
 *  1. Hàng lỗi đi đâu: kho chọn CACH_XU_LY_HANG lúc lập; hàng giữ ở kho thì nhà cung cấp chọn nhận lại / tiêu hủy trên
 *     cổng, kho ghi giao trả / tiêu hủy theo lựa chọn đó.
 *  2. Nhà cung cấp bù gì (TEN_CACH_BU): nhà cung cấp chọn trên Cổng nhà cung cấp cho TỪNG DÒNG sản phẩm lỗi; đầu biên
 *     bản là tổng của các dòng (HON_HOP: dòng giao bù, dòng trừ tiền).
 * Mã khớp BienBanTraHangNcc / BienBanTraHangServiceImpl ở máy chủ.
 */

/** Cách xử lý hàng lỗi kho chọn lúc lập biên bản. */
export const CACH_XU_LY_HANG = [
  { ma: "GIU_KHO", ten: "Giữ ở kho, trả sau", moTa: "Hàng lỗi để ở khu chờ trả. Nhà cung cấp đến lấy hoặc kho gửi trả sau." },
  // Chỉ khi người ký là đại diện nhà cung cấp: bên vận chuyển không nhận hàng lỗi thay nhà cung cấp
  { ma: "TRA_NGAY", ten: "Trả ngay cho người giao hàng", moTa: "Người của nhà cung cấp mang hàng lỗi về ngay, hàng không vào kho." },
];
export const CACH_XU_LY_MAC_DINH = "GIU_KHO";

/** Ai ký biên bản bên giao hàng lúc kiểm. Người của bên vận chuyển chỉ xác nhận số lỗi lúc giao, không thay nhà cung cấp. */
export const BEN_KY = [
  { ma: "DAI_DIEN_NCC", ten: "Đại diện nhà cung cấp", moTa: "Nhân viên hoặc tài xế của nhà cung cấp." },
  { ma: "VAN_CHUYEN", ten: "Bên vận chuyển", moTa: "Tài xế nhà xe, bưu tá: chỉ xác nhận số lỗi lúc giao, nhà cung cấp vẫn xác nhận trên cổng." },
];
export const BEN_KY_MAC_DINH = "DAI_DIEN_NCC";

/** Tên cách bù (của một dòng, hoặc tổng của biên bản: HON_HOP khi dòng giao bù dòng trừ tiền). */
export const TEN_CACH_BU = {
  CHO_CHOT: "Chờ nhà cung cấp chọn",
  DOI_HANG: "Giao bù hàng",
  TRU_CONG_NO: "Trừ tiền hàng",
  HON_HOP: "Trừ tiền và giao bù",
};

/** Nhà cung cấp chọn cho hàng lỗi còn ở kho (trên Cổng nhà cung cấp); HON_HOP: dòng nhận lại, dòng tiêu hủy. */
export const TEN_HANG_LOI_NCC = { NHAN_LAI: "Nhận lại hàng lỗi", TIEU_HUY: "Đồng ý tiêu hủy", HON_HOP: "Nhận lại và tiêu hủy" };

/** Cách giao trả hàng lỗi sau khi nhập kho (nhà cung cấp đã chọn nhận lại). */
export const CACH_GIAO_TRA = [
  { ma: "NCC_LAY", ten: "Nhà cung cấp đến lấy", moTa: "Người của nhà cung cấp nhận tại kho và ký biên bản." },
  { ma: "VAN_CHUYEN", ten: "Gửi đơn vị vận chuyển", moTa: "Kho đóng gói gửi trả, ghi mã vận đơn." },
];

/** Hàng lỗi của biên bản đang ở đâu. */
export const TRANG_THAI_HANG_LOI = {
  O_KHO: { label: "Đang ở kho chờ trả" },
  DA_TRA: { label: "Đã giao trả" },
  DA_TIEU_HUY: { label: "Đã tiêu hủy" },
  DA_XU_LY: { label: "Đã trả và tiêu hủy" },
  KHONG_RO: { label: "Không rõ (dữ liệu cũ)" },
};

/**
 * Trạng thái hiển thị của biên bản (máy chủ tính): chờ người giao hàng ký (chưa gửi nhà cung cấp), chờ nhà cung cấp trả lời trên
 * cổng, rồi việc kho làm theo lựa chọn của nhà cung cấp (giao trả / tiêu hủy), rồi chờ hàng bù.
 */
export const TRANG_THAI_TRA_HANG = {
  CHO_KY: { label: "Chờ ký biên bản" },
  CHO_CHOT: { label: "Chờ nhà cung cấp xác nhận" },
  CHO_GIAO_TRA: { label: "Chờ giao trả hàng" },
  CHO_TIEU_HUY: { label: "Chờ tiêu hủy" },
  CHO_HANG_BU: { label: "Chờ hàng bù" },
  HOAN_TAT: { label: "Hoàn tất" },
  MOI_LAP: { label: "Chưa nhập kho" },
  DA_HUY: { label: "Đã hủy" },
};

/** Trạng thái biên bản (mã máy chủ) → { label }; mã lạ thì hiện nguyên mã (màu tra theo tên ở constants/trangThai.js). */
export function trangThaiTraHang(ma) {
  return TRANG_THAI_TRA_HANG[ma] ?? { label: ma || "—" };
}

/** Độ dài tối đa các ô của biên bản trả hàng, khớp máy chủ. */
export const GIOI_HAN_TRA_HANG = { ten: 100, bienSo: 20, maVanDon: 50, ghiChu: 255 };

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
