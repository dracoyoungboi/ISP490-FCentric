// Đọc vai trò và id người dùng hiện tại ở frontend (chỉ phục vụ hiển thị;
// backend @RequireAuth vẫn là chốt chặn thật).
export const ROLES = {
  QUAN_TRI_VIEN: "quan_tri_vien",
  QUAN_LY_KHO: "quan_ly_kho",
  NHAN_VIEN_KHO: "nhan_vien_kho",
  NHAN_VIEN_MUA_HANG: "nhan_vien_mua_hang",
  NHAN_VIEN_BAN_HANG: "nhan_vien_ban_hang",
};

/** `role` trong localStorage có thể là chuỗi nhiều vai trò cách nhau khoảng trắng. */
export function getStoredRoles() {
  const raw = window.localStorage.getItem("role") ?? "";
  return raw.split(/\s+/).filter(Boolean);
}

export function hasAnyRole(roles) {
  const mine = getStoredRoles();
  return roles.some((role) => mine.includes(role));
}

export function getCurrentUserId() {
  try {
    const token = window.localStorage.getItem("access_token");
    if (!token) return null;
    const b64 = token.split(".")[1];
    const payload = JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.id ?? null;
  } catch {
    return null;
  }
}
