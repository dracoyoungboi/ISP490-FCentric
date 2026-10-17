import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { phieuChuyenKhoService } from "@/services/phieuChuyenKhoService";
import purchaseOrderService from "@/services/purchaseOrderService";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { donBanHangService } from "@/services/donBanHangService";
import { getMineKhoList } from "@/services/khoService";
import { toast } from "@/lib/thongBaoNhanh";
import {
    ArrowLeft,
    ArrowRightLeft,
    FileText,
    Loader2,
    Truck,
    Undo2,
    Warehouse,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import FormActions from "@/components/shared/FormActions";
import LoadingState from "@/components/shared/LoadingState";
import StatusBadge from "@/components/shared/StatusBadge";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const SELECT_CLASS =
    "h-9 w-full rounded-md border border-bo-border bg-white px-3 text-sm text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:opacity-50";

const FIELD_LABEL_CLASS = "text-xs font-medium text-bo-foreground";

const SOURCE_TABS = [
    { value: "PO", label: "Nhập từ đối tác", icon: FileText },
    { value: "TRANSFER", label: "Nhận hàng nội bộ", icon: ArrowRightLeft },
    { value: "RETURN", label: "Nhập hàng trả lại", icon: Undo2 },
];

export default function PhieuNhapKhoCreate() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams(); // Đọc params từ URL

    // --- States cho Loại Nhập ---
    const [importSource, setImportSource] = useState("PO"); // "PO", "TRANSFER", hoặc "RETURN"

    // --- Data States ---
    const [poList, setPoList] = useState([]);
    const [transferList, setTransferList] = useState([]);
    const [returnList, setReturnList] = useState([]);
    const [warehouses, setWarehouses] = useState([]);

    const [selectedPO, setSelectedPO] = useState(null);
    const [selectedTransfer, setSelectedTransfer] = useState(null);
    const [selectedReturn, setSelectedReturn] = useState(null);

    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [createdId, setCreatedId] = useState(null);
    // Khóa tạo phiếu: dangTaoRef chặn bấm đúp (state chỉ cập nhật ở lần render sau);
    // createdIdRef giữ id phiếu đã tạo để không bao giờ gọi API tạo lần 2.
    const dangTaoRef = useRef(false);
    const createdIdRef = useRef(null);

    const [form, setForm] = useState({
        donMuaHangId: "",
        transferId: "",
        phieuXuatId: "", // ID phiếu xuất kho dùng cho chức năng hoàn trả
        khoId: "",
        ghiChu: "",
    });

    const handleSelectPO = useCallback(async (id) => {
        if (!id) { setSelectedPO(null); return; }
        setActionLoading(true);
        try {
            const res = await purchaseOrderService.getById(id);
            const data = res.data;
            data.chiTietDonMuaHangs = data.chiTietDonMuaHangs.map(item => {
                const maxQuantity = (item.soLuongDat || 0) - (item.soLuongDaNhan || 0);
                return {
                    ...item,
                    maxSoLuong: maxQuantity,
                    soLuongNhapTay: maxQuantity
                };
            });
            setSelectedPO(data);
            setForm(prev => ({
                ...prev,
                donMuaHangId: data.id,
                khoId: data.khoNhap?.id || prev.khoId,
                ghiChu: `Tạo phiếu nhập kho từ đơn mua ${data.soDonMua}`
            }));
        } catch {
            toast.error("Không thể tải chi tiết đơn mua hàng");
        } finally { setActionLoading(false); }
    }, []);

    const handleSelectTransfer = useCallback(async (id) => {
        if (!id) { setSelectedTransfer(null); return; }
        setActionLoading(true);
        try {
            const res = await phieuChuyenKhoService.getDetail(id);
            const data = res.data || res;
            setSelectedTransfer(data);
            setForm(prev => ({
                ...prev,
                transferId: data.id,
                khoId: data.trangThai === 4 ? data.khoXuatId : data.khoNhapId,
                ghiChu: data.trangThai === 4
                    ? `Nhập hoàn trả (RET) từ phiếu chuyển bị hủy: ${data.soPhieuXuat}`
                    : `Nhập kho nội bộ từ phiếu chuyển: ${data.soPhieuXuat}`
            }));
        } catch {
            toast.error("Không thể tải chi tiết luân chuyển");
        } finally { setActionLoading(false); }
    }, []);

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const myWarehousesRes = await getMineKhoList().catch(() => ({ data: [] }));
            const warehouseList = myWarehousesRes.data || myWarehousesRes || [];
            setWarehouses(warehouseList);
            const myWarehouseIds = warehouseList.map(w => w.id);

            const [poRes, transferRes3, transferRes4, allReceiptsRes, allIssuesRes, returnSoRes] = await Promise.all([
                purchaseOrderService.filter({
                    page: 0, size: 1000,
                    filters: [{ fieldName: "trangThai", operator: "IN", value: [3, 5] }],
                    sorts: [{ fieldName: "id", direction: "DESC" }]
                }).catch(() => ({ content: [] })),

                phieuChuyenKhoService.filter({
                    page: 0, size: 1000,
                    filters: [{ fieldName: "trangThai", operation: "EQUALS", value: 3 }],
                    sorts: [{ fieldName: "ngayCapNhat", direction: "DESC" }]
                }).catch(() => ({ content: [] })),

                phieuChuyenKhoService.filter({
                    page: 0, size: 1000,
                    filters: [{ fieldName: "trangThai", operation: "EQUALS", value: 4 }],
                    sorts: [{ fieldName: "ngayCapNhat", direction: "DESC" }]
                }).catch(() => ({ content: [] })),

                phieuNhapKhoService.filter({ page: 0, size: 2000 }).catch(() => ({ content: [] })),

                phieuXuatKhoService.filter({ page: 0, size: 2000 }).catch(() => ({ content: [] })),

                // Fetch các Đơn Bán Hàng trạng thái 6 (Bị hoàn trả) để tham chiếu
                donBanHangService.filter({
                    page: 0, size: 1000,
                    filters: [{ fieldName: "trangThai", operation: "EQUALS", value: 6 }],
                    sorts: [{ fieldName: "ngayCapNhat", direction: "DESC" }]
                }).catch(() => ({ content: [] }))
            ]);

            // === 1. XỬ LÝ PO (Logic nguyên gốc) ===
            const rawPoList = poRes.data?.content || poRes.content || [];
            const validPoList = rawPoList.filter(po => {
                if (po.trangThai !== 3 && po.trangThai !== 5) return false;
                const targetKhoId = po.khoNhap?.id || po.khoNhapId;
                if (!targetKhoId) return false;

                const isMyWarehouse = myWarehouseIds.map(Number).includes(Number(targetKhoId));
                if (!isMyWarehouse) return false;
                if (po.chiTietDonMuaHangs && Array.isArray(po.chiTietDonMuaHangs)) {
                    return po.chiTietDonMuaHangs.some(ct => (ct.soLuongDaNhan || 0) < (ct.soLuongDat || 0));
                }

                return true;
            });
            setPoList(validPoList);

            // === 2. XỬ LÝ TRANSFER (Logic nguyên gốc) ===
            const allReceipts = allReceiptsRes.content || allReceiptsRes.data?.content || [];
            const usedTransferIds = new Set(
                allReceipts
                    .filter(r => r.trangThai === 3)
                    .map(r => Number(r.phieuXuatGocId || r.phieuChuyenId || r.transferId))
                    .filter(id => id > 0)
            );

            const allIssues = allIssuesRes.content || allIssuesRes.data?.content || [];
            const validIssueTransferIds = new Set(
                allIssues
                    .filter(pxk => pxk.trangThai === 3)
                    .map(pxk => Number(pxk.phieuChuyenKhoGocId || pxk.phieuChuyenId || pxk.transferId))
                    .filter(id => id > 0)
            );

            // 3. Xử lý gộp và lọc Phiếu Chuyển Kho
            const rawTransfers = [
                ...(transferRes3.content || transferRes3.data?.content || []),
                ...(transferRes4.content || transferRes4.data?.content || [])
            ];

            const availableTransfers = rawTransfers.filter(t => {
                // Ép kiểu ID hiện tại về Number để check trong Set
                const currentTransferId = Number(t.id);

                // Nếu đã nhập kho rồi -> Loại bỏ
                if (usedTransferIds.has(currentTransferId)) return false;

                if (t.trangThai === 3) {
                    // PHIẾU ĐANG VẬN CHUYỂN: Chỉ kho NHẬN (đích) mới được thấy
                    const targetKhoId = t.khoNhapId || t.khoChuyenDen?.id;
                    if (!targetKhoId) return false;
                    return myWarehouseIds.map(Number).includes(Number(targetKhoId));
                }
                else if (t.trangThai === 4) {
                    // PHIẾU ĐÃ HỦY: Chỉ kho XUẤT (nguồn) mới được thấy
                    const sourceKhoId = t.khoXuatId || t.kho?.id;
                    if (!sourceKhoId) return false;

                    const isMyWarehouse = myWarehouseIds.map(Number).includes(Number(sourceKhoId));

                    // PHẢI tồn tại phiếu xuất từ phiếu chuyển này và phiếu xuất đó phải ở trạng thái 3
                    const hasValidIssue = validIssueTransferIds.has(currentTransferId);

                    return isMyWarehouse && hasValidIssue;
                }

                return false;
            });

            setTransferList(availableTransfers);

            // Lọc phiếu xuất thuộc đơn hàng bị hoàn trả
            const rawReturnSOs = returnSoRes.content || returnSoRes.data?.content || [];
            const returnedSOIds = new Set(rawReturnSOs.map(so => Number(so.id)));

            // Lọc ra các Phiếu nhập hoàn trả đang TỒN TẠI (Trạng thái khác 4 - Đã hủy)
            const activeReturnReceipts = allReceipts.filter(r =>
                r.trangThai !== 4 &&
                (r.soPhieuNhap?.includes("-RET-") || (r.loaiNhap || "").toLowerCase().includes("hoàn trả"))
            );

            const availableReturnPXs = allIssues.filter(px => {
                if (px.trangThai !== 3) return false; // Phải là phiếu đã xuất thành công
                if (!px.donBanHang || !returnedSOIds.has(Number(px.donBanHang.id))) return false; // Phải thuộc Đơn bán hàng bị hoàn trả

                // Kho xuất đi phải là kho thuộc quyền quản lý của nhân viên (để trả về đúng kho)
                const targetKhoId = px.kho?.id || px.khoXuatId;
                if (!targetKhoId || !myWarehouseIds.map(Number).includes(Number(targetKhoId))) return false;

                // Kiểm tra xem phiếu xuất này đã bị lấy đi tạo Phiếu nhập hoàn trả nào chưa (dựa vào ghi chú chứa mã phiếu xuất)
                const isAlreadyReturned = activeReturnReceipts.some(receipt =>
                    receipt.ghiChu?.includes(px.soPhieuXuat)
                );
                if (isAlreadyReturned) return false; // Nếu đã có phiếu nhập -> Ẩn khỏi dropdown

                return true;
            });
            setReturnList(availableReturnPXs);

            if (warehouseList.length === 1) {
                setForm(prev => ({ ...prev, khoId: warehouseList[0].id }));
            }

            // === URL PARAMS AUTO SELECT ===
            const urlPoId = searchParams.get("poId");
            const urlTransferId = searchParams.get("transferId");

            if (urlPoId) {
                // Tìm trong danh sách hợp lệ xem có PO này không
                const poInList = validPoList.find(p => String(p.id) === String(urlPoId));
                if (poInList) {
                    // Gọi hàm handleSelectPO để load chi tiết và set selectedPO
                    await handleSelectPO(urlPoId);
                } else {
                    toast.warning("Đơn mua này không đủ điều kiện để nhập kho hoặc bạn không có quyền");
                }
            } else if (urlTransferId) {
                setImportSource("TRANSFER");
                const isTransferValid = availableTransfers.some(t => String(t.id) === String(urlTransferId));
                if (isTransferValid) {
                    await handleSelectTransfer(urlTransferId);
                } else {
                    toast.warning("Yêu cầu chuyển kho này không đủ điều kiện nhập kho hoặc bạn không có quyền");
                }
            }

        } catch {
            toast.error("Không thể tải dữ liệu khởi tạo");
        } finally {
            setLoading(false);
        }
    }, [searchParams, handleSelectPO, handleSelectTransfer]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect
    // (react-hooks/set-state-in-effect); dữ liệu khởi tạo vẫn tải ngay khi mount.
    useEffect(() => {
        queueMicrotask(() => fetchInitialData());
    }, [fetchInitialData]);

    const handleQuantityChange = (chiTietId, newValue) => {
        setSelectedPO(prev => {
            if (!prev) return prev;

            const updatedItems = prev.chiTietDonMuaHangs.map(ct => {
                if (ct.id === chiTietId) {
                    let finalValue = newValue;
                    if (newValue !== "") {
                        finalValue = parseInt(newValue, 10);
                        if (isNaN(finalValue) || finalValue < 0) finalValue = 0;
                        if (finalValue > ct.maxSoLuong) finalValue = ct.maxSoLuong;
                    }

                    return { ...ct, soLuongNhapTay: finalValue };
                }
                return ct;
            });

            return { ...prev, chiTietDonMuaHangs: updatedItems };
        });
    };

    // Bổ sung handler khi chọn Phiếu Xuất trả lại
    const handleSelectReturn = useCallback(async (id) => {
        if (!id) {
            setSelectedReturn(null);
            setForm(prev => ({ ...prev, phieuXuatId: "", ghiChu: "" })); // Reset form khi bỏ chọn
            return;
        }
        setActionLoading(true);
        try {
            const res = await phieuXuatKhoService.getDetail(id);
            const data = res.data || res;

            setSelectedReturn(data); // Lưu nguyên vẹn để dùng cho việc map danh sách chi tiết
            const selectedItem = returnList.find(px => String(px.id) === String(id));

            setForm(prev => ({
                ...prev,
                phieuXuatId: id, // Lấy cứng ID truyền vào luôn, không sợ undefined
                khoId: selectedItem?.kho?.id || selectedItem?.khoXuatId || prev.khoId,
                ghiChu: `Nhập hoàn trả từ phiếu xuất: ${selectedItem?.soPhieuXuat} (Đơn: ${selectedItem?.donBanHang?.soDonHang || 'Không rõ'})`
            }));
        } catch {
            toast.error("Không thể tải chi tiết phiếu xuất");
        } finally { setActionLoading(false); }
    }, [returnList]);

    // Trả về id phiếu (đã có hoặc vừa tạo); null nếu chưa tạo được hoặc đang tạo dở
    async function createPhieu() {
        if (createdIdRef.current) return createdIdRef.current;
        if (dangTaoRef.current) return null;
        dangTaoRef.current = true;
        try {
            const newId = await taoPhieuMoi();
            if (newId) {
                createdIdRef.current = newId;
                setCreatedId(newId);
            }
            return newId;
        } finally {
            dangTaoRef.current = false;
        }
    }

    async function taoPhieuMoi() {
        if (importSource === "PO") {
            if (!selectedPO) return toast.error("Vui lòng chọn đơn mua hàng"), null;
            const chiTiet = selectedPO.chiTietDonMuaHangs.map(ct => ({
                bienTheSanPhamId: ct.bienTheSanPham.id,
                soLuongDuKienNhap: Number(ct.soLuongNhapTay) || 0
            })).filter(ct => ct.soLuongDuKienNhap > 0);

            try {
                setActionLoading(true);
                const res = await phieuNhapKhoService.create({
                    donMuaHangId: selectedPO.id,
                    ghiChu: form.ghiChu,
                    chiTietPhieuNhapKhos: chiTiet
                });
                toast.success("Tạo phiếu nhập thành công");
                return res.id;
            } catch (e) {
                toast.error(e?.response?.data?.message || "Lỗi khi tạo phiếu nhập");
                return null;
            } finally { setActionLoading(false); }
        } else if (importSource === "TRANSFER") {
            if (!form.transferId) return toast.error("Vui lòng chọn yêu cầu chuyển kho"), null;
            try {
                setActionLoading(true);
                const res = await phieuNhapKhoService.createFromTransfer(form.transferId);
                const newId = res.data?.id || res.id;
                toast.success("Khởi tạo phiếu nhập luân chuyển thành công");
                return newId;
            } catch (e) {
                toast.error(e?.response?.data?.message || "Không thể tạo phiếu");
                return null;
            } finally { setActionLoading(false); }
        } else if (importSource === "RETURN") {
            if (!form.phieuXuatId) return toast.error("Vui lòng chọn phiếu xuất của đơn hàng cần hoàn trả"), null;
            try {
                setActionLoading(true);
                const res = await phieuNhapKhoService.createFromSalesReturn(form.phieuXuatId, { ghiChu: form.ghiChu });
                const newId = res.data?.id || res.id;
                toast.success("Khởi tạo phiếu nhập trả hàng thành công");
                return newId;
            } catch (e) {
                toast.error(e?.response?.data?.message || "Không thể tạo phiếu nhập hoàn trả");
                return null;
            } finally { setActionLoading(false); }
        }
    }

    // "Lưu nháp" và "Tiếp tục khai Lô" cùng tạo phiếu (một lần) rồi mở chi tiết phiếu vừa tạo
    // — ở đó khai báo lô / hủy phiếu. Phiếu đã tạo thì chỉ mở lại, không tạo thêm.
    const handleContinue = async () => {
        const id = await createPhieu();
        if (id) navigate(`/goods-receipts/${id}`);
    };

    if (loading) {
        return (
            <PageContainer>
                <LoadingState rows={4} label="Đang tải dữ liệu khởi tạo" />
            </PageContainer>
        );
    }

    const returnItemsToRender = selectedReturn?.chiTiet || selectedReturn?.chiTietPhieuXuatKhos || [];
    const noSourceSelected =
        (importSource === "PO" && !selectedPO) ||
        (importSource === "TRANSFER" && !selectedTransfer) ||
        (importSource === "RETURN" && !selectedReturn);

    return (
        <PageContainer className="space-y-5">
            <Link
                to="/goods-receipts"
                className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
            >
                <ArrowLeft className="size-4" />
                Quay lại danh sách
            </Link>

            <PageHeader
                title="Tạo phiếu nhập kho"
                description="Chọn nguồn chứng từ phù hợp để khởi tạo phiếu nhập kho."
            />

            {/* ── Source Toggle ── */}
            <div className="flex w-fit flex-wrap items-center gap-1 rounded-lg border border-bo-border bg-bo-surface-subtle p-1">
                {SOURCE_TABS.map(tab => {
                    const TabIcon = tab.icon;
                    const isActive = importSource === tab.value;
                    return (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setImportSource(tab.value)}
                            className={
                                isActive
                                    ? "flex items-center gap-2 rounded-md bg-white px-4 py-1.5 text-sm font-semibold text-bo-primary shadow-sm"
                                    : "flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-foreground"
                            }
                        >
                            <TabIcon className="size-3.5" /> {tab.label}
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
                {/* ── Settings ── */}
                <div className="lg:col-span-1">
                    <SurfaceCard title="Thông tin nguồn" className="h-full">
                        <div className="flex flex-col gap-5">
                            {importSource === "PO" && (
                                <div className="flex flex-col gap-2">
                                    <label className={FIELD_LABEL_CLASS}>Đơn liên kết</label>
                                    <select
                                        className={SELECT_CLASS}
                                        value={form.donMuaHangId}
                                        onChange={(e) => handleSelectPO(e.target.value)}
                                    >
                                        <option value="">-- Chọn đơn --</option>
                                        {poList.map(po => <option key={po.id} value={po.id}>{po.soDonMua} - {po.nhaCungCap?.tenNhaCungCap}</option>)}
                                    </select>
                                </div>
                            )}
                            {importSource === "TRANSFER" && (
                                <div className="flex flex-col gap-2">
                                    <label className={FIELD_LABEL_CLASS}>Yêu cầu luân chuyển</label>
                                    <select
                                        className={SELECT_CLASS}
                                        value={form.transferId}
                                        onChange={(e) => handleSelectTransfer(e.target.value)}
                                    >
                                        <option value="">-- Chọn chứng từ vận chuyển --</option>
                                        {transferList.map(t => <option key={t.id} value={t.id}>{t.soPhieuXuat} ({t.kho?.tenKho} → {t.khoChuyenDen?.tenKho})</option>)}
                                    </select>
                                </div>
                            )}
                            {importSource === "RETURN" && (
                                <div className="flex flex-col gap-2">
                                    <label className={FIELD_LABEL_CLASS}>Phiếu xuất hoàn trả</label>
                                    <select
                                        className={SELECT_CLASS}
                                        value={form.phieuXuatId}
                                        onChange={(e) => handleSelectReturn(e.target.value)}
                                    >
                                        <option value="">-- Chọn phiếu xuất --</option>
                                        {returnList.map(px => (
                                            <option key={px.id} value={px.id}>
                                                {px.soPhieuXuat} (Đơn: {px.donBanHang?.soDonHang})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <label className={FIELD_LABEL_CLASS}>Kho tiếp nhận</label>
                                <div className="flex h-9 items-center gap-2 rounded-md border border-dashed border-bo-border bg-bo-surface-subtle px-3 text-sm font-medium text-bo-foreground">
                                    <Warehouse className="size-3.5 shrink-0 opacity-60" />
                                    <span className="truncate">
                                        {form.khoId ? warehouses.find(k => k.id === parseInt(form.khoId))?.tenKho : "Tự động trích xuất"}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className={FIELD_LABEL_CLASS}>Ghi chú phiếu</label>
                                <Textarea
                                    className="min-h-24 border-bo-border bg-white text-sm text-bo-foreground placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                                    placeholder="..."
                                    value={form.ghiChu}
                                    onChange={(e) => setForm(p => ({ ...p, ghiChu: e.target.value }))}
                                />
                            </div>
                        </div>
                    </SurfaceCard>
                </div>

                {/* ── Content Preview ── */}
                <div className="lg:col-span-2">
                    <SurfaceCard
                        title="Mặt hàng dự kiến"
                        className="h-full"
                        contentClassName="p-0"
                        action={
                            <>
                                {/* Mã chứng từ nguồn là chữ thường (không bấm được nên không tô màu) */}
                                {importSource === "PO" && selectedPO && (
                                    <span className="font-mono text-xs font-semibold text-slate-600">#{selectedPO.soDonMua}</span>
                                )}
                                {importSource === "TRANSFER" && selectedTransfer && (
                                    <span className="font-mono text-xs font-semibold text-slate-600">#{selectedTransfer.soPhieuXuat}</span>
                                )}
                                {importSource === "RETURN" && selectedReturn && (
                                    <span className="font-mono text-xs font-semibold text-slate-600">#{selectedReturn?.phieu.soPhieuXuat}</span>
                                )}
                            </>
                        }
                    >
                        <div className="min-h-[320px] overflow-x-auto">
                            {noSourceSelected ? (
                                <div className="flex h-[320px] flex-col items-center justify-center gap-3 text-bo-muted">
                                    <Truck className="size-10 text-slate-300" />
                                    <p className="text-xs font-medium uppercase tracking-widest">
                                        Vui lòng chọn nguồn chứng từ
                                    </p>
                                </div>
                            ) : (
                                <table className="w-full min-w-[560px] text-sm">
                                    <thead>
                                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                                            <th className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Sản phẩm</th>
                                            <th className="h-10 px-4 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Số lượng</th>
                                            <th className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-bo-border">
                                        {importSource === "PO" ? selectedPO.chiTietDonMuaHangs.map(ct => (
                                            <tr key={ct.id} className="transition-colors hover:bg-bo-surface-subtle">
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-bo-foreground">
                                                        {ct.bienTheSanPham?.tenSanPham || 'Tên sản phẩm'}
                                                    </div>
                                                    <div className="mt-0.5 font-mono text-[11px] text-bo-muted">{ct.bienTheSanPham?.maSku}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-1">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={ct.maxSoLuong}
                                                            className="h-9 w-24 rounded-md border border-bo-border bg-white px-2 text-center text-sm font-semibold text-bo-primary focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15"
                                                            value={ct.soLuongNhapTay}
                                                            onChange={(e) => handleQuantityChange(ct.id, e.target.value)}
                                                        />
                                                        {ct.soLuongDaNhan > 0 && (
                                                            <span className="text-[10px] font-medium text-bo-muted">
                                                                Đã nhận: {ct.soLuongDaNhan}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusBadge label="Chờ nhập" />
                                                </td>
                                            </tr>
                                        )) : importSource === "TRANSFER" ? selectedTransfer.items?.map(item => (
                                            <tr key={item.id} className="transition-colors hover:bg-bo-surface-subtle">
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-bo-foreground">{item.tenSanPham}</div>
                                                    <div className="mt-0.5 font-mono text-[11px] text-bo-muted">{item.sku}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="text-sm font-semibold text-bo-primary">{item.soLuongYeuCau}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusBadge label="Đang vận chuyển" />
                                                </td>
                                            </tr>
                                        )) : returnItemsToRender.map(item => (
                                            <tr key={item.id} className="transition-colors hover:bg-bo-surface-subtle">
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-bo-foreground">{item.tenSanPham || item.bienTheSanPham?.sanPham?.tenSanPham || 'Sản phẩm'}</div>
                                                    <div className="mt-0.5 font-mono text-[11px] text-bo-muted">{item.sku || item.bienTheSanPham?.maSku}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="text-sm font-semibold text-bo-danger">{item.soLuongCanXuat || item.soLuong}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusBadge label="Hàng trả lại" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </SurfaceCard>
                </div>
            </div>

            {/* ── Footer Actions ── */}
            <FormActions>
                <Button
                    variant="outline"
                    onClick={handleContinue}
                    disabled={actionLoading || !form.khoId || Boolean(createdId)}
                    className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                >
                    {actionLoading && <Loader2 className="size-4 animate-spin" />}
                    Lưu nháp
                </Button>
                <Button
                    onClick={handleContinue}
                    disabled={actionLoading || !form.khoId}
                    className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50"
                >
                    {actionLoading ? <Loader2 className="size-4 animate-spin" /> : (
                        importSource === "RETURN" ? <Undo2 className="size-4" /> : <ArrowRightLeft className="size-4" />
                    )}
                    {importSource === "PO" ? "Tiếp tục khai Lô" : (importSource === "RETURN" ? "Xác nhận nhập kho" : "Nhập kho ngay")}
                </Button>
            </FormActions>
        </PageContainer>
    );
}
