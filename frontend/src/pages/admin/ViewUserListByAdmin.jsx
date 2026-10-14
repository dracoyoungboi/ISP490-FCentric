import { useCallback, useEffect, useRef, useState } from "react";
import {
    AlertTriangle,
    KeyRound,
    Plus,
    SearchX,
    Users,
} from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import AddUserDialog from "@/components/admin/AddUserDialog";
import PageContainer from "@/components/backoffice/PageContainer";
import UserAvatar from "@/components/UserAvatar";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import FilterSelect from "@/components/shared/FilterSelect";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import TablePagination from "@/components/shared/TablePagination";
import TableShell from "@/components/shared/TableShell";
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
import { ROLES } from "@/constants/backend/role";
import { cn } from "@/lib/utils";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import { adminService } from "@/services/adminService";
import { getCurrentUserId } from "@/utils/roles";

// Chỉ lọc theo các vai trò nhân sự tạo được ở popup "Thêm người dùng".
// Khách hàng quản lý ở module Khách hàng (bảng khach_hang), không nằm trong nguoi_dung,
// nên lựa chọn "Khách hàng" ở đây luôn ra danh sách rỗng.
const ROLE_OPTIONS = [
    { value: "ALL", label: "Tất cả vai trò" },
    ...ROLES.filter((role) => role.value !== "khach_hang"),
];

// Tab trạng thái (bố cục A+G). Giá trị giữ như tham số ?trangThai= cũ trên URL.
// "Bị khóa" = mọi tài khoản trangThai ≠ 1: khớp badge trong bảng và điều kiện chặn đăng nhập ở backend.
const STATUS_TABS = [
    { value: "ALL", label: "Tất cả" },
    { value: "1", label: "Hoạt động" },
    { value: "0", label: "Bị khóa", tone: "danger" },
];
const STATUS_TAB_VALUES = STATUS_TABS.map((tab) => tab.value);
const EMPTY_TAB_TITLE = {
    1: "Không có tài khoản nào đang hoạt động",
    0: "Không có tài khoản nào bị khóa",
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_FIELDS = ["hoTen", "tenDangNhap", "email", "soDienThoai"];
// Cột Thao tác: `w-px` + nowrap để co vừa đúng nút; ghim mép phải khi bảng phải cuộn ngang.
const COLUMNS = [
    { label: "STT", center: true },
    { label: "Tên đăng nhập" },
    { label: "Họ tên" },
    { label: "Email" },
    { label: "SĐT" },
    { label: "Vai trò", center: true },
    { label: "Trạng thái", center: true },
    { label: "Thao tác", center: true, sticky: true, className: "w-px" },
];

// Viền + bóng bên trái cột ghim — chỉ bật khi còn cột bị che phía dưới.
const STICKY_EDGE = "border-l border-bo-border shadow-[-6px_0_8px_-6px_rgb(15_23_42/0.15)]";
const LOAD_ERROR_MESSAGE = "Không thể tải danh sách người dùng. Vui lòng thử lại.";
// Dòng người dùng vừa tạo được tô nền trong chừng này thời gian để dễ nhận ra.
const NEW_ROW_HIGHLIGHT_MS = 4000;

const DEFAULT_FILTERS = {
    keyword: "",
    vaiTro: "ALL",
    trangThai: "ALL",
    page: 0,
    size: DEFAULT_PAGE_SIZE,
};

const formatRole = (role) => ROLES.find((r) => r.value === role)?.label || role || "—";

function buildUserFilterPayload(filters) {
    const filterList = [];
    const keyword = filters.keyword.trim();

    // Backend gom các điều kiện OR thành một nhóm rồi AND với các điều kiện còn lại:
    // (hoTen OR tenDangNhap OR email OR SĐT) AND vaiTro AND trangThai
    if (keyword) {
        SEARCH_FIELDS.forEach((field) => {
            filterList.push({
                fieldName: field,
                operation: "ILIKE",
                value: keyword,
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

    if (filters.trangThai === "1") {
        filterList.push({
            fieldName: "trangThai",
            operation: "EQUALS",
            value: 1,
            logicType: "AND",
        });
    } else if (filters.trangThai === "0") {
        filterList.push({
            fieldName: "trangThai",
            operation: "NOT_IN",
            value: [1],
            logicType: "AND",
        });
    }

    return {
        page: filters.page,
        size: filters.size,
        filters: filterList,
        // Mới tạo lên đầu (không hiện cột Ngày tạo; xem ở trang chi tiết).
        sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
    };
}

/** Đọc bộ lọc từ URL (?q=&vaiTro=&trangThai=&page=&size=). `page` trên URL đếm từ 1. */
function readFiltersFromUrl(searchParams) {
    const vaiTro = searchParams.get("vaiTro");
    const trangThai = searchParams.get("trangThai");
    const page = Number.parseInt(searchParams.get("page") ?? "", 10);
    const size = Number.parseInt(searchParams.get("size") ?? "", 10);

    return {
        keyword: (searchParams.get("q") ?? "").trim(),
        vaiTro: ROLE_OPTIONS.some((o) => o.value === vaiTro) ? vaiTro : "ALL",
        trangThai: STATUS_TAB_VALUES.includes(trangThai) ? trangThai : "ALL",
        page: page > 1 ? page - 1 : 0,
        size: PAGE_SIZE_OPTIONS.includes(size) ? size : DEFAULT_PAGE_SIZE,
    };
}

function filtersToSearchParams(filters) {
    const params = new URLSearchParams();
    if (filters.keyword) params.set("q", filters.keyword);
    if (filters.vaiTro !== "ALL") params.set("vaiTro", filters.vaiTro);
    if (filters.trangThai !== "ALL") params.set("trangThai", filters.trangThai);
    if (filters.page > 0) params.set("page", String(filters.page + 1));
    if (filters.size !== DEFAULT_PAGE_SIZE) params.set("size", String(filters.size));
    return params;
}

export default function ViewUserListByAdmin() {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [filters, setFilters] = useState(() => readFiltersFromUrl(searchParams));
    // Ô tìm kiếm đổi ngay khi gõ; filters.keyword chỉ đổi khi ngừng gõ (debounce) hoặc bấm Enter.
    const [searchText, setSearchText] = useState(filters.keyword);

    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const requestIdRef = useRef(0);

    const [currentUserId] = useState(() => getCurrentUserId());

    const [selectedUserForReset, setSelectedUserForReset] = useState(null);
    const [resettingUser, setResettingUser] = useState(false);

    // Popup Thêm người dùng; /users/add (đường dẫn cũ) chuyển về đây kèm state để mở sẵn popup.
    const [createOpen, setCreateOpen] = useState(() => Boolean(location.state?.openCreateUser));
    const [highlightUserId, setHighlightUserId] = useState(null);

    const syncedSearchRef = useRef(searchParams.toString());

    // Callback ref: bảng chỉ được gắn khi tải xong (lúc tải hiện LoadingState).
    const [tableEl, setTableEl] = useState(null);
    const [columnsHidden, setColumnsHidden] = useState(false);

    // Bộ lọc ngoài tab trạng thái (nút "Xóa lọc" chỉ xóa các bộ lọc này, giữ tab đang chọn).
    const hasActiveFilters = Boolean(searchText.trim()) || filters.vaiTro !== "ALL";

    // ── Danh sách ────────────────────────────────────────────────
    // silent: tải lại sau khi thêm người dùng — giữ nguyên bảng đang xem, không hiện vòng xoay.
    const fetchUsers = useCallback(async ({ silent = false } = {}) => {
        const requestId = ++requestIdRef.current;
        if (!silent) setLoading(true);
        setLoadError(null);

        try {
            const res = await adminService.filterUsersByAdmin(buildUserFilterPayload(filters));
            // Bỏ qua response cũ về muộn (đã đổi từ khóa / bộ lọc / trang trong lúc chờ).
            if (requestId !== requestIdRef.current) return;

            if (res.data?.status !== 200) {
                throw new Error(res.data?.message || LOAD_ERROR_MESSAGE);
            }

            const pageData = res.data.data ?? {};
            const content = pageData.content ?? [];
            const totalElements = pageData.totalElements ?? 0;

            // Trang trên URL vượt quá số trang thực tế → lùi về trang cuối có dữ liệu.
            if (content.length === 0 && totalElements > 0 && filters.page > 0) {
                const lastPage = Math.max(Math.ceil(totalElements / filters.size) - 1, 0);
                setFilters((prev) => ({ ...prev, page: lastPage }));
                return; // vẫn đang tải: lần gọi cho trang cuối sẽ tắt loading
            }

            setUsers(content);
            setTotal(totalElements);
            setLoading(false);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            console.error(error);
            setUsers([]);
            setTotal(0);
            setLoadError(error?.response?.data?.message || LOAD_ERROR_MESSAGE);
            setLoading(false);
        }
    }, [filters]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn fetch lại ngay mỗi khi filters đổi.
    useEffect(() => {
        queueMicrotask(() => fetchUsers());
    }, [fetchUsers]);

    // ── Số trên từng tab: cùng từ khóa + vai trò đang lọc, chỉ thay trạng thái (R1) ──
    const tabCounts = useDemTheoTrangThai(
        STATUS_TAB_VALUES,
        async (trangThai) => {
            const res = await adminService.filterUsersByAdmin(
                buildUserFilterPayload({ ...filters, trangThai, page: 0, size: 1 })
            );
            if (res.data?.status !== 200) throw new Error(res.data?.message || LOAD_ERROR_MESSAGE);
            return res.data?.data?.totalElements ?? 0;
        },
        `${filters.keyword}|${filters.vaiTro}`
    );

    // ── Debounce ô tìm kiếm: không gọi API ở mỗi lần gõ phím ──
    useEffect(() => {
        const keyword = searchText.trim();
        const timer = setTimeout(() => {
            setFilters((prev) => (prev.keyword === keyword ? prev : { ...prev, keyword, page: 0 }));
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchText]);

    // ── Giữ bộ lọc + trang trên URL: mở chi tiết rồi "Quay lại" không mất vị trí ──
    useEffect(() => {
        const next = filtersToSearchParams(filters);
        const nextSearch = next.toString();
        if (nextSearch === syncedSearchRef.current) return;
        syncedSearchRef.current = nextSearch;
        setSearchParams(next, { replace: true });
    }, [filters, setSearchParams]);

    // ── Bảng rộng hơn khung (laptop + sidebar mở): cột Thao tác luôn ghim bên phải;
    //    bật viền/bóng khi còn cột nằm khuất dưới nó (chưa cuộn hết sang phải). ──
    useEffect(() => {
        const scroller = tableEl?.parentElement;
        if (!tableEl || !scroller || typeof ResizeObserver === "undefined") return undefined;

        const update = () => {
            setColumnsHidden(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);
        };
        const observer = new ResizeObserver(update);
        observer.observe(scroller);
        observer.observe(tableEl);
        scroller.addEventListener("scroll", update, { passive: true });
        return () => {
            observer.disconnect();
            scroller.removeEventListener("scroll", update);
        };
    }, [tableEl]);

    // ── /users/add đã mở sẵn popup: xóa state để F5 / quay lại không tự mở lại ──
    useEffect(() => {
        if (!location.state?.openCreateUser) return;
        navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    }, [location, navigate]);

    // ── Bỏ tô nền dòng vừa tạo sau vài giây ──
    useEffect(() => {
        if (highlightUserId == null) return undefined;
        const timer = setTimeout(() => setHighlightUserId(null), NEW_ROW_HIGHLIGHT_MS);
        return () => clearTimeout(timer);
    }, [highlightUserId]);

    const handleUserCreated = (user) => {
        // Vai trò khác Quản trị viên thường cần gán kho phụ trách ngay sau khi tạo.
        const canAssignWarehouse = user.id != null && user.vaiTro !== "quan_tri_vien";
        toast.success("Đã tạo tài khoản.", {
            description: `Mật khẩu tạm thời của ${user.tenDangNhap} sẽ được gửi tới ${user.email}.`,
            duration: 8000,
            action: canAssignWarehouse
                ? {
                      label: "Phân quyền kho",
                      onClick: () => navigate(`/users/${user.id}/edit-role`),
                  }
                : undefined,
        });
        setHighlightUserId(user.id ?? null);
        // Giữ nguyên bộ lọc + trang đang xem; danh sách xếp mới tạo lên đầu.
        fetchUsers({ silent: true });
        tabCounts.reload();
    };

    const applyKeyword = (keyword) => {
        setFilters((prev) => (prev.keyword === keyword ? prev : { ...prev, keyword, page: 0 }));
    };

    const changeFilter = (key, value) => {
        setFilters((prev) => (prev[key] === value ? prev : { ...prev, [key]: value, page: 0 }));
    };

    const clearFilters = () => {
        setSearchText("");
        setFilters((prev) => ({ ...DEFAULT_FILTERS, trangThai: prev.trangThai, size: prev.size }));
    };

    const isCurrentUser = (user) =>
        currentUserId != null && String(user.id) === String(currentUserId);

    const handleConfirmResetRandom = async () => {
        if (!selectedUserForReset) return;
        try {
            setResettingUser(true);
            await adminService.resetUserPasswordRandomByAdmin(selectedUserForReset.id);
            toast.success(
                `Đã cấp mật khẩu tạm thời và gửi về email cho ${selectedUserForReset.hoTen || selectedUserForReset.tenDangNhap}`
            );
            setSelectedUserForReset(null);
        } catch (err) {
            toast.error(err?.response?.data?.message || "Không thể cấp lại mật khẩu cho người dùng");
        } finally {
            setResettingUser(false);
        }
    };

    // Trang chi tiết dùng `from` cho nút "Quay lại danh sách" (giữ nguyên bộ lọc + trang).
    const detailLinkState = { from: `${location.pathname}${location.search}` };

    // Số chỉ hiện khi đã đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs.
    const statusTabs = STATUS_TABS.map((tab) => ({
        ...tab,
        count: loadError ? null : tabCounts.counts[tab.value],
    }));

    return (
        <PageContainer className="space-y-4">
            <ListPageHeader
                actions={
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                    >
                        <Plus className="size-4" />
                        Thêm người dùng
                    </Button>
                }
            />

            {/* ── BẢNG: tab trạng thái + tìm kiếm + vai trò cùng một hàng ── */}
            <TableShell
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label="Lọc người dùng theo trạng thái"
                                tabs={statusTabs}
                                value={filters.trangThai}
                                onChange={(value) => changeFilter("trangThai", value)}
                            />
                        }
                        hasFilter={hasActiveFilters}
                        onClear={clearFilters}
                    >
                        <SearchInput
                            label="Tìm người dùng"
                            placeholder="Tên, tên đăng nhập, email hoặc SĐT"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") applyKeyword(searchText.trim());
                            }}
                            onClear={() => {
                                setSearchText("");
                                applyKeyword("");
                            }}
                            className="sm:w-[340px]"
                        />
                        <FilterSelect
                            label="Lọc theo vai trò"
                            value={filters.vaiTro}
                            options={ROLE_OPTIONS}
                            onChange={(value) => changeFilter("vaiTro", value)}
                            align="end"
                        />
                    </ListToolbar>
                }
                footer={
                    <TablePagination
                        page={filters.page}
                        size={filters.size}
                        total={total}
                        sizeOptions={PAGE_SIZE_OPTIONS}
                        onPageChange={(page) => {
                            if (page < 0) return;
                            setFilters((prev) => ({ ...prev, page }));
                        }}
                        onSizeChange={(size) =>
                            setFilters((prev) =>
                                prev.size === size ? prev : { ...prev, size, page: 0 }
                            )
                        }
                    />
                }
            >
                {loading ? (
                    <LoadingState label="Đang tải danh sách người dùng" />
                ) : loadError ? (
                    <ErrorState
                        description={loadError}
                        onRetry={() => {
                            fetchUsers();
                            tabCounts.reload();
                        }}
                    />
                ) : users.length === 0 ? (
                    hasActiveFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy người dùng phù hợp"
                            description="Thử đổi từ khóa hoặc bỏ bớt bộ lọc."
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
                    ) : filters.trangThai !== "ALL" ? (
                        <EmptyState
                            icon={Users}
                            title={EMPTY_TAB_TITLE[filters.trangThai]}
                            description="Chọn tab Tất cả để xem mọi tài khoản."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() => changeFilter("trangThai", "ALL")}
                                    className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Xem tất cả
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={Users}
                            title="Chưa có người dùng"
                            description="Thêm tài khoản cho nhân viên để họ đăng nhập vào hệ thống."
                        />
                    )
                ) : (
                    <table ref={setTableEl} className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                {COLUMNS.map((column) => (
                                    <th
                                        key={column.label}
                                        scope="col"
                                        className={cn(
                                            "h-10 whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted",
                                            column.center ? "text-center" : "text-left",
                                            column.sticky && "sticky right-0 z-[1] bg-bo-surface-subtle",
                                            column.sticky && columnsHidden && STICKY_EDGE,
                                            column.className
                                        )}
                                    >
                                        {column.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-bo-border">
                            {users.map((u, index) => {
                                const isSelf = isCurrentUser(u);
                                const isActive = u.trangThai === 1;
                                const isNew = highlightUserId != null && u.id === highlightUserId;

                                return (
                                    <tr
                                        key={u.id}
                                        onClick={() => navigate(`/users/${u.id}`, { state: detailLinkState })}
                                        aria-current={isNew ? "true" : undefined}
                                        className={cn(
                                            "group cursor-pointer transition-colors duration-500 hover:bg-bo-surface-subtle",
                                            isNew && "bg-bo-primary-soft"
                                        )}
                                    >
                                        <td className="px-3 py-3 text-center text-xs text-bo-muted">
                                            {filters.page * filters.size + index + 1}
                                        </td>

                                        <td className="whitespace-nowrap px-3 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <UserAvatar
                                                    userId={u.id}
                                                    name={u.hoTen || u.tenDangNhap}
                                                    avatarUrl={u.avatarUrl}
                                                    size="xs"
                                                />
                                                {/* Link để dùng được bằng bàn phím / mở tab mới; chặn bubble lên onClick của dòng */}
                                                <Link
                                                    to={`/users/${u.id}`}
                                                    state={detailLinkState}
                                                    onClick={(e) => e.stopPropagation()}
                                                    title={u.tenDangNhap}
                                                    className="block max-w-[180px] truncate rounded-sm font-semibold text-bo-foreground hover:text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                                                >
                                                    {u.tenDangNhap}
                                                </Link>
                                                {isSelf ? (
                                                    <span className="shrink-0 rounded-full bg-bo-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-bo-primary">
                                                        Bạn
                                                    </span>
                                                ) : null}
                                            </div>
                                        </td>

                                        <td className="px-3 py-3 text-bo-foreground">
                                            <div className="max-w-[200px] truncate" title={u.hoTen || undefined}>
                                                {u.hoTen || "—"}
                                            </div>
                                        </td>

                                        <td className="px-3 py-3 text-slate-600">
                                            <div className="max-w-[220px] truncate" title={u.email || undefined}>
                                                {u.email || "—"}
                                            </div>
                                        </td>

                                        <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-600">
                                            {u.soDienThoai || "—"}
                                        </td>

                                        <td className="px-3 py-3 text-center">
                                            <StatusBadge
                                                label={formatRole(u.vaiTro)}
                                                tone="neutral"
                                                dot={false}
                                                className="whitespace-nowrap"
                                            />
                                        </td>

                                        <td className="px-3 py-3 text-center">
                                            <StatusBadge
                                                label={isActive ? "Hoạt động" : "Bị khóa"}
                                                tone={isActive ? "success" : "danger"}
                                                className="whitespace-nowrap"
                                            />
                                        </td>

                                        {/* Ô thao tác không điều hướng: bấm trượt nút (hoặc nút đang khóa) không mở chi tiết */}
                                        <td
                                            className={cn(
                                                "sticky right-0 z-[1] cursor-default whitespace-nowrap px-3 py-3 text-center transition-colors duration-500 group-hover:bg-bo-surface-subtle",
                                                isNew ? "bg-bo-primary-soft" : "bg-white",
                                                columnsHidden && STICKY_EDGE
                                            )}
                                            onClick={(e) => e.stopPropagation()}
                                            title={
                                                isSelf
                                                    ? "Đây là tài khoản của bạn — hãy dùng chức năng Đổi mật khẩu"
                                                    : undefined
                                            }
                                        >
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={isSelf}
                                                onClick={() => setSelectedUserForReset(u)}
                                                className="border-bo-border bg-white text-xs text-bo-foreground hover:border-bo-primary/40 hover:bg-bo-primary-soft hover:text-bo-primary"
                                            >
                                                <KeyRound className="size-3.5" />
                                                Cấp lại mật khẩu
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </TableShell>

            {/* ── POPUP THÊM NGƯỜI DÙNG ── */}
            <AddUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={handleUserCreated} />

            {/* ── DIALOG CẤP LẠI MẬT KHẨU ── */}
            <AlertDialog
                open={Boolean(selectedUserForReset)}
                onOpenChange={(open) => {
                    if (!open && !resettingUser) setSelectedUserForReset(null);
                }}
            >
                <AlertDialogContent className="bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cấp lại mật khẩu người dùng</AlertDialogTitle>
                        {/* asChild: Description mặc định render <p>; bên trong có <div>/<p> sẽ sai cấu trúc HTML */}
                        <AlertDialogDescription asChild>
                            <div className="space-y-2 text-sm text-slate-600">
                                <p>
                                    Bạn có muốn cấp lại mật khẩu cho tài khoản{" "}
                                    <span className="font-semibold text-slate-900">
                                        {selectedUserForReset?.tenDangNhap}
                                    </span>
                                    {selectedUserForReset?.hoTen ? ` (${selectedUserForReset.hoTen})` : ""}?
                                </p>
                                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                                    Email nhận mật khẩu:{" "}
                                    <span className="font-medium text-slate-800">
                                        {selectedUserForReset?.email || "Chưa thiết lập email"}
                                    </span>
                                    {!selectedUserForReset?.email ? (
                                        <p className="mt-1 flex items-start gap-1.5 font-medium text-amber-600">
                                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                                            Tài khoản này chưa có email nên không thể gửi mật khẩu tự động.
                                            Vui lòng cập nhật email cho người dùng trước.
                                        </p>
                                    ) : null}
                                </div>
                                {selectedUserForReset && selectedUserForReset.trangThai !== 1 ? (
                                    <p className="flex items-start gap-1.5 text-xs font-medium text-amber-600">
                                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                                        Tài khoản đang bị khóa — người dùng chỉ đăng nhập được bằng mật khẩu
                                        mới sau khi được mở khóa.
                                    </p>
                                ) : null}
                                <p className="text-xs text-slate-500">
                                    Hệ thống sẽ tạo mật khẩu tạm thời ngẫu nhiên và gửi về email người dùng.
                                    Sau khi đăng nhập, người dùng bắt buộc phải đổi mật khẩu mới.
                                </p>
                            </div>
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
                            {resettingUser ? "Đang gửi email..." : "Gửi mật khẩu ngẫu nhiên"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PageContainer>
    );
}
