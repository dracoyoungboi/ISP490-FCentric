/**
 * Quy tắc mã vạch dùng chung cho màn Kiểm đếm & khóa lô và trang Mã vạch nhà cung cấp.
 * Khớp MaVachUtils.java ở backend (ký tự hợp lệ, tiền tố FC-, số kiểm tra GS1).
 * Không import alias "@/…" để chạy được bằng `node --test`.
 */

/** Ký tự có thể in trên tem mã vạch: chữ không dấu, số và . _ / - */
export const KY_TU_MA_VACH = /^[A-Za-z0-9._/-]+$/;

export const kyTuHopLe = (ma) => KY_TU_MA_VACH.test(String(ma ?? ""));

/** Tiền tố dành riêng cho thẻ lệnh kiểm đếm; SKU và mã NCC không được bắt đầu bằng tiền tố này. */
export const TIEN_TO_THE_LENH = "FC-";

/** Số lượng tối đa của một lượt quét kiểu "12*MÃ" (một thùng). */
export const SO_LUONG_TOI_DA_MOI_LUOT = 999;

/**
 * Tách "12*MÃ" (kiểu máy POS: số × mã) thành { soLuong: 12, ma: "MÃ" }. Không có tiền tố thì soLuong = 1.
 * Khoảng trắng hai đầu được bỏ. Số trước dấu * ngoài 1..999 thì trả `loi` (không tự đổi thành số khác).
 */
export function tachSoLuong(raw) {
  const chuoi = String(raw ?? "").trim();
  const khop = /^(\d+)\s*\*\s*(.+)$/.exec(chuoi);
  if (!khop) return { soLuong: 1, ma: chuoi };
  const n = Number(khop[1]);
  const ma = khop[2].trim();
  if (!Number.isInteger(n) || n < 1 || n > SO_LUONG_TOI_DA_MOI_LUOT) {
    return { soLuong: null, ma, loi: `Số lượng trước dấu * phải từ 1 đến ${SO_LUONG_TOI_DA_MOI_LUOT}.` };
  }
  return { soLuong: n, ma };
}

const DANG_GS1 = { 8: "EAN-8", 12: "UPC-A", 13: "EAN-13", 14: "GTIN-14" };

/**
 * Kiểm số kiểm tra GS1 (EAN-8, UPC-A, EAN-13, GTIN-14).
 * Trả { kieu, ok }: kieu null nếu mã không phải dạng GS1 (khi đó ok cũng null).
 */
export function gs1(ma) {
  const chuoi = String(ma ?? "");
  const kieu = DANG_GS1[chuoi.length];
  if (!kieu || !/^\d+$/.test(chuoi)) return { kieu: null, ok: null };
  const so = chuoi.split("").map(Number);
  const kiemTra = so.pop();
  let tong = 0;
  so.reverse().forEach((x, i) => {
    tong += x * (i % 2 === 0 ? 3 : 1);
  });
  return { kieu, ok: (10 - (tong % 10)) % 10 === kiemTra };
}

/** Dòng mô tả dạng mã cho hộp "Mã chưa có trong hệ thống". tone: ok | bad | neutral. */
export function moTaDangMa(ma) {
  const chuoi = String(ma ?? "");
  const g = gs1(chuoi);
  const dem = `${chuoi.length} ${/^\d+$/.test(chuoi) ? "chữ số" : "ký tự, có chữ"}`;
  if (!g.kieu) return { chu: dem, tone: "neutral", gs1: g };
  return g.ok
    ? { chu: `${dem} · dạng ${g.kieu} · đúng số kiểm tra`, tone: "ok", gs1: g }
    : { chu: `${dem} · dạng ${g.kieu} · sai số kiểm tra, mã đã bị đọc lệch`, tone: "bad", gs1: g };
}

/** Khoảng cách Levenshtein (số ký tự phải thêm / bớt / thay). */
export function lev(a, b) {
  const x = String(a ?? "");
  const y = String(b ?? "");
  let truoc = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i += 1) {
    const nay = [i];
    for (let j = 1; j <= y.length; j += 1) {
      nay[j] = Math.min(truoc[j] + 1, nay[j - 1] + 1, truoc[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    truoc = nay;
  }
  return truoc[y.length];
}

/**
 * Mã đã có gần giống mã vừa quét (máy quét đọc lệch 1–2 ký tự):
 * lệch tối đa 1 ký tự với mã ngắn, 2 ký tự với mã từ 10 ký tự; chỉ giữ nhóm lệch ít nhất, tối đa 3 mã.
 * `ungVien`: [{ ma, nhan, ... }]. Mỗi kết quả thêm `lech` (số ký tự lệch) và `kyTu` [{ c, lech }] để tô ký tự khác.
 * Không so chữ hoa / thường.
 */
export function ganGiong(ma, ungVien) {
  const hoa = String(ma ?? "").toUpperCase();
  if (!hoa) return [];
  const nguong = hoa.length >= 10 ? 2 : 1;
  const daGap = new Set();
  const ds = [];
  for (const u of ungVien ?? []) {
    const maU = String(u?.ma ?? "");
    const khoa = maU.toUpperCase();
    if (!khoa || daGap.has(khoa)) continue;
    daGap.add(khoa);
    const d = lev(hoa, khoa);
    if (d > 0 && d <= nguong) ds.push({ ...u, ma: maU, lech: d });
  }
  const itNhat = ds.reduce((m, u) => Math.min(m, u.lech), Infinity);
  return ds
    .filter((u) => u.lech === itNhat)
    .slice(0, 3)
    .map((u) => {
      const cungDai = u.ma.length === hoa.length;
      return { ...u, kyTu: u.ma.split("").map((c, i) => ({ c, lech: cungDai && c.toUpperCase() !== hoa[i] })) };
    });
}

/**
 * Mã đã có mà mã vừa quét là PHẦN ĐẦU của nó (máy quét đọc thiếu đuôi, hoặc chỉ quét được một phần tem).
 * Chỉ xét mã quét từ 6 ký tự; tối đa 3 mã, mã ngắn nhất trước. Mỗi kết quả có `thieu` (số ký tự thiếu) và `kyTu`
 * (phần đuôi thiếu được đánh dấu `lech`).
 */
export function phanDauCua(ma, ungVien) {
  const hoa = String(ma ?? "").toUpperCase();
  if (hoa.length < 6) return [];
  const daGap = new Set();
  const ds = [];
  for (const u of ungVien ?? []) {
    const maU = String(u?.ma ?? "");
    const khoa = maU.toUpperCase();
    if (!khoa || daGap.has(khoa)) continue;
    daGap.add(khoa);
    if (khoa.length > hoa.length && khoa.startsWith(hoa)) ds.push({ ...u, ma: maU, thieu: khoa.length - hoa.length });
  }
  return ds
    .sort((a, b) => a.thieu - b.thieu)
    .slice(0, 3)
    .map((u) => ({ ...u, kyTu: u.ma.split("").map((c, i) => ({ c, lech: i >= hoa.length })) }));
}

/** Từ khóa tìm kiếm trông như một mã vạch (để trang Mã vạch NCC gợi ý mã gần giống khi không thấy). */
export const trongNhuMa = (q) => String(q ?? "").trim().length >= 6 && kyTuHopLe(String(q).trim());
