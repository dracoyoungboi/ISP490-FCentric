/**
 * Logic thuần của mục "Thiết bị đang đăng nhập" ở Hồ sơ (chốt PA5, 31/10/2026): sắp xếp, tìm và gom nhóm cho
 * ngăn kéo "Xem tất cả thiết bị". Không import alias "@/..." để chạy được bằng `node --test`.
 *
 * Mỗi phiên là PhienDangNhapDto: { id, thietBiNay, userAgent, diaChiIp, viTri, taoLuc, truyCapCuoi }.
 * `bayGio` (ms) truyền vào từ ngoài — thời điểm tải danh sách — để kết quả không đổi giữa các lần vẽ.
 *
 * Không lọc/gom theo thời gian (bỏ "Hôm nay" / "Lâu không dùng", 01/11/2026): phiên chỉ sống GIO_HIEU_LUC_PHIEN giờ
 * kể từ lần đăng nhập (đổi mật khẩu thì tính lại từ lúc đổi), không gia hạn khi đang dùng, và danh sách chỉ có phiên
 * còn hạn, nên mọi thiết bị đều hoạt động trong ngày.
 */
import { moTaThietBi, thoiGianTuongDoi } from "../../../utils/thietBi.js";
import { ngayGio } from "../phanQuyen.js";

const PHUT_MS = 60 * 1000;
/** Hạn một lần đăng nhập, khớp PHIEN_TTL (NguoiDungService) và hạn token (JwtServiceImpl) ở máy chủ. */
export const GIO_HIEU_LUC_PHIEN = 24;
/** Số thẻ thiết bị hiện trên trang; nhiều hơn thì mở ngăn kéo "Xem tất cả thiết bị". */
export const SO_THE_TREN_TRANG = 6;
/** Điện thoại (PA A, 02/11/2026): chỉ hiện chừng này thiết bị trên trang, phần còn lại xem trong ngăn kéo. */
export const SO_THE_DIEN_THOAI = 3;

function docMs(giaTri) {
  if (!giaTri) return NaN;
  const ms = (giaTri instanceof Date ? giaTri : new Date(giaTri)).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

/** Số phút từ lần hoạt động cuối tới `bayGio`; thiết bị này luôn là 0; thiếu dữ liệu thì Infinity (xếp cuối). */
export function phutKhongHoatDong(phien, bayGio) {
  if (phien?.thietBiNay) return 0;
  const ms = docMs(phien?.truyCapCuoi);
  if (!Number.isFinite(ms)) return Infinity;
  return Math.max(0, Math.floor((bayGio - ms) / PHUT_MS));
}

/** Thêm thông tin hiển thị cho từng phiên và sắp xếp: thiết bị này trước, rồi mới hoạt động trước. */
export function chuanBiPhien(ds, bayGio) {
  const mang = Array.isArray(ds) ? ds.filter((p) => p && p.id != null) : [];
  return mang
    .map((p) => {
      const { ten, loai } = moTaThietBi(p.userAgent);
      return { ...p, ten, loai, phut: phutKhongHoatDong(p, bayGio) };
    })
    .sort((a, b) => Number(Boolean(b.thietBiNay)) - Number(Boolean(a.thietBiNay)) || a.phut - b.phut || a.id - b.id);
}

/** Tìm theo từ khóa (tên trình duyệt · hệ điều hành, địa chỉ IP, vị trí), không phân biệt hoa thường. */
export function timPhien(ds, tuKhoa = "") {
  const tk = String(tuKhoa ?? "").trim().toLowerCase();
  if (!tk) return ds;
  return ds.filter((p) => [p.ten, p.diaChiIp, p.viTri].filter(Boolean).join(" ").toLowerCase().includes(tk));
}

/** Gom cho ngăn kéo: "Thiết bị này" rồi "Thiết bị khác"; bỏ nhóm rỗng, giữ thứ tự trong nhóm. */
export function nhomPhien(ds) {
  const NHOM = [
    { ma: "nay", ten: "Thiết bị này", thuoc: (p) => p.thietBiNay },
    { ma: "khac", ten: "Thiết bị khác", thuoc: (p) => !p.thietBiNay },
  ];
  return NHOM.map(({ ma, ten, thuoc }) => ({ ma, ten, ds: ds.filter(thuoc) })).filter((n) => n.ds.length > 0);
}

/** Dòng phụ của một phiên: lần hoạt động · IP (· vị trí) (· lúc đăng nhập, khi `coLucDangNhap`). */
export function dongPhuPhien(p, { coLucDangNhap = false } = {}) {
  const tuongDoi = thoiGianTuongDoi(p.truyCapCuoi);
  return [
    p.thietBiNay ? "Đang hoạt động" : tuongDoi ? `Hoạt động ${tuongDoi}` : null,
    p.diaChiIp,
    p.viTri,
    coLucDangNhap && p.taoLuc ? `Đăng nhập ${ngayGio(p.taoLuc)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
