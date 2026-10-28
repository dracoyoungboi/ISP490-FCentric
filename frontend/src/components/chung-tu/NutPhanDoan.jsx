import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Nút chọn dạng phân đoạn trong thanh công cụ bảng: lọc nhanh ("Tất cả / Còn thiếu (3) / Đủ (5)") hoặc cách xem
 * ("Danh sách / Lưới màu × kích cỡ"). Cùng kiểu ô phân đoạn của bản demo và ChonPhuongAn ở Kênh bán hàng.
 * `luaChon`: `[{ value, label, count? }]` — có `count` thì hiện "(n)" sau nhãn. `nhan`: tên nhóm cho trình đọc màn hình.
 * Đi qua lại bằng phím mũi tên trái / phải, Home, End (chỉ lựa chọn đang chọn nằm trong thứ tự Tab).
 */
export default function NutPhanDoan({ value, luaChon, onChange, nhan, className }) {
  const refs = useRef([]);
  const ds = Array.isArray(luaChon) ? luaChon : [];

  const chon = (i) => {
    const muc = ds[i];
    if (!muc) return;
    onChange(muc.value);
    refs.current[i]?.focus();
  };

  const bamPhim = (suKien, i) => {
    const cuoi = ds.length - 1;
    if (suKien.key === "ArrowRight" || suKien.key === "ArrowDown") chon(i === cuoi ? 0 : i + 1);
    else if (suKien.key === "ArrowLeft" || suKien.key === "ArrowUp") chon(i === 0 ? cuoi : i - 1);
    else if (suKien.key === "Home") chon(0);
    else if (suKien.key === "End") chon(cuoi);
    else return;
    suKien.preventDefault();
  };

  const coChon = ds.some((m) => m.value === value);

  return (
    <div
      role="radiogroup"
      aria-label={nhan}
      className={cn("inline-flex max-w-full shrink-0 gap-0.5 overflow-x-auto rounded-lg bg-slate-100 p-0.5", className)}
    >
      {ds.map((m, i) => {
        const dangChon = m.value === value;
        return (
          <button
            key={m.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={dangChon}
            tabIndex={dangChon || (!coChon && i === 0) ? 0 : -1}
            onClick={() => onChange(m.value)}
            onKeyDown={(suKien) => bamPhim(suKien, i)}
            className={cn(
              "h-7 shrink-0 whitespace-nowrap rounded-md px-2.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
              dangChon
                ? "bg-bo-surface font-semibold text-bo-heading shadow-[0_1px_2px_rgba(15,23,42,0.14)]"
                : "font-medium text-slate-600 hover:text-bo-foreground",
            )}
          >
            {m.label}
            {typeof m.count === "number" ? <span className="tabular-nums"> ({m.count.toLocaleString("vi-VN")})</span> : null}
          </button>
        );
      })}
    </div>
  );
}
