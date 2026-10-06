import { useEffect, useState } from "react";
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/components/ui/popover";
import {
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandItem,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/shared/StatusBadge";
import BrandFormDialog from "@/components/brand/BrandFormDialog";
import { thuongHieuService } from "@/services/thuongHieuService.js";
import { Check, ChevronsUpDown, Plus, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const parseRoles = (value) => {
    if (typeof value !== "string") return [];
    return value.split(/\s+/).filter(Boolean);
};

/**
 * Combobox chọn thương hiệu DÙNG CHUNG cho form tạo/sửa sản phẩm.
 * - Tìm kiếm theo mã/tên.
 * - Thương hiệu ngừng hoạt động: vẫn hiển thị nếu đang được gán,
 *   nhưng không chọn được cho gán mới.
 * - quan_tri_vien có thể tạo thương hiệu mới NGAY TẠI CHỖ (dialog lồng,
 *   không làm mất draft ảnh/biến thể của form sản phẩm cha).
 * - Gỡ liên kết bằng mục "Không có thương hiệu" trong dropdown.
 * - Không có nút X bên ngoài; chiều cao h-9 đồng bộ với Input/Select.
 */
export default function BrandSelector({
    value,
    onChange,
    disabled = false,
    placeholder = "Chọn thương hiệu (không bắt buộc)",
}) {
    const [open, setOpen] = useState(false);
    const [brands, setBrands] = useState([]);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    const isAdmin = parseRoles(window.localStorage.getItem("role") ?? "").includes("quan_tri_vien");

    useEffect(() => {
        let cancelled = false;
        thuongHieuService
            .getAll()
            .then((res) => {
                if (!cancelled) setBrands(res?.data ?? []);
            })
            .catch(() => {
                if (!cancelled) toast.error("Không thể tải danh sách thương hiệu");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const selected = brands.find((brand) => brand.id === value) ?? null;

    return (
        <>
            <div className="w-full min-w-0">
                <Popover open={open && !disabled} onOpenChange={(nextOpen) => {
                    if (!disabled) setOpen(nextOpen);
                }}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={open && !disabled}
                            disabled={disabled}
                            className={cn(
                                "h-9 w-full min-w-0 max-w-full justify-between gap-2 border-bo-border bg-white px-3 py-1 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle",
                                !selected && "text-bo-muted",
                            )}
                        >
                            <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                {selected?.logoUrl ? (
                                    <img
                                        src={selected.logoUrl}
                                        alt=""
                                        className="size-5 shrink-0 rounded object-contain"
                                    />
                                ) : (
                                    <Tag className="size-4 shrink-0 text-bo-muted" />
                                )}
                                <span className="min-w-0 truncate">
                                    {selected ? selected.tenThuongHieu : placeholder}
                                </span>
                            </span>
                            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="start"
                        className="w-[var(--radix-popover-trigger-width)] border-bo-border bg-white p-0"
                    >
                        <Command className="rounded-lg">
                            <CommandInput placeholder="Tìm kiếm thương hiệu..." className="text-bo-foreground" />
                            <CommandList className="max-h-[240px]">
                                <CommandEmpty className="text-bo-muted">Không tìm thấy thương hiệu</CommandEmpty>
                                <CommandItem
                                    value="__khong-co-thuong-hieu__"
                                    keywords={["Không có thương hiệu", "Bỏ chọn thương hiệu"]}
                                    disabled={disabled}
                                    onSelect={() => {
                                        if (disabled) return;
                                        onChange(null);
                                        setOpen(false);
                                    }}
                                    className="data-[selected=true]:bg-bo-primary-soft data-[selected=true]:text-bo-foreground"
                                >
                                    <Tag className="size-4 shrink-0 text-bo-muted" />
                                    <span className="min-w-0 flex-1 truncate">Không có thương hiệu</span>
                                    {value == null ? <Check className="size-4 shrink-0 text-bo-primary" /> : null}
                                </CommandItem>
                                {brands.map((brand) => {
                                    const isInactive = Number(brand.trangThai) !== 1;
                                    const isCurrent = value === brand.id;
                                    return (
                                        <CommandItem
                                            key={brand.id}
                                            value={`${brand.tenThuongHieu} ${brand.maThuongHieu}`}
                                            disabled={disabled || (isInactive && !isCurrent)}
                                            onSelect={() => {
                                                if (disabled) return;
                                                onChange(brand.id);
                                                setOpen(false);
                                            }}
                                            className="data-[selected=true]:bg-bo-primary-soft data-[selected=true]:text-bo-foreground"
                                        >
                                            {brand.logoUrl ? (
                                                <img
                                                    src={brand.logoUrl}
                                                    alt=""
                                                    className="size-4 shrink-0 rounded object-contain"
                                                />
                                            ) : (
                                                <Tag className="size-4 shrink-0 text-bo-muted" />
                                            )}
                                            <span className="min-w-0 flex-1 truncate">{brand.tenThuongHieu}</span>
                                            <span className="shrink-0 font-mono text-xs text-bo-muted">{brand.maThuongHieu}</span>
                                            {isInactive ? (
                                                <StatusBadge label="Ngừng hoạt động" tone="neutral" dot={false} className="shrink-0" />
                                            ) : null}
                                            {isCurrent ? <Check className="size-4 shrink-0 text-bo-primary" /> : null}
                                        </CommandItem>
                                    );
                                })}
                                {isAdmin ? (
                                    <CommandItem
                                        value="__tao-moi__"
                                        disabled={disabled}
                                        onSelect={() => {
                                            setOpen(false);
                                            if (!disabled) setCreateDialogOpen(true);
                                        }}
                                        className="border-t border-bo-border data-[selected=true]:bg-bo-primary-soft data-[selected=true]:text-bo-foreground"
                                    >
                                        <Plus className="size-4 text-bo-primary" />
                                        <span className="font-medium text-bo-primary">Tạo thương hiệu mới</span>
                                    </CommandItem>
                                ) : null}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            <BrandFormDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onCreated={(brand) => {
                    onChange(brand.id);
                    setCreateDialogOpen(false);
                }}
            />
        </>
    );
}
