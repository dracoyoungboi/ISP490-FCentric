import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const COT = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
};

/** Dải ô bằng nhau, chia bởi đường kẻ 1px (cùng kiểu MetricStrip). `phang`: không viền ngoài, dùng trong thẻ. */
export function DaiO({ soO = 3, phang = false, className, children }) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden bg-bo-border",
        phang ? "" : "rounded-lg border border-bo-border shadow-sm",
        COT[soO] ?? COT[3],
        className,
      )}
    >
      {children}
    </div>
  );
}

const NHAN_TRANG_THAI = { xong: "Xong", dang: "Đang ở bước này", cho: "Chưa tới" };

/**
 * Một ô bước / điều kiện. Ô bằng nhau nhờ lưới; nút hành động luôn nằm ở đáy ô.
 * - trangThai: "xong" | "dang" | "cho"
 * - nhan: chữ nhỏ trên cùng (vd "Bước 1"); nhanTrangThai: chữ bên phải (mặc định theo trạng thái)
 */
export function OBuoc({ trangThai = "cho", so, nhan, nhanTrangThai, tieuDe, giaTri, moTa, phu, hanhDong, className }) {
  const xong = trangThai === "xong";
  const dang = trangThai === "dang";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 bg-bo-surface p-4 md:min-h-[156px]",
        dang && "shadow-[inset_0_3px_0_var(--color-bo-primary)]",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-bo-muted">
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] text-xs font-semibold",
            xong && "border-bo-success bg-bo-success text-white",
            dang && "border-bo-primary bg-bo-surface text-bo-primary",
            !xong && !dang && "border-slate-300 bg-bo-surface text-bo-muted",
          )}
          aria-hidden="true"
        >
          {xong ? <Check className="size-3.5" /> : so}
        </span>
        <span className="min-w-0 truncate">{nhan}</span>
        <span className="ml-auto shrink-0 font-medium">{nhanTrangThai ?? NHAN_TRANG_THAI[trangThai]}</span>
      </div>
      {tieuDe ? (
        <p className={cn("mt-1 text-[15px] font-semibold leading-6", trangThai === "cho" ? "text-bo-muted" : "text-bo-heading")}>
          {tieuDe}
        </p>
      ) : null}
      {giaTri ? <div className="mt-1 break-words text-base font-semibold leading-6 text-bo-heading">{giaTri}</div> : null}
      {moTa ? <div className="text-[13px] leading-5 text-slate-600">{moTa}</div> : null}
      {phu}
      <div className="mt-auto flex min-h-11 flex-wrap items-center gap-2 pt-3">{hanhDong}</div>
    </div>
  );
}

/** Thanh mức (tiến độ / mức đầy). tone: "" (xanh dương) | ok | warn | bad. */
export function ThanhMuc({ phanTram, tone = "", className, label }) {
  const rong = Math.max(0, Math.min(100, Math.round(Number(phanTram) || 0)));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={rong}
      aria-label={label}
      className={cn("h-1.5 min-w-10 overflow-hidden rounded-full bg-[#e9eef4]", className)}
    >
      <span
        className={cn(
          "block h-full rounded-full",
          tone === "ok" ? "bg-bo-success" : tone === "warn" ? "bg-amber-600" : tone === "bad" ? "bg-bo-danger" : "bg-bo-primary",
        )}
        style={{ width: `${rong}%` }}
      />
    </div>
  );
}

/** Thanh + số "đã/tổng" căn phải, cột cố định cho bảng. */
export function TienDoSo({ da, tong, className }) {
  const xong = tong > 0 && da >= tong;
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_64px] items-center gap-3", className)}>
      <ThanhMuc phanTram={tong > 0 ? (da / tong) * 100 : 0} tone={xong ? "ok" : ""} label={`${da} trên ${tong}`} />
      <span className="text-right text-[13px] tabular-nums text-slate-600">
        {da.toLocaleString("vi-VN")}/{tong.toLocaleString("vi-VN")}
      </span>
    </div>
  );
}
