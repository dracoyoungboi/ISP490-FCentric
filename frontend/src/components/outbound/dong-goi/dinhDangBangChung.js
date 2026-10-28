import { formatDate } from "@/utils/formatters";
import { resolveProofMediaUrl } from "./tinhDongGoi";

/*
 * Định dạng dùng chung của phần xem bằng chứng đóng gói (màn Đóng gói, khối ở chi tiết đơn bán). Chỉ dùng trong giao diện
 * (alias "@/…" của Vite) — hàm thuần chạy `node --test` để ở tinhDongGoi.js.
 */

const pad2 = (n) => String(n).padStart(2, "0");
export const dinhGio = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
export const dinhNgay = (value) => formatDate(value).slice(0, 5); // "20/11"
export const dongHo = (giay) => `${pad2(Math.floor(giay / 60))}:${pad2(giay % 60)}`;
export const urlCua = (bc) => resolveProofMediaUrl(bc?.urlPublic || bc?.duongDanMinio);
