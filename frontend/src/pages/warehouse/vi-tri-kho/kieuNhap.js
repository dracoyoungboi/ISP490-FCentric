import { NHOM_TRANG_THAI_KE } from "@/constants/nhapKho";

/** Kiểu ô nhập dùng chung cho các hộp của trang Vị trí kệ (cao 36px, viền xám, focus xanh). */
export const O_NHAP =
  "h-9 w-full rounded-md border border-bo-border bg-white px-3 text-sm text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle disabled:text-bo-muted aria-[invalid=true]:border-bo-danger [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export const O_GHI_CHU =
  "min-h-[76px] w-full rounded-md border border-bo-border bg-white px-3 py-2 text-sm text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15";

export const NUT_PHU = "border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle";
export const NUT_CHINH = "bg-bo-primary text-white hover:bg-bo-primary-hover";

/** Kiểm tra khu vực mới (dùng ở hộp Thêm khu vực và hộp Đặt lên mặt bằng). */
export function kiemTraKhuMoi({ ma, ten }, khuVucs) {
  const maChuan = String(ma ?? "").trim().toUpperCase();
  const loi = {};
  if (!maChuan) loi.ma = "Nhập mã khu vực.";
  else if (/\s/.test(maChuan)) loi.ma = "Mã khu vực không có khoảng trắng.";
  else if ((khuVucs ?? []).some((k) => String(k.maKhuVuc ?? "").toUpperCase() === maChuan)) loi.ma = "Mã này đã có trong kho.";
  if (!String(ten ?? "").trim()) loi.ten = "Nhập tên khu vực.";
  return { maChuan, loi, hopLe: !loi.ma && !loi.ten };
}

/** Sắp xếp vị trí theo khu rồi theo mã (A-02-01 trước A-10-01). */
export const soSanhViTri = (a, b) =>
  String(a.maViTri ?? "").localeCompare(String(b.maViTri ?? ""), "vi", { numeric: true });

export const dinhDangSo = (n) => Number(n || 0).toLocaleString("vi-VN");

/** Tab trạng thái của danh sách vị trí (giữ trên URL ?trangThai=). "Đầy" là trạng thái tính, không chọn tay. */
export const TAB_TRANG_THAI_KE = [
  { value: "tat-ca", label: "Tất cả" },
  { value: "con-cho", label: NHOM_TRANG_THAI_KE.CON_CHO.label, ma: "CON_CHO" },
  { value: "day", label: NHOM_TRANG_THAI_KE.DAY.label, ma: "DAY", tone: "warning" },
  { value: "bao-tri", label: NHOM_TRANG_THAI_KE.BAO_TRI.label, ma: "BAO_TRI" },
];
