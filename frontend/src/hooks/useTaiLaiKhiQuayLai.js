import { useEffect, useRef } from "react";
import { GIA_CACH_TU_TAI_LAI_MS, nenTuTaiLai } from "@/lib/tinhTaiLai";

/** Popup, hộp xác nhận, bảng trượt (Radix) đang mở thì có phần tử role dialog / alertdialog trong trang. */
const coHopThoaiDangMo = () => document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;

/**
 * Tự gọi `taiLai()` khi người dùng quay lại tab / cửa sổ (sự kiện visibilitychange và focus),
 * để dữ liệu do người khác hoặc hệ thống khác vừa đổi hiện ra mà không phải bấm F5.
 *
 * `taiLai` phải tải lại NGẦM: giữ nguyên nội dung đang hiện, không bật vòng xoay cả trang.
 *
 * Không tự tải lại khi:
 * - `bat = false` (vd. trang đang tải, hoặc đang sửa dở dữ liệu lấy từ máy chủ);
 * - đang mở popup / hộp xác nhận;
 * - chưa qua `giaCach` (mặc định 30 giây) kể từ lần tải gần nhất. Lần tải gần nhất là mốc muộn nhất trong:
 *   lúc vào trang, lần tự tải trước, và `lanCuoi` (Date — thời điểm dữ liệu trên màn được tải, nếu trang có).
 */
export default function useTaiLaiKhiQuayLai(taiLai, { bat = true, lanCuoi = null, giaCach = GIA_CACH_TU_TAI_LAI_MS } = {}) {
  const taiLaiRef = useRef(taiLai);
  const batRef = useRef(bat);
  const lanCuoiRef = useRef(lanCuoi);
  const lanTuTaiRef = useRef(0);

  useEffect(() => {
    taiLaiRef.current = taiLai;
    batRef.current = bat;
    lanCuoiRef.current = lanCuoi;
  });

  useEffect(() => {
    lanTuTaiRef.current = Date.now();

    const khiQuayLai = () => {
      const bayGio = Date.now();
      const lanCuoiDuLieu = lanCuoiRef.current instanceof Date ? lanCuoiRef.current.getTime() : 0;
      const nen = nenTuTaiLai({
        bat: batRef.current,
        hienThi: document.visibilityState === "visible",
        coHopThoai: coHopThoaiDangMo(),
        bayGio,
        lanCuoi: Math.max(lanTuTaiRef.current, lanCuoiDuLieu),
        giaCach,
      });
      if (!nen) return;
      // Ghi mốc trước khi gọi: focus và visibilitychange thường bắn liền nhau, chỉ tải một lần
      lanTuTaiRef.current = bayGio;
      taiLaiRef.current();
    };

    document.addEventListener("visibilitychange", khiQuayLai);
    window.addEventListener("focus", khiQuayLai);
    return () => {
      document.removeEventListener("visibilitychange", khiQuayLai);
      window.removeEventListener("focus", khiQuayLai);
    };
  }, [giaCach]);
}
