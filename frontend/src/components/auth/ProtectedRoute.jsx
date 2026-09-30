import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { toast } from "sonner";
import { nguoiDungService } from "../../services/nguoiDungService";

export default function ProtectedRoute() {
    const token = localStorage.getItem("access_token");
    const [status, setStatus] = useState("checking");
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        if (!token) {
            toast.warning("Bạn cần đăng nhập trước để truy cập trang này", {
                id: "auth-required",
            });
            return;
        }

        let cancelled = false;
        const controller = new AbortController();



        nguoiDungService
            .getMe({ signal: controller.signal })
            .then(() => {
                if (!cancelled) {
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
                const errorMessage = err?.response?.data?.message;
                const httpStatus = err?.response?.status;

                // apiClient đã xóa phiên và chuyển về login khi tài khoản bị khóa.
                if (
                    errorCode === "ACCOUNT_DISABLED" ||
                    (typeof errorMessage === "string" &&
                        errorMessage.includes("bị khóa"))
                ) {
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
    }, [token, retryCount]);

    if (!token || status === "unauthenticated") {
        return <Navigate to="/login" replace />;
    }

    if (status === "checking") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-bo-canvas p-6">
                <div
                    role="status"
                    className="flex items-center gap-3 rounded-lg border border-bo-border bg-white px-5 py-4 text-sm text-bo-muted shadow-sm"
                >
                    <span
                        aria-hidden="true"
                        className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
                    />
                    <span>Đang kiểm tra phiên đăng nhập...</span>
                </div>
            </main>
        );
    }

    if (status === "error") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-bo-canvas p-6">
                <div
                    role="alert"
                    className="w-full max-w-md rounded-lg border border-bo-border bg-white p-6 text-center shadow-sm"
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

    return <Outlet />;
}
