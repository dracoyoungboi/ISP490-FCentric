import {
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

import UserAvatar from "@/components/UserAvatar";
import NotificationBell from "@/components/backoffice/NotificationBell";
import GlobalSearch from "@/components/backoffice/GlobalSearch";
import { useCurrentUserAvatarUrl } from "@/utils/avatar";
import { nguoiDungService } from "@/services/nguoiDungService";
import { xinRoiTrang } from "@/lib/chanRoiTrang";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import ConfirmModal from "@/components/ui/confirm-modal";
import { demLuotChuaKhoa } from "@/utils/hangLoiTam";

// Phím tắt mở ô tìm kiếm: ⌘ + K trên máy Mac, Ctrl + K trên Windows/Linux
const PHIM_TAT =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || "") ? "⌘ + K" : "Ctrl + K";

const ROLE_LABELS = {
  quan_tri_vien: "Quản trị viên",
  quan_ly_kho: "Quản lý kho",
  nhan_vien_kho: "Nhân viên kho",
  nhan_vien_mua_hang: "Nhân viên mua hàng",
  nhan_vien_ban_hang: "Nhân viên bán hàng",
};

export default function BackofficeHeader() {
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
  let username = "Quản trị viên";

  if (token) {
    try {
      const payload = jwtDecode(token);
      userId = payload.userId || payload.id || payload.sub;
      username = payload.tenDangNhap || payload.username || "Quản trị viên";
    } catch (error) {
      console.error("Invalid token", error);
    }
  }

  // Ảnh đại diện lấy từ cache hồ sơ (login response / GET /me) — tự cập nhật
  // ngay khi đổi ảnh mà không cần đăng nhập lại
  const avatarUrl = useCurrentUserAvatarUrl(userId);

  // Số lượt quét chưa khóa lô khi bấm Đăng xuất (> 0 thì hỏi lại trước khi xóa phiên). Đóng hộp chỉ tắt `hoiLuot`,
  // giữ số: hộp còn hiện trong lúc chạy hiệu ứng đóng, không nháy "Có 0 lượt quét…"
  const [luotChuaKhoa, setLuotChuaKhoa] = useState(0);
  const [hoiLuot, setHoiLuot] = useState(false);

  const dangXuat = () => {
    // Trang đang sửa dở (vd. trình sửa mẫu in) được hỏi trước khi đăng xuất
    xinRoiTrang(() => {
      // Chỉ xóa phiên đăng nhập; bản nháp hóa đơn POS (gắn theo tài khoản, hết hạn sau 12 giờ)
      // được giữ để đăng nhập lại vẫn còn hóa đơn và mã QR đang chờ.
      nguoiDungService.logout();
      sessionStorage.clear();
      navigate("/login");
    });
  };

  const handleLogout = () => {
    // Lô đang kiểm (màn Kiểm đếm) chỉ nằm trong bộ nhớ phiên: đăng xuất là mất các lượt chưa khóa lô
    const dem = demLuotChuaKhoa();
    if (dem > 0) {
      setLuotChuaKhoa(dem);
      setHoiLuot(true);
    } else {
      dangXuat();
    }
  };

  const sidebarOpen = isMobile ? openMobile : open;
  const roleLabel = ROLE_LABELS[role] || "Thành viên hệ thống";

  return (
    <header id="backoffice-header" className="sticky top-0 z-40 shrink-0 border-b border-bo-border bg-bo-surface">
      <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {/* Nút mở menu chỉ còn trên điện thoại (menu là ngăn kéo).
              Trên máy tính, nút thu gọn nằm ở đầu sidebar, cạnh logo (BackofficeSidebar.jsx). */}
          {isMobile ? (
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
          ) : null}

          {/* Tìm kiếm toàn hệ thống thay cho breadcrumb; tên trang nằm ở hàng tiêu đề trong trang */}
          <GlobalSearch
            userId={userId}
            role={role}
            isPhone={isMobile}
            placeholder={isMobile ? "Tìm kiếm" : `Tìm kiếm (${PHIM_TAT})`}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Chuông thông báo của người đang đăng nhập (API /api/v1/thong-bao, xem thongBaoService.js) */}
          <NotificationBell />

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
              className="z-50 w-56 rounded-lg border border-bo-border bg-bo-surface p-1 text-bo-foreground shadow-lg"
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
      </div>
      <ConfirmModal
        isOpen={hoiLuot}
        onClose={() => setHoiLuot(false)}
        onConfirm={() => {
          setHoiLuot(false);
          dangXuat();
        }}
        title="Còn lượt quét chưa khóa lô"
        description={`Có ${luotChuaKhoa} lượt quét ở màn Kiểm đếm chưa khóa lô. Đăng xuất bây giờ sẽ mất các lượt này, phải đếm lại thùng đó. Quay lại màn Kiểm đếm để khóa lô trước khi đăng xuất.`}
        confirmText="Vẫn đăng xuất"
        cancelText="Quay lại"
      />
    </header>
  );
}
