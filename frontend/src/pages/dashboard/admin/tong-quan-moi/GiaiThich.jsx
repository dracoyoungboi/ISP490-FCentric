import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * Chữ gạch chân chấm mở hộp giải thích cách tính (đặc tả bản 2): tiêu đề, một đoạn nói số này là gì, phép tính bằng chính số
 * đang hiện (mỗi dòng [tên, giá trị, là dòng tổng?]), một câu so sánh và liên kết sang báo cáo. Số trong hộp lấy từ cùng
 * lần tải với số trên màn, nên luôn khớp. congThuc (tùy chọn): các dòng công thức viết bằng chữ, đặt đầu khung xám, trên
 * các dòng số.
 * Đặt được bên trong nút (ô chỉ số): bấm chữ không chọn ô.
 */
export default function GiaiThich({ children, tieuDe, moTa, congThuc, dong, ghiChu, lienKet, className, align = "start" }) {
  const [mo, setMo] = useState(false);
  const dung = (e) => e.stopPropagation();
  return (
    <Popover open={mo} onOpenChange={setMo}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          onClick={dung}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setMo((x) => !x);
            }
          }}
          className={cn(
            "cursor-pointer rounded-sm underline decoration-slate-400 decoration-dotted decoration-1 underline-offset-[3px] hover:decoration-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
            className,
          )}
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={8}
        collisionPadding={16}
        role="dialog"
        aria-label={tieuDe}
        onClick={dung}
        className="w-[340px] max-w-[calc(100vw-32px)] rounded-xl border border-bo-border bg-white p-4 text-[13px] leading-5 text-bo-foreground shadow-lg"
      >
        <button
          type="button"
          onClick={() => setMo(false)}
          aria-label={t("Đóng")}
          className="absolute right-2 top-2 grid size-7 cursor-pointer place-items-center rounded-md text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        <h5 className="mb-1.5 pr-6 text-sm font-semibold">{tieuDe}</h5>
        {moTa ? <p className="text-bo-muted">{moTa}</p> : null}
        {dong?.length || congThuc?.length ? (
          <div className="mt-2.5 rounded-lg bg-bo-surface-subtle px-3 py-2 tabular-nums">
            {congThuc?.length ? (
              <div className={cn("space-y-1 py-0.5 font-medium", dong?.length && "mb-1.5 border-b border-bo-border pb-2")}>
                {congThuc.map((x) => (
                  <p key={x}>{x}</p>
                ))}
              </div>
            ) : null}
            {(dong ?? []).map(([ten, giaTri, tong]) => (
              <div key={ten} className={cn("flex justify-between gap-4 py-0.5", tong && "mt-1 border-t border-bo-border pt-1.5 font-semibold")}>
                <span className={tong ? "" : "text-bo-muted"}>{ten}</span>
                <span className="whitespace-nowrap text-right">{giaTri}</span>
              </div>
            ))}
          </div>
        ) : null}
        {ghiChu ? <p className="mt-2.5 text-bo-muted">{ghiChu}</p> : null}
        {lienKet ? (
          <Link
            to={lienKet.to}
            className="mt-2.5 inline-flex items-center gap-0.5 font-medium text-bo-primary hover:text-bo-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
          >
            {lienKet.ten}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
