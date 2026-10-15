import { normalizeShopDomain } from "@/constants/channel";

const DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/** Giá trị ban đầu của form kết nối. Ô khóa luôn trống: không bao giờ điền khóa đã lưu vào ô. */
export function taoGiaTriKetNoi(config) {
  return {
    shopDomain: config?.shopDomain ?? "",
    accessToken: "",
    clientId: config?.clientId ?? "",
    apiSecret: "",
    refreshToken: "",
  };
}

/** Đã có kết nối dùng được: có tên miền và khóa truy cập đã lưu. */
export function daKetNoi(config) {
  return Boolean(config?.hasAccessToken && config?.shopDomain);
}

export function kiemTraGiaTriKetNoi(values, config) {
  const errors = {};
  const domain = normalizeShopDomain(values.shopDomain);
  if (!domain) errors.shopDomain = "Nhập tên miền cửa hàng.";
  else if (!DOMAIN_PATTERN.test(domain)) errors.shopDomain = "Tên miền phải có dạng ten-cua-hang.myshopify.com.";
  if (!config?.hasAccessToken && !values.accessToken.trim()) errors.accessToken = "Nhập khóa truy cập.";
  return errors;
}

/** Người dùng có đổi gì so với kết nối đang lưu không (ô khóa có chữ là có đổi). */
export function coThayDoiKetNoi(values, config) {
  return (
    normalizeShopDomain(values.shopDomain) !== (config?.shopDomain ?? "") ||
    Boolean(values.accessToken.trim()) ||
    Boolean(values.apiSecret.trim()) ||
    Boolean(values.refreshToken.trim()) ||
    values.clientId.trim() !== (config?.clientId ?? "")
  );
}

/** Dữ liệu gửi PUT /shopify. Khóa để trống = giữ khóa đã lưu. Lần đầu kết nối thì bật đồng bộ gian hàng. */
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

/** Trạng thái gian hàng cho ConnectionStatusBadge: chua_ket_noi | het_han | tam_dung | dang_hoat_dong. */
export function trangThaiKetNoi(config) {
  if (!daKetNoi(config)) return "chua_ket_noi";
  if (config?.tokenExpired || config?.isTokenExpired) return "het_han";
  return Number(config?.trangThai) === 1 ? "dang_hoat_dong" : "tam_dung";
}
