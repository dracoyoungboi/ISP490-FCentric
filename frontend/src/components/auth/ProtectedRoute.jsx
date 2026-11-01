import { useEffect, useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { toast } from "@/lib/thongBaoNhanh";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { nguoiDungService } from "../../services/nguoiDungService";
import { SU_KIEN_PHAI_DOI_MAT_KHAU } from "../../services/apiClient";
import { ensureTokenUsable } from "../../utils/authToken";

// Máy chủ trả lời /me trong khoảng này thì vào thẳng trang, không chớp hộp "Đang kiểm tra phiên đăng nhập"
const TRE_HIEN_HOP_CHO_MS = 400;

/**
 * Cổng mọi trang cần đăng nhập (khung quản trị, POS, các trang In). Tài khoản còn mật khẩu tạm thì chỉ hiện hộp Đổi
 * mật khẩu bắt buộc, KHÔNG dựng trang bên dưới: trang không gọi API (máy chủ cũng chặn, 403 PASSWORD_CHANGE_REQUIRED)
 * và không có đường đi vòng qua trang In hay /pos.
 */
export default function ProtectedRoute() {
    const navigate = useNavigate();
    const token = localStorage.getItem("access_token");
    const [status, setStatus] = useState("checking");
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [taiKhoan, setTaiKhoan] = useState({ tenDangNhap: "", email: "" });
    const [retryCount, setRetryCount] = useState(0);
    // Chỉ trễ ở lần kiểm tra đầu; bấm Thử lại thì hộp hiện ngay
    const [hienHopCho, setHienHopCho] = useState(false);

    useEffect(() => {
        if (status !== "checking" || hienHopCho) return;
        const timer = setTimeout(() => setHienHopCho(true), TRE_HIEN_HOP_CHO_MS);
        return () => clearTimeout(timer);
    }, [status, hienHopCho]);

    // Máy chủ báo phải đổi mật khẩu ở một request bất kỳ (vd. cờ vừa bật): mở hộp bắt buộc
    useEffect(() => {
        const moHop = () => setMustChangePassword(true);
        window.addEventListener(SU_KIEN_PHAI_DOI_MAT_KHAU, moHop);
        return () => window.removeEventListener(SU_KIEN_PHAI_DOI_MAT_KHAU, moHop);
    }, []);

    useEffect(() => {
        if (!token) {
            toast.warning("Bạn cần đăng nhập trước để truy cập trang này", {
                id: "auth-required",
            });
            return;
        }

        // Token hết hạn/hỏng: đăng xuất ngay, không gọi /me (backend sẽ trả 401 ở tầng filter)
        if (!ensureTokenUsable(token)) {
            navigate("/login", { replace: true });
            return;
        }

        let cancelled = false;
        const controller = new AbortController();

        nguoiDungService
            .getMe({ signal: controller.signal })
            .then((response) => {
                if (!cancelled) {
                    setMustChangePassword(response?.data?.mustChangePassword === true);
                    setTaiKhoan({
                        tenDangNhap: response?.data?.tenDangNhap || "",
                        email: response?.data?.email || "",
                    });
                    setStatus("authenticated");
                }
            })
            .catch((err) => {
                // Bỏ qua request đã bị hủy khi component unmount.
                if (
                    cancelled ||
                    controller.signal.aborted ||
                    err?.code === "ERR_CANCELED"
                ) {
                    return;
                }

                const errorCode = err?.response?.data?.error;
                const httpStatus = err?.response?.status;

                // apiClient đã xóa phiên và chuyển về login khi tài khoản bị khóa (theo mã lỗi, không dò chữ).
                if (errorCode === "ACCOUNT_DISABLED") {
                    return;
                }

                // Phiên không hợp lệ hoặc thiếu thông tin xác thực.
                // Backend hiện trả 403 cho trường hợp không có Authorization.
                if (httpStatus === 401 || httpStatus === 403) {
                    nguoiDungService.logout();

                    if (!cancelled) {
                        setStatus("unauthenticated");
                    }

                    return;
                }

                // Timeout, mất mạng hoặc lỗi server: giữ phiên và cho phép thử lại.
                if (!cancelled) {
                    setStatus("error");
                }
            });

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [token, retryCount, navigate]);

    if (!token || status === "unauthenticated") {
        return <Navigate to="/login" replace />;
    }

    if (status === "checking") {
        if (!hienHopCho) {
            return <main className="min-h-screen bg-bo-canvas" />;
        }

        return (
            <main className="flex min-h-screen items-center justify-center bg-bo-canvas p-6">
                <div
                    role="status"
                    className="flex items-center gap-3 rounded-lg border border-bo-border bg-bo-surface px-5 py-4 text-sm text-bo-muted shadow-sm"
                >
                    <span
                        aria-hidden="true"
                        className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
                    />
                    <span>Đang kiểm tra phiên đăng nhập</span>
                </div>
            </main>
        );
    }

    if (status === "error") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-bo-canvas p-6">
                <div
                    role="alert"
                    className="w-full max-w-md rounded-lg border border-bo-border bg-bo-surface p-6 text-center shadow-sm"
                >
                    <h1 className="text-base font-semibold text-bo-foreground">
                        Chưa thể xác thực phiên đăng nhập
                    </h1>

                    <p className="mt-2 text-sm text-bo-muted">
                        Máy chủ chưa phản hồi hoặc kết nối đang gặp sự cố.
                        Hãy thử lại sau.
                    </p>

                    <button
                        type="button"
                        onClick={() => {
                            setStatus("checking");
                            setRetryCount((count) => count + 1);
                        }}
                        className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        Thử lại
                    </button>
                </div>
            </main>
        );
    }

    if (mustChangePassword) {
        return (
            <main className="min-h-screen bg-bo-canvas">
                <ChangePasswordModal
                    open
                    forceChange
                    onOpenChange={() => {}}
                    onSuccess={() => setMustChangePassword(false)}
                    tenDangNhap={taiKhoan.tenDangNhap}
                    email={taiKhoan.email}
                />
            </main>
        );
    }

    return <Outlet />;
}