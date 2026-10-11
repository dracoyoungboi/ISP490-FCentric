import { getApiErrorMessage } from "@/utils/apiError";
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
    CheckCircle, XCircle, Clock, RefreshCw, Package,
    User, Warehouse, FileText, AlertCircle, Loader2, ChevronDown, Eye,
} from 'lucide-react';
import applicationRequestService from '@/services/applicationRequestService'; // adjust path

import PageContainer from '@/components/backoffice/PageContainer';
import PageHeader from '@/components/backoffice/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import FilterBar from '@/components/shared/FilterBar';
import LoadingState from '@/components/shared/LoadingState';
import SearchInput from '@/components/shared/SearchInput';
import StatusBadge from '@/components/shared/StatusBadge';
import TableShell from '@/components/shared/TableShell';

/* ─── helpers ─────────────────────────────────────────────────────── */
const STATUS = {
    0: { label: 'Đã từ chối', tone: 'danger', Icon: XCircle },
    1: { label: 'Chờ duyệt', tone: 'warning', Icon: Clock },
    2: { label: 'Đã duyệt', tone: 'success', Icon: CheckCircle },
};

const fmtDate = (iso) =>
    iso ? new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/* ─── Main component ───────────────────────────────────────────────── */
export default function ApplicationRequestManagement() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [searchDebounced, setSearchDebounced] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [notification, setNotification] = useState(null); // { type, msg }

    // Dialog: review confirmation
    const [reviewDialog, setReviewDialog] = useState(null); // { request, action: 'approve'|'reject' }
    const [reviewLoading, setReviewLoading] = useState(false);

    // Dialog: detail view
    const [detailDialog, setDetailDialog] = useState(null); // request object

    /* notify — giữ nguyên cơ chế: state + tự ẩn sau 5s */
    const notify = useCallback((type, msg) => {
        setNotification({ type, msg });
        setTimeout(() => setNotification(null), 5000);
    }, []);

    /* fetch */
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await applicationRequestService.getAllRequests();
            setRequests(data);
        } catch (e) {
            notify('error', getApiErrorMessage(e, 'Không thể tải danh sách yêu cầu'));
        } finally {
            setLoading(false);
        }
    }, [notify]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn fetch ngay khi mount.
    useEffect(() => { queueMicrotask(() => load()); }, [load]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setSearchDebounced(searchInput);
        }, 250);

        return () => clearTimeout(timeoutId);
    }, [searchInput]);

    /* review submit */
    const handleReviewConfirm = async () => {
        if (!reviewDialog) return;
        const { request, action } = reviewDialog;
        const status = action === 'approve' ? 2 : 0;
        setReviewLoading(true);
        try {
            await applicationRequestService.reviewRequest(request.nguoiDungId, status);
            notify('success', action === 'approve' ? 'Đã duyệt yêu cầu thành công.' : 'Đã từ chối yêu cầu.');
            setReviewDialog(null);
            load();
        } catch (e) {
            notify('error', e?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
        } finally {
            setReviewLoading(false);
        }
    };

    /* filtered list */
    const filtered = requests.filter((r) => {
        if (!r) return false;

        const matchStatus = filterStatus === 'all' || String(r.trangThai ?? '') === filterStatus;
        const keyword = searchDebounced.trim().toLowerCase();
        const matchSearch =
            !keyword ||
            String(r.nguoiDungId ?? '').includes(keyword) ||
            String(r.khoId ?? '').includes(keyword) ||
            String(r.ghiChu ?? '').toLowerCase().includes(keyword);

        return matchStatus && matchSearch;
    });

    /* stats */
    const stats = {
        total: requests.length,
        pending: requests.filter((r) => r.trangThai === 1).length,
        approved: requests.filter((r) => r.trangThai === 2).length,
        rejected: requests.filter((r) => r.trangThai === 0).length,
    };

    const statusOptions = [
        { value: 'all', label: 'Tất cả trạng thái' },
        { value: '1', label: 'Chờ duyệt' },
        { value: '2', label: 'Đã duyệt' },
        { value: '0', label: 'Đã từ chối' },
    ];

    const statusLabel = statusOptions.find((x) => x.value === filterStatus)?.label || 'Tất cả trạng thái';

    return (
        <PageContainer className="space-y-5">

            {/* ── Page header ── */}
            <PageHeader
                title="Yêu cầu tạo đơn mua hàng"
                description="Duyệt hoặc từ chối các yêu cầu gửi lên từ nhân viên kho"
            />

            {/* ── Notification ── */}
            {notification && (
                <div
                    className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${
                        notification.type === 'success'
                            ? 'border-bo-success/30 bg-bo-success-soft text-bo-success'
                            : 'border-bo-danger/30 bg-bo-danger-soft text-bo-danger'
                    }`}
                >
                    {notification.type === 'success'
                        ? <CheckCircle className="mt-0.5 size-4 shrink-0" />
                        : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
                    <span>{notification.msg}</span>
                </div>
            )}

            {/* ── Stat cards ── */}
            <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                    { label: 'Tổng yêu cầu', value: stats.total, icon: <FileText className="size-5" />, iconClass: 'bg-bo-primary-soft text-bo-primary' },
                    { label: 'Chờ duyệt', value: stats.pending, icon: <Clock className="size-5" />, iconClass: 'bg-bo-warning-soft text-bo-warning' },
                    { label: 'Đã duyệt', value: stats.approved, icon: <CheckCircle className="size-5" />, iconClass: 'bg-bo-success-soft text-bo-success' },
                    { label: 'Từ chối', value: stats.rejected, icon: <XCircle className="size-5" />, iconClass: 'bg-bo-danger-soft text-bo-danger' },
                ].map((s) => (
                    <div
                        key={s.label}
                        className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm"
                    >
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-bo-muted">{s.label}</p>
                            <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{s.value}</p>
                        </div>
                        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${s.iconClass}`}>
                            {s.icon}
                        </span>
                    </div>
                ))}
            </section>

            {/* ── Filters ── */}
            <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                <div className="border-b border-bo-border px-4 py-3 sm:px-5">
                    <h2 className="text-sm font-semibold text-bo-foreground sm:text-base">Bộ lọc tìm kiếm</h2>
                </div>
                <FilterBar
                    primary={
                        <SearchInput
                            placeholder="Tìm theo ID người dùng, kho, ghi chú..."
                            label="Tìm kiếm yêu cầu"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onClear={() => setSearchInput('')}
                            className="sm:max-w-md"
                        />
                    }
                    filters={
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="h-9 w-full justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle sm:w-[220px]"
                                >
                                    <span className="truncate">{statusLabel}</span>
                                    <ChevronDown className="size-4 shrink-0 opacity-60" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="backoffice-user-menu z-50 w-[220px] rounded-lg border border-bo-border bg-white p-1 shadow-lg">
                                {statusOptions.map((opt) => (
                                    <DropdownMenuItem
                                        key={opt.value}
                                        onClick={() => setFilterStatus(opt.value)}
                                        className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                    >
                                        {opt.label}
                                        {filterStatus === opt.value && <CheckCircle className="size-4 text-bo-primary" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    }
                    actions={
                        <>
                            <Button
                                onClick={() => {
                                    setSearchInput('');
                                    setSearchDebounced('');
                                    setFilterStatus('all');
                                }}
                                variant="outline"
                                className="h-9 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                Đặt lại
                            </Button>
                            <Button
                                onClick={load}
                                className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                            >
                                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                                Làm mới dữ liệu
                            </Button>
                        </>
                    }
                />
            </div>

            {/* ── Table ── */}
            <TableShell title="Danh sách yêu cầu" description="Theo dõi trạng thái xử lý của từng yêu cầu">
                {loading ? (
                    <LoadingState rows={5} label="Đang tải danh sách yêu cầu" />
                ) : filtered.length === 0 ? (
                    <EmptyState
                        icon={FileText}
                        title="Không có yêu cầu nào"
                        description="Chưa có yêu cầu nào khớp với bộ lọc hiện tại."
                    />
                ) : (
                    <table className="w-full min-w-[1000px] text-sm">
                        <thead>
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Người dùng ID</th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Kho ID</th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Sản phẩm (biến thể)</th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ghi chú</th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thời gian gửi</th>
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {filtered.map((req, idx) => {
                                const st = STATUS[req.trangThai] || STATUS[1];
                                const StIcon = st.Icon;
                                const isPending = req.trangThai === 1;
                                return (
                                    <tr key={idx} className="transition-colors hover:bg-bo-surface-subtle">
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex size-8 items-center justify-center rounded-full bg-bo-primary-soft">
                                                    <User className="size-4 text-bo-primary" />
                                                </div>
                                                <span className="font-mono font-semibold text-bo-foreground">#{req.nguoiDungId}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <Warehouse className="size-4 text-slate-400" />
                                                <span className="font-medium text-slate-700">Kho #{req.khoId}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <Package className="size-4 shrink-0 text-slate-400" />
                                                <span className="font-medium text-slate-700">
                                                    {req.bienTheSanPhamIds?.length ?? 0} biến thể
                                                </span>
                                                {req.bienTheSanPhamIds?.length > 0 && (
                                                    <button
                                                        onClick={() => setDetailDialog(req)}
                                                        className="ml-1 text-xs font-medium text-bo-primary hover:underline"
                                                    >
                                                        Xem
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <p className="max-w-[180px] truncate text-sm text-slate-600" title={req.ghiChu}>
                                                {req.ghiChu || <span className="italic text-bo-muted">Không có</span>}
                                            </p>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-600">
                                            {fmtDate(req.taoLuc)}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <StatusBadge
                                                tone={st.tone}
                                                dot={false}
                                                label={
                                                    <span className="flex items-center gap-1">
                                                        <StIcon className="size-3.5" />
                                                        {st.label}
                                                    </span>
                                                }
                                            />
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setDetailDialog(req)}
                                                    className="h-8 gap-1 border-bo-border bg-white px-2 text-bo-foreground hover:bg-bo-surface-subtle"
                                                >
                                                    <Eye className="size-3.5" />
                                                </Button>
                                                {isPending && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => setReviewDialog({ request: req, action: 'approve' })}
                                                            className="h-8 gap-1 bg-bo-success px-3 font-semibold text-white hover:bg-bo-success/90"
                                                        >
                                                            <CheckCircle className="size-3.5" />
                                                            Duyệt
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setReviewDialog({ request: req, action: 'reject' })}
                                                            className="h-8 gap-1 border-bo-danger/30 bg-white px-3 font-semibold text-bo-danger hover:bg-bo-danger-soft"
                                                        >
                                                            <XCircle className="size-3.5" />
                                                            Từ chối
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </TableShell>

            {/* ── Review Confirmation Dialog ── */}
            <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
                <DialogContent className="overflow-hidden rounded-lg border border-bo-border bg-white p-0 text-bo-foreground shadow-lg sm:max-w-md">
                    <div className={`flex items-center gap-3 border-b border-bo-border px-5 py-4 ${reviewDialog?.action === 'approve' ? 'bg-bo-success-soft' : 'bg-bo-danger-soft'
                        }`}>
                        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-white ${reviewDialog?.action === 'approve' ? 'text-bo-success' : 'text-bo-danger'}`}>
                            {reviewDialog?.action === 'approve'
                                ? <CheckCircle className="size-5" />
                                : <XCircle className="size-5" />
                            }
                        </div>
                        <DialogTitle className="m-0 text-base font-semibold text-bo-foreground">
                            {reviewDialog?.action === 'approve' ? 'Xác nhận duyệt yêu cầu' : 'Xác nhận từ chối yêu cầu'}
                        </DialogTitle>
                    </div>
                    <div className="p-5">
                        <DialogDescription className="mb-4 text-sm text-bo-muted">
                            {reviewDialog?.action === 'approve'
                                ? 'Sau khi duyệt, nhân viên mua hàng có thể tạo đơn mua hàng với các biến thể trong yêu cầu này.'
                                : 'Yêu cầu sẽ bị từ chối. Nhân viên cần gửi lại yêu cầu mới nếu cần.'
                            }
                        </DialogDescription>

                        {reviewDialog && (
                            <div className="space-y-2 rounded-lg border border-bo-border bg-bo-surface-subtle p-4 text-sm">
                                <div className="flex justify-between">
                                    <span className="font-medium text-bo-muted">Người dùng ID:</span>
                                    <span className="font-semibold text-bo-foreground">#{reviewDialog.request.nguoiDungId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-bo-muted">Kho:</span>
                                    <span className="font-semibold text-bo-foreground">#{reviewDialog.request.khoId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium text-bo-muted">Số biến thể:</span>
                                    <span className="font-semibold text-bo-foreground">{reviewDialog.request.bienTheSanPhamIds?.length ?? 0}</span>
                                </div>
                                {reviewDialog.request.ghiChu && (
                                    <div className="flex justify-between gap-4">
                                        <span className="shrink-0 font-medium text-bo-muted">Ghi chú:</span>
                                        <span className="text-right text-slate-600">{reviewDialog.request.ghiChu}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <DialogFooter className="mt-6 gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setReviewDialog(null)}
                                disabled={reviewLoading}
                                className="flex-1 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                Hủy
                            </Button>
                            <Button
                                onClick={handleReviewConfirm}
                                disabled={reviewLoading}
                                className={`flex-1 font-semibold text-white ${reviewDialog?.action === 'approve'
                                        ? 'bg-bo-success hover:bg-bo-success/90'
                                        : 'bg-bo-danger hover:bg-bo-danger/90'
                                    }`}
                            >
                                {reviewLoading ? (
                                    <><Loader2 className="mr-2 size-4 animate-spin" />Đang xử lý...</>
                                ) : reviewDialog?.action === 'approve' ? (
                                    <><CheckCircle className="mr-2 size-4" />Duyệt yêu cầu</>
                                ) : (
                                    <><XCircle className="mr-2 size-4" />Từ chối</>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Detail Dialog ── */}
            <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
                <DialogContent className="rounded-lg border border-bo-border bg-white text-bo-foreground shadow-lg sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-semibold text-bo-foreground">
                            <FileText className="size-5 text-bo-primary" />
                            Chi tiết Yêu cầu — Người dùng #{detailDialog?.nguoiDungId}
                        </DialogTitle>
                    </DialogHeader>
                    {detailDialog && (
                        <div className="mt-2 space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-lg border border-bo-border bg-bo-surface-subtle p-3">
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-bo-muted">Kho</p>
                                    <p className="font-semibold text-bo-foreground">#{detailDialog.khoId}</p>
                                </div>
                                <div className="rounded-lg border border-bo-border bg-bo-surface-subtle p-3">
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</p>
                                    {(() => {
                                        const st = STATUS[detailDialog.trangThai] || STATUS[1];
                                        const StIcon = st.Icon;
                                        return (
                                            <StatusBadge
                                                tone={st.tone}
                                                dot={false}
                                                label={
                                                    <span className="flex items-center gap-1">
                                                        <StIcon className="size-3" />{st.label}
                                                    </span>
                                                }
                                            />
                                        );
                                    })()}
                                </div>
                                <div className="col-span-2 rounded-lg border border-bo-border bg-bo-surface-subtle p-3">
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-bo-muted">Thời gian gửi</p>
                                    <p className="font-medium text-slate-700">{fmtDate(detailDialog.taoLuc)}</p>
                                </div>
                                {detailDialog.ghiChu && (
                                    <div className="col-span-2 rounded-lg border border-bo-border bg-bo-surface-subtle p-3">
                                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-bo-muted">Ghi chú</p>
                                        <p className="text-slate-700">{detailDialog.ghiChu}</p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-bo-muted">
                                    <Package className="size-3.5" />
                                    Danh sách Biến thể Sản phẩm ({detailDialog.bienTheSanPhamIds?.length ?? 0})
                                </p>
                                <div className="max-h-48 overflow-y-auto overflow-hidden rounded-lg border border-bo-border">
                                    {detailDialog.bienTheSanPhamIds?.length > 0 ? (
                                        detailDialog.bienTheSanPhamIds.map((id, i) => (
                                            <div
                                                key={id}
                                                className={`flex items-center justify-between border-b border-bo-border px-4 py-2.5 text-sm last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-bo-surface-subtle'
                                                    }`}
                                            >
                                                <span className="font-medium text-bo-muted">#{i + 1}</span>
                                                <span className="font-mono font-semibold text-bo-primary">ID: {id}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-6 text-center text-sm text-bo-muted">Không có biến thể</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setDetailDialog(null)} className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
                            Đóng
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageContainer>
    );
}
