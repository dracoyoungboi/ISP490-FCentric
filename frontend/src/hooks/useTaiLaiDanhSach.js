import { useCallback, useEffect, useRef, useState } from "react";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";

/**
 * Tải lại danh sách theo PA1: nút ⟳ + "Cập nhật lúc HH:mm" ở chân bảng, và tự tải lại khi quay lại tab.
 * Kết quả truyền thẳng vào `TablePagination capNhat={...}`.
 *
 * - `duLieu`: mảng dòng đang hiện, phải là state của trang (không tạo mảng mới mỗi lần render).
 *   Mỗi lần nó được thay bằng mảng mới (tải xong, kể cả khi đổi bộ lọc) thì `thoiDiem` = lúc đó.
 *   Sửa một dòng tại chỗ bằng dữ liệu máy chủ trả về sau thao tác (vd. phân công) cũng tính là dữ liệu mới.
 * - `taiNgam()`: tải lại mà KHÔNG xóa bảng (không bật vòng xoay), trả Promise; reject khi lỗi để
 *   chân bảng báo "Không tải lại được" trong khi bảng vẫn giữ dữ liệu cũ.
 * - `bat`: false khi trang đang tải theo cách thường (lần đầu, đổi bộ lọc / trang): không tự tải lại,
 *   nút ⟳ hiện "Đang tải…" và không bấm được (tránh lần tải ngầm chen ngang lần tải đó).
 *
 * Trả về `{ thoiDiem, dangTai, loi, taiLai }`.
 */
export default function useTaiLaiDanhSach({ duLieu, taiNgam, bat = true }) {
  const [thoiDiem, setThoiDiem] = useState(null);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState(false);
  const taiNgamRef = useRef(taiNgam);
  const dangTaiRef = useRef(false);

  useEffect(() => {
    taiNgamRef.current = taiNgam;
  });

  // Dữ liệu vừa được thay mới → ghi thời điểm, bỏ báo lỗi của lần tải lại trước.
  // Hoãn qua microtask để không setState đồng bộ trong effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    queueMicrotask(() => {
      setThoiDiem(new Date());
      setLoi(false);
    });
  }, [duLieu]);

  const taiLai = useCallback(async () => {
    if (dangTaiRef.current) return;
    dangTaiRef.current = true;
    setDangTai(true);
    try {
      await taiNgamRef.current();
      setLoi(false);
    } catch {
      setLoi(true);
    } finally {
      dangTaiRef.current = false;
      setDangTai(false);
    }
  }, []);

  useTaiLaiKhiQuayLai(taiLai, { bat: bat && !dangTai, lanCuoi: thoiDiem });

  return { thoiDiem, dangTai: dangTai || !bat, loi, taiLai };
}
