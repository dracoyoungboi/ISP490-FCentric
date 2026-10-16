import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import useSaoChep from "@/hooks/useSaoChep";

/**
 * Nút sao chép dùng chung (số điện thoại, email, mã…). Cách báo đã chép theo config/thongBaoNhanh.js → nutSaoChep:
 * "thong-bao" bật thông báo nhanh "Đã sao chép số điện thoại"; "tai-cho" đổi nút thành dấu tích kèm chữ "Đã chép".
 *
 * `nhan`: nhãn đọc màn hình, chú thích khi rê chuột và nguồn chữ thông báo, ví dụ "Sao chép số điện thoại".
 */
export default function NutSaoChep({ giaTri, nhan, className }) {
  const { daChep, saoChep } = useSaoChep();
  const xong = daChep !== null;

  if (giaTri == null || giaTri === "") return null;

  return (
    <button
      type="button"
      onClick={() => saoChep(giaTri, { nhan })}
      aria-label={nhan}
      title={xong ? undefined : nhan}
      className={cn(
        "relative inline-flex size-7 shrink-0 items-center justify-center rounded-md text-bo-muted transition-colors hover:bg-slate-100 hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary",
        xong && "text-bo-success hover:text-bo-success",
        className,
      )}
    >
      {xong ? (
        <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md bg-bo-foreground px-2 py-0.5 text-[11.5px] font-medium leading-4 text-white opacity-0 transition duration-150 ease-out motion-reduce:transition-none",
          xong && "translate-y-0 opacity-100",
        )}
      >
        Đã chép
      </span>
      <span className="sr-only" aria-live="polite">
        {xong ? "Đã sao chép" : ""}
      </span>
    </button>
  );
}
