import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Đếm số dòng của từng tab trạng thái cho trang danh sách tải theo trang từ API (R1, R8, R9).
 *
 * - `tabValues`: mã các tab cần đếm (vd. ["ALL", "1", "0"]).
 * - `dem(tabValue)`: hàm trả về Promise<number>, dựng đúng yêu cầu của danh sách
 *   (cùng phạm vi kho, từ khóa, ngày…), chỉ thay điều kiện trạng thái, `size = 1`, lấy `totalElements`.
 * - `khoa`: chuỗi đại diện cho các bộ lọc trừ trạng thái; đổi khóa thì đếm lại.
 * - `enabled`: false khi chưa đủ dữ liệu để dựng yêu cầu (vd. đang tải danh sách kho của người dùng).
 *
 * Trả về `{ counts, reload }`. `counts[tab]` là số, hoặc null khi đang đếm / đếm lỗi
 * để tab không hiện số giả. Gọi `reload()` sau thao tác đổi trạng thái (duyệt, khóa, xóa…).
 */
export default function useDemTheoTrangThai(tabValues, dem, khoa, { enabled = true } = {}) {
  const [counts, setCounts] = useState({});
  const [lanTai, setLanTai] = useState(0);
  const demRef = useRef(dem);
  const yeuCauRef = useRef(0);
  const dsTab = tabValues.join("|");

  useEffect(() => {
    demRef.current = dem;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const maYeuCau = ++yeuCauRef.current;
    const cacTab = dsTab.split("|");
    // Hoãn qua microtask (react-hooks/set-state-in-effect): xóa số cũ rồi đếm lại
    queueMicrotask(() => {
      if (maYeuCau !== yeuCauRef.current) return;
      setCounts({});
      Promise.all(cacTab.map((tab) => demRef.current(tab).then((n) => [tab, n], () => [tab, null])))
        .then((ketQua) => {
          if (maYeuCau !== yeuCauRef.current) return;
          setCounts(Object.fromEntries(ketQua));
        });
    });
    return undefined;
  }, [dsTab, khoa, enabled, lanTai]);

  const reload = useCallback(() => setLanTai((n) => n + 1), []);

  return { counts, reload };
}
