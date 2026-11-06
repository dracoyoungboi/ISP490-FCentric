import { useEffect, useState } from "react";
import { KHO_LAM_VIEC_EVENT, coQuyenTaiKhoLamViec } from "@/utils/khoLamViec";

/** Mã quyền "Xuất báo cáo" (bảng quyen_han); máy chủ kiểm quyền này ở kho làm việc cho mọi API xuất Excel báo cáo. */
export const QUYEN_XUAT_BAO_CAO = "xuat_bao_cao";

/** Có quyền Xuất báo cáo ở kho làm việc hiện tại (quản trị viên luôn có); tự cập nhật khi đổi kho làm việc. */
export default function useCoQuyenXuatBaoCao() {
  const [co, setCo] = useState(() => coQuyenTaiKhoLamViec(QUYEN_XUAT_BAO_CAO));
  useEffect(() => {
    const nghe = () => setCo(coQuyenTaiKhoLamViec(QUYEN_XUAT_BAO_CAO));
    window.addEventListener(KHO_LAM_VIEC_EVENT, nghe);
    window.addEventListener("storage", nghe);
    return () => {
      window.removeEventListener(KHO_LAM_VIEC_EVENT, nghe);
      window.removeEventListener("storage", nghe);
    };
  }, []);
  return co;
}
