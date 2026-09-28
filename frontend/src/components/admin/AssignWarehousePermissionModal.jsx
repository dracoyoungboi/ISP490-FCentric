import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Warehouse, AlertCircle } from "lucide-react";
import { khoService } from "@/services/khoService";
import { quyenHanService } from "@/services/quyenHan";
import PermissionMatrix from "./PermissionMatrix";
import { toast } from "sonner";
import { parseDateTimeToIsoString } from "@/utils/formatters";

export default function AssignWarehousePermissionModal({
    open,
    onClose,
    userId,
    onAssigned,
    existingAssignments = [],
}) {
    const [warehouses, setWarehouses] = useState([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [selectedPermissions, setSelectedPermissions] = useState({});
    const [ghiChu, setGhiChu] = useState("")
    const [ngayKetThuc, setNgayKetThuc] = useState(null);
    const pageSize = 20;

    // Người dùng đang có 1 phân quyền kho hoạt động: khoá modal vào đúng kho đó.
    // Nhiều hơn 1 phân quyền hoạt động: không cho phép thao tác (phải dọn dẹp trước).
    const lockedAssignment =
        existingAssignments?.length === 1 ? existingAssignments[0] : null;
    const hasMultipleActive = (existingAssignments?.length ?? 0) > 1;

    const selectedWarehouseCount = useMemo(
        () => (lockedAssignment ? 1 : warehouses.filter((w) => w.isSelected).length),
        [warehouses, lockedAssignment]
    );

    const selectedPermissionCount = useMemo(
        () => Object.values(selectedPermissions || {}).filter(Boolean).length,
        [selectedPermissions]
    );

    const canSubmitAssign =
        !hasMultipleActive &&
        selectedWarehouseCount === 1 &&
        selectedPermissionCount > 0;

    const resetState = useCallback(() => {
        setWarehouses([]);
        setPage(0);
        setHasMore(true);
        setLoading(false);
        setLoadingMore(false);
        setAssigning(false);
        setSelectedPermissions({});
        setGhiChu("");
        setNgayKetThuc(null);
    }, []);

    const mapKhoToItem = (warehouse) => ({
        id: warehouse.id,
        maKho: warehouse.maKho,
        tenKho: warehouse.tenKho,
        diaChi: warehouse.diaChi,
        trangThai: warehouse.trangThai,
        isSelected: false,
        isManager: false,
    });

    const loadWarehouses = useCallback(
        async (pageToLoad) => {
            if (pageToLoad === 0) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            try {
                const res = await khoService.filter({
                    page: pageToLoad,
                    size: pageSize,
                });

                const content = res?.data?.data?.content || [];

                setWarehouses((prev) => {
                    const existingById = new Map(prev.map((warehouse) => [warehouse.id, warehouse]));
                    const next = [...prev];

                    content.forEach((k) => {
                        const existing = existingById.get(k.id);
                        if (existing) {
                            // giữ lại trạng thái chọn hiện tại
                            next[next.indexOf(existing)] = {
                                ...existing,
                                maKho: k.maKho,
                                tenKho: k.tenKho,
                                diaChi: k.diaChi,
                                trangThai: k.trangThai,
                            };
                        } else {
                            next.push(mapKhoToItem(k));
                        }
                    });

                    return next;
                });

                setPage(pageToLoad);
                if (content.length < pageSize) {
                    setHasMore(false);
                }
            } catch (e) {
                console.error("Lỗi load danh sách kho", e);
                setHasMore(false);
            } finally {
                if (pageToLoad === 0) {
                    setLoading(false);
                } else {
                    setLoadingMore(false);
                }
            }
        },
        [pageSize]
    );

    useEffect(() => {
        if (open) {
            resetState();
            // Khoá vào kho đang phụ trách: điền sẵn các quyền đang hoạt động của kho đó.
            // Hoãn qua microtask để tránh setState đồng bộ trong effect
            // (react-hooks/set-state-in-effect).
            const active = existingAssignments?.length === 1 ? existingAssignments[0] : null;
            queueMicrotask(() => {
                if (active) {
                    const prefilled = {};
                    (active.chiTietQuyenKhos || []).forEach((ct) => {
                        const pid = ct?.quyenHan?.id;
                        if (pid != null && Number(ct.trangThai) === 1) {
                            prefilled[pid] = true;
                        }
                    });
                    setSelectedPermissions(prefilled);
                }
            });
            loadWarehouses(0);
        } else {
            resetState();
        }
    }, [open, existingAssignments, loadWarehouses, resetState]);

    const handleScrollWarehouses = (e) => {
        const el = e.currentTarget;
        if (
            !loadingMore &&
            hasMore &&
            el.scrollHeight - el.scrollTop - el.clientHeight < 80
        ) {
            loadWarehouses(page + 1);
        }
    };

    const toggleWarehouseSelected = (warehouseId) => {
        // Đang khoá vào kho phụ trách hiện tại: không đổi kho trong modal.
        if (lockedAssignment) return;
        setWarehouses((prev) =>
            prev.map((warehouse) => {
                if (warehouse.id === warehouseId) {
                    return {
                        ...warehouse,
                        isSelected: !warehouse.isSelected,
                        isManager: warehouse.isSelected ? false : warehouse.isManager,
                    };
                }
                // Đơn chọn: mỗi người dùng chỉ được phân quyền tối đa 1 kho.
                return warehouse.isSelected ? { ...warehouse, isSelected: false } : warehouse;
            })
        );
    };

    const toggleWarehouseManager = (warehouseId) => {
        if (lockedAssignment) return;
        setWarehouses((prev) =>
            prev.map((warehouse) =>
                warehouse.id === warehouseId
                    ? {
                        ...warehouse,
                        isManager: !warehouse.isManager,
                    }
                    : warehouse
            )
        );
    };

    const handleAssignSubmit = async () => {
        const permissionIds = Object.keys(selectedPermissions || {})
            .filter((k) => selectedPermissions[k])
            .map((k) => Number(k));

        // Khoá: lấy thẳng từ bản ghi phân quyền — không phụ thuộc item danh sách đã tải hay chưa
        // (hỗ trợ phân trang danh sách kho).
        const target = lockedAssignment
            ? {
                id: lockedAssignment.kho?.id,
                isManager: Number(lockedAssignment.laQuanLyKho) === 1,
            }
            : warehouses.find((warehouse) => warehouse.isSelected);

        if (!permissionIds.length || !target?.id || !userId || hasMultipleActive) {
            return;
        }

        try {
            setAssigning(true);
            // Lấy mốc tgian hiện tại cho field ngayBatDau
            const nowIso = new Date().toISOString();
            // Chỉ gửi đúng 1 request cho 1 kho duy nhất
            const payload = {
                nguoiDungId: Number(userId),
                khoId: target.id,
                laQuanLyKho: target.isManager ? 1 : 0,
                ngayBatDau: nowIso,
                ngayKetThuc: ngayKetThuc ? parseDateTimeToIsoString(ngayKetThuc) : null,
                ghiChu: ghiChu,
                chiTietQuyenKhos: permissionIds.map((pid) => ({
                    quyenHanId: pid,
                    trangThai: 1,
                })),
            };

            await quyenHanService.ganQuyenQuyenHan({
                khoId: target.id,
                payload,
            });

            // Đóng modal trước khi reload để tránh chớp reset khi mở
            onClose();
            await onAssigned?.();
            toast.success("Phân quyền kho thành công");
        } catch (e) {
            console.error("Lỗi phân quyền kho cho người dùng", e);
            toast.error(
                e?.response?.data?.message || "Lỗi phân quyền kho cho người dùng"
            );
        } finally {
            setAssigning(false);
        }
    };

    const handleClose = () => {
        if (assigning) return;
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
            <DialogContent className="w-[95vw] max-w-3xl rounded-lg border border-bo-border bg-white text-bo-foreground shadow-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Warehouse className="h-5 w-5 text-bo-primary" />
                        Thêm phân quyền kho
                    </DialogTitle>
                    <DialogDescription className="text-bo-muted">
                        Bước 1: Chọn kho phụ trách (tối đa 1 kho đang hoạt động) • Bước 2: Chọn
                        quyền chức năng áp dụng cho kho đã chọn.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
                    {lockedAssignment && (
                        <div className="flex items-start gap-2 rounded-lg border border-bo-warning/30 bg-bo-warning-soft p-3">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-bo-warning" />
                            <p className="text-xs text-bo-warning">
                                Người dùng đang phụ trách kho{" "}
                                <span className="font-bold">
                                    {lockedAssignment.kho?.tenKho ?? `ID ${lockedAssignment.kho?.id}`}
                                </span>
                                . Bạn chỉ có thể cập nhật quyền cho kho này. Để chuyển sang kho
                                khác, hãy xóa phân quyền hiện tại rồi thêm mới.
                            </p>
                        </div>
                    )}

                    {hasMultipleActive && (
                        <div className="flex items-start gap-2 rounded-lg border border-bo-danger/30 bg-bo-danger-soft p-3">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-bo-danger" />
                            <p className="text-xs text-bo-danger">
                                Người dùng đang có nhiều hơn 1 phân quyền kho đang hoạt động.
                                Hãy xóa bớt còn tối đa 1 kho trên trang quản lý trước khi tiếp tục.
                            </p>
                        </div>
                    )}

                    {/* Step 1: Chọn kho */}
                    <section>
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wide text-bo-foreground">
                                1. Chọn kho phụ trách
                            </p>
                            <span className="text-[10px] text-bo-muted">
                              
                            </span>
                        </div>

                        {loading && warehouses.length === 0 ? (
                            <p className="text-xs text-bo-muted">Đang tải danh sách kho...</p>
                        ) : warehouses.length === 0 ? (
                            <p className="text-xs italic text-bo-muted">
                                Chưa có kho nào. Vui lòng tạo kho trước khi phân quyền.
                            </p>
                        ) : (
                            <div
                                className="max-h-64 space-y-3 overflow-y-auto pr-1"
                                onScroll={handleScrollWarehouses}
                            >
                                {warehouses.map((warehouse) => {
                                    const isLocked = !!lockedAssignment;
                                    const isSelected = isLocked
                                        ? warehouse.id === lockedAssignment.kho?.id
                                        : warehouse.isSelected;
                                    // Đơn chọn: khi đã chọn 1 kho, khoá checkbox các kho còn lại;
                                    // kho đang chọn vẫn click được để bỏ chọn và đổi kho khác.
                                    const rowDisabled = isLocked || (!isSelected && selectedWarehouseCount === 1);
                                    const isManager = isLocked
                                        ? Number(lockedAssignment.laQuanLyKho) === 1
                                        : warehouse.isManager;

                                    return (
                                    <div
                                        key={warehouse.id}
                                        title={isLocked && !isSelected ? "Xóa phân quyền kho hiện tại trước khi đổi kho" : undefined}
                                        className={`flex items-center justify-between rounded-lg border p-4
                        ${isSelected
                                                ? "border-bo-primary/30 bg-bo-primary-soft/40"
                                                : "border-bo-border bg-white"
                                            } ${rowDisabled && !isSelected ? "opacity-60" : ""}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleWarehouseSelected(warehouse.id)}
                                                disabled={rowDisabled}
                                                className="size-5 rounded border-bo-border accent-bo-primary disabled:cursor-not-allowed"
                                            />

                                            <div>
                                                <p className="text-sm font-bold text-bo-foreground">
                                                    {warehouse.tenKho}
                                                </p>
                                                <p className="text-xs uppercase text-bo-muted">
                                                    {warehouse.maKho} • ID: {warehouse.id}
                                                </p>
                                                <p className="mt-1 line-clamp-1 text-[11px] text-bo-muted">
                                                    {warehouse.diaChi}
                                                </p>
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <button
                                                type="button"
                                                onClick={() => toggleWarehouseManager(warehouse.id)}
                                                disabled={isLocked}
                                                className={`rounded border px-3 py-1.5 text-[10px] font-bold shadow-sm disabled:cursor-not-allowed disabled:opacity-60
                            ${isManager
                                                        ? "border-bo-primary bg-bo-primary text-white"
                                                        : "border-bo-border bg-white text-bo-muted"
                                                    }`}
                                            >
                                                QUẢN LÝ CHÍNH
                                            </button>
                                        )}
                                    </div>
                                    );
                                })}

                                {loadingMore && (
                                    <p className="py-1 text-center text-[11px] text-bo-muted">
                                        Đang tải thêm kho...
                                    </p>
                                )}
                                {!hasMore && warehouses.length > 0 && (
                                    <p className="py-1 text-center text-[11px] text-bo-muted">
                                        Đã hiển thị tất cả kho.
                                    </p>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Step 2: Chọn quyền */}
                    <section>
                        <div className="mb-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-bo-foreground">
                                2. Chọn quyền chức năng
                            </p>
                            <p className="mt-1 text-[11px] text-bo-muted">
                                Các quyền sẽ được áp dụng cho toàn bộ kho được chọn ở bước 1.
                            </p>
                        </div>

                        <div
                            className={
                                selectedWarehouseCount === 0
                                    ? "pointer-events-none opacity-50"
                                    : ""
                            }
                        >
                            <PermissionMatrix
                                selectedPermissions={selectedPermissions}
                                setSelectedPermissions={setSelectedPermissions}
                            />
                        </div>
                        {selectedWarehouseCount === 0 && (
                            <p className="mt-2 text-[11px] text-bo-danger">
                                Vui lòng chọn ít nhất 1 kho ở bước 1 trước khi cấu hình quyền.
                            </p>
                        )}
                    </section>

                    <section>
                        <div className="mb-3 flex flex-col gap-2">
                            <p className="text-xs font-bold uppercase tracking-wide text-bo-foreground">3. Cấu hình bổ sung</p>
                            <div>
                                <p className="text-[11px] text-bo-muted">
                                    Ghi chú
                                </p>
                                <textarea
                                    className="w-full rounded-md border border-bo-border p-2 text-sm text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15"
                                    placeholder="Nhập ghi chú"
                                    value={ghiChu}
                                    onChange={(e) => setGhiChu(e.target.value)}
                                />
                            </div>
                            <div>
                                <p className="text-[11px] text-bo-muted">
                                    Ngày kết thúc
                                </p>
                                <input
                                    type="datetime-local"
                                    className="w-full rounded-md border border-bo-border p-2 text-sm text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15"
                                    value={ngayKetThuc}
                                    onChange={(e) => setNgayKetThuc(e.target.value)}
                                />
                            </div>
                        </div>
                    </section>
                </div>

                <DialogFooter className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={assigning}
                        className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                    >
                        Hủy
                    </Button>
                    <Button
                        type="button"
                        onClick={handleAssignSubmit}
                        disabled={assigning || !canSubmitAssign}
                        className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                    >
                        {assigning ? "Đang lưu..." : "Lưu phân quyền"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
