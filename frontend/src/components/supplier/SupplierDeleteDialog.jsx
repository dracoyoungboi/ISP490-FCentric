import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, ShieldAlert, Trash2 } from "lucide-react";

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { checkSupplierDelete, deleteSupplier, updateSupplierStatus } from "@/services/supplierService";
import { getApiErrorMessage } from "@/utils/apiError";
import { TRANG_THAI_NCC, laHoatDong } from "./quyTacNhaCungCap";

/** "3 đơn mua hàng, 1 phiếu nhập kho" — chỉ kể loại chứng từ có phát sinh. */
function moTaGiaoDich(kiemTra) {
    const phan = [];
    if (kiemTra?.soDonMuaHang > 0) phan.push(`${kiemTra.soDonMuaHang} đơn mua hàng`);
    if (kiemTra?.soPhieuNhapKho > 0) phan.push(`${kiemTra.soPhieuNhapKho} phiếu nhập kho`);
    if (kiemTra?.soLoHang > 0) phan.push(`${kiemTra.soLoHang} lô hàng`);
    return phan.join(", ");
}

/**
 * Xóa nhà cung cấp: hỏi máy chủ trước rồi mới hiện nội dung phù hợp.
 * - Chưa phát sinh giao dịch (tạo nhầm): xác nhận xóa hẳn.
 * - Đã có giao dịch: không xóa được, đề nghị Ngừng hoạt động (giữ lịch sử, không gửi yêu cầu báo giá mới).
 * - onChecked(kiemTra): báo kết quả kiểm tra mới nhất cho trang cha (tùy chọn).
 */
export default function SupplierDeleteDialog({ supplier, open, onOpenChange, onDeleted, onStatusChanged, onChecked }) {
    const [session, setSession] = useState(0);
    const [prevOpen, setPrevOpen] = useState(open);
    if (open !== prevOpen) {
        setPrevOpen(open);
        if (open) setSession((value) => value + 1);
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            {supplier ? (
                <DeleteContent
                    key={session}
                    supplier={supplier}
                    onClose={() => onOpenChange(false)}
                    onDeleted={onDeleted}
                    onStatusChanged={onStatusChanged}
                    onChecked={onChecked}
                />
            ) : null}
        </AlertDialog>
    );
}

function DeleteContent({ supplier, onClose, onDeleted, onStatusChanged, onChecked }) {
    // { loading } | { kiemTra } | { loadError }
    const [check, setCheck] = useState({ loading: true });
    const [working, setWorking] = useState(false);
    const [actionError, setActionError] = useState("");
    // Giữ trong ref: trang cha truyền hàm mới mỗi lần vẽ thì runCheck không đổi theo (tránh kiểm tra lặp)
    const onCheckedRef = useRef(onChecked);
    useEffect(() => {
        onCheckedRef.current = onChecked;
    });

    const runCheck = useCallback(async () => {
        setCheck({ loading: true });
        try {
            const kiemTra = await checkSupplierDelete(supplier.id);
            setCheck({ kiemTra });
            onCheckedRef.current?.(kiemTra);
        } catch (error) {
            setCheck({ loadError: getApiErrorMessage(error, "Không kiểm tra được giao dịch của nhà cung cấp") });
        }
    }, [supplier.id]);

    // Hoãn qua microtask để tránh setState đồng bộ trong effect (react-hooks/set-state-in-effect).
    useEffect(() => {
        queueMicrotask(() => runCheck());
    }, [runCheck]);

    const handleDelete = async () => {
        setWorking(true);
        setActionError("");
        try {
            await deleteSupplier(supplier.id);
            onDeleted?.(supplier);
            onClose();
        } catch (error) {
            // Vừa phát sinh giao dịch giữa lúc kiểm tra và lúc bấm xóa: máy chủ trả kết quả kiểm tra mới.
            const kiemTra = error?.response?.data?.data;
            if (kiemTra && typeof kiemTra === "object" && kiemTra.coTheXoa === false) {
                setCheck({ kiemTra });
                onCheckedRef.current?.(kiemTra);
            } else {
                setActionError(getApiErrorMessage(error, "Xóa thất bại, vui lòng thử lại."));
            }
            setWorking(false);
        }
    };

    const handleDeactivate = async () => {
        setWorking(true);
        setActionError("");
        try {
            const updated = await updateSupplierStatus(supplier.id, TRANG_THAI_NCC.NGUNG_HOAT_DONG);
            onStatusChanged?.(updated ?? { ...supplier, trangThai: TRANG_THAI_NCC.NGUNG_HOAT_DONG });
            onClose();
        } catch (error) {
            setActionError(getApiErrorMessage(error, "Không thể ngừng hoạt động nhà cung cấp. Vui lòng thử lại."));
            setWorking(false);
        }
    };

    const ten = (
        <span className="font-semibold text-bo-foreground">
            {supplier.tenNhaCungCap}
            {supplier.maNhaCungCap ? <span className="font-mono font-normal text-bo-muted"> ({supplier.maNhaCungCap})</span> : null}
        </span>
    );

    const kiemTra = check.kiemTra;
    const khongXoaDuoc = kiemTra && !kiemTra.coTheXoa;
    const coTheNgung = khongXoaDuoc && laHoatDong(supplier);

    let title = "Xóa nhà cung cấp";
    let body;
    if (check.loading) {
        body = (
            <p className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Đang kiểm tra giao dịch của nhà cung cấp...
            </p>
        );
    } else if (check.loadError) {
        body = <p>{check.loadError}</p>;
    } else if (khongXoaDuoc) {
        title = "Không thể xóa nhà cung cấp";
        body = (
            <>
                <p>
                    {ten} đã có {moTaGiaoDich(kiemTra)}. Xóa sẽ làm mất lịch sử giao dịch nên hệ thống không cho xóa.
                </p>
                {coTheNgung ? (
                    <p>
                        Bạn có thể <span className="font-medium text-bo-foreground">Ngừng hoạt động</span> nhà cung cấp:
                        không gửi yêu cầu báo giá mới nữa, còn đơn đang xử lý và lịch sử vẫn giữ nguyên.
                    </p>
                ) : (
                    <p>Nhà cung cấp này đã ngừng hoạt động.</p>
                )}
            </>
        );
    } else {
        title = "Xóa nhà cung cấp?";
        body = (
            <p>
                {ten} chưa có giao dịch nào. Xóa xong sẽ không khôi phục được.
            </p>
        );
    }

    return (
        <AlertDialogContent
            className="border-bo-border bg-white sm:max-w-md"
            onEscapeKeyDown={(event) => {
                if (working) event.preventDefault();
            }}
        >
            <AlertDialogHeader className="text-left">
                <AlertDialogTitle className="flex items-center gap-2 text-base text-bo-foreground">
                    {khongXoaDuoc ? (
                        <ShieldAlert className="size-5 shrink-0 text-bo-warning" aria-hidden="true" />
                    ) : (
                        <Trash2 className="size-5 shrink-0 text-bo-danger" aria-hidden="true" />
                    )}
                    {title}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                    <div className="space-y-2 text-sm leading-6 text-bo-muted">{body}</div>
                </AlertDialogDescription>
            </AlertDialogHeader>

            {actionError ? (
                <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-bo-danger/20 bg-bo-danger-soft px-3 py-2.5 text-sm text-bo-danger"
                >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{actionError}</span>
                </div>
            ) : null}

            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel
                    disabled={working}
                    className="border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
                >
                    {khongXoaDuoc || check.loadError ? "Đóng" : "Hủy"}
                </AlertDialogCancel>
                {check.loadError ? (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={runCheck}
                        className="border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
                    >
                        Thử lại
                    </Button>
                ) : null}
                {coTheNgung ? (
                    <Button
                        type="button"
                        onClick={handleDeactivate}
                        disabled={working}
                        className="min-w-[150px] bg-bo-warning text-white hover:bg-bo-warning/90"
                    >
                        {working ? <Loader2 className="size-4 animate-spin" /> : null}
                        Ngừng hoạt động
                    </Button>
                ) : null}
                {kiemTra?.coTheXoa ? (
                    <Button
                        type="button"
                        onClick={handleDelete}
                        disabled={working}
                        className="min-w-[100px] bg-bo-danger text-white hover:bg-bo-danger/90"
                    >
                        {working ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                        Xóa
                    </Button>
                ) : null}
            </AlertDialogFooter>
        </AlertDialogContent>
    );
}
