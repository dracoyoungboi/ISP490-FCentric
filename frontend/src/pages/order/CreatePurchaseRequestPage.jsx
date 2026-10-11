import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft, Package, Send, Loader2,
    X, Check, ShoppingBag, Layers,
    ChevronRight, Minus, Plus, Trash2,
} from 'lucide-react';

import PageContainer from '@/components/backoffice/PageContainer';
import PageHeader from '@/components/backoffice/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import FormActions from '@/components/shared/FormActions';
import LoadingState from '@/components/shared/LoadingState';
import SearchInput from '@/components/shared/SearchInput';
import SurfaceCard from '@/components/shared/SurfaceCard';

import apiClient from '@/services/apiClient';
import { productService } from '@/services/productService';
import purchaseRequestService from '@/services/purchaseRequestService';

const PRODUCT_PAGE_SIZE = 8;

const CONTROL_CLASS =
    'h-11 w-full rounded-md border border-bo-border bg-white px-3 text-sm text-bo-foreground shadow-none placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

// ─── VariantRow ───────────────────────────────────────────────────────────────
function VariantRow({ variant, selectedEntry, onToggle, onQtyChange }) {
    const img = variant.anhBienThe?.tepTin?.duongDan;
    const isSelected = !!selectedEntry;

    return (
        <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${isSelected ? 'border-bo-primary/50 bg-bo-primary-soft/50' : 'border-transparent bg-bo-surface-subtle hover:bg-slate-100'}`}>
            <button type="button" onClick={() => onToggle(variant)} className="shrink-0">
                <div className={`flex size-4 items-center justify-center rounded border transition-colors ${isSelected ? 'border-bo-primary bg-bo-primary' : 'border-slate-300 bg-white'}`}>
                    {isSelected && <Check className="size-3 text-white" strokeWidth={3} />}
                </div>
            </button>

            {img
                ? <img src={img} alt="" className="size-9 shrink-0 rounded-md border border-bo-border object-cover" />
                : <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-bo-border bg-white"><Package className="size-4 text-slate-400" /></div>
            }

            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onToggle(variant)}>
                <p className={`truncate text-[13px] leading-tight ${isSelected ? 'font-semibold text-bo-foreground' : 'font-medium text-slate-700'}`}>
                    {[variant.mauSac?.tenMau, variant.size?.maSize, variant.chatLieu?.tenChatLieu].filter(Boolean).join(' / ') || variant.maSku}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-bo-muted">{variant.maSku}</p>
            </div>

            {isSelected && (
                <div className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => onQtyChange(variant.id, Math.max(1, (selectedEntry.soLuong || 1) - 1))}
                        className="flex size-7 items-center justify-center rounded-md bg-bo-primary-soft text-bo-primary transition-colors hover:bg-bo-primary/15">
                        <Minus className="size-3" />
                    </button>
                    <input
                        type="number"
                        min={1}
                        value={selectedEntry.soLuong || 1}
                        onChange={e => onQtyChange(variant.id, Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-7 w-12 rounded-md border border-bo-border bg-white text-center text-[13px] font-semibold text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-1 focus:ring-bo-primary/30"
                    />
                    <button type="button" onClick={() => onQtyChange(variant.id, (selectedEntry.soLuong || 1) + 1)}
                        className="flex size-7 items-center justify-center rounded-md bg-bo-primary-soft text-bo-primary transition-colors hover:bg-bo-primary/15">
                        <Plus className="size-3" />
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────
function ProductCard({ product, selectedMap, onToggle, onQtyChange }) {
    const [expanded, setExpanded] = useState(false);
    const variants = (product.bienTheSanPhams || []).filter(v => v.trangThai !== 0);
    const selectedCount = variants.filter(v => selectedMap.has(v.id)).length;
    const allSelected = variants.length > 0 && variants.every(v => selectedMap.has(v.id));

    const mainImg =
        product.anhQuanAos?.find(a => a.anhChinh === 1)?.tepTin?.duongDan ||
        product.anhQuanAos?.[0]?.tepTin?.duongDan ||
        variants[0]?.anhBienThe?.tepTin?.duongDan;

    const handleSelectAll = (e) => {
        e.stopPropagation();
        variants.forEach(v => onToggle(v, product.tenSanPham, !allSelected));
    };

    return (
        <div className={`overflow-hidden rounded-lg border bg-white transition-colors ${selectedCount > 0 ? 'border-bo-primary/50 shadow-sm' : 'border-bo-border'}`}>
            <button type="button" onClick={() => setExpanded(p => !p)}
                className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-bo-surface-subtle">
                {mainImg
                    ? <img src={mainImg} alt="" className="size-12 shrink-0 rounded-md border border-bo-border object-cover" />
                    : <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-bo-border bg-bo-surface-subtle"><ShoppingBag className="size-5 text-slate-400" /></div>
                }
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-bo-foreground">{product.tenSanPham}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        {product.danhMuc?.tenDanhMuc && <span className="rounded bg-bo-primary-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-bo-primary">{product.danhMuc.tenDanhMuc}</span>}
                        <span className="font-mono text-[10px] font-semibold text-bo-muted">{product.maSanPham}</span>
                        <span className="flex items-center gap-0.5 text-[10px] font-medium text-slate-400"><Layers className="size-3" />{variants.length} biến thể</span>
                    </div>
                </div>
                {selectedCount > 0 && (
                    <span className="flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full bg-bo-primary px-2 text-[11px] font-bold text-white">{selectedCount}</span>
                )}
                <ChevronRight className={`size-4 shrink-0 text-bo-muted transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
            </button>

            {expanded && (
                <div className="space-y-2 border-t border-bo-border bg-bo-surface-subtle/60 px-3.5 py-3">
                    {variants.length === 0
                        ? <p className="py-5 text-center text-[13px] italic text-slate-400">Sản phẩm này chưa có biến thể</p>
                        : (
                            <>
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-bo-muted">{variants.length} biến thể</p>
                                    <button type="button" onClick={handleSelectAll} className="text-[11px] font-semibold text-bo-primary transition-colors hover:text-bo-primary-hover">
                                        {allSelected ? '− Bỏ chọn tất cả' : '+ Chọn tất cả'}
                                    </button>
                                </div>
                                <div className="space-y-1.5">
                                    {variants.map(v => (
                                        <VariantRow
                                            key={v.id}
                                            variant={v}
                                            selectedEntry={selectedMap.get(v.id)}
                                            onToggle={(variant) => onToggle(variant, product.tenSanPham, !selectedMap.has(variant.id))}
                                            onQtyChange={onQtyChange}
                                        />
                                    ))}
                                </div>
                            </>
                        )
                    }
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function CreatePurchaseRequestPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams(); // Đọc query params

    // Form state
    const [khoId, setKhoId] = useState('');
    const [ngayGiaoDuKien, setNgayGiaoDuKien] = useState('');
    const [ghiChu, setGhiChu] = useState('');

    // Warehouses
    const [warehouses, setWarehouses] = useState([]);
    const [loadingWarehouses, setLoadingWarehouses] = useState(true);

    // Products
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [productPage, setProductPage] = useState(0);
    const [productTotalPages, setProductTotalPages] = useState(0);

    // Selected: Map<variantId, { variant, productName, soLuong }>
    const [selected, setSelected] = useState(new Map());

    // Submit
    const [submitting, setSubmitting] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    // Hàm tìm biến thể bằng API lấy toàn bộ sản phẩm theo kho
    const findVariantInWarehouse = useCallback(async (warehouseId, variantIdToFind) => {
        try {
            const res = await apiClient.get(`/api/v1/san-pham-quan-ao/theo-kho/${warehouseId}`);
            const productsInWarehouse = res.data?.data || res.data || [];

            let foundVariant = null;
            let parentProductName = '';

            // tìm trong toàn bộ sản phẩm của kho này để tìm đúng biến thể
            for (const product of productsInWarehouse) {
                if (product.bienTheSanPhams && product.bienTheSanPhams.length > 0) {
                    const match = product.bienTheSanPhams.find(v => String(v.id) === String(variantIdToFind));
                    if (match) {
                        foundVariant = match;
                        parentProductName = product.tenSanPham;
                        break; // Tìm thấy thì thoát vòng lặp ngay
                    }
                }
            }

            if (foundVariant) {
                // Đẩy vào danh sách đã chọn
                setSelected(prev => {
                    const next = new Map(prev);
                    if (!next.has(foundVariant.id)) {
                        next.set(foundVariant.id, {
                            variant: foundVariant,
                            productName: parentProductName,
                            soLuong: 1
                        });
                    }
                    return next;
                });
            } else {
                toast.error('Không tìm thấy biến thể này trong kho đã chọn.');
            }

        } catch (error) {
            console.error('Lỗi khi lục tìm biến thể theo kho:', error);
            toast.error('Không thể tự tải sản phẩm từ đường dẫn');
        }
    }, []);

    //Xử lý đọc Params từ URL
    const applyUrlParams = useCallback(() => {
        const urlKhoId = searchParams.get('khoId');
        const urlBienTheId = searchParams.get('bienTheId');

        if (urlKhoId) {
            setKhoId(urlKhoId); // Tự động chọn kho trên form
        }
        if (urlKhoId && urlBienTheId) {
            findVariantInWarehouse(urlKhoId, urlBienTheId);
        }
    }, [searchParams, findVariantInWarehouse]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); vẫn chạy ngay khi mount.
    useEffect(() => { queueMicrotask(() => applyUrlParams()); }, [applyUrlParams]);

    // ── Load warehouses ──
    const loadWarehouses = useCallback(async () => {
        setLoadingWarehouses(true);
        try {
            const res = await apiClient.post('/api/v1/kho/filter', {
                filters: [], sorts: [{ fieldName: 'tenKho', direction: 'ASC' }], page: 0, size: 100,
            });
            setWarehouses(res.data?.data?.content || res.data?.content || []);
        } catch {
            toast.error('Không thể tải danh sách kho');
        } finally {
            setLoadingWarehouses(false);
        }
    }, []);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect; vẫn chạy khi mount.
    useEffect(() => { queueMicrotask(() => loadWarehouses()); }, [loadWarehouses]);

    // ── Fetch products ──
    const fetchProducts = useCallback(async (pg = 0, term = '') => {
        setLoadingProducts(true);
        try {
            const res = await productService.filterProducts({
                page: pg, size: PRODUCT_PAGE_SIZE,
                filters: term.trim()
                    ? [{ fieldName: 'tenSanPham', operation: 'LIKE', value: term.trim(), logicType: 'AND' }]
                    : [],
                sorts: [{ fieldName: 'ngayTao', direction: 'DESC' }],
            });
            const data = res?.data?.data || res?.data || {};
            setProducts(data.content || []);
            setProductTotalPages(data.totalPages || 0);
            setProductPage(pg);
        } catch {
            toast.error('Không thể tải danh sách sản phẩm');
        } finally {
            setLoadingProducts(false);
        }
    }, []);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect; vẫn chạy khi mount.
    useEffect(() => { queueMicrotask(() => fetchProducts(0, '')); }, [fetchProducts]);

    useEffect(() => {
        const t = setTimeout(() => fetchProducts(0, searchTerm), 350);
        return () => clearTimeout(t);
    }, [searchTerm, fetchProducts]);

    // ── Selected handlers ──
    const handleToggle = (variant, productName, select) => {
        setSelected(prev => {
            const next = new Map(prev);
            if (select) next.set(variant.id, { variant, productName, soLuong: 1 });
            else next.delete(variant.id);
            return next;
        });
    };

    const handleQtyChange = (variantId, qty) => {
        setSelected(prev => {
            const next = new Map(prev);
            const entry = next.get(variantId);
            if (entry) next.set(variantId, { ...entry, soLuong: qty });
            return next;
        });
    };

    // ── Validate ──
    const validate = () => {
        if (!khoId) { toast.error('Vui lòng chọn kho nhập'); return false; }
        if (!ngayGiaoDuKien) { toast.error('Vui lòng chọn ngày giao dự kiến'); return false; }
        if (selected.size === 0) { toast.error('Vui lòng chọn ít nhất một biến thể sản phẩm'); return false; }
        return true;
    };

    // ── Submit ──
    const handleSubmit = () => {
        if (!validate()) return;
        setShowConfirmDialog(true);
    };

    const confirmCreate = async () => {
        setSubmitting(true);
        try {
            const payload = {
                khoNhapId: parseInt(khoId),
                ngayGiaoDuKien: new Date(ngayGiaoDuKien).toISOString(),
                ghiChu: ghiChu.trim() || null,
                chiTietYeuCauMuaHangs: Array.from(selected.values()).map(({ variant, soLuong }) => ({
                    bienTheSanPhamId: variant.id,
                    soLuongDat: soLuong,
                })),
            };
            await purchaseRequestService.create(payload);
            toast.success('Tạo yêu cầu mua hàng thành công! Chờ quản lý duyệt.');
            setShowConfirmDialog(false);
            setTimeout(() => navigate('/purchase-requests'), 1200);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Không thể tạo yêu cầu. Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    const selectedWarehouse = warehouses.find(w => w.id === parseInt(khoId));
    const totalItems = Array.from(selected.values()).reduce((s, e) => s + (e.soLuong || 1), 0);

    return (
        <PageContainer className="space-y-5">
            {/* ── Header ── */}
            <PageHeader
                title="Tạo yêu cầu mua hàng"
                description="Điền thông tin và chọn sản phẩm cần nhập · Quản lý sẽ xét duyệt trước khi gửi báo giá"
                actions={
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/purchase-requests')}
                        className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                    >
                        <ArrowLeft className="size-4" />
                        Quay lại danh sách yêu cầu
                    </Button>
                }
            />

            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">

                {/* ── Card trái: Thông tin yêu cầu ── */}
                <aside className="flex flex-col gap-5 lg:col-span-5">
                    <SurfaceCard title="Thông tin yêu cầu">

                        {/* Kho nhập */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-bo-foreground">
                                Kho nhập <span className="text-bo-danger">*</span>
                            </label>
                            <select
                                className={`${CONTROL_CLASS} font-semibold`}
                                value={khoId}
                                onChange={e => setKhoId(e.target.value)}
                                disabled={loadingWarehouses}
                            >
                                <option value="">-- Chọn kho nhập --</option>
                                {warehouses.map(kho => (
                                    <option key={kho.id} value={kho.id}>
                                        {kho.tenKho} {kho.maKho ? `(${kho.maKho})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Ngày giao dự kiến */}
                        <div className="mt-5 flex flex-col gap-2">
                            <label className="text-sm font-medium text-bo-foreground">
                                Ngày giao dự kiến <span className="text-bo-danger">*</span>
                            </label>
                            <input
                                type="date"
                                value={ngayGiaoDuKien}
                                onChange={e => setNgayGiaoDuKien(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className={`${CONTROL_CLASS} font-semibold`}
                            />
                        </div>

                        {/* Ghi chú */}
                        <div className="mt-5 flex flex-col gap-2">
                            <label className="text-sm font-medium text-bo-foreground">Ghi chú</label>
                            <textarea
                                placeholder="Lý do yêu cầu, ghi chú cho quản lý..."
                                value={ghiChu}
                                onChange={e => setGhiChu(e.target.value)}
                                rows={3}
                                className="min-h-[100px] w-full resize-none rounded-md border border-bo-border bg-white px-3 py-2.5 text-sm font-medium text-bo-foreground shadow-none placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15"
                            />
                        </div>

                        {/* Summary đã chọn */}
                        {selected.size > 0 && (
                            <div className="mt-5 space-y-3 rounded-lg border border-bo-border bg-bo-surface-subtle px-4 py-4">
                                <div className="flex items-center justify-between border-b border-bo-border pb-2">
                                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-bo-primary">
                                        <Check className="size-4" /> Đã chọn {selected.size} biến thể
                                    </span>
                                    <button type="button" onClick={() => setSelected(new Map())}
                                        className="flex items-center gap-1 text-[11px] font-semibold text-bo-danger transition-colors hover:text-bo-danger/80">
                                        <Trash2 className="size-3.5" /> Xóa tất cả
                                    </button>
                                </div>
                                <div className="max-h-[200px] space-y-2 overflow-y-auto pr-1">
                                    {Array.from(selected.entries()).map(([id, { variant, productName, soLuong }]) => {
                                        const img = variant.anhBienThe?.tepTin?.duongDan;
                                        return (
                                            <div key={id} className="flex items-center gap-2.5 rounded-md border border-bo-border bg-white p-2">
                                                {img
                                                    ? <img src={img} alt="" className="size-8 shrink-0 rounded-md border border-bo-border object-cover" />
                                                    : <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-bo-surface-subtle"><Package className="size-4 text-slate-400" /></div>
                                                }
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[12px] font-semibold text-bo-foreground">{productName}</p>
                                                    <p className="mt-0.5 font-mono text-[10px] text-bo-muted">{variant.maSku}</p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1 rounded-md border border-bo-border bg-bo-surface-subtle p-0.5">
                                                    <button type="button" onClick={() => handleQtyChange(id, Math.max(1, soLuong - 1))}
                                                        className="flex size-6 items-center justify-center rounded bg-white text-bo-primary shadow-sm hover:bg-bo-primary-soft">
                                                        <Minus className="size-3" />
                                                    </button>
                                                    <span className="w-6 text-center text-[12px] font-bold text-bo-foreground">{soLuong}</span>
                                                    <button type="button" onClick={() => handleQtyChange(id, soLuong + 1)}
                                                        className="flex size-6 items-center justify-center rounded bg-white text-bo-primary shadow-sm hover:bg-bo-primary-soft">
                                                        <Plus className="size-3" />
                                                    </button>
                                                </div>
                                                <button type="button" onClick={() => { setSelected(prev => { const n = new Map(prev); n.delete(id); return n; }); }}
                                                    className="ml-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-bo-danger-soft text-bo-danger transition-colors hover:bg-bo-danger/15">
                                                    <X className="size-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </SurfaceCard>
                </aside>

                {/* ── Card phải: Chọn sản phẩm ── */}
                <div className="flex flex-col gap-5 lg:col-span-7">
                    <SurfaceCard
                        title="Chọn sản phẩm & biến thể"
                        action={
                            <div className="hidden w-64 sm:block">
                                <SearchInput
                                    placeholder="Tìm tên sản phẩm..."
                                    label="Tìm sản phẩm"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    onClear={() => setSearchTerm('')}
                                    className="sm:max-w-none"
                                />
                            </div>
                        }
                    >
                        {/* Mobile Search */}
                        <div className="mb-3 sm:hidden">
                            <SearchInput
                                placeholder="Tìm tên sản phẩm..."
                                label="Tìm sản phẩm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onClear={() => setSearchTerm('')}
                            />
                        </div>

                        {/* Product list */}
                        <div className="max-h-[580px] space-y-3 overflow-y-auto pr-2">
                            {loadingProducts ? (
                                <LoadingState rows={5} label="Đang tải sản phẩm" />
                            ) : products.length === 0 ? (
                                <EmptyState
                                    icon={ShoppingBag}
                                    title="Không tìm thấy sản phẩm"
                                    description="Thử từ khóa khác hoặc chọn kho nhập khác để xem biến thể."
                                />
                            ) : products.map(product => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    selectedMap={selected}
                                    onToggle={handleToggle}
                                    onQtyChange={handleQtyChange}
                                />
                            ))}
                        </div>

                        {/* Pagination */}
                        {productTotalPages > 1 && (
                            <div className="mt-4 flex items-center justify-center gap-3 border-t border-bo-border pt-4">
                                <Button type="button" variant="outline" size="sm"
                                    disabled={productPage === 0 || loadingProducts}
                                    onClick={() => fetchProducts(productPage - 1, searchTerm)}
                                    className="h-9 gap-1 border-bo-border bg-white text-xs font-semibold text-bo-foreground hover:bg-bo-surface-subtle">← Trước</Button>
                                <span className="rounded-md border border-bo-border bg-bo-surface-subtle px-4 py-1.5 text-xs font-semibold text-bo-foreground">
                                    {productPage + 1} / {productTotalPages}
                                </span>
                                <Button type="button" variant="outline" size="sm"
                                    disabled={productPage >= productTotalPages - 1 || loadingProducts}
                                    onClick={() => fetchProducts(productPage + 1, searchTerm)}
                                    className="h-9 gap-1 border-bo-border bg-white text-xs font-semibold text-bo-foreground hover:bg-bo-surface-subtle">Sau →</Button>
                            </div>
                        )}
                    </SurfaceCard>
                </div>
            </div>

            {/* ── Action Buttons ── */}
            <FormActions className="rounded-lg border border-bo-border shadow-sm">
                <span className="mr-auto text-xs text-bo-muted">
                    Đã chọn <span className="font-semibold text-bo-foreground">{selected.size}</span> biến thể ·{' '}
                    <span className="font-semibold text-bo-foreground">{totalItems}</span> sản phẩm
                </span>
                <Button
                    onClick={handleSubmit}
                    disabled={submitting || selected.size === 0}
                    className="flex h-11 items-center justify-center gap-2 rounded-md bg-bo-primary px-8 font-semibold text-white hover:bg-bo-primary-hover disabled:opacity-50"
                >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Gửi yêu cầu mua hàng
                </Button>
            </FormActions>

            {/* ── Confirm Dialog ── */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent className="overflow-hidden rounded-lg border border-bo-border bg-white p-0 text-bo-foreground shadow-lg sm:max-w-md">
                    <div className="flex items-center gap-3 border-b border-bo-border bg-bo-primary-soft px-5 py-4">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-bo-primary">
                            <Send className="size-5" />
                        </div>
                        <DialogTitle className="m-0 text-base font-semibold text-bo-foreground">
                            Xác nhận tạo yêu cầu
                        </DialogTitle>
                    </div>
                    <div className="bg-white p-5">
                        <DialogDescription className="mb-5 text-sm leading-relaxed text-bo-muted">
                            Yêu cầu sẽ được gửi đến quản lý để xét duyệt. Sau khi duyệt, hệ thống sẽ tạo đơn báo giá gửi đến nhà cung cấp.
                        </DialogDescription>

                        <div className="mb-5 space-y-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-4 text-sm">
                            <div className="flex items-center justify-between border-b border-bo-border pb-2">
                                <span className="font-medium text-bo-muted">Kho nhập:</span>
                                <span className="text-[15px] font-semibold text-bo-foreground">{selectedWarehouse?.tenKho || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-bo-border pb-2">
                                <span className="font-medium text-bo-muted">Ngày giao:</span>
                                <span className="text-[15px] font-semibold text-bo-foreground">{formatDate(ngayGiaoDuKien)}</span>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                                <span className="flex items-center gap-1.5 font-medium text-bo-muted"><Layers className="size-4" /> Tổng sản phẩm:</span>
                                <span className="rounded-md bg-bo-primary-soft px-2 py-0.5 text-[16px] font-bold text-bo-primary">{totalItems} SP ({selected.size} biến thể)</span>
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={submitting}
                                className="h-11 w-full rounded-md border-bo-border bg-white font-medium text-bo-foreground hover:bg-bo-surface-subtle sm:w-auto">
                                Hủy bỏ
                            </Button>
                            <Button onClick={confirmCreate} disabled={submitting}
                                className="h-11 w-full rounded-md bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover sm:w-auto">
                                {submitting
                                    ? <><Loader2 className="mr-2 size-5 animate-spin" />Đang tạo...</>
                                    : <><Check className="mr-2 size-4" />Xác nhận tạo</>
                                }
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </PageContainer>
    );
}
