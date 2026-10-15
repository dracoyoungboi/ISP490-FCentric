import { useState } from "react";
import { Check, ChevronsUpDown, Landmark, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { timNganHang, useDanhSachNganHang } from "@/services/nganHangService";

/** "Công Thương" → "cong thuong": tìm ngân hàng không cần gõ dấu. */
const boDau = (text) =>
    String(text ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[đĐ]/g, "d")
        .toLowerCase();

function LogoNganHang({ bank, className }) {
    const [loi, setLoi] = useState(false);
    if (!bank?.logo || loi) {
        return (
            <span className={cn("flex size-6 shrink-0 items-center justify-center rounded bg-bo-surface-subtle text-bo-muted", className)}>
                <Landmark className="size-3.5" aria-hidden="true" />
            </span>
        );
    }
    return (
        <img
            src={bank.logo}
            alt=""
            loading="lazy"
            onError={() => setLoi(true)}
            className={cn("h-6 w-10 shrink-0 object-contain", className)}
        />
    );
}

/**
 * Ô chọn ngân hàng nhận tiền của nhà cung cấp (lưu mã BIN theo VietQR).
 * Không tải được danh sách (mất mạng, API VietQR lỗi) thì cho nhập tay mã ngân hàng.
 */
export default function NganHangPicker({
    id,
    value,
    onChange,
    disabled = false,
    invalid = false,
    describedBy,
    className,
}) {
    const { danhSach, dangTai, loi } = useDanhSachNganHang();
    const [open, setOpen] = useState(false);
    const selected = timNganHang(danhSach, value);

    if (loi) {
        return (
            <div className="space-y-1">
                <Input
                    id={id}
                    value={value}
                    onChange={(event) => onChange(event.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 20))}
                    readOnly={disabled}
                    placeholder="VD: 970415"
                    autoComplete="off"
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    className={className}
                />
                <p className="text-xs leading-5 text-bo-muted">
                    Không tải được danh sách ngân hàng. Nhập mã BIN theo VietQR (VD: 970415 là VietinBank).
                </p>
            </div>
        );
    }

    const pick = (bin) => {
        setOpen(false);
        onChange(bin);
    };

    return (
        <Popover open={open && !disabled} onOpenChange={setOpen} modal>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    disabled={disabled || dangTai}
                    className={cn(
                        "h-10 w-full justify-between gap-2 px-3 text-left text-sm font-normal hover:bg-white disabled:opacity-100",
                        className,
                        value ? "text-bo-foreground" : "text-slate-400",
                    )}
                >
                    <span className="flex min-w-0 items-center gap-2">
                        {dangTai ? (
                            <>
                                <Loader2 className="size-4 shrink-0 animate-spin text-bo-muted" aria-hidden="true" />
                                <span className="truncate text-bo-muted">Đang tải danh sách ngân hàng...</span>
                            </>
                        ) : selected ? (
                            <>
                                <LogoNganHang bank={selected} />
                                <span className="truncate font-medium">{selected.tenNgan}</span>
                            </>
                        ) : value ? (
                            <span className="truncate">{value}</span>
                        ) : (
                            <span className="truncate">Chọn ngân hàng</span>
                        )}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-[min(92vw,360px)] rounded-lg border border-bo-border bg-white p-0 shadow-lg"
            >
                <Command
                    filter={(itemValue, search, keywords) => {
                        const tuKhoa = boDau(search).trim();
                        if (!tuKhoa) return 1;
                        return boDau([itemValue, ...(keywords ?? [])].join(" ")).includes(tuKhoa) ? 1 : 0;
                    }}
                >
                    <CommandInput placeholder="Tìm tên ngân hàng hoặc mã..." />
                    <CommandList className="max-h-72">
                        <CommandEmpty>Không tìm thấy ngân hàng phù hợp.</CommandEmpty>
                        <CommandGroup>
                            {danhSach.map((bank) => (
                                <CommandItem
                                    key={bank.bin}
                                    value={bank.bin}
                                    keywords={[bank.code, bank.tenNgan, bank.tenDayDu]}
                                    onSelect={() => pick(bank.bin)}
                                    className="flex items-center gap-2 py-2"
                                >
                                    <LogoNganHang bank={bank} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-bo-foreground">{bank.tenNgan}</span>
                                        <span className="block truncate text-xs text-bo-muted">{bank.tenDayDu}</span>
                                    </span>
                                    <Check
                                        className={cn("size-4 shrink-0 text-bo-primary", selected?.bin === bank.bin ? "opacity-100" : "opacity-0")}
                                        aria-hidden="true"
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                    {value ? (
                        <div className="border-t border-bo-border p-1">
                            <button
                                type="button"
                                onClick={() => pick("")}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground"
                            >
                                <X className="size-4" aria-hidden="true" />
                                Bỏ chọn ngân hàng
                            </button>
                        </div>
                    ) : null}
                </Command>
            </PopoverContent>
        </Popover>
    );
}
