import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { productService } from "@/services/productService.js";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
    Save, Printer, RefreshCcw, Package,
    Layers, Tag, ChevronDown, ChevronLeft, ChevronRight, Check, Filter, DollarSign,
} from "lucide-react";

import BarcodePrint from "@/pages/product/components/product/BarcodePrint";
import { useToggle } from "@/hooks/useToggle";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import PageContainer from "@/components/backoffice/PageContainer";
import FilterBar from "@/components/shared/FilterBar";
import SearchInput from "@/components/shared/SearchInput";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";

const STATUS_OPTIONS = [
    { value: "ALL", label: "Tất cả trạng thái" },
    { value: "1",   label: "Đang hoạt động" },
    { value: "0",   label: "Ngừng hoạt động" },
];

// Bảng class tĩnh cho ô nhập giá: highlight khi giá đã thay đổi nhưng chưa lưu.
const priceInputClass = (isPriceChanged) =>
    `mx-auto h-8 w-28 text-right text-xs font-medium text-bo-foreground focus-visible:border-bo-primary ${
        isPriceChanged ? "border-bo-warning bg-bo-warning-soft" : "border-bo-border bg-white"
    }`;

export default function SkuBuilder() {
    const location = useLocation();
    const [skus, setSkus] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const [isBarcodeModalOpen, openBarcodeModal, closeBarcodeModal] = useToggle(false);
    const [selectedSkusToPrint, setSelectedSkusToPrint] = useState([]);
    const savingSkuIdsRef = useRef(new Set());
    const [savingSkuIds, setSavingSkuIds] = useState(new Set());

    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    const fetchSkus = useCallback(async () => {
        try {
            setIsLoading(true);
            const payload = {
                page: 0,
                size: 1000,
                filters: [],
                sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
            };
            const res = await productService.filterProducts(payload);
            const serverResponse = res.data;
            if (serverResponse?.status === 200) {
                const products = serverResponse.data.content || [];
                const flattenedSkus = [];
                products.forEach((product) => {
                    if (product.bienTheSanPhams?.length) {
                        product.bienTheSanPhams.forEach((variant) => {
                            flattenedSkus.push({
                                ...variant,
                                productId: product.id,
                                productName: product.tenSanPham,
                                productCode: product.maSanPham,
                                originalPrice: variant.giaBan,
                                originalCost: variant.giaVon,
                                image: variant.anhBienThe || (product.anhQuanAos?.[0]?.tepTin?.duongDan || product.anhQuanAos?.[0]?.urlAnh),
                            });
                        });
                    }
                });
                setSkus(flattenedSkus);
            }
        } catch (error) {
            console.error("Lỗi khi tải danh sách SKU:", error);
            toast.error("Không thể tải danh sách SKU");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // Hoãn qua microtask để tránh setState đồng bộ trong effect
        // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
        queueMicrotask(() => fetchSkus());
        // Force scroll to top on navigation
        window.scrollTo(0, 0);
    }, [fetchSkus, location.pathname, location.search]);

    // Derived state using useMemo to ensure consistency
    const processedSkus = useMemo(() => {
        let result = [...skus];
        if (keyword.trim()) {
            const lk = keyword.toLowerCase();
            result = result.filter((sku) =>
                sku.productName?.toLowerCase().includes(lk) ||
                sku.maSku?.toLowerCase().includes(lk) ||
                sku.maVachSku?.toLowerCase().includes(lk) ||
                sku.maVach?.toLowerCase().includes(lk) ||
                sku.maBienThe?.toLowerCase().includes(lk)
            );
        }
        if (statusFilter !== "ALL") {
            result = result.filter((sku) => sku.trangThai === Number(statusFilter));
        }
        return result;
    }, [skus, keyword, statusFilter]);

    const stats = useMemo(() => ({
        total: skus.length,
        active: skus.filter((s) => s.trangThai === 1).length,
        inactive: skus.filter((s) => s.trangThai === 0).length,
        changed: skus.filter((s) => s.giaBan === "" || s.giaVon === "" || Number(s.giaBan) !== Number(s.originalPrice) || Number(s.giaVon) !== Number(s.originalCost)).length,
    }), [skus]);

    const handlePriceChange = (id, field, value) => {
        setSkus((prev) => prev.map((sku) => sku.id === id ? { ...sku, [field]: value } : sku));
    };

    const savePrice = async (sku) => {
        if (savingSkuIdsRef.current.has(sku.id)) return;
        const price = Number(sku.giaBan);
        const cost = Number(sku.giaVon);
        if (
            sku.giaBan == null || String(sku.giaBan).trim() === "" ||
            sku.giaVon == null || String(sku.giaVon).trim() === "" ||
            !Number.isFinite(price) || !Number.isFinite(cost) || price < 0 || cost < 0
        ) {
            toast.error("Giá bán và giá vốn phải là số hợp lệ, không âm.");
            return;
        }
        savingSkuIdsRef.current.add(sku.id);
        setSavingSkuIds(new Set(savingSkuIdsRef.current));
        try {
            const response = await productService.updateSkuPrice(sku.id, price, cost);
            if (response.data?.status !== 200) {
                throw new Error("Cập nhật giá không thành công");
            }
            toast.success("Cập nhật giá thành công");
            // Lưu đúng giá gửi lên API. Nếu người dùng sửa tiếp trong lúc
            // chờ API, phần sửa mới vẫn được đánh dấu chưa lưu.
            setSkus((prev) =>
                prev.map((s) => s.id === sku.id ? { ...s, originalPrice: price, originalCost: cost } : s)
            );
        } catch {
            toast.error("Không thể cập nhật giá");
        } finally {
            savingSkuIdsRef.current.delete(sku.id);
            setSavingSkuIds(new Set(savingSkuIdsRef.current));
        }
    };

    const handlePrintBarcode = (sku) => {
        if (savingSkuIdsRef.current.has(sku.id)) {
            toast.info("Đang lưu giá. Vui lòng đợi trước khi in mã vạch.");
            return;
        }
        if (sku.giaBan === "" || Number(sku.giaBan) !== Number(sku.originalPrice)) {
            toast.info("Giá bán đã thay đổi. Hãy lưu giá trước khi in mã vạch.");
            return;
        }
        setSelectedSkusToPrint([{
            id: sku.productId,
            tenSanPham: sku.productName,
            bienTheSanPhams: [{ ...sku, giaBan: sku.originalPrice }],
        }]);
        openBarcodeModal();
    };

    const currentPageSkus = processedSkus.slice(page * pageSize, (page + 1) * pageSize);
    const totalPages = Math.max(1, Math.ceil(processedSkus.length / pageSize));

    return (
        <PageContainer key={location.pathname} className="space-y-5">

            {/* ══ STATS ════════════════════════════════════════════════════════ */}
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
                    <div>
                        <p className="text-xs font-medium text-bo-muted">Tổng biến thể</p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{stats.total}</p>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft text-bo-primary">
                        <Package className="size-5" />
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
                    <div>
                        <p className="text-xs font-medium text-bo-muted">Đang hoạt động</p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{stats.active}</p>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-success-soft text-bo-success">
                        <Layers className="size-5" />
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
                    <div>
                        <p className="text-xs font-medium text-bo-muted">Ngừng hoạt động</p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{stats.inactive}</p>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <Tag className="size-5" />
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
                    <div>
                        <p className="text-xs font-medium text-bo-muted">Chờ lưu giá</p>
                        <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{stats.changed}</p>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-warning-soft text-bo-warning">
                        <DollarSign className="size-5" />
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
                    className="border-b-0"
                    primary={
                        <SearchInput
                            value={keyword}
                            onChange={(e) => { setKeyword(e.target.value); setPage(0); }}
                            placeholder="Tìm theo tên SP, SKU, Barcode..."
                            label="Tìm kiếm SKU"
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
                                        className="h-9 w-[200px] justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                    >
                                        <span className="truncate">
                                            {STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label}
                                        </span>
                                        <ChevronDown className="size-4 shrink-0 opacity-70" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="backoffice-user-menu z-50 w-[200px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                                >
                                    {STATUS_OPTIONS.map((opt) => (
                                        <DropdownMenuItem
                                            key={opt.value}
                                            onClick={() => { setStatusFilter(opt.value); setPage(0); }}
                                            className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                                        >
                                            {opt.label}
                                            {statusFilter === opt.value && <Check className="size-4" />}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Tải lại */}
                            <Button
                                variant="outline"
                                onClick={fetchSkus}
                                disabled={isLoading || savingSkuIds.size > 0}
                                className="flex h-9 items-center gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                <RefreshCcw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
                                Tải lại
                            </Button>
                        </>
                    }
                />
            </div>

            {/* ══ TABLE / LOADING / EMPTY ══════════════════════════════════════ */}
            {isLoading ? (
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <LoadingState label="Đang tải danh sách biến thể..." />
                </div>
            ) : processedSkus.length === 0 ? (
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <EmptyState
                        icon={Layers}
                        title="Không tìm thấy biến thể nào"
                        description="Hãy thử thay đổi bộ lọc hoặc từ khoá tìm kiếm để xem kết quả khác."
                    />
                </div>
            ) : (
                <TableShell
                    footer={
                        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                            {/* Số dòng hiển thị */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-bo-muted">Hiển thị:</span>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="h-8 w-[120px] justify-between border-bo-border bg-white px-2.5 text-xs font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                        >
                                            {pageSize} dòng
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
                                                onClick={() => { setPageSize(size); setPage(0); }}
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
                                    {page * pageSize + 1}
                                </span>
                                {" - "}
                                <span className="font-semibold text-bo-foreground">
                                    {Math.min((page + 1) * pageSize, processedSkus.length)}
                                </span>
                                {" trong tổng số "}
                                <span className="font-semibold text-bo-primary">{processedSkus.length}</span> kết quả
                            </p>

                            {/* Điều hướng */}
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(page - 1)}
                                    disabled={page === 0}
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
                                        } else if (page < 3) {
                                            pageNum = idx;
                                        } else if (page > totalPages - 4) {
                                            pageNum = totalPages - 5 + idx;
                                        } else {
                                            pageNum = page - 2 + idx;
                                        }
                                        return (
                                            <Button
                                                key={idx}
                                                variant={page === pageNum ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setPage(pageNum)}
                                                className={
                                                    page === pageNum
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
                                    onClick={() => setPage(page + 1)}
                                    disabled={page >= totalPages - 1}
                                    className="h-8 gap-1 border-bo-border bg-white px-2.5 text-xs text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                                >
                                    Sau
                                    <ChevronRight className="size-3.5" />
                                </Button>
                            </div>
                        </div>
                    }
                >
                    {/* Bảng dữ liệu, cuộn bên trong khung */}
                    <div className="max-h-[520px] overflow-y-auto">
                        <table className="w-full min-w-[1080px] text-sm">
                            <thead className="sticky top-0 z-10">
                                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                    <th className="h-10 w-14 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">STT</th>
                                    <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">SKU</th>
                                    <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Sản phẩm</th>
                                    <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Màu</th>
                                    <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Size</th>
                                    <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                                    <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Giá vốn</th>
                                    <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Giá bán</th>
                                    <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-bo-border">
                                {currentPageSkus.map((sku, index) => {
                                    const isPriceChanged = sku.giaBan === "" || sku.giaVon === "" || Number(sku.giaBan) !== Number(sku.originalPrice) || Number(sku.giaVon) !== Number(sku.originalCost);
                                    return (
                                        <tr key={`${sku.id}-${index}`} className="transition-colors hover:bg-bo-surface-subtle">
                                            <td className="w-14 px-3 py-3 text-center align-middle text-xs text-bo-muted">
                                                {page * pageSize + index + 1}
                                            </td>

                                            <td className="px-3 py-3 align-middle">
                                                <span className="font-mono text-xs font-bold tracking-wide text-bo-primary">
                                                    {sku.maSku || sku.maBienThe || sku.skuCode || "N/A"}
                                                </span>
                                            </td>

                                            <td className="max-w-[260px] px-3 py-3 align-middle">
                                                <Link
                                                    to={`/products/${sku.productId}`}
                                                    title={sku.productName}
                                                    className="block w-full truncate text-left font-semibold leading-snug text-bo-foreground hover:underline"
                                                >
                                                    {sku.productName}
                                                </Link>
                                                {sku.productCode && (
                                                    <p className="mt-0.5 line-clamp-1 font-mono text-xs font-semibold text-bo-muted">{sku.productCode}</p>
                                                )}
                                            </td>

                                            <td className="px-3 py-3 text-center align-middle">
                                                {sku.mauSac?.tenMau ? (
                                                    <span className="inline-flex items-center rounded-full border border-bo-border bg-bo-surface-subtle px-2.5 py-0.5 text-xs font-medium text-bo-muted">
                                                        {sku.mauSac.tenMau}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-300">—</span>
                                                )}
                                            </td>

                                            <td className="px-3 py-3 text-center align-middle">
                                                {sku.size?.tenSize ? (
                                                    <span className="inline-flex items-center rounded-full border border-bo-border bg-bo-surface-subtle px-2.5 py-0.5 text-xs font-medium text-bo-muted">
                                                        {sku.size.tenSize}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-300">—</span>
                                                )}
                                            </td>

                                            <td className="px-3 py-3 text-center align-middle">
                                                {sku.trangThai === 1 ? (
                                                    <StatusBadge label="Hoạt động" tone="success" />
                                                ) : (
                                                    <StatusBadge label="Ngừng HĐ" tone="neutral" />
                                                )}
                                            </td>

                                            <td className="px-3 py-3 text-center align-middle">
                                                <Input
                                                    type="number"
                                                    className={priceInputClass(isPriceChanged)}
                                                    value={sku.giaVon}
                                                    onChange={(e) => handlePriceChange(sku.id, "giaVon", e.target.value)}
                                                />
                                            </td>

                                            <td className="px-3 py-3 text-center align-middle">
                                                <Input
                                                    type="number"
                                                    className={priceInputClass(isPriceChanged)}
                                                    value={sku.giaBan}
                                                    onChange={(e) => handlePriceChange(sku.id, "giaBan", e.target.value)}
                                                />
                                            </td>

                                            <td className="px-3 py-3 align-middle">
                                                <div className="flex items-center justify-center gap-1">
                                                    {isPriceChanged && (
                                                        <button
                                                            type="button"
                                                            title={savingSkuIds.has(sku.id) ? "Đang lưu giá..." : "Lưu giá"}
                                                            aria-label="Lưu giá"
                                                            disabled={savingSkuIds.has(sku.id)}
                                                            onClick={() => savePrice(sku)}
                                                            className="inline-flex size-8 items-center justify-center rounded-md text-bo-success transition-colors hover:bg-bo-success-soft disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            <Save className="size-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        title="In mã vạch"
                                                        aria-label="In mã vạch"
                                                        disabled={savingSkuIds.has(sku.id)}
                                                        onClick={() => handlePrintBarcode(sku)}
                                                        className="inline-flex size-8 items-center justify-center rounded-md text-bo-primary transition-colors hover:bg-bo-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <Printer className="size-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </TableShell>
            )}

            <BarcodePrint
                isOpen={isBarcodeModalOpen}
                onClose={closeBarcodeModal}
                products={selectedSkusToPrint}
            />
        </PageContainer>
    );
}
