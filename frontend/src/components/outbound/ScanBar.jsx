import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { CheckCircle2, Keyboard, KeyboardOff, Loader2, ScanBarcode, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Nhớ theo máy: tắt bàn phím ảo ở ô quét (máy cầm tay / súng quét Bluetooth)
const TAT_BAN_PHIM_KEY = "fcentric.quet.tatBanPhim";

const inputClass =
  "h-11 w-full rounded-lg border border-bo-border bg-white pl-10 pr-3 font-mono text-base text-bo-foreground outline-none placeholder:font-sans placeholder:text-sm placeholder:text-bo-muted focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle";

const GOI_Y_MAC_DINH =
  "Dùng Barcode to PC (đặt hậu tố là phím Enter) hoặc súng quét USB. Có thể gõ SKU rồi nhấn Enter. Nghe tiếng “rè” là mã chưa được cộng.";

/**
 * Ô quét mã vạch cho Barcode to PC / súng quét USB: thiết bị gõ mã như bàn phím rồi gửi Enter.
 * Ô luôn giữ focus sau mỗi lần quét; mất focus thì đèn báo chuyển cam để người dùng bấm lại.
 * Âm thanh: máy quét tự kêu khi đọc được mã; trang chỉ kêu tiếng "rè" khi mã không cộng được (không có nút loa).
 *
 * - `gon`: kiểu gọn của màn Thực hiện nhặt hàng — "Đang gửi n mã" lên cạnh nhãn, ô số lượng nhỏ "SL" (không nổi bật:
 *   quét vật lý luôn là 1 cái mỗi lần), gợi ý ngắn trong ô. Mặc định giữ kiểu cũ (màn Đóng gói).
 * - `goiY`: câu hướng dẫn khi chưa quét lần nào.
 */
const ScanBar = forwardRef(function ScanBar(
  { onScan, disabled = false, pending = 0, lastResult, gon = false, goiY = GOI_Y_MAC_DINH },
  ref,
) {
  const inputRef = useRef(null);
  const [code, setCode] = useState("");
  const [qty, setQty] = useState("1");
  const [focused, setFocused] = useState(false);
  // Màn cảm ứng: tắt bàn phím ảo khi dùng súng quét Bluetooth / máy cầm tay (súng quét vẫn gõ được vào ô). Nhớ theo máy.
  const [tatBanPhim, setTatBanPhim] = useState(() => {
    try { return window.localStorage.getItem(TAT_BAN_PHIM_KEY) === "1"; } catch { return false; }
  });
  const doiBanPhim = () => {
    const moi = !tatBanPhim;
    setTatBanPhim(moi);
    try { window.localStorage.setItem(TAT_BAN_PHIM_KEY, moi ? "1" : "0"); } catch { /* bỏ qua */ }
    inputRef.current?.blur();
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const nutBanPhim = (
    <button
      type="button"
      onClick={doiBanPhim}
      aria-pressed={tatBanPhim}
      aria-label={tatBanPhim ? "Bật bàn phím ảo" : "Tắt bàn phím ảo khi dùng súng quét"}
      title={tatBanPhim ? "Bật bàn phím ảo" : "Tắt bàn phím ảo khi dùng súng quét"}
      className={cn(
        "hidden size-11 shrink-0 place-items-center rounded-lg border border-bo-border bg-bo-surface text-slate-600 cam-ung:grid",
        tatBanPhim && "border-bo-primary bg-bo-primary-soft text-bo-primary",
      )}
    >
      {tatBanPhim ? <KeyboardOff className="size-5" aria-hidden="true" /> : <Keyboard className="size-5" aria-hidden="true" />}
    </button>
  );

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

  const guiKhiEnter = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  const nhanO = (
    <label htmlFor="pick-scan-input" className="text-sm font-medium text-bo-foreground">
      Mã vạch / SKU
    </label>
  );

  // ngan: chữ ngắn cho điện thoại (đèn nằm chung hàng với dòng kết quả). Trên điện thoại đèn chỉ báo trạng thái, không phải
  // nút (ô quét nằm ngay trên, chạm vào ô là đủ) nên không cần vùng chạm 44px và không bị lớp cảm ứng kéo cao.
  const veDen = (ngan = false) => {
    const The = ngan ? "span" : "button";
    return (
      <The
        {...(ngan ? { role: "status" } : { type: "button", onClick: () => inputRef.current?.focus() })}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
          ngan && "shrink-0 whitespace-nowrap",
          disabled
            ? "bg-slate-100 text-slate-500"
            : focused
              ? "bg-bo-success-soft text-bo-success"
              : "bg-bo-warning-soft text-bo-warning",
        )}
      >
        <span className="size-1.5 rounded-full bg-current" />
        {disabled
          ? ngan ? "Đang khóa" : "Không quét được"
          : focused
            ? ngan ? "Sẵn sàng" : "Sẵn sàng quét"
            : ngan ? "Chạm ô để quét" : "Bấm vào đây để quét tiếp"}
      </The>
    );
  };
  const den = veDen();

  const oMa = (
    <div className="relative">
      <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-bo-muted" />
      <input
        id="pick-scan-input"
        ref={inputRef}
        autoFocus
        inputMode={tatBanPhim ? "none" : undefined}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={guiKhiEnter}
        placeholder={gon ? "Quét hoặc nhập SKU" : "Quét mã vạch hoặc nhập SKU rồi nhấn Enter"}
        className={inputClass}
      />
    </div>
  );

  const propsSoLuong = {
    id: "pick-scan-qty",
    type: "number",
    min: 1,
    inputMode: "numeric",
    disabled,
    value: qty,
    onChange: (event) => setQty(event.target.value.replace(/[^\d]/g, "")),
    onKeyDown: guiKhiEnter,
  };

  const dangGui = pending > 0 ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-bo-muted">
      <Loader2 className="size-3.5 animate-spin" />
      Đang gửi {pending} mã
    </span>
  ) : null;

  const ketQua = lastResult ? (
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
    <p className="text-sm text-bo-muted max-md:line-clamp-1">{goiY}</p>
  );

  if (gon) {
    return (
      <div className="min-w-0 space-y-2">
        <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-3 gap-y-1 max-md:hidden">
          {nhanO}
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {dangGui}
            {den}
          </span>
        </div>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">{oMa}</div>
          <label htmlFor="pick-scan-qty" className="grid gap-0.5 text-[11px] leading-[14px] text-bo-muted">
            <span aria-hidden="true">SL</span>
            <span className="sr-only">Số lượng mỗi lần quét</span>
            <input
              {...propsSoLuong}
              className="h-11 w-14 rounded-lg border border-bo-border bg-bo-surface px-1.5 text-center text-sm font-medium text-slate-600 outline-none focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle"
            />
          </label>
          {nutBanPhim}
        </div>
        {/* Điện thoại: hàng nhãn + đèn ở trên bị ẩn cho vùng quét thấp; đèn và "Đang gửi" về chung hàng kết quả */}
        <div className="flex min-h-5 min-w-0 items-start max-md:gap-2">
          <div className="flex min-w-0 max-md:flex-1" role="status" aria-live="polite">
            {ketQua}
          </div>
          <span className="flex shrink-0 items-center gap-2 md:hidden">
            {pending > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-bo-muted">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                {pending}
                <span className="sr-only">mã đang gửi</span>
              </span>
            ) : null}
            {veDen(true)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            {nhanO}
            {den}
          </div>
          {oMa}
        </div>

        <div className="flex items-end gap-2">
          <div className="w-24">
            <label htmlFor="pick-scan-qty" className="mb-1.5 block text-sm font-medium text-bo-foreground">
              Số lượng
            </label>
            <input
              {...propsSoLuong}
              className="h-11 w-full rounded-lg border border-bo-border bg-bo-surface px-3 text-center text-base font-semibold text-bo-foreground outline-none focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle"
            />
          </div>
        </div>
      </div>

      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2" role="status" aria-live="polite">
        {ketQua}
        {dangGui}
      </div>
    </div>
  );
});

export default ScanBar;
