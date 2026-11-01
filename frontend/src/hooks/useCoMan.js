import { laCamUng } from "@/lib/camUng";

/**
 * Cỡ màn theo kế hoạch responsive:
 * - "dienThoai": dưới 768px (mọi thiết bị);
 * - "mtbDoc": 768–1023px trên màn cảm ứng; "mtbNgang": 1024–1279px trên màn cảm ứng;
 * - "mayTinh": từ 1280px, hoặc dùng chuột ở bất kỳ cỡ nào từ 768px — giao diện máy tính giữ nguyên.
 */
export function tinhCoMan(rong = window.innerWidth, camUng = laCamUng()) {
  if (rong < 768) return "dienThoai";
  if (camUng && rong < 1024) return "mtbDoc";
  if (camUng && rong < 1280) return "mtbNgang";
  return "mayTinh";
}
