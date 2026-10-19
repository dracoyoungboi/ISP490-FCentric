import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Store, Warehouse } from "lucide-react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { getMineKhoList } from "@/services/khoService";
import { laKhoGiaoDich, laKhoTong } from "@/utils/kho";
import { KHO_LAM_VIEC_EVENT, getKhoLamViecId, setKhoLamViecId } from "@/utils/khoLamViec";

/**
 * Ô "Nơi làm việc" (kho làm việc) ở đáy sidebar cho vai trò làm việc theo kho mà không có mục Cấu hình
 * (nhân viên kho, bán hàng, mua hàng): luôn thấy mình đang làm ở đâu. Biểu tượng theo loại kho:
 * kho tổng là nhà kho, còn lại là cửa hàng.
 * - Có từ 2 kho giao dịch trở lên (hoặc chưa chọn kho) thì bấm để đổi; đổi xong các trang
 *   đang theo kho tự tải lại qua sự kiện KHO_LAM_VIEC_EVENT.
 * - Thu gọn sidebar: còn biểu tượng, rê chuột hiện tên kho qua tooltip dùng chung của sidebar.
 * Props từ BackofficeSidebar: isExpanded, layoutClass, fadeClass, onShowTooltip, onHideTooltip.
 */
export default function SidebarKhoLamViec({ isExpanded, layoutClass, fadeClass, onShowTooltip, onHideTooltip }) {
  const [dsKho, setDsKho] = useState([]);
  const [khoId, setKhoId] = useState(getKhoLamViecId);

  useEffect(() => {
    let huy = false;
    getMineKhoList()
      .then((ds) => {
        if (!huy) setDsKho((ds ?? []).filter(laKhoGiaoDich));
      })
      .catch(() => {
        if (!huy) setDsKho([]);
      });
    return () => {
      huy = true;
    };
  }, []);

  useEffect(() => {
    const nghe = (event) => setKhoId(event.detail ?? null);
    window.addEventListener(KHO_LAM_VIEC_EVENT, nghe);
    return () => window.removeEventListener(KHO_LAM_VIEC_EVENT, nghe);
  }, []);

  // Chưa tải xong hoặc không có kho nào: không hiện để tránh nhấp nháy
  if (dsKho.length === 0) return null;

  const khoHienTai = dsKho.find((kho) => kho.id === khoId) ?? null;
  const tenKho = khoHienTai?.tenKho ?? "Chưa chọn kho";
  const doiDuoc = dsKho.length > 1 || !khoHienTai;

  const tooltipProps = isExpanded
    ? {}
    : {
        onPointerOver: (event) => onShowTooltip(event, tenKho, "Nơi làm việc"),
        onPointerOut: onHideTooltip,
        onFocus: (event) => onShowTooltip(event, tenKho, "Nơi làm việc"),
        onBlur: onHideTooltip,
      };

  const noiDung = (
    <>
      {khoHienTai && !laKhoTong(khoHienTai) ? (
        <Store className="size-[18px]" aria-hidden="true" />
      ) : (
        <Warehouse className="size-[18px]" aria-hidden="true" />
      )}
      <span data-nhan className={cn("min-w-0 flex-1 text-left", fadeClass)}>
        <span className="block truncate text-[11px] leading-4 text-bo-sidebar-muted">Nơi làm việc</span>
        <span className="block truncate text-[13px] leading-4 font-medium text-white">{tenKho}</span>
      </span>
      {doiDuoc ? <ChevronsUpDown className={cn("ml-auto size-4 opacity-70", fadeClass)} aria-hidden="true" /> : null}
    </>
  );

  const nutClass = cn(layoutClass, "h-11 text-bo-sidebar-muted hover:bg-bo-sidebar-hover hover:text-white");

  if (!doiDuoc) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          className={cn(nutClass, "cursor-default hover:bg-transparent hover:text-bo-sidebar-muted")}
          aria-label={`Nơi làm việc: ${tenKho}`}
          {...tooltipProps}
        >
          {noiDung}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  const chonKho = (kho) => {
    if (kho.id === khoId) return;
    setKhoId(kho.id);
    setKhoLamViecId(kho.id);
    toast.success(`Đã chuyển sang ${kho.tenKho}.`);
  };

  return (
    <SidebarMenuItem>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            className={cn(nutClass, "data-[state=open]:bg-bo-sidebar-hover data-[state=open]:text-white")}
            aria-label={`Nơi làm việc: ${tenKho}. Bấm để đổi nơi làm việc`}
            {...tooltipProps}
          >
            {noiDung}
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={isExpanded ? "top" : "right"}
          align={isExpanded ? "start" : "end"}
          sideOffset={8}
          className="z-[90] w-[240px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
        >
          <p className="px-2.5 pt-1.5 pb-1 text-xs text-bo-muted">
            Đổi nơi làm việc. Các trang theo kho sẽ hiện số liệu của nơi này.
          </p>
          {dsKho.map((kho) => (
            <DropdownMenuItem
              key={kho.id}
              onClick={() => chonKho(kho)}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
            >
              <span className="truncate">{kho.tenKho}</span>
              {kho.id === khoId ? <Check className="size-4 shrink-0 text-bo-primary" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
