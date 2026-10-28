import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/lib/thongBaoNhanh';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    ChevronDown, Plus, Trash2, Send, ArrowLeft, Building2, Package,
    CheckCircle, AlertCircle, Loader2, Search, Mail,
    FileText, RotateCw, MapPin, Phone, User, ShoppingCart,
    Clock, XCircle, LockKeyhole, Info, Zap,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

import purchaseOrderCreateService from '@/services/purchaseOrderCreateService';
import apiClient from '@/services/apiClient';
import { khoService } from "@/services/khoService";

/* ─── Shared layout components ──────────────────────────────────── */
function SectionCard({ icon, iconBg, iconColor, title, children }) {
    const Icon = icon;
    return (
        <div className="rounded-2xl bg-bo-surface shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-200/80 overflow-hidden flex flex-col h-full items-stretch">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-bo-surface-subtle shrink-0">
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconBg}`}>
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
                <p className="font-bold text-slate-800 text-[14px]">{title}</p>
            </div>
            <div className="p-5 flex-1 flex flex-col gap-5 justify-start">{children}</div>
        </div>
    );
}

function InfoField({ label, value, mono = false, icon: Icon, children }) {
    return (
        <div className="space-y-1.5 flex flex-col">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-slate-500 uppercase tracking-widest">
                {Icon && <Icon className="h-3.5 w-3.5 opacity-70" />}
                {label}
            </div>
            <div className="flex-1 flex items-start mt-0.5">
                {children ?? (
                    <p className={`text-[14px] font-semibold text-slate-800 ${mono ? "font-mono font-bold tracking-tight" : ""}`}>
                        {value || "—"}
                    </p>
                )}
            </div>
        </div>
    );
}



/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
export default function PurchaseOrderCreate() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // ── Query-string params: bienTheId và khoId từ URL ──────────────────
    const urlBienTheId = searchParams.get("bienTheId")
        ? parseInt(searchParams.get("bienTheId"), 10)
        : null;
    const urlKhoId = searchParams.get("khoId")
        ? parseInt(searchParams.get("khoId"), 10)
        : null;

    /* ── Data State ── */
    const [warehouses, setWarehouses] = useState([]);
    const [productVariants, setProductVariants] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(false);

    /* ── Prefill state ── */
    const [prefillDone, setPrefillDone] = useState(false);

    /* ── Form State ── */
    const [loading] = useState(false);
    const [showSendDialog, setShowSendDialog] = useState(false);
    const [showProductDialog, setShowProductDialog] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);

    // ── Chỉ giữ các trường mà backend DTO yêu cầu ──
    const [formData, setFormData] = useState({
        khoId: urlKhoId ? String(urlKhoId) : '',
        ngayDatHang: new Date().toISOString().split('T')[0],
        ngayGiaoDuKien: '',
        ghiChu: '',
    });

    const [orderItems, setOrderItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredProducts, setFilteredProducts] = useState([]);

    /* ── Load master data ── */
    useEffect(() => {
        const loadData = async () => {
            setIsLoadingData(true);
            try {
                // Load product variants
                let variantsData = [];
                try {
                    const variantsRes = await purchaseOrderCreateService.getAllProductVariants();
                    variantsData = variantsRes?.data ?? (Array.isArray(variantsRes) ? variantsRes : []);
                    console.log('✅ Product variants loaded:', variantsData.length);
                } catch (error) {
                    console.error('❌ Failed to load product variants:', error);
                    toast.error('Không thể tải danh sách sản phẩm');
                }

                // Load warehouses
                let warehousesData = [];
                try {
                    const warehousesRes = await khoService.filter({ page: 0, size: 100, filters: [] });
                    if (warehousesRes?.data?.data?.content) warehousesData = warehousesRes.data.data.content;
                    console.log('✅ Warehouses loaded:', warehousesData.length);
                } catch (error) {
                    console.error('❌ Failed to load warehouses:', error);
                    toast.error('Không thể tải danh sách kho');
                }

                setProductVariants(variantsData);
                setFilteredProducts(variantsData);
                setWarehouses(warehousesData);

                if (variantsData.length === 0) {
                    toast.error('Không thể tải danh sách sản phẩm. Vui lòng thử lại.');
                }
            } catch (error) {
                console.error('❌ Failed to load initial data:', error);
                toast.error('Không thể tải dữ liệu ban đầu. Vui lòng thử lại.');
            } finally {
                setIsLoadingData(false);
            }
        };
        loadData();
    }, []);

    /* ── Prefill từ URL ── */
    useEffect(() => {
        if (!urlBienTheId || productVariants.length === 0 || prefillDone) return;

        const variant = productVariants.find(p => p.id === urlBienTheId);
        if (!variant) {
            console.warn(`[PrefillOrder] bienTheId=${urlBienTheId} không tìm thấy.`);
            toast.error(`Không tìm thấy sản phẩm với ID ${urlBienTheId}. Vui lòng chọn thủ công.`);
            setPrefillDone(true);
            return;
        }

        setOrderItems(prev => {
            if (prev.some(item => item.bienTheSanPhamId === variant.id)) return prev;
            return [...prev, {
                bienTheSanPhamId: variant.id,
                maBienThe: variant.maBienThe,
                tenSanPham: variant.tenSanPham,
                thuocTinh: variant.thuocTinh,
                donViTinh: variant.donViTinh || '',
                soLuongDat: 1,
                donGia: 0,
                ghiChu: '',
                anhBienThe: variant.anhBienThe || null,
            }];
        });

        toast.success(`Đã thêm sản phẩm ${variant.tenSanPham} vào đơn hàng từ URL`);
        setPrefillDone(true);
    }, [urlBienTheId, productVariants, prefillDone]);

    /* ── Filter products in dialog ── */
    useEffect(() => {
        if (!productVariants.length) return;
        if (!searchTerm.trim()) { setFilteredProducts(productVariants); return; }
        const lw = searchTerm.toLowerCase();
        setFilteredProducts(productVariants.filter(p =>
            (p.tenSanPham?.toLowerCase() || '').includes(lw) ||
            (p.maBienThe?.toLowerCase() || '').includes(lw) ||
            (p.thuocTinh?.toLowerCase() || '').includes(lw)
        ));
    }, [searchTerm, productVariants]);

    /* ── Form handlers ── */
    const handleInputChange = (field, value) =>
        setFormData(prev => ({ ...prev, [field]: value }));

    const handleAddProduct = (product) => {
        if (orderItems.some(item => item.bienTheSanPhamId === product.id)) {
            toast.error('Sản phẩm đã có trong đơn hàng.');
            return;
        }
        setOrderItems(prev => [...prev, {
            bienTheSanPhamId: product.id,
            maBienThe: product.maBienThe,
            tenSanPham: product.tenSanPham,
            thuocTinh: product.thuocTinh,
            donViTinh: product.donViTinh || '',
            soLuongDat: 1,
            donGia: 0,
            ghiChu: '',
            anhBienThe: product.anhBienThe || null,
        }]);
        setShowProductDialog(false);
        setSearchTerm('');
        toast.success('Đã thêm sản phẩm vào đơn hàng');
    };

    const handleUpdateItem = (index, field, value) =>
        setOrderItems(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });

    const handleRemoveItem = (index) => {
        setOrderItems(prev => prev.filter((_, i) => i !== index));
        toast.success('Đã xóa sản phẩm khỏi đơn hàng');
    };

    /* ── Validate ── */
    const validateForm = () => {
        if (!formData.khoId && !urlKhoId) { toast.error('Vui lòng chọn kho tiếp nhận'); return false; }
        if (!formData.ngayDatHang) { toast.error('Vui lòng chọn ngày đặt hàng'); return false; }
        if (!formData.ngayGiaoDuKien) { toast.error('Vui lòng chọn ngày giao dự kiến'); return false; }
        if (new Date(formData.ngayGiaoDuKien) <= new Date(formData.ngayDatHang)) {
            toast.error('Ngày giao dự kiến phải sau ngày đặt hàng');
            return false;
        }
        if (orderItems.length === 0) { toast.error('Vui lòng thêm ít nhất một sản phẩm'); return false; }
        for (const item of orderItems) {
            if (!item.soLuongDat || item.soLuongDat <= 0) {
                toast.error(`Số lượng sản phẩm "${item.tenSanPham}" phải lớn hơn 0`);
                return false;
            }
        }
        return true;
    };

    const handleSendToSupplier = () => {
        if (!validateForm()) return;
        setShowSendDialog(true);
    };

    /* ── Submit — chỉ gửi đúng các trường trong DonMuaHangCreating ── */
    const confirmSendEmail = async () => {
        if (!validateForm()) return;
        setSendingEmail(true);
        try {
            // ── Payload khớp đúng DTO DonMuaHangCreating ──
            const payload = {
                ngayDatHang: new Date(formData.ngayDatHang).toISOString(),
                ngayGiaoDuKien: new Date(formData.ngayGiaoDuKien).toISOString(),
                ghiChu: formData.ghiChu || '',
                chiTietDonMuaHangs: orderItems.map(item => ({
                    bienTheSanPhamId: Number(item.bienTheSanPhamId),
                    soLuongDat: Number(item.soLuongDat),
                    soLuongDaNhan: 0,
                    donGia: Number(item.donGia),
                    thanhTien: Number(item.soLuongDat) * Number(item.donGia),
                    ghiChu: item.ghiChu || '',
                })),
            };

            const khoIdToUse = formData.khoId || urlKhoId;

            await apiClient.post('/api/v1/nghiep-vu/don-mua-hang/create', payload, {
                headers: {
                    'kho_id': khoIdToUse,
                },
            });

            toast.success('Đã gửi yêu cầu duyệt nhập hàng thành công.');
            setShowSendDialog(false);
            setTimeout(() => navigate('/purchase-requests'), 2000);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Không thể gửi yêu cầu. Vui lòng thử lại.');
        } finally {
            setSendingEmail(false);
        }
    };

    const selectedWarehouse = warehouses.find(k => k.id === parseInt(formData.khoId || urlKhoId)) ?? null;

    /* ── Loading screen ── */
    if (isLoadingData) {
        return (
            <div className="p-5 bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 min-h-[calc(100vh-64px)] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 bg-bo-surface/50 backdrop-blur-sm rounded-3xl border border-slate-200/60 shadow-sm p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#b8860b]" />
                    <span className="text-[15px] font-medium text-slate-600">
                        {urlBienTheId ? 'Đang khởi tạo đơn hàng nhanh...' : 'Đang khởi tạo biểu mẫu...'}
                    </span>
                </div>
            </div>
        );
    }

    /* ══════════════════════════════════════════════════════════════════
       MAIN FORM
    ══════════════════════════════════════════════════════════════════ */
    return (
        <div className="p-5 space-y-5 bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 min-h-[calc(100vh-64px)] lux-sync">

            {/* ── Navigation ── */}
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => navigate('/purchase-requests')}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 hover:text-slate-900"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Quay lại danh sách
                </button>
            </div>

            {/* ── Info Card: Thiết lập chứng từ (không còn nhà cung cấp & số đơn) ── */}
            <SectionCard title="Thiết lập chứng từ" icon={FileText} iconBg="bg-amber-100" iconColor="text-amber-600">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                    {/* Kho tiếp nhận */}
                    <div className="space-y-2">
                        <Label className="text-[13px] font-bold text-slate-700">
                            Kho Tiếp Nhận <span className="text-rose-500">*</span>
                            {urlKhoId && (
                                <span className="text-[11px] text-amber-600 font-normal ml-1">
                                    (Đã khóa từ URL)
                                </span>
                            )}
                        </Label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild disabled={!!urlKhoId}>
                                <Button
                                    variant="outline"
                                    className={`w-full h-11 justify-between font-medium rounded-xl border-slate-200 px-4 text-[14px] ${urlKhoId ? 'bg-bo-surface-subtle cursor-not-allowed opacity-75' : ''}`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <Package className="h-4 w-4 text-slate-400 shrink-0" />
                                        <span className="truncate">
                                            {selectedWarehouse ? selectedWarehouse.tenKho : 'Chọn kho tiếp nhận...'}
                                        </span>
                                        {urlKhoId && <LockKeyhole className="h-3.5 w-3.5 text-amber-500 shrink-0 ml-1" />}
                                    </div>
                                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="w-[340px] max-h-[320px] overflow-y-auto bg-bo-surface rounded-xl shadow-lg"
                                align="start"
                            >
                                {warehouses.map((warehouse) => (
                                    <DropdownMenuItem
                                        key={warehouse.id}
                                        onClick={() => !urlKhoId && handleInputChange('khoId', warehouse.id)}
                                        className={`cursor-pointer p-3 flex flex-col items-start gap-1 rounded-lg mx-1 my-0.5 ${urlKhoId ? 'cursor-not-allowed opacity-50' : ''}`}
                                        disabled={!!urlKhoId}
                                    >
                                        <span className="font-bold text-slate-800">{warehouse.tenKho}</span>
                                        <span className="text-[12px] text-slate-500">{warehouse.diaChi}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {selectedWarehouse?.diaChi && (
                            <p className="text-[12px] text-slate-400 pl-1 flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-slate-300 inline-block" />
                                {selectedWarehouse.diaChi}
                            </p>
                        )}
                    </div>

                    {/* Ngày đặt hàng */}
                    <div className="space-y-2">
                        <Label className="text-[13px] font-bold text-slate-700">
                            Ngày Tạo <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                            type="date"
                            value={formData.ngayDatHang}
                            onChange={(e) => handleInputChange('ngayDatHang', e.target.value)}
                            className="h-11 rounded-xl border-slate-200 shadow-sm focus-visible:ring-slate-500"
                        />
                    </div>

                    {/* Ngày giao dự kiến */}
                    <div className="space-y-2">
                        <Label className="text-[13px] font-bold text-slate-700">
                            Ngày Giao Dự Kiến <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                            type="date"
                            value={formData.ngayGiaoDuKien}
                            onChange={(e) => handleInputChange('ngayGiaoDuKien', e.target.value)}
                            className="h-11 rounded-xl border-slate-200 shadow-sm focus-visible:ring-slate-500"
                        />
                    </div>
                </div>

                {/* Ghi chú */}
                <div className="space-y-2">
                    <Label className="text-[13px] font-bold text-slate-700">Ghi Chú</Label>
                    <Textarea
                        value={formData.ghiChu}
                        onChange={(e) => handleInputChange('ghiChu', e.target.value)}
                        placeholder="Ghi chú thêm về đơn hàng..."
                        className="rounded-xl border-slate-200 resize-none"
                        rows={3}
                    />
                </div>
            </SectionCard>

            {/* ── Order Items Table ── */}
            <SectionCard title="Danh sách Sản phẩm" icon={ShoppingCart} iconBg="bg-emerald-100" iconColor="text-emerald-600">

                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500 font-medium">
                        {orderItems.length > 0
                            ? `${orderItems.length} sản phẩm`
                            : 'Chưa có sản phẩm nào'}
                    </p>
                    <Button
                        type="button"
                        onClick={() => setShowProductDialog(true)}
                        className="h-9 rounded-xl gap-1.5 bg-gradient-to-r from-[#b8860b] to-[#d4a017] text-white font-semibold shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Thêm sản phẩm
                    </Button>
                </div>

                {orderItems.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl py-12 flex flex-col items-center gap-3 text-slate-400">
                        <Package className="h-10 w-10 opacity-40" />
                        <p className="font-semibold text-slate-500">Chưa có sản phẩm trong đơn hàng</p>
                        <p className="text-sm">Nhấn "Thêm sản phẩm" để bắt đầu</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-bo-surface-subtle">
                                <TableHead className="font-bold text-slate-700">Sản phẩm</TableHead>
                                <TableHead className="font-bold text-slate-700 text-center w-32">Số lượng</TableHead>
                                <TableHead className="w-10"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orderItems.map((item, index) => (
                                <TableRow key={index} className="hover:bg-bo-surface-subtle">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            {item.anhBienThe?.tepTin?.duongDan ? (
                                                <img
                                                    src={item.anhBienThe.tepTin.duongDan}
                                                    alt=""
                                                    className="h-10 w-10 rounded-xl object-cover border border-slate-200 shrink-0"
                                                />
                                            ) : (
                                                <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                                    <Package className="h-4 w-4 text-slate-400" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold text-[14px] text-slate-800">{item.tenSanPham}</p>
                                                <p className="text-[12px] text-slate-500">{item.thuocTinh}</p>
                                                <p className="font-mono text-[11px] text-amber-700 font-bold">{item.maBienThe}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Input
                                            type="number"
                                            min="1"
                                            value={item.soLuongDat}
                                            onChange={(e) => handleUpdateItem(index, 'soLuongDat', e.target.value)}
                                            className="h-9 w-24 text-center rounded-lg font-bold border-slate-200 mx-auto"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemoveItem(index)}
                                            className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-bo-danger-soft rounded-lg"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/purchase-requests')}
                        className="h-11 rounded-xl px-6 font-semibold border-slate-200"
                    >
                        Hủy bỏ
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSendToSupplier}
                        disabled={loading}
                        className="h-11 rounded-xl px-6 gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-md"
                    >
                        {loading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />Đang xử lý...</>
                        ) : (
                            <><Send className="h-4 w-4" />Gửi phê duyệt</>
                        )}
                    </Button>
                </div>
            </SectionCard>

            {/* ── Product Picker Dialog ── */}
            <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
                <DialogContent className="sm:max-w-2xl rounded-2xl overflow-hidden p-0 border-0 shadow-2xl flex flex-col max-h-[80vh]">
                    <div className="bg-[#1a1612] p-6 flex items-center gap-3 shrink-0">
                        <div className="h-10 w-10 bg-bo-surface/10 rounded-full flex items-center justify-center shrink-0">
                            <Package className="h-5 w-5 text-[#d4a017]" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-white m-0">Chọn Sản phẩm</DialogTitle>
                        </div>
                    </div>

                    <div className="px-6 pt-4 pb-3 bg-[#fffdf8] border-b border-[#eadfc8] shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#b8a98a]" />
                            <Input
                                placeholder="Tìm theo SKU, tên, thuộc tính..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-10 rounded-xl border-[#e8dcc8] bg-bo-surface focus-visible:ring-[#b8860b]"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 bg-[#fffdf8]">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-[#f8f3e8] border-b border-[#eadfc8]">
                                    <TableHead className="font-bold text-[#5a4e3a] text-[12px] uppercase tracking-wide pl-6">SKU</TableHead>
                                    <TableHead className="font-bold text-[#5a4e3a] text-[12px] uppercase tracking-wide">Sản phẩm</TableHead>
                                    <TableHead className="font-bold text-[#5a4e3a] text-[12px] uppercase tracking-wide text-center">Thao tác</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-16">
                                            <Search className="h-8 w-8 text-[#d0c3ad] mx-auto mb-2" />
                                            <p className="text-[15px] font-bold text-[#2f2a23]">Không tìm thấy mặt hàng</p>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredProducts.map((product) => {
                                    const isSelected = orderItems.some(item => item.bienTheSanPhamId === product.id);
                                    return (
                                        <TableRow
                                            key={product.id}
                                            className={`border-b border-[#f0e7d8] transition-colors ${
                                                isSelected ? 'opacity-60 bg-[#f8f3e8]' : 'bg-[#fffdf8] hover:bg-[#fff7ea]'
                                            }`}
                                        >
                                            <TableCell className="font-mono text-[13px] text-[#9c7414] font-bold whitespace-nowrap pl-6">
                                                {product.maBienThe}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    {product.anhBienThe?.tepTin?.duongDan ? (
                                                        <img
                                                            src={product.anhBienThe.tepTin.duongDan}
                                                            alt=""
                                                            className="h-10 w-10 rounded-xl object-cover border border-[#e8dcc8] shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="h-10 w-10 rounded-xl bg-[#f6f0e5] border border-[#e8dcc8] flex items-center justify-center shrink-0">
                                                            <Package className="h-4 w-4 text-[#c7b79c]" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-[14px] text-[#1e2c48] line-clamp-1">{product.tenSanPham}</p>
                                                        <p className="text-[12px] text-[#6f7f99] mt-0.5">{product.thuocTinh}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {isSelected ? (
                                                    <Button size="sm" variant="outline" disabled
                                                        className="h-8 rounded-xl gap-1 border-[#e2d5bd] text-[#a89f92] font-semibold bg-[#f7f3ea]">
                                                        <CheckCircle className="h-3.5 w-3.5" /> Đã thêm
                                                    </Button>
                                                ) : (
                                                    <Button size="sm" onClick={() => handleAddProduct(product)}
                                                        className="h-8 rounded-xl gap-1 bg-gradient-to-r from-[#b8860b] to-[#d4a017] hover:brightness-95 text-white font-semibold shadow-sm">
                                                        <Plus className="h-3.5 w-3.5" /> Lấy
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="shrink-0 border-t border-[#eadfc8] bg-[#f8f3e8] px-6 py-3 flex items-center justify-between text-xs text-[#7a6e5f]">
                        <span>
                            Hiển thị <span className="font-bold text-[#b8860b]">{filteredProducts.length}</span> mặt hàng
                        </span>
                        <span>Đã chọn: <span className="font-bold text-[#1a1612]">{orderItems.length}</span></span>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Confirm Dialog ── */}
            <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
                <DialogContent className="rounded-2xl sm:max-w-md p-0 overflow-hidden border-0 shadow-2xl">
                    <div className="bg-blue-600 p-6 flex items-center gap-3">
                        <div className="h-10 w-10 bg-bo-surface/20 rounded-full flex items-center justify-center shrink-0">
                            <Send className="h-5 w-5 text-white" />
                        </div>
                        <DialogTitle className="text-xl font-bold text-white m-0">Gửi yêu cầu duyệt nhập hàng</DialogTitle>
                    </div>
                    <div className="p-6">
                        <DialogDescription className="text-[15px] text-slate-600 mb-6">
                            Yêu cầu sẽ được gửi đến quản lý và chờ xét duyệt. Vui lòng rà soát cẩn trọng trước khi gửi.
                        </DialogDescription>
                        <div className="space-y-4 mb-6">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-bo-surface-subtle border border-slate-200 rounded-xl p-3 text-center">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kho tiếp nhận</p>
                                    <p className="font-bold text-[14px] text-slate-700 truncate">
                                        {selectedWarehouse?.tenKho || '—'}
                                    </p>
                                </div>
                                <div className="bg-bo-surface-subtle border border-slate-200 rounded-xl p-3 text-center">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mặt hàng</p>
                                    <p className="font-black text-[15px] text-emerald-600">
                                        {orderItems.length} <span className="text-[12px] font-medium text-slate-500">sp</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="gap-2 mt-4">
                            <Button
                                variant="outline"
                                onClick={() => setShowSendDialog(false)}
                                disabled={sendingEmail}
                                className="h-11 rounded-xl font-semibold w-full sm:w-auto"
                            >
                                Hủy bỏ
                            </Button>
                            <Button
                                onClick={confirmSendEmail}
                                disabled={sendingEmail}
                                className="h-11 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md w-full sm:w-auto"
                            >
                                {sendingEmail
                                    ? <><Loader2 className="h-5 w-5 animate-spin mr-2" />Đang gửi...</>
                                    : <><Send className="h-4 w-4 mr-2" />Xác nhận gửi</>
                                }
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}