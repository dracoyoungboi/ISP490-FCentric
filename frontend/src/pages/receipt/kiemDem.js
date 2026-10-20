/**
 * Logic thuần của màn Kiểm đếm & khóa lô (PA2, chốt 19/10/2026). Không phụ thuộc React để kiểm bằng `node --test`.
 *
 * "Phiên" là lô đang kiểm của một biến thể, lưu tạm trong trình duyệt tới khi khóa lô:
 *   { log: [Lượt], cur, dem, keId, maLo, nsx }
 *   Lượt = { id, gio, ma, nguon, sl, kq: "cho" | "dat" | "loi", loi, lyDo, huy }
 *   - kq "cho": chế độ "Quét thẻ cho từng cái", đang chờ quét ĐẠT / KHÔNG ĐẠT.
 *   - kq "loi": `loi` cái không đạt (1..sl), phần còn lại của lượt là đạt; `lyDo` bắt buộc trước lượt kế tiếp.
 *   - maLo null: dùng mã gợi ý.
 */

import { TIEN_TO_THE_LENH } from "../../utils/maVach.js";

/** Cấu hình KIEM_DEM_XAC_NHAN (Cấu hình › Nhập kho). */
export const CHE_DO_XAC_NHAN = {
  QUET_TIEP_LA_DAT: "QUET_TIEP_LA_DAT",
  QUET_THE_TUNG_CAI: "QUET_THE_TUNG_CAI",
};

/** Thẻ lệnh in để ở bàn kiểm (mã Code 128). Chỉ khớp đúng mã, không khớp tiền tố. */
export const THE_LENH = {
  KHONG_DAT: `${TIEN_TO_THE_LENH}KHONG-DAT`,
  HOAN_TAC: `${TIEN_TO_THE_LENH}HOAN-TAC`,
  KHOA_LO: `${TIEN_TO_THE_LENH}KHOA-LO`,
  DAT: `${TIEN_TO_THE_LENH}DAT`,
};

/** Mã thẻ lý do không đạt thứ n (1-based), theo thứ tự LY_DO_LOI. */
export const maTheLyDo = (n) => `${TIEN_TO_THE_LENH}LD-${n}`;

/** Tiền tố mã lô gợi ý khi máy chủ chưa trả cấu hình MA_LO_TIEN_TO (Cấu hình › Nhập kho). */
export const TIEN_TO_MA_LO_MAC_DINH = "LO";

/**
 * Ngày sản xuất sớm nhất được nhận: chặn dữ liệu nhập nhầm (vd. máy quét gõ mã kệ vào ô ngày thành năm 0102),
 * không phải quy tắc nghiệp vụ. Khớp NSX_SOM_NHAT ở backend.
 */
export const NSX_SOM_NHAT = "2000-01-01";

/**
 * Đọc thẻ lệnh từ mã đã viết hoa. Trả null nếu không bắt đầu bằng FC-.
 * { loai: "KHONG_DAT" | "HOAN_TAC" | "KHOA_LO" | "DAT" | "LY_DO" | "KHONG_RO", soLyDo? }
 */
export function docTheLenh(hoa, soLyDo) {
  if (!hoa.startsWith(TIEN_TO_THE_LENH)) return null;
  const loai = Object.keys(THE_LENH).find((k) => THE_LENH[k] === hoa);
  if (loai) return { loai };
  const ld = new RegExp(`^${TIEN_TO_THE_LENH}LD-(\\d{1,2})$`).exec(hoa);
  if (ld && Number(ld[1]) >= 1 && Number(ld[1]) <= soLyDo) return { loai: "LY_DO", soLyDo: Number(ld[1]) };
  return { loai: "KHONG_RO" };
}

export const phienMoi = (nsx = "") => ({ log: [], cur: null, dem: 1, keId: null, maLo: null, nsx });

/** Phiên đọc lại từ trình duyệt: bỏ dữ liệu hỏng thay vì làm vỡ màn. */
export function chuanHoaPhien(raw, nsxMacDinh = "") {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.log)) return phienMoi(nsxMacDinh);
  const log = raw.log
    .filter((e) => e && Number.isInteger(e.id) && typeof e.ma === "string" && Number.isInteger(e.sl) && e.sl > 0)
    .map((e) => ({
      id: e.id,
      gio: String(e.gio ?? ""),
      ma: e.ma,
      nguon: String(e.nguon ?? ""),
      sl: e.sl,
      kq: ["cho", "dat", "loi"].includes(e.kq) ? e.kq : "dat",
      loi: e.kq === "loi" ? Math.max(1, Math.min(Number(e.loi) || 1, e.sl)) : 0,
      lyDo: e.kq === "loi" && typeof e.lyDo === "string" && e.lyDo ? e.lyDo : null,
      huy: Boolean(e.huy),
    }));
  const dem = Math.max(Number(raw.dem) || 1, ...log.map((e) => e.id + 1), 1);
  return {
    log,
    cur: log.some((e) => e.id === raw.cur && !e.huy) ? raw.cur : null,
    dem,
    keId: Number.isInteger(raw.keId) ? raw.keId : null,
    maLo: typeof raw.maLo === "string" ? raw.maLo : null,
    nsx: typeof raw.nsx === "string" ? raw.nsx : nsxMacDinh,
    khoaChuaRo: lanKhoaHopLe(raw.khoaChuaRo) ? raw.khoaChuaRo : null,
  };
}

const lanKhoaHopLe = (l) =>
  Boolean(l) &&
  typeof l.maLo === "string" &&
  Number.isInteger(l.dat) &&
  Number.isInteger(l.loi) &&
  (l.keId === null || Number.isInteger(l.keId)) &&
  typeof l.nsx === "string" &&
  Number.isInteger(l.dem);

/**
 * Lô trên máy chủ có đúng là lần khóa `lan` ({ maLo, dat, loi, keId, nsx }) không: trùng mã (không phân biệt hoa
 * thường), số đạt, số lỗi, kệ và ngày sản xuất. Dùng khi lần khóa trước không rõ kết quả (mất phản hồi) để không
 * khóa lại thành lô trùng.
 */
export function khopLanKhoa(lo, lan) {
  if (!lo || !lan) return false;
  const hoa = (v) => String(v ?? "").trim().toUpperCase();
  return (
    hoa(lo.maLo) === hoa(lan.maLo) &&
    Number(lo.soLuongNhap || 0) === lan.dat &&
    Number(lo.soLuongLoi || 0) === lan.loi &&
    (lo.viTriKhoId ?? null) === (lan.keId ?? null) &&
    String(lo.ngaySanXuat ?? "").slice(0, 10) === lan.nsx
  );
}

/**
 * Đối chiếu lần khóa không rõ kết quả (`phien.khoaChuaRo` = { maLo, dat, loi, keId, nsx, dem }) với lô trên máy chủ
 * (`dsLo`: danh sách lô VỪA tải lại, null nếu tải lỗi) trước khi khóa lô đang kiểm ({ dat, loi }). Lượt có id < `dem`
 * là lượt đã nằm trong lần khóa đó.
 * - "da-luu": máy chủ đã lưu lô đó và lô đang kiểm vẫn đúng các lượt của lần đó → chốt theo lần đó, không gửi lại.
 * - "chan": máy chủ đã lưu lô đó nhưng lô đang kiểm đã đổi (quét thêm, hoàn tác, lượt chờ chọn) mà còn lượt đã nằm
 *   trong lô đó → khóa tiếp là đếm gấp đôi; hoàn tác các lượt đó trước.
 * - "chua-kiem": có lần khóa không rõ kết quả mà chưa có danh sách lô vừa tải (`dsLo` null: tải lại lỗi) → chưa biết
 *   lần đó đã được lưu hay chưa, không gửi lần khóa mới (danh sách trên màn có thể cũ, mã lô có thể đã gõ khác).
 * - null: không có lần khóa không rõ kết quả, máy chủ chưa có lô đó, hoặc các lượt của lần đó đã hoàn tác hết.
 */
export function doiChieuKhoaChuaRo(phien, dsLo, { dat, loi }) {
  const truoc = phien?.khoaChuaRo;
  if (!truoc) return null;
  if (!dsLo) return "chua-kiem";
  if (!dsLo.some((l) => khopLanKhoa(l, truoc))) return null;
  const conLuotCu = phien.log.some((e) => !e.huy && e.id < truoc.dem);
  const coLuotMoi = phien.log.some((e) => !e.huy && e.id >= truoc.dem);
  if (!coLuotMoi && dat === truoc.dat && loi === truoc.loi) return "da-luu";
  return conLuotCu ? "chan" : null;
}

/**
 * Kết quả của lần tải mới nhất. `layLan()`: số thứ tự lần tải mới nhất; `layTai()`: promise kết quả của lần đó (lần
 * bị một lần tải bắt đầu sau thay chỗ trả null). Lần đang chờ lại bị thay chỗ thì chờ tiếp lần mới hơn: bị thay chỗ
 * không có nghĩa là tải lỗi, lần mới hơn (tải sau nên không cũ hơn) có thể đã tải được.
 */
export async function ketQuaLanTaiMoiNhat(layLan, layTai) {
  for (;;) {
    const lan = layLan();
    const kq = await layTai();
    if (lan === layLan()) return kq;
  }
}

/**
 * Câu báo khi chưa đối chiếu được lần khóa không rõ kết quả vì chưa tải được danh sách lô: mất mạng, hoặc máy chủ
 * từ chối (đổi nơi làm việc, phiếu bị hủy…). `cauMayChu`: câu lỗi của máy chủ nếu có (mất mạng thì không có).
 */
export function cauChuaKiemKhoaChuaRo(maLo, cauMayChu = "") {
  const lyDo = String(cauMayChu ?? "").trim().replace(/[.\s]+$/, "");
  return (
    `Chưa tải được danh sách lô để kiểm lần khóa lô ${maLo} lúc mất phản hồi đã được lưu hay chưa` +
    (lyDo ? ` (${lyDo}).` : ".") +
    " Lô đang kiểm vẫn giữ nguyên các lượt quét, khóa lại sau khi tải được."
  );
}

/** Mã lô có chứa mã thẻ lệnh (FC-…): thường do máy quét gõ nhầm vào ô Mã lô. */
export const maLoChuaTheLenh = (maLo) => String(maLo ?? "").toUpperCase().includes(TIEN_TO_THE_LENH);

export const datCua = (e) => (e.huy || e.kq === "cho" ? 0 : e.sl - (e.kq === "loi" ? e.loi : 0));
export const loiCua = (e) => (e.huy || e.kq !== "loi" ? 0 : e.loi);

export const luotHienTai = (phien) => (phien.cur == null ? null : phien.log.find((e) => e.id === phien.cur && !e.huy) ?? null);

/** Lượt còn thiếu quyết định: chưa chọn Đạt / Không đạt, hoặc không đạt mà chưa có lý do. */
const thieuQuyetDinh = (e) => !e.huy && (e.kq === "cho" || (e.kq === "loi" && !e.lyDo));

/** Lượt hiện tại còn chặn lần quét sau: chưa chọn Đạt / Không đạt, hoặc không đạt mà chưa có lý do. */
export function luotDangCho(phien) {
  const c = luotHienTai(phien);
  if (!c) return null;
  if (c.kq === "cho") return { luot: c, loai: "cho" };
  if (c.kq === "loi" && !c.lyDo) return { luot: c, loai: "lyDo" };
  return null;
}

export function cauChanLuot(cho) {
  if (!cho) return "";
  return cho.loai === "cho"
    ? `Chọn Đạt hoặc Không đạt cho ${cho.luot.ma} trước: quét thẻ ĐẠT / KHÔNG ĐẠT hoặc bấm trên thẻ kết quả.`
    : `Chọn lý do không đạt cho ${cho.luot.ma} trước: quét mã lý do trên thẻ lệnh hoặc bấm chọn trên thẻ kết quả.`;
}

/**
 * Số liệu biến thể: lô đã khóa (từ máy chủ) + lô đang kiểm (phiên).
 * `xong` chỉ khi số ĐÃ KHÓA đủ số đặt — hàng còn trong lô chưa khóa chưa được lưu.
 */
export function tinh(phien, { canNhap, datKhoa, loiKhoa }) {
  const can = Math.max(0, Number(canNhap) || 0);
  const datLo = phien.log.reduce((t, e) => t + datCua(e), 0);
  const loiLo = phien.log.reduce((t, e) => t + loiCua(e), 0);
  const choLo = phien.log.reduce((t, e) => t + (!e.huy && e.kq === "cho" ? e.sl : 0), 0);
  const trongLo = datLo + loiLo + choLo;
  const daKhoa = (Number(datKhoa) || 0) + (Number(loiKhoa) || 0);
  const daKiem = daKhoa + trongLo;
  return {
    can,
    datKhoa: Number(datKhoa) || 0,
    loiKhoa: Number(loiKhoa) || 0,
    datLo,
    loiLo,
    choLo,
    trongLo,
    daKhoa,
    daKiem,
    conLai: Math.max(0, can - daKiem),
    // Lô đang kiểm nhiều hơn phần còn thiếu: máy khác vừa khóa thêm lô (phiên của máy này đọc lại từ trình duyệt)
    vuot: Math.max(0, daKiem - can),
    xong: can > 0 && daKhoa >= can && trongLo === 0,
  };
}

/** Nhãn trạng thái của biến thể (thẻ R8): Chờ kiểm đếm · Đang kiểm đếm · Chờ khóa lô · Đã kiểm xong. */
export function nhanTrangThai(t) {
  if (t.vuot > 0 && t.trongLo > 0) return "Vượt số đặt";
  if (t.xong) return "Đã kiểm xong";
  if (t.conLai === 0 && t.trongLo > 0) return "Chờ khóa lô";
  if (t.daKiem > 0) return "Đang kiểm đếm";
  return "Chờ kiểm đếm";
}

/**
 * Thêm một lượt quét đúng biến thể. Số lượng bị chặn ở số còn lại theo đơn mua.
 * Trả { phien, luot, soTinh } hoặc { phien, soTinh: 0 } khi đã đủ.
 */
export function themLuot(phien, { ma, nguon, soLuong, conLai, cheDo, gio }) {
  const soTinh = Math.min(Math.max(1, soLuong), conLai);
  if (soTinh <= 0) return { phien, soTinh: 0, luot: null };
  const luot = {
    id: phien.dem,
    gio,
    ma,
    nguon: nguon + (soTinh < soLuong ? ` · chỉ tính ${soTinh} vì đủ số đặt` : ""),
    sl: soTinh,
    kq: cheDo === CHE_DO_XAC_NHAN.QUET_THE_TUNG_CAI ? "cho" : "dat",
    loi: 0,
    lyDo: null,
    huy: false,
  };
  return { phien: { ...phien, log: [luot, ...phien.log], cur: luot.id, dem: phien.dem + 1 }, luot, soTinh };
}

/** Sửa lượt hiện tại; không có lượt hiện tại thì trả nguyên phiên. */
export function suaLuotHienTai(phien, sua) {
  const c = luotHienTai(phien);
  if (!c) return phien;
  return { ...phien, log: phien.log.map((e) => (e.id === c.id ? { ...e, ...sua(e) } : e)) };
}

export const thanhDat = (phien) => suaLuotHienTai(phien, () => ({ kq: "dat", loi: 0, lyDo: null }));

export const thanhKhongDat = (phien) =>
  suaLuotHienTai(phien, (e) => ({ kq: "loi", loi: Math.max(1, Math.min(e.loi || 1, e.sl)), lyDo: e.kq === "loi" ? e.lyDo : null }));

export const chonLyDo = (phien, lyDo) => suaLuotHienTai(phien, (e) => (e.kq === "loi" ? { lyDo } : {}));

/** ± số lượng của lượt hiện tại: tối thiểu 1, tối đa = số hiện tại + số còn lại theo đơn mua. */
export const doiSoLuong = (phien, delta, conLai) =>
  suaLuotHienTai(phien, (e) => {
    const sl = Math.max(1, Math.min(e.sl + conLai, e.sl + delta));
    return { sl, loi: e.kq === "loi" ? Math.min(Math.max(1, e.loi), sl) : 0 };
  });

/** ± "Trong đó không đạt" của lượt hiện tại (1..sl). */
export const doiSoLoi = (phien, delta) =>
  suaLuotHienTai(phien, (e) => (e.kq === "loi" ? { loi: Math.max(1, Math.min(e.sl, e.loi + delta)) } : {}));

/** Hoàn tác một lượt (đánh dấu hủy, giữ lại trong danh sách). Trả { phien, luot } hoặc { phien, luot: null }. */
export function hoanTacLuot(phien, id) {
  const luot = phien.log.find((e) => e.id === id && !e.huy);
  if (!luot) return { phien, luot: null };
  return {
    phien: { ...phien, log: phien.log.map((e) => (e.id === id ? { ...e, huy: true } : e)), cur: phien.cur === id ? null : phien.cur },
    luot,
  };
}

/** Lượt để thẻ HOÀN TÁC lùi: lượt hiện tại, không có thì lượt gần nhất còn hiệu lực (quét nhiều lần thì lùi dần). */
export const luotDeHoanTac = (phien) => luotHienTai(phien) ?? phien.log.find((e) => !e.huy) ?? null;

/** Hàng không đạt của lô đang kiểm, gộp theo lý do (gửi máy chủ khi khóa lô). */
export function nhomLoiTheoLyDo(log) {
  const theoLyDo = new Map();
  for (const e of log) {
    const n = loiCua(e);
    if (n > 0) theoLyDo.set(e.lyDo, (theoLyDo.get(e.lyDo) ?? 0) + n);
  }
  return [...theoLyDo].map(([lyDo, soLuong]) => ({ lyDo, soLuong }));
}

/** Câu mô tả một lượt trong tab "Lượt quét lô này". */
export function nhanLuot(e) {
  if (e.kq === "cho") return `Chờ chọn Đạt / Không đạt · ${e.sl}`;
  if (e.kq === "loi") return `Không đạt ${e.loi} · ${e.lyDo || "chưa chọn lý do"}${e.sl - e.loi ? ` · Đạt ${e.sl - e.loi}` : ""}`;
  return `Đạt ${e.sl}`;
}

/** Còn trống của kệ: sức chứa − đang chứa − hàng đạt của lô đã khóa chưa nhập kho. null nếu kệ không giới hạn. */
export function conTrongKe(viTri) {
  const suc = Number(viTri?.sucChua) || 0;
  if (suc <= 0) return null;
  return Math.max(0, suc - (Number(viTri.dangChua) || 0) - (Number(viTri.choNhap) || 0));
}

/** Lý do kệ không chọn được (mã để so trong code; `lyDo` là chữ hiển thị). */
export const KE_KHONG_DUOC = { KHONG_CO: "KHONG_CO", BAO_TRI: "BAO_TRI", DAY: "DAY", CHI_CON: "CHI_CON" };

/** Kệ có chọn được cho `datLo` cái đạt không. { duoc, ma, lyDo } — lyDo dùng để ghi cạnh tên kệ bị khóa. */
export function keDungDuoc(viTri, datLo = 0) {
  if (!viTri) return { duoc: false, ma: KE_KHONG_DUOC.KHONG_CO, lyDo: "Không có kệ" };
  if (viTri.trangThai && viTri.trangThai !== "HOAT_DONG") return { duoc: false, ma: KE_KHONG_DUOC.BAO_TRI, lyDo: "Bảo trì" };
  const con = conTrongKe(viTri);
  if (con === null) return { duoc: true, ma: "", lyDo: "" };
  if (con <= 0) return { duoc: false, ma: KE_KHONG_DUOC.DAY, lyDo: "Đầy" };
  if (datLo > con) return { duoc: false, ma: KE_KHONG_DUOC.CHI_CON, lyDo: `Chỉ còn trống ${con}` };
  return { duoc: true, ma: "", lyDo: "" };
}

/**
 * Kho có kệ đang hoạt động: chỉ khi đó lô có hàng đạt mới bắt chọn kệ (khớp backend khaiBaoLo). Kho có kệ nhưng
 * kệ nào cũng bảo trì thì hàng đạt nhập kho chưa gắn kệ.
 */
export const coKeHoatDong = (viTris) => (viTris ?? []).some((v) => v.trangThai === "HOAT_DONG");

/** Câu báo khi quét / chọn phải kệ không dùng được. */
export function cauKeKhongDuoc(ke, kt) {
  return kt.ma === KE_KHONG_DUOC.BAO_TRI ? `Kệ ${ke.maViTri} đang bảo trì, hãy chọn kệ khác.` : `Kệ ${ke.maViTri} đã đầy, hãy chọn kệ khác.`;
}

/**
 * Mã lô gợi ý <tiền tố>-<số phiếu>-NN (tiền tố trong Cấu hình › Nhập kho, mặc định LO), không trùng mã lô đã khóa
 * của biến thể (số phiếu đã duy nhất nên mã lô không trùng phiếu khác).
 */
export function goiYMaLo(soPhieu, maLoDaCo = [], tienTo = TIEN_TO_MA_LO_MAC_DINH) {
  const daCo = new Set(maLoDaCo.map((m) => String(m).trim().toUpperCase()));
  const tt = String(tienTo || TIEN_TO_MA_LO_MAC_DINH).trim();
  let n = maLoDaCo.length + 1;
  let ma;
  do {
    ma = `${tt}-${soPhieu}-${String(n).padStart(2, "0")}`;
    n += 1;
  } while (daCo.has(ma.toUpperCase()));
  return ma;
}

/**
 * Điều kiện khóa lô. `coKe`: kho có kệ đang hoạt động (không có thì hàng đạt chưa gắn kệ vẫn khóa được).
 * `keDangTai`: danh sách kệ chưa tải xong — chưa biết kho có kệ hay không nên chưa cho khóa lô có hàng đạt.
 * Trả { maLo, ke, thieu: [...], loi: [...], ok }.
 */
export function dieuKienKhoaLo(phien, { t, viTris = [], coKe, keDangTai = false, maLoGoiY, maLoDaCo = [], homNay }) {
  const maLo = String(phien.maLo ?? maLoGoiY ?? "").trim();
  // Kho không còn kệ đang hoạt động: kệ chọn từ trước (nay bảo trì) không gửi được và không chọn kệ khác được → bỏ qua
  const keChon = viTris.find((v) => v.id === phien.keId) ?? null;
  const ke = keChon && (coKe || keDungDuoc(keChon, 0).duoc) ? keChon : null;
  const thieu = [];
  const loi = [];
  // Mọi lượt trong lô (không chỉ lượt hiện tại) phải có quyết định: phiên đọc lại có thể còn lượt chờ cũ
  const cho = phien.log.find(thieuQuyetDinh);
  if (t.trongLo === 0) thieu.push("sản phẩm");
  if (t.datLo > 0 && keDangTai) loi.push("Đang tải danh sách kệ, chờ một chút rồi khóa.");
  if (t.datLo > 0 && coKe && !keDangTai && !ke) thieu.push("kệ cho hàng đạt");
  if (!maLo) thieu.push("mã lô");
  if (!phien.nsx) thieu.push("ngày sản xuất");
  if (cho) {
    const thieuGi = cho.kq === "cho" ? "chưa chọn Đạt hay Không đạt" : "chưa chọn lý do không đạt";
    // Lượt hiện tại chọn được trên thẻ kết quả; lượt cũ hơn (phiên đọc lại từ trình duyệt) thì hoàn tác ở danh sách lượt
    loi.push(
      cho.id === phien.cur
        ? `Lượt quét ${cho.ma} ${thieuGi}. Chọn trên thẻ kết quả.`
        : `Lượt quét ${cho.ma}${cho.gio ? ` lúc ${cho.gio}` : ""} ${thieuGi}. Hoàn tác lượt đó ở danh sách "Lượt quét lô này" rồi quét lại sản phẩm.`,
    );
  }
  if (t.trongLo > 0 && t.daKhoa + t.trongLo > t.can) {
    const conThieu = Math.max(0, t.can - t.daKhoa);
    loi.push(
      `Lô đang kiểm có ${t.trongLo} nhưng biến thể chỉ còn thiếu ${conThieu} (đã có lô khác được khóa thêm). ` +
        `Hoàn tác bớt ${t.daKhoa + t.trongLo - t.can} rồi khóa, sản phẩm thừa để riêng.`,
    );
  }
  if (ke && t.datLo > 0) {
    const kt = keDungDuoc(ke, t.datLo);
    if (!kt.duoc) {
      const con = conTrongKe(ke);
      loi.push(
        kt.ma === KE_KHONG_DUOC.BAO_TRI
          ? `Kệ ${ke.maViTri} đang bảo trì, hãy chọn kệ khác.`
          : `Kệ ${ke.maViTri} chỉ còn trống ${con ?? 0}, lô đang có ${t.datLo} đạt. Chọn kệ khác.`,
      );
    }
  }
  if (maLo && maLo.length > 50) loi.push("Mã lô tối đa 50 ký tự.");
  if (maLoChuaTheLenh(maLo)) {
    loi.push(`Mã lô có chứa mã thẻ lệnh (${TIEN_TO_THE_LENH}…), có thể máy quét đã gõ nhầm vào ô Mã lô. Sửa lại mã lô.`);
  }
  if (maLo && maLoDaCo.some((m) => String(m).trim().toUpperCase() === maLo.toUpperCase())) {
    loi.push(`Mã lô ${maLo} đã có trong phiếu, hãy đổi mã khác.`);
  }
  if (phien.nsx && homNay && phien.nsx > homNay) loi.push("Ngày sản xuất không được sau hôm nay.");
  if (phien.nsx && phien.nsx < NSX_SOM_NHAT) loi.push("Ngày sản xuất không hợp lệ, kiểm tra lại năm.");
  return { maLo, ke, thieu, loi, ok: thieu.length === 0 && loi.length === 0 };
}

/** "Tên sản phẩm · màu · kích cỡ" để phân biệt các biến thể cùng sản phẩm. */
export function tenDayDu(item) {
  if (!item) return "";
  return [item.tenBienThe, item.mauSac, item.kichCo].filter(Boolean).join(" · ");
}

/** Mọi mã nhận ra biến thể (SKU, mã vạch tem FCentric, mã vạch NCC đã liên kết), viết hoa. */
export function maCuaBienThe(item) {
  return [item?.sku, item?.maVachSku, ...(item?.maVachNcc ?? [])].filter(Boolean).map((m) => String(m).toUpperCase());
}

/** Ngày hôm nay yyyy-MM-dd theo giờ máy (ô ngày của trình duyệt cũng theo giờ máy). */
export function ngayHomNay(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
