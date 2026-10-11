import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    FileText, ArrowLeft, Loader2, ClipboardList, Truck,
    Building2, Package, CheckCircle, DollarSign
} from "lucide-react";

import apiClient from "@/services/apiClient";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import FormSection from "@/components/shared/FormSection";
import FormActions from "@/components/shared/FormActions";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (v) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);

export default function PurchaseOrderCreateManual() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // --- States ---
    const [quotationList, setQuotationList] = useState([]);
    const [selectedQuotation, setSelectedQuotation] = useState(null);

    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    const [form, setForm] = useState({
        quotationId: "",
        ghiChu: "",
    });

    const loadQuotationDetails = useCallback(async (id) => {
        setActionLoading(true);
        try {
            const res = await apiClient.get(`/api/v1/don-mua-hang/get-by-id/${id}`);
            const data = res.data?.data || res.data;

            setSelectedQuotation(data);
            setForm(prev => ({
                ...prev,
                quotationId: data.id,
            }));
        } catch {
            toast.error("Không thể tải chi tiết báo giá");
            setSelectedQuotation(null);
            setForm(prev => ({ ...prev, quotationId: "" }));
        } finally {
            setActionLoading(false);
        }
    }, []);

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            // Lấy trực tiếp danh sách Đơn mua hàng (Báo giá) có trạng thái = 2 (Đã nhận báo giá)
            const res = await apiClient.post('/api/v1/don-mua-hang/filter', {
                filters: [{ fieldName: "trangThai", operation: "EQUALS", value: 2, logicType: "AND" }],
                sorts: [{ fieldName: "ngayCapNhat", direction: "DESC" }],
                page: 0, size: 1000
            });

            setQuotationList(res.data?.data?.content || res.data?.content || []);

            // Auto-fill nếu URL có truyền sẵn ID
            const initialId = searchParams.get("id");
            if (initialId) {
                await loadQuotationDetails(initialId);
            }
        } catch {
            toast.error("Không thể tải danh sách báo giá");
        } finally {
            setLoading(false);
        }
    }, [loadQuotationDetails, searchParams]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    useEffect(() => {
        queueMicrotask(() => fetchInitialData());
    }, [fetchInitialData]);

    const handleSelectQuotation = (id) => {
        if (!id) {
            setSelectedQuotation(null);
            setForm(prev => ({ ...prev, quotationId: "" }));
            return;
        }
        loadQuotationDetails(id);
    };

    const handleCreate = () => {
        if (!form.quotationId) return toast.error("Vui lòng chọn một báo giá từ danh sách");
        setShowConfirmDialog(true);
    };

    const confirmCreate = async () => {
        setSubmitting(true);
        try {
            await apiClient.put(`/api/v1/nghiep-vu/don-mua-hang/duyet-don/${form.quotationId}/3`);

            toast.success('Đã chấp nhận báo giá và tạo đơn mua hàng.');
            setShowConfirmDialog(false);
            setTimeout(() => navigate(`/purchase-orders/${form.quotationId}`), 1000);
        } catch (err) {
            console.error('Error creating PO:', err);
            toast.error(err.response?.data?.message || 'Không thể tạo đơn mua hàng. Vui lòng thử lại.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <PageContainer>
                <SurfaceCard title="Tạo đơn mua hàng" description="Đang chuẩn bị dữ liệu">
                    <LoadingState rows={4} label="Đang tải dữ liệu khởi tạo" />
                </SurfaceCard>
            </PageContainer>
        );
    }

    return (
        <PageContainer className="space-y-5">
            <PageHeader
                eyebrow="Mua hàng"
                title="Tạo đơn mua hàng"
                description="Chọn một báo giá đã nhận để chốt giá với nhà cung cấp và khởi tạo đơn mua hàng."
                actions={
                    <Link
                        to="/purchase-orders"
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-bo-border bg-white px-3 text-sm font-medium text-bo-foreground transition-colors hover:bg-bo-surface-subtle"
                    >
                        <ArrowLeft className="size-4" />
                        Quay lại danh sách
                    </Link>
                }
            />

            {/* ── Main Layout: 2 Columns ── */}
            <div className="flex flex-col items-start gap-5 lg:flex-row">

                {/* ════ LEFT COLUMN (Settings) ════ */}
                <aside className="w-full shrink-0 lg:w-[400px]">
                    <FormSection
                        title="Thông tin báo giá"
                        description="Chọn báo giá cần chốt để tạo đơn mua hàng."
                    >
                        <div className="space-y-5">
                            {/* Chọn Báo Giá */}
                            <div className="space-y-1.5">
                                <label htmlFor="quotationId" className="text-xs font-semibold uppercase tracking-wide text-bo-muted">
                                    Chọn Báo giá (PO) <span className="text-bo-danger">*</span>
                                </label>
                                <select
                                    id="quotationId"
                                    className="h-10 w-full cursor-pointer rounded-md border border-bo-border bg-white px-3 text-sm font-semibold text-bo-foreground transition-colors focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                                    value={form.quotationId}
                                    onChange={(e) => handleSelectQuotation(e.target.value)}
                                    disabled={actionLoading}
                                >
                                    <option value="">-- Vui lòng chọn --</option>
                                    {quotationList.map(q => (
                                        <option key={q.id} value={q.id}>
                                            {q.soDonMua} - {q.nhaCungCap?.tenNhaCungCap || "Chưa rõ"}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Mã đơn */}
                            <div className="space-y-1.5">
                                <label htmlFor="soDonMua" className="text-xs font-semibold uppercase tracking-wide text-bo-muted">
                                    Mã đơn mua hàng
                                </label>
                                <Input
                                    id="soDonMua"
                                    value={selectedQuotation ? selectedQuotation.soDonMua : ''}
                                    readOnly
                                    placeholder="Sẽ tự động điền khi chọn báo giá"
                                    className="h-10 border-bo-border bg-bo-surface-subtle font-mono text-sm font-semibold text-bo-primary"
                                />
                            </div>

                            {/* Info NCC rút gọn */}
                            {selectedQuotation && (
                                <div className="rounded-lg border border-bo-border bg-bo-surface-subtle p-4">
                                    <div className="mb-2 flex items-center gap-2">
                                        <Building2 className="size-4 text-bo-muted" />
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Nhà cung cấp</p>
                                    </div>
                                    <p className="text-sm font-semibold text-bo-foreground">{selectedQuotation.nhaCungCap?.tenNhaCungCap}</p>
                                    <p className="mt-0.5 font-mono text-xs text-bo-muted">{selectedQuotation.nhaCungCap?.maNhaCungCap}</p>

                                    <div className="mt-3 border-t border-bo-border pt-3">
                                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Tổng tiền báo giá</p>
                                        <p className="text-xl font-bold tracking-tight text-bo-primary">
                                            {formatCurrency(selectedQuotation.tongTien)}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </FormSection>
                </aside>

                {/* ════ RIGHT COLUMN (Preview) ════ */}
                <div className="min-w-0 flex-1">
                    <TableShell
                        title="Chi tiết sản phẩm"
                        description="Sản phẩm thuộc báo giá đã chọn."
                        toolbar={
                            selectedQuotation ? (
                                <div className="flex items-center gap-2 border-b border-bo-border px-4 py-2.5 sm:px-5">
                                    <span className="text-xs font-medium text-bo-muted">Từ yêu cầu gốc:</span>
                                    <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-bo-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-blue-700">
                                        <FileText className="size-3.5" />
                                        #{selectedQuotation.yeuCauMuaHang?.soYeuCauMuaHang || selectedQuotation.yeuCauMuaHang?.id}
                                    </span>
                                </div>
                            ) : null
                        }
                    >
                        {!selectedQuotation ? (
                            <EmptyState
                                icon={Truck}
                                title="Vui lòng chọn báo giá bên trái"
                                description="Danh sách sản phẩm của báo giá sẽ hiển thị tại đây sau khi bạn chọn."
                            />
                        ) : (
                            <table className="w-full min-w-[720px] text-sm">
                                <thead>
                                    <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                        <th className="h-10 w-[350px] px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Sản phẩm</th>
                                        <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">SL duyệt</th>
                                        <th className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Đơn giá</th>
                                        <th className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thành tiền</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-bo-border">
                                    {selectedQuotation.chiTietDonMuaHangs?.map((ct, idx) => (
                                        <tr key={ct.id || idx} className="transition-colors hover:bg-bo-surface-subtle">
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-3">
                                                    {ct.bienTheSanPham?.anhBienThe?.tepTin?.duongDan ? (
                                                        <div className="size-11 shrink-0 overflow-hidden rounded-lg border border-bo-border bg-slate-100">
                                                            <img src={ct.bienTheSanPham.anhBienThe.tepTin.duongDan} alt="Ảnh sản phẩm" className="size-full object-cover" />
                                                        </div>
                                                    ) : (
                                                        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-bo-border bg-slate-100">
                                                            <Package className="size-5 text-slate-300" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold leading-tight text-bo-foreground">
                                                            {ct.bienTheSanPham?.tenSanPham || ct.bienTheSanPham?.tenBienThe || 'Sản phẩm'}
                                                        </p>
                                                        <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-bo-muted">
                                                            <span>{ct.bienTheSanPham?.maSku}</span>
                                                            <span className="text-slate-300">|</span>
                                                            <span>{ct.bienTheSanPham?.mauSac?.tenMau} - {ct.bienTheSanPham?.size?.maSize}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <span className="inline-flex items-center rounded-md border border-blue-200 bg-bo-primary-soft px-3 py-1 text-sm font-bold text-bo-primary">
                                                    {ct.soLuongDat || 0}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <span className="text-sm font-semibold text-bo-foreground">
                                                    {formatCurrency(ct.donGia)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <span className="text-[15px] font-bold tracking-tight text-bo-success">
                                                    {formatCurrency(ct.thanhTien)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!selectedQuotation.chiTietDonMuaHangs || selectedQuotation.chiTietDonMuaHangs.length === 0) && (
                                        <tr>
                                            <td colSpan={4}>
                                                <EmptyState
                                                    icon={Package}
                                                    title="Báo giá này chưa có sản phẩm chi tiết"
                                                    description="Nhà cung cấp chưa cập nhật chi tiết sản phẩm cho báo giá."
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
                    disabled={actionLoading || !form.quotationId}
                    className="h-10 gap-2 bg-bo-primary px-6 font-semibold text-white hover:bg-bo-primary-hover disabled:opacity-50"
                >
                    {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                    Chấp nhận &amp; Tạo Đơn
                </Button>
            </FormActions>

            {/* ── Confirm Dialog ── */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent className="overflow-hidden rounded-lg border border-bo-border bg-white p-0 shadow-lg sm:max-w-md">
                    <div className="flex items-center gap-3 border-b border-bo-border bg-white p-5">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-bo-success-soft text-bo-success">
                            <CheckCircle className="size-5" />
                        </div>
                        <div>
                            <DialogTitle className="m-0 text-lg font-semibold text-bo-foreground">Xác nhận tạo đơn hàng</DialogTitle>
                            <DialogDescription className="mt-1 text-[13px] text-slate-500">
                                Hành động này sẽ chốt báo giá với nhà cung cấp.
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="space-y-5 bg-white p-5">
                        <div className="space-y-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-4 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-bo-muted">Mã đơn mua:</span>
                                <span className="font-mono text-[15px] font-semibold text-bo-primary">{selectedQuotation?.soDonMua}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-bo-muted">Nhà cung cấp:</span>
                                <span className="font-semibold text-bo-foreground">{selectedQuotation?.nhaCungCap?.tenNhaCungCap}</span>
                            </div>
                            <div className="h-px bg-bo-border" />
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 font-medium text-bo-muted">
                                    <DollarSign className="size-4" /> Tổng tiền chốt:
                                </span>
                                <span className="text-lg font-bold text-bo-success">{formatCurrency(selectedQuotation?.tongTien)}</span>
                            </div>
                        </div>

                        <DialogFooter className="gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setShowConfirmDialog(false)}
                                disabled={submitting}
                                className="h-10 flex-1 border-bo-border bg-white font-medium text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                Hủy bỏ
                            </Button>
                            <Button
                                onClick={confirmCreate}
                                disabled={submitting}
                                className="h-10 flex-1 gap-2 bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover disabled:opacity-50"
                            >
                                {submitting ? <><Loader2 className="size-4 animate-spin" />Đang xử lý...</> : <><CheckCircle className="size-4" />Xác nhận</>}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </PageContainer>
    );
}
