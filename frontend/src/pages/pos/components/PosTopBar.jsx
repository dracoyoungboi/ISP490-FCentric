import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import {
  ArrowLeft,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Maximize2,
  Minimize2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { useCurrentUserAvatarUrl } from '@/utils/avatar';
import { nguoiDungService } from '@/services/nguoiDungService';
import PosModal from './PosModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ROLE_LABELS = {
  quan_tri_vien: 'Quản trị viên',
  quan_ly_kho: 'Quản lý kho',
  nhan_vien_kho: 'Nhân viên kho',
  nhan_vien_mua_hang: 'Nhân viên mua hàng',
  nhan_vien_ban_hang: 'Nhân viên bán hàng',
};

const iconButton = 'grid size-9 shrink-0 place-items-center rounded-lg border border-bo-border text-bo-muted transition hover:bg-slate-50 hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-bo-primary';

function readCurrentUser() {
  const token = localStorage.getItem('access_token');
  const role = localStorage.getItem('role');
  let userId = null;
  let username = 'Người dùng';
  if (token) {
    try {
      const payload = jwtDecode(token);
      userId = payload.userId || payload.id || payload.sub;
      username = payload.tenDangNhap || payload.username || username;
    } catch {
      /* token hỏng: ProtectedRoute/apiClient sẽ xử lý phiên */
    }
  }
  return { userId, username, roleLabel: ROLE_LABELS[role] || 'Thành viên hệ thống' };
}

/** Trạng thái mạng của trình duyệt — mất mạng thì báo ngay cho thu ngân. */
function useOnlineStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const supported = typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen);
  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  return { isFullscreen, supported, toggle };
}

/**
 * Thanh trên cùng của màn POS toàn màn hình (thay cho sidebar + header backoffice):
 * logo · tiêu đề · [children: chọn kho…] · trạng thái mạng · giờ · toàn màn hình · trợ giúp · tài khoản.
 */
export default function PosTopBar({ children, onHelp, pendingPaymentCount = 0 }) {
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const now = useClock();
  const { isFullscreen, supported: fullscreenSupported, toggle: toggleFullscreen } = useFullscreen();
  const [{ userId, username, roleLabel }] = useState(readCurrentUser);
  const avatarUrl = useCurrentUserAvatarUrl(userId);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const logout = () => {
    // Chỉ xóa phiên đăng nhập. Bản nháp hóa đơn (gắn theo tài khoản, tự hết hạn sau 12 giờ) được
    // giữ: đăng nhập lại vẫn còn hóa đơn và mã QR đang chờ; tài khoản khác không đọc được.
    nguoiDungService.logout();
    sessionStorage.clear();
    navigate('/login');
  };
  const handleLogout = () => {
    if (pendingPaymentCount > 0) setConfirmLogout(true);
    else logout();
  };

  // Đang hỏi lại đăng xuất: phím tắt POS (F1–F9) không được mở hộp thoại khác đè lên; Esc = Ở lại.
  useEffect(() => {
    if (!confirmLogout) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setConfirmLogout(false);
      if (event.key === 'Escape' || /^F\d$/.test(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [confirmLogout]);

  const timeLabel = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateLabel = now.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-bo-border bg-bo-surface px-3 sm:px-4">
      <Link
        aria-label="Về trang quản trị"
        className={iconButton}
        title="Về trang quản trị (bản nháp hóa đơn vẫn được giữ)"
        to="/dashboard"
      >
        <ArrowLeft aria-hidden="true" size={16} />
      </Link>
      <div className="flex min-w-0 shrink-0 items-center gap-2.5 pr-1">
        <img alt="" className="size-8 shrink-0 object-contain" draggable={false} src="/branding/f-centric-icon.svg" />
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block truncate text-sm font-semibold text-bo-foreground">Bán hàng tại quầy</span>
          <span className="block truncate text-[11px] text-bo-muted">FCentric POS</span>
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          aria-live="polite"
          className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium md:inline-flex ${online ? 'bg-bo-success-soft text-bo-success' : 'bg-bo-danger-soft text-bo-danger'}`}
          title={online ? 'Đang kết nối mạng' : 'Mất kết nối mạng — chưa thể thanh toán'}
        >
          {online ? <Wifi aria-hidden="true" size={13} /> : <WifiOff aria-hidden="true" size={13} />}
          {online ? 'Trực tuyến' : 'Mất mạng'}
        </span>
        {!online ? <span className="grid size-9 place-items-center rounded-lg bg-bo-danger-soft text-bo-danger md:hidden" title="Mất kết nối mạng"><WifiOff aria-hidden="true" size={16} /></span> : null}

        <span className="hidden text-right leading-tight lg:block">
          <span className="block text-sm font-semibold tabular-nums text-bo-foreground">{timeLabel}</span>
          <span className="block text-[11px] capitalize text-bo-muted">{dateLabel}</span>
        </span>

        {fullscreenSupported ? (
          <button
            aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            className={`${iconButton} hidden sm:grid`}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            type="button"
          >
            {isFullscreen ? <Minimize2 aria-hidden="true" size={16} /> : <Maximize2 aria-hidden="true" size={16} />}
          </button>
        ) : null}

        {onHelp ? (
          <button aria-label="Hướng dẫn phím tắt" className={iconButton} onClick={onHelp} title="Phím tắt (F1)" type="button">
            <CircleHelp aria-hidden="true" size={16} />
          </button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Mở menu tài khoản"
              className="flex h-10 max-w-[200px] items-center gap-2 rounded-lg px-1.5 text-bo-foreground transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-bo-primary"
              type="button"
            >
              <UserAvatar avatarUrl={avatarUrl} name={username} size="xs" userId={userId} />
              <span className="hidden min-w-0 text-left xl:block">
                <span className="block truncate text-sm font-semibold leading-4">{username}</span>
                <span className="mt-0.5 block truncate text-[11px] leading-3 text-bo-muted">{roleLabel}</span>
              </span>
              <ChevronDown aria-hidden="true" className="hidden size-4 text-bo-muted xl:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[90] w-56 rounded-lg border border-bo-border bg-white p-1 text-bo-foreground shadow-lg" sideOffset={6}>
            <div className="px-2 py-2">
              <p className="truncate text-sm font-semibold">{username}</p>
              <p className="mt-0.5 truncate text-xs text-bo-muted">{roleLabel}</p>
            </div>
            <DropdownMenuSeparator className="bg-bo-border" />
            <DropdownMenuItem asChild className="cursor-pointer rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-950">
              <Link to="/dashboard">
                <LayoutDashboard className="size-4 text-slate-500" />
                Về trang quản trị
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-bo-border" />
            <DropdownMenuItem className="cursor-pointer rounded-md px-2.5 py-2 text-sm text-bo-danger focus:bg-bo-danger-soft focus:text-bo-danger" onClick={handleLogout}>
              <LogOut className="size-4" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {confirmLogout ? (
        <PosModal description="Hóa đơn đang chờ thanh toán vẫn được giữ trên máy này cho tài khoản của bạn." onClose={() => setConfirmLogout(false)} size="sm" title="Đăng xuất?">
          <p className="text-sm leading-6 text-bo-foreground">
            Còn <strong>{pendingPaymentCount}</strong> hóa đơn đang chờ thanh toán (mã QR chưa nhận tiền hoặc giao dịch chưa rõ kết quả).
          </p>
          <p className="mt-2 text-sm leading-6 text-bo-muted">
            Đăng nhập lại bằng tài khoản này trong vòng 12 giờ để tiếp tục và kiểm tra kết quả. Tiền khách chuyển trong lúc bạn đăng xuất vẫn được hệ thống ghi nhận.
          </p>
          <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <button className="inline-flex min-h-10 items-center justify-center rounded-lg border border-bo-border bg-bo-surface px-4 py-2 text-sm font-medium text-bo-foreground transition hover:bg-slate-50" onClick={() => setConfirmLogout(false)} type="button">Ở lại</button>
            <button className="inline-flex min-h-10 items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700" onClick={logout} type="button">Vẫn đăng xuất</button>
          </div>
        </PosModal>
      ) : null}
    </header>
  );
}
