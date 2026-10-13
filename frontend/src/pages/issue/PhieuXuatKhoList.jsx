import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
    ClipboardList, FileText, Filter, Package, Plus, RefreshCcw, XCircle,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import FilterBar from "@/components/shared/FilterBar";
import SearchInput from "@/components/shared/SearchInput";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { PHIEU_XUAT_STATUS } from "@/constants/trangThaiXuatBan";

const STATUS_MAP = PHIEU_XUAT_STATUS;

const STATUS_OPTIONS = [
    { value: "", label: "Tất cả trạng thái" },
    { value: "0", label: "Nháp" },
    { value: "6", label: "Chờ xuất (đã đóng gói)" },
    { value: "1", label: "Chờ duyệt" },
    { value: "2", label: "Đã duyệt" },
    { value: "3", label: "Đã xuất" },
    { value: "4", label: "Đã hủy" },
];

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

function buildFilterPayload(filters) {
    const filterList = [];
    if (filters.keyword?.trim()) {
        const searchKeyword = filters.keyword.trim();
        ["soPhieuXuat", "donBanHang.soDonHang"].forEach((field) => {
            filterList.push({ fieldName: field, operation: "LIKE", value: searchKeyword, logicType: "OR" });
        });
    }
    if (filters.trangThai !== "") {
        filterList.push({ fieldName: "trangThai", operation: "EQUALS", value: Number(filters.trangThai) });
    }
    if (filters.tenKho !== "") {
        filterList.push({ fieldName: "kho.tenKho", operation: "LIKE", value: filters.tenKho.trim() });
    }
    return { page: filters.page, size: filters.size, filters: filterList, sorts: [{ fieldName: "ngayTao", direction: "DESC" }] };
}

export default function PhieuXuatKhoList() {
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);

    const [filters, setFilters] = useState({
        keyword: "",
        tenKho: "",
        trangThai: "",
        ngayXuat: "",
        page: 0,
        size: 10,
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await phieuXuatKhoService.filter(buildFilterPayload(filters));
            let finalData = res.content || [];

            // Lọc ngày xuất phía client (ngayXuat, fallback ngayTao)
            if (filters.ngayXuat) {
                finalData = finalData.filter((item) => {
                    const dateValue = item.ngayXuat || item.ngayTao;
                    if (!dateValue) return false;
                    const date = new Date(dateValue);
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    return `${y}-${m}-${d}` === filters.ngayXuat;
                });
            }

            setData(finalData);
            setTotal(res.totalElements || 0); // Phân trang sẽ nhận chuẩn 10/10 dòng
        } catch (e) {
            console.error("Fetch list error:", e);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn fetch lại ngay mỗi khi bộ lọc đổi.
    useEffect(() => {
        queueMicrotask(() => fetchData());
    }, [fetchData]);

    const totalPages = Math.max(1, Math.ceil(total / filters.size));

    const handleReset = () => {
        setFilters({ keyword: "", tenKho: "", trangThai: "", ngayXuat: "", page: 0, size: 10 });
    };

    const stats = useMemo(() => ({
        nhap: data.filter((d) => d.trangThai === 0).length,
        daXuat: data.filter((d) => d.trangThai === 3 || d.trangThai === 5).length,
        daHuy: data.filter((d) => d.trangThai === 4).length,
    }), [data]);

    return (
        <PageContainer className="space-y-5">

            {/* ══ STATS ══ */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                    icon={<Package className="size-5" />}
                    iconClass="bg-bo-primary-soft text-bo-primary"
                    label="Tổng phiếu xuất"
                    value={total}
                />
                <StatTile
                    icon={<FileText className="size-5" />}
                    iconClass="bg-bo-warning-soft text-bo-warning"
                    label="Nháp"
                    value={stats.nhap}
                />
                <StatTile
                    icon={<CheckCircle2 className="size-5" />}
                    iconClass="bg-bo-success-soft text-bo-success"
                    label="Đã xuất"
                    value={stats.daXuat}
                />
                <StatTile
                    icon={<XCircle className="size-5" />}
                    iconClass="bg-bo-danger-soft text-bo-danger"
                    label="Đã hủy"
                    value={stats.daHuy}
                />
            </section>

            {/* ══ BỘ LỌC TÌM KIẾM ══ */}
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
                            placeholder="Nhập số phiếu..."
                            label="Số phiếu / Mã tham chiếu"
                            value={filters.keyword}
                            onChange={(e) => setFilters((p) => ({ ...p, keyword: e.target.value, page: 0 }))}
                            onClear={() => setFilters((p) => ({ ...p, keyword: "", page: 0 }))}
                        />
                    }
                    filters={
                        <>
                            <input
                                type="text"
                                placeholder="Nhập tên kho"
                                aria-label="Kho xuất"
                                value={filters.tenKho}
                                onChange={(e) => setFilters((p) => ({ ...p, tenKho: e.target.value, page: 0 }))}
                                className="h-9 w-full rounded-md border border-bo-border bg-white px-3 text-sm text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 sm:w-[190px]"
                            />

                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-9 w-full justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle sm:w-[180px]"
                                    >
                                        <span className="truncate">
                                            {STATUS_OPTIONS.find((s) => s.value === filters.trangThai)?.label || "Tất cả trạng thái"}
                                        </span>
                                        <ChevronDown className="size-4 shrink-0 opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="backoffice-user-menu z-50 w-[200px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                >
                                    {STATUS_OPTIONS.map((s) => (
                                        <DropdownMenuItem
                                            key={s.value}
                                            onClick={() => setFilters((p) => ({ ...p, trangThai: s.value, page: 0 }))}
                                            className="cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            {s.label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <input
                                type="date"
                                aria-label="Ngày xuất"
                                value={filters.ngayXuat}
                                disabled={loading}
                                onChange={(e) => setFilters((p) => ({ ...p, ngayXuat: e.target.value, page: 0 }))}
                                className="h-9 w-full rounded-md border border-bo-border bg-white px-3 text-sm text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 disabled:opacity-50 sm:w-[170px]"
                            />

                            <Button
                                variant="outline"
                                onClick={handleReset}
                                disabled={loading}
                                className="h-9 gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                            >
                                <RefreshCcw className="size-4" />
                                Đặt lại
                            </Button>
                        </>
                    }
                    actions={
                        <Link to="/goods-issues/create">
                            <Button className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                                <Plus className="size-4" />
                                Tạo phiếu xuất kho
                            </Button>
                        </Link>
                    }
                />
            </div>

            {/* ══ TABLE / LOADING / EMPTY ══ */}
            {loading ? (
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <LoadingState rows={6} label="Đang tải danh sách phiếu xuất kho" />
                </div>
            ) : data.length === 0 ? (
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <EmptyState
                        icon={ClipboardList}
                        title="Không tìm thấy phiếu xuất kho"
                        description="Hiện tại chưa có dữ liệu phù hợp. Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."
                    />
                </div>
            ) : (
                <TableShell
                    title="Danh sách phiếu xuất kho"
                    description={`Tổng ${total} phiếu xuất kho`}
                    footer={
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-bo-muted">Hiển thị</span>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-8 w-[110px] justify-between border-bo-border bg-white px-2.5 text-xs font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                        >
                                            {filters.size} dòng
                                            <ChevronDown className="size-3.5 opacity-60" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="start"
                                        className="backoffice-user-menu z-50 w-[110px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                    >
                                        {PAGE_SIZE_OPTIONS.map((size) => (
                                            <DropdownMenuItem
                                                key={size}
                                                onClick={() => setFilters((p) => ({ ...p, size, page: 0 }))}
                                                className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                            >
                                                {size} dòng
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <p className="text-xs text-bo-muted">
                                Hiển thị{" "}
                                <span className="font-semibold text-bo-foreground">
                                    {filters.page * filters.size + 1}
                                </span>
                                {" – "}
                                <span className="font-semibold text-bo-foreground">
                                    {Math.min((filters.page + 1) * filters.size, total)}
                                </span>
                                {" trong tổng số "}
                                <span className="font-semibold text-bo-primary">{total}</span> kết quả
                            </p>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
                                    disabled={filters.page === 0}
                                    className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                                >
                                    <ChevronLeft className="size-3.5" />
                                    Trước
                                </Button>

                                <div className="hidden items-center gap-1 sm:flex">
                                    {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                                        let pageNum;
                                        if (totalPages <= 5) pageNum = idx;
                                        else if (filters.page < 3) pageNum = idx;
                                        else if (filters.page > totalPages - 4) pageNum = totalPages - 5 + idx;
                                        else pageNum = filters.page - 2 + idx;
                                        return (
                                            <Button
                                                key={idx}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setFilters((p) => ({ ...p, page: pageNum }))}
                                                className={
                                                    filters.page === pageNum
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
                                    onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
                                    disabled={filters.page + 1 >= totalPages || data.length === 0}
                                    className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                                >
                                    Sau
                                    <ChevronRight className="size-3.5" />
                                </Button>
                            </div>
                        </div>
                    }
                >
                    <table className="w-full min-w-[980px] text-sm">
                        <thead>
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className="h-10 w-14 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    STT
                                </th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Số phiếu xuất
                                </th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Tham chiếu gốc
                                </th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Kho xuất
                                </th>
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Ngày tạo
                                </th>
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Ngày xuất
                                </th>
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Trạng thái
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {data.map((item, index) => {
                                // XÁC ĐỊNH MÃ THAM CHIẾU ĐỂ HIỂN THỊ
                                const isChuyenKho = item.loaiXuat === "chuyen_kho" || item.loaiXuat === "CHUYEN_KHO";

                                const maThamChieu = isChuyenKho
                                    ? (item.phieuChuyenKhoGoc?.soPhieuXuat || item.soPhieuChuyenKhoGoc || `PCK ID: ${item.phieuChuyenKhoGocId || item.parentId}`)
                                    : (item.donBanHang?.soDonHang || "-");

                                const status = STATUS_MAP[item.trangThai];

                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => navigate(`/goods-issues/${item.id}`)}
                                        className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                                    >
                                        <td className="px-3 py-3 text-center text-xs text-bo-muted">
                                            {filters.page * filters.size + index + 1}
                                        </td>
                                        <td className="px-3 py-3 font-semibold text-bo-primary">
                                            {item.soPhieuXuat}
                                        </td>
                                        {/* CỘT THAM CHIẾU — chuyển kho dùng bo-primary, SO dùng slate để phân biệt */}
                                        <td className="px-3 py-3">
                                            <span
                                                className={
                                                    isChuyenKho
                                                        ? "inline-flex items-center rounded-md border border-bo-primary/20 bg-bo-primary-soft px-2 py-1 text-xs font-semibold text-bo-primary"
                                                        : "inline-flex items-center rounded-md border border-bo-border bg-bo-surface-subtle px-2 py-1 text-xs font-semibold text-slate-600"
                                                }
                                            >
                                                {maThamChieu}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-sm text-bo-foreground">
                                            {item.kho?.tenKho || "-"}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 text-center text-xs text-bo-muted">
                                            {new Date(item.ngayTao).toLocaleDateString("vi-VN")}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 text-center text-xs text-bo-muted">
                                            {item.ngayXuat ? new Date(item.ngayXuat).toLocaleDateString("vi-VN") : "Chưa xuất kho"}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            {status ? (
                                                <StatusBadge
                                                    label={status.label}
                                                    tone={status.tone}
                                                    className={status.className}
                                                />
                                            ) : (
                                                <span className="text-xs text-bo-muted">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </TableShell>
            )}
        </PageContainer>
    );
}

function StatTile({ icon, iconClass, label, value }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
            <div className="min-w-0">
                <p className="text-xs font-medium text-bo-muted">{label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{value}</p>
            </div>
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                {icon}
            </span>
        </div>
    );
}
