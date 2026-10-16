import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { getMineKhoList } from "@/services/khoService";
import apiClient from "@/services/apiClient";
import { toast } from "@/lib/thongBaoNhanh";
import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Loader2, ClipboardList, Building2, Package, ArrowRightLeft, SearchX } from "lucide-react";
import { createPortal } from "react-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PHIEU_CHUYEN_KHO_STATUS, getPhieuChuyenKhoStatus } from "@/constants/phieuChuyenKho";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { formatDate } from "@/utils/formatters";

// ── Trạng thái — dùng chung tên với danh sách (constants/phieuChuyenKho) ──
const STATUS_MAP = PHIEU_CHUYEN_KHO_STATUS;

const TH_CLASS =
    "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

function StatTile({ icon, iconClass, label, value }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
            <div className="min-w-0">
                <p className="text-xs font-medium text-bo-muted">{label}</p>
                <p className="mt-1 truncate text-base font-bold leading-snug tracking-tight text-bo-foreground">{value}</p>
            </div>
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                {icon}
            </span>
        </div>
    );
}

export default function PhieuChuyenKhoDetail() {
    const { id }     = useParams();
    const navigate   = useNavigate();

    const [data,               setData]               = useState(null);
    const [loading,            setLoading]            = useState(false);
    // null: không lỗi; { khongTimThay, moTa }: lần tải gần nhất lỗi
    const [loadError,          setLoadError]          = useState(null);
    const [showCancelConfirm,  setShowCancelConfirm]  = useState(false);
    const [isProcessing,       setIsProcessing]       = useState(false);
    const [myWarehouseIds,     setMyWarehouseIds]     = useState([]);

    // Auth & roles
    const [userRoles, setUserRoles] = useState([]);
    const [relatedIssue, setRelatedIssue] = useState(null);
    const [relatedReceipt, setRelatedReceipt] = useState(null);

    const fetchDetail = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await phieuChuyenKhoService.getDetail(id);
            const payload = res?.data || res;
            if (payload?.id != null) {
                setData(payload);
            } else {
                // Máy chủ trả về rỗng: coi như không có phiếu này
                setData(null);
                setLoadError({ khongTimThay: true });
            }
        } catch (e) {
            setData(null);
            setLoadError({
                // Máy chủ trả 400 ("Không tìm thấy phiếu chuyển kho id: …") cho mã không tồn tại
                khongTimThay: [400, 404].includes(getApiErrorStatus(e)),
                moTa: getApiErrorMessage(e, "Đã xảy ra lỗi khi tải phiếu chuyển kho. Vui lòng thử lại."),
            });
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchMyWarehouses = useCallback(async () => {
        try {
            const listKho = await getMineKhoList();
            setMyWarehouseIds(listKho.map(kho => kho.id));
        } catch (error) {
            console.error("Lỗi khi tải danh sách kho phân quyền:", error);
        }
    }, []);

    const fetchUserInfo = useCallback(async () => {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) return;
            const b64 = token.split(".")[1];
            const payload = JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
            if (!payload || !payload.id) return;

            const userResponse = await apiClient.get(`/api/v1/nguoi-dung/get-by-id/${payload.id}`);
            const userData = userResponse.data?.data;
            if (userData && userData.vaiTro) {
                setUserRoles(userData.vaiTro.includes(" ") ? userData.vaiTro.split(" ") : [userData.vaiTro]);
            }
        } catch (error) {
            console.error('Lỗi khi lấy thông tin user:', error);
        }
    }, []);

    // Lấy trước thông tin phiếu xuất / nhập liên kết để validate (Disable nút nếu đã tồn tại)
    const fetchRelatedDocs = useCallback(() => {
        if (!id) return;
        phieuXuatKhoService.filter({ page: 0, size: 2000 }).then(res => {
            const issues = res.content || res.data?.content || [];
            const found = issues.find(i => (String(i.phieuChuyenKhoGocId) === String(id) || String(i.phieuChuyenId) === String(id) || String(i.transferId) === String(id)) && i.trangThai !== 4);
            if (found) setRelatedIssue(found);
        }).catch(() => {});

        phieuNhapKhoService.filter({ page: 0, size: 2000 }).then(res => {
            const receipts = res.content || res.data?.content || [];
            const found = receipts.find(r => (String(r.phieuXuatGocId) === String(id) || String(r.phieuChuyenId) === String(id) || String(r.transferId) === String(id)));
            if (found) setRelatedReceipt(found);
        }).catch(() => {});
    }, [id]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu vẫn tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => {
            fetchDetail();
            fetchMyWarehouses();
            fetchRelatedDocs();
        });
    }, [fetchDetail, fetchMyWarehouses, fetchRelatedDocs]);

    useEffect(() => {
        queueMicrotask(() => fetchUserInfo());
    }, [fetchUserInfo]);

    async function handleStatusChange(actionFn, successMsg) {
        setIsProcessing(true);
        try {
            await actionFn(id);
            toast.success(successMsg);
            fetchDetail();
        } catch (e) {
            toast.error(e?.response?.data?.message || "Thao tác thất bại");
        } finally {
            setIsProcessing(false);
        }
    }

    async function handleMasterCancel() {
        setIsProcessing(true);
        try {
            await phieuChuyenKhoService.cancel(id);
            toast.success("Đã hủy toàn bộ quy trình chuyển kho thành công");
            setShowCancelConfirm(false);
            fetchDetail();
        } catch (e) {
            toast.error(e?.response?.data?.message || "Không thể hủy phiếu");
        } finally {
            setIsProcessing(false);
        }
    }

    // ── Đang tải / lỗi tải / không có phiếu: vẫn giữ nút quay lại danh sách ──
    if (loading || !data) {
        return (
            <PageContainer className="space-y-5">
                <button
                    type="button"
                    onClick={() => navigate("/transfer-tickets")}
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
                >
                    <ArrowLeft className="size-4" />
                    Quay lại danh sách
                </button>
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    {loading || !loadError ? (
                        <LoadingState rows={5} label="Đang tải dữ liệu phiếu chuyển kho" />
                    ) : loadError.khongTimThay ? (
                        <EmptyState
                            icon={SearchX}
                            title="Không tìm thấy phiếu chuyển kho"
                            description="Phiếu chuyển kho không tồn tại hoặc đã bị xóa khỏi hệ thống."
                            action={
                                <Button
                                    onClick={() => navigate("/transfer-tickets")}
                                    className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                                >
                                    Về danh sách phiếu chuyển kho
                                </Button>
                            }
                        />
                    ) : (
                        <ErrorState
                            title="Không tải được phiếu chuyển kho"
                            description={loadError.moTa}
                            onRetry={fetchDetail}
                        />
                    )}
                </div>
            </PageContainer>
        );
    }

    const isKhoRole            = userRoles.includes("quan_ly_kho") || userRoles.includes("nhan_vien_kho");
    const isStaffRole          = userRoles.includes("nhan_vien_kho");
    const isAdmin              = userRoles.includes("quan_tri_vien");
    const isQuanLy             = userRoles.includes("quan_ly_kho") || isAdmin;

    const st                   = getPhieuChuyenKhoStatus(data.trangThai);
    const isDestinationManager = isAdmin || (isQuanLy && myWarehouseIds.includes(data.khoNhapId));
    const isSourceStaff        = isAdmin || (isQuanLy && myWarehouseIds.includes(data.khoXuatId));
    const totalItems           = data.items?.length || 0;
    const totalQty             = data.items?.reduce((s, i) => s + (i.soLuongYeuCau || 0), 0) || 0;

    return (
        <PageContainer className="space-y-5">

            {/* ── Header ── */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <button
                    type="button"
                    onClick={() => navigate("/transfer-tickets")}
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
                >
                    <ArrowLeft className="size-4" />
                    Quay lại danh sách
                </button>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Badge trạng thái */}
                    <StatusBadge label={st.label} tone={st.tone} className={st.className} />

                    {/* Các nút xử lý kho đặc thù cho role KHO */}
                    {isKhoRole && data.trangThai === 2 && myWarehouseIds.includes(data.khoXuatId) && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span>
                                        <Button
                                            onClick={() => navigate(`/goods-issues/create?transferId=${id}`)}
                                            disabled={!!relatedIssue}
                                            className="gap-2 bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <ArrowRightLeft className="size-4" /> Tạo phiếu xuất kho
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{relatedIssue ? "Đã tồn tại phiếu xuất kho cho yêu cầu này" : "Tạo phiếu xuất kho điều chuyển"}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    {isKhoRole && data.trangThai === 3 && myWarehouseIds.includes(data.khoNhapId) && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span>
                                        <Button
                                            onClick={() => navigate(`/goods-receipts/create?transferId=${id}`)}
                                            disabled={!!relatedReceipt}
                                            className="gap-2 bg-bo-success font-semibold text-white hover:bg-bo-success/90 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <Package className="size-4" /> Nhập kho
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{relatedReceipt ? "Đã tồn tại phiếu nhập kho cho yêu cầu này" : "Tạo phiếu nhập kho tại kho đích"}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    {isKhoRole && data.trangThai === 4 && myWarehouseIds.includes(data.khoXuatId) && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span>
                                        <Button
                                            onClick={() => navigate(`/goods-receipts/create?transferId=${id}`)}
                                            disabled={!!relatedReceipt}
                                            className="gap-2 bg-bo-warning font-semibold text-white hover:bg-bo-warning/90 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <Package className="size-4" /> Nhập kho (Hoàn trả)
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{relatedReceipt ? "Đã tồn tại phiếu nhập kho hoàn trả" : "Tạo phiếu nhập kho hoàn trả về kho nguồn"}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    {/* Nút Huỷ (Chỉ hiện khi không phải nhân viên kho) */}
                    {!isStaffRole && [0, 1, 2, 3].includes(data.trangThai) && (
                        <Button
                            variant="outline"
                            disabled={isProcessing}
                            onClick={() => setShowCancelConfirm(true)}
                            className="border-bo-danger/30 bg-bo-danger-soft font-medium text-bo-danger hover:bg-bo-danger-soft/70 hover:text-bo-danger"
                        >
                            Hủy phiếu
                        </Button>
                    )}

                    {/* Nút Gửi duyệt */}
                    {data.trangThai === 0 && isDestinationManager && (
                        <Button
                            disabled={isProcessing}
                            onClick={() => handleStatusChange(phieuChuyenKhoService.submit, "Đã gửi yêu cầu tới kho đích")}
                            className="gap-2 bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover disabled:opacity-50"
                        >
                            {isProcessing
                                ? <><Loader2 className="size-4 animate-spin" />Đang xử lý...</>
                                : "Gửi duyệt"
                            }
                        </Button>
                    )}

                    {/* Nút Phê duyệt */}
                    {data.trangThai === 1 && isSourceStaff && (
                        <Button
                            disabled={isProcessing}
                            onClick={() => handleStatusChange(phieuChuyenKhoService.approve, "Phê duyệt nhận hàng thành công")}
                            className="gap-2 bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover disabled:opacity-50"
                        >
                            {isProcessing
                                ? <><Loader2 className="size-4 animate-spin" />Đang xử lý...</>
                                : "Phê duyệt"
                            }
                        </Button>
                    )}
                </div>
            </div>

            {/* ── Stats cards ── */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                    icon={<Building2 className="size-5" />}
                    iconClass="bg-bo-primary-soft text-bo-primary"
                    label="Kho nguồn"
                    value={data.khoXuatTen || "—"}
                />
                <StatTile
                    icon={<Building2 className="size-5" />}
                    iconClass="bg-purple-50 text-purple-600"
                    label="Kho đích"
                    value={data.khoNhapTen || "—"}
                />
                <StatTile
                    icon={<ClipboardList className="size-5" />}
                    iconClass="bg-bo-warning-soft text-bo-warning"
                    label="Số loại SP"
                    value={totalItems}
                />
                <StatTile
                    icon={<Package className="size-5" />}
                    iconClass="bg-bo-success-soft text-bo-success"
                    label="Tổng số lượng"
                    value={totalQty}
                />
            </section>

            {/* ── Thông tin phiếu ── */}
            <SurfaceCard
                title="Thông tin phiếu chuyển kho nội bộ"
                description="Chi tiết về phiếu điều chuyển"
            >
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <InfoField label="Số phiếu xuất gốc" value={data.soPhieuXuat} mono />
                    <InfoField label="Kho nguồn (xuất)"  value={data.khoXuatTen} />
                    <InfoField label="Kho đích (nhập)"   value={data.khoNhapTen} />
                    <InfoField label="Người phê duyệt"   value={data.nguoiDuyetTen || "Chưa duyệt"} />
                    <InfoField
                        label="Ngày tạo"
                        value={formatDate(data.ngayTao)}
                    />
                    <div className="md:col-span-3">
                        <InfoField label="Ghi chú" value={data.ghiChu || "Không có ghi chú"} />
                    </div>
                </div>
            </SurfaceCard>

            {/* ── Danh sách hàng hóa ── */}
            <TableShell
                title="Danh sách hàng hóa luân chuyển"
                description="Chi tiết các sản phẩm trong phiếu"
                footer={
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-bo-muted">
                            Tổng{" "}
                            <span className="font-semibold text-bo-primary">{totalItems}</span>{" "}
                            sản phẩm
                        </p>
                        <p className="text-[11px] italic text-bo-muted">
                            * Việc chọn lô hàng cụ thể được thực hiện tại màn hình <strong>Xuất kho</strong>.
                        </p>
                    </div>
                }
            >
                <table className="w-full min-w-[640px] text-sm">
                    <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th className={`${TH_CLASS} text-left`}>
                                Sản phẩm / SKU
                            </th>
                            <th className={`${TH_CLASS} text-right`}>
                                Số lượng yêu cầu
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {data.items?.map((item, idx) => (
                            <tr key={idx} className="transition-colors hover:bg-bo-surface-subtle">
                                <td className="px-4 py-3.5 align-middle">
                                    <span className="font-semibold leading-snug text-bo-foreground">
                                        {item.tenSanPham}
                                    </span>
                                    <span className="mt-0.5 block font-mono text-xs text-bo-primary">
                                        {item.sku}
                                    </span>
                                </td>
                                <td className="px-4 py-3.5 text-right align-middle">
                                    <span className="inline-flex items-center justify-end rounded-md bg-bo-surface-subtle px-2.5 py-1">
                                        <span className="text-xs font-semibold text-slate-800">
                                            {item.soLuongYeuCau}
                                        </span>
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </TableShell>

            {/* ── Modal xác nhận huỷ ── */}
            {showCancelConfirm && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md overflow-hidden rounded-lg border border-bo-border bg-white shadow-lg">
                        {/* Modal header */}
                        <div className="flex items-center gap-3 border-b border-bo-border px-5 py-4">
                            <div className="flex size-9 items-center justify-center rounded-lg bg-bo-danger-soft">
                                <AlertTriangle className="size-4 text-bo-danger" />
                            </div>
                            <div>
                                <p className="font-semibold leading-snug text-bo-foreground">Xác nhận hủy toàn bộ quy trình</p>
                                <p className="mt-0.5 text-xs text-bo-muted">Hành động này không thể hoàn tác</p>
                            </div>
                        </div>

                        {/* Modal body */}
                        <div className="px-5 py-5">
                            <p className="text-sm leading-relaxed text-bo-foreground">
                                Bạn chắc chắn muốn hủy phiếu{" "}
                                <span className="font-bold text-bo-foreground">{data.soPhieuXuat}</span>?
                            </p>
                            <p className="mt-3 text-sm font-semibold text-bo-danger">
                                Hệ thống sẽ tự động hủy các phiếu xuất/nhập liên quan ngay lập tức.
                            </p>
                        </div>

                        {/* Modal footer */}
                        <div className="flex justify-end gap-2 border-t border-bo-border bg-bo-surface-subtle px-5 py-4">
                            <Button
                                variant="outline"
                                onClick={() => setShowCancelConfirm(false)}
                                className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                Quay lại
                            </Button>
                            <Button
                                disabled={isProcessing}
                                onClick={handleMasterCancel}
                                className="min-w-[140px] gap-2 bg-bo-danger font-semibold text-white hover:bg-bo-danger/90 disabled:opacity-50"
                            >
                                {isProcessing
                                    ? <><Loader2 className="size-4 animate-spin" />Đang xử lý...</>
                                    : "Xác nhận hủy"
                                }
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body // Gắn thẳng modal vào thẻ body
            )}
        </PageContainer>
    );
}

// ── Sub-component ─────────────────────────────────────────────────────────
function InfoField({ label, value, mono = false }) {
    return (
        <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                {label}
            </p>
            <p className={`font-semibold leading-snug text-bo-foreground ${mono ? "font-mono text-bo-primary" : ""}`}>
                {value || "—"}
            </p>
        </div>
    );
}
