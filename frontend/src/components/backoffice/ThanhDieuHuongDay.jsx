import { createElement } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  Package,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { getStoredRoles } from "@/utils/roles";
import { useBanPhimAoMo } from "@/hooks/useBanPhimAo";
import { useTaiTruocLienKet } from "@/lib/taiTrang";
import { cn } from "@/lib/utils";

/**
 * Thanh điều hướng đáy trên điện thoại (< 768px): 3–4 việc chính của vai trò + "Menu" mở ngăn kéo menu đầy đủ
 * (sidebar hiện có). Chỉ hiện ở trang cấp đầu (danh sách, Tổng quan); trang chi tiết / tạo mới dùng thanh thao tác đáy.
 * Đường dẫn và nhãn lấy đúng như menu bên trái; phân quyền vẫn do route và máy chủ chặn.
 */
const TONG_QUAN = { nhan: "Tổng quan", icon: LayoutDashboard, to: "/dashboard" };
const THEO_VAI_TRO = [
  ["quan_tri_vien", [
    TONG_QUAN,
    { nhan: "Đơn bán", icon: ShoppingCart, to: "/sales-orders" },
    { nhan: "Tồn kho", icon: Package, to: "/reports/inventory" },
    { nhan: "Báo cáo", icon: BarChart3, to: "/reports/revenue", khop: (p) => p.startsWith("/reports/") && p !== "/reports/inventory" },
  ]],
  ["quan_ly_kho", [
    TONG_QUAN,
    { nhan: "Yêu cầu", icon: FileText, to: "/purchase-requests" },
    { nhan: "Chuyển kho", icon: ArrowLeftRight, to: "/transfer-tickets" },
    { nhan: "Tồn kho", icon: Package, to: "/reports/inventory" },
  ]],
  ["nhan_vien_kho", [
    TONG_QUAN,
    { nhan: "Nhặt hàng", icon: ClipboardList, to: "/goods-issues/pick-lists" },
    { nhan: "Nhận hàng", icon: ArrowDownToLine, to: "/goods-receipts" },
    { nhan: "Kiểm kê", icon: ClipboardCheck, to: "/stock-take" },
  ]],
  ["nhan_vien_ban_hang", [
    TONG_QUAN,
    { nhan: "Đơn bán", icon: ShoppingCart, to: "/sales-orders" },
    { nhan: "Khách hàng", icon: Users, to: "/customers" },
  ]],
  ["nhan_vien_mua_hang", [
    TONG_QUAN,
    { nhan: "Yêu cầu", icon: FileText, to: "/purchase-requests" },
    { nhan: "Đơn mua", icon: Truck, to: "/purchase-orders" },
    { nhan: "Nhà cung cấp", icon: Users, to: "/supplier" },
  ]],
];

const LINK_THANH_DAY = "nav[data-thanh-dieu-huong-day] a[href]";

function mucThanhDay() {
  const vaiTro = getStoredRoles();
  return THEO_VAI_TRO.find(([ma]) => vaiTro.includes(ma))?.[1] ?? [TONG_QUAN];
}

export default function ThanhDieuHuongDay() {
  const { pathname } = useLocation();
  const { openMobile, setOpenMobile } = useSidebar();
  const muc = mucThanhDay();
  const dangChon = (m) => (m.khop ? m.khop(pathname) : pathname === m.to || pathname.startsWith(`${m.to}/`));
  // Đang gõ (bàn phím ảo mở): ẩn thanh để không bị bàn phím che / trôi giữa màn; đóng bàn phím là hiện lại
  const banPhimMo = useBanPhimAoMo();
  // Như menu trái: chạm xuống một mục là tải trước trang đó, nhấc tay ra thì trang hiện ngay
  useTaiTruocLienKet(LINK_THANH_DAY);

  return (
    <nav
      aria-label="Điều hướng chính"
      data-thanh-dieu-huong-day=""
      // Số cột = số mục của vai trò + Menu (bán hàng 3 mục, các vai trò khác 4)
      style={{ gridTemplateColumns: `repeat(${muc.length + 1}, minmax(0, 1fr))` }}
      className={cn(
        "no-print fixed inset-x-0 bottom-0 z-40 grid border-t border-bo-border bg-bo-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(15,23,42,0.04)] md:hidden",
        banPhimMo && "hidden",
      )}
    >
      {muc.map((m) => {
        const chon = !openMobile && dangChon(m);
        return (
          <Link
            key={m.to}
            to={m.to}
            onClick={() => setOpenMobile(false)}
            aria-current={chon ? "page" : undefined}
            className={cn(
              "flex h-14 min-w-0 flex-col items-center justify-center gap-1 text-[11.5px] font-medium leading-none",
              chon ? "text-bo-primary" : "text-slate-500",
            )}
          >
            {createElement(m.icon, { className: "size-[22px]", strokeWidth: chon ? 2.25 : 2, "aria-hidden": true })}
            <span className={cn("max-w-full truncate px-0.5", chon && "font-semibold")}>{m.nhan}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setOpenMobile(!openMobile)}
        aria-expanded={openMobile}
        aria-controls="backoffice-navigation"
        className={cn(
          "flex h-14 min-w-0 flex-col items-center justify-center gap-1 text-[11.5px] font-medium leading-none",
          openMobile ? "text-bo-primary" : "text-slate-500",
        )}
      >
        <LayoutGrid className="size-[22px]" aria-hidden="true" />
        <span className={cn(openMobile && "font-semibold")}>Menu</span>
      </button>
    </nav>
  );
}
