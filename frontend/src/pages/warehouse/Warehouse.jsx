import { getApiErrorMessage } from "@/utils/apiError";
import { useCallback, useEffect, useState } from 'react';
import {
    BarChart3, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
    Edit, Eye, Filter, Package, Plus, RefreshCcw, Trash2, XCircle,
} from 'lucide-react';

import PageContainer from '@/components/backoffice/PageContainer';
import FilterBar from '@/components/shared/FilterBar';
import SearchInput from '@/components/shared/SearchInput';
import TableShell from '@/components/shared/TableShell';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { khoService } from '@/services/khoService';
import { useToggle } from '@/hooks/useToggle';
import ConfirmModal from '@/components/ui/confirm-modal';
import {
    WarehouseDialog
} from '.';

/* ── Filter payload builder ── */
function buildPayload(filters) {
    const list = [];
    if (filters.searchTerm?.trim()) {
        ["tenKho", "maKho", "diaChi"].forEach(f =>
            list.push({ fieldName: f, operation: "ILIKE", value: filters.searchTerm.trim(), logicType: "OR" })
        );
    }
    if (filters.filterStatus === "active")
        list.push({ fieldName: "trangThai", operation: "EQUALS", value: 1, logicType: "AND" });
    else if (filters.filterStatus === "inactive")
        list.push({ fieldName: "trangThai", operation: "EQUALS", value: 0, logicType: "AND" });

    return {
        filters: list,
        sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
        page: filters.pageNumber,
        size: filters.pageSize,
    };
}

const STATUS_OPTIONS = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'active', label: 'Đang hoạt động' },
    { value: 'inactive', label: 'Ngừng hoạt động' },
];

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

/* ════════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════════ */
export default function WarehouseManagement() {
    const [warehouses, setWarehouses] = useState([]);
    const [managers, setManagers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingManagers, setIsLoadingManagers] = useState(false);

    const [searchInput, setSearchInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [pagination, setPagination] = useState({
        pageNumber: 0, pageSize: 10, totalElements: 0, totalPages: 0,
    });

    const [showDialog, setShowDialog] = useState(false);
    const [dialogMode, setDialogMode] = useState('create');
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);
    const [isConfirmOpen, openConfirm, closeConfirm] = useToggle(false);
    const [warehouseToDelete, setWarehouseToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [formData, setFormData] = useState({
        maKho: '', tenKho: '', diaChi: '', quanLyId: '', trangThai: 1,
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setSearchTerm(searchInput);
        }, 250);

        return () => clearTimeout(timeoutId);
    }, [searchInput]);

    /* ── Fetch warehouses ── */
    const fetchWarehouses = useCallback(async (
        page = pagination.pageNumber,
        size = pagination.pageSize,
    ) => {
        try {
            setIsLoading(true);
            const res = await khoService.filter(
                buildPayload({ searchTerm, filterStatus, pageNumber: page, pageSize: size })
            );
            const d = res?.data?.data ?? res?.data;
            if (d) {
                setWarehouses(d.content || []);
                setPagination(prev => ({
                    ...prev,
                    pageNumber: d.number || 0,
                    pageSize: Math.max(d.size, 1),
                    totalElements: d.totalElements || 0,
                    totalPages: d.totalPages || 0,
                }));
            } else {
                setWarehouses([]);
            }
        } catch (err) {
            console.error("Lỗi khi tải danh sách kho:", err);
            toast.error("Không thể tải danh sách kho");
            setWarehouses([]);
        } finally {
            setIsLoading(false);
        }
    }, [searchTerm, filterStatus, pagination.pageNumber, pagination.pageSize]);

    /* ── Fetch managers ── */
    const fetchManagers = useCallback(async () => {
        try {
            setIsLoadingManagers(true);
            const res = await khoService.getManagers();
            if (res.data?.status === 200) {
                setManagers((res.data.data.content || []).map(u => ({ id: u.id, name: u.hoTen })));
            }
        } catch (err) {
            console.error("Lỗi khi tải danh sách quản lý:", err);
            toast.error("Không thể tải danh sách người quản lý");
        } finally {
            setIsLoadingManagers(false);
        }
    }, []);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn fetch lại ngay mỗi khi bộ lọc/trang đổi.
    useEffect(() => {
        queueMicrotask(() => fetchWarehouses());
    }, [fetchWarehouses]);

    useEffect(() => {
        if (showDialog) queueMicrotask(() => fetchManagers());
    }, [showDialog, fetchManagers]);

    /* ── Pagination ── */
    const handlePageChange = p => { if (p >= 0 && p < pagination.totalPages) setPagination(prev => ({ ...prev, pageNumber: p })); };
    const handlePageSizeChange = sz => setPagination(prev => ({ ...prev, pageSize: sz, pageNumber: 0 }));

    /* ── Validation ── */
    const validateForm = () => {
        const e = {};
        if (!formData.maKho) e.maKho = 'Vui lòng nhập mã kho';
        if (!formData.tenKho) e.tenKho = 'Vui lòng nhập tên kho';
        else if (formData.tenKho.length < 5) e.tenKho = 'Tên kho phải có ít nhất 5 ký tự';
        if (!formData.diaChi) e.diaChi = 'Vui lòng nhập địa chỉ';
        if (!formData.quanLyId) e.quanLyId = 'Vui lòng chọn người quản lý';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    /* ── Dialog ── */
    const handleOpenDialog = (mode, wh = null) => {
        setDialogMode(mode);
        setSelectedWarehouse(wh);
        if (mode === 'create')
            setFormData({ maKho: '', tenKho: '', diaChi: '', quanLyId: '', trangThai: 1 });
        else if (mode === 'edit' && wh)
            setFormData({ maKho: wh.maKho, tenKho: wh.tenKho, diaChi: wh.diaChi, quanLyId: wh.quanLy?.id?.toString() || '', trangThai: wh.trangThai ?? 1 });
        setErrors({});
        setShowDialog(true);
    };

    const handleCloseDialog = () => { setShowDialog(false); setSelectedWarehouse(null); setErrors({}); };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        try {
            const data = { maKho: formData.maKho, tenKho: formData.tenKho, diaChi: formData.diaChi, quanLyId: Number(formData.quanLyId), trangThai: Number(formData.trangThai) };
            let res;
            if (dialogMode === 'create') res = await khoService.create(data);
            else if (dialogMode === 'edit') res = await khoService.update({ id: selectedWarehouse.id, ...data });
            if (res?.data?.status >= 400) { toast.error(res.data.message || 'Có lỗi xảy ra'); return; }
            toast.success(dialogMode === 'create' ? 'Thêm kho mới thành công.' : 'Cập nhật thông tin kho thành công.');
            setShowDialog(false); setErrors({}); fetchWarehouses();
        } catch (err) {
            console.error('Chi tiết lỗi:', err);
            console.error('Error response:', err.response);
            console.error('Error response data:', err.response?.data);
            toast.error(getApiErrorMessage(err, 'Có lỗi xảy ra khi xử lý kho'));
        }
    };

    const handleDeleteClick = useCallback((wh) => { setWarehouseToDelete(wh); openConfirm(); }, [openConfirm]);

    const handleConfirmDelete = useCallback(async () => {
        if (!warehouseToDelete) return;
        try {
            setIsDeleting(true);
            await khoService.delete(warehouseToDelete.id);
            toast.success('Xóa kho thành công.');
            closeConfirm(); setWarehouseToDelete(null); fetchWarehouses();
        } catch (err) {
            console.error('Lỗi khi xóa kho:', err);
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi xóa kho');
        } finally { setIsDeleting(false); }
    }, [warehouseToDelete, closeConfirm, fetchWarehouses]);

    const handleCancelDelete = useCallback(() => {
        if (!isDeleting) { setWarehouseToDelete(null); closeConfirm(); }
    }, [isDeleting, closeConfirm]);

    /* ── Computed stats ──
       Lưu ý: total lấy từ phân trang BE, còn active/inactive/totalStock
       được tính trên các dòng của TRANG HIỆN TẠI (giữ nguyên hành vi cũ). */
    const stats = {
        total: pagination.totalElements,
        active: warehouses.filter(w => w.trangThai === 1).length,
        inactive: warehouses.filter(w => w.trangThai === 0).length,
        totalStock: warehouses.reduce((s, w) => s + (w.soLuongTon || 0), 0),
    };

    const statusLabel = STATUS_OPTIONS.find(o => o.value === filterStatus)?.label ?? 'Tất cả trạng thái';

    /* ══════════════
       RENDER
    ══════════════ */
    return (
        <PageContainer className="space-y-5">

            {/* ── Stats (tính trên trang hiện tại) ── */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                    icon={<Package className="size-5" />}
                    iconClass="bg-bo-primary-soft text-bo-primary"
                    label="Tổng kho"
                    value={stats.total}
                />
                <StatTile
                    icon={<CheckCircle2 className="size-5" />}
                    iconClass="bg-bo-success-soft text-bo-success"
                    label="Đang hoạt động"
                    value={stats.active}
                />
                <StatTile
                    icon={<XCircle className="size-5" />}
                    iconClass="bg-bo-warning-soft text-bo-warning"
                    label="Ngừng hoạt động"
                    value={stats.inactive}
                />
                <StatTile
                    icon={<BarChart3 className="size-5" />}
                    iconClass="bg-bo-danger-soft text-bo-danger"
                    label="Tổng tồn kho"
                    value={stats.totalStock.toLocaleString("vi-VN")}
                />
            </section>

            {/* ── Filter ── */}
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
                            placeholder="Tìm theo tên kho, mã kho, địa chỉ..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onClear={() => setSearchInput('')}
                        />
                    }
                    filters={
                        <>
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        disabled={isLoading}
                                        className="h-9 w-full justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50 sm:w-[190px]"
                                    >
                                        <span className="truncate">{statusLabel}</span>
                                        <ChevronDown className="size-4 shrink-0 opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="backoffice-user-menu z-50 w-[200px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                >
                                    {STATUS_OPTIONS.map((opt) => (
                                        <DropdownMenuItem
                                            key={opt.value}
                                            onClick={() => setFilterStatus(opt.value)}
                                            className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            {opt.label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button
                                variant="outline"
                                onClick={() => { setSearchInput(''); setSearchTerm(''); setFilterStatus('all'); }}
                                disabled={isLoading}
                                className="h-9 gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                            >
                                <RefreshCcw className="size-4" />
                                Đặt lại
                            </Button>
                        </>
                    }
                    actions={
                        <Button
                            onClick={() => handleOpenDialog('create')}
                            className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            <Plus className="size-4" />
                            Thêm kho mới
                        </Button>
                    }
                />
            </div>

            {/* ── Content ── */}
            {isLoading ? (
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <LoadingState rows={5} label="Đang tải danh sách kho" />
                </div>
            ) : warehouses.length > 0 ? (
                <TableShell
                    title="Danh sách kho"
                    description={`Tổng ${pagination.totalElements} kho trong hệ thống`}
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
                                        {PAGE_SIZE_OPTIONS.map((sz) => (
                                            <DropdownMenuItem
                                                key={sz}
                                                onClick={() => handlePageSizeChange(sz)}
                                                className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                            >
                                                {sz} dòng
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
                    <table className="w-full min-w-[920px] text-sm">
                        <thead>
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className="h-10 w-14 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    STT
                                </th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Mã kho
                                </th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Tên kho
                                </th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Người quản lý
                                </th>
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Trạng thái
                                </th>
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Tồn kho
                                </th>
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Thao tác
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {warehouses.map((wh, idx) => (
                                <tr key={wh.id} className="transition-colors hover:bg-bo-surface-subtle">
                                    <td className="px-3 py-3 text-center text-xs text-bo-muted">
                                        {pagination.pageNumber * pagination.pageSize + idx + 1}
                                    </td>
                                    <td className="px-3 py-3 font-mono text-sm font-semibold text-bo-primary">
                                        {wh.maKho || '—'}
                                    </td>
                                    <td className="px-3 py-3">
                                        <p className="font-semibold text-bo-foreground">{wh.tenKho}</p>
                                        {wh.diaChi && (
                                            <p className="mt-0.5 max-w-[260px] truncate text-xs text-bo-muted">
                                                {wh.diaChi}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-sm text-bo-foreground">
                                        {wh.quanLy?.hoTen || '—'}
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <StatusBadge
                                            label={wh.trangThai === 1 ? 'Hoạt động' : 'Ngừng hoạt động'}
                                            tone={wh.trangThai === 1 ? 'success' : 'danger'}
                                        />
                                    </td>
                                    <td className="px-3 py-3 text-center font-semibold text-bo-foreground">
                                        {(wh.soLuongTon || 0).toLocaleString("vi-VN")}
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <button
                                                type="button"
                                                title="Xem chi tiết"
                                                aria-label={`Xem chi tiết ${wh.tenKho}`}
                                                onClick={() => handleOpenDialog('view', wh)}
                                                className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary"
                                            >
                                                <Eye className="size-4" />
                                            </button>
                                            <button
                                                type="button"
                                                title="Chỉnh sửa"
                                                aria-label={`Chỉnh sửa ${wh.tenKho}`}
                                                onClick={() => handleOpenDialog('edit', wh)}
                                                className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary"
                                            >
                                                <Edit className="size-4" />
                                            </button>
                                            <button
                                                type="button"
                                                title="Xóa kho"
                                                aria-label={`Xóa kho ${wh.tenKho}`}
                                                onClick={() => handleDeleteClick(wh)}
                                                className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-danger hover:text-bo-danger"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableShell>
            ) : (
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <EmptyState
                        icon={Package}
                        title="Không tìm thấy kho hàng"
                        description="Chưa có dữ liệu kho phù hợp. Hãy thay đổi bộ lọc hoặc thêm kho mới."
                        action={
                            <Button
                                onClick={() => handleOpenDialog('create')}
                                className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                            >
                                <Plus className="size-4" />
                                Thêm kho mới
                            </Button>
                        }
                    />
                </div>
            )}

            {/* ── Modals ── */}
            <WarehouseDialog
                showDialog={showDialog}
                setShowDialog={setShowDialog}
                dialogMode={dialogMode}
                selectedWarehouse={selectedWarehouse}
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                managers={managers}
                isLoadingManagers={isLoadingManagers}
                onSubmit={handleSubmit}
                onClose={handleCloseDialog}
            />

            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
                title="Xác nhận xóa kho"
                description={
                    warehouseToDelete
                        ? `Bạn có chắc chắn muốn xóa kho "${warehouseToDelete.tenKho}"? Hành động này không thể hoàn tác.`
                        : "Bạn có chắc chắn muốn xóa kho này?"
                }
                confirmText="Xóa"
                cancelText="Hủy"
                variant="danger"
                isLoading={isDeleting}
            />
        </PageContainer>
    );
}

/* ══════════════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════════════ */
function StatTile({ icon, iconClass, label, value }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
            <div className="min-w-0">
                <p className="text-xs font-medium text-bo-muted">{label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">
                    {value}
                </p>
            </div>
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                {icon}
            </span>
        </div>
    );
}
