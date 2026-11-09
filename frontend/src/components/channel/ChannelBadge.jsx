import { cn } from "@/lib/utils";
import { getChannelBadgeClass, getChannelName } from "@/constants/channel";
import { t } from "@/i18n";

/** Badge kênh bán (màu theo SRS 8.1.1). Đơn không có kênh hiện "Bán thường". */
export default function ChannelBadge({ maKenh, label, className }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-md border px-2 text-xs font-semibold",
        getChannelBadgeClass(maKenh),
        className,
      )}
    >
      {label ?? t(getChannelName(maKenh))}
    </span>
  );
}
