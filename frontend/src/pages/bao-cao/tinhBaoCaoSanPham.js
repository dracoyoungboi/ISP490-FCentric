// Phần tính của màn Báo cáo sản phẩm (không gọi API): nhóm tab, xếp cột, ma trận màu × size, lỗi khoảng ngày.
import { khoangMoc, ngayMay } from "./tinhBaoCaoDoanhThu";
import { t } from "../../i18n/t.js";

export const N = (v) => Number(v) || 0;

/** Tab nhóm sản phẩm (tham số "nhom" trên URL). */
export const NHOM = [
  { value: "tat-ca", label: t("Tất cả") },
  { value: "co-ban", label: t("Có bán") },
  // Sắp hết hàng gồm cả mã đang bán mà đã hết sạch (cần nhập gấp nhất)
  { value: "sap-het", label: t("Sắp hết hàng"), tone: "danger", loc: (p) => p.tinhTrang === "BAN_CHAY_SAP_HET" || (p.tinhTrang === "HET_HANG" && N(p.soLuong) > 0) },
  { value: "du-hang", label: t("Dư hàng"), tone: "warning", tinhTrang: "DU_HANG" },
  { value: "khong-ban", label: t("Không bán"), tinhTrang: "KHONG_BAN" },
];

/** Nhãn tình trạng (StatusBadge) theo mã máy chủ. */
// i18n-giu-nguyen: nhãn đưa vào StatusBadge (badge tự dịch lúc vẽ, tra màu theo tên Việt)
export const TINH_TRANG = {
  BAN_CHAY_SAP_HET: { label: "Sắp hết hàng" }, // i18n-giu-nguyen: nhãn StatusBadge
  DU_HANG: { label: "Dư hàng" }, // i18n-giu-nguyen: nhãn StatusBadge
  KHONG_BAN: { label: "Không bán", nhom: "canChuY" }, // i18n-giu-nguyen: nhãn StatusBadge
  HET_HANG: { label: "Hết hàng" }, // i18n-giu-nguyen: nhãn StatusBadge
  BINH_THUONG: { label: "Bình thường" }, // i18n-giu-nguyen: nhãn StatusBadge
};

export function locNhom(ds, nhom) {
  if (nhom === "co-ban") return ds.filter((p) => N(p.soLuong) > 0);
  const n = NHOM.find((x) => x.value === nhom);
  if (n?.loc) return ds.filter(n.loc);
  if (n?.tinhTrang) return ds.filter((p) => p.tinhTrang === n.tinhTrang);
  return ds;
}

export function demNhom(ds) {
  return Object.fromEntries(NHOM.map((n) => [n.value, locNhom(ds, n.value).length]));
}

/** Tìm theo tên, mã sản phẩm, mã SKU (không phân biệt hoa thường, bỏ dấu). */
const boDau = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
export function timKiem(ds, tuKhoa) {
  const k = boDau(tuKhoa).trim();
  if (!k) return ds;
  return ds.filter((p) => boDau(`${p.tenSanPham} ${p.maSanPham}`).includes(k) || (p.bienThe ?? []).some((b) => boDau(b.maSku).includes(k)));
}

/**
 * Xếp theo cột: sl (số lượng), dt (doanh thu), ln (lợi nhuận gộp). Giảm dần; bằng nhau thì doanh thu, rồi mã.
 * Sản phẩm không bán xếp sau, giá trị tồn lớn trước (như máy chủ).
 */
export function xep(ds, theo = "sl") {
  const k = { sl: "soLuong", dt: "doanhThu", ln: "loiNhuan" }[theo] ?? "soLuong";
  return [...ds].sort((a, b) => {
    const coA = N(a.soLuong) > 0, coB = N(b.soLuong) > 0;
    if (coA !== coB) return coA ? -1 : 1;
    if (!coA) return N(b.giaTriTon) - N(a.giaTriTon) || String(a.maSanPham).localeCompare(String(b.maSanPham));
    return N(b[k]) - N(a[k]) || N(b.doanhThu) - N(a.doanhThu) || String(a.maSanPham).localeCompare(String(b.maSanPham));
  });
}

/** Tăng / giảm so với kỳ trước (0,128 = 12,8%); kỳ trước 0 thì null. */
export const tyLeTang = (nay, truoc) => (N(truoc) ? (N(nay) - N(truoc)) / Math.abs(N(truoc)) : null);

/** Ma trận màu × size: hàng = màu, cột = size (theo thứ tự size), ô = biến thể hoặc null. */
export function maTran(bienThe = []) {
  const mau = [];
  const size = new Map();
  bienThe.forEach((b) => {
    const tenMau = b.mau || "—", tenSize = b.size || "—";
    if (!mau.some((m) => m.ten === tenMau)) mau.push({ ten: tenMau, hex: b.maMauHex });
    // Size chưa có thứ tự xếp cuối
    if (!size.has(tenSize)) size.set(tenSize, b.thuTuSize ?? Number.MAX_SAFE_INTEGER);
  });
  const dsSize = [...size.entries()].sort((a, b) => a[1] - b[1]).map(([s]) => s);
  const o = (m, s) => bienThe.find((b) => (b.mau || "—") === m && (b.size || "—") === s) ?? null;
  return { mau, size: dsSize, o, max: Math.max(1, ...bienThe.map((b) => N(b.soLuong))) };
}

/** Lỗi khoảng ngày tùy chọn (chuỗi rỗng = hợp lệ): đủ hai ngày, từ năm 2000, không sau hôm nay, tối đa 1 năm. */
export function loiKhoang(tuNgay, denNgay, homNay = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tuNgay ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(denNgay ?? "")) return t("Chọn đủ từ ngày và đến ngày.");
  if (Number(tuNgay.slice(0, 4)) < 2000 || Number(denNgay.slice(0, 4)) < 2000) return t("Ngày phải từ năm 2000 trở đi.");
  if (tuNgay > denNgay) return t("Từ ngày phải trước hoặc bằng đến ngày.");
  if (denNgay > ngayMay(homNay)) return t("Đến ngày không được sau hôm nay.");
  // Mốc 1 năm như LocalDate.plusYears của máy chủ: 29/02 sang năm không nhuận thành 28/02
  const [y, m, d] = tuNgay.split("-").map(Number);
  const motNam = new Date(y + 1, m - 1, d);
  if (motNam.getMonth() !== m - 1) motNam.setDate(0);
  if (denNgay >= ngayMay(motNam)) return t("Mỗi lần xem tối đa 1 năm.");
  return "";
}

export const tenTepExcel = ({ tuNgay, denNgay }) => `Bao-cao-san-pham_${tuNgay}_${denNgay}.xlsx`;

/**
 * Lên / xuống hạng so với kỳ trước (hạng theo số lượng bán, máy chủ tính). Trả null khi không có gì để hiện:
 * sản phẩm không bán trong kỳ, hoặc kỳ trước cả cửa hàng chưa bán gì (mọi mã đều "mới vào" thì không có ý nghĩa).
 */
export function doiHang(hang, hangTruoc, coBanKyTruoc = true) {
  if (!hang) return null;
  if (!hangTruoc) return coBanKyTruoc ? { loai: "moi" } : null;
  if (hangTruoc > hang) return { loai: "len", so: hangTruoc - hang };
  if (hangTruoc < hang) return { loai: "xuong", so: hang - hangTruoc };
  return { loai: "giu" };
}

/* ---------- Bộ lọc trên đường dẫn: ?ky=7 | ?tu=yyyy-MM-dd&den=yyyy-MM-dd, &kho=<id>, &kenh=POS|TRUC_TIEP|<id> ---------- */

/** Mốc nhanh ghi được lên đường dẫn (30 ngày qua là mặc định nên không ghi; tùy chọn thì ghi tu/den). */
const MOC_TREN_URL = ["7", "thang-nay", "thang-truoc"];
const MOC_MAC_DINH = "30";
const SO_ID = /^[1-9]\d{0,8}$/;
const KENH_HOP_LE = /^(POS|TRUC_TIEP|[1-9]\d{0,8})$/;

/** Chuỗi yyyy-MM-dd là một ngày có thật (loại 2026-02-30, 2026-13-01). */
export function laNgayThat(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s ?? "")) return false;
  const [y, m, d] = s.split("-").map(Number);
  return ngayMay(new Date(y, m - 1, d)) === s;
}

/**
 * Bộ lọc mở sẵn từ đường dẫn (vd. "Xem tất cả" ở Tổng quan). Giá trị lạ thì bỏ qua: kỳ về 30 ngày qua, kho / kênh về tất cả.
 * Kho và kênh ở đây mới kiểm dạng; kho ngoài phạm vi được xem, kênh không còn trong danh sách do trang tự bỏ sau khi tải.
 */
export function boLocTuUrl(params, homNay = new Date()) {
  const lay = (k) => params?.get?.(k) ?? null;
  const tu = lay("tu"), den = lay("den"), ky = lay("ky");
  let moc = MOC_MAC_DINH;
  let khoang = khoangMoc(MOC_MAC_DINH, homNay);
  if (tu != null || den != null) {
    if (laNgayThat(tu) && laNgayThat(den) && !loiKhoang(tu, den, homNay)) {
      moc = "tuy-chon";
      khoang = { tuNgay: tu, denNgay: den };
    }
  } else if (MOC_TREN_URL.includes(ky)) {
    moc = ky;
    khoang = khoangMoc(ky, homNay);
  }
  const kho = lay("kho"), kenh = lay("kenh");
  return { moc, khoang, khoId: SO_ID.test(kho ?? "") ? kho : "", kenh: KENH_HOP_LE.test(kenh ?? "") ? kenh : "" };
}

/** Phần bộ lọc (kỳ, kho, kênh) của đường dẫn, theo thứ tự cố định, để biết đường dẫn có đổi bộ lọc không (bỏ qua tab). */
export function chuoiBoLocUrl(params) {
  return ["ky", "tu", "den", "kho", "kenh"].map((k) => `${k}=${params?.get?.(k) ?? ""}`).join("&");
}

/** Đường dẫn mới khi bộ lọc đổi: giữ các tham số khác (vd. tab "nhom"), mặc định thì không ghi. */
export function ghiBoLocLenUrl(params, { moc, khoang, khoId, kenh }) {
  const next = new URLSearchParams(params);
  ["ky", "tu", "den", "kho", "kenh"].forEach((k) => next.delete(k));
  if (moc === "tuy-chon") {
    next.set("tu", khoang.tuNgay);
    next.set("den", khoang.denNgay);
  } else if (MOC_TREN_URL.includes(moc)) {
    next.set("ky", moc);
  }
  if (khoId) next.set("kho", String(khoId));
  if (kenh) next.set("kenh", String(kenh));
  return next;
}

/**
 * Đường dẫn tới Báo cáo sản phẩm kèm bộ lọc (thẻ Bán chạy ở các trang Tổng quan): nhom (tab), tuNgay + denNgay (khoảng
 * ngày cố định) hoặc ky (mốc nhanh), khoId.
 */
export function duongDanBaoCaoSanPham({ nhom, tuNgay, denNgay, ky, khoId } = {}) {
  const p = new URLSearchParams();
  if (nhom && nhom !== "tat-ca") p.set("nhom", nhom);
  if (tuNgay && denNgay) {
    p.set("tu", tuNgay);
    p.set("den", denNgay);
  } else if (MOC_TREN_URL.includes(ky)) {
    p.set("ky", ky);
  }
  if (khoId != null && khoId !== "") p.set("kho", String(khoId));
  const q = p.toString();
  return q ? `/reports/products?${q}` : "/reports/products";
}
