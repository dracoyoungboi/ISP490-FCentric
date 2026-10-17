import StatusBadge from "@/components/shared/StatusBadge";
import { CONNECTION_STATUS } from "@/constants/channel";

/** Trạng thái gian hàng: Chưa kết nối / Đang hoạt động / Tạm dừng / Hết hạn khóa. */
export default function ConnectionStatusBadge({ trangThai, className }) {
  const meta = CONNECTION_STATUS[trangThai] ?? { label: trangThai ? `Không xác định (mã ${trangThai})` : "Chưa có trạng thái" };
  return <StatusBadge label={meta.label} className={className} />;
}
