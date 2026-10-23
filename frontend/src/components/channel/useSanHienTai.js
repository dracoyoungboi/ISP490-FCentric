import { useParams } from "react-router-dom";
import { timSan } from "@/constants/channel";

/**
 * Sàn của trang đang mở theo `:maKenh` trên đường dẫn (/channels/lazada/...); mã lạ thì null.
 * Các trang kênh nằm dưới KenhHopLe nên luôn nhận được sàn hợp lệ.
 */
export default function useSanHienTai() {
  const { maKenh } = useParams();
  return timSan(maKenh);
}
