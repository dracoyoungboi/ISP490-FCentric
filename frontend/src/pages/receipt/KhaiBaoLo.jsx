import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { toast } from "@/lib/thongBaoNhanh";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Database,
    Info,
    Loader2,
    RotateCcw,
    SearchX,
    Trash2,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import StatusBadge from "@/components/shared/StatusBadge";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { formatDate } from "@/utils/formatters";

// dangSua: đang sửa lô đã khai báo (máy chủ cập nhật lô theo mã lô) — mã lô bị khóa để không sinh lô thứ hai
const DEFAULT_FORM = { maLo: "", nsx: "", soLuongNhap: "", ghiChu: "", dangSua: false };

const FIELD_CLASS =
    "h-9 w-full rounded-md border border-bo-border bg-white px-3 text-sm text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15";

export default function KhaiBaoLo() {
    const { phieuNhapKhoId, bienTheSanPhamId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [detail, setDetail] = useState(null);
    // Lỗi lần tải đầu: null | "notfound-phieu" | "notfound-item" | { message }
    const [loadError, setLoadError] = useState(null);
    const [lotList, setLotList] = useState([]);
    const [form, setForm] = useState(DEFAULT_FORM);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedLot, setSelectedLot] = useState(null);
    const [deleting, setDeleting] = useState(false);
    // Khóa ngay khi bấm (state chỉ cập nhật ở lần render sau): bấm đúp không gửi 2 yêu cầu
    const savingRef = useRef(false);
    const deletingRef = useRef(false);

    const resetForm = useCallback(() => setForm(DEFAULT_FORM), []);

    const checkIsEditable = () => {
        if (!detail?.phieu) return false;
        return detail.phieu.trangThai === 0 &&
               !(detail.phieu.loaiNhap || "").includes("Chuyển kho") &&
               !(detail.phieu.loaiNhap || "").includes("hoàn trả");
    };

    const isEditable = checkIsEditable();
    const isAutoLotMode = detail?.phieu?.loaiNhap?.includes("Chuyển kho") || detail?.phieu?.loaiNhap?.includes("hoàn trả");

    // silent: tải lại sau khi lưu / xóa lô — lỗi chỉ báo toast, giữ dữ liệu đang hiện
    const fetchDetail = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoadError(null);
        try {
            const [resDetail, resLots] = await Promise.all([
                phieuNhapKhoService.getDetail(phieuNhapKhoId),
                phieuNhapKhoService.getLotInput(phieuNhapKhoId, Number(bienTheSanPhamId))
            ]);
            const item = (resDetail?.items || []).find(i => i.bienTheSanPhamId === Number(bienTheSanPhamId));
            if (!item) {
                setDetail(null);
                setLoadError("notfound-item");
                return;
            }
            setDetail({ phieu: resDetail, item });
            setLotList(Array.isArray(resLots?.data) ? resLots.data : []);
        } catch (error) {
            if (silent) {
                toast.error(getApiErrorMessage(error, "Không tải lại được dữ liệu lô hàng"));
                return;
            }
            // Máy chủ trả 400 "Không tìm thấy phiếu nhập id: …" khi mã không tồn tại
            const status = getApiErrorStatus(error);
            setLoadError(status === 404 || status === 400
                ? "notfound-phieu"
                : { message: getApiErrorMessage(error, "Không thể tải dữ liệu lô hàng") });
        }
    }, [phieuNhapKhoId, bienTheSanPhamId]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu vẫn tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => {
            fetchDetail();
            resetForm();
        });
    }, [fetchDetail, resetForm]);

    // Máy chủ (PhieuNhapKhoService.khaiBaoLo) cập nhật lô nếu trong phiếu đã có lô cùng mã, ngược lại tạo lô mới.
    // Sửa lô: bấm dòng lô → biểu mẫu chuyển sang "Sửa lô", mã lô bị khóa (đổi mã sẽ sinh lô mới, lô cũ vẫn còn).
    const chonLoDeSua = (lo) => {
        if (!isEditable || loading) return;
        setForm({
            maLo: lo.maLo,
            nsx: lo.ngaySanXuat?.slice(0, 10) || "",
            soLuongNhap: lo.soLuongNhap ?? "",
            ghiChu: lo.ghiChu || "",
            dangSua: true,
        });
    };
    const maLoTrung = !form.dangSua && form.maLo.trim()
        ? lotList.find((lo) => String(lo.maLo).trim().toLowerCase() === form.maLo.trim().toLowerCase())
        : null;

    async function handleSaveLot() {
        if (!isEditable) return toast.error("Phiếu đã khóa hoặc lô tự động");
        if (savingRef.current) return;
        const { maLo, soLuongNhap, nsx, ghiChu } = form;
        if (!maLo || !soLuongNhap || !nsx) return toast.error("Nhập đầy đủ thông tin bắt buộc");
        savingRef.current = true;
        setLoading(true);
        try {
            await phieuNhapKhoService.khaiBaoLo(phieuNhapKhoId, {
                bienTheSanPhamId: Number(bienTheSanPhamId),
                maLo, ngaySanXuat: nsx ? `${nsx}T00:00:00.000Z` : null,
                soLuongNhap: Number(soLuongNhap), ghiChu,
            });
            toast.success(form.dangSua || maLoTrung ? `Đã cập nhật lô ${maLo}` : "Khai báo lô thành công");
            resetForm();
            await fetchDetail({ silent: true });
        } catch (error) { toast.error(getApiErrorMessage(error, "Không thể khai báo lô")); }
        finally {
            savingRef.current = false;
            setLoading(false);
        }
    }

    const openDeleteConfirm = (lo) => {
        setSelectedLot(lo);
        setShowDeleteConfirm(true);
    };

    // Giữ selectedLot khi đóng để nội dung hộp thoại không nháy trống lúc đang đóng
    const closeDeleteConfirm = () => {
        if (deletingRef.current) return;
        setShowDeleteConfirm(false);
    };

    async function handleDelete() {
        if (!selectedLot || deletingRef.current) return;
        deletingRef.current = true;
        setDeleting(true);
        try {
            await phieuNhapKhoService.deleteLo(phieuNhapKhoId, selectedLot.chiTietPhieuNhapKhoId);
            toast.success("Xóa lô thành công");
            setShowDeleteConfirm(false);
            // Lô đang sửa vừa bị xóa thì trả biểu mẫu về khai báo mới
            if (form.dangSua && form.maLo === selectedLot.maLo) resetForm();
            await fetchDetail({ silent: true });
        } catch (error) { toast.error(getApiErrorMessage(error, "Không thể xóa lô")); }
        finally {
            deletingRef.current = false;
            setDeleting(false);
        }
    }

    if (!detail) {
        if (!loadError) {
            return (
                <PageContainer>
                    <LoadingState rows={3} label="Đang tải dữ liệu lô hàng" />
                </PageContainer>
            );
        }
        const notFoundPhieu = loadError === "notfound-phieu";
        const notFoundItem = loadError === "notfound-item";
        return (
            <PageContainer>
                <div className="overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
                    {notFoundPhieu || notFoundItem ? (
                        <EmptyState
                            icon={SearchX}
                            title={notFoundPhieu ? "Không tìm thấy phiếu nhập kho" : "Không tìm thấy biến thể trong phiếu nhập"}
                            description={notFoundPhieu
                                ? "Phiếu nhập kho không tồn tại hoặc đã bị xóa khỏi hệ thống."
                                : "Biến thể này không có trong phiếu nhập kho."}
                            action={
                                <Button
                                    onClick={() => navigate(notFoundPhieu ? "/goods-receipts" : `/goods-receipts/${phieuNhapKhoId}`)}
                                    className="bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover"
                                >
                                    {notFoundPhieu ? "Quay lại danh sách" : "Quay lại chi tiết phiếu nhập"}
                                </Button>
                            }
                        />
                    ) : (
                        <ErrorState
                            title="Không thể tải dữ liệu lô hàng"
                            description={loadError.message}
                            onRetry={() => fetchDetail()}
                        />
                    )}
                </div>
            </PageContainer>
        );
    }

    // Phiếu từ đơn mua kiểm đếm ở màn Kiểm đếm & khóa lô (chọn kệ, ghi hàng lỗi và lý do). Màn này không gửi kệ / số lỗi:
    // kho có kệ thì máy chủ từ chối, trùng mã lô thì ghi đè số lỗi của lô đã khóa. Cùng điều kiện với KiemDemLo (soDonMua)
    // nên hai màn không chuyển qua lại
    if (detail.phieu?.soDonMua) {
        return <Navigate to={`/goods-receipts/${phieuNhapKhoId}/receive/${bienTheSanPhamId}`} replace />;
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
                action={<span className="font-mono text-xs font-semibold text-slate-600">SKU: {item.sku}</span>}
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
                        description={isEditable ? "Bấm vào một lô để sửa. Muốn đổi mã lô thì xóa lô đó rồi khai báo lại." : undefined}
                        toolbar={
                            !isEditable ? (
                                <div className="flex items-center justify-end border-b border-bo-border px-4 py-2.5 sm:px-5">
                                    <StatusBadge
                                        label={isAutoLotMode ? "Lô tự động" : "Chỉ xem"}
                                        tone="neutral"
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
                                            onClick={() => chonLoDeSua(lo)}
                                            aria-selected={form.dangSua && form.maLo === lo.maLo}
                                            className={`transition-colors hover:bg-bo-surface-subtle ${isEditable ? "cursor-pointer" : ""} ${form.dangSua && form.maLo === lo.maLo ? "bg-bo-primary-soft" : ""}`}
                                        >
                                            <td className="px-4 py-3">
                                                <span className="inline-flex rounded-md bg-bo-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-bo-primary">
                                                    #{lo.maLo}
                                                </span>
                                                <div className="mt-1 max-w-[180px] truncate text-[11px] text-bo-muted" title={lo.ghiChu || undefined}>{lo.ghiChu || "—"}</div>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-center font-medium text-bo-foreground">
                                                {formatDate(lo.ngaySanXuat)}
                                            </td>
                                            <td className="px-4 py-3 text-center font-semibold text-bo-foreground">{lo.soLuongNhap}</td>
                                            <td className="px-4 py-3 text-right">
                                                {isEditable ? (
                                                    <RowActions className="justify-end">
                                                        <RowActionButton
                                                            icon={Trash2}
                                                            tone="danger"
                                                            label={`Xóa lô ${lo.maLo}`}
                                                            disabled={deleting}
                                                            onClick={() => openDeleteConfirm(lo)}
                                                        />
                                                    </RowActions>
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
                        <SurfaceCard title={form.dangSua ? `Sửa lô ${form.maLo}` : "Khai báo lô mới"}>
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-medium text-bo-foreground">Mã lô</label>
                                    <input
                                        className={form.dangSua ? `${FIELD_CLASS} cursor-default bg-bo-surface-subtle text-bo-muted` : FIELD_CLASS}
                                        name="maLo"
                                        placeholder="Ví dụ: LO-001"
                                        value={form.maLo}
                                        readOnly={form.dangSua}
                                        aria-describedby={maLoTrung ? "canh-bao-ma-lo" : undefined}
                                        onChange={e => setForm(p => ({ ...p, maLo: e.target.value }))}
                                    />
                                    {form.dangSua ? (
                                        <p className="text-xs text-bo-muted">Mã lô không đổi được khi sửa.</p>
                                    ) : maLoTrung ? (
                                        <p id="canh-bao-ma-lo" className="text-xs text-bo-warning">
                                            Mã lô đã có trong phiếu (số lượng {maLoTrung.soLuongNhap}). Lưu sẽ thay số lượng của lô này, không cộng thêm.
                                        </p>
                                    ) : null}
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
                                        {form.dangSua ? "Lưu thay đổi" : "Lưu lô hàng"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={resetForm}
                                        className="w-full gap-2 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
                                    >
                                        <RotateCcw className="size-4" /> {form.dangSua ? "Hủy sửa" : "Nhập lại"}
                                    </Button>
                                </div>
                                {isEnough && (
                                    <div className="flex items-center gap-2 rounded-lg border border-bo-success/20 bg-bo-success-soft p-3 text-xs font-semibold text-bo-success">
                                        <CheckCircle2 className="size-4 shrink-0" /> Đã khai báo đủ số lượng
                                    </div>
                                )}
                            </div>
                        </SurfaceCard>
                    ) : (
                        <div className="flex flex-col gap-4 rounded-lg border border-bo-border bg-bo-surface-subtle p-5 text-center">
                            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-bo-surface text-bo-warning shadow-sm">
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

            {/* Xác nhận xóa lô: khóa nút khi đang xóa */}
            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={closeDeleteConfirm}
                onConfirm={handleDelete}
                title="Xóa lô hàng"
                description={
                    <>Chắc chắn muốn xóa lô <span className="font-semibold text-bo-danger">{selectedLot?.maLo}</span>?</>
                }
                confirmText="Xóa lô"
                isLoading={deleting}
            />
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
