// Kỳ xem của màn Tổng quan quản trị (đặc tả bản 2, mục 1): thuần dữ liệu để kiểm thử bằng node --test.
// Cùng luật với máy chủ (KyXemTongQuan.java): mọi mốc theo lịch, kỳ chạm hôm nay cắt ở giờ số liệu, kỳ so sánh cắt cùng giờ.
import { t } from "../../../../i18n/t.js";
import { docNgay, tenThu, tenThuGiuaCau } from "./tongQuanFormat.js";

export const KY_MAC_DINH = "30_ngay";
export const SO_NGAY_TUY_CHON_TOI_DA = 366;

export const TEN_KY = {
  hom_nay: t("Hôm nay"),
  hom_qua: t("Hôm qua"),
  "7_ngay": t("7 ngày qua"),
  "30_ngay": t("30 ngày qua"),
  thang_nay: t("Tháng này"),
  thang_truoc: t("Tháng trước"),
  "12_thang": t("12 tháng qua"),
  tuy_chon: t("Tùy chọn"),
};

/** Menu kỳ chia nhóm; Tùy chọn đứng riêng ở cuối. */
export const NHOM_KY = [
  { ten: t("Theo ngày"), ds: ["hom_nay", "hom_qua", "7_ngay", "30_ngay"] },
  { ten: t("Theo tháng"), ds: ["thang_nay", "thang_truoc", "12_thang"] },
];

const NGAY = 24 * 3600e3;
const hai = (n) => String(n).padStart(2, "0");
const dm = (d) => `${hai(d.getDate())}/${hai(d.getMonth() + 1)}`;
const dmy = (d) => `${dm(d)}/${d.getFullYear()}`;
const hm = (d) => `${hai(d.getHours())}:${hai(d.getMinutes())}`;
const dauNgay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const congNgay = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds());
const ngayCuoiThang = (y, m) => new Date(y, m + 1, 0).getDate();
/** Ngày máy chủ đọc được: yyyy-MM-dd theo giờ địa phương. */
export const ngayMay = (d) => `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`;

/** Cùng ngày, cùng giờ của tháng trước; tháng trước không có ngày đó thì lấy hết tháng trước. */
function cungLucThangTruoc(d) {
  const y = d.getFullYear();
  const m = d.getMonth();
  if (d.getDate() > new Date(y, m, 0).getDate()) return new Date(y, m, 1);
  return new Date(y, m - 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
}

function luiNam(d) {
  const y = d.getFullYear() - 1;
  return new Date(y, d.getMonth(), Math.min(d.getDate(), ngayCuoiThang(y, d.getMonth())), d.getHours(), d.getMinutes(), d.getSeconds());
}

function motNgay(ma, tu, cuoiNgay, bayGio) {
  const dangChay = cuoiNgay >= bayGio;
  const den = dangChay ? bayGio : cuoiNgay;
  return { ma, tu, den, tuTruoc: congNgay(tu, -7), denTruoc: congNgay(den, -7), nhom: "gio", soDiem: 24, kieuSoSanh: "tuan_truoc", dangChay };
}

/**
 * Khoảng của một kỳ, tính ở trình duyệt từ giờ số liệu (cho dòng phụ của menu kỳ khi chưa tải kỳ đó). Kỳ đang xem thì dùng
 * khoảng máy chủ trả (tuKyMayChu). tuNgay / denNgay: Date của kỳ tùy chọn (tính cả hai đầu).
 */
export function khoangKy(ma, thoiDiem, tuNgay, denNgay) {
  const bayGio = docNgay(thoiDiem) ?? new Date();
  const homNay = dauNgay(bayGio);
  switch (ma) {
    case "hom_nay":
      return motNgay(ma, homNay, congNgay(homNay, 1), bayGio);
    case "hom_qua":
      return motNgay(ma, congNgay(homNay, -1), homNay, bayGio);
    case "7_ngay":
    case "30_ngay": {
      const n = ma === "7_ngay" ? 7 : 30;
      const tu = congNgay(homNay, -(n - 1));
      return { ma, tu, den: bayGio, tuTruoc: congNgay(tu, -n), denTruoc: congNgay(bayGio, -n), nhom: "ngay", soDiem: n, kieuSoSanh: "lien_truoc", dangChay: true };
    }
    case "thang_nay": {
      const tu = new Date(bayGio.getFullYear(), bayGio.getMonth(), 1);
      return {
        ma, tu, den: bayGio, tuTruoc: new Date(bayGio.getFullYear(), bayGio.getMonth() - 1, 1), denTruoc: cungLucThangTruoc(bayGio),
        nhom: "ngay", soDiem: ngayCuoiThang(bayGio.getFullYear(), bayGio.getMonth()), kieuSoSanh: "thang_truoc", dangChay: true,
      };
    }
    case "thang_truoc": {
      const tu = new Date(bayGio.getFullYear(), bayGio.getMonth() - 1, 1);
      const den = new Date(bayGio.getFullYear(), bayGio.getMonth(), 1);
      return {
        ma, tu, den, tuTruoc: new Date(tu.getFullYear(), tu.getMonth() - 1, 1), denTruoc: tu,
        nhom: "ngay", soDiem: ngayCuoiThang(tu.getFullYear(), tu.getMonth()), kieuSoSanh: "thang_truoc", dangChay: false,
      };
    }
    case "12_thang": {
      const tu = new Date(bayGio.getFullYear(), bayGio.getMonth() - 11, 1);
      return { ma, tu, den: bayGio, tuTruoc: new Date(tu.getFullYear() - 1, tu.getMonth(), 1), denTruoc: luiNam(bayGio), nhom: "thang", soDiem: 12, kieuSoSanh: "nam_truoc", dangChay: true };
    }
    case "tuy_chon": {
      if (!tuNgay || !denNgay) return null;
      const tu = dauNgay(tuNgay);
      const cuoiNgay = congNgay(dauNgay(denNgay), 1);
      const soNgay = Math.round((cuoiNgay - tu) / NGAY);
      if (soNgay <= 1) return motNgay(ma, tu, cuoiNgay, bayGio);
      const dangChay = cuoiNgay >= bayGio;
      const den = dangChay ? bayGio : cuoiNgay;
      const tuTruoc = congNgay(tu, -soNgay);
      const denTruoc = new Date(tuTruoc.getTime() + (den - tu));
      const soThang = (denNgay.getFullYear() - tuNgay.getFullYear()) * 12 + denNgay.getMonth() - tuNgay.getMonth() + 1;
      return {
        ma, tu, den, tuTruoc, denTruoc, nhom: soNgay <= 62 ? "ngay" : "thang", soDiem: soNgay <= 62 ? soNgay : soThang,
        kieuSoSanh: "lien_truoc", dangChay,
      };
    }
    default:
      return null;
  }
}

/** Kỳ máy chủ trả (TongQuanAdminResponse.ky) → cùng dạng với khoangKy (mốc là Date). */
export function kyTuMayChu(ky) {
  if (!ky) return null;
  return {
    ma: ky.ma, tu: docNgay(ky.tu), den: docNgay(ky.den), tuTruoc: docNgay(ky.tuTruoc), denTruoc: docNgay(ky.denTruoc),
    bieuDoTruocTu: docNgay(ky.bieuDoTruocTu), bieuDoTruocDen: docNgay(ky.bieuDoTruocDen),
    nhom: ky.nhom, soDiem: ky.soDiem, kieuSoSanh: ky.kieuSoSanh, dangChay: ky.dangChay,
  };
}

/** Số ngày lịch của khoảng (kỳ đang chạy tính cả hôm nay). */
export const soNgayCuaKy = (k) => Math.round((dauNgay(new Date(k.den.getTime() - 1)) - dauNgay(k.tu)) / NGAY) + 1;

const namKhac = (...ds) => ds.some((d) => d && d.getFullYear() !== ds[0].getFullYear());
const thangNam = (d) => t("T{{thang}}/{{nam}}", { thang: d.getMonth() + 1, nam: String(d.getFullYear()).slice(2) });

/**
 * Khoảng đang xem và khoảng đem so viết bằng ngày giờ thật: xem "27/11, 00:00 – 21:13" hoặc "29/10 – 27/11";
 * truoc "thứ Sáu 20/11" hoặc "29/09 – 28/10"; cungGio: kỳ đang chạy nên kỳ so sánh cắt cùng giờ.
 */
export function khoangChu(k) {
  if (!k) return { xem: "", truoc: "", cungGio: false };
  const cuoi = new Date(k.den.getTime() - 1);
  const cuoiTruoc = new Date(k.denTruoc.getTime() - 1);
  if (k.ma === "12_thang") {
    return { xem: `${thangNam(k.tu)} – ${thangNam(cuoi)}`, truoc: `${thangNam(k.tuTruoc)} – ${thangNam(cuoiTruoc)}`, cungGio: k.dangChay };
  }
  const motNgayXem = soNgayCuaKy(k) <= 1;
  const f = namKhac(k.tu, cuoi, k.tuTruoc) ? dmy : dm;
  return {
    xem: motNgayXem ? `${dm(k.tu)}${k.dangChay ? `, 00:00 – ${hm(k.den)}` : ""}` : `${f(k.tu)} – ${f(cuoi)}`,
    truoc: motNgayXem ? `${tenThuGiuaCau(k.tuTruoc)} ${dm(k.tuTruoc)}` : `${f(k.tuTruoc)} – ${f(cuoiTruoc)}`,
    cungGio: k.dangChay,
  };
}

/** Hai dòng mô tả kỳ: [khoảng đang xem, "So với <khoảng>[, cùng giờ]"]. */
export function moTaKy(k) {
  const c = khoangChu(k);
  if (!k) return ["", ""];
  return [c.xem, c.cungGio ? t("So với {{khoang}}, cùng giờ", { khoang: c.truoc }) : t("So với {{khoang}}", { khoang: c.truoc })];
}

/** Nhãn ngắn trên nút kỳ (tùy chọn ghi số ngày). */
export function nhanNutKy(ma, k) {
  if (ma === "tuy_chon" && k) return t("Tùy chọn, {{soNgay}} ngày", { soNgay: soNgayCuaKy(k), count: soNgayCuaKy(k) });
  return TEN_KY[ma] ?? TEN_KY[KY_MAC_DINH];
}

/** Chú thích hai đường trên biểu đồ: [đường kỳ này, đường kỳ trước], ghi bằng khoảng ngày thật. */
export function chuThichBieuDo(k) {
  if (!k) return ["", ""];
  if (k.ma === "hom_nay") return [t("Hôm nay"), `${tenThu(k.tuTruoc)} ${dm(k.tuTruoc)}`];
  const c = khoangChu(k);
  const truoc = c.truoc.charAt(0).toUpperCase() + c.truoc.slice(1);
  return [c.xem, c.cungGio ? t("{{khoang}}, cùng giờ", { khoang: truoc }) : truoc];
}

/** Mốc bắt đầu của điểm thứ i (tính từ goc) theo nhóm giờ / ngày / tháng. */
export function mocDiem(k, goc, i) {
  if (k.nhom === "gio") return new Date(goc.getFullYear(), goc.getMonth(), goc.getDate(), i);
  if (k.nhom === "ngay") return new Date(goc.getFullYear(), goc.getMonth(), goc.getDate() + i);
  return new Date(goc.getFullYear(), goc.getMonth() + i, 1);
}

/** Nhãn trục ngang: "09:00", "12/10", "T10" (điểm đầu và tháng 1 kèm năm: "T1/26"). */
export function nhanTrucDiem(k, i) {
  const d = mocDiem(k, k.tu, i);
  if (k.nhom === "gio") return `${hai(i)}:00`;
  if (k.nhom === "ngay") return dm(d);
  const kemNam = i === 0 || d.getMonth() === 0;
  return `${t("T{{thang}}", { thang: d.getMonth() + 1 })}${kemNam ? `/${String(d.getFullYear()).slice(2)}` : ""}`;
}

/** Nhãn đầy đủ của một điểm trong hộp rê chuột: thứ + ngày (+ giờ), tháng/năm; điểm đang chạy ghi "(đến hh:mm)". */
export function nhanDiem(k, i, truoc) {
  const goc = truoc ? k.bieuDoTruocTu ?? k.tuTruoc : k.tu;
  const d = mocDiem(k, goc, i);
  const cuoiNay = !truoc && k.dangChay && i === soDiemDaCo(k) - 1;
  if (k.nhom === "gio") return `${tenThu(d)} ${dm(d)}, ${hai(i)}:00 – ${hai((i + 1) % 24)}:00`;
  if (k.nhom === "ngay") return `${tenThu(d)} ${dm(d)}${cuoiNay ? t(" (đến {{gio}})", { gio: hm(k.den) }) : ""}`;
  return `${t("Tháng {{thang}}/{{nam}}", { thang: d.getMonth() + 1, nam: d.getFullYear() })}${cuoiNay ? t(" (đến {{ngay}})", { ngay: dm(k.den) }) : ""}`;
}

/** Số điểm của kỳ đang xem đã có (điểm cuối có thể đang chạy dở). */
export function soDiemDaCo(k) {
  if (!k.dangChay) return k.soDiem;
  const cuoi = new Date(k.den.getTime() - 1);
  if (k.nhom === "gio") return Math.min(k.soDiem, cuoi.getHours() + 1);
  if (k.nhom === "ngay") return Math.min(k.soDiem, Math.round((dauNgay(cuoi) - dauNgay(k.tu)) / NGAY) + 1);
  return Math.min(k.soDiem, (cuoi.getFullYear() - k.tu.getFullYear()) * 12 + cuoi.getMonth() - k.tu.getMonth() + 1);
}

/**
 * Số điểm của đường kỳ trước (theo bieuDoTruocTu – bieuDoTruocDen), không quá số điểm của biểu đồ. Tháng đem so ngắn hơn
 * tháng đang xem (tháng 2 so với tháng 3) thì các điểm cuối của đường kỳ trước để trống, không vẽ thành 0.
 */
export function soDiemKyTruoc(k) {
  if (!k.bieuDoTruocTu || !k.bieuDoTruocDen || k.nhom === "gio") return k.soDiem;
  const dau = k.bieuDoTruocTu;
  const cuoi = new Date(k.bieuDoTruocDen.getTime() - 1);
  const n = k.nhom === "ngay"
    ? Math.round((dauNgay(cuoi) - dauNgay(dau)) / NGAY) + 1
    : (cuoi.getFullYear() - dau.getFullYear()) * 12 + cuoi.getMonth() - dau.getMonth() + 1;
  return Math.max(0, Math.min(k.soDiem, n));
}

/** Tiêu đề biểu đồ: "Doanh thu theo giờ", "… theo ngày, 30 ngày", "… theo ngày, tháng 11", "… theo tháng, 12 tháng". */
export function tieuDeBieuDo(tenChiSo, k) {
  if (!k) return tenChiSo;
  if (k.nhom === "gio") return t("{{chiSo}} theo giờ", { chiSo: tenChiSo });
  if (k.nhom === "thang") return t("{{chiSo}} theo tháng, {{soThang}} tháng", { chiSo: tenChiSo, soThang: k.soDiem });
  if (k.ma === "thang_nay" || k.ma === "thang_truoc") return t("{{chiSo}} theo ngày, tháng {{thang}}", { chiSo: tenChiSo, thang: k.tu.getMonth() + 1 });
  return t("{{chiSo}} theo ngày, {{soNgay}} ngày", { chiSo: tenChiSo, soNgay: k.soDiem });
}

/** Lỗi của khoảng tùy chọn (null khi hợp lệ). */
export function loiTuyChon(tu, den, homNay, ngayDau) {
  if (!tu || !den) return t("Chọn đủ ngày bắt đầu và ngày kết thúc.");
  const soNgay = Math.round((dauNgay(den) - dauNgay(tu)) / NGAY) + 1;
  if (soNgay < 1) return t("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
  if (dauNgay(den) > dauNgay(homNay)) return t("Không chọn được ngày sau hôm nay.");
  if (soNgay > SO_NGAY_TUY_CHON_TOI_DA) return t("Chọn tối đa {{soNgay}} ngày (đang {{dangChon}} ngày).", { soNgay: SO_NGAY_TUY_CHON_TOI_DA, dangChon: soNgay });
  if (ngayDau && dauNgay(den) < dauNgay(ngayDau)) return t("Khoảng đã chọn trước ngày hệ thống có dữ liệu. Chọn ngày muộn hơn.");
  return null;
}

/** Ngày đầu / ngày cuối (yyyy-MM-dd, tính cả hai đầu) của kỳ đang xem, để mở báo cáo đúng khoảng. */
export function ngayCuaKy(k) {
  if (!k) return {};
  return { tuNgay: ngayMay(k.tu), denNgay: ngayMay(new Date(k.den.getTime() - 1)) };
}
