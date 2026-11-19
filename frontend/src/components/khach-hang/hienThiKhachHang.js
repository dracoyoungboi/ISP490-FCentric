/**
 * Cách hiện một khách hàng ở danh sách và trang chi tiết: nguồn khách, số điện thoại gọi được, lần mua gần nhất.
 * Danh sách chỉ có khách cửa hàng (chốt 20/11, máy chủ lọc). Khách sàn chỉ gặp ở trang chi tiết (mở từ đơn bán, báo
 * cáo): tên và số đã che (Shopee "****", TikTok "N***ễn T**", Lazada "8**4") hiện nguyên văn, kèm dải "Khách từ <sàn>".
 * Không có JSX để chạy kiểm thử bằng node --test, nên import bằng đường dẫn tương đối.
 */
import { t } from "../../i18n/t.js";
import { formatDate } from "../../utils/formatters.js";
import { cachDay } from "./chi-tiet/tinhKhachHang.js";

/** Nguồn của hồ sơ khách (nơi hồ sơ được tạo); trùng NguonKhachHang.java ở máy chủ. */
export const NGUON_KHACH = Object.freeze({
  SHOPEE: "shopee",
  TIKTOK: "tiktok",
  LAZADA: "lazada",
  SHOPIFY: "shopify",
  CUA_HANG: "cua_hang",
});

// Tiền tố mã của khách tự tạo từ đơn sàn (OmnichannelOrderSyncJob ở máy chủ). Đổi ở đó thì đổi cả đây và
// NguonKhachHang.java. Mã nhập tay và tiền tố mã tự tạo không được bắt đầu bằng các tiền tố này.
const TIEN_TO_NGUON = [
  ["KH-SHP-", NGUON_KHACH.SHOPEE],
  ["KH-TTS-", NGUON_KHACH.TIKTOK],
  ["KH-LZD-", NGUON_KHACH.LAZADA],
  ["KH-SP-", NGUON_KHACH.SHOPIFY],
];
export const TIEN_TO_SAN = TIEN_TO_NGUON.map(([tienTo]) => tienTo);

// Mã kênh để vẽ logo (ChannelLogo); tên sàn là tên riêng, không dịch.
const MA_KENH = { shopee: "SHOPEE", tiktok: "TIKTOK", lazada: "LAZADA", shopify: "SHOPIFY" };
const TEN_SAN = { shopee: "Shopee", tiktok: "TikTok Shop", lazada: "Lazada", shopify: "Shopify" };

/** Tiền tố sàn mà mã bắt đầu bằng (không phân biệt hoa thường), "" khi không phải mã khách sàn. */
export function tienToSan(ma) {
  const hoa = String(ma ?? "").trim().toUpperCase();
  return TIEN_TO_SAN.find((tienTo) => hoa.startsWith(tienTo)) ?? "";
}

export function nguonTuMa(ma) {
  const tienTo = tienToSan(ma);
  return tienTo ? TIEN_TO_NGUON.find(([p]) => p === tienTo)[1] : NGUON_KHACH.CUA_HANG;
}

export const laNguonSan = (nguon) => nguon !== NGUON_KHACH.CUA_HANG && Boolean(MA_KENH[nguon]);
export const maKenhCuaNguon = (nguon) => MA_KENH[nguon] ?? null;
export const tenNguon = (nguon) => TEN_SAN[nguon] ?? t("Cửa hàng");

/** Khách do đồng bộ đơn sàn tạo (không nằm trong danh sách khách hàng): sàn của khách, null với khách cửa hàng. */
export function sanCuaKhach(khachHang) {
  const nguon = nguonTuMa(khachHang?.maKhachHang);
  return laNguonSan(nguon) ? nguon : null;
}

/** Tên khách để hiện (tiêu đề, hộp thoại, thông báo); trống thì lấy mã. */
export function tenHienThi(khachHang) {
  return String(khachHang?.tenKhachHang ?? "").trim() || khachHang?.maKhachHang || "—";
}

/** Số điện thoại có dấu * là số sàn đã che (che hết hoặc một phần): không gọi, không sao chép. */
export const laSoBiChe = (soDienThoai) => String(soDienThoai ?? "").includes("*");

/** Số dùng cho liên kết gọi (tel:); số bị che thì "" để không hiện nút Gọi. */
export function soDeGoi(soDienThoai) {
  const so = String(soDienThoai ?? "").trim();
  if (!so || laSoBiChe(so)) return "";
  return so.replace(/[\s.]/g, "");
}

const vietHoaDau = (s) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

/**
 * Cột "Lần mua gần nhất" của danh sách (POST /khach-hang/danh-sach trả `lanMuaGanNhat`). Tổng chi tiêu, số đơn chỉ ở
 * trang chi tiết (chốt 19/11). `chiPhamViMinh`: người xem chỉ thấy đơn trong phạm vi của mình (không phải quản trị
 * viên) — khách không có đơn trong phạm vi thì hiện "—" thay vì "Chưa mua", vì khách có thể đã mua qua người khác.
 * Trả { ngay, ngayPhu, khi, chuaMua, khongRo }:
 * - ngayPhu: "Hôm nay" / "3 ngày trước" viết hoa đầu (dòng riêng dưới ngày); khi: cùng chữ, viết thường (giữa câu).
 */
export function lanMuaHang(khachHang, { chiPhamViMinh = false, homNay = new Date() } = {}) {
  const ngay = khachHang?.lanMuaGanNhat;
  if (!ngay || Number.isNaN(new Date(ngay).getTime())) {
    return { ngay: "", ngayPhu: "", khi: "", chuaMua: !chiPhamViMinh, khongRo: chiPhamViMinh };
  }
  const khi = cachDay(ngay, homNay);
  return { ngay: formatDate(ngay), ngayPhu: vietHoaDau(khi), khi, chuaMua: false, khongRo: false };
}
