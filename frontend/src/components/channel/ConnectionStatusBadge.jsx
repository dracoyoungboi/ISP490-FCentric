import StatusBadge from "@/components/shared/StatusBadge";
import { CONNECTION_STATUS } from "@/constants/channel";

export default function ConnectionStatusBadge({ trangThai }) {
  const meta = CONNECTION_STATUS[trangThai] ?? { label: trangThai || "Không xác định", tone: "neutral" };
  return <StatusBadge label={meta.label} tone={meta.tone} />;
}
