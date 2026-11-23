import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Nút "i" tròn đặt cạnh tiêu đề trang (prop `giaiThich` của ListPageHeader): bấm mới mở hộp giải thích,
 * bấm ra ngoài hoặc Esc thì đóng. Dùng khi danh sách có quy tắc người dùng cần biết nhưng không cần thấy thường trực
 * (vd. màn Khách hàng chỉ có khách cửa hàng). Bấm được cả trên điện thoại, khác `title` chỉ hiện khi rê chuột.
 * - label: đọc cho trình đọc màn hình (nút chỉ có biểu tượng).
 * - tieuDe: dòng đậm đầu hộp; children: nội dung hộp.
 * - classNameHop: đổi độ rộng hộp khi nội dung dài (mặc định 320px), vd. "w-96".
 */
export default function NutGiaiThich({ label, tieuDe, children, className, classNameHop }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-bo-muted transition-colors",
            "hover:bg-slate-100 hover:text-bo-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
            "data-[state=open]:bg-bo-primary-soft data-[state=open]:text-bo-primary",
            className,
          )}
        >
          <Info className="size-[18px]" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={16}
        className={cn(
          "w-80 max-w-[calc(100vw-2rem)] rounded-lg border-bo-border bg-bo-surface p-4 text-bo-foreground shadow-lg",
          classNameHop,
        )}
      >
        {tieuDe ? <p className="text-sm font-semibold text-bo-foreground">{tieuDe}</p> : null}
        <div className={cn("text-[13px] leading-5", tieuDe && "mt-1.5")}>{children}</div>
      </PopoverContent>
    </Popover>
  );
}
