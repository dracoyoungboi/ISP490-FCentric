import { getApiErrorMessage } from "@/utils/apiError";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Edit, Eye, Package, Plus, SearchX } from 'lucide-react';

import PageContainer from '@/components/backoffice/PageContainer';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import ListPageHeader from '@/components/shared/ListPageHeader';
import ListToolbar from '@/components/shared/ListToolbar';
import LoadingState from '@/components/shared/LoadingState';
import SearchInput from '@/components/shared/SearchInput';
import StatusBadge from '@/components/shared/StatusBadge';
import StatusTabs from '@/components/shared/StatusTabs';
import TableShell from '@/components/shared/TableShell';
import TablePagination from '@/components/shared/TablePagination';
import { RowActionButton, RowActions } from '@/components/shared/RowActions';
import { Button } from '@/components/ui/button';
import { SO_DONG_MAC_DINH } from '@/constants/phanTrang';
import { formatNumber } from '@/utils/formatters';
import { toast } from '@/lib/thongBaoNhanh';
import { khoService } from '@/services/khoService';
import { trangCuoiNeuVuot } from '@/lib/tinhTaiLai';
import useDemTheoTrangThai from '@/hooks/useDemTheoTrangThai';
import useTabTrenUrl from '@/hooks/useTabTrenUrl';
import useTaiLaiKhiQuayLai from '@/hooks/useTaiLaiKhiQuayLai';
import { hasAnyRole, ROLES } from '@/utils/roles';
import {
    WarehouseDialog
} from '.';
import ChiTietKhoDialog from './ChiTietKhoDialog';
import HopTrangThaiKho from './HopTrangThaiKho';
import { laKhoAo, nhanLoaiKho } from './loaiKho';

/* ── Tab trạng thái (bố cục A+G) — giữ trên URL ?trangThai= ── */
const STATUS_TABS = [
    { value: 'tat-ca', label: 'Tất cả' },
    { value: 'hoat-dong', label: 'Hoạt động' },
    { value: 'ngung-hoat-dong', label: 'Ngừng hoạt động' },
];
const STATUS_TAB_VALUES = STATUS_TABS.map((tab) => tab.value);
const TAB_MAC_DINH = 'tat-ca';
const EMPTY_TAB_TITLE = {
    'hoat-dong': 'Không có kho nào đang hoạt động',
    'ngung-hoat-dong': 'Không có kho nào ngừng hoạt động',
};

/* ── Filter payload builder ── */
function buildPayload(filters) {
    const list = [];
    if (filters.searchTerm?.trim()) {
        ["tenKho", "maKho", "diaChi"].forEach(f =>
            list.push({ fieldName: f, operation: "ILIKE", value: filters.searchTerm.trim(), logicType: "OR" })
        );
    }
    // Khớp badge trong bảng: trangThai = 1 là "Hoạt động", còn lại là "Ngừng hoạt động"
    if (filters.trangThai === 'hoat-dong')
        list.push({ fieldName: "trangThai", operation: "EQUALS", value: 1, logicType: "AND" });
    else if (filters.trangThai === 'ngung-hoat-dong')
        list.push({ fieldName: "trangThai", operation: "NOT_IN", value: [1], logicType: "AND" });

    return {
        filters: list,
        sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
        page: filters.pageNumber,
        size: filters.pageSize,
    };
}

/* ════════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════════ */
export default function WarehouseManagement() {
    const [warehouses, setWarehouses] = useState([]);
    const [managers, setManagers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [isLoadingManagers, setIsLoadingManagers] = useState(false);
    const requestIdRef = useRef(0);

    const [searchInput, setSearchInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [tab, setTab] = useTabTrenUrl(STATUS_TAB_VALUES, TAB_MAC_DINH);
    const [pagination, setPagination] = useState({
        pageNumber: 0, pageSize: SO_DONG_MAC_DINH, totalElements: 0, totalPages: 0,
    });

    const [showDialog, setShowDialog] = useState(false);
    const [dialogMode, setDialogMode] = useState('create');
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);
    // Popup Chi tiết kho (PA2) và hộp Ngừng / Cho phép hoạt động (thay cho nút "Xóa kho" cũ)
    const [chiTiet, setChiTiet] = useState({ open: false, kho: null });
    const [doiTrangThai, setDoiTrangThai] = useState({ open: false, kho: null });
    // Thêm / sửa / đổi trạng thái kho là quyền của quản trị viên (API create, update, trang-thai)
    const laQuanTriVien = hasAnyRole([ROLES.QUAN_TRI_VIEN]);

    const [formData, setFormData] = useState({
        maKho: '', tenKho: '', diaChi: '', quanLyId: '', trangThai: 1, loaiKho: 'cua_hang',
    });
    const [errors, setErrors] = useState({});

    // Từ khóa áp dụng sau khi ngừng gõ; đổi từ khóa thì về trang đầu
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setSearchTerm(searchInput);
            setPagination(prev => (prev.pageNumber === 0 ? prev : { ...prev, pageNumber: 0 }));
        }, 250);

        return () => clearTimeout(timeoutId);
    }, [searchInput]);

    /* ── Fetch warehouses ── */
    // silent: tải lại ngầm khi quay lại tab — giữ bảng đang xem, lỗi chỉ ghi log
    const fetchWarehouses = useCallback(async (
        page = pagination.pageNumber,
        size = pagination.pageSize,
        { silent = false } = {},
    ) => {
        // Đổi tab / từ khóa liên tiếp có thể chạy 2 yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
        const requestId = ++requestIdRef.current;
        try {
            if (!silent) setIsLoading(true);
            const res = await khoService.filter(
                buildPayload({ searchTerm, trangThai: tab, pageNumber: page, pageSize: size })
            );
            if (requestId !== requestIdRef.current) return;
            const d = res?.data?.data ?? res?.data;
            if (d) {
                const content = d.content || [];
                const totalElements = d.totalElements || 0;
                // Trang đang xem vượt quá số trang (vd. vừa xóa kho cuối của trang cuối) → lùi về trang cuối có dữ liệu
                const trangCuoi = trangCuoiNeuVuot({ trang: page, kichThuoc: size, soDong: content.length, tong: totalElements });
                if (trangCuoi != null) {
                    setPagination(prev => ({ ...prev, pageNumber: trangCuoi }));
                    return;
                }
                setWarehouses(content);
                setPagination(prev => ({
                    ...prev,
                    pageNumber: d.number || 0,
                    pageSize: Math.max(d.size, 1),
                    totalElements,
                    totalPages: d.totalPages || 0,
                }));
            } else {
                setWarehouses([]);
            }
            setLoadError(false);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.error("Lỗi khi tải danh sách kho:", err);
            if (silent) return;
            toast.error("Không thể tải danh sách kho");
            // Không giữ dòng + tổng số của lần tải trước (R9)
            setWarehouses([]);
            setPagination(prev => ({ ...prev, totalElements: 0, totalPages: 0 }));
            setLoadError(true);
        } finally {
            if (requestId === requestIdRef.current) setIsLoading(false);
        }
    }, [searchTerm, tab, pagination.pageNumber, pagination.pageSize]);

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

    /* ── Số trên tab: cùng từ khóa đang tìm, chỉ thay trạng thái (R1) ── */
    const { counts: tabCounts, reload: reloadCounts } = useDemTheoTrangThai(
        STATUS_TAB_VALUES,
        async (trangThai) => {
            const res = await khoService.filter(
                buildPayload({ searchTerm, trangThai, pageNumber: 0, pageSize: 1 })
            );
            const d = res?.data?.data ?? res?.data;
            return d?.totalElements ?? 0;
        },
        searchTerm
    );

    /* ── Pagination ── */
    const handlePageChange = p => { if (p >= 0 && p < pagination.totalPages) setPagination(prev => ({ ...prev, pageNumber: p })); };
    const handlePageSizeChange = sz => setPagination(prev => ({ ...prev, pageSize: sz, pageNumber: 0 }));

    // Đổi tab: ghi lên URL và về trang đầu
    const changeTab = (value) => {
        setTab(value);
        setPagination(prev => (prev.pageNumber === 0 ? prev : { ...prev, pageNumber: 0 }));
    };

    const hasActiveFilters = Boolean(searchInput.trim());

    // "Xóa lọc": bỏ từ khóa, giữ tab đang chọn
    const clearFilters = () => {
        setSearchInput('');
        setSearchTerm('');
        setPagination(prev => (prev.pageNumber === 0 ? prev : { ...prev, pageNumber: 0 }));
    };

    const handleRetry = () => {
        fetchWarehouses();
        reloadCounts();
    };

    // Quay lại tab thì tải lại ngầm danh sách + số trên tab (không tải khi đang mở popup)
    useTaiLaiKhiQuayLai(() => {
        reloadCounts();
        fetchWarehouses(pagination.pageNumber, pagination.pageSize, { silent: true });
    }, { bat: !isLoading });

    /* ── Validation ── */
    const validateForm = () => {
        const e = {};
        if (!formData.maKho) e.maKho = 'Vui lòng nhập mã kho';
        if (!formData.tenKho) e.tenKho = 'Vui lòng nhập tên kho';
        else if (formData.tenKho.length < 5) e.tenKho = 'Tên kho phải có ít nhất 5 ký tự';
        if (!formData.diaChi) e.diaChi = 'Vui lòng nhập địa chỉ';
        if (!formData.quanLyId) e.quanLyId = 'Vui lòng chọn người quản lý';
        if (formData.loaiKho === 'kho_tong' && Number(formData.trangThai) === 1) {
            const khoTongKhac = warehouses.find(w => w.loaiKho === 'kho_tong' && w.trangThai === 1 && !laKhoAo(w) && w.id !== selectedWarehouse?.id);
            if (khoTongKhac) e.loaiKho = `Đã có Kho tổng đang hoạt động: ${khoTongKhac.tenKho}. Hãy đổi kho đó thành Kho bán hàng trước.`;
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    /* ── Dialog ── */
    const moChiTiet = (wh) => setChiTiet({ open: true, kho: wh });

    const handleOpenDialog = (mode, wh = null) => {
        setDialogMode(mode);
        setSelectedWarehouse(wh);
        if (mode === 'create')
            setFormData({ maKho: '', tenKho: '', diaChi: '', quanLyId: '', trangThai: 1, loaiKho: 'cua_hang' });
        else if (mode === 'edit' && wh)
            setFormData({ maKho: wh.maKho, tenKho: wh.tenKho, diaChi: wh.diaChi, quanLyId: wh.quanLy?.id?.toString() || '', trangThai: wh.trangThai ?? 1, loaiKho: wh.loaiKho || 'cua_hang' });
        setErrors({});
        setShowDialog(true);
    };

    const handleCloseDialog = () => { setShowDialog(false); setSelectedWarehouse(null); setErrors({}); };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        try {
            const data = { maKho: formData.maKho, tenKho: formData.tenKho, diaChi: formData.diaChi, quanLyId: Number(formData.quanLyId), trangThai: Number(formData.trangThai), loaiKho: formData.loaiKho };
            let res;
            if (dialogMode === 'create') res = await khoService.create(data);
            else if (dialogMode === 'edit') res = await khoService.update({ id: selectedWarehouse.id, ...data });
            if (res?.data?.status >= 400) { toast.error(res.data.message || 'Có lỗi xảy ra'); return; }
            toast.success(dialogMode === 'create' ? 'Thêm kho mới thành công.' : 'Cập nhật thông tin kho thành công.');
            setShowDialog(false); setErrors({}); fetchWarehouses(); reloadCounts();
        } catch (err) {
            console.error('Chi tiết lỗi:', err);
            console.error('Error response:', err.response);
            console.error('Error response data:', err.response?.data);
            toast.error(getApiErrorMessage(err, 'Có lỗi xảy ra khi xử lý kho'));
        }
    };

    // Sau khi đổi trạng thái: cập nhật ngay dòng và popup đang mở, rồi tải lại danh sách + số trên tab
    const handleTrangThaiDaDoi = (khoMoi) => {
        const hoatDong = Number(khoMoi?.trangThai) === 1;
        toast.success(hoatDong ? `Đã cho phép ${khoMoi.tenKho} hoạt động lại.` : `Đã ngừng hoạt động ${khoMoi.tenKho}.`);
        setWarehouses(prev => prev.map(w => (w.id === khoMoi.id ? { ...w, ...khoMoi } : w)));
        setChiTiet(prev => (prev.kho?.id === khoMoi.id ? { ...prev, kho: { ...prev.kho, ...khoMoi } } : prev));
        fetchWarehouses();
        reloadCounts();
    };

    // Số chỉ hiện khi đã đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs
    const statusTabs = STATUS_TABS.map((t) => ({
        ...t,
        count: loadError ? null : tabCounts[t.value],
    }));

    /* ══════════════
       RENDER
    ══════════════ */
    return (
        <PageContainer fill className="space-y-4">
            <ListPageHeader
                actions={
                    laQuanTriVien ? (
                        <Button
                            onClick={() => handleOpenDialog('create')}
                            className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            <Plus className="size-4" />
                            Thêm kho
                        </Button>
                    ) : null
                }
            />

            {/* ── Table ── */}
            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label="Lọc kho theo trạng thái"
                                tabs={statusTabs}
                                value={tab}
                                onChange={changeTab}
                            />
                        }
                        hasFilter={hasActiveFilters}
                        onClear={clearFilters}
                    >
                        <SearchInput
                            label="Tìm kho"
                            placeholder="Tìm theo tên kho, mã kho, địa chỉ..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onClear={() => setSearchInput('')}
                            className="sm:w-[320px]"
                        />
                    </ListToolbar>
                }
                footer={
                    !isLoading && !loadError && warehouses.length > 0 ? (
                        <TablePagination
                            page={pagination.pageNumber}
                            size={pagination.pageSize}
                            total={pagination.totalElements}
                            onPageChange={handlePageChange}
                            onSizeChange={handlePageSizeChange}
                        />
                    ) : null
                }
            >
                {isLoading ? (
                    <LoadingState rows={5} label="Đang tải danh sách kho" />
                ) : loadError ? (
                    <ErrorState
                        description="Không thể tải danh sách kho. Vui lòng thử lại."
                        onRetry={handleRetry}
                    />
                ) : warehouses.length === 0 ? (
                    hasActiveFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy kho phù hợp"
                            description="Thử đổi từ khóa tìm kiếm."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={clearFilters}
                                    className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Xóa lọc
                                </Button>
                            }
                        />
                    ) : tab !== TAB_MAC_DINH ? (
                        <EmptyState
                            icon={Package}
                            title={EMPTY_TAB_TITLE[tab]}
                            description="Chọn tab Tất cả để xem mọi kho."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() => changeTab(TAB_MAC_DINH)}
                                    className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Xem tất cả
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={Package}
                            title="Chưa có kho"
                            description="Thêm kho để quản lý tồn kho và người phụ trách từng kho."
                            action={
                                laQuanTriVien ? (
                                    <Button
                                        onClick={() => handleOpenDialog('create')}
                                        className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                                    >
                                        <Plus className="size-4" />
                                        Thêm kho
                                    </Button>
                                ) : null
                            }
                        />
                    )
                ) : (
                    <table className="w-full min-w-[1020px] text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className="h-10 w-14 px-3 text-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    STT
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Mã kho
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Tên kho
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Loại kho
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Người quản lý
                                </th>
                                <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Trạng thái
                                </th>
                                <th className="h-10 px-3 text-right tabular-nums whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Tồn kho
                                </th>
                                <th className="h-10 px-3 text-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Thao tác
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {warehouses.map((wh, idx) => (
                                <tr
                                    key={wh.id}
                                    onClick={() => moChiTiet(wh)}
                                    className={`cursor-pointer transition-colors hover:bg-bo-surface-subtle ${chiTiet.open && chiTiet.kho?.id === wh.id ? 'bg-bo-primary-soft' : ''}`}
                                >
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
                                    <td className="px-3 py-3">
                                        <span title={nhanLoaiKho(wh).moTa} className="whitespace-nowrap text-slate-700">
                                            {nhanLoaiKho(wh).label}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-sm text-bo-foreground">
                                        {wh.quanLy?.hoTen || '—'}
                                    </td>
                                    <td className="px-3 py-3">
                                        <StatusBadge label={wh.trangThai === 1 ? 'Hoạt động' : 'Ngừng hoạt động'} />
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">
                                        {wh.soLuongTon == null ? (
                                            <span className="text-bo-muted">—</span>
                                        ) : (
                                            <span className="font-semibold text-bo-foreground">{formatNumber(wh.soLuongTon)}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3">
                                        <RowActions>
                                            <RowActionButton
                                                icon={Eye}
                                                label="Xem chi tiết"
                                                onClick={() => moChiTiet(wh)}
                                            />
                                            {laQuanTriVien ? (
                                                <RowActionButton
                                                    icon={Edit}
                                                    label="Chỉnh sửa"
                                                    onClick={() => handleOpenDialog('edit', wh)}
                                                />
                                            ) : null}
                                        </RowActions>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </TableShell>

            {/* ── Modals ── */}
            <WarehouseDialog
                showDialog={showDialog}
                setShowDialog={setShowDialog}
                dialogMode={dialogMode}
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                managers={managers}
                isLoadingManagers={isLoadingManagers}
                onSubmit={handleSubmit}
                onClose={handleCloseDialog}
            />

            <ChiTietKhoDialog
                kho={chiTiet.kho}
                open={chiTiet.open}
                onOpenChange={(open) => setChiTiet(prev => ({ ...prev, open }))}
                coTheQuanLy={laQuanTriVien}
                onChinhSua={(wh) => {
                    setChiTiet(prev => ({ ...prev, open: false }));
                    handleOpenDialog('edit', wh);
                }}
                onDoiTrangThai={(wh) => setDoiTrangThai({ open: true, kho: wh })}
            />

            <HopTrangThaiKho
                kho={doiTrangThai.kho}
                open={doiTrangThai.open}
                onOpenChange={(open) => setDoiTrangThai(prev => ({ ...prev, open }))}
                onChanged={handleTrangThaiDaDoi}
            />
        </PageContainer>
    );
}
