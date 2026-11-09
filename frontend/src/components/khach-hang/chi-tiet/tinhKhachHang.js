// Tính toán của màn Chi tiết khách hàng (bản một khối, chốt 18/10/2026). Không có JSX để chạy kiểm thử bằng node --test,
// nên import bằng đường dẫn tương đối (không dùng "@/").
import { formatCurrency, formatDate } from "../../../utils/formatters.js";
import { getChannelName } from "../../../constants/channel.js";
import { t } from "../../../i18n/t.js";

/** Trạng thái khách hàng (cột khach_hang.trang_thai). */
export const TRANG_THAI_KHACH = { HOAT_DONG: 1, NGUNG_HOAT_DONG: 0 };

export const LOAI_KHACH = {
  le: t("Khách lẻ"),
  si: t("Khách sỉ"),
  doanh_nghiep: t("Doanh nghiệp"),
};

/** Tên loại khách; chưa phân loại (hoặc giá trị lạ) thì null. */
export function nhanLoaiKhach(loai) {
  return LOAI_KHACH[loai] ?? null;
}

export function laHoatDong(khachHang) {
  return Number(khachHang?.trangThai) === TRANG_THAI_KHACH.HOAT_DONG;
}

/** Doanh nghiệp ghi địa chỉ trụ sở, khách lẻ / sỉ ghi địa chỉ giao hàng. */
export function nhanDiaChi(loai) {
  return loai === "doanh_nghiep" ? t("Địa chỉ trụ sở") : t("Địa chỉ giao hàng");
}

/** Giá trị lọc kênh của đơn không gắn kênh (đơn bán thường tạo trên hệ thống). */
export const KENH_BAN_THUONG = "ban-thuong";

export const LUA_CHON_THOI_GIAN = [
  { value: "", label: t("Mọi thời gian") },
  { value: "30", label: t("30 ngày qua") },
  { value: "90", label: t("90 ngày qua") },
  { value: "365", label: t("12 tháng qua") },
];

const hai = (n) => String(n).padStart(2, "0");

/** Ngày bắt đầu của "N ngày qua" theo giờ máy, dạng "YYYY-MM-DD" (máy chủ hiểu là đầu ngày giờ Việt Nam). */
export function ngayBatDau(soNgay, homNay = new Date()) {
  const d = new Date(homNay.getFullYear(), homNay.getMonth(), homNay.getDate() - Number(soNgay));
  return `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`;
}

/** Lựa chọn lọc kênh lấy từ các kênh khách đã mua qua (`tongQuan.kenhMua`), nhiều đơn nhất ở trước. */
export function luaChonKenh(kenhMua) {
  return [
    { value: "", label: t("Tất cả kênh") },
    ...(kenhMua ?? []).map((k) =>
      k.id == null
        ? { value: KENH_BAN_THUONG, label: t("Bán thường") }
        : { value: String(k.id), label: k.tenKenh || getChannelName(k.maKenh) },
    ),
  ];
}

/** Tên các kênh khách đã mua qua, nhiều đơn nhất ở trước; chưa mua thì "—". */
export function moTaKenhMua(kenhMua) {
  const ten = (kenhMua ?? []).map((k) => (k.id == null ? t("Bán thường") : k.tenKenh || getChannelName(k.maKenh)));
  return ten.length ? ten.join(", ") : "—";
}

/** Mới nhất ở trên; trùng ngày đặt thì đơn tạo sau ở trên. */
export const SAP_XEP_MOI_NHAT = [
  { fieldName: "ngayDatHang", direction: "DESC" },
  { fieldName: "id", direction: "DESC" },
];

/**
 * Điều kiện lọc đơn bán của khách cho POST /don-ban-hang/filter. Phạm vi theo vai trò do máy chủ tự thêm.
 * Từ khóa tìm theo mã đơn hoặc mã đơn bên sàn (hai điều kiện OR, các điều kiện còn lại AND).
 */
export function dieuKienDon({ khachHangId, tuKhoa = "", kenh = "", thoiGian = "", homNay = new Date() }) {
  const dk = [
    { fieldName: "khachHang.id", operation: "EQUALS", value: Number(khachHangId) },
    { fieldName: "loaiChungTu", operation: "EQUALS", value: "don_ban_hang" },
  ];
  const tim = tuKhoa.trim();
  if (tim) {
    dk.push({ fieldName: "soDonHang", operation: "LIKE", value: tim, logicType: "OR" });
    dk.push({ fieldName: "maDonHangKenh", operation: "LIKE", value: tim, logicType: "OR" });
  }
  if (kenh === KENH_BAN_THUONG) {
    dk.push({ fieldName: "kenhBanHang", operation: "IS_NULL" });
  } else if (kenh) {
    dk.push({ fieldName: "kenhBanHang.id", operation: "EQUALS", value: Number(kenh) });
  }
  if (thoiGian) {
    dk.push({ fieldName: "ngayDatHang", operation: "GREATER_THAN_OR_EQUAL", value: ngayBatDau(thoiGian, homNay) });
  }
  return dk;
}

export function dieuKienBaoGia(khachHangId) {
  return [
    { fieldName: "khachHang.id", operation: "EQUALS", value: Number(khachHangId) },
    { fieldName: "loaiChungTu", operation: "EQUALS", value: "bao_gia" },
  ];
}

/** "hôm nay" / "hôm qua" / "N ngày trước", tính theo ngày lịch của máy. */
export function cachDay(thoiDiem, homNay = new Date()) {
  const d = thoiDiem ? new Date(thoiDiem) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const dauNgay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const soNgay = Math.round((dauNgay(homNay) - dauNgay(d)) / 86400000);
  if (soNgay <= 0) return t("hôm nay");
  if (soNgay === 1) return t("hôm qua");
  return t("{{count}} ngày trước", { count: soNgay });
}

/** Tổng số đơn bán của khách trong phạm vi người xem (kể cả nháp) — số trên tab Đơn hàng. */
export function tongSoDon(tongQuan) {
  if (!tongQuan) return 0;
  return (Number(tongQuan.soDonDat) || 0) + (Number(tongQuan.soDonNhap) || 0);
}

/**
 * Năm ô "Tình hình mua hàng" từ GET /khach-hang/{id}/tong-quan-mua-hang.
 * Mỗi ô: { ma, nhan, giaTri, coGiaTri, phu, donGanNhat? }. Đơn nháp không tính là đã đặt;
 * đơn đã hủy / bị hoàn trả vẫn là đơn đã đặt nhưng không tính vào chi tiêu.
 * Còn phải thu: phần chưa thu đủ của đơn bán thường theo phiếu thu (đơn sàn thanh toán theo sàn, đơn tại quầy đã thu đủ,
 * đơn cũ chưa theo dõi không tính), kèm số cần hoàn lại khách nếu có; máy chủ cũ không trả thì ô trống.
 */
export function tinhKpi(tongQuan, homNay = new Date()) {
  const soDonDat = Number(tongQuan?.soDonDat) || 0;
  const soDonTinh = Number(tongQuan?.soDonTinhChiTieu) || 0;
  const soDonNhap = Number(tongQuan?.soDonNhap) || 0;
  const coDon = soDonDat > 0;
  const trong = soDonNhap > 0 ? t("{{count}} đơn nháp chưa tính", { count: soDonNhap }) : t("Chưa có đơn hàng");

  const phuSoDon = [
    tongQuan?.soDonHuy ? t("{{count}} đã hủy", { count: tongQuan.soDonHuy }) : "",
    tongQuan?.soDonHoanTra ? t("{{count}} bị hoàn trả", { count: tongQuan.soDonHoanTra }) : "",
    soDonNhap ? t("{{count}} nháp chưa tính", { count: soDonNhap }) : "",
  ].filter(Boolean).join(" · ") || t("Không có đơn hủy hay hoàn trả");

  const gan = tongQuan?.donGanNhat ?? null;
  const coTrungBinh = coDon && soDonTinh > 0 && tongQuan?.trungBinhMoiDon != null;
  const coCongNo = coDon && tongQuan?.conPhaiThu != null;
  const soDonNo = Number(tongQuan?.soDonConPhaiThu) || 0;
  const canHoan = Number(tongQuan?.canHoan) || 0;
  const phuCongNo = [
    soDonNo ? t("{{count}} đơn chưa thu đủ", { count: soDonNo }) : t("Không còn đơn chưa thu đủ"),
    canHoan > 0 ? t("cần hoàn khách {{canHoan}}", { canHoan: formatCurrency(canHoan) }) : "",
  ].filter(Boolean).join(" · ");

  return [
    {
      ma: "chi-tieu",
      nhan: t("Tổng chi tiêu"),
      coGiaTri: coDon,
      giaTri: coDon ? formatCurrency(tongQuan.tongChiTieu) : "—",
      phu: coDon ? t("Từ {{count}} đơn, không tính hủy và hoàn trả", { count: soDonTinh }) : trong,
    },
    {
      ma: "so-don",
      nhan: t("Số đơn", { context: "dem" }),
      coGiaTri: coDon,
      giaTri: coDon ? String(soDonDat) : "—",
      phu: coDon ? phuSoDon : trong,
    },
    {
      ma: "trung-binh",
      nhan: t("Trung bình mỗi đơn"),
      coGiaTri: coTrungBinh,
      giaTri: coTrungBinh ? formatCurrency(tongQuan.trungBinhMoiDon) : "—",
      phu: coTrungBinh ? t("Trên {{count}} đơn tính chi tiêu", { count: soDonTinh }) : coDon ? t("Chưa có đơn tính chi tiêu") : trong,
    },
    {
      ma: "gan-nhat",
      nhan: t("Lần mua gần nhất"),
      coGiaTri: Boolean(gan),
      giaTri: gan ? formatDate(gan.ngayDatHang) : "—",
      phu: gan ? cachDay(gan.ngayDatHang, homNay) : trong,
      donGanNhat: gan,
    },
    {
      ma: "con-phai-thu",
      nhan: t("Còn phải thu"),
      coGiaTri: coCongNo,
      giaTri: coCongNo ? formatCurrency(tongQuan.conPhaiThu) : "—",
      phu: coCongNo ? phuCongNo : trong,
    },
  ];
}

/** Ghi chú cột Ghi chú của báo giá: báo giá bị từ chối ghi lý do, còn lại ghi chú của báo giá. */
export function ghiChuBaoGia(baoGia) {
  if (Number(baoGia?.trangThai) === 4 && baoGia?.lyDoTuChoi?.trim()) return t("Lý do: {{lyDo}}", { lyDo: baoGia.lyDoTuChoi.trim() });
  return baoGia?.ghiChu?.trim() || "";
}

/** Câu phạm vi dữ liệu theo vai trò (khớp DonBanHangService.dieuKienPhamViTheoVaiTro ở máy chủ). */
export function ghiChuPhamVi({ laQuanTriVien, laVaiTroKho, laBanHang, laBaoGia = false }) {
  if (laQuanTriVien) return "";
  if (laVaiTroKho) return laBaoGia ? t("Chỉ hiện báo giá xuất từ nơi làm việc của bạn.") : t("Chỉ tính đơn xuất từ nơi làm việc của bạn.");
  if (laBanHang) return laBaoGia ? t("Chỉ hiện báo giá do bạn tạo.") : t("Chỉ tính đơn do bạn tạo.");
  return "";
}
