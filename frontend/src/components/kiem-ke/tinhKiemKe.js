/*
 * Hàm thuần của màn Chi tiết đợt kiểm kê (/stock-take/:id): dòng lô, số đếm, lọc, tìm / quét mã lô, tiến độ, giao dịch
 * xen giữa (Q16b), dữ liệu gửi khi hoàn thành (chỉ lô đã đếm — Q16a), tiến trình, thông báo, tệp CSV số đếm.
 * Không gọi API, không phụ thuộc React, chạy được bằng `node --test`.
 *
 * Dữ liệu máy chủ (PhieuKiemKeService):
 * - Đợt (DotKiemKeDto): trangThai 0 Đang kiểm kê · 1 Hoàn thành; kho chỉ có { id, tenKho }.
 * - Dòng (ChiTietKiemKeDto): mỗi lô có tồn trong kho lúc tạo đợt một dòng (kể cả lô tồn 0); soLuongHeThong chụp lúc tạo.
 *   Hoàn thành chỉ ghi các dòng được gửi: dòng không gửi giữ soLuongThucTe = 0 và loaiChenhLech = null → "Không đếm".
 * Số đếm dở lưu trên máy (banTamKiemKe.js): `soDem` = { [chiTietId]: { so, luc } } — `luc` là giờ đếm (ms, đã chỉnh theo
 * giờ máy chủ khi đọc được) để so với lịch sử giao dịch kho.
 */
import { DUNG_SAI_GIO_KIEM_KE_MS, SO_LO_LECH_HIEN } from "../../config/bangChungTu.js";
import { docSo, khopTuKhoa, soVN, tachTuKhoa } from "../chung-tu/bangChungTu.js";

export const TT_DOT_KIEM_KE = Object.freeze({ DANG_KIEM_KE: 0, HOAN_THANH: 1 });

export const laDotXong = (dot) => Number(dot?.trangThai) === TT_DOT_KIEM_KE.HOAN_THANH;

const coSo = (v) => v != null && v !== "" && Number.isFinite(Number(v));

/** Đổi chi tiết của máy chủ sang dòng của bảng (giữ thứ tự máy chủ trả). */
export function dongKiemKe(chiTiet) {
  return (Array.isArray(chiTiet) ? chiTiet : []).filter((ct) => ct?.id != null).map((ct) => {
    const bt = ct.bienTheSanPham ?? {};
    const daGhi = ct.loaiChenhLech != null;
    return {
      id: ct.id,
      loHangId: ct.loHang?.id ?? null,
      maLo: ct.loHang?.maLo || "",
      bienTheId: bt.id ?? null,
      // Tên hiện nguyên "Tên - Màu / Kích cỡ" của máy chủ, không tách; tenSanPham để ô tìm dùng chung khớp theo tên
      tenSanPham: bt.tenBienThe || bt.maSku || "",
      sku: bt.maSku || "",
      heThong: docSo(ct.soLuongHeThong),
      thucTeMayChu: daGhi ? docSo(ct.soLuongThucTe) : null,
      chenhLechMayChu: daGhi ? docSo(ct.chenhLechSoLuong) : null,
      loaiMayChu: daGhi ? String(ct.loaiChenhLech) : null,
    };
  });
}

const loaiTheoLech = (lech) => (lech > 0 ? "thua" : lech < 0 ? "thieu" : "khop");

/**
 * Dòng kèm số đếm và loại: "chua" (đang kiểm kê, chưa đếm) · "khop" · "thua" · "thieu" · "khongDem" (đợt đã xong, dòng
 * không được gửi). `xen`: Set id dòng có giao dịch kho sau lúc đếm (chỉ khi đang kiểm kê). `goc`: dòng gốc (ô tìm nhớ chữ
 * tìm theo đối tượng này nên không tính lại sau mỗi lần đếm).
 */
export function tinhDong(dong, { soDem = {}, daXong = false, xen = null } = {}) {
  return (Array.isArray(dong) ? dong : []).map((d) => {
    if (daXong) {
      const loai = d.loaiMayChu == null ? "khongDem" : ["thua", "thieu", "khop"].includes(d.loaiMayChu) ? d.loaiMayChu : loaiTheoLech(d.chenhLechMayChu);
      return { ...d, goc: d, so: d.thucTeMayChu, lech: d.chenhLechMayChu, loai, xen: false, luc: null };
    }
    const muc = soDem?.[d.id];
    if (!muc || !coSo(muc.so)) return { ...d, goc: d, so: null, lech: null, loai: "chua", xen: false, luc: null };
    const so = Number(muc.so);
    const lech = so - d.heThong;
    return {
      ...d,
      goc: d,
      so,
      lech,
      loai: loaiTheoLech(lech),
      xen: Boolean(xen?.has?.(d.id)),
      luc: muc.luc ?? null,
      lucHien: muc.lucHien ?? null,
    };
  });
}

/** Đếm của cả đợt (không theo tìm / lọc). `daDem`: lô đã có số (đang kiểm kê: trên máy; đã xong: máy chủ đã ghi). */
export function demKiemKe(rows) {
  const ds = Array.isArray(rows) ? rows : [];
  const dem = { tong: ds.length, daDem: 0, chua: 0, khongDem: 0, khop: 0, thua: 0, thieu: 0, spThua: 0, spThieu: 0, xen: 0 };
  const bienThe = new Set();
  for (const d of ds) {
    bienThe.add(d.bienTheId ?? d.sku);
    if (d.loai === "chua") dem.chua += 1;
    else if (d.loai === "khongDem") dem.khongDem += 1;
    else {
      dem.daDem += 1;
      dem[d.loai] += 1;
      if (d.loai === "thua") dem.spThua += d.lech;
      if (d.loai === "thieu") dem.spThieu -= d.lech;
    }
    if (d.xen) dem.xen += 1;
  }
  dem.lech = dem.thua + dem.thieu;
  dem.soBienThe = bienThe.size;
  dem.phanTram = dem.tong ? Math.round((dem.daDem / dem.tong) * 100) : 0;
  return dem;
}

/** Đợt đã xong mà không dòng nào được ghi: đóng bằng "Đóng đợt, không đổi tồn" (gửi danh sách rỗng). */
export const laDotDaDong = (daXong, dem) => Boolean(daXong) && dem.tong > 0 && dem.khongDem === dem.tong;

// ── Lọc ──────────────────────────────────────────────────────────────────────

export const BO_LOC_KIEM_KE = Object.freeze({
  chua: (d) => d.loai === "chua",
  da: (d) => d.loai !== "chua" && d.loai !== "khongDem",
  lech: (d) => d.loai === "thua" || d.loai === "thieu",
  thua: (d) => d.loai === "thua",
  thieu: (d) => d.loai === "thieu",
  khop: (d) => d.loai === "khop",
  khongDem: (d) => d.loai === "khongDem",
  xen: (d) => d.xen,
  tatCa: null,
});

/**
 * Các lựa chọn lọc theo tình huống. Đang kiểm kê: Chưa đếm / Lệch / Khớp (đếm mù: Chưa đếm / Đã đếm) / Cần đếm lại (khi
 * có) / Tất cả. Đã xong: Lệch / Thừa / Thiếu / Khớp / Không đếm (khi có) / Tất cả.
 */
export function luaChonLoc({ daXong, mu, dem, giuXen = false }) {
  const m = (value, label, count) => ({ value, label, count });
  if (daXong) {
    return [
      m("lech", "Lệch", dem.lech),
      m("thua", "Thừa", dem.thua),
      m("thieu", "Thiếu", dem.thieu),
      m("khop", "Khớp", dem.khop),
      dem.khongDem ? m("khongDem", "Không đếm", dem.khongDem) : null,
      m("tatCa", "Tất cả", dem.tong),
    ].filter(Boolean);
  }
  return [
    m("chua", "Chưa đếm", dem.chua),
    ...(mu ? [m("da", "Đã đếm", dem.daDem)] : [m("lech", "Lệch", dem.lech), m("khop", "Khớp", dem.khop)]),
    // `giuXen`: đang xem "Cần đếm lại" thì giữ lựa chọn này dù vừa đếm lại hết (bảng không tự nhảy sang bộ lọc khác)
    dem.xen || giuXen ? m("xen", "Cần đếm lại", dem.xen) : null,
    m("tatCa", "Tất cả", dem.tong),
  ].filter(Boolean);
}

/** Lọc mặc định: đang kiểm kê → Chưa đếm; đã xong → Lệch (không lô nào lệch, hoặc đợt đã đóng → Tất cả). */
export function locMacDinh({ daXong, dem }) {
  if (!daXong) return "chua";
  return dem.lech > 0 ? "lech" : "tatCa";
}

/** Tên bộ lọc trong câu "Không có lô … ." */
export const TEN_LOC = Object.freeze({
  chua: "chưa đếm",
  da: "đã đếm",
  lech: "lệch",
  thua: "thừa",
  thieu: "thiếu",
  khop: "khớp",
  khongDem: "không đếm",
  xen: "cần đếm lại",
});

// ── Tìm / quét ───────────────────────────────────────────────────────────────

/**
 * Tìm trên MỌI lô (bỏ qua bộ lọc, để quét được cả lô đã đếm). Ưu tiên trùng đúng mã lô (quét tem lô) → `kieu` "lo";
 * gõ / quét đúng SKU có nhiều lô → "sku" (nhắc quét mã lô trên tem); còn lại tìm theo tên, SKU, mã lô → "tim".
 * Từ khóa trống → null.
 */
export function timLo(rows, tuKhoa) {
  const chu = String(tuKhoa ?? "").trim();
  if (!chu) return null;
  const ds0 = Array.isArray(rows) ? rows : [];
  const thuong = chu.toLowerCase();
  const theoLo = ds0.filter((d) => d.maLo && d.maLo.toLowerCase() === thuong);
  if (theoLo.length) return { ds: theoLo, kieu: "lo" };
  const tu = tachTuKhoa(chu);
  const ds = ds0.filter((d) => khopTuKhoa(d.goc ?? d, tu));
  const laSku = ds.length > 1 && ds.every((d) => d.sku && d.sku.toLowerCase() === thuong);
  return { ds, kieu: laSku ? "sku" : "tim" };
}

/** Chữ kết quả cạnh ô tìm. */
export function chuKetQuaTim(kq) {
  if (!kq || !kq.ds.length) return "";
  // Mã lô do người nhập gõ, cùng mã có thể ở nhiều biến thể: khi đó chọn đúng sản phẩm, không tô dòng nào
  if (kq.kieu === "lo" && kq.ds.length > 1) return `Mã lô này có ở ${soVN(kq.ds.length)} sản phẩm · nhập số ở đúng dòng sản phẩm`;
  if (kq.kieu === "lo") return "Đúng mã lô · nhập số đếm ở dòng tô xanh";
  if (kq.kieu === "sku") return `SKU này có ${soVN(kq.ds.length)} lô · quét mã lô trên tem để chọn đúng lô`;
  return `Tìm thấy ${soVN(kq.ds.length)} lô`;
}

/**
 * Các dòng hiện trong bảng: có từ khóa → kết quả tìm (bỏ qua bộ lọc); không thì theo bộ lọc, cộng các dòng vừa nhập số
 * (`giuLai`: Set id) để dòng không biến mất ngay khi đang đếm ở bộ lọc "Chưa đếm".
 */
export function dongHienThi(rows, { tuKhoa = "", loc = "tatCa", giuLai = null } = {}) {
  const kq = timLo(rows, tuKhoa);
  if (kq) return kq.ds;
  const ham = BO_LOC_KIEM_KE[loc] ?? null;
  const ds = Array.isArray(rows) ? rows : [];
  if (!ham) return ds;
  return ds.filter((d) => ham(d) || Boolean(giuLai?.has?.(d.id)));
}

// ── Số đếm ───────────────────────────────────────────────────────────────────

/** Chữ gõ vào ô Thực tế → số nguyên ≥ 0 (bỏ ký tự không phải số, cắt theo số chữ số tối đa) hoặc null (ô trống). */
export function docSoDem(chu, toiDa) {
  const soChu = String(Math.max(1, Math.floor(docSo(toiDa)))).length;
  const chuSo = String(chu ?? "").replace(/\D/g, "").slice(0, soChu);
  if (!chuSo) return null;
  return Math.min(Number(chuSo), docSo(toiDa));
}

// ── Giao dịch xen giữa (Q16b) ────────────────────────────────────────────────

/** Giờ của một mốc máy chủ (chuỗi ISO, hoặc số giây / mili giây) → ms; không đọc được → NaN. */
export function msCua(v) {
  if (v == null || v === "") return NaN;
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  return Date.parse(v);
}

/** Lệch giữa giờ máy chủ (header Date) và giờ máy này lúc nhận trả lời; không đọc được → 0. */
export function lechGioMayChu(dateHeader, nowMs) {
  const t = Date.parse(dateHeader ?? "");
  return Number.isFinite(t) && Number.isFinite(nowMs) ? t - nowMs : 0;
}

// Khóa lô: mã lô + SKU (mã lô do người nhập gõ, cùng mã có thể ở nhiều biến thể). Lịch sử thiếu SKU thì dùng khóa chung "*".
const khoaLo = (maLo, sku) => `${String(maLo ?? "").toLowerCase()}|${sku ? String(sku).toLowerCase() : "*"}`;

/** Giờ giao dịch muộn nhất đã biết của một lô (theo mã lô + SKU, cả khóa chung khi lịch sử thiếu SKU); không có → undefined. */
function gioGiaoDichCua(muonNhat, maLo, sku) {
  if (!maLo || !muonNhat?.get) return undefined;
  const a = muonNhat.get(khoaLo(maLo, sku));
  const b = muonNhat.get(khoaLo(maLo, null));
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

/**
 * Giờ giao dịch muộn nhất (ms) của từng lô ở kho của đợt, từ lịch sử giao dịch kho: Map("mã lô|sku" viết thường → ms). Bỏ
 * dòng lịch sử của chính đợt này (điều chỉnh khi hoàn thành).
 */
export function gioMuonNhatTheoLo(lichSu, { khoId, dotId = null } = {}) {
  const muonNhat = new Map();
  if (!Array.isArray(lichSu) || khoId == null) return muonNhat;
  for (const ls of lichSu) {
    if (!ls?.maLo || Number(ls.khoId) !== Number(khoId)) continue;
    if (dotId != null && ls.loaiThamChieu === "kiem_ke" && Number(ls.idThamChieu) === Number(dotId)) continue;
    const t = msCua(ls.ngayGiaoDich);
    if (!Number.isFinite(t)) continue;
    const khoa = khoaLo(ls.maLo, ls.maSku);
    if (!(muonNhat.get(khoa) >= t)) muonNhat.set(khoa, t);
  }
  return muonNhat;
}

/**
 * Giờ ghi cho một lần đếm: giờ máy này chỉnh theo máy chủ (`lech`), nhưng không sớm hơn giao dịch đã biết của lô cộng dung
 * sai — người đếm lúc này đã thấy (đếm sau) mọi giao dịch có trong lịch sử vừa tải, nên đếm lại một lô "Đếm lại" là hết cờ.
 */
export function gioDem({ bayGio, lech = 0, maLo, sku, muonNhat, dungSai = DUNG_SAI_GIO_KIEM_KE_MS }) {
  const t = Number(bayGio) + (Number(lech) || 0);
  const gd = gioGiaoDichCua(muonNhat, maLo, sku);
  return gd != null && Number.isFinite(gd) ? Math.max(t, gd + dungSai + 1) : t;
}

/**
 * Các dòng (Set id) có giao dịch kho của lô ghi sau lúc đếm dòng đó (trừ khoảng dung sai đồng hồ): lọc lịch sử theo kho của
 * đợt + mã lô (gioMuonNhatTheoLo; truyền sẵn `muonNhat` thì dùng luôn). Dòng chưa có giờ đếm thì không xét được.
 */
export function loXenGiua(lichSu, { khoId, dotId = null, rows, dungSai = DUNG_SAI_GIO_KIEM_KE_MS, muonNhat: muonNhatCo } = {}) {
  const ra = new Set();
  const muonNhat = muonNhatCo ?? gioMuonNhatTheoLo(lichSu, { khoId, dotId });
  if (!muonNhat.size) return ra;
  for (const d of Array.isArray(rows) ? rows : []) {
    if (d.loai === "chua" || d.loai === "khongDem" || !d.maLo || d.luc == null) continue;
    const luc = Number(d.luc);
    if (!Number.isFinite(luc)) continue;
    const t = gioGiaoDichCua(muonNhat, d.maLo, d.sku);
    if (t != null && t > luc - dungSai) ra.add(d.id);
  }
  return ra;
}

// ── Hoàn thành ───────────────────────────────────────────────────────────────

/**
 * Tóm tắt cho hộp Hoàn thành và dữ liệu gửi: chỉ lô ĐÃ ĐẾM và không có giao dịch sau lúc đếm (Q16a: lô chưa đếm không gửi,
 * tồn giữ nguyên). Thừa / thiếu / lệch nhiều nhất tính trên lô được gửi.
 */
export function tomTatHoanThanh(rows) {
  const ds = Array.isArray(rows) ? rows : [];
  const gui = ds.filter((d) => d.loai !== "chua" && d.loai !== "khongDem" && !d.xen && d.so != null);
  const lech = gui.filter((d) => d.loai === "thua" || d.loai === "thieu").sort((a, b) => Math.abs(b.lech) - Math.abs(a.lech));
  const thua = gui.filter((d) => d.loai === "thua");
  const thieu = gui.filter((d) => d.loai === "thieu");
  return {
    soGui: gui.length,
    daDem: ds.filter((d) => d.loai !== "chua" && d.loai !== "khongDem").length,
    tong: ds.length,
    chua: ds.filter((d) => d.loai === "chua").length,
    xen: ds.filter((d) => d.xen).length,
    thua: thua.length,
    spThua: thua.reduce((t, d) => t + d.lech, 0),
    thieu: thieu.length,
    spThieu: thieu.reduce((t, d) => t - d.lech, 0),
    soLech: lech.length,
    top: lech.slice(0, SO_LO_LECH_HIEN),
    duLieu: gui.map((d) => ({ chiTietId: d.id, soLuongThucTe: d.so })),
  };
}

/** Lý do khóa nút Hoàn thành (hiện dưới đầu khối), "" khi bấm được. `dongDuoc`: người này có mục Đóng đợt trong menu. */
export function lyDoKhoaHoanThanh(tt, { dongDuoc = false } = {}) {
  if (!tt.daDem) {
    return dongDuoc ? "Chưa đếm lô nào. Muốn bỏ đợt này thì dùng Đóng đợt, không đổi tồn trong menu ⋯" : "Chưa đếm lô nào";
  }
  if (!tt.soGui) return "Mọi lô đã đếm đều có nhập hoặc xuất sau lúc đếm, cần đếm lại";
  return "";
}

// ── Tiến trình, thông báo ────────────────────────────────────────────────────

/**
 * Ba bước: Tạo đợt → Đếm hàng (x/y lô) → Hoàn thành / Đã đóng đợt. `chiXem`: người không đếm đợt này (kho không được phân)
 * không thấy số đếm (nằm trên máy người đếm) nên bước Đếm hàng chỉ ghi tổng số lô.
 */
export function buocKiemKe({ dot, dem, daXong, daDong, chiXem = false }) {
  return [
    { ma: "tao", nhan: "Tạo đợt", trangThai: "xong", ngay: dot?.ngayBatDau ?? dot?.ngayTao ?? null, coGio: true },
    {
      ma: "dem",
      nhan: "Đếm hàng",
      trangThai: daXong ? "xong" : "dangLam",
      phu: chiXem && !daXong ? `${soVN(dem.tong)} lô` : `${soVN(dem.daDem)}/${soVN(dem.tong)} lô`,
    },
    {
      ma: "xong",
      nhan: daDong ? "Đã đóng đợt" : "Hoàn thành",
      trangThai: daXong ? "xong" : "chua",
      ngay: daXong ? dot?.ngayHoanThanh ?? null : null,
      coGio: true,
    },
  ];
}

const pad2 = (n) => String(n).padStart(2, "0");

/** "08:30 · 21/10" theo giờ máy người dùng; không đọc được → "". */
export function gioNgay(v) {
  const t = msCua(v);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} · ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

/**
 * Các dòng thông báo (thứ tự hiện), mỗi dòng `{ ma, tone, chu, hanhDong? }` — `hanhDong` là mã nút màn tự gắn:
 * "xemXen" · "thuLaiXen" · "xoaBanTam" · "tatMu" · "taiCsvMat".
 * @param o
 *   - `dot`, `daXong`, `daDong`, `chiXem` (đợt của kho không được phân), `doiKho` (tên kho vừa tự chuyển nơi làm việc)
 *   - `dem` (demKiemKe), `mu` (đang đếm mù), `loiXen` (câu lỗi tải lịch sử giao dịch), `khoiPhuc` ({ soDong, luc } | null)
 *   - `nguoiKhac` (số tài khoản khác có bản đếm dở trên máy), `soMat` (số lô đã đếm trên máy mà lần hoàn thành ở nơi khác
 *     không gửi), `daGuiXong` (vừa hoàn thành / đóng đợt trên máy chủ nhưng chưa tải lại được kết quả)
 */
export function thongBaoKiemKe(o) {
  const kho = o.dot?.kho?.tenKho || "kho của đợt";
  const ds = [];
  const them = (ma, tone, chu, hanhDong) => ds.push({ ma, tone, chu, hanhDong });
  if (!o.daXong && o.daGuiXong) {
    them("daGuiXong", "ok", "Máy chủ đã ghi kết quả đợt này. Đang tải lại để hiện kết quả; không cần đếm thêm.");
    return ds;
  }
  if (!o.daXong) {
    if (o.doiKho) them("doiKho", "info", `Đã chuyển nơi làm việc sang ${o.doiKho} để làm đợt này.`);
    if (o.chiXem) {
      them(
        "chiXem",
        "neutral",
        `Đợt này thuộc ${kho}, không nằm trong kho được phân cho bạn. Bạn chỉ xem được; người làm ở ${kho} hoặc quản trị viên hoàn thành đợt.`,
      );
      return ds;
    }
    them(
      "tamDung",
      "warn",
      `Tạm dừng nhập, xuất, chuyển kho và bán tại quầy ở ${kho} tới khi hoàn thành đợt: hệ thống chưa tự khóa kho khi kiểm kê.`,
    );
    // Giờ tạo đợt đã ở bước Tạo đợt của tiến trình: không ghi lại ở đây
    them(
      "chup",
      "info",
      "Tồn hệ thống chụp lúc tạo đợt, gồm cả hàng đã nhặt đang ở khu đóng gói, chờ xuất: đếm cả số hàng đó. Lô nhập sau lúc tạo đợt không có trong danh sách.",
    );
    if (o.dem?.xen) {
      them(
        "xen",
        "warn",
        `${soVN(o.dem.xen)} lô có nhập hoặc xuất (kể cả bán tại quầy) sau lúc bạn đếm. Đếm lại các lô này; nếu không, lúc hoàn thành chúng được giữ nguyên tồn.`,
        "xemXen",
      );
    }
    if (o.loiXen) them("loiXen", "warn", `Chưa kiểm tra được giao dịch sau lúc đếm: ${o.loiXen}.`, "thuLaiXen");
    if (o.khoiPhuc?.soDong) {
      // Giờ lưu đã ở khung "Đã lưu tạm trên máy này · …" của cột phải
      them(
        "khoiPhuc",
        "ok",
        `Đã khôi phục ${soVN(o.khoiPhuc.soDong)} số đếm lưu trên máy này. Đếm tiếp từ chỗ dừng.`,
        "xoaBanTam",
      );
    }
    if (o.nguoiKhac) {
      them(
        "nguoiKhac",
        "info",
        "Máy này có bản đếm dở của tài khoản khác cho đợt này. Bản đó chỉ người đó mở được; bạn đếm trên bản của mình.",
      );
    }
    // Trình duyệt chặn lưu tạm: báo một chỗ, ở khung trạng thái lưu tạm của cột phải (ThuocTinhKiemKe)
    if (o.mu) {
      them(
        "mu",
        "neutral",
        "Đang đếm mù: ẩn tồn hệ thống và chênh lệch để số đếm không bị dẫn. Lựa chọn được nhớ theo tài khoản của bạn trên máy này.",
        "tatMu",
      );
    }
    return ds;
  }
  if (o.soMat) {
    const luc = gioNgay(o.dot?.ngayHoanThanh);
    them(
      "mat",
      "warn",
      `Đợt này đã được hoàn thành${luc ? ` lúc ${luc}` : ""}. ${soVN(o.soMat)} lô bạn đã đếm trên máy này không có trong lần hoàn thành đó nên được ghi là Không đếm, tồn giữ nguyên.`,
      "taiCsvMat",
    );
  }
  if (o.daDong) them("daDong", "neutral", `Đã đóng đợt mà không đổi tồn kho ở ${kho}. Mọi lô ghi là Không đếm.`);
  else them("daXong", "ok", `Đã cập nhật tồn kho ở ${kho} theo số thực tế; lô không đếm giữ nguyên tồn.`);
  return ds;
}

// ── Tệp CSV số đếm ───────────────────────────────────────────────────────────

// Dấu BOM đầu tệp để Excel đọc đúng UTF-8
const BOM = String.fromCharCode(0xfeff);

const oCsv = (v) => {
  const chu = String(v ?? "");
  return /[",\r\n;]/.test(chu) ? `"${chu.replace(/"/g, '""')}"` : chu;
};

/**
 * Tệp CSV (UTF-8, có BOM để Excel đọc đúng dấu) các số đếm trên máy: mã đợt, mã lô, SKU, sản phẩm, tồn hệ thống, số đếm,
 * lúc đếm. `rows`: các dòng đã tính (tinhDong) có số đếm muốn xuất — gọi nơi khác lọc trước.
 */
export function csvSoDem(rows, { maDot = "" } = {}) {
  const dau = ["Mã đợt", "Mã lô", "SKU", "Sản phẩm", "Tồn hệ thống", "Số đếm", "Lúc đếm"];
  const dong = (Array.isArray(rows) ? rows : []).map((d) =>
    // Giờ đếm thật trên máy (giờ so sánh `luc` có thể bị đẩy lên sau giao dịch đã biết, xem gioDem)
    [maDot, d.maLo, d.sku, d.tenSanPham, d.heThong, d.so, gioNgay(d.lucHien ?? d.luc)].map(oCsv).join(","),
  );
  return `${BOM}${[dau.join(","), ...dong].join("\r\n")}\r\n`;
}

/**
 * Lô đã đếm trên máy (bản tạm) mà lần hoàn thành của máy chủ không ghi (loaiChenhLech = null): `dongMayChu` là dòng đã
 * tính của đợt đã xong, `soDem` là bản tạm. Trả các dòng kèm số / giờ đếm trên máy để xuất CSV.
 */
export function soDemBiBo(dongMayChu, soDem) {
  return (Array.isArray(dongMayChu) ? dongMayChu : [])
    .filter((d) => d.loai === "khongDem" && soDem?.[d.id] && coSo(soDem[d.id].so))
    .map((d) => ({ ...d, so: Number(soDem[d.id].so), luc: soDem[d.id].luc ?? null, lucHien: soDem[d.id].lucHien ?? null }));
}
