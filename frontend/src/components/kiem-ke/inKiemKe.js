/*
 * Logic thuần của bản in kiểm kê: Biên bản kiểm kê hàng hóa (/stock-take/:id/print) và Phiếu điều chỉnh kho của đợt
 * (/stock-take/:id/print-adjustment). Đổi dữ liệu API (KiemKeDto.Dot, Dong, PhieuDieuChinh) sang số liệu in. Không gọi
 * API, không phụ thuộc React, chạy được bằng `node --test`.
 *
 * Bố cục đã chốt 09/11 (bản vẽ PA B): một trang A4 dọc gồm tổng hợp + chỉ các dòng lệch, toàn bộ dòng đếm sang phụ lục
 * xếp theo kệ; ảnh không in, chỉ ghi số ảnh; tiền chỉ in cho Quản trị viên, Quản lý kho.
 */
import { docSo } from "../chung-tu/bangChungTu.js";
import { tenHangIn } from "../chuyen-kho/inChuyenKho.js";
import { TT_DOT, laLech, sapXepDong } from "./kiemKe.js";
import { t } from "../../i18n/t.js";

/** Loại giấy theo đường dẫn. `tieuDe`: tên ở thanh công cụ (dịch theo ngôn ngữ giao diện). */
export const LOAI_IN_KIEM_KE = Object.freeze({
  "bien-ban": { tieuDe: t("Biên bản kiểm kê") },
  "dieu-chinh": { tieuDe: t("Phiếu điều chỉnh kho") },
});

/** Tiêu đề in trên giấy: chữ trên chứng từ giữ tiếng Việt ở mọi ngôn ngữ giao diện. */
export const TEN_GIAY_KIEM_KE = Object.freeze({
  "bien-ban": "BIÊN BẢN KIỂM KÊ HÀNG HÓA", // i18n-giu-nguyen: nội dung chứng từ in
  "dieu-chinh": "PHIẾU ĐIỀU CHỈNH KHO", // i18n-giu-nguyen: nội dung chứng từ in
});

/**
 * Giấy chưa in được cho đợt này thì trả câu giải thích, in được thì null.
 * Biên bản: Chờ duyệt (bản nháp để ban kiểm kê ký trước khi trình) và Đã duyệt. Phiếu điều chỉnh: đợt đã duyệt có lệch.
 */
export function lyDoChuaInKiemKe(loai, dot, phieu) {
  if (!LOAI_IN_KIEM_KE[loai]) return t("Không có mẫu in này cho đợt kiểm kê.");
  if (!dot) return null;
  const tt = Number(dot.trangThai);
  if (loai === "bien-ban") {
    if (tt === TT_DOT.CHO_DUYET || tt === TT_DOT.DA_DUYET) return null;
    if (tt === TT_DOT.DA_HUY) return t("Đợt đã hủy nên không lập biên bản kiểm kê.");
    return t("Biên bản in được khi đợt đã kiểm đếm xong (Chờ duyệt hoặc Đã duyệt).");
  }
  if (tt !== TT_DOT.DA_DUYET) return t("Phiếu điều chỉnh kho có sau khi đợt kiểm kê được duyệt.");
  if (!phieu) return t("Đợt không có chênh lệch nên không có phiếu điều chỉnh kho.");
  return null;
}

/** Biên bản còn là bản nháp (chưa duyệt): in dấu "BẢN NHÁP – CHƯA DUYỆT", ô Người duyệt để trống. */
export const laBanNhap = (dot) => Number(dot?.trangThai) !== TT_DOT.DA_DUYET;

const so = (v) => (v === null || v === undefined || v === "" ? null : docSo(v));
const chu = (s) => String(s ?? "").trim();

// Nhãn phạm vi trên giấy giữ tiếng Việt (màn hình dùng nhanPhamVi / moTaPhamVi của kiemKe.js, đã dịch)
// i18n-giu-nguyen: nội dung chứng từ in
const NHAN_PHAM_VI_IN = Object.freeze({ toan_bo: "Toàn bộ kho", theo_khu_vuc: "Theo khu vực", theo_ke: "Theo vị trí kệ", theo_danh_muc: "Theo danh mục", dot_xuat: "Đột xuất" });
const TOI_DA_PHAM_VI_IN = 12;

/** Phạm vi in trên giấy: "Theo danh mục: Áo Polo (gồm 2 danh mục con)"; toàn kho thì "Toàn bộ kho". */
export function phamViIn(dot) {
  if (!dot) return "";
  const loai = dot.loaiKiemKe;
  const nhan = NHAN_PHAM_VI_IN[loai] ?? NHAN_PHAM_VI_IN.toan_bo;
  if (loai === "toan_bo" || loai === "dot_xuat" || !loai) return `${nhan} (mọi kệ của kho)`; // i18n-giu-nguyen: nội dung chứng từ in
  const gon = (ds) => {
    const ten = ds.filter(Boolean);
    if (ten.length <= TOI_DA_PHAM_VI_IN) return ten.join(", ");
    return `${ten.slice(0, TOI_DA_PHAM_VI_IN).join(", ")} +${ten.length - TOI_DA_PHAM_VI_IN}`;
  };
  let chiTiet = "";
  // i18n-giu-nguyen: nội dung chứng từ in
  if (loai === "theo_khu_vuc") chiTiet = gon((dot.khuVuc ?? []).map((k) => k.ten || k.ma)) || "Chưa chọn khu vực";
  else if (loai === "theo_ke") chiTiet = gon((dot.viTri ?? []).map((v) => v.ma)) || "Chưa chọn kệ"; // i18n-giu-nguyen: nội dung chứng từ in
  else if (loai === "theo_danh_muc") {
    const goc = dot.danhMuc?.ten || "Chưa chọn danh mục"; // i18n-giu-nguyen: nội dung chứng từ in
    const con = Math.max(0, (dot.danhMucChot?.length ?? 0) - 1);
    chiTiet = con > 0 ? `${goc} (gồm ${con} danh mục con)` : goc; // i18n-giu-nguyen: nội dung chứng từ in
  }
  return `${nhan}: ${chiTiet}`;
}

/** Một dòng in: tên hàng, mã, lô, kệ, số sổ / thực tế / chênh lệch, giá vốn chốt và giá trị chênh lệch. */
export function dongIn(d) {
  const soSach = so(d?.soLuongHeThong) ?? 0;
  const thucTe = so(d?.soLuongThucTe);
  const cl = thucTe === null ? null : so(d?.chenhLechSoLuong) ?? thucTe - soSach;
  const gia = so(d?.giaVonHeThong) ?? 0;
  const sp = d?.sanPham ?? {};
  return {
    khoa: d?.id,
    ten: tenHangIn({ tenSanPham: sp.tenSanPham, sku: sp.maSku, tenMau: sp.tenMau, kichCo: sp.kichCo }),
    sku: chu(sp.maSku),
    maLo: chu(d?.loHang?.ma),
    ke: chu(d?.viTri?.ma),
    soSach,
    thucTe,
    chenhLech: cl,
    giaVon: gia,
    // Giá trị chênh lệch có dấu theo máy chủ; dòng chưa có thì tính lại từ giá vốn chốt
    giaTri: cl === null ? null : so(d?.giaTriChenhLech) ?? cl * gia,
    lyDo: lyDoIn(d),
    nguoiDem: chu(d?.nguoiKiemDem?.hoTen),
    lanDem: Number(d?.lanKiemDem) || 1,
  };
}

/** Cột "Lý do, hướng xử lý": "Đếm lần 2. <lý do>. Xử lý: <biện pháp>" (bỏ phần trống). */
export function lyDoIn(d) {
  const lan = Number(d?.lanKiemDem) || 1;
  const lyDo = chu(d?.lyDoChenhLech).replace(/[.。]+$/, "");
  const xuLy = chu(d?.bienPhapXuLy).replace(/[.。]+$/, "");
  // i18n-giu-nguyen: nội dung chứng từ in
  return [lan > 1 ? `Đếm lần ${lan}` : "", lyDo, xuLy ? `Xử lý: ${xuLy}` : ""].filter(Boolean).join(". ");
}

/** Tổng hợp của biên bản (mục II). Số đã làm tròn tiền tới đồng ở lúc in, ở đây giữ nguyên. */
export function tongHopIn(dong) {
  const tong = { soDong: 0, khop: 0, chuaDem: 0, soSach: 0, thucTe: 0, thua: 0, thieu: 0, dongThua: 0, dongThieu: 0,
    giaTriSo: 0, giaTriThua: 0, giaTriThieu: 0 };
  for (const d of dong) {
    tong.soDong++;
    tong.soSach += d.soSach;
    tong.giaTriSo += d.soSach * d.giaVon;
    if (d.thucTe === null) {
      tong.chuaDem++;
      continue;
    }
    tong.thucTe += d.thucTe;
    if (d.chenhLech > 0) {
      tong.thua += d.chenhLech;
      tong.dongThua++;
      tong.giaTriThua += Math.abs(d.giaTri ?? 0);
    } else if (d.chenhLech < 0) {
      tong.thieu += -d.chenhLech;
      tong.dongThieu++;
      tong.giaTriThieu += Math.abs(d.giaTri ?? 0);
    } else {
      tong.khop++;
    }
  }
  tong.chenhLech = tong.thua - tong.thieu;
  tong.giaTriRong = tong.giaTriThua - tong.giaTriThieu;
  // Tỷ lệ chênh lệch ròng trên giá trị theo sổ (%); sổ bằng 0 thì không tính
  tong.tiLe = tong.giaTriSo > 0 ? (tong.giaTriRong / tong.giaTriSo) * 100 : null;
  return tong;
}

/**
 * Thành phần ban kiểm kê: người chủ trì, rồi những người đã đếm (kể cả lần đếm trước của dòng đếm lại), người đếm nhiều
 * dòng hơn đứng trước. `soDong`: số dòng người đó đếm ở lần cuối.
 */
export function banKiemKe(dot, dongApi) {
  const theoTen = new Map();
  const them = (n, vaiTro) => {
    const ten = chu(n?.hoTen);
    if (!ten) return null;
    const khoa = n?.id ?? ten;
    if (!theoTen.has(khoa)) theoTen.set(khoa, { khoa: String(khoa), ten, chuTri: false, soDong: 0, daDem: false });
    const x = theoTen.get(khoa);
    if (vaiTro === "chuTri") x.chuTri = true;
    else x.daDem = true;
    return x;
  };
  them(dot?.nguoiChuTri, "chuTri");
  for (const d of dongApi ?? []) {
    const x = them(d?.nguoiKiemDem, "dem");
    if (x) x.soDong++;
    for (const l of d?.lanTruoc ?? []) them(l?.nguoiKiemDem, "dem");
  }
  return [...theoTen.values()].sort((a, b) => Number(b.chuTri) - Number(a.chuTri) || b.soDong - a.soDong);
}

/** Ô ký "Người kiểm đếm": người đếm nhiều dòng nhất ở lần cuối (cả ban có ở mục thành phần). */
export function nguoiDemChinh(ban) {
  const dem = ban.filter((x) => x.soDong > 0).sort((a, b) => b.soDong - a.soDong);
  return dem[0]?.ten ?? "";
}

/** Số ảnh bằng chứng của cả đợt (ảnh không in, chỉ ghi số). */
export const soAnhDot = (dongApi) => (dongApi ?? []).reduce((s, d) => s + (d?.anh?.length ?? 0), 0);

/** Toàn bộ dữ liệu biên bản từ đợt + dòng. */
export function bienBanKiemKe(dot, dongApi) {
  const dong = sapXepDong(dongApi ?? []).map(dongIn);
  const ban = banKiemKe(dot, dongApi);
  return {
    dong,
    lech: dong.filter((d) => d.thucTe !== null && d.chenhLech !== 0),
    tong: tongHopIn(dong),
    ban,
    nguoiDem: nguoiDemChinh(ban),
    soAnh: soAnhDot(dongApi),
  };
}

/**
 * Dòng của phiếu điều chỉnh kho nguồn kiểm kê: mỗi dòng lệch của đợt đã duyệt là một dòng phiếu (KiemKeDuyetService
 * .ghiDieuChinh: số lượng = chênh lệch, đơn giá = giá vốn chốt, thành tiền = |chênh lệch| × giá vốn).
 */
export function dongPhieuDieuChinh(dongApi) {
  const dong = sapXepDong((dongApi ?? []).filter(laLech)).map(dongIn);
  const tong = { tang: 0, giam: 0, tienTang: 0, tienGiam: 0 };
  const ds = dong.map((d) => {
    const thanhTien = Math.abs(d.chenhLech) * d.giaVon;
    if (d.chenhLech > 0) {
      tong.tang += d.chenhLech;
      tong.tienTang += thanhTien;
    } else {
      tong.giam += -d.chenhLech;
      tong.tienGiam += thanhTien;
    }
    return { ...d, thanhTien };
  });
  return { dong: ds, tong: { ...tong, tienRong: tong.tienTang - tong.tienGiam } };
}

/** Loại phiếu điều chỉnh in trên giấy. */
export function tenLoaiDieuChinh(loai) {
  if (loai === "tang") return "Tăng"; // i18n-giu-nguyen: nội dung chứng từ in
  if (loai === "giam") return "Giảm"; // i18n-giu-nguyen: nội dung chứng từ in
  return "Tăng và giảm"; // i18n-giu-nguyen: nội dung chứng từ in
}
