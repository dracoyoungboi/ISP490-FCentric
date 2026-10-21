import { getApiErrorMessage } from "@/utils/apiError";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import apiClient from "@/services/apiClient";
import { CircleCheck, CirclePause, Eye, Pencil, Plus, User, Mail, Phone, Users, SearchX } from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import KhachHangFormDialog from "@/components/khach-hang/KhachHangFormDialog";
import TrangThaiKhachHangDialog from "@/components/khach-hang/chi-tiet/TrangThaiKhachHangDialog";
import { laHoatDong } from "@/components/khach-hang/chi-tiet/tinhKhachHang";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import FilterSelect from "@/components/shared/FilterSelect";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import { ROLES, hasAnyRole } from "@/utils/roles";

// Khớp quyền ở backend (KhachHangController): thêm, sửa, đổi trạng thái khách hàng.
const QUYEN_SUA_KHACH = [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_BAN_HANG];
// Dòng khách vừa thêm được tô nền vài giây rồi trở lại bình thường.
const TO_DONG_MOI_MS = 4000;

// Gõ ô tìm kiếm: chờ người dùng ngừng gõ một chút rồi mới gọi API
const SEARCH_DEBOUNCE_MS = 300;

// Tên loại khách hàng (giữ nguyên 3 giá trị nghiệp vụ). Loại là phân loại, hiện chữ thường, không tô màu.
const LOAI_KHACH_HANG_MAP = {
    le: { label: "Khách lẻ" },
    doanh_nghiep: { label: "Doanh nghiệp" },
    si: { label: "Khách sỉ" }
};

// Tab theo loại khách hàng (bố cục A+G), thứ tự giữ như bộ lọc loại cũ.
// Giá trị tab là mã loại trong code, nằm trên URL ?loai= (tab "Tất cả" không ghi lên URL).
const LOAI_TAB_MAC_DINH = "tat-ca";
const LOAI_TABS = [
    { value: LOAI_TAB_MAC_DINH, label: "Tất cả" },
    { value: "le", label: LOAI_KHACH_HANG_MAP.le.label },
    { value: "si", label: LOAI_KHACH_HANG_MAP.si.label },
    { value: "doanh_nghiep", label: LOAI_KHACH_HANG_MAP.doanh_nghiep.label }
];
const LOAI_TAB_VALUES = LOAI_TABS.map((tab) => tab.value);

// Trạng thái vẫn là ô chọn (SRS 1.5.1); một tên "Ngừng hoạt động" cho cả bộ lọc, bảng và hộp thoại đổi trạng thái
const TRANG_THAI_FILTER_OPTIONS = [
    { value: "all", label: "Tất cả trạng thái" },
    { value: "1", label: "Hoạt động" },
    { value: "0", label: "Ngừng hoạt động" }
];

// Điều kiện lọc dùng chung cho danh sách và số trên tab (chỉ khác điều kiện loại)
function buildKhachHangFilters({ keyword, loai, trangThai }) {
    const filters = [];

    // Search filter - tìm theo tên, mã, số điện thoại, email
    if (keyword) {
        ["tenKhachHang", "maKhachHang", "soDienThoai", "email"].forEach((fieldName) => {
            filters.push({
                fieldName,
                operation: "ILIKE",
                value: `%${keyword}%`,
                logicType: "OR"
            });
        });
    }

    // Loại khách hàng filter
    if (loai && loai !== LOAI_TAB_MAC_DINH) {
        filters.push({
            fieldName: "loaiKhachHang",
            operation: "EQUALS",
            value: loai,
            logicType: "AND"
        });
    }

    // Trạng thái filter
    if (trangThai !== "all") {
        filters.push({
            fieldName: "trangThai",
            operation: "EQUALS",
            value: parseInt(trangThai),
            logicType: "AND"
        });
    }

    return filters;
}

// Service xử lý API calls
const khachHangService = {
    filter: async (filterRequest) => {
        const response = await apiClient.post("/api/v1/khach-hang/filter", filterRequest);
        return response.data.data;
    },

};

// Component chính
export default function KhachHangPage() {
    const [khachHangs, setKhachHangs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(SO_DONG_MAC_DINH);
    const [totalItems, setTotalItems] = useState(0);
    const navigate = useNavigate();
    const coTheSua = hasAnyRole(QUYEN_SUA_KHACH);
    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    // Từ khóa thực sự gửi lên server (trễ SEARCH_DEBOUNCE_MS sau lần gõ cuối, hoặc ngay khi Enter)
    const [debouncedSearch, setDebouncedSearch] = useState("");
    // Tab loại khách hàng nằm trên URL ?loai= (F5 / quay lại từ chi tiết vẫn đúng tab)
    const [loaiKhachHang, setLoaiKhachHang] = useTabTrenUrl(LOAI_TAB_VALUES, LOAI_TAB_MAC_DINH, { ten: "loai" });
    const [trangThai, setTrangThai] = useState("all");
    const [loadError, setLoadError] = useState(false);
    // Đánh số mỗi lần tải danh sách: phản hồi về muộn của lần tải cũ bị bỏ qua
    const requestSeq = useRef(0);

    // Popup Thêm / Sửa khách hàng: giữ khách đang sửa sau khi đóng để nội dung không đổi giữa chừng
    // khi hiệu ứng đóng còn chạy. Đường dẫn cũ /customers/:id/edit đã chuyển sang trang chi tiết.
    const [formDialog, setFormDialog] = useState({ open: false, khachHang: null });
    const moForm = (khachHang = null) => setFormDialog({ open: true, khachHang });
    const [trangThaiDialog, setTrangThaiDialog] = useState({ open: false, khachHang: null });
    const [highlightId, setHighlightId] = useState(null);

    // Load data
    // silent: tải lại ngầm khi quay lại tab — giữ bảng đang xem, lỗi chỉ ghi log
    const loadKhachHangs = useCallback(async ({ silent = false } = {}) => {
        const seq = ++requestSeq.current;
        if (!silent) setLoading(true);
        try {
            const filters = buildKhachHangFilters({ keyword: debouncedSearch, loai: loaiKhachHang, trangThai });

            const filterRequest = {
                filters,
                sorts: [
                    {
                        fieldName: "ngayTao",
                        direction: "DESC"
                    }
                ],
                page: currentPage,
                size: pageSize
            };

            const data = await khachHangService.filter(filterRequest);
            if (seq !== requestSeq.current) return;

            const content = data.content || [];
            // Trang hiện tại không còn dòng nào (vừa xóa dòng cuối của trang cuối...) -> lùi một trang.
            // Server trả trang rỗng kèm totalElements = 0 nên không dựa vào tổng để tính trang cuối.
            if (!content.length && currentPage > 0) {
                setCurrentPage(page => Math.max(0, page - 1));
                return;
            }
            setKhachHangs(content);
            setTotalItems(data.totalElements || 0);
            setLoadError(false);
        } catch (error) {
            if (seq !== requestSeq.current) return;
            if (silent) {
                console.error(error);
                return;
            }
            // Không giữ dòng + tổng số của lần tải trước (R9); bảng hiện thẻ lỗi kèm nút Thử lại
            console.error(getApiErrorMessage(error, "Không tải được danh sách khách hàng"));
            setLoadError(true);
            setKhachHangs([]);
            setTotalItems(0);
        } finally {
            if (seq === requestSeq.current) setLoading(false);
        }
    }, [currentPage, pageSize, debouncedSearch, loaiKhachHang, trangThai]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => loadKhachHangs());
    }, [loadKhachHangs]);

    // Số trên tab: cùng từ khóa + trạng thái đang lọc, chỉ thay điều kiện loại (R1);
    // cùng điều kiện "loaiKhachHang EQUALS" của danh sách nên số khớp số dòng khi bấm tab
    const tabCounts = useDemTheoTrangThai(
        LOAI_TAB_VALUES,
        async (loai) => {
            const data = await khachHangService.filter({
                filters: buildKhachHangFilters({ keyword: debouncedSearch, loai, trangThai }),
                sorts: [],
                page: 0,
                size: 1
            });
            return data.totalElements || 0;
        },
        `${debouncedSearch}|${trangThai}`
    );

    // Quay lại tab thì tải lại ngầm danh sách + số trên tab (khách mới có thể được tạo ở quầy POS)
    useTaiLaiKhiQuayLai(() => {
        tabCounts.reload();
        loadKhachHangs({ silent: true });
    }, { bat: !loading });

    // Áp dụng từ khóa tìm kiếm và quay về trang đầu (chỉ khi từ khóa thực sự đổi)
    const applySearch = useCallback((term) => {
        if (term === debouncedSearch) return;
        setDebouncedSearch(term);
        setCurrentPage(0);
    }, [debouncedSearch]);

    useEffect(() => {
        const term = searchQuery.trim();
        if (term === debouncedSearch) return undefined;
        const timer = setTimeout(() => applySearch(term), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchQuery, debouncedSearch, applySearch]);

    // Handlers
    // Enter: tìm ngay, không chờ hết thời gian trễ (bộ hẹn giờ đang chờ tự hủy khi từ khóa đổi)
    const handleSearch = () => {
        applySearch(searchQuery.trim());
    };

    const handleClearSearch = () => {
        setSearchQuery("");
        applySearch("");
    };

    // Đổi tab loại: ghi lên URL và về trang đầu
    const handleLoaiKhachHangChange = (value) => {
        setLoaiKhachHang(value);
        setCurrentPage(0);
    };

    const handleTrangThaiChange = (value) => {
        setTrangThai(value);
        setCurrentPage(0);
    };

    // "Xóa lọc": bỏ từ khóa + trạng thái, giữ tab loại đang chọn
    const handleResetFilters = () => {
        setSearchQuery("");
        setDebouncedSearch("");
        setTrangThai("all");
        setCurrentPage(0);
    };

    const handleRetry = () => {
        loadKhachHangs();
        tabCounts.reload();
    };

    // Nhấn vào dòng -> xem chi tiết; bỏ qua khi người dùng đang bôi đen chữ (vd. copy SĐT, email)
    const handleRowClick = (khachHang) => {
        if (window.getSelection()?.toString()) return;
        navigate(`/customers/${khachHang.id}`);
    };

    // Bỏ tô nền dòng vừa thêm sau vài giây.
    useEffect(() => {
        if (highlightId == null) return undefined;
        const timer = setTimeout(() => setHighlightId(null), TO_DONG_MOI_MS);
        return () => clearTimeout(timer);
    }, [highlightId]);

    const handleSaved = (saved, { laSua }) => {
        if (laSua) {
            setKhachHangs((prev) => prev.map((item) => (item.id === saved?.id ? { ...item, ...saved } : item)));
            toast.success(`Đã lưu thông tin khách hàng "${saved?.tenKhachHang ?? ""}"`);
            tabCounts.reload();
            return;
        }
        tabCounts.reload();
        if (!saved?.id) {
            // Máy chủ cũ chưa trả khách vừa tạo: tải lại danh sách.
            toast.success("Đã thêm khách hàng");
            setCurrentPage(0);
            loadKhachHangs();
            return;
        }
        // Danh sách xếp mới nhất lên đầu: thêm vào đầu, về trang 1 và tô nền dòng mới.
        setKhachHangs((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)].slice(0, pageSize));
        setTotalItems((n) => n + 1);
        setLoadError(false);
        setHighlightId(saved.id);
        setCurrentPage(0);
        const tabLoai = LOAI_TABS.find((tab) => tab.value === saved.loaiKhachHang);
        const khacTab = loaiKhachHang !== LOAI_TAB_MAC_DINH && saved.loaiKhachHang !== loaiKhachHang;
        toast.success(`Đã thêm khách hàng ${saved.maKhachHang}`, {
            description: khacTab && tabLoai ? `Khách mới nằm ở tab ${tabLoai.label}.` : undefined,
            action: { label: "Xem", onClick: () => navigate(`/customers/${saved.id}`) },
        });
    };

    const handleTrangThaiDoi = (moi) => {
        setKhachHangs((prev) => prev.map((item) => (item.id === moi.id ? { ...item, ...moi } : item)));
        toast.success(laHoatDong(moi) ? "Đã cho phép khách hàng hoạt động lại" : "Đã ngừng hoạt động khách hàng");
        tabCounts.reload();
        // Đang lọc theo trạng thái thì dòng vừa đổi không còn thuộc bộ lọc: tải lại ngầm.
        if (trangThai !== "all") loadKhachHangs({ silent: true });
    };

    // Render helpers
    const getLoaiKhachHangBadge = (loai) => {
        // Khách tạo trước khi backend lưu loại có loaiKhachHang = null -> "Chưa phân loại" (chữ xám)
        const item = LOAI_KHACH_HANG_MAP[loai];
        if (!item) return <span className="whitespace-nowrap text-bo-muted">{loai || "Chưa phân loại"}</span>;
        return <span className="whitespace-nowrap text-slate-700">{item.label}</span>;
    };

    const totalPages = Math.ceil(totalItems / pageSize);

    const handlePageChange = (newPage) => {
        if (newPage >= 0 && newPage < totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handlePageSizeChange = (newSize) => {
        setPageSize(newSize);
        setCurrentPage(0);
    };

    // Bộ lọc ngoài tab loại (nút "Xóa lọc" chỉ xóa các bộ lọc này)
    const hasActiveFilters = Boolean(searchQuery.trim() || debouncedSearch || trangThai !== "all");

    // Số chỉ hiện khi đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs
    const loaiTabs = LOAI_TABS.map((tab) => ({
        ...tab,
        count: loadError ? null : tabCounts.counts[tab.value],
    }));
    const loaiTabLabel = LOAI_TABS.find((tab) => tab.value === loaiKhachHang)?.label;

    return (
        <PageContainer fill className="space-y-4">
            {/* ── Hàng tiêu đề: tên trang + nút chính ── */}
            <ListPageHeader
                actions={
                    coTheSua ? (
                        <Button
                            onClick={() => moForm()}
                            className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            <Plus className="size-4" />
                            Thêm khách hàng
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
                                label="Lọc khách hàng theo loại"
                                tabs={loaiTabs}
                                value={loaiKhachHang}
                                onChange={handleLoaiKhachHangChange}
                            />
                        }
                        hasFilter={hasActiveFilters}
                        onClear={handleResetFilters}
                    >
                        <SearchInput
                            label="Tìm khách hàng"
                            placeholder="Tìm theo tên, mã, SĐT, email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClear={handleClearSearch}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            className="sm:w-[300px]"
                        />
                        <FilterSelect
                            label="Lọc theo trạng thái"
                            value={trangThai}
                            options={TRANG_THAI_FILTER_OPTIONS}
                            onChange={handleTrangThaiChange}
                            className="sm:w-[180px]"
                            align="end"
                        />
                    </ListToolbar>
                }
                footer={
                    !loading && !loadError && totalItems > 0 ? (
                        <TablePagination
                            page={currentPage}
                            size={pageSize}
                            total={totalItems}
                            onPageChange={handlePageChange}
                            onSizeChange={handlePageSizeChange}
                        />
                    ) : null
                }
            >
                {loading ? (
                    <LoadingState rows={6} label="Đang tải danh sách khách hàng" />
                ) : loadError ? (
                    <ErrorState
                        description="Không tải được danh sách khách hàng. Vui lòng thử lại."
                        onRetry={handleRetry}
                    />
                ) : khachHangs.length === 0 ? (
                    hasActiveFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy khách hàng phù hợp"
                            description="Thử đổi từ khóa hoặc trạng thái."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={handleResetFilters}
                                    className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Xóa lọc
                                </Button>
                            }
                        />
                    ) : loaiKhachHang !== LOAI_TAB_MAC_DINH ? (
                        <EmptyState
                            icon={Users}
                            title={`Không có khách hàng nào thuộc loại "${loaiTabLabel}"`}
                            description="Chọn tab Tất cả để xem mọi khách hàng."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() => handleLoaiKhachHangChange(LOAI_TAB_MAC_DINH)}
                                    className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    Xem tất cả
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={Users}
                            title="Chưa có khách hàng"
                            description="Thêm khách hàng để lập đơn bán hàng và theo dõi lịch sử mua."
                            action={
                                coTheSua ? (
                                    <Button
                                        onClick={() => moForm()}
                                        className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
                                    >
                                        <Plus className="size-4" />
                                        Thêm khách hàng
                                    </Button>
                                ) : null
                            }
                        />
                    )
                ) : (
                    <table className="w-full min-w-[900px] text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className="h-10 w-14 whitespace-nowrap px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    STT
                                </th>
                                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Mã KH
                                </th>
                                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Khách hàng
                                </th>
                                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Loại KH
                                </th>
                                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Liên hệ
                                </th>
                                <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Trạng thái
                                </th>
                                <th className="h-10 whitespace-nowrap px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Thao tác
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {khachHangs.map((khachHang, index) => (
                                <tr
                                    key={khachHang.id}
                                    onClick={() => handleRowClick(khachHang)}
                                    className={`cursor-pointer transition-colors hover:bg-bo-surface-subtle ${khachHang.id === highlightId ? "bg-bo-primary-soft" : ""}`}
                                >
                                    <td className="px-3 py-3 text-center text-xs text-bo-muted">
                                        {currentPage * pageSize + index + 1}
                                    </td>
                                    <td className="px-3 py-3">
                                        <span className="font-semibold tracking-wide text-bo-primary">
                                            {khachHang.maKhachHang}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="font-semibold text-bo-foreground">
                                            {khachHang.tenKhachHang}
                                        </div>
                                        {khachHang.nguoiLienHe && (
                                            <div className="mt-0.5 flex items-center gap-1 text-xs text-bo-muted">
                                                <User className="size-3 shrink-0" /> {khachHang.nguoiLienHe}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-3">
                                        {getLoaiKhachHangBadge(khachHang.loaiKhachHang)}
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="flex flex-col gap-1 text-xs text-bo-muted">
                                            <div className="flex items-center gap-1.5">
                                                <Phone className="size-3 shrink-0" /> {khachHang.soDienThoai || "—"}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Mail className="size-3 shrink-0" /> {khachHang.email || "—"}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3">
                                        <StatusBadge doiTuong="nguoi" label={khachHang.trangThai === 1 ? "Hoạt động" : "Ngừng hoạt động"} />
                                    </td>
                                    <td className="px-3 py-3">
                                        <RowActions>
                                            <RowActionButton
                                                icon={Eye}
                                                label="Xem chi tiết"
                                                onClick={() => navigate(`/customers/${khachHang.id}`)}
                                            />
                                            {coTheSua ? (
                                                <>
                                                    <RowActionButton
                                                        icon={Pencil}
                                                        label="Chỉnh sửa"
                                                        onClick={() => moForm(khachHang)}
                                                    />
                                                    <RowActionButton
                                                        icon={laHoatDong(khachHang) ? CirclePause : CircleCheck}
                                                        label={laHoatDong(khachHang) ? "Ngừng hoạt động" : "Cho phép hoạt động"}
                                                        onClick={() => setTrangThaiDialog({ open: true, khachHang })}
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

            {/* ── Thêm / Sửa khách hàng (popup dùng chung với trang chi tiết) ── */}
            {coTheSua ? (
                <>
                    <KhachHangFormDialog
                        open={formDialog.open}
                        onOpenChange={(open) => setFormDialog((prev) => ({ ...prev, open }))}
                        khachHang={formDialog.khachHang}
                        onSaved={handleSaved}
                    />
                    <TrangThaiKhachHangDialog
                        khachHang={trangThaiDialog.khachHang}
                        open={trangThaiDialog.open}
                        onOpenChange={(open) => setTrangThaiDialog((prev) => ({ ...prev, open }))}
                        onChanged={handleTrangThaiDoi}
                    />
                </>
            ) : null}
        </PageContainer>
    );
}
