import { Check, RefreshCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { KY_OPTIONS, gioPhut } from "../tong-quan/tongQuanFormat";
import { FOCUS, KHUNG, MENU, NHAN_KY, dsKhoDayDu, khoangKy } from "./boLoc";

/* Thanh lọc Tổng quan: menu chọn kho (tách Kho tổng / Cửa hàng), menu chọn kỳ (kèm khoảng ngày thật), nút cập nhật. */

const MUC = "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] text-slate-700 focus:bg-bo-surface-subtle focus:text-bo-foreground";
const NHOM = "px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";

function MucKho({ id, ten, phu, khoId, onChange }) {
  return (
    <DropdownMenuItem onClick={() => onChange(id)} className={MUC}>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{ten}</span>
        {phu ? <span className="block text-xs text-bo-muted">{phu}</span> : null}
      </span>
      {khoId === id ? <Check className="size-4 shrink-0 text-bo-primary" aria-hidden="true" /> : <span className="size-4 shrink-0" />}
    </DropdownMenuItem>
  );
}

export function KhoMenu({ data, dsKho, khoId, onChange, disabled, children, align = "start" }) {
  const ds = dsKhoDayDu(data, dsKho);
  const khoTong = ds.filter((k) => k.laKhoTong);
  const cuaHang = ds.filter((k) => !k.laKhoTong);
  const chung = { khoId, onChange };
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} sideOffset={6} className={cn(MENU, "w-72")}>
        <MucKho id={null} ten="Tất cả kho" phu={`${ds.length} kho, không tính kho trung chuyển`} {...chung} />
        {khoTong.length ? (
          <>
            <DropdownMenuSeparator className="my-1 bg-bo-border" />
            <DropdownMenuLabel className={NHOM}>Kho tổng</DropdownMenuLabel>
            {khoTong.map((k) => <MucKho key={k.id} id={k.id} ten={k.tenKho} {...chung} />)}
          </>
        ) : null}
        {cuaHang.length ? (
          <>
            <DropdownMenuSeparator className="my-1 bg-bo-border" />
            <DropdownMenuLabel className={NHOM}>Cửa hàng</DropdownMenuLabel>
            {cuaHang.map((k) => <MucKho key={k.id} id={k.id} ten={k.tenKho} {...chung} />)}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function KyMenu({ ky, onChange, thoiDiem, children, align = "start" }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} sideOffset={6} className={cn(MENU, "w-72")}>
        {KY_OPTIONS.map((o) => {
          const k = khoangKy(o.value, thoiDiem);
          return (
            <DropdownMenuItem key={o.value} onClick={() => onChange(o.value)} className={MUC}>
              <span className="min-w-0 flex-1">
                <span className={cn("block font-medium", ky === o.value ? "text-bo-primary-hover" : "text-bo-foreground")}>{NHAN_KY[o.value]}</span>
                <span className="block text-xs tabular-nums text-bo-muted">{k.day}</span>
              </span>
              {ky === o.value ? <Check className="size-4 shrink-0 text-bo-primary" aria-hidden="true" /> : <span className="size-4 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator className="my-1 bg-bo-border" />
        <p className="px-2.5 py-1.5 text-xs leading-5 text-bo-muted">Số liệu tính đến hết hôm qua. 7 và 30 ngày so với số ngày liền trước; 12 tháng so với cùng kỳ năm trước.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Nút cập nhật dạng biểu tượng; rê chuột hiện giờ số liệu. */
export function NutCapNhat({ data, refreshing, onReload }) {
  const gio = data?.thoiDiem ? gioPhut(data.thoiDiem) : null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onReload}
          disabled={refreshing}
          aria-label={gio ? `Cập nhật số liệu (số liệu lúc ${gio})` : "Cập nhật số liệu"}
          className={cn(KHUNG, FOCUS, "inline-flex size-9 shrink-0 items-center justify-center p-0 text-slate-500 hover:text-bo-foreground")}
        >
          <RefreshCcw className={cn("size-4", refreshing && "animate-spin")} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="bg-bo-sidebar text-white [&>span>svg]:bg-bo-sidebar [&>span>svg]:fill-bo-sidebar">
        Cập nhật{gio ? ` · số liệu lúc ${gio}` : ""}
      </TooltipContent>
    </Tooltip>
  );
}
