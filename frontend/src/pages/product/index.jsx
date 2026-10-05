import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { productService } from "@/services/productService.js";
import { thuongHieuService } from "@/services/thuongHieuService.js";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Eye, Edit, Trash2, RefreshCcw, Package, Plus, CheckCircle2, XCircle, ShoppingBag, ChevronDown, ChevronLeft, ChevronRight, Check, Filter, Tag } from "lucide-react";
import { useToggle } from "@/hooks/useToggle";
import AddProductModal from "@/pages/product/components/product/AddProductModal";
import EditProductModal from "@/pages/product/components/product/EditProductModal";
import ProductModal from "@/pages/product/components/product/ProductModal";
import ConfirmModal from "@/components/ui/confirm-modal";
import { formatCurrency, formatDate } from "@/utils/formatters";
import InventoryDrawer from "@/pages/product/components/product/InventoryDrawer";

import PageContainer from "@/components/backoffice/PageContainer";
import FilterBar from "@/components/shared/FilterBar";
import SearchInput from "@/components/shared/SearchInput";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

    if (filters.giaTu && filters.giaTu !== "") {
        filterList.push({
            fieldName: "giaBanMacDinh",
            operation: "GREATER_THAN_OR_EQUAL",
            value: Number(filters.giaTu),
            logicType: "AND",
        });
    }

    if (filters.giaDen && filters.giaDen !== "") {
        filterList.push({
            fieldName: "giaBanMacDinh",
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

export default function ProductList() {
    // Du lieu danh sach hien thi tren bang Quan ly san pham.
    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const [filters, setFilters] = useState({
        keyword: "",
        danhMuc: "ALL",
        thuongHieu: "ALL",
        trangThai: "ALL",
        giaTu: "",
        giaDen: "",
        page: 0,
        size: 10,
    });

    // Danh sách thương hiệu cho bộ lọc (nạp 1 lần)
    const [brands, setBrands] = useState([]);

    const location = useLocation();
    const toastShownRef = useRef(false);
    const navigate = useNavigate();
    const searchTimeoutRef = useRef(null);

    const [isAddModalOpen, openAddModal, closeAddModal] = useToggle(false);
    const [isEditModalOpen, openEditModal, closeEditModal] = useToggle(false);
    const [isViewModalOpen, , closeViewModal] = useToggle(false);
    const [isConfirmOpen, openConfirm, closeConfirm] = useToggle(false);

    // ── State mới: Inventory Drawer ──────────────────────────────────────────
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [selectedInventoryProduct, setSelectedInventoryProduct] = useState(null);

    const [productToDelete, setProductToDelete] = useState(null);
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const STATUS_OPTIONS = useMemo(() => [
        { value: "ALL", label: "Tất cả trạng thái" },
        { value: "1", label: "Còn hàng" },
        { value: "0", label: "Hết hàng" },
        { value: "2", label: "Ngừng hoạt động" },
    ], []);

    // ── Global stats: đếm toàn bộ không phụ thuộc trang ─────────────────────
    const [globalStats, setGlobalStats] = useState({ conHang: 0, hetHang: 0, ngungHoatDong: 0 });

    const fetchGlobalStats = useCallback(async () => {
        // Luong thong ke tong quan:
        // Frontend goi 3 lan filterProducts theo trangThai -> backend filter/page query -> lay totalElements.
        try {
            const makePayload = (trangThai) => ({
                page: 0,
                size: 1,
                filters: [{ fieldName: "trangThai", operation: "EQUALS", value: trangThai, logicType: "AND" }],
                sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
            });
            const [r1, r0, r2] = await Promise.all([
                productService.filterProducts(makePayload(1)),
                productService.filterProducts(makePayload(0)),
                productService.filterProducts(makePayload(2)),
            ]);
            setGlobalStats({
                conHang:        r1.data?.data?.totalElements ?? 0,
                hetHang:        r0.data?.data?.totalElements ?? 0,
                ngungHoatDong:  r2.data?.data?.totalElements ?? 0,
            });
        } catch {
            // ignore stats error silently
        }
    }, []);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect).
    useEffect(() => { queueMicrotask(() => fetchGlobalStats()); }, [fetchGlobalStats]);

    // Nạp danh sách thương hiệu cho bộ lọc (lỗi thì bỏ qua, không chặn màn danh sách)
    useEffect(() => {
        let cancelled = false;
        thuongHieuService.getAll()
            .then((res) => { if (!cancelled) setBrands(res?.data ?? []); })
            .catch(() => { /* ignore */ });
        return () => { cancelled = true; };
    }, []);

    const fetchProducts = useCallback(async () => {
        try {
            setIsLoading(true);
            // [User thao tac bo loc/tim kiem]
            // -> buildProductFilterPayload
            // -> productService.filterProducts
            // -> ProductController.filter -> ProductService.filter -> ProductRepository
            const payload = buildProductFilterPayload(filters);
            const res = await productService.filterProducts(payload);
            const serverResponse = res.data;
            if (serverResponse?.status === 200) {
                const pageData = serverResponse.data;
                const statusOrder = { 1: 0, 0: 1, 2: 2 };
                const sortedContent = [...(pageData.content || [])].sort((a, b) => {
                    const orderA = statusOrder[a?.trangThai] ?? 99;
                    const orderB = statusOrder[b?.trangThai] ?? 99;
                    return orderA - orderB;
                });
                setProducts(sortedContent);
                setTotal(pageData.totalElements || 0);
            }
        } catch (error) {
            console.error("Lỗi khi tải sản phẩm:", error.response?.data || error.message);
            toast.error("Không thể tải danh sách sản phẩm");
            setProducts([]);
            setTotal(0);
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        // Debounce keyword tim kiem de tranh goi API lien tuc khi user dang go phim.
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(fetchProducts, filters.keyword ? 500 : 0);
        return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
    }, [filters, fetchProducts]);

    useEffect(() => {
        if (!location.state?.success || toastShownRef.current) return;
        toastShownRef.current = true;
        toast.success(location.state.message || "Thao tác thành công");
        navigate(location.pathname, { replace: true });
    }, [location.state, navigate, location.pathname]);

    const handleReset = useCallback(() => {
        setFilters({ keyword: "", danhMuc: "ALL", thuongHieu: "ALL", trangThai: "ALL", giaTu: "", giaDen: "", page: 0, size: 10 });
    }, []);

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
            // -> reload lai danh sach o frontend.
            await productService.deleteProduct(productToDelete.id);
            toast.success("Xóa sản phẩm thành công");
            closeConfirm();
            setProductToDelete(null);
            fetchProducts();
        } catch (error) {
            console.error("Lỗi khi xóa sản phẩm:", error);
            toast.error(error.response?.data?.message || "Có lỗi xảy ra khi xóa sản phẩm");
        } finally {
            setIsDeleting(false);
        }
    }, [productToDelete, closeConfirm, fetchProducts]);

    const handleCancelDelete = useCallback(() => {
        if (!isDeleting) { setProductToDelete(null); closeConfirm(); }
    }, [isDeleting, closeConfirm]);

    const updateFilter = useCallback((field, value, resetPage = true) => {
        // Dong bo gia tri bo loc, mac dinh quay ve trang dau khi bo loc thay doi.
        const actualValue = value?.target ? value.target.value : value;
        setFilters(prev => ({ ...prev, [field]: actualValue, ...(resetPage && { page: 0 }) }));
    }, []);

    const handleFilterChange = useMemo(() => ({
        keyword:  (e) => updateFilter("keyword", e),
        giaTu:    (e) => updateFilter("giaTu", e),
        giaDen:   (e) => updateFilter("giaDen", e),
        danhMuc:  (v) => updateFilter("danhMuc", v),
        thuongHieu: (v) => updateFilter("thuongHieu", v),
        trangThai:(v) => updateFilter("trangThai", v),
        size:     (v) => updateFilter("size", Number(v)),
        page:     (v) => updateFilter("page", v, false),
    }), [updateFilter]);

    const handleModalSuccess = useCallback(() => { fetchProducts(); fetchGlobalStats(); }, [fetchProducts, fetchGlobalStats]);
    // Sau khi Them/Sua thanh cong, refresh lai danh sach va thong ke de UI phan anh du lieu moi nhat.

    // ── Handlers Inventory Drawer ────────────────────────────────────────────
    const handleOpenInventory = useCallback((product) => {
        setSelectedInventoryProduct(product);
        setIsInventoryOpen(true);
    }, []);

    const handleCloseInventory = useCallback(() => {
        setIsInventoryOpen(false);
        setSelectedInventoryProduct(null);
    }, []);

    const totalPages = Math.max(1, Math.ceil(total / filters.size));

    return (
        <PageContainer className="space-y-5">
            {/* ══ STATS ════════════════════════════════════════════════════════ */}
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
                    <div>
                        <p className="text-xs font-medium text-bo-muted">Tổng sản phẩm</p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{total}</p>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft text-bo-primary">
                        <Package className="size-5" />
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
                    <div>
                        <p className="text-xs font-medium text-bo-muted">Còn hàng</p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{globalStats.conHang}</p>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-success-soft text-bo-success">
                        <CheckCircle2 className="size-5" />
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
                    <div>
                        <p className="text-xs font-medium text-bo-muted">Hết hàng</p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{globalStats.hetHang}</p>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-danger-soft text-bo-danger">
                        <XCircle className="size-5" />
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
                    <div>
                        <p className="text-xs font-medium text-bo-muted">Ngừng hoạt động</p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{globalStats.ngungHoatDong}</p>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <ShoppingBag className="size-5" />
                    </span>
                </div>
            </section>

            {/* ══ BỘ LỌC TÌM KIẾM ═════════════════════════════════════════════ */}
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
                            placeholder="Tìm theo tên, mô tả sản phẩm..."
                            value={filters.keyword}
                            onChange={handleFilterChange.keyword}
                            disabled={isLoading}
                        />
                    }
                    filters={
                        <>
                            {/* Trạng thái */}
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-9 max-w-[200px] justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                    >
                                        <span className="truncate">
                                            {filters.trangThai === "ALL" && "Tất cả trạng thái"}
                                            {filters.trangThai === "1"   && "Còn hàng"}
                                            {filters.trangThai === "0"   && "Hết hàng"}
                                            {filters.trangThai === "2"   && "Ngừng hoạt động"}
                                        </span>
                                        <ChevronDown className="size-4 shrink-0 opacity-70" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="backoffice-user-menu z-50 w-[200px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                >
                                    {STATUS_OPTIONS.map((s) => (
                                        <DropdownMenuItem
                                            key={s.value}
                                            /*[User chọn trạng thái trên bộ lọc*/
                                            onClick={() => handleFilterChange.trangThai(s.value)}
                                            className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            {s.label}
                                            {filters.trangThai === s.value && <Check className="h-4 w-4" />}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Thương hiệu */}
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-9 max-w-[200px] justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                    >
                                        <span className="truncate">
                                            {filters.thuongHieu === "ALL"
                                                ? "Tất cả thương hiệu"
                                                : brands.find((b) => b.id === Number(filters.thuongHieu))?.tenThuongHieu ?? "Thương hiệu"}
                                        </span>
                                        <ChevronDown className="size-4 shrink-0 opacity-70" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="backoffice-user-menu z-50 w-[200px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                >
                                    <DropdownMenuItem
                                        onClick={() => handleFilterChange.thuongHieu("ALL")}
                                        className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                    >
                                        Tất cả thương hiệu
                                        {filters.thuongHieu === "ALL" && <Check className="h-4 w-4" />}
                                    </DropdownMenuItem>
                                    {brands.map((brand) => (
                                        <DropdownMenuItem
                                            key={brand.id}
                                            onClick={() => handleFilterChange.thuongHieu(String(brand.id))}
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

                            {/* Giá từ */}
                            <Input
                                type="number"
                                value={filters.giaTu}
                                onChange={handleFilterChange.giaTu}
                                placeholder="Giá từ"
                                aria-label="Giá từ"
                                min="0"
                                className="h-9 w-28 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
                                disabled={isLoading}
                            />

                            {/* Giá đến */}
                            <Input
                                type="number"
                                value={filters.giaDen}
                                onChange={handleFilterChange.giaDen}
                                placeholder="Giá đến"
                                aria-label="Giá đến"
                                min="0"
                                className="h-9 w-28 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
                                disabled={isLoading}
                            />

                            {/* Đặt lại */}
                            <Button
                                variant="outline"
                                onClick={handleReset}
                                disabled={isLoading}
                                className="flex h-9 items-center gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                <RefreshCcw className="h-4 w-4" />
                                Đặt lại
                            </Button>
                        </>
                    }
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
            </div>

            {/* ══ TABLE / LOADING / EMPTY ══════════════════════════════════════ */}
            {isLoading ? (
                <div className="flex items-center justify-center rounded-lg border border-bo-border bg-white py-12 shadow-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-bo-primary" />
                    <span className="ml-3 text-sm text-bo-muted">Đang tải danh sách sản phẩm...</span>
                </div>
            ) : products.length === 0 ? (
                <div className="rounded-lg border border-bo-border bg-white shadow-sm">
                    <EmptyState
                        icon={Package}
                        title="Không tìm thấy sản phẩm"
                        description="Hiện tại chưa có dữ liệu sản phẩm phù hợp. Hãy thử thay đổi bộ lọc hoặc từ khoá tìm kiếm để xem kết quả khác."
                    />
                </div>
            ) : (
                <TableShell
                    footer={
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            {/* Số dòng hiển thị */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-bo-muted">Hiển thị:</span>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-8 w-[120px] justify-between border-bo-border bg-white px-2.5 text-xs font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                        >
                                            {filters.size} dòng
                                            <ChevronDown className="size-3.5 opacity-60" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="start"
                                        className="backoffice-user-menu z-50 w-[120px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                    >
                                        {[5, 10, 20, 50, 100].map(size => (
                                            <DropdownMenuItem
                                                key={size}
                                                onClick={() => handleFilterChange.size(size)}
                                                className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                            >
                                                {size} dòng
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Thông tin trang */}
                            <p className="text-xs text-bo-muted">
                                Hiển thị{" "}
                                <span className="font-semibold text-bo-foreground">
                                    {filters.page * filters.size + 1}
                                </span>
                                {" - "}
                                <span className="font-semibold text-bo-foreground">
                                    {Math.min((filters.page + 1) * filters.size, total)}
                                </span>
                                {" trong tổng số "}
                                <span className="font-semibold text-bo-primary">{total}</span>{" "}
                                kết quả
                            </p>

                            {/* Điều hướng */}
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleFilterChange.page(filters.page - 1)}
                                    disabled={filters.page === 0}
                                    className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                                >
                                    <ChevronLeft className="size-3.5" />
                                    Trước
                                </Button>

                                <div className="hidden items-center gap-1 sm:flex">
                                    {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                                        let pageNum;
                                        if (totalPages <= 5) {
                                            pageNum = idx;
                                        } else if (filters.page < 3) {
                                            pageNum = idx;
                                        } else if (filters.page > totalPages - 4) {
                                            pageNum = totalPages - 5 + idx;
                                        } else {
                                            pageNum = filters.page - 2 + idx;
                                        }
                                        return (
                                            <Button
                                                key={idx}
                                                variant={filters.page === pageNum ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => handleFilterChange.page(pageNum)}
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
                                    onClick={() => handleFilterChange.page(filters.page + 1)}
                                    disabled={filters.page >= totalPages - 1}
                                    className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                                >
                                    Sau
                                    <ChevronRight className="size-3.5" />
                                </Button>
                            </div>
                        </div>
                    }
                >
                    {/* Bảng có chiều cao cố định, cuộn bên trong */}
                    <div className="max-h-[520px] overflow-y-auto">
                        <table className="w-full min-w-[1100px] text-sm">
                            <thead className="sticky top-0 z-10">
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    STT
                                </th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Hình ảnh
                                </th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Tên sản phẩm
                                </th>
                                <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Thương hiệu
                                </th>
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Giá bán
                                </th>
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Trạng thái
                                </th>
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Ngày tạo
                                </th>
                                <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                    Thao tác
                                </th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-bo-border">
                            {products.map((product, index) => (
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
                                            <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-bo-border bg-bo-surface-subtle px-2 py-0.5 text-xs font-medium text-bo-foreground">
                                                <Tag className="size-3 shrink-0 text-bo-muted" />
                                                <span className="truncate">{product.thuongHieu.tenThuongHieu}</span>
                                            </span>
                                        ) : (
                                            <span className="text-xs italic text-bo-muted">Chưa xác định</span>
                                        )}
                                    </td>

                                    {/* Giá bán */}
                                    <td className="px-3 py-3 text-center">
                                        <span className="inline-flex items-center gap-1.5 rounded-md bg-bo-success-soft px-2.5 py-1 text-xs font-semibold text-bo-success">
                                            {product.giaBanMacDinh ? formatCurrency(product.giaBanMacDinh) : "N/A"}
                                        </span>
                                    </td>

                                    {/* Trạng thái */}
                                    <td className="px-3 py-3 text-center">
                                        {product.trangThai === 1 ? (
                                            <StatusBadge label="Còn hàng" tone="success" />
                                        ) : product.trangThai === 0 ? (
                                            <StatusBadge label="Hết hàng" tone="danger" />
                                        ) : (
                                            <StatusBadge label="Ngừng hoạt động" tone="neutral" />
                                        )}
                                    </td>

                                    {/* Ngày tạo */}
                                    <td className="px-3 py-3 text-center text-sm text-bo-muted">
                                        {formatDate(product.ngayTao) !== "N/A" ? formatDate(product.ngayTao) : "-"}
                                    </td>

                                    {/* Thao tác */}
                                    <td className="px-3 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            <Link
                                                to={`/products/${product.id}`}
                                                title="Xem chi tiết"
                                                className="inline-flex size-8 items-center justify-center rounded-md text-bo-primary transition-colors hover:bg-bo-primary-soft"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Link>
                                            {/*<button*/}
                                            {/*    type="button"*/}
                                            {/*    title="Tồn kho biến thể"*/}
                                            {/*    onClick={() => handleOpenInventory(product)}*/}
                                            {/*    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent transition-all duration-150 hover:scale-110 active:scale-95 text-blue-600 hover:bg-blue-50 hover:border-blue-200"*/}
                                            {/*>*/}
                                            {/*    <Layers className="h-4 w-4" />*/}
                                            {/*</button>*/}
                                            <button
                                                type="button"
                                                title="Chỉnh sửa"
                                                onClick={() => { setSelectedProductId(product.id); openEditModal(); }}
                                                className="inline-flex size-8 items-center justify-center rounded-md text-bo-primary transition-colors hover:bg-bo-primary-soft"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                title="Xóa sản phẩm"
                                                onClick={() => handleDeleteClick(product)}
                                                className="inline-flex size-8 items-center justify-center rounded-md text-bo-danger transition-colors hover:bg-bo-danger-soft"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </TableShell>
            )}

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

            <ProductModal
                isOpen={isViewModalOpen}
                onClose={() => { setSelectedProductId(null); closeViewModal(); }}
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

            <InventoryDrawer
                isOpen={isInventoryOpen}
                onClose={handleCloseInventory}
                product={selectedInventoryProduct}
            />

        </PageContainer>
    );
}
