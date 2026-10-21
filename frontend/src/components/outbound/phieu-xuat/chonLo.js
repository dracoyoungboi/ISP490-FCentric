/*
 * Hàm thuần của màn Chọn lô hàng (một dòng phiếu xuất), không React, chạy được bằng `node --test`:
 * quyền sửa, tổng đã chọn và kiểm tra trực tiếp, 4 kiểm tra khi lưu (giữ đúng thứ tự và câu của bản cũ) cùng payload `pick-lo`,
 * điền lại theo nhập trước lấy trước, thứ tự hiện lô, tình trạng từng lô.
 *
 * `lots`: GET …/available-lots → `[{ loHangId, maLo, ngayNhapGanNhat, soLuongKhaDung }]` (đã sắp nhập trước lấy trước).
 * `chon` / `daLuu`: `{ [loHangId]: "số" }` (chuỗi như ô nhập; daLuu dựng từ GET …/picked-lots).
 */
import { TRANG_THAI_PHIEU_XUAT } from "../../../constants/trangThaiXuatBan.js";
import { docSo, soVN } from "../../chung-tu/bangChungTu.js";

const soCua = (value) => Number(value) || 0;

/**
 * Được sửa lô không (khớp backend PhieuXuatKhoService.pickLoHang) và lý do chỉ xem:
 * phiếu bán hàng chỉ quản trị viên / quản lý kho sửa khi Nháp hoặc Chờ xuất; phiếu khác (chuyển kho) chọn lô khi Nháp.
 */
export function quyenChonLo({ loaiXuat, trangThai, laQuanLy = false } = {}) {
  const tt = Number(trangThai);
  const laBanHang = loaiXuat === "ban_hang";
  const duocSua = laBanHang
    ? Boolean(laQuanLy) && (tt === TRANG_THAI_PHIEU_XUAT.NHAP || tt === TRANG_THAI_PHIEU_XUAT.CHO_XUAT)
    : tt === TRANG_THAI_PHIEU_XUAT.NHAP;
  let lyDoXem = null;
  if (!duocSua) {
    if (tt === TRANG_THAI_PHIEU_XUAT.DA_XUAT || tt === 5) lyDoXem = "Phiếu đã xuất kho nên chỉ xem được lô đã lấy.";
    else if (tt === TRANG_THAI_PHIEU_XUAT.DA_HUY) lyDoXem = "Phiếu đã hủy nên chỉ xem được lô.";
    else if (laBanHang) lyDoXem = "Chỉ quản lý kho hoặc quản trị viên sửa được lô của phiếu bán hàng.";
    else lyDoXem = "Phiếu không còn ở trạng thái Nháp nên chỉ xem được lô.";
  }
  return { duocSua, laBanHang, lyDoXem };
}

/** Bản đồ số lượng theo lô từ GET …/picked-lots (`[{ loHangId, soLuongDaPick }]`), như bản cũ. */
export function banDoDaLay(daLay) {
  const map = {};
  (Array.isArray(daLay) ? daLay : []).forEach((item) => {
    if (item?.loHangId != null) map[item.loHangId] = String(item.soLuongDaPick);
  });
  return map;
}

/** Tổng số lượng của mọi lô (mọi trang, kể cả lô đang bị ô tìm ẩn). */
export function tongChon(chon) {
  return Object.values(chon ?? {}).reduce((s, v) => s + soCua(v), 0);
}

/** Lô đầu tiên có số chọn vượt số còn lấy được (lô không có trong danh sách coi như còn 0). */
function loVuotDau(chon, lots) {
  for (const [id, val] of Object.entries(chon ?? {})) {
    const sl = soCua(val);
    if (sl <= 0) continue;
    const lot = (lots ?? []).find((l) => String(l.loHangId) === String(id));
    const kd = docSo(lot?.soLuongKhaDung);
    if (sl > kd) return { loHangId: id, maLo: lot?.maLo ?? `#${id}`, soLuongKhaDung: kd };
  }
  return null;
}

/**
 * Kiểm tra trực tiếp cho dải tổng và nút Lưu lô.
 * @returns `{ tong, loVuot, chu, tone: "ok" | "warn" | "bad", hopLe }` — `hopLe`: lưu được (bán hàng phải đúng bằng số cần
 *   xuất; chuyển kho lưu được một phần, không vượt).
 */
export function trangThaiChonLo({ chon, lots, can, laBanHang = false } = {}) {
  const tong = tongChon(chon);
  const canXuat = docSo(can);
  const loVuot = loVuotDau(chon, lots);
  let chu;
  let tone;
  if (loVuot) {
    chu = `Lô ${loVuot.maLo} chỉ còn ${soVN(loVuot.soLuongKhaDung)} có thể lấy`;
    tone = "bad";
  } else if (tong > canXuat) {
    chu = `Vượt ${soVN(tong - canXuat)} so với số cần xuất`;
    tone = "bad";
  } else if (tong > 0 && tong === canXuat) {
    chu = "Khớp số cần xuất";
    tone = "ok";
  } else if (tong === 0) {
    chu = "Nhập số lượng lấy ở ít nhất một lô";
    tone = "warn";
  } else if (!laBanHang) {
    chu = `Còn thiếu ${soVN(canXuat - tong)} — phiếu chuyển kho lưu được một phần`;
    tone = "warn";
  } else {
    chu = `Còn thiếu ${soVN(canXuat - tong)} — sửa lô phải đủ ${soVN(canXuat)} (không đổi số lượng phiếu)`;
    tone = "warn";
  }
  const hopLe = !loVuot && tong > 0 && (laBanHang ? tong === canXuat : tong <= canXuat);
  return { tong, loVuot, chu, tone, hopLe };
}

/**
 * 4 kiểm tra khi lưu, đúng thứ tự và câu của bản cũ (spec-picking B.4), rồi dựng `loHangPicks` cho POST …/pick-lo
 * (chỉ lô > 0, thứ tự theo khóa như Object.entries của bản cũ).
 * @returns `{ loi: string | null, loHangPicks: { loHangId: number, soLuongXuat: number }[] }`
 */
export function kiemTraLuuLo({ chon, lots, can, laBanHang = false } = {}) {
  const entries = Object.entries(chon ?? {}).filter(([, v]) => Number(v) > 0);
  if (entries.length === 0) return { loi: "Vui lòng nhập số lượng cần lấy", loHangPicks: [] };
  for (const [id, val] of entries) {
    const lot = (lots ?? []).find((l) => l.loHangId === Number(id));
    if (Number(val) > docSo(lot?.soLuongKhaDung)) {
      return { loi: `Lô ${lot?.maLo ?? `#${id}`} không đủ tồn kho`, loHangPicks: [] };
    }
  }
  const tong = tongChon(chon);
  const canXuat = docSo(can);
  if (tong > canXuat) return { loi: "Tổng số lượng lấy vượt quá số lượng cần xuất", loHangPicks: [] };
  if (laBanHang && tong !== canXuat) {
    return { loi: `Sửa lô phải đủ ${canXuat} (không đổi số lượng phiếu)`, loHangPicks: [] };
  }
  return {
    loi: null,
    loHangPicks: entries.map(([loHangId, soLuongXuat]) => ({ loHangId: Number(loHangId), soLuongXuat: Number(soLuongXuat) })),
  };
}

/** Điền lại theo nhập trước lấy trước trên MỌI lô (theo thứ tự backend trả), bỏ qua lô hết hàng có thể lấy. */
export function datLaiTheoFifo(lots, can) {
  let conLai = Math.max(0, docSo(can));
  const moi = {};
  for (const l of Array.isArray(lots) ? lots : []) {
    if (conLai <= 0) break;
    const lay = Math.min(Math.floor(docSo(l.soLuongKhaDung)), conLai);
    if (lay > 0) {
      moi[l.loHangId] = String(lay);
      conLai -= lay;
    }
  }
  return moi;
}

/** Lô hết hàng có thể lấy mà dòng chưa lấy: xếp cuối (giữ thứ tự nhập trước lấy trước trong từng phần), hiện mờ. */
export function laLoHet(lot, daLuu) {
  return docSo(lot?.soLuongKhaDung) <= 0 && soCua(daLuu?.[lot?.loHangId]) <= 0;
}

export function sapXepLo(lots, daLuu) {
  const ds = Array.isArray(lots) ? lots : [];
  return [...ds.filter((l) => !laLoHet(l, daLuu)), ...ds.filter((l) => laLoHet(l, daLuu))];
}

/** Lô nhập trước lấy trước sẽ lấy đầu tiên: lô đầu còn hàng có thể lấy (không có thì lô đầu danh sách). */
export function loDauFifo(lots) {
  const ds = Array.isArray(lots) ? lots : [];
  return (ds.find((l) => docSo(l.soLuongKhaDung) > 0) ?? ds[0])?.loHangId ?? null;
}

/** Tình trạng của một lô khi đang sửa: `{ chu, tone: "mo" | "ok" | "warn" | "bad" }`. */
export function tinhTrangLo(soLuong, conLayDuoc) {
  const sl = soCua(soLuong);
  const kd = docSo(conLayDuoc);
  if (kd <= 0 && sl <= 0) return { chu: "Hết hàng có thể lấy", tone: "mo" };
  if (sl > kd) return { chu: "Vượt mức", tone: "bad" };
  if (sl > 0 && sl === kd) return { chu: "Lấy hết lô", tone: "ok" };
  if (sl > 0) return { chu: "Một phần", tone: "warn" };
  return { chu: "Không dùng", tone: "mo" };
}

/**
 * Lỗi "không tìm thấy" khi mở Chọn lô là mất DÒNG hay mất PHIẾU: câu máy chủ của picked-lots là "Không tìm thấy chi tiết",
 * của available-lots / chi tiết phiếu là "Không tìm thấy phiếu…". Không rõ thì coi là mất phiếu.
 */
export function loaiKhongThayChonLo(cauMayChu) {
  return /chi tiết|dòng/i.test(String(cauMayChu ?? "")) ? "dong" : "phieu";
}
