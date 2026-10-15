// src/pages/supplier/SupplierDetailView.jsx — trang Chi tiết nhà cung cấp (/supplier/:id)
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import {
    AlertTriangle, ArrowLeft, CircleCheck, CirclePause, Clock, Calendar, Edit,
    Landmark, Mail, MapPin, Phone, User2,
} from "lucide-react";
import { toast } from "sonner";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import StatusBadge from "@/components/shared/StatusBadge";
import SurfaceCard from "@/components/shared/SurfaceCard";
import SupplierFormDialog from "@/components/supplier/SupplierFormDialog";
import SupplierStatusDialog from "@/components/supplier/SupplierStatusDialog";
import { laHoatDong } from "@/components/supplier/quyTacNhaCungCap";
import { getSupplierById } from "@/services/supplierService";
import { timNganHang, useDanhSachNganHang } from "@/services/nganHangService";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { formatDateTime } from "@/utils/formatters";
import { ROLES, hasAnyRole } from "@/utils/roles";

// Khớp quyền ở backend (NhaCungCapController): Quản lý kho chỉ xem.
const QUYEN_QUAN_LY_NCC = [ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG];

// ── Info field — hiển thị label + value dạng readonly ────────────────────
function InfoField({ label, icon: Icon, children, value, className }) {
    const content = children ?? (
        <span className="text-sm font-medium text-bo-foreground">{value || "—"}</span>
    );
    return (
        <div className={`flex min-w-0 flex-col gap-1.5 ${className ?? ""}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{label}</p>
            <div className="flex min-w-0 items-start gap-2">
                {Icon ? <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" /> : null}
                <div className="min-w-0 break-words">{content}</div>
            </div>
        </div>
    );
}

function Notice({ tone = "warning", children, action }) {
    const toneClass = tone === "warning"
        ? "border-orange-200 bg-bo-warning-soft text-bo-warning"
        : "border-bo-border bg-slate-50 text-slate-700";
    return (
        <div className={`flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${toneClass}`}>
            <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="leading-6">{children}</div>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────
export default function SupplierDetailView() {
    const { id }      = useParams();
    const navigate    = useNavigate();
    const coTheQuanLy = hasAnyRole(QUYEN_QUAN_LY_NCC);
    const [supplier, setSupplier] = useState(null);
    const [loading,  setLoading]  = useState(true);
    // null | { notFound: true } | { message }
    const [loadError, setLoadError] = useState(null);
    const [editOpen, setEditOpen] = useState(false);
    const [statusOpen, setStatusOpen] = useState(false);
    const { danhSach: nganHangs } = useDanhSachNganHang();

    const fetchSupplier = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const data = await getSupplierById(id);
            setSupplier(data ?? null);
            if (!data) setLoadError({ notFound: true });
        } catch (error) {
            setSupplier(null);
            const status = getApiErrorStatus(error);
            setLoadError(status === 404
                ? { notFound: true }
                : { message: getApiErrorMessage(error, "Không thể tải thông tin nhà cung cấp") });
        } finally {
            setLoading(false);
        }
    }, [id]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); request vẫn chạy ngay khi mount.
    useEffect(() => { queueMicrotask(() => fetchSupplier()); }, [fetchSupplier]);

    const backButton = (
        <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/supplier")}
            className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
        >
            <ArrowLeft className="size-4" />
            Quay lại danh sách
        </Button>
    );

    if (loading) {
        return (
            <PageContainer>
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <LoadingState rows={4} label="Đang tải thông tin nhà cung cấp" />
                </div>
            </PageContainer>
        );
    }

    if (!supplier) {
        return (
            <PageContainer className="space-y-5">
                <PageHeader title="Chi tiết nhà cung cấp" actions={backButton} />
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    {loadError?.notFound ? (
                        <EmptyState
                            title="Không tìm thấy nhà cung cấp"
                            description="Nhà cung cấp có thể đã bị xóa hoặc đường dẫn không đúng."
                        />
                    ) : (
                        <ErrorState
                            title="Không thể tải thông tin nhà cung cấp"
                            description={loadError?.message}
                            onRetry={fetchSupplier}
                        />
                    )}
                </div>
            </PageContainer>
        );
    }

    const dangHoatDong = laHoatDong(supplier);
    const thieuEmail = !supplier.email?.trim();
    const nganHang = timNganHang(nganHangs, supplier.nganHang);
    const coThongTinThanhToan = Boolean(supplier.nganHang && supplier.soNganHang);

    const handleSaved = (saved) => {
        setSupplier((prev) => ({ ...prev, ...saved }));
        toast.success("Đã lưu thay đổi nhà cung cấp");
    };

    const handleStatusChanged = (updated) => {
        setSupplier((prev) => ({ ...prev, ...updated }));
        toast.success(laHoatDong(updated)
            ? "Đã cho phép nhà cung cấp hoạt động lại"
            : "Đã ngừng hoạt động nhà cung cấp");
    };

    return (
        <PageContainer className="space-y-5">
            {/* ── Page header ── */}
            <PageHeader
                title="Chi tiết nhà cung cấp"
                actions={
                    <>
                        {backButton}
                        {coTheQuanLy ? (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setStatusOpen(true)}
                                    className={dangHoatDong
                                        ? "gap-1.5 border-bo-border bg-white text-bo-warning hover:bg-bo-warning-soft hover:text-bo-warning"
                                        : "gap-1.5 border-bo-border bg-white text-bo-success hover:bg-bo-success-soft hover:text-bo-success"}
                                >
                                    {dangHoatDong ? <CirclePause className="size-4" /> : <CircleCheck className="size-4" />}
                                    {dangHoatDong ? "Ngừng hoạt động" : "Cho phép hoạt động"}
                                </Button>
                                <Button
                                    onClick={() => setEditOpen(true)}
                                    className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
                                >
                                    <Edit className="size-4" />
                                    Chỉnh sửa
                                </Button>
                            </>
                        ) : null}
                    </>
                }
            />

            {!dangHoatDong ? (
                <Notice tone="neutral">
                    <span className="font-semibold">Nhà cung cấp đang ngừng hoạt động.</span>{" "}
                    Không được chọn khi gửi yêu cầu báo giá; đơn mua đang xử lý vẫn tiếp tục bình thường.
                </Notice>
            ) : thieuEmail ? (
                <Notice
                    action={coTheQuanLy ? (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditOpen(true)}
                            className="border-orange-200 bg-white text-bo-warning hover:bg-bo-warning-soft hover:text-bo-warning"
                        >
                            Thêm email
                        </Button>
                    ) : null}
                >
                    <span className="font-semibold">Chưa có email.</span>{" "}
                    Chưa gửi được yêu cầu báo giá cho nhà cung cấp này.
                </Notice>
            ) : null}

            {/* ── Row 1: Định danh ── */}
            <SurfaceCard title="Thông tin cơ bản">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <InfoField label="Mã nhà cung cấp">
                        <span className="rounded-md border border-bo-border bg-bo-surface-subtle px-2 py-1 font-mono text-sm font-semibold text-bo-foreground">
                            {supplier.maNhaCungCap || "—"}
                        </span>
                    </InfoField>
                    <InfoField label="Tên nhà cung cấp" value={supplier.tenNhaCungCap} />
                    <InfoField label="Trạng thái">
                        <StatusBadge
                            label={dangHoatDong ? "Hoạt động" : "Ngừng hoạt động"}
                            tone={dangHoatDong ? "success" : "neutral"}
                        />
                    </InfoField>
                </div>
            </SurfaceCard>

            {/* ── Row 2: Liên hệ + Thanh toán & Hệ thống ── */}
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">

                {/* Liên hệ */}
                <SurfaceCard title="Thông tin liên hệ" className="h-full">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <InfoField label="Người liên hệ" icon={User2} value={supplier.nguoiLienHe} />
                        <InfoField label="Số điện thoại" icon={Phone}>
                            <span className="font-mono text-sm font-medium text-bo-foreground">
                                {supplier.soDienThoai || "—"}
                            </span>
                        </InfoField>
                        <InfoField label="Email" icon={Mail} value={supplier.email} className="sm:col-span-2" />
                        <InfoField label="Địa chỉ" icon={MapPin} className="sm:col-span-2">
                            <span className="text-sm font-medium leading-relaxed text-bo-foreground">
                                {supplier.diaChi || "—"}
                            </span>
                        </InfoField>
                    </div>
                </SurfaceCard>

                {/* Thanh toán + Hệ thống xếp chồng */}
                <div className="flex flex-col gap-5">
                    <SurfaceCard
                        title="Thông tin thanh toán"
                        description="Dùng để tạo mã QR khi thanh toán đơn mua."
                    >
                        {coThongTinThanhToan ? (
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <InfoField label="Ngân hàng" icon={Landmark}>
                                    <span className="block text-sm font-medium text-bo-foreground">
                                        {nganHang?.tenNgan ?? supplier.nganHang}
                                    </span>
                                    {nganHang?.tenDayDu ? (
                                        <span className="block text-xs text-bo-muted">{nganHang.tenDayDu}</span>
                                    ) : null}
                                </InfoField>
                                <InfoField label="Số tài khoản">
                                    <span className="font-mono text-sm font-medium text-bo-foreground">
                                        {supplier.soNganHang}
                                    </span>
                                </InfoField>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-bo-muted">
                                    Chưa có tài khoản ngân hàng nên chưa tạo được mã QR khi thanh toán đơn mua.
                                </p>
                                {coTheQuanLy ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditOpen(true)}
                                        className="shrink-0 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                    >
                                        Thêm tài khoản
                                    </Button>
                                ) : null}
                            </div>
                        )}
                    </SurfaceCard>

                    {/* Thông tin hệ thống */}
                    <SurfaceCard title="Thông tin hệ thống" className="bg-bo-surface-subtle">
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <InfoField label="Ngày tạo" icon={Calendar} value={formatDateTime(supplier.ngayTao)} />
                            <InfoField label="Cập nhật lần cuối" icon={Clock} value={formatDateTime(supplier.ngayCapNhat)} />
                        </div>
                    </SurfaceCard>
                </div>
            </div>

            {coTheQuanLy ? (
                <>
                    <SupplierFormDialog
                        open={editOpen}
                        onOpenChange={setEditOpen}
                        supplier={supplier}
                        onSaved={handleSaved}
                    />
                    <SupplierStatusDialog
                        supplier={supplier}
                        open={statusOpen}
                        onOpenChange={setStatusOpen}
                        onChanged={handleStatusChanged}
                    />
                </>
            ) : null}
        </PageContainer>
    );
}
