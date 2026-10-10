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
