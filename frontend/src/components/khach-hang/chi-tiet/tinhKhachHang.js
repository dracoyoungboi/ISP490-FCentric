// Tính toán của màn Chi tiết khách hàng (bản một khối, chốt 18/10/2026). Không có JSX để chạy kiểm thử bằng node --test,
// nên import bằng đường dẫn tương đối (không dùng "@/").
import { formatCurrency, formatDate } from "../../../utils/formatters.js";
import { getChannelName } from "../../../constants/channel.js";

/** Trạng thái khách hàng (cột khach_hang.trang_thai). */
export const TRANG_THAI_KHACH = { HOAT_DONG: 1, NGUNG_HOAT_DONG: 0 };

export const LOAI_KHACH = {
  le: "Khách lẻ",
  si: "Khách sỉ",
  doanh_nghiep: "Doanh nghiệp",
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
  return loai === "doanh_nghiep" ? "Địa chỉ trụ sở" : "Địa chỉ giao hàng";
}

/** Giá trị lọc kênh của đơn không gắn kênh (đơn bán thường tạo trên hệ thống). */
export const KENH_BAN_THUONG = "ban-thuong";

export const LUA_CHON_THOI_GIAN = [
  { value: "", label: "Mọi thời gian" },
  { value: "30", label: "30 ngày qua" },
  { value: "90", label: "90 ngày qua" },
  { value: "365", label: "12 tháng qua" },
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
    { value: "", label: "Tất cả kênh" },
    ...(kenhMua ?? []).map((k) =>
      k.id == null
        ? { value: KENH_BAN_THUONG, label: "Bán thường" }
        : { value: String(k.id), label: k.tenKenh || getChannelName(k.maKenh) },
    ),
  ];
}

/** Tên các kênh khách đã mua qua, nhiều đơn nhất ở trước; chưa mua thì "—". */
export function moTaKenhMua(kenhMua) {
  const ten = (kenhMua ?? []).map((k) => (k.id == null ? "Bán thường" : k.tenKenh || getChannelName(k.maKenh)));
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
  if (soNgay <= 0) return "hôm nay";
  if (soNgay === 1) return "hôm qua";
  return `${soNgay} ngày trước`;
}

/** Tổng số đơn bán của khách trong phạm vi người xem (kể cả nháp) — số trên tab Đơn hàng. */
export function tongSoDon(tongQuan) {
  if (!tongQuan) return 0;
  return (Number(tongQuan.soDonDat) || 0) + (Number(tongQuan.soDonNhap) || 0);
}

/**
 * Bốn ô "Tình hình mua hàng" từ GET /khach-hang/{id}/tong-quan-mua-hang.
 * Mỗi ô: { ma, nhan, giaTri, coGiaTri, phu, donGanNhat? }. Đơn nháp không tính là đã đặt;
 * đơn đã hủy / bị hoàn trả vẫn là đơn đã đặt nhưng không tính vào chi tiêu.
 */
export function tinhKpi(tongQuan, homNay = new Date()) {
  const soDonDat = Number(tongQuan?.soDonDat) || 0;
  const soDonTinh = Number(tongQuan?.soDonTinhChiTieu) || 0;
  const soDonNhap = Number(tongQuan?.soDonNhap) || 0;
  const coDon = soDonDat > 0;
  const trong = soDonNhap > 0 ? `${soDonNhap} đơn nháp chưa tính` : "Chưa có đơn hàng";

  const phuSoDon = [
    tongQuan?.soDonHuy ? `${tongQuan.soDonHuy} đã hủy` : "",
    tongQuan?.soDonHoanTra ? `${tongQuan.soDonHoanTra} bị hoàn trả` : "",
    soDonNhap ? `${soDonNhap} nháp chưa tính` : "",
  ].filter(Boolean).join(" · ") || "Không có đơn hủy hay hoàn trả";

  const gan = tongQuan?.donGanNhat ?? null;
  const coTrungBinh = coDon && soDonTinh > 0 && tongQuan?.trungBinhMoiDon != null;

  return [
    {
      ma: "chi-tieu",
      nhan: "Tổng chi tiêu",
      coGiaTri: coDon,
      giaTri: coDon ? formatCurrency(tongQuan.tongChiTieu) : "—",
      phu: coDon ? `Từ ${soDonTinh} đơn, không tính hủy và hoàn trả` : trong,
    },
    {
      ma: "so-don",
      nhan: "Số đơn",
      coGiaTri: coDon,
      giaTri: coDon ? String(soDonDat) : "—",
      phu: coDon ? phuSoDon : trong,
    },
    {
      ma: "trung-binh",
      nhan: "Trung bình mỗi đơn",
      coGiaTri: coTrungBinh,
      giaTri: coTrungBinh ? formatCurrency(tongQuan.trungBinhMoiDon) : "—",
      phu: coTrungBinh ? `Trên ${soDonTinh} đơn tính chi tiêu` : coDon ? "Chưa có đơn tính chi tiêu" : trong,
    },
    {
      ma: "gan-nhat",
      nhan: "Lần mua gần nhất",
      coGiaTri: Boolean(gan),
      giaTri: gan ? formatDate(gan.ngayDatHang) : "—",
      phu: gan ? cachDay(gan.ngayDatHang, homNay) : trong,
      donGanNhat: gan,
    },
  ];
}

/** Ghi chú cột Ghi chú của báo giá: báo giá bị từ chối ghi lý do, còn lại ghi chú của báo giá. */
export function ghiChuBaoGia(baoGia) {
  if (Number(baoGia?.trangThai) === 4 && baoGia?.lyDoTuChoi?.trim()) return `Lý do: ${baoGia.lyDoTuChoi.trim()}`;
  return baoGia?.ghiChu?.trim() || "";
}

/** Câu phạm vi dữ liệu theo vai trò (khớp DonBanHangService.dieuKienPhamViTheoVaiTro ở máy chủ). */
export function ghiChuPhamVi({ laQuanTriVien, laVaiTroKho, laBanHang }) {
  if (laQuanTriVien) return "";
  if (laVaiTroKho) return "Chỉ tính đơn xuất từ kho bạn phụ trách.";
  if (laBanHang) return "Chỉ tính đơn do bạn tạo.";
  return "";
}
