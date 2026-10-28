import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { NUT_CHINH, NUT_PHU } from "./kieuNhap";

const RONG = { vua: "sm:max-w-[560px]", rong: "sm:max-w-[720px]" };

/**
 * Khung chung của các hộp trên trang Vị trí kệ: tiêu đề + mô tả, thân là form, chân có Hủy và nút chính.
 * Nhấn Enter trong ô nhập là bấm nút chính.
 */
export function KhungHop({ tieuDe, moTa, rong = "vua", onHuy, onGui, nhanGui, dangGui = false, khoaGui = false, chanTrai, children }) {
  return (
    <DialogContent className={cn("flex max-h-[calc(100dvh-4rem)] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0", RONG[rong] ?? RONG.vua)}>
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (!dangGui && !khoaGui) onGui?.();
        }}
      >
        <DialogHeader className="shrink-0 border-b border-bo-border px-6 py-4 text-left">
          <DialogTitle className="text-base text-bo-foreground">{tieuDe}</DialogTitle>
          {moTa ? <DialogDescription className="text-[13px] text-bo-muted">{moTa}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">{children}</div>
        <DialogFooter className="shrink-0 items-center border-t border-bo-border bg-bo-surface-subtle px-6 py-3 sm:justify-between">
          <div className="min-w-0 text-[13px] text-bo-muted">{chanTrai}</div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onHuy} disabled={dangGui} className={NUT_PHU}>
              Hủy
            </Button>
            {onGui ? (
              <Button type="submit" disabled={dangGui || khoaGui} className={cn("min-w-28 gap-1.5", NUT_CHINH)}>
                {dangGui ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {nhanGui}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/** Một trường: nhãn trên, ô nhập, dòng gợi ý hoặc lỗi dưới. */
export function Truong({ nhan, htmlFor, loi, goiY, className, children }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {nhan ? (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-bo-foreground">
          {nhan}
        </label>
      ) : null}
      {children}
      {loi ? (
        <p id={htmlFor ? `${htmlFor}-loi` : undefined} className="text-xs text-bo-danger">
          {loi}
        </p>
      ) : goiY ? (
        <p className="text-xs text-bo-muted">{goiY}</p>
      ) : null}
    </div>
  );
}

/**
 * Nhóm nút chọn một trong vài giá trị (kiểu segmented). luaChon: [{ ma, ten }].
 * `day`: các nút chia đều hết bề ngang (dùng trong hộp); mặc định co theo chữ.
 */
export function NhomChon({ nhan, value, onChange, luaChon, day = false, className }) {
  return (
    <div
      role="group"
      aria-label={nhan}
      className={cn(
        "inline-flex max-w-full gap-0.5 overflow-x-auto rounded-md border border-bo-border bg-bo-surface-subtle p-0.5 [scrollbar-width:none]",
        day && "grid w-full",
        className,
      )}
      style={day ? { gridTemplateColumns: `repeat(${luaChon.length}, minmax(0, 1fr))` } : undefined}
    >
      {luaChon.map((lc) => {
        const chon = lc.ma === value;
        return (
          <button
            key={lc.ma}
            type="button"
            aria-pressed={chon}
            onClick={() => onChange(lc.ma)}
            className={cn(
              "h-8 shrink-0 whitespace-nowrap rounded-[5px] px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
              chon ? "bg-bo-surface font-medium text-bo-heading shadow-sm" : "text-bo-muted hover:text-bo-foreground",
            )}
          >
            {lc.ten}
          </button>
        );
      })}
    </div>
  );
}
