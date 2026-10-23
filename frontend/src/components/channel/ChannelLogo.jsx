import { useState } from "react";
import { ShoppingBag, Store } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Logo sàn: chỉ dùng file chính thức của sàn đặt trong public/channel-logos/, giữ nguyên file, không tự vẽ.
 * Shopify: hình túi "The Shopping Bag" bản màu đầy đủ (trang thương hiệu shopify.com/press/brand).
 * Chưa có file (hoặc tải lỗi) thì hiện ô trung tính, không vẽ thay.
 * Hiển thị đúng cỡ số nguyên (16, 18, 28, 32, 40 px) để nét căng; không phóng bằng transform.
 * Lazada: phần trái tim của logo 2019 (Wikimedia Commons "Lazada (2019).svg"), bỏ chữ "Lazada", giữ nguyên nét và màu.
 * TikTok Shop: phần túi của logo "túi + TikTok Shop" (zonalogo.com, bản SVG), bỏ chữ, giữ nguyên nét và màu.
 */
const LOGO_FILES = {
  SHOPIFY: "/channel-logos/shopify-bag.svg",
  LAZADA: "/channel-logos/lazada.svg",
  TIKTOK: "/channel-logos/tiktok-shop.svg",
};

// Logo tối (túi đen của TikTok Shop) trên menu nền tối: đặt trong ô nền trắng để thấy được, không đổi màu logo
const NEN_SANG_O_MENU = new Set(["TIKTOK"]);

// File đã tải lỗi một lần thì các chỗ khác hiện ô trung tính luôn, không gọi lại
const fileLoi = new Set();

function useLogo(maKenh) {
  const file = LOGO_FILES[String(maKenh ?? "").toUpperCase()] ?? null;
  const [loi, setLoi] = useState(() => !file || fileLoi.has(file));
  const baoLoi = () => {
    if (file) fileLoi.add(file);
    setLoi(true);
  };
  return { file: loi ? null : file, baoLoi };
}

export default function ChannelLogo({ maKenh, size = 40, className }) {
  const { file, baoLoi } = useLogo(maKenh);
  const kichCo = { width: size, height: size };
  if (file) {
    return (
      <img
        src={file}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        draggable={false}
        onError={baoLoi}
        style={kichCo}
        className={cn("shrink-0 select-none object-contain", className)}
      />
    );
  }
  const icon = Math.max(12, Math.round(size / 2));
  return (
    <span
      aria-hidden="true"
      style={kichCo}
      className={cn("grid shrink-0 place-items-center rounded-lg border border-bo-border bg-bo-surface-subtle text-slate-400", className)}
    >
      <Store style={{ width: icon, height: icon }} />
    </span>
  );
}

/** Biểu tượng mục sàn ở menu bên trái (cỡ do menu đặt, 18 px). Thiếu file thì dùng biểu tượng túi chung. */
function MenuIconKenh({ maKenh, className }) {
  const { file, baoLoi } = useLogo(maKenh);
  if (!file) return <ShoppingBag className={className} />;
  if (NEN_SANG_O_MENU.has(String(maKenh).toUpperCase())) {
    return (
      <span aria-hidden="true" className={cn("grid shrink-0 place-items-center rounded-[4px] bg-white", className)}>
        <img src={file} alt="" draggable={false} onError={baoLoi} className="size-[78%] select-none object-contain" />
      </span>
    );
  }
  return (
    <img src={file} alt="" aria-hidden="true" draggable={false} onError={baoLoi} className={cn("shrink-0 select-none object-contain", className)} />
  );
}

// Menu nhận component chỉ có `className`: mỗi sàn một component (sidebar.config.js chọn theo mã kênh)
export function ShopifyMenuIcon({ className }) {
  return <MenuIconKenh maKenh="SHOPIFY" className={className} />;
}

export function LazadaMenuIcon({ className }) {
  return <MenuIconKenh maKenh="LAZADA" className={className} />;
}

export function TiktokMenuIcon({ className }) {
  return <MenuIconKenh maKenh="TIKTOK" className={className} />;
}
