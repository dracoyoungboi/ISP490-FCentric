import { useId, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NUT_VIEN = "border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";

/**
 * Khung "Cần xem lại" của Chi tiết người dùng (Kiểu D, chốt 19/10/2026): chỗ duy nhất trên trang dùng màu cảnh báo.
 * Mỗi điểm bấm được (khi có quyền liên quan): tab Quyền tô các ô đó và làm mờ phần còn lại; bấm lại hoặc
 * "Bỏ đánh dấu" để thôi. Điểm đang chọn tự sáng lên nên không cần thêm chip "Đang xem…" ở chỗ khác.
 * `onChonDiem(ma)`: trang quyết định bật/tắt (đang ở tab khác thì chỉ chuyển về tab Quyền, không tắt).
 * `idVung`: id vùng tab mà các điểm điều khiển (aria-controls).
 * Nút phụ (vd. "Sửa theo mẫu") do trang truyền vào; không truyền thì không có nút (xem trang của chính mình).
 */
export default function CanXemLai({ vanDe, danhDau, onChonDiem, onBoDanhDau, idVung, nhanNut, onNut, className }) {
  const idTieuDe = useId();
  const nutDiem = useRef({});
  if (!vanDe?.length) return null;
  return (
    <section
      aria-labelledby={idTieuDe}
      className={cn(
        "mx-4 mb-4 flex flex-wrap items-start gap-x-4 gap-y-2.5 rounded-lg border border-orange-200 bg-bo-warning-soft px-4 py-3 sm:mx-6",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 basis-72 gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-700" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id={idTieuDe} className="text-[13.5px] font-semibold leading-5 text-orange-900">
            Cần xem lại
          </h2>
          <ul className="mt-1 space-y-1">
            {vanDe.map((v) => {
              const chon = danhDau === v.ma;
              return (
                <li key={v.ma} className="text-[13px] leading-5 text-slate-600">
                  {v.maQuyen.length ? (
                    <button
                      ref={(el) => {
                        nutDiem.current[v.ma] = el;
                      }}
                      type="button"
                      aria-pressed={chon}
                      aria-controls={idVung}
                      title={chon ? "Bỏ đánh dấu" : "Đánh dấu các quyền này ở tab Quyền truy cập"}
                      onClick={() => onChonDiem(v.ma)}
                      className={cn(
                        "-mx-1 rounded-sm px-1 text-left font-medium text-orange-900 underline decoration-orange-300 underline-offset-[3px] outline-none hover:decoration-orange-700 focus-visible:ring-2 focus-visible:ring-orange-500/50",
                        chon && "bg-orange-100 decoration-orange-700",
                      )}
                    >
                      {v.chinh}
                    </button>
                  ) : (
                    <span className="font-medium text-orange-900">{v.chinh}</span>
                  )}
                  {v.phu ? <span> · {v.phu}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {danhDau || onNut ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:w-full">
          {danhDau ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                // Nút này biến mất sau khi bấm: đưa tiêu điểm về điểm vừa bỏ đánh dấu
                nutDiem.current[danhDau]?.focus();
                onBoDanhDau();
              }}
              className="h-9 gap-1.5 text-orange-900 hover:bg-orange-100 hover:text-orange-900"
            >
              <X className="size-3.5" aria-hidden="true" />
              Bỏ đánh dấu
            </Button>
          ) : null}
          {onNut ? (
            <Button type="button" variant="outline" onClick={onNut} className={`h-9 max-sm:flex-1 ${NUT_VIEN}`}>
              {nhanNut}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
