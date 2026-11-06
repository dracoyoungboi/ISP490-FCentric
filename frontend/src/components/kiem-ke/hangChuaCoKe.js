/**
 * Hàm thuần của màn Hàng chưa có kệ và hộp Xếp kệ: số xếp được, nhãn kệ gợi ý, nhóm theo chứng từ nhập, lọc, kiểm phần
 * chia kệ, tóm tắt kết quả. Dữ liệu một lô là phần tử của GET /api/v1/kiem-ke/hang-chua-co-ke (KiemKeDto.HangChuaCoKe).
 */
import { boDau } from "../chung-tu/bangChungTu.js";

/** Lý do của kệ gợi ý / kệ liên quan (ChonKeGoiY ở máy chủ). */
export const LY_DO_KE = {
  KE_CUA_LO: "Kệ của lô",
  DANG_CHUA_LO: "Lô đang ở kệ này",
  CUNG_SKU: "Kệ đang có cùng SKU",
  CUNG_MAU: "Kệ đang có cùng mẫu",
};

/** Vì sao một kệ liên quan không chọn được. */
export const CHAN_KE = {
  BAO_TRI: "đang bảo trì",
  KIEM_KE: "đang kiểm kê",
  DAY: "đã đầy",
  DA_GOI_Y: "đã gợi ý cho các lô phía trên",
};

/** Khóa nhóm của hàng không rõ chứng từ (luôn ở cuối). */
export const KHONG_RO_NGUON = "khong-ro";

const so = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const soVi = (n) => so(n).toLocaleString("vi-VN");

/** Số xếp lên kệ được lúc này: phần chưa có kệ trừ phần phiếu nhặt đang giữ (người nhặt lấy ở đó). */
export function soXepDuoc(h) {
  return Math.max(0, so(h?.chuaCoKe) - so(h?.dangGiuNhat));
}

/** Lô xếp được lúc này: không thuộc đợt kiểm kê đang chạy và còn phần không bị phiếu nhặt giữ. */
export function coTheXep(h) {
  return Boolean(h) && !h.dangKiemKe && soXepDuoc(h) > 0;
}

/** Kệ gợi ý đủ chỗ cho cả phần xếp được: xếp một chạm được. */
export function xepNgayDuoc(h) {
  const g = h?.keGoiY;
  if (!coTheXep(h) || !g?.id) return false;
  return g.conCho == null || so(g.conCho) >= soXepDuoc(h);
}

/** Câu thay cho kệ gợi ý khi lô chưa xếp được, hoặc không có kệ nào chọn được. */
export function cauKhongGoiY(h) {
  if (h?.dangKiemKe) return "Lô đang trong đợt kiểm kê, xếp sau khi đợt kết thúc";
  if (h && soXepDuoc(h) === 0) return "Phiếu nhặt đang giữ cả phần này, người nhặt sẽ lấy ở đây";
  const chan = (h?.keLienQuan ?? []).find((k) => k.chan);
  if (chan) return `Kệ ${chan.ma} ${CHAN_KE[chan.chan] ?? "không chọn được"}`;
  return "Chưa kệ nào trong kho có sản phẩm này";
}

/** Khóa nhóm của một lô: phiếu nhập gần nhất, không có thì nhóm "không rõ chứng từ". */
export const khoaNhom = (h) => (h?.nguon?.phieuNhapId != null ? String(h.nguon.phieuNhapId) : KHONG_RO_NGUON);

/**
 * Gom lô theo chứng từ nhập, giữ thứ tự xuất hiện (máy chủ trả chứng từ mới nhất trước); nhóm không rõ chứng từ ở cuối.
 * Trả `[{ khoa, nguon, ds }]`.
 */
export function nhomTheoNguon(ds) {
  const nhom = new Map();
  for (const h of ds ?? []) {
    const k = khoaNhom(h);
    if (!nhom.has(k)) nhom.set(k, { khoa: k, nguon: h.nguon ?? null, ds: [] });
    nhom.get(k).ds.push(h);
  }
  const kq = [...nhom.values()];
  const cuoi = kq.findIndex((n) => n.khoa === KHONG_RO_NGUON);
  if (cuoi >= 0) kq.push(...kq.splice(cuoi, 1));
  return kq;
}

/** Tên nhóm theo loại chứng từ. */
export function tieuDeNguon(nguon) {
  if (!nguon) return "Không rõ chứng từ";
  switch (nguon.loai) {
    case "CHUYEN_KHO":
      return nguon.tuDau ? `Nhận chuyển kho từ ${nguon.tuDau}` : "Nhận chuyển kho";
    case "HUY_CHUYEN_KHO":
      return "Về lại do hủy chuyển kho";
    case "KHACH_TRA":
      return "Khách trả hàng";
    case "NHA_CUNG_CAP":
      return nguon.tuDau ? `Nhập từ ${nguon.tuDau}` : "Nhập từ nhà cung cấp";
    default:
      return "Phiếu nhập kho";
  }
}

/**
 * Lọc danh sách: `tim` (mã lô, SKU, tên), `loc` ("tat-ca" | "ngay" | "chon"), `phieuChuyen` / `phieuNhap` (id chứng từ
 * từ liên kết "Xếp kệ" ở phiếu chuyển kho / phiếu nhập).
 */
export function locHangChuaCoKe(ds, { tim = "", loc = "tat-ca", phieuChuyen = null, phieuNhap = null } = {}) {
  const tu = boDau(String(tim).trim()).toLowerCase();
  return (ds ?? []).filter((h) => {
    if (loc === "ngay" && !xepNgayDuoc(h)) return false;
    if (loc === "chon" && xepNgayDuoc(h)) return false;
    if (phieuChuyen != null && h.nguon?.phieuChuyenId !== phieuChuyen) return false;
    if (phieuNhap != null && h.nguon?.phieuNhapId !== phieuNhap) return false;
    if (!tu) return true;
    const chu = `${h.maLo ?? ""} ${h.sanPham?.maSku ?? ""} ${h.sanPham?.tenSanPham ?? ""}`;
    return boDau(chu).toLowerCase().includes(tu);
  });
}

/** Số lô và tổng sản phẩm chưa có kệ. */
export function tongChuaCoKe(ds) {
  return { soLo: (ds ?? []).length, soLuong: (ds ?? []).reduce((s, h) => s + so(h.chuaCoKe), 0) };
}

/** Số kệ còn nhận được theo sơ đồ kệ; null = không giới hạn, hoặc kệ chưa có trong sơ đồ (đang tải) nên không chặn. */
export function conChoKe(ke) {
  if (!ke) return null;
  const suc = so(ke.sucChua);
  return suc > 0 ? Math.max(0, suc - so(ke.dangChua)) : null;
}

/**
 * Vì sao không chọn được kệ cho lô (null = chọn được): kệ bảo trì / khóa kiểm kê / đầy theo sơ đồ kệ, và khóa kiểm kê
 * theo cặp kệ–lô máy chủ đã tính ở `keLienQuan` của lô.
 */
export function lyDoKhongChonKe(ke, dsLo = []) {
  if (!ke) return "Không tìm thấy kệ";
  if (ke.trangThai === "KHOA_KIEM_KE" || ke.khoa === "toan_ke") return "Đang kiểm kê";
  if (ke.trangThai === "BAO_TRI") return "Bảo trì";
  for (const h of dsLo) {
    if ((h.keLienQuan ?? []).some((k) => k.id === ke.id && k.chan === "KIEM_KE")) return "Đang kiểm kê với lô này";
  }
  return conChoKe(ke) === 0 ? "Đầy" : null;
}

/**
 * Kiểm phần chia kệ của MỘT lô. `dong`: `[{ keId, soLuong }]`; `toiDa`: số xếp được của lô (soXepDuoc); `keTheoId`: Map
 * id → kệ của sơ đồ. Trả `{ tong, conLai, loiDong: (chuỗi | null)[], loi }` — `loi` là câu đầu tiên chặn nút Xếp.
 */
export function kiemChiaKe(dong, toiDa, keTheoId) {
  const daChon = new Set();
  const loiDong = (dong ?? []).map((d) => {
    if (d.keId == null) return "Chọn kệ";
    if (daChon.has(d.keId)) return "Kệ đã chọn ở dòng khác";
    daChon.add(d.keId);
    const sl = so(d.soLuong);
    if (!Number.isInteger(sl) || sl <= 0) return "Nhập số lượng";
    const con = conChoKe(keTheoId?.get(d.keId));
    if (con != null && sl > con) return `Kệ chỉ còn chỗ ${soVi(con)}`;
    return null;
  });
  const tong = (dong ?? []).reduce((s, d) => s + Math.max(0, so(d.soLuong)), 0);
  const conLai = so(toiDa) - tong;
  const loi = loiDong.find(Boolean) ?? (conLai < 0 ? `Tối đa ${soVi(toiDa)} sản phẩm` : null);
  return { tong, conLai, loiDong, loi };
}

/**
 * Dòng chia kệ mở sẵn khi mở hộp cho một lô, tính trên phần xếp được: kệ gợi ý (nếu có) với số vừa chỗ; kệ gợi ý không
 * đủ chỗ thì thêm một dòng trống cho phần còn lại.
 */
export function dongMoSan(h) {
  const can = soXepDuoc(h);
  const g = h?.keGoiY;
  if (!g?.id) return [{ keId: null, soLuong: can }];
  if (g.conCho == null || so(g.conCho) >= can) return [{ keId: g.id, soLuong: can }];
  const vua = Math.max(0, so(g.conCho));
  return [
    { keId: g.id, soLuong: vua },
    { keId: null, soLuong: can - vua },
  ];
}

/**
 * Tóm tắt kết quả POST /xep-ke-nhieu: `daXep` / `loi` là các phần, `soSanPham` tổng đã xếp, `soLoDaXep` số lô có ít nhất
 * một phần đã xếp (một lô chia nhiều kệ là nhiều phần).
 */
export function tomTatKetQua(kq) {
  const ds = Array.isArray(kq) ? kq : [];
  const daXep = ds.filter((p) => p.daXep);
  return {
    daXep,
    loi: ds.filter((p) => !p.daXep),
    soSanPham: daXep.reduce((s, p) => s + so(p.soLuong), 0),
    soLoDaXep: new Set(daXep.map((p) => p.loHangId)).size,
  };
}

/** Gom các phần theo lô cho câu thông báo: `[{ loHangId, ke: [viTriKhoId…], loi: [câu…] }]` theo thứ tự xuất hiện. */
export function gomTheoLo(phan) {
  const theoLo = new Map();
  for (const p of phan ?? []) {
    if (!theoLo.has(p.loHangId)) theoLo.set(p.loHangId, { loHangId: p.loHangId, ke: [], loi: [] });
    const lo = theoLo.get(p.loHangId);
    if (p.viTriKhoId != null && !lo.ke.includes(p.viTriKhoId)) lo.ke.push(p.viTriKhoId);
    if (p.loi && !lo.loi.includes(p.loi)) lo.loi.push(p.loi);
  }
  return [...theoLo.values()];
}
