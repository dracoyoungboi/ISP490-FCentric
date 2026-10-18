import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { coTrangTruocTrongUngDung } from "@/lib/lichSuDieuHuong";

/**
 * Nút Quay lại của trang chi tiết. Có trang trước của ứng dụng trong thẻ thì lùi một bước (về đúng trang
 * trước, giữ tab và tham số trên đường dẫn của nó); mở thẳng bằng đường dẫn (thẻ mới, link cũ được chuyển
 * hướng) thì mở `duongDanDanhSach`. Đổi tab trong trang (replace) không làm thay đổi cách nhận biết này.
 */
export default function useQuayLai(duongDanDanhSach) {
  const navigate = useNavigate();
  return useCallback(() => {
    if (coTrangTruocTrongUngDung(window.history.state)) navigate(-1);
    else navigate(duongDanDanhSach);
  }, [navigate, duongDanDanhSach]);
}
