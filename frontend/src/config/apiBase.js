/**
 * Địa chỉ backend dùng chung cho toàn bộ frontend — chạy đúng ở cả localhost và khi deploy,
 * không cần sửa file .env mỗi lần đẩy code:
 * - `npm run dev`  : VITE_API_URL nếu có, mặc định http://localhost:8080
 * - `npm run build`: VITE_API_URL nếu là địa chỉ thật; bỏ qua địa chỉ localhost lỡ để trong .env,
 *                    khi đó gọi API cùng tên miền với trang web (vd. https://fcentric.net/api/...)
 */
const LOCAL_BACKEND = "http://localhost:8080";

const fromEnv = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
const pointsToLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(fromEnv);

export const API_BASE_URL = import.meta.env.DEV
  ? fromEnv || LOCAL_BACKEND
  : fromEnv && !pointsToLocalhost
    ? fromEnv
    : "";
