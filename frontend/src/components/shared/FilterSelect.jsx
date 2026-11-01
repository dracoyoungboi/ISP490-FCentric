import { useContext, useId } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocTrongSheetContext } from "@/components/shared/locTrongSheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Ô chọn trong thanh lọc, cùng kiểu DropdownMenu ở DonBanHangList / PhieuXuatKhoList.
 *
 * - `onClear` (tuỳ chọn): khi đang chọn khác lựa chọn đầu tiên (thường là "Tất cả …"), nút × thay chỗ mũi tên
 *   để bỏ riêng bộ lọc này mà không phải mở menu. `clearLabel` là nhãn đọc màn hình của nút ×.
 *   Có `onClear` thì `className` đặt cho khung bọc (độ rộng), không phải cho nút.
 */
export default function FilterSelect({
  value,
  options,
  onChange,
  label,
  className,
  disabled = false,
  align = "start",
  onClear,
  clearLabel,
}) {
  const current = options.find((option) => option.value === value) ?? options[0];
  const coXoa = Boolean(onClear) && !disabled && current !== options[0];
  const trongSheet = useContext(LocTrongSheetContext);
  const ten = useId();

  // Trong sheet "Bộ lọc" trên điện thoại: danh sách chọn một, mỗi dòng cao 48px, chọn là áp ngay
  if (trongSheet) {
    return (
      <fieldset disabled={disabled} className="min-w-0">
        <legend className="mb-2 text-[13px] font-semibold text-bo-muted">{label}</legend>
        <div className="overflow-hidden rounded-lg border border-bo-border">
          {options.map((option) => {
            const chon = option.value === current?.value;
            return (
              <label
                key={option.value}
                className="flex min-h-12 cursor-pointer items-center gap-3 border-t border-bo-border px-3.5 text-[15px] first:border-t-0 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-bo-primary"
              >
                <input
                  type="radio"
                  name={ten}
                  className="sr-only"
                  checked={chon}
                  onChange={() => onChange(option.value)}
                />
                <span className={cn("flex-1", chon && "font-semibold")}>{option.label}</span>
                {chon ? <Check className="size-[18px] text-bo-primary" aria-hidden="true" /> : null}
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  const menu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={onClear ? `${label}: ${current?.label ?? ""}` : label}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between gap-2 border-bo-border bg-bo-surface px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle",
            onClear ? coXoa && "pr-10" : ["sm:w-[190px]", className],
          )}
        >
          <span className="truncate">{current?.label}</span>
          {coXoa ? null : <ChevronDown className="size-4 shrink-0 opacity-60" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="z-50 min-w-[200px] rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg"
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
          >
            {option.label}
            {option.value === value ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!onClear) return menu;

  return (
    <div className={cn("relative w-full sm:w-[190px]", className)}>
      {menu}
      {coXoa ? (
        <button
          type="button"
          onClick={onClear}
          aria-label={clearLabel || `Bỏ lọc ${label?.toLocaleLowerCase("vi-VN") ?? ""}`.trim()}
          title={clearLabel || undefined}
          className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-bo-muted hover:bg-slate-100 hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
