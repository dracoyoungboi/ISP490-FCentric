// src/pages/supplier/SupplierList.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Plus, Edit, Trash2, Eye, Loader2, Users,
    Phone, Mail, User2, AlertTriangle, SearchX,
} from 'lucide-react';
import { toast } from "sonner";

import PageContainer from "@/components/backoffice/PageContainer";
import EmptyState from "@/components/shared/EmptyState";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import TablePagination from "@/components/shared/TablePagination";
import TableShell from "@/components/shared/TableShell";
import { Button } from "@/components/ui/button";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";

import { getAllSupplier, deleteSupplier } from "@/services/supplierService";

// Ô tìm kiếm: lọc ngay trên dữ liệu đang có, chỉ gọi lại API khi ngừng gõ
const SEARCH_DEBOUNCE_MS = 350;

// ── Confirm Delete Modal (tách hoàn toàn khỏi table row) ─────────────────
function ConfirmDeleteModal({ target, isDeleting, onConfirm, onCancel }) {
    if (!target) return null;
    return (
        // Backdrop
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={!isDeleting ? onCancel : undefined}
            />
            {/* Dialog */}
            <div className="relative z-10 mx-4 w-full max-w-md overflow-hidden rounded-lg border border-bo-border bg-white text-bo-foreground shadow-lg">
                {/* Header */}
                <div className="flex items-center gap-3 border-b border-bo-border bg-bo-danger-soft px-5 py-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-bo-danger">
                        <AlertTriangle className="size-5" />
                    </span>
                    <div>
                        <p className="text-base font-semibold leading-snug text-bo-danger">
                            Xác nhận xóa nhà cung cấp
                        </p>
                        <p className="mt-0.5 text-xs text-bo-muted">Hành động này không thể hoàn tác</p>
                    </div>
                </div>

                {/* Body */}
                <div className="px-5 py-4">
                    <p className="text-sm leading-relaxed text-slate-600">
                        Bạn có chắc chắn muốn xóa nhà cung cấp{" "}
                        <span className="font-semibold text-bo-foreground">"{target.tenNhaCungCap}"</span>{" "}
                        (mã: <span className="font-mono font-semibold text-bo-foreground">{target.maNhaCungCap}</span>)?
                    </p>
                    <p className="mt-2 text-xs text-bo-muted">
                        Toàn bộ thông tin liên quan đến nhà cung cấp này sẽ bị xóa vĩnh viễn.
                    </p>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 border-t border-bo-border bg-bo-surface-subtle px-5 py-3">
                    <Button
                        type="button"
                        variant="outline"
                        className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        onClick={onCancel}
                        disabled={isDeleting}
                    >
                        Hủy bỏ
                    </Button>
                    <Button
                        type="button"
                        className="min-w-[100px] border border-bo-danger bg-bo-danger text-white hover:bg-bo-danger/90"
                        onClick={onConfirm}
                        disabled={isDeleting}
                    >
                        {isDeleting ? (
                            <><Loader2 className="mr-2 size-4 animate-spin" />Đang xóa...</>
                        ) : (
                            <><Trash2 className="mr-2 size-4" />Xóa</>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

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
    tab === "tat-ca" || (tab === "hoat-dong" ? item.trangThai === 1 : item.trangThai !== 1);

const matchSearch = (item, search) => {
    const keyword = search.trim().toLowerCase();
    return (
        !keyword ||
        item.maNhaCungCap?.toLowerCase().includes(keyword) ||
        item.tenNhaCungCap?.toLowerCase().includes(keyword) ||
        item.nguoiLienHe?.toLowerCase().includes(keyword)
    );
};

// ── Main component ────────────────────────────────────────────────────────
export default function SupplierList() {
    const [suppliers,    setSuppliers]    = useState([]);
    const [search,       setSearch]       = useState("");
    // Từ khóa gửi lên API: đổi sau khi ngừng gõ SEARCH_DEBOUNCE_MS (gõ từng chữ không gọi API, bảng không nháy)
    const [apiSearch,    setApiSearch]    = useState("");
    const [loading,      setLoading]      = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam     = searchParams.get("trangThai");
    const filterStatus = STATUS_TAB_VALUES.includes(tabParam) ? tabParam : "tat-ca";

    // Delete state — tách riêng, không dùng Dialog lồng trong table row
    const [deleteTarget, setDeleteTarget] = useState(null); // object nhà cung cấp cần xóa
    const [isDeleting,   setIsDeleting]   = useState(false);

    // Pagination
    const [pageNumber,  setPageNumber]  = useState(0);
    const [pageSize,    setPageSize]    = useState(SO_DONG_MAC_DINH);

    const navigate = useNavigate();

    // ── Fetch ──────────────────────────────────────────────────────────
    const fetchSuppliers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAllSupplier(apiSearch);
            setSuppliers(data);
            setPageNumber(0);
        } catch {
            toast.error("Không thể tải danh sách nhà cung cấp");
        } finally {
            setLoading(false);
        }
    }, [apiSearch]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); request vẫn chạy ngay khi mount.
    useEffect(() => { queueMicrotask(() => fetchSuppliers()); }, [fetchSuppliers]);

    useEffect(() => {
        const value = search.trim();
        if (value === apiSearch) return undefined;
        const timer = setTimeout(() => setApiSearch(value), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [search, apiSearch]);

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

    // ── Delete ─────────────────────────────────────────────────────────
    const handleDeleteClick = (item) => {
        setDeleteTarget(item);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteSupplier(deleteTarget.id);
            toast.success(`Đã xóa nhà cung cấp "${deleteTarget.tenNhaCungCap}" thành công`);
            setDeleteTarget(null);
            // Reload và điều chỉnh trang nếu xóa hết item trang cuối
            const updated = suppliers.filter(s => s.id !== deleteTarget.id);
            setSuppliers(updated);
            const newTotal  = updated.filter(s => matchSearch(s, search) && matchTab(s, filterStatus)).length;
            const newTotalPages = Math.max(1, Math.ceil(newTotal / pageSize));
            if (pageNumber >= newTotalPages) setPageNumber(Math.max(0, newTotalPages - 1));
        } catch (err) {
            toast.error(err.response?.data?.message || "Xóa thất bại, vui lòng thử lại");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCancelDelete = () => {
        if (!isDeleting) setDeleteTarget(null);
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
            count: loading ? null : searched.filter((item) => matchTab(item, tab.value)).length,
        })),
        [searched, loading]
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
    const handleClearSearch = () => {
        setSearch("");
        setApiSearch("");
    };

    return (
        <>
            {/* ── Confirm delete modal (portal-like, ngoài layout chính) ── */}
            <ConfirmDeleteModal
                target={deleteTarget}
                isDeleting={isDeleting}
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />

            <PageContainer fill className="space-y-4">
                <ListPageHeader
                    actions={
                        <Button
                            onClick={() => navigate("/supplier/new")}
                            className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            <Plus className="size-4" />
                            Thêm nhà cung cấp
                        </Button>
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
                                placeholder="Tìm theo mã, tên, người liên hệ..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onClear={handleClearSearch}
                                className="sm:w-[300px]"
                            />
                        </ListToolbar>
                    }
                    footer={
                        !loading && pageItems.length > 0 ? (
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
                                    <tr key={item.id} className="transition-colors hover:bg-bo-surface-subtle">
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
                                            <StatusBadge
                                                label={item.trangThai === 1 ? "Hoạt động" : "Ngừng hoạt động"}
                                                tone={item.trangThai === 1 ? "success" : "neutral"}
                                            />
                                        </td>

                                        {/* Thao tác */}
                                        <td className="px-3 py-3">
                                            <RowActions>
                                                <RowActionButton
                                                    icon={Eye}
                                                    label="Xem chi tiết"
                                                    onClick={() => navigate(`/supplier/view/${item.id}`)}
                                                />
                                                <RowActionButton
                                                    icon={Edit}
                                                    label="Chỉnh sửa"
                                                    onClick={() => navigate(`/supplier/${item.id}`)}
                                                />
                                                <RowActionButton
                                                    icon={Trash2}
                                                    label="Xóa"
                                                    tone="danger"
                                                    onClick={() => handleDeleteClick(item)}
                                                />
                                            </RowActions>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </TableShell>
            </PageContainer>
        </>
    );
}
