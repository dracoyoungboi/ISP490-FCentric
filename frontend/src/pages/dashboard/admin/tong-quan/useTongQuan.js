import { useCallback, useEffect, useRef, useState } from "react";
import { dashboardService } from "@/services/dashboardService";
import { ngayMay } from "./kyXem";

/**
 * Tải dữ liệu màn Tổng quan theo kỳ ({ ma, tuNgay, denNgay }) và kho.
 * Khi đổi bộ lọc hoặc bấm "Cập nhật": giữ số cũ trên màn (không nháy khung chờ), chỉ thay khi có số mới.
 * Lỗi khi đã có số cũ: giữ số cũ, báo không cập nhật được và gọi onLoi(số cũ) để màn đưa bộ lọc về đúng số đang hiện
 * (không để đầu trang ghi kho / kỳ mới trên số của kho / kỳ cũ).
 */
export function useTongQuan(kyChon, khoId, onLoi) {
  const [state, setState] = useState({ data: null, status: "loading", refreshing: false, loiCapNhat: false });
  const ctrlRef = useRef(null);
  const dataRef = useRef(null);
  const khoaRef = useRef(null);
  const onLoiRef = useRef(onLoi);
  useEffect(() => {
    onLoiRef.current = onLoi;
  });
  const ma = kyChon.ma;
  const tuNgay = kyChon.ma === "tuy_chon" && kyChon.tuNgay ? ngayMay(kyChon.tuNgay) : undefined;
  const denNgay = kyChon.ma === "tuy_chon" && kyChon.denNgay ? ngayMay(kyChon.denNgay) : undefined;

  const load = useCallback(async (lamMoi = false) => {
    const khoa = [ma, tuNgay, denNgay, khoId].join("|");
    // Bộ lọc vừa được đưa về đúng số đang hiện (sau lỗi): không tải lại, giữ dải báo lỗi. Nút Cập nhật / Thử lại vẫn tải.
    if (!lamMoi && dataRef.current && khoaRef.current === khoa) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setState((s) => ({ ...s, status: s.data ? s.status : "loading", refreshing: true, loiCapNhat: false }));
    try {
      const res = await dashboardService.getTongQuan({ ky: ma, tuNgay, denNgay, khoId, lamMoi }, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      dataRef.current = res.data?.data ?? null;
      khoaRef.current = khoa;
      setState({ data: dataRef.current, status: "ready", refreshing: false, loiCapNhat: false });
    } catch {
      if (ctrl.signal.aborted) return;
      setState((s) => ({ ...s, status: s.data ? "ready" : "error", refreshing: false, loiCapNhat: Boolean(s.data) }));
      if (dataRef.current) onLoiRef.current?.(dataRef.current);
    }
  }, [ma, tuNgay, denNgay, khoId]);

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
