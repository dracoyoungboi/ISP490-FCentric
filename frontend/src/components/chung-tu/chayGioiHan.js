/*
 * Chạy nhiều việc bất đồng bộ với số việc cùng lúc có giới hạn (rà soát 21/10/2026, N7: tải lô từng dòng của phiếu xuất,
 * lô kế thừa của phiếu nhập… không bắn hàng trăm lời gọi cùng lúc). Thuần, chạy được bằng `node --test`.
 */
import { SO_VIEC_DONG_THOI } from "../../config/bangChungTu.js";

/**
 * Chạy `viec[i]()` (trả Promise) với tối đa `gioiHan` việc cùng lúc (mặc định SO_VIEC_DONG_THOI), giữ thứ tự kết quả.
 * Một việc lỗi không dừng các việc khác. `khiXong(i, kq)` gọi ngay khi từng việc xong (để hiện dần).
 * @returns {Promise<{ ok: boolean, giaTri?: any, loi?: any }[]>}
 */
export async function chayGioiHan(viec, gioiHan = SO_VIEC_DONG_THOI, khiXong) {
  const ds = Array.isArray(viec) ? viec : [];
  const kq = new Array(ds.length);
  let tiep = 0;
  const luong = async () => {
    while (tiep < ds.length) {
      const i = tiep;
      tiep += 1;
      try {
        kq[i] = { ok: true, giaTri: await ds[i]() };
      } catch (loi) {
        kq[i] = { ok: false, loi };
      }
      khiXong?.(i, kq[i]);
    }
  };
  const soLuong = Math.min(Math.max(1, Math.floor(Number(gioiHan)) || 1), ds.length);
  await Promise.all(Array.from({ length: soLuong }, luong));
  return kq;
}
