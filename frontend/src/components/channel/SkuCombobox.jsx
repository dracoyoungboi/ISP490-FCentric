import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Unlink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { cn } from "@/lib/utils";

/**
 * Chọn biến thể FCentric để ghép tay với SKU sàn (mẫu combobox BrandSelector).
 * Tìm ở server: GET /bien-the/tim-kiem, chờ 300 ms sau khi ngừng gõ.
 */
export default function SkuCombobox({ value, onChange, disabled = false, saving = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      kenhBanHangService
        .timBienThe(query.trim(), 20)
        .then((list) => {
          if (!cancelled) setOptions(Array.isArray(list) ? list : []);
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const pick = (option) => {
    setOpen(false);
    setQuery("");
    onChange(option);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || saving}
          className={cn(
            "h-9 w-full justify-between gap-2 border-bo-border bg-white px-3 text-left text-sm font-normal hover:bg-bo-surface-subtle",
            value ? "text-bo-foreground" : "text-bo-muted",
          )}
        >
          <span className="min-w-0 truncate">
            {value ? (
              <>
                <span className="font-mono text-xs font-semibold text-bo-primary">{value.maSku}</span>
                <span className="ml-1.5 text-xs text-bo-muted">{value.tenBienThe}</span>
              </>
            ) : (
              "Chọn biến thể FCentric"
            )}
          </span>
          {saving ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <ChevronsUpDown className="size-4 shrink-0 opacity-60" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,380px)] rounded-lg border border-bo-border bg-white p-0 shadow-lg">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Tìm theo SKU hoặc tên biến thể..." value={query} onValueChange={setQuery} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-bo-muted">
                <Loader2 className="size-4 animate-spin" /> Đang tìm
              </div>
            ) : (
              <>
                <CommandEmpty>Không tìm thấy biến thể phù hợp.</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem key={option.id} value={String(option.id)} onSelect={() => pick(option)} className="flex items-start gap-2">
                      <Check className={cn("mt-0.5 size-4 shrink-0", value?.id === option.id ? "opacity-100 text-bo-primary" : "opacity-0")} />
                      <span className="min-w-0">
                        <span className="block font-mono text-xs font-semibold text-bo-foreground">{option.maSku}</span>
                        <span className="block truncate text-xs text-bo-muted">{option.tenBienThe}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {value ? (
              <div className="border-t border-bo-border p-1">
                <button
                  type="button"
                  onClick={() => pick(null)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-bo-danger hover:bg-bo-danger-soft"
                >
                  <Unlink className="size-4" />
                  Bỏ liên kết
                </button>
              </div>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
