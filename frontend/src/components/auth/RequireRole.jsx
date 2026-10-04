import { Outlet, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

/**
 * Chặn theo vai trò ở FRONTEND (chỉ là UX — backend @RequireAuth mới là
 * chốt chặn thật). Dùng cho các trang cấu hình chỉ dành cho
 * quan_tri_vien / quan_ly_kho: truy cập bằng URL trực tiếp sẽ thấy màn
 * hình "Bạn không có quyền truy cập" thay vì vào được trang.
 *
 * `role` trong localStorage có thể là chuỗi cách khoảng nhiều vai trò
 * (pattern parseRoles đang dùng ở các trang khác).
 */
function parseRoles(value) {
    if (Array.isArray(value)) return value.map((item) => String(item));
    if (typeof value !== "string") return [];
    return value.split(/\s+/).filter(Boolean);
}

export default function RequireRole({ roles = [] }) {
    const navigate = useNavigate();
    const stored = window.localStorage.getItem("role") ?? "";
    const userRoles = parseRoles(stored);

    if (!userRoles.some((role) => roles.includes(role))) {
        return (
            <div className="p-6">
                <EmptyState
                    icon={Lock}
                    title="Bạn không có quyền truy cập"
                    description="Tài khoản của bạn không được phép truy cập trang này."
                    action={
                        <Button
                            className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                            onClick={() => navigate("/dashboard")}
                        >
                            Về trang tổng quan
                        </Button>
                    }
                />
            </div>
        );
    }

    return <Outlet />;
}
