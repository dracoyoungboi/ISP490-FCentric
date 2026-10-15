import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft, ArrowRight, Calendar, Camera, CheckCheck, ClipboardList, Hash,
    Info as InfoIcon, Layers, Loader2, Package, PackageX, ShieldCheck, User, UserPlus, Warehouse,
} from "lucide-react";
import { toast } from "sonner";

import PageContainer from "@/components/backoffice/PageContainer";
import PackingProofModal from "@/components/outbound/PackingProofModal";
import { formatCurrency } from "@/utils/formatters";
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
import LotAllocationDialog from "@/components/outbound/LotAllocationDialog";
import ConfirmModal from "@/components/ui/confirm-modal";
import { Button } from "@/components/ui/button";
import useScanQueue from "@/hooks/useScanQueue";
import { nhatHangService, isPickListMock } from "@/services/nhatHangService";
import { PICK_LIST_EDITABLE, formatQuantity, getPickListStatus, toNumber } from "@/constants/outbound";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { playScanBeep } from "@/utils/scanBeep";
import { formatDateTime } from "@/utils/dateTime";
import { TRANG_THAI_DON } from "@/constants/trangThaiXuatBan";
import { getDonBanHangStatus } from "@/constants/donBanHang";
import { getCurrentUserId, hasAnyRole, ROLES } from "@/utils/roles";

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
    const [assignOpen, setAssignOpen] = useState(false);
    const [completeOpen, setCompleteOpen] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [completeResult, setCompleteResult] = useState(null);
    const [cancelledAlert, setCancelledAlert] = useState(null);
    const [proofModalOrder, setProofModalOrder] = useState(null);
    const [lotLine, setLotLine] = useState(null);
    const busyRef = useRef(false);

    const fetchDetail = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        setLoadError(null);
        try {
            const res = await nhatHangService.getPickList(id);
            setDto(res);
        } catch (error) {
            setLoadError(getApiErrorStatus(error) === 404 ? "notfound" : "error");
            if (silent) toast.error(getApiErrorMessage(error, "Không tải lại được phiếu nhặt hàng"));
        } finally {
            if (!silent) setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        queueMicrotask(() => fetchDetail());
    }, [fetchDetail]);

    // Lắng nghe sự kiện Outbound WebSocket realtime (đơn hủy trên sàn, tự động giảm SL nhặt)
    useEffect(() => {
        if (!id) return;
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsHost = window.location.hostname === "localhost" ? "localhost:8080" : window.location.host;
        const wsUrl = `${wsProtocol}//${wsHost}/ws-outbound?pickListId=${id}`;

        let ws;
        try {
            ws = new WebSocket(wsUrl);
            ws.onopen = () => {
                const pingInterval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send("ping");
                    }
                }, 30000);
                ws._pingInterval = pingInterval;
            };

            ws.onmessage = (event) => {
                if (event.data === "pong") return;
                try {
                    const parsed = JSON.parse(event.data);
                    const eventType = parsed.eventType;
                    const data = parsed.data || {};

                    if (eventType === "ORDER_CANCELLED_IN_PICK_LIST") {
                        setCancelledAlert({
                            soDonHang: data.soDonHangBiHuy,
                            message: data.message,
                            hangCanTraKe: data.hangCanTraKe || [],
                        });
                        toast.warning(`Đơn hàng ${data.soDonHangBiHuy || ""} đã bị hủy trên sàn! Số lượng cần nhặt đã tự động giảm.`);
                        fetchDetail({ silent: true });
                        playScanBeep(false); // cảnh báo đơn bị hủy: máy quét không báo được việc này
                    } else if (eventType === "PICK_LIST_CANCELLED") {
                        setCancelledAlert({
                            cancelledAll: true,
                            message: data.message || "Toàn bộ đơn hàng trong đợt đã bị hủy!",
                        });
                        toast.error(data.message || "Đợt nhặt hàng đã bị hủy toàn bộ.");
                        fetchDetail({ silent: true });
                    }
                } catch {
                    // Ignore non-json
                }
            };

            ws.onclose = () => {
                if (ws._pingInterval) clearInterval(ws._pingInterval);
            };
        } catch {
            // Ignore ws error
        }

        return () => {
            if (ws) {
                if (ws._pingInterval) clearInterval(ws._pingInterval);
                ws.close();
            }
        };
    }, [id, fetchDetail]);

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
        } catch (error) {
            setLastResult({ ok: false, message: getApiErrorMessage(error, `Không quét được mã ${barcode}`) });
            // Chỉ kêu khi KHÔNG cộng được: máy quét đã tự kêu "bíp" khi đọc được mã, nhưng không biết mã có
            // thuộc đợt nhặt này / còn cần nhặt hay không.
            playScanBeep(false);
            if (getApiErrorStatus(error) === 409) fetchDetail({ silent: true });
        }
    }, [id, fetchDetail]);

    const { enqueue, pending } = useScanQueue(processScan);

    const lines = useMemo(() => {
        const list = [...(dto?.chiTietNhatHangs ?? [])];
        return list.sort((a, b) => {
            const diff = lineState(a).order - lineState(b).order;
            if (diff !== 0) return diff;
            return String(a.maSku ?? "").localeCompare(String(b.maSku ?? ""), "vi", { numeric: true });
        });
    }, [dto]);

    const handleComplete = async () => {
        if (busyRef.current) return;
        busyRef.current = true;
        setCompleting(true);
        try {
            const res = await nhatHangService.hoanTat(id);
            setDto(res);
            const tatCaDon = res?.danhSachMaDonHang ?? dto?.danhSachMaDonHang ?? [];
            const donBoQua = res?.donChuaTaoPhieuXuat ?? [];
            setCompleteResult({
                maDonHangs: tatCaDon.filter((code) => !donBoQua.includes(code)),
                donBoQua,
            });
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
                    <LoadingState label="Đang tải phiếu nhặt hàng" />
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
                            title="Không tìm thấy phiếu nhặt hàng"
                            description="Phiếu nhặt hàng không tồn tại hoặc thuộc kho khác với kho đang chọn."
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
    // Bắt buộc phân công trước khi nhặt (khớp NhatHangServiceImpl): chỉ người được giao mới quét được,
    // kể cả quản lý kho / quản trị viên — muốn tự nhặt thì phân công cho chính mình.
    const laQuanLy = hasAnyRole([ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO]);
    const daPhanCong = dto.nguoiNhatId != null;
    const laNguoiNhat = daPhanCong && Number(dto.nguoiNhatId) === Number(getCurrentUserId());
    const duocQuet = editable && laNguoiNhat;
    // Nhân viên kho chỉ tự nhận phiếu chưa có người nhặt; quản lý / quản trị viên phân công (lại) được
    const duocPhanCong = editable && (laQuanLy || !daPhanCong);
    // Hoàn tất: người được giao, hoặc quản lý / quản trị viên hoàn tất thay
    const duocHoanTat = editable && daPhanCong && (laNguoiNhat || laQuanLy);
    // Phân bổ lô: người được giao nhặt, hoặc quản lý / quản trị viên sửa thay; khóa sau Hoàn tất nhặt
    const duocPhanBoLo = editable && (laNguoiNhat || laQuanLy);
    const conLai = Math.max(0, toNumber(dto.tongSoLuongCanNhat) - toNumber(dto.tongSoLuongDaQuet));
    const maDonHangs = dto.danhSachMaDonHang ?? [];

    return (
        <PageContainer className="space-y-5">
            <MockModeNotice show={isPickListMock} />

            {/* ── Cảnh báo Real-time đơn bị hủy trong lúc nhặt (SRS 6.3.1 Outbound cancellation) ── */}
            {cancelledAlert && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800 text-sm font-bold">⚠️</span>
                            <div className="space-y-1">
                                <h4 className="text-sm font-semibold text-amber-900">
                                    {cancelledAlert.cancelledAll
                                        ? "Đợt nhặt hàng đã bị hủy toàn bộ"
                                        : `Đơn hàng ${cancelledAlert.soDonHang || ""} đã bị hủy trên sàn`}
                                </h4>
                                <p className="text-xs text-amber-800">{cancelledAlert.message}</p>
                                {cancelledAlert.hangCanTraKe && cancelledAlert.hangCanTraKe.length > 0 && (
                                    <div className="mt-2 rounded border border-amber-200 bg-white/70 p-2 text-xs">
                                        <p className="font-semibold text-amber-900 mb-1">Hàng cần chuyển vào khay Put-back (Hàng chờ trả kệ trên xe đẩy):</p>
                                        <ul className="list-disc pl-4 space-y-0.5 text-amber-800">
                                            {cancelledAlert.hangCanTraKe.map((item, idx) => (
                                                <li key={idx}>
                                                    <span className="font-medium">{item.tenSanPham}</span> ({item.sku}): <span className="font-bold text-amber-900">{formatQuantity(item.soLuong)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCancelledAlert(null)}
                            className="text-xs text-amber-700 hover:bg-amber-200/50 hover:text-amber-900 h-7 px-2"
                        >
                            Đóng
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Thanh thao tác ── */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <BackLink onClick={() => navigate("/goods-issues/pick-lists")} />
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={status.label} tone={status.tone} />
                    {duocPhanCong ? (
                        <Button
                            variant="outline"
                            onClick={() => setAssignOpen(true)}
                            className="gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        >
                            <UserPlus className="size-4" />
                            {!laQuanLy ? "Nhận việc" : daPhanCong ? "Phân công lại" : "Phân công"}
                        </Button>
                    ) : null}
                    {duocHoanTat ? (
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
            <SurfaceCard title="Thông tin phiếu nhặt hàng">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoItem icon={Hash} label="Mã phiếu nhặt hàng" value={dto.maPickList} highlight />
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
                <CompleteResultPanel
                    result={completeResult}
                    orders={dto.danhSachDonHang}
                    onClose={() => setCompleteResult(null)}
                    onOpenProofModal={(order) => setProofModalOrder(order)}
                />
            ) : null}

            {/* ── Chế độ chỉ xem ── */}
            {!editable ? (
                <div className="flex items-center gap-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-3 text-sm text-slate-700">
                    <InfoIcon className="size-4 shrink-0 text-bo-muted" />
                    <p className="min-w-0 flex-1">
                        {dto.trangThai === "da_huy" || dto.trangThai === "huy"
                            ? "Phiếu nhặt hàng đã hủy."
                            : dto.trangThai === "da_nhat"
                                ? "Đã nhặt xong. Bấm Đóng gói ở từng đơn (bên phải) để quét đóng gói, sau đó xác nhận xuất kho ở phiếu xuất."
                                : "Phiếu nhặt hàng đã xuất kho."}
                    </p>
                    {dto.trangThai === "da_nhat" ? <GoodsIssueLink /> : null}
                </div>
            ) : null}

            {/* ── Quét mã: chỉ người được phân công ── */}
            {duocQuet ? (
                <SurfaceCard
                    title="Quét mã vạch"
                    description="Mỗi lần quét cộng số lượng vào đúng SKU. Mã được gửi lần lượt nên có thể quét liên tục."
                >
                    <ScanBar
                        ref={scanBarRef}
                        onScan={(barcode, soLuong) => enqueue({ barcode, soLuong })}
                        pending={pending}
                        lastResult={lastResult}
                    />
                </SurfaceCard>
            ) : editable && !daPhanCong ? (
                <div role="status" className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center">
                    <UserPlus className="size-5 shrink-0 text-amber-700" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-amber-900">Phiếu nhặt chưa được phân công</p>
                        <p className="mt-0.5 text-xs text-amber-800">
                            {laQuanLy
                                ? "Phân công người nhặt trước khi nhặt hàng. Muốn tự nhặt thì chọn Nhận việc cho tôi."
                                : "Bấm Nhận việc để nhận phiếu này rồi bắt đầu quét mã."}
                        </p>
                    </div>
                    <Button
                        onClick={() => setAssignOpen(true)}
                        className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                    >
                        <UserPlus className="size-4" />
                        {laQuanLy ? "Phân công" : "Nhận việc"}
                    </Button>
                </div>
            ) : editable ? (
                <div role="status" className="flex items-center gap-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-3 text-sm text-slate-700">
                    <User className="size-4 shrink-0 text-bo-muted" />
                    <p className="min-w-0 flex-1">
                        Phiếu đang giao cho <strong className="font-semibold">{dto.tenNguoiNhat}</strong>. Chỉ người được phân công mới quét nhặt được
                        {laQuanLy ? " — muốn tự nhặt thì phân công lại cho mình." : "."}
                    </p>
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                {/* ── Sản phẩm cần nhặt ── */}
                <TableShell
                    className="xl:col-span-2"
                    title="Sản phẩm cần nhặt"
                    description={`${lines.length} SKU · dòng chưa đủ lên trước · lô gợi ý theo FIFO (lô nhập kho sớm lấy trước)`}
                >
                    {lines.length === 0 ? (
                        <EmptyState icon={Package} title="Phiếu nhặt hàng không có sản phẩm" description="Đợt nhặt này chưa có dòng sản phẩm nào." />
                    ) : (
                        <table className="w-full min-w-[860px] text-sm">
                            <thead>
                                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                    <th className={`${TH_CLASS} text-left`}>Sản phẩm</th>
                                    <th className={`${TH_CLASS} text-left`}>Lô phân bổ</th>
                                    <th className={`${TH_CLASS} text-center`}>Cần nhặt</th>
                                    <th className={`${TH_CLASS} text-center`}>Đã quét</th>
                                    <th className={`${TH_CLASS} text-center`}>Còn lại</th>
                                    <th className={`${TH_CLASS} text-center`}>Trạng thái</th>
                                    {duocPhanBoLo ? <th className={`${TH_CLASS} text-right`}>Thao tác</th> : null}
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
                                            <td className="px-4 py-3">
                                                <LotCell line={line} />
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
                                            {duocPhanBoLo ? (
                                                <td className="whitespace-nowrap px-4 py-3 text-right">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={toNumber(line.soLuongCanNhat) <= 0}
                                                        onClick={() => setLotLine(line)}
                                                        className="h-8 gap-1.5 border-bo-primary/30 bg-bo-primary-soft px-3 text-xs font-semibold text-bo-primary hover:bg-bo-primary-soft/70 hover:text-bo-primary"
                                                    >
                                                        <Layers className="size-3.5" />
                                                        Phân bổ lô
                                                    </Button>
                                                </td>
                                            ) : null}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </TableShell>

                {/* ── Đơn trong Pick List ── */}
                <SurfaceCard title="Đơn trong phiếu nhặt hàng" description={`${maDonHangs.length} đơn`}>
                    {maDonHangs.length === 0 ? (
                        <p className="py-4 text-center text-sm text-bo-muted">Không có đơn nào.</p>
                    ) : (
                        <OrderCodes
                            codes={maDonHangs}
                            orders={dto.danhSachDonHang}
                            cancelledAlert={cancelledAlert}
                            onOpenProofModal={(order) => setProofModalOrder(order)}
                        />
                    )}
                </SurfaceCard>
            </div>

            <AssignPickerDialog
                open={assignOpen}
                onOpenChange={setAssignOpen}
                pickList={dto}
                onAssigned={(res) => res && setDto((prev) => ({ ...prev, ...res }))}
            />

            <LotAllocationDialog
                open={Boolean(lotLine)}
                onOpenChange={(next) => !next && setLotLine(null)}
                pickListId={dto.id}
                line={lotLine}
                onSaved={(res) => res && setDto(res)}
            />

            <ConfirmModal
                isOpen={completeOpen}
                onClose={() => !completing && setCompleteOpen(false)}
                onConfirm={handleComplete}
                variant="info"
                title="Hoàn tất nhặt hàng"
                description={`Phiếu nhặt hàng ${dto.maPickList} sẽ chuyển sang Đã nhặt và khóa phân bổ lô. Hệ thống tạo phiếu xuất kho nháp có sẵn lô cho từng đơn (đơn đặt sớm nhận lô cũ trước), các đơn chuyển sang Chờ đóng gói.`}
                confirmText="Hoàn tất nhặt"
                cancelText="Quay lại"
                isLoading={completing}
            />

            {/* Modal xem / upload bằng chứng đóng gói nhanh từ màn nhặt hàng */}
            <PackingProofModal
                isOpen={Boolean(proofModalOrder)}
                onClose={() => setProofModalOrder(null)}
                donId={proofModalOrder?.id}
                soDonHang={proofModalOrder?.soDonHang}
                tongTienDonHang={proofModalOrder?.tongCong}
                onProofChanged={() => fetchDetail({ silent: true })}
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
            Quay lại danh sách phiếu nhặt hàng
        </button>
    );
}

/** Lô đang phân bổ cho dòng nhặt (gợi ý FIFO hoặc đã sửa tay); phân bổ thiếu so với số cần nhặt thì cảnh báo. */
function LotCell({ line }) {
    const phanBo = line.phanBoLo ?? [];
    const canNhat = toNumber(line.soLuongCanNhat);
    const thieu = canNhat - toNumber(line.soLuongDaPhanBo);
    if (phanBo.length === 0) {
        return canNhat > 0
            ? <span className="text-xs font-semibold text-bo-warning">Chưa phân bổ lô</span>
            : <span className="text-xs text-bo-muted">—</span>;
    }
    return (
        <div className="flex flex-col gap-1">
            {phanBo.map((lo) => (
                <span key={lo.loHangId} className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
                    <span className="rounded-md border border-bo-border bg-white px-1.5 py-0.5 font-mono font-semibold text-bo-foreground">
                        {lo.maLo}
                    </span>
                    <span className="font-semibold text-slate-600">× {formatQuantity(lo.soLuong)}</span>
                </span>
            ))}
            <span className="text-[11px] text-bo-muted">{line.phanBoThuCong ? "Đã sửa tay" : "Gợi ý FIFO"}</span>
            {thieu > 0 ? (
                <span className="text-[11px] font-semibold text-bo-warning">Còn thiếu {formatQuantity(thieu)} — tồn theo lô không đủ</span>
            ) : null}
        </div>
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

function OrderCodes({ codes, orders, cancelledAlert, onOpenProofModal }) {
    const orderMap = useMemo(() => {
        const map = new Map();
        if (orders && Array.isArray(orders)) {
            orders.forEach((o) => {
                if (o.soDonHang) map.set(o.soDonHang, o);
            });
        }
        return map;
    }, [orders]);

    return (
        <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-2">
                {codes.map((code) => {
                    const info = orderMap.get(code);
                    const isCancelled = info?.biHuy || (cancelledAlert && cancelledAlert.soDonHang === code) || (cancelledAlert?.cancelledAll);

                    if (isCancelled) {
                        return (
                            <div
                                key={code}
                                className="flex items-center justify-between rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm"
                                title="Đơn hàng đã bị hủy trên sàn - Cần cất hàng thừa vào khay Put-back"
                            >
                                <span className="line-through opacity-75">{code}</span>
                                <span className="rounded bg-rose-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-900">
                                    HỦY TỪ SÀN · PUT-BACK
                                </span>
                            </div>
                        );
                    }

                    const choDongGoi = info?.trangThai === TRANG_THAI_DON.CHO_DONG_GOI;
                    const daDongGoi = info?.trangThai === TRANG_THAI_DON.DA_DONG_GOI;
                    const tongTien = info?.tongCong != null ? formatCurrency(info.tongCong) : null;
                    const yeuCauVideo = info?.yeuCauVideo;
                    const daDuBangChung = info?.daDuBangChung;

                    return (
                        <div
                            key={code}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bo-border bg-bo-surface-subtle px-3 py-2 text-xs text-bo-foreground hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="size-2 rounded-full bg-emerald-500" />
                                <span className="font-semibold uppercase tracking-wide">{code}</span>
                                {tongTien && (
                                    <span className="font-mono text-slate-600 font-medium">({tongTien})</span>
                                )}
                                {info && info.trangThai !== TRANG_THAI_DON.CHO_NHAT_HANG && !choDongGoi ? (
                                    <span className="font-normal text-bo-muted">· {getDonBanHangStatus(info.trangThai).label}</span>
                                ) : null}

                                {/* Badge bằng chứng */}
                                {info && (choDongGoi || daDongGoi) && (
                                    <span
                                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                                            daDuBangChung
                                                ? "bg-emerald-100 text-emerald-800"
                                                : "bg-amber-100 text-amber-800"
                                        }`}
                                    >
                                        <ShieldCheck className="size-3" />
                                        {daDuBangChung ? "Đủ bằng chứng" : yeuCauVideo ? "Cần video (15-30s)" : "Cần 2 ảnh"}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {info?.id && onOpenProofModal && (choDongGoi || daDongGoi) && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenProofModal(info)}
                                        className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 shadow-xs"
                                        title="Xem hoặc tải lên bằng chứng đóng gói"
                                    >
                                        <Camera className="size-3 text-slate-500" /> Bằng chứng
                                    </button>
                                )}
                                {choDongGoi ? (
                                    <Link
                                        to={`/goods-issues/packing/${info.id}`}
                                        className="inline-flex items-center gap-1 rounded bg-bo-primary px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-bo-primary-hover shadow-xs"
                                    >
                                        Đóng gói <ArrowRight className="size-3" />
                                    </Link>
                                ) : null}
                            </div>

                            {info && (info.tenKenh || info.tenKhachHang || info.tomTatHang) ? (
                                <div className="w-full space-y-0.5 text-[11px] text-bo-muted">
                                    <p>
                                        <span className="font-semibold text-slate-600">{info.tenKenh || "Trực tiếp"}</span>
                                        {info.tenKhachHang ? ` · ${info.tenKhachHang}` : ""}
                                    </p>
                                    {info.tomTatHang ? <p className="line-clamp-2">{info.tomTatHang}</p> : null}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
            {orders && orders.some((o) => o.biHuy) && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">
                    * Các đơn bị gạch ngang đã hủy từ sàn, không tạo phiếu xuất và đã được tự động trừ khỏi số lượng cần nhặt.
                </p>
            )}
        </div>
    );
}

function CompleteResultPanel({ result, orders, onClose, onOpenProofModal }) {
    const codes = result.maDonHangs ?? [];
    const donBoQua = result.donBoQua ?? [];
    return (
        <SurfaceCard
            title="Đã hoàn tất nhặt hàng"
            description={codes.length > 0
                ? `Hệ thống đã tạo phiếu xuất kho nháp cho ${codes.length} đơn, các đơn chuyển sang Chờ đóng gói. Bước tiếp theo: đóng gói (Scan-to-Pack) từng đơn rồi xác nhận xuất kho.`
                : "Không còn đơn nào cần xuất nên hệ thống không tạo phiếu xuất kho."}
            action={
                <button type="button" onClick={onClose} className="text-sm font-medium text-bo-muted hover:text-bo-foreground">
                    Đóng
                </button>
            }
        >
            <div className="space-y-3">
                {codes.length > 0 ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <OrderCodes codes={codes} orders={orders} onOpenProofModal={onOpenProofModal} />
                        <GoodsIssueLink />
                    </div>
                ) : null}
                {donBoQua.length > 0 ? (
                    <div className="rounded-lg border border-bo-warning/30 bg-bo-warning-soft p-3 text-sm text-slate-800">
                        <p className="mb-2 font-semibold">
                            Không tạo phiếu xuất cho {donBoQua.length} đơn đã hủy hoặc đã xuất trước đó. Hàng đã nhặt cho các đơn này cần trả về kệ.
                        </p>
                        <OrderCodes codes={donBoQua} />
                    </div>
                ) : null}
            </div>
        </SurfaceCard>
    );
}
