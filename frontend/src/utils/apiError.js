/** Ưu tiên câu thông báo tiếng Việt của backend; không có thì dùng câu dự phòng. */
export function getApiErrorMessage(error, fallback) {
  const data = error?.response?.data;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  if (Array.isArray(data?.errors) && data.errors[0]) return String(data.errors[0]);
  if (!error?.response && error?.request) {
    return `${fallback}: không nhận được phản hồi từ máy chủ.`;
  }
  return fallback;
}

export function getApiErrorStatus(error) {
  return error?.response?.status ?? null;
}

const MA_LOI_HOP_LE = /^[A-Z][A-Z0-9_]+$/;

/**
 * Mã lỗi có cấu trúc của máy chủ (LoiCoMaException): `data.data.code` trước, rồi `data.error`.
 * Chỉ nhận chuỗi dạng MÃ_CHỮ_HOA (`error` của lỗi thường là câu lý do HTTP như "Conflict"). Không có mã thì null.
 */
export function getApiErrorCode(error) {
  const body = error?.response?.data;
  for (const ma of [body?.data?.code, body?.error]) {
    if (typeof ma === "string" && MA_LOI_HOP_LE.test(ma)) return ma;
  }
  return null;
}
