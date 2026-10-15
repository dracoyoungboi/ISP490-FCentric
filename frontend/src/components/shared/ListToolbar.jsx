import { useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Hàng đầu khung bảng của trang danh sách (bố cục A+G): tab trạng thái bên trái,
 * tìm kiếm và bộ lọc bên phải, chung một hàng khi đủ chỗ.
 * Không đủ chỗ thì tách hai tầng: tab ở tầng trên, bộ lọc xuống tầng dưới trải hết chiều ngang
 * (ô tìm kiếm giãn ra lấp chỗ trống), giữa hai tầng có đường kẻ, gạch chân tab nằm trên đường kẻ đó.
 * Truyền vào `toolbar` của TableShell.
 * - onClear: hiện nút "Xóa lọc" khi `hasFilter` (chỉ khi đang lọc).
 */
export default function ListToolbar({ tabs, children, hasFilter = false, onClear, className }) {
  const khungRef = useRef(null);
  const tabsRef = useRef(null);
  const locRef = useRef(null);
  const [haiTang, setHaiTang] = useState(false);
  const coTab = Boolean(tabs);

  // Đo sau khi trình duyệt tự xuống dòng: khối lọc nằm dưới hàng tab thì bật kiểu hai tầng.
  // Kiểu hai tầng chỉ đổi độ giãn và đường kẻ, không đổi độ rộng gốc của các khối,
  // nên không làm trình duyệt đổi lại cách xuống dòng (không nhấp nháy qua lại).
  useLayoutEffect(() => {
    const khung = khungRef.current;
    if (!coTab || !khung) return undefined;
    const kiemTra = () => {
      const tab = tabsRef.current?.getBoundingClientRect();
      const loc = locRef.current?.getBoundingClientRect();
      if (!tab || !loc) return;
      setHaiTang(loc.top >= tab.bottom - 2);
    };
    kiemTra();
    // Đổi giữa một hàng và hai tầng luôn làm đổi chiều cao khung, nên chỉ cần theo dõi khung
    const quanSat = new ResizeObserver(kiemTra);
    quanSat.observe(khung);
    return () => quanSat.disconnect();
  }, [coTab]);
  // Không có tab thì không có gì để tách tầng (bỏ qua giá trị đo cũ nếu trang vừa ẩn tab)
  const dangHaiTang = coTab && haiTang;

  return (
    <div
      ref={khungRef}
      data-hai-tang={dangHaiTang || undefined}
      className={cn("flex flex-wrap items-center gap-x-3 border-b border-bo-border px-3 sm:px-4", className)}
    >
      {coTab ? (
        // relative z-[1]: gạch chân tab đang chọn vẽ đè lên đường kẻ giữa hai tầng
        <div ref={tabsRef} className="relative z-[1] min-w-0 max-w-full">
          {tabs}
        </div>
      ) : null}
      <div
        ref={locRef}
        className={cn(
          "ml-auto flex w-full flex-wrap items-center justify-end gap-2 py-2 sm:w-auto",
          dangHaiTang && [
            "relative grow justify-start",
            // Đường kẻ giữa hai tầng, tràn hết bề ngang khung (bù phần đệm px-3 / sm:px-4)
            "before:absolute before:inset-x-[-0.75rem] before:top-0 before:h-px before:bg-bo-border sm:before:inset-x-[-1rem]",
            // Ô tìm kiếm giãn ra lấp chỗ trống của tầng dưới
            "[&>label:has(>input[type=search])]:grow [&>label:has(>input[type=search])]:max-w-none",
          ],
        )}
      >
        {children}
        {hasFilter && onClear ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onClear}
            className="h-9 gap-1.5 px-2.5 text-sm font-normal text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground"
          >
            <X className="size-4" />
            Xóa lọc
          </Button>
        ) : null}
      </div>
    </div>
  );
}
