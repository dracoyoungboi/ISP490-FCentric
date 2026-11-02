import { SIDEBAR_MENU } from "@/components/backoffice/sidebar.config";

/**
 * Mọi đường dẫn có mục riêng trên menu trái (kể cả mục con): danh sách, Tổng quan, báo cáo, trang cấu hình.
 * Thêm Hồ sơ (mở từ menu tài khoản ở đầu trang): cũng là trang cấp đầu, không có trang cha để nút ← quay về.
 */
const TRANG_CAP_DAU = new Set([
  ...SIDEBAR_MENU.flatMap((m) => [m.to, ...(m.children ?? []).map((c) => c.to)]).filter(Boolean),
  "/profile",
]);

/**
 * Trang cấp đầu = một mục trên menu trái, hoặc Hồ sơ. Chỉ những trang này có thanh điều hướng đáy trên điện thoại;
 * trang chi tiết / tạo mới / in (không có mục menu) dùng nút quay lại và thanh thao tác đáy của chứng từ.
 */
export function laTrangCapDau(path) {
  return TRANG_CAP_DAU.has(path.length > 1 ? path.replace(/\/+$/, "") : path);
}
