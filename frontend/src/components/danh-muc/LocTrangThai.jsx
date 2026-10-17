import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { LOC_MAC_DINH, LOC_TRANG_THAI } from "./cayDanhMuc";

// Đang hoạt động đứng đầu và là bộ lọc mặc định
const LUA_CHON_TRANG_THAI = [
  { value: LOC_TRANG_THAI.HOAT_DONG, label: "Đang hoạt động" },
  { value: LOC_TRANG_THAI.NGUNG, label: "Ngừng hoạt động" },
  { value: LOC_TRANG_THAI.TAT_CA, label: "Tất cả" },
];

/**
 * Ô lọc "Trạng thái: Đang hoạt động ▾" cạnh ô tìm (thay cho 3 tab). Menu có số đếm từng trạng thái.
 * Chọn khác mặc định (Ngừng hoạt động / Tất cả) thì nút tô xanh nhạt để thấy ngay bảng đang xem khác thường lệ.
 * `dem`: { [value]: số danh mục }.
 */
export default function LocTrangThai({ value, onChange, dem = {}, className }) {
  const hienTai = LUA_CHON_TRANG_THAI.find((o) => o.value === value) ?? LUA_CHON_TRANG_THAI[0];
  const dangLoc = hienTai.value !== LOC_MAC_DINH;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={`Lọc theo trạng thái: ${hienTai.label}`}
          className={cn(
            "h-9 w-full justify-between gap-2 px-3 text-sm font-normal sm:w-auto",
            dangLoc
              ? "border-[#b6d4fe] bg-bo-primary-soft text-bo-primary-hover hover:bg-bo-primary-soft hover:text-bo-primary-hover"
              : "border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle",
            className,
          )}
        >
          <span className="truncate">
            Trạng thái: <span className="font-semibold">{hienTai.label}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="z-50 w-[248px] rounded-lg border border-bo-border bg-white p-1 shadow-lg">
        {LUA_CHON_TRANG_THAI.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => onChange(o.value)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
          >
            <span className="flex-1">{o.label}</span>
            <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-semibold tabular-nums text-slate-600">
              {dem[o.value] ?? 0}
            </span>
            <span className="inline-flex w-4 justify-center">
              {o.value === hienTai.value ? <Check className="size-4 text-bo-primary" aria-hidden="true" /> : null}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
