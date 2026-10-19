import { jwtDecode } from "jwt-decode";
import { laKhoGiaoDich } from "@/utils/kho";
import { hasAnyRole, ROLES } from "@/utils/roles";

/*
 * Kho làm việc (ngữ cảnh kho) dùng chung cho các màn nghiệp vụ kho.
 * - Lưu ở localStorage "selected_kho_id" (cùng khóa với KhoLamViecSelect); apiClient gửi kèm header kho_id.
 * - Backend (AuthorizationAspect) chỉ chấp nhận header là kho có trong token của người dùng;
 *   quản trị viên được bỏ qua bước này.
 * - Màn đóng gói dùng để tự chuyển kho làm việc sang kho của đơn khi đơn thuộc kho khác.
 */
const KHO_LAM_VIEC_KEY = "selected_kho_id";

export function getKhoLamViecId() {
  try {
    const id = Number(window.localStorage.getItem(KHO_LAM_VIEC_KEY));
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** Sự kiện phát ra mỗi lần đổi kho làm việc (detail = id kho), để ô chọn kho ở trang và ở sidebar luôn khớp nhau. */
export const KHO_LAM_VIEC_EVENT = "fcentric:kho-lam-viec";

export function setKhoLamViecId(id) {
  try {
    window.localStorage.setItem(KHO_LAM_VIEC_KEY, String(id));
  } catch {
    // localStorage bị chặn: màn vẫn chạy với kho truyền trực tiếp qua tham số
  }
  window.dispatchEvent(new CustomEvent(KHO_LAM_VIEC_EVENT, { detail: Number(id) || null }));
}

const laQuanTriVien = () => hasAnyRole([ROLES.QUAN_TRI_VIEN]);

/** Kho được phân công trong token — đúng danh sách backend dùng để kiểm tra header kho_id. */
function khoTrongToken() {
  try {
    const token = window.localStorage.getItem("access_token");
    if (!token) return [];
    const raw = jwtDecode(token)?.warehousePermissions;
    const list = typeof raw === "string" ? JSON.parse(raw) : raw;
    return (Array.isArray(list) ? list : [])
      .filter((pq) => pq?.kho && (pq.trangThai == null || Number(pq.trangThai) === 1))
      .map((pq) => pq.kho);
  } catch {
    return [];
  }
}

/** Kho dùng được làm kho làm việc (đồng bộ, không gọi API): kho giao dịch và nằm trong quyền của người dùng. */
export function laKhoLamViecHopLe(kho) {
  if (!laKhoGiaoDich(kho)) return false;
  return laQuanTriVien() || khoTrongToken().some((k) => k.id === kho.id);
}
