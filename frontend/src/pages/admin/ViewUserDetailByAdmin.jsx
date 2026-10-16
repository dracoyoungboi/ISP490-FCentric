import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { adminService } from "@/services/adminService.js";

import PageContainer from "@/components/backoffice/PageContainer";
import { ENTITY_NAME_TYPE } from "@/components/backoffice/pageTitle";
import SurfaceCard from "@/components/shared/SurfaceCard";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import UserAvatar from "@/components/UserAvatar";
import { formatDate } from "@/utils/formatters";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import {
    ArrowLeft,
    Mail,
    Phone,
    Calendar,
    Warehouse,
    Shield,
    IdCard,
    Clock3,
    Building2,
    UserCog,
    UserX
} from "lucide-react";

import { toast } from "@/lib/thongBaoNhanh";

const ROLE_LABELS = {
    quan_tri_vien: "Quản trị viên",
    quan_ly_kho: "Quản lý kho",
    nhan_vien_kho: "Nhân viên kho",
    nhan_vien_ban_hang: "Nhân viên bán hàng",
    nhan_vien_mua_hang: "Nhân viên mua hàng",
    khach_hang: "Khách hàng",
};

const LOAD_ERROR_MESSAGE = "Không thể tải thông tin người dùng. Vui lòng thử lại.";
// Mã HTTP coi là "không có người dùng này": 404, và 400 vì backend hiện báo
// "Không tìm thấy người dùng" bằng CommonException (400). Thử lại cũng không ra kết quả khác.
const NOT_FOUND_STATUSES = [400, 404];

export default function ViewUserDetailByAdmin() {

    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    // Danh sách gửi kèm URL của nó (bộ lọc + trang); mở thẳng link thì về /users.
    const backTo =
        typeof location.state?.from === "string" && location.state.from.startsWith("/users")
            ? location.state.from
            : "/users";

    const [user, setUser] = useState(null);
    // { notFound, message } khi tải lỗi; null khi đang tải hoặc đã tải xong
    const [loadError, setLoadError] = useState(null);
    const requestIdRef = useRef(0);
    const [loadingToggle, setLoadingToggle] = useState(false);
    // Hộp xác nhận Khóa / Mở khóa tài khoản
    const [confirmToggleOpen, setConfirmToggleOpen] = useState(false);

    const fetchUser = useCallback(async () => {
        // Chỉ nhận kết quả của lần tải mới nhất (đổi id / bấm Thử lại liên tiếp)
        const requestId = ++requestIdRef.current;
        setUser(null);
        setLoadError(null);
        try {
            const res = await adminService.getByIdByAdmin(id);
            if (requestId !== requestIdRef.current) return;
            if (!res?.data) throw new Error(res?.message || LOAD_ERROR_MESSAGE);
            setUser(res.data);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.error(err);
            setLoadError({
                notFound: NOT_FOUND_STATUSES.includes(getApiErrorStatus(err)),
                message: getApiErrorMessage(err, LOAD_ERROR_MESSAGE),
            });
        }
    }, [id]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn tải ngay khi mở trang / đổi id.
    useEffect(() => {
        queueMicrotask(() => fetchUser());
    }, [fetchUser]);

    // Chạy sau khi bấm xác nhận trong hộp thoại; đang xử lý thì bỏ qua lần bấm tiếp theo.
    const handleToggleStatus = async () => {
        if (loadingToggle) return;
        setLoadingToggle(true);
        try {
            await adminService.toggleUserStatusByAdmin(id);
        } catch (err) {
            toast.error(
                err?.response?.data?.message ||
                "Không thể cập nhật trạng thái tài khoản"
            );
            setLoadingToggle(false);
            return;
        }

        setConfirmToggleOpen(false);
        toast.success("Cập nhật trạng thái tài khoản thành công");
        try {
            const refreshed = await adminService.getByIdByAdmin(id);
            if (refreshed?.data) setUser(refreshed.data);
            else fetchUser();
        } catch {
            // Đã đổi trạng thái nhưng tải lại hồ sơ lỗi → tải lại cả trang (có nút Thử lại nếu vẫn lỗi)
            fetchUser();
        } finally {
            setLoadingToggle(false);
        }
    };

    if (loadError) {
        return (
            <PageContainer className="space-y-4">
                <Link
                    to={backTo}
                    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-bo-primary hover:text-bo-primary-hover"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Quay lại danh sách
                </Link>
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    {loadError.notFound ? (
                        <EmptyState
                            icon={UserX}
                            title="Không tìm thấy người dùng"
                            description="Tài khoản có thể đã bị xóa hoặc đường dẫn không còn hợp lệ."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() => navigate(backTo)}
                                    className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    <ArrowLeft className="size-4" />
                                    Quay lại danh sách
                                </Button>
                            }
                        />
                    ) : (
                        <ErrorState
                            title="Không thể tải thông tin người dùng"
                            description={loadError.message}
                            onRetry={fetchUser}
                        />
                    )}
                </div>
            </PageContainer>
        );
    }

    if (!user) {
        return (
            <PageContainer>
                <LoadingState label="Đang tải dữ liệu người dùng" />
            </PageContainer>
        );
    }

    const isActive = user.trangThai === 1;
    const roleLabel = ROLE_LABELS[user.vaiTro] || user.vaiTro?.replaceAll("_", " ") || "Không xác định";
    const warehouseCount = user.khoPhuTrach?.length || 0;

    return (
        <PageContainer className="space-y-5">

            {/* HEADER */}
            <div className="flex flex-col gap-4 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                    <Link
                        to={backTo}
                        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-bo-primary hover:text-bo-primary-hover"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Quay lại danh sách
                    </Link>
                    <div>
                        <h1 className={`truncate text-lg text-bo-heading ${ENTITY_NAME_TYPE}`}>
                            {user.hoTen}
                        </h1>
                        <p className="mt-1 text-sm text-bo-muted">
                            Hồ sơ, trạng thái và quyền phụ trách kho của tài khoản
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        onClick={() => navigate(`/users/${user.id}/edit-role`)}
                    >
                        <Shield className="mr-2 h-4 w-4" />
                        Chỉnh sửa quyền
                    </Button>

                    <Button
                        disabled={loadingToggle}
                        className={
                            isActive
                                ? "bg-bo-danger text-white hover:bg-bo-danger/90"
                                : "bg-bo-success text-white hover:bg-bo-success/90"
                        }
                        onClick={() => setConfirmToggleOpen(true)}
                    >
                        {loadingToggle
                            ? "Đang xử lý..."
                            : isActive
                                ? "Khóa tài khoản"
                                : "Mở khóa tài khoản"}
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <OverviewTile
                    icon={<UserCog className="h-4 w-4 text-bo-primary" />}
                    label="Vai trò"
                    value={roleLabel}
                />
                <OverviewTile
                    icon={<Shield className="h-4 w-4 text-bo-primary" />}
                    label="Trạng thái"
                    value={isActive ? "Đang hoạt động" : "Đã khóa"}
                />
                <OverviewTile
                    icon={<Building2 className="h-4 w-4 text-bo-primary" />}
                    label="Kho phụ trách"
                    value={`${warehouseCount} kho`}
                />
                <OverviewTile
                    icon={<IdCard className="h-4 w-4 text-bo-primary" />}
                    label="Mã người dùng"
                    value={user.id || "—"}
                />
            </div>

            {/* USER PROFILE */}
            <div className="grid gap-5 md:grid-cols-3">

                {/* LEFT CARD */}
                <div className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
                    <div className="flex flex-col items-center gap-4 p-6 text-center">

                        <UserAvatar userId={user.id} name={user.hoTen} avatarUrl={user.avatarUrl} size="lg" />

                        <div className="min-w-0">
                            <h2
                                className="break-all text-xl font-bold text-bo-foreground"
                                title={user.hoTen}
                            >
                                {user.hoTen}
                            </h2>

                            <p
                                className="break-all text-sm text-bo-muted"
                                title={user.tenDangNhap}
                            >
                                @{user.tenDangNhap}
                            </p>
                        </div>

                        <Badge variant="outline" className="border-bo-border bg-bo-surface-subtle text-bo-foreground">
                            {roleLabel}
                        </Badge>

                        <StatusBadge
                            label={isActive ? "Hoạt động" : "Bị khóa"}
                            tone={isActive ? "success" : "danger"}
                        />

                        <div className="w-full space-y-2 border-t border-bo-border pt-4 text-left">
                            <InfoMini
                                icon={<Calendar className="h-4 w-4" />}
                                label="Ngày tạo"
                                value={formatDate(user.ngayTao)}
                            />
                            <InfoMini
                                icon={<Clock3 className="h-4 w-4" />}
                                label="Cập nhật gần nhất"
                                value={formatDate(user.ngayCapNhat)}
                            />
                        </div>

                    </div>
                </div>

                {/* INFO CARD */}
                <div className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm md:col-span-2">

                    <div className="border-b border-bo-border px-4 py-3">
                        <h3 className="text-sm font-semibold text-bo-foreground">
                            Thông tin liên hệ và hệ thống
                        </h3>
                    </div>

                    <div className="divide-y divide-bo-border">

                        <InfoRow
                            icon={<IdCard className="h-4 w-4" />}
                            label="ID"
                            value={user.id || "—"}
                        />

                        <InfoRow
                            icon={<UserCog className="h-4 w-4" />}
                            label="Tên đăng nhập"
                            value={user.tenDangNhap ? `@${user.tenDangNhap}` : "—"}
                        />

                        <InfoRow
                            icon={<Mail className="h-4 w-4" />}
                            label="Email"
                            value={user.email || "—"}
                        />

                        <InfoRow
                            icon={<Phone className="h-4 w-4" />}
                            label="Số điện thoại"
                            value={user.soDienThoai || "—"}
                        />

                    </div>

                </div>

            </div>

            {/* WAREHOUSE PERMISSION */}
            {user.vaiTro !== "khach_hang" && (
                <SurfaceCard>
                    <div className="mb-4 flex items-center gap-2 border-b border-bo-border pb-3 font-semibold text-bo-foreground">
                        <Warehouse className="h-4 w-4" />
                        Kho được phân quyền phụ trách
                    </div>

                    {user.khoPhuTrach?.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-bo-surface-subtle hover:bg-bo-surface-subtle">
                                        <TableHead>Mã Kho</TableHead>
                                        <TableHead>Tên Kho</TableHead>
                                        <TableHead>Vai trò</TableHead>
                                        <TableHead>Ngày cấp</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {user.khoPhuTrach.map((item, index) => (
                                        <TableRow
                                            key={index}
                                            className="hover:bg-bo-surface-subtle"
                                        >
                                            <TableCell className="font-semibold">
                                                {item.kho?.maKho || "—"}
                                            </TableCell>

                                            <TableCell>
                                                {item.kho?.tenKho || "—"}
                                            </TableCell>

                                            <TableCell>
                                                <Badge
                                                    variant="secondary"
                                                    className="border-bo-border bg-bo-surface-subtle text-bo-foreground hover:bg-slate-100"
                                                >
                                                    {roleLabel}
                                                </Badge>
                                            </TableCell>

                                            <TableCell>
                                                {formatDate(item.ngayTao)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="p-6 text-center text-sm text-bo-muted">
                            Người dùng chưa được phân quyền kho nào
                        </div>
                    )}
                </SurfaceCard>
            )}

            {/* ── HỘP XÁC NHẬN KHÓA / MỞ KHÓA TÀI KHOẢN ── */}
            <AlertDialog
                open={confirmToggleOpen}
                onOpenChange={(open) => {
                    if (!open && !loadingToggle) setConfirmToggleOpen(false);
                }}
            >
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isActive ? "Khóa tài khoản người dùng" : "Mở khóa tài khoản người dùng"}
                        </AlertDialogTitle>
                        {/* asChild: Description mặc định render <p>; bên trong có <p> sẽ sai cấu trúc HTML */}
                        <AlertDialogDescription asChild>
                            <div className="space-y-2 text-sm text-slate-600">
                                <p>
                                    Bạn có muốn {isActive ? "khóa" : "mở khóa"} tài khoản{" "}
                                    <span className="font-semibold text-slate-900">{user.tenDangNhap}</span>
                                    {user.hoTen ? ` (${user.hoTen})` : ""}?
                                </p>
                                <p className="text-xs text-slate-500">
                                    {isActive
                                        ? "Người dùng sẽ không đăng nhập được và bị đăng xuất ở thao tác tiếp theo. Có thể mở khóa lại bất cứ lúc nào."
                                        : "Người dùng sẽ đăng nhập và sử dụng hệ thống trở lại được."}
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:justify-end">
                        <AlertDialogCancel disabled={loadingToggle}>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={loadingToggle}
                            onClick={(e) => {
                                e.preventDefault();
                                handleToggleStatus();
                            }}
                            className={
                                isActive
                                    ? "bg-bo-danger text-white hover:bg-bo-danger/90"
                                    : "bg-bo-success text-white hover:bg-bo-success/90"
                            }
                        >
                            {loadingToggle
                                ? "Đang xử lý..."
                                : isActive
                                    ? "Khóa tài khoản"
                                    : "Mở khóa tài khoản"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </PageContainer>
    );
}

function InfoRow({ icon, label, value }) {
    return (
        <div className="flex items-center justify-between gap-3 p-4 text-sm">
            <div className="flex shrink-0 items-center gap-2 text-bo-muted">
                {icon}
                {label}
            </div>
            <div className="break-all text-right font-medium text-bo-foreground">
                {value}
            </div>
        </div>
    );
}

function InfoMini({ icon, label, value }) {
    return (
        <div className="flex items-center justify-between gap-3 text-xs">
            <div className="inline-flex items-center gap-1.5 text-bo-muted">
                {icon}
                <span>{label}</span>
            </div>
            <span className="text-right font-medium text-bo-foreground">{value}</span>
        </div>
    );
}

function OverviewTile({ icon, label, value }) {
    return (
        <div className="rounded-lg border border-bo-border bg-bo-surface px-4 py-3 shadow-sm">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-bo-primary-soft">
                {icon}
            </div>
            <p className="text-[11px] uppercase tracking-wide text-bo-muted">{label}</p>
            <p className="mt-1 text-sm font-semibold text-bo-foreground">{value}</p>
        </div>
    );
}
