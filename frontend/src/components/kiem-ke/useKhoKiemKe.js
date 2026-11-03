import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { getKhoList } from "@/services/khoService";
import { laKhoGiaoDich } from "@/utils/kho";
import { dsKhoLamViecTrongToken, getKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";

/**
 * Kho đang xem của Sơ đồ khóa / Hàng chưa có kệ: `?khoId=` trên URL (liên kết từ đợt kiểm kê), không có thì kho làm việc,
 * rồi kho đầu tiên. Quản trị viên chọn được mọi kho giao dịch; người khác chỉ kho được phân.
 */
export default function useKhoKiemKe() {
  const [params, setParams] = useSearchParams();
  const laQtv = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const tai = useCallback(async () => (laQtv ? (await getKhoList()).filter(laKhoGiaoDich) : dsKhoLamViecTrongToken()), [laQtv]);
  const q = useTaiDuLieu(tai, "kho-kiem-ke");
  const dsKho = useMemo(() => q.data ?? [], [q.data]);
  const tuUrl = Number(params.get("khoId"));
  const khoId =
    dsKho.find((k) => Number(k.id) === tuUrl)?.id ??
    dsKho.find((k) => Number(k.id) === getKhoLamViecId())?.id ??
    dsKho[0]?.id ??
    null;
  const doiKho = (id) =>
    setParams(
      (cu) => {
        const moi = new URLSearchParams(cu);
        moi.set("khoId", String(id));
        return moi;
      },
      { replace: true },
    );
  return { dsKho, khoId: khoId == null ? null : Number(khoId), doiKho, dangTai: q.loading && q.data === undefined, loi: q.error, taiLai: q.reload };
}
