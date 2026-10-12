import { useMemo, useState } from "react";
import { Check, ChevronDown, Lock, X } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { locMauSac } from "./logicBienThe";

export function ChamMau({ hex, className }) {
    return (
        <span
            className={cn("size-3.5 shrink-0 rounded-full border border-bo-border", className)}
            style={{ backgroundColor: hex || "transparent" }}
            aria-hidden="true"
        />
    );
}

const KHONG_KHOA = [];
const GOI_Y_KHOA = "Màu đang có biến thể nên không bỏ chọn được";

/**
 * Ô chọn nhiều màu sắc. Trong ô chỉ hiện các màu đã chọn dạng thẻ, theo thứ tự chọn (cũng là thứ tự nhóm
 * trong bảng biến thể). Bấm vào ô để mở danh sách: tìm không dấu, tick nhiều màu liền mạch, Enter để chọn,
 * Backspace khi ô tìm trống để bỏ màu chọn sau cùng, Esc để đóng.
 * `khoa`: màu đang có biến thể đã lưu (form Chỉnh sửa), luôn được chọn và không bỏ được.
 */
export default function ChonMauSac({ mauSacs, daChon, khoa = KHONG_KHOA, dangTai, coLoi, disabled, onBatTat, onThem }) {
    const [mo, setMo] = useState(false);
    const [tuKhoa, setTuKhoa] = useState("");

    const mauTheoId = useMemo(() => new Map(mauSacs.map((m) => [m.id, m])), [mauSacs]);
    const tapDaChon = useMemo(() => new Set(daChon), [daChon]);
    const tapKhoa = useMemo(() => new Set(khoa), [khoa]);
    const ketQua = useMemo(() => locMauSac(mauSacs, tuKhoa), [mauSacs, tuKhoa]);
    const dsDaChon = daChon.map((id) => mauTheoId.get(id)).filter(Boolean);
    const chuaChonTrongKetQua = ketQua.filter((m) => !tapDaChon.has(m.id));
    const dangTim = tuKhoa.trim() !== "";

    const doiMo = (giaTri) => {
        setMo(giaTri);
        if (!giaTri) setTuKhoa("");
    };

    const handleKeyDownTim = (e) => {
        if (e.key !== "Backspace" || tuKhoa !== "") return;
        const mauBoDuoc = [...daChon].reverse().find((id) => !tapKhoa.has(id));
        if (mauBoDuoc == null) return;
        e.preventDefault();
        onBatTat(mauBoDuoc);
    };

    if (dangTai && mauSacs.length === 0) {
        return <div className="h-9 w-full animate-pulse rounded-md bg-bo-border/60" aria-hidden="true" />;
    }

    return (
        <Popover open={mo} onOpenChange={doiMo}>
            <PopoverAnchor asChild>
                {/* Bấm vào chỗ trống trong ô cũng mở danh sách; nút x trên thẻ thì chỉ bỏ màu đó. */}
                <div
                    onClick={(e) => {
                        if (!disabled && !e.target.closest("button")) doiMo(true);
                    }}
                    className={cn(
                        "flex min-h-9 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-md border bg-white px-1.5 py-1 shadow-xs transition-[color,box-shadow]",
                        "has-[:focus-visible]:border-bo-primary has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-bo-primary/15",
                        mo ? "border-bo-primary ring-[3px] ring-bo-primary/15" : coLoi ? "border-bo-danger" : "border-bo-border",
                        disabled && "pointer-events-none opacity-60",
                    )}
                >
                    {dsDaChon.map((mau) => {
                        const daKhoa = tapKhoa.has(mau.id);
                        return (
                            <span
                                key={mau.id}
                                title={daKhoa ? GOI_Y_KHOA : undefined}
                                className={cn(
                                    "inline-flex h-[26px] items-center gap-1.5 rounded-md border border-bo-border bg-bo-surface-subtle pl-2 text-[13px] font-medium text-bo-foreground",
                                    daKhoa ? "pr-2" : "pr-0.5",
                                )}
                            >
                                <ChamMau hex={mau.maMauHex} className="size-3" />
                                {mau.tenMau}
                                {/* Không nằm trong thứ tự Tab: bàn phím bỏ màu bằng danh sách hoặc Backspace. */}
                                {!daKhoa && (
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        disabled={disabled}
                                        aria-label={`Bỏ màu ${mau.tenMau}`}
                                        onClick={() => onBatTat(mau.id)}
                                        className="flex size-5 items-center justify-center rounded text-bo-muted transition-colors hover:bg-bo-danger-soft hover:text-bo-danger"
                                    >
                                        <X className="size-3" aria-hidden="true" />
                                    </button>
                                )}
                            </span>
                        );
                    })}
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            data-o-chon-mau=""
                            disabled={disabled}
                            aria-label={
                                dsDaChon.length > 0
                                    ? `Màu sắc: đã chọn ${dsDaChon.length}. Bấm để thêm hoặc bỏ màu`
                                    : "Chọn màu sắc"
                            }
                            aria-invalid={coLoi || undefined}
                            className="flex h-[26px] min-w-[120px] flex-1 items-center justify-between gap-2 rounded px-1.5 text-left text-sm text-bo-muted outline-none"
                        >
                            <span>{dsDaChon.length > 0 ? "Thêm màu…" : "Chọn màu sắc…"}</span>
                            <ChevronDown className={cn("size-4 shrink-0 transition-transform", mo && "rotate-180")} aria-hidden="true" />
                        </button>
                    </PopoverTrigger>
                </div>
            </PopoverAnchor>

            <PopoverContent
                align="start"
                collisionPadding={16}
                className="w-[min(360px,var(--radix-popover-trigger-width))] overflow-hidden border-bo-border bg-white p-0"
            >
                {/* label: cmdk gắn nhãn này cho ô tìm (aria-labelledby), aria-label đặt trên ô sẽ bị bỏ qua. */}
                <Command
                    label="Tìm màu sắc"
                    shouldFilter={false}
                    loop
                    className="bg-white [&_[data-slot=command-input-wrapper]]:border-bo-border"
                >
                    <CommandInput
                        value={tuKhoa}
                        onValueChange={setTuKhoa}
                        onKeyDown={handleKeyDownTim}
                        placeholder="Tìm màu: xanh, xám…"
                        className="text-bo-foreground placeholder:text-bo-muted"
                    />
                    <CommandList className="max-h-[280px] py-1" aria-label="Danh sách màu sắc" aria-multiselectable="true">
                        <CommandEmpty className="px-3 py-6 text-center text-sm text-bo-muted">
                            {mauSacs.length === 0
                                ? "Chưa có màu sắc nào. Vui lòng thêm ở trang Thuộc tính."
                                : "Không có màu khớp từ khóa."}
                        </CommandEmpty>
                        {ketQua.map((mau) => {
                            const daTick = tapDaChon.has(mau.id);
                            const daKhoa = tapKhoa.has(mau.id);
                            return (
                                <CommandItem
                                    key={mau.id}
                                    value={String(mau.id)}
                                    disabled={daKhoa}
                                    // Bấm chuột vẫn giữ con trỏ ở ô tìm để gõ tìm tiếp hoặc Backspace ngay.
                                    onMouseDown={(e) => e.preventDefault()}
                                    onSelect={() => onBatTat(mau.id)}
                                    aria-checked={daTick}
                                    title={daKhoa ? GOI_Y_KHOA : undefined}
                                    className="mx-1 gap-2.5 px-2 py-1.5 text-bo-foreground data-[disabled=true]:opacity-100 data-[selected=true]:bg-bo-surface-subtle data-[selected=true]:text-bo-foreground"
                                >
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                                            daKhoa
                                                ? "border-bo-primary/50 bg-bo-primary/50"
                                                : daTick
                                                  ? "border-bo-primary bg-bo-primary"
                                                  : "border-bo-muted/40 bg-white",
                                        )}
                                    >
                                        {daTick && <Check className="size-3 text-white" />}
                                    </span>
                                    <ChamMau hex={mau.maMauHex} />
                                    <span className="min-w-0 flex-1 truncate">
                                        {mau.tenMau}
                                        {daKhoa && <span className="sr-only"> (đang có biến thể)</span>}
                                    </span>
                                    {daKhoa && <Lock className="size-3.5 text-bo-muted" aria-hidden="true" />}
                                    <span className="shrink-0 font-mono text-xs text-bo-muted">{mau.maMau}</span>
                                </CommandItem>
                            );
                        })}
                    </CommandList>
                </Command>
                {mauSacs.length > 0 && (
                    <div className="flex items-center justify-between gap-3 border-t border-bo-border px-3 py-2 text-xs">
                        <button
                            type="button"
                            disabled={chuaChonTrongKetQua.length === 0}
                            onClick={() => onThem(chuaChonTrongKetQua.map((m) => m.id))}
                            className="whitespace-nowrap rounded-sm font-medium text-bo-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary disabled:text-bo-muted disabled:no-underline"
                        >
                            {dangTim ? `Chọn cả ${ketQua.length} kết quả` : `Chọn tất cả (${mauSacs.length})`}
                        </button>
                        <span className="hidden truncate text-bo-muted sm:inline pointer-coarse:hidden">Enter để chọn · Esc để đóng</span>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
