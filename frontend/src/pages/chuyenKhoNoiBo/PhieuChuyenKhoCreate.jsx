import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "@/lib/thongBaoNhanh";
import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Plus, Trash2, Search, Package, ArrowDown, ChevronDown,
    Building2, Loader2, ArrowLeft, ClipboardList,
} from "lucide-react";

import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { donBanHangService } from "@/services/donBanHangService";
import { khoService } from "@/services/khoService";
import { laKhoGiaoDich, laKhoTong } from "@/utils/kho";
import { soNguyenDuong } from "@/utils/thamSoDuongDan";

const FIELD_LABEL_CLASS =
    "text-xs font-semibold uppercase tracking-wide text-bo-muted";
const DROPDOWN_CONTENT_CLASS =
    "z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg";
const DROPDOWN_ITEM_CLASS =
    "cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";
const TH_CLASS =
    "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

function InfoTile({ icon, iconClass, label, value, valueClass }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
            <div className="min-w-0">
                <p className="text-xs font-medium text-bo-muted">{label}</p>
                <p className={`mt-1 truncate text-base font-bold tracking-tight ${valueClass || "text-bo-foreground"}`}>
                    {value}
                </p>
            </div>
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                {icon}
            </span>
        </div>
    );
}

/** Một dòng hàng điều chuyển từ biến thể (dữ liệu /don-ban-hang/variants-for-create). */
function taoDongHang(bienThe, soLuong = 1) {
    return {
        variantId: bienThe.id,
        sku: bienThe.maBienThe,
        name: bienThe.tenSanPham,
        color: bienThe.tenMau,
        size: bienThe.tenSize,
        material: bienThe.tenChatLieu,
        quantity: soLuong,
    };
}

/**
 * Đọc đề xuất trên đường dẫn: ?khoXuatId=&khoNhapId=&bienTheId=&soLuong=
 * (nút "Chuyển … từ Kho tổng" ở Tổng quan). Không có tham số nào thì trả về null.
 * - Chỉ nhận kho có trong danh sách chọn được (đang hoạt động, không phải kho ảo).
 * - Kho xuất thiếu, sai hoặc trùng kho nhận thì dùng Kho tổng (kho bán hàng nhận hàng từ Kho tổng).
 * - Mã hàng phải nằm trong danh sách đang kinh doanh; số lượng sai thì về 1.
 */
function docDeXuatTuDuongDan(thamSo, dsKho, dsBienThe) {
    const khoXuatIdUrl = thamSo.get("khoXuatId");
    const khoNhapIdUrl = thamSo.get("khoNhapId");
    const bienTheIdUrl = thamSo.get("bienTheId");
    if (!khoXuatIdUrl && !khoNhapIdUrl && !bienTheIdUrl) return null;

    const timKho = (id) => (id ? dsKho.find((k) => String(k.id) === String(id)) : undefined);
    const khoNhap = timKho(khoNhapIdUrl);
    let khoXuat = timKho(khoXuatIdUrl);
    if ((khoXuatIdUrl || khoNhapIdUrl) && (!khoXuat || khoXuat.id === khoNhap?.id)) {
        const khoTong = dsKho.find(laKhoTong);
        khoXuat = khoTong && khoTong.id !== khoNhap?.id ? khoTong : undefined;
    }
    const bienThe = bienTheIdUrl ? dsBienThe.find((v) => String(v.id) === String(bienTheIdUrl)) : undefined;

    const canhBao = [];
    if (khoNhapIdUrl && !khoNhap) canhBao.push("Kho nhận trong đề xuất không còn chọn được (đã ngừng hoạt động hoặc không tồn tại), hãy chọn lại kho nhận.");
    if (bienTheIdUrl && !bienThe) canhBao.push("Không tìm thấy sản phẩm trong đề xuất (có thể đã ngừng kinh doanh), hãy chọn bằng nút \"Thêm sản phẩm\".");
    return {
        khoXuatId: khoXuat ? String(khoXuat.id) : "",
        khoNhapId: khoNhap ? String(khoNhap.id) : "",
        dongHang: bienThe ? taoDongHang(bienThe, soNguyenDuong(thamSo.get("soLuong"))) : null,
        canhBao,
    };
}

export default function PhieuChuyenKhoCreate() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // Chỉ điền sẵn một lần (StrictMode gọi tải dữ liệu 2 lần; không ghi đè khi người dùng đã sửa).
    const daDienSanRef = useRef(false);

    const [warehouses, setWarehouses] = useState([]);
    const [variants, setVariants] = useState([]);
    const [showProductDialog, setShowProductDialog] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ khoXuatId: "", khoNhapId: "", ghiChu: "" });
    const [transferItems, setTransferItems] = useState([]);

    const loadInitialData = useCallback(async () => {
        try {
            const [variantRes, khoRes] = await Promise.all([
                donBanHangService.getVariantsForCreate(),
                khoService.filter({ page: 0, size: 100, filters: [] }),
            ]);
            const dsBienThe = variantRes?.data?.data || variantRes?.data || [];
            setVariants(dsBienThe);
            const listKho = khoRes.data?.data?.content || khoRes.data?.content || [];
            // Bỏ Kho Trung Chuyển (kho ảo chứa hàng đang chuyển) và kho ngừng hoạt động
            const dsKho = listKho.filter(laKhoGiaoDich);
            setWarehouses(dsKho);

            if (daDienSanRef.current) return;
            const deXuat = docDeXuatTuDuongDan(searchParams, dsKho, dsBienThe);
            if (!deXuat) return;
            daDienSanRef.current = true;
            setFormData(prev => ({
                ...prev,
                khoXuatId: deXuat.khoXuatId || prev.khoXuatId,
                khoNhapId: deXuat.khoNhapId || prev.khoNhapId,
            }));
            if (deXuat.dongHang) {
                setTransferItems(prev => prev.some(i => i.variantId === deXuat.dongHang.variantId) ? prev : [...prev, deXuat.dongHang]);
            }
            if (deXuat.canhBao.length) {
                toast.warning(deXuat.canhBao.join(" "));
            } else {
                toast.success("Đã điền sẵn theo đề xuất bổ sung. Kiểm tra lại kho và số lượng trước khi tạo phiếu.");
            }
        } catch {
            toast.error("Không thể tải dữ liệu khởi tạo");
        }
    }, [searchParams]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu vẫn tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => loadInitialData());
    }, [loadInitialData]);

    const filteredProducts = useMemo(() => {
        const lower = searchTerm.toLowerCase().trim();
        if (!lower) return variants.slice(0, 10);
        return variants.filter(v =>
            v.tenSanPham?.toLowerCase().includes(lower) ||
            v.maBienThe?.toLowerCase().includes(lower)
        );
    }, [searchTerm, variants]);

    const handleAddProduct = (product) => {
        if (transferItems.some(i => i.variantId === product.id)) {
            toast.warning("Sản phẩm này đã có trong danh sách");
            return;
        }
        setTransferItems(prev => [...prev, taoDongHang(product)]);
        setShowProductDialog(false);
        setSearchTerm("");
    };

    async function handleCreate() {
        if (!formData.khoXuatId || !formData.khoNhapId)
            return toast.error("Vui lòng chọn đầy đủ kho gửi và kho nhận");
        if (formData.khoXuatId === formData.khoNhapId)
            return toast.error("Kho gửi và kho nhận không được trùng nhau");
        if (transferItems.length === 0)
            return toast.error("Vui lòng chọn ít nhất 1 sản phẩm để điều chuyển");
        try {
            setLoading(true);
            const payload = {
                khoXuatId: parseInt(formData.khoXuatId),
                khoNhapId: parseInt(formData.khoNhapId),
                ghiChu: formData.ghiChu?.trim() || "",
                chiTietXuat: transferItems.map(item => ({
                    bienTheSanPhamId: item.variantId,
                    soLuongXuat: item.quantity,
                })),
            };
            const res = await phieuChuyenKhoService.create(payload);
            toast.success("Tạo yêu cầu điều chuyển thành công");
            navigate(`/transfer-tickets/${res.id}`);
        } catch (e) {
            toast.error(e?.response?.data?.message || "Lỗi khi tạo phiếu");
        } finally {
            setLoading(false);
        }
    }

    // Ô số lượng có thể tạm trống khi đang gõ, không cộng chuỗi
    const totalQty = transferItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0);

    // ── Warehouse dropdown label helper ──
    const khoXuatLabel = formData.khoXuatId
        ? warehouses.find(k => k.id === parseInt(formData.khoXuatId))?.tenKho
        : "Chọn kho gửi";
    const khoNhapLabel = formData.khoNhapId
        ? warehouses.find(k => k.id === parseInt(formData.khoNhapId))?.tenKho
        : "Chọn kho nhận";

    return (
        <PageContainer className="space-y-5">

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => navigate("/transfer-tickets")}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
                >
                    <ArrowLeft className="size-4" />
                    Quay lại danh sách
                </button>
            </div>

            {/* ── Stats cards ── */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <InfoTile
                    icon={<Building2 className="size-5" />}
                    iconClass="bg-bo-primary-soft text-bo-primary"
                    label="Kho nguồn"
                    value={khoXuatLabel === "Chọn kho gửi"
                        ? <span className="text-sm font-normal text-bo-muted">Chưa chọn</span>
                        : khoXuatLabel}
                />
                <InfoTile
                    icon={<Building2 className="size-5" />}
                    iconClass="bg-purple-50 text-purple-600"
                    label="Kho đích"
                    value={khoNhapLabel === "Chọn kho nhận"
                        ? <span className="text-sm font-normal text-bo-muted">Chưa chọn</span>
                        : khoNhapLabel}
                />
                <InfoTile
                    icon={<Package className="size-5" />}
                    iconClass="bg-bo-warning-soft text-bo-warning"
                    label="Tổng số lượng"
                    value={totalQty}
                />
            </section>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">

                {/* ── LEFT: Thông tin lộ trình ── */}
                <SurfaceCard
                    className="lg:col-span-1"
                    title="Thông tin lộ trình"
                    description="Chọn kho xuất và kho nhập"
                    contentClassName="space-y-5"
                >
                    {/* Kho xuất */}
                    <div className="space-y-1.5">
                        <label className={FIELD_LABEL_CLASS}>
                            Kho xuất (Nguồn)
                        </label>
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="h-10 w-full justify-between border-bo-border bg-white font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    <div className="flex min-w-0 items-center">
                                        <Building2 className="mr-2 size-4 shrink-0 text-bo-muted" />
                                        <span className="truncate text-sm">{khoXuatLabel}</span>
                                    </div>
                                    <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className={`${DROPDOWN_CONTENT_CLASS} max-h-[300px] w-[260px] overflow-y-auto`}>
                                {warehouses.map((k) => (
                                    <DropdownMenuItem
                                        key={k.id}
                                        disabled={Number(formData.khoNhapId) === k.id}
                                        onClick={() => setFormData({ ...formData, khoXuatId: k.id.toString() })}
                                        className={`${DROPDOWN_ITEM_CLASS} flex flex-col items-start py-2`}
                                    >
                                        <span className="font-medium text-slate-900">{k.tenKho}</span>
                                        <span className="text-xs text-bo-muted">Mã: {k.maKho}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Arrow */}
                    <div className="flex justify-center">
                        <div className="flex size-8 items-center justify-center rounded-full bg-bo-surface-subtle">
                            <ArrowDown className="size-4 text-bo-muted" />
                        </div>
                    </div>

                    {/* Kho nhập */}
                    <div className="space-y-1.5">
                        <label className={FIELD_LABEL_CLASS}>
                            Kho nhập (Đích)
                        </label>
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="h-10 w-full justify-between border-bo-border bg-white font-normal text-bo-foreground hover:bg-bo-surface-subtle"
                                >
                                    <div className="flex min-w-0 items-center">
                                        <Building2 className="mr-2 size-4 shrink-0 text-bo-muted" />
                                        <span className="truncate text-sm">{khoNhapLabel}</span>
                                    </div>
                                    <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className={`${DROPDOWN_CONTENT_CLASS} max-h-[300px] w-[260px] overflow-y-auto`}>
                                {warehouses.map((k) => (
                                    <DropdownMenuItem
                                        key={k.id}
                                        disabled={Number(formData.khoXuatId) === k.id}
                                        onClick={() => setFormData({ ...formData, khoNhapId: k.id.toString() })}
                                        className={`${DROPDOWN_ITEM_CLASS} flex flex-col items-start py-2`}
                                    >
                                        <span className="font-medium text-slate-900">{k.tenKho}</span>
                                        <span className="text-xs text-bo-muted">Mã: {k.maKho}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Ghi chú */}
                    <div className="space-y-1.5 border-t border-bo-border pt-4">
                        <label htmlFor="ghiChu" className={FIELD_LABEL_CLASS}>
                            Ghi chú
                        </label>
                        <textarea
                            id="ghiChu"
                            value={formData.ghiChu}
                            onChange={(e) => setFormData({ ...formData, ghiChu: e.target.value })}
                            rows={3}
                            placeholder="Lý do điều phối hàng..."
                            className="w-full resize-none rounded-md border border-bo-border bg-white px-3 py-2 text-sm text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15"
                        />
                    </div>
                </SurfaceCard>

                {/* ── RIGHT: Danh sách hàng điều chuyển ── */}
                <div className="lg:col-span-3">
                    <TableShell
                        title="Danh mục hàng điều chuyển"
                        description="Chọn sản phẩm và số lượng cần chuyển"
                        toolbar={
                            <div className="flex justify-end px-4 pt-3 sm:px-5">
                                <Button
                                    onClick={() => setShowProductDialog(true)}
                                    className="h-9 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                                >
                                    <Plus className="size-4" />
                                    Thêm sản phẩm
                                </Button>
                            </div>
                        }
                        footer={transferItems.length > 0 ? (
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-bo-muted">
                                    Tổng{" "}
                                    <span className="font-semibold text-bo-primary">{transferItems.length}</span>{" "}
                                    sản phẩm —{" "}
                                    <span className="font-semibold text-bo-primary">{totalQty}</span>{" "}
                                    đơn vị
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="outline"
                                        className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                        onClick={() => navigate("/transfer-tickets")}
                                    >
                                        Hủy
                                    </Button>
                                    <Button
                                        onClick={handleCreate}
                                        disabled={loading}
                                        className="min-w-[180px] gap-2 bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover disabled:opacity-50"
                                    >
                                        {loading
                                            ? <><Loader2 className="size-4 animate-spin" />Đang xử lý...</>
                                            : <>Tạo phiếu điều chuyển</>
                                        }
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    >
                        {/* Table */}
                        {transferItems.length === 0 ? (
                            <EmptyState
                                icon={Package}
                                title="Chưa có sản phẩm nào"
                                description={'Nhấn "Thêm sản phẩm" để chọn hàng hóa cần điều chuyển.'}
                            />
                        ) : (
                            <table className="w-full min-w-[720px] text-sm">
                                <thead>
                                    <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                        <th className={`${TH_CLASS} text-left`}>
                                            Thông tin sản phẩm
                                        </th>
                                        <th className={`${TH_CLASS} w-36 text-center`}>
                                            Số lượng
                                        </th>
                                        <th className="h-10 w-14 px-4" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-bo-border">
                                    {transferItems.map((item, index) => (
                                        <tr key={item.variantId} className="transition-colors hover:bg-bo-surface-subtle">
                                            <td className="px-4 py-3.5 align-middle">
                                                <span className="font-semibold leading-snug text-bo-foreground">
                                                    {item.name}
                                                </span>
                                                <span className="mt-0.5 block font-mono text-xs text-bo-primary">
                                                    {item.sku}
                                                </span>
                                                <span className="mt-0.5 block text-xs italic text-bo-muted">
                                                    {item.color || "—"} / {item.size || "—"} / {item.material || "—"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-center align-middle">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={item.quantity}
                                                    onChange={(e) => {
                                                        let val = e.target.value;
                                                        // Chỉ parse khi có dữ liệu, nếu không để chuỗi rỗng để người dùng có thể xóa
                                                        if (val !== "") {
                                                            val = parseInt(val);
                                                            if (isNaN(val) || val < 1) val = 1;
                                                        }
                                                        setTransferItems(prev => prev.map((it, i) => i === index ? { ...it, quantity: val } : it));
                                                    }}
                                                    onBlur={(e) => {
                                                        // Khi click chuột ra ngoài, nếu để trống thì reset về 1
                                                        if (e.target.value === "") {
                                                            setTransferItems(prev => prev.map((it, i) => i === index ? { ...it, quantity: 1 } : it));
                                                        }
                                                    }}
                                                    className="h-9 w-24 rounded-md border border-bo-border bg-white text-center font-semibold text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15"
                                                />
                                            </td>
                                            <td className="px-4 py-3.5 text-center align-middle">
                                                <button
                                                    type="button"
                                                    onClick={() => setTransferItems(prev => prev.filter((_, i) => i !== index))}
                                                    aria-label="Xóa sản phẩm"
                                                    className="inline-flex size-8 items-center justify-center rounded-md border border-transparent text-bo-danger transition-colors hover:border-bo-danger/20 hover:bg-bo-danger-soft"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </TableShell>
                </div>
            </div>

            {/* ── PRODUCT SELECTOR DIALOG ── */}
            <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
                <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl gap-0 overflow-y-auto rounded-lg border border-bo-border bg-white p-0 text-bo-foreground shadow-lg outline-none">
                    {/* Panel header */}
                    <div className="flex items-center gap-3 border-b border-bo-border px-5 pb-4 pt-5">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bo-warning-soft">
                            <Search className="size-4 text-bo-warning" />
                        </div>
                        <div>
                            <p className="font-semibold leading-snug text-bo-foreground">Tìm kiếm sản phẩm</p>
                            <p className="mt-0.5 text-xs text-bo-muted">Chọn biến thể sản phẩm từ danh mục hệ thống</p>
                        </div>
                    </div>

                    {/* Search bar */}
                    <div className="px-5 py-4">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-bo-muted" />
                            <Input
                                placeholder="Nhập tên sản phẩm hoặc mã SKU..."
                                className="h-10 border-bo-border bg-white pl-9 text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-2 focus-visible:ring-bo-primary/15"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Danh sách sản phẩm */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {filteredProducts.length === 0 ? (
                            <EmptyState
                                icon={Search}
                                title="Không tìm thấy sản phẩm"
                                description="Thử tìm với từ khóa khác"
                            />
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                        <th className={`${TH_CLASS} text-left`}>
                                            Sản phẩm
                                        </th>
                                        <th className="h-10 w-24 px-4" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-bo-border">
                                    {filteredProducts.map((product) => (
                                        <tr
                                            key={product.id}
                                            onClick={() => handleAddProduct(product)}
                                            className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                                        >
                                            <td className="px-5 py-3.5 align-middle">
                                                <span className="font-semibold leading-snug text-bo-foreground">
                                                    {product.tenSanPham}
                                                </span>
                                                <span className="mt-0.5 block font-mono text-xs text-bo-primary">
                                                    {product.maBienThe}
                                                </span>
                                                <span className="mt-0.5 block text-xs italic text-bo-muted">
                                                    {product.tenMau || "—"} / {product.tenSize || "—"} / {product.tenChatLieu || "—"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-right align-middle">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleAddProduct(product); }}
                                                    className="inline-flex h-8 items-center justify-center rounded-md bg-bo-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-bo-primary-hover"
                                                >
                                                    Chọn
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Panel footer */}
                    <div className="flex items-center justify-between border-t border-bo-border bg-bo-surface-subtle px-5 py-4">
                        <p className="text-sm text-bo-muted">
                            <span className="font-semibold text-bo-primary">{filteredProducts.length}</span> kết quả
                        </p>
                        <button
                            type="button"
                            onClick={() => { setShowProductDialog(false); setSearchTerm(""); }}
                            className="inline-flex h-8 items-center justify-center rounded-md border border-bo-border bg-white px-4 text-sm font-medium text-bo-foreground transition-colors hover:bg-bo-surface-subtle"
                        >
                            Đóng
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </PageContainer>
    );
}
