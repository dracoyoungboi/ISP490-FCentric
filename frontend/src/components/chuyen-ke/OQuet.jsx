import { forwardRef } from "react";
import { CircleCheck, Info, ScanBarcode, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// Phản hồi lần quét: khung nền nhạt theo kết quả, chữ đủ lớn để người cầm máy quét đứng xa vẫn đọc được
const KIEU = {
  ok: { icon: CircleCheck, mau: "text-bo-success", khung: "border-bo-success/30 bg-bo-success-soft" },
  canhBao: { icon: TriangleAlert, mau: "text-bo-warning", khung: "border-amber-300/70 bg-bo-warning-soft" },
  loi: { icon: TriangleAlert, mau: "text-bo-danger", khung: "border-bo-danger/25 bg-bo-danger-soft" },
  thongTin: { icon: Info, mau: "text-bo-primary", khung: "border-bo-primary/25 bg-bo-primary-soft" },
};

/** Câu phản hồi dưới ô quét; `lan` đổi mỗi lần quét để khung hiện lại dù câu giống lần trước. */
export function PhanHoiQuet({ phanHoi, lan = 0, className }) {
  if (!phanHoi) return null;
  const k = KIEU[phanHoi.kieu] ?? KIEU.thongTin;
  const Icon = k.icon;
  return (
    <p
      key={lan}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-medium leading-5 text-bo-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300",
        k.khung,
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", k.mau)} aria-hidden="true" />
      <span className="min-w-0">{phanHoi.chu}</span>
    </p>
  );
}

/**
 * Ô quét mã (kệ, sản phẩm / lô): máy quét gõ mã rồi Enter, gõ tay cũng được. `dsGoiY`: các mã gợi ý (datalist) khi gõ tay.
 * `phanHoi` / `lan`: câu phản hồi lần quét cuối (đọc bằng trình đọc màn hình). `khoa`: chưa dùng được (disabled);
 * `ban`: đang tra mã vừa quét (chỉ đọc, bỏ qua Enter, giữ tiêu điểm).
 */
const OQuet = forwardRef(function OQuet(
  { id, nhan, giaTri, onDoi, onQuet, placeholder, dsGoiY, phanHoi, lan, khoa = false, ban = false, className, cao = "h-11" },
  ref,
) {
  const idGoiY = dsGoiY?.length ? `${id}-goi-y` : undefined;
  return (
    <div className={cn("grid gap-2", className)}>
      <label className="relative flex items-center" htmlFor={id}>
        <span className="sr-only">{nhan}</span>
        <ScanBarcode className="pointer-events-none absolute left-3 size-[18px] text-bo-primary" aria-hidden="true" />
        <input
          ref={ref}
          id={id}
          type="text"
          autoComplete="off"
          enterKeyHint="go"
          spellCheck={false}
          list={idGoiY}
          disabled={khoa}
          // Đang tra mã: chỉ khóa đọc (không disabled) để ô giữ tiêu điểm cho lần quét tiếp
          readOnly={ban}
          aria-busy={ban || undefined}
          value={giaTri}
          onChange={(e) => onDoi(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (!ban) onQuet(giaTri);
          }}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-lg border border-bo-input-border bg-white pl-10 pr-3 font-mono text-[15px] text-bo-foreground outline-none placeholder:font-sans placeholder:text-[13px] placeholder:text-slate-500 focus:border-bo-primary focus:ring-[3px] focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle",
            cao,
          )}
        />
        {idGoiY ? (
          <datalist id={idGoiY}>
            {dsGoiY.map((g) => (
              <option key={g.value} value={g.value}>
                {g.nhan}
              </option>
            ))}
          </datalist>
        ) : null}
      </label>
      <div role="status" aria-live="polite">
        <PhanHoiQuet phanHoi={phanHoi} lan={lan} />
      </div>
    </div>
  );
});

export default OQuet;
