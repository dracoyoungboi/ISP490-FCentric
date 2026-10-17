// Hằng số và hàm định dạng dùng chung cho màn Tổng quan quản trị viên.

/** Màu số liệu: mỗi màu một nghĩa trên toàn màn (đã kiểm tra phân biệt được với người mù màu). */
export const MAU = {
  doanhThu: "#1677ff",
  don: "#eb6834",
  loiNhuan: "#1baf7a",
  tonKho: "#eda100",
  kiemKe: "#e87ba4",
  luoi: "#eef1f5",
  truc: "#94a3b8",
};

export const KY_OPTIONS = [
  { value: "7_ngay", label: "7 ngày" },
  { value: "30_ngay", label: "30 ngày" },
  { value: "12_thang", label: "12 tháng" },
];

export const KY_MAC_DINH = "30_ngay";

export function moTaKy(ky) {
  if (ky === "7_ngay") return "7 ngày qua";
  if (ky === "12_thang") return "12 tháng qua";
  return "30 ngày qua";
}

const nf0 = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfToiDa1 = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const nfToiDa2 = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

const so = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const formatSo = (v) => nf0.format(so(v));

export const formatTien = (v) => `${nf0.format(so(v))} ₫`;

/** Tách tiền thành phần số và đơn vị để hiển thị số lớn: 8,22 | tỷ ₫. */
export function tachTienGon(v) {
  const n = so(v);
  const a = Math.abs(n);
  if (a >= 1e9) return { so: nf2.format(n / 1e9), donVi: "tỷ ₫" };
  if (a >= 1e6) return { so: nf1.format(n / 1e6), donVi: "triệu ₫" };
  if (a >= 1e3) return { so: nf0.format(Math.round(n / 1e3)), donVi: "nghìn ₫" };
  return { so: nf0.format(n), donVi: "₫" };
}

export function formatTienGon(v) {
  const t = tachTienGon(v);
  return `${t.so} ${t.donVi}`;
}

/**
 * Tiền trên màn Tổng quan (bản Kiểu 3): dưới 1 triệu ghi đủ "495.000 ₫", từ 1 triệu "17,8 triệu ₫",
 * từ 1 tỷ "2,49 tỷ ₫". Không dùng "nghìn" để mọi số tiền đọc cùng một kiểu.
 */
export function tachTien(v) {
  const n = so(v);
  const a = Math.abs(n);
  if (a >= 1e9) return { so: nf2.format(n / 1e9), donVi: "tỷ ₫" };
  if (a >= 1e6) return { so: nf1.format(n / 1e6), donVi: "triệu ₫" };
  return { so: nf0.format(Math.round(n)), donVi: "₫" };
}

export function formatTienNgan(v) {
  const t = tachTien(v);
  return `${t.so} ${t.donVi}`;
}

/** Mức thay đổi có dấu: "+12,4%", "−3,1%", "0%"; null khi kỳ trước bằng 0 hoặc không có (không ghi % vô nghĩa). */
export function bienDong(hienTai, truoc) {
  const p = phanTramThayDoi(hienTai, truoc);
  if (p == null || !Number.isFinite(p)) return null;
  // Dưới 0,05% coi như không đổi: ghi "0%" màu chữ thường, không xanh/đỏ
  if (Math.abs(p) < 0.05) return { tang: null, chu: "0%" };
  return { tang: p > 0, chu: `${p > 0 ? "+" : "−"}${nfToiDa1.format(Math.abs(p))}%` };
}

/** Nhãn trục tiền: 4 tỷ, 1,5 tr, 250 nghìn. Giữ phần lẻ để các vạch không bị làm tròn trùng nhau. */
export function formatTrucTien(v) {
  const n = so(v);
  const a = Math.abs(n);
  if (a >= 1e9) return `${nfToiDa2.format(n / 1e9)} tỷ`;
  if (a >= 1e6) return `${nfToiDa2.format(n / 1e6)} tr`;
  if (a >= 1e3) return `${nfToiDa2.format(n / 1e3)} nghìn`;
  return nf0.format(n);
}

/** Nhãn gọn cho một điểm trên biểu đồ: 1,1 tr, 299 tr, 2,4 tỷ (dưới 10 giữ một số lẻ). */
export function formatNhanTien(v) {
  const n = so(v);
  const a = Math.abs(n);
  const gon = (x) => (Math.abs(x) < 10 ? nfToiDa1 : nf0).format(x);
  if (a >= 1e9) return `${gon(n / 1e9)} tỷ`;
  if (a >= 1e6) return `${gon(n / 1e6)} tr`;
  if (a >= 1e3) return `${nf0.format(n / 1e3)} nghìn`;
  return nf0.format(n);
}

export const formatPhanTram = (p, chuSo = 1) =>
  p == null || !Number.isFinite(p) ? "—" : `${(chuSo === 0 ? nf0 : nf1).format(p)}%`;

/** % thay đổi so với giá trị trước; null khi không có cơ sở so sánh. */
export function phanTramThayDoi(hienTai, truoc) {
  const a = so(hienTai);
  const b = so(truoc);
  if (b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
}

export const tyLe = (a, b) => (so(b) === 0 ? null : (so(a) / so(b)) * 100);

const TEN_THU = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const TEN_THU_GIUA_CAU = ["Chủ nhật", "thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm", "thứ Sáu", "thứ Bảy"];
const THU_NGAN = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const hai = (n) => String(n).padStart(2, "0");

/** "2026-10-12" hoặc "2026-10-12T15:30:00" → Date theo giờ địa phương (không đổi múi giờ). */
export function docNgay(chuoi) {
  if (!chuoi) return null;
  const [ngay, gio = "00:00:00"] = String(chuoi).split("T");
  const [y, m, d] = ngay.split("-").map(Number);
  const [h, mi, s] = gio.split(":").map(Number);
  return new Date(y, m - 1, d, h || 0, mi || 0, s || 0);
}

/** Tên thứ ở đầu câu ("Thứ Hai, 12/10/2026") và ở giữa câu ("cùng giờ thứ Hai tuần trước"). */
export const tenThu = (d) => TEN_THU[d.getDay()];
export const tenThuGiuaCau = (d) => TEN_THU_GIUA_CAU[d.getDay()];

/** Nhãn trục: ngày "12/10" (kỳ ngắn kèm thứ), tháng "T10" (điểm đầu và tháng 1 kèm năm: "T1/26"). */
export function nhanTruc(tu, nhom, soDiem, viTri = 1) {
  const d = docNgay(tu);
  if (!d) return "";
  if (nhom === "thang") {
    const kemNam = viTri === 0 || d.getMonth() === 0;
    return `T${d.getMonth() + 1}${kemNam ? `/${String(d.getFullYear()).slice(2)}` : ""}`;
  }
  return soDiem <= 8 ? `${THU_NGAN[d.getDay()]} ${hai(d.getDate())}/${hai(d.getMonth() + 1)}` : `${hai(d.getDate())}/${hai(d.getMonth() + 1)}`;
}

export function nhanDayDu(tu, nhom) {
  const d = docNgay(tu);
  if (!d) return "";
  if (nhom === "thang") return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
  return `${tenThu(d)}, ${hai(d.getDate())}/${hai(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export const ngayThang = (chuoi) => {
  const d = docNgay(chuoi);
  return d ? `${hai(d.getDate())}/${hai(d.getMonth() + 1)}` : "";
};

export const ngayDayDu = (chuoi) => {
  const d = docNgay(chuoi);
  return d ? `${hai(d.getDate())}/${hai(d.getMonth() + 1)}/${d.getFullYear()}` : "";
};

export const gioPhut = (chuoi) => {
  const d = docNgay(chuoi);
  return d ? `${hai(d.getHours())}:${hai(d.getMinutes())}` : "";
};

/** Thời gian ngắn cho dòng hoạt động: giờ:phút nếu cùng ngày, kèm ngày nếu khác ngày. */
export function thoiGianNgan(chuoi, homNay) {
  const d = docNgay(chuoi);
  const h = docNgay(homNay);
  if (!d) return "";
  const cungNgay = h && d.toDateString() === h.toDateString();
  return cungNgay ? gioPhut(chuoi) : `${ngayThang(chuoi)} ${gioPhut(chuoi)}`;
}
