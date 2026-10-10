// Bật dữ liệu mẫu bằng biến môi trường (đặt trong frontend/.env.local hoặc chạy `npx vite --mode mock`).
// Mặc định tắt: mọi màn gọi API thật.
export const CHANNEL_MOCK = import.meta.env.VITE_CHANNEL_MOCK === "true";
export const PICKLIST_MOCK = import.meta.env.VITE_PICKLIST_MOCK === "true";

export function mockDelay(min = 150, max = 300) {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Lỗi giả có cùng hình dạng lỗi axios để trang xử lý như lỗi thật. */
export function mockError(status, message) {
  const error = new Error(message);
  error.response = { status, data: { status, message, data: null } };
  return error;
}

export function paginate(list, page = 0, size = 20) {
  const safeSize = Math.max(1, Number(size) || 20);
  const safePage = Math.max(0, Number(page) || 0);
  const start = safePage * safeSize;
  return {
    content: list.slice(start, start + safeSize),
    totalElements: list.length,
    totalPages: Math.max(1, Math.ceil(list.length / safeSize)),
    number: safePage,
    size: safeSize,
  };
}

export const clone = (value) => JSON.parse(JSON.stringify(value));

export function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}
