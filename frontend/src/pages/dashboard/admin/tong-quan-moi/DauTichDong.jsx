import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/*
 * Dấu tích có hiệu ứng cho trạng thái "Không có việc nào đang chờ".
 * Nền xanh nhạt nảy lên, vòng tròn tự vẽ theo chiều kim đồng hồ từ đỉnh, dấu tích vẽ tiếp,
 * cả biểu tượng nảy nhẹ và tỏa một vòng sóng. Tổng khoảng 1,1 giây.
 * Dùng Web Animations API có sẵn trong trình duyệt, không thêm thư viện.
 * Chạy khi hiện ra và khi rê chuột vào; người dùng bật "giảm chuyển động" thì chỉ hiện hình tĩnh.
 */

const MUOT = "cubic-bezier(0.22, 1, 0.36, 1)";
const NAY = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export default function DauTichDong({ className }) {
  const ref = useRef(null);

  const chay = useCallback(() => {
    const khung = ref.current;
    if (!khung || typeof khung.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    khung.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    const lay = (k) => khung.querySelector(`[data-k="${k}"]`);

    lay("nen").animate(
      [
        { transform: "scale(0.4)", opacity: 0 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 420, easing: NAY, fill: "backwards" },
    );
    lay("vong").animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 520, delay: 80, easing: MUOT, fill: "backwards" });
    lay("tich").animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 340, delay: 460, easing: MUOT, fill: "backwards" });
    khung.animate([{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 320, delay: 780, easing: "ease-out" });
    lay("song").animate(
      [
        { transform: "scale(0.9)", opacity: 0.5 },
        { transform: "scale(1.75)", opacity: 0 },
      ],
      { duration: 700, delay: 760, easing: "ease-out", fill: "backwards" },
    );
  }, []);

  useEffect(() => {
    chay();
  }, [chay]);

  return (
    <span ref={ref} onMouseEnter={chay} aria-hidden="true" className={cn("relative inline-flex size-10 shrink-0 items-center justify-center", className)}>
      <span data-k="song" className="absolute inset-0 rounded-full bg-[#22a06b]/25 opacity-0" />
      <span data-k="nen" className="absolute inset-0 rounded-full bg-[#e9f7f0]" />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative size-6 text-[#22a06b]">
        <circle data-k="vong" cx="12" cy="12" r="10" pathLength="1" strokeDasharray="1" transform="rotate(-90 12 12)" />
        <path data-k="tich" d="m9 12 2 2 4-4" pathLength="1" strokeDasharray="1" />
      </svg>
    </span>
  );
}
