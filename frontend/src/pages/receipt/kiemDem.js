/**
 * Logic thuần của màn Kiểm đếm & khóa lô (PA2, chốt 19/10/2026). Không phụ thuộc React để kiểm bằng `node --test`.
 *
 * "Phiên" là lô đang kiểm của một biến thể, lưu tạm trong trình duyệt tới khi khóa lô:
 *   { log: [Lượt], cur, dem, dsKe, maLo, nsx }
 *   Lượt = { id, gio, ma, nguon, sl, kq: "cho" | "dat" | "loi", loi, lyDo, huy }
 *   - dsKe: kệ cho hàng đạt theo thứ tự quét [{ id, sl }]; kệ đầu là kệ chính. `sl` null = máy tự chia (lấp từng kệ
 *     theo chỗ trống), số = người kiểm gõ tay. Một lô xếp được vào nhiều kệ (chốt 20/11/2026, PA A).
 *   - kq "cho": chế độ "Quét thẻ cho từng cái", đang chờ quét ĐẠT / KHÔNG ĐẠT.
 *   - kq "loi": `loi` cái không đạt (1..sl), phần còn lại của lượt là đạt; `lyDo` bắt buộc trước lượt kế tiếp.
 *   - maLo null: dùng mã gợi ý.
 */

import { TIEN_TO_THE_LENH } from "../../utils/maVach.js";
import { t } from "../../i18n/t.js";

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

export const phienMoi = (nsx = "") => ({ log: [], cur: null, dem: 1, dsKe: [], maLo: null, nsx });

/** Danh sách kệ đọc lại từ trình duyệt: bỏ dòng hỏng, kệ trùng. Bản tạm cũ (trước 20/11) chỉ có `keId`. */
function chuanHoaDsKe(raw) {
  if (!Array.isArray(raw.dsKe)) return Number.isInteger(raw.keId) ? [{ id: raw.keId, sl: null }] : [];
  const daCo = new Set();
  return raw.dsKe
    .filter((d) => d && Number.isInteger(d.id) && !daCo.has(d.id) && daCo.add(d.id))
    .map((d) => ({ id: d.id, sl: Number.isInteger(d.sl) && d.sl >= 0 ? d.sl : null }));
}

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
    dsKe: chuanHoaDsKe(raw),
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
  (l.phanKe == null || (Array.isArray(l.phanKe) && l.phanKe.every((k) => k && Number.isInteger(k.id) && Number.isInteger(k.sl)))) &&
  typeof l.nsx === "string" &&
  Number.isInteger(l.dem);

/**
 * Lô trên máy chủ có đúng là lần khóa `lan` ({ maLo, dat, loi, keId, phanKe, nsx }) không: trùng mã (không phân biệt
 * hoa thường), số đạt, số lỗi, kệ (kệ chính và từng phần khi lô xếp nhiều kệ) và ngày sản xuất. Dùng khi lần khóa trước
 * không rõ kết quả (mất phản hồi) để không khóa lại thành lô trùng.
 */
export function khopLanKhoa(lo, lan) {
  if (!lo || !lan) return false;
  const hoa = (v) => String(v ?? "").trim().toUpperCase();
  // Máy chủ chỉ trả phanKe cho lô từ hai kệ trở lên; lần khóa một kệ không có phanKe
  const keLo = (lo.phanKe ?? []).map((k) => `${k.viTriKhoId}:${Number(k.soLuong)}`).join(",");
  const keLan = (lan.phanKe ?? []).map((k) => `${k.id}:${k.sl}`).join(",");
  return (
    hoa(lo.maLo) === hoa(lan.maLo) &&
    Number(lo.soLuongNhap || 0) === lan.dat &&
    Number(lo.soLuongLoi || 0) === lan.loi &&
    (lo.viTriKhoId ?? null) === (lan.keId ?? null) &&
    keLo === keLan &&
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
    t("Chưa tải được danh sách lô để kiểm lần khóa lô {{maLo}} lúc mất phản hồi đã được lưu hay chưa", { maLo }) +
    (lyDo ? ` (${lyDo}).` : ".") +
    t(" Lô đang kiểm vẫn giữ nguyên các lượt quét, khóa lại sau khi tải được.")
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
    ? t("Chọn Đạt hoặc Không đạt cho {{ma}} trước: quét thẻ ĐẠT / KHÔNG ĐẠT hoặc bấm trên thẻ kết quả.", { ma: cho.luot.ma })
    : t("Chọn lý do không đạt cho {{ma}} trước: quét mã lý do trên thẻ lệnh hoặc bấm chọn trên thẻ kết quả.", { ma: cho.luot.ma });
}

/**
 * Số liệu biến thể: lô đã khóa (từ máy chủ) + lô đang kiểm (phiên).
 * `xong` chỉ khi số ĐÃ KHÓA đủ số đặt — hàng còn trong lô chưa khóa chưa được lưu.
 */
export function tinh(phien, { canNhap, datKhoa, loiKhoa }) {
  const can = Math.max(0, Number(canNhap) || 0);
  const datLo = phien.log.reduce((tg, e) => tg + datCua(e), 0);
  const loiLo = phien.log.reduce((tg, e) => tg + loiCua(e), 0);
  const choLo = phien.log.reduce((tg, e) => tg + (!e.huy && e.kq === "cho" ? e.sl : 0), 0);
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
export function nhanTrangThai(tg) {
  // i18n-giu-nguyen: nhãn StatusBadge tự dịch
  if (tg.vuot > 0 && tg.trongLo > 0) return "Vượt số đặt";
  // i18n-giu-nguyen: nhãn StatusBadge tự dịch
  if (tg.xong) return "Đã kiểm xong";
  // i18n-giu-nguyen: nhãn StatusBadge tự dịch
  if (tg.conLai === 0 && tg.trongLo > 0) return "Chờ khóa lô";
  // i18n-giu-nguyen: nhãn StatusBadge tự dịch
  if (tg.daKiem > 0) return "Đang kiểm đếm";
  // i18n-giu-nguyen: nhãn StatusBadge tự dịch
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
    nguon: nguon + (soTinh < soLuong ? t(" · chỉ tính {{soTinh}} vì đủ số đặt", { soTinh }) : ""),
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
  if (e.kq === "cho") return t("Chờ chọn Đạt / Không đạt · {{sl}}", { sl: e.sl });
  if (e.kq === "loi") return t("Không đạt {{loi}} · {{lyDo}}{{phanDat}}", { loi: e.loi, lyDo: e.lyDo ? t(e.lyDo) : t("chưa chọn lý do"), phanDat: e.sl - e.loi ? t(" · Đạt {{soDat}}", { soDat: e.sl - e.loi }) : "" });
  return t("Đạt {{sl}}", { sl: e.sl });
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
  if (!viTri) return { duoc: false, ma: KE_KHONG_DUOC.KHONG_CO, lyDo: t("Không có kệ") };
  if (viTri.trangThai && viTri.trangThai !== "HOAT_DONG") return { duoc: false, ma: KE_KHONG_DUOC.BAO_TRI, lyDo: t("Bảo trì") };
  const con = conTrongKe(viTri);
  if (con === null) return { duoc: true, ma: "", lyDo: "" };
  if (con <= 0) return { duoc: false, ma: KE_KHONG_DUOC.DAY, lyDo: t("Đầy") };
  if (datLo > con) return { duoc: false, ma: KE_KHONG_DUOC.CHI_CON, lyDo: t("Chỉ còn trống {{con}}", { con }) };
  return { duoc: true, ma: "", lyDo: "" };
}

/**
 * Kho có kệ đang hoạt động: chỉ khi đó lô có hàng đạt mới bắt chọn kệ (khớp backend khaiBaoLo). Kho có kệ nhưng
 * kệ nào cũng bảo trì thì hàng đạt nhập kho chưa gắn kệ.
 */
export const coKeHoatDong = (viTris) => (viTris ?? []).some((v) => v.trangThai === "HOAT_DONG");

/** Câu báo khi quét / chọn phải kệ không dùng được. */
export function cauKeKhongDuoc(ke, kt) {
  return kt.ma === KE_KHONG_DUOC.BAO_TRI ? t("Kệ {{maViTri}} đang bảo trì, hãy chọn kệ khác.", { maViTri: ke.maViTri }) : t("Kệ {{maViTri}} đã đầy, hãy chọn kệ khác.", { maViTri: ke.maViTri });
}

/**
 * Chia hàng đạt của lô vào các kệ đã chọn, theo thứ tự quét. Kệ gõ tay số giữ đúng số đó; kệ tự chia lấp dần phần còn
 * lại, tối đa bằng chỗ trống của kệ (kệ không giới hạn nhận hết phần còn lại). Kệ không còn trong danh sách kệ của
 * kho thì bỏ qua.
 * Trả { phan: [{ ke, sl, tuChia }], chuaXep, xepThua }: `chuaXep` hàng đạt chưa có kệ, `xepThua` số gõ tay vượt số đạt.
 */
export function chiaKe(dsKe, datLo, viTris = []) {
  const ds = (dsKe ?? []).map((d) => ({ d, ke: viTris.find((v) => v.id === d.id) ?? null })).filter((x) => x.ke);
  let conLai = datLo - ds.reduce((s, x) => s + (x.d.sl ?? 0), 0);
  const phan = ds.map(({ d, ke }) => {
    if (d.sl != null) return { ke, sl: d.sl, tuChia: false };
    const con = conTrongKe(ke);
    const sl = Math.max(0, con === null ? conLai : Math.min(con, conLai));
    conLai -= sl;
    return { ke, sl, tuChia: true };
  });
  return { phan, chuaXep: Math.max(0, conLai), xepThua: Math.max(0, -conLai) };
}

/**
 * Quét / chọn một kệ cho hàng đạt của lô đang kiểm. Trả { phien, loai }:
 * - "da-co": kệ đã có trong danh sách, không đổi gì.
 * - "doi": hàng đạt đã có đủ kệ (hoặc lô chưa có hàng đạt) → quét kệ khác là đổi sang kệ đó, như trước khi có nhiều kệ.
 * - "them": còn hàng đạt chưa có kệ → thêm kệ vào cuối danh sách để nhận phần còn lại.
 */
export function themKeVaoLo(phien, keId, { datLo, viTris = [] }) {
  const dsKe = phien.dsKe ?? [];
  if (dsKe.some((d) => d.id === keId)) return { phien, loai: "da-co" };
  const { chuaXep } = chiaKe(dsKe, datLo, viTris);
  if (dsKe.length && chuaXep === 0) return { phien: { ...phien, dsKe: [{ id: keId, sl: null }] }, loai: "doi" };
  return { phien: { ...phien, dsKe: [...dsKe, { id: keId, sl: null }] }, loai: "them" };
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
 * Trả { maLo, ke, phan, phanGui, chuaXep, cauChuaXep, thieu: [...], loi: [...], ok }: `ke` kệ chính, `phan` mọi kệ đã
 * chọn kèm số chia (để hiện), `phanGui` các kệ nhận hàng (số > 0) để gửi máy chủ, `cauChuaXep` câu báo còn hàng đạt
 * chưa có kệ (cũng nằm trong `loi`).
 */
export function dieuKienKhoaLo(phien, { t: tg, viTris = [], coKe, keDangTai = false, maLoGoiY, maLoDaCo = [], homNay }) {
  const maLo = String(phien.maLo ?? maLoGoiY ?? "").trim();
  // Kho không còn kệ đang hoạt động: kệ chọn từ trước (nay bảo trì) không gửi được và không chọn kệ khác được → bỏ qua
  const dsKe = (phien.dsKe ?? []).filter((d) => {
    const v = viTris.find((x) => x.id === d.id);
    return v && (coKe || keDungDuoc(v, 0).duoc);
  });
  const { phan, chuaXep, xepThua } = chiaKe(dsKe, tg.datLo, viTris);
  const phanGui = phan.filter((x) => x.sl > 0);
  const ke = phanGui[0]?.ke ?? phan[0]?.ke ?? null;
  const thieu = [];
  const loi = [];
  // Câu "còn … chưa có kệ" riêng ra để hộp Khóa lô hiện ngay dưới bảng kệ, không lặp ở dòng lỗi chung
  let cauChuaXep = null;
  // Mọi lượt trong lô (không chỉ lượt hiện tại) phải có quyết định: phiên đọc lại có thể còn lượt chờ cũ
  const cho = phien.log.find(thieuQuyetDinh);
  if (tg.trongLo === 0) thieu.push(t("sản phẩm"));
  if (tg.datLo > 0 && keDangTai) loi.push(t("Đang tải danh sách kệ, chờ một chút rồi khóa."));
  if (tg.datLo > 0 && coKe && !keDangTai && !phan.length) thieu.push(t("kệ cho hàng đạt"));
  if (!maLo) thieu.push(t("mã lô"));
  if (!phien.nsx) thieu.push(t("ngày sản xuất"));
  if (cho) {
    const thieuGi = cho.kq === "cho" ? t("chưa chọn Đạt hay Không đạt") : t("chưa chọn lý do không đạt");
    // Lượt hiện tại chọn được trên thẻ kết quả; lượt cũ hơn (phiên đọc lại từ trình duyệt) thì hoàn tác ở danh sách lượt
    loi.push(
      cho.id === phien.cur
        ? t("Lượt quét {{ma}} {{thieuGi}}. Chọn trên thẻ kết quả.", { ma: cho.ma, thieuGi })
        : t("Lượt quét {{ma}}{{phanGio}} {{thieuGi}}. Hoàn tác lượt đó ở danh sách \"Lượt quét lô này\" rồi quét lại sản phẩm.", { ma: cho.ma, phanGio: cho.gio ? t(" lúc {{gio}}", { gio: cho.gio }) : "", thieuGi }),
    );
  }
  if (tg.trongLo > 0 && tg.daKhoa + tg.trongLo > tg.can) {
    const conThieu = Math.max(0, tg.can - tg.daKhoa);
    loi.push(
      t("Lô đang kiểm có {{trongLo}} nhưng biến thể chỉ còn thiếu {{conThieu}} (đã có lô khác được khóa thêm). ", { trongLo: tg.trongLo, conThieu }) +
        t("Hoàn tác bớt {{soThua}} rồi khóa, sản phẩm thừa để riêng.", { soThua: tg.daKhoa + tg.trongLo - tg.can }),
    );
  }
  if (phan.length && tg.datLo > 0) {
    for (const x of phan) {
      if (x.ke.trangThai && x.ke.trangThai !== "HOAT_DONG") {
        loi.push(t("Kệ {{maViTri}} đang bảo trì, hãy chọn kệ khác.", { maViTri: x.ke.maViTri }));
        continue;
      }
      const con = conTrongKe(x.ke);
      // Kệ tự chia không bao giờ vượt chỗ trống; chỉ số gõ tay mới vượt được
      if (con !== null && x.sl > con) {
        loi.push(t("Kệ {{maViTri}} chỉ còn trống {{con}}, đang xếp {{sl}}. Giảm số ở kệ này rồi quét thêm kệ khác.", { maViTri: x.ke.maViTri, con, sl: x.sl }));
      }
    }
    if (xepThua > 0) {
      loi.push(t("Đã xếp {{xep}} vào kệ nhưng lô chỉ có {{datLo}} đạt. Giảm số ở bảng kệ.", { xep: tg.datLo + xepThua, datLo: tg.datLo }));
    } else if (chuaXep > 0) {
      cauChuaXep = t("Còn {{soCon}} đạt chưa có kệ, quét thêm kệ.", { soCon: chuaXep });
      loi.push(cauChuaXep);
    }
  }
  if (maLo && maLo.length > 50) loi.push(t("Mã lô tối đa 50 ký tự."));
  if (maLoChuaTheLenh(maLo)) {
    loi.push(t("Mã lô có chứa mã thẻ lệnh ({{TIEN_TO_THE_LENH}}…), có thể máy quét đã gõ nhầm vào ô Mã lô. Sửa lại mã lô.", { TIEN_TO_THE_LENH }));
  }
  if (maLo && maLoDaCo.some((m) => String(m).trim().toUpperCase() === maLo.toUpperCase())) {
    loi.push(t("Mã lô {{maLo}} đã có trong phiếu, hãy đổi mã khác.", { maLo }));
  }
  if (phien.nsx && homNay && phien.nsx > homNay) loi.push(t("Ngày sản xuất không được sau hôm nay."));
  if (phien.nsx && phien.nsx < NSX_SOM_NHAT) loi.push(t("Ngày sản xuất không hợp lệ, kiểm tra lại năm."));
  return { maLo, ke, phan, phanGui, chuaXep, cauChuaXep, thieu, loi, ok: thieu.length === 0 && loi.length === 0 };
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
