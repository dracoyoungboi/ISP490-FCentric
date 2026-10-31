/**
 * Logic thuần của mục "Thiết bị đang đăng nhập" ở Hồ sơ (chốt PA5, 31/10/2026): sắp xếp, phân loại theo lần hoạt động,
 * lọc và gom nhóm cho ngăn kéo "Xem tất cả thiết bị". Không import alias "@/..." để chạy được bằng `node --test`.
 *
 * Mỗi phiên là PhienDangNhapDto: { id, thietBiNay, userAgent, diaChiIp, viTri, taoLuc, truyCapCuoi }.
 * `bayGio` (ms) truyền vào từ ngoài — thời điểm tải danh sách — để kết quả không đổi giữa các lần vẽ.
 */
import { moTaThietBi, thoiGianTuongDoi } from "../../../utils/thietBi.js";
import { ngayGio } from "../phanQuyen.js";

const PHUT_MS = 60 * 1000;
export const PHUT_MOT_NGAY = 24 * 60;
/** Không hoạt động từ bao nhiêu phút thì coi là "lâu không dùng" (7 ngày). */
export const PHUT_LAU_KHONG_DUNG = 7 * PHUT_MOT_NGAY;
/** Số thẻ thiết bị hiện trên trang; nhiều hơn thì mở ngăn kéo "Xem tất cả thiết bị". */
export const SO_THE_TREN_TRANG = 6;

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

/** Đếm nhanh cho dòng tóm tắt: số phiên hoạt động trong ngày (gồm thiết bị này) và các phiên lâu không dùng. */
export function phanLoaiPhien(ds) {
  const homNay = ds.filter((p) => p.phut < PHUT_MOT_NGAY);
  const khac = ds.filter((p) => !p.thietBiNay);
  const lauKhongDung = khac.filter((p) => p.phut >= PHUT_LAU_KHONG_DUNG);
  return { homNay, khac, lauKhongDung };
}

export const LOC_THIET_BI = [
  { ma: "tat_ca", ten: "Tất cả" },
  { ma: "hom_nay", ten: "Hôm nay" },
  { ma: "lau_khong_dung", ten: "Lâu không dùng" },
];

/** Lọc theo bộ lọc thời gian và từ khóa (tên trình duyệt · hệ điều hành, địa chỉ IP, vị trí). */
export function locPhien(ds, { loc = "tat_ca", tuKhoa = "" } = {}) {
  const tk = String(tuKhoa ?? "").trim().toLowerCase();
  return ds.filter((p) => {
    if (loc === "hom_nay" && !(p.phut < PHUT_MOT_NGAY)) return false;
    if (loc === "lau_khong_dung" && (p.thietBiNay || p.phut < PHUT_LAU_KHONG_DUNG)) return false;
    if (!tk) return true;
    return [p.ten, p.diaChiIp, p.viTri].filter(Boolean).join(" ").toLowerCase().includes(tk);
  });
}

/** Gom theo thời gian cho ngăn kéo; bỏ nhóm rỗng, giữ thứ tự trong nhóm. */
export function nhomTheoThoiGian(ds) {
  const NHOM = [
    { ma: "nay", ten: "Thiết bị này", thuoc: (p) => p.thietBiNay },
    { ma: "hom_nay", ten: "Hôm nay", thuoc: (p) => !p.thietBiNay && p.phut < PHUT_MOT_NGAY },
    { ma: "tuan", ten: "Trong 7 ngày qua", thuoc: (p) => !p.thietBiNay && p.phut >= PHUT_MOT_NGAY && p.phut < PHUT_LAU_KHONG_DUNG },
    { ma: "cu", ten: "Hơn 7 ngày trước", thuoc: (p) => !p.thietBiNay && p.phut >= PHUT_LAU_KHONG_DUNG },
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
