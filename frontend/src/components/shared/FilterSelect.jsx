import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Ô chọn trong thanh lọc, cùng kiểu DropdownMenu ở DonBanHangList / PhieuXuatKhoList. */
export default function FilterSelect({
  value,
  options,
  onChange,
  label,
  className,
  disabled = false,
  align = "start",
}) {
  const current = options.find((option) => option.value === value) ?? options[0];
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={label}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle sm:w-[190px]",
            className,
          )}
        >
          <span className="truncate">{current?.label}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="backoffice-user-menu z-50 min-w-[200px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
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
}
