import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Thanh bước của màn Thiết lập gian hàng: (1) — (2) — (3) — (4), không khung.
 * - `buoc`: [{ so, ten }], `hienTai`: số bước đang làm, `daXong(so)`: bước đã lưu.
 * - Một bước chỉ hiện ✓ khi nó và mọi bước trước đã xong (không có ✓ "nhảy cóc"); đường nối tô màu theo đó.
 * - Bấm được vào bước đã xong hoặc bước đang làm. Màn hẹp chỉ hiện vòng số và tên bước đang làm.
 */
export default function SetupStepper({ buoc, hienTai, daXong, onChon, className }) {
  const xongLienTiep = (so) => buoc.filter((b) => b.so <= so).every((b) => daXong(b.so));
  const buocHienTai = buoc.find((b) => b.so === hienTai);
  return (
    <nav aria-label="Các bước thiết lập" className={className}>
      <ol className="flex items-center">
        {buoc.map((b, index) => {
          const dangLam = b.so === hienTai;
          const xong = !dangLam && xongLienTiep(b.so);
          const bamDuoc = Boolean(onChon) && (xong || dangLam || daXong(b.so));
          const noiDung = (
            <>
              <span
                className={cn(
                  "grid size-[26px] shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums transition-colors",
                  dangLam && "bg-bo-primary text-white",
                  xong && "bg-bo-primary-soft text-bo-primary",
                  !xong && !dangLam && "border border-slate-300 bg-bo-surface text-slate-500",
                )}
                aria-hidden="true"
              >
                {xong ? <Check className="size-3.5" strokeWidth={3} /> : b.so}
              </span>
              <span
                className={cn(
                  "hidden whitespace-nowrap text-sm md:inline",
                  dangLam ? "font-semibold text-bo-heading" : xong ? "text-bo-foreground" : "text-bo-muted",
                )}
              >
                {b.ten}
              </span>
              <span className="sr-only">{`Bước ${b.so}: ${b.ten}${xong ? " (đã xong)" : dangLam ? " (đang làm)" : ""}`}</span>
            </>
          );
          return (
            <li key={b.so} className={cn("flex items-center", index < buoc.length - 1 && "flex-1")}>
              {bamDuoc ? (
                <button
                  type="button"
                  onClick={() => onChon(b.so)}
                  aria-current={dangLam ? "step" : undefined}
                  className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 max-sm:min-h-11 max-sm:min-w-11 max-sm:justify-center"
                >
                  {noiDung}
                </button>
              ) : (
                <div className="flex items-center gap-2.5" aria-current={dangLam ? "step" : undefined}>
                  {noiDung}
                </div>
              )}
              {index < buoc.length - 1 ? (
                <span aria-hidden="true" className={cn("mx-3.5 h-px min-w-6 flex-1", xongLienTiep(b.so) ? "bg-bo-primary" : "bg-bo-border")} />
              ) : null}
            </li>
          );
        })}
      </ol>
      {buocHienTai ? (
        <p className="mt-2.5 text-sm font-semibold text-bo-heading md:hidden">
          Bước {buocHienTai.so}/{buoc.length}: {buocHienTai.ten}
        </p>
      ) : null}
    </nav>
  );
}
