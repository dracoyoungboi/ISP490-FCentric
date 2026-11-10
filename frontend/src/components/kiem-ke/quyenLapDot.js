import { coQuyenTaiKho, dsKhoLamViecTrongToken } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";

/**
 * Ai lập được đợt kiểm kê (đặc tả BA mục 3, chốt 10/11) — khớp KiemKeQuyen.duocLapDot ở máy chủ:
 * quản trị viên và quản lý kho lập sẵn theo vai trò; nhân viên kho cần quyền `tao_dot_kiem_ke` tại kho.
 * Nhân viên kho chỉ lập và sửa nháp của mình; Bắt đầu, Hủy vẫn là việc của quản lý kho.
 */
export const QUYEN_LAP_DOT = "tao_dot_kiem_ke";

/** Quản trị viên hoặc quản lý kho: làm mọi bước của đợt nháp (lập, sửa, bắt đầu, hủy). */
export const laQuanLyKiemKe = () => hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);

/** Nhân viên kho lập đợt nhờ quyền được cấp (không phải quản lý). */
export const lapNhoQuyen = () => !laQuanLyKiemKe() && hasAnyRole([ROLES.NHAN_VIEN_KHO]);

/**
 * Lập được đợt ở kho `khoId`; bỏ trống `khoId` = ở ít nhất một kho kiểm kê được (kho giao dịch đang hoạt động, đúng danh
 * sách kho của biểu mẫu Tạo đợt).
 */
export function coQuyenLapDot(khoId) {
  if (laQuanLyKiemKe()) return true;
  if (!lapNhoQuyen()) return false;
  if (khoId != null) return coQuyenTaiKho(khoId, QUYEN_LAP_DOT);
  return dsKhoLamViecTrongToken().some((k) => coQuyenTaiKho(k.id, QUYEN_LAP_DOT));
}
