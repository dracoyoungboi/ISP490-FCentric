import { formatNumber } from "../../utils/formatters.js";
import { t } from "../../i18n/t.js";

/**
 * Đọc ảnh chụp tiến độ "Đồng bộ ngay" (DongBoNgayDto của máy chủ) thành số liệu hiển thị.
 * Hàm thuần, không gọi API: dùng chung cho nút, bảng thả xuống và kiểm thử.
 */

export const DB_TRANG_THAI = { DANG_CHAY: "dang_chay", XONG: "xong", LOI: "loi", DA_DUNG: "da_dung" };

const THU_TU_GIAI_DOAN = { doc_san_pham: 0, day_ton: 1, lay_don: 2 };
/** Bước lấy đơn thường mất vài giây: cộng vào thời gian còn lại khi đang đẩy tồn */
const LAY_DON_UOC_TINH_MS = 2500;

export const dangChayDongBo = (p) => p?.trangThai === DB_TRANG_THAI.DANG_CHAY;

/** Phần trăm cả đợt: đọc sản phẩm 4%, đẩy tồn 88% chia đều theo SKU, lấy đơn 8%. */
export function phanTramDongBo(p) {
  if (!p) return 0;
  if (p.trangThai === DB_TRANG_THAI.XONG) return 100;
  const giaiDoan = THU_TU_GIAI_DOAN[p.giaiDoan] ?? 0;
  if (giaiDoan === 0) return 2;
  if (giaiDoan === 2) return 96;
  const tong = Number(p.tongSku);
  if (!(tong > 0)) return 92;
  return Math.round(4 + (88 * Math.min(Number(p.daXuLy) || 0, tong)) / tong);
}

/**
 * Thời gian còn lại (ms) khi đang đẩy tồn, theo tốc độ trung bình mỗi SKU tới giờ.
 * null khi chưa đủ số liệu (dưới 3 SKU) hoặc không ở bước đẩy tồn.
 */
export function uocTinhConLaiMs(p) {
  if (!dangChayDongBo(p) || p.giaiDoan !== "day_ton") return null;
  const tong = Number(p.tongSku);
  const daXuLy = Number(p.daXuLy) || 0;
  if (!(tong > 0) || daXuLy < 3 || p.dayTonDaChayMs == null) return null;
  const moiSku = Number(p.dayTonDaChayMs) / daXuLy;
  return Math.max(0, tong - daXuLy) * moiSku + LAY_DON_UOC_TINH_MS;
}

/** "Còn vài giây" / "Còn khoảng 25 giây" / "Còn khoảng 3 phút". */
export function moTaConLai(ms) {
  if (ms == null || Number.isNaN(ms)) return null;
  const giay = ms / 1000;
  if (giay < 10) return t("Còn vài giây");
  const lam = Math.round(giay / 5) * 5;
  if (lam < 60) return t("Còn khoảng {{lam}} giây", { lam });
  return t("Còn khoảng {{phut}} phút", { phut: Math.round(giay / 60) });
}

/** Câu thời gian còn lại cho chân bảng lúc đang chạy. */
export function cauConLai(p, conLaiMs) {
  if (!dangChayDongBo(p)) return null;
  if (p.giaiDoan === "lay_don") return t("Sắp xong");
  return moTaConLai(conLaiMs) ?? t("Đang ước tính thời gian");
}

/** Đồng hồ đã chạy: "0:07", "2:45". */
export function dongHoDaChay(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Thời lượng cả đợt: "43 giây", "2 phút 5 giây". */
export function thoiLuong(ms) {
  const s = Math.max(1, Math.round((Number(ms) || 0) / 1000));
  if (s < 60) return t("{{s}} giây", { s });
  return t("{{phut}} phút{{phanGiay}}", { phut: Math.floor(s / 60), phanGiay: s % 60 ? t(" {{giay}} giây", { giay: s % 60 }) : "" });
}

/** Kết quả gọn của đợt đã kết thúc: tone cho màu, nhan cho nút/chấm. */
export function ketQuaDongBo(p) {
  if (p?.trangThai === DB_TRANG_THAI.LOI) return { tone: "loi", tieuDe: t("Đồng bộ dừng giữa chừng"), nhan: t("Đồng bộ lỗi") };
  if (p?.trangThai === DB_TRANG_THAI.DA_DUNG) return { tone: "dung", tieuDe: t("Đã dừng đồng bộ"), nhan: t("Đã dừng") };
  if (p?.soLoi) return { tone: "canh", tieuDe: t("Đồng bộ xong"), nhan: t("Xong · {{soLoi}} SKU lỗi", { count: Number(p.soLoi), soLoi: formatNumber(p.soLoi) }) };
  return { tone: "ok", tieuDe: t("Đồng bộ xong"), nhan: t("Đã đồng bộ") };
}

/** Số SKU chưa đẩy của đợt dừng giữa chừng (0 nếu không có). */
export function soChuaDay(p) {
  if (p?.soChuaDay != null) return Number(p.soChuaDay);
  if (p?.tongSku == null) return 0;
  return Math.max(0, Number(p.tongSku) - (Number(p.daXuLy) || 0));
}

/**
 * Ba bước của đợt, mỗi bước { ma, ten, tt, phu }.
 * tt: "xong" | "dang" | "cho" | "canh" (xong nhưng có SKU lỗi) | "loi" | "dung" | "boqua".
 */
export function cacBuocDongBo(p, tenSan = "Shopify") {
  const chay = dangChayDongBo(p);
  const tt = p?.trangThai;
  const giaiDoan = THU_TU_GIAI_DOAN[p?.giaiDoan] ?? 0;
  const tong = p?.tongSku;

  let docSp;
  if (giaiDoan > 0) docSp = { tt: "xong", phu: `${formatNumber(tong)} SKU` };
  else if (chay) docSp = { tt: "dang", phu: t("Đang đọc…") };
  else if (tt === DB_TRANG_THAI.LOI) docSp = { tt: "loi", phu: t("Không đọc được") };
  else docSp = { tt: "dung", phu: t("Đã dừng") };

  const loi = p?.soLoi ? t(" · {{soLoi}} lỗi", { count: Number(p.soLoi), soLoi: formatNumber(p.soLoi) }) : "";
  let dayTon;
  if (giaiDoan < 1) dayTon = chay ? { tt: "cho", phu: t("Chờ") } : { tt: "boqua", phu: t("Chưa đẩy") };
  else if (giaiDoan === 1 && chay) dayTon = { tt: "dang", phu: `${formatNumber(p.daXuLy)}/${formatNumber(tong)} SKU${loi}` };
  else if (giaiDoan === 1 && tt === DB_TRANG_THAI.LOI) dayTon = { tt: "loi", phu: t("Dừng ở SKU {{thuTu}}/{{tong}}", { thuTu: formatNumber(Number(p.daXuLy) + 1), tong: formatNumber(tong) }) };
  else if (giaiDoan === 1 && tt === DB_TRANG_THAI.DA_DUNG) dayTon = { tt: "dung", phu: t("Đã đẩy {{daXuLy}}/{{tong}} SKU", { count: Number(tong), daXuLy: formatNumber(p.daXuLy), tong: formatNumber(tong) }) };
  else dayTon = { tt: p?.soLoi ? "canh" : "xong", phu: `${formatNumber(p?.soThanhCong)}/${formatNumber(tong)} SKU${loi}` };

  let layDon;
  if (giaiDoan < 2) layDon = chay ? { tt: "cho", phu: t("Đơn 24 giờ qua") } : { tt: "boqua", phu: t("Chưa lấy") };
  else if (chay) layDon = { tt: "dang", phu: t("Đang lấy…") };
  else if (tt === DB_TRANG_THAI.XONG) layDon = { tt: "xong", phu: p.soDonMoi ? t("{{soDonMoi}} đơn mới", { soDonMoi: formatNumber(p.soDonMoi), count: Number(p.soDonMoi) || 0 }) : t("Không có đơn mới") };
  else layDon = { tt: "loi", phu: t("Không lấy được") };

  return [
    { ma: "doc-san-pham", ten: t("Đọc sản phẩm trên {{tenSan}}", { tenSan }), ...docSp },
    { ma: "day-ton", ten: t("Đẩy tồn kho"), ...dayTon },
    { ma: "lay-don", ten: t("Lấy đơn mới"), ...layDon },
  ];
}
