import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { productService } from "@/services/productService.js";
import { toast } from "@/lib/thongBaoNhanh";
import { Link } from "react-router-dom";
import { Save, Printer, RefreshCcw, Layers, SearchX } from "lucide-react";

import BarcodePrint from "@/pages/product/components/product/BarcodePrint";
import { useToggle } from "@/hooks/useToggle";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import { cn } from "@/lib/utils";

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
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import MoneyInput from "@/components/shared/MoneyInput";

// Tab trạng thái (bố cục A+G) — mã tab nằm trên URL ?trangThai=
const STATUS_TABS = [
    { value: "tat-ca",          label: "Tất cả" },
    { value: "hoat-dong",       label: "Hoạt động" },
    { value: "ngung-hoat-dong", label: "Ngừng hoạt động" },
];
const STATUS_TAB_VALUES = STATUS_TABS.map((tab) => tab.value);
const TAB_MAC_DINH = "tat-ca";
const LOAD_ERROR_MESSAGE = "Không thể tải danh sách biến thể. Vui lòng thử lại.";

// Khớp nhãn trên dòng: trangThai = 1 là "Hoạt động", còn lại là "Ngừng hoạt động".
const matchTab = (sku, tab) =>
    tab === TAB_MAC_DINH || (tab === "hoat-dong" ? sku.trangThai === 1 : sku.trangThai !== 1);

const matchSearch = (sku, keyword) => {
    if (!keyword.trim()) return true;
    const lk = keyword.toLowerCase();
    return (
        sku.productName?.toLowerCase().includes(lk) ||
        sku.maSku?.toLowerCase().includes(lk) ||
        sku.maVachSku?.toLowerCase().includes(lk) ||
        sku.maVach?.toLowerCase().includes(lk) ||
        sku.maBienThe?.toLowerCase().includes(lk)
    );
};

// Dòng đang sửa giá vốn / giá bán mà chưa lưu (ô giá tô vàng, hiện nút Lưu giá).
const isPriceChanged = (sku) =>
    sku.giaBan === "" || sku.giaVon === "" ||
    Number(sku.giaBan) !== Number(sku.originalPrice) || Number(sku.giaVon) !== Number(sku.originalCost);

// Bảng class tĩnh cho ô nhập giá: highlight khi giá đã thay đổi nhưng chưa lưu.
const priceInputClass = (daDoiGia) =>
    cn("ml-auto w-28", daDoiGia && "border-bo-warning bg-bo-warning-soft");

export default function SkuBuilder() {
    const location = useLocation();
    const [skus, setSkus] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const requestIdRef = useRef(0);

    const [keyword, setKeyword] = useState("");
    // Tab trạng thái trên URL ?trangThai= (F5 / quay lại vẫn đúng tab)
    const [tab, setTab] = useTabTrenUrl(STATUS_TAB_VALUES, TAB_MAC_DINH);

    const [isBarcodeModalOpen, openBarcodeModal, closeBarcodeModal] = useToggle(false);
    const [selectedSkusToPrint, setSelectedSkusToPrint] = useState([]);
    const savingSkuIdsRef = useRef(new Set());
    const [savingSkuIds, setSavingSkuIds] = useState(new Set());

    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(SO_DONG_MAC_DINH);

    const fetchSkus = useCallback(async () => {
        // Chỉ nhận kết quả của lần tải mới nhất
        const requestId = ++requestIdRef.current;
        setIsLoading(true);
        setLoadError(null);
        try {
            const payload = {
                page: 0,
                size: 1000,
                filters: [],
                sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
            };
            const res = await productService.filterProducts(payload);
            if (requestId !== requestIdRef.current) return;
            const serverResponse = res.data;
            if (serverResponse?.status !== 200) {
                throw new Error(serverResponse?.message || LOAD_ERROR_MESSAGE);
            }
            const products = serverResponse.data?.content || [];
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
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            console.error("Lỗi khi tải danh sách SKU:", error);
            toast.error("Không thể tải danh sách SKU");
            // Không giữ dòng của lần tải trước (R9)
            setSkus([]);
            setLoadError(error?.response?.data?.message || LOAD_ERROR_MESSAGE);
        } finally {
            if (requestId === requestIdRef.current) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // Hoãn qua microtask để tránh setState đồng bộ trong effect
        // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
        // Không tải lại khi chỉ đổi tab (?trangThai=) để giữ giá đang sửa dở.
        queueMicrotask(() => fetchSkus());
        // Force scroll to top on navigation
        window.scrollTo(0, 0);
    }, [fetchSkus, location.pathname]);

    // Lọc tại chỗ: từ khóa trước, trạng thái sau — số trên tab đếm trên `searched` (R1)
    const searched = useMemo(
        () => skus.filter((sku) => matchSearch(sku, keyword)),
        [skus, keyword]
    );
    const processedSkus = useMemo(
        () => searched.filter((sku) => matchTab(sku, tab)),
        [searched, tab]
    );

    // Số trên tab = số dòng sẽ thấy khi bấm tab, theo từ khóa đang tìm; đang tải / lỗi thì không hiện (R9)
    const statusTabs = useMemo(
        () => STATUS_TABS.map((t) => ({
            ...t,
            count: isLoading || loadError ? null : searched.filter((sku) => matchTab(sku, t.value)).length,
        })),
        [searched, isLoading, loadError]
    );

    // Số dòng đang sửa giá dở (trên mọi dòng đã tải, kể cả dòng bị bộ lọc che)
    const soDongChuaLuu = useMemo(() => skus.filter(isPriceChanged).length, [skus]);

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

    // Đổi tab: ghi lên URL và về trang đầu
    const changeTab = (value) => {
        setTab(value);
        setPage(0);
    };

    // "Xóa lọc" chỉ xóa từ khóa, giữ tab đang chọn
    const handleClearSearch = () => {
        setKeyword("");
        setPage(0);
    };

    const totalPages = Math.max(1, Math.ceil(processedSkus.length / pageSize));
    const safePage = Math.min(page, totalPages - 1);
    const currentPageSkus = processedSkus.slice(safePage * pageSize, (safePage + 1) * pageSize);
    const emptyTabLabel = STATUS_TABS.find((t) => t.value === tab)?.label;

    return (
        <PageContainer key={location.pathname} fill className="space-y-4">
            <ListPageHeader
                actions={
                    <Button
                        variant="outline"
                        onClick={fetchSkus}
                        disabled={isLoading || savingSkuIds.size > 0}
                        className="gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                    >
                        <RefreshCcw className={cn("size-4", isLoading && "animate-spin")} />
                        Tải lại
                    </Button>
                }
            />

            {/* ══ BẢNG: tab trạng thái + tìm kiếm cùng một hàng ══ */}
            <TableShell
                fill
                toolbar={
                    <ListToolbar
                        tabs={
                            <StatusTabs
                                label="Lọc biến thể theo trạng thái"
                                tabs={statusTabs}
                                value={tab}
                                onChange={changeTab}
                            />
                        }
                        hasFilter={Boolean(keyword.trim())}
                        onClear={handleClearSearch}
                    >
                        {/* Nhắc dòng đang sửa giá dở (không phải số thống kê) */}
                        {soDongChuaLuu > 0 ? (
                            <span className="inline-flex h-7 items-center whitespace-nowrap rounded-full border border-bo-warning/30 bg-bo-warning-soft px-2.5 text-xs font-medium text-bo-warning">
                                {soDongChuaLuu.toLocaleString("vi-VN")} dòng chưa lưu giá
                            </span>
                        ) : null}
                        <SearchInput
                            value={keyword}
                            onChange={(e) => { setKeyword(e.target.value); setPage(0); }}
                            onClear={handleClearSearch}
                            placeholder="Tìm theo tên SP, SKU, mã vạch..."
                            label="Tìm kiếm SKU"
                            className="sm:w-[300px]"
                        />
                    </ListToolbar>
                }
                footer={
                    !isLoading && !loadError && processedSkus.length > 0 ? (
                        <TablePagination
                            page={safePage}
                            size={pageSize}
                            total={processedSkus.length}
                            onPageChange={setPage}
                            onSizeChange={(size) => { setPageSize(size); setPage(0); }}
                        />
                    ) : null
                }
            >
                {isLoading ? (
                    <LoadingState label="Đang tải danh sách biến thể" />
                ) : loadError ? (
                    <ErrorState description={loadError} onRetry={fetchSkus} />
                ) : processedSkus.length === 0 ? (
                    keyword.trim() ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy biến thể phù hợp"
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
                    ) : tab !== TAB_MAC_DINH ? (
                        <EmptyState
                            icon={Layers}
                            title={`Không có biến thể nào ở trạng thái "${emptyTabLabel}"`}
                            description="Chọn tab Tất cả để xem mọi biến thể."
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
                            icon={Layers}
                            title="Chưa có biến thể"
                            description="Biến thể được tạo khi thêm hoặc sửa sản phẩm ở trang Sản phẩm."
                        />
                    )
                ) : (
                    /* Bảng dữ liệu: khung giãn hết màn, thân bảng tự cuộn, tiêu đề cột đứng yên */
                        <table className="w-full min-w-[1080px] text-sm">
                            <thead className="sticky top-0 z-10">
                                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                    <th className="h-10 w-14 px-3 text-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">STT</th>
                                    <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">SKU</th>
                                    <th className="h-10 px-3 text-left whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Sản phẩm</th>
                                    <th className="h-10 px-3 text-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Màu</th>
                                    <th className="h-10 px-3 text-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Kích cỡ</th>
                                    <th className="h-10 px-3 text-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                                    <th className="h-10 w-36 px-3 text-right whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Giá vốn</th>
                                    <th className="h-10 w-36 px-3 text-right whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Giá bán</th>
                                    <th className="h-10 px-3 text-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-bo-border">
                                {currentPageSkus.map((sku, index) => {
                                    const daDoiGia = isPriceChanged(sku);
                                    return (
                                        <tr key={`${sku.id}-${index}`} className="transition-colors hover:bg-bo-surface-subtle">
                                            <td className="w-14 px-3 py-3 text-center align-middle text-xs text-bo-muted">
                                                {safePage * pageSize + index + 1}
                                            </td>

                                            <td className="px-3 py-3 align-middle">
                                                <span className="whitespace-nowrap font-mono text-xs font-bold tracking-wide text-bo-primary">
                                                    {sku.maSku || sku.maBienThe || sku.skuCode || "—"}
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
                                                    <StatusBadge label="Hoạt động" tone="success" className="whitespace-nowrap" />
                                                ) : (
                                                    <StatusBadge label="Ngừng hoạt động" tone="neutral" className="whitespace-nowrap" />
                                                )}
                                            </td>

                                            <td className="px-3 py-3 text-right align-middle">
                                                <MoneyInput
                                                    aria-label={`Giá vốn ${sku.maSku || sku.maBienThe || ""}`.trim()}
                                                    className={priceInputClass(daDoiGia)}
                                                    value={sku.giaVon}
                                                    onChange={(giaTri) => handlePriceChange(sku.id, "giaVon", giaTri)}
                                                />
                                            </td>

                                            <td className="px-3 py-3 text-right align-middle">
                                                <MoneyInput
                                                    aria-label={`Giá bán ${sku.maSku || sku.maBienThe || ""}`.trim()}
                                                    className={priceInputClass(daDoiGia)}
                                                    value={sku.giaBan}
                                                    onChange={(giaTri) => handlePriceChange(sku.id, "giaBan", giaTri)}
                                                />
                                            </td>

                                            <td className="px-3 py-3 align-middle">
                                                <RowActions>
                                                    {daDoiGia && (
                                                        <RowActionButton
                                                            icon={Save}
                                                            tone="success"
                                                            label={savingSkuIds.has(sku.id) ? "Đang lưu giá..." : "Lưu giá"}
                                                            disabled={savingSkuIds.has(sku.id)}
                                                            onClick={() => savePrice(sku)}
                                                        />
                                                    )}
                                                    <RowActionButton
                                                        icon={Printer}
                                                        label="In mã vạch"
                                                        disabled={savingSkuIds.has(sku.id)}
                                                        onClick={() => handlePrintBarcode(sku)}
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

            <BarcodePrint
                isOpen={isBarcodeModalOpen}
                onClose={closeBarcodeModal}
                products={selectedSkusToPrint}
            />
        </PageContainer>
    );
}
