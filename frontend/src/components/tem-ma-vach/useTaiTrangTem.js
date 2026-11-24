import { useCallback, useRef, useState } from "react";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { productService } from "@/services/productService";

/** Kết quả tải trước (rê chuột lên tab) còn dùng thẳng, không gọi lại máy chủ, trong khoảng này. */
const MOI_TAI_MS = 15000;

const khoaCua = ({ tab, tuKhoa, page, size }) => `${tab}|${tuKhoa}|${page}|${size}`;

/**
 * Tải danh sách màn "Tem mã vạch" cho mượt khi đổi tab / đổi trang:
 * - Nhớ kết quả từng (tab, từ khóa, trang, cỡ trang) trong lần mở màn: quay lại tab đã xem là thấy ngay (`data` lấy từ
 *   bộ nhớ), đồng thời tải lại ngầm để có số mới.
 * - Số đếm 4 tab chỉ phụ thuộc từ khóa: chỉ xin máy chủ đếm khi đổi từ khóa hoặc `reload()`; đổi tab / trang thì giữ số
 *   đang có (không xóa rồi vẽ lại).
 * - `taiTruoc(tab)`: tải trước trang đầu của một tab (gọi khi trỏ chuột dừng trên tab) để lúc bấm đã có dữ liệu.
 * Trả `{ data, dem, dangTaiMoi, loading, error, loiTaiLai, dungKhoa, initialLoading, capNhatLuc, reload, taiTruoc }`;
 * `dangTaiMoi`: đang tải một trang chưa từng xem (trang làm mờ bảng cũ và chạy vạch tải).
 */
export default function useTaiTrangTem({ tab, tuKhoa, page, size }) {
  // khóa → { data, luc }: ref cho lúc tải (effect / sự kiện), state cho lúc dựng giao diện
  const nhoRef = useRef(new Map());
  const [nho, setNho] = useState(() => new Map());
  const dangGoiRef = useRef(new Map()); // khóa → Promise đang chờ (tải trước)
  const demRef = useRef({ tuKhoa: null }); // từ khóa của số đếm đang giữ
  const epDemRef = useRef(false);
  const [dem, setDem] = useState({ tuKhoa: null, data: null });

  const goi = useCallback((thamSo, kemDem) => {
    const khoa = khoaCua(thamSo);
    const p = productService
      .locGiaBan({ page: thamSo.page, size: thamSo.size, tuKhoa: thamSo.tuKhoa, trangThai: thamSo.tab, kemDem })
      .then((res) => {
        const muc = { data: res, luc: Date.now() };
        nhoRef.current.set(khoa, muc);
        setNho((cu) => new Map(cu).set(khoa, muc));
        if (res?.demTheoTab) {
          demRef.current = { tuKhoa: thamSo.tuKhoa };
          setDem({ tuKhoa: thamSo.tuKhoa, data: res.demTheoTab });
        }
        return res;
      })
      .finally(() => {
        if (dangGoiRef.current.get(khoa) === p) dangGoiRef.current.delete(khoa);
      });
    dangGoiRef.current.set(khoa, p);
    return p;
  }, []);

  const thamSo = { tab, tuKhoa, page, size };
  const khoa = khoaCua(thamSo);
  const ds = useTaiDuLieu(() => {
    const dangGoi = dangGoiRef.current.get(khoa);
    if (dangGoi) return dangGoi;
    const daNho = nhoRef.current.get(khoa);
    const canDem = epDemRef.current || demRef.current.tuKhoa !== tuKhoa;
    epDemRef.current = false;
    // Vừa tải trước xong (rê chuột rồi bấm): dùng luôn, khỏi gọi lại máy chủ
    if (daNho && !canDem && Date.now() - daNho.luc < MOI_TAI_MS) return Promise.resolve(daNho.data);
    return goi(thamSo, canDem);
  }, khoa);

  const daNho = nho.get(khoa);
  const data = ds.dungKhoa ? ds.data : (daNho?.data ?? ds.data);

  /** Tải lại (dữ liệu vừa đổi: sửa giá, quay lại tab): bỏ trang đã nhớ của các tab khác, đếm lại số trên tab. */
  const reload = useCallback(() => {
    epDemRef.current = true;
    nhoRef.current = new Map();
    setNho(new Map());
    ds.reload();
  }, [ds]);

  const taiTruoc = useCallback(
    (tabMoi) => {
      const ts = { tab: tabMoi, tuKhoa, page: 0, size };
      const k = khoaCua(ts);
      if (k === khoa || nhoRef.current.has(k) || dangGoiRef.current.has(k)) return;
      goi(ts, false).catch(() => {});
    },
    [goi, khoa, tuKhoa, size],
  );

  return {
    data,
    dem: dem.tuKhoa === tuKhoa ? dem.data : null,
    dangTaiMoi: ds.loading && !ds.dungKhoa && !daNho,
    loading: ds.loading,
    error: ds.error,
    loiTaiLai: ds.loiTaiLai,
    dungKhoa: ds.dungKhoa || Boolean(daNho),
    initialLoading: ds.initialLoading,
    capNhatLuc: ds.capNhatLuc,
    reload,
    taiTruoc,
  };
}
