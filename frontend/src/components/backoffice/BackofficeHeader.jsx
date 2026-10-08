import {
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

import UserAvatar from "@/components/UserAvatar";
import { useCurrentUserAvatarUrl } from "@/utils/avatar";
import { nguoiDungService } from "@/services/nguoiDungService";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";

const ROLE_LABELS = {
  quan_tri_vien: "Quản trị viên",
  quan_ly_kho: "Quản lý kho",
  nhan_vien_kho: "Nhân viên kho",
  nhan_vien_mua_hang: "Nhân viên mua hàng",
  nhan_vien_ban_hang: "Nhân viên bán hàng",
};

export default function BackofficeHeader({ title, subtitle, routeKey }) {
  const {
    toggleSidebar,
    open,
    isMobile,
    openMobile,
  } = useSidebar();
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");
  const role = localStorage.getItem("role");

  let userId = null;
  let username = "Admin";

  if (token) {
    try {
      const payload = jwtDecode(token);
      userId = payload.userId || payload.id || payload.sub;
      username = payload.tenDangNhap || payload.username || "Admin";
    } catch (error) {
      console.error("Invalid token", error);
    }
  }

  // Ảnh đại diện lấy từ cache hồ sơ (login response / GET /me) — tự cập nhật
  // ngay khi đổi ảnh mà không cần đăng nhập lại
  const avatarUrl = useCurrentUserAvatarUrl(userId);

  const handleLogout = () => {
    // Chỉ xóa phiên đăng nhập; bản nháp hóa đơn POS (gắn theo tài khoản, hết hạn sau 12 giờ)
    // được giữ để đăng nhập lại vẫn còn hóa đơn và mã QR đang chờ.
    nguoiDungService.logout();
    sessionStorage.clear();
    navigate("/login");
  };

  const sidebarOpen = isMobile ? openMobile : open;
  const displayTitle =
    routeKey === "WAREHOUSE" ? "Quản lý kho hàng" : title || "FCentric";
  const roleLabel = ROLE_LABELS[role] || "Thành viên hệ thống";

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-bo-border bg-bo-surface">
      <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-4 lg:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "Thu gọn menu" : "Mở menu"}
            aria-expanded={sidebarOpen}
            aria-controls="backoffice-navigation"
            className="shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="size-5" />
            ) : (
              <PanelLeftOpen className="size-5" />
            )}
          </Button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
              <span className="hidden sm:inline">FCentric</span>
              <span className="hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="truncate normal-case tracking-normal text-bo-foreground">
                {displayTitle}
              </span>
            </div>
            {subtitle ? (
              <p className="hidden max-w-[60vw] truncate text-xs text-bo-muted md:block">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              type="button"
              className="h-10 max-w-[220px] shrink-0 gap-2 px-2 text-bo-foreground hover:bg-slate-100"
              aria-label="Mở menu tài khoản"
            >
              <UserAvatar userId={userId} name={username} avatarUrl={avatarUrl} size="xs" />

              <span className="hidden min-w-0 text-left sm:block">
                <span className="block truncate text-sm font-semibold leading-4">
                  {username}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-normal leading-3 text-bo-muted">
                  {roleLabel}
                </span>
              </span>
              <ChevronDown className="hidden size-4 text-bo-muted sm:block" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="backoffice-user-menu z-50 w-56 rounded-lg border border-bo-border bg-white p-1 text-bo-foreground shadow-lg"
          >
            <div className="px-2 py-2">
              <p className="truncate text-sm font-semibold">{username}</p>
              <p className="mt-0.5 truncate text-xs text-bo-muted">{roleLabel}</p>
            </div>

            <DropdownMenuSeparator className="bg-bo-border" />

            <DropdownMenuItem
              asChild
              disabled={!userId}
              className="cursor-pointer rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-950"
            >
              <Link to="/profile">
                <UserRound className="size-4 text-slate-500" />
                Hồ sơ
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-bo-border" />

            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer rounded-md px-2.5 py-2 text-sm text-bo-danger focus:bg-bo-danger-soft focus:text-bo-danger"
            >
              <LogOut className="size-4" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
