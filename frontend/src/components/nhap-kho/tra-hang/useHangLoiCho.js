import { useEffect, useState } from "react";
import { bienBanTraHangService } from "@/services/bienBanTraHangService";
import { viecKho } from "./traHangUtils";

/*
 * Việc hàng lỗi còn treo, lấy từ danh sách biên bản trả hàng (máy chủ đã lọc theo kho người dùng được xem). Thay cho
 * màn Trả hàng nhà cung cấp riêng: màn Đơn mua hàng và Phiếu nhập kho hiện dòng chú ý + lọc theo các mã này (bộ lọc
 * `id IN` sẵn có của API danh sách).
 * - donChoChot: đơn mua có biên bản đã nhập kho mà nhà cung cấp chưa chọn giao bù / trừ tiền (mua hàng theo dõi, nhắc).
 * - phieuChoGiaoTra: phiếu nhập đã nhập kho còn hàng lỗi ở kho mà nhà cung cấp đã chọn nhận lại / tiêu hủy (kho làm).
 * `bat = false` (vai trò không xử lý việc này): không gọi máy chủ. Lỗi tải thì coi như không có việc (không chặn màn).
 */
const RONG = { donChoChot: [], phieuChoGiaoTra: [] };

export default function useHangLoiCho(bat = true) {
  const [kq, setKq] = useState(RONG);
  useEffect(() => {
    if (!bat) return undefined;
    const ctrl = new AbortController();
    bienBanTraHangService
      .danhSach({}, ctrl.signal)
      .then((d) => {
        const ds = (Array.isArray(d?.items) ? d.items : []).filter((bb) => bb.trangThai !== "DA_HUY" && bb.phieuDaNhap);
        const khac = (mang) => [...new Set(mang.filter((id) => id != null))];
        setKq({
          donChoChot: khac(ds.filter((bb) => bb.choNccChonCachBu).map((bb) => bb.donMuaHangId)),
          phieuChoGiaoTra: khac(ds.filter((bb) => viecKho(bb)).map((bb) => bb.phieuNhapKhoId)),
        });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setKq(RONG);
      });
    return () => ctrl.abort();
  }, [bat]);
  return kq;
}
