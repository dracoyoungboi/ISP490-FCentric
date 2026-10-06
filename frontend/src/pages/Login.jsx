import { useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import { nguoiDungService } from '../services/nguoiDungService';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { getMineKhoList } from '../services/khoService';
import AuthShell from '../components/auth/AuthShell';

/* ── Class patterns dùng chung (theo thiết kế modern white/gray) ── */
const INPUT_BASE =
    'flex h-11 w-full rounded-lg border bg-white px-3 py-2 text-base text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';
const INPUT_NORMAL = 'border-gray-300';
const INPUT_ERROR = 'border-red-500 focus:ring-red-500';
const LABEL = 'text-sm font-medium leading-none text-gray-900';
const PRIMARY_BTN =
    'inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const ERROR_BANNER =
    'flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700';
const EYE_BTN =
    'absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 transition-colors';
const LINK_MUTED = 'text-sm font-medium text-gray-500 hover:text-black hover:underline transition-colors';

export default function AuthPage() {
    const navigate = useNavigate();

    // Chỉ chuyển vào dashboard nếu token còn hạn; xóa token lỗi/hết hạn để không bị bounce.
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        try {
            const decoded = jwtDecode(token);
            const expiresAt = Number(decoded?.exp) * 1000;

            if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
                nguoiDungService.logout();
                sessionStorage.setItem(
                    'session_expired_message',
                    'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
                );
                return;
            }

            navigate('/dashboard', { replace: true });
        } catch {
            nguoiDungService.logout();
            sessionStorage.setItem(
                'session_expired_message',
                'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.'
            );
        }
    }, [navigate]);

    // Thông báo "tài khoản bị khóa" từ lần logout cưỡng bức (apiClient) — đọc 1 lần rồi xóa
    useEffect(() => {
        const lockedMessage = sessionStorage.getItem('account_locked_message');
        const expiredMessage = sessionStorage.getItem('session_expired_message');
        if (lockedMessage) {
            sessionStorage.removeItem('account_locked_message');
            setErrors({ general: lockedMessage });
        } else if (expiredMessage) {
            sessionStorage.removeItem('session_expired_message');
            setErrors({ general: expiredMessage });
        }
    }, []);

    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const [loginData, setLoginData] = useState({ username: '', matKhau: '' });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrors({});
        try {
            if (!loginData.username || !loginData.matKhau) {
                setErrors({ general: 'Vui lòng điền đầy đủ thông tin đăng nhập' });
                return;
            }
            const response = await nguoiDungService.login({ username: loginData.username, password: loginData.matKhau });
            if (response?.status !== 200) {
                setErrors({ general: response?.message || 'Đăng nhập thất bại' });
                return;
            }

            const token = localStorage.getItem('access_token');
            if (!token) {
                setErrors({ general: 'Không nhận được token đăng nhập, vui lòng thử lại' });
                return;
            }

            try {
                const decoded = jwtDecode(token);
                // Role đã được nguoiDungService lưu từ nguoiDung.vaiTro — chỉ dùng claim trong
                // JWT làm dự phòng khi role chưa có (không ghi đè, không lưu "undefined")
                if (!localStorage.getItem('role')) {
                    const rawRole = decoded?.scope || decoded?.vaiTro || decoded?.role || decoded?.authorities;
                    if (typeof rawRole === 'string' && rawRole && rawRole !== 'undefined') {
                        const role = rawRole.startsWith('ROLE_') ? rawRole.slice(5) : rawRole;
                        localStorage.setItem('role', role);
                    }
                }
                if (decoded?.warehousePermissions) {
                    try {
                        const permissions = typeof decoded.warehousePermissions === 'string'
                            ? JSON.parse(decoded.warehousePermissions)
                            : decoded.warehousePermissions;
                        if (Array.isArray(permissions) && permissions.length > 0 && permissions[0]?.kho) {
                            localStorage.setItem('selected_kho_id', permissions[0].kho.id);
                        }
                    } catch (parseError) {
                        console.error('Lỗi khi đọc warehousePermissions từ Token:', parseError);
                    }
                }
            } catch (decodeError) {
                // Token không hợp lệ: xoá để tránh vòng lặp redirect với token hỏng, ở lại trang đăng nhập
                console.error('Token đăng nhập không hợp lệ:', decodeError);
                localStorage.removeItem('access_token');
                setErrors({ general: 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại' });
                return;
            }

            try {
                const myWarehouses = await getMineKhoList();
                if (myWarehouses && myWarehouses.length > 0 && !localStorage.getItem('selected_kho_id')) {
                    localStorage.setItem('selected_kho_id', myWarehouses[0].id);
                }
            } catch {
                console.warn('Không thể tải danh sách kho.');
            }

            navigate('/dashboard');
        } catch (error) {
            setErrors({ general: error.response?.data?.message || 'Có lỗi xảy ra khi đăng nhập' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthShell>
            <div className="text-center lg:text-left mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-3 text-gray-900 fade-in-up delay-1">
                    Đăng nhập
                </h1>
                <p className="text-gray-500 text-base fade-in-up delay-2">
                    Chào mừng trở lại hệ thống FCentric.
                </p>
            </div>

            {/* ── FORM ĐĂNG NHẬP ── */}
            <form className="space-y-5 fade-in-up delay-3" onSubmit={handleLogin} noValidate>
                {errors.general && (
                    <div className={ERROR_BANNER} role="alert">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span>{errors.general}</span>
                    </div>
                )}

                <div className="space-y-2">
                    <label htmlFor="login-username" className={LABEL}>Tên đăng nhập / Email / SĐT</label>
                    <input
                        id="login-username"
                        type="text"
                        placeholder="Nhập tài khoản của bạn"
                        className={`${INPUT_BASE} ${INPUT_NORMAL}`}
                        value={loginData.username}
                        onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                        autoComplete="username"
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label htmlFor="login-password" className={LABEL}>Mật khẩu</label>
                        <button type="button" className={LINK_MUTED} onClick={() => navigate('/forgot-password')}>
                            Quên mật khẩu?
                        </button>
                    </div>
                    <div className="relative">
                        <input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            className={`${INPUT_BASE} ${INPUT_NORMAL} pr-10`}
                            value={loginData.matKhau}
                            onChange={(e) => setLoginData({ ...loginData, matKhau: e.target.value })}
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            className={EYE_BTN}
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                    <input
                        type="checkbox"
                        id="remember"
                        className="w-4 h-4 rounded border border-gray-300 accent-gray-900 cursor-pointer"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer select-none">
                        Ghi nhớ đăng nhập
                    </label>
                </div>

                <button type="submit" className={`${PRIMARY_BTN} mt-4`} disabled={isLoading}>
                    {isLoading ? (
                        <><Loader2 size={16} className="animate-spin" /> Đang xử lý...</>
                    ) : (
                        'Đăng nhập'
                    )}
                </button>
            </form>
        </AuthShell>
    );
}
