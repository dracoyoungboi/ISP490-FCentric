/**
 * Logic thuần của màn Chi tiết nhà cung cấp · bản "một khối" (chốt 17/10/2026).
 * Không import alias "@/..." để chạy được bằng `node --test`.
 *
 * Đầu vào lấy từ API có sẵn:
 * - `dons`: DonMuaHangDto của nhà cung cấp (trạng thái 1–5), có `chiTietDonMuaHangs`.
 * - `phieus`: PhieuNhapKhoDto (chưa hủy) của nhà cung cấp, hoặc `null` khi vai trò không xem được phiếu nhập.
 */
import { docSo, tinhTienDoNhan, trangThaiGiao } from "../../order/chi-tiet-don-mua/tinhNhanHang.js";

/** Trạng thái đơn mua (DON_MUA_HANG_STATUS) theo luồng đang chạy. */
export const TRANG_THAI_DON = {
  DA_GUI: 1, // đã gửi yêu cầu báo giá, chờ nhà cung cấp
  DA_BAO_GIA: 2, // nhà cung cấp đã báo giá, chờ duyệt
  DANG_VAN_CHUYEN: 3, // đã chốt
  KHONG_CHAP_NHAN: 4,
  DA_THANH_TOAN: 5, // dữ liệu cũ, vẫn tính là đã chốt
};
export const TRANG_THAI_DA_CHOT = [TRANG_THAI_DON.DANG_VAN_CHUYEN, TRANG_THAI_DON.DA_THANH_TOAN];
export const TRANG_THAI_BAO_GIA = [TRANG_THAI_DON.DA_GUI, TRANG_THAI_DON.DA_BAO_GIA, TRANG_THAI_DON.KHONG_CHAP_NHAN];

const PHIEU_DA_NHAP = 3;
/** Số đơn gần nhất vẽ trên vạch "Giao đúng hạn". */
export const SO_DON_TREN_VACH = 6;

const MS_MOT_NGAY = 24 * 60 * 60 * 1000;

function docNgay(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dauNgay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function moc(value) {
  return docNgay(value)?.getTime() ?? 0;
}

/** Ngày đặt của đơn: lúc gửi yêu cầu báo giá; đơn cũ thiếu thì lấy ngày tạo. */
export function ngayDat(don) {
  return don?.ngayDatHang || don?.ngayTao || null;
}

/** Tách đơn đã chốt (3, 5) và báo giá chưa thành đơn (1, 2, 4); mới nhất lên trước. */
export function phanLoaiDon(dons) {
  const ds = Array.isArray(dons) ? dons : [];
  const theoNgayMoi = (a, b) => moc(ngayDat(b)) - moc(ngayDat(a)) || (b.id ?? 0) - (a.id ?? 0);
  return {
    chot: ds.filter((d) => TRANG_THAI_DA_CHOT.includes(Number(d?.trangThai))).sort(theoNgayMoi),
    baoGia: ds.filter((d) => TRANG_THAI_BAO_GIA.includes(Number(d?.trangThai))).sort(theoNgayMoi),
  };
}

/** Ngày nhập kho của phiếu đã nhập cuối cùng, theo từng đơn mua. `null` khi không có danh sách phiếu. */
export function ngayNhapCuoiTheoDon(phieus) {
  if (!Array.isArray(phieus)) return null;
  const theoDon = new Map();
  for (const p of phieus) {
    if (Number(p?.trangThai) !== PHIEU_DA_NHAP || p?.donMuaHangId == null) continue;
    const ngay = docNgay(p.ngayNhap);
    if (!ngay) continue;
    const cu = theoDon.get(p.donMuaHangId);
    if (!cu || ngay > cu) theoDon.set(p.donMuaHangId, ngay);
  }
  return theoDon;
}

/**
 * Tình trạng giao hàng của một đơn đã chốt:
 * - chưa nhận đủ: `conLai` / `homNay` / `quaHan` (theo ngày giao dự kiến) hoặc `khongCo` (đơn không có ngày);
 * - đã nhận đủ: `dungHan` / `tre` (so ngày nhập của phiếu cuối với ngày dự kiến),
 *   hoặc `daDu` khi không biết ngày nhập (vai trò không xem phiếu nhập) hay đơn không có ngày dự kiến.
 */
export function tinhGiaoHang(don, ngayNhapCuoi, homNay = new Date()) {
  const tienDo = tinhTienDoNhan(don?.chiTietDonMuaHangs);
  if (!tienDo.daDu) {
    const giao = trangThaiGiao(don?.ngayGiaoDuKien, false, homNay);
    return { ...giao, tienDo };
  }
  const han = docNgay(don?.ngayGiaoDuKien);
  const nhap = ngayNhapCuoi instanceof Map ? ngayNhapCuoi.get(don?.id) : null;
  if (!han || !nhap) return { loai: "daDu", soNgay: 0, tienDo };
  const tre = Math.round((dauNgay(nhap) - dauNgay(han)) / MS_MOT_NGAY);
  return tre > 0 ? { loai: "tre", soNgay: tre, tienDo } : { loai: "dungHan", soNgay: 0, tienDo };
}

/** Bảng tình trạng giao cho mọi đơn đã chốt: Map id đơn → kết quả `tinhGiaoHang`. */
export function giaoHangTheoDon(chot, phieus, homNay = new Date()) {
  const ngayNhap = ngayNhapCuoiTheoDon(phieus);
  const map = new Map();
  for (const don of chot) map.set(don.id, tinhGiaoHang(don, ngayNhap, homNay));
  return map;
}

/**
 * 4 ô "Tình hình hợp tác".
 * - Giao đúng hạn: đơn đã nhận đủ và biết ngày nhập; `null` khi chưa có đơn nào như vậy.
 *   `coNgayNhap = false` khi vai trò không xem được phiếu nhập (không tính được).
 * - Tỉ lệ chốt báo giá: số đã chốt / (đã chốt + không chấp nhận); báo giá đang chờ không tính.
 */
export function tinhChiSo(chot, baoGia, giaoTheoDon, { coNgayNhap = true } = {}) {
  const giaTri = chot.reduce((tong, d) => tong + docSo(d?.tongTien), 0);

  let dungHan = 0;
  let daXet = 0;
  for (const don of chot) {
    const g = giaoTheoDon.get(don.id);
    if (g?.loai === "dungHan") {
      dungHan += 1;
      daXet += 1;
    } else if (g?.loai === "tre") {
      daXet += 1;
    }
  }

  const tuChoi = baoGia.filter((d) => Number(d?.trangThai) === TRANG_THAI_DON.KHONG_CHAP_NHAN).length;
  const daXetBaoGia = chot.length + tuChoi;

  const ganNhat = chot[0] ?? null;
  const vach = coNgayNhap
    ? chot
      .slice(0, SO_DON_TREN_VACH)
      .reverse()
      .map((don) => ({ id: don.id, soDonMua: don.soDonMua, loai: giaoTheoDon.get(don.id)?.loai ?? "khongCo" }))
    : [];

  return {
    giaTri: { tong: giaTri, soDon: chot.length },
    giaoDungHan: {
      tinhDuoc: coNgayNhap,
      dungHan,
      daXet,
      phanTram: coNgayNhap && daXet > 0 ? Math.round((dungHan / daXet) * 100) : null,
      vach,
    },
    tiLeChot: {
      daChot: chot.length,
      daXet: daXetBaoGia,
      phanTram: daXetBaoGia > 0 ? Math.round((chot.length / daXetBaoGia) * 100) : null,
    },
    lanDatGanNhat: ganNhat ? { ngay: ngayDat(ganNhat), don: ganNhat } : null,
  };
}

const THU_TU_GIAO = { quaHan: 0, homNay: 1, conLai: 2, khongCo: 3 };

/**
 * Việc đang mở với nhà cung cấp, việc gấp lên trước:
 * 1. đơn đã chốt chưa nhận đủ: quá hạn (lâu nhất trước) → hôm nay → còn N ngày (gần nhất trước) → không có ngày;
 * 2. báo giá nhà cung cấp đã gửi, đang chờ duyệt (trạng thái 2), mới nhất trước.
 */
export function timViecDangMo(chot, baoGia, giaoTheoDon) {
  const don = chot
    .map((d) => ({ loai: "don", don: d, giao: giaoTheoDon.get(d.id) }))
    .filter((v) => v.giao && !v.giao.tienDo.daDu)
    .sort((a, b) => {
      const ta = THU_TU_GIAO[a.giao.loai] ?? 9;
      const tb = THU_TU_GIAO[b.giao.loai] ?? 9;
      if (ta !== tb) return ta - tb;
      if (a.giao.loai === "quaHan") return b.giao.soNgay - a.giao.soNgay;
      if (a.giao.loai === "conLai") return a.giao.soNgay - b.giao.soNgay;
      return moc(ngayDat(a.don)) - moc(ngayDat(b.don));
    });
  const choDuyet = baoGia
    .filter((d) => Number(d?.trangThai) === TRANG_THAI_DON.DA_BAO_GIA)
    .map((d) => ({ loai: "baoGia", don: d }));
  return [...don, ...choDuyet];
}

/** Số việc đang dở, dùng cho câu hệ quả trong hộp Ngừng hoạt động. */
export function demViecDangDo(viec) {
  return {
    donChoGiao: viec.filter((v) => v.loai === "don").length,
    baoGiaChoDuyet: viec.filter((v) => v.loai === "baoGia").length,
  };
}

function moTaBienThe(bt) {
  // Cùng cách ghép như bảng sản phẩm ở Chi tiết đơn mua hàng
  return [bt?.mauSac?.tenMau, bt?.size?.tenSize || bt?.size?.maSize].filter(Boolean).join(" · ");
}

/**
 * "Sản phẩm & giá": mỗi biến thể đã mua từ nhà cung cấp (chỉ đơn đã chốt), mua gần nhất lên trước.
 * So với lần trước: giá ở đơn gần nhất so với đơn trước đó có biến thể này.
 */
export function tinhLichSuGia(chot) {
  const theoBienThe = new Map();
  for (const don of chot) {
    const ngay = ngayDat(don);
    for (const ct of don?.chiTietDonMuaHangs ?? []) {
      const bt = ct?.bienTheSanPham;
      if (!bt?.id) continue;
      let dong = theoBienThe.get(bt.id);
      if (!dong) {
        dong = { bienTheId: bt.id, bienThe: bt, lanMua: [], daDat: 0 };
        theoBienThe.set(bt.id, dong);
      }
      dong.daDat += Math.max(0, docSo(ct.soLuongDat));
      if (!dong.lanMua.some((l) => l.donId === don.id)) {
        dong.lanMua.push({ donId: don.id, ngay, gia: docSo(ct.donGia) });
      }
    }
  }

  const ketQua = [];
  for (const dong of theoBienThe.values()) {
    const lan = [...dong.lanMua].sort((a, b) => moc(b.ngay) - moc(a.ngay) || b.donId - a.donId);
    const gias = lan.map((l) => l.gia);
    const ganNhat = lan[0];
    const truoc = lan[1] ?? null;
    let soVoiTruoc = { loai: "lanDau", phanTram: null };
    if (truoc) {
      if (truoc.gia > 0 && ganNhat.gia !== truoc.gia) {
        const pt = Math.round(((ganNhat.gia - truoc.gia) / truoc.gia) * 1000) / 10;
        soVoiTruoc = { loai: ganNhat.gia > truoc.gia ? "tang" : "giam", phanTram: Math.abs(pt) };
      } else if (ganNhat.gia === truoc.gia) {
        soVoiTruoc = { loai: "khongDoi", phanTram: 0 };
      }
    }
    const bt = dong.bienThe;
    ketQua.push({
      bienTheId: dong.bienTheId,
      ten: bt.tenSanPham || bt.tenBienThe || `Biến thể #${dong.bienTheId}`,
      moTa: moTaBienThe(bt),
      sku: bt.maSku || "",
      giaGanNhat: ganNhat.gia,
      giaThap: Math.min(...gias),
      giaCao: Math.max(...gias),
      soVoiTruoc,
      soLanMua: lan.length,
      daDat: dong.daDat,
      lanMuaGanNhat: ganNhat.ngay,
    });
  }
  return ketQua.sort((a, b) => moc(b.lanMuaGanNhat) - moc(a.lanMuaGanNhat) || a.ten.localeCompare(b.ten, "vi"));
}

/**
 * Dòng thời gian "Hoạt động": chỉ các sự kiện có ngày giờ chắc chắn trên chứng từ
 * (backend chưa lưu riêng lúc nhà cung cấp báo giá và lúc chốt / từ chối).
 * - Gửi yêu cầu báo giá: `ngayDatHang` (thiếu thì `ngayTao`) của mỗi đơn.
 * - Nhập kho: `ngayNhap` của phiếu đã nhập (khi xem được phiếu nhập).
 * - Tạo nhà cung cấp: `ngayTao` của nhà cung cấp.
 */
export function dungHoatDong({ ncc, dons, phieus }) {
  const suKien = [];
  for (const don of Array.isArray(dons) ? dons : []) {
    const ngay = ngayDat(don);
    if (!docNgay(ngay)) continue;
    const soSanPham = (don.chiTietDonMuaHangs ?? []).length;
    suKien.push({
      khoa: `don-${don.id}`,
      loai: "guiYeuCau",
      ngay,
      ma: don.soDonMua || `#${don.id}`,
      donId: don.id,
      trangThai: Number(don.trangThai),
      soSanPham,
      nguoi: don.nguoiTao?.hoTen || null,
    });
  }
  for (const p of Array.isArray(phieus) ? phieus : []) {
    if (Number(p?.trangThai) !== PHIEU_DA_NHAP || !docNgay(p.ngayNhap)) continue;
    suKien.push({
      khoa: `phieu-${p.id}`,
      loai: "nhapKho",
      ngay: p.ngayNhap,
      ma: p.soPhieuNhap || `#${p.id}`,
      phieuId: p.id,
      soDonMua: p.soDonMua || null,
      donId: p.donMuaHangId ?? null,
      tenKho: p.tenKho || null,
    });
  }
  if (docNgay(ncc?.ngayTao)) {
    suKien.push({ khoa: "tao-ncc", loai: "taoNcc", ngay: ncc.ngayTao, ma: ncc.maNhaCungCap || "" });
  }
  return suKien.sort((a, b) => moc(b.ngay) - moc(a.ngay));
}
