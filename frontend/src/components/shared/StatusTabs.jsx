import { useRef } from "react";
import { cn } from "@/lib/utils";

const MAU_SO = {
  danger: "bg-red-50 text-red-700",
  warning: "bg-amber-50 text-amber-700",
};

/**
 * Hàng tab trạng thái của trang danh sách (bố cục A+G).
 * - tabs: [{ value, label, count?, tone? }]. `count` là số dòng sẽ thấy khi bấm tab (R1).
 * - Số 0 không hiện. Đang tải hoặc đếm lỗi thì để `count` = null/undefined: tab không có số (R9).
 * - `tone` ("warning" | "danger") tô màu số khi > 0 và tab không đang chọn.
 * - Đi qua lại bằng phím mũi tên trái/phải, Home, End. Màn hẹp: cuộn ngang, không xuống dòng.
 */
export default function StatusTabs({ tabs, value, onChange, label = "Lọc theo trạng thái", className }) {
  const refs = useRef([]);

  const chon = (index) => {
    const tab = tabs[index];
    if (!tab) return;
    onChange(tab.value);
    refs.current[index]?.focus();
  };

  const onKeyDown = (event, index) => {
    const cuoi = tabs.length - 1;
    if (event.key === "ArrowRight") chon(index === cuoi ? 0 : index + 1);
    else if (event.key === "ArrowLeft") chon(index === 0 ? cuoi : index - 1);
    else if (event.key === "Home") chon(0);
    else if (event.key === "End") chon(cuoi);
    else return;
    event.preventDefault();
  };

  return (
    // Không xuống dòng: hẹp thì cuộn ngang (ẩn thanh cuộn) để gạch chân tab luôn nằm sát mép bảng
    <div
      role="tablist"
      aria-label={label}
      className={cn("-mb-px flex min-w-0 items-end gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}
    >
      {tabs.map((tab, index) => {
        const active = tab.value === value;
        const coSo = typeof tab.count === "number" && tab.count > 0;
        return (
          <button
            key={tab.value}
            ref={(el) => { refs.current[index] = el; }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "inline-flex h-12 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-2.5 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30",
              active
                ? "border-bo-primary font-semibold text-bo-foreground"
                : "border-transparent font-medium text-bo-muted hover:text-bo-foreground",
            )}
          >
            {tab.label}
            {coSo ? (
              <span
                className={cn(
                  "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                  active ? "bg-bo-primary-soft text-bo-primary" : MAU_SO[tab.tone] ?? "bg-slate-100 text-slate-600",
                )}
              >
                {tab.count.toLocaleString("vi-VN")}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
