import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    AlertTriangle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    DollarSign,
    Eye,
    Mail,
    Phone,
    ShieldAlert,
    ShoppingCart,
    TrendingUp,
    Users,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import UserAvatar from "@/components/UserAvatar";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dashboardService } from "@/services/dashboardService";
import { adminService } from "@/services/adminService";

/* ══════════════════════════════════════════════════
   ROLE MAP
══════════════════════════════════════════════════ */
const ROLE_OPTIONS = [
    { value: "ALL", label: "Tất cả" },
    { value: "quan_tri_vien", label: "Quản trị viên" },
    { value: "quan_ly_kho", label: "Quản lý kho" },
    { value: "nhan_vien_kho", label: "Nhân viên kho" },
    { value: "nhan_vien_ban_hang", label: "Nhân viên bán hàng" },
    { value: "nhan_vien_mua_hang", label: "Nhân viên mua hàng" },
    { value: "khach_hang", label: "Khách hàng" },
];
const formatRole = (role) => ROLE_OPTIONS.find((r) => r.value === role)?.label || role;

/* ══════════════════════════════════════════════════
   STATUS MAP (trangThai: 1 = hoạt động, còn lại = bị khóa)
══════════════════════════════════════════════════ */
const STATUS_MAP = {
    1: { label: "Hoạt động", tone: "success" },
    0: { label: "Bị khóa", tone: "danger" },
};

const ALERT_TONES = {
    danger: {
        tile: "border-bo-danger/15 bg-bo-danger-soft",
        chip: "bg-bo-danger text-white",
        text: "text-bo-danger",
    },
    warning: {
        tile: "border-bo-warning/15 bg-bo-warning-soft",
        chip: "bg-bo-warning text-white",
        text: "text-bo-warning",
    },
    neutral: {
        tile: "border-bo-border bg-bo-surface-subtle",
        chip: "bg-slate-400 text-white",
        text: "text-bo-muted",
    },
};

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
export default function DashboardAdmin() {
    const [data, setData] = useState(null);
    const [latestUsers, setLatestUsers] = useState([]);
    // Kích thước trang mặc định khớp với tham số size của lần gọi đầu tiên bên dưới
    const [pagination, setPagination] = useState({
        pageNumber: 0,
        pageSize: 5,
        totalPages: 0,
        totalElements: 0,
    });

    const loadUsers = useCallback(async (page, size) => {
        try {
            const res = await adminService.getUserListByAdmin({
                page,
                size,
                sort: "ngayTao,desc",
            });
            const pageData = res.data.data;
            setLatestUsers(pageData.content);
            setPagination({
                pageNumber: pageData.number,
                pageSize: pageData.size,
                totalPages: pageData.totalPages,
                totalElements: pageData.totalElements,
            });
        } catch (err) {
            console.error(err);
        }
    }, []);

    useEffect(() => {
        dashboardService.getDashboard().then((res) => setData(res.data.data));
        // Hoãn qua microtask để tránh setState đồng bộ trong effect
        // (react-hooks/set-state-in-effect); request vẫn chạy ngay khi mount,
        // độc lập với request dashboard như hành vi cũ.
        queueMicrotask(() => loadUsers(0, 5));
    }, [loadUsers]);

    const handlePageChange = (page) => {
        if (page < 0 || page >= pagination.totalPages) return;
        loadUsers(page, pagination.pageSize);
    };

    const handlePageSizeChange = (size) => {
        loadUsers(0, size);
    };

    if (!data) return null;

    const maxRevenue = Math.max(...data.revenueLast7Days.map((i) => i.value), 1);

    return (
        <PageContainer className="space-y-5">
            {/* ── KPI CARDS ── */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                    icon={<Users className="size-4" />}
                    iconClass="bg-bo-primary-soft text-bo-primary"
                    label="User mới hôm nay"
                    value={data.newUsersToday}
                    trend="+Hôm nay"
                    trendClass="text-bo-success"
                />
                <KpiCard
                    icon={<Users className="size-4" />}
                    iconClass="bg-slate-100 text-slate-600"
                    label="Tổng người dùng"
                    value={data.totalUsers}
                    trend="Toàn hệ thống"
                    trendClass="text-bo-muted"
                />
                <KpiCard
                    icon={<DollarSign className="size-4" />}
                    iconClass="bg-bo-success-soft text-bo-success"
                    label="Doanh thu hôm nay"
                    value={`${data.revenueToday.toLocaleString()}₫`}
                    trend="Ngày hiện tại"
                    trendClass="text-bo-success"
                />
                <KpiCard
                    icon={<ShoppingCart className="size-4" />}
                    iconClass="bg-purple-50 text-purple-600"
                    label="Đơn bán hôm nay"
                    value={data.totalOrdersToday}
                    trend="Đã xử lý"
                    trendClass="text-purple-600"
                />
            </section>

            {/* ── CHART + ALERTS ── */}
            <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <SurfaceCard
                    title="Doanh thu 7 ngày"
                    description="7 ngày gần nhất"
                    className="lg:col-span-2"
                >
                    <div className="flex h-64 items-end justify-between gap-2 sm:gap-3">
                        {data.revenueLast7Days.map((item) => {
                            const pct = Math.max((item.value / maxRevenue) * 100, 6);
                            return (
                                <div
                                    key={item.date}
                                    className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                                >
                                    <span className="pointer-events-none absolute bottom-[calc(100%-1.5rem)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-bo-foreground px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                        {(item.value / 1000).toFixed(0)}k ₫
                                    </span>
                                    <div className="flex h-36 w-full items-end rounded-md bg-bo-surface-subtle p-1">
                                        <div
                                            className="w-full rounded-md bg-bo-primary transition-colors hover:bg-bo-primary-hover"
                                            style={{ height: `${pct}%` }}
                                            title={`${item.date}: ${item.value.toLocaleString()}₫`}
                                        />
                                    </div>
                                    <span className="text-[11px] text-bo-muted">
                                        {item.date.slice(5)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </SurfaceCard>

                <SurfaceCard
                    title="Cảnh báo nhanh"
                    description="Tổng hợp từ hệ thống"
                >
                    <div className="space-y-3">
                        <AlertTile
                            icon={<AlertTriangle className="size-4" />}
                            tone="danger"
                            title="Tồn kho thấp"
                            subtitle={`${data.lowStockCount} cảnh báo`}
                        />
                        <AlertTile
                            icon={<Clock className="size-4" />}
                            tone="warning"
                            title="Đơn chờ duyệt"
                            subtitle={`${data.pendingPurchaseOrders} mua · ${data.pendingSaleOrders} bán`}
                        />
                        <AlertTile
                            icon={<ShieldAlert className="size-4" />}
                            tone="neutral"
                            title="Tài khoản bị khóa"
                            subtitle={`${data.bannedUsers} tài khoản`}
                        />
                    </div>
                </SurfaceCard>
            </section>

            {/* ── LATEST USERS ── */}
            <TableShell
                title="User mới tạo gần đây"
                description="Danh sách người dùng vừa đăng ký tham gia hệ thống"
                toolbar={
                    <div className="flex items-center justify-end px-4 py-2.5 sm:px-5">
                        <Link
                            to="/users"
                            className="inline-flex items-center gap-1 text-sm font-medium text-bo-primary hover:text-bo-primary-hover"
                        >
                            Xem tất cả <ChevronRight className="size-4" />
                        </Link>
                    </div>
                }
                footer={
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* Page size */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-bo-muted">Hiển thị</span>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-8 w-[110px] justify-between border-bo-border bg-white px-2.5 text-xs font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                    >
                                        {pagination.pageSize} dòng
                                        <ChevronDown className="size-3.5 opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="backoffice-user-menu z-50 w-[110px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                >
                                    {[5, 10, 20, 50, 100].map((size) => (
                                        <DropdownMenuItem
                                            key={size}
                                            onClick={() => handlePageSizeChange(size)}
                                            className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            {size} dòng
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Page info */}
                        <p className="text-xs text-bo-muted">
                            Hiển thị{" "}
                            <span className="font-semibold text-bo-foreground">
                                {pagination.pageNumber * pagination.pageSize + 1}
                            </span>
                            {" – "}
                            <span className="font-semibold text-bo-foreground">
                                {Math.min(
                                    (pagination.pageNumber + 1) * pagination.pageSize,
                                    pagination.totalElements
                                )}
                            </span>
                            {" trong tổng số "}
                            <span className="font-semibold text-bo-primary">
                                {pagination.totalElements}
                            </span>{" "}
                            kết quả
                        </p>

                        {/* Navigation */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.pageNumber - 1)}
                                disabled={pagination.pageNumber === 0}
                                className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                            >
                                <ChevronLeft className="size-3.5" />
                                Trước
                            </Button>

                            <div className="hidden items-center gap-1 sm:flex">
                                {[...Array(Math.min(5, pagination.totalPages))].map((_, idx) => {
                                    let pageNum;
                                    if (pagination.totalPages <= 5) {
                                        pageNum = idx;
                                    } else if (pagination.pageNumber < 3) {
                                        pageNum = idx;
                                    } else if (pagination.pageNumber > pagination.totalPages - 4) {
                                        pageNum = pagination.totalPages - 5 + idx;
                                    } else {
                                        pageNum = pagination.pageNumber - 2 + idx;
                                    }
                                    return (
                                        <Button
                                            key={idx}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePageChange(pageNum)}
                                            className={
                                                pagination.pageNumber === pageNum
                                                    ? "h-8 border-bo-primary bg-bo-primary px-2.5 text-xs text-white hover:bg-bo-primary-hover"
                                                    : "h-8 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle"
                                            }
                                        >
                                            {pageNum + 1}
                                        </Button>
                                    );
                                })}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.pageNumber + 1)}
                                disabled={pagination.pageNumber >= pagination.totalPages - 1}
                                className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                            >
                                Sau
                                <ChevronRight className="size-3.5" />
                            </Button>
                        </div>
                    </div>
                }
            >
                <table className="w-full min-w-[880px] text-sm">
                    <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                Username
                            </th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                Họ tên
                            </th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                Vai trò
                            </th>
                            <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                Liên hệ
                            </th>
                            <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                Trạng thái
                            </th>
                            <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                Ngày tạo
                            </th>
                            <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                Thao tác
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {latestUsers.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-10">
                                    <div className="flex flex-col items-center gap-2 text-sm text-bo-muted">
                                        <Users className="size-8 text-slate-300" />
                                        Không có dữ liệu
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            latestUsers.map((user) => {
                                const status = STATUS_MAP[user.trangThai] || STATUS_MAP[0];
                                return (
                                    <tr
                                        key={user.id}
                                        className="transition-colors hover:bg-bo-surface-subtle"
                                    >
                                        <td className="px-3 py-3 font-semibold text-bo-foreground">
                                            {user.tenDangNhap}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <UserAvatar userId={user.id} name={user.hoTen} avatarUrl={user.avatarUrl} size="xs" />
                                                <span>{user.hoTen}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <StatusBadge
                                                label={formatRole(user.vaiTro)}
                                                tone="neutral"
                                                dot={false}
                                            />
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="space-y-1 text-xs text-bo-muted">
                                                {user.email && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Mail className="size-3.5 shrink-0" />
                                                        {user.email}
                                                    </div>
                                                )}
                                                {user.soDienThoai && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Phone className="size-3.5 shrink-0" />
                                                        {user.soDienThoai}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <StatusBadge
                                                label={status.label}
                                                tone={status.tone}
                                            />
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 text-center text-xs text-bo-muted">
                                            {new Date(user.ngayTao).toLocaleDateString("vi-VN")}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <Link
                                                to={`/users/${user.id}`}
                                                title="Xem chi tiết"
                                                aria-label={`Xem chi tiết ${user.tenDangNhap}`}
                                                className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary"
                                            >
                                                <Eye className="size-4" />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </TableShell>
        </PageContainer>
    );
}

/* ══════════════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════════════ */

function KpiCard({ icon, iconClass, label, value, trend, trendClass }) {
    return (
        <div className="rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-bo-muted">{label}</span>
                <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
                >
                    {icon}
                </span>
            </div>
            <p className="mt-3 break-words text-2xl font-bold tracking-tight text-bo-foreground">
                {value}
            </p>
            <p className={`mt-1 flex items-center gap-1 text-xs ${trendClass}`}>
                <TrendingUp className="size-3" />
                {trend}
            </p>
        </div>
    );
}

function AlertTile({ icon, tone = "neutral", title, subtitle }) {
    const t = ALERT_TONES[tone] || ALERT_TONES.neutral;

    return (
        <div className={`flex items-start gap-3 rounded-lg border p-3 ${t.tile}`}>
            <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${t.chip}`}
            >
                {icon}
            </span>
            <div className="min-w-0">
                <p className="text-sm font-semibold text-bo-foreground">{title}</p>
                <p className={`mt-0.5 text-xs ${t.text}`}>{subtitle}</p>
            </div>
        </div>
    );
}
