import { cn } from "@/lib/utils";
import { LY_DO_DOI_GIA } from "./nhomGiaBan";

/** Chọn lý do đổi giá bằng chip (bắt buộc một lý do; ghi vào lịch sử đổi giá). */
export default function ChipLyDo({ value, onChange, disabled = false, className, nhanId }) {
  return (
    <div className={className}>
      <p id={nhanId} className="mb-1.5 text-xs font-medium text-slate-700">Lý do</p>
      <div role="group" aria-labelledby={nhanId} className="flex flex-wrap gap-1.5">
        {LY_DO_DOI_GIA.map((lyDo) => {
          const chon = value === lyDo;
          return (
            <button
              key={lyDo}
              type="button"
              aria-pressed={chon}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onChange(lyDo);
              }}
              className={cn(
                "h-7 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors disabled:opacity-60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
                chon ? "border-bo-primary bg-bo-primary-soft text-bo-primary-strong" : "border-bo-border bg-white text-slate-700 hover:border-slate-400",
              )}
            >
              {lyDo}
            </button>
          );
        })}
      </div>
    </div>
  );
}
