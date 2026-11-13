import { useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

/** Từ khóa `?q=` trên đường dẫn lúc mở trang (để khởi tạo ô tìm, tránh tải một lượt không có từ khóa). */
export function docTuKhoaUrl(search) {
  return new URLSearchParams(search).get("q") ?? "";
}

/**
 * Trang danh sách nhận từ khóa từ "Xem tất cả" của ô tìm kiếm toàn hệ thống: `/products?q=POLO`.
 * Có `?q=` thì gọi `apDung(tuKhoa)` (đặt vào ô tìm của trang) rồi bỏ `q` khỏi đường dẫn (replace, giữ tham số khác và
 * `location.state`), để gõ từ khóa khác trong trang không bị đường dẫn kéo lại. Đang ở trang rồi bấm "Xem tất cả" lần
 * nữa (cùng trang, `q` mới) cũng nhận.
 */
export default function useTuKhoaTuUrl(apDung) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const q = searchParams.get("q");
  const apDungRef = useRef(apDung);
  const stateRef = useRef(location.state);
  useEffect(() => {
    apDungRef.current = apDung;
    stateRef.current = location.state;
  });

  useEffect(() => {
    if (q == null) return;
    // Hoãn qua microtask như các trang danh sách (tránh setState đồng bộ trong effect)
    queueMicrotask(() => apDungRef.current(q));
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("q");
        return next;
      },
      { replace: true, state: stateRef.current },
    );
  }, [q, setSearchParams]);
}
