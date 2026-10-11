import { useCallback, useEffect, useRef, useState } from "react";
import { dashboardService } from "@/services/dashboardService";

/**
 * Tải dữ liệu màn Tổng quan theo kỳ và kho.
 * Khi đổi bộ lọc hoặc bấm "Cập nhật": giữ số cũ trên màn (không nháy khung chờ), chỉ thay khi có số mới.
 * Lỗi khi đã có số cũ: giữ số cũ và báo không cập nhật được.
 */
export function useTongQuan(ky, khoId) {
  const [state, setState] = useState({ data: null, status: "loading", refreshing: false, loiCapNhat: false });
  const ctrlRef = useRef(null);

  const load = useCallback(async (lamMoi = false) => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setState((s) => ({ ...s, status: s.data ? s.status : "loading", refreshing: true, loiCapNhat: false }));
    try {
      const res = await dashboardService.getTongQuan({ ky, khoId, lamMoi }, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setState({ data: res.data?.data ?? null, status: "ready", refreshing: false, loiCapNhat: false });
    } catch {
      if (ctrl.signal.aborted) return;
      setState((s) => ({ ...s, status: s.data ? "ready" : "error", refreshing: false, loiCapNhat: Boolean(s.data) }));
    }
  }, [ky, khoId]);

  useEffect(() => {
    let active = true;
    // Hoãn qua microtask để không gọi setState đồng bộ trong effect (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      if (active) load();
    });
    return () => {
      active = false;
      ctrlRef.current?.abort();
    };
  }, [load]);

  /** Nút "Cập nhật" và "Thử lại": luôn lấy số liệu mới nhất. */
  const reload = useCallback(() => load(true), [load]);

  return { ...state, reload };
}
