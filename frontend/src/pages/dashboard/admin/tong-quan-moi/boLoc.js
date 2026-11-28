import { t } from "../../../../i18n/t.js";

/* Hằng số và hàm dùng chung cho thanh lọc đầu trang Tổng quan: kiểu nút theo token hệ thống (bo-*), danh sách kho.
   FOCUS, MENU còn được Báo cáo doanh thu, Bộ lọc kỳ của báo cáo, Nhật ký nhập – xuất dùng chung. */

/** Nút trong thanh lọc: nền trắng, viền 1px, cao 36px, bo 8px (cùng kiểu ô lọc ở các màn khác). */
export const KHUNG =
  "h-9 rounded-lg border border-bo-border bg-white text-[13px] font-medium text-bo-foreground shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-bo-surface-subtle disabled:opacity-60";

export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30";

/** Khung menu thả xuống. */
export const MENU = "z-50 rounded-xl border border-bo-border bg-white p-1.5 shadow-lg";

export function tenKhoDangXem(khoId, dsKho) {
  return khoId == null ? t("Tất cả kho") : dsKho.find((k) => k.id === khoId)?.tenKho ?? t("Kho đã chọn");
}
