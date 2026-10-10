import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { CheckCircle2, Loader2, ScanBarcode, Volume2, VolumeX, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-lg border border-bo-border bg-white pl-10 pr-3 font-mono text-base text-bo-foreground outline-none placeholder:font-sans placeholder:text-sm placeholder:text-bo-muted focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle";

/**
 * Ô quét mã vạch cho Barcode to PC / súng quét USB: thiết bị gõ mã như bàn phím rồi gửi Enter.
 * Ô luôn giữ focus sau mỗi lần quét; mất focus thì đèn báo chuyển cam để người dùng bấm lại.
 */
const ScanBar = forwardRef(function ScanBar(
  { onScan, disabled = false, pending = 0, lastResult, soundOn, onToggleSound },
  ref,
) {
  const inputRef = useRef(null);
  const [code, setCode] = useState("");
  const [qty, setQty] = useState("1");
  const [focused, setFocused] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const submit = () => {
    const value = code.trim();
    if (!value || disabled) return;
    const soLuong = Math.max(1, Number.parseInt(qty, 10) || 1);
    onScan(value, soLuong);
    setCode("");
    setQty("1");
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="pick-scan-input" className="text-sm font-medium text-bo-foreground">
              Mã vạch / SKU
            </label>
            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                disabled
                  ? "bg-slate-100 text-slate-500"
                  : focused
                    ? "bg-bo-success-soft text-bo-success"
                    : "bg-bo-warning-soft text-bo-warning",
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {disabled ? "Không quét được" : focused ? "Sẵn sàng quét" : "Bấm vào đây để quét tiếp"}
            </button>
          </div>
          <div className="relative">
            <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-bo-muted" />
            <input
              id="pick-scan-input"
              ref={inputRef}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="Quét mã vạch hoặc nhập SKU rồi nhấn Enter"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="w-24">
            <label htmlFor="pick-scan-qty" className="mb-1.5 block text-sm font-medium text-bo-foreground">
              Số lượng
            </label>
            <input
              id="pick-scan-qty"
              type="number"
              min={1}
              inputMode="numeric"
              disabled={disabled}
              value={qty}
              onChange={(event) => setQty(event.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
              className="h-11 w-full rounded-lg border border-bo-border bg-white px-3 text-center text-base font-semibold text-bo-foreground outline-none focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle"
            />
          </div>
          <button
            type="button"
            onClick={onToggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? "Tắt âm báo" : "Bật âm báo"}
            title={soundOn ? "Tắt âm báo" : "Bật âm báo"}
            className="inline-flex size-11 items-center justify-center rounded-lg border border-bo-border bg-white text-bo-muted transition-colors hover:border-bo-primary hover:text-bo-primary"
          >
            {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        </div>
      </div>

      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2" role="status" aria-live="polite">
        {lastResult ? (
          <p
            className={cn(
              "inline-flex min-w-0 items-center gap-1.5 text-sm font-medium",
              lastResult.ok ? "text-bo-success" : "text-bo-danger",
            )}
          >
            {lastResult.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <XCircle className="size-4 shrink-0" />}
            <span className="min-w-0 break-words">{lastResult.message}</span>
          </p>
        ) : (
          <p className="text-sm text-bo-muted">
            Dùng Barcode to PC (đặt hậu tố là phím Enter) hoặc súng quét USB. Có thể gõ SKU rồi nhấn Enter.
          </p>
        )}
        {pending > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-bo-muted">
            <Loader2 className="size-3.5 animate-spin" />
            Đang gửi {pending} mã
          </span>
        ) : null}
      </div>
    </div>
  );
});

export default ScanBar;
