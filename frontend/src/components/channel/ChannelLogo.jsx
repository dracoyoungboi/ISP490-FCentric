import { useId, useState } from "react";
import { ShoppingBag, Store } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Logo sàn: chỉ dùng file chính thức của sàn đặt trong public/channel-logos/, giữ nguyên file, không tự vẽ
 * (ngoại lệ duy nhất: biểu tượng Shopee ở menu trái, ghi ở dưới).
 * Shopify: hình túi "The Shopping Bag" bản màu đầy đủ (trang thương hiệu shopify.com/press/brand).
 * Chưa có file (hoặc tải lỗi) thì hiện ô trung tính, không vẽ thay.
 * Hiển thị đúng cỡ số nguyên (16, 18, 28, 32, 40 px) để nét căng; không phóng bằng transform.
 * Lazada: phần trái tim của logo 2019 (Wikimedia Commons "Lazada (2019).svg"), bỏ chữ "Lazada", giữ nguyên nét và màu.
 * TikTok Shop: phần túi của logo "túi + TikTok Shop" (zonalogo.com, bản SVG), bỏ chữ, giữ nguyên nét và màu.
 * Shopee: phần túi chữ S của logo (Wikimedia Commons "Shopee.svg"), bỏ chữ "Shopee", giữ nguyên nét và màu. Ở menu trái
 * dùng biểu tượng ô cam túi trắng PNG 60 px (bizwebapp.dktcdn.net, user chọn 30/10) vì túi cam khó nhìn trên nền tối.
 */
const LOGO_FILES = {
  SHOPIFY: "/channel-logos/shopify-bag.svg",
  LAZADA: "/channel-logos/lazada.svg",
  TIKTOK: "/channel-logos/tiktok-shop.svg",
  SHOPEE: "/channel-logos/shopee.svg",
};

// Riêng ở menu trái (nền tối): Shopee dùng biểu tượng ô cam túi trắng 60 px (ảnh user chọn 30/10) thay cho túi cam
const LOGO_MENU_FILES = {
  SHOPEE: "/channel-logos/shopee-menu.png",
};

// Logo tối (túi đen của TikTok Shop) trên menu nền tối: đặt trong ô nền trắng để thấy được, không đổi màu logo
const NEN_SANG_O_MENU = new Set(["TIKTOK"]);

// File đã tải lỗi một lần thì các chỗ khác hiện ô trung tính luôn, không gọi lại
const fileLoi = new Set();

function useLogo(maKenh, { menu = false } = {}) {
  const ma = String(maKenh ?? "").toUpperCase();
  const file = (menu && LOGO_MENU_FILES[ma]) || LOGO_FILES[ma] || null;
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
  const { file, baoLoi } = useLogo(maKenh, { menu: true });
  if (!file) return <ShoppingBag className={className} />;
  // Biểu tượng dạng ô màu: bo góc như ô nền trắng của TikTok Shop để các mục sàn cùng dáng
  if (LOGO_MENU_FILES[String(maKenh).toUpperCase()]) {
    return (
      <img src={file} alt="" aria-hidden="true" draggable={false} onError={baoLoi} className={cn("shrink-0 select-none rounded-[4px] object-contain", className)} />
    );
  }
  if (NEN_SANG_O_MENU.has(String(maKenh).toUpperCase())) {
    return (
      <span aria-hidden="true" className={cn("grid shrink-0 place-items-center rounded-[4px] bg-bo-surface", className)}>
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

export function ShopeeMenuIcon({ className }) {
  return <MenuIconKenh maKenh="SHOPEE" className={className} />;
}

/**
 * Biểu tượng kênh "Bán hàng tại quầy" (mẫu A đã duyệt): ô vuông bo góc nền xanh chuyển màu theo chữ F của logo
 * FCentric, hình quầy thu ngân (màn hình + quầy) màu trắng. Kênh nội bộ nên tự vẽ, không phải logo của bên thứ ba.
 * Cỡ do nơi dùng đặt qua `className` (menu ép 16px) hoặc `size`.
 */
export function BieuTuongTaiQuay({ size, className }) {
  const idGradient = `tai-quay-${useId().replace(/:/g, "")}`;
  const kichCo = size ? { width: size, height: size } : undefined;
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" style={kichCo} className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id={idGradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#1677ff" />
        </linearGradient>
      </defs>
      <rect width="16" height="16" rx="4" fill={`url(#${idGradient})`} />
      <rect x="4" y="3.1" width="8" height="4.8" rx="1" fill="none" stroke="#ffffff" strokeWidth="1.3" />
      <path d="M8 7.9v1.7" stroke="#ffffff" strokeWidth="1.3" />
      <rect x="3" y="9.7" width="10" height="3.3" rx="1" fill="#ffffff" />
    </svg>
  );
}

export function TaiQuayMenuIcon({ className }) {
  return <BieuTuongTaiQuay className={className} />;
}
