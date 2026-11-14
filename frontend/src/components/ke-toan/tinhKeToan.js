import { t } from "../../i18n/t.js";
/**
 * Hàm thuần cho phần xuất dữ liệu kế toán (Cấu hình › Xuất kế toán, màn Xuất dữ liệu kế toán, thẻ hóa đơn nhà cung cấp).
 * Quy tắc kiểm trùng với máy chủ (CauHinhKeToanService, ThueSuatService, HoaDonDauVaoService) để hai phía báo cùng câu.
 * Ngày luôn ở dạng chuỗi yyyy-MM-dd (so sánh chuỗi là so ngày).
 */

/** Thuế suất GTGT nhận được (%). */
export const THUE_SUAT = [0, 5, 8, 10];

/**
 * Ba hình thức chuyển kho AMIS nhận (danh sách trong tệp mẫu Chuyển kho); phần tử đầu là mặc định (trùng máy chủ).
 * "Xuất kho kiêm vận chuyển nội bộ": AMIS coi là hóa đơn điện tử, bỏ trống số chứng từ khi nhập.
 */
// i18n-giu-nguyen: giá trị gửi máy chủ và so khớp (AMIS nhận đúng chữ Việt); nơi hiện ra màn hình tự bọc t()
export const HINH_THUC_CHUYEN_KHO = [
  "Xuất chuyển kho nội bộ", // i18n-giu-nguyen: giá trị gửi máy chủ
  "Xuất kho kiêm vận chuyển nội bộ", // i18n-giu-nguyen: giá trị gửi máy chủ
  "Xuất kho gửi bán đại lý", // i18n-giu-nguyen: giá trị gửi máy chủ
];

/**
 * Tài khoản mặc định theo hệ thống tài khoản TT 99/2025 của AMIS Kế toán doanh nghiệp (nhập thử 14/11/2026: 511, 521 có
 * tài khoản con nên dùng 5111, 5211; 111, 112, 156 không có con). Trùng giá trị mặc định ở CauHinhKeToanService.
 */
export const TAI_KHOAN = [
  { key: "tkTienMat", nhan: t("Tiền mặt"), goiY: "111", moTa: t("Bán tại quầy thu tiền mặt") },
  { key: "tkNganHang", nhan: t("Tiền gửi ngân hàng"), goiY: "112", moTa: t("Bán tại quầy chuyển khoản (payOS)") },
  { key: "tkPhaiThu", nhan: t("Phải thu khách hàng"), goiY: "131", moTa: t("Bán buôn, đơn Shopify, đơn tại quầy trả kết hợp (tạm)") },
  { key: "tkDoanhThu", nhan: t("Doanh thu"), goiY: "5111", moTa: t("Mọi chứng từ bán hàng") },
  { key: "tkChietKhau", nhan: t("Chiết khấu"), goiY: "5211", moTa: t("Giảm giá đơn Shopify") },
  { key: "tkThueDauRa", nhan: t("Thuế GTGT đầu ra"), goiY: "33311", moTa: t("Thuế trên chứng từ bán hàng") },
  { key: "tkKho", nhan: t("Hàng hóa (kho)"), goiY: "156", moTa: t("Mua hàng, chuyển kho, giá vốn") },
  { key: "tkGiaVon", nhan: t("Giá vốn"), goiY: "632", moTa: t("AMIS tự tính tiền vốn") },
  { key: "tkPhaiTra", nhan: t("Phải trả nhà cung cấp"), goiY: "331", moTa: t("Mua hàng chưa thanh toán") },
  { key: "tkThueDauVao", nhan: t("Thuế GTGT đầu vào"), goiY: "1331", moTa: t("Hóa đơn nhà cung cấp") },
  { key: "tkTraLai", nhan: t("Hàng bán bị trả lại"), goiY: "5212", moTa: t("Trả hàng tại quầy, đơn hoàn trả") },
  { key: "tkHangThieu", nhan: t("Hàng thiếu chờ xử lý"), goiY: "1381", moTa: t("Kiểm kê thiếu, hao hụt chuyển kho") },
  { key: "tkHangThua", nhan: t("Hàng thừa chờ xử lý"), goiY: "3381", moTa: t("Kiểm kê thừa, nhập kho khác") },
];

/** Nhóm hiển thị theo thứ tự nhập vào AMIS (trùng XuatKeToanService.tongHopTheoLoai). */
export const TEN_LOAI = {
  ton_dau_ky: t("Tồn đầu kỳ"),
  mua_hang: t("Mua hàng"),
  chuyen_kho_xuat: t("Chuyển kho (xuất đi)"),
  chuyen_kho_nhan: t("Chuyển kho (nhận về)"),
  nhap_kho_khac: t("Nhập kho khác"),
  xuat_kho_khac: t("Xuất kho khác"),
  ban_hang: t("Bán hàng"),
  tra_lai: t("Hàng bán trả lại"),
  danh_muc: t("Danh mục"),
  bien_dong_kho: t("Biến động kho"),
};

/** Tên riêng của loại chứng từ chi tiết (vấn đề, chứng từ trong lô). */
const TEN_LOAI_CHI_TIET = {
  tra_lai_quay: t("Trả hàng tại quầy"),
  tra_lai_don: t("Đơn hoàn trả"),
};

/** Nhóm hiển thị của loại chứng từ: phiếu kho khác theo chiều (mọi bảng nguồn), hàng bán trả lại (quầy + đơn hoàn). */
export function nhomHienThi(loai) {
  if (!loai) return "";
  if (loai.startsWith("nhap_khac_")) return "nhap_kho_khac";
  if (loai.startsWith("xuat_khac_")) return "xuat_kho_khac";
  if (loai.startsWith("tra_lai_")) return "tra_lai";
  return loai;
}

export const tenLoai = (loai) => TEN_LOAI_CHI_TIET[loai] ?? TEN_LOAI[nhomHienThi(loai)] ?? loai ?? "";

/** Loại có cột tiền trên bảng tổng hợp: chuyển kho và xuất kho khác để AMIS tự tính giá nên không có tiền. */
export const coTien = (loai) => !String(loai ?? "").startsWith("chuyen_kho") && loai !== "xuat_kho_khac";
/** Loại có thuế GTGT. */
export const coThue = (loai) => loai === "ban_hang" || loai === "mua_hang" || loai === "tra_lai";

/** Lô còn hiệu lực mới nhất trong danh sách (chỉ lô này được hủy); null khi không có. */
export function loCoTheHuy(dsLo = []) {
  return dsLo.filter((lo) => lo.trangThai !== "da_huy").reduce((moi, lo) => (moi == null || lo.id > moi.id ? lo : moi), null);
}

const TAI_KHOAN_REGEX = /^\d{3,20}$/;
const MA_DICH_VU_REGEX = /^[A-Za-z0-9._-]{1,50}$/;
const SO_TK_NGAN_HANG_REGEX = /^[A-Za-z0-9]{4,30}$/;
const KY_HIEU_REGEX = /^[A-Za-z0-9/-]{1,20}$/;
const SO_HOA_DON_REGEX = /^\d{1,20}$/;
const NGAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const gon = (v) => String(v ?? "").trim();

/** yyyy-MM-dd theo giờ máy (người dùng ở Việt Nam). */
export function ngayIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Ngày chốt mặc định: hôm qua (chứng từ của hôm nay còn phát sinh). */
export function homQuaIso(bayGio = new Date()) {
  const d = new Date(bayGio.getFullYear(), bayGio.getMonth(), bayGio.getDate() - 1);
  return ngayIso(d);
}

/** dd/MM/yyyy từ yyyy-MM-dd. */
export function hienNgay(iso) {
  if (!iso || !NGAY_REGEX.test(iso)) return iso ?? "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function dinhDangKichThuoc(byte) {
  const so = Number(byte) || 0;
  if (so < 1024) return `${so} B`;
  if (so < 1024 * 1024) return `${(so / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(so / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

// ── Cấu hình kế toán ──────────────────────────────────────────────────────

export function formCauHinh(dto) {
  const form = {
    ngayMoc: dto?.ngayMoc ?? "",
    maDichVuVanChuyen: dto?.maDichVuVanChuyen ?? "PVC",
    tenDichVuVanChuyen: dto?.tenDichVuVanChuyen ?? "Phí vận chuyển", // i18n-giu-nguyen: giá trị mặc định gửi máy chủ
    hinhThucChuyenKho: dto?.hinhThucChuyenKho ?? HINH_THUC_CHUYEN_KHO[0],
    soTkNganHangNhan: dto?.soTkNganHangNhan ?? "",
  };
  for (const tk of TAI_KHOAN) form[tk.key] = dto?.[tk.key] ?? tk.goiY;
  return form;
}

/** Lỗi theo từng ô ({} = hợp lệ). */
export function kiemTraCauHinh(form) {
  const loi = {};
  if (form.ngayMoc && (!NGAY_REGEX.test(form.ngayMoc) || form.ngayMoc < "2020-01-01")) {
    loi.ngayMoc = t("Ngày mốc phải từ 01/01/2020 trở đi");
  }
  for (const tk of TAI_KHOAN) {
    if (!TAI_KHOAN_REGEX.test(gon(form[tk.key]))) loi[tk.key] = t("Chỉ gồm chữ số (3–20 số), vd. 33311");
  }
  if (!MA_DICH_VU_REGEX.test(gon(form.maDichVuVanChuyen))) {
    loi.maDichVuVanChuyen = t("Chữ không dấu, số và . _ - (tối đa 50 ký tự)");
  }
  const ten = gon(form.tenDichVuVanChuyen);
  if (!ten || ten.length > 100) loi.tenDichVuVanChuyen = t("Nhập tên (tối đa 100 ký tự)");
  if (!HINH_THUC_CHUYEN_KHO.includes(form.hinhThucChuyenKho)) loi.hinhThucChuyenKho = t("Chọn hình thức chuyển kho");
  const soTk = gon(form.soTkNganHangNhan);
  if (soTk && !SO_TK_NGAN_HANG_REGEX.test(soTk)) loi.soTkNganHangNhan = t("Chỉ gồm chữ và số (4–30 ký tự)");
  return loi;
}

export function payloadCauHinh(form, version) {
  const payload = {
    ngayMoc: form.ngayMoc || null,
    maDichVuVanChuyen: gon(form.maDichVuVanChuyen),
    tenDichVuVanChuyen: gon(form.tenDichVuVanChuyen),
    hinhThucChuyenKho: form.hinhThucChuyenKho,
    soTkNganHangNhan: gon(form.soTkNganHangNhan) || null,
    version: version ?? null,
  };
  for (const tk of TAI_KHOAN) payload[tk.key] = gon(form[tk.key]);
  return payload;
}

// ── Thuế suất ─────────────────────────────────────────────────────────────

/** Hai khoảng ngày (den rỗng = chưa hết hiệu lực) có chung ít nhất một ngày (bảng thuế suất: pages/settings/vatLich.js). */
export function chongNhau(tu1, den1, tu2, den2) {
  const cuoi1 = den1 || "9999-12-31";
  const cuoi2 = den2 || "9999-12-31";
  return tu1 <= cuoi2 && tu2 <= cuoi1;
}

const theoTen = (a, b) => (a.tenDanhMuc ?? "").localeCompare(b.tenDanhMuc ?? "", "vi");

/**
 * Danh mục phẳng theo thứ tự cây (con thụt vào dưới cha) cho ô chọn phạm vi thuế suất. API /all trả mọi danh mục, mỗi
 * danh mục kèm cây con (danhMucCons): gốc là danh mục không nằm trong cây con của danh mục nào; mỗi id lấy một lần.
 * Bỏ danh mục đã ngừng (trangThai 0) trừ id trong giuIds (đang có dòng thuế suất dùng); con của nó vẫn hiện.
 */
export function phangDanhMuc(ds, giuIds = []) {
  const tatCa = ds ?? [];
  const giu = new Set(giuIds);
  const laCon = new Set();
  const ghiCon = (dm) => (dm.danhMucCons ?? []).forEach((con) => { laCon.add(con.id); ghiCon(con); });
  tatCa.forEach(ghiCon);
  const ketQua = [];
  const daCo = new Set();
  const di = (dm, muc) => {
    if (daCo.has(dm.id)) return;
    daCo.add(dm.id);
    const hien = dm.trangThai !== 0 || giu.has(dm.id);
    if (hien) ketQua.push({ id: dm.id, ten: `${"— ".repeat(muc)}${dm.tenDanhMuc ?? ""}`, ma: dm.maDanhMuc });
    [...(dm.danhMucCons ?? [])].sort(theoTen).forEach((con) => di(con, hien ? muc + 1 : muc));
  };
  tatCa.filter((dm) => !laCon.has(dm.id)).sort(theoTen).forEach((dm) => di(dm, 0));
  return ketQua;
}

// ── Hóa đơn nhà cung cấp ──────────────────────────────────────────────────

export function formHoaDon(dto) {
  return {
    coHoaDon: dto?.daNhap ? (dto.coHoaDon ? "co" : "khong") : "co",
    mauSo: dto?.mauSo ?? "1",
    kyHieu: dto?.kyHieu ?? "",
    soHoaDon: dto?.soHoaDon ?? "",
    ngayHoaDon: dto?.ngayHoaDon ?? "",
    thueSuat: dto?.thueSuat != null ? String(Number(dto.thueSuat)) : "8",
  };
}

/** Lỗi theo từng ô ({} = hợp lệ). homNay: yyyy-MM-dd. */
export function kiemTraHoaDon(form, homNay) {
  const loi = {};
  if (form.coHoaDon !== "co") return loi;
  const mauSo = gon(form.mauSo);
  if (mauSo && !KY_HIEU_REGEX.test(mauSo)) loi.mauSo = t("Chữ, số, / và - (tối đa 20 ký tự)");
  if (!KY_HIEU_REGEX.test(gon(form.kyHieu))) loi.kyHieu = t("Nhập ký hiệu, vd. C26TAA");
  if (!SO_HOA_DON_REGEX.test(gon(form.soHoaDon))) loi.soHoaDon = t("Nhập số hóa đơn (chỉ chữ số)");
  if (!form.ngayHoaDon || !NGAY_REGEX.test(form.ngayHoaDon)) loi.ngayHoaDon = t("Chọn ngày hóa đơn");
  else if (form.ngayHoaDon > homNay || form.ngayHoaDon < "2020-01-01") loi.ngayHoaDon = t("Ngày hóa đơn không hợp lệ");
  if (!THUE_SUAT.includes(Number(form.thueSuat))) loi.thueSuat = t("Chọn thuế suất");
  return loi;
}

export function payloadHoaDon(form) {
  if (form.coHoaDon !== "co") return { coHoaDon: false };
  return {
    coHoaDon: true,
    mauSo: gon(form.mauSo) || null,
    kyHieu: gon(form.kyHieu).toUpperCase(),
    soHoaDon: gon(form.soHoaDon),
    ngayHoaDon: form.ngayHoaDon,
    thueSuat: Number(form.thueSuat),
  };
}

// ── Màn xuất ──────────────────────────────────────────────────────────────

/** Tổng của các dòng tổng hợp (để hiện dòng cộng). */
export function congTongHop(tongHop = []) {
  return tongHop.reduce(
    (tt, d) => ({
      soChungTu: tt.soChungTu + (d.soChungTu || 0),
      soDong: tt.soDong + (d.soDong || 0),
    }),
    { soChungTu: 0, soDong: 0 },
  );
}

/**
 * Nhóm chứng từ của một lô theo nhóm hiển thị, giữ thứ tự nhập vào AMIS (nhóm lạ xuống cuối); trong nhóm sắp theo ngày
 * hạch toán rồi số chứng từ (một nhóm gộp nhiều loại chi tiết, vd. trả hàng tại quầy và đơn hoàn trả).
 */
export function nhomTheoLoai(chungTu = []) {
  const thuTu = Object.keys(TEN_LOAI);
  const viTri = (loai) => (thuTu.includes(loai) ? thuTu.indexOf(loai) : thuTu.length);
  const theoNgay = (a, b) =>
    String(a.ngayHachToan ?? "").localeCompare(String(b.ngayHachToan ?? "")) ||
    String(a.soChungTu ?? "").localeCompare(String(b.soChungTu ?? ""));
  const nhom = new Map();
  for (const ct of chungTu) {
    const khoa = nhomHienThi(ct.loai);
    if (!nhom.has(khoa)) nhom.set(khoa, []);
    nhom.get(khoa).push(ct);
  }
  return [...nhom.entries()]
    .sort((a, b) => viTri(a[0]) - viTri(b[0]))
    .map(([loai, ds]) => ({ loai, ten: tenLoai(loai), chungTu: [...ds].sort(theoNgay) }));
}
