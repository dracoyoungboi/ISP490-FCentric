import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { adminService } from "@/services/adminService.js";

import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UserAvatar from "@/components/UserAvatar";

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
    UserCog
} from "lucide-react";

import { toast } from "sonner";

const ROLE_LABELS = {
    quan_tri_vien: "Quản trị viên",
    quan_ly_kho: "Quản lý kho",
    nhan_vien_kho: "Nhân viên kho",
    nhan_vien_ban_hang: "Nhân viên bán hàng",
    nhan_vien_mua_hang: "Nhân viên mua hàng",
    khach_hang: "Khách hàng",
};

export default function ViewUserDetailByAdmin() {

    const { id } = useParams();
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [loadingToggle, setLoadingToggle] = useState(false);

    const handleToggleStatus = async () => {
        try {

            setLoadingToggle(true);

            await adminService.toggleUserStatusByAdmin(id);

            const refreshed = await adminService.getByIdByAdmin(id);

            setUser(refreshed.data);

            toast.success("Cập nhật trạng thái tài khoản thành công");

        } catch (err) {

            toast.error(
                err?.response?.data?.message ||
                "Không thể cập nhật trạng thái tài khoản"
            );

        } finally {

            setLoadingToggle(false);

        }
    };

    useEffect(() => {

        adminService.getByIdByAdmin(id)
            .then((res) => {
                setUser(res.data);
            })
            .catch((err) => {
                console.error(err);
            });

    }, [id]);

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
                        to="/users"
                        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-bo-primary hover:text-bo-primary-hover"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Quay lại danh sách
                    </Link>
                    <div>
                        <h1 className="truncate text-lg font-bold text-bo-foreground">
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
                        onClick={handleToggleStatus}
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
                    value={user.id || "N/A"}
                />
            </div>

            {/* USER PROFILE */}
            <div className="grid gap-5 md:grid-cols-3">

                {/* LEFT CARD */}
                <div className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
                    <div className="flex flex-col items-center gap-4 p-6 text-center">

                        <UserAvatar userId={user.id} name={user.hoTen} size="lg" />

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
                                value={formatDate(user.ngayTao) || "N/A"}
                            />
                            <InfoMini
                                icon={<Clock3 className="h-4 w-4" />}
                                label="Cập nhật gần nhất"
                                value={formatDate(user.ngayCapNhat) || "N/A"}
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
                            value={user.id || "N/A"}
                        />

                        <InfoRow
                            icon={<UserCog className="h-4 w-4" />}
                            label="Tên đăng nhập"
                            value={user.tenDangNhap ? `@${user.tenDangNhap}` : "N/A"}
                        />

                        <InfoRow
                            icon={<Mail className="h-4 w-4" />}
                            label="Email"
                            value={user.email || "N/A"}
                        />

                        <InfoRow
                            icon={<Phone className="h-4 w-4" />}
                            label="Số điện thoại"
                            value={user.soDienThoai || "N/A"}
                        />

                        <InfoRow
                            icon={<Calendar className="h-4 w-4" />}
                            label="Ngày tạo"
                            value={formatDate(user.ngayTao) || "N/A"}
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
                                                {item.kho?.maKho || "N/A"}
                                            </TableCell>

                                            <TableCell>
                                                {item.kho?.tenKho || "N/A"}
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

function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("vi-VN");
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
