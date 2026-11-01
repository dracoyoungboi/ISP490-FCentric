import { useState } from "react";
import { X } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/**
 * Sheet trượt từ đáy (điện thoại): tiêu đề + nút đóng 44px, thân tự cuộn, chân cố định có khoảng an toàn đáy máy.
 * Dùng vaul (components/ui/drawer) đã có; màu theo token bo-* vì token shadcn (bg-background…) chưa khai báo.
 * - `kichHoat`: nút mở sheet (bọc DrawerTrigger → có aria-expanded, đóng sheet thì tiêu điểm về lại nút này).
 * - `mo` / `onDoiMo`: điều khiển từ ngoài; bỏ trống thì sheet tự giữ trạng thái.
 * - `chan`: các nút ở chân sheet (nút chính đặt cuối); truyền hàm `(dong) => …` khi nút cần đóng sheet.
 */
export default function SheetDay({ kichHoat, mo, onDoiMo, tieuDe, moTa, children, chan, className }) {
  const [moRieng, setMoRieng] = useState(false);
  const dangMo = mo ?? moRieng;
  const doiMo = onDoiMo ?? setMoRieng;
  const dong = () => doiMo(false);

  return (
    <Drawer open={dangMo} onOpenChange={doiMo}>
      {kichHoat ? <DrawerTrigger asChild>{kichHoat}</DrawerTrigger> : null}
      <DrawerContent
        className={cn(
          // Lớp của DrawerContent gắn theo data-[vaul-drawer-direction=bottom] nên phải cùng điều kiện mới đè được
          "border-bo-border bg-bo-surface font-backoffice text-bo-foreground",
          "data-[vaul-drawer-direction=bottom]:max-h-[88dvh] data-[vaul-drawer-direction=bottom]:rounded-t-2xl",
          "[&>div:first-child]:mt-2 [&>div:first-child]:h-1 [&>div:first-child]:w-9 [&>div:first-child]:bg-slate-300",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2 pb-1 pl-4 pr-2 pt-1">
          <DrawerTitle className="text-[17px] font-semibold leading-6 text-bo-heading">{tieuDe}</DrawerTitle>
          <DrawerClose asChild>
            <button
              type="button"
              aria-label="Đóng"
              className="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </DrawerClose>
        </div>
        <DrawerDescription className="sr-only">{moTa || tieuDe}</DrawerDescription>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {chan ? (
          <div className="flex gap-2.5 border-t border-bo-border px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
            {typeof chan === "function" ? chan(dong) : chan}
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
