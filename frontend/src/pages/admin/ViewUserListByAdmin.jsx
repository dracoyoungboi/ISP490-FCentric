import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Filter,
    Search,
    Users,
    XCircle,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import UserAvatar from "@/components/UserAvatar";
import FilterBar from "@/components/shared/FilterBar";
import SearchInput from "@/components/shared/SearchInput";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { adminService } from "@/services/adminService";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const ROLE_OPTIONS = [
    { value: "ALL", label: "Tất cả" },
    { value: "quan_tri_vien", label: "Quản trị viên" },
    { value: "quan_ly_kho", label: "Quản lý kho" },
    { value: "nhan_vien_kho", label: "Nhân viên kho" },
    { value: "nhan_vien_ban_hang", label: "Nhân viên bán hàng" },
    { value: "nhan_vien_mua_hang", label: "Nhân viên mua hàng" },
    { value: "khach_hang", label: "Khách hàng" },
];

const STATUS_OPTIONS = [
    { value: "ALL", label: "Tất cả" },
    { value: "1", label: "Hoạt động" },
    { value: "0", label: "Bị khóa" },
];

function buildUserFilterPayload(filters) {
    const filterList = [];

    if (filters.keyword?.trim()) {
        ["hoTen", "tenDangNhap", "email"].forEach((field) => {
            filterList.push({
                fieldName: field,
                operation: "ILIKE",
                value: filters.keyword.trim(),
                logicType: "OR",
            });
        });
    }

    if (filters.vaiTro !== "ALL") {
        filterList.push({
            fieldName: "vaiTro",
            operation: "EQUALS",
            value: filters.vaiTro,
            logicType: "AND",
        });
    }

    if (filters.trangThai !== "ALL") {
        filterList.push({
            fieldName: "trangThai",
            operation: "EQUALS",
            value: Number(filters.trangThai),
            logicType: "AND",
        });
    }

    return {
        page: filters.page,
        size: filters.size,
        filters: filterList,
        sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
    };
}

const formatRole = (role) =>
    ROLE_OPTIONS.find((r) => r.value === role)?.label || role;

export default function ViewUserListByAdmin() {
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);

    const [filters, setFilters] = useState({
        keyword: "",
        vaiTro: "ALL",
        trangThai: "ALL",
        page: 0,
        size: 10,
    });

    const location = useLocation();
    const toastShownRef = useRef(false);
    const navigate = useNavigate();

    const [selectedUserForReset, setSelectedUserForReset] = useState(null);
    const [resettingUser, setResettingUser] = useState(false);

    const handleConfirmResetRandom = async () => {
        if (!selectedUserForReset) return;
        try {
            setResettingUser(true);
            await adminService.resetUserPasswordRandomByAdmin(selectedUserForReset.id);
            toast.success(`Đã cấp mật khẩu tạm thời ngẫu nhiên và gửi về email cho ${selectedUserForReset.hoTen || selectedUserForReset.tenDangNhap}`);
            setSelectedUserForReset(null);
        } catch (err) {
            toast.error(err?.response?.data?.message || "Không thể cấp lại mật khẩu cho người dùng");
        } finally {
            setResettingUser(false);
        }
    };

    const fetchUsers = useCallback(async () => {
        try {
            const payload = buildUserFilterPayload(filters);

            const res = await adminService.filterUsersByAdmin(payload);

            if (res.data?.status === 200) {
                const pageData = res.data.data;

                setUsers(pageData.content || []);
                setTotal(pageData.totalElements || 0);
            }
        } catch (error) {
            console.error(error);
            toast.error("Không thể tải danh sách người dùng");
        }
    }, [filters]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn fetch lại ngay mỗi khi filters đổi.
    useEffect(() => {
        queueMicrotask(() => fetchUsers());
    }, [fetchUsers]);

    useEffect(() => {
        if (!location.state?.success) return;
        if (toastShownRef.current) return;

        toastShownRef.current = true;

        toast.success(location.state.message || "Tạo người dùng thành công");

        navigate(location.pathname, { replace: true });
    }, [location, navigate]);

    const pagination = {
        pageNumber: filters.page,
        pageSize: filters.size,
        totalElements: total,
        totalPages: Math.max(Math.ceil(total / filters.size), 1),
    };

    function handlePageChange(newPage) {
        if (newPage >= 0 && newPage < pagination.totalPages) {
            setFilters((prev) => ({
                ...prev,
                page: newPage,
            }));
        }
    }

    function handlePageSizeChange(newSize) {
        setFilters((prev) => ({
            ...prev,
            size: newSize,
            page: 0,
        }));
    }

    const stats = useMemo(() => ({
        totalUsers: total,
        activeUsers: users.filter((u) => u.trangThai === 1).length,
        lockedUsers: users.filter((u) => u.trangThai === 0).length,
    }), [users, total]);

    return (
        <PageContainer className="space-y-5">
            {/* ── STATS ── */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
                    <div>
                        <p className="text-xs font-medium text-bo-muted">Tổng người dùng</p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">
                            {stats.totalUsers}
                        </p>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft text-bo-primary">
                        <Users className="size-5" />
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
                    <div>
                        <p className="text-xs font-medium text-bo-muted">Hoạt động</p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">
                            {stats.activeUsers}
                        </p>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-success-soft text-bo-success">
                        <CheckCircle2 className="size-5" />
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
                    <div>
                        <p className="text-xs font-medium text-bo-muted">Bị khóa</p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">
                            {stats.lockedUsers}
                        </p>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-danger-soft text-bo-danger">
                        <XCircle className="size-5" />
                    </span>
                </div>
            </section>

            {/* ── FILTER ── */}
            <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-bo-border px-4 py-3 sm:px-5">
                    <Filter className="size-4 text-bo-primary" />
                    <h2 className="text-sm font-semibold text-bo-foreground sm:text-base">
                        Bộ lọc tìm kiếm
                    </h2>
                </div>
                <FilterBar
                    primary={
                        <SearchInput
                            placeholder="Tên / username / email"
                            value={filters.keyword}
                            onChange={(e) =>
                                setFilters((p) => ({
                                    ...p,
                                    keyword: e.target.value,
                                    page: 0,
                                }))
                            }
                            onClear={() =>
                                setFilters((p) => ({ ...p, keyword: "", page: 0 }))
                            }
                        />
                    }
                    filters={
                        <>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-9 justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                    >
                                        {ROLE_OPTIONS.find((r) => r.value === filters.vaiTro)?.label}
                                        <ChevronDown className="size-4 opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="backoffice-user-menu z-50 w-48 rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                >
                                    {ROLE_OPTIONS.map((r) => (
                                        <DropdownMenuItem
                                            key={r.value}
                                            onClick={() =>
                                                setFilters((p) => ({ ...p, vaiTro: r.value, page: 0 }))
                                            }
                                            className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            {r.label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-9 justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                    >
                                        {STATUS_OPTIONS.find((s) => s.value === filters.trangThai)
                                            ?.label}
                                        <ChevronDown className="size-4 opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="backoffice-user-menu z-50 w-40 rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                >
                                    {STATUS_OPTIONS.map((s) => (
                                        <DropdownMenuItem
                                            key={s.value}
                                            onClick={() =>
                                                setFilters((p) => ({
                                                    ...p,
                                                    trangThai: s.value,
                                                    page: 0,
                                                }))
                                            }
                                            className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            {s.label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    }
                    actions={
                        <Link to="/users/add">
                            <Button className="bg-bo-primary text-white hover:bg-bo-primary-hover">
                                + Thêm người dùng
                            </Button>
                        </Link>
                    }
                />
            </div>

            {/* ── TABLE ── */}
            <TableShell
                footer={
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* Page size */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-bo-muted">Hiển thị:</span>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-8 w-[120px] justify-between border-bo-border bg-white px-2.5 text-xs font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                    >
                                        {pagination.pageSize} dòng
                                        <ChevronDown className="size-3.5 opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="backoffice-user-menu z-50 w-[120px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
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
                            </span>{" "}
                            -{" "}
                            <span className="font-semibold text-bo-foreground">
                                {Math.min(
                                    (pagination.pageNumber + 1) * pagination.pageSize,
                                    pagination.totalElements
                                )}
                            </span>{" "}
                            trong tổng số{" "}
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
                <div className="max-h-[520px] overflow-y-auto">
                    <table className="w-full min-w-[880px] text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    STT
                                </th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Username
                                </th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Họ tên
                                </th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Email
                                </th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    SĐT
                                </th>
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Vai trò
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
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-4 py-14 text-center text-sm text-bo-muted">
                                        <div className="flex flex-col items-center gap-2">
                                            <Users className="size-8 text-slate-300" />
                                            Không có dữ liệu
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {users.map((u, index) => (
                                <tr
                                    key={u.id}
                                    onClick={() => navigate(`/users/${u.id}`)}
                                    className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                                >
                                    <td className="px-3 py-3 text-center text-xs text-bo-muted">
                                        {pagination.pageNumber * pagination.pageSize + index + 1}
                                    </td>

                                    <td className="px-3 py-3 font-semibold text-bo-foreground">
                                        <div className="flex items-center gap-2.5">
                                            <UserAvatar userId={u.id} name={u.hoTen || u.tenDangNhap} avatarUrl={u.avatarUrl} size="xs" />
                                            <span>{u.tenDangNhap}</span>
                                        </div>
                                    </td>

                                    <td className="px-3 py-3 text-bo-foreground">{u.hoTen}</td>

                                    <td className="px-3 py-3 text-slate-600">{u.email}</td>

                                    <td className="px-3 py-3 text-slate-600">{u.soDienThoai}</td>

                                    <td className="px-3 py-3 text-center">
                                        <StatusBadge
                                            label={formatRole(u.vaiTro)}
                                            tone="neutral"
                                            dot={false}
                                        />
                                    </td>

                                    <td className="px-3 py-3 text-center">
                                        <StatusBadge
                                            label={u.trangThai === 1 ? "Hoạt động" : "Bị khóa"}
                                            tone={u.trangThai === 1 ? "success" : "danger"}
                                        />
                                    </td>

                                    <td className="px-3 py-3 text-center">
                                        {u.ngayTao
                                            ? new Date(u.ngayTao).toLocaleDateString("vi-VN")
                                            : "-"}
                                    </td>

                                    <td className="px-3 py-3 text-center">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 border-bo-danger/30 bg-white px-2.5 text-xs text-bo-danger hover:bg-bo-danger hover:text-white"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedUserForReset(u);
                                            }}
                                        >
                                            Reset
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </TableShell>

            {/* ALERT DIALOG CẤP LẠI MẬT KHẨU */}
            <AlertDialog
                open={Boolean(selectedUserForReset)}
                onOpenChange={(open) => {
                    if (!open && !resettingUser) setSelectedUserForReset(null);
                }}
            >
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cấp lại mật khẩu người dùng</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2 text-sm text-slate-600">
                            <div>
                                Bạn có muốn cấp lại mật khẩu cho tài khoản{" "}
                                <span className="font-semibold text-slate-900">
                                    {selectedUserForReset?.tenDangNhap}
                                </span>{" "}
                                {selectedUserForReset?.hoTen && `(${selectedUserForReset.hoTen})`}?
                            </div>
                            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-500 border border-slate-200">
                                Email nhận mật khẩu:{" "}
                                <span className="font-medium text-slate-800">
                                    {selectedUserForReset?.email || "Chưa thiết lập email"}
                                </span>
                                {!selectedUserForReset?.email && (
                                    <p className="text-amber-600 mt-1 font-medium">
                                        ⚠️ Tài khoản này chưa có email, không thể gửi mật khẩu ngẫu nhiên tự động. Vui lòng cập nhật email cho người dùng trước.
                                    </p>
                                )}
                            </div>
                            <p className="text-xs text-slate-500">
                                Hệ thống sẽ tự động tạo mật khẩu tạm thời ngẫu nhiên và gửi thư định dạng HTML về email người dùng. Sau khi đăng nhập, người dùng sẽ bắt buộc phải đổi mật khẩu mới.
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:justify-end">
                        <AlertDialogCancel disabled={resettingUser}>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={resettingUser || !selectedUserForReset?.email}
                            onClick={(e) => {
                                e.preventDefault();
                                handleConfirmResetRandom();
                            }}
                            className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            {resettingUser ? "Đang gửi mail..." : "Gửi mật khẩu ngẫu nhiên"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PageContainer>
    );
}
