/*
 * Hàm thuần cho BẢNG HÀNG của các màn chi tiết chứng từ: tìm không dấu, gom theo sản phẩm, tóm tắt màu · kích cỡ,
 * thu gọn mặc định, phân trang theo sản phẩm hoặc theo dòng, tổng cả chứng từ, tìm trang chứa một dòng (khi quét).
 * Không gọi API, không phụ thuộc React, chạy được bằng `node --test`. Ngưỡng và cỡ trang ở config/bangChungTu.js.
 *
 * Mỗi màn đổi dòng của API sang "dòng chứng từ" (giữ thêm trường riêng của màn tùy ý):
 *   {
 *     id,                  // khóa dòng, duy nhất trong chứng từ (bắt buộc)
 *     khoaNhom?,           // khóa sản phẩm để gom; thiếu thì gom theo tenSanPham
 *     tenSanPham?, sku?, tenMau?, maMauHex?, kichCo?, anh?,
 *     maVach?,             // chuỗi hoặc mảng chuỗi
 *     maLo?,               // chuỗi hoặc mảng chuỗi (dòng của danh sách lô)
 *     lo?,                 // [{ maLo, soLuong }] (thẻ lô của dòng, dùng cho ChipLo)
 *     chuTimThem?,         // chữ khác cũng được tìm (vd. chất liệu), chuỗi hoặc mảng
 *     soLuong?,            // số mặc định để cộng tổng
 *   }
 * `tuBienThe(bienTheSanPham)` đọc sẵn các trường trên từ biến thể sản phẩm của backend (kể cả maVach; khoaNhom là
 * `sanPhamId` — backend cũ chưa trả trường này thì gom theo tên).
 */
import {
  CO_TRANG_DONG,
  CO_TRANG_NHOM,
  NGUONG_CONG_CU,
  NGUONG_THU_GON,
  SO_MUC_TOM_TAT,
} from "../../config/bangChungTu.js";
import { vietHoaDau } from "./loiTai.js";

export const KHONG_MAU_KICH_CO = "Không có màu, kích cỡ";
const TONG_MAC_DINH = Object.freeze({ soLuong: "soLuong" });

/** Đọc số từ BigDecimal của backend (số hoặc chuỗi "80.00"); sai hoặc trống thì 0. */
export function docSo(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Số theo kiểu Việt Nam: 1.234. */
export const soVN = (n) => docSo(n).toLocaleString("vi-VN");

/** Chữ thường, bỏ dấu tiếng Việt, đ → d: gõ "ao thun den" vẫn khớp "Áo thun / Đen". */
export function boDau(chu) {
  return String(chu ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

const thanhMang = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
const coChu = (x) => x != null && String(x).trim() !== "";
const giongId = (a, b) => a != null && b != null && String(a) === String(b);

/**
 * Đọc các trường chung từ `bienTheSanPham` của backend (ảnh: `anhBienThe.tepTin.duongDan`, như màn cũ; mã vạch:
 * `maVachSku`, để quét / gõ mã vạch ở ô tìm ra dòng).
 * Gom nhóm theo id sản phẩm (`sanPhamId` của BienTheSanPhamDto): tên sản phẩm không duy nhất nên gom theo tên sẽ gộp
 * hai sản phẩm trùng tên. Backend chưa trả `sanPhamId` (bản cũ) thì `khoaNhom` null và bảng gom theo tên như trước.
 */
export function tuBienThe(bienThe) {
  const bt = bienThe ?? {};
  return {
    khoaNhom: bt.sanPhamId ?? bt.sanPham?.id ?? null,
    tenSanPham: bt.tenSanPham || bt.sanPham?.tenSanPham || bt.tenBienThe || bt.maSku || "",
    sku: bt.maSku || "",
    maVach: bt.maVachSku || "",
    tenMau: bt.mauSac?.tenMau || "",
    maMauHex: bt.mauSac?.maMauHex || "",
    kichCo: bt.size?.tenSize || bt.size?.maSize || "",
    anh: bt.anhBienThe?.tepTin?.duongDan || null,
  };
}

// Chữ tìm của một dòng đã bỏ dấu, nhớ theo đối tượng dòng (dữ liệu mới là đối tượng mới nên không cần xóa)
const CHU_TIM = new WeakMap();
// Ký tự ngăn từ trong chữ tìm: khoảng trắng và dấu nối hay gặp trong SKU, mã lô ("QJ-26-M", "Đen / M")
const NGAN_TU = /[\s\-_/.,·×|()]+/;
// Từ khóa ngắn (1–2 ký tự, như kích cỡ "M", "XL") phải khớp ĐẦU một từ: gõ "m" không ra mọi dòng chứa "phẩm"
const DO_DAI_TU_NGAN = 2;

function boTimCua(dong) {
  if (!dong || typeof dong !== "object") return { chu: "", tu: [] };
  if (CHU_TIM.has(dong)) return CHU_TIM.get(dong);
  const phan = [
    dong.tenSanPham,
    dong.sku,
    dong.tenMau,
    dong.kichCo,
    ...thanhMang(dong.maVach),
    ...thanhMang(dong.maLo),
    ...thanhMang(dong.lo).map((l) => (l && typeof l === "object" ? l.maLo : l)),
    ...thanhMang(dong.chuTimThem),
  ].filter(coChu);
  const chu = boDau(phan.join(" "));
  const bo = { chu, tu: chu.split(NGAN_TU).filter(Boolean) };
  CHU_TIM.set(dong, bo);
  return bo;
}

/** Toàn bộ chữ được tìm của một dòng (tên, SKU, màu, kích cỡ, mã vạch, mã lô, chữ thêm), đã bỏ dấu. */
export const chuTimCua = (dong) => boTimCua(dong).chu;

// Mảnh từ khóa chỉ gồm ký tự ngăn ("/" trong "Đen / M", "-" trong "Áo thun - Đen") và dấu câu dính hai đầu mảnh ("đen,")
const CHI_NGAN_TU = new RegExp(`^${NGAN_TU.source}$`);
const DAU_CAU_HAI_DAU = /^[,;·|()]+|[,;·|()]+$/g;

/**
 * Tách từ khóa thành các từ đã bỏ dấu; mọi từ đều phải có trong dòng (thứ tự tùy ý). Bỏ mảnh chỉ gồm ký tự ngăn và gọt
 * dấu câu ở hai đầu để gõ đúng nhãn đang hiện ("Đen / M", "đen, m") vẫn ra dòng; giữ "-" trong mảnh ("sp1-") để tìm mã.
 */
export function tachTuKhoa(tuKhoa) {
  return boDau(tuKhoa)
    .split(/\s+/)
    .map((tu) => tu.replace(DAU_CAU_HAI_DAU, ""))
    .filter((tu) => tu && !CHI_NGAN_TU.test(tu));
}

/**
 * Dòng có khớp từ khóa không: mọi từ của từ khóa đều phải có (không dấu, không phân biệt hoa thường, thứ tự tùy ý).
 * Từ dài từ 3 ký tự khớp ở bất kỳ đâu ("cl005" trong SKU); từ 1–2 ký tự phải khớp đầu một từ ("m" là kích cỡ M).
 */
export function khopTuKhoa(dong, tuKhoa) {
  const tuTim = Array.isArray(tuKhoa) ? tuKhoa : tachTuKhoa(tuKhoa);
  if (!tuTim.length) return true;
  const { chu, tu } = boTimCua(dong);
  return tuTim.every((t) => (t.length > DO_DAI_TU_NGAN ? chu.includes(t) : tu.some((w) => w.startsWith(t))));
}

/** Lọc theo từ khóa và (nếu có) bộ lọc nhanh `loc(dong) → boolean`. Giữ nguyên thứ tự dòng. */
export function locDong(dongs, { tuKhoa = "", loc = null } = {}) {
  const ds = Array.isArray(dongs) ? dongs : [];
  const tu = tachTuKhoa(tuKhoa);
  if (!tu.length && !loc) return ds;
  return ds.filter((d) => (!loc || loc(d)) && khopTuKhoa(d, tu));
}

/** Khóa nhóm của dòng: theo `khoaNhom`, thiếu thì theo tên sản phẩm. */
export function khoaNhomCua(dong) {
  if (coChu(dong?.khoaNhom)) return `sp-${dong.khoaNhom}`;
  return `ten-${String(dong?.tenSanPham ?? "").trim()}`;
}

/**
 * Gom dòng theo sản phẩm. Thứ tự nhóm = thứ tự xuất hiện đầu tiên, dòng trong nhóm giữ thứ tự gốc.
 * @returns {{ khoa: string, tenSanPham: string, anh: string | null, dong: object[] }[]}
 */
export function gomTheoSanPham(dongs) {
  const theoKhoa = new Map();
  for (const d of Array.isArray(dongs) ? dongs : []) {
    const khoa = khoaNhomCua(d);
    if (!theoKhoa.has(khoa)) theoKhoa.set(khoa, { khoa, tenSanPham: d?.tenSanPham || "", anh: null, dong: [] });
    const nhom = theoKhoa.get(khoa);
    if (!nhom.anh && d?.anh) nhom.anh = d.anh;
    nhom.dong.push(d);
  }
  return [...theoKhoa.values()];
}

function duyNhat(ds) {
  const gap = new Set();
  const kq = [];
  for (const x of ds) {
    const chu = String(x ?? "").trim();
    if (!chu || gap.has(chu)) continue;
    gap.add(chu);
    kq.push(chu);
  }
  return kq;
}

function rutGon(ds, toiDa) {
  if (ds.length <= toiDa) return ds.join(", ");
  return `${ds.slice(0, toiDa).join(", ")} +${ds.length - toiDa}`;
}

/** "Đen, Trắng · S, M, L" (theo thứ tự xuất hiện, bỏ trùng); quá nhiều thì "+n"; không có gì: "Không có màu, kích cỡ". */
export function tomTatMauKichCo(dongs, { toiDa = SO_MUC_TOM_TAT } = {}) {
  const ds = Array.isArray(dongs) ? dongs : [];
  const maus = duyNhat(ds.map((d) => d?.tenMau));
  const cos = duyNhat(ds.map((d) => d?.kichCo));
  const phan = [maus.length ? rutGon(maus, toiDa) : "", cos.length ? rutGon(cos, toiDa) : ""].filter(Boolean);
  return phan.length ? phan.join(" · ") : KHONG_MAU_KICH_CO;
}

/** Nhãn biến thể của một dòng: "Đen / M", "Đen", "M" hoặc "Không có màu, kích cỡ". */
export function nhanMauKichCo(dong) {
  return [dong?.tenMau, dong?.kichCo].filter(coChu).map((x) => String(x).trim()).join(" / ") || KHONG_MAU_KICH_CO;
}

/** Có hiện thanh công cụ (ô tìm, lọc, phân trang) không: quá `nguong` dòng. */
export const coCongCu = (soDong, nguong = NGUONG_CONG_CU) => docSo(soDong) > nguong;

/** Nhóm sản phẩm có mặc định thu gọn không: chứng từ quá `nguong` biến thể. */
export const macDinhThuGon = (soDong, nguong = NGUONG_THU_GON) => docSo(soDong) > nguong;

/** Nhóm đang mở: theo lần bấm của người dùng, không thì đang tìm → mở, còn lại theo mặc định thu gọn. */
export function nhomDangMo(khoa, { moNhom = {}, dangTim = false, thuGonMacDinh = false, thuGonDuoc = true } = {}) {
  if (!thuGonDuoc) return true;
  if (typeof moNhom?.[khoa] === "boolean") return moNhom[khoa];
  return dangTim || !thuGonMacDinh;
}

/**
 * Cắt một trang. `trang` tính từ 0, tự kẹp vào khoảng hợp lệ (dữ liệu ngắn lại sau khi tải lại không làm trang trống).
 * `coTrang` = Infinity: một trang chứa tất cả.
 */
export function phanTrang(ds, trang = 0, coTrang = Infinity) {
  const mang = Array.isArray(ds) ? ds : [];
  const tong = mang.length;
  const co = Number(coTrang) >= 1 ? Math.floor(Number(coTrang)) : 1;
  const soTrang = Math.max(1, Math.ceil(tong / co));
  const t = Math.min(Math.max(0, Math.floor(docSo(trang))), soTrang - 1);
  const dau = t === 0 ? 0 : t * co; // co = Infinity: 0 × Infinity là NaN
  return { muc: mang.slice(dau, dau + co), trang: t, soTrang, tong, tu: tong ? dau + 1 : 0, den: Math.min(dau + co, tong) };
}

/**
 * Cộng các trường của mọi dòng (luôn cả chứng từ, không theo trang).
 * @param tongTheo `{ ten: "tenTruong" | (dong) => number }`, mặc định `{ soLuong: "soLuong" }`
 */
export function tinhTong(dongs, tongTheo = TONG_MAC_DINH) {
  const kq = {};
  const ds = Array.isArray(dongs) ? dongs : [];
  for (const [ten, cach] of Object.entries(tongTheo ?? {})) {
    const lay = typeof cach === "function" ? cach : (d) => d?.[cach];
    kq[ten] = ds.reduce((s, d) => s + docSo(lay(d)), 0);
  }
  return kq;
}

/**
 * Trang (từ 0) chứa dòng `id` theo đúng bộ lọc đang dùng; -1 nếu dòng không có hoặc đang bị bộ lọc che.
 * `theo = "nhom"`: đếm theo nhóm sản phẩm (không cắt đôi nhóm). `coTrang = Infinity`: không phân trang.
 */
export function timTrangCuaDong(dongs, id, { theo = "nhom", coTrang = Infinity, tuKhoa = "", loc = null } = {}) {
  const ds = locDong(dongs, { tuKhoa, loc });
  const co = Number(coTrang) >= 1 ? Math.floor(Number(coTrang)) : 1;
  const viTri = theo === "dong"
    ? ds.findIndex((d) => giongId(d?.id, id))
    : gomTheoSanPham(ds).findIndex((n) => n.dong.some((d) => giongId(d?.id, id)));
  return viTri < 0 ? -1 : Math.floor(viTri / co);
}

/** Cỡ trang mặc định theo cách phân trang. */
export const luaChonCoTrangMacDinh = (theo) => (theo === "dong" ? CO_TRANG_DONG : CO_TRANG_NHOM);

/**
 * Dựng toàn bộ dữ liệu hiển thị của bảng (dùng trong useBangChungTu, test được bằng node).
 *
 * @param dongs  các dòng chứng từ (xem đầu file)
 * @param tuyChon
 *   - `theo`: "nhom" (gom theo sản phẩm, phân trang theo sản phẩm) | "dong" (dòng phẳng, phân trang theo dòng)
 *   - `tuKhoa`, `loc(dong) → boolean`: tìm và lọc nhanh
 *   - `trang` (từ 0), `coTrang`: cỡ trang (mặc định số đầu của CO_TRANG_NHOM / CO_TRANG_DONG)
 *   - `moNhom`: `{ [khoaNhom]: boolean }` các nhóm người dùng đã bấm mở / thu gọn
 *   - `nguongCongCu`, `nguongThuGon`: mặc định NGUONG_CONG_CU, NGUONG_THU_GON
 *   - `tongTheo`: các tổng cần cộng (xem tinhTong)
 * @returns
 *   - `tong`: `{ soDong, soSanPham, ...tinhTong }` của CẢ chứng từ (không theo tìm, lọc hay trang)
 *   - `ketQua`: `{ soDong, soSanPham }` sau khi tìm / lọc
 *   - `coCongCu`, `thuGonMacDinh`, `dangTim`, `dangLoc`, `rong` (chứng từ không có dòng), `khongKetQua`
 *   - `coPhanTrang`, `trang`, `soTrang`, `coTrang`, `tongMuc` (số nhóm hoặc số dòng được phân trang), `tu`, `den`
 *   - `nhom`: nhóm của trang (chỉ khi theo nhóm), mỗi nhóm
 *     `{ khoa, tenSanPham, anh, dong, soBienThe, soBienTheCaNhom, tomTat, tong, thuGonDuoc, mo }`
 *   - `dong`: các dòng của trang (theo nhóm: dòng của mọi nhóm trên trang, kể cả nhóm đang thu gọn)
 *   - `khoaNhomLoc`: khóa mọi nhóm sau khi lọc (mọi trang), `moHet`: mọi nhóm đó đang mở
 */
export function dungBangChungTu(dongs, tuyChon = {}) {
  const {
    theo = "nhom",
    tuKhoa = "",
    loc = null,
    trang = 0,
    coTrang,
    moNhom = {},
    nguongCongCu = NGUONG_CONG_CU,
    nguongThuGon = NGUONG_THU_GON,
    tongTheo = TONG_MAC_DINH,
  } = tuyChon;
  const tatCa = Array.isArray(dongs) ? dongs : [];
  const theoNhom = theo !== "dong";
  const nhomTatCa = gomTheoSanPham(tatCa);
  const soDongCuaNhom = new Map(nhomTatCa.map((n) => [n.khoa, n.dong.length]));

  const congCu = coCongCu(tatCa.length, nguongCongCu);
  const thuGonMacDinh = theoNhom && macDinhThuGon(tatCa.length, nguongThuGon);
  const dangTim = tachTuKhoa(tuKhoa).length > 0;
  const dangLoc = typeof loc === "function";

  const daLoc = locDong(tatCa, { tuKhoa, loc });
  const nhomLoc = theoNhom ? gomTheoSanPham(daLoc) : [];
  const coDinh = Number(coTrang) >= 1 ? Math.floor(Number(coTrang)) : luaChonCoTrangMacDinh(theo)[0];
  const mucPhanTrang = theoNhom ? nhomLoc : daLoc;
  const coPhanTrang = congCu && mucPhanTrang.length > 0;
  const cat = phanTrang(mucPhanTrang, trang, coPhanTrang ? coDinh : Infinity);

  const cachMo = { moNhom, dangTim, thuGonMacDinh, thuGonDuoc: congCu };
  const nhom = theoNhom
    ? cat.muc.map((n) => ({
      ...n,
      soBienThe: n.dong.length,
      soBienTheCaNhom: soDongCuaNhom.get(n.khoa) ?? n.dong.length,
      tomTat: tomTatMauKichCo(n.dong),
      tong: tinhTong(n.dong, tongTheo),
      thuGonDuoc: congCu,
      mo: nhomDangMo(n.khoa, cachMo),
    }))
    : [];
  const khoaNhomLoc = nhomLoc.map((n) => n.khoa);

  return {
    theo: theoNhom ? "nhom" : "dong",
    tong: { soDong: tatCa.length, soSanPham: nhomTatCa.length, ...tinhTong(tatCa, tongTheo) },
    ketQua: { soDong: daLoc.length, soSanPham: theoNhom ? nhomLoc.length : gomTheoSanPham(daLoc).length },
    coCongCu: congCu,
    thuGonMacDinh,
    dangTim,
    dangLoc,
    rong: tatCa.length === 0,
    khongKetQua: tatCa.length > 0 && daLoc.length === 0,
    coPhanTrang,
    trang: cat.trang,
    soTrang: cat.soTrang,
    coTrang: coDinh,
    tongMuc: cat.tong,
    tu: cat.tu,
    den: cat.den,
    nhom,
    dong: theoNhom ? nhom.flatMap((n) => n.dong) : cat.muc,
    khoaNhomLoc,
    moHet: khoaNhomLoc.length > 0 && khoaNhomLoc.every((k) => nhomDangMo(k, cachMo)),
  };
}

/**
 * Chữ "Tìm thấy …" cạnh ô tìm (chỉ khi đang tìm hoặc lọc).
 * Theo nhóm: "Tìm thấy 12 biến thể trong 3 sản phẩm"; theo dòng: "Tìm thấy 5 dòng". Không có kết quả: "Không có kết quả".
 * `donVi`: đơn vị của dòng (mặc định "biến thể" khi theo nhóm, "dòng" khi theo dòng).
 */
export function chuTimThay(bang, { donVi } = {}) {
  if (!bang || (!bang.dangTim && !bang.dangLoc)) return "";
  const { soDong, soSanPham } = bang.ketQua ?? { soDong: 0, soSanPham: 0 };
  if (!soDong) return "Không có kết quả";
  if (bang.theo === "dong") return `Tìm thấy ${soVN(soDong)} ${donVi ?? "dòng"}`;
  return `Tìm thấy ${soVN(soDong)} ${donVi ?? "biến thể"} trong ${soVN(soSanPham)} sản phẩm`;
}

/**
 * Câu gợi ý cạnh tiêu đề bảng khi các nhóm đang thu gọn mặc định (> NGUONG_THU_GON biến thể): chỉ khi không tìm, không lọc
 * và chưa mở hết. Ngược lại "" (một câu, một điều kiện cho mọi màn gom theo sản phẩm).
 */
export function chuGoiYThuGon(bang, nguong = NGUONG_THU_GON) {
  if (!bang?.thuGonMacDinh || bang.dangTim || bang.dangLoc || bang.moHet) return "";
  return `Hơn ${soVN(nguong)} biến thể nên đang thu gọn theo sản phẩm. Bấm một sản phẩm để xem từng biến thể.`;
}

/**
 * Câu khi chứng từ chưa có dòng nào, theo tên đầy đủ: "Phiếu nhặt hàng chưa có sản phẩm nào.".
 * `dauCham = false` cho lý do khóa nút ("Phiếu nhặt hàng chưa có sản phẩm nào").
 */
export function cauChungTuRong(tenChungTu, { dauCham = true } = {}) {
  const ten = vietHoaDau(tenChungTu) || "Chứng từ";
  return `${ten} chưa có sản phẩm nào${dauCham ? "." : ""}`;
}

/** Câu khi tìm không thấy: "Không có biến thể nào khớp “áo len”.". */
export const cauKhongKhop = (donVi, tuKhoa) => `Không có ${donVi || "dòng"} nào khớp “${String(tuKhoa ?? "").trim()}”.`;

/** Câu khi lọc nhanh không còn dòng: "Không có SKU nào ở bộ lọc này.". */
export const cauLocRong = (donVi) => `Không có ${donVi || "dòng"} nào ở bộ lọc này.`;

/**
 * Lưới màu × kích cỡ của một nhóm (xem gọn biến thể thời trang): một hàng mỗi màu, một cột mỗi kích cỡ.
 * @param layGiaTri  số trong ô (mặc định `soLuong`)
 * @returns `{ cotKichCo: string[], hang: [{ tenMau, maMauHex, o: [{ kichCo, dong | null, giaTri | null }], cong }], cong }`
 *   Màu / kích cỡ trống ghi "—". Hai dòng trùng màu và kích cỡ thì cộng vào cùng ô (`dong` là dòng đầu).
 */
export function luoiMauKichCo(dongs, layGiaTri = (d) => d?.soLuong) {
  const ds = Array.isArray(dongs) ? dongs : [];
  const ten = (x) => (coChu(x) ? String(x).trim() : "—");
  const maus = duyNhat(ds.map((d) => ten(d?.tenMau)));
  const cotKichCo = duyNhat(ds.map((d) => ten(d?.kichCo)));
  const hang = maus.map((mau) => {
    const cuaMau = ds.filter((d) => ten(d?.tenMau) === mau);
    const o = cotKichCo.map((kichCo) => {
      const trong = cuaMau.filter((d) => ten(d?.kichCo) === kichCo);
      return {
        kichCo,
        dong: trong[0] ?? null,
        giaTri: trong.length ? trong.reduce((s, d) => s + docSo(layGiaTri(d)), 0) : null,
      };
    });
    return {
      tenMau: mau,
      maMauHex: cuaMau.find((d) => d?.maMauHex)?.maMauHex || "",
      o,
      cong: o.reduce((s, x) => s + (x.giaTri ?? 0), 0),
    };
  });
  return { cotKichCo, hang, cong: hang.reduce((s, h) => s + h.cong, 0) };
}
