import { useCallback, useState } from "react";
import { laTheRieng } from "@/lib/moTrangIn";
import { t } from "@/i18n";

/**
 * Nút về của trang in. Trang in mở ở thẻ riêng (lib/moTrangIn) thì nút là "Đóng": đóng thẻ, người dùng trở lại đúng
 * thẻ đang làm; trình duyệt không cho đóng thì về trang chứng từ ngay trong thẻ (`veTrongThe`). Trang in mở trong cùng
 * thẻ (trình duyệt chặn thẻ mới, đường dẫn cũ) thì nút là "Quay lại" và gọi `veTrongThe`.
 */
export default function useNutVeTrangIn(veTrongThe) {
  // Đọc một lần lúc mở trang: sau khi về trang chứng từ trong thẻ thì trang in đã đóng lại
  const [theRieng] = useState(() => typeof window !== "undefined" && laTheRieng(window.history));

  const ve = useCallback(() => {
    if (!theRieng) {
      veTrongThe?.();
      return;
    }
    window.close();
    window.setTimeout(() => {
      if (!window.closed) veTrongThe?.();
    }, 200);
  }, [theRieng, veTrongThe]);

  return { theRieng, ve, nhan: theRieng ? t("Đóng") : t("Quay lại") };
}
