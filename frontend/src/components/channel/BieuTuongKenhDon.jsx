import { Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { getChannelName } from "@/constants/channel";
import { t, tDuLieu } from "@/i18n";
import ChannelLogo, { BieuTuongTaiQuay } from "@/components/channel/ChannelLogo";

/**
 * Biểu tượng kênh đứng trước số đơn (PA A, chốt 02/11): logo sàn 16 px thay cho thẻ chữ màu.
 * Đơn không gắn kênh (chốt từ báo giá, và cả đơn tại quầy vì POS hiện không gắn kênh) hiện cửa hàng xám để số đơn
 * các dòng vẫn thẳng cột; biểu tượng tại quầy chỉ dành cho đơn còn gắn kênh POS.
 * Rê chuột hiện tên gian hàng; trình đọc màn hình đọc tên kênh.
 */
export default function BieuTuongKenhDon({ maKenh, tenKenh, className }) {
  const ma = maKenh ? String(maKenh).toUpperCase() : null;
  // Đơn không gắn kênh luôn gọi "Bán thường" (Đơn chờ xuất nhận "Trực tiếp" từ máy chủ, như thẻ kênh cũ thì bỏ qua)
  // tenKenh dịch lúc vẽ: "Trực tiếp" của máy chủ (mã DIRECT) có khóa, tên gian hàng thật không có nên giữ nguyên
  const ten = (ma && tenKenh && tDuLieu(tenKenh)) || t(getChannelName(ma));
  return (
    // relative: giữ chữ sr-only trong khung này, không để nó thoát ra kéo dài vùng cuộn của hộp thoại / bảng
    <span title={ten} className={cn("relative inline-flex size-4 shrink-0", className)}>
      {ma === "POS" ? (
        <BieuTuongTaiQuay size={16} />
      ) : ma ? (
        <ChannelLogo maKenh={ma} size={16} />
      ) : (
        <Store aria-hidden="true" strokeWidth={1.8} className="size-4 text-bo-muted/80" />
      )}
      <span className="sr-only">{ten}</span>
    </span>
  );
}
