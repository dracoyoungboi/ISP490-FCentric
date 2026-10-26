/*
 * Hàm thuần của màn Tạo yêu cầu nhập hàng (/purchase-requests/create): chỉ mục danh mục hàng Kho tổng, tìm / quét,
 * thêm – cộng – thay – bỏ dòng, đọc danh sách dán từ Excel, lưới màu × kích cỡ, ngày giao, cảnh báo, tóm tắt theo nhóm
 * hàng, lý do khóa nút Gửi duyệt và thân yêu cầu POST. Không gọi API, không phụ thuộc React (chạy bằng node --test).
 *
 * Danh mục hàng: `bienThe[]` của GET /nghiep-vu/yeu-cau-mua-hang/hang-kho-tong (HangNhapKhoTongResponse.BienThe):
 *   { bienTheId, maSku, maVach, sanPhamId, maSanPham, tenSanPham, nhomHang, tenMau, maMauHex, tenSize, tenChatLieu, anh,
 *     khaDung, dangVe, nguong, daTungNhap, soLuongDeXuat, du, yeuCauMo: { id, ma, soYeuCau } | null }
 * Dòng yêu cầu trong màn: `{ bienTheId, soLuong }` — `soLuong` là số, hoặc "" khi đang xóa trống ô (rời ô thì về 1).
 */
import { docSo, khopTuKhoa, tachTuKhoa } from "../../chung-tu/bangChungTu.js";
import { docOSoLuong, SO_LUONG_TOI_DA } from "../../ban-hang/tao-bao-gia/tinhTaoBaoGia.js";
import { SO_GOI_Y_SAN_PHAM } from "../../../config/bangChungTu.js";

export { docOSoLuong, SO_LUONG_TOI_DA };

/** Khớp máy chủ (YeuCauMuaHangService): ghi chú tối đa, số dòng tối đa mỗi yêu cầu. */
export const GHI_CHU_TOI_DA = 500;
export const SO_DONG_TOI_DA = 1000;
/** Nút chọn nhanh ngày giao: sau n ngày. */
export const MOC_NGAY_GIAO = Object.freeze([7, 14, 30]);
/** Hộp Dán từ Excel: số dòng lỗi hiện ra (còn lại gom "và n dòng lỗi khác"). */
export const SO_LOI_DAN_HIEN = 6;
/** Tóm tắt theo nhóm hàng: số nhóm hiện, còn lại gom "Nhóm khác". */
export const SO_NHOM_HANG_HIEN = 5;

const THU = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const CO_CHU = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL", "5XL"];
const giongId = (a, b) => a != null && b != null && String(a) === String(b);

/* ------------------------------------------------------------------ danh mục */

/** Thứ tự kích cỡ: cỡ chữ theo bảng cỡ quen dùng, rồi cỡ số theo giá trị, còn lại theo chữ cái. */
export function soSanhKichCo(a, b) {
  const doc = (x) => {
    const chu = String(x ?? "").trim().toUpperCase();
    const viTri = CO_CHU.indexOf(chu);
    const so = Number(chu);
    if (viTri >= 0) return { nhom: 0, khoa: viTri, chu };
    if (chu !== "" && Number.isFinite(so)) return { nhom: 1, khoa: so, chu };
    return { nhom: 2, khoa: 0, chu };
  };
  const x = doc(a);
  const y = doc(b);
  if (x.nhom !== y.nhom) return x.nhom - y.nhom;
  if (x.nhom < 2) return x.khoa - y.khoa;
  return x.chu.localeCompare(y.chu, "vi");
}

/**
 * Chỉ mục của danh mục hàng: `theoId` (bienTheId → biến thể), `theoMa` (SKU / mã vạch chữ thường → biến thể),
 * `theoSanPham` (sanPhamId → biến thể xếp theo màu rồi kích cỡ), `thuTu` (bienTheId → vị trí trong danh mục).
 */
export function taoChiMuc(dsHang) {
  const ds = Array.isArray(dsHang) ? dsHang : [];
  const theoId = new Map();
  const theoMa = new Map();
  const theoSanPham = new Map();
  ds.forEach((bt) => {
    if (bt?.bienTheId == null) return;
    theoId.set(String(bt.bienTheId), bt);
    if (bt.maSku) theoMa.set(String(bt.maSku).trim().toLowerCase(), bt);
    if (bt.maVach && !theoMa.has(String(bt.maVach).trim().toLowerCase())) {
      theoMa.set(String(bt.maVach).trim().toLowerCase(), bt);
    }
    const khoa = String(bt.sanPhamId ?? `ten-${bt.tenSanPham}`);
    if (!theoSanPham.has(khoa)) theoSanPham.set(khoa, []);
    theoSanPham.get(khoa).push(bt);
  });
  const thuTu = new Map();
  let i = 0;
  for (const [, dsBt] of theoSanPham) {
    // Màu theo thứ tự xuất hiện, trong cùng màu xếp theo kích cỡ
    const mau = [];
    dsBt.forEach((bt) => { if (!mau.includes(bt.tenMau ?? "")) mau.push(bt.tenMau ?? ""); });
    dsBt.sort((a, b) => mau.indexOf(a.tenMau ?? "") - mau.indexOf(b.tenMau ?? "") || soSanhKichCo(a.tenSize, b.tenSize));
    dsBt.forEach((bt) => { thuTu.set(String(bt.bienTheId), i++); });
  }
  return { theoId, theoMa, theoSanPham, thuTu };
}

/** Khóa sản phẩm của một biến thể trong chỉ mục `theoSanPham`. */
export const khoaSanPham = (bt) => String(bt?.sanPhamId ?? `ten-${bt?.tenSanPham}`);

/** Mã cần chú ý: đang nằm trong yêu cầu nhập khác chưa xong, hoặc Kho tổng còn dư. */
export const canChuY = (bt) => Boolean(bt?.yeuCauMo) || Boolean(bt?.du);

/** Lọc nhanh của bảng hàng (useBangChungTu → boLoc): mặc định "Tất cả", "Cần chú ý" theo canChuY. */
export const BO_LOC_BANG = Object.freeze({ tatCa: null, chuY: canChuY });

/** Mã Kho tổng đang hết / sắp hết (có số đề xuất). */
export const laGoiY = (bt) => docSo(bt?.soLuongDeXuat) > 0;

// Dạng "dòng chứng từ" của biến thể để tìm bằng khopTuKhoa (nhớ theo đối tượng: chữ tìm chỉ tính một lần)
const DONG_TIM = new WeakMap();
export function dongTimCua(bt) {
  if (!bt || typeof bt !== "object") return {};
  if (!DONG_TIM.has(bt)) {
    DONG_TIM.set(bt, {
      tenSanPham: bt.tenSanPham, sku: bt.maSku, maVach: bt.maVach, tenMau: bt.tenMau, kichCo: bt.tenSize,
      chuTimThem: [bt.maSanPham, bt.tenChatLieu, bt.nhomHang].filter(Boolean),
    });
  }
  return DONG_TIM.get(bt);
}

/** Tìm biến thể theo tên, SKU, mã vạch, mã sản phẩm, màu, cỡ, chất liệu, nhóm hàng (không dấu, mọi từ phải có). */
export function timHang(dsHang, tuKhoa, gioiHan = SO_GOI_Y_SAN_PHAM) {
  const ds = Array.isArray(dsHang) ? dsHang : [];
  const tu = tachTuKhoa(tuKhoa);
  const khop = tu.length ? ds.filter((bt) => khopTuKhoa(dongTimCua(bt), tu)) : ds;
  return { ds: khop.slice(0, gioiHan), tong: khop.length };
}

/**
 * Enter ở ô tìm / máy quét: trùng đúng SKU hoặc mã vạch thì lấy mã đó; không thì chỉ lấy khi còn đúng một kết quả.
 * Trả `{ bienThe }`, `{ loi: "nhieu" | "khong" }`, hoặc null khi trống.
 */
export function chonKhiEnter(dsHang, chiMuc, tuKhoa) {
  const tho = String(tuKhoa ?? "").trim();
  if (!tho) return null;
  const trung = chiMuc?.theoMa?.get(tho.toLowerCase());
  if (trung) return { bienThe: trung };
  const { ds, tong } = timHang(dsHang, tho, 1);
  if (tong === 1) return { bienThe: ds[0] };
  return { loi: tong > 1 ? "nhieu" : "khong" };
}

/* ------------------------------------------------------------------ dòng yêu cầu */

/** Thêm một mã: đã có thì cộng `soLuong` (quét lại cộng 1), chưa có thì thêm cuối. */
export function themDong(dong, bienTheId, soLuong = 1) {
  const ds = Array.isArray(dong) ? dong : [];
  const them = Math.max(1, Math.floor(docSo(soLuong)) || 1);
  if (ds.some((d) => giongId(d.bienTheId, bienTheId))) {
    return ds.map((d) => (giongId(d.bienTheId, bienTheId)
      ? { ...d, soLuong: Math.min(SO_LUONG_TOI_DA, docSo(d.soLuong) + them) }
      : d));
  }
  return [...ds, { bienTheId, soLuong: Math.min(SO_LUONG_TOI_DA, them) }];
}

/**
 * Thêm nhiều mã một lần (Gợi ý cần nhập, Dán từ Excel, Thêm cả n biến thể). `cach`: mã đã có thì "cong" (cộng thêm),
 * "thay" (thay bằng số mới) hoặc "giu" (giữ nguyên). Trả `{ dong, moi, capNhat }` (số mã mới, số mã đã có bị đổi).
 */
export function themNhieu(dong, dsThem, cach = "cong") {
  const kq = Array.isArray(dong) ? dong.map((d) => ({ ...d })) : [];
  let moi = 0;
  let capNhat = 0;
  for (const x of Array.isArray(dsThem) ? dsThem : []) {
    if (x?.bienTheId == null) continue;
    const sl = Math.min(SO_LUONG_TOI_DA, Math.max(1, Math.floor(docSo(x.soLuong)) || 1));
    const cu = kq.find((d) => giongId(d.bienTheId, x.bienTheId));
    if (!cu) {
      kq.push({ bienTheId: x.bienTheId, soLuong: sl });
      moi += 1;
    } else if (cach === "cong") {
      cu.soLuong = Math.min(SO_LUONG_TOI_DA, docSo(cu.soLuong) + sl);
      capNhat += 1;
    } else if (cach === "thay") {
      cu.soLuong = sl;
      capNhat += 1;
    }
  }
  return { dong: kq, moi, capNhat };
}

/** Đặt cùng một số lượng cho các mã `ids`. */
export function datSoLuong(dong, ids, soLuong) {
  const chon = new Set((ids ?? []).map(String));
  const sl = Math.min(SO_LUONG_TOI_DA, Math.max(1, Math.floor(docSo(soLuong)) || 1));
  return (dong ?? []).map((d) => (chon.has(String(d.bienTheId)) ? { ...d, soLuong: sl } : d));
}

/** Đưa các mã `ids` về số đề xuất; mã không có đề xuất giữ nguyên. Trả `{ dong, dat, khong }`. */
export function theoSoDeXuat(dong, ids, theoId) {
  const chon = new Set((ids ?? []).map(String));
  let dat = 0;
  let khong = 0;
  const kq = (dong ?? []).map((d) => {
    if (!chon.has(String(d.bienTheId))) return d;
    const deXuat = docSo(theoId?.get(String(d.bienTheId))?.soLuongDeXuat);
    if (deXuat > 0) { dat += 1; return { ...d, soLuong: Math.min(SO_LUONG_TOI_DA, deXuat) }; }
    khong += 1;
    return d;
  });
  return { dong: kq, dat, khong };
}

/** Bỏ các mã `ids` khỏi yêu cầu. */
export function boDong(dong, ids) {
  const bo = new Set((ids ?? []).map(String));
  return (dong ?? []).filter((d) => !bo.has(String(d.bienTheId)));
}

/**
 * Hoàn tác một lần bỏ dòng: chèn lại các dòng đã bỏ (`daBo`, giữ nguyên số lượng lúc bỏ) mà hiện chưa có — không ghi
 * đè cả danh sách, nên số đã sửa và mã thêm sau lần bỏ vẫn còn.
 */
export function chenLaiDong(dong, daBo) {
  const co = new Set((dong ?? []).map((d) => String(d.bienTheId)));
  return [...(dong ?? []), ...(daBo ?? []).filter((d) => !co.has(String(d.bienTheId)))];
}

/** Ô số lượng của một dòng: chữ không hợp lệ thì giữ số cũ, trống giữ "" (rời ô về 1). */
export function doiSoLuongDong(dong, bienTheId, chu) {
  const v = docOSoLuong(chu);
  if (v === undefined) return dong;
  return (dong ?? []).map((d) => (giongId(d.bienTheId, bienTheId) ? { ...d, soLuong: v === "" ? "" : Math.max(1, v) } : d));
}

/** Rời ô số lượng: ô đang trống hoặc 0 thì về 1. */
export function roiOSoLuong(dong, bienTheId) {
  return (dong ?? []).map((d) => (giongId(d.bienTheId, bienTheId) && !(docSo(d.soLuong) >= 1) ? { ...d, soLuong: 1 } : d));
}

/**
 * Ô của lưới màu × kích cỡ: trống hoặc 0 là bỏ mã khỏi yêu cầu (sản phẩm vẫn ở lại lưới); số thì đặt số đó (chưa có
 * thì thêm); chữ không hợp lệ thì giữ nguyên.
 */
export function doiOLuoi(dong, bienTheId, chu) {
  const v = docOSoLuong(chu);
  if (v === undefined) return dong;
  if (v === "" || v === 0) return boDong(dong, [bienTheId]);
  if ((dong ?? []).some((d) => giongId(d.bienTheId, bienTheId))) {
    return dong.map((d) => (giongId(d.bienTheId, bienTheId) ? { ...d, soLuong: v } : d));
  }
  return [...(dong ?? []), { bienTheId, soLuong: v }];
}

/**
 * Ghi thêm vào thứ tự sản phẩm (chỉ nối thêm, không xóa): sản phẩm của các mã `ids` chưa có thì thêm cuối. Giữ thứ tự
 * hiển thị ổn định — bỏ dòng đầu của một sản phẩm (hay xóa ô trên lưới) không làm sản phẩm đó nhảy chỗ.
 * Trả nguyên mảng cũ khi không có gì mới.
 */
export function noiThuTuSanPham(thuTu, ids, chiMuc) {
  const kq = Array.isArray(thuTu) ? [...thuTu] : [];
  (ids ?? []).forEach((id) => {
    const bt = chiMuc?.theoId?.get(String(id));
    if (bt && !kq.includes(khoaSanPham(bt))) kq.push(khoaSanPham(bt));
  });
  return kq.length === (thuTu?.length ?? 0) ? thuTu ?? [] : kq;
}

/**
 * Dòng của bảng chứng từ (useBangChungTu) từ các dòng yêu cầu: gom theo sản phẩm theo `thuTuSp` (thứ tự thêm, xem
 * noiThuTuSanPham; sản phẩm chưa có trong đó xếp sau, theo lần xuất hiện), biến thể trong một sản phẩm theo màu rồi
 * kích cỡ. Dòng không còn trong danh mục (mã vừa ngừng) vẫn hiện bằng id để người dùng bỏ đi.
 */
export function dongBang(dong, chiMuc, thuTuSp = []) {
  const ds = Array.isArray(dong) ? dong : [];
  const thuTuSpMap = new Map((thuTuSp ?? []).map((k, i) => [k, i]));
  const coSan = thuTuSpMap.size;
  ds.forEach((d, i) => {
    const bt = chiMuc?.theoId?.get(String(d.bienTheId));
    const khoa = bt ? khoaSanPham(bt) : `id-${d.bienTheId}`;
    if (!thuTuSpMap.has(khoa)) thuTuSpMap.set(khoa, coSan + i);
  });
  return ds
    .map((d) => {
      const bt = chiMuc?.theoId?.get(String(d.bienTheId));
      const khoa = bt ? khoaSanPham(bt) : `id-${d.bienTheId}`;
      return {
        id: d.bienTheId,
        khoaNhom: bt?.sanPhamId ?? `id-${d.bienTheId}`,
        tenSanPham: bt?.tenSanPham || `Mã id ${d.bienTheId}`,
        sku: bt?.maSku || "",
        maVach: bt?.maVach || "",
        tenMau: bt?.tenMau || "",
        maMauHex: bt?.maMauHex || "",
        kichCo: bt?.tenSize || "",
        anh: bt?.anh || null,
        chuTimThem: [bt?.maSanPham, bt?.tenChatLieu, bt?.nhomHang].filter(Boolean),
        soLuong: docSo(d.soLuong),
        oNhap: d.soLuong,
        khaDung: docSo(bt?.khaDung),
        dangVe: docSo(bt?.dangVe),
        deXuat: docSo(bt?.soLuongDeXuat),
        daTungNhap: Boolean(bt?.daTungNhap),
        du: Boolean(bt?.du),
        yeuCauMo: bt?.yeuCauMo ?? null,
        khongConBan: !bt,
        _thuTuSp: thuTuSpMap.get(khoa),
        _thuTu: chiMuc?.thuTu?.get(String(d.bienTheId)) ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => a._thuTuSp - b._thuTuSp || a._thuTu - b._thuTu);
}

/* ------------------------------------------------------------------ lưới màu × kích cỡ */

/**
 * Lưới nhập của một sản phẩm: mọi biến thể trong danh mục (kể cả chưa có trong yêu cầu), một hàng mỗi màu, một cột
 * mỗi kích cỡ. Ô: `{ kichCo, bienThe | null, soLuong: số | "" }`; `cong` của hàng / cột / cả lưới.
 * Hai biến thể trùng màu và cỡ (khác chất liệu — DB cho phép) thì tách hàng theo "Màu · Chất liệu"; vẫn trùng nữa thì
 * mỗi biến thể một hàng kèm SKU, để không ô nào gộp mất một mã.
 */
export function luoiNhap(dsBienThe, dong) {
  const ds = Array.isArray(dsBienThe) ? dsBienThe : [];
  const slTheoId = new Map((dong ?? []).map((d) => [String(d.bienTheId), d.soLuong]));
  const ten = (x) => (x != null && String(x).trim() !== "" ? String(x).trim() : "—");
  const coTrungO = (nhanHang) => {
    const gap = new Set();
    return ds.some((bt) => {
      const k = `${nhanHang(bt)}|${ten(bt.tenSize)}`;
      if (gap.has(k)) return true;
      gap.add(k);
      return false;
    });
  };
  let nhanHang = (bt) => ten(bt.tenMau);
  if (coTrungO(nhanHang)) nhanHang = (bt) => `${ten(bt.tenMau)} · ${ten(bt.tenChatLieu)}`;
  if (coTrungO(nhanHang)) nhanHang = (bt) => `${ten(bt.tenMau)} · ${ten(bt.tenChatLieu)} · ${bt.maSku || bt.bienTheId}`;
  const maus = [];
  ds.forEach((bt) => { if (!maus.includes(nhanHang(bt))) maus.push(nhanHang(bt)); });
  const cotKichCo = [...new Set(ds.map((bt) => ten(bt.tenSize)))].sort(soSanhKichCo);
  const hang = maus.map((mau) => {
    const cuaMau = ds.filter((bt) => nhanHang(bt) === mau);
    const o = cotKichCo.map((kichCo) => {
      const bt = cuaMau.find((x) => ten(x.tenSize) === kichCo) ?? null;
      const sl = bt ? slTheoId.get(String(bt.bienTheId)) : undefined;
      return { kichCo, bienThe: bt, soLuong: sl == null ? "" : sl };
    });
    return {
      tenMau: mau,
      maMauHex: cuaMau.find((x) => x.maMauHex)?.maMauHex || "",
      o,
      cong: o.reduce((s, x) => s + docSo(x.soLuong), 0),
    };
  });
  const congCot = cotKichCo.map((_, i) => hang.reduce((s, h) => s + docSo(h.o[i].soLuong), 0));
  return { cotKichCo, hang, congCot, cong: hang.reduce((s, h) => s + h.cong, 0) };
}

/* ------------------------------------------------------------------ dán từ Excel */

// Một ô của dòng dán: gọt khoảng trắng và ngoặc kép hai đầu (CSV "SKU","30")
const gotO = (x) => String(x ?? "").trim().replace(/^"([\s\S]*)"$/, "$1").trim();
// Khoảng trắng trong ô số: Excel định dạng ngăn nghìn bằng dấu cách / NBSP / U+202F ("1 200")
const KHOANG_TRONG_SO = /[\s\u00a0\u202f]/g;

/** Ô số lượng của dòng dán: số nguyên dương (cho phép ngăn nghìn "1.200", "1,200", "1 200"); sai thì null. */
function docOSoDan(chu) {
  const tho = gotO(chu).replace(KHOANG_TRONG_SO, "");
  const so = /^\d{1,3}([.,]\d{3})+$/.test(tho) ? tho.replace(/[.,]/g, "") : tho;
  return /^\d+$/.test(so) && Number(so) > 0 ? Number(so) : null;
}

/**
 * Tách một dòng dán thành `{ bt, cacO }`: `bt` là biến thể của ô mã (null nếu không ô nào là mã), `cacO` các ô sau ô mã.
 * - Có Tab (chép từ Excel): tách theo Tab; ô mã là ô đầu tiên khớp SKU / mã vạch (bỏ qua được cột STT, tên phía trước),
 *   các cột sau ô mã giữ nguyên (cột cuối là số lượng).
 * - Không có Tab: thử tách theo chấm phẩy, khoảng trắng, dấu phẩy; lấy cách tách mà ô đầu là mã.
 */
function tachDongDan(goc, chiMuc) {
  const tim = (o) => chiMuc?.theoMa?.get(o.toLowerCase()) ?? null;
  if (goc.includes("\t")) {
    const cacO = goc.split("\t").map(gotO).filter(Boolean);
    const viTri = cacO.findIndex((o) => tim(o));
    return viTri < 0 ? { bt: null, cacO, coTab: true } : { bt: tim(cacO[viTri]), cacO: cacO.slice(viTri + 1), coTab: true };
  }
  for (const ngan of [/;/, /\s+/, /,/]) {
    const cacO = goc.split(ngan).map(gotO).filter(Boolean);
    if (cacO.length && tim(cacO[0])) return { bt: tim(cacO[0]), cacO: cacO.slice(1), coTab: false };
  }
  return { bt: null, cacO: goc.split(/[;,\s]+/).map(gotO).filter(Boolean), coTab: false };
}

/**
 * Đọc danh sách dán (mỗi dòng: SKU hoặc mã vạch, rồi số lượng). Mã lặp được cộng dồn; quá SO_LUONG_TOI_DA thì kẹp lại.
 * - Dòng không trống ĐẦU TIÊN không có mã nào và không kết thúc bằng số: coi là tiêu đề, bỏ qua (chỉ dòng đầu).
 * - Không có Tab mà dòng có hơn 2 phần ("SKU,1,200", "SKU1 30 SKU2 20"): báo lỗi thay vì đoán sai số lượng.
 * Trả `{ hop: [{ bienTheId, soLuong }], loi: [{ dongSo, chu, lyDo }], soDong, soDongLap }`.
 */
export function docDanhSachDan(chu, chiMuc) {
  const gop = new Map();
  const loi = [];
  let soDong = 0;
  let daQuaDongDau = false;
  String(chu ?? "").replace(/^\ufeff/, "").split(/\r?\n/).forEach((dong, i) => {
    const goc = dong.trim();
    if (!goc) return;
    const laDongDau = !daQuaDongDau;
    daQuaDongDau = true;
    const hienThi = goc.replace(/\t/g, "  ");
    const { bt, cacO, coTab } = tachDongDan(goc, chiMuc);
    if (!bt) {
      if (laDongDau && docOSoDan(cacO[cacO.length - 1]) == null) return; // dòng tiêu đề
      loi.push({ dongSo: i + 1, chu: hienThi, lyDo: "không tìm thấy mã" });
      return;
    }
    if (!cacO.length) {
      loi.push({ dongSo: i + 1, chu: hienThi, lyDo: "thiếu số lượng" });
      return;
    }
    if (!coTab && cacO.length > 1) {
      loi.push({ dongSo: i + 1, chu: hienThi, lyDo: "dòng có hơn 2 phần, mỗi dòng chỉ ghi mã và số lượng" });
      return;
    }
    const so = docOSoDan(cacO[cacO.length - 1]);
    if (so == null) {
      loi.push({ dongSo: i + 1, chu: hienThi, lyDo: "số lượng không hợp lệ" });
      return;
    }
    soDong += 1;
    const khoa = String(bt.bienTheId);
    gop.set(khoa, { bienTheId: bt.bienTheId, soLuong: (gop.get(khoa)?.soLuong ?? 0) + so });
  });
  const hop = [...gop.values()].map((x) => ({ ...x, soLuong: Math.min(SO_LUONG_TOI_DA, x.soLuong) }));
  return { hop, loi, soDong, soDongLap: soDong - hop.length };
}

/* ------------------------------------------------------------------ ngày giao */

const pad2 = (n) => String(n).padStart(2, "0");

/** Ngày (theo giờ máy) dạng yyyy-MM-dd. */
export const isoNgay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Đọc "yyyy-MM-dd" thành Date 00:00 giờ máy; sai thì null. */
export function docNgay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

const DINH_DANG_NGAY_VN = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
});

/**
 * Hôm nay theo giờ Việt Nam (Date 00:00 giờ máy của ngày đó): máy chủ so ngày giao theo ngày Việt Nam, nên máy đặt
 * múi giờ khác (vd. UTC, 00:00–07:00) vẫn không chọn được "hôm qua".
 */
export function homNayVN(bayGio = new Date()) {
  return docNgay(DINH_DANG_NGAY_VN.format(bayGio));
}

/** Ngày sau `n` ngày kể từ `homNay` (yyyy-MM-dd). */
export function sauNgay(n, homNay = homNayVN()) {
  const d = new Date(homNay.getFullYear(), homNay.getMonth(), homNay.getDate() + n);
  return isoNgay(d);
}

/** Số ngày từ hôm nay tới ngày giao (âm: đã qua); ngày sai thì null. */
export function soNgayToi(iso, homNay = homNayVN()) {
  const d = docNgay(iso);
  if (!d) return null;
  const goc = new Date(homNay.getFullYear(), homNay.getMonth(), homNay.getDate());
  return Math.round((d - goc) / 86400000);
}

/** Dòng dưới ô ngày giao: `{ trai, phai, loi }` — "Thứ Hai, 03/11/2026" · "còn 9 ngày"; trống: "Bắt buộc". */
export function moTaNgayGiao(iso, homNay = homNayVN()) {
  const d = docNgay(iso);
  if (!d) return { trai: "Bắt buộc", phai: "", loi: false };
  const con = soNgayToi(iso, homNay);
  if (con < 0) return { trai: "Ngày đã qua, chọn từ hôm nay", phai: "", loi: true };
  return {
    trai: `${THU[d.getDay()]}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`,
    phai: con === 0 ? "hôm nay" : `còn ${con} ngày`,
    loi: false,
  };
}

/* ------------------------------------------------------------------ cảnh báo, tóm tắt, gửi */

/**
 * Các dòng cần chú ý: `trung` (mã đang trong yêu cầu nhập khác chưa xong), `du` (Kho tổng còn dư, không tính mã đã
 * trùng), `maYeuCau` (các mã yêu cầu khác, không lặp).
 */
export function canhBao(dong, chiMuc) {
  const trung = [];
  const du = [];
  const maYeuCau = [];
  (dong ?? []).forEach((d) => {
    const bt = chiMuc?.theoId?.get(String(d.bienTheId));
    if (!bt) return;
    if (bt.yeuCauMo) {
      trung.push(d.bienTheId);
      if (bt.yeuCauMo.ma && !maYeuCau.includes(bt.yeuCauMo.ma)) maYeuCau.push(bt.yeuCauMo.ma);
    } else if (bt.du) {
      du.push(d.bienTheId);
    }
  });
  return { trung, du, maYeuCau, soChuY: trung.length + du.length };
}

/** Câu cảnh báo đầu khối / trong hộp xác nhận; không có gì thì "". */
export function cauCanhBao({ trung = [], du = [], maYeuCau = [] } = {}) {
  const ma = maYeuCau.length > 3 ? `${maYeuCau.slice(0, 3).join(", ")} và ${maYeuCau.length - 3} yêu cầu khác` : maYeuCau.join(", ");
  const phan = [
    trung.length ? `${trung.length.toLocaleString("vi-VN")} mã đang nằm trong yêu cầu nhập khác chưa xong${ma ? ` (${ma})` : ""}` : "",
    du.length ? `${du.length.toLocaleString("vi-VN")} mã Kho tổng còn dư hàng` : "",
  ].filter(Boolean);
  return phan.length ? `${phan.join("; ")}. Gửi thêm có thể mua trùng hoặc mua thừa.` : "";
}

/** Số lượng theo nhóm hàng, nhiều trước; quá SO_NHOM_HANG_HIEN nhóm thì gom phần còn lại vào "Nhóm khác (n)". */
export function theoNhomHang(dong, chiMuc) {
  const tong = new Map();
  (dong ?? []).forEach((d) => {
    const ten = chiMuc?.theoId?.get(String(d.bienTheId))?.nhomHang || "Chưa phân nhóm";
    tong.set(ten, (tong.get(ten) ?? 0) + docSo(d.soLuong));
  });
  const ds = [...tong.entries()].map(([ten, soLuong]) => ({ ten, soLuong })).sort((a, b) => b.soLuong - a.soLuong);
  if (ds.length <= SO_NHOM_HANG_HIEN) return ds;
  const con = ds.slice(SO_NHOM_HANG_HIEN);
  return [
    ...ds.slice(0, SO_NHOM_HANG_HIEN),
    { ten: `Nhóm khác (${con.length})`, soLuong: con.reduce((s, x) => s + x.soLuong, 0) },
  ];
}

/** Số dòng đang đúng số đề xuất (trên các dòng có đề xuất). */
export function demTheoDeXuat(dong, chiMuc) {
  return (dong ?? []).filter((d) => {
    const deXuat = docSo(chiMuc?.theoId?.get(String(d.bienTheId))?.soLuongDeXuat);
    return deXuat > 0 && docSo(d.soLuong) === deXuat;
  }).length;
}

/**
 * Lý do nút "Gửi duyệt" đang khóa (chuỗi rỗng: gửi được). Ô số lượng đang xóa trống KHÔNG khóa nút (như Tạo báo giá):
 * bấm Gửi duyệt làm ô rời tiêu điểm và màn điền 1 trước khi mở hộp xác nhận; thân yêu cầu cũng tính ô trống là 1.
 */
export function lyDoKhoaGui({ dangTai = false, coKho = true, dong = [], chiMuc = null, ngayGiao = "", homNay = homNayVN() } = {}) {
  if (dangTai) return "Đang tải dữ liệu";
  if (!coKho) return "Chưa có Kho tổng nhận hàng";
  if (!dong.length) return "Thêm ít nhất một sản phẩm";
  if (dong.length > SO_DONG_TOI_DA) return `Tối đa ${SO_DONG_TOI_DA.toLocaleString("vi-VN")} dòng mỗi yêu cầu`;
  if (chiMuc && dong.some((d) => !chiMuc.theoId.has(String(d.bienTheId)))) return "Có mã đã ngừng kinh doanh, bỏ trước khi gửi";
  const con = soNgayToi(ngayGiao, homNay);
  if (con == null) return "Chọn ngày giao dự kiến";
  if (con < 0) return "Ngày giao không được trước hôm nay";
  return "";
}

/**
 * Thân POST /nghiep-vu/yeu-cau-mua-hang/create. Ngày giao gửi lúc 00:00 giờ Việt Nam của ngày đã chọn (máy chủ so theo
 * ngày Việt Nam). Ô số lượng đang trống tính là 1 (đúng giá trị màn điền khi rời ô).
 */
export function taoBodyYeuCau({ khoNhapId, ngayGiao, ghiChu }, dong) {
  return {
    khoNhapId: Number(khoNhapId),
    ngayGiaoDuKien: `${ngayGiao}T00:00:00+07:00`,
    ghiChu: String(ghiChu ?? "").trim() || null,
    chiTietYeuCauMuaHangs: (Array.isArray(dong) ? dong : []).map((d) => ({
      bienTheSanPhamId: Number(d.bienTheId),
      soLuongDat: docSo(d.soLuong) >= 1 ? Math.floor(docSo(d.soLuong)) : 1,
    })),
  };
}

/** Id yêu cầu vừa tạo trong phản hồi của POST create ({ data: YeuCauMuaHangDto }); không có thì null. */
export function idYeuCauMoi(phanHoi) {
  const id = phanHoi?.data?.id ?? phanHoi?.id;
  return id != null && String(id) !== "" ? id : null;
}

/**
 * Đọc đề xuất trên đường dẫn (nút "Yêu cầu nhập" ở Tổng quan): ?khoId=&bienTheId=&soLuong=&ten=
 * Trả null khi không có tham số; còn lại `{ dong, khoTong, khoDeXuat, khongThay, coSoLuong, ten }`:
 * - `dong`: `{ bienTheId, soLuong }` hoặc null; số lượng thiếu / sai thì 1 (`coSoLuong` = false);
 * - `khoTong`: kho trong đường dẫn khi đó LÀ một Kho tổng (màn chọn đúng kho đó); `khoDeXuat`: khi KHÔNG phải Kho tổng
 *   (kho bán hàng cần bổ sung, hàng nhập về Kho tổng rồi chuyển sang);
 * - `khongThay`: mã trong đề xuất không còn trong danh mục (đã ngừng kinh doanh); `ten`: tên sản phẩm trong đường dẫn.
 */
export function docDeXuatDuongDan(thamSo, chiMuc, dsKhoTong = []) {
  const lay = (k) => (typeof thamSo?.get === "function" ? thamSo.get(k) : thamSo?.[k]) ?? null;
  const khoId = lay("khoId");
  const bienTheId = lay("bienTheId");
  if (!khoId && !bienTheId) return null;
  const bt = bienTheId ? chiMuc?.theoId?.get(String(bienTheId)) : null;
  const so = Math.floor(Number(lay("soLuong")));
  const coSoLuong = Number.isFinite(so) && so >= 1;
  const laKhoTong = khoId != null && (dsKhoTong ?? []).some((k) => giongId(k.id, khoId));
  return {
    dong: bt ? { bienTheId: bt.bienTheId, soLuong: coSoLuong ? Math.min(SO_LUONG_TOI_DA, so) : 1 } : null,
    khoTong: khoId && laKhoTong ? String(khoId) : null,
    khoDeXuat: khoId && !laKhoTong ? String(khoId) : null,
    khongThay: Boolean(bienTheId) && !bt,
    coSoLuong,
    ten: String(lay("ten") ?? "").trim() || null,
  };
}
