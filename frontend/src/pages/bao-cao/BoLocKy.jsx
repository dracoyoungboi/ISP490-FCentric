import { useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FOCUS, MENU } from "@/pages/dashboard/admin/tong-quan-moi/boLoc";
import { cn } from "@/lib/utils";
import { loiKhoangNgay, ngayMay } from "./tinhBaoCaoDoanhThu";

// Ô chọn kho, cách xem, kỳ dùng chung cho các báo cáo theo kỳ (Báo cáo doanh thu, Báo cáo nhập xuất).
export const MUC = "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] text-slate-700 focus:bg-bo-surface-subtle focus:text-bo-foreground";
export const NUT_KY = cn(FOCUS, "inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-1 rounded-md border border-bo-border bg-white px-2 text-sm font-medium text-bo-foreground shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-bo-surface-subtle");
export const O_NGAY = "h-[30px] min-w-0 rounded-md border border-bo-border bg-white px-2 text-sm text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15";

export function Menu({ nhan, ariaLabel, children, rong = "w-60", align = "start", icon = false, className }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={ariaLabel} className={className ?? NUT_KY}>
          {icon ? <CalendarDays className="size-4 text-bo-muted" aria-hidden="true" /> : null}
          <span className="truncate">{nhan}</span>
          <ChevronDown className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} sideOffset={6} className={cn(MENU, rong)}>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Muc({ chon, onChon, ten, phu }) {
  return (
    <DropdownMenuItem onClick={onChon} className={MUC}>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate", chon ? "font-medium text-bo-primary-hover" : "text-bo-foreground")}>{ten}</span>
        {phu ? <span className="block text-xs text-bo-muted">{phu}</span> : null}
      </span>
      {chon ? <Check className="size-4 shrink-0 text-bo-primary" aria-hidden="true" /> : <span className="size-4 shrink-0" />}
    </DropdownMenuItem>
  );
}

/**
 * Hai ô ngày của khoảng tùy chọn: giữ bản nhập riêng, chỉ đưa lên bộ lọc khi hợp lệ (năm gõ dở như 0002, quá 1 năm, sau
 * hôm nay thì báo dưới ô, không gọi máy chủ).
 */
export function KhoangTuyChon({ khoang, onDoi }) {
  const [nhap, setNhap] = useState(khoang);
  const loi = loiKhoangNgay(nhap.tuNgay, nhap.denNgay);
  const homNay = ngayMay(new Date());
  const doi = (x) => {
    const moi = { ...nhap, ...x };
    setNhap(moi);
    if (!loiKhoangNgay(moi.tuNgay, moi.denNgay)) onDoi(moi);
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <label className="sr-only" htmlFor="bc-tu-ngay">Từ ngày</label>
        <input aria-describedby={loi ? "bc-loi-ngay" : undefined} aria-invalid={loi ? true : undefined} className={O_NGAY} id="bc-tu-ngay" max={nhap.denNgay || homNay} min="2000-01-01" onChange={(e) => doi({ tuNgay: e.target.value })} type="date" value={nhap.tuNgay} />
        <span className="text-bo-muted" aria-hidden="true">–</span>
        <label className="sr-only" htmlFor="bc-den-ngay">Đến ngày</label>
        <input aria-describedby={loi ? "bc-loi-ngay" : undefined} aria-invalid={loi ? true : undefined} className={O_NGAY} id="bc-den-ngay" max={homNay} min={nhap.tuNgay || "2000-01-01"} onChange={(e) => doi({ denNgay: e.target.value })} type="date" value={nhap.denNgay} />
      </div>
      {loi ? <p className="text-xs text-bo-danger" id="bc-loi-ngay" role="alert">{loi}</p> : null}
    </div>
  );
}

