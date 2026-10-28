import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChamMau } from "./ChonMauSac";
import { kiemTraDoiThuocTinh } from "./logicSuaBienThe";
import { NUT_VIEN_CLASS, SELECT_CONTENT_CLASS, SELECT_ITEM_CLASS, SELECT_TRIGGER_CLASS } from "./kieuForm";

/**
 * Đổi màu sắc / kích cỡ của một biến thể đã lưu nhưng chưa phát sinh giao dịch.
 * Kiểm tra ngay khi chọn (trùng biến thể khác, đổi chéo trong cùng lần lưu); mã SKU được tạo lại khi lưu.
 * Form cha đặt key mới mỗi lần mở để hộp luôn bắt đầu từ thuộc tính hiện tại của biến thể.
 */
export default function DoiThuocTinhBienThe({ open, state, id, mauSacs, kichCos, onOpenChange, onDoi }) {
    const bienThe = state.bienTheCu[id];
    const [mauSacId, setMauSacId] = useState(bienThe?.mauSacId ?? null);
    const [sizeId, setSizeId] = useState(bienThe?.sizeId ?? null);

    if (!bienThe) return null;
    const daDoi = mauSacId !== bienThe.mauSacId || sizeId !== bienThe.sizeId;
    const loi = daDoi ? kiemTraDoiThuocTinh(state, id, mauSacId, sizeId) : null;

    // Đổi xong, dòng có thể chuyển sang nhóm màu khác: trả focus về đúng nút "Đổi" của biến thể này.
    const traFocus = (e) => {
        e.preventDefault();
        document.querySelector(`[data-doi-bien-the="${id}"]`)?.focus();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent onCloseAutoFocus={traFocus} className="border-bo-border bg-bo-surface text-bo-foreground sm:max-w-md">
                <DialogHeader className="text-left">
                    <DialogTitle className="text-base text-bo-foreground">Đổi màu sắc, kích cỡ</DialogTitle>
                    <DialogDescription className="text-sm text-bo-muted">
                        Biến thể <span className="font-mono text-bo-foreground">{bienThe.maSku}</span> chưa phát sinh giao dịch.
                        Mã SKU sẽ được tạo lại theo màu sắc và kích cỡ mới khi lưu.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="doi-mau-sac">Màu sắc</Label>
                        <Select value={mauSacId == null ? "" : String(mauSacId)} onValueChange={(v) => v !== "" && setMauSacId(Number(v))}>
                            <SelectTrigger id="doi-mau-sac" aria-invalid={loi ? true : undefined} className={SELECT_TRIGGER_CLASS}>
                                <SelectValue placeholder="Chọn màu sắc" />
                            </SelectTrigger>
                            <SelectContent position="popper" className={`${SELECT_CONTENT_CLASS} max-h-[260px]`}>
                                {mauSacs.map((mau) => (
                                    <SelectItem key={mau.id} value={String(mau.id)} className={SELECT_ITEM_CLASS}>
                                        <ChamMau hex={mau.maMauHex} />
                                        {mau.tenMau}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="doi-kich-co">Kích cỡ</Label>
                        <Select value={sizeId == null ? "" : String(sizeId)} onValueChange={(v) => v !== "" && setSizeId(Number(v))}>
                            <SelectTrigger id="doi-kich-co" aria-invalid={loi ? true : undefined} className={SELECT_TRIGGER_CLASS}>
                                <SelectValue placeholder="Chọn kích cỡ" />
                            </SelectTrigger>
                            <SelectContent position="popper" className={`${SELECT_CONTENT_CLASS} max-h-[260px]`}>
                                {kichCos.map((size) => (
                                    <SelectItem key={size.id} value={String(size.id)} className={SELECT_ITEM_CLASS}>
                                        {size.tenSize || size.maSize}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <p role="status" className={loi ? "text-sm text-bo-danger" : "text-sm text-bo-muted"}>
                    {loi ?? (daDoi ? "Bấm Đổi để áp dụng, thay đổi chỉ được lưu khi bấm Lưu thay đổi." : "Chọn màu sắc hoặc kích cỡ mới.")}
                </p>

                <DialogFooter className="gap-2">
                    <Button type="button" variant="outline" className={NUT_VIEN_CLASS} onClick={() => onOpenChange(false)}>
                        Hủy
                    </Button>
                    <Button
                        type="button"
                        disabled={!daDoi || Boolean(loi)}
                        className="bg-bo-primary text-white hover:bg-bo-primary-hover focus-visible:ring-[3px] focus-visible:ring-bo-primary/30"
                        onClick={() => onDoi(id, mauSacId, sizeId)}
                    >
                        Đổi
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
