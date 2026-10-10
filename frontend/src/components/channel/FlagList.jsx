import StatusBadge from "@/components/shared/StatusBadge";
import OrderFlagBadges from "@/components/channel/OrderFlagBadges";
import { FLAG_META, parseFlags } from "@/constants/channel";

/** Danh sách cờ cần xử lý kèm giải thích và cách gỡ (TK 7.4). `compact` chỉ hiện badge. */
export default function FlagList({ value, compact = false }) {
  const flags = parseFlags(value);
  if (compact) return <OrderFlagBadges value={flags} max={5} />;
  if (!flags.length) return null;
  return (
    <ul className="space-y-2">
      {flags.map((flag) => {
        const meta = FLAG_META[flag] ?? { label: flag, tone: "warning", description: "", resolve: "" };
        return (
          <li key={flag} className="rounded-md border border-bo-border bg-bo-surface-subtle p-3">
            <StatusBadge label={meta.label} tone={meta.tone} dot={false} />
            {meta.description ? <p className="mt-1.5 text-sm text-slate-700">{meta.description}</p> : null}
            {meta.resolve ? <p className="mt-0.5 text-xs text-bo-muted">Cách xử lý: {meta.resolve}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
