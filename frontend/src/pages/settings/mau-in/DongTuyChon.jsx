import { useEffect, useId, useRef, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/shared/StatusBadge";
import { LABEL_MAX_LENGTH } from "@/components/print/schemas/printSchemas";
import { cn } from "@/lib/utils";

const ICON_BUTTON =
    "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary disabled:pointer-events-none disabled:opacity-50";

/**
 * Một dòng tùy chọn của trình sửa mẫu in: ô chọn bật/tắt + nhãn in trên giấy (+ "gốc: …" khi đã
 * đổi tên) + gợi ý; mục đổi tên được có nút bút chì để sửa nhãn ngay tại dòng.
 * - Nhãn cập nhật vào bản đang sửa ngay khi gõ (tờ giấy và nút Lưu theo kịp — bấm Lưu khi còn đang
 *   gõ vẫn lưu đúng chữ đang gõ). Enter / "Xong" / rời ô nhập = xong; Esc = trả về nhãn lúc bắt đầu
 *   sửa; để trống = nhãn gốc.
 * - Dòng bắt buộc (cột tên hàng, số lượng…) không tắt được nhưng vẫn đổi tên được.
 * - Dòng phụ thuộc mục đang tắt (`row.inactive`: cột của bảng đang tắt…) khóa ô chọn, hiện gợi ý
 *   cần bật mục nào; vẫn đổi tên được để chuẩn bị trước.
 */
export default function DongTuyChon({ row, onToggle, onRename, disabled = false }) {
    const checkboxId = useId();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState("");
    // Đã kết thúc lần sửa này (Xong / Esc / Trả về tên gốc) — sự kiện rời ô đến sau không đổi gì nữa
    const doneRef = useRef(false);
    // Nhãn lúc bắt đầu sửa — Esc trả về nhãn này
    const startLabelRef = useRef("");
    // Xong bằng Enter / Esc / nút (không phải rời ô): đưa focus về nút bút chì, không rơi về đầu trang
    const pencilRef = useRef(null);
    const refocusRef = useRef(false);
    const canRename = Boolean(row.labelKey && onRename);

    useEffect(() => {
        if (editing || !refocusRef.current) return;
        refocusRef.current = false;
        pencilRef.current?.focus();
    }, [editing]);

    const startEdit = () => {
        doneRef.current = false;
        startLabelRef.current = row.label;
        setValue(row.label);
        setEditing(true);
    };
    const change = (text) => {
        setValue(text);
        onRename(text);
    };
    const finish = (label, { keepFocus = true } = {}) => {
        if (doneRef.current) return;
        doneRef.current = true;
        if (label !== null) onRename(label);
        refocusRef.current = keepFocus;
        setEditing(false);
    };
    // Nhãn đã cập nhật theo từng lần gõ — xong thì chỉ thoát chế độ sửa
    const commit = () => finish(null);
    const cancel = () => finish(startLabelRef.current);

    return (
        <div className="flex min-h-[38px] items-start gap-2.5 py-1">
            <Checkbox
                id={checkboxId}
                checked={row.on}
                disabled={row.locked || row.inactive || disabled}
                onCheckedChange={(checked) => onToggle(checked === true)}
                aria-label={
                    row.locked ? `${row.label} (bắt buộc)` : row.inactive && row.hint ? `${row.label} (${row.hint})` : row.label
                }
                className="mt-[9px] size-[18px] rounded-[4px] border-[#94a3b8] data-[state=checked]:border-bo-primary data-[state=checked]:bg-bo-primary disabled:opacity-100 data-[state=checked]:disabled:border-[#94a3b8] data-[state=checked]:disabled:bg-[#94a3b8]"
            />
            {editing ? (
                <div
                    className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5"
                    onBlur={(event) => {
                        // Rời khỏi ô sửa nhãn (không phải sang nút Xong / Trả về tên gốc) thì xong —
                        // kể cả khi bấm sang ô chọn của chính dòng này
                        if (!event.currentTarget.contains(event.relatedTarget)) finish(null, { keepFocus: false });
                    }}
                >
                    <Input
                        autoFocus
                        value={value}
                        maxLength={LABEL_MAX_LENGTH}
                        disabled={disabled}
                        onChange={(event) => change(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                commit();
                            } else if (event.key === "Escape") {
                                event.preventDefault();
                                event.stopPropagation();
                                cancel();
                            }
                        }}
                        aria-label={`Nhãn in trên giấy thay cho “${row.defaultLabel}”`}
                        placeholder={row.defaultLabel}
                        className="h-8 min-w-0 flex-1 border-[#8a96a6] bg-white px-2 text-sm shadow-none focus-visible:border-bo-primary focus-visible:ring-[3px] focus-visible:ring-bo-primary/15"
                    />
                    <button
                        type="button"
                        // Giữ con trỏ trong ô nhập khi bấm (Safari không chuyển focus sang nút) để lần bấm
                        // không bị sự kiện rời ô "lưu trước" chặn mất
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={commit}
                        className="inline-flex h-8 shrink-0 items-center rounded-md bg-bo-primary px-2.5 text-[13px] font-medium text-white hover:bg-bo-primary-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary"
                    >
                        Xong
                    </button>
                    <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => finish("")}
                        aria-label="Trả về tên gốc"
                        title="Trả về tên gốc"
                        className={ICON_BUTTON}
                    >
                        <RotateCcw className="size-4" aria-hidden="true" />
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex min-w-0 flex-1 flex-col py-[7px]">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                            <label
                                htmlFor={checkboxId}
                                className={cn(
                                    "min-w-0 text-sm leading-5 break-words",
                                    row.locked || row.inactive ? "cursor-default" : "cursor-pointer",
                                    row.on && !row.inactive ? "text-bo-foreground" : "text-bo-muted"
                                )}
                            >
                                {row.label}
                            </label>
                            {row.renamed ? (
                                <span className="text-xs leading-4 text-bo-muted">gốc: {row.defaultLabel}</span>
                            ) : null}
                            {row.locked ? <StatusBadge label="Bắt buộc" nhom="dong" /> : null}
                        </div>
                        {row.hint ? <p className="mt-0.5 text-xs leading-4 text-bo-muted">{row.hint}</p> : null}
                    </div>
                    {canRename ? (
                        <button
                            ref={pencilRef}
                            type="button"
                            onClick={startEdit}
                            disabled={disabled}
                            aria-label={`Đổi tên “${row.label}”`}
                            title="Đổi tên"
                            className={cn(ICON_BUTTON, "mt-[3px]")}
                        >
                            <Pencil className="size-[15px]" aria-hidden="true" />
                        </button>
                    ) : null}
                </>
            )}
        </div>
    );
}
