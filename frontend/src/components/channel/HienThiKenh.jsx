import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

const MAU_CHAM = {
  success: "bg-bo-success",
  warning: "bg-amber-500",
  info: "bg-bo-primary",
  neutral: "bg-slate-400",
  danger: "bg-bo-danger",
};

/** Trạng thái dạng chấm + chữ (không viên). Chỉ trạng thái lỗi có nền đỏ nhạt để nổi lên trong bảng dài. */
export function TrangThaiCham({ label, tone = "neutral", className }) {
  const loi = tone === "danger";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] leading-5",
        loi ? "rounded-md bg-bo-danger-soft px-2 text-bo-danger" : tone === "neutral" ? "text-bo-muted" : "text-bo-foreground",
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", MAU_CHAM[tone] ?? MAU_CHAM.neutral)} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Ảnh sản phẩm vuông (36 px mặc định); chưa có ảnh hoặc ảnh lỗi thì hiện ô xám. */
export function AnhSanPham({ src, size = 36, className }) {
  const [loiSrc, setLoiSrc] = useState(null);
  const kichCo = { width: size, height: size };
  if (src && loiSrc !== src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={() => setLoiSrc(src)}
        style={kichCo}
        className={cn("shrink-0 rounded-md border border-bo-border bg-bo-surface-subtle object-cover", className)}
      />
    );
  }
  return (
    <span aria-hidden="true" style={kichCo} className={cn("grid shrink-0 place-items-center rounded-md bg-slate-100 text-slate-400", className)}>
      <ImageOff className="size-3.5" />
    </span>
  );
}
