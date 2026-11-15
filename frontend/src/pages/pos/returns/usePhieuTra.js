import { useEffect, useState } from 'react';
import { traHangService } from '@/services/traHangService';
import { getApiErrorMessage } from '@/utils/apiError';
import { t } from "@/i18n";

/**
 * Tải biên bản một phiếu trả (GET /api/v1/pos/returns/{id}). {@code banDau}: dữ liệu đã có sẵn (vừa tìm theo mã RET)
 * thì hiện ngay, không gọi lại.
 */
export function usePhieuTra(id, banDau = null) {
  const [kq, setKq] = useState({ id: null, phieu: null, loi: null });
  const [lanTai, setLanTai] = useState(0);
  const coSan = banDau && banDau.id === id;
  useEffect(() => {
    if (!id || coSan) return undefined;
    const ctrl = new AbortController();
    traHangService.phieu(id, { signal: ctrl.signal })
      .then((p) => setKq({ id, phieu: p, loi: null }))
      .catch((err) => {
        if (!ctrl.signal.aborted) setKq({ id, phieu: null, loi: getApiErrorMessage(err, t("Không tải được phiếu trả.")) });
      });
    return () => ctrl.abort();
  }, [id, coSan, lanTai]);
  if (coSan) return { phieu: banDau, loi: null, dangTai: false, thuLai: () => {} };
  const dungPhieu = kq.id === id;
  return {
    phieu: dungPhieu ? kq.phieu : null,
    loi: dungPhieu ? kq.loi : null,
    dangTai: !dungPhieu,
    thuLai: () => { setKq({ id: null, phieu: null, loi: null }); setLanTai((n) => n + 1); },
  };
}
