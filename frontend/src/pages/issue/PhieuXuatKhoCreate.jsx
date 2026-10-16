import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import { getMineKhoList } from "@/services/khoService";
import { toast } from "@/lib/thongBaoNhanh";
import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    ChevronDown, Warehouse, ArrowRightLeft, Package,
    ArrowLeft, Loader2, Info as InfoIcon,
} from "lucide-react";

const FIELD_LABEL_CLASS =
    "text-xs font-semibold uppercase tracking-wide text-bo-muted";
const DROPDOWN_CONTENT_CLASS =
    "z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg";
const DROPDOWN_ITEM_CLASS =
    "cursor-pointer rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";
const TH_CLASS =
    "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

/**
 * Tạo phiếu xuất CHUYỂN KHO từ yêu cầu chuyển kho đã duyệt. Phiếu xuất bán hàng không tạo ở đây: hệ thống sinh khi
 * hoàn tất nhặt hàng (có sẵn lô của phiếu nhặt); phiếu bị hủy sau khi nhặt thì "Tạo lại phiếu xuất" ở màn đơn bán.
 */
export default function PhieuXuatKhoCreate() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams(); // Lấy query param từ URL

    const [transferList, setTransferList] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedTransfer, setSelectedTransfer] = useState(null);
    const [loading, setLoading] = useState(false);
    const [createdId, setCreatedId] = useState(null);
    const [form, setForm] = useState({ transferId: "", khoId: "" });

    const handleSelectTransfer = useCallback(async (transferId) => {
        if (!transferId) {
            setSelectedTransfer(null);
            setForm((prev) => ({ ...prev, transferId: "" }));
            return;
        }
        try {
            const res = await phieuChuyenKhoService.getDetail(transferId);
            const data = res.data || res;
            setSelectedTransfer(data);
            setForm(prev => ({ ...prev, transferId: data.id, khoId: data.khoXuatId }));
        } catch { toast.error("Không thể tải chi tiết yêu cầu chuyển kho"); }
    }, []);

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const myWarehousesRes = await getMineKhoList();
            const warehouseList = myWarehousesRes.data || myWarehousesRes;
            setWarehouses(warehouseList);
            const myWarehouseIds = warehouseList.map(w => w.id);

            // 1. Tải danh sách Phiếu Chuyển Kho đã duyệt
            const transferRes = await phieuChuyenKhoService.filter({
                page: 0, size: 1000,
                filters: [{ fieldName: "trangThai", operation: "EQUALS", value: 2 }],
                sorts: [{ fieldName: "ngayTao", direction: "DESC" }],
            });

            // 2. Tải danh sách Phiếu Xuất Kho (Bỏ filter NOT_IN để tránh lỗi Backend)
            const exportsRes = await phieuXuatKhoService.filter({
                page: 0, size: 10000
            });

            const allExportsRaw = exportsRes.content || exportsRes.data?.content || [];

            // Lọc bỏ các phiếu đã hủy (trạng thái = 4) bằng JavaScript
            const allExports = allExportsRaw.filter(pxk => pxk.trangThai !== 4);

            // Trích xuất ra mảng ID của các phiếu chuyển đã được tạo phiếu xuất
            const usedTransferIds = allExports
                .map(pxk => pxk.phieuChuyenKhoGocId)
                .filter(Boolean); // Lọc bỏ null/undefined

            // 3. Lọc phiếu chuyển kho
            const allTransfers = transferRes.content || transferRes.data?.content || [];
            const validTransfers = allTransfers.filter(t => {
                const idKhoXuat = t.kho?.id;
                if (!idKhoXuat) return false;

                // Điều kiện 1: Thuộc kho của tôi
                const isMyWarehouse = myWarehouseIds.map(Number).includes(Number(idKhoXuat));

                // Điều kiện 2: Chưa bị tạo phiếu xuất trước đó (ID không nằm trong mảng usedTransferIds)
                const isNotDuplicated = !usedTransferIds.includes(t.id);

                return isMyWarehouse && isNotDuplicated;
            });

            setTransferList(validTransfers);

            if (warehouseList.length === 1)
                setForm(prev => ({ ...prev, khoId: warehouseList[0].id }));

            // Liên kết cũ "?soId=" (tạo phiếu xuất bán hàng tay) không còn dùng
            if (searchParams.get("soId")) {
                toast.info("Phiếu xuất bán hàng được tạo tự động khi hoàn tất nhặt hàng. Gom đơn vào phiếu nhặt ở màn Đơn chờ xuất.");
            }

            // auto-fill nếu có param transferId TỪ URL
            const urlTransferId = searchParams.get("transferId");
            if (urlTransferId) {
                const isTransferValid = validTransfers.some(t => String(t.id) === String(urlTransferId));
                if (isTransferValid) {
                    await handleSelectTransfer(urlTransferId);
                } else {
                    toast.warning("Yêu cầu chuyển kho này không đủ điều kiện xuất kho hoặc bạn không có quyền");
                }
            }

        } catch {
            toast.error("Không thể tải dữ liệu khởi tạo");
        } finally {
            setLoading(false);
        }
    }, [searchParams, handleSelectTransfer]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu khởi tạo vẫn tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => fetchInitialData());
    }, [fetchInitialData]);

    async function createPhieu() {
        if (!form.transferId) return toast.error("Vui lòng chọn yêu cầu chuyển kho"), null;
        try {
            setLoading(true);
            const res = await phieuChuyenKhoService.createExport(form.transferId);
            const newId = res.data?.id || res.id;
            setCreatedId(newId);
            toast.success("Khởi tạo phiếu xuất chuyển kho thành công");
            return newId;
        } catch (e) { toast.error(e?.response?.data?.message || "Không thể tạo phiếu xuất chuyển kho"); return null; }
        finally { setLoading(false); }
    }

    async function handleSaveDraft() { await createPhieu(); }
    async function handleContinue() {
        const id = createdId || await createPhieu();
        if (id) navigate(`/goods-issues/${id}`);
    }

    const transferLabel = form.transferId ? transferList.find(t => t.id === parseInt(form.transferId))?.soPhieuXuat : "Chọn yêu cầu chuyển kho";
    const khoLabel = form.khoId ? warehouses.find(k => k.id === parseInt(form.khoId))?.tenKho : "Tự động trích xuất";
    const canSubmit = !loading && Boolean(form.transferId);

    return (
        <PageContainer className="space-y-5">

            {/* ── Header ── */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={() => navigate("/goods-issues")}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
                >
                    <ArrowLeft className="size-4" />
                    Quay lại danh sách
                </button>

                <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-bo-border bg-bo-surface-subtle px-3.5 py-2 text-sm font-semibold text-bo-foreground">
                    <ArrowRightLeft className="size-4 text-bo-primary" />
                    Xuất chuyển kho nội bộ
                </span>
            </div>

            <div role="note" className="flex items-start gap-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-3 text-sm text-slate-700">
                <InfoIcon className="mt-0.5 size-4 shrink-0 text-bo-muted" />
                <p>
                    Phiếu xuất bán hàng được tạo tự động khi hoàn tất nhặt hàng, có sẵn lô của phiếu nhặt. Gom đơn vào phiếu nhặt ở màn{" "}
                    <Link to="/goods-issues/pending-orders" className="font-semibold text-bo-primary hover:underline">Đơn chờ xuất</Link>.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

                {/* ── LEFT: Thông tin phiếu xuất ── */}
                <SurfaceCard
                    className="lg:col-span-1"
                    title="Thông tin phiếu xuất"
                    description="Chọn yêu cầu chuyển kho"
                    contentClassName="space-y-5"
                >
                    {/* Nguồn */}
                    <div className="space-y-1.5">
                        <label className={FIELD_LABEL_CLASS}>Yêu cầu chuyển kho</label>
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-10 w-full justify-between border-bo-border bg-white font-normal text-bo-foreground hover:bg-bo-surface-subtle">
                                    <div className="flex min-w-0 items-center">
                                        <Package className="mr-2 size-4 shrink-0 text-bo-muted" />
                                        <span className="truncate text-sm">{transferLabel}</span>
                                    </div>
                                    <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="start"
                                className={`${DROPDOWN_CONTENT_CLASS} max-h-[300px] w-[280px] overflow-y-auto`}
                            >
                                {transferList.length === 0 ? (
                                    <DropdownMenuItem disabled className="px-2.5 py-1.5 text-sm italic text-bo-muted">Không có yêu cầu nào khả dụng</DropdownMenuItem>
                                ) : transferList.map(t => (
                                    <DropdownMenuItem key={t.id} onClick={() => handleSelectTransfer(t.id)} className={`${DROPDOWN_ITEM_CLASS} flex flex-col items-start py-2`}>
                                        <span className="font-medium text-slate-900">{t.soPhieuXuat}</span>
                                        <span className="text-xs text-bo-muted">Đến: {t.khoChuyenDen?.tenKho}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Kho xuất */}
                    <div className="space-y-1.5">
                        <label className={FIELD_LABEL_CLASS}>Kho xuất hàng</label>
                        <Button variant="outline" disabled className="h-10 w-full justify-between border-bo-border bg-bo-surface-subtle font-semibold text-bo-foreground disabled:opacity-80">
                            <div className="flex min-w-0 items-center">
                                <Warehouse className="mr-2 size-4 shrink-0 text-bo-muted" />
                                <span className="truncate text-sm">{khoLabel}</span>
                            </div>
                        </Button>
                    </div>
                </SurfaceCard>

                {/* ── RIGHT: Bảng sản phẩm ── */}
                <div className="lg:col-span-2">
                    {!selectedTransfer ? (
                        <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                            <EmptyState
                                icon={Package}
                                title="Chưa có dữ liệu"
                                description="Vui lòng chọn yêu cầu chuyển kho để xem danh sách sản phẩm."
                            />
                        </div>
                    ) : (
                        <TableShell
                            title="Chi tiết yêu cầu điều chuyển"
                            description="Danh sách hàng hóa cần xuất kho"
                            toolbar={
                                selectedTransfer.soPhieuXuat ? (
                                    <div className="flex justify-end px-4 pt-3 sm:px-5">
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-bo-border bg-bo-surface-subtle px-2.5 py-1 text-xs font-semibold text-slate-600">
                                            {selectedTransfer.soPhieuXuat}
                                        </span>
                                    </div>
                                ) : null
                            }
                            footer={
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-bo-muted">
                                        <span className="font-semibold text-bo-foreground">
                                            Kho đích: {selectedTransfer.khoNhapTen}
                                        </span>
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={handleSaveDraft}
                                            disabled={!canSubmit}
                                            className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                                        >
                                            Tạo phiếu
                                        </Button>
                                        <Button
                                            onClick={handleContinue}
                                            disabled={!canSubmit}
                                            className="min-w-[160px] gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                                        >
                                            {loading
                                                ? <><Loader2 className="size-4 animate-spin" />Đang xử lý...</>
                                                : "Tiếp tục bốc Lô →"
                                            }
                                        </Button>
                                    </div>
                                </div>
                            }
                        >
                            <table className="w-full min-w-[520px] text-sm">
                                <thead>
                                    <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                        <th className={`${TH_CLASS} text-left`}>Mặt hàng</th>
                                        <th className={`${TH_CLASS} text-right`}>SL Yêu cầu</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-bo-border">
                                    {selectedTransfer.items?.map((item) => (
                                        <tr key={item.bienTheId} className="transition-colors hover:bg-bo-surface-subtle">
                                            <td className="px-4 py-3.5 align-middle">
                                                <span className="font-semibold text-bo-foreground">{item.tenSanPham}</span>
                                                <span className="mt-0.5 block font-mono text-xs text-bo-muted">{item.sku}</span>
                                            </td>
                                            <td className="px-4 py-3.5 text-right align-middle">
                                                <span className="inline-flex items-center justify-end rounded-md bg-bo-surface-subtle px-2.5 py-1">
                                                    <span className="text-xs font-semibold text-slate-800">{item.soLuongYeuCau}</span>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </TableShell>
                    )}
                </div>
            </div>
        </PageContainer>
    );
}
