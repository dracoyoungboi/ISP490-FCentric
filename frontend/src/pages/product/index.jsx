import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { productService } from "@/services/productService.js";
import { thuongHieuService } from "@/services/thuongHieuService.js";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { toast } from "@/lib/thongBaoNhanh";
import { Eye, Edit, Trash2, Package, Plus, ChevronDown, Check, Info, SearchX } from "lucide-react";
import { useToggle } from "@/hooks/useToggle";
import AddProductModal from "@/pages/product/components/product/AddProductModal";
import EditProductModal from "@/pages/product/components/product/EditProductModal";
import ConfirmModal from "@/components/ui/confirm-modal";
import { formatDate } from "@/utils/formatters";
import { dinhDangKhoangGia } from "@/pages/product/components/product/khoangGiaBienThe";

import PageContainer from "@/components/backoffice/PageContainer";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
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

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Tab trạng thái (bố cục A+G): mã tab nằm trên URL ?trangThai=, `trangThai` là giá trị gửi API.
// "Hết hàng" ở đây = hết trên mọi kho (backend tự tính lại 1/0 theo tồn kho các biến thể),
// khác "Hết hàng" theo từng kho ở Báo cáo tồn kho → có chú thích khi rê chuột.
const STATUS_TABS = [
    { value: "tat-ca", label: "Tất cả", trangThai: "ALL" },
    { value: "con-hang", label: "Còn hàng", trangThai: "1" },
    { value: "het-hang", label: "Hết hàng", trangThai: "0", hint: "Hết hàng ở mọi kho" },
    { value: "ngung-hoat-dong", label: "Ngừng hoạt động", trangThai: "2" },
];
const STATUS_TAB_VALUES = STATUS_TABS.map((tab) => tab.value);
const TAB_MAC_DINH = "tat-ca";
const trangThaiCuaTab = (ma) => STATUS_TABS.find((tab) => tab.value === ma)?.trangThai ?? "ALL";

const SEARCH_DEBOUNCE_MS = 500;
const LOAD_ERROR_MESSAGE = "Không thể tải danh sách sản phẩm. Vui lòng thử lại.";

// Bộ lọc ngoài tab trạng thái (trạng thái lấy từ URL).
const DEFAULT_FILTERS = {
    keyword: "",
    danhMuc: "ALL",
    thuongHieu: "ALL",
    giaTu: "",
    giaDen: "",
    page: 0,
    size: SO_DONG_MAC_DINH,
};
const EMPTY_DRAFT = { keyword: "", giaTu: "", giaDen: "" };

function buildProductFilterPayload(filters) {
    // Chuan hoa bo loc tu UI -> payload backend filter API.
    // Payload nay duoc ProductController.filter nhan vao de xu ly phan trang + dieu kien tim kiem.
    const filterList = [];

    if (filters.keyword?.trim()) {
        ["tenSanPham", "moTa"].forEach((field) => {
            filterList.push({
                fieldName: field,
                operation: "ILIKE",
                value: filters.keyword.trim(),
                logicType: "OR",
            });
        });
    }

    if (filters.danhMuc && filters.danhMuc !== "ALL") {
        filterList.push({
            fieldName: "danhMuc.id",
            operation: "EQUALS",
            value: Number(filters.danhMuc),
            logicType: "AND",
        });
    }

    if (filters.thuongHieu && filters.thuongHieu !== "ALL") {
        filterList.push({
            fieldName: "thuongHieu.id",
            operation: "EQUALS",
            value: Number(filters.thuongHieu),
            logicType: "AND",
        });
    }

    if (filters.trangThai && filters.trangThai !== "ALL") {
        filterList.push({
            fieldName: "trangThai",
            operation: "EQUALS",
            value: Number(filters.trangThai),
            logicType: "AND",
        });
    }

    // Khoảng giá: trường lọc ảo của backend — sản phẩm có ít nhất một biến thể đang bán
    // (trangThai = 1) có giá bán thỏa điều kiện. Không dùng giaBanMacDinh (sản phẩm hết hàng = 0).
    if (filters.giaTu && filters.giaTu !== "") {
        filterList.push({
            fieldName: "giaBanBienThe",
            operation: "GREATER_THAN_OR_EQUAL",
            value: Number(filters.giaTu),
            logicType: "AND",
        });
    }

    if (filters.giaDen && filters.giaDen !== "") {
        filterList.push({
            fieldName: "giaBanBienThe",
            operation: "LESS_THAN_OR_EQUAL",
            value: Number(filters.giaDen),
            logicType: "AND",
        });
    }

    return {
        page: filters.page,
        size: filters.size,
        filters: filterList,
        sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
    };
}

// Nhãn tab kèm chú thích khi rê chuột (StatusTabs hiện `label` nguyên trạng nên truyền được phần tử).
function TabLabel({ label, hint }) {
    if (!hint) return label;
    return (
        <span title={hint} className="inline-flex items-center gap-1">
            {label}
            <Info className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="sr-only">({hint.toLowerCase()})</span>
        </span>
    );
}

export default function ProductList() {
    // Du lieu danh sach hien thi tren bang Quan ly san pham.
    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const requestIdRef = useRef(0);

    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    // Ô từ khóa / khoảng giá đổi ngay khi gõ; chỉ áp vào `filters` (gọi API, đếm tab) khi ngừng gõ.
    const [draft, setDraft] = useState(EMPTY_DRAFT);

    // Tab trạng thái trên URL ?trangThai= (F5 / quay lại từ trang chi tiết vẫn đúng tab)
    const [tab, setTab] = useTabTrenUrl(STATUS_TAB_VALUES, TAB_MAC_DINH);
    const trangThai = trangThaiCuaTab(tab);

    // Danh sách thương hiệu cho bộ lọc (nạp 1 lần)
    const [brands, setBrands] = useState([]);

    const location = useLocation();
    const toastShownRef = useRef(false);
    const navigate = useNavigate();

    const [isAddModalOpen, openAddModal, closeAddModal] = useToggle(false);
    const [isEditModalOpen, openEditModal, closeEditModal] = useToggle(false);
    const [isConfirmOpen, openConfirm, closeConfirm] = useToggle(false);

    const [productToDelete, setProductToDelete] = useState(null);
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Nạp danh sách thương hiệu cho bộ lọc (lỗi thì bỏ qua, không chặn màn danh sách)
    useEffect(() => {
        let cancelled = false;
        thuongHieuService.getAll()
            .then((res) => { if (!cancelled) setBrands(res?.data ?? []); })
            .catch(() => { /* ignore */ });
        return () => { cancelled = true; };
    }, []);

    // silent: tải lại ngầm khi quay lại tab — giữ bảng đang xem, lỗi chỉ ghi log
    const fetchProducts = useCallback(async ({ silent = false } = {}) => {
        // Đổi tab / bộ lọc / trang liên tiếp có thể chạy nhiều yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
        const requestId = ++requestIdRef.current;
        if (!silent) {
            setIsLoading(true);
            setLoadError(null);
        }
        try {
            // [User thao tac bo loc/tim kiem]
            // -> buildProductFilterPayload
            // -> productService.filterProducts
            // -> ProductController.filter -> ProductService.filter -> ProductRepository
            const payload = buildProductFilterPayload({ ...filters, trangThai });
            const res = await productService.filterProducts(payload);
            if (requestId !== requestIdRef.current) return;
            const serverResponse = res.data;
            if (serverResponse?.status !== 200) {
                throw new Error(serverResponse?.message || LOAD_ERROR_MESSAGE);
            }
            const pageData = serverResponse.data ?? {};
            const content = pageData.content || [];
            const totalElements = pageData.totalElements || 0;

            // Trang đang xem vượt quá số trang (vd. vừa xóa dòng cuối của trang cuối) → lùi về trang cuối có dữ liệu
            if (content.length === 0 && totalElements > 0 && filters.page > 0) {
                const lastPage = Math.max(Math.ceil(totalElements / filters.size) - 1, 0);
                setFilters((prev) => ({ ...prev, page: lastPage }));
                return; // vẫn đang tải: lần gọi cho trang cuối sẽ tắt loading
            }

            const statusOrder = { 1: 0, 0: 1, 2: 2 };
            const sortedContent = [...content].sort((a, b) => {
                const orderA = statusOrder[a?.trangThai] ?? 99;
                const orderB = statusOrder[b?.trangThai] ?? 99;
                return orderA - orderB;
            });
            setProducts(sortedContent);
            setTotal(totalElements);
            setLoadError(null);
            setIsLoading(false);
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            console.error("Lỗi khi tải sản phẩm:", error.response?.data || error.message);
            if (silent) {
                // Giữ bảng; tắt vòng tải phòng khi lần tải ngầm này đã thay một lần tải thường đang chạy
                setIsLoading(false);
                return;
            }
            toast.error("Không thể tải danh sách sản phẩm");
            // Không giữ dòng + tổng số của lần tải trước (R9)
            setProducts([]);
            setTotal(0);
            setLoadError(error?.response?.data?.message || LOAD_ERROR_MESSAGE);
            setIsLoading(false);
        }
    }, [filters, trangThai]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn tải lại ngay mỗi khi bộ lọc / tab / trang đổi.
    useEffect(() => {
        queueMicrotask(() => fetchProducts());
    }, [fetchProducts]);

    // ── Số trên tab: cùng từ khóa, danh mục, thương hiệu, khoảng giá; chỉ thay trạng thái (R1) ──
    const { counts: soTheoTab, reload: taiLaiSoTab } = useDemTheoTrangThai(
        STATUS_TAB_VALUES,
        async (ma) => {
            const res = await productService.filterProducts(
                buildProductFilterPayload({ ...filters, trangThai: trangThaiCuaTab(ma), page: 0, size: 1 })
            );
            if (res.data?.status !== 200) throw new Error(res.data?.message || LOAD_ERROR_MESSAGE);
            return res.data?.data?.totalElements ?? 0;
        },
        `${filters.keyword.trim()}|${filters.danhMuc}|${filters.thuongHieu}|${filters.giaTu}|${filters.giaDen}`
    );

    // Quay lại tab thì tải lại ngầm danh sách + số trên tab
    useTaiLaiKhiQuayLai(() => {
        taiLaiSoTab();
        fetchProducts({ silent: true });
    }, { bat: !isLoading });

    // ── Debounce ô từ khóa + khoảng giá: không gọi API ở mỗi lần gõ phím ──
    useEffect(() => {
        const timer = setTimeout(() => {
            setFilters((prev) =>
                prev.keyword === draft.keyword && prev.giaTu === draft.giaTu && prev.giaDen === draft.giaDen
                    ? prev
                    : { ...prev, ...draft, page: 0 }
            );
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [draft]);

    useEffect(() => {
        if (!location.state?.success || toastShownRef.current) return;
        toastShownRef.current = true;
        toast.success(location.state.message || "Thao tác thành công");
        // Xóa state nhưng giữ tham số URL (tab đang chọn)
        navigate({ pathname: location.pathname, search: location.search }, { replace: true });
    }, [location.state, navigate, location.pathname, location.search]);

    // Bộ lọc ngoài tab trạng thái (nút "Xóa lọc" chỉ xóa các bộ lọc này, giữ tab đang chọn).
    const hasActiveFilters =
        Boolean(draft.keyword.trim() || draft.giaTu || draft.giaDen) ||
        filters.thuongHieu !== "ALL" ||
        filters.danhMuc !== "ALL";

    const clearFilters = useCallback(() => {
        setDraft(EMPTY_DRAFT);
        setFilters((prev) => ({ ...DEFAULT_FILTERS, size: prev.size }));
    }, []);

    // Đổi tab: ghi lên URL và về trang đầu
    const changeTab = useCallback((value) => {
        setTab(value);
        setFilters((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
    }, [setTab]);

    const handleDeleteClick = useCallback((product) => {
        // Mo modal xac nhan xoa mem san pham.
        setProductToDelete(product);
        openConfirm();
    }, [openConfirm]);

    const handleConfirmDelete = useCallback(async () => {
        if (!productToDelete) return;
        try {
            setIsDeleting(true);
            // Luong xoa mem:
            // Frontend -> productService.deleteProduct
            // -> ProductController.softDelete -> ProductService.softDelete -> Repository.save(status)
            // -> reload lai danh sach va so tren tab o frontend (R8).
            await productService.deleteProduct(productToDelete.id);
            toast.success("Xóa sản phẩm thành công");
            closeConfirm();
            setProductToDelete(null);
            fetchProducts();
            taiLaiSoTab();
        } catch (error) {
            console.error("Lỗi khi xóa sản phẩm:", error);
            toast.error(error.response?.data?.message || "Có lỗi xảy ra khi xóa sản phẩm");
        } finally {
            setIsDeleting(false);
        }
    }, [productToDelete, closeConfirm, fetchProducts, taiLaiSoTab]);

    const handleCancelDelete = useCallback(() => {
        if (!isDeleting) { setProductToDelete(null); closeConfirm(); }
    }, [isDeleting, closeConfirm]);

    const updateFilter = useCallback((field, value, resetPage = true) => {
        // Dong bo gia tri bo loc, mac dinh quay ve trang dau khi bo loc thay doi.
        setFilters(prev => ({ ...prev, [field]: value, ...(resetPage && { page: 0 }) }));
    }, []);

    const updateDraft = useCallback((field) => (e) => {
        const value = e.target.value;
        setDraft((prev) => ({ ...prev, [field]: value }));
    }, []);

    // Sau khi Them/Sua thanh cong, refresh lai danh sach va so tren tab de UI phan anh du lieu moi nhat.
    const handleModalSuccess = useCallback(() => { fetchProducts(); taiLaiSoTab(); }, [fetchProducts, taiLaiSoTab]);

    // Số chỉ hiện khi đã đếm xong và danh sách không lỗi (R9); số 0 tự ẩn trong StatusTabs.
    const statusTabs = STATUS_TABS.map((t) => ({
        value: t.value,
        label: <TabLabel label={t.label} hint={t.hint} />,
        count: loadError ? null : soTheoTab[t.value],
    }));
    const emptyTabLabel = STATUS_TABS.find((t) => t.value === tab)?.label;

    return (
        <PageContainer fill className="space-y-4">
            <ListPageHeader
                actions={
                    <Button
                        onClick={openAddModal}
                        className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                    >
                        <Plus className="h-4 w-4" />
                        Thêm sản phẩm
                    </Button>
                }
            />

            {/* ══ BẢNG: tab trạng thái + tìm kiếm + thương hiệu + khoảng giá cùng một hàng ══ */}
            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label="Lọc sản phẩm theo trạng thái"
                                tabs={statusTabs}
                                value={tab}
                                onChange={changeTab}
                            />
                        }
                        hasFilter={hasActiveFilters}
                        onClear={clearFilters}
                    >
                        <SearchInput
                            label="Tìm sản phẩm"
                            placeholder="Tìm theo tên, mô tả sản phẩm..."
                            value={draft.keyword}
                            onChange={updateDraft("keyword")}
                            onClear={() => {
                                setDraft((prev) => ({ ...prev, keyword: "" }));
                                updateFilter("keyword", "");
                            }}
                            className="sm:w-[300px]"
                        />

                        {/* Thương hiệu */}
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    aria-label="Lọc theo thương hiệu"
                                    className="h-9 w-full justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle sm:w-[190px]"
                                >
                                    <span className="truncate">
                                        {filters.thuongHieu === "ALL"
                                            ? "Tất cả thương hiệu"
                                            : brands.find((b) => b.id === Number(filters.thuongHieu))?.tenThuongHieu ?? "Thương hiệu"}
                                    </span>
                                    <ChevronDown className="size-4 shrink-0 opacity-60" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="z-50 max-h-[400px] w-[220px] overflow-y-auto rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                            >
                                <DropdownMenuItem
                                    onClick={() => updateFilter("thuongHieu", "ALL")}
                                    className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                >
                                    Tất cả thương hiệu
                                    {filters.thuongHieu === "ALL" && <Check className="h-4 w-4" />}
                                </DropdownMenuItem>
                                {brands.map((brand) => (
                                    <DropdownMenuItem
                                        key={brand.id}
                                        onClick={() => updateFilter("thuongHieu", String(brand.id))}
                                        className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                    >
                                        <span className="min-w-0 truncate">
                                            {brand.tenThuongHieu}
                                            {Number(brand.trangThai) !== 1 && (
                                                <span className="ml-2 text-xs text-bo-muted">(Ngừng)</span>
                                            )}
                                        </span>
                                        {filters.thuongHieu === String(brand.id) && <Check className="h-4 w-4 shrink-0" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Khoảng giá bán */}
                        <div className="flex w-full items-center gap-2 sm:w-auto">
                            <Input
                                type="number"
                                value={draft.giaTu}
                                onChange={updateDraft("giaTu")}
                                placeholder="Giá từ"
                                aria-label="Giá từ"
                                min="0"
                                className="h-9 min-w-0 flex-1 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20 sm:w-28 sm:flex-none"
                            />
                            <Input
                                type="number"
                                value={draft.giaDen}
                                onChange={updateDraft("giaDen")}
                                placeholder="Giá đến"
                                aria-label="Giá đến"
                                min="0"
                                className="h-9 min-w-0 flex-1 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20 sm:w-28 sm:flex-none"
                            />
                        </div>
                    </ListToolbar>
                }
                footer={
                    !isLoading && !loadError && total > 0 ? (
                        <TablePagination
                            page={filters.page}
                            size={filters.size}
                            total={total}
                            onPageChange={(page) => updateFilter("page", page, false)}
                            onSizeChange={(size) => updateFilter("size", Number(size))}
                        />
                    ) : null
                }
            >
                {isLoading ? (
                    <LoadingState label="Đang tải danh sách sản phẩm" />
                ) : loadError ? (
                    <ErrorState
                        description={loadError}
                        onRetry={() => {
                            fetchProducts();
                            taiLaiSoTab();
                        }}
                    />
                ) : products.length === 0 ? (
                    hasActiveFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy sản phẩm phù hợp"
                            description="Thử đổi từ khóa, thương hiệu hoặc khoảng giá."
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
                            title={`Không có sản phẩm nào ở trạng thái "${emptyTabLabel}"`}
                            description="Chọn tab Tất cả để xem mọi sản phẩm."
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
                            title="Chưa có sản phẩm"
                            description="Thêm sản phẩm để quản lý biến thể, giá bán và tồn kho."
                        />
                    )
                ) : (
                    /* Bảng dữ liệu: khung giãn hết màn, thân bảng tự cuộn, tiêu đề cột đứng yên */
                    <table className="w-full min-w-[1100px] text-sm">
                        <thead className="sticky top-0 z-10">
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th className="h-10 px-3 text-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                STT
                            </th>
                            <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                Hình ảnh
                            </th>
                            <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                Tên sản phẩm
                            </th>
                            <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                Thương hiệu
                            </th>
                            <th className="h-10 px-3 text-right whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                Giá bán
                            </th>
                            <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                Trạng thái
                            </th>
                            <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                Ngày tạo
                            </th>
                            <th className="h-10 px-3 text-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                Thao tác
                            </th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                        {products.map((product, index) => {
                            // Giá theo biến thể đang bán: một giá "980.000 ₫", khác giá "450.000 ₫ – 980.000 ₫"
                            const giaBan = dinhDangKhoangGia(product.bienTheSanPhams, "giaBan");
                            return (
                            <tr
                                key={product.id}
                                className="transition-colors hover:bg-bo-surface-subtle"
                            >
                                {/* STT */}
                                <td className="px-3 py-3 text-center text-xs text-bo-muted">
                                    {filters.page * filters.size + index + 1}
                                </td>

                                {/* Hình ảnh */}
                                <td className="px-3 py-3">
                                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-bo-border bg-slate-100">
                                        {product.anhQuanAos?.[0]?.tepTin?.duongDan ? (
                                            <img
                                                src={product.anhQuanAos[0].tepTin.duongDan}
                                                alt={product.tenSanPham}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <Package className="h-5 w-5 text-slate-300" />
                                        )}
                                    </div>
                                </td>

                                {/* Tên sản phẩm */}
                                <td className="max-w-[260px] px-3 py-3">
                                    <Link
                                        to={`/products/${product.id}`}
                                        title={product.tenSanPham}
                                        className="block w-full truncate text-left font-semibold leading-snug text-bo-foreground hover:underline"
                                    >
                                        {product.tenSanPham}
                                    </Link>
                                    {product.moTa && (
                                        <p className="mt-0.5 line-clamp-1 text-xs text-bo-muted">
                                            {product.moTa}
                                        </p>
                                    )}
                                </td>

                                {/* Thương hiệu */}
                                <td className="max-w-[180px] px-3 py-3">
                                    {product.thuongHieu?.tenThuongHieu ? (
                                        <span className="block truncate text-slate-700" title={product.thuongHieu.tenThuongHieu}>
                                            {product.thuongHieu.tenThuongHieu}
                                        </span>
                                    ) : (
                                        <span className="text-xs italic text-bo-muted">Chưa xác định</span>
                                    )}
                                </td>

                                {/* Giá bán (biến thể đang bán) */}
                                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                                    {giaBan ? (
                                        <span className="text-bo-foreground">{giaBan}</span>
                                    ) : (
                                        <span className="text-bo-muted">—</span>
                                    )}
                                </td>

                                {/* Trạng thái */}
                                <td className="px-3 py-3">
                                    {product.trangThai === 1 ? (
                                        <StatusBadge label="Còn hàng" />
                                    ) : product.trangThai === 0 ? (
                                        <StatusBadge label="Hết hàng" />
                                    ) : (
                                        <StatusBadge label="Ngừng hoạt động" />
                                    )}
                                </td>

                                {/* Ngày tạo */}
                                <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums text-bo-muted">
                                    {formatDate(product.ngayTao)}
                                </td>

                                {/* Thao tác */}
                                <td className="px-3 py-3">
                                    <RowActions>
                                        <RowActionButton
                                            icon={Eye}
                                            label="Xem chi tiết"
                                            onClick={() => navigate(`/products/${product.id}`)}
                                        />
                                        <RowActionButton
                                            icon={Edit}
                                            label="Chỉnh sửa"
                                            onClick={() => { setSelectedProductId(product.id); openEditModal(); }}
                                        />
                                        <RowActionButton
                                            icon={Trash2}
                                            label="Xóa sản phẩm"
                                            tone="danger"
                                            onClick={() => handleDeleteClick(product)}
                                        />
                                    </RowActions>
                                </td>
                            </tr>
                            );
                        })}
                        </tbody>
                    </table>
                )}
            </TableShell>

            {/* ══ MODALS & DRAWER ══════════════════════════════════════════════════ */}
            <AddProductModal
                isOpen={isAddModalOpen}
                onClose={closeAddModal}
                onSuccess={handleModalSuccess}
            />

            <EditProductModal
                isOpen={isEditModalOpen}
                onClose={() => { setSelectedProductId(null); closeEditModal(); }}
                onSuccess={handleModalSuccess}
                productId={selectedProductId}
            />

            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
                title="Xác nhận xóa sản phẩm"
                description={
                    productToDelete
                        ? `Bạn có chắc chắn muốn xóa sản phẩm "${productToDelete.tenSanPham}"? Hành động này không thể hoàn tác.`
                        : "Bạn có chắc chắn muốn xóa sản phẩm này?"
                }
                confirmText="Xóa"
                cancelText="Hủy"
                variant="danger"
                isLoading={isDeleting}
            />

        </PageContainer>
    );
}
