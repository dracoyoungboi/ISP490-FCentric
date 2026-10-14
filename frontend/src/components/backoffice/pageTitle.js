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
