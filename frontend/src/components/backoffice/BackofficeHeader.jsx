import {
  ChevronDown,
  LogOut,
  Menu,
  Store,
  UserRound,
  Warehouse,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { laTrangCapDau } from "@/components/backoffice/thanhDay";
import { hienKhoLamViecODaySidebar } from "@/components/backoffice/sidebar.config";
import { laKhoTong } from "@/utils/kho";
import { KHO_LAM_VIEC_EVENT, dsKhoLamViecTrongToken, getKhoLamViecId } from "@/utils/khoLamViec";
import { jwtDecode } from "jwt-decode";

import UserAvatar from "@/components/UserAvatar";
import NotificationBell from "@/components/backoffice/NotificationBell";
import GlobalSearch from "@/components/backoffice/GlobalSearch";
import { useCurrentUserProfile } from "@/utils/avatar";
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
import { NutChonNgonNguThanhTren } from "@/components/shared/ChonNgonNgu";
import { t } from "@/i18n";

// Phím tắt mở ô tìm kiếm: ⌘ K trên máy Mac, Ctrl K trên Windows/Linux (hiện thành nhãn phím ở góc phải ô tìm)
const PHIM_TAT =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || "") ? ["⌘", "K"] : ["Ctrl", "K"];

const ROLE_LABELS = {
  quan_tri_vien: t("Quản trị viên"),
  quan_ly_kho: t("Quản lý kho"),
  nhan_vien_kho: t("Nhân viên kho"),
  nhan_vien_mua_hang: t("Nhân viên mua hàng"),
  nhan_vien_ban_hang: t("Nhân viên bán hàng"),
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
  let tenTrongToken = null;

  if (token) {
    try {
      const payload = jwtDecode(token);
      userId = payload.userId || payload.id || payload.sub;
      tenTrongToken = payload.hoTen || payload.tenDangNhap || payload.username;
    } catch (error) {
      console.error("Invalid token", error);
    }
  }

  // Ảnh đại diện + họ tên lấy từ cache hồ sơ (login response / GET /me) — tự cập nhật
  // ngay khi đổi ảnh hay sửa họ tên mà không cần đăng nhập lại
  const profile = useCurrentUserProfile(userId);
  const avatarUrl = profile?.avatarUrl ?? null;
  const username = profile?.hoTen || tenTrongToken || t("Quản trị viên");

  // Số lượt quét chưa khóa lô khi bấm Đăng xuất (> 0 thì hỏi lại trước khi xóa phiên). Đóng hộp chỉ tắt `hoiLuot`,
  // giữ số: hộp còn hiện trong lúc chạy hiệu ứng đóng, không nháy "Có 0 lượt quét…"
  const [luotChuaKhoa, setLuotChuaKhoa] = useState(0);
  const [hoiLuot, setHoiLuot] = useState(false);

  const dangXuat = () => {
    // Trang đang sửa dở (vd. trình sửa mẫu in) được hỏi trước khi đăng xuất
    xinRoiTrang(async () => {
      // Thu hồi phiên ở máy chủ trước (best-effort) để thiết bị này biến khỏi "Thiết bị đang đăng nhập",
      // rồi mới xóa token phía trình duyệt. Bản nháp hóa đơn POS (gắn theo tài khoản, hết hạn sau 12 giờ)
      // được giữ để đăng nhập lại vẫn còn hóa đơn và mã QR đang chờ.
      await nguoiDungService.logoutServer();
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
  const roleLabel = ROLE_LABELS[role] || t("Thành viên hệ thống");

  // Điện thoại, trang cấp đầu: nút Menu nằm ở thanh điều hướng đáy, chỗ nút ☰ hiện nơi làm việc (bấm mở menu để đổi)
  const { pathname } = useLocation();
  const coThanhDay = isMobile && laTrangCapDau(pathname);
  const [khoId, setKhoId] = useState(getKhoLamViecId);
  useEffect(() => {
    const nghe = (event) => setKhoId(event.detail ?? null);
    window.addEventListener(KHO_LAM_VIEC_EVENT, nghe);
    return () => window.removeEventListener(KHO_LAM_VIEC_EVENT, nghe);
  }, []);
  const khoLamViec = coThanhDay && hienKhoLamViecODaySidebar(role)
    ? dsKhoLamViecTrongToken().find((kho) => kho.id === khoId) ?? null
    : null;

  return (
    <header id="backoffice-header" className="sticky top-0 z-40 shrink-0 border-b border-bo-border bg-bo-surface">
      <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {/* Nút mở menu chỉ còn trên điện thoại (menu là ngăn kéo).
              Trên máy tính, nút thu gọn nằm ở đầu sidebar, cạnh logo (BackofficeSidebar.jsx). */}
          {khoLamViec ? (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={t("Nơi làm việc: {{tenKho}}. Mở menu để đổi", { tenKho: khoLamViec.tenKho })}
              className="flex h-9 min-w-0 max-w-[62%] shrink-0 items-center gap-1.5 rounded-lg px-1.5 text-left text-slate-700 hover:bg-slate-100"
            >
              {laKhoTong(khoLamViec) ? (
                <Warehouse className="size-[18px] shrink-0 text-slate-500" aria-hidden="true" />
              ) : (
                <Store className="size-[18px] shrink-0 text-slate-500" aria-hidden="true" />
              )}
              <span className="min-w-0 truncate text-[13px] font-semibold leading-4">{khoLamViec.tenKho}</span>
              <ChevronDown className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            </button>
          ) : isMobile && !coThanhDay ? (
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? t("Thu gọn menu") : t("Mở menu")}
              aria-expanded={sidebarOpen}
              aria-controls="backoffice-navigation"
              className="size-10 shrink-0 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            >
              {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          ) : null}

          {/* Tìm kiếm toàn hệ thống thay cho breadcrumb; tên trang nằm ở hàng tiêu đề trong trang */}
          <GlobalSearch
            userId={userId}
            role={role}
            isPhone={isMobile}
            placeholder={isMobile ? (khoLamViec ? t("Tìm") : t("Tìm kiếm")) : t("Tìm theo mã, tên hoặc số điện thoại…")}
            phimTat={PHIM_TAT}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Cùng cỡ và màu với chuông bên cạnh; màn hẹp chỉ còn biểu tượng */}
          <NutChonNgonNguThanhTren className="h-10 min-w-10 rounded-md px-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" />

          {/* Chuông thông báo của người đang đăng nhập (API /api/v1/thong-bao, xem thongBaoService.js) */}
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                type="button"
                className="group h-10 max-w-[220px] shrink-0 gap-2 px-2 text-bo-foreground hover:bg-slate-100 data-[state=open]:bg-slate-100"
                aria-label={t("Mở menu tài khoản")}
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
                {/* Mũi tên lật lên khi menu mở, cùng kiểu với các nút xổ khác trong app */}
                <ChevronDown className="hidden size-3.5 text-bo-muted transition-transform group-hover:text-bo-foreground group-data-[state=open]:rotate-180 group-data-[state=open]:text-bo-foreground motion-reduce:transition-none sm:block" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={6}
              className="z-50 w-56 rounded-lg border border-bo-border bg-bo-surface p-1 text-bo-foreground shadow-lg"
            >
              <div className="px-2.5 py-2">
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
                  {t("Hồ sơ")}
                </Link>
              </DropdownMenuItem>

              {/* Một tông xám như các dòng khác; rê chuột / chọn bằng phím mới hiện đỏ */}
              <DropdownMenuItem
                onClick={handleLogout}
                className="group cursor-pointer rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-bo-danger-soft focus:text-bo-danger"
              >
                <LogOut className="size-4 text-slate-500 group-focus:text-bo-danger" />
                {t("Đăng xuất")}
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
        title={t("Còn lượt quét chưa khóa lô")}
        description={t("Có {{count}} lượt quét ở màn Kiểm đếm chưa khóa lô. Đăng xuất bây giờ sẽ mất các lượt này, phải đếm lại thùng đó. Quay lại màn Kiểm đếm để khóa lô trước khi đăng xuất.", { count: luotChuaKhoa })}
        confirmText={t("Vẫn đăng xuất")}
        cancelText={t("Quay lại")}
      />
    </header>
  );
}
