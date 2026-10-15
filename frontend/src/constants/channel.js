// Hằng số dùng chung cho phần Kênh bán hàng (omnichannel).
// Id kênh theo bảng kenh_ban_hang (migration omnichannel_v1.sql): POS 1, SHOPIFY 2, LAZADA 3, SHOPEE 4 (tạm hoãn), TIKTOK 5.

export const CHANNELS = {
  POS: { id: 1, maKenh: "POS", tenKenh: "POS" },
  SHOPIFY: { id: 2, maKenh: "SHOPIFY", tenKenh: "Shopify" },
  LAZADA: { id: 3, maKenh: "LAZADA", tenKenh: "Lazada" },
  TIKTOK: { id: 5, maKenh: "TIKTOK", tenKenh: "TikTok Shop" },
};

/** Lựa chọn lọc theo kênh sàn (Đơn chờ xuất, Đơn bán hàng). */
export const MARKETPLACE_FILTER_OPTIONS = [
  { value: "", label: "Tất cả kênh" },
  { value: "shopify", label: "Shopify", id: CHANNELS.SHOPIFY.id },
  { value: "lazada", label: "Lazada", id: CHANNELS.LAZADA.id },
  { value: "tiktok", label: "TikTok Shop", id: CHANNELS.TIKTOK.id },
];

// Màu badge kênh theo SRS 8.1.1: Shopify xanh lá, Lazada xanh dương, TikTok xám đậm.
export const CHANNEL_BADGE_CLASS = {
  SHOPIFY: "border-green-200 bg-green-50 text-green-700",
  LAZADA: "border-blue-200 bg-blue-50 text-blue-700",
  TIKTOK: "border-slate-300 bg-slate-100 text-slate-800",
  SHOPEE: "border-orange-200 bg-orange-50 text-orange-700",
  POS: "border-indigo-200 bg-indigo-50 text-indigo-700",
  DEFAULT: "border-bo-border bg-bo-surface-subtle text-slate-600",
};

const CHANNEL_NAMES = {
  SHOPIFY: "Shopify",
  LAZADA: "Lazada",
  TIKTOK: "TikTok Shop",
  SHOPEE: "Shopee",
  POS: "POS",
};

export function getChannelName(maKenh, fallback = "Bán thường") {
  if (!maKenh) return fallback;
  return CHANNEL_NAMES[String(maKenh).toUpperCase()] ?? maKenh;
}

export function getChannelBadgeClass(maKenh) {
  if (!maKenh) return CHANNEL_BADGE_CLASS.DEFAULT;
  return CHANNEL_BADGE_CLASS[String(maKenh).toUpperCase()] ?? CHANNEL_BADGE_CLASS.DEFAULT;
}

export const CONNECTION_STATUS = {
  chua_ket_noi: { label: "Chưa kết nối", tone: "neutral" },
  dang_hoat_dong: { label: "Đang hoạt động", tone: "success" },
  tam_dung: { label: "Tạm dừng", tone: "warning" },
  het_han: { label: "Hết hạn khóa", tone: "danger" },
  loi: { label: "Lỗi", tone: "danger" },
};

export const SYNC_STATUS = {
  CHO: { label: "Chờ", tone: "neutral" },
  DANG_XU_LY: { label: "Đang xử lý", tone: "info" },
  THANH_CONG: { label: "Thành công", tone: "success" },
  CHO_THU_LAI: { label: "Chờ thử lại", tone: "warning" },
  LOI: { label: "Lỗi", tone: "danger" },
  BO_QUA: { label: "Bỏ qua", tone: "neutral" },
};

export const LINK_STATUS = {
  da_lien_ket: { label: "Đã liên kết", tone: "success" },
  chua_lien_ket: { label: "Chưa liên kết", tone: "neutral" },
  loi: { label: "Lỗi", tone: "danger" },
};

export const LINK_STATUS_OPTIONS = [
  { value: "", label: "Tất cả liên kết" },
  { value: "da_lien_ket", label: "Đã liên kết" },
  { value: "chua_lien_ket", label: "Chưa liên kết" },
  { value: "loi", label: "Lỗi" },
];

export const LOG_TYPE = {
  KET_NOI: "Kết nối",
  TOKEN: "Token",
  SAN_PHAM: "Sản phẩm",
  TON_KHO: "Tồn kho",
  DON_HANG: "Đơn hàng",
  HUY_DON: "Hủy đơn",
};

export const LOG_SOURCE = {
  BATCH: "Định kỳ",
  REALTIME: "Tức thời",
  MANUAL: "Thủ công",
  WEBHOOK: "Webhook",
  POLLING: "Quét bù",
};

export const LOG_TYPE_OPTIONS = [
  { value: "", label: "Tất cả loại" },
  ...Object.entries(LOG_TYPE).map(([value, label]) => ({ value, label })),
];

export const LOG_STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "LOI", label: "Lỗi" },
  { value: "CHO_THU_LAI", label: "Chờ thử lại" },
  { value: "THANH_CONG", label: "Thành công" },
  { value: "BO_QUA", label: "Bỏ qua" },
];

/**
 * Tab trạng thái của bảng Nhật ký đồng bộ (bố cục A+G). `ma` nằm trên đường dẫn `?trangThai=`,
 * `trangThai` là mã gửi API (cùng mã SYNC_STATUS để một trạng thái chỉ có một tên).
 */
// Chỉ các trạng thái backend thật sự trả về và lọc được (KenhBanHangDongBoServiceImpl.filterNhatKy:
// THANH_CONG, LOI, CHO). "Chờ thử lại", "Bỏ qua" chỉ có trong dữ liệu giả nên không làm tab (N4).
export const LOG_STATUS_TABS = [
  { ma: "tat-ca", label: "Tất cả", trangThai: null },
  { ma: "cho", label: SYNC_STATUS.CHO.label, trangThai: "CHO" },
  { ma: "thanh-cong", label: SYNC_STATUS.THANH_CONG.label, trangThai: "THANH_CONG" },
  { ma: "loi", label: SYNC_STATUS.LOI.label, trangThai: "LOI" },
];

/**
 * Tab trạng thái liên kết của trang Liên kết sản phẩm (S-OC-03). Bật/tắt đồng bộ là cột công tắc riêng,
 * không phải trạng thái liên kết. `ma` nằm trên đường dẫn `?trangThai=`, `trangThai` là mã gửi API.
 */
export const LINK_STATUS_TABS = [
  { ma: "tat-ca", label: "Tất cả", trangThai: null },
  { ma: "da-lien-ket", label: LINK_STATUS.da_lien_ket.label, trangThai: "da_lien_ket" },
  { ma: "chua-lien-ket", label: LINK_STATUS.chua_lien_ket.label, trangThai: "chua_lien_ket" },
  { ma: "loi", label: LINK_STATUS.loi.label, trangThai: "loi" },
];

/** Cờ cần xử lý trên đơn (TK 7.4). Mọi cờ đều chặn Pick List và xuất kho. */
export const FLAG_META = {
  THIEU_HANG: {
    label: "Thiếu hàng",
    tone: "danger",
    description: "Giữ chỗ chưa đủ số lượng đặt.",
    resolve: "Giữ bù khi có hàng, hoặc nhập / chuyển kho thêm.",
  },
  YEU_CAU_HUY: {
    label: "Khách yêu cầu hủy",
    tone: "warning",
    description: "Sàn đang xử lý yêu cầu hủy của người mua.",
    resolve: "Chờ sàn duyệt hoặc đóng yêu cầu.",
  },
  XUNG_DOT_HUY: {
    label: "Xung đột hủy",
    tone: "danger",
    description: "Sàn hủy hoặc sửa đơn khi đơn đã vào phiếu nhặt hàng / có phiếu xuất.",
    resolve: "Xác nhận hủy theo sàn hoặc Áp dụng thay đổi từ sàn.",
  },
  HOAN_HANG: {
    label: "Hoàn hàng",
    tone: "warning",
    description: "Hàng đã rời kho nhưng sàn báo hủy hoặc hoàn.",
    resolve: "Hoàn trả hàng, hoặc Đánh dấu đã xử lý sau khi xử lý tay.",
  },
  CAN_KIEM_TRA: {
    label: "Cần kiểm tra",
    tone: "warning",
    description: "Trạng thái trên sàn không khớp với kho.",
    resolve: "Kiểm tra rồi Đánh dấu đã xử lý.",
  },
};

/** `canXuLy` là chuỗi "A,B" ở DonBanHangDto và mảng ở ThongTinKenhDto. */
export function parseFlags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(",")
    .map((flag) => flag.trim())
    .filter(Boolean);
}

export const HOLD_STATUS = {
  dang_giu: { label: "Đang giữ", tone: "info" },
  da_nha: { label: "Đã nhả", tone: "neutral" },
  da_xuat: { label: "Đã xuất", tone: "success" },
};

/** Gợi ý xử lý theo mã lỗi nhật ký đồng bộ. */
export const ERROR_HINTS = {
  THIEU_LIEN_KET: "SKU chưa liên kết. Mở Liên kết sản phẩm để ghép SKU.",
  429: "Vượt giới hạn gọi API, hệ thống sẽ tự thử lại.",
  401: "Token không hợp lệ. Kiểm tra khóa hoặc làm mới token.",
  AUTH: "Token không hợp lệ. Kiểm tra khóa hoặc làm mới token.",
  CHANGE_FROM_QUANTITY_STALE: "Shopify đã tự đổi tồn, hệ thống sẽ đẩy lại.",
  DON_DA_XU_LY_NGOAI_HE_THONG: "Đơn đã vận chuyển hoặc giao trước khi kết nối nên không nhập về.",
  KHONG_TIM_THAY_DON: "Không tìm thấy đơn tương ứng trong hệ thống.",
};

export function getErrorHint(maLoi) {
  if (!maLoi) return null;
  return ERROR_HINTS[maLoi] ?? null;
}

/** "fcentric-dev", "https://fcentric-dev.myshopify.com/" → "fcentric-dev.myshopify.com" */
export function normalizeShopDomain(value) {
  let domain = String(value ?? "").trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (domain && !domain.includes(".")) domain = `${domain}.myshopify.com`;
  return domain;
}

/** Kho được chọn làm kho đồng bộ: bỏ Kho Trung Chuyển và kho ngừng hoạt động (BR-OC-04). */
export function locKhoDongBo(list) {
  return (Array.isArray(list) ? list : []).filter(
    (kho) => kho?.maKho !== "KHO_TRANSIT" && (kho?.trangThai === undefined || kho?.trangThai === null || Number(kho.trangThai) === 1),
  );
}

// ── Màn Kênh bán hàng theo từng sàn (bố cục học từ trang quản lý kênh của Sapo) ──

/** Các sàn hiển thị ở trang Kênh bán hàng. Hiện chỉ Shopify có tích hợp thật. */
export const SAN_BAN_HANG = [
  { maKenh: "SHOPIFY", ten: "Shopify", duongDan: "/channels/shopify", hoTro: true },
  { maKenh: "LAZADA", ten: "Lazada", duongDan: null, hoTro: false },
  { maKenh: "TIKTOK", ten: "TikTok Shop", duongDan: null, hoTro: false },
];

/** Bốn bước thiết lập gian hàng (tên ngắn trùng tên thẻ ở trang Cấu hình). */
export const BUOC_THIET_LAP = [
  { so: 1, ten: "Gian hàng", moTa: "Nhập tên miền và khóa truy cập của ứng dụng Shopify." },
  { so: 2, ten: "Tồn kho", moTa: "Chọn cách cập nhật số tồn lên Shopify." },
  { so: 3, ten: "Đơn hàng", moTa: "Bật nhận đơn mới từ Shopify về FCentric." },
  { so: 4, ten: "Liên kết sản phẩm", moTa: "Ghép sản phẩm trên Shopify với biến thể FCentric." },
];

/**
 * Trạng thái một dòng liên kết sản phẩm. Mỗi dòng luôn gắn một biến thể FCentric:
 * "chua_lien_ket" là dòng đang ngừng đồng bộ (backend lưu "chua_dong_bo").
 */
export const LIEN_KET_STATUS = {
  da_lien_ket: { label: "Đang đồng bộ", tone: "success" },
  chua_lien_ket: { label: "Ngừng đồng bộ", tone: "warning" },
  loi: { label: "Lỗi", tone: "danger" },
};

/** Tab của trang Sản phẩm theo sàn. `ma` nằm trên đường dẫn `?trangThai=`. */
export const LIEN_KET_TABS = [
  { ma: "tat-ca", label: "Tất cả", trangThai: null },
  { ma: "dang-dong-bo", label: LIEN_KET_STATUS.da_lien_ket.label, trangThai: "da_lien_ket" },
  { ma: "ngung-dong-bo", label: LIEN_KET_STATUS.chua_lien_ket.label, trangThai: "chua_lien_ket" },
  { ma: "loi", label: LIEN_KET_STATUS.loi.label, trangThai: "loi" },
];

/**
 * Số lượng đẩy lên sàn, khớp KenhBanHangDongBoServiceImpl.dayTonKhoLenKenh:
 * lấy ⌊khả dụng × tỷ lệ / 100⌋ trừ tồn đệm; kết quả không vượt ngưỡng về 0 thì đẩy 0.
 */
export function tinhSoTonDayLenSan(khaDung, { tyLeDayTon = 100, tonDem = 0, nguongVe0 = 0 } = {}) {
  const kd = Math.max(0, Math.floor(Number(khaDung) || 0));
  const soDay = Math.floor((kd * (Number(tyLeDayTon) || 0)) / 100) - (Number(tonDem) || 0);
  return soDay <= (Number(nguongVe0) || 0) ? 0 : soDay;
}
