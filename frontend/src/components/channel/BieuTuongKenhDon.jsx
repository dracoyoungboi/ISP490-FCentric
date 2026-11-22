import { cn } from "@/lib/utils";
import { getChannelName } from "@/constants/channel";
import { t, tDuLieu } from "@/i18n";
import ChannelLogo, { BieuTuongTaiQuay } from "@/components/channel/ChannelLogo";

/**
 * Biểu tượng kênh đứng trước số đơn (PA A, chốt 02/11): logo sàn 16 px thay cho thẻ chữ màu.
 * Đơn không gắn kênh là đơn tại quầy (POS không gắn kênh, và từ 19/11 không còn tạo đơn tay) nên hiện biểu tượng
 * tại quầy, cùng hình với menu trái và trang Kênh bán (user chọn mẫu A 19/11).
 * Rê chuột hiện tên gian hàng; trình đọc màn hình đọc tên kênh.
 */
export default function BieuTuongKenhDon({ maKenh, tenKenh, className }) {
  const ma = maKenh ? String(maKenh).toUpperCase() : null;
  const taiQuay = !ma || ma === "POS";
  // tenKenh dịch lúc vẽ: tên gian hàng thật không có khóa nên giữ nguyên.
  // Đơn tại quầy luôn gọi "Bán hàng tại quầy" (bỏ qua "Trực tiếp" mà máy chủ gửi cho Đơn chờ nhặt hàng)
  const ten = taiQuay ? t("Bán hàng tại quầy") : (tenKenh && tDuLieu(tenKenh)) || t(getChannelName(ma));
  return (
    // relative: giữ chữ sr-only trong khung này, không để nó thoát ra kéo dài vùng cuộn của hộp thoại / bảng
    <span title={ten} className={cn("relative inline-flex size-4 shrink-0", className)}>
      {taiQuay ? <BieuTuongTaiQuay size={16} /> : <ChannelLogo maKenh={ma} size={16} />}
      <span className="sr-only">{ten}</span>
    </span>
  );
}
