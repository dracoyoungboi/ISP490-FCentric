import { useCallback, useEffect, useState } from 'react';
import { posService } from '@/services/posService';

const KHONG_KIEM_KE = { dangKiemKe: false, toanKho: false, dots: [] };
// Đợt kiểm kê bắt đầu / kết thúc ở màn khác: hỏi lại định kỳ (cùng nhịp tải ngầm danh mục) và khi quay lại tab
const CHU_KY_MS = 30000;

/**
 * Kho đang bán có đợt kiểm kê đang giữ khóa không (dải báo ở quầy, chặn thanh toán khi kiểm toàn kho).
 * Tải lại khi đổi kho, khi `taiLai` đổi (sau thanh toán / máy chủ báo thiếu hàng), mỗi 30 giây, khi quay lại tab và
 * khi gọi `lamMoi()` (lúc mở thanh toán: đợt vừa bắt đầu thì câu chặn nói đúng "đang kiểm kê", không nói "vượt tồn").
 * Lỗi mạng: giữ kết quả cũ — máy chủ vẫn chặn đúng lúc thanh toán.
 */
export function useKiemKeKho(khoId, taiLai) {
  // Kết quả gắn với kho đã hỏi: đổi kho thì bỏ ngay kết quả của kho cũ; tải lại cùng kho thì giữ (không nhấp nháy)
  const [ketQua, setKetQua] = useState({ khoId: null, ...KHONG_KIEM_KE });
  const [lan, setLan] = useState(0);
  const lamMoi = useCallback(() => setLan((x) => x + 1), []);

  useEffect(() => {
    if (!khoId) return undefined;
    let controller = null;
    const hoi = () => {
      if (controller || document.visibilityState !== 'visible') return;
      const current = new AbortController();
      controller = current;
      posService.getKiemKe(khoId, { signal: current.signal })
        .then((data) => {
          if (!current.signal.aborted && data) {
            const moi = {
              khoId,
              dangKiemKe: Boolean(data.dangKiemKe),
              toanKho: Boolean(data.toanKho),
              dots: Array.isArray(data.dots) ? data.dots : [],
            };
            // Không đổi gì thì giữ object cũ: trang POS không vẽ lại mỗi phút
            setKetQua((cu) => (JSON.stringify(cu) === JSON.stringify(moi) ? cu : moi));
          }
        })
        .catch(() => {})
        .finally(() => {
          if (controller === current) controller = null;
        });
    };
    hoi();
    const timer = window.setInterval(hoi, CHU_KY_MS);
    document.addEventListener('visibilitychange', hoi);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', hoi);
      controller?.abort();
    };
  }, [khoId, taiLai, lan]);

  return { ...(ketQua.khoId === khoId && khoId ? ketQua : KHONG_KIEM_KE), lamMoi };
}
