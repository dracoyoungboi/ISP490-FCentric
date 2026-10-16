import { useCallback, useEffect, useRef, useState } from "react";
import { CAU_HINH_THONG_BAO_NHANH } from "@/config/thongBaoNhanh";
import { toast } from "@/lib/thongBaoNhanh";
import { chuDaSaoChep } from "@/lib/tinhThongBaoNhanh";

const THONG_BAO_LOI = "Không sao chép được. Hãy chọn chữ và sao chép thủ công.";

/**
 * Ghi chữ vào bộ nhớ tạm. navigator.clipboard chỉ chạy trên https hoặc localhost;
 * khi hệ thống chạy qua http (ví dụ địa chỉ IP trong mạng nội bộ) thì dùng cách dự phòng.
 */
async function ghiBoNhoTam(chu) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(chu);
      return true;
    } catch {
      // Trình duyệt từ chối: thử cách dự phòng bên dưới
    }
  }

  const dangChon = document.activeElement;
  const o = document.createElement("textarea");
  o.value = chu;
  o.setAttribute("readonly", "");
  o.style.position = "fixed";
  o.style.top = "0";
  o.style.opacity = "0";
  o.style.pointerEvents = "none";
  document.body.appendChild(o);
  o.select();
  let duoc = false;
  try {
    duoc = document.execCommand("copy");
  } catch {
    duoc = false;
  }
  o.remove();
  if (dangChon instanceof HTMLElement) dangChon.focus({ preventScroll: true });
  return duoc;
}

const TAI_CHO = CAU_HINH_THONG_BAO_NHANH.nutSaoChep === "tai-cho";

/**
 * Sao chép kèm phản hồi, theo config/thongBaoNhanh.js → nutSaoChep:
 * - "thong-bao": bật thông báo nhanh "Đã sao chép …" (chữ lấy từ `nhan`, ví dụ "Sao chép số điện thoại").
 * - "tai-cho": không bật thông báo; `daChep` giữ khóa của mục vừa chép trong một lúc (saoChepTaiCho)
 *   để nút đổi thành dấu tích "Đã chép".
 * Không chép được thì luôn báo lỗi.
 */
export default function useSaoChep() {
  const [daChep, setDaChep] = useState(null);
  const hen = useRef(0);

  useEffect(() => () => clearTimeout(hen.current), []);

  const saoChep = useCallback(async (giaTri, { khoa = true, nhan } = {}) => {
    const duoc = await ghiBoNhoTam(String(giaTri ?? ""));
    if (!duoc) {
      toast.error(THONG_BAO_LOI);
      return false;
    }
    if (!TAI_CHO) {
      toast.success(chuDaSaoChep(nhan));
      return true;
    }
    clearTimeout(hen.current);
    setDaChep(khoa);
    hen.current = setTimeout(() => setDaChep(null), CAU_HINH_THONG_BAO_NHANH.saoChepTaiCho);
    return true;
  }, []);

  const quenDaChep = useCallback(() => {
    clearTimeout(hen.current);
    setDaChep(null);
  }, []);

  return { daChep, saoChep, quenDaChep, taiCho: TAI_CHO };
}
