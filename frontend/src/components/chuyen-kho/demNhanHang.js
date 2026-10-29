/*
 * Logic thuần của màn Nhận hàng chuyển kho (B.4) theo cách kiểm đếm của màn nhập hàng NCC (PA A, chốt 30/10/2026):
 * lượt quét, chia lô, đổi Đạt / Hỏng, lý do hỏng theo danh mục LY_DO_LOI, hoàn tác, ghép lý do gửi máy chủ, lưu tạm
 * trong thẻ trình duyệt. Không phụ thuộc React, chạy được bằng `node --test`
 * (src/components/chuyen-kho/demNhanHang.test.js).
 *
 * "Phiên nhận" = { dem, log, cur, so }:
 * - `dem`: { [khoaLo]: { dat, hong: { [lyDo]: số }, ghiChu } }. Khóa LY_DO_CHUA_CHON ("?") của `hong` là cái hỏng của
 *   lượt quét đang chờ chọn lý do.
 * - `log`: lượt quét, mới nhất trước. Lượt = { id, gio, ma, sku, bienTheId, nguon, phan: [{ khoa, sl }], sl,
 *   kq: "dat" | "hong", hong, lyDo, huy }. `phan`: số đã cộng vào từng lô (gõ 12* có thể chia sang nhiều lô).
 * Đổi một lượt = trừ phần cũ của lượt rồi cộng phần mới; hoàn tác = trừ phần của lượt (số không xuống dưới 0 khi người
 * kiểm đã gõ tay đè lên số của lượt đó).
 */
import { LY_DO_LOI } from "../../constants/nhapKho.js";
import { docSoLuong, khoaLo, tinhNhanHang } from "./hienThiChuyenKho.js";

/** Khóa của cái hỏng chưa chọn lý do (lượt quét vừa đổi thành Hỏng). */
export const LY_DO_CHUA_CHON = "?";
/** Lý do "Khác" của danh mục: phải ghi rõ ở ô ghi chú. */
export const LY_DO_KHAC = "Khác";
/** Ô ghi chú lý do tối đa: chữ ghép (hỏng theo lý do + thiếu) vẫn dưới 255 ký tự của máy chủ. */
export const GHI_CHU_TOI_DA = 150;
const LY_DO_TOI_DA = 255;

const chuoi = (v) => String(v ?? "").trim();
const soNguyen = (v) => (Number.isInteger(v) && v >= 0 ? v : null);

export const phienNhanMoi = () => ({ dem: {}, log: [], cur: null, so: 1 });

const dongDem = (dem, khoa) => dem?.[khoa] ?? { dat: 0, hong: {}, ghiChu: "" };

/** Tổng cái hỏng của một dòng đếm (kể cả cái chưa chọn lý do). */
export const tongHong = (r) => Object.values(r?.hong ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);

/** Còn đếm thêm được bao nhiêu ở một lô: Gửi − Đạt − Hỏng (không âm). */
export function conDemDuoc(lo, dem) {
    const r = dongDem(dem, khoaLo(lo));
    return Math.max(0, docSoLuong(lo.soLuong) - r.dat - tongHong(r));
}

/** Các lô của một biến thể theo thứ tự trong phiếu. */
export const loCuaBienThe = (dsLo, bienTheId) => (Array.isArray(dsLo) ? dsLo : []).filter((l) => l.bienTheId === bienTheId);

/** Tổng số gửi của một biến thể (mọi lô). */
export const guiCuaBienThe = (dsLo, bienTheId) => loCuaBienThe(dsLo, bienTheId).reduce((s, l) => s + docSoLuong(l.soLuong), 0);

/** Biến thể của phiếu khớp mã quét (SKU hoặc mã vạch tem FCentric, không phân biệt hoa thường) hoặc null. */
export function timBienTheTheoMa(dsLo, ma) {
    const hoa = chuoi(ma).toUpperCase();
    if (!hoa) return null;
    const ds = Array.isArray(dsLo) ? dsLo : [];
    const theoSku = ds.find((l) => chuoi(l.sku).toUpperCase() === hoa);
    if (theoSku) return { bienTheId: theoSku.bienTheId, nguon: "quét SKU" };
    const theoMaVach = ds.find((l) => chuoi(l.maVach) && chuoi(l.maVach).toUpperCase() === hoa);
    return theoMaVach ? { bienTheId: theoMaVach.bienTheId, nguon: "mã vạch FCentric" } : null;
}

/** Chia `n` cái vào các lô (cùng biến thể) còn đếm được, theo thứ tự lô: { phan: [{ khoa, sl }], tinh }. */
export function chiaLo(dsLoBienThe, dem, n) {
    const phan = [];
    let con = Math.max(0, n);
    for (const lo of dsLoBienThe) {
        if (con <= 0) break;
        const lay = Math.min(con, conDemDuoc(lo, dem));
        if (lay > 0) {
            phan.push({ khoa: khoaLo(lo), sl: lay });
            con -= lay;
        }
    }
    return { phan, tinh: Math.max(0, n) - con };
}

/** Cộng (`dau` = 1) hoặc trừ (`dau` = −1) phần của một lượt vào bảng đếm. Cái hỏng tính từ lô cuối của lượt ngược lên. */
function apDung(dem, luot, dau) {
    const moi = { ...dem };
    let con = luot.kq === "hong" ? luot.hong : 0;
    const hongPhan = luot.phan.map(() => 0);
    for (let i = luot.phan.length - 1; i >= 0 && con > 0; i -= 1) {
        hongPhan[i] = Math.min(con, luot.phan[i].sl);
        con -= hongPhan[i];
    }
    luot.phan.forEach((p, i) => {
        const r = dongDem(moi, p.khoa);
        const hong = { ...r.hong };
        const h = hongPhan[i];
        if (h) {
            const k = luot.lyDo || LY_DO_CHUA_CHON;
            const v = (hong[k] || 0) + dau * h;
            if (v > 0) hong[k] = v;
            else delete hong[k];
        }
        moi[p.khoa] = { ...r, dat: Math.max(0, r.dat + dau * (p.sl - h)), hong };
    });
    return moi;
}

/**
 * Thêm một lượt quét đúng biến thể `bienTheId`: chia `soLuong` vào các lô còn đếm được, mặc định Đạt (Đ2: luôn "Quét
 * tiếp là Đạt"). Đủ số gửi rồi thì không cộng (Đ5): trả { phien, luot: null, tinh: 0 }. Lượt hiện tại còn chờ chọn lý
 * hỏng thì cũng không cộng: trả thêm `choLyDo` (lượt đang chờ).
 */
export function themLuot(phien, dsLo, { bienTheId, ma, soLuong = 1, nguon, gio }) {
    const cho = luotChoLyDo(phien);
    if (cho) return { phien, luot: null, tinh: 0, choLyDo: cho };
    const cung = loCuaBienThe(dsLo, bienTheId);
    const { phan, tinh } = chiaLo(cung, phien.dem, soLuong);
    if (tinh <= 0) return { phien, luot: null, tinh: 0 };
    const luot = { id: phien.so, gio, ma, sku: cung[0].sku, bienTheId, nguon, phan, sl: tinh, kq: "dat", hong: 0, lyDo: null, huy: false };
    return {
        phien: { ...phien, dem: apDung(phien.dem, luot, 1), log: [luot, ...phien.log], cur: luot.id, so: phien.so + 1 },
        luot,
        tinh,
    };
}

export const luotHienTai = (phien) => (phien?.cur == null ? null : phien.log.find((e) => e.id === phien.cur && !e.huy) ?? null);

/** Lượt hiện tại đã đổi thành Hỏng mà chưa chọn lý do: chặn lần quét sau. */
export function luotChoLyDo(phien) {
    const c = luotHienTai(phien);
    return c && c.kq === "hong" && !c.lyDo ? c : null;
}

/**
 * Sửa lượt hiện tại (`sua(lượt)` trả các trường đổi). Đổi số lượng thì chia lại lô theo chỗ còn trống; số hỏng luôn
 * 1..số lượng khi là Hỏng. Không có lượt hiện tại thì trả nguyên phiên.
 */
export function suaLuot(phien, dsLo, sua) {
    const c = luotHienTai(phien);
    if (!c) return phien;
    const demTru = apDung(phien.dem, c, -1);
    const muon = { ...c, ...sua(c) };
    let luot = { ...muon, phan: c.phan, sl: c.sl };
    if (muon.sl !== c.sl) {
        const chia = chiaLo(loCuaBienThe(dsLo, c.bienTheId), demTru, Math.max(1, muon.sl));
        if (chia.tinh > 0) luot = { ...muon, phan: chia.phan, sl: chia.tinh };
    }
    luot.hong = luot.kq === "hong" ? Math.max(1, Math.min(luot.sl, luot.hong || 1)) : 0;
    if (luot.kq !== "hong") luot.lyDo = null;
    return { ...phien, dem: apDung(demTru, luot, 1), log: phien.log.map((e) => (e.id === c.id ? luot : e)) };
}

export const thanhHong = (phien, dsLo) => suaLuot(phien, dsLo, (c) => ({ kq: "hong", hong: c.kq === "hong" ? c.hong : 1 }));
export const thanhDat = (phien, dsLo) => suaLuot(phien, dsLo, () => ({ kq: "dat", hong: 0, lyDo: null }));
export const chonLyDo = (phien, dsLo, lyDo) => suaLuot(phien, dsLo, (c) => (c.kq === "hong" ? { lyDo } : {}));
/** ± số lượng của lượt hiện tại (tối thiểu 1, tối đa theo chỗ còn trống của các lô). */
export const doiSoLuong = (phien, dsLo, delta) => suaLuot(phien, dsLo, (c) => ({ sl: Math.max(1, c.sl + delta) }));
/** ± "Trong đó hỏng" của lượt hiện tại (1..số lượng). */
export const doiSoHong = (phien, dsLo, delta) => suaLuot(phien, dsLo, (c) => (c.kq === "hong" ? { hong: c.hong + delta } : {}));

/** Hoàn tác một lượt (giữ trong danh sách, đánh dấu đã hoàn tác): { phien, luot } hoặc { phien, luot: null }. */
export function hoanTacLuot(phien, id) {
    const luot = phien.log.find((e) => e.id === id && !e.huy);
    if (!luot) return { phien, luot: null };
    return {
        phien: {
            ...phien,
            dem: apDung(phien.dem, luot, -1),
            log: phien.log.map((e) => (e.id === id ? { ...e, huy: true } : e)),
            cur: phien.cur === id ? null : phien.cur,
        },
        luot,
    };
}

/** Lượt để thẻ HOÀN TÁC lùi: lượt hiện tại, không có thì lượt gần nhất còn hiệu lực. */
export const luotDeHoanTac = (phien) => luotHienTai(phien) ?? phien.log.find((e) => !e.huy) ?? null;

/**
 * Lô `khoa` đang có cái hỏng của lượt chờ chọn lý do: chưa cho gõ tay ô Đạt / ô Hỏng của lô đó (gõ đè thì số "chưa
 * chọn lý do" không còn khớp lượt, kẹt lại không gỡ được).
 */
export const loDangChoLyDo = (phien, khoa) => Boolean(luotChoLyDo(phien)?.phan.some((p) => p.khoa === khoa));

/**
 * Gõ tay đè lên lô của lượt hiện tại: lượt đó coi như xong (thẻ kết quả không sửa được nữa), vì số trên ô không còn là
 * số của lượt; sửa tiếp lượt sẽ cộng lại phần cũ của lượt lên số vừa gõ (Đạt + Hỏng vượt số gửi).
 */
function xongLuotNeuCham(phien, khoa) {
    return luotHienTai(phien)?.phan.some((p) => p.khoa === khoa) ? { ...phien, cur: null } : phien;
}

/** Gõ tay ô Đạt (đếm tay không có máy quét). Lô đang chờ chọn lý do hỏng thì không đổi. */
export function datTay(phien, khoa, soDat) {
    if (loDangChoLyDo(phien, khoa)) return phien;
    const r = dongDem(phien.dem, khoa);
    return xongLuotNeuCham({ ...phien, dem: { ...phien.dem, [khoa]: { ...r, dat: Math.max(0, Math.trunc(Number(soDat) || 0)) } } }, khoa);
}

/**
 * ± một lý do ở hộp Hỏng của một lô; thêm không vượt Gửi − Đạt − Hỏng (Đ4: ô Hỏng chỉ đổi theo lý do). Lô đang chờ chọn
 * lý do hỏng thì không đổi.
 */
export function doiHongTay(phien, lo, lyDo, delta) {
    const khoa = khoaLo(lo);
    if (loDangChoLyDo(phien, khoa)) return phien;
    const r = dongDem(phien.dem, khoa);
    if (delta > 0 && conDemDuoc(lo, phien.dem) < delta) return phien;
    const hong = { ...r.hong };
    const v = Math.max(0, (hong[lyDo] || 0) + delta);
    if (v > 0) hong[lyDo] = v;
    else delete hong[lyDo];
    return xongLuotNeuCham({ ...phien, dem: { ...phien.dem, [khoa]: { ...r, hong } } }, khoa);
}

export function doiGhiChu(phien, khoa, ghiChu) {
    const r = dongDem(phien.dem, khoa);
    return { ...phien, dem: { ...phien.dem, [khoa]: { ...r, ghiChu: String(ghiChu ?? "").slice(0, GHI_CHU_TOI_DA) } } };
}

/** Lý do hỏng của một dòng theo thứ tự danh mục, bỏ cái chưa chọn lý do: [[lyDo, số], …]. */
export function hongTheoLyDo(r) {
    const thuTu = (k) => {
        const i = LY_DO_LOI.indexOf(k);
        return i < 0 ? LY_DO_LOI.length : i;
    };
    return Object.entries(r?.hong ?? {})
        .filter(([k, v]) => k !== LY_DO_CHUA_CHON && v > 0)
        .sort((a, b) => thuTu(a[0]) - thuTu(b[0]));
}

/**
 * Chữ lý do gửi máy chủ cho một dòng lệch (cột ly_do_hong_thieu, tối đa 255): "Hỏng 2: Rách vải 1, Ố bẩn 1. Thiếu 1:
 * <ghi chú>". Một lý do thì không ghi số lần nữa. Ghi chú đi với phần thiếu; không thiếu thì ghi chú làm rõ lý do Khác;
 * có cả thiếu lẫn lý do Khác thì ghi chú đứng riêng ("… Thiếu 1. Ghi chú: …"). Quá 255 ký tự thì cắt bớt ghi chú.
 */
export function ghepLyDo({ hong, thieu, lyDos, ghiChu }) {
    const coKhac = lyDos.some(([k]) => k === LY_DO_KHAC);
    const ghep = (gc) => {
        const phan = [];
        if (hong > 0) {
            const theoLyDo = lyDos.length === 1 ? lyDos[0][0] : lyDos.map(([k, v]) => `${k} ${v}`).join(", ");
            phan.push(`Hỏng ${hong}: ${theoLyDo}${gc && thieu <= 0 ? ` (${gc})` : ""}`);
        }
        if (thieu > 0) phan.push(gc && coKhac ? `Thiếu ${thieu}. Ghi chú: ${gc}` : `Thiếu ${thieu}${gc ? `: ${gc}` : ""}`);
        return phan.join(". ");
    };
    const gc = chuoi(ghiChu);
    const du = ghep(gc);
    if (du.length <= LY_DO_TOI_DA || !gc) return du.slice(0, LY_DO_TOI_DA);
    const giu = Math.max(0, gc.length - (du.length - LY_DO_TOI_DA) - 1);
    return ghep(giu ? `${gc.slice(0, giu)}…` : "").slice(0, LY_DO_TOI_DA);
}

/**
 * Bảng nhận hàng từ phiên: kết quả của tinhNhanHang (gui, dat, hong, thieu, vuot, lech, khop…) thêm cho mỗi dòng:
 * `lyDos` (hỏng theo lý do), `chuaLyDo` (cái hỏng chưa chọn lý do), `ghiChu`, `canGhiChu` (có thiếu hoặc lý do Khác,
 * Đ3), `lyDo` (chữ ghép gửi máy chủ), `thieuLyDo` (dòng lệch còn thiếu lý do / ghi chú). yeuCauNhanLech dùng thẳng kết quả.
 */
export function tinhNhan(dsLo, dem) {
    const ds = Array.isArray(dsLo) ? dsLo : [];
    const them = {};
    const demCu = {};
    for (const l of ds) {
        const k = khoaLo(l);
        const r = dongDem(dem, k);
        const hong = tongHong(r);
        const thieu = docSoLuong(l.soLuong) - r.dat - hong;
        const lyDos = hongTheoLyDo(r);
        const chuaLyDo = r.hong?.[LY_DO_CHUA_CHON] || 0;
        const canGhiChu = thieu > 0 || (r.hong?.[LY_DO_KHAC] || 0) > 0;
        // Ô ghi chú ẩn (hết thiếu, không còn lý do Khác) thì ghi chú cũ không lên biên bản
        const lyDo = ghepLyDo({ hong, thieu, lyDos, ghiChu: canGhiChu ? r.ghiChu : "" });
        demCu[k] = { dat: r.dat, hong, lyDo };
        them[k] = { lyDos, chuaLyDo, ghiChu: r.ghiChu ?? "", canGhiChu, thieuGhiChu: canGhiChu && !chuoi(r.ghiChu) };
    }
    const kq = tinhNhanHang(ds, demCu);
    const dong = kq.dong.map((d) => {
        const t = them[d.khoa];
        return { ...d, ...t, thieuLyDo: d.lech && (t.chuaLyDo > 0 || t.thieuGhiChu) };
    });
    return { ...kq, dong };
}

/** Câu một lượt ở thẻ "Lượt quét". */
export function nhanLuotNhan(e) {
    if (e.kq === "hong") return `Hỏng ${e.hong} · ${e.lyDo || "chưa chọn lý do"}${e.sl > e.hong ? ` · Đạt ${e.sl - e.hong}` : ""}`;
    return `Đạt ${e.sl}`;
}

// ── Lưu tạm trong thẻ trình duyệt (Đ6, như màn nhập NCC): tải lại trang không mất số; đóng thẻ là mất ──

const KHOA_LUU = (phieuId) => `fcentric:nhan-chuyen-kho:${phieuId}`;

/** Dấu của danh sách lô (khóa + số gửi): phiếu đổi hàng thì bản lưu cũ không dùng nữa. */
export const vanTayLo = (dsLo) => (Array.isArray(dsLo) ? dsLo : []).map((l) => `${khoaLo(l)}:${docSoLuong(l.soLuong)}`).join("|");

const luotHopLe = (e, khoaHopLe) =>
    e && Number.isInteger(e.id) && typeof e.ma === "string" && Number.isInteger(e.bienTheId) &&
    Number.isInteger(e.sl) && e.sl > 0 && (e.kq === "dat" || e.kq === "hong") &&
    (e.kq === "dat" ? e.hong === 0 && e.lyDo == null : Number.isInteger(e.hong) && e.hong >= 1 && e.hong <= e.sl) &&
    (e.lyDo == null || typeof e.lyDo === "string") &&
    Array.isArray(e.phan) && e.phan.length > 0 &&
    e.phan.every((p) => p && khoaHopLe.has(p.khoa) && Number.isInteger(p.sl) && p.sl > 0) &&
    e.phan.reduce((s, p) => s + p.sl, 0) === e.sl;

/**
 * Phiên đọc lại từ trình duyệt: sai dấu lô hoặc dữ liệu hỏng (số âm, lượt sai dạng, cái hỏng "chưa chọn lý do" không
 * thuộc lượt đang chờ) thì bắt đầu phiên mới thay vì làm vỡ màn hay để số kẹt không gỡ được.
 */
export function chuanHoaPhienNhan(raw, dsLo) {
    if (!raw || typeof raw !== "object" || raw.vanTay !== vanTayLo(dsLo) || !raw.dem || typeof raw.dem !== "object" || !Array.isArray(raw.log)) {
        return phienNhanMoi();
    }
    const khoaHopLe = new Set((dsLo ?? []).map(khoaLo));
    const dem = {};
    for (const [k, r] of Object.entries(raw.dem)) {
        if (!khoaHopLe.has(k) || !r || soNguyen(r.dat) == null) return phienNhanMoi();
        const hong = {};
        for (const [ly, v] of Object.entries(r.hong ?? {})) {
            if (!soNguyen(v)) return phienNhanMoi();
            hong[ly] = v;
        }
        dem[k] = { dat: r.dat, hong, ghiChu: typeof r.ghiChu === "string" ? r.ghiChu.slice(0, GHI_CHU_TOI_DA) : "" };
    }
    if (!raw.log.every((e) => luotHopLe(e, khoaHopLe))) return phienNhanMoi();
    const log = raw.log.map((e) => ({ ...e, huy: Boolean(e.huy), phan: e.phan.map((p) => ({ khoa: p.khoa, sl: p.sl })) }));
    const so = Math.max(Number(raw.so) || 1, ...log.map((e) => e.id + 1), 1);
    const phien = { dem, log, cur: log.some((e) => e.id === raw.cur && !e.huy) ? raw.cur : null, so };
    // Cái hỏng "chưa chọn lý do" chỉ có khi lượt hiện tại đang chờ lý do, và đúng bằng số hỏng của lượt đó
    const cho = luotChoLyDo(phien);
    const chuaChon = Object.values(dem).reduce((s, r) => s + (r.hong[LY_DO_CHUA_CHON] || 0), 0);
    if (chuaChon !== (cho ? cho.hong : 0)) return phienNhanMoi();
    return phien;
}

/** Phiên đã có gì để giữ chưa (số đếm, lượt quét, ghi chú). */
export const phienCoSo = (phien) =>
    Boolean(phien) && (phien.log.some((e) => !e.huy) || Object.values(phien.dem).some((r) => r.dat > 0 || tongHong(r) > 0 || chuoi(r.ghiChu)));

export function docPhienNhan(phieuId) {
    try {
        const raw = window.sessionStorage.getItem(KHOA_LUU(phieuId));
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/** Ghi phiên (kèm dấu lô); `phien` null hoặc chưa có gì thì xóa bản lưu. */
export function ghiPhienNhan(phieuId, phien, dsLo) {
    try {
        if (!phienCoSo(phien)) window.sessionStorage.removeItem(KHOA_LUU(phieuId));
        else window.sessionStorage.setItem(KHOA_LUU(phieuId), JSON.stringify({ ...phien, vanTay: vanTayLo(dsLo) }));
    } catch {
        // Trình duyệt chặn bộ nhớ phiên: vẫn đếm được, chỉ không giữ khi tải lại trang
    }
}
