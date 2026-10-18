import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tải dữ liệu bằng một hàm trả về Promise, tải lại khi `khoa` đổi hoặc khi gọi `reload()`.
 *
 * - Chỉ nhận kết quả của lần tải mới nhất (đổi bộ lọc liên tiếp không bị kết quả cũ đè lên).
 * - Trong lúc tải lại vẫn giữ `data` cũ để trang không nháy trắng; `loading` cho biết đang tải.
 * - `enabled = false`: chưa tải (vd. chưa đủ dữ liệu để dựng yêu cầu). Bật lại (false → true) là một lần tải mới
 *   như `reload()` dù `khoa` giữ nguyên: `loading` = true, không trả lỗi của lần trước, `data` cũ vẫn giữ.
 * - `setData(fn)`: sửa dữ liệu tại chỗ sau một thao tác (vd. cập nhật một dòng của bảng). Gọi trong lúc đang
 *   tải lại cùng `khoa` (vd. tải ngầm khi quay lại tab, hay `reload()` sau thao tác trước) thì kết quả lần tải đó
 *   bị bỏ — yêu cầu gửi trước thao tác nên có thể cũ hơn dữ liệu vừa sửa — và hook tự tải lại một lần nữa,
 *   nên dữ liệu vừa sửa không bị đè mà lần tải lại cũng không mất. Thao tác cứ chen vào liên tục thì sau
 *   SO_LAN_TAI_LAI_TOI_DA lần hook thôi tải, giữ dữ liệu đang có (không đè thao tác cuối).
 * - `capNhatLuc`: thời điểm (Date) của lần tải thành công gần nhất.
 * - `loiTaiLai`: lần tải gần nhất lỗi nhưng `data` đang giữ vẫn đúng `khoa` hiện tại (lỗi khi tải lại,
 *   không phải khi đổi bộ lọc) — trang có thể giữ bảng cũ thay vì thay bằng ô báo lỗi.
 */
// Khóa của dữ liệu khi chưa tải được lần nào: không trùng với bất kỳ `khoa` nào trang truyền vào (kể cả null)
const CHUA_CO_DU_LIEU = Symbol("chuaCoDuLieu");
// Số lần tự tải lại liên tiếp tối đa vì có setData chen vào; quá số này thì thôi tải (giữ dữ liệu đang có)
const SO_LAN_TAI_LAI_TOI_DA = 3;

export default function useTaiDuLieu(tai, khoa = "", { enabled: batVao = true } = {}) {
  // Ép về boolean: NaN hay object mới mỗi lần render sẽ làm phép so sánh bật/tắt bên dưới không bao giờ dừng
  const enabled = Boolean(batVao);
  const [lanTai, setLanTai] = useState(0);
  const [ketQua, setKetQua] = useState({ khoa: null, khoaDuLieu: CHUA_CO_DU_LIEU, data: undefined, error: null, luc: undefined });
  const taiRef = useRef(tai);
  const ketQuaRef = useRef(ketQua);
  // Số lần trang sửa dữ liệu tại chỗ (setData), để biết có thao tác nào chen vào giữa lúc một lần tải đang chạy
  const lanSuaRef = useRef(0);
  // Số lần đã tự tải lại liên tiếp cho khóa `khoaDemRef`; về 0 khi nhận kết quả, khi đổi khóa, khi tắt và khi reload()
  const lanTaiLaiNoiTiepRef = useRef(0);
  const khoaDemRef = useRef(khoa);
  useEffect(() => {
    taiRef.current = tai;
    ketQuaRef.current = ketQua;
  });

  // Số lần `enabled` chuyển từ false sang true, nằm trong khóa đầy đủ: bật lại cùng `khoa` (vd. đóng rồi mở lại ngăn
  // kéo) là một lần tải mới thay vì tải ngầm với loading = false và lỗi cũ còn hiện. Tăng ngay trong lúc render
  // (React vẽ lại trước khi hiển thị) để không có khung hình nào đã bật mà khóa chưa đổi
  const [bat, setBat] = useState({ enabled, lan: 0 });
  if (bat.enabled !== enabled) setBat({ enabled, lan: enabled ? bat.lan + 1 : bat.lan });

  const khoaDayDu = `${khoa}#${lanTai}#${bat.lan}`;
  useEffect(() => {
    // Lần tự tải lại trước bị hủy giữa chừng (đổi khóa, tắt) thì bộ đếm không kịp về 0: đặt lại ở đây
    if (!enabled || khoaDemRef.current !== khoa) {
      khoaDemRef.current = khoa;
      lanTaiLaiNoiTiepRef.current = 0;
    }
    if (!enabled) return undefined;
    let boQua = false;
    const lanSuaLucDau = lanSuaRef.current;
    Promise.resolve()
      .then(() => taiRef.current())
      .then(
        (data) => {
          if (boQua) return;
          // Tải lại cùng khóa mà trang vừa sửa dữ liệu tại chỗ: bỏ kết quả này (có thể cũ hơn dữ liệu vừa sửa),
          // giữ dữ liệu đang có và gửi một lần tải mới — yêu cầu mới đi sau thao tác nên không còn cũ
          const daSua = lanSuaRef.current !== lanSuaLucDau;
          if (daSua && ketQuaRef.current.khoaDuLieu === khoa) {
            if (lanTaiLaiNoiTiepRef.current < SO_LAN_TAI_LAI_TOI_DA) {
              lanTaiLaiNoiTiepRef.current += 1;
              setLanTai((n) => n + 1);
              return;
            }
            // Đã tự tải lại đủ số lần mà thao tác vẫn chen vào: thôi tải, giữ dữ liệu đang có
            lanTaiLaiNoiTiepRef.current = 0;
            setKetQua((cu) => ({ ...cu, khoa: khoaDayDu, error: null }));
            return;
          }
          lanTaiLaiNoiTiepRef.current = 0;
          setKetQua({ khoa: khoaDayDu, khoaDuLieu: khoa, data, error: null, luc: new Date() });
        },
        (error) => {
          if (boQua) return;
          lanTaiLaiNoiTiepRef.current = 0;
          setKetQua((cu) => ({ ...cu, khoa: khoaDayDu, error }));
        },
      );
    return () => {
      boQua = true;
    };
  }, [khoaDayDu, khoa, enabled]);

  const reload = useCallback(() => {
    lanTaiLaiNoiTiepRef.current = 0;
    setLanTai((n) => n + 1);
  }, []);
  const setData = useCallback((capNhat) => {
    lanSuaRef.current += 1;
    setKetQua((cu) => ({ ...cu, data: typeof capNhat === "function" ? capNhat(cu.data) : capNhat }));
  }, []);

  const loading = enabled && ketQua.khoa !== khoaDayDu;
  return {
    data: ketQua.data,
    error: loading ? null : ketQua.error,
    loading,
    /** Chưa có dữ liệu lần nào (lần tải đầu) */
    initialLoading: loading && ketQua.data === undefined,
    capNhatLuc: ketQua.luc,
    loiTaiLai: !loading && Boolean(ketQua.error) && ketQua.khoaDuLieu === khoa,
    reload,
    setData,
  };
}
