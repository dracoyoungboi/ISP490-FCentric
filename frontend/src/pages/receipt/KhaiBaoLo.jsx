import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { toast } from "sonner";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Database,
    Info,
    Loader2,
    RefreshCcw,
    Trash2,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import StatusBadge from "@/components/shared/StatusBadge";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import { Button } from "@/components/ui/button";

const DEFAULT_FORM = { maLo: "", nsx: "", soLuongNhap: "", ghiChu: "" };

const FIELD_CLASS =
    "h-9 w-full rounded-md border border-bo-border bg-white px-3 text-sm text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15";

export default function KhaiBaoLo() {
    const { phieuNhapKhoId, bienTheSanPhamId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [detail, setDetail] = useState(null);
    const [lotList, setLotList] = useState([]);
    const [form, setForm] = useState(DEFAULT_FORM);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedLot, setSelectedLot] = useState(null);

    const resetForm = useCallback(() => setForm(DEFAULT_FORM), []);

    const checkIsEditable = () => {
        if (!detail?.phieu) return false;
        return detail.phieu.trangThai === 0 &&
               !(detail.phieu.loaiNhap || "").includes("Chuyển kho") &&
               !(detail.phieu.loaiNhap || "").includes("hoàn trả");
    };

    const isEditable = checkIsEditable();
    const isAutoLotMode = detail?.phieu?.loaiNhap?.includes("Chuyển kho") || detail?.phieu?.loaiNhap?.includes("hoàn trả");

    const fetchDetail = useCallback(async () => {
        try {
            const [resDetail, resLots] = await Promise.all([
                phieuNhapKhoService.getDetail(phieuNhapKhoId),
                phieuNhapKhoService.getLotInput(phieuNhapKhoId, Number(bienTheSanPhamId))
            ]);
            const item = resDetail.items.find(i => i.bienTheSanPhamId === Number(bienTheSanPhamId));
            if (!item) {
                toast.error("Không tìm thấy biến thể trong phiếu nhập");
                return navigate(-1);
            }
            setDetail({ phieu: resDetail, item });
            setLotList(Array.isArray(resLots?.data) ? resLots.data : []);
        } catch {
            toast.error("Lỗi khi tải dữ liệu");
        }
    }, [phieuNhapKhoId, bienTheSanPhamId, navigate]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu vẫn tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => {
            fetchDetail();
            resetForm();
        });
    }, [fetchDetail, resetForm]);

    async function handleSaveLot() {
        if (!isEditable) return toast.error("Phiếu đã khóa hoặc lô tự động");
        const { maLo, soLuongNhap, nsx, ghiChu } = form;
        if (!maLo || !soLuongNhap || !nsx) return toast.error("Nhập đầy đủ thông tin bắt buộc");
        setLoading(true);
        try {
            await phieuNhapKhoService.khaiBaoLo(phieuNhapKhoId, {
                bienTheSanPhamId: Number(bienTheSanPhamId),
                maLo, ngaySanXuat: nsx ? `${nsx}T00:00:00.000Z` : null,
                soLuongNhap: Number(soLuongNhap), ghiChu,
            });
            toast.success("Khai báo lô thành công");
            await fetchDetail(); resetForm();
        } catch { toast.error("Không thể khai báo lô"); }
        finally { setLoading(false); }
    }

    async function handleDelete() {
        if (!selectedLot) return;
        try {
            await phieuNhapKhoService.deleteLo(phieuNhapKhoId, selectedLot.chiTietPhieuNhapKhoId);
            toast.success("Xóa lô thành công");
            await fetchDetail(); setShowDeleteConfirm(false); setSelectedLot(null);
        } catch { toast.error("Không thể xóa lô"); }
    }

    if (!detail) {
        return (
            <PageContainer>
                <LoadingState rows={3} label="Đang tải dữ liệu lô hàng" />
            </PageContainer>
        );
    }

    const { item } = detail;
    const isEnough = (item.soLuongDaKhaiBao ?? 0) >= item.soLuongCanNhap;

    return (
        <PageContainer className="space-y-5">
            <button
                type="button"
                onClick={() => navigate(`/goods-receipts/${phieuNhapKhoId}`)}
                className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
            >
                <ArrowLeft className="size-4" />
                Quay lại chi tiết phiếu nhập
            </button>

            <PageHeader
                title="Khai báo lô hàng"
                description="Khai báo thông tin lô cho biến thể sản phẩm trong phiếu nhập kho."
            />

            {/* ── Info Component ── */}
            <SurfaceCard
                title="Thông tin biến thể"
                action={<StatusBadge label={`SKU: ${item.sku}`} tone="neutral" dot={false} />}
            >
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoItem label="Sản phẩm" value={item.tenBienThe} />
                    <InfoItem label="Mã SKU" value={item.sku} isBadge />
                    <InfoItem label="Cần nhập" value={item.soLuongCanNhap} />
                    <InfoItem
                        label="Đã khai báo"
                        value={`${isAutoLotMode ? item.soLuongCanNhap : (item.soLuongDaKhaiBao ?? 0)} / ${item.soLuongCanNhap}`}
                        highlight={isEnough || isAutoLotMode}
                    />
                </div>
            </SurfaceCard>

            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
                {/* ── Lot List ── */}
                <div className="lg:col-span-2">
                    <TableShell
                        title="Danh sách lô"
                        description={isEditable ? "Chọn một dòng để đưa thông tin lô vào biểu mẫu." : undefined}
                        toolbar={
                            !isEditable ? (
                                <div className="flex items-center justify-end border-b border-bo-border px-4 py-2.5 sm:px-5">
                                    <StatusBadge
                                        label={isAutoLotMode ? "Lô tự động" : "Chỉ xem"}
                                        tone="neutral"
                                        dot={false}
                                    />
                                </div>
                            ) : null
                        }
                    >
                        {lotList.length === 0 ? (
                            <EmptyState
                                icon={Database}
                                title="Chưa có dữ liệu lô hàng"
                                description="Khai báo lô hàng cho biến thể này bằng biểu mẫu bên cạnh."
                            />
                        ) : (
                            <table className="w-full min-w-[560px] text-sm">
                                <thead>
                                    <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                        <th className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Mã lô</th>
                                        <th className="h-10 px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày SX</th>
                                        <th className="h-10 px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Số lượng</th>
                                        <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-bo-border">
                                    {lotList.map((lo) => (
                                        <tr
                                            key={lo.loHangId}
                                            className={isEditable ? "cursor-pointer transition-colors hover:bg-bo-surface-subtle" : ""}
                                            onClick={() => isEditable && setForm({
                                                maLo: lo.maLo, nsx: lo.ngaySanXuat?.slice(0, 10) || "",
                                                soLuongNhap: lo.soLuongNhap, ghiChu: lo.ghiChu || ""
                                            })}
                                        >
                                            <td className="px-4 py-3">
                                                <span className="inline-flex rounded-md bg-bo-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-bo-primary">
                                                    #{lo.maLo}
                                                </span>
                                                <div className="mt-1 max-w-[180px] truncate text-[11px] text-bo-muted">{lo.ghiChu || "-"}</div>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-center font-medium text-bo-foreground">
                                                {lo.ngaySanXuat ? new Date(lo.ngaySanXuat).toLocaleDateString("vi-VN") : "-"}
                                            </td>
                                            <td className="px-4 py-3 text-center font-semibold text-bo-foreground">{lo.soLuongNhap}</td>
                                            <td className="px-4 py-3 text-right">
                                                {isEditable ? (
                                                    <button
                                                        type="button"
                                                        aria-label={`Xóa lô ${lo.maLo}`}
                                                        className="inline-flex size-8 items-center justify-center rounded-md text-bo-danger transition-colors hover:bg-bo-danger-soft"
                                                        onClick={(e) => {
                                                            e.stopPropagation(); setSelectedLot(lo); setShowDeleteConfirm(true);
                                                        }}
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </button>
                                                ) : <Info className="inline-block size-4 text-bo-muted" />}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </TableShell>
                </div>

                {/* ── Form / Status ── */}
                <div className="lg:col-span-1">
                    {isEditable ? (
                        <SurfaceCard title="Cập nhật lô">
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-medium text-bo-foreground">Mã lô</label>
                                    <input
                                        className={FIELD_CLASS}
                                        name="maLo"
                                        placeholder="Ví dụ: LO-001"
                                        value={form.maLo}
                                        onChange={e => setForm(p => ({ ...p, maLo: e.target.value }))}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-medium text-bo-foreground">Ngày sản xuất</label>
                                    <input
                                        className={FIELD_CLASS}
                                        type="date"
                                        value={form.nsx}
                                        onChange={e => setForm(p => ({ ...p, nsx: e.target.value }))}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-medium text-bo-foreground">Số lượng</label>
                                    <input
                                        className={`${FIELD_CLASS} font-semibold`}
                                        type="number"
                                        placeholder="0"
                                        value={form.soLuongNhap}
                                        onChange={e => setForm(p => ({ ...p, soLuongNhap: e.target.value }))}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-medium text-bo-foreground">Ghi chú</label>
                                    <input
                                        className={FIELD_CLASS}
                                        placeholder="..."
                                        value={form.ghiChu}
                                        onChange={e => setForm(p => ({ ...p, ghiChu: e.target.value }))}
                                    />
                                </div>
                                <div className="mt-1 flex flex-col gap-2">
                                    <Button
                                        onClick={handleSaveLot}
                                        disabled={loading}
                                        className="w-full gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                                        Lưu lô hàng
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={resetForm}
                                        className="w-full gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                    >
                                        <RefreshCcw className="size-4" /> Làm mới
                                    </Button>
                                </div>
                                {isEnough && (
                                    <div className="flex items-center gap-2 rounded-lg border border-bo-success/20 bg-bo-success-soft p-3 text-xs font-semibold text-bo-success">
                                        <CheckCircle2 className="size-4 shrink-0" /> Full quantity declare
                                    </div>
                                )}
                            </div>
                        </SurfaceCard>
                    ) : (
                        <div className="flex flex-col gap-4 rounded-lg border border-bo-border bg-bo-surface-subtle p-5 text-center">
                            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-white text-bo-warning shadow-sm">
                                <AlertCircle className="size-5" />
                            </span>
                            <p className="text-sm font-medium leading-6 text-bo-muted">
                                {isAutoLotMode
                                    ? "Hệ thống đã tự động kế thừa lô hàng từ nguồn. Bạn không cần khai báo thủ công."
                                    : "Phiếu đã khóa hoặc bị hủy, không thể chỉnh sửa dữ liệu lô."}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL DELETE */}
            {showDeleteConfirm && (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-bo-foreground/40 p-4 backdrop-blur-sm"
                >
                    <div className="w-full max-w-sm overflow-hidden rounded-lg border border-bo-border bg-white shadow-lg">
                        <div className="px-5 pt-5">
                            <h2 className="text-base font-semibold text-bo-foreground">Xóa lô hàng</h2>
                            <p className="mt-2 text-sm leading-6 text-bo-muted">
                                Chắc chắn muốn xóa lô <span className="font-semibold text-bo-danger">{selectedLot?.maLo}</span>?
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-bo-border bg-bo-surface-subtle px-5 py-3.5">
                            <Button
                                variant="outline"
                                onClick={() => setShowDeleteConfirm(false)}
                                className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                Hủy
                            </Button>
                            <Button onClick={handleDelete} className="bg-bo-danger text-white hover:bg-red-700">
                                Xác nhận
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}

function InfoItem({ label, value, isBadge, highlight }) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-bo-muted">{label}</span>
            {isBadge ? (
                <span className="w-fit rounded-md bg-bo-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-bo-primary">{value}</span>
            ) : (
                <span className={highlight ? "break-words text-base font-bold text-bo-primary" : "break-words text-sm font-semibold text-bo-foreground"}>{value || "---"}</span>
            )}
        </div>
    );
}
