// Dữ liệu của chuông thông báo trên thanh trên cùng (NotificationBell.jsx, useThongBao.js): thuần dữ liệu, không React,
// không gọi máy chủ, để kiểm thử bằng node --test. Khác "thông báo nhanh" (toast) ở lib/thongBaoNhanh.

/** Màu ô biểu tượng NotificationBell hỗ trợ (MAU_O_BIEU_TUONG); giá trị khác coi như "info". */
export const TONE_THONG_BAO = Object.freeze(["info", "warning", "danger", "success"]);

const thoiDiem = (n) => {
  const t = new Date(n.thoiGian).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** Mới nhất trước; cùng thời điểm thì id lớn (tạo sau) trước, như máy chủ xếp. */
const moiNhatTruoc = (a, b) => thoiDiem(b) - thoiDiem(a) || Number(b.id) - Number(a.id) || 0;

/** Chỉ nhận đường dẫn trong ứng dụng ("/transfer-tickets/12"), không mở trang ngoài. */
const duongDanTrongUngDung = (s) => (typeof s === "string" && s.startsWith("/") && !s.startsWith("//") ? s : null);

/**
 * Một dòng API /api/v1/thong-bao → một dòng của chuông: { id, loai, tone, nhom, tieuDe, moTa, duongDan, thoiGian, daDoc }.
 * Thiếu id hoặc tiêu đề thì trả null (bỏ dòng).
 */
export function chuyenDongThongBao(d) {
  if (!d || d.id == null || typeof d.tieuDe !== "string" || !d.tieuDe.trim()) return null;
  return {
    id: d.id,
    loai: d.loai ?? null,
    tone: TONE_THONG_BAO.includes(d.tone) ? d.tone : "info",
    nhom: d.nhom || null,
    tieuDe: d.tieuDe,
    moTa: d.moTa || null,
    duongDan: duongDanTrongUngDung(d.duongDan),
    thoiGian: d.thoiGian ?? null,
    daDoc: Boolean(d.daDoc),
  };
}

/**
 * Một trang API { content, totalElements, totalPages, soChuaDoc } → { items, soChuaDoc }: items mới nhất trước, không
 * trùng id; soChuaDoc là số chưa đọc của mọi trang (máy chủ đếm), không nhỏ hơn số chưa đọc đang thấy. Máy chủ không trả
 * soChuaDoc thì đếm trên trang này.
 */
export function chuyenDanhSachThongBao(data) {
  const ds = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : [];
  const daCo = new Set();
  const items = [];
  for (const d of ds) {
    const n = chuyenDongThongBao(d);
    if (!n || daCo.has(n.id)) continue;
    daCo.add(n.id);
    items.push(n);
  }
  items.sort(moiNhatTruoc);
  const chuaDocTrongTrang = items.filter((n) => !n.daDoc).length;
  const soMayChu = Number(data?.soChuaDoc);
  const soChuaDoc =
    data?.soChuaDoc != null && Number.isFinite(soMayChu) && soMayChu >= 0
      ? Math.max(Math.floor(soMayChu), chuaDocTrongTrang)
      : chuaDocTrongTrang;
  return { items, soChuaDoc };
}

/** Đánh dấu một thông báo đã đọc trong { items, soChuaDoc }: chỉ trừ số khi dòng đó đang chưa đọc. */
export function daDocMot(tt, id) {
  const n = tt.items.find((x) => x.id === id);
  if (!n || n.daDoc) return tt;
  return {
    items: tt.items.map((x) => (x.id === id ? { ...x, daDoc: true } : x)),
    soChuaDoc: Math.max(0, tt.soChuaDoc - 1),
  };
}

/** Đánh dấu mọi thông báo đã đọc: mọi dòng đã đọc, số chưa đọc về 0. */
export function daDocTatCa(tt) {
  return { items: tt.items.map((n) => (n.daDoc ? n : { ...n, daDoc: true })), soChuaDoc: 0 };
}
