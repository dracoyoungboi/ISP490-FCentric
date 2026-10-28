import { History, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { OUTLINE_BUTTON } from "@/components/settings/settingsStyles";

/**
 * Ngăn kéo "Lịch sử chỉnh sửa" của trình sửa mẫu in: mỗi lần lưu là một phiên bản (giờ lưu,
 * người lưu, đã đổi gì). "Khôi phục" đưa phiên bản cũ vào BẢN ĐANG SỬA — chỉ áp dụng khi bấm Lưu,
 * nên khôi phục nhầm vẫn bấm Hủy được.
 *
 * `history`: { status: "loading" | "error" | "ready", entries, errorStatus }
 * `restoreDisabled`: đang lưu — tạm khóa nút Khôi phục để lần lưu không ghi đè bản vừa khôi phục.
 * entry: { id, when, who, summary, isCurrent, restorable }
 */
export default function NganKeoLichSu({
    open,
    onOpenChange,
    history,
    onRetry,
    onRestore,
    restoreDisabled = false,
    docNoun = "phiếu",
}) {
    const entries = history?.entries ?? [];
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full gap-0 bg-bo-surface p-0 sm:max-w-[420px] [&>button:last-child]:hidden"
            >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-bo-border px-5 py-4">
                    <div className="min-w-0">
                        <SheetTitle className="text-base leading-6 font-semibold text-bo-foreground">
                            Lịch sử chỉnh sửa
                        </SheetTitle>
                        <SheetDescription className="mt-0.5 text-[13px] leading-5 text-bo-muted">
                            Mỗi lần lưu là một phiên bản. Khôi phục sẽ đưa phiên bản cũ vào bản đang sửa — bấm Lưu để
                            áp dụng cho {docNoun} in ra.
                        </SheetDescription>
                    </div>
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        aria-label="Đóng lịch sử chỉnh sửa"
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary"
                    >
                        <X className="size-4" aria-hidden="true" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5">
                    {history?.status === "loading" ? (
                        <LoadingState className="min-h-48" label="Đang tải lịch sử chỉnh sửa" />
                    ) : history?.status === "error" ? (
                        <ErrorState
                            className="min-h-48"
                            title="Không tải được lịch sử chỉnh sửa"
                            description={
                                history.errorStatus === 403
                                    ? "Tài khoản của bạn không có quyền xem lịch sử mẫu in."
                                    : "Không đọc được lịch sử từ máy chủ. Vui lòng thử lại."
                            }
                            onRetry={history.errorStatus === 403 ? undefined : onRetry}
                        />
                    ) : entries.length === 0 ? (
                        <EmptyState
                            className="min-h-48"
                            icon={History}
                            title="Chưa có phiên bản nào"
                            description="Mỗi lần bấm Lưu, mẫu in được ghi lại ở đây kèm người lưu và những gì đã đổi."
                        />
                    ) : (
                        <ol aria-label="Các phiên bản đã lưu, mới nhất trước">
                            {entries.map((entry) => (
                                <li
                                    key={entry.id}
                                    className="flex items-start justify-between gap-3 border-b border-[#eef1f5] py-3.5 last:border-b-0"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm leading-5 font-semibold text-bo-foreground">{entry.when}</p>
                                        {entry.who ? (
                                            <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">{entry.who}</p>
                                        ) : null}
                                        <p className="mt-1.5 text-sm leading-5 break-words text-bo-foreground">{entry.summary}</p>
                                    </div>
                                    {entry.isCurrent ? (
                                        <StatusBadge label="Đang dùng" nhom="xong" className="mt-0.5" />
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className={`h-8 shrink-0 ${OUTLINE_BUTTON}`}
                                            disabled={!entry.restorable || restoreDisabled}
                                            title={entry.restorable ? undefined : "Mẫu của phiên bản này không còn dùng được"}
                                            onClick={() => onRestore(entry)}
                                        >
                                            Khôi phục
                                        </Button>
                                    )}
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
