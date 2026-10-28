import { createElement } from "react";
import { ArrowDown, Store, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

function NutKho({ icon, ten, vaiTro, mau }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-md border border-bo-border bg-bo-surface px-2.5 py-2">
      <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md", mau)}>
        {createElement(icon, { className: "size-4", "aria-hidden": true })}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-5 text-bo-foreground" title={ten || undefined}>
          {ten || "—"}
        </span>
        <span className="block text-xs leading-4 text-bo-muted">{vaiTro}</span>
      </span>
    </div>
  );
}

/**
 * Tuyến chuyển ở cột thuộc tính (rà soát N12: một cách vẽ cho phiếu chuyển kho và phiếu xuất chuyển kho):
 * thẻ kho nguồn (xuất hàng) → mũi tên → thẻ kho đích (nhận hàng). `ghiChu`: một dòng nhỏ dưới tuyến,
 * vd. "Hàng đi qua kho Trung chuyển trong lúc vận chuyển". Đặt trong NhomThuocTinh nhan="Tuyến chuyển".
 */
export default function TuyenChuyen({ khoNguon, khoDich, ghiChu, className }) {
  return (
    <div className={cn("grid gap-0.5", className)}>
      <NutKho icon={Warehouse} ten={khoNguon} vaiTro="Kho nguồn · xuất hàng" mau="bg-bo-primary-soft text-bo-primary" />
      <div aria-hidden="true" className="flex h-[22px] items-center pl-4 text-slate-400">
        <ArrowDown className="size-4" />
      </div>
      <NutKho icon={Store} ten={khoDich} vaiTro="Kho đích · nhận hàng" mau="bg-bo-success-soft text-bo-success" />
      {ghiChu ? <p className="mt-2 text-xs leading-[18px] text-bo-muted">{ghiChu}</p> : null}
    </div>
  );
}
