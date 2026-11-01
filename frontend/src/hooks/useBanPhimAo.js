import { useEffect, useState } from "react";

/**
 * true khi bàn phím ảo đang mở: khung nhìn hiển thị (visualViewport) thấp hơn cửa sổ ít nhất 150px. Nhân với vv.scale để
 * phóng to bằng hai ngón (khung nhìn nhỏ đi nhưng không có bàn phím) không bị tính nhầm là bàn phím mở.
 * Dùng để ẩn các thanh dính đáy (thanh điều hướng, thanh thao tác, thanh chọn hàng loạt) lúc đang gõ, vì từ Chrome 108
 * trên Android và trên Safari iOS, bàn phím chỉ co visual viewport nên phần tử position: fixed ở đáy bị bàn phím che hoặc
 * trôi lơ lửng giữa màn. Máy tính không có bàn phím ảo nên luôn false.
 */
export function useBanPhimAoMo() {
  const [mo, setMo] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const tinh = () => setMo(window.innerHeight - vv.height * vv.scale >= 150);
    tinh();
    vv.addEventListener("resize", tinh);
    return () => vv.removeEventListener("resize", tinh);
  }, []);
  return mo;
}
