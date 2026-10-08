import { useCallback, useEffect, useRef, useState } from "react";

const PX_TO_MM = 25.4 / 96;
// Dư 2mm: sai số làm tròn giữa bố cục màn hình và bố cục in — tránh dòng
// cuối tràn sang trang thứ hai.
const SAFETY_MM = 2;

/**
 * Chiều cao trang in cho khổ nhiệt K80 = chiều cao THẬT của tờ giấy trên
 * màn hình (đơn vị mm, đã gồm padding = lề 3mm trên/dưới).
 *
 * Trên màn hình tờ giấy K80 rộng 80mm với padding 3mm -> vùng nội dung
 * 74mm, đúng bằng vùng nội dung khi in (@page 80mm, margin 3mm) nên chiều
 * cao đo trên màn hình = chiều cao khi in. Phần tử đo KHÔNG được bị zoom
 * hoặc display:none (dùng tờ giấy của trang in thật hoặc print mirror —
 * mirror được đặt ngoài màn hình thay vì ẩn hẳn).
 *
 * Trả về { ref, heightMm }: gắn `ref` vào tờ giấy; `heightMm` = null khi
 * không phải K80 hoặc chưa đo được (getPaperPageCss dùng 297mm tạm).
 */
export function useThermalPageHeight(enabled) {
    const [heightMm, setHeightMm] = useState(null);
    const observerRef = useRef(null);

    const ref = useCallback(
        (el) => {
            observerRef.current?.disconnect();
            observerRef.current = null;
            if (!el || !enabled) return;
            const measure = () => {
                const height = el.offsetHeight;
                if (!height) return;
                const next = Math.ceil(height * PX_TO_MM + SAFETY_MM);
                setHeightMm((prev) => (prev === next ? prev : next));
            };
            measure();
            const observer = new ResizeObserver(measure);
            observer.observe(el);
            observerRef.current = observer;
        },
        [enabled]
    );

    useEffect(() => () => observerRef.current?.disconnect(), []);

    return { ref, heightMm: enabled ? heightMm : null };
}
