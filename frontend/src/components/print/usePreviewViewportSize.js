import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Đo kích thước (clientWidth/clientHeight) của vùng chứa preview bằng
 * callback ref + ResizeObserver:
 * - callback ref tự gắn lại observer khi vùng preview mount/unmount
 *   (vd: chuyển trạng thái loading -> có nội dung) — không phụ thuộc thứ tự effect.
 * - setState chỉ khi kích thước THỰC SỰ đổi, tránh vòng lặp re-render.
 * - Trước lần đo đầu tiên width/height = 0 — bên dùng phải có fallback
 *   (computeFitScale trả 1 khi kích thước chưa có, không sinh NaN).
 *
 * Zoom áp dụng lên CON của viewport (tờ giấy) nên kích thước viewport không
 * bị zoom làm đổi — không có feedback loop.
 */
export function usePreviewViewportSize() {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const observerRef = useRef(null);

    const ref = useCallback((el) => {
        observerRef.current?.disconnect();
        observerRef.current = null;
        if (!el) return;

        const measure = () => {
            const width = el.clientWidth;
            const height = el.clientHeight;
            setSize((prev) =>
                prev.width === width && prev.height === height
                    ? prev
                    : { width, height }
            );
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        observerRef.current = observer;
    }, []);

    useEffect(() => {
        return () => observerRef.current?.disconnect();
    }, []);

    return { ref, width: size.width, height: size.height };
}
