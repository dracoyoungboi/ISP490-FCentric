import { cn } from "@/lib/utils";
import { getChannelBadgeClass, getChannelName } from "@/constants/channel";

/**
 * Logo sàn: chỉ dùng file logo chính thức đặt ở public/channel-logos/ (khai báo vào LOGO_FILES khi đã có),
 * chưa có file thì hiện tên sàn — không tự vẽ logo (KE-HOACH-CODE mục A.8).
 */
const LOGO_FILES = {
  // SHOPIFY: "/channel-logos/shopify.svg",
};

export default function ChannelLogo({ maKenh, className }) {
  const key = String(maKenh ?? "").toUpperCase();
  const file = LOGO_FILES[key];
  if (file) {
    return <img src={file} alt={getChannelName(key)} className={cn("h-10 w-auto shrink-0 object-contain", className)} />;
  }
  return (
    <span
      className={cn(
        "inline-flex h-10 shrink-0 items-center rounded-lg border px-3 text-sm font-bold tracking-tight",
        getChannelBadgeClass(key),
        className,
      )}
    >
      {getChannelName(key, key)}
    </span>
  );
}
