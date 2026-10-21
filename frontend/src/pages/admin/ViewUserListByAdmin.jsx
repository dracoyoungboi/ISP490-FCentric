import { useCallback, useEffect, useRef, useState } from "react";
import {
    AlertTriangle,
    Ellipsis,
    Eye,
    KeyRound,
    Lock,
    LockOpen,
    Plus,
    SearchX,
    ShieldCheck,
    Users,
} from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "@/lib/thongBaoNhanh";

import AddUserDialog from "@/components/admin/AddUserDialog";
import PageContainer from "@/components/backoffice/PageContainer";
import { QUAN_TRI_VIEN, canKho, hieuLucCuaToi } from "@/components/nguoi-dung/phanQuyen";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLES } from "@/constants/backend/role";
import { LUA_CHON_SO_DONG, SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { cn } from "@/lib/utils";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { adminService } from "@/services/adminService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDate } from "@/utils/formatters";
import { getCurrentUserId } from "@/utils/roles";

// Lọc theo vai trò nhân sự, cùng danh sách và thứ tự với popup "Thêm người dùng".
const ROLE_OPTIONS = [{ value: "ALL", label: "Tất cả vai trò" }, ...ROLES];

// Tab trạng thái (bố cục A+G). Giá trị giữ như tham số ?trangThai= cũ trên URL.
// "Bị khóa" = mọi tài khoản trangThai ≠ 1: khớp badge trong bảng và điều kiện chặn đăng nhập ở backend.
// "Chưa đổi mật khẩu tạm thời" không phải trạng thái: người đó vẫn Hoạt động, chỉ ghi thêm dòng phụ.
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

const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_FIELDS = ["hoTen", "tenDangNhap", "email", "soDienThoai"];
// Họ tên (đậm) và tên đăng nhập luôn ở hai cột riêng, kể cả khi giống hệt nhau: họ tên trùng tên đăng nhập
// là dữ liệu hợp lệ (tài khoản đặt theo vai trò/kho, hoặc tạo không kèm họ tên), không đoán "chưa cập nhật".
// Ô cách hai bên 16px để Số điện thoại và Trạng thái không sát nhau.
// Cột Thao tác: `w-px` + nowrap để co vừa đúng nút; ghim mép phải khi bảng phải cuộn ngang.
const COLUMNS = [
    { label: "STT", center: true, className: "w-px" },
    { label: "Người dùng" },
    { label: "Tên đăng nhập" },
    { label: "Vai trò" },
    { label: "Kho phụ trách" },
    { label: "Số điện thoại" },
    { label: "Trạng thái" },
    { label: "Ngày tạo" },
    { label: "Thao tác", center: true, sticky: true, className: "w-px" },
];

// Viền + bóng bên trái cột ghim — chỉ bật khi còn cột bị che phía dưới.
const STICKY_EDGE = "border-l border-bo-border shadow-[-6px_0_8px_-6px_rgb(15_23_42/0.15)]";
const LOAD_ERROR_MESSAGE = "Không thể tải danh sách người dùng. Vui lòng thử lại.";
// Dòng người dùng vừa tạo được tô nền trong chừng này thời gian để dễ nhận ra.
const NEW_ROW_HIGHLIGHT_MS = 4000;

// Nút ⋯ cùng kiểu ô vuông viền xám của cột Thao tác (RowActionButton); mục menu như ⋯ ở Chi tiết người dùng.
const NUT_MENU =
    "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 data-[state=open]:border-bo-primary data-[state=open]:text-bo-primary";
const MUC_MENU =
    "cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";

const DEFAULT_FILTERS = {
    keyword: "",
    vaiTro: "ALL",
    trangThai: "ALL",
    page: 0,
    size: SO_DONG_MAC_DINH,
};

const formatRole = (role) => ROLES.find((r) => r.value === role)?.label || role || "—";

/** Gọi tên trong câu (hộp xác nhận, thông báo): họ tên kèm tên đăng nhập, vì họ tên không duy nhất. */
function tenTrongCau(user) {
    if (!user) return "";
    const hoTen = user.hoTen?.trim() || "";
    if (!hoTen || hoTen === user.tenDangNhap) return user.tenDangNhap || hoTen;
    return `${hoTen} (${user.tenDangNhap})`;
}

/**
 * Cột Kho phụ trách: kho đang hiệu lực (mỗi người tối đa một kho) do POST /admin/filter trả trong `khoPhuTrachHieuLuc`.
 * Quản trị viên toàn quyền ở mọi kho. Máy chủ bản cũ chưa trả trường này thì ghi "—" thay vì báo nhầm "Chưa có kho".
 */
function KhoPhuTrach({ user }) {
    if (user.vaiTro === QUAN_TRI_VIEN) return <span className="text-bo-muted">Mọi kho</span>;
    if (!canKho(user.vaiTro) || !Object.prototype.hasOwnProperty.call(user, "khoPhuTrachHieuLuc")) {
        return <span className="text-bo-muted">—</span>;
    }
    if (!user.khoPhuTrachHieuLuc) return <StatusBadge label="Chưa có kho" />;

    const tenKho = user.khoPhuTrachHieuLuc.tenKho || user.khoPhuTrachHieuLuc.maKho || "—";
    // Cùng mốc nhắc gia hạn với Hồ sơ: còn ≤ 7 ngày thì chữ cam "Hết hiệu lực …"
    const hieuLuc = hieuLucCuaToi(user.khoPhuTrachHieuLuc.ngayKetThuc);
    return (
        <div className="min-w-0">
            <div className="max-w-[200px] truncate text-slate-700" title={tenKho}>
                {tenKho}
            </div>
            {hieuLuc.denNgay ? (
                <div
                    className={cn(
                        "mt-0.5 whitespace-nowrap text-xs leading-4",
                        hieuLuc.sapHet ? "font-medium text-bo-warning" : "text-bo-muted"
                    )}
                >
                    {hieuLuc.sapHet ? `Hết hiệu lực ${hieuLuc.denNgay}` : `Đến ${hieuLuc.denNgay}`}
                </div>
            ) : null}
        </div>
    );
}

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
        // Mới tạo lên đầu
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
        size: LUA_CHON_SO_DONG.includes(size) ? size : SO_DONG_MAC_DINH,
    };
}

function filtersToSearchParams(filters) {
    const params = new URLSearchParams();
    if (filters.keyword) params.set("q", filters.keyword);
    if (filters.vaiTro !== "ALL") params.set("vaiTro", filters.vaiTro);
    if (filters.trangThai !== "ALL") params.set("trangThai", filters.trangThai);
    if (filters.page > 0) params.set("page", String(filters.page + 1));
    if (filters.size !== SO_DONG_MAC_DINH) params.set("size", String(filters.size));
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

    // Hộp Cấp lại mật khẩu và hộp Khóa / mở khóa (mở từ menu ⋯ của dòng). Giữ người đang thao tác cả lúc hộp
    // đang mờ dần khi đóng, để tên và màu nút không đổi giữa chừng.
    const [resetDialog, setResetDialog] = useState({ open: false, user: null });
    const [resettingUser, setResettingUser] = useState(false);
    const [toggleDialog, setToggleDialog] = useState({ open: false, user: null });
    const [togglingUser, setTogglingUser] = useState(false);
    // Menu ⋯ đang mở (id người dùng). Menu không modal nên cú bấm ra ngoài để đóng menu vẫn tới dòng bên dưới:
    // ghi lại lúc nhấn chuột để cú bấm đó chỉ đóng menu, không mở trang chi tiết.
    const [menuMoId, setMenuMoId] = useState(null);
    const boQuaClickRef = useRef(false);

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
    // quiet: tự tải lại ngầm khi quay lại tab — như silent, nhưng lỗi chỉ ghi log và giữ bảng.
    const fetchUsers = useCallback(async ({ silent = false, quiet = false } = {}) => {
        const requestId = ++requestIdRef.current;
        if (!silent && !quiet) setLoading(true);
        if (!quiet) setLoadError(null);

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
            const trangCuoi = trangCuoiNeuVuot({
                trang: filters.page, kichThuoc: filters.size, soDong: content.length, tong: totalElements,
            });
            if (trangCuoi != null) {
                setFilters((prev) => ({ ...prev, page: trangCuoi }));
                return; // vẫn đang tải: lần gọi cho trang cuối sẽ tắt loading
            }

            setUsers(content);
            setTotal(totalElements);
            setLoadError(null);
            setLoading(false);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            console.error(error);
            if (quiet) {
                // Giữ bảng; tắt vòng tải phòng khi lần tải ngầm này đã thay một lần tải thường đang chạy
                setLoading(false);
                return;
            }
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

    // Quay lại tab thì tải lại ngầm danh sách + số trên tab
    useTaiLaiKhiQuayLai(() => {
        tabCounts.reload();
        fetchUsers({ quiet: true });
    }, { bat: !loading });

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
        // Vai trò dùng kho thường cần phân kho ngay sau khi tạo: mở thẳng ngăn kéo Phân quyền ở trang chi tiết.
        const canAssignWarehouse = user.id != null && canKho(user.vaiTro);
        toast.success("Đã tạo tài khoản.", {
            description: `Mật khẩu tạm thời của ${user.tenDangNhap} sẽ được gửi tới ${user.email}.`,
            action: canAssignWarehouse
                ? {
                      label: "Phân quyền",
                      onClick: () => navigate(`/users/${user.id}?phan-quyen=1`, { state: detailLinkState }),
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

    // Mở hộp từ menu ⋯. Cờ "đang xử lý" chỉ tắt khi lỗi hoặc khi mở lại hộp: tắt lúc hộp đang mờ dần
    // thì nút đổi chữ từ "Đang xử lý..." về nhãn cũ ngay trước mắt người dùng.
    const moHopCapLaiMatKhau = (user) => {
        setResettingUser(false);
        setResetDialog({ open: true, user });
    };
    const moHopKhoaMoKhoa = (user) => {
        setTogglingUser(false);
        setToggleDialog({ open: true, user });
    };

    // Đóng hộp thì đưa focus về nút ⋯ của dòng (mục menu đã mở hộp không còn trên trang)
    const traFocusVeNutMenu = (event, user) => {
        event.preventDefault();
        if (user?.id == null) return;
        document.querySelector(`[data-menu-nguoi-dung="${user.id}"]`)?.focus();
    };

    const handleConfirmResetRandom = async () => {
        const user = resetDialog.user;
        if (!user || resettingUser) return;
        setResettingUser(true);
        try {
            await adminService.resetUserPasswordRandomByAdmin(user.id);
            toast.success(`Đã gửi mật khẩu tạm thời mới tới ${user.email}.`);
            setResetDialog((d) => ({ ...d, open: false }));
            // Dòng phụ "Chưa đổi mật khẩu tạm thời" hiện ngay, không cần tải lại trang
            fetchUsers({ silent: true });
        } catch (err) {
            setResettingUser(false);
            toast.error(getApiErrorMessage(err, "Không thể cấp lại mật khẩu cho người dùng"));
        }
    };

    const handleConfirmToggle = async () => {
        const user = toggleDialog.user;
        if (!user || togglingUser) return;
        const dangHoatDong = user.trangThai === 1;
        setTogglingUser(true);
        try {
            // API chỉ đảo trạng thái: đọc lại trạng thái mới nhất trước khi đảo, để không mở khóa nhầm một tài khoản
            // người khác vừa khóa (danh sách đang xem có thể đã cũ).
            const moiNhat = await adminService.getByIdByAdmin(user.id);
            const trangThaiMoiNhat = moiNhat?.data?.trangThai;
            if (trangThaiMoiNhat != null && (trangThaiMoiNhat === 1) !== dangHoatDong) {
                toast.warning("Tài khoản này vừa được đổi trạng thái ở nơi khác.", {
                    description: "Danh sách đã được tải lại, hãy kiểm tra rồi thao tác lại.",
                });
                setToggleDialog((d) => ({ ...d, open: false }));
            } else {
                await adminService.toggleUserStatusByAdmin(user.id);
                toast.success(
                    dangHoatDong
                        ? `Đã khóa tài khoản ${tenTrongCau(user)}.`
                        : `Đã mở khóa tài khoản ${tenTrongCau(user)}.`
                );
                setToggleDialog((d) => ({ ...d, open: false }));
            }
            fetchUsers({ silent: true });
            tabCounts.reload();
        } catch (err) {
            setTogglingUser(false);
            toast.error(getApiErrorMessage(err, "Không thể cập nhật trạng thái tài khoản"));
        }
    };

    // Trang chi tiết dùng `from` cho nút "Quay lại danh sách" (giữ nguyên bộ lọc + trang).
    const detailLinkState = { from: `${location.pathname}${location.search}` };

    // Số chỉ hiện khi đã đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs.
    const statusTabs = STATUS_TABS.map((tab) => ({
        ...tab,
        count: loadError ? null : tabCounts.counts[tab.value],
    }));

    const resetTarget = resetDialog.user;
    const toggleTarget = toggleDialog.user;
    const toggleTargetActive = toggleTarget?.trangThai === 1;

    return (
        <PageContainer fill className="space-y-4">
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
                fill
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
                    !loading && !loadError && users.length > 0 ? (
                        <TablePagination
                            page={filters.page}
                            size={filters.size}
                            total={total}
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
                    ) : null
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
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                {COLUMNS.map((column) => (
                                    <th
                                        key={column.label}
                                        scope="col"
                                        className={cn(
                                            "h-10 whitespace-nowrap px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted",
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

                        <tbody
                            className="divide-y divide-bo-border"
                            onPointerDownCapture={() => {
                                boQuaClickRef.current = menuMoId != null;
                            }}
                        >
                            {users.map((u, index) => {
                                const isSelf = isCurrentUser(u);
                                const isActive = u.trangThai === 1;
                                const isNew = highlightUserId != null && u.id === highlightUserId;
                                const tenHienThi = u.hoTen?.trim() || u.tenDangNhap;
                                const email = u.email?.trim() || "";

                                return (
                                    <tr
                                        key={u.id}
                                        onClick={() => {
                                            // Cú bấm này chỉ để đóng menu ⋯ đang mở
                                            if (boQuaClickRef.current) {
                                                boQuaClickRef.current = false;
                                                return;
                                            }
                                            navigate(`/users/${u.id}`, { state: detailLinkState });
                                        }}
                                        aria-current={isNew ? "true" : undefined}
                                        className={cn(
                                            "group cursor-pointer transition-colors duration-500 hover:bg-bo-surface-subtle",
                                            isNew && "bg-bo-primary-soft"
                                        )}
                                    >
                                        <td className="px-4 py-2.5 text-center text-xs tabular-nums text-bo-muted">
                                            {filters.page * filters.size + index + 1}
                                        </td>

                                        {/* Người dùng: họ tên (đậm) + email; tên đăng nhập ở cột riêng */}
                                        <td className="px-4 py-2.5">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <UserAvatar
                                                    userId={u.id}
                                                    name={tenHienThi}
                                                    avatarUrl={u.avatarUrl}
                                                    size="xs"
                                                    className={cn(!isActive && "opacity-60 grayscale")}
                                                />
                                                <div className="min-w-0">
                                                    <div className="flex min-w-0 items-center gap-1.5">
                                                        {/* Link để dùng được bằng bàn phím / mở tab mới; chặn bubble lên onClick của dòng */}
                                                        <Link
                                                            to={`/users/${u.id}`}
                                                            state={detailLinkState}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (boQuaClickRef.current) {
                                                                    boQuaClickRef.current = false;
                                                                    e.preventDefault();
                                                                }
                                                            }}
                                                            title={tenHienThi}
                                                            className={cn(
                                                                "block max-w-[240px] truncate rounded-sm font-semibold hover:text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
                                                                isActive ? "text-bo-foreground" : "text-bo-muted"
                                                            )}
                                                        >
                                                            {tenHienThi}
                                                        </Link>
                                                        {isSelf ? (
                                                            <span className="shrink-0 rounded-full bg-bo-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-bo-primary">
                                                                Bạn
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div
                                                        className="max-w-[260px] truncate text-[13px] leading-[18px] text-bo-muted"
                                                        title={email || undefined}
                                                    >
                                                        {email || "Chưa có email"}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">
                                            <div className="max-w-[200px] truncate" title={u.tenDangNhap}>
                                                {u.tenDangNhap}
                                            </div>
                                        </td>

                                        {/* Vai trò là phân loại: chữ thường, không dùng thẻ trạng thái */}
                                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">
                                            {formatRole(u.vaiTro)}
                                        </td>

                                        <td className="px-4 py-2.5">
                                            <KhoPhuTrach user={u} />
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-600">
                                            {u.soDienThoai || "—"}
                                        </td>

                                        <td className="px-4 py-2.5">
                                            <StatusBadge doiTuong="nguoi" label={isActive ? "Hoạt động" : "Bị khóa"} />
                                            {u.mustChangePassword ? (
                                                <div className="mt-1 whitespace-nowrap text-xs leading-4 text-bo-muted">
                                                    Chưa đổi mật khẩu tạm thời
                                                </div>
                                            ) : null}
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-2.5 text-[13px] tabular-nums text-bo-muted">
                                            {formatDate(u.ngayTao)}
                                        </td>

                                        {/* Ô thao tác không điều hướng: bấm trượt nút hoặc chọn mục menu không mở chi tiết */}
                                        <td
                                            className={cn(
                                                "sticky right-0 z-[1] cursor-default whitespace-nowrap px-4 py-2.5 text-center transition-colors duration-500 group-hover:bg-bo-surface-subtle",
                                                isNew ? "bg-bo-primary-soft" : "bg-white",
                                                columnsHidden && STICKY_EDGE
                                            )}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <DropdownMenu
                                                modal={false}
                                                open={menuMoId === u.id}
                                                // Menu cũ đóng sau khi menu mới đã mở (bấm sang ⋯ dòng khác):
                                                // chỉ xóa khi đang là menu của chính dòng này, kẻo phải bấm hai lần.
                                                onOpenChange={(mo) =>
                                                    setMenuMoId((dangMo) => (mo ? u.id : dangMo === u.id ? null : dangMo))
                                                }
                                            >
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        type="button"
                                                        data-menu-nguoi-dung={u.id}
                                                        aria-label={`Thao tác với ${tenTrongCau(u)}`}
                                                        title="Thao tác"
                                                        className={NUT_MENU}
                                                    >
                                                        <Ellipsis className="size-4" aria-hidden="true" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="end"
                                                    className="z-50 w-[300px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                                >
                                                    <DropdownMenuItem
                                                        onClick={() => navigate(`/users/${u.id}`, { state: detailLinkState })}
                                                        className={MUC_MENU}
                                                    >
                                                        <Eye className="mt-0.5 size-4 text-slate-400" aria-hidden="true" />
                                                        <span className="font-medium text-bo-foreground">Xem chi tiết</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        disabled={isSelf}
                                                        onClick={() =>
                                                            navigate(`/users/${u.id}?phan-quyen=1`, { state: detailLinkState })
                                                        }
                                                        className={MUC_MENU}
                                                    >
                                                        <ShieldCheck className="mt-0.5 size-4 text-slate-400" aria-hidden="true" />
                                                        <span className="flex min-w-0 flex-col gap-0.5">
                                                            <span className="font-medium text-bo-foreground">Phân quyền</span>
                                                            <span className="text-xs leading-4 text-bo-muted">
                                                                {isSelf
                                                                    ? "Bạn không tự phân quyền cho chính mình được"
                                                                    : u.vaiTro === QUAN_TRI_VIEN
                                                                      ? "Vai trò · quản trị viên có toàn quyền ở mọi kho"
                                                                      : "Vai trò, kho làm việc và quyền"}
                                                            </span>
                                                        </span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        disabled={isSelf || !email}
                                                        onClick={() => moHopCapLaiMatKhau(u)}
                                                        className={MUC_MENU}
                                                    >
                                                        <KeyRound className="mt-0.5 size-4 text-slate-400" aria-hidden="true" />
                                                        <span className="flex min-w-0 flex-col gap-0.5">
                                                            <span className="font-medium text-bo-foreground">Cấp lại mật khẩu</span>
                                                            <span className="break-all text-xs leading-4 text-bo-muted">
                                                                {isSelf
                                                                    ? "Tài khoản của bạn: dùng Đổi mật khẩu"
                                                                    : email
                                                                      ? `Gửi mật khẩu tạm thời mới tới ${email}`
                                                                      : "Tài khoản chưa có email nên không gửi được"}
                                                            </span>
                                                        </span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator className="my-1 bg-bo-border" />
                                                    {isActive ? (
                                                        <DropdownMenuItem
                                                            disabled={isSelf}
                                                            onClick={() => moHopKhoaMoKhoa(u)}
                                                            className={`${MUC_MENU} focus:bg-bo-danger-soft`}
                                                        >
                                                            <Lock className="mt-0.5 size-4 text-bo-danger" aria-hidden="true" />
                                                            <span className="flex min-w-0 flex-col gap-0.5">
                                                                <span className="font-medium text-bo-danger">Khóa tài khoản</span>
                                                                <span className="text-xs leading-4 text-bo-muted">
                                                                    {isSelf
                                                                        ? "Không thể tự khóa tài khoản của mình"
                                                                        : "Không đăng nhập được · phiếu và lịch sử giữ nguyên"}
                                                                </span>
                                                            </span>
                                                        </DropdownMenuItem>
                                                    ) : (
                                                        <DropdownMenuItem
                                                            onClick={() => moHopKhoaMoKhoa(u)}
                                                            className={MUC_MENU}
                                                        >
                                                            <LockOpen className="mt-0.5 size-4 text-bo-success" aria-hidden="true" />
                                                            <span className="flex min-w-0 flex-col gap-0.5">
                                                                <span className="font-medium text-bo-foreground">Mở khóa tài khoản</span>
                                                                <span className="text-xs leading-4 text-bo-muted">
                                                                    Người dùng đăng nhập lại được
                                                                </span>
                                                            </span>
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
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

            {/* ── DIALOG CẤP LẠI MẬT KHẨU (cùng nội dung với Chi tiết người dùng; mục menu đã tắt khi chưa có email) ── */}
            <AlertDialog
                open={resetDialog.open}
                onOpenChange={(open) => {
                    if (!open && !resettingUser) setResetDialog((d) => ({ ...d, open: false }));
                }}
            >
                <AlertDialogContent
                    className="bg-white"
                    onCloseAutoFocus={(e) => traFocusVeNutMenu(e, resetTarget)}
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cấp lại mật khẩu cho {tenTrongCau(resetTarget)}?</AlertDialogTitle>
                        {/* asChild: Description mặc định render <p>; bên trong có <p> sẽ sai cấu trúc HTML */}
                        <AlertDialogDescription asChild>
                            <div className="space-y-2 text-sm text-slate-600">
                                <p>
                                    Hệ thống tạo mật khẩu tạm thời ngẫu nhiên và gửi tới{" "}
                                    <span className="font-medium text-slate-900">{resetTarget?.email}</span>. Sau khi
                                    đăng nhập, người dùng phải đổi mật khẩu mới.
                                </p>
                                {resetTarget && resetTarget.trangThai !== 1 ? (
                                    <p className="flex items-start gap-1.5 text-xs font-medium text-bo-warning">
                                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                                        Tài khoản đang bị khóa: người dùng chỉ đăng nhập được bằng mật khẩu mới sau khi
                                        được mở khóa.
                                    </p>
                                ) : null}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:justify-end">
                        <AlertDialogCancel disabled={resettingUser}>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={resettingUser || !resetTarget?.email}
                            onClick={(e) => {
                                e.preventDefault();
                                handleConfirmResetRandom();
                            }}
                            className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            {resettingUser ? "Đang gửi..." : "Cấp lại mật khẩu"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── DIALOG KHÓA / MỞ KHÓA (cùng nội dung với Chi tiết người dùng) ── */}
            <AlertDialog
                open={toggleDialog.open}
                onOpenChange={(open) => {
                    if (!open && !togglingUser) setToggleDialog((d) => ({ ...d, open: false }));
                }}
            >
                <AlertDialogContent
                    className="bg-white"
                    onCloseAutoFocus={(e) => traFocusVeNutMenu(e, toggleTarget)}
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {toggleTargetActive
                                ? `Khóa tài khoản ${tenTrongCau(toggleTarget)}?`
                                : `Mở khóa tài khoản ${tenTrongCau(toggleTarget)}?`}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {toggleTargetActive
                                ? "Người dùng bị đăng xuất ở thao tác tiếp theo và không đăng nhập được cho tới khi mở khóa. Phiếu, đơn và lịch sử do người này tạo vẫn giữ nguyên."
                                : "Người dùng đăng nhập lại được bằng mật khẩu hiện tại. Vai trò, nơi làm việc và quyền giữ như trước khi khóa."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:justify-end">
                        <AlertDialogCancel disabled={togglingUser}>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={togglingUser}
                            onClick={(e) => {
                                e.preventDefault();
                                handleConfirmToggle();
                            }}
                            className={
                                toggleTargetActive
                                    ? "bg-bo-danger text-white hover:bg-bo-danger/90"
                                    : "bg-bo-primary text-white hover:bg-bo-primary-hover"
                            }
                        >
                            {togglingUser
                                ? "Đang xử lý..."
                                : toggleTargetActive
                                  ? "Khóa tài khoản"
                                  : "Mở khóa tài khoản"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PageContainer>
    );
}
