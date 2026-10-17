import StatusBadge from "@/components/shared/StatusBadge";
import { LIEN_KET_STATUS } from "@/constants/channel";

/** Trạng thái đồng bộ của một sản phẩm đã liên kết: Đang đồng bộ / Ngừng đồng bộ / Lỗi. */
export default function SyncStatusBadge({ trangThai, className }) {
  const meta = LIEN_KET_STATUS[trangThai] ?? { label: trangThai ? `Không xác định (mã ${trangThai})` : "Chưa có trạng thái" };
  return <StatusBadge label={meta.label} className={className} />;
}
