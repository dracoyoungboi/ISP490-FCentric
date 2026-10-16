// Bật dữ liệu mẫu bằng biến môi trường (đặt trong frontend/.env.local hoặc chạy `npx vite --mode mock`).
// Mặc định tắt: mọi màn gọi API thật.
export const CHANNEL_MOCK = import.meta.env.VITE_CHANNEL_MOCK === "true";
export const PICKLIST_MOCK = import.meta.env.VITE_PICKLIST_MOCK === "true";
// Màn nhập kho theo lô FO-094 → FO-100: vị trí kệ, mặt bằng, mã vạch NCC, biên bản trả hàng.
// Chỉ có tác dụng với phần máy chủ chưa có API (cờ *_DA_CO_MAY_CHU còn false); phiếu nhập vẫn gọi API thật.
// MẶC ĐỊNH BẬT (cả npm run dev lẫn bản build) để nhóm xem được màn trên web khi backend chưa xong;
// trang luôn có dòng "Đang dùng dữ liệu mẫu". Muốn tắt: đặt VITE_NHAP_KHO_MOCK=false.
export const NHAP_KHO_MOCK = import.meta.env.VITE_NHAP_KHO_MOCK !== "false";

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
