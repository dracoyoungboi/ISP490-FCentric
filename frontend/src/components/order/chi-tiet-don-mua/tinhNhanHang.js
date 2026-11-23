/*
 * Hàm thuần cho màn Chi tiết đơn mua hàng (bản "một khối"): tiến độ nhận hàng, bảng theo đợt nhận,
 * các bước của đơn và hạn giao. Không gọi API, không phụ thuộc React, chạy được bằng `node --test`.
 *
 * Quy ước dữ liệu (đọc từ backend nhánh Khang):
 * - Số đã nhận của từng dòng đơn (`soLuongDaNhan`) là số ĐÃ XONG: hàng đạt (cộng khi phiếu nhập HOÀN TẤT, trạng
 *   thái 3) + hàng lỗi đã chốt trừ tiền với nhà cung cấp (`soLuongTruTien`, chỉ có ở API chi tiết đơn). Màn này tách
 *   hàng đạt = đã nhận − trừ tiền. "Còn thiếu" = max(0, đặt − đã nhận). Hàng lỗi chờ nhà cung cấp xác nhận / chờ giao
 *   bù vẫn là còn thiếu.
 * - Chi tiết phiếu nhập (`/phieu-nhap-kho/{id}/detail`) trả `items[]` theo biến thể:
 *   `soLuongCanNhap` = số dự kiến nhập đợt này, `soLuongDaKhaiBao` = số đạt đã khai báo lô, `soLuongLoiQc` = số lỗi.
 *   Phiếu hoàn tất: số đã nhập của đợt = số đạt, số lỗi hiện riêng. Phiếu chưa hoàn tất: chỉ là số dự kiến.
 * - Phiếu đã hủy (4) không thành cột.
 */
import { t } from "../../../i18n/t.js";

const TRANG_THAI_PHIEU_HOAN_TAT = 3;
const TRANG_THAI_PHIEU_HUY = 4;
const MS_MOT_NGAY = 24 * 60 * 60 * 1000;

/** Trạng thái đơn mua dùng trong logic màn chi tiết (tên hiển thị ở constants/donMuaHang.js). */
export const TRANG_THAI_DON_MUA = Object.freeze({
  DANG_VAN_CHUYEN: 3,
  DA_NHAN_DU: 5,
  DA_DONG: 6,
  DA_HUY: 7,
});

/** Lý do đóng / hủy đơn tối đa (khớp DonMuaHangService.LY_DO_KET_THUC_TOI_DA). */
export const LY_DO_KET_THUC_TOI_DA = 255;

/** Đơn đã kết thúc sớm: đã đóng (nhận thiếu) hoặc đã hủy — không còn hàng về, không tạo phiếu nhập. */
export function daKetThucSom(trangThai) {
  const tt = docSo(trangThai);
  return tt === TRANG_THAI_DON_MUA.DA_DONG || tt === TRANG_THAI_DON_MUA.DA_HUY;
}

/**
 * Mục "Đóng đơn (nhận thiếu)" / "Hủy đơn" ở menu ⋯ của Chi tiết đơn mua (cùng điều kiện máy chủ kiểm, trừ phiếu nhập
 * nháp — máy chủ báo 409 kèm số phiếu). Chỉ đơn đang vận chuyển:
 * - Đóng: đã có ít nhất một phiếu nhập hoàn tất (kể cả đợt toàn hàng lỗi, "đã nhận" vẫn 0) và còn thiếu > 0.
 * - Hủy: chưa có phiếu nhập hoàn tất nào.
 * @param duocThaoTac vai trò được đóng / hủy (quản trị viên, nhân viên mua hàng)
 * @param tienDo `tinhTienDoNhan(don.chiTietDonMuaHangs)`
 * @param soPhieuHoanTat số phiếu nhập đã hoàn tất của đơn (cột không chờ nhập của `dungBangDotNhan`); `null` khi chưa
 *   biết (vai trò không xem được phiếu nhập, đang tải, tải lỗi) thì đoán theo số của đơn: đã nhận hoặc trừ tiền > 0
 * @returns `{ dong, huy }` (boolean)
 */
export function thaoTacKetThuc(don, tienDo, duocThaoTac, soPhieuHoanTat = null) {
  const dangVe = Boolean(don) && docSo(don.trangThai) === TRANG_THAI_DON_MUA.DANG_VAN_CHUYEN;
  if (!duocThaoTac || !dangVe) return { dong: false, huy: false };
  const td = tienDo ?? tinhTienDoNhan(don.chiTietDonMuaHangs);
  const coDotNhan = soPhieuHoanTat == null ? !td.chuaNhan : soPhieuHoanTat > 0;
  return { dong: coDotNhan && !td.daDu, huy: !coDotNhan };
}

/** Đọc số từ BigDecimal của backend (số hoặc chuỗi "80.00"); sai hoặc trống thì 0. */
export function docSo(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function docNgay(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dauNgay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Trừ tiền và hàng đạt của một dòng đơn: "đã nhận" của máy chủ gồm cả hàng lỗi đã chốt trừ tiền. */
function tachDaNhan(ct) {
  const xong = Math.max(0, docSo(ct?.soLuongDaNhan));
  const tru = Math.min(xong, Math.max(0, docSo(ct?.soLuongTruTien)));
  return { dat: xong - tru, tru };
}

/** Còn thiếu của một dòng đơn: đặt − đã nhận (hàng đạt + hàng lỗi đã chốt trừ tiền), không âm. */
export function conThieuDong(ct) {
  const d = Math.max(0, docSo(ct?.soLuongDat));
  const { dat: n, tru } = tachDaNhan(ct);
  return Math.max(0, d - n - tru);
}

/**
 * Tiến độ nhận hàng của cả đơn.
 * - `conThieu` cộng phần thiếu của TỪNG dòng (đặt − đã nhận − trừ tiền; dòng nhận vượt không bù cho dòng còn thiếu).
 * - `truTien`: hàng lỗi đã chốt trừ tiền (không giao lại, đơn giảm số này).
 * - `vuot` cộng phần nhận vượt số đặt (dữ liệu bất thường, cần hiện cho người dùng thấy).
 * - `phanTram`: (đã nhận + trừ tiền) / đặt, mỗi dòng tính trong mức số đặt.
 * - `daDu`: đơn có ít nhất một dòng và mọi dòng không còn thiếu (giống điều kiện khóa nút Tạo phiếu nhập).
 */
export function tinhTienDoNhan(chiTiets) {
  const dong = Array.isArray(chiTiets) ? chiTiets : [];
  let dat = 0;
  let daNhan = 0;
  let truTien = 0;
  let xongTrongMuc = 0;
  let conThieu = 0;
  let vuot = 0;
  for (const ct of dong) {
    const d = Math.max(0, docSo(ct?.soLuongDat));
    const { dat: n, tru } = tachDaNhan(ct);
    dat += d;
    daNhan += n;
    truTien += tru;
    xongTrongMuc += Math.min(n + tru, d);
    conThieu += Math.max(0, d - n - tru);
    vuot += Math.max(0, n + tru - d);
  }
  return {
    dat,
    daNhan,
    truTien,
    conThieu,
    vuot,
    phanTram: dat > 0 ? Math.min(100, Math.round((xongTrongMuc / dat) * 100)) : 0,
    daDu: dong.length > 0 && conThieu === 0,
    chuaNhan: daNhan === 0 && truTien === 0,
  };
}

/** Thứ tự cột: các đợt đã nhập theo ngày nhập, sau đó các phiếu đang chờ nhập theo ngày tạo. */
function sapXepPhieu(a, b) {
  if (a.choNhap !== b.choNhap) return a.choNhap ? 1 : -1;
  const ta = docNgay(a.ngay)?.getTime() ?? 0;
  const tb = docNgay(b.ngay)?.getTime() ?? 0;
  if (ta !== tb) return ta - tb;
  return docSo(a.id) - docSo(b.id);
}

/**
 * Bảng "Sản phẩm và các đợt nhận": mỗi phiếu nhập (chưa hủy) là một cột.
 * @param chiTiets  `chiTietDonMuaHangs` của đơn
 * @param phieus    chi tiết các phiếu nhập của đơn (kết quả `getDetail`, có thể kèm `ngayTao` từ danh sách)
 * @returns `{ cot, dong, tong, lechSo }`
 *   - `cot[i]`: `{ id, soPhieu, ngay, choNhap, nguoiNhap }`
 *   - `dong[j].theoDot[i]`: số của dòng j trong đợt i — phiếu đã nhập: số ĐẠT; phiếu chờ nhập: số dự kiến;
 *     `null` nếu phiếu không có sản phẩm này
 *   - `dong[j].theoDotLoi[i]`: số hàng lỗi của dòng j ở phiếu đã nhập i (phiếu chờ nhập, không có sản phẩm: 0)
 *   - `dong[j]`: thêm `truTien`, `thanhTien` = (đặt − trừ tiền) × đơn giá, `thanhTienTheoDat`, `giamTru`, `giaTriDaNhan`
 *   - `tong`: thêm `truTien`, `thanhTienTheoDat` (đặt × giá), `giamTru` (trừ tiền × giá), `thanhTien` (đã giảm trừ),
 *     `giaTriDaNhan` (đã nhận × giá), `theoDotLoi`
 *   - `lechSo`: các dòng mà tổng số đạt các đợt đã nhập khác `soLuongDaNhan` (dữ liệu cũ hoặc lệch)
 */
export function dungBangDotNhan(chiTiets, phieus) {
  const cot = (Array.isArray(phieus) ? phieus : [])
    .filter((p) => p && docSo(p.trangThai) !== TRANG_THAI_PHIEU_HUY)
    .map((p) => {
      const choNhap = docSo(p.trangThai) !== TRANG_THAI_PHIEU_HOAN_TAT;
      // Phiếu đã nhập: số đạt (máy chủ chỉ cộng hàng đạt vào đã nhận), hàng lỗi để riêng
      const soLuong = new Map();
      const soLoi = new Map();
      for (const it of Array.isArray(p.items) ? p.items : []) {
        if (it?.bienTheSanPhamId == null) continue;
        const sl = choNhap ? docSo(it.soLuongCanNhap) : docSo(it.soLuongDaKhaiBao);
        soLuong.set(it.bienTheSanPhamId, (soLuong.get(it.bienTheSanPhamId) ?? 0) + sl);
        if (!choNhap) {
          soLoi.set(it.bienTheSanPhamId, (soLoi.get(it.bienTheSanPhamId) ?? 0) + Math.max(0, docSo(it.soLuongLoiQc)));
        }
      }
      return {
        id: p.id,
        soPhieu: p.soPhieuNhap || `#${p.id}`,
        ngay: choNhap ? p.ngayTao ?? null : p.ngayNhap ?? p.ngayTao ?? null,
        choNhap,
        nguoiNhap: p.tenNguoiNhap || null,
        soLuong,
        soLoi,
      };
    })
    .sort(sapXepPhieu);

  const lechSo = [];
  const dong = (Array.isArray(chiTiets) ? chiTiets : []).map((ct, viTri) => {
    const bt = ct?.bienTheSanPham ?? {};
    const dat = Math.max(0, docSo(ct?.soLuongDat));
    const { dat: daNhan, tru: truTien } = tachDaNhan(ct);
    const donGia = ct?.donGia ?? null;
    const gia = docSo(donGia);
    const theoDot = cot.map((c) => (c.soLuong.has(bt.id) ? c.soLuong.get(bt.id) : null));
    const theoDotLoi = cot.map((c) => c.soLoi.get(bt.id) ?? 0);
    const tongDaNhapTheoDot = cot.reduce(
      (tong, c, i) => (c.choNhap || theoDot[i] == null ? tong : tong + theoDot[i]),
      0,
    );
    if (cot.some((c) => !c.choNhap) && tongDaNhapTheoDot !== daNhan) {
      lechSo.push({ bienTheId: bt.id ?? null, maSku: bt.maSku ?? null, theoDot: tongDaNhapTheoDot, daNhan });
    }
    return {
      khoa: ct?.id ?? `dong-${viTri}`,
      bienTheId: bt.id ?? null,
      ten: bt.tenSanPham || bt.tenBienThe || bt.maSku || "—",
      sku: bt.maSku || null,
      bienThe: [bt.mauSac?.tenMau, bt.size?.tenSize || bt.size?.maSize].filter(Boolean).join(" · "),
      tenMau: bt.mauSac?.tenMau || "",
      maMauHex: bt.mauSac?.maMauHex || "",
      kichCo: bt.size?.tenSize || bt.size?.maSize || "",
      anh: bt.anhBienThe?.tepTin?.duongDan || null,
      donGia,
      // Không có đơn giá (dữ liệu lạ): giữ thành tiền của máy chủ khi không có trừ tiền
      thanhTien: donGia != null ? Math.max(0, dat - truTien) * gia : truTien > 0 ? null : ct?.thanhTien ?? null,
      thanhTienTheoDat: donGia != null ? dat * gia : ct?.thanhTien ?? null,
      giamTru: truTien * gia,
      giaTriDaNhan: daNhan * gia,
      dat,
      daNhan,
      truTien,
      conThieu: Math.max(0, dat - daNhan - truTien),
      vuot: Math.max(0, daNhan + truTien - dat),
      theoDot,
      theoDotLoi,
    };
  });

  const tong = {
    dat: dong.reduce((s, d) => s + d.dat, 0),
    daNhan: dong.reduce((s, d) => s + d.daNhan, 0),
    truTien: dong.reduce((s, d) => s + d.truTien, 0),
    conThieu: dong.reduce((s, d) => s + d.conThieu, 0),
    vuot: dong.reduce((s, d) => s + d.vuot, 0),
    thanhTienTheoDat: dong.reduce((s, d) => s + docSo(d.thanhTienTheoDat), 0),
    giamTru: dong.reduce((s, d) => s + d.giamTru, 0),
    thanhTien: dong.reduce((s, d) => s + docSo(d.thanhTien), 0),
    giaTriDaNhan: dong.reduce((s, d) => s + d.giaTriDaNhan, 0),
    theoDot: cot.map((_, i) => dong.reduce((s, d) => s + (d.theoDot[i] ?? 0), 0)),
    theoDotLoi: cot.map((_, i) => dong.reduce((s, d) => s + d.theoDotLoi[i], 0)),
  };

  return {
    cot: cot.map((c) => ({ id: c.id, soPhieu: c.soPhieu, ngay: c.ngay, choNhap: c.choNhap, nguoiNhap: c.nguoiNhap })),
    dong,
    tong,
    lechSo,
  };
}

/**
 * Hạn giao so theo ngày lịch trên máy người dùng (cùng cách hiển thị ngày ở utils/formatters).
 * @returns `{ loai: "khongCo" | "daDu" | "quaHan" | "homNay" | "conLai", soNgay }`
 */
export function trangThaiGiao(ngayGiaoDuKien, daDu, homNay = new Date()) {
  const han = docNgay(ngayGiaoDuKien);
  if (!han) return { loai: "khongCo", soNgay: 0 };
  if (daDu) return { loai: "daDu", soNgay: 0 };
  const chenh = Math.round((dauNgay(homNay) - dauNgay(han)) / MS_MOT_NGAY);
  if (chenh > 0) return { loai: "quaHan", soNgay: chenh };
  if (chenh === 0) return { loai: "homNay", soNgay: 0 };
  return { loai: "conLai", soNgay: -chenh };
}

/**
 * 6 bước của đơn mua hàng, theo đúng trạng thái đang dùng (constants/donMuaHang.js):
 * 1 Đã gửi · 2 Đã báo giá · 3 Đang vận chuyển · 4 Không chấp nhận báo giá · 5 Đã nhận đủ (dữ liệu cũ, trước gọi "Đã thanh toán")
 * · 6 Đã đóng (nhận thiếu) · 7 Đã hủy. Đơn 6 / 7: bước cuối đổi thành "Đã đóng" / "Đã hủy" (dừng, mốc `ngayKetThuc`).
 * Mỗi bước: `{ ma, nhan, trangThai: "xong" | "dangLam" | "chua" | "dung", phu, ngay, canhBao }`.
 * `ngay` để màn tự định dạng; `canhBao` là chữ cảnh báo (vd. "quá hạn 1 ngày").
 */
export function tinhBuocDonMua(don, tienDo, cotDot, homNay = new Date()) {
  const trangThai = docSo(don?.trangThai);
  const daDong = trangThai === TRANG_THAI_DON_MUA.DA_DONG;
  const daHuy = trangThai === TRANG_THAI_DON_MUA.DA_HUY;
  const daChot = trangThai === TRANG_THAI_DON_MUA.DANG_VAN_CHUYEN || trangThai === TRANG_THAI_DON_MUA.DA_NHAN_DU
    || daDong || daHuy;
  const tuChoi = trangThai === 4;
  const td = tienDo ?? tinhTienDoNhan(don?.chiTietDonMuaHangs);
  const giao = trangThaiGiao(don?.ngayGiaoDuKien, td.daDu, homNay);
  const dotDaNhap = (Array.isArray(cotDot) ? cotDot : []).filter((c) => !c.choNhap);
  // "đã nhận/đặt"; có trừ tiền thì ghi thành phép cộng "37 đạt + 3 trừ tiền / 40" (hàng lỗi không giao lại cũng là
  // phần đã xong của đơn) để khỏi đọc "37/40" là còn thiếu
  const soDaNhan = td.truTien > 0
    ? t("{{daNhan}} đạt + {{truTien}} trừ tiền / {{dat}}", { daNhan: td.daNhan, dat: td.dat, truTien: td.truTien })
    : `${td.daNhan}/${td.dat}`;

  const buocBaoGia = daChot || tuChoi || trangThai === 2
    ? { trangThai: "xong", phu: t("Đã có giá") }
    : { trangThai: "dangLam", phu: t("Chờ nhà cung cấp") };

  const buocChot = daChot
    ? { trangThai: "xong", phu: t("Đã chốt") }
    : tuChoi
      ? { trangThai: "dung", phu: t("Không chấp nhận báo giá") }
      : trangThai === 2
        ? { trangThai: "dangLam", phu: t("Chờ duyệt báo giá") }
        : { trangThai: "chua", phu: "" };

  let buocNhan;
  if (!daChot) {
    buocNhan = { trangThai: "chua", phu: "", canhBao: "" };
  } else if (daDong) {
    // Đã thôi nhận: các đợt đã nhận là xong, không còn cảnh báo quá hạn
    buocNhan = { trangThai: "xong", phu: soDaNhan, canhBao: "" };
  } else if (daHuy) {
    buocNhan = { trangThai: "chua", phu: t("Không nhận"), canhBao: "" };
  } else if (td.daDu) {
    buocNhan = { trangThai: "xong", phu: soDaNhan, canhBao: "" };
  } else {
    buocNhan = {
      trangThai: "dangLam",
      // Đợt đầu toàn hàng lỗi: đã có phiếu nhập hoàn tất nên không còn là "Chưa nhận"
      phu: td.chuaNhan && !dotDaNhap.length ? t("Chưa nhận") : soDaNhan,
      canhBao: giao.loai === "quaHan" ? t("quá hạn {{count}} ngày", { count: giao.soNgay }) : "",
    };
  }

  const dotCoNgay = dotDaNhap.filter((c) => c.ngay);
  const ngayDotCuoi = dotCoNgay.length ? dotCoNgay[dotCoNgay.length - 1].ngay : null;

  return [
    {
      ma: "yeu-cau",
      nhan: t("Yêu cầu nhập hàng"),
      trangThai: "xong",
      phu: don?.yeuCauMuaHang?.soYeuCauMuaHang || "",
      ngay: don?.yeuCauMuaHang?.ngayTao ?? null,
      canhBao: "",
    },
    {
      ma: "gui-yeu-cau-bao-gia",
      nhan: t("Gửi yêu cầu báo giá"),
      trangThai: "xong",
      phu: "",
      // Lúc email yêu cầu báo giá gửi được (ngayGuiYeuCau); dữ liệu cũ thì ngày tạo đơn
      ngay: don?.ngayGuiYeuCau ?? don?.ngayDatHang ?? don?.ngayTao ?? null,
      canhBao: "",
    },
    { ma: "bao-gia", nhan: t("Nhà cung cấp báo giá"), ngay: null, canhBao: "", ...buocBaoGia },
    { ma: "chot-don", nhan: t("Chốt đơn"), ngay: null, canhBao: "", ...buocChot },
    { ma: "nhan-hang", nhan: t("Nhận hàng"), ngay: null, ...buocNhan },
    daDong || daHuy
      ? {
        ma: "nhan-du",
        nhan: daDong ? t("Đã đóng") : t("Đã hủy"),
        trangThai: "dung",
        phu: daDong ? t("Thiếu {{conThieu}}", { conThieu: td.conThieu }) : "",
        ngay: don?.ngayKetThuc ?? null,
        canhBao: "",
      }
      : {
        ma: "nhan-du",
        nhan: t("Nhận đủ"),
        trangThai: daChot && td.daDu ? "xong" : "chua",
        phu: !daChot ? "" : td.daDu ? "" : t("Còn thiếu {{conThieu}}", { conThieu: td.conThieu }),
        ngay: daChot && td.daDu ? ngayDotCuoi : null,
        canhBao: "",
      },
  ];
}

// ── Biên bản trả hàng của đơn (khối "Hàng lỗi trả nhà cung cấp", nhãn phụ Còn thiếu, hộp Đóng đơn) ────────────────
// Cách bù nhà cung cấp chọn trên cổng: CHO_CHOT (chưa chọn) | DOI_HANG (giao bù) | TRU_CONG_NO (trừ tiền). `theoBienThe` chỉ để
// hiển thị: [{ bienTheSanPhamId, sku, soLuongLoi, donGia, conThieuDongDon }].

/** Biên bản còn hiệu lực (bỏ biên bản đã hủy). */
export function bienBanHieuLuc(dsBienBan) {
  return (Array.isArray(dsBienBan) ? dsBienBan : []).filter(
    (bb) => bb && bb.trangThai !== "DA_HUY" && bb.trangThaiHienThi !== "DA_HUY",
  );
}

/** Biên bản mà hàng lỗi còn chờ: đã nhập kho và nhà cung cấp chưa chọn, hoặc giao bù mà chưa nhận đủ hàng bù. */
export function bienBanConCho(bb) {
  if (!bb?.phieuDaNhap) return false;
  return bb.phuongAn === "CHO_CHOT" || (bb.phuongAn === "DOI_HANG" && !bb.buXong);
}

/**
 * Nhãn phụ dưới ô Còn thiếu theo biến thể: `{ [bienTheSanPhamId]: "choChot" | "choHangBu" }`.
 * Một biến thể vừa chờ nhà cung cấp chọn ở biên bản này vừa chờ hàng bù ở biên bản khác thì ưu tiên "choChot" (việc mua
 * hàng còn phải nhắc).
 */
export function nhanBuTheoBienThe(dsBienBan) {
  const kq = {};
  for (const bb of bienBanHieuLuc(dsBienBan)) {
    if (!bienBanConCho(bb)) continue;
    const loai = bb.phuongAn === "CHO_CHOT" ? "choChot" : "choHangBu";
    for (const d of Array.isArray(bb.theoBienThe) ? bb.theoBienThe : []) {
      if (d?.bienTheSanPhamId == null || !(docSo(d.soLuongLoi) > 0)) continue;
      if (kq[d.bienTheSanPhamId] !== "choChot") kq[d.bienTheSanPhamId] = loai;
    }
  }
  return kq;
}

/**
 * Hàng lỗi chưa xong sẽ chuyển sang trừ tiền khi đóng đơn (gần đúng như máy chủ): Σ min(số lỗi, còn thiếu dòng đơn) của
 * các biên bản chờ nhà cung cấp chọn / chờ hàng bù; còn thiếu của dòng đơn trừ dần qua từng biên bản cùng biến thể.
 * @param chiTiets dòng đơn (để lấy còn thiếu hiện tại); không có dòng thì dùng `conThieuDongDon` của biên bản
 * @returns `{ soLuong, soBienBan: string[] }`
 */
export function hangLoiChuyenKhiDongDon(dsBienBan, chiTiets) {
  const conLai = new Map();
  for (const ct of Array.isArray(chiTiets) ? chiTiets : []) {
    const id = ct?.bienTheSanPham?.id;
    if (id != null) conLai.set(id, (conLai.get(id) ?? 0) + conThieuDong(ct));
  }
  let soLuong = 0;
  const soBienBan = [];
  for (const bb of bienBanHieuLuc(dsBienBan)) {
    if (!bienBanConCho(bb)) continue;
    let cuaBienBan = 0;
    for (const d of Array.isArray(bb.theoBienThe) ? bb.theoBienThe : []) {
      const id = d?.bienTheSanPhamId;
      if (id == null) continue;
      const thieu = conLai.has(id) ? conLai.get(id) : Math.max(0, docSo(d.conThieuDongDon));
      const chuyen = Math.max(0, Math.min(docSo(d.soLuongLoi), thieu));
      conLai.set(id, thieu - chuyen);
      cuaBienBan += chuyen;
    }
    if (cuaBienBan > 0) {
      soLuong += cuaBienBan;
      soBienBan.push(bb.soBienBan || `#${bb.id}`);
    }
  }
  return { soLuong, soBienBan };
}

/** Tóm tắt phương án của một biên bản cho thẻ nhỏ ở cột phải; phiếu chưa nhập kho thì rỗng (nhãn trạng thái đã nói). */
export function tomTatPhuongAn(bb, dinhDangTien = String) {
  if (!bb?.phieuDaNhap) return "";
  if (bb.phuongAn === "TRU_CONG_NO") return t("trừ tiền {{tien}}", { tien: dinhDangTien(docSo(bb.tienTruTien)) });
  if (bb.phuongAn === "DOI_HANG") return bb.buXong ? t("giao bù, đã đủ") : t("giao bù");
  if (bb.phuongAn === "CHO_CHOT") return t("chờ nhà cung cấp chọn");
  return "";
}
