import { cn } from "@/lib/utils";
import payosLogo from "@/assets/brands/payos-logo.png";
import payosLogo24 from "@/assets/brands/payos-logo-24.png";
import payosLogo30 from "@/assets/brands/payos-logo-30.png";
import payosLogo36 from "@/assets/brands/payos-logo-36.png";
import payosLogo40 from "@/assets/brands/payos-logo-40.png";
import payosLogo48 from "@/assets/brands/payos-logo-48.png";
import payosLogo50 from "@/assets/brands/payos-logo-50.png";
import payosLogo60 from "@/assets/brands/payos-logo-60.png";
import payosLogo80 from "@/assets/brands/payos-logo-80.png";

/*
 * Logo payOS chính thức (payos-logo.png, đã cắt sát nét, 363×161).
 * Các bản thu nhỏ sẵn bằng Lanczos đúng cỡ hiển thị 24px và 40px ở mật độ 1x/1.25x/1.5x/2x:
 * để trình duyệt tự thu nhỏ nhiều lần thì logo bị mờ ở zoom 100%.
 * srcSet theo chiều rộng + sizes = chiều rộng hiển thị -> trình duyệt chọn đúng bản.
 */
const LOGO_RATIO = 363 / 161;
const LOGO_SRCSET = [
  [payosLogo24, 54],
  [payosLogo30, 68],
  [payosLogo36, 81],
  [payosLogo40, 90],
  [payosLogo48, 108],
  [payosLogo50, 113],
  [payosLogo60, 135],
  [payosLogo80, 180],
  [payosLogo, 363],
]
  .map(([url, width]) => `${url} ${width}w`)
  .join(", ");

/** height: chiều cao hiển thị (px). Nên dùng 24 hoặc 40 — hai cỡ có bản thu nhỏ sẵn. */
export default function PayosLogo({ height = 40, className }) {
  const width = Math.round(height * LOGO_RATIO);
  return (
    <img
      alt="payOS"
      className={cn("max-w-none shrink-0", className)}
      draggable={false}
      height={height}
      sizes={`${width}px`}
      src={height <= 24 ? payosLogo24 : payosLogo40}
      srcSet={LOGO_SRCSET}
      width={width}
    />
  );
}
