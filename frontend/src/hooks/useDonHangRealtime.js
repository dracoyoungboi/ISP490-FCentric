import { useEffect, useRef } from "react";
import { API_BASE_URL } from "@/config/apiBase";
import { docSuKienDonHang } from "@/services/docSuKienDonHang";

export default function useDonHangRealtime(onChange, { bat = true } = {}) {
  const callback = useRef(onChange);
  useEffect(() => { callback.current = onChange; }, [onChange]);
  useEffect(() => {
    if (!bat) return;
    const controller = new AbortController();
    let timer;
    let wake;
    let running = false;
    let pending = false;
    const refresh = async () => {
      pending = true;
      if (running) return;
      running = true;
      try {
        while (pending && !controller.signal.aborted) {
          pending = false;
          await callback.current();
        }
      } catch { /* The page retains its existing error/retry handling. */ }
      finally { running = false; }
    };
    const listen = async () => {
      let failures = 0;
      while (!controller.signal.aborted) {
        const token = localStorage.getItem("access_token");
        if (!token) return;
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/don-ban-hang/su-kien`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
            signal: controller.signal,
          });
          if (response.status === 401 || response.status === 403) return;
          if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new Error("Event stream unavailable");
          failures = 0;
          await docSuKienDonHang(response.body, refresh, controller.signal);
        } catch { if (controller.signal.aborted) return; failures++; }
        if (controller.signal.aborted) return;
        await new Promise((resolve) => { wake = resolve; timer = setTimeout(resolve, Math.min(15000, 1000 * 2 ** Math.min(failures, 4))); });
      }
    };
    listen();
    return () => { controller.abort(); clearTimeout(timer); wake?.(); };
  }, [bat]);
}
