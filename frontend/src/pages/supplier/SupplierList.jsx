// src/pages/supplier/SupplierList.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Plus, Edit, Trash2, Eye, Users,
    Phone, Mail, User2, SearchX,
} from 'lucide-react';
import { toast } from "@/lib/thongBaoNhanh";

import PageContainer from "@/components/backoffice/PageContainer";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import TablePagination from "@/components/shared/TablePagination";
import TableShell from "@/components/shared/TableShell";
import SupplierDeleteDialog from "@/components/supplier/SupplierDeleteDialog";
import SupplierFormDialog from "@/components/supplier/SupplierFormDialog";
import { laHoatDong } from "@/components/supplier/quyTacNhaCungCap";
import { Button } from "@/components/ui/button";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { getAllSupplier } from "@/services/supplierService";
import { getApiErrorMessage } from "@/utils/apiError";
import { ROLES, hasAnyRole } from "@/utils/roles";

// Thêm / sửa / xóa / ngừng hoạt động: khớp quyền ở backend (NhaCungCapController).
// Quản lý kho vẫn xem được danh sách và chi tiết nhưng không thấy các nút này.
const QUYEN_QUAN_LY_NCC = [ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG];
// Dòng vừa thêm được tô nền vài giây để dễ thấy.
const NEW_ROW_HIGHLIGHT_MS = 4000;

// ── Tab trạng thái (bố cục A+G) — giữ trên URL ?trangThai= ───────────────
const STATUS_TABS = [
    { value: "tat-ca",          label: "Tất cả" },
    { value: "hoat-dong",       label: "Hoạt động" },
    { value: "ngung-hoat-dong", label: "Ngừng hoạt động" },
];
const STATUS_TAB_VALUES = STATUS_TABS.map((tab) => tab.value);
const EMPTY_TAB_TITLE = {
    "hoat-dong":       "Không có nhà cung cấp nào đang hoạt động",
    "ngung-hoat-dong": "Không có nhà cung cấp nào ngừng hoạt động",
};

// Khớp badge trong bảng: trangThai = 1 là "Hoạt động", còn lại là "Ngừng hoạt động".
const matchTab = (item, tab) =>
    tab === "tat-ca" || (tab === "hoat-dong" ? laHoatDong(item) : !laHoatDong(item));

// Danh sách nhà cung cấp nhỏ: tải một lần, lọc ngay trên máy (không gọi lại API mỗi lần gõ).
const matchSearch = (item, search) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return [item.maNhaCungCap, item.tenNhaCungCap, item.nguoiLienHe, item.soDienThoai, item.email]
        .some((value) => value?.toLowerCase().includes(keyword));
};

// ── Main component ────────────────────────────────────────────────────────
export default function SupplierList() {
    const location = useLocation();
    const navigate = useNavigate();
    const coTheQuanLy = hasAnyRole(QUYEN_QUAN_LY_NCC);

    const [suppliers,    setSuppliers]    = useState([]);
    const [search,       setSearch]       = useState("");
    const [loading,      setLoading]      = useState(true);
    const [loadError,    setLoadError]    = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam     = searchParams.get("trangThai");
    const filterStatus = STATUS_TAB_VALUES.includes(tabParam) ? tabParam : "tat-ca";

    // Popup Thêm / Sửa: supplier null = thêm mới. Đóng popup chỉ đổi `open`, giữ `supplier`
    // để nội dung không đổi giữa chừng khi hiệu ứng đóng còn chạy.
    // /supplier/new (đường dẫn cũ) chuyển về đây kèm state để mở sẵn popup thêm mới.
    const [formDialog, setFormDialog] = useState(() => ({
        open: Boolean(location.state?.openCreateSupplier) && coTheQuanLy,
        supplier: null,
    }));
    const [deleteDialog, setDeleteDialog] = useState({ open: false, supplier: null });
    const openForm = (supplier = null) => setFormDialog({ open: true, supplier });
    const [highlightId, setHighlightId] = useState(null);

    // Pagination
    const [pageNumber,  setPageNumber]  = useState(0);
    const [pageSize,    setPageSize]    = useState(SO_DONG_MAC_DINH);

    // Chỉ nhận kết quả của lần tải mới nhất: lần tải ngầm về chậm không đè dữ liệu tải sau một thao tác
    const requestIdRef = useRef(0);
    // ── Fetch ──────────────────────────────────────────────────────────
    // silent: tải lại ngầm khi quay lại tab — giữ bảng đang xem, lỗi chỉ ghi log
    const fetchSuppliers = useCallback(async ({ silent = false } = {}) => {
        const requestId = ++requestIdRef.current;
        if (!silent) {
            setLoading(true);
            setLoadError(null);
        }
        try {
            const data = await getAllSupplier();
            if (requestId !== requestIdRef.current) return;
            setSuppliers(Array.isArray(data) ? data : []);
            setLoadError(null);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            if (silent) {
                console.error(error);
                return;
            }
            setLoadError(getApiErrorMessage(error, "Không thể tải danh sách nhà cung cấp"));
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, []);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); request vẫn chạy ngay khi mount.
    useEffect(() => { queueMicrotask(() => fetchSuppliers()); }, [fetchSuppliers]);

    // Quay lại tab thì tải lại ngầm (không tải khi đang mở hộp thêm / sửa / xóa)
    useTaiLaiKhiQuayLai(() => fetchSuppliers({ silent: true }), { bat: !loading });

    // /supplier/new đã mở sẵn popup: xóa state để F5 / quay lại không tự mở lại.
    useEffect(() => {
        if (!location.state?.openCreateSupplier) return;
        navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    }, [location, navigate]);

    // Bỏ tô nền dòng vừa thêm sau vài giây.
    useEffect(() => {
        if (highlightId == null) return undefined;
        const timer = setTimeout(() => setHighlightId(null), NEW_ROW_HIGHLIGHT_MS);
        return () => clearTimeout(timer);
    }, [highlightId]);

    // Đổi tab: ghi lên URL (F5 / quay lại vẫn đúng tab) và về trang đầu
    const changeTab = (value) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (value === "tat-ca") next.delete("trangThai");
            else next.set("trangThai", value);
            return next;
        }, { replace: true });
        setPageNumber(0);
    };

    const changeSearch = (value) => {
        setSearch(value);
        setPageNumber(0);
    };

    // ── Client-side filter ─────────────────────────────────────────────
    const searched = useMemo(
        () => suppliers.filter((item) => matchSearch(item, search)),
        [suppliers, search]
    );
    const filtered = useMemo(
        () => searched.filter((item) => matchTab(item, filterStatus)),
        [searched, filterStatus]
    );

    // Số trên tab = số dòng sẽ thấy khi bấm tab, theo từ khóa đang tìm (R1); đang tải thì không hiện (R9)
    const statusTabs = useMemo(
        () => STATUS_TABS.map((tab) => ({
            ...tab,
            count: loading || loadError ? null : searched.filter((item) => matchTab(item, tab.value)).length,
        })),
        [searched, loading, loadError]
    );

    // ── Pagination ─────────────────────────────────────────────────────
    const totalElements = filtered.length;
    const totalPages    = Math.max(1, Math.ceil(totalElements / pageSize));
    const safePage      = Math.min(pageNumber, totalPages - 1);
    const pageItems     = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

    const handlePageChange = (p) => {
        if (p >= 0 && p < totalPages) setPageNumber(p);
    };

    // "Xóa lọc" chỉ xóa từ khóa, giữ tab đang chọn
    const handleClearSearch = () => changeSearch("");

    // ── Kết quả từ các popup: cập nhật ngay trên bảng, giữ nguyên tab / trang / từ khóa ──
    const handleSaved = (saved, { laSua }) => {
        if (laSua) {
            setSuppliers((prev) => prev.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)));
            toast.success(`Đã lưu thay đổi của nhà cung cấp "${saved.tenNhaCungCap}"`);
            return;
        }
        // Danh sách xếp mới nhất lên đầu: thêm vào đầu, về trang 1 và tô nền dòng mới.
        setSuppliers((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
        setHighlightId(saved.id);
        setPageNumber(0);
        toast.success(`Đã thêm nhà cung cấp "${saved.tenNhaCungCap}"`, {
            description: filterStatus === "ngung-hoat-dong"
                ? "Nhà cung cấp mới ở tab Hoạt động."
                : undefined,
        });
    };

    const handleDeleted = (deleted) => {
        setSuppliers((prev) => prev.filter((item) => item.id !== deleted.id));
        toast.success(`Đã xóa nhà cung cấp "${deleted.tenNhaCungCap}"`);
    };

    const handleStatusChanged = (updated) => {
        setSuppliers((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
        toast.success(laHoatDong(updated)
            ? `Đã cho phép "${updated.tenNhaCungCap}" hoạt động lại`
            : `Đã ngừng hoạt động "${updated.tenNhaCungCap}"`);
    };

    return (
        <>
            <PageContainer fill className="space-y-4">
                <ListPageHeader
                    actions={
                        coTheQuanLy ? (
                            <Button
                                onClick={() => openForm()}
                                className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
                            >
                                <Plus className="size-4" />
                                Thêm nhà cung cấp
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
                                    label="Lọc nhà cung cấp theo trạng thái"
                                    tabs={statusTabs}
                                    value={filterStatus}
                                    onChange={changeTab}
                                />
                            }
                            hasFilter={Boolean(search.trim())}
                            onClear={handleClearSearch}
                        >
                            <SearchInput
                                label="Tìm nhà cung cấp"
                                placeholder="Tìm mã, tên, liên hệ, SĐT..."
                                value={search}
                                onChange={(e) => changeSearch(e.target.value)}
                                onClear={handleClearSearch}
                                className="sm:w-[300px]"
                            />
                        </ListToolbar>
                    }
                    footer={
                        !loading && !loadError && pageItems.length > 0 ? (
                            <TablePagination
                                page={safePage}
                                size={pageSize}
                                total={totalElements}
                                onPageChange={handlePageChange}
                                onSizeChange={(size) => { setPageSize(size); setPageNumber(0); }}
                            />
                        ) : null
                    }
                >
                    {loading ? (
                        <LoadingState rows={5} label="Đang tải danh sách nhà cung cấp" />
                    ) : loadError ? (
                        <ErrorState
                            title="Không thể tải danh sách nhà cung cấp"
                            description={loadError}
                            onRetry={() => fetchSuppliers()}
                        />
                    ) : pageItems.length === 0 ? (
                        search.trim() ? (
                            <EmptyState
                                icon={SearchX}
                                title="Không tìm thấy nhà cung cấp phù hợp"
                                description="Thử đổi từ khóa tìm kiếm."
                                action={
                                    <Button
                                        variant="outline"
                                        onClick={handleClearSearch}
                                        className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                    >
                                        Xóa lọc
                                    </Button>
                                }
                            />
                        ) : filterStatus !== "tat-ca" ? (
                            <EmptyState
                                icon={Users}
                                title={EMPTY_TAB_TITLE[filterStatus]}
                                description="Chọn tab Tất cả để xem mọi nhà cung cấp."
                                action={
                                    <Button
                                        variant="outline"
                                        onClick={() => changeTab("tat-ca")}
                                        className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                    >
                                        Xem tất cả
                                    </Button>
                                }
                            />
                        ) : (
                            <EmptyState
                                icon={Users}
                                title="Chưa có nhà cung cấp"
                                description="Thêm nhà cung cấp để gửi yêu cầu báo giá và lập đơn mua hàng."
                                action={
                                    coTheQuanLy ? (
                                        <Button
                                            onClick={() => openForm()}
                                            className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
                                        >
                                            <Plus className="size-4" />
                                            Thêm nhà cung cấp
                                        </Button>
                                    ) : null
                                }
                            />
                        )
                    ) : (
                        /* Bảng: khung giãn hết màn, thân bảng tự cuộn, tiêu đề cột đứng yên */
                        <table className="w-full min-w-[960px] text-sm">
                            <thead className="sticky top-0 z-10">
                                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                    {["STT", "Mã NCC", "Tên nhà cung cấp", "Người liên hệ", "SĐT", "Email", "Trạng thái", "Thao tác"].map((h, i) => (
                                        <th
                                            key={h}
                                            className={`h-10 whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted ${i === 7 ? "text-center" : "text-left"}`}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-bo-border">
                                {pageItems.map((item, index) => (
                                    <tr
                                        key={item.id}
                                        onClick={() => navigate(`/supplier/${item.id}`)}
                                        className={`cursor-pointer transition-colors hover:bg-bo-surface-subtle ${item.id === highlightId ? "bg-bo-primary-soft" : ""}`}
                                    >
                                        {/* STT */}
                                        <td className="px-3 py-3 text-xs text-bo-muted">
                                            {safePage * pageSize + index + 1}
                                        </td>

                                        {/* Mã NCC */}
                                        <td className="px-3 py-3">
                                            <span className="font-mono text-xs font-semibold text-bo-foreground">
                                                {item.maNhaCungCap || "—"}
                                            </span>
                                        </td>

                                        {/* Tên */}
                                        <td className="max-w-[220px] px-3 py-3">
                                            <span className="font-semibold leading-snug text-bo-foreground">
                                                {item.tenNhaCungCap}
                                            </span>
                                        </td>

                                        {/* Người liên hệ */}
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1.5 text-slate-600">
                                                <User2 className="size-3.5 shrink-0 text-slate-400" />
                                                <span>{item.nguoiLienHe || "—"}</span>
                                            </div>
                                        </td>

                                        {/* SĐT */}
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1.5 text-slate-600">
                                                <Phone className="size-3.5 shrink-0 text-slate-400" />
                                                <span>{item.soDienThoai || "—"}</span>
                                            </div>
                                        </td>

                                        {/* Email */}
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                <Mail className="size-3.5 shrink-0 text-slate-400" />
                                                <span>{item.email || "—"}</span>
                                            </div>
                                        </td>

                                        {/* Trạng thái */}
                                        <td className="whitespace-nowrap px-3 py-3">
                                            <StatusBadge label={laHoatDong(item) ? "Hoạt động" : "Ngừng hoạt động"} />
                                        </td>

                                        {/* Thao tác */}
                                        <td className="px-3 py-3">
                                            <RowActions>
                                                <RowActionButton
                                                    icon={Eye}
                                                    label="Xem chi tiết"
                                                    onClick={() => navigate(`/supplier/${item.id}`)}
                                                />
                                                {coTheQuanLy ? (
                                                    <>
                                                        <RowActionButton
                                                            icon={Edit}
                                                            label="Chỉnh sửa"
                                                            onClick={() => openForm(item)}
                                                        />
                                                        <RowActionButton
                                                            icon={Trash2}
                                                            label="Xóa"
                                                            tone="danger"
                                                            onClick={() => setDeleteDialog({ open: true, supplier: item })}
                                                        />
                                                    </>
                                                ) : null}
                                            </RowActions>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </TableShell>
            </PageContainer>

            <SupplierFormDialog
                open={formDialog.open}
                supplier={formDialog.supplier}
                onOpenChange={(open) => setFormDialog((prev) => ({ ...prev, open }))}
                onSaved={handleSaved}
            />

            <SupplierDeleteDialog
                supplier={deleteDialog.supplier}
                open={deleteDialog.open}
                onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
                onDeleted={handleDeleted}
                onStatusChanged={handleStatusChanged}
            />
        </>
    );
}
