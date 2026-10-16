import { useState } from "react";
import { AlertCircle, CircleCheck, CirclePause, Loader2 } from "lucide-react";

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
import { updateSupplierStatus } from "@/services/supplierService";
import { getApiErrorMessage } from "@/utils/apiError";
import { TRANG_THAI_NCC, laHoatDong } from "./quyTacNhaCungCap";

/**
 * Câu về việc đang dở trong hộp Ngừng hoạt động (bản chốt 17/10/2026).
 * `viecDangDo = { donChoGiao, baoGiaChoDuyet }` khi trang biết số việc (Chi tiết nhà cung cấp);
 * không truyền thì nói chung. Biết số mà không có việc nào thì bỏ câu này.
 */
function CauViecDangDo({ viecDangDo }) {
    const so = (n) => <span className="font-semibold text-bo-foreground">{n}</span>;
    if (!viecDangDo) {
        return <li>Đơn mua và báo giá đang xử lý vẫn tiếp tục bình thường: nhận hàng, nhập kho, duyệt báo giá.</li>;
    }
    const don = Number(viecDangDo.donChoGiao) || 0;
    const baoGia = Number(viecDangDo.baoGiaChoDuyet) || 0;
    if (don > 0 && baoGia > 0) {
        return (
            <li>
                Đang có {so(`${don} đơn chờ giao`)} và {so(`${baoGia} báo giá chờ duyệt`)}: vẫn xử lý bình thường (nhận hàng, nhập kho, duyệt báo giá).
            </li>
        );
    }
    if (don > 0) return <li>Đang có {so(`${don} đơn chờ giao`)}: vẫn xử lý bình thường (nhận hàng, nhập kho).</li>;
    if (baoGia > 0) return <li>Đang có {so(`${baoGia} báo giá chờ duyệt`)}: vẫn duyệt được bình thường.</li>;
    return null;
}

/**
 * Xác nhận Ngừng hoạt động / Cho phép hoạt động lại một nhà cung cấp — nói rõ hệ quả trước khi đổi.
 * `onChanged(supplier)` nhận nhà cung cấp sau khi đổi (máy chủ trả về).
 * `viecDangDo` (tuỳ chọn): số đơn chờ giao và báo giá chờ duyệt, để kể đúng số việc đang dở.
 */
export default function SupplierStatusDialog({ supplier, open, onOpenChange, onChanged, viecDangDo }) {
    const [session, setSession] = useState(0);
    const [prevOpen, setPrevOpen] = useState(open);
    if (open !== prevOpen) {
        setPrevOpen(open);
        if (open) setSession((value) => value + 1);
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            {supplier ? (
                <StatusContent
                    key={session}
                    supplier={supplier}
                    onClose={() => onOpenChange(false)}
                    onChanged={onChanged}
                    viecDangDo={viecDangDo}
                />
            ) : null}
        </AlertDialog>
    );
}

function StatusContent({ supplier: supplierLucMo, onClose, onChanged, viecDangDo }) {
    // Giữ nguyên nội dung lúc mở: đổi xong trang cha cập nhật trạng thái ngay, nhưng hộp thoại
    // đang chạy hiệu ứng đóng không được lật sang câu ngược lại.
    const [supplier] = useState(supplierLucMo);
    const dangHoatDong = laHoatDong(supplier);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const confirm = async () => {
        setSaving(true);
        setError("");
        try {
            const updated = await updateSupplierStatus(
                supplier.id,
                dangHoatDong ? TRANG_THAI_NCC.NGUNG_HOAT_DONG : TRANG_THAI_NCC.HOAT_DONG,
            );
            onChanged?.(updated ?? {
                ...supplier,
                trangThai: dangHoatDong ? TRANG_THAI_NCC.NGUNG_HOAT_DONG : TRANG_THAI_NCC.HOAT_DONG,
            });
            onClose();
        } catch (err) {
            setError(getApiErrorMessage(err, "Không thể đổi trạng thái nhà cung cấp. Vui lòng thử lại."));
            setSaving(false);
        }
    };

    const ten = (
        <span className="font-semibold text-bo-foreground">
            {supplier.tenNhaCungCap}
            {supplier.maNhaCungCap ? <span className="font-mono font-normal text-bo-muted"> ({supplier.maNhaCungCap})</span> : null}
        </span>
    );

    return (
        <AlertDialogContent
            className="border-bo-border bg-white sm:max-w-md"
            onEscapeKeyDown={(event) => {
                if (saving) event.preventDefault();
            }}
        >
            <AlertDialogHeader className="text-left">
                <AlertDialogTitle className="flex items-center gap-2 text-base text-bo-foreground">
                    {dangHoatDong ? (
                        <CirclePause className="size-5 shrink-0 text-bo-warning" aria-hidden="true" />
                    ) : (
                        <CircleCheck className="size-5 shrink-0 text-bo-success" aria-hidden="true" />
                    )}
                    {dangHoatDong ? "Ngừng hoạt động nhà cung cấp?" : "Cho phép nhà cung cấp hoạt động lại?"}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                    <div className="space-y-2 text-sm leading-6 text-bo-muted">
                        {dangHoatDong ? (
                            <>
                                <p>{ten} sẽ không được chọn khi gửi yêu cầu báo giá mới.</p>
                                <ul className="list-disc space-y-1 pl-5">
                                    <CauViecDangDo viecDangDo={viecDangDo} />
                                    <li>Thông tin và lịch sử giao dịch được giữ nguyên; có thể cho phép hoạt động lại bất cứ lúc nào.</li>
                                </ul>
                            </>
                        ) : (
                            <p>{ten} sẽ lại được chọn khi gửi yêu cầu báo giá.</p>
                        )}
                    </div>
                </AlertDialogDescription>
            </AlertDialogHeader>

            {error ? (
                <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-bo-danger/20 bg-bo-danger-soft px-3 py-2.5 text-sm text-bo-danger"
                >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{error}</span>
                </div>
            ) : null}

            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel
                    disabled={saving}
                    className="border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
                >
                    Hủy
                </AlertDialogCancel>
                <Button
                    type="button"
                    onClick={confirm}
                    disabled={saving}
                    className={
                        dangHoatDong
                            ? "min-w-[150px] bg-bo-warning text-white hover:bg-bo-warning/90"
                            : "min-w-[150px] bg-bo-success text-white hover:bg-bo-success/90"
                    }
                >
                    {saving ? (
                        <>
                            <Loader2 className="size-4 animate-spin" />
                            Đang lưu...
                        </>
                    ) : dangHoatDong ? (
                        "Ngừng hoạt động"
                    ) : (
                        "Cho phép hoạt động"
                    )}
                </Button>
            </AlertDialogFooter>
        </AlertDialogContent>
    );
}
