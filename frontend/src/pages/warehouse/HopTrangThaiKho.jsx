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
import { khoService } from "@/services/khoService";
import { getApiErrorMessage } from "@/utils/apiError";
import { laKhoHoatDong } from "@/utils/kho";
import { cauNgungHoatDong } from "./chiTietKho";

/**
 * Xác nhận Ngừng hoạt động / Cho phép hoạt động lại một kho (thay cho nút "Xóa kho" cũ:
 * backend "xóa" kho thực chất chỉ đặt trạng thái 0). Cùng kiểu hộp Ngừng hoạt động nhà cung cấp.
 * `onChanged(kho)` nhận kho sau khi đổi (máy chủ trả về).
 */
export default function HopTrangThaiKho({ kho, open, onOpenChange, onChanged }) {
    const [lanMo, setLanMo] = useState(0);
    const [moTruoc, setMoTruoc] = useState(open);
    if (open !== moTruoc) {
        setMoTruoc(open);
        if (open) setLanMo((n) => n + 1);
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            {kho ? (
                <NoiDung key={lanMo} kho={kho} onClose={() => onOpenChange(false)} onChanged={onChanged} />
            ) : null}
        </AlertDialog>
    );
}

function NoiDung({ kho: khoLucMo, onClose, onChanged }) {
    // Giữ nội dung lúc mở: đổi xong trang cha cập nhật trạng thái ngay, hộp đang đóng không lật sang câu ngược lại
    const [kho] = useState(khoLucMo);
    const dangHoatDong = laKhoHoatDong(kho);
    const [dangLuu, setDangLuu] = useState(false);
    const [loi, setLoi] = useState("");

    const xacNhan = async () => {
        setDangLuu(true);
        setLoi("");
        const trangThaiMoi = dangHoatDong ? 0 : 1;
        try {
            const sauKhiDoi = await khoService.doiTrangThai(kho.id, trangThaiMoi);
            onChanged?.(sauKhiDoi ?? { ...kho, trangThai: trangThaiMoi });
            onClose();
        } catch (err) {
            setLoi(getApiErrorMessage(err, "Không thể đổi trạng thái kho. Vui lòng thử lại."));
            setDangLuu(false);
        }
    };

    const ten = (
        <span className="font-semibold text-bo-foreground">
            {kho.tenKho}
            {kho.maKho ? <span className="font-mono font-normal text-bo-muted"> ({kho.maKho})</span> : null}
        </span>
    );
    const dam = (chu) => <span className="font-semibold text-bo-foreground">{chu}</span>;

    return (
        <AlertDialogContent
            className="border-bo-border bg-white sm:max-w-md"
            onEscapeKeyDown={(event) => {
                if (dangLuu) event.preventDefault();
            }}
        >
            <AlertDialogHeader className="text-left">
                <AlertDialogTitle className="flex items-center gap-2 text-base text-bo-foreground">
                    {dangHoatDong ? (
                        <CirclePause className="size-5 shrink-0 text-bo-warning" aria-hidden="true" />
                    ) : (
                        <CircleCheck className="size-5 shrink-0 text-bo-success" aria-hidden="true" />
                    )}
                    {dangHoatDong ? "Ngừng hoạt động kho?" : "Cho phép kho hoạt động lại?"}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                    <div className="space-y-2 text-sm leading-6 text-bo-muted">
                        {dangHoatDong ? (
                            <>
                                <p>{ten} sẽ không chọn được khi tạo chứng từ mới: nhập kho, xuất kho, chuyển kho, bán tại quầy.</p>
                                <ul className="list-disc space-y-1 pl-5">
                                    {cauNgungHoatDong(kho).map((cau) => {
                                        if (cau.loai === "ton") {
                                            return (
                                                <li key="ton">
                                                    Kho đang còn {dam(`${cau.soLuong} sản phẩm`)} tồn: tồn kho giữ nguyên, nhưng không bán hay chuyển đi được cho tới khi kho hoạt động lại.
                                                </li>
                                            );
                                        }
                                        if (cau.loai === "kho-tong") {
                                            return <li key="kho-tong">Đây là Kho tổng: trong lúc ngừng, không nhập được hàng từ nhà cung cấp.</li>;
                                        }
                                        return <li key="giu">Lịch sử và chứng từ cũ được giữ nguyên; có thể cho phép hoạt động lại bất cứ lúc nào.</li>;
                                    })}
                                </ul>
                            </>
                        ) : (
                            <p>{ten} sẽ lại chọn được khi tạo chứng từ mới.</p>
                        )}
                    </div>
                </AlertDialogDescription>
            </AlertDialogHeader>

            {loi ? (
                <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-bo-danger/20 bg-bo-danger-soft px-3 py-2.5 text-sm text-bo-danger"
                >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{loi}</span>
                </div>
            ) : null}

            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel
                    disabled={dangLuu}
                    className="border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
                >
                    Hủy
                </AlertDialogCancel>
                <Button
                    type="button"
                    onClick={xacNhan}
                    disabled={dangLuu}
                    className={
                        dangHoatDong
                            ? "min-w-[150px] bg-bo-warning text-white hover:bg-bo-warning/90"
                            : "min-w-[150px] bg-bo-success text-white hover:bg-bo-success/90"
                    }
                >
                    {dangLuu ? (
                        <>
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
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
