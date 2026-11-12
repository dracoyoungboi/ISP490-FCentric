import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getMineKhoList } from '@/services/khoService';
import { donBanHangService } from '@/services/donBanHangService';
import { currentUserKey, toPosCustomer } from '@/services/posService';
import { laKhoBanTaiQuay } from '@/utils/kho';
import usePosTabLock from './usePosTabLock';

/**
 * Dữ liệu dùng chung của hai màn quầy (Bán hàng /pos và Trả hàng /pos/returns), giữ ở khung PosLayout để đổi chế độ
 * không phải tải lại từ đầu: khung chỉ gỡ khi rời hẳn POS (về quản trị, đăng xuất), lúc đó mọi thứ dưới đây mất theo.
 */
export const PosDuLieuChungContext = createContext(null);

/** Bộ nhớ tạm tối đa chừng này mục (mỗi tổ hợp kho / từ khóa / bộ lọc / trang danh mục là một mục). */
const BO_NHO_TOI_DA = 40;

const giongNhau = (a, b) => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

/**
 * Một nguồn dữ liệu tải một lần cho cả khung. {@code tai()}: chưa có thì tải (màn hiện vòng chờ), có rồi thì làm mới
 * ngầm — lỗi lúc làm mới ngầm thì giữ dữ liệu cũ; dữ liệu mới giống hệt thì giữ nguyên tham chiếu để màn không dựng lại.
 * Lần trước lỗi (chưa có dữ liệu) thì xóa lỗi để màn hiện vòng chờ trong lúc thử lại, không để màn lỗi đứng đó.
 */
function useNguonChung(nap) {
  const [trang, setTrang] = useState({ ds: null, loi: null });
  const dangTai = useRef(null);
  const napRef = useRef(nap);

  const tai = useCallback(() => {
    if (dangTai.current) return dangTai.current;
    setTrang((cu) => (cu.loi ? { ds: null, loi: null } : cu));
    const luot = napRef.current()
      .then(
        (ds) => setTrang((cu) => (cu.ds && giongNhau(cu.ds, ds) ? cu : { ds, loi: null })),
        (loi) => setTrang((cu) => (cu.ds ? cu : { ds: null, loi })),
      )
      .finally(() => { dangTai.current = null; });
    dangTai.current = luot;
    return luot;
  }, []);

  return useMemo(() => ({ ...trang, tai, thuLai: tai }), [trang, tai]);
}

const napKho = () => getMineKhoList().then((ds) => (ds ?? []).filter(laKhoBanTaiQuay));
const napKhach = () => donBanHangService.getCustomersForCreate()
  .then((res) => (res?.data?.data ?? []).map(toPosCustomer));

/** Dựng giá trị cho PosDuLieuChungContext — chỉ PosLayout gọi. */
export function useTaoPosDuLieuChung() {
  // Kho bán tại quầy (kho tổng, kho ảo, kho ngừng hoạt động không bán tại quầy) — cả hai màn dùng
  const kho = useNguonChung(napKho);
  // Khách cho ô chọn khách — chỉ màn bán dùng, tải khi màn bán mở lần đầu
  const khach = useNguonChung(napKhach);

  // Khóa "một tab POS mỗi tài khoản": chỉ bắt đầu giữ khi màn bán mở lần đầu (màn trả hàng không ghi nháp nên
  // không giữ), rồi giữ suốt lúc còn ở POS để quay lại màn bán không phải xin lại khóa.
  const [userKey] = useState(currentUserKey);
  const [canKhoa, setCanKhoa] = useState(false);
  const [lanXin, setLanXin] = useState(0);
  const khoaTab = usePosTabLock(userKey, canKhoa, lanXin);
  const trangThaiKhoaRef = useRef(khoaTab.status);
  useEffect(() => {
    trangThaiKhoaRef.current = khoaTab.status;
  });
  const batDauKhoa = useCallback(() => {
    setCanKhoa(true);
    // Lần trước bị chặn vì tab khác đang giữ POS: mở lại màn bán thì xin lại (tab kia có thể đã đóng)
    if (trangThaiKhoaRef.current === 'blocked') setLanXin((n) => n + 1);
  }, []);

  // Bộ nhớ tạm cho danh mục hàng, danh sách hóa đơn còn hạn…: quay lại màn hiện ngay bản cũ rồi làm mới ngầm
  const boNhoRef = useRef(new Map());
  const boNho = useMemo(() => ({
    lay: (khoa) => boNhoRef.current.get(khoa),
    ghi: (khoa, giaTri) => {
      const map = boNhoRef.current;
      map.delete(khoa);
      map.set(khoa, giaTri);
      if (map.size > BO_NHO_TOI_DA) map.delete(map.keys().next().value);
    },
    /** Bỏ mọi mục có khóa bắt đầu bằng {@code tienTo} (vd. sau thanh toán / trả hàng: tồn đã đổi). */
    xoaTheo: (tienTo) => {
      const map = boNhoRef.current;
      [...map.keys()].filter((khoa) => khoa.startsWith(tienTo)).forEach((khoa) => map.delete(khoa));
    },
  }), []);

  return useMemo(
    () => ({ kho, khach, khoaTab: { ...khoaTab, batDau: batDauKhoa }, boNho }),
    [kho, khach, khoaTab, batDauKhoa, boNho],
  );
}

const BO_NHO_RONG = { lay: () => undefined, ghi: () => {}, xoaTheo: () => {} };

/** Dữ liệu chung của khung POS; ngoài khung (thử riêng một màn) thì bộ nhớ tạm không nhớ gì. */
export function usePosDuLieuChung() {
  return useContext(PosDuLieuChungContext) ?? { boNho: BO_NHO_RONG };
}
