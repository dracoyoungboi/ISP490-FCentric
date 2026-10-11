import { jwtDecode } from "jwt-decode";
import { nguoiDungService } from "../services/nguoiDungService";

// Kiểm tra hạn của access token ngay ở client (chỉ decode, việc kiểm chữ ký là của backend).
// Token hết hạn bị backend chặn ở tầng filter, nên phải xử lý trước khi gọi API.

export const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
export const SESSION_INVALID_MESSAGE = "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";

// Token hết hạn / exp không hợp lệ / không decode được: xóa phiên, để lại thông báo
// cho trang Login (session_expired_message) và trả false. Token còn hạn: trả true.
export function ensureTokenUsable(token) {
  let message = null;
  try {
    const decoded = jwtDecode(token);
    const expiresAt = Number(decoded?.exp) * 1000;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      message = SESSION_EXPIRED_MESSAGE;
    }
  } catch {
    message = SESSION_INVALID_MESSAGE;
  }

  if (!message) return true;

  nguoiDungService.logout();
  sessionStorage.setItem("session_expired_message", message);
  return false;
}
