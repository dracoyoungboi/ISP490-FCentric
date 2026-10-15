import { createContext, useContext, useLayoutEffect } from "react";

/**
 * Tiêu đề trang (h1) dùng chung cho toàn bộ backoffice.
 *
 * - BackofficeLayout cung cấp `title` lấy từ PAGE_META_CONFIG (trùng nhãn menu bên trái).
 * - Trang có hàng tiêu đề riêng (ListPageHeader, PageHeader) gọi `useClaimPageTitle()` để "nhận" tiêu đề;
 *   khi chưa trang nào nhận, PageContainer tự vẽ tiêu đề ở đầu trang (`showFallback`).
 * - Trang tự có h1 (chi tiết sản phẩm, hồ sơ…) được đánh dấu `ownTitle` trong PAGE_META_CONFIG nên không vẽ thêm.
 */
export const PageTitleContext = createContext({ title: null, showFallback: false, claim: null });

/**
 * Kiểu chữ tiêu đề trang: 24px, đậm 560, nét Inter Display (opsz 32), màu bo-heading.
 * Dùng cho PageHeading và cho các màn tự vẽ h1 tiêu đề trang (có icon, nằm trong thẻ đầu trang…).
 */
export const PAGE_HEADING_TYPE =
  "text-[24px] leading-8 font-[560] tracking-[-0.01em] text-bo-heading [font-variation-settings:'opsz'_32]";

/**
 * Nét chữ cho tên đối tượng ở đầu màn chi tiết (tên sản phẩm, khách hàng, người dùng): đậm 600 và bỏ ghim
 * opsz 14 của font-backoffice để Inter tự chọn nét theo cỡ chữ, cùng họ với tiêu đề trang.
 * Cỡ chữ và màu do từng màn tự đặt (có màn nằm trên nền tối).
 */
export const ENTITY_NAME_TYPE = "font-semibold [font-variation-settings:normal]";

export function usePageTitle() {
  return useContext(PageTitleContext);
}

/** Báo cho layout biết trang đã tự vẽ tiêu đề. Dùng useLayoutEffect để không nháy tiêu đề dự phòng. */
export function useClaimPageTitle(enabled = true) {
  const { claim } = useContext(PageTitleContext);
  useLayoutEffect(() => {
    if (!enabled || !claim) return undefined;
    return claim();
  }, [enabled, claim]);
}
