/**
 * Hàm thuần cho các trang sau đăng nhập của cổng nhà cung cấp: Cần xử lý, Biên bản trả hàng, Lịch sử.
 * Nhãn trạng thái khai báo ở constants/congNhaCungCap.js bằng tên tiếng Việt (StatusBadge tự dịch và tra màu).
 * Chạy được bằng `node --test`.
 */
import { t } from "../../i18n/t.js";
import { chuanHoaHoTen, loiHoTen } from "../../validations/hoTen.js";
import { NHAN_HANG_LOI, NHAN_TRANG_THAI_BIEN_BAN } from "../../constants/congNhaCungCap.js";

/** Hai cách bù nhà cung cấp chọn cho biên bản (giá trị gửi máy chủ ở `phuongAn`). */
export const PHUONG_AN = Object.freeze({ TRU_TIEN: "TRU_CONG_NO", GIAO_BU: "DOI_HANG", CHO_CHOT: "CHO_CHOT" });

/** Nhà cung cấp chọn cho hàng lỗi còn ở kho (giá trị gửi máy chủ ở `hangLoi`). */
export const HANG_LOI = Object.freeze({ NHAN_LAI: "NHAN_LAI", TIEU_HUY: "TIEU_HUY" });

export const GHI_CHU_BIEN_BAN_TOI_DA = 255;
/** Bộ đếm ký tự ghi chú chỉ hiện khi gần chạm giới hạn. */
export const GHI_CHU_BIEN_BAN_HIEN_DEM = 200;

/** Khoảng thời gian của trang Lịch sử (số tháng; 1 = 30 ngày). Mặc định 6 tháng như máy chủ. */
export const KHOANG_LICH_SU = Object.freeze(["1", "6", "12"]);
export const KHOANG_MAC_DINH = "6";
export const chuanHoaKhoang = (k) => (KHOANG_LICH_SU.includes(String(k)) ? String(k) : KHOANG_MAC_DINH);

/** Tên khoảng thời gian ("30 ngày gần nhất"…), dùng ở ô chọn và chân bảng. */
export function tenKhoang(k) {
  const khoang = chuanHoaKhoang(k);
  if (khoang === "1") return t("30 ngày gần nhất");
  return khoang === "12" ? t("12 tháng gần nhất") : t("6 tháng gần nhất");
}

const pad2 = (n) => String(n).padStart(2, "0");
/** yyyy-MM-dd theo giờ Việt Nam. */
export function ngayVietNam(d) {
  const vn = new Date(d.getTime() + 7 * 3600e3);
  return `${vn.getUTCFullYear()}-${pad2(vn.getUTCMonth() + 1)}-${pad2(vn.getUTCDate())}`;
}

/** `tuNgay` gửi máy chủ: 30 ngày trước / 6 tháng trước / 12 tháng trước (theo ngày Việt Nam). */
export function tuNgayTheoKhoang(k, bayGio = new Date()) {
  const khoang = chuanHoaKhoang(k);
  if (khoang === "1") return ngayVietNam(new Date(bayGio.getTime() - 30 * 86400e3));
  const [y, m, d] = ngayVietNam(bayGio).split("-").map(Number);
  // Lùi số tháng, ngày vượt cuối tháng thì lấy ngày cuối tháng (31/08 lùi 6 tháng → 28 hoặc 29/02)
  const thang = m - 1 - Number(khoang);
  const cuoiThang = new Date(Date.UTC(y, thang + 1, 0)).getUTCDate();
  const kq = new Date(Date.UTC(y, thang, Math.min(d, cuoiThang)));
  return `${kq.getUTCFullYear()}-${pad2(kq.getUTCMonth() + 1)}-${pad2(kq.getUTCDate())}`;
}

/** Số việc trên tab "Cần xử lý": biên bản chờ chọn + đơn chờ báo giá. */
export function demViec(viec) {
  return (viec?.bienBanCho?.length ?? 0) + (viec?.donChoBaoGia?.length ?? 0);
}

/** "67%" — tỉ lệ được chấp nhận; chưa gửi báo giá nào thì null. */
export function tiLePhanTram(tu, mau) {
  const a = Number(tu);
  const b = Number(mau);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return `${Math.round((a / b) * 100)}%`;
}

/**
 * Cách xử lý của một dòng lịch sử trả hàng:
 * - `{ loai: "cho" }`: còn chờ nhà cung cấp chọn (biên bản chưa hủy);
 * - `{ loai: "tru", tien }`;
 * - `{ loai: "bu", xong, conLai }`;
 * - `{ loai: "huy" }`: biên bản đã hủy.
 */
export function cachXuLyLichSu(dong) {
  if (dong?.daHuy) return { loai: "huy" };
  // tienTru: đã trừ, hoặc dự kiến khi phiếu chưa nhập kho; 0 / thiếu thì không hiện số (tránh "−0 ₫")
  if (dong?.phuongAn === PHUONG_AN.TRU_TIEN) return { loai: "tru", tien: soDuongHoacNull(dong.tienTru) };
  if (dong?.phuongAn === PHUONG_AN.GIAO_BU) {
    return { loai: "bu", xong: Boolean(dong.buXong), conLai: Math.max(0, Number(dong.conChoGiao) || 0) };
  }
  return { loai: "cho" };
}

/** Số > 0, còn lại null. */
function soDuongHoacNull(giaTri) {
  const so = Number(giaTri);
  return Number.isFinite(so) && so > 0 ? so : null;
}

/** Nhà cung cấp còn việc phải trả lời (máy chủ tính: chưa chọn cách bù, hoặc hàng lỗi ở kho chưa chọn). */
export const choTraLoi = (bb) => bb?.trangThai === "CHO_XAC_NHAN";

/** Còn chọn / đổi được gì trên cổng (máy chủ trả các lựa chọn còn mở `cachBuMo`, `hangLoiMo`). */
export const coTheChon = (bb) =>
  Boolean(bb) && bb.trangThai !== "DA_HUY" && ((bb.cachBuMo?.length ?? 0) > 0 || (bb.hangLoiMo?.length ?? 0) > 0);

/** Nhãn đầu trang biên bản. Còn chờ trả lời mà không còn gì chọn được (đơn đã kết thúc) thì "Hết hạn". */
export function nhanTrangThaiBienBan(bb) {
  if (!bb) return null;
  if (choTraLoi(bb) && !coTheChon(bb)) return NHAN_TRANG_THAI_BIEN_BAN.HET_HAN_TRA_LOI;
  return NHAN_TRANG_THAI_BIEN_BAN[bb.trangThai] ?? NHAN_TRANG_THAI_BIEN_BAN.DA_XAC_NHAN;
}

/** Nhãn cột Hàng lỗi ở lịch sử: đã rời kho thì theo trạng thái; còn ở kho thì theo lựa chọn của nhà cung cấp. */
export function nhanHangLoi(dong) {
  if (dong?.hangLoi === "DA_TRA" || dong?.hangLoi === "DA_TIEU_HUY") return NHAN_HANG_LOI[dong.hangLoi];
  if (dong?.hangLoi !== "O_KHO" || dong?.daHuy) return null;
  return NHAN_HANG_LOI[dong.hangLoiNcc] ?? NHAN_HANG_LOI.CHO_CHON;
}

/** Số tiền dự kiến trừ, nói ở lựa chọn Trừ tiền hàng: `tienTru` của máy chủ nếu có, không thì tổng giá trị hàng lỗi. */
export function tienTruDuKien(bb) {
  return soDuongHoacNull(bb?.tienTru) ?? (Number(bb?.tongGiaTri) || 0);
}

/** Số tiền trừ đã chốt (hoặc dự kiến khi chưa nhập kho) để hiện sau khi xác nhận; 0 / thiếu thì null (không hiện). */
export function tienTruDaChot(bb) {
  return soDuongHoacNull(bb?.tienTru);
}

/** Ô Người xác nhận: bắt buộc, theo luật họ tên (validations/hoTen.js). Trả câu lỗi hoặc "". */
export function loiNguoiXacNhan(giaTri) {
  if (!chuanHoaHoTen(giaTri)) return t("Nhập tên người xác nhận");
  return loiHoTen(giaTri);
}

/**
 * Dữ liệu gửi POST /cong-ncc/bien-ban/{id}/xac-nhan. `phuongAn` / `hangLoi`: lựa chọn (null là giữ như cũ).
 * `phienBan`: phiên bản biên bản đang hiển thị — kho vừa lập lại thì máy chủ từ chối (409) thay vì ghi lựa chọn cho bản cũ.
 */
export function taoPayloadXacNhan({ phuongAn = null, hangLoi = null }, nguoiXacNhan, ghiChu, phienBan = null) {
  const ghi = String(ghiChu ?? "").trim().slice(0, GHI_CHU_BIEN_BAN_TOI_DA);
  return { phuongAn, hangLoi, nguoiXacNhan: chuanHoaHoTen(nguoiXacNhan), ghiChu: ghi || null, phienBan: phienBan ?? null };
}

/** Thuộc tính một dòng hàng lỗi: "Đen · S · AK-...". */
export function thuocTinhDong(d) {
  return [d?.mauSac, d?.kichCo].map((x) => String(x ?? "").trim()).filter(Boolean).join(" · ");
}
