import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import purchaseRequestService from "@/services/purchaseRequestService";
import apiClient from "@/services/apiClient";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    FileText, ArrowLeft, Loader2, ClipboardList, Truck,
    CheckCircle2, Send, RotateCw, Check, Users
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import FormSection from "@/components/shared/FormSection";
import FormActions from "@/components/shared/FormActions";

export default function QuotationRequestCreate() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // --- States ---
    const [prList, setPrList] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [selectedPR, setSelectedPR] = useState(null);

    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    const [form, setForm] = useState({
        prId: "",
        soDonMua: "",
        ghiChu: "",
    });

    const [selectedSupplierIds, setSelectedSupplierIds] = useState([]);

    const generateOrderNumber = useCallback(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const r = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        setForm(prev => ({ ...prev, soDonMua: `RFQ${y}${m}${d}${r}` }));
    }, []);

    const loadPRDetails = useCallback(async (id) => {
        setActionLoading(true);
        try {
            const res = await apiClient.get(`/api/v1/yeu-cau-mua-hang/get-by-id/${id}`);
            const data = res.data?.data;

            setSelectedPR(data);
            setForm(prev => ({
                ...prev,
                prId: data.id,
                ghiChu: `Tạo yêu cầu báo giá từ yêu cầu mua hàng #${data.id}`
            }));
            generateOrderNumber();
        } catch {
            toast.error("Không thể tải chi tiết yêu cầu mua hàng");
            setSelectedPR(null);
            setForm(prev => ({ ...prev, prId: "" }));
        } finally {
            setActionLoading(false);
        }
    }, [generateOrderNumber]);

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            // Lấy danh sách PR (Đã duyệt) từ API filter mới
            const prRes = await apiClient.post('/api/v1/yeu-cau-mua-hang/filter', {
                filters: [{ fieldName: "trangThai", operation: "EQUALS", value: 2, logicType: "AND" }],
                sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
                page: 0, size: 1000
            });
            setPrList(prRes.data?.data?.content || prRes.data?.content || []);

            // Lấy danh sách nhà cung cấp (chỉ hiển thị những NCC đang hoạt động: trangThai = 1)
            const suppRes = await apiClient.get('/api/supplier');
            const allSuppliers = suppRes.data?.data || [];
            setSuppliers(allSuppliers.filter(s => s.trangThai === 1));

            // Xử lý auto-fill nếu đi từ màn detail sang
            const initialPrId = searchParams.get("prId");
            if (initialPrId) {
                await loadPRDetails(initialPrId);
            }
        } catch {
            toast.error("Không thể tải dữ liệu khởi tạo");
        } finally {
            setLoading(false);
        }
    }, [loadPRDetails, searchParams]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    useEffect(() => {
        queueMicrotask(() => fetchInitialData());
    }, [fetchInitialData]);

    const handleSelectPR = (id) => {
        if (!id) {
            setSelectedPR(null);
            setForm(prev => ({ ...prev, prId: "", soDonMua: "" }));
            return;
        }
        loadPRDetails(id);
    };

    const toggleSupplier = (id) => {
        setSelectedSupplierIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleCreate = () => {
        if (!form.prId) return toast.error("Vui lòng chọn yêu cầu mua hàng");
        if (selectedSupplierIds.length === 0) return toast.error("Vui lòng chọn ít nhất một nhà cung cấp");
        setShowConfirmDialog(true);
    };

    const confirmSend = async () => {
        setSending(true);
        try {
            await purchaseRequestService.sendQuotationRequest({
                yeuCauMuaHangId: parseInt(form.prId),
                nhaCungCapIds: selectedSupplierIds,
                ghiChu: form.ghiChu,
            });

            toast.success(`Đã gửi yêu cầu báo giá đến ${selectedSupplierIds.length} NCC thành công.`);
            setShowConfirmDialog(false);
            setTimeout(() => navigate('/quotation-requests'), 1500);
        } catch (err) {
            console.error('Error sending quotation request:', err);
            toast.error(err.response?.data?.message || 'Không thể gửi yêu cầu báo giá. Vui lòng thử lại.');
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <PageContainer>
                <SurfaceCard title="Tạo yêu cầu báo giá" description="Đang chuẩn bị dữ liệu">
                    <LoadingState rows={4} label="Đang tải dữ liệu khởi tạo" />
                </SurfaceCard>
            </PageContainer>
        );
    }

    return (
        <PageContainer className="space-y-5">
            <PageHeader
                eyebrow="Mua hàng"
                title="Tạo yêu cầu báo giá"
                description="Chọn yêu cầu mua hàng đã duyệt và gửi yêu cầu báo giá tới các nhà cung cấp."
                actions={
                    <Link
                        to="/quotation-requests"
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-bo-border bg-white px-3 text-sm font-medium text-bo-foreground transition-colors hover:bg-bo-surface-subtle"
                    >
                        <ArrowLeft className="size-4" />
                        Quay lại danh sách
                    </Link>
                }
            />

            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
                {/* ── Settings (Left Column) ── */}
                <aside className="flex flex-col gap-5 lg:col-span-1">
                    <FormSection
                        title="Thông tin gửi báo giá"
                        description="Yêu cầu mua hàng, mã báo giá và nhà cung cấp nhận yêu cầu."
                    >
                        <div className="space-y-5">
                            <div className="space-y-1.5">
                                <label htmlFor="prId" className="text-xs font-semibold uppercase tracking-wide text-bo-muted">
                                    Yêu cầu mua hàng (PR) <span className="text-bo-danger">*</span>
                                </label>
                                <select
                                    id="prId"
                                    className="h-10 w-full rounded-md border border-bo-border bg-white px-3 text-sm font-semibold text-bo-foreground transition-colors focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                                    value={form.prId}
                                    onChange={(e) => handleSelectPR(e.target.value)}
                                    disabled={actionLoading}
                                >
                                    <option value="">-- Chọn yêu cầu mua hàng đã duyệt --</option>
                                    {prList.map(pr => (
                                        <option key={pr.id} value={pr.id}>
                                            {pr.soYeuCauMuaHang || `PR-${pr.id}`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="soDonMua" className="text-xs font-semibold uppercase tracking-wide text-bo-muted">
                                    Tiền tố mã báo giá (Tùy chọn)
                                </label>
                                <div className="flex gap-2">
                                    <Input
                                        id="soDonMua"
                                        value={form.soDonMua}
                                        onChange={(e) => setForm(prev => ({ ...prev, soDonMua: e.target.value }))}
                                        placeholder="VD: RFQ2024..."
                                        className="h-10 flex-1 border-bo-border bg-white font-mono text-sm font-semibold text-bo-primary"
                                    />
                                    <Button
                                        type="button" variant="outline" onClick={generateOrderNumber}
                                        className="size-10 shrink-0 border-bo-border bg-white p-0 text-bo-primary hover:bg-bo-primary-soft"
                                        title="Tự sinh mã"
                                        aria-label="Tự sinh mã báo giá"
                                    >
                                        <RotateCw className="size-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* ── Multi-select Nhà Cung Cấp ── */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-bo-muted">
                                        Nhà Cung Cấp <span className="text-bo-danger">*</span>
                                    </span>
                                    {selectedSupplierIds.length > 0 && (
                                        <span className="rounded-full bg-bo-primary-soft px-2 py-0.5 text-[10px] font-semibold text-bo-primary">
                                            {selectedSupplierIds.length} đã chọn
                                        </span>
                                    )}
                                </div>
                                <div className="max-h-[240px] space-y-1 overflow-y-auto rounded-md border border-bo-border bg-bo-surface-subtle p-1.5">
                                    {suppliers.length === 0 ? (
                                        <p className="py-6 text-center text-xs italic text-bo-muted">Không có dữ liệu NCC</p>
                                    ) : suppliers.map(s => {
                                        const isSelected = selectedSupplierIds.includes(s.id);
                                        return (
                                            <button
                                                key={s.id} type="button" onClick={() => toggleSupplier(s.id)}
                                                className={`flex w-full items-center justify-between rounded-md border p-2.5 text-left transition-colors ${isSelected ? 'border-bo-primary/40 bg-white shadow-sm' : 'border-transparent hover:bg-white'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex size-4 items-center justify-center rounded border transition-colors ${isSelected ? 'border-bo-primary bg-bo-primary' : 'border-bo-border bg-white'}`}>
                                                        {isSelected && <Check className="size-3 text-white" strokeWidth={3} />}
                                                    </div>
                                                    <div>
                                                        <p className={`text-[13px] leading-tight ${isSelected ? 'font-semibold text-bo-foreground' : 'font-medium text-bo-muted'}`}>{s.tenNhaCungCap}</p>
                                                        <p className="mt-0.5 font-mono text-[10px] text-bo-muted">{s.maNhaCungCap}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </FormSection>
                </aside>

                {/* ── Content Preview (Right Column) ── */}
                <div className="lg:col-span-2">
                    <TableShell
                        title="Danh sách sản phẩm"
                        description="Sản phẩm thuộc yêu cầu mua hàng đã chọn."
                        toolbar={
                            selectedPR ? (
                                <div className="flex items-center gap-2 border-b border-bo-border px-4 py-2.5 sm:px-5">
                                    <span className="text-xs font-medium text-bo-muted">Yêu cầu gốc:</span>
                                    <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-bo-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-blue-700">
                                        <FileText className="size-3.5" />
                                        #{selectedPR.soYeuCauMuaHang || selectedPR.id}
                                    </span>
                                </div>
                            ) : null
                        }
                    >
                        {!selectedPR ? (
                            <EmptyState
                                icon={Truck}
                                title="Vui lòng chọn yêu cầu mua hàng"
                                description="Danh sách sản phẩm của yêu cầu mua hàng sẽ hiển thị tại đây sau khi bạn chọn yêu cầu mua hàng."
                            />
                        ) : (
                            <table className="w-full min-w-[640px] text-sm">
                                <thead>
                                    <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                        <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Sản phẩm</th>
                                        <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Số lượng yêu cầu</th>
                                        <th className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-bo-border">
                                    {selectedPR.chiTietYeuCauMuaHangs?.map((ct, idx) => (
                                        <tr key={ct.id || idx} className="transition-colors hover:bg-bo-surface-subtle">
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft text-bo-primary">
                                                        <ClipboardList className="size-4" />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-bo-foreground">
                                                            {ct.bienTheSanPham?.tenSanPham || ct.bienTheSanPham?.tenBienThe || 'Tên sản phẩm'}
                                                        </div>
                                                        <div className="mt-0.5 flex gap-2 font-mono text-[11px] text-bo-muted">
                                                            <span>{ct.bienTheSanPham?.maSku}</span>
                                                            <span className="text-slate-300">|</span>
                                                            <span>{ct.bienTheSanPham?.mauSac?.tenMau} - {ct.bienTheSanPham?.size?.maSize}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <span className="rounded-md bg-slate-100 px-2 py-1 text-base font-bold text-bo-foreground">
                                                    {ct.soLuongDat || 0}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <span className="ml-auto inline-flex w-max items-center gap-1 rounded-md border border-green-200 bg-bo-success-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bo-success">
                                                    <CheckCircle2 className="size-3" /> Ready
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!selectedPR.chiTietYeuCauMuaHangs || selectedPR.chiTietYeuCauMuaHangs.length === 0) && (
                                        <tr>
                                            <td colSpan={3}>
                                                <EmptyState
                                                    title="Yêu cầu này không có sản phẩm nào"
                                                    description="Yêu cầu mua hàng gốc chưa có chi tiết sản phẩm."
                                                    className="min-h-0 py-10"
                                                />
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </TableShell>
                </div>
            </div>

            {/* ── Footer Actions ── */}
            <FormActions>
                <Button
                    onClick={handleCreate}
                    disabled={actionLoading || !form.prId || selectedSupplierIds.length === 0}
                    className="h-10 gap-2 bg-bo-primary px-6 font-semibold text-white hover:bg-bo-primary-hover disabled:opacity-50"
                >
                    {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Tạo & Gửi {selectedSupplierIds.length > 0 ? `(${selectedSupplierIds.length})` : ''} báo giá
                </Button>
            </FormActions>

            {/* ── Confirm Dialog ── */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent className="overflow-hidden rounded-lg border border-bo-border bg-white p-0 shadow-lg sm:max-w-md">
                    <div className="flex items-center gap-3 border-b border-bo-border bg-white p-5">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bo-primary-soft text-bo-primary">
                            <Send className="size-5" />
                        </div>
                        <DialogTitle className="m-0 text-lg font-semibold text-bo-foreground">
                            Xác nhận gửi yêu cầu
                        </DialogTitle>
                    </div>
                    <div className="bg-white p-5">
                        <DialogDescription className="mb-5 text-sm leading-6 text-slate-600">
                            Hệ thống sẽ tạo <strong>{selectedSupplierIds.length} đơn báo giá</strong> và gửi email thông báo đồng loạt đến các nhà cung cấp đã chọn.
                        </DialogDescription>

                        <div className="mb-5 space-y-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-4 text-sm">
                            <div className="flex items-center justify-between border-b border-bo-border pb-2">
                                <span className="font-medium text-bo-muted">Mã yêu cầu gốc:</span>
                                <span className="font-semibold text-bo-foreground">{selectedPR?.soYeuCauMuaHang || `#${selectedPR?.id}`}</span>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                                <span className="flex items-center gap-1.5 font-medium text-bo-muted"><Users className="size-4" /> Số lượng gửi:</span>
                                <span className="rounded-md bg-bo-primary-soft px-2 py-0.5 text-base font-bold text-bo-primary">{selectedSupplierIds.length} NCC</span>
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowConfirmDialog(false)}
                                disabled={sending}
                                className="h-10 w-full border-bo-border bg-white font-medium text-bo-foreground hover:bg-bo-surface-subtle sm:w-auto"
                            >
                                Hủy bỏ
                            </Button>
                            <Button
                                onClick={confirmSend}
                                disabled={sending}
                                className="h-10 w-full gap-2 bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover disabled:opacity-50 sm:w-auto"
                            >
                                {sending
                                    ? <><Loader2 className="size-4 animate-spin" />Đang gửi...</>
                                    : <><Send className="size-4" />Tiến hành gửi</>
                                }
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </PageContainer>
    );
}
