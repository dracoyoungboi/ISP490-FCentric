import { Boxes, CreditCard, IdCard, Printer, RefreshCcw, Store } from "lucide-react";

/**
 * Trung tâm Cấu hình (/settings/*): menu trái của SettingsLayout, mục "Cấu hình" ghim ở đáy sidebar
 * và danh sách màn hình theo vai trò (phân quyền, tìm kiếm toàn hệ thống) cùng đọc từ đây.
 *
 * - roles:     vai trò được mở trang (frontend chỉ là UX — backend @RequireAuth mới là chốt chặn thật).
 * - editRoles: vai trò được sửa; vai trò còn lại chỉ xem (tiêu đề hiện nhãn "Chỉ xem").
 */
const QTV = "quan_tri_vien";
const QLK = "quan_ly_kho";

export const SETTINGS_GROUPS = [
  { key: "van-hanh", label: "Vận hành" },
  { key: "cua-hang", label: "Cửa hàng" },
];

export const SETTINGS_PAGES = [
  // GET /dieu-hanh-he-thong/cau-hinh cho QTV và QLK; PUT chỉ QTV
  { key: "stock", label: "Tồn kho", to: "/settings/stock", group: "van-hanh", icon: Boxes, roles: [QTV, QLK], editRoles: [QTV] },
  { key: "sync", label: "Đồng bộ kênh bán", to: "/settings/sync", group: "van-hanh", icon: RefreshCcw, roles: [QTV, QLK], editRoles: [QTV] },
  { key: "customer", label: "Khách hàng", to: "/settings/customer", group: "van-hanh", icon: IdCard, roles: [QTV, QLK], editRoles: [QTV] },
  // ThongTinCongTyController: GET/PUT/logo cho QTV và QLK
  { key: "store", label: "Thông tin cửa hàng", to: "/settings/store", group: "cua-hang", icon: Store, roles: [QTV, QLK], editRoles: [QTV, QLK] },
  // CauHinhThanhToanController: chỉ QTV
  { key: "payment", label: "Thanh toán", to: "/settings/payment", group: "cua-hang", icon: CreditCard, roles: [QTV], editRoles: [QTV] },
  // CauHinhMauInController: QTV và QLK
  { key: "print", label: "Mẫu in", to: "/settings/print-templates", group: "cua-hang", icon: Printer, roles: [QTV, QLK], editRoles: [QTV, QLK] },
];

/** Vai trò được mở ít nhất một trang cấu hình. */
export const SETTINGS_ROLES = [...new Set(SETTINGS_PAGES.flatMap((page) => page.roles))];

/** `role` trong localStorage có thể là nhiều vai trò cách nhau bởi khoảng trắng. */
export function parseRoles(value) {
  return typeof value === "string" ? value.split(/\s+/).filter(Boolean) : [];
}

const coVaiTro = (roles, vaiTro) => vaiTro.some((role) => roles.includes(role));

/** Các trang cấu hình vai trò được mở, giữ thứ tự khai báo. */
export function settingsPagesFor(roleValue) {
  const vaiTro = parseRoles(roleValue);
  return SETTINGS_PAGES.filter((page) => coVaiTro(page.roles, vaiTro));
}

/** Vai trò có được sửa trang cấu hình này không. */
export function canEditSettingsPage(page, roleValue) {
  return Boolean(page) && coVaiTro(page.editRoles, parseRoles(roleValue));
}

/** Trang cấu hình chứa đường dẫn (trang con như /settings/print-templates/... tính vào trang cha). */
export function findSettingsPage(pathname) {
  return SETTINGS_PAGES.find((page) => pathname === page.to || pathname.startsWith(`${page.to}/`)) ?? null;
}
