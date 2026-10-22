/**
 * Tiện ích quản lý và kiểm tra dữ liệu kết nối Lazada Open Platform.
 * Lưu giữ App Key, App Secret (AES-256-GCM), Access Token, Refresh Token.
 */

export function taoGiaTriKetNoiLazada(config) {
  return {
    appKey: config?.appKey ?? "",
    appSecret: "",
    accessToken: "",
    refreshToken: "",
  };
}

export function daKetNoiLazada(config) {
  return Boolean(config?.appKey && (config?.hasAccessToken || config?.hasAppSecret));
}

export function kiemTraGiaTriKetNoiLazada(values, config) {
  const errors = {};
  if (!values.appKey?.trim() && !config?.appKey) {
    errors.appKey = "Nhập App Key của ứng dụng Lazada Open Platform.";
  }
  if (!config?.hasAppSecret && !values.appSecret?.trim()) {
    errors.appSecret = "Nhập App Secret.";
  }
  return errors;
}

export function coThayDoiKetNoiLazada(values, config) {
  return (
    values.appKey?.trim() !== (config?.appKey ?? "") ||
    Boolean(values.appSecret?.trim()) ||
    Boolean(values.accessToken?.trim()) ||
    Boolean(values.refreshToken?.trim())
  );
}

export function taoPayloadKetNoiLazada(values, config) {
  return {
    appKey: values.appKey?.trim() || null,
    appSecret: values.appSecret?.trim() || null,
    accessToken: values.accessToken?.trim() || null,
    refreshToken: values.refreshToken?.trim() || null,
    trangThai: daKetNoiLazada(config) ? config?.trangThai ?? 1 : 1,
  };
}

export function trangThaiKetNoiLazada(config) {
  if (!config || !daKetNoiLazada(config)) return "chua_ket_noi";
  if (config.trangThai === 0) return "tam_dung";
  if (config.tokenExpiresAt && new Date(config.tokenExpiresAt) < new Date()) return "het_han";
  return "dang_hoat_dong";
}
