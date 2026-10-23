import { CONNECTION_STATUS, normalizeShopDomain } from "../../constants/channel.js";

/**
 * Trạng thái kết nối gian hàng dùng chung cho mọi sàn và các hàm của form khóa Shopify (đổi tên từ ketNoiShopify.js).
 * Đọc được cả KetNoiKenhDto (GET /{maKenh}/ket-noi, KH mục C.3) lẫn cấu hình Shopify cũ (GET /shopify, chưa có
 * trường trangThaiKetNoi): khi thiếu trường đó thì suy từ khóa đã lưu như trước.
 */

const DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const MOT_NGAY_MS = 86_400_000;
/** Còn từng này ngày trở xuống thì nhắc ủy quyền lại (KH mục D.4). */
export const SO_NGAY_NHAC_UY_QUYEN = 7;

/** Trạng thái lưu ở máy chủ (cột trang_thai_ket_noi); cấu hình Shopify cũ thì suy từ khóa đã lưu. */
function trangThaiLuu(dto) {
  if (!dto) return "chua_ket_noi";
  if (dto.trangThaiKetNoi) return dto.trangThaiKetNoi;
  if (!(dto.hasAccessToken && dto.shopDomain)) return "chua_ket_noi";
  return dto.tokenExpired || dto.isTokenExpired ? "het_han" : "dang_hoat_dong";
}

function hanDaQua(dto, bayGio) {
  if (!dto?.hanUyQuyen) return false;
  const han = new Date(dto.hanUyQuyen).getTime();
  return !Number.isNaN(han) && han <= bayGio;
}

/** Đã từng kết nối (kể cả hết hạn ủy quyền hay tạm dừng): các trang của gian hàng mở được. */
export function daKetNoi(dto) {
  const trangThai = trangThaiLuu(dto);
  return trangThai === "dang_hoat_dong" || trangThai === "het_han";
}

/** chua_ket_noi | het_han | tam_dung | dang_hoat_dong | loi (máy chủ ghi lỗi kết nối; không tính là đã kết nối) */
export function trangThaiKetNoi(dto, bayGio = Date.now()) {
  if (trangThaiLuu(dto) === "loi") return "loi";
  if (!daKetNoi(dto)) return "chua_ket_noi";
  if (trangThaiLuu(dto) === "het_han" || hanDaQua(dto, bayGio)) return "het_han";
  return Number(dto?.trangThai) === 1 ? "dang_hoat_dong" : "tam_dung";
}

/** Nhãn thẻ trạng thái: sàn ủy quyền hết hạn ghi "Hết hạn ủy quyền", Shopify giữ "Hết hạn khóa". */
export function nhanTrangThaiKetNoi(trangThai, kieuKetNoi) {
  if (trangThai === "het_han" && kieuKetNoi === "uy_quyen") return "Hết hạn ủy quyền";
  return (CONNECTION_STATUS[trangThai] ?? CONNECTION_STATUS.chua_ket_noi).label;
}

const dauNgay = (ms) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Hạn ủy quyền của sàn ủy quyền: { han (Date), soNgay, hetHan, sapHet (còn ≤ 7 ngày) }.
 * `soNgay` đếm theo ngày lịch (bỏ giờ) cho khớp ngày đang hiện: hôm nay 23/10, hết hạn 28/10 → 5; hết hạn trong
 * hôm nay → 0 (xem `conLaiUyQuyen`). Không có hạn (Shopify, chưa ủy quyền) thì null.
 */
export function hanUyQuyen(dto, bayGio = Date.now()) {
  if (!dto?.hanUyQuyen) return null;
  const han = new Date(dto.hanUyQuyen);
  if (Number.isNaN(han.getTime())) return null;
  const hetHan = trangThaiKetNoi(dto, bayGio) === "het_han";
  // Math.round: ngày đổi giờ mùa hè dài / ngắn hơn 24 giờ
  const soNgay = hetHan ? 0 : Math.max(0, Math.round((dauNgay(han.getTime()) - dauNgay(bayGio)) / MOT_NGAY_MS));
  return { han, soNgay, hetHan, sapHet: !hetHan && soNgay <= SO_NGAY_NHAC_UY_QUYEN };
}

/** "còn N ngày" / "hết hạn hôm nay" của hạn ủy quyền (kết quả `hanUyQuyen`) chưa hết. */
export function conLaiUyQuyen(han) {
  return han?.soNgay > 0 ? `còn ${han.soNgay} ngày` : "hết hạn hôm nay";
}

// ── Form khóa Shopify ──

export function taoGiaTriKetNoi(config) {
  return {
    shopDomain: config?.shopDomain ?? "",
    accessToken: "",
    clientId: config?.clientId ?? "",
    apiSecret: "",
    refreshToken: "",
  };
}

/**
 * Đã kết nối thì ô tên miền chỉ đọc: đổi sang cửa hàng khác phải ngắt rồi kết nối lại (KH mục B.3, C.1).
 * Máy chủ chưa ngắt kết nối được thì vẫn cho sửa tại chỗ như trước, để không hết đường đổi cửa hàng.
 */
export function khoaTenMien(config) {
  return hoTroNgatKetNoi(config) && daKetNoi(config) && Boolean(config?.shopDomain);
}

export function kiemTraGiaTriKetNoi(values, config) {
  const errors = {};
  const domain = normalizeShopDomain(values.shopDomain);
  if (!domain) errors.shopDomain = "Nhập tên miền cửa hàng.";
  else if (!DOMAIN_PATTERN.test(domain)) errors.shopDomain = "Tên miền phải có dạng ten-cua-hang.myshopify.com.";
  if (!config?.hasAccessToken && !values.accessToken.trim()) errors.accessToken = "Nhập khóa truy cập.";
  return errors;
}

/** Có đổi gì so với khóa đã lưu không (ô khóa để trống = giữ khóa cũ). */
export function coThayDoiKetNoi(values, config) {
  return (
    normalizeShopDomain(values.shopDomain) !== (config?.shopDomain ?? "") ||
    Boolean(values.accessToken.trim()) ||
    Boolean(values.apiSecret.trim()) ||
    Boolean(values.refreshToken.trim()) ||
    values.clientId.trim() !== (config?.clientId ?? "")
  );
}

/** Ô khóa để trống gửi null = giữ khóa đã lưu. Lần đầu kết nối thì bật đồng bộ. */
export function taoPayloadKetNoi(values, config) {
  return {
    shopDomain: normalizeShopDomain(values.shopDomain),
    accessToken: values.accessToken.trim() || null,
    apiSecret: values.apiSecret.trim() || null,
    clientId: values.clientId.trim(),
    refreshToken: values.refreshToken.trim() || null,
    trangThai: daKetNoi(config) ? config?.trangThai ?? 1 : 1,
  };
}

// ── Form khóa ứng dụng của sàn ủy quyền (Lazada, TikTok Shop) ──

export function taoGiaTriKhoaUngDung(dto) {
  return { appKey: dto?.appKey ?? "", appSecret: "", serviceId: dto?.serviceId ?? "" };
}

/** App Key, App Secret bắt buộc khi chưa lưu; Service ID chỉ TikTok Shop (`coServiceId`). */
export function kiemTraKhoaUngDung(values, dto, { coServiceId = false } = {}) {
  const errors = {};
  if (!values.appKey.trim()) errors.appKey = "Nhập App Key.";
  if (!dto?.hasAppSecret && !values.appSecret.trim()) errors.appSecret = "Nhập App Secret.";
  if (coServiceId && !values.serviceId.trim()) errors.serviceId = "Nhập Service ID.";
  return errors;
}

export function coThayDoiKhoaUngDung(values, dto) {
  return (
    values.appKey.trim() !== (dto?.appKey ?? "") ||
    Boolean(values.appSecret.trim()) ||
    values.serviceId.trim() !== (dto?.serviceId ?? "")
  );
}

/** PUT /{maKenh}/ket-noi/khoa: khóa rỗng = giữ khóa cũ; Service ID chỉ gửi khi sàn có. */
export function taoPayloadKhoaUngDung(values, { coServiceId = false } = {}) {
  return {
    appKey: values.appKey.trim() || null,
    appSecret: values.appSecret.trim() || null,
    ...(coServiceId ? { serviceId: values.serviceId.trim() || null } : {}),
  };
}

// ── Ngắt kết nối ──

/**
 * Máy chủ ngắt kết nối được chưa: chỉ máy chủ có API kết nối chung (KH Phần 2) mới trả trangThaiKetNoi; máy chủ cũ
 * trả cấu hình Shopify của GET /shopify, chưa có DELETE /{maKenh}/ket-noi.
 */
export function hoTroNgatKetNoi(dto) {
  return dto?.trangThaiKetNoi != null;
}

/**
 * Câu trong hộp xác nhận ngắt kết nối (KH mục B.8): nói rõ tồn và đơn trên sàn ra sao sau khi ngắt.
 * `san` là phần tử SAN_BAN_HANG, `ketNoi` là kết nối đang mở (tên gian hàng hoặc tên miền).
 */
export function moTaNgatKetNoi(san, ketNoi) {
  const tenSan = san?.ten ?? "sàn";
  const tonVaDon = `Số tồn trên ${tenSan} giữ nguyên như lần đẩy cuối, đơn mới sẽ không về FCentric.`;
  const giuLai = "Liên kết sản phẩm và các đơn đã về FCentric vẫn được giữ;";
  if (san?.kieuKetNoi === "khoa") {
    return [
      `Hệ thống sẽ xóa khóa truy cập đã lưu và dừng đồng bộ với ${ketNoi?.shopDomain || `cửa hàng ${tenSan}`}.`,
      tonVaDon,
      `${giuLai} kết nối lại bằng cửa hàng khác thì phải ghép sản phẩm lại.`,
      `Ứng dụng vẫn còn trong cửa hàng; muốn thu hồi hẳn khóa, hãy gỡ ứng dụng trong trang quản trị ${tenSan}.`,
    ].join(" ");
  }
  return [
    `Hệ thống sẽ xóa ủy quyền đã lưu và dừng đồng bộ với ${ketNoi?.tenGianHang || `gian hàng ${tenSan}`}.`,
    tonVaDon,
    `${giuLai} ủy quyền lại bằng gian hàng khác thì phải ghép sản phẩm lại.`,
  ].join(" ");
}
