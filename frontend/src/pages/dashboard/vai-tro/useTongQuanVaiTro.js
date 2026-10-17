import { useCallback, useEffect, useRef, useState } from "react";
import { dashboardService } from "@/services/dashboardService";

/** Tự tải lại sau mỗi khoảng này khi trang đang hiện (backend giữ kết quả cùng 60 giây). */
const CHU_KY_MS = 60_000;

/**
 * Tải Tổng quan theo vai trò (GET /api/v1/tong-quan/cua-toi). Kho làm việc đi theo header kho_id của apiClient,
 * nên khi đổi kho trang dựng lại hook này (key = kho).
 * - "Tải lại" và "Thử lại": tính lại ngay (lamMoi). Tự cập nhật mỗi phút khi trang đang hiện.
 * - Khi đã có số: giữ số cũ trên màn trong lúc tải, lỗi thì giữ số cũ và báo không cập nhật được.
 */
export function useTongQuanVaiTro(vaiTro) {
  const [state, setState] = useState({ data: null, status: "loading", refreshing: false, loiCapNhat: false, error: null });
  const ctrlRef = useRef(null);
  /**
   * Yêu cầu đang chạy ({ batDau, lamMoi }) hoặc null. Lần tự cập nhật bỏ qua yêu cầu mới chạy chưa tới một chu kỳ để
   * không hủy lượt "Tải lại" của người dùng; yêu cầu treo quá một chu kỳ thì bị hủy và gửi lại.
   */
  const dangTaiRef = useRef(null);

  const load = useCallback(
    async (lamMoi = false, imLang = false) => {
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      dangTaiRef.current = { batDau: Date.now(), lamMoi };
      // Tự cập nhật thì tải ngầm: không làm mờ trang, không đổi chữ nút "Tải lại"
      if (!imLang) setState((s) => ({ ...s, status: s.data ? s.status : "loading", refreshing: true, loiCapNhat: false }));
      try {
        const res = await dashboardService.getCuaToi({ vaiTro, lamMoi }, { signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        const data = res.data?.data ?? null;
        if (!data) throw new Error("Máy chủ không trả về số liệu tổng quan");
        setState({ data, status: "ready", refreshing: false, loiCapNhat: false, error: null });
      } catch (error) {
        if (ctrl.signal.aborted) return;
        setState((s) => ({ ...s, status: s.data ? "ready" : "error", refreshing: false, loiCapNhat: Boolean(s.data), error }));
      } finally {
        if (ctrlRef.current === ctrl) dangTaiRef.current = null;
      }
    },
    [vaiTro],
  );

  useEffect(() => {
    let active = true;
    // Hoãn qua microtask để không gọi setState đồng bộ trong effect (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      if (active) load();
    });
    const hen = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const dangTai = dangTaiRef.current;
      if (!dangTai) load(false, true);
      else if (Date.now() - dangTai.batDau >= CHU_KY_MS) load(dangTai.lamMoi, true);
    }, CHU_KY_MS);
    return () => {
      active = false;
      window.clearInterval(hen);
      ctrlRef.current?.abort();
    };
  }, [load]);

  const reload = useCallback(() => load(true), [load]);

  return { ...state, reload };
}
