import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft, ArrowRight, Calendar, CheckCheck, ClipboardList, Hash,
    Info as InfoIcon, Loader2, MapPin, Package, PackageX, User, UserPlus, Warehouse,
} from "lucide-react";
import { toast } from "sonner";

import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import InfoItem from "@/components/shared/InfoItem";
import MockModeNotice from "@/components/shared/MockModeNotice";
import PickProgress from "@/components/outbound/PickProgress";
import ScanBar from "@/components/outbound/ScanBar";
import AssignPickerDialog from "@/components/outbound/AssignPickerDialog";
import ConfirmModal from "@/components/ui/confirm-modal";
import { Button } from "@/components/ui/button";
import useScanQueue from "@/hooks/useScanQueue";
import { nhatHangService, isPickListMock } from "@/services/nhatHangService";
import { PICK_LIST_EDITABLE, formatQuantity, getPickListStatus, toNumber } from "@/constants/outbound";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { playScanBeep } from "@/utils/scanBeep";
import { formatDateTime } from "@/utils/dateTime";

const TH_CLASS = "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

// Backend không cho quét quá số cần nhặt, nên mỗi dòng chỉ có hai trạng thái.
function lineState(line) {
    const can = toNumber(line.soLuongCanNhat);
    const quet = toNumber(line.soLuongDaQuet);
    if (can > 0 && quet >= can) return { label: "Đủ", tone: "success", order: 1 };
    return { label: "Còn thiếu", tone: "warning", order: 0 };
}

export default function PickListDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const scanBarRef = useRef(null);

    const [dto, setDto] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [lastResult, setLastResult] = useState(null);
    const [highlightId, setHighlightId] = useState(null);
    const [soundOn, setSoundOn] = useState(true);
    const [assignOpen, setAssignOpen] = useState(false);
    const [completeOpen, setCompleteOpen] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [completeResult, setCompleteResult] = useState(null);
    const busyRef = useRef(false);

    const fetchDetail = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        setLoadError(null);
        try {
            const res = await nhatHangService.getPickList(id);
            setDto(res);
        } catch (error) {
            setLoadError(getApiErrorStatus(error) === 404 ? "notfound" : "error");
            if (silent) toast.error(getApiErrorMessage(error, "Không tải lại được Pick List"));
        } finally {
            if (!silent) setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        queueMicrotask(() => fetchDetail());
    }, [fetchDetail]);

    // Gửi từng mã một (backend khóa Pick List khi quét)
    const processScan = useCallback(async ({ barcode, soLuong }) => {
        try {
            const res = await nhatHangService.quetBarcode(id, { barcode, soLuong });
            setDto((prev) => {
                if (!prev) return prev;
                const lines = (prev.chiTietNhatHangs ?? []).map((line) => {
                    const matched = res?.chiTietId != null
                        ? line.id === res.chiTietId
                        : line.bienTheSanPhamId === res?.bienTheId;
                    return matched ? { ...line, soLuongDaQuet: res.soLuongDaQuet } : line;
                });
                return {
                    ...prev,
                    trangThai: prev.trangThai === "cho_nhat" ? "dang_nhat" : prev.trangThai,
                    chiTietNhatHangs: lines,
                    tongSoLuongDaQuet: res?.tongSoLuongDaQuet ?? prev.tongSoLuongDaQuet,
                    phanTramHoanThanh: res?.phanTramHoanThanh ?? prev.phanTramHoanThanh,
                    coTheHoanTat: res?.coTheHoanTat ?? prev.coTheHoanTat,
                };
            });
            setHighlightId(res?.chiTietId ?? null);
            setLastResult({
                ok: true,
                message: res?.thongBao
                    || `${res?.maSku ?? barcode} +${soLuong} → ${formatQuantity(res?.soLuongDaQuet)}/${formatQuantity(res?.soLuongCanNhat)}`,
            });
            if (soundOn) playScanBeep(true);
        } catch (error) {
            setLastResult({ ok: false, message: getApiErrorMessage(error, `Không quét được mã ${barcode}`) });
            if (soundOn) playScanBeep(false);
            if (getApiErrorStatus(error) === 409) fetchDetail({ silent: true });
        }
    }, [id, soundOn, fetchDetail]);

    const { enqueue, pending } = useScanQueue(processScan);

    const lines = useMemo(() => {
        const list = [...(dto?.chiTietNhatHangs ?? [])];
        return list.sort((a, b) => {
            const diff = lineState(a).order - lineState(b).order;
            if (diff !== 0) return diff;
            return String(a.viTriKho ?? "").localeCompare(String(b.viTriKho ?? ""), "vi", { numeric: true });
        });
    }, [dto]);

    const handleComplete = async () => {
        if (busyRef.current) return;
        busyRef.current = true;
        setCompleting(true);
        try {
            const res = await nhatHangService.hoanTat(id);
            setDto(res);
            setCompleteResult({ maDonHangs: res?.danhSachMaDonHang ?? dto?.danhSachMaDonHang ?? [] });
            toast.success(`Đã hoàn tất nhặt ${res?.maPickList ?? ""}`.trim());
        } catch (error) {
            toast.error(getApiErrorMessage(error, "Không thể hoàn tất nhặt hàng"));
            if (getApiErrorStatus(error) === 409) fetchDetail({ silent: true });
        } finally {
            busyRef.current = false;
            setCompleting(false);
            setCompleteOpen(false);
        }
    };

    if (loading && !dto) {
        return (
            <PageContainer>
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <LoadingState label="Đang tải Pick List" />
                </div>
            </PageContainer>
        );
    }

    if (!dto) {
        return (
            <PageContainer className="space-y-5">
                <BackLink onClick={() => navigate("/goods-issues/pick-lists")} />
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    {loadError === "notfound" ? (
                        <EmptyState
                            icon={PackageX}
                            title="Không tìm thấy Pick List"
                            description="Pick List không tồn tại hoặc thuộc kho khác với kho đang chọn."
                        />
                    ) : (
                        <ErrorState onRetry={() => fetchDetail()} />
                    )}
                </div>
            </PageContainer>
        );
    }

    const status = getPickListStatus(dto.trangThai);
    const editable = PICK_LIST_EDITABLE.includes(dto.trangThai);
    const conLai = Math.max(0, toNumber(dto.tongSoLuongCanNhat) - toNumber(dto.tongSoLuongDaQuet));
    const maDonHangs = dto.danhSachMaDonHang ?? [];

    return (
        <PageContainer className="space-y-5">
            <MockModeNotice show={isPickListMock} />

            {/* ── Thanh thao tác ── */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <BackLink onClick={() => navigate("/goods-issues/pick-lists")} />
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={status.label} tone={status.tone} />
                    {editable ? (
                        <Button
                            variant="outline"
                            onClick={() => setAssignOpen(true)}
                            className="gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            <UserPlus className="size-4" />
                            {dto.nguoiNhatId ? "Phân công lại" : "Phân công"}
                        </Button>
                    ) : null}
                    {editable ? (
                        <span title={dto.coTheHoanTat ? undefined : `Còn ${formatQuantity(conLai)} sản phẩm chưa nhặt`}>
                            <Button
                                disabled={!dto.coTheHoanTat || completing || pending > 0}
                                onClick={() => setCompleteOpen(true)}
                                className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                            >
                                {completing ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
                                Hoàn tất nhặt
                            </Button>
                        </span>
                    ) : null}
                </div>
            </div>

            {/* ── Thông tin chung ── */}
            <SurfaceCard title="Thông tin Pick List">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoItem icon={Hash} label="Mã Pick List" value={dto.maPickList} highlight />
                    <InfoItem icon={Warehouse} label="Kho xuất" value={dto.tenKhoXuat} />
                    <InfoItem icon={User} label="Người nhặt" value={dto.tenNguoiNhat || "Chưa phân công"} />
                    <InfoItem icon={ClipboardList} label="Đơn / SKU" value={`${dto.tongDonHang ?? maDonHangs.length} đơn · ${dto.tongSku ?? lines.length} SKU`} />
                    <InfoItem icon={Calendar} label="Ngày tạo" value={formatDateTime(dto.ngayTao)} />
                    <InfoItem icon={Calendar} label="Hoàn tất nhặt" value={formatDateTime(dto.ngayHoanTat) || "Chưa hoàn tất"} />
                    {dto.ghiChu ? (
                        <div className="sm:col-span-2">
                            <InfoItem icon={InfoIcon} label="Ghi chú" value={dto.ghiChu} />
                        </div>
                    ) : null}
                </div>
                <div className="mt-5 border-t border-bo-border pt-4">
                    <PickProgress
                        daQuet={dto.tongSoLuongDaQuet}
                        canNhat={dto.tongSoLuongCanNhat}
                        percent={dto.phanTramHoanThanh}
                    />
                </div>
            </SurfaceCard>

            {/* ── Kết quả hoàn tất nhặt ── */}
            {completeResult ? (
                <CompleteResultPanel result={completeResult} onClose={() => setCompleteResult(null)} />
            ) : null}

            {/* ── Chế độ chỉ xem ── */}
            {!editable ? (
                <div className="flex items-center gap-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-3 text-sm text-slate-700">
                    <InfoIcon className="size-4 shrink-0 text-bo-muted" />
                    <p className="min-w-0 flex-1">
                        {dto.trangThai === "da_huy" || dto.trangThai === "huy"
                            ? "Pick List đã hủy."
                            : dto.trangThai === "da_nhat"
                                ? "Đã nhặt xong. Mở phiếu xuất kho nháp của từng đơn để chọn lô và hoàn thành xuất kho."
                                : "Pick List đã xuất kho."}
                    </p>
                    {dto.trangThai === "da_nhat" ? <GoodsIssueLink /> : null}
                </div>
            ) : null}

            {/* ── Quét mã ── */}
            {editable ? (
                <SurfaceCard
                    title="Quét mã vạch"
                    description="Mỗi lần quét cộng số lượng vào đúng SKU. Mã được gửi lần lượt nên có thể quét liên tục."
                >
                    <ScanBar
                        ref={scanBarRef}
                        onScan={(barcode, soLuong) => enqueue({ barcode, soLuong })}
                        pending={pending}
                        lastResult={lastResult}
                        soundOn={soundOn}
                        onToggleSound={() => {
                            setSoundOn((value) => !value);
                            scanBarRef.current?.focus();
                        }}
                    />
                </SurfaceCard>
            ) : null}

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                {/* ── Sản phẩm cần nhặt ── */}
                <TableShell
                    className="xl:col-span-2"
                    title="Sản phẩm cần nhặt"
                    description={`${lines.length} SKU · sắp theo vị trí kệ, dòng chưa đủ lên trước`}
                >
                    {lines.length === 0 ? (
                        <EmptyState icon={Package} title="Pick List không có sản phẩm" description="Đợt nhặt này chưa có dòng sản phẩm nào." />
                    ) : (
                        <table className="w-full min-w-[760px] text-sm">
                            <thead>
                                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                    <th className={`${TH_CLASS} text-left`}>Sản phẩm</th>
                                    <th className={`${TH_CLASS} text-left`}>Vị trí</th>
                                    <th className={`${TH_CLASS} text-center`}>Cần nhặt</th>
                                    <th className={`${TH_CLASS} text-center`}>Đã quét</th>
                                    <th className={`${TH_CLASS} text-center`}>Còn lại</th>
                                    <th className={`${TH_CLASS} text-center`}>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-bo-border">
                                {lines.map((line) => {
                                    const state = lineState(line);
                                    const conLaiDong = Math.max(0, toNumber(line.soLuongCanNhat) - toNumber(line.soLuongDaQuet));
                                    const variantName = [line.tenMau, line.tenSize].filter(Boolean).join(" / ");
                                    return (
                                        <tr
                                            key={line.id}
                                            className={`transition-colors ${highlightId === line.id ? "bg-bo-primary-soft" : "hover:bg-bo-surface-subtle"}`}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="line-clamp-1 font-semibold text-bo-foreground">
                                                        {line.tenSanPham}{variantName ? ` · ${variantName}` : ""}
                                                    </span>
                                                    <span className="flex flex-wrap items-center gap-1.5">
                                                        <span className="w-fit rounded-md bg-bo-primary-soft px-2 py-0.5 font-mono text-xs font-semibold text-bo-primary">
                                                            {line.maSku}
                                                        </span>
                                                        {line.maVachSku ? (
                                                            <span className="font-mono text-xs text-bo-muted">{line.maVachSku}</span>
                                                        ) : null}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3">
                                                {line.viTriKho ? (
                                                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-bo-foreground">
                                                        <MapPin className="size-3.5 text-bo-muted" />
                                                        {line.viTriKho}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-bo-muted">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center font-semibold text-bo-foreground">{formatQuantity(line.soLuongCanNhat)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`font-mono font-semibold ${state.tone === "success" ? "text-bo-success" : state.tone === "danger" ? "text-bo-danger" : "text-bo-foreground"}`}>
                                                    {formatQuantity(line.soLuongDaQuet)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center font-semibold text-bo-muted">{formatQuantity(conLaiDong)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <StatusBadge label={state.label} tone={state.tone} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </TableShell>

                {/* ── Đơn trong Pick List ── */}
                <SurfaceCard title="Đơn trong Pick List" description={`${maDonHangs.length} đơn`}>
                    {maDonHangs.length === 0 ? (
                        <p className="py-4 text-center text-sm text-bo-muted">Không có đơn nào.</p>
                    ) : (
                        <OrderCodes codes={maDonHangs} />
                    )}
                </SurfaceCard>
            </div>

            <AssignPickerDialog
                open={assignOpen}
                onOpenChange={setAssignOpen}
                pickList={dto}
                onAssigned={(res) => res && setDto((prev) => ({ ...prev, ...res }))}
            />

            <ConfirmModal
                isOpen={completeOpen}
                onClose={() => !completing && setCompleteOpen(false)}
                onConfirm={handleComplete}
                variant="info"
                title="Hoàn tất nhặt hàng"
                description={`Pick List ${dto.maPickList} sẽ chuyển sang Đã nhặt và hệ thống tạo phiếu xuất kho nháp cho từng đơn trong đợt.`}
                confirmText="Hoàn tất nhặt"
                cancelText="Quay lại"
                isLoading={completing}
            />

        </PageContainer>
    );
}

function BackLink({ onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
        >
            <ArrowLeft className="size-4" />
            Quay lại danh sách Pick List
        </button>
    );
}

function GoodsIssueLink() {
    return (
        <Link
            to="/goods-issues"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-bo-primary hover:underline"
        >
            Mở danh sách phiếu xuất <ArrowRight className="size-3" />
        </Link>
    );
}

function OrderCodes({ codes }) {
    return (
        <div className="flex flex-wrap gap-2">
            {codes.map((code) => (
                <span
                    key={code}
                    className="inline-flex items-center rounded-md border border-bo-border bg-bo-surface-subtle px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-bo-foreground"
                >
                    {code}
                </span>
            ))}
        </div>
    );
}

function CompleteResultPanel({ result, onClose }) {
    const codes = result.maDonHangs ?? [];
    return (
        <SurfaceCard
            title="Đã hoàn tất nhặt hàng"
            description={`Hệ thống đã tạo phiếu xuất kho nháp cho ${codes.length} đơn. Bước tiếp theo: chọn lô và hoàn thành xuất kho ở từng phiếu.`}
            action={
                <button type="button" onClick={onClose} className="text-sm font-medium text-bo-muted hover:text-bo-foreground">
                    Đóng
                </button>
            }
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {codes.length > 0 ? <OrderCodes codes={codes} /> : <span />}
                <GoodsIssueLink />
            </div>
        </SurfaceCard>
    );
}
