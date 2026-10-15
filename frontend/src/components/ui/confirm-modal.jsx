import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";

const VARIANT_CONFIG = {
    danger: {
        icon: AlertTriangle,
        iconColor: "text-red-500",
        confirmButtonClass: "bg-red-600 hover:bg-red-700 text-white",
        title: "Xác nhận xóa"
    },
    warning: {
        icon: AlertTriangle,
        iconColor: "text-yellow-500",
        confirmButtonClass: "bg-yellow-600 hover:bg-yellow-700 text-white",
        title: "Cảnh báo"
    },
    info: {
        icon: Info,
        iconColor: "text-blue-500",
        confirmButtonClass: "bg-blue-600 hover:bg-blue-700 text-white",
        title: "Thông tin"
    },
    success: {
        icon: CheckCircle2,
        iconColor: "text-green-500",
        confirmButtonClass: "bg-green-600 hover:bg-green-700 text-white",
        title: "Xác nhận"
    },
    gold: {
        icon: AlertTriangle,
        iconColor: "!text-amber-700 dark:!text-amber-700",
        iconBgClass: "!bg-amber-100 dark:!bg-amber-100",
        dialogClass: "!bg-[#fffdf8] !text-[#3d3529] dark:!bg-[#fffdf8] dark:!text-[#3d3529] !border-[#e6dcc9]",
        titleClass: "!text-[#3d3529] dark:!text-[#3d3529]",
        descriptionClass: "!text-[#7a6e5f] dark:!text-[#7a6e5f]",
        cancelButtonClass: "!border-[#d7cab2] !text-[#6b5f4c] !bg-[#fffdf8] hover:!bg-[#f8f2e4] dark:!border-[#d7cab2] dark:!text-[#6b5f4c] dark:!bg-[#fffdf8] dark:hover:!bg-[#f8f2e4]",
        confirmButtonClass: "!bg-[#b8860b] hover:!bg-[#9c7108] !text-white dark:!bg-[#b8860b] dark:hover:!bg-[#9c7108] dark:!text-white",
        title: "Xác nhận"
    }
};


export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Xác nhận",
    cancelText = "Hủy",
    variant = "danger",
    isLoading = false,
}) {
    const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.danger;
    const mergedConfig = {
        iconBgClass: "bg-gray-50",
        dialogClass: "bg-white border border-gray-200",
        titleClass: "text-gray-900",
        descriptionClass: "text-gray-600",
        cancelButtonClass: "border-gray-300 text-gray-700 hover:bg-gray-50",
        ...config,
    };
    const Icon = mergedConfig.icon;

    const handleConfirm = async () => {
        await onConfirm?.();
    };

    return (
        // Đang xử lý thì không cho đóng (Esc, bấm ra ngoài, nút X) để thao tác không bị bỏ dở giữa chừng
        <Dialog open={isOpen} onOpenChange={(mo) => { if (!mo && isLoading) return; onClose?.(mo); }}>
            <DialogContent className={`sm:max-w-[425px] rounded-xl shadow-lg ${mergedConfig.dialogClass}`}>
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${mergedConfig.iconBgClass}`}>
                            <Icon className={`h-6 w-6 ${mergedConfig.iconColor}`} />
                        </div>
                        <DialogTitle className={`text-lg font-semibold ${mergedConfig.titleClass}`}>
                            {title || mergedConfig.title}
                        </DialogTitle>
                    </div>
                    <DialogDescription className={`text-sm pt-2 ${mergedConfig.descriptionClass}`}>
                        {description}
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="gap-2 sm:gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                        className={mergedConfig.cancelButtonClass}
                    >
                        {cancelText}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className={mergedConfig.confirmButtonClass}
                    >
                        {isLoading ? (
                            <>
                                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Đang xử lý...
                            </>
                        ) : (
                            confirmText
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
