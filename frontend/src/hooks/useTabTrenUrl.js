import { useCallback, useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

/**
 * Tab trạng thái lưu trên đường dẫn (bố cục A+G, quy tắc R7): F5, quay lại từ trang chi tiết
 * hay mở từ "Việc cần xử lý" ở Tổng quan đều vào đúng tab.
 *
 * - `giaTriHopLe`: mã các tab (vd. ["tat-ca", "cho-duyet", …]); giá trị lạ trên URL coi như `macDinh`.
 * - `macDinh`: tab mở sẵn (thường "tat-ca"); tab mặc định không ghi lên URL.
 * - `ten`: tên tham số, mặc định "trangThai".
 *
 * Trả về `[tab, setTab]`. `setTab(giaTri, thayDoiKhac?)` ghi đè lịch sử (replace), có thể đổi kèm
 * tham số khác trong cùng một lần, vd. `setTab("cho-xuat-kho", { loai: "ban_hang" })`;
 * truyền `null`/"" để xóa tham số đó. Vẫn là mục lịch sử đó nên giữ nguyên `location.state`
 * (vd. `from` của trang chi tiết để nút Quay lại về đúng danh sách đang lọc).
 */
export default function useTabTrenUrl(giaTriHopLe, macDinh, { ten = "trangThai" } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const stateRef = useRef(location.state);
  useEffect(() => {
    stateRef.current = location.state;
  });
  const giaTri = searchParams.get(ten);
  const tab = giaTriHopLe.includes(giaTri) ? giaTri : macDinh;

  const setTab = useCallback(
    (moi, thayDoiKhac = {}) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const ghi = (khoa, v) => {
            if (v == null || v === "") next.delete(khoa);
            else next.set(khoa, String(v));
          };
          ghi(ten, moi === macDinh ? null : moi);
          Object.entries(thayDoiKhac).forEach(([khoa, v]) => ghi(khoa, v));
          return next;
        },
        { replace: true, state: stateRef.current },
      );
    },
    [setSearchParams, ten, macDinh],
  );

  return [tab, setTab];
}
