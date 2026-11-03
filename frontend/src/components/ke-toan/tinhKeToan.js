/**
 * Hàm thuần cho phần xuất dữ liệu kế toán (Cấu hình › Xuất kế toán, màn Xuất dữ liệu kế toán, thẻ hóa đơn nhà cung cấp).
 * Quy tắc kiểm trùng với máy chủ (CauHinhKeToanService, ThueSuatService, HoaDonDauVaoService) để hai phía báo cùng câu.
 * Ngày luôn ở dạng chuỗi yyyy-MM-dd (so sánh chuỗi là so ngày).
 */

/** Thuế suất GTGT nhận được (%). */
export const THUE_SUAT = [0, 5, 8, 10];

/** Ba hình thức chuyển kho AMIS nhận (danh sách trong tệp mẫu Chuyển kho). */
export const HINH_THUC_CHUYEN_KHO = [
  "Xuất kho kiêm vận chuyển nội bộ",
  "Xuất kho gửi bán đại lý",
  "Xuất chuyển kho nội bộ",
];

/** Tài khoản mặc định theo hệ thống tài khoản TT 99/2025 của AMIS Kế toán doanh nghiệp. */
export const TAI_KHOAN = [
  { key: "tkTienMat", nhan: "Tiền mặt", goiY: "111", moTa: "Bán tại quầy thu tiền mặt" },
  { key: "tkNganHang", nhan: "Tiền gửi ngân hàng", goiY: "112", moTa: "Bán tại quầy chuyển khoản (payOS)" },
  { key: "tkPhaiThu", nhan: "Phải thu khách hàng", goiY: "131", moTa: "Bán buôn, đơn Shopify, đơn tại quầy trả kết hợp (tạm)" },
  { key: "tkDoanhThu", nhan: "Doanh thu", goiY: "511", moTa: "Mọi chứng từ bán hàng" },
  { key: "tkChietKhau", nhan: "Chiết khấu", goiY: "521", moTa: "Giảm giá đơn Shopify" },
  { key: "tkThueDauRa", nhan: "Thuế GTGT đầu ra", goiY: "33311", moTa: "Thuế trên chứng từ bán hàng" },
  { key: "tkKho", nhan: "Hàng hóa (kho)", goiY: "156", moTa: "Mua hàng, chuyển kho, giá vốn" },
  { key: "tkGiaVon", nhan: "Giá vốn", goiY: "632", moTa: "AMIS tự tính tiền vốn" },
  { key: "tkPhaiTra", nhan: "Phải trả nhà cung cấp", goiY: "331", moTa: "Mua hàng chưa thanh toán" },
  { key: "tkThueDauVao", nhan: "Thuế GTGT đầu vào", goiY: "1331", moTa: "Hóa đơn nhà cung cấp" },
];

export const TEN_LOAI = {
  ton_dau_ky: "Tồn đầu kỳ",
  mua_hang: "Mua hàng",
  chuyen_kho_xuat: "Chuyển kho (xuất đi)",
  chuyen_kho_nhan: "Chuyển kho (nhận về)",
  ban_hang: "Bán hàng",
  danh_muc: "Danh mục",
  bien_dong_kho: "Biến động kho",
};

export const tenLoai = (loai) => TEN_LOAI[loai] ?? loai ?? "";

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
    tenDichVuVanChuyen: dto?.tenDichVuVanChuyen ?? "Phí vận chuyển",
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
    loi.ngayMoc = "Ngày mốc phải từ 01/01/2020 trở đi";
  }
  for (const tk of TAI_KHOAN) {
    if (!TAI_KHOAN_REGEX.test(gon(form[tk.key]))) loi[tk.key] = "Chỉ gồm chữ số (3–20 số), vd. 33311";
  }
  if (!MA_DICH_VU_REGEX.test(gon(form.maDichVuVanChuyen))) {
    loi.maDichVuVanChuyen = "Chữ không dấu, số và . _ - (tối đa 50 ký tự)";
  }
  const ten = gon(form.tenDichVuVanChuyen);
  if (!ten || ten.length > 100) loi.tenDichVuVanChuyen = "Nhập tên (tối đa 100 ký tự)";
  if (!HINH_THUC_CHUYEN_KHO.includes(form.hinhThucChuyenKho)) loi.hinhThucChuyenKho = "Chọn hình thức chuyển kho";
  const soTk = gon(form.soTkNganHangNhan);
  if (soTk && !SO_TK_NGAN_HANG_REGEX.test(soTk)) loi.soTkNganHangNhan = "Chỉ gồm chữ và số (4–30 ký tự)";
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

/** Hai khoảng ngày (den rỗng = chưa hết hiệu lực) có chung ít nhất một ngày. */
export function chongNhau(tu1, den1, tu2, den2) {
  const cuoi1 = den1 || "9999-12-31";
  const cuoi2 = den2 || "9999-12-31";
  return tu1 <= cuoi2 && tu2 <= cuoi1;
}

/** Câu lỗi của form thuế suất ("" = hợp lệ). danhSach: các dòng đang có; idDangSua: dòng đang sửa (bỏ qua khi so). */
export function kiemTraThueSuat(form, danhSach = [], idDangSua = null) {
  if (!THUE_SUAT.includes(Number(form.tyLe)) || form.tyLe === "" || form.tyLe == null) {
    return "Thuế suất chỉ nhận 0%, 5%, 8% hoặc 10%";
  }
  if (!form.hieuLucTu || !NGAY_REGEX.test(form.hieuLucTu)) return "Chọn ngày bắt đầu áp dụng";
  if (form.hieuLucDen && form.hieuLucDen < form.hieuLucTu) return "Ngày kết thúc phải từ ngày bắt đầu trở đi";
  const danhMucId = form.danhMucId ? Number(form.danhMucId) : null;
  const trung = danhSach.find(
    (t) =>
      t.id !== idDangSua &&
      (t.danhMucId ?? null) === danhMucId &&
      chongNhau(form.hieuLucTu, form.hieuLucDen || null, t.hieuLucTu, t.hieuLucDen || null),
  );
  if (trung) {
    return `Khoảng ngày chồng lên dòng ${Number(trung.tyLe)}% từ ${hienNgay(trung.hieuLucTu)}. Đặt ngày kết thúc cho dòng cũ trước.`;
  }
  return "";
}

export function payloadThueSuat(form) {
  return {
    tyLe: Number(form.tyLe),
    hieuLucTu: form.hieuLucTu,
    hieuLucDen: form.hieuLucDen || null,
    danhMucId: form.danhMucId ? Number(form.danhMucId) : null,
    ghiChu: gon(form.ghiChu) || null,
  };
}

/** Dòng thuế suất đang áp dụng hôm nay. */
export const dangApDung = (t, homNay) => t.hieuLucTu <= homNay && (!t.hieuLucDen || t.hieuLucDen >= homNay);

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
  if (mauSo && !KY_HIEU_REGEX.test(mauSo)) loi.mauSo = "Chữ, số, / và - (tối đa 20 ký tự)";
  if (!KY_HIEU_REGEX.test(gon(form.kyHieu))) loi.kyHieu = "Nhập ký hiệu, vd. C26TAA";
  if (!SO_HOA_DON_REGEX.test(gon(form.soHoaDon))) loi.soHoaDon = "Nhập số hóa đơn (chỉ chữ số)";
  if (!form.ngayHoaDon || !NGAY_REGEX.test(form.ngayHoaDon)) loi.ngayHoaDon = "Chọn ngày hóa đơn";
  else if (form.ngayHoaDon > homNay || form.ngayHoaDon < "2020-01-01") loi.ngayHoaDon = "Ngày hóa đơn không hợp lệ";
  if (!THUE_SUAT.includes(Number(form.thueSuat))) loi.thueSuat = "Chọn thuế suất";
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
    (t, d) => ({
      soChungTu: t.soChungTu + (d.soChungTu || 0),
      soDong: t.soDong + (d.soDong || 0),
    }),
    { soChungTu: 0, soDong: 0 },
  );
}

/** Nhóm chứng từ của một lô theo loại, giữ thứ tự nhập vào AMIS. */
export function nhomTheoLoai(chungTu = []) {
  const thuTu = Object.keys(TEN_LOAI);
  const nhom = new Map();
  for (const ct of chungTu) {
    if (!nhom.has(ct.loai)) nhom.set(ct.loai, []);
    nhom.get(ct.loai).push(ct);
  }
  return [...nhom.entries()]
    .sort((a, b) => thuTu.indexOf(a[0]) - thuTu.indexOf(b[0]))
    .map(([loai, ds]) => ({ loai, ten: tenLoai(loai), chungTu: ds }));
}
