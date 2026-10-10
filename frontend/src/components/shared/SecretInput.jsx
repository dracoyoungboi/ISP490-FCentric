import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full rounded-lg border border-bo-border bg-bo-surface px-3 text-sm text-bo-foreground outline-none placeholder:text-slate-500 focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle";

/**
 * Ô nhập khóa bí mật (sao chép từ PaymentSettingsPage.jsx, D.7).
 * Nút mắt chỉ hiện/ẩn chữ đang gõ; không bao giờ điền khóa thật đã lưu vào ô.
 */
export default function SecretInput({ id, label, value, onChange, error, hint, disabled, autoFocus, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-bo-foreground" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          autoFocus={autoFocus}
          className={cn(
            inputClass,
            "pr-10 font-mono placeholder:font-sans",
            error && "border-bo-danger focus:border-bo-danger focus:ring-bo-danger/15",
          )}
          disabled={disabled}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          type={visible ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={visible ? `Ẩn ${label}` : `Hiện ${label}`}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 outline-none hover:text-bo-foreground focus-visible:ring-2 focus-visible:ring-bo-primary/30"
          onClick={() => setVisible((v) => !v)}
          type="button"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-bo-danger" id={`${id}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-bo-muted">{hint}</p>
      ) : null}
    </div>
  );
}
