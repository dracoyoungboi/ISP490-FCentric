import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { toast } from "sonner";
import PageContainer from "@/components/backoffice/PageContainer";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Package, CheckCircle2, ClipboardList } from "lucide-react";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDate } from "@/utils/formatters";
import { TRANG_THAI_PHIEU_XUAT } from "@/constants/trangThaiXuatBan";

const TH_CLASS =
    "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

// Badge trạng thái lô
function LotStatusBadge({ numValue, tonKhaDung }) {
    if (numValue <= 0) return <span className="text-xs text-bo-muted">Không dùng</span>;
    if (numValue > tonKhaDung) return <StatusBadge label="Vượt mức" tone="danger" />;
    if (numValue === tonKhaDung) return <StatusBadge label="Hết lô" tone="success" />;
    return <StatusBadge label="Một phần" tone="warning" />;
}

function PickStatTile({ icon, iconClass, label, value, valueClass, sub }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
            <div className="min-w-0">
                <p className="text-xs font-medium text-bo-muted">{label}</p>
                <p className={`mt-1 truncate text-lg font-bold tracking-tight ${valueClass || "text-bo-foreground"}`}>
                    {value}
                    {sub}
                </p>
            </div>
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                {icon}
            </span>
        </div>
    );
}

export default function PickLot() {
    const navigate = useNavigate();
    const { phieuXuatKhoId, chiTietPhieuXuatKhoId } = useParams();
    const { state } = useLocation();

    const bienTheSanPhamId = state?.bienTheSanPhamId;
    const sku              = state?.sku || "-";
    const tenBienThe       = state?.tenBienThe || "-";
    const soLuongCanXuat   = Number(state?.soLuongXuat ?? 0);
    const phieuTrangThai   = state?.phieuTrangThai;
    // Chọn lô được khi phiếu còn Nháp; phiếu bán hàng đã đóng gói (Chờ xuất) vẫn chọn lô trước khi xuất kho
    // (khớp PhieuXuatKhoService.pickLoHang)
    const isReadOnly       = !(phieuTrangThai === TRANG_THAI_PHIEU_XUAT.NHAP
        || (state?.loaiXuat === "ban_hang" && phieuTrangThai === TRANG_THAI_PHIEU_XUAT.CHO_XUAT));

    // Trang tự tải ngay khi mở nên bắt đầu ở trạng thái đang tải (không hiện "Không có lô" trước khi có kết quả)
    const [loading,  setLoading]  = useState(true);
    const [lots,     setLots]     = useState([]);
    const [pickMap,  setPickMap]  = useState({});
    // null: không lỗi; chuỗi: mô tả lỗi tải danh sách lô (không hiện nhầm "Không có lô khả dụng")
    const [loadError, setLoadError] = useState(null);

    const loadInitialData = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [lotsRes, pickedRes] = await Promise.all([
                phieuXuatKhoService.getAvailableLots(phieuXuatKhoId, bienTheSanPhamId),
                phieuXuatKhoService.getPickedLots(phieuXuatKhoId, chiTietPhieuXuatKhoId).catch(() => []),
            ]);
            setLots(Array.isArray(lotsRes) ? lotsRes : []);
            if (Array.isArray(pickedRes)) {
                const map = {};
                pickedRes.forEach(item => { map[item.loHangId] = String(item.soLuongDaPick); });
                setPickMap(map);
            }
        } catch (e) {
            setLots([]);
            setLoadError(getApiErrorMessage(e, "Đã xảy ra lỗi khi tải danh sách lô. Vui lòng thử lại."));
        }
        finally { setLoading(false); }
    }, [phieuXuatKhoId, bienTheSanPhamId, chiTietPhieuXuatKhoId]);

    useEffect(() => {
        if (!bienTheSanPhamId || !phieuXuatKhoId) {
            toast.error("Thiếu thông tin biến thể");
            navigate(-1);
            return;
        }
        // Hoãn qua microtask để tránh setState đồng bộ trong effect
        // (react-hooks/set-state-in-effect); dữ liệu lô vẫn tải ngay khi mount.
        queueMicrotask(() => loadInitialData());
    }, [phieuXuatKhoId, bienTheSanPhamId, navigate, loadInitialData]);

    const tongPickMoi = useMemo(() =>
        Object.values(pickMap).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [pickMap]);

    function handleChange(loHangId, rawValue) {
        if (isReadOnly) return;
        if (rawValue === "") { setPickMap(prev => ({ ...prev, [loHangId]: "" })); return; }
        if (!/^\d+$/.test(rawValue)) return;
        setPickMap(prev => ({ ...prev, [loHangId]: rawValue }));
    }

    async function handleSave() {
        if (isReadOnly) return;
        const entries = Object.entries(pickMap).filter(([, v]) => Number(v) > 0);
        if (entries.length === 0) { toast.error("Vui lòng nhập số lượng cần lấy"); return; }
        for (const [id, val] of entries) {
            const lot = lots.find(l => l.loHangId === Number(id));
            if (Number(val) > (lot?.soLuongKhaDung || 0)) { toast.error(`Lô ${lot?.maLo} không đủ tồn kho`); return; }
        }
        if (tongPickMoi > soLuongCanXuat) { toast.error("Tổng số lượng lấy vượt quá số lượng cần xuất"); return; }

        setLoading(true);
        try {
            await phieuXuatKhoService.pickLo(phieuXuatKhoId, {
                chiTietPhieuXuatKhoId: Number(chiTietPhieuXuatKhoId),
                loHangPicks: entries.map(([loHangId, soLuongXuat]) => ({ loHangId: Number(loHangId), soLuongXuat: Number(soLuongXuat) })),
            });
            toast.success("Chọn lô thành công");
            navigate(-1);
        } catch (e) { toast.error(e?.response?.data?.message || "Chọn lô thất bại"); }
        finally { setLoading(false); }
    }

    const daDu = tongPickMoi >= soLuongCanXuat;
    // Chưa tải xong lần đầu hoặc tải lỗi: chưa biết số đã lấy, hiện "—" thay vì 0
    const coSoDaLay = !loadError && !(loading && lots.length === 0);

    return (
        <PageContainer className="space-y-5">

            {/* ── Header ── */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={() => navigate(`/goods-issues/${phieuXuatKhoId}`)}
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
                >
                    <ArrowLeft className="size-4" />
                    Quay lại chi tiết phiếu
                </button>

                {isReadOnly && (
                    <StatusBadge label="Chế độ xem" tone="neutral" />
                )}
            </div>

            {/* ── Stats cards ── */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <PickStatTile
                    icon={<Package className="size-5" />}
                    iconClass="bg-bo-primary-soft text-bo-primary"
                    label="SKU"
                    value={<span className="font-mono text-sm">{sku}</span>}
                />
                <PickStatTile
                    icon={<ClipboardList className="size-5" />}
                    iconClass="bg-indigo-50 text-indigo-600"
                    label="Biến thể"
                    value={<span className="text-sm">{tenBienThe}</span>}
                />
                <PickStatTile
                    icon={<Package className="size-5" />}
                    iconClass="bg-bo-warning-soft text-bo-warning"
                    label="Cần xuất"
                    value={soLuongCanXuat}
                />
                <PickStatTile
                    icon={<CheckCircle2 className="size-5" />}
                    iconClass={coSoDaLay && daDu ? "bg-bo-success-soft text-bo-success" : "bg-slate-100 text-slate-400"}
                    label="Đã lấy"
                    value={coSoDaLay ? tongPickMoi : "—"}
                    valueClass={coSoDaLay && daDu ? "text-bo-success" : "text-bo-foreground"}
                    sub={coSoDaLay ? <span className="text-sm font-normal text-bo-muted">/{soLuongCanXuat}</span> : null}
                />
            </section>

            {/* ── Bảng lô hàng ── */}
            <TableShell
                title="Danh sách lô khả dụng"
                description={isReadOnly ? "Xem số lượng đã lấy ở từng lô" : "Nhập số lượng cần xuất cho từng lô"}
                footer={lots.length > 0 ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-bo-muted">
                            Tổng <span className="font-semibold text-bo-primary">{lots.length}</span> lô — Đã pick{" "}
                            <span className={`font-semibold ${tongPickMoi >= soLuongCanXuat ? "text-bo-success" : "text-bo-warning"}`}>{tongPickMoi}</span>
                            /{soLuongCanXuat}
                        </p>
                        {!isReadOnly && (
                            <Button
                                disabled={loading || tongPickMoi <= 0}
                                onClick={handleSave}
                                className="min-w-[140px] gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                            >
                                {loading
                                    ? <><Loader2 className="size-4 animate-spin" />Đang lưu...</>
                                    : <><CheckCircle2 className="size-4" />Xác nhận Lô</>
                                }
                            </Button>
                        )}
                    </div>
                ) : null}
            >
                {loading ? (
                    <LoadingState rows={4} label="Đang tải danh sách lô" />
                ) : loadError ? (
                    <ErrorState
                        title="Không tải được danh sách lô"
                        description={loadError}
                        onRetry={loadInitialData}
                    />
                ) : lots.length === 0 ? (
                    <EmptyState
                        icon={Package}
                        title="Không có lô khả dụng"
                        description="Sản phẩm này hiện không có lô hàng nào khả dụng."
                    />
                ) : (
                    <table className="w-full min-w-[760px] text-sm">
                        <thead>
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className={`${TH_CLASS} text-left`}>Mã lô</th>
                                <th className={`${TH_CLASS} text-center`}>Ngày nhập</th>
                                {!isReadOnly && <th className={`${TH_CLASS} text-center`}>Tồn khả dụng</th>}
                                <th className={`${TH_CLASS} text-center`}>Số lượng xuất</th>
                                {!isReadOnly && <th className={`${TH_CLASS} text-center`}>Trạng thái</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {lots.map((lot) => {
                                const displayValue = pickMap[lot.loHangId] ?? "";
                                const numValue     = Number(displayValue) || 0;
                                const tonKhaDung   = Number(lot.soLuongKhaDung) || 0;
                                return (
                                    <tr key={lot.loHangId} className="transition-colors hover:bg-bo-surface-subtle">
                                        <td className="px-4 py-3.5 align-middle">
                                            <span className="rounded-md bg-bo-primary-soft px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-bo-primary">
                                                {lot.maLo}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-center align-middle">
                                            <span className="text-sm text-bo-muted">
                                                {lot.ngayNhapGanNhat ? formatDate(lot.ngayNhapGanNhat) : "—"}
                                            </span>
                                        </td>
                                        {!isReadOnly && (
                                            <td className="px-4 py-3.5 text-center align-middle">
                                                <span className="inline-flex items-center justify-center rounded-md bg-bo-surface-subtle px-2.5 py-1">
                                                    <span className="text-xs font-semibold text-slate-800">{tonKhaDung}</span>
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-4 py-3.5 text-center align-middle">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                readOnly={isReadOnly}
                                                value={displayValue}
                                                onChange={(e) => handleChange(lot.loHangId, e.target.value)}
                                                placeholder="0"
                                                className={`h-9 w-24 rounded-md border text-center font-semibold transition-colors focus:outline-none ${isReadOnly
                                                    ? "cursor-not-allowed border-bo-border bg-bo-surface-subtle text-bo-muted"
                                                    : "border-bo-border bg-white text-bo-foreground focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15"
                                                    }`}
                                            />
                                        </td>
                                        {!isReadOnly && (
                                            <td className="px-4 py-3.5 text-center align-middle">
                                                <LotStatusBadge numValue={numValue} tonKhaDung={tonKhaDung} />
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </TableShell>
        </PageContainer>
    );
}
