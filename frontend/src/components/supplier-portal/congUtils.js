/**
 * Hàm thuần cho các trang sau đăng nhập của cổng nhà cung cấp: Cần xử lý, Biên bản trả hàng, Lịch sử.
 * Nhãn trạng thái khai báo ở constants/congNhaCungCap.js bằng tên tiếng Việt (StatusBadge tự dịch và tra màu).
 * Chạy được bằng `node --test`.
 */
import { t } from "../../i18n/t.js";
import { chuanHoaHoTen, loiHoTen } from "../../validations/hoTen.js";
import { NHAN_HANG_LOI, NHAN_TRANG_THAI_BIEN_BAN } from "../../constants/congNhaCungCap.js";

/**
 * Hai cách bù nhà cung cấp chọn cho từng dòng (giá trị gửi máy chủ ở `phuongAn`). Đầu biên bản còn CHO_CHOT (còn dòng
 * chưa chọn) và HON_HOP (dòng giao bù, dòng trừ tiền).
 */
export const PHUONG_AN = Object.freeze({
  TRU_TIEN: "TRU_CONG_NO",
  GIAO_BU: "DOI_HANG",
  CHO_CHOT: "CHO_CHOT",
  HON_HOP: "HON_HOP",
});

/** Nhà cung cấp chọn cho hàng lỗi còn ở kho (giá trị gửi máy chủ ở `hangLoi`). */
export const HANG_LOI = Object.freeze({ NHAN_LAI: "NHAN_LAI", TIEU_HUY: "TIEU_HUY" });

export const GHI_CHU_BIEN_BAN_TOI_DA = 255;
/** Bộ đếm ký tự ghi chú chỉ hiện khi gần chạm giới hạn. */
export const GHI_CHU_BIEN_BAN_HIEN_DEM = 200;

const pad2 = (n) => String(n).padStart(2, "0");
/** yyyy-MM-dd theo giờ Việt Nam. */
export function ngayVietNam(d) {
  const vn = new Date(d.getTime() + 7 * 3600e3);
  return `${vn.getUTCFullYear()}-${pad2(vn.getUTCMonth() + 1)}-${pad2(vn.getUTCDate())}`;
}

/** Số việc trên tab "Cần xử lý": biên bản chờ chọn + đơn chờ báo giá. */
export function demViec(viec) {
  return (viec?.bienBanCho?.length ?? 0) + (viec?.donChoBaoGia?.length ?? 0);
}

/** Số ngày lịch (giờ Việt Nam) từ hôm nay tới mốc: âm = đã qua, 0 = hôm nay; không có mốc thì null. */
export function soNgayToiMoc(moc, bayGio = new Date()) {
  if (!moc) return null;
  const d = new Date(moc);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((Date.parse(ngayVietNam(d)) - Date.parse(ngayVietNam(bayGio))) / 86400e3);
}

/** Thứ tự mức gấp trên trang Cần xử lý: đỏ (quá hạn / hôm nay), cam (sắp đến hạn), xám (còn thời gian). */
const THU_TU_MUC_GAP = { do: 0, cam: 1, xam: 2 };

/**
 * Gom biên bản chờ trả lời và đơn chờ báo giá của /viec-can-lam thành một danh sách, gấp nhất trước.
 * Biên bản theo hạn trả lời (quá giờ hạn là quá hạn, kể cả trong ngày hạn; còn ≤ 2 ngày là cam); đơn theo ngày cần giao
 * (đã qua / hôm nay là đỏ, còn ≤ 3 ngày là cam). Cùng mức thì biên bản trước (quá hạn chưa chọn cách bù là bị trừ tiền),
 * rồi mốc sớm trước. Không có mốc thì xám và xếp cuối nhóm.
 * Mỗi phần tử: `{ loai: "bien-ban" | "bao-gia", id, so, soNgay, quaHan, mucGap, duLieu }`.
 */
export function xepViecCanLam(viec, bayGio = new Date()) {
  const bienBan = (viec?.bienBanCho ?? []).map((bb) => {
    const soNgay = soNgayToiMoc(bb.hanTraLoi, bayGio);
    const quaHan = bb.hanTraLoi ? new Date(bb.hanTraLoi).getTime() < bayGio.getTime() : false;
    const mucGap = soNgay == null ? "xam" : quaHan || soNgay <= 0 ? "do" : soNgay <= 2 ? "cam" : "xam";
    return { loai: "bien-ban", id: bb.id, so: bb.soBienBan, soNgay, quaHan, mucGap, duLieu: bb };
  });
  const baoGia = (viec?.donChoBaoGia ?? []).map((d) => {
    const soNgay = soNgayToiMoc(d.ngayCanGiao, bayGio);
    const mucGap = soNgay == null ? "xam" : soNgay <= 0 ? "do" : soNgay <= 3 ? "cam" : "xam";
    return { loai: "bao-gia", id: d.id, so: d.soDonMua, soNgay, quaHan: soNgay != null && soNgay < 0, mucGap, duLieu: d };
  });
  const moc = (v) => (v.soNgay == null ? Number.POSITIVE_INFINITY : v.soNgay);
  return [...bienBan, ...baoGia].sort(
    (a, b) =>
      THU_TU_MUC_GAP[a.mucGap] - THU_TU_MUC_GAP[b.mucGap] ||
      (a.loai === b.loai ? 0 : a.loai === "bien-ban" ? -1 : 1) ||
      moc(a) - moc(b),
  );
}

/** "67%" — tỉ lệ được chấp nhận; chưa gửi báo giá nào thì null. */
export function tiLePhanTram(tu, mau) {
  const a = Number(tu);
  const b = Number(mau);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return `${Math.round((a / b) * 100)}%`;
}

/**
 * Cách xử lý của một dòng lịch sử trả hàng:
 * - `{ loai: "cho" }`: còn chờ nhà cung cấp chọn (biên bản chưa hủy);
 * - `{ loai: "tru", tien }`;
 * - `{ loai: "bu", xong, conLai }`;
 * - `{ loai: "huy" }`: biên bản đã hủy.
 */
export function cachXuLyLichSu(dong) {
  if (dong?.daHuy) return { loai: "huy" };
  // tienTru: đã trừ, hoặc dự kiến khi phiếu chưa nhập kho; 0 / thiếu thì không hiện số (tránh "−0 ₫")
  if (dong?.phuongAn === PHUONG_AN.TRU_TIEN) return { loai: "tru", tien: soDuongHoacNull(dong.tienTru) };
  if (dong?.phuongAn === PHUONG_AN.GIAO_BU) {
    return { loai: "bu", xong: Boolean(dong.buXong), conLai: Math.max(0, Number(dong.conChoGiao) || 0) };
  }
  // Mỗi sản phẩm một cách: phần trừ tiền và phần giao bù còn chờ
  if (dong?.phuongAn === PHUONG_AN.HON_HOP) {
    return {
      loai: "hon",
      tien: soDuongHoacNull(dong.tienTru),
      xong: Boolean(dong.buXong),
      conLai: Math.max(0, Number(dong.conChoGiao) || 0),
    };
  }
  return { loai: "cho" };
}

/** Số > 0, còn lại null. */
function soDuongHoacNull(giaTri) {
  const so = Number(giaTri);
  return Number.isFinite(so) && so > 0 ? so : null;
}

/** Nhà cung cấp còn việc phải trả lời (máy chủ tính: chưa chọn cách bù, hoặc hàng lỗi ở kho chưa chọn). */
export const choTraLoi = (bb) => bb?.trangThai === "CHO_XAC_NHAN";

/** Còn chọn / đổi được gì trên cổng (máy chủ trả các lựa chọn còn mở `cachBuMo`, `hangLoiMo`). */
export const coTheChon = (bb) =>
  Boolean(bb) && bb.trangThai !== "DA_HUY" && ((bb.cachBuMo?.length ?? 0) > 0 || (bb.hangLoiMo?.length ?? 0) > 0);

/** Nhãn đầu trang biên bản. Còn chờ trả lời mà không còn gì chọn được (đơn đã kết thúc) thì "Hết hạn". */
export function nhanTrangThaiBienBan(bb) {
  if (!bb) return null;
  if (choTraLoi(bb) && !coTheChon(bb)) return NHAN_TRANG_THAI_BIEN_BAN.HET_HAN_TRA_LOI;
  return NHAN_TRANG_THAI_BIEN_BAN[bb.trangThai] ?? NHAN_TRANG_THAI_BIEN_BAN.DA_XAC_NHAN;
}

/** Nhãn cột Hàng lỗi ở lịch sử: đã rời kho thì theo trạng thái; còn ở kho thì theo lựa chọn của nhà cung cấp. */
export function nhanHangLoi(dong) {
  if (["DA_TRA", "DA_TIEU_HUY", "DA_XU_LY"].includes(dong?.hangLoi)) return NHAN_HANG_LOI[dong.hangLoi];
  if (dong?.hangLoi !== "O_KHO" || dong?.daHuy) return null;
  return NHAN_HANG_LOI[dong.hangLoiNcc] ?? NHAN_HANG_LOI.CHO_CHON;
}

/** Số tiền trừ đã chốt (hoặc dự kiến khi chưa nhập kho) để hiện sau khi xác nhận; 0 / thiếu thì null (không hiện). */
export function tienTruDaChot(bb) {
  return soDuongHoacNull(bb?.tienTru);
}

/** Ô Người xác nhận: bắt buộc, theo luật họ tên (validations/hoTen.js). Trả câu lỗi hoặc "". */
export function loiNguoiXacNhan(giaTri) {
  if (!chuanHoaHoTen(giaTri)) return t("Nhập tên người xác nhận");
  return loiHoTen(giaTri);
}

/** Thuộc tính một dòng hàng lỗi: "Đen · S · AK-...". */
export function thuocTinhDong(d) {
  return [d?.mauSac, d?.kichCo].map((x) => String(x ?? "").trim()).filter(Boolean).join(" · ");
}

// ─────────────────────────────────────────────────────────────
// Trả lời biên bản theo từng dòng sản phẩm lỗi (`bb.dong`)
// ─────────────────────────────────────────────────────────────

const dsDong = (bb) => (Array.isArray(bb?.dong) ? bb.dong : []);
/** Dòng chọn được trên cổng: phải có id để gửi máy chủ (dòng thiếu id chỉ hiện, không chọn, không tính là thiếu). */
const dsDongChon = (bb) => dsDong(bb).filter((d) => d?.id != null);

/** Cách bù / hàng lỗi dòng còn chọn hoặc đổi được (máy chủ tính; rỗng: đã chốt). */
export const moCachBu = (d) => (Array.isArray(d?.cachBuMo) ? d.cachBuMo : []);
export const moHangLoi = (d) => (Array.isArray(d?.hangLoiMo) ? d.hangLoiMo : []);

/** Dòng còn câu nào chọn / đổi được. */
export const dongConMo = (d) => moCachBu(d).length > 0 || moHangLoi(d).length > 0;

/** Hàng lỗi của dòng còn ở kho (chưa giao trả / tiêu hủy / trả ngay cho người giao hàng). */
export const dongOKho = (d) => (d?.viTriHang ?? "O_KHO") === "O_KHO";

/** Lựa chọn đang áp dụng của dòng theo máy chủ: { cachBu, hangLoi } (null: chưa chọn). */
export function luaChonHienTai(d) {
  return {
    cachBu: d?.cachBu && d.cachBu !== PHUONG_AN.CHO_CHOT ? d.cachBu : null,
    hangLoi: d?.hangLoi ?? null,
  };
}

/**
 * Lựa chọn có hiệu lực của dòng: câu đang chọn khi còn đổi được (hoặc trùng lựa chọn đang áp dụng), không thì lựa chọn
 * đang áp dụng. Dùng cho tóm tắt và hộp xác nhận để không cộng một lựa chọn máy chủ sẽ không nhận.
 */
export function luaChonHieuLuc(d, chon) {
  const cu = luaChonHienTai(d);
  if (!chon) return cu;
  const nhan = (moi, cuGiaTri, mo) => (moi && (moi === cuGiaTri || mo.includes(moi)) ? moi : cuGiaTri);
  return { cachBu: nhan(chon.cachBu, cu.cachBu, moCachBu(d)), hangLoi: nhan(chon.hangLoi, cu.hangLoi, moHangLoi(d)) };
}

/**
 * Phần trừ tiền của dòng theo cách bù `cachBu`: { soLuong, tien }. Dòng máy chủ đã ghi trừ tiền thì theo số máy chủ
 * (`soLuongTru`, `tienTru`: quá hạn / đóng đơn khi đơn chỉ còn chờ một phần thì trừ một phần); dòng vừa chọn trừ tiền
 * thì cả dòng theo giá trị dòng.
 */
export function truTienDong(d, cachBu = luaChonHienTai(d).cachBu) {
  if (cachBu !== PHUONG_AN.TRU_TIEN) return { soLuong: 0, tien: 0 };
  const sl = Number(d?.soLuong) || 0;
  const donGia = Number(d?.donGia) || 0;
  if (luaChonHienTai(d).cachBu === PHUONG_AN.TRU_TIEN && d?.soLuongTru != null && Number.isFinite(Number(d.soLuongTru))) {
    const n = Math.min(sl, Math.max(0, Number(d.soLuongTru)));
    const tien = d.tienTru != null && Number.isFinite(Number(d.tienTru)) ? Number(d.tienTru) : n * donGia;
    return { soLuong: n, tien };
  }
  return { soLuong: sl, tien: Number(d?.giaTri) || sl * donGia };
}

/** Lựa chọn ban đầu của khung trả lời: id dòng → lựa chọn đang áp dụng. */
export function khoiTaoLuaChon(bb) {
  const kq = {};
  for (const d of dsDongChon(bb)) kq[d.id] = luaChonHienTai(d);
  return kq;
}

/**
 * Chữ ký dữ liệu chọn của biên bản (lựa chọn, vị trí hàng lỗi, lựa chọn còn mở của từng dòng, lần lập): đổi thì khung
 * trả lời dựng lại từ dữ liệu mới, không giữ lựa chọn cũ của bản đã tải trước.
 */
export function chuKyLuaChon(bb) {
  const dong = dsDong(bb)
    .map((d) => [d.id, d.cachBu, d.hangLoi, d.viTriHang, d.soLuong, moCachBu(d).join("+"), moHangLoi(d).join("+")].join(":"))
    .join("|");
  return String(bb?.phienBan ?? "") + "#" + dong;
}

/** Câu bắt buộc của dòng: cách bù đang chờ (còn chọn được), hàng lỗi còn ở kho mà chưa chọn. Dòng thiếu id: không. */
export function canChon(d) {
  if (d?.id == null) return { cachBu: false, hangLoi: false };
  return {
    cachBu: !luaChonHienTai(d).cachBu && moCachBu(d).length > 0,
    hangLoi: !d?.hangLoi && moHangLoi(d).length > 0,
  };
}

/** Số câu bắt buộc của dòng còn thiếu trong lựa chọn đang chọn. */
export function soCauThieu(d, chon) {
  const can = canChon(d);
  return (can.cachBu && !chon?.cachBu ? 1 : 0) + (can.hangLoi && !chon?.hangLoi ? 1 : 0);
}

/** Dòng có câu chọn khác lựa chọn đang áp dụng (chỉ tính câu còn đổi được). */
export function dongCoDoi(d, chon) {
  const cu = luaChonHienTai(d);
  const doiCachBu = Boolean(chon?.cachBu) && chon.cachBu !== cu.cachBu && moCachBu(d).includes(chon.cachBu);
  const doiHangLoi = Boolean(chon?.hangLoi) && chon.hangLoi !== cu.hangLoi && moHangLoi(d).includes(chon.hangLoi);
  return doiCachBu || doiHangLoi;
}

/**
 * Nhãn thẻ của dòng: "chon-lai" (lúc nhập kho không trừ tiền được, phải chọn lại cách bù) | "chua-chon" | "thieu-mot"
 * (còn một trong hai câu) | "da-chon" | "da-chot" (không còn gì đổi được).
 */
export function trangThaiTheDong(d, chon) {
  const can = canChon(d);
  const thieu = soCauThieu(d, chon);
  if (can.cachBu && !chon?.cachBu && d?.nguonCachBu === "NHAP_KHO") return "chon-lai";
  if (thieu > 0) return thieu === (can.cachBu ? 1 : 0) + (can.hangLoi ? 1 : 0) ? "chua-chon" : "thieu-mot";
  return dongConMo(d) ? "da-chon" : "da-chot";
}

/** Id các dòng còn thiếu lựa chọn bắt buộc, theo thứ tự dòng. */
export function dongConThieu(bb, chonTheoDong) {
  return dsDongChon(bb).filter((d) => soCauThieu(d, chonTheoDong?.[d.id]) > 0).map((d) => d.id);
}

/** Số sản phẩm của các dòng còn thiếu lựa chọn bắt buộc (bộ đếm "Còn … sản phẩm chưa chọn đủ"). */
export function soSanPhamConThieu(bb, chonTheoDong) {
  return dsDongChon(bb)
    .filter((d) => soCauThieu(d, chonTheoDong?.[d.id]) > 0)
    .reduce((s, d) => s + (Number(d.soLuong) || 0), 0);
}

/** Có dòng nào đổi so với lựa chọn đang áp dụng. */
export function coDongDoi(bb, chonTheoDong) {
  return dsDongChon(bb).some((d) => dongCoDoi(d, chonTheoDong?.[d.id]));
}

/**
 * Tóm tắt phương án xử lý (đơn vị: sản phẩm) theo lựa chọn có hiệu lực của từng dòng: trừ tiền (số lượng, tiền), giao
 * bù, coi như đã giao bù (phần còn lại của dòng chỉ trừ tiền một phần), nhận lại, tiêu hủy, đã rời kho, và số sản phẩm
 * của các dòng còn thiếu lựa chọn bắt buộc (`chuaChon`). Nhận lại / tiêu hủy chỉ tính hàng lỗi còn ở kho.
 */
export function tomTatLuaChon(bb, chonTheoDong) {
  const kq = { truTien: { soLuong: 0, tien: 0 }, giaoBu: 0, coiNhuDaBu: 0, nhanLai: 0, tieuHuy: 0, daRoiKho: 0, chuaChon: 0 };
  for (const d of dsDong(bb)) {
    const sl = Number(d.soLuong) || 0;
    const chon = chonTheoDong?.[d.id];
    const c = luaChonHieuLuc(d, chon);
    if (c.cachBu === PHUONG_AN.TRU_TIEN) {
      const tru = truTienDong(d, c.cachBu);
      kq.truTien.soLuong += tru.soLuong;
      kq.truTien.tien += tru.tien;
      kq.coiNhuDaBu += sl - tru.soLuong;
    } else if (c.cachBu === PHUONG_AN.GIAO_BU) {
      kq.giaoBu += sl;
    }
    if (!dongOKho(d)) kq.daRoiKho += sl;
    else if (c.hangLoi === HANG_LOI.NHAN_LAI) kq.nhanLai += sl;
    else if (c.hangLoi === HANG_LOI.TIEU_HUY) kq.tieuHuy += sl;
    if (soCauThieu(d, chon ?? luaChonHienTai(d)) > 0) kq.chuaChon += sl;
  }
  return kq;
}

/** Số dòng còn chọn / đổi được câu `loai` ("cachBu" | "hangLoi"). */
export function soDongMo(bb, loai) {
  return dsDongChon(bb).filter((d) => (loai === "cachBu" ? moCachBu(d) : moHangLoi(d)).length > 0).length;
}

/** Giá trị chung của câu `loai` trên các dòng còn chọn được (nút "Áp dụng nhanh" đang bật); khác nhau / thiếu thì null. */
export function giaTriChung(bb, chonTheoDong, loai) {
  const cac = new Set();
  for (const d of dsDongChon(bb)) {
    if ((loai === "cachBu" ? moCachBu(d) : moHangLoi(d)).length === 0) continue;
    cac.add((chonTheoDong?.[d.id] ?? luaChonHienTai(d))[loai] ?? null);
  }
  return cac.size === 1 ? [...cac][0] : null;
}

/**
 * Áp một lựa chọn cho mọi dòng còn chọn được giá trị đó (hoặc đang áp dụng đúng giá trị đó: đưa về lựa chọn cũ). Trả
 * { chon, boQua }: `boQua` = số dòng giữ lựa chọn khác vì câu đó đã chốt (dòng chưa từng chọn mà đã khóa, hàng lỗi đã
 * rời kho thì không tính).
 */
export function apDungNhanh(bb, chonTheoDong, loai, giaTri) {
  const chon = { ...chonTheoDong };
  let boQua = 0;
  for (const d of dsDongChon(bb)) {
    const mo = loai === "cachBu" ? moCachBu(d) : moHangLoi(d);
    const hienTai = luaChonHienTai(d)[loai];
    const cu = chon[d.id] ?? luaChonHienTai(d);
    if (mo.includes(giaTri) || (mo.length > 0 && hienTai === giaTri)) chon[d.id] = { ...cu, [loai]: giaTri };
    else if (hienTai != null && hienTai !== giaTri && (loai === "cachBu" || dongOKho(d))) boQua += 1;
  }
  return { chon, boQua };
}

/** Số sản phẩm vừa chọn đồng ý tiêu hủy (trước đó chưa đồng ý): câu cam kết nói rõ không hoàn tác. */
export function soTieuHuyMoi(bb, chonTheoDong) {
  return dsDongChon(bb)
    .filter((d) => chonTheoDong?.[d.id]?.hangLoi === HANG_LOI.TIEU_HUY && d.hangLoi !== HANG_LOI.TIEU_HUY && moHangLoi(d).length > 0)
    .reduce((s, d) => s + (Number(d.soLuong) || 0), 0);
}

/**
 * Dữ liệu gửi POST /cong-ncc/bien-ban/{id}/xac-nhan theo từng dòng: chỉ các dòng có đổi, mỗi dòng chỉ câu có đổi (null
 * là giữ như cũ). `phienBan`: phiên bản biên bản đang hiển thị (kho vừa lập lại thì máy chủ từ chối 409). `camKet`:
 * người xác nhận đã đánh dấu câu cam kết trong hộp xác nhận.
 */
export function taoPayloadTheoDong(bb, chonTheoDong, nguoiXacNhan, ghiChu, phienBan = null, camKet = false) {
  const dong = [];
  for (const d of dsDongChon(bb)) {
    const c = chonTheoDong?.[d.id];
    if (!c) continue;
    const cu = luaChonHienTai(d);
    const phuongAn = c.cachBu && c.cachBu !== cu.cachBu && moCachBu(d).includes(c.cachBu) ? c.cachBu : null;
    const hangLoi = c.hangLoi && c.hangLoi !== cu.hangLoi && moHangLoi(d).includes(c.hangLoi) ? c.hangLoi : null;
    if (phuongAn || hangLoi) dong.push({ id: d.id, phuongAn, hangLoi });
  }
  const ghi = String(ghiChu ?? "").trim().slice(0, GHI_CHU_BIEN_BAN_TOI_DA);
  return {
    dong,
    nguoiXacNhan: chuanHoaHoTen(nguoiXacNhan),
    ghiChu: ghi || null,
    phienBan: phienBan ?? null,
    camKet: Boolean(camKet),
  };
}
