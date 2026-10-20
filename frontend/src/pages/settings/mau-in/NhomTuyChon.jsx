import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * Một nhóm tùy chọn (khớp một khối trên tờ giấy) ở cột phải của trình sửa mẫu in:
 * ô chọn ba trạng thái bật/tắt cả nhóm · tên nhóm · "đang bật/tổng" · mũi tên mở/đóng.
 * Rê chuột lên đầu nhóm thì khối tương ứng trên giấy được tô viền (onHover).
 */
export default function NhomTuyChon({
    ref,
    group,
    open,
    active,
    onOpenChange,
    onToggleAll,
    onHover,
    disabled = false,
    children,
}) {
    const contentId = useId();
    const hasRows = group.total > 0;
    const checkState = group.state === "all" ? true : group.state === "some" ? "indeterminate" : false;

    return (
        <div ref={ref} className="border-b border-[#eef1f5] last:border-b-0" data-nhom={group.key}>
            <div
                className={cn("flex items-center gap-2.5 pl-4 pr-3 transition-colors", active ? "bg-bo-primary-soft" : "bg-white")}
                // Sự kiện con trỏ (cùng loại với tờ giấy để thứ tự rời / vào luôn đúng), chuột hoặc bút; chạm
                // trên màn cảm ứng không giữ khối sáng mãi
                onPointerEnter={(event) => {
                    if (event.pointerType !== "touch") onHover?.(group.key);
                }}
                onPointerLeave={(event) => {
                    if (event.pointerType !== "touch") onHover?.(null);
                }}
            >
                {hasRows && group.canToggleAll ? (
                    <Checkbox
                        checked={checkState}
                        disabled={disabled}
                        onCheckedChange={() => onToggleAll(group.state !== "all")}
                        aria-label={group.state === "all" ? `Tắt cả nhóm ${group.title}` : `Bật cả nhóm ${group.title}`}
                        className="size-[18px] rounded-[4px] border-[#94a3b8] data-[state=checked]:border-bo-primary data-[state=checked]:bg-bo-primary data-[state=indeterminate]:border-bo-primary data-[state=indeterminate]:bg-bo-primary data-[state=indeterminate]:text-white"
                    />
                ) : (
                    <span className="w-[18px] shrink-0" aria-hidden="true" />
                )}
                <button
                    type="button"
                    onClick={() => onOpenChange(!open)}
                    aria-expanded={open}
                    aria-controls={contentId}
                    className="flex min-h-12 min-w-0 flex-1 items-center justify-between gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-bo-primary"
                >
                    <span className="min-w-0 truncate text-sm font-semibold text-bo-foreground">{group.title}</span>
                    <span className="inline-flex shrink-0 items-center gap-2 text-xs text-bo-muted">
                        {hasRows ? (
                            <span aria-label={`Đang in ${group.onCount} trên ${group.total} mục`}>
                                {group.onCount}/{group.total}
                            </span>
                        ) : null}
                        <ChevronDown
                            className={cn("size-4 transition-transform", open && "rotate-180")}
                            aria-hidden="true"
                        />
                    </span>
                </button>
            </div>
            <div id={contentId} role="region" aria-label={group.title} hidden={!open} className="pb-3.5 pl-4 pr-3">
                {open ? children : null}
            </div>
        </div>
    );
}
