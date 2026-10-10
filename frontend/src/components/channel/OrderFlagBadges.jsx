import StatusBadge from "@/components/shared/StatusBadge";
import { FLAG_META, parseFlags } from "@/constants/channel";

/** Các cờ cần xử lý của đơn (TK 7.4). `max` giới hạn số badge, phần còn lại hiện "+n". */
export default function OrderFlagBadges({ value, max = 2, emptyText = "—" }) {
  const flags = parseFlags(value);
  if (!flags.length) return <span className="text-xs text-bo-muted">{emptyText}</span>;
  const shown = flags.slice(0, max);
  const rest = flags.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((flag) => (
        <StatusBadge
          key={flag}
          label={FLAG_META[flag]?.label ?? flag}
          tone={FLAG_META[flag]?.tone ?? "warning"}
          dot={false}
        />
      ))}
      {rest > 0 ? (
        <span className="text-xs font-semibold text-bo-muted" title={flags.slice(max).map((f) => FLAG_META[f]?.label ?? f).join(", ")}>
          +{rest}
        </span>
      ) : null}
    </div>
  );
}
