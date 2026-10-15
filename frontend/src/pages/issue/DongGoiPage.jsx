import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft, ArrowRight, CheckCheck, ClipboardList, FileText, Hash,
    Info as InfoIcon, Loader2, MapPin, Package, PackageX, Phone, Store, User, Warehouse,
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
import PickProgress from "@/components/outbound/PickProgress";
import ScanBar from "@/components/outbound/ScanBar";
import ConfirmModal from "@/components/ui/confirm-modal";
import { Button } from "@/components/ui/button";
import PackingProofSection from "@/components/outbound/PackingProofSection";
import useScanQueue from "@/hooks/useScanQueue";
import { dongGoiService } from "@/services/dongGoiService";
import { donBanHangService } from "@/services/donBanHangService";
import { formatQuantity, toNumber } from "@/constants/outbound";
import { getDonBanHangStatus } from "@/constants/donBanHang";
import { getPhieuXuatKhoStatus } from "@/constants/phieuXuatKho";
import { TRANG_THAI_DON, TRANG_THAI_PHIEU_XUAT } from "@/constants/trangThaiXuatBan";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { getKhoLamViecId, laKhoLamViecHopLe, setKhoLamViecId } from "@/utils/khoLamViec";
import { playScanBeep } from "@/utils/scanBeep";

const TH_CLASS = "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

// Backend không cho quét quá số cần đóng gói, nên mỗi dòng chỉ có hai trạng thái.
function lineState(line) {
    const can = toNumber(line.soLuongCan);
    const quet = toNumber(line.soLuongDaQuet);
    if (can > 0 && quet >= can) return { label: "Đủ", tone: "success", order: 1 };
    return { label: "Còn thiếu", tone: "warning", order: 0 };
}

/** Phiên đóng gói gửi kèm lỗi 409 khi đơn đã bị hủy (danh sách hàng cần cất về kệ). */
function phienTuLoi(error) {
    const data = error?.response?.data?.data;
    return data && data.phieuXuatKhoId ? data : null;
}

/**
 * Đóng gói đơn bán (Scan-to-Pack): sau khi nhặt xong, quét từng sản phẩm của đơn để đối chiếu.
 * Đủ thì hoàn tất → phiếu xuất "Chờ xuất", đơn "Chờ xuất kho"; xuất kho ở màn phiếu xuất.
 */
export default function DongGoiPage() {
    const { donId } = useParams();
    const navigate = useNavigate();
    const scanBarRef = useRef(null);

    const [dto, setDto] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(null); // { kind: "notfound" | "error" | "message", message }
    const [lastResult, setLastResult] = useState(null);
    const [highlightId, setHighlightId] = useState(null);
    const [completeOpen, setCompleteOpen] = useState(false);
    const [completing, setCompleting] = useState(false);
    const busyRef = useRef(false);

    /**
     * Đơn thuộc kho khác kho làm việc (nhân viên nhiều kho): chuyển kho làm việc sang kho của đơn nếu được phép,
     * để header kho_id khớp phiếu xuất. Trả về true nếu đã chuyển.
     */
    const chuyenSangKhoCuaDon = useCallback(async () => {
        let kho;
        try {
            // getDetail trả về ResponseData ({ status, data, message })
            const res = await donBanHangService.getDetail(donId);
            kho = res?.data?.donBanHang?.khoXuat;
        } catch {
            return false; // không đọc được đơn: giữ lỗi 403 ban đầu
        }
        if (!kho?.id || kho.id === getKhoLamViecId() || !laKhoLamViecHopLe(kho)) return false;
        setKhoLamViecId(kho.id);
        toast.info(`Đã chuyển kho làm việc sang ${kho.tenKho}`);
        return true;
    }, [donId]);

    const fetchPhien = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        setLoadError(null);
        try {
            let res;
            try {
                res = await dongGoiService.layPhien(donId);
            } catch (error) {
                if (getApiErrorStatus(error) === 403 && await chuyenSangKhoCuaDon()) {
                    res = await dongGoiService.layPhien(donId);
                } else {
                    throw error;
                }
            }
            setDto(res);
        } catch (error) {
            const status = getApiErrorStatus(error);
            setLoadError(status === 404
                ? { kind: "notfound" }
                : status === 409 || status === 403 || status === 400
                    ? { kind: "message", message: getApiErrorMessage(error, "Không mở được phiên đóng gói") }
                    : { kind: "error" });
            if (silent) toast.error(getApiErrorMessage(error, "Không tải lại được phiên đóng gói"));
        } finally {
            if (!silent) setLoading(false);
        }
    }, [donId, chuyenSangKhoCuaDon]);

    useEffect(() => {
        queueMicrotask(() => fetchPhien());
    }, [fetchPhien]);

    // Gửi từng mã một (backend khóa phiếu xuất khi quét)
    const processScan = useCallback(async ({ barcode, soLuong }) => {
        if (!dto?.phieuXuatKhoId) return;
        try {
            const res = await dongGoiService.quet(dto.phieuXuatKhoId, { barcode, soLuong });
            setDto(res);
            setHighlightId(res?.chiTietVuaQuetId ?? null);
            setLastResult({ ok: true, message: res?.thongBao || `${barcode} +${soLuong}` });
        } catch (error) {
            const phienHuy = phienTuLoi(error);
            if (phienHuy) setDto(phienHuy);
            setLastResult({ ok: false, message: getApiErrorMessage(error, `Không quét được mã ${barcode}`) });
            // Chỉ kêu khi KHÔNG cộng được: máy quét đã tự kêu "bíp" khi đọc được mã, nhưng không biết mã có
            // thuộc đơn này / còn cần đóng gói hay không.
            playScanBeep(false);
            if (getApiErrorStatus(error) === 409 && !phienHuy) fetchPhien({ silent: true });
        }
    }, [dto?.phieuXuatKhoId, fetchPhien]);

    const { enqueue, pending } = useScanQueue(processScan);

    const lines = useMemo(() => {
        const list = [...(dto?.items ?? [])];
        return list.sort((a, b) => lineState(a).order - lineState(b).order);
    }, [dto]);

    const handleComplete = async () => {
        if (busyRef.current || !dto?.phieuXuatKhoId) return;
        busyRef.current = true;
        setCompleting(true);
        try {
            const res = await dongGoiService.hoanTat(dto.phieuXuatKhoId);
            setDto(res);
            toast.success(res?.thongBao || "Đã đóng gói xong");
        } catch (error) {
            const phienHuy = phienTuLoi(error);
            if (phienHuy) setDto(phienHuy);
            toast.error(getApiErrorMessage(error, "Không thể hoàn tất đóng gói"));
            if (getApiErrorStatus(error) === 409 && !phienHuy) fetchPhien({ silent: true });
        } finally {
            busyRef.current = false;
            setCompleting(false);
            setCompleteOpen(false);
        }
    };

    const backToOrder = () => navigate(`/sales-orders/${donId}`);

    if (loading && !dto) {
        return (
            <PageContainer>
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <LoadingState label="Đang tải phiên đóng gói" />
                </div>
            </PageContainer>
        );
    }

    if (!dto) {
        return (
            <PageContainer className="space-y-5">
                <BackLink onClick={backToOrder} />
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    {loadError?.kind === "notfound" ? (
                        <EmptyState icon={PackageX} title="Không tìm thấy đơn bán hàng" description="Đơn không tồn tại hoặc đã bị xóa." />
                    ) : loadError?.kind === "message" ? (
                        <EmptyState icon={PackageX} title="Chưa đóng gói được đơn này" description={loadError.message} />
                    ) : (
                        <ErrorState onRetry={() => fetchPhien()} />
                    )}
                </div>
            </PageContainer>
        );
    }

    const donStatus = getDonBanHangStatus(dto.trangThaiDon);
    const phieuStatus = getPhieuXuatKhoStatus(dto.trangThaiPhieu);
    const dangDongGoi = dto.trangThaiPhieu === TRANG_THAI_PHIEU_XUAT.NHAP && !dto.biHuy;
    const daDongGoi = dto.trangThaiPhieu === TRANG_THAI_PHIEU_XUAT.CHO_XUAT && !dto.biHuy;
    const conLai = Math.max(0, toNumber(dto.tongSoLuongCan) - toNumber(dto.tongSoLuongDaQuet));
    // biHuy = đơn hủy HOẶC chỉ phiếu xuất bị hủy; chỉ đơn hủy mới phải chuyển hàng về khu hoàn kệ
    const donDaHuy = dto.trangThaiDon === TRANG_THAI_DON.DA_HUY;

    return (
        <PageContainer className="space-y-5">
            {/* ── Thanh thao tác ── */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <BackLink onClick={backToOrder} />
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={donStatus.label} tone={donStatus.tone} />
                    <StatusBadge label={`Phiếu xuất: ${phieuStatus.label}`} tone={phieuStatus.tone} className={phieuStatus.className} />
                    {dangDongGoi ? (
                        <span title={dto.coTheHoanTat ? undefined : !dto.daDuBangChung ? "Cần tải lên đầy đủ bằng chứng đóng gói để hoàn tất" : `Còn ${formatQuantity(conLai)} sản phẩm chưa quét`}>
                            <Button
                                disabled={!dto.coTheHoanTat || completing || pending > 0}
                                onClick={() => setCompleteOpen(true)}
                                className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                            >
                                {completing ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
                                Hoàn tất đóng gói
                            </Button>
                        </span>
                    ) : null}
                    {daDongGoi ? (
                        <Button
                            onClick={() => navigate(`/goods-issues/${dto.phieuXuatKhoId}`)}
                            className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            <ArrowRight className="size-4" /> Mở phiếu xuất để xuất kho
                        </Button>
                    ) : null}
                </div>
            </div>

            {/* ── Đơn bị hủy trong lúc đóng gói ── */}
            {dto.biHuy && donDaHuy ? (
                <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-4 shadow-sm">
                    <h4 className="text-sm font-semibold text-rose-900">Đơn {dto.soDonHang} đã bị hủy — đã khóa đóng gói</h4>
                    <p className="mt-1 text-xs text-rose-800">
                        Không đóng gói / xuất kho đơn này. Chuyển toàn bộ hàng của đơn về khu hoàn kệ:
                    </p>
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-rose-800">
                        {(dto.items ?? []).map((item) => (
                            <li key={item.chiTietId}>
                                <span className="font-medium">{item.tenSanPham}</span> ({item.maSku}): <span className="font-bold">{formatQuantity(item.soLuongCan)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {/* ── Chỉ phiếu xuất bị hủy: đơn vẫn còn hiệu lực ── */}
            {dto.biHuy && !donDaHuy ? (
                <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
                    <h4 className="text-sm font-semibold text-amber-900">Phiếu xuất {dto.soPhieuXuat} đã bị hủy — đã khóa đóng gói</h4>
                    <p className="mt-1 text-xs text-amber-800">
                        Đơn {dto.soDonHang} vẫn còn hiệu lực. Bấm Tạo lại phiếu xuất ở màn đơn bán hàng để đóng gói lại.
                    </p>
                </div>
            ) : null}

            {/* ── Thông tin đơn & phiếu xuất ── */}
            <SurfaceCard title="Thông tin đóng gói">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoItem
                        icon={Hash}
                        label="Đơn bán"
                        value={<Link to={`/sales-orders/${dto.donBanHangId}`} className="text-bo-primary hover:underline">{dto.soDonHang}</Link>}
                        highlight
                    />
                    <InfoItem icon={User} label="Khách hàng" value={dto.tenKhachHang || "Khách lẻ"} />
                    <InfoItem icon={Phone} label="Số điện thoại" value={dto.soDienThoai || "—"} />
                    <InfoItem
                        icon={FileText}
                        label="Phiếu xuất"
                        value={<Link to={`/goods-issues/${dto.phieuXuatKhoId}`} className="text-bo-primary hover:underline">{dto.soPhieuXuat}</Link>}
                    />
                    <InfoItem icon={Warehouse} label="Kho xuất" value={dto.tenKho} />
                    <InfoItem icon={ClipboardList} label="Phiếu nhặt hàng" value={dto.maPickList || "Không qua phiếu nhặt"} />
                    {dto.tenKenh ? (
                        <InfoItem icon={Store} label="Kênh bán" value={`${dto.tenKenh}${dto.maDonHangKenh ? ` · #${dto.maDonHangKenh}` : ""}`} />
                    ) : null}
                    <InfoItem icon={MapPin} label="Địa chỉ giao" value={dto.diaChiGiaoHang || "—"} />
                </div>
                <div className="mt-5 border-t border-bo-border pt-4">
                    <PickProgress
                        label="Tiến độ đóng gói"
                        daQuet={dto.tongSoLuongDaQuet}
                        canNhat={dto.tongSoLuongCan}
                        percent={dto.phanTramHoanThanh}
                    />
                </div>
            </SurfaceCard>

            {/* ── Trạng thái chỉ xem ── */}
            {!dangDongGoi && !dto.biHuy ? (
                <div className="flex items-center gap-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-3 text-sm text-slate-700">
                    <InfoIcon className="size-4 shrink-0 text-bo-muted" />
                    <p className="min-w-0 flex-1">
                        {daDongGoi
                            ? `Đã đóng gói xong. Phiếu xuất ${dto.soPhieuXuat} chờ xác nhận xuất kho (lô đã có sẵn từ phiếu nhặt).`
                            : dto.trangThaiPhieu === TRANG_THAI_PHIEU_XUAT.DA_XUAT
                                ? `Phiếu xuất ${dto.soPhieuXuat} đã xuất kho.`
                                : `Phiếu xuất ${dto.soPhieuXuat} không còn ở bước đóng gói.`}
                    </p>
                </div>
            ) : null}

            {/* ── Quét mã ── */}
            {dangDongGoi ? (
                <SurfaceCard
                    title="Quét mã vạch đóng gói"
                    description="Quét từng sản phẩm bỏ vào thùng. Mã không thuộc đơn hoặc quét quá số lượng sẽ báo lỗi ngay."
                >
                    <ScanBar
                        ref={scanBarRef}
                        onScan={(barcode, soLuong) => enqueue({ barcode, soLuong })}
                        pending={pending}
                        lastResult={lastResult}
                    />
                </SurfaceCard>
            ) : null}

            {/* ── Bằng chứng đóng gói (SRS 6.3.1 - 6.3.2) ── */}
            <PackingProofSection
                donId={dto.donBanHangId}
                soDonHang={dto.soDonHang}
                tongTienDonHang={dto.tongTienDonHang}
                yeuCauVideo={dto.yeuCauVideo}
                danhSachBangChung={dto.danhSachBangChung || []}
                daDuBangChung={dto.daDuBangChung}
                onRefresh={() => fetchPhien({ silent: true })}
                readOnly={!dangDongGoi}
            />

            {/* ── Sản phẩm cần đóng gói ── */}
            <TableShell title="Sản phẩm cần đóng gói" description={`${lines.length} dòng · dòng chưa đủ lên trước`}>
                {lines.length === 0 ? (
                    <EmptyState icon={Package} title="Phiếu xuất không có sản phẩm" description="Phiếu xuất của đơn chưa có dòng sản phẩm nào." />
                ) : (
                    <table className="w-full min-w-[720px] text-sm">
                        <thead>
                            <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                <th className={`${TH_CLASS} text-left`}>Sản phẩm</th>
                                <th className={`${TH_CLASS} text-center`}>Cần đóng gói</th>
                                <th className={`${TH_CLASS} text-center`}>Đã quét</th>
                                <th className={`${TH_CLASS} text-center`}>Còn lại</th>
                                <th className={`${TH_CLASS} text-center`}>Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bo-border">
                            {lines.map((line) => {
                                // Đơn đã hủy: mọi dòng là hàng cần cất về kệ, không còn "thiếu"
                                const state = dto.biHuy && donDaHuy ? { label: "Cất về kệ", tone: "danger" } : lineState(line);
                                const conLaiDong = Math.max(0, toNumber(line.soLuongCan) - toNumber(line.soLuongDaQuet));
                                const variantName = [line.tenMau, line.tenSize].filter(Boolean).join(" / ");
                                return (
                                    <tr
                                        key={line.chiTietId}
                                        className={`transition-colors ${highlightId === line.chiTietId ? "bg-bo-primary-soft" : "hover:bg-bo-surface-subtle"}`}
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
                                                    {line.maVachSku ? <span className="font-mono text-xs text-bo-muted">{line.maVachSku}</span> : null}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center font-semibold text-bo-foreground">{formatQuantity(line.soLuongCan)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`font-mono font-semibold ${state.tone === "success" ? "text-bo-success" : "text-bo-foreground"}`}>
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

            <ConfirmModal
                isOpen={completeOpen}
                onClose={() => !completing && setCompleteOpen(false)}
                onConfirm={handleComplete}
                variant="info"
                title="Hoàn tất đóng gói"
                description={`Đơn ${dto.soDonHang} sẽ chuyển sang Chờ xuất kho và phiếu xuất ${dto.soPhieuXuat} sang Chờ xuất. Bước tiếp theo: xác nhận xuất kho (lô đã có sẵn từ phiếu nhặt).`}
                confirmText="Hoàn tất đóng gói"
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
            Quay lại đơn bán hàng
        </button>
    );
}
