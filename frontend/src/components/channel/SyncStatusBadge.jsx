import StatusBadge from "@/components/shared/StatusBadge";
import { SYNC_STATUS } from "@/constants/channel";

export default function SyncStatusBadge({ trangThai }) {
  const meta = SYNC_STATUS[trangThai] ?? { label: trangThai || "—", tone: "neutral" };
  return <StatusBadge label={meta.label} tone={meta.tone} />;
}
