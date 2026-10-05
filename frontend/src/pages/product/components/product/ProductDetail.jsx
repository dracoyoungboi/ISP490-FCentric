import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Package, ChevronRight, Info, Tag, Box, ArrowLeft, ChevronLeft
} from "lucide-react";
import { toast } from "sonner";
import { productService } from "@/services/productService.js";
import { danhMucQuanAoService } from "@/services/danhMucQuanAoService.js";
import { formatCurrency } from "@/utils/formatters";
import { Button } from "@/components/ui/button";

import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";

export default function ProductDetail() {
    const { id } = useParams();
    const [product, setProduct] = useState(null);
    const [allCategories, setAllCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const navigate = useNavigate();
    const totalImages = product?.anhQuanAos?.length || 0;

    useEffect(() => {
        // Dam bao selectedImageIndex luon hop le khi so anh thay doi.
        if (totalImages === 0) {
            if (selectedImageIndex !== 0) setSelectedImageIndex(0);
            return;
        }
        if (selectedImageIndex > totalImages - 1) {
            setSelectedImageIndex(totalImages - 1);
        }
    }, [totalImages, selectedImageIndex]);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            // Luong tai du lieu chi tiet san pham:
            // Frontend -> productService.getProductById
            // -> ProductController.getById -> ProductService.getById -> ProductRepository.findById.
            // Dong thoi tai cay danh muc de dung breadcrumb cha-con.
            const [productRes, categoryRes] = await Promise.all([
                productService.getProductById(id),
                danhMucQuanAoService.getCayDanhMuc()
            ]);

            if (productRes.data?.status === 200) {
                setProduct(productRes.data.data);
            }
            if (categoryRes.data?.data) {
                setAllCategories(categoryRes.data.data);
            }
        } catch (error) {
            console.error("Lỗi fetch dữ liệu:", error);
            toast.error("Không thể tải thông tin sản phẩm");
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        // Hoãn qua microtask để tránh setState đồng bộ trong effect
        // (react-hooks/set-state-in-effect); request vẫn chạy ngay khi mount,
        // giữ nguyên hành vi cũ là chỉ tải khi có id.
        if (id) queueMicrotask(() => fetchData());
    }, [id, fetchData]);

    const handlePrevImage = () => setSelectedImageIndex((prev) => Math.max(prev - 1, 0));
    const handleNextImage = () => setSelectedImageIndex((prev) => Math.min(prev + 1, totalImages - 1));
    const showImageControls = totalImages > 1;
    const canGoPrev = selectedImageIndex > 0;
    const canGoNext = selectedImageIndex < totalImages - 1;

    const breadcrumbs = useMemo(() => {
        // Dung DFS tim duong dan danh muc tu root -> danh muc hien tai cua san pham.
        // Muc dich: hien breadcrumb dung theo cau truc cay danh muc.
        if (!product?.danhMuc || !allCategories || allCategories.length === 0) return [];
        const targetId = product.danhMuc.id;
        const findPath = (categories, idToFind, currentPath = []) => {
            for (const cat of categories) {
                const newPath = [...currentPath, cat];
                if (cat.id === idToFind) return newPath;
                if (cat.danhMucCons && cat.danhMucCons.length > 0) {
                    const found = findPath(cat.danhMucCons, idToFind, newPath);
                    if (found) return found;
                }
            }
            return null;
        };
        return findPath(allCategories, targetId) || [product.danhMuc];
    }, [product, allCategories]);

    const statusMeta = useMemo(() => {
        // Map trang thai backend sang nhan + tone hien thi tren StatusBadge.
        const configs = {
            1: { label: "Còn hàng", tone: "success" },
            0: { label: "Hết hàng", tone: "danger" },
            2: { label: "Ngừng hoạt động", tone: "neutral" }
        };
        return configs[product?.trangThai] || configs[2];
    }, [product?.trangThai]);

    const variantCount = product?.bienTheSanPhams?.length || 0;

    if (isLoading) return (
        <PageContainer>
            <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                <LoadingState label="Đang tải thông tin sản phẩm" />
            </div>
        </PageContainer>
    );

    if (!product) return (
        <PageContainer>
            <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                <EmptyState
                    icon={Package}
                    title="Sản phẩm không tồn tại trong hệ thống."
                    description="Sản phẩm có thể đã bị xóa hoặc đường dẫn không còn hợp lệ."
                />
            </div>
        </PageContainer>
    );

    return (
        <PageContainer className="space-y-5">
            {/* ── ĐIỀU HƯỚNG + BREADCRUMB ── */}
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/products")}
                    className="h-9 gap-1.5 border-bo-border bg-white px-3 text-bo-foreground hover:bg-bo-surface-subtle"
                >
                    <ArrowLeft className="size-4" />
                    Quay lại danh sách
                </Button>

                <div className="hidden h-4 w-px bg-bo-border sm:block" />

                <nav className="flex items-center gap-2 overflow-x-auto whitespace-nowrap text-sm text-bo-muted">
                    {breadcrumbs.map((cat) => (
                        <div key={cat.id} className="flex items-center gap-2">
                            <ChevronRight className="size-4 shrink-0 text-slate-300" />
                            <span>{cat.tenDanhMuc}</span>
                        </div>
                    ))}
                    <ChevronRight className="size-4 shrink-0 text-slate-300" />
                    <span className="max-w-[240px] truncate font-semibold text-bo-foreground">
                        {product.tenSanPham}
                    </span>
                </nav>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
                {/* ── THƯ VIỆN ẢNH ── */}
                <SurfaceCard>
                    <div className="group relative aspect-square overflow-hidden rounded-lg border border-bo-border bg-bo-surface-subtle">
                        {product.anhQuanAos?.[selectedImageIndex] ? (
                            <img
                                src={product.anhQuanAos[selectedImageIndex].tepTin?.duongDan}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                alt={product.tenSanPham}
                            />
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center text-bo-muted">
                                <Package className="mb-4 size-16 stroke-[1.5] text-slate-300" />
                                <p>Ảnh sản phẩm chưa được cập nhật</p>
                            </div>
                        )}

                        {showImageControls && (
                            <>
                                <button
                                    type="button"
                                    onClick={handlePrevImage}
                                    disabled={!canGoPrev}
                                    aria-label="Ảnh trước"
                                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-bo-border bg-white p-2 text-bo-foreground shadow-sm transition-colors hover:bg-bo-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <ChevronLeft className="size-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNextImage}
                                    disabled={!canGoNext}
                                    aria-label="Ảnh kế tiếp"
                                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-bo-border bg-white p-2 text-bo-foreground shadow-sm transition-colors hover:bg-bo-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <ChevronRight className="size-5" />
                                </button>
                            </>
                        )}
                    </div>

                    <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                        {product.anhQuanAos?.map((img, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedImageIndex(idx)}
                                aria-label={`Xem ảnh ${idx + 1}`}
                                className={`relative size-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                                    selectedImageIndex === idx
                                        ? "border-bo-primary"
                                        : "border-transparent hover:border-bo-border"
                                }`}
                            >
                                <img src={img.tepTin?.duongDan} className="h-full w-full object-cover" alt="thumbnail" />
                            </button>
                        ))}
                    </div>
                </SurfaceCard>

                {/* ── THÔNG TIN SẢN PHẨM ── */}
                <SurfaceCard>
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex h-6 items-center rounded-full border border-bo-border bg-bo-surface-subtle px-2.5 text-xs font-medium text-bo-muted">
                                    {product.danhMuc?.tenDanhMuc}
                                </span>
                                {product.thuongHieu?.tenThuongHieu ? (
                                    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-bo-primary bg-bo-primary-soft px-2.5 text-xs font-medium text-bo-primary">
                                        {product.thuongHieu.logoUrl ? (
                                            <img
                                                src={product.thuongHieu.logoUrl}
                                                alt=""
                                                className="size-4 rounded object-contain"
                                            />
                                        ) : (
                                            <Tag className="size-3.5" />
                                        )}
                                        {product.thuongHieu.tenThuongHieu}
                                    </span>
                                ) : (
                                    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-bo-border bg-bo-surface-subtle px-2.5 text-xs font-medium italic text-bo-muted">
                                        <Tag className="size-3.5" />
                                        Chưa xác định
                                    </span>
                                )}
                                <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
                            </div>

                            <h1 className="text-2xl font-bold leading-tight tracking-tight text-bo-foreground sm:text-3xl">
                                {product.tenSanPham}
                            </h1>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-bo-muted">
                                <span className="inline-flex items-center gap-2">
                                    <Box className="size-4" />
                                    Mã sản phẩm: <b className="text-bo-foreground">{product.maSanPham || id}</b>
                                </span>
                                <span className="inline-flex items-center gap-2">
                                    <Tag className="size-4" />
                                    Mã vạch: <b className="text-bo-foreground">{product.maVach || "Chưa cập nhật"}</b>
                                </span>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border border-bo-border bg-bo-surface-subtle p-3">
                                <p className="text-xs font-medium text-bo-muted">Giá bán mặc định</p>
                                <p className="mt-1 text-lg font-bold text-bo-foreground">{formatCurrency(product.giaBanMacDinh)}</p>
                            </div>
                            <div className="rounded-lg border border-bo-border bg-bo-surface-subtle p-3">
                                <p className="text-xs font-medium text-bo-muted">Giá vốn mặc định</p>
                                <p className="mt-1 text-lg font-bold text-bo-foreground">{formatCurrency(product.giaVonMacDinh)}</p>
                            </div>
                            <div className="rounded-lg border border-bo-border bg-bo-surface-subtle p-3">
                                <p className="text-xs font-medium text-bo-muted">Biến thể hiện có</p>
                                <p className="mt-1 text-lg font-bold text-bo-foreground">{variantCount}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-bo-foreground">Danh sách biến thể</h3>
                                <span className="text-xs text-bo-muted">{variantCount} tùy chọn</span>
                            </div>

                            <div className="overflow-hidden rounded-lg border border-bo-border bg-white">
                                <div className="max-h-[340px] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 z-10 border-b border-bo-border bg-bo-surface-subtle">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                                    Chi tiết màu sắc &amp; size
                                                </th>
                                                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                                                    Giá bán lẻ
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-bo-border">
                                            {product.bienTheSanPhams?.map((variant) => (
                                                <tr key={variant.id} className="transition-colors hover:bg-bo-surface-subtle">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="size-5 flex-shrink-0 rounded-full border border-white shadow-sm ring-2 ring-bo-border"
                                                                style={{ backgroundColor: variant.mauSac?.maMauHex || variant.mauSac?.maMau }}
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-bo-foreground">{variant.mauSac?.tenMau || "-"}</span>
                                                                <span className="text-xs text-bo-muted">Kích cỡ: {variant.size?.tenSize || "-"}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="font-bold text-bo-foreground">{formatCurrency(variant.giaBan)}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </SurfaceCard>
            </div>

            {/* ── MÔ TẢ / THÔNG SỐ ── */}
            <SurfaceCard>
                <Tabs defaultValue="desc" className="w-full">
                    <TabsList className="mb-5 h-auto w-full justify-start gap-1 rounded-lg border border-bo-border bg-bo-surface-subtle p-1 sm:w-auto">
                        <TabsTrigger
                            value="desc"
                            className="rounded-md px-4 py-2 text-sm font-semibold text-bo-muted data-[state=active]:bg-white data-[state=active]:text-bo-primary data-[state=active]:shadow-sm"
                        >
                            Mô tả chi tiết
                        </TabsTrigger>
                        <TabsTrigger
                            value="spec"
                            className="rounded-md px-4 py-2 text-sm font-semibold text-bo-muted data-[state=active]:bg-white data-[state=active]:text-bo-primary data-[state=active]:shadow-sm"
                        >
                            Thông số kỹ thuật
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="desc" className="mt-0 outline-none">
                        <div className="rounded-lg border border-bo-border bg-bo-surface-subtle p-4 leading-relaxed text-bo-foreground">
                            {product.moTa || "Hiện tại chưa có mô tả chi tiết cho sản phẩm này."}
                        </div>
                    </TabsContent>

                    <TabsContent value="spec" className="mt-0 outline-none">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="rounded-lg border border-bo-border bg-bo-surface-subtle p-4">
                                <p className="flex items-center gap-2 text-xs font-medium text-bo-muted">
                                    <Tag className="size-3.5" /> Chất liệu chính
                                </p>
                                <p className="mt-2 text-base font-semibold text-bo-foreground">
                                    {product.bienTheSanPhams?.[0]?.chatLieu?.tenChatLieu || "Thông tin đang cập nhật"}
                                </p>
                            </div>
                            <div className="rounded-lg border border-bo-border bg-bo-surface-subtle p-4">
                                <p className="flex items-center gap-2 text-xs font-medium text-bo-muted">
                                    <Tag className="size-3.5" /> Thương hiệu
                                </p>
                                <p className="mt-2 text-base font-semibold text-bo-foreground">
                                    {product.thuongHieu?.tenThuongHieu || "Chưa xác định"}
                                </p>
                            </div>
                            <div className="rounded-lg border border-bo-border bg-bo-surface-subtle p-4">
                                <p className="flex items-center gap-2 text-xs font-medium text-bo-muted">
                                    <Info className="size-3.5" /> Phân loại ngành hàng
                                </p>
                                <p className="mt-2 text-base font-semibold text-bo-foreground">
                                    {product.danhMuc?.tenDanhMuc}
                                </p>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </SurfaceCard>
        </PageContainer>
    );
}
