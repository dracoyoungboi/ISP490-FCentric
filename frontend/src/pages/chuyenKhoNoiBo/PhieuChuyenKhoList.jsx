import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import apiClient from "@/services/apiClient";
import PageContainer from "@/components/backoffice/PageContainer";
import FilterBar from "@/components/shared/FilterBar";
import SearchInput from "@/components/shared/SearchInput";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
    RefreshCcw, Package, Plus,
    ChevronDown, ChevronLeft, ChevronRight, Filter,
    CheckCircle2, XCircle, ClipboardList, Truck,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

//Constants & Helpers
const ROLE = {
    QUAN_TRI_VIEN: "quan_tri_vien",
    QUAN_LY_KHO: "quan_ly_kho",
    NHAN_VIEN_KHO: "nhan_vien_kho",
    NHAN_VIEN_MUA_HANG: "nhan_vien_mua_hang",
    NHAN_VIEN_BAN_HANG: "nhan_vien_ban_hang",
};

function parseJwt(token) {
    try {
        const b64 = token.split(".")[1];
        return JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
    } catch { return null; }
}

function parseRoles(vaiTro) {
    if (!vaiTro) return [];
    return vaiTro.includes(" ") ? vaiTro.split(" ") : [vaiTro];
}

const STATUS_MAP = {
    0: { label: "Nháp", tone: "warning" },
    1: { label: "Chờ duyệt", tone: "info" },
    2: {
        label: "Chờ xuất hàng",
        tone: "info",
        className: "border-indigo-200 bg-indigo-50 text-indigo-700",
    },
    3: {
        label: "Đang vận chuyển",
        tone: "info",
        className: "border-purple-200 bg-purple-50 text-purple-700",
    },
    4: { label: "Đã hủy", tone: "danger" },
    5: { label: "Hoàn tất", tone: "success" },
};

const STATUS_OPTIONS = [
    { value: "", label: "Tất cả trạng thái" },
    ...Object.entries(STATUS_MAP).map(([key, val]) => ({ value: key, label: val.label })),
];

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];
const TH_CLASS =
    "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";

function buildFilterPayload(filters) {
    const filterList = [];
    if (filters.keyword?.trim()) {
        filterList.push({ fieldName: "soPhieuXuat", operation: "LIKE", value: filters.keyword.trim() });
    }
    if (filters.tenKhoNhap?.trim()) {
        filterList.push({ fieldName: "khoChuyenDen.tenKho", operation: "LIKE", value: filters.tenKhoNhap.trim() });
    }
    if (filters.trangThai !== "") {
        filterList.push({ fieldName: "trangThai", operation: "EQUALS", value: Number(filters.trangThai) });
    }
    return { page: filters.page, size: filters.size, filters: filterList, sorts: [{ fieldName: "ngayTao", direction: "DESC" }] };
}

export default function PhieuChuyenKhoList() {
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [userRoles, setUserRoles] = useState([]);

    const [filters, setFilters] = useState({
        keyword: "",
        tenKhoNhap: "",
        trangThai: "",
        page: 0,
        size: 10,
    });

    // Kiểm tra quyền (chỉ nhân viên kho)
    const isNhanVienKho = userRoles.includes(ROLE.NHAN_VIEN_KHO);

    // Fetch roles
    const fetchUserInfo = useCallback(async () => {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) return;
            const payload = parseJwt(token);
            if (!payload || !payload.id) return;

            const userResponse = await apiClient.get(`/api/v1/nguoi-dung/get-by-id/${payload.id}`);
            const userData = userResponse.data?.data;
            if (userData && userData.vaiTro) {
                setUserRoles(parseRoles(userData.vaiTro));
            }
        } catch (error) {
            console.error('Lỗi khi lấy thông tin user:', error);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await phieuChuyenKhoService.filter(buildFilterPayload(filters));
            setData(res?.content || []);
            setTotal(res?.totalElements || 0);
        } catch (error) {
            console.error("Lỗi lấy danh sách:", error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu vẫn tải lại mỗi khi bộ lọc đổi.
    useEffect(() => {
        queueMicrotask(() => fetchUserInfo());
    }, [fetchUserInfo]);

    useEffect(() => {
        queueMicrotask(() => fetchData());
    }, [fetchData]);

    const totalPages = Math.max(1, Math.ceil(total / filters.size));

    const handleReset = () => {
        setFilters({ keyword: "", tenKhoNhap: "", trangThai: "", page: 0, size: 10 });
    };

    const stats = useMemo(() => ({
        dangVanChuyen: data.filter((d) => d.trangThai === 3).length,
        hoanTat: data.filter((d) => d.trangThai === 5).length,
        daHuy: data.filter((d) => d.trangThai === 4).length,
    }), [data]);

    return (
        <PageContainer className="space-y-5">

            {/* ══ STATS ═══════════════════════════════════════════════════════ */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                    icon={<Package className="size-5" />}
                    iconClass="bg-bo-primary-soft text-bo-primary"
                    label="Tổng phiếu chuyển"
                    value={total}
                />
                <StatTile
                    icon={<Truck className="size-5" />}
                    iconClass="bg-purple-50 text-purple-600"
                    label="Đang vận chuyển"
                    value={stats.dangVanChuyen}
                />
                <StatTile
                    icon={<CheckCircle2 className="size-5" />}
                    iconClass="bg-bo-success-soft text-bo-success"
                    label="Hoàn tất"
                    value={stats.hoanTat}
                />
                <StatTile
                    icon={<XCircle className="size-5" />}
                    iconClass="bg-bo-danger-soft text-bo-danger"
                    label="Đã hủy"
                    value={stats.daHuy}
                />
            </section>

            {/* ══ BỘ LỌC TÌM KIẾM ════════════════════════════════════════════ */}
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
                            label="Số phiếu"
                            value={filters.keyword}
                            onChange={(e) => setFilters(p => ({ ...p, keyword: e.target.value, page: 0 }))}
                            onClear={() => setFilters(p => ({ ...p, keyword: "", page: 0 }))}
                        />
                    }
                    filters={
                        <>
                            <input
                                type="text"
                                placeholder="Tên kho nhận hàng"
                                aria-label="Kho nhập (đích)"
                                value={filters.tenKhoNhap}
                                onChange={(e) => setFilters(p => ({ ...p, tenKhoNhap: e.target.value, page: 0 }))}
                                className="h-9 w-full rounded-md border border-bo-border bg-white px-3 text-sm text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 sm:w-[200px]"
                            />

                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-9 w-full justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle sm:w-[190px]"
                                    >
                                        <span className="truncate">{STATUS_OPTIONS.find((s) => s.value === filters.trangThai)?.label || "Tất cả trạng thái"}</span>
                                        <ChevronDown className="size-4 shrink-0 opacity-70" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="backoffice-user-menu z-50 w-[200px] rounded-lg border border-bo-border bg-white p-1 shadow-lg">
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
                        !isNhanVienKho ? (
                            <Link to="/transfer-tickets/create">
                                <Button className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                                    <Plus className="size-4" />
                                    Tạo phiếu chuyển kho
                                </Button>
                            </Link>
                        ) : null
                    }
                />
            </div>

            {/* ══ TABLE / LOADING / EMPTY ═════════════════════════════════════ */}
            {loading ? (
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <LoadingState rows={6} label="Đang tải danh sách phiếu chuyển kho" />
                </div>
            ) : data.length === 0 ? (
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <EmptyState
                        icon={ClipboardList}
                        title="Không có dữ liệu phiếu chuyển"
                        description="Hiện tại chưa có dữ liệu phù hợp. Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."
                    />
                </div>
            ) : (
                <TableShell
                    title="Danh sách phiếu chuyển kho"
                    description={`Tổng ${total} phiếu chuyển kho`}
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
                                    <DropdownMenuContent align="start" className="backoffice-user-menu z-50 w-[110px] rounded-lg border border-bo-border bg-white p-1 shadow-lg">
                                        {PAGE_SIZE_OPTIONS.map(size => (
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
                                <span className="font-semibold text-bo-foreground">{filters.page * filters.size + 1}</span>
                                {" – "}
                                <span className="font-semibold text-bo-foreground">{Math.min((filters.page + 1) * filters.size, total)}</span>
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
                                    <ChevronLeft className="size-3.5" /> Trước
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
                                    disabled={filters.page + 1 >= totalPages}
                                    className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                                >
                                    Sau <ChevronRight className="size-3.5" />
                                </Button>
                            </div>
                        </div>
                    }
                >
                    <table className="w-full min-w-[900px] text-sm">
                        <thead>
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className={`${TH_CLASS} w-14 text-center`}>STT</th>
                                <th className={`${TH_CLASS} text-left`}>Số phiếu</th>
                                <th className={`${TH_CLASS} text-left`}>Kho xuất</th>
                                <th className={`${TH_CLASS} text-left`}>Kho nhập</th>
                                <th className={`${TH_CLASS} text-center`}>Ngày tạo</th>
                                <th className={`${TH_CLASS} text-center`}>Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {data.map((item, index) => {
                                const status = STATUS_MAP[item.trangThai];
                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => navigate(`/transfer-tickets/${item.id}`)}
                                        className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                                    >
                                        <td className="w-14 px-4 py-3.5 text-center align-middle">
                                            <span className="inline-flex size-7 items-center justify-center rounded-full bg-bo-surface-subtle text-xs font-semibold text-slate-600">
                                                {filters.page * filters.size + index + 1}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 align-middle font-semibold text-bo-primary">{item.soPhieuXuat}</td>
                                        <td className="px-4 py-3.5 align-middle text-bo-foreground">{item.kho?.tenKho}</td>
                                        <td className="px-4 py-3.5 align-middle text-bo-foreground">{item.khoChuyenDen?.tenKho}</td>
                                        <td className="px-4 py-3.5 text-center align-middle">
                                            <span className="text-xs text-bo-muted">{new Date(item.ngayTao).toLocaleDateString("vi-VN")}</span>
                                        </td>
                                        <td className="px-4 py-3.5 text-center align-middle">
                                            {status ? (
                                                <StatusBadge label={status.label} tone={status.tone} className={status.className} />
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
