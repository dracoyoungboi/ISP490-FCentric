import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tải dữ liệu bằng một hàm trả về Promise, tải lại khi `khoa` đổi hoặc khi gọi `reload()`.
 *
 * - Chỉ nhận kết quả của lần tải mới nhất (đổi bộ lọc liên tiếp không bị kết quả cũ đè lên).
 * - Trong lúc tải lại vẫn giữ `data` cũ để trang không nháy trắng; `loading` cho biết đang tải.
 * - `enabled = false`: chưa tải (vd. chưa đủ dữ liệu để dựng yêu cầu).
 * - `setData(fn)`: sửa dữ liệu tại chỗ sau một thao tác (vd. cập nhật một dòng của bảng).
 */
export default function useTaiDuLieu(tai, khoa = "", { enabled = true } = {}) {
  const [lanTai, setLanTai] = useState(0);
  const [ketQua, setKetQua] = useState({ khoa: null, data: undefined, error: null });
  const taiRef = useRef(tai);
  useEffect(() => {
    taiRef.current = tai;
  });

  const khoaDayDu = `${khoa}#${lanTai}`;
  useEffect(() => {
    if (!enabled) return undefined;
    let boQua = false;
    Promise.resolve()
      .then(() => taiRef.current())
      .then(
        (data) => {
          if (!boQua) setKetQua({ khoa: khoaDayDu, data, error: null });
        },
        (error) => {
          if (!boQua) setKetQua((cu) => ({ khoa: khoaDayDu, data: cu.data, error }));
        },
      );
    return () => {
      boQua = true;
    };
  }, [khoaDayDu, enabled]);

  const reload = useCallback(() => setLanTai((n) => n + 1), []);
  const setData = useCallback((capNhat) => {
    setKetQua((cu) => ({ ...cu, data: typeof capNhat === "function" ? capNhat(cu.data) : capNhat }));
  }, []);

  const loading = enabled && ketQua.khoa !== khoaDayDu;
  return {
    data: ketQua.data,
    error: loading ? null : ketQua.error,
    loading,
    /** Chưa có dữ liệu lần nào (lần tải đầu) */
    initialLoading: loading && ketQua.data === undefined,
    reload,
    setData,
  };
}
