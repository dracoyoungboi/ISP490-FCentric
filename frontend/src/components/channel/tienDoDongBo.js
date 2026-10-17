/**
 * Đọc ảnh chụp tiến độ "Đồng bộ ngay" (DongBoNgayDto của máy chủ) thành số liệu hiển thị.
 * Hàm thuần, không gọi API: dùng chung cho nút, bảng thả xuống và kiểm thử.
 */

export const DB_TRANG_THAI = { DANG_CHAY: "dang_chay", XONG: "xong", LOI: "loi", DA_DUNG: "da_dung" };

const THU_TU_GIAI_DOAN = { doc_san_pham: 0, day_ton: 1, lay_don: 2 };
/** Bước lấy đơn thường mất vài giây: cộng vào thời gian còn lại khi đang đẩy tồn */
const LAY_DON_UOC_TINH_MS = 2500;

const so = (n) => Number(n || 0).toLocaleString("vi-VN");

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
  if (giay < 10) return "Còn vài giây";
  const lam = Math.round(giay / 5) * 5;
  if (lam < 60) return `Còn khoảng ${lam} giây`;
  return `Còn khoảng ${Math.round(giay / 60)} phút`;
}

/** Câu thời gian còn lại cho chân bảng lúc đang chạy. */
export function cauConLai(p, conLaiMs) {
  if (!dangChayDongBo(p)) return null;
  if (p.giaiDoan === "lay_don") return "Sắp xong";
  return moTaConLai(conLaiMs) ?? "Đang ước tính thời gian";
}

/** Đồng hồ đã chạy: "0:07", "2:45". */
export function dongHoDaChay(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Thời lượng cả đợt: "43 giây", "2 phút 5 giây". */
export function thoiLuong(ms) {
  const s = Math.max(1, Math.round((Number(ms) || 0) / 1000));
  if (s < 60) return `${s} giây`;
  return `${Math.floor(s / 60)} phút${s % 60 ? ` ${s % 60} giây` : ""}`;
}

/** Kết quả gọn của đợt đã kết thúc: tone cho màu, nhan cho nút/chấm. */
export function ketQuaDongBo(p) {
  if (p?.trangThai === DB_TRANG_THAI.LOI) return { tone: "loi", tieuDe: "Đồng bộ dừng giữa chừng", nhan: "Đồng bộ lỗi" };
  if (p?.trangThai === DB_TRANG_THAI.DA_DUNG) return { tone: "dung", tieuDe: "Đã dừng đồng bộ", nhan: "Đã dừng" };
  if (p?.soLoi) return { tone: "canh", tieuDe: "Đồng bộ xong", nhan: `Xong · ${so(p.soLoi)} SKU lỗi` };
  return { tone: "ok", tieuDe: "Đồng bộ xong", nhan: "Đã đồng bộ" };
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
  if (giaiDoan > 0) docSp = { tt: "xong", phu: `${so(tong)} SKU` };
  else if (chay) docSp = { tt: "dang", phu: "Đang đọc…" };
  else if (tt === DB_TRANG_THAI.LOI) docSp = { tt: "loi", phu: "Không đọc được" };
  else docSp = { tt: "dung", phu: "Đã dừng" };

  const loi = p?.soLoi ? ` · ${so(p.soLoi)} lỗi` : "";
  let dayTon;
  if (giaiDoan < 1) dayTon = chay ? { tt: "cho", phu: "Chờ" } : { tt: "boqua", phu: "Chưa đẩy" };
  else if (giaiDoan === 1 && chay) dayTon = { tt: "dang", phu: `${so(p.daXuLy)}/${so(tong)} SKU${loi}` };
  else if (giaiDoan === 1 && tt === DB_TRANG_THAI.LOI) dayTon = { tt: "loi", phu: `Dừng ở SKU ${so(Number(p.daXuLy) + 1)}/${so(tong)}` };
  else if (giaiDoan === 1 && tt === DB_TRANG_THAI.DA_DUNG) dayTon = { tt: "dung", phu: `Đã đẩy ${so(p.daXuLy)}/${so(tong)} SKU` };
  else dayTon = { tt: p?.soLoi ? "canh" : "xong", phu: `${so(p?.soThanhCong)}/${so(tong)} SKU${loi}` };

  let layDon;
  if (giaiDoan < 2) layDon = chay ? { tt: "cho", phu: "Đơn 24 giờ qua" } : { tt: "boqua", phu: "Chưa lấy" };
  else if (chay) layDon = { tt: "dang", phu: "Đang lấy…" };
  else if (tt === DB_TRANG_THAI.XONG) layDon = { tt: "xong", phu: p.soDonMoi ? `${so(p.soDonMoi)} đơn mới` : "Không có đơn mới" };
  else layDon = { tt: "loi", phu: "Không lấy được" };

  return [
    { ma: "doc-san-pham", ten: `Đọc sản phẩm trên ${tenSan}`, ...docSp },
    { ma: "day-ton", ten: "Đẩy tồn kho", ...dayTon },
    { ma: "lay-don", ten: "Lấy đơn mới", ...layDon },
  ];
}
