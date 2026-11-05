// Phần tính của màn Báo cáo sản phẩm (không gọi API): nhóm tab, xếp cột, ma trận màu × size, lỗi khoảng ngày.
import { ngayMay } from "./tinhBaoCaoDoanhThu";

export const N = (v) => Number(v) || 0;

/** Tab nhóm sản phẩm (tham số "nhom" trên URL). */
export const NHOM = [
  { value: "tat-ca", label: "Tất cả" },
  { value: "co-ban", label: "Có bán" },
  // Sắp hết hàng gồm cả mã đang bán mà đã hết sạch (cần nhập gấp nhất)
  { value: "sap-het", label: "Sắp hết hàng", tone: "danger", loc: (p) => p.tinhTrang === "BAN_CHAY_SAP_HET" || (p.tinhTrang === "HET_HANG" && N(p.soLuong) > 0) },
  { value: "du-hang", label: "Dư hàng", tone: "warning", tinhTrang: "DU_HANG" },
  { value: "khong-ban", label: "Không bán", tinhTrang: "KHONG_BAN" },
];

/** Nhãn tình trạng (StatusBadge) theo mã máy chủ. */
export const TINH_TRANG = {
  BAN_CHAY_SAP_HET: { label: "Sắp hết hàng" },
  DU_HANG: { label: "Dư hàng" },
  KHONG_BAN: { label: "Không bán", nhom: "canChuY" },
  HET_HANG: { label: "Hết hàng" },
  BINH_THUONG: { label: "Bình thường" },
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tuNgay ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(denNgay ?? "")) return "Chọn đủ từ ngày và đến ngày.";
  if (Number(tuNgay.slice(0, 4)) < 2000 || Number(denNgay.slice(0, 4)) < 2000) return "Ngày phải từ năm 2000 trở đi.";
  if (tuNgay > denNgay) return "Từ ngày phải trước hoặc bằng đến ngày.";
  if (denNgay > ngayMay(homNay)) return "Đến ngày không được sau hôm nay.";
  const motNam = `${Number(tuNgay.slice(0, 4)) + 1}${tuNgay.slice(4)}`;
  if (denNgay >= motNam) return "Mỗi lần xem tối đa 1 năm.";
  return "";
}

export const tenTepExcel = ({ tuNgay, denNgay }) => `Bao-cao-san-pham_${tuNgay}_${denNgay}.xlsx`;
