import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NUT_VIEN_CLASS } from "./kieuForm";

/** Hộp hỏi trước khi bỏ dữ liệu đang nhập; cùng mẫu với hộp "Bỏ thông tin đang nhập?" của popup Thêm người dùng. */
export default function HopHoiBoThayDoi({ open, onOpenChange, onBo, onCloseAutoFocus, tieuDe, moTa }) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="border-bo-border bg-bo-surface sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-base text-bo-foreground">{tieuDe}</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm text-bo-muted">{moTa}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className={NUT_VIEN_CLASS}>Tiếp tục nhập</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onBo}
                        className="bg-bo-danger text-white hover:bg-bo-danger/90 focus-visible:ring-[3px] focus-visible:ring-bo-danger/20"
                    >
                        Bỏ thay đổi
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
