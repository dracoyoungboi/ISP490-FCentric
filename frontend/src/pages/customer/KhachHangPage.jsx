import { getApiErrorMessage } from "@/utils/apiError";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import apiClient from "@/services/apiClient";
import {
    Plus,
    Eye,
    Trash2,
    User,
    Mail,
    Phone,
    MapPin,
    AlertCircle,
    CheckCircle2,
    Loader2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Check,
    Users,
    UserPlus,
    SearchX
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import PageContainer from "@/components/backoffice/PageContainer";
import ConfirmModal from "@/components/ui/confirm-modal";
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
import useDemTheoTrangThai from "@/hooks/useDemTheoTrangThai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import {
    PHONE_ERROR_MESSAGE,
    getPhoneError,
    isPhoneValid,
    sanitizePhoneInput
} from "@/utils/phoneValidation";

// Gõ ô tìm kiếm: chờ người dùng ngừng gõ một chút rồi mới gọi API
const SEARCH_DEBOUNCE_MS = 300;

// Dãy nút trang: luôn có trang đầu, trang cuối và các trang quanh trang hiện tại;
// khoảng bị bỏ qua hiển thị "…" (khoảng chỉ thiếu đúng 1 trang thì hiện luôn trang đó).
// Trang tính từ 0, phần tử dạng chuỗi là dấu "…".
function getPageItems(current, totalPages) {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);

    const pages = new Set([0, totalPages - 1, current - 1, current, current + 1]);
    // Gần đầu / cuối dãy: hiện đủ các trang liền kề để số nút không bị co lại
    if (current <= 2) [1, 2, 3].forEach(p => pages.add(p));
    if (current >= totalPages - 3) [totalPages - 4, totalPages - 3, totalPages - 2].forEach(p => pages.add(p));

    const sorted = [...pages].filter(p => p >= 0 && p < totalPages).sort((a, b) => a - b);
    const items = [];
    sorted.forEach((page, i) => {
        const prev = sorted[i - 1];
        if (i > 0 && page - prev === 2) items.push(prev + 1);
        else if (i > 0 && page - prev > 2) items.push(`gap-${prev}`);
        items.push(page);
    });
    return items;
}

// Bản đồ nhãn + tông màu loại khách hàng (giữ nguyên 3 giá trị nghiệp vụ)
const LOAI_KHACH_HANG_MAP = {
    le: { label: "Khách lẻ", tone: "info" },
    doanh_nghiep: { label: "Doanh nghiệp", tone: "warning" },
    si: { label: "Khách sỉ", tone: "success" }
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

// Trạng thái vẫn là ô chọn (SRS 1.5.1); một tên "Ngừng hoạt động" cho cả bộ lọc, bảng và hộp thoại xóa
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

    getById: async (id) => {
        const response = await apiClient.get(`/api/v1/khach-hang/get-by-id/${id}`);
        return response.data.data;
    },

    create: async (data) => {
        const response = await apiClient.post("/api/v1/khach-hang/create", data);
        return response.data;
    },

    update: async (id, data) => {
        const response = await apiClient.put(`/api/v1/khach-hang/${id}`, data);
        return response.data;
    },

    softDelete: async (id) => {
        const response = await apiClient.delete(`/api/v1/khach-hang/soft-delete/${id}`);
        return response.data;
    }
};

// Component chính
export default function KhachHangPage() {
    const [khachHangs, setKhachHangs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    const [totalItems, setTotalItems] = useState(0);
    const navigate = useNavigate();
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

    // Dialog states
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [selectedKhachHang, setSelectedKhachHang] = useState(null);

    // Form state for create
    const [formData, setFormData] = useState({
        maKhachHang: "",
        tenKhachHang: "",
        nguoiLienHe: "",
        soDienThoai: "",
        email: "",
        diaChi: "",
        loaiKhachHang: "le"
    });

    const [formErrors, setFormErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Lỗi từ server khi bấm "Thêm khách hàng" (trùng mã/SĐT/email...) — hiện ngay trong dialog
    const [submitError, setSubmitError] = useState("");

    // Alert state
    const [alert, setAlert] = useState({ show: false, message: "", type: "success" });

    // Alert helper
    const showAlert = useCallback((message, type = "success") => {
        setAlert({ show: true, message, type });
        setTimeout(() => setAlert({ show: false, message: "", type: "success" }), 3000);
    }, []);

    // Load data
    const loadKhachHangs = useCallback(async () => {
        const seq = ++requestSeq.current;
        setLoading(true);
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
            // Không giữ dòng + tổng số của lần tải trước (R9)
            setLoadError(true);
            setKhachHangs([]);
            setTotalItems(0);
            showAlert(getApiErrorMessage(error, "Không tải được danh sách khách hàng"), "error");
        } finally {
            if (seq === requestSeq.current) setLoading(false);
        }
    }, [currentPage, pageSize, debouncedSearch, loaiKhachHang, trangThai, showAlert]);

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

    const handleDeleteClick = (khachHang) => {
        setSelectedKhachHang(khachHang);
        setShowDeleteDialog(true);
    };

    const handleDeleteConfirm = async () => {
        try {
            await khachHangService.softDelete(selectedKhachHang.id);
            showAlert("Xóa khách hàng thành công");
            setShowDeleteDialog(false);
            loadKhachHangs();
            tabCounts.reload();
        } catch (error) {
            showAlert(getApiErrorMessage(error, "Không xóa được khách hàng"), "error");
        }
    };

    // Create dialog handlers
    const handleOpenCreateDialog = () => {
        setFormData({
            maKhachHang: "",
            tenKhachHang: "",
            nguoiLienHe: "",
            soDienThoai: "",
            email: "",
            diaChi: "",
            loaiKhachHang: "le"
        });
        setFormErrors({});
        setSubmitError("");
        setShowCreateDialog(true);
    };

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setSubmitError("");
        // Clear error for this field when user starts typing
        if (formErrors[field]) {
            setFormErrors(prev => ({ ...prev, [field]: "" }));
        }
    };

    const validateForm = () => {
        const errors = {};

        if (!formData.maKhachHang.trim()) {
            errors.maKhachHang = "Mã khách hàng là bắt buộc";
        }

        if (!formData.tenKhachHang.trim()) {
            errors.tenKhachHang = "Tên khách hàng là bắt buộc";
        }

        if (!isPhoneValid(formData.soDienThoai)) {
            errors.soDienThoai = PHONE_ERROR_MESSAGE;
        }

        if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
            errors.email = "Email không hợp lệ";
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateSubmit = async () => {
        if (!validateForm()) {
            showAlert("Vui lòng kiểm tra lại thông tin", "error");
            return;
        }

        setIsSubmitting(true);
        try {
            await khachHangService.create(formData);
            showAlert("Thêm khách hàng thành công");
            setShowCreateDialog(false);
            loadKhachHangs();
            tabCounts.reload();
        } catch (error) {
            // Hiện trong dialog (thông báo ngoài trang bị lớp phủ dialog che); ưu tiên message của backend,
            // vd. "Số điện thoại đã thuộc khách hàng ..." thay vì "Request failed with status code 409"
            setSubmitError(error.response?.data?.message || "Không thể thêm khách hàng. Vui lòng thử lại.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render helpers
    const getLoaiKhachHangBadge = (loai) => {
        // Khách tạo trước khi backend lưu loại có loaiKhachHang = null -> "Chưa phân loại"
        const item = LOAI_KHACH_HANG_MAP[loai] || { label: loai || "Chưa phân loại", tone: "neutral" };

        return <StatusBadge label={item.label} tone={item.tone} dot={false} />;
    };

    const totalPages = Math.ceil(totalItems / pageSize);

    const handlePageChange = (newPage) => {
        if (newPage >= 0 && newPage < totalPages) {
            setCurrentPage(newPage);
        }
    };

    // Hiện lỗi SĐT ngay khi đã gõ đủ 10 số mà sai định dạng, hoặc lỗi từ lần bấm "Thêm"
    const phoneError = formErrors.soDienThoai || getPhoneError(formData.soDienThoai);

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
        <PageContainer className="space-y-4">
            {/* ── Hàng tiêu đề: tên trang + nút chính ── */}
            <ListPageHeader
                actions={
                    <Button
                        onClick={handleOpenCreateDialog}
                        className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
                    >
                        <Plus className="size-4" />
                        Thêm khách hàng
                    </Button>
                }
            />

            {/* ── Alert ── */}
            {alert.show && (
                <div
                    role="status"
                    className={`flex items-start gap-3 rounded-lg border p-3 ${alert.type === "error"
                        ? "border-bo-danger/20 bg-bo-danger-soft"
                        : "border-bo-success/20 bg-bo-success-soft"}`}
                >
                    <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-md text-white ${alert.type === "error" ? "bg-bo-danger" : "bg-bo-success"}`}
                    >
                        {alert.type === "error" ? (
                            <AlertCircle className="size-4" />
                        ) : (
                            <CheckCircle2 className="size-4" />
                        )}
                    </span>
                    <p
                        className={`pt-1 text-sm font-medium ${alert.type === "error" ? "text-bo-danger" : "text-bo-success"}`}
                    >
                        {alert.message}
                    </p>
                </div>
            )}

            {/* ── Table ── */}
            <TableShell
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
                    totalItems > 0 ? (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            {/* Page size */}
                            <div className="flex items-center gap-2">
                                <span className="whitespace-nowrap text-xs text-bo-muted">Hiển thị</span>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-8 w-[110px] justify-between border-bo-border bg-white px-2.5 text-xs font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                        >
                                            {pageSize} dòng
                                            <ChevronDown className="size-3.5 opacity-60" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="start"
                                        className="backoffice-user-menu z-50 w-[110px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                    >
                                        {[5,10,20, 50, 100].map(size => (
                                            <DropdownMenuItem
                                                key={size}
                                                onClick={() => handlePageSizeChange(size)}
                                                className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                            >
                                                {size} dòng
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Page info */}
                            <p className="text-xs text-bo-muted">
                                Hiển thị{" "}
                                <span className="font-semibold text-bo-foreground">
                                    {currentPage * pageSize + 1}
                                </span>
                                {" – "}
                                <span className="font-semibold text-bo-foreground">
                                    {Math.min((currentPage + 1) * pageSize, totalItems)}
                                </span>
                                {" trong tổng số "}
                                <span className="font-semibold text-bo-primary">{totalItems}</span> kết quả
                            </p>

                            {/* Navigation */}
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 0}
                                    className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                                >
                                    <ChevronLeft className="size-3.5" />
                                    Trước
                                </Button>

                                <div className="hidden items-center gap-1 sm:flex">
                                    {getPageItems(currentPage, totalPages).map((item) => (
                                        typeof item === "number" ? (
                                            <Button
                                                key={item}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePageChange(item)}
                                                aria-current={currentPage === item ? "page" : undefined}
                                                className={
                                                    currentPage === item
                                                        ? "h-8 border-bo-primary bg-bo-primary px-2.5 text-xs text-white hover:bg-bo-primary-hover"
                                                        : "h-8 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle"
                                                }
                                            >
                                                {item + 1}
                                            </Button>
                                        ) : (
                                            <span key={item} className="px-1 text-xs text-bo-muted" aria-hidden="true">
                                                …
                                            </span>
                                        )
                                    ))}
                                </div>

                                {/* Màn hình nhỏ ẩn dãy số trang -> hiện vị trí trang hiện tại */}
                                <span className="text-xs text-bo-muted sm:hidden">
                                    {currentPage + 1} / {totalPages}
                                </span>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage >= totalPages - 1}
                                    className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                                >
                                    Sau
                                    <ChevronRight className="size-3.5" />
                                </Button>
                            </div>
                        </div>
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
                        />
                    )
                ) : (
                    <div className="max-h-[520px] overflow-y-auto">
                        <table className="w-full min-w-[900px] text-sm">
                            <thead>
                                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                    <th className="h-10 w-14 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                        STT
                                    </th>
                                    <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                        Mã KH
                                    </th>
                                    <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                        Khách hàng
                                    </th>
                                    <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                        Loại KH
                                    </th>
                                    <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                        Liên hệ
                                    </th>
                                    <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                        Trạng thái
                                    </th>
                                    <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                        Thao tác
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-bo-border">
                                {khachHangs.map((khachHang, index) => (
                                    <tr
                                        key={khachHang.id}
                                        onClick={() => handleRowClick(khachHang)}
                                        className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
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
                                        <td className="px-3 py-3 text-center">
                                            {getLoaiKhachHangBadge(khachHang.loaiKhachHang)}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex flex-col gap-1 text-xs text-bo-muted">
                                                <div className="flex items-center gap-1.5">
                                                    <Phone className="size-3 shrink-0" /> {khachHang.soDienThoai || "-"}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Mail className="size-3 shrink-0" /> {khachHang.email || "-"}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <StatusBadge
                                                label={khachHang.trangThai === 1 ? "Hoạt động" : "Ngừng hoạt động"}
                                                tone={khachHang.trangThai === 1 ? "success" : "neutral"}
                                            />
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/customers/${khachHang.id}`);
                                                    }}
                                                    className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary"
                                                    title="Xem chi tiết"
                                                >
                                                    <Eye className="size-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteClick(khachHang);
                                                    }}
                                                    className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-danger hover:text-bo-danger"
                                                    title="Xóa"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </TableShell>

            {/* ── Create Dialog ── */}
            <Dialog
                open={showCreateDialog}
                onOpenChange={(open) => { if (!open) setShowCreateDialog(false); }}
            >
                <DialogContent className="max-h-[90vh] w-[95vw] overflow-hidden rounded-lg border border-bo-border bg-white p-0 text-bo-foreground shadow-lg sm:max-w-2xl">
                    <div className="border-b border-bo-border px-5 py-4">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-bo-foreground">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-bo-primary-soft">
                                    <UserPlus className="size-4 text-bo-primary" />
                                </span>
                                Thêm khách hàng mới
                            </DialogTitle>
                        </DialogHeader>
                        <p className="mt-1 text-sm text-bo-muted">
                            Điền thông tin để tạo khách hàng mới
                        </p>
                    </div>

                    <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
                        <div className="space-y-5">
                            {/* Thông tin cơ bản */}
                            <div className="space-y-3">
                                <p className="text-xs font-bold uppercase tracking-wide text-bo-primary">
                                    Thông tin cơ bản
                                </p>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {/* Mã khách hàng */}
                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="maKhachHang"
                                            className="text-xs font-semibold uppercase tracking-wide text-bo-muted"
                                        >
                                            Mã khách hàng *
                                        </Label>
                                        <Input
                                            id="maKhachHang"
                                            placeholder="VD: KH001"
                                            value={formData.maKhachHang}
                                            onChange={(e) => handleFormChange("maKhachHang", e.target.value)}
                                            aria-invalid={Boolean(formErrors.maKhachHang)}
                                            className={`h-10 bg-white text-bo-foreground placeholder:text-bo-muted focus-visible:ring-bo-primary/15 ${formErrors.maKhachHang
                                                ? "border-bo-danger focus-visible:border-bo-danger"
                                                : "border-bo-border focus-visible:border-bo-primary"}`}
                                        />
                                        {formErrors.maKhachHang && (
                                            <p className="flex items-center gap-1 text-xs text-bo-danger">
                                                <AlertCircle className="size-3" />{formErrors.maKhachHang}
                                            </p>
                                        )}
                                    </div>

                                    {/* Tên khách hàng */}
                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="tenKhachHang"
                                            className="text-xs font-semibold uppercase tracking-wide text-bo-muted"
                                        >
                                            Tên khách hàng *
                                        </Label>
                                        <Input
                                            id="tenKhachHang"
                                            placeholder="VD: Nguyễn Văn A"
                                            value={formData.tenKhachHang}
                                            onChange={(e) => handleFormChange("tenKhachHang", e.target.value)}
                                            aria-invalid={Boolean(formErrors.tenKhachHang)}
                                            className={`h-10 bg-white text-bo-foreground placeholder:text-bo-muted focus-visible:ring-bo-primary/15 ${formErrors.tenKhachHang
                                                ? "border-bo-danger focus-visible:border-bo-danger"
                                                : "border-bo-border focus-visible:border-bo-primary"}`}
                                        />
                                        {formErrors.tenKhachHang && (
                                            <p className="flex items-center gap-1 text-xs text-bo-danger">
                                                <AlertCircle className="size-3" />{formErrors.tenKhachHang}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {/* Người liên hệ */}
                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="nguoiLienHe"
                                            className="text-xs font-semibold uppercase tracking-wide text-bo-muted"
                                        >
                                            Người liên hệ
                                        </Label>
                                        <Input
                                            id="nguoiLienHe"
                                            placeholder="VD: Trần Thị B"
                                            value={formData.nguoiLienHe}
                                            onChange={(e) => handleFormChange("nguoiLienHe", e.target.value)}
                                            className="h-10 border-bo-border bg-white text-bo-foreground placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                                        />
                                    </div>

                                    {/* Loại khách hàng */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold uppercase tracking-wide text-bo-muted">
                                            Loại khách hàng
                                        </Label>
                                        <DropdownMenu modal={false}>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="flex h-10 w-full items-center justify-between rounded-md border border-bo-border bg-white px-3 text-left text-sm text-bo-foreground transition-colors hover:bg-bo-surface-subtle"
                                                >
                                                    <span>
                                                        {formData.loaiKhachHang === "le" && "Khách lẻ"}
                                                        {formData.loaiKhachHang === "si" && "Khách sỉ"}
                                                        {formData.loaiKhachHang === "doanh_nghiep" && "Doanh nghiệp"}
                                                    </span>
                                                    <ChevronDown className="size-4 shrink-0 text-bo-muted" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="start"
                                                className="backoffice-user-menu z-50 w-[--radix-dropdown-menu-trigger-width] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                            >
                                                {[
                                                    { value: "le", label: "Khách lẻ" },
                                                    { value: "si", label: "Khách sỉ" },
                                                    { value: "doanh_nghiep", label: "Doanh nghiệp" },
                                                ].map(opt => (
                                                    <DropdownMenuItem
                                                        key={opt.value}
                                                        onClick={() => handleFormChange("loaiKhachHang", opt.value)}
                                                        className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                                    >
                                                        {opt.label}
                                                        {formData.loaiKhachHang === opt.value && (
                                                            <Check className="size-4 text-bo-primary" />
                                                        )}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-bo-border" />

                            {/* Thông tin liên hệ */}
                            <div className="space-y-3">
                                <p className="text-xs font-bold uppercase tracking-wide text-bo-primary">
                                    Thông tin liên hệ
                                </p>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {/* Số điện thoại */}
                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="soDienThoai"
                                            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-bo-muted"
                                        >
                                            <Phone className="size-3.5" /> Số điện thoại
                                        </Label>
                                        <Input
                                            id="soDienThoai"
                                            value={formData.soDienThoai}
                                            onChange={(e) => handleFormChange("soDienThoai", sanitizePhoneInput(e.target.value))}
                                            maxLength={10}
                                            inputMode="numeric"
                                            aria-invalid={Boolean(phoneError)}
                                            className={`h-10 bg-white text-bo-foreground placeholder:text-bo-muted focus-visible:ring-bo-primary/15 ${phoneError
                                                ? "border-bo-danger focus-visible:border-bo-danger"
                                                : "border-bo-border focus-visible:border-bo-primary"}`}
                                        />
                                        {phoneError && (
                                            <p className="flex items-center gap-1 text-xs text-bo-danger">
                                                <AlertCircle className="size-3" />{phoneError}
                                            </p>
                                        )}
                                    </div>

                                    {/* Email */}
                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="email"
                                            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-bo-muted"
                                        >
                                            <Mail className="size-3.5" /> Email
                                        </Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="VD: example@email.com"
                                            value={formData.email}
                                            onChange={(e) => handleFormChange("email", e.target.value)}
                                            aria-invalid={Boolean(formErrors.email)}
                                            className={`h-10 bg-white text-bo-foreground placeholder:text-bo-muted focus-visible:ring-bo-primary/15 ${formErrors.email
                                                ? "border-bo-danger focus-visible:border-bo-danger"
                                                : "border-bo-border focus-visible:border-bo-primary"}`}
                                        />
                                        {formErrors.email && (
                                            <p className="flex items-center gap-1 text-xs text-bo-danger">
                                                <AlertCircle className="size-3" />{formErrors.email}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Địa chỉ */}
                                <div className="space-y-1.5">
                                    <Label
                                        htmlFor="diaChi"
                                        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-bo-muted"
                                    >
                                        <MapPin className="size-3.5" /> Địa chỉ
                                    </Label>
                                    <Input
                                        id="diaChi"
                                        placeholder="VD: 123 Đường ABC, Quận XYZ, TP. HCM"
                                        value={formData.diaChi}
                                        onChange={(e) => handleFormChange("diaChi", e.target.value)}
                                        className="h-10 border-bo-border bg-white text-bo-foreground placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {submitError && (
                        <div
                            role="alert"
                            className="mx-5 mb-3 flex items-start gap-2 rounded-md border border-bo-danger/20 bg-bo-danger-soft px-3 py-2 text-sm text-bo-danger"
                        >
                            <AlertCircle className="mt-0.5 size-4 shrink-0" />
                            <span>{submitError}</span>
                        </div>
                    )}

                    <DialogFooter className="flex flex-row justify-end gap-2 border-t border-bo-border bg-bo-surface-subtle px-5 py-3">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isSubmitting}
                            onClick={() => setShowCreateDialog(false)}
                            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            Hủy
                        </Button>
                        <Button
                            type="button"
                            disabled={isSubmitting}
                            onClick={handleCreateSubmit}
                            className="min-w-[160px] gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Đang xử lý...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="size-4" />
                                    Thêm khách hàng
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Dialog ── */}
            <ConfirmModal
                isOpen={showDeleteDialog}
                onClose={() => setShowDeleteDialog(false)}
                onConfirm={handleDeleteConfirm}
                title="Xác nhận xóa"
                description={
                    <>
                        Bạn có chắc chắn muốn xóa khách hàng{" "}
                        <span className="font-semibold text-bo-foreground">
                            {selectedKhachHang?.tenKhachHang}
                        </span>
                        ? Khách hàng sẽ được chuyển sang trạng thái &quot;Ngừng hoạt động&quot;.
                    </>
                }
                confirmText="Xóa"
                cancelText="Hủy"
                variant="danger"
            />
        </PageContainer>
    );
}
