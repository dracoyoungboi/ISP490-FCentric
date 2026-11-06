import { useCallback } from "react";
import { moDuocTaiKho } from "@/components/chuyen-kho/lamViecTaiKho";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { demHangChuaCoKe } from "@/services/stockTakeService";
import { hasAnyRole } from "@/utils/roles";
import { VAI_TRO_XEP_KE } from "./soHangChuaCoKe";

/**
 * Hàng của một chứng từ nhập còn chưa có kệ ở kho nhận — dòng nhắc "Xếp kệ" trên phiếu chuyển kho đã nhận, phiếu nhập
 * đã hoàn tất. `kho`: `{ id }` kho nhận; `phieuChuyenId` hoặc `phieuNhapId`: chứng từ cần xem; `bat`: chứng từ đã nhập
 * kho; `phienBan`: đổi khi chứng từ có thêm phiếu nhập (vd. số phiếu nhập của phiếu chuyển) để đếm lại. Chỉ tải khi người
 * xem có vai trò kho và được phân kho đó (quản trị viên mọi kho); quay lại thẻ thì đếm lại; lỗi thì im lặng (không nhắc).
 * Trả `{ soLo, soLuong, duongDan }`; `soLo` 0 khi không có gì cần xếp.
 */
export default function useHangChuaCoKeCuaChungTu({ kho, phieuChuyenId = null, phieuNhapId = null, bat = true, phienBan = "" }) {
  const khoId = kho?.id ?? null;
  const batTai = Boolean(bat) && khoId != null && hasAnyRole(VAI_TRO_XEP_KE) && moDuocTaiKho(kho);
  const tai = useCallback(() => demHangChuaCoKe(khoId, { phieuChuyenId, phieuNhapId }), [khoId, phieuChuyenId, phieuNhapId]);
  const q = useTaiDuLieu(tai, `chua-ke-chung-tu-${khoId}-${phieuChuyenId}-${phieuNhapId}-${phienBan}`, { enabled: batTai });
  useTaiLaiKhiQuayLai(() => q.reload(), { bat: batTai && !q.loading, lanCuoi: q.capNhatLuc });

  const dem = batTai && !q.error && q.dungKhoa ? q.data : null;
  const loc = phieuChuyenId != null ? `phieuChuyen=${phieuChuyenId}` : `phieuNhap=${phieuNhapId}`;
  return {
    soLo: Number(dem?.soLo) || 0,
    soLuong: Number(dem?.soLuong) || 0,
    duongDan: `/warehouse/unshelved?khoId=${khoId}&${loc}`,
  };
}
