import { useEffect, useRef } from "react";
import { moKenhRealtime } from "@/services/realtimeService";

/** Gửi "ping" giữ kết nối (máy chủ trả "pong"). */
const CHU_KY_PING_MS = 30000;

/**
 * Lắng nghe sự kiện tức thời của một phiếu nhặt qua WebSocket `/ws-outbound` (OutboundWebSocketHandler), mở bằng vé
 * xin cho đúng phiếu này: đơn bị hủy khi đang nhặt (ORDER_CANCELLED_IN_PICK_LIST), sau khi nhặt xong
 * (ORDER_CANCELLED_IN_PACKING), hủy cả phiếu (PICK_LIST_CANCELLED).
 *
 * `xuLy(eventType, data)` luôn là bản mới nhất (không mở lại kết nối khi trang vẽ lại). Tin không phải JSON và "pong"
 * bị bỏ qua. Trình duyệt chặn WebSocket thì màn vẫn chạy, chỉ không nhận cảnh báo tức thời.
 */
export default function useSuKienPhieuNhat(pickListId, xuLy) {
  const xuLyRef = useRef(xuLy);

  useEffect(() => {
    xuLyRef.current = xuLy;
  });

  useEffect(() => {
    if (!pickListId) return undefined;
    let ws = null;
    let henPing = null;
    let daDung = false;

    moKenhRealtime(`/api/v1/realtime/ve/phieu-nhat/${pickListId}`, "/ws-outbound").then((ketNoi) => {
      if (!ketNoi) return;
      // Rời trang trong lúc đang xin vé: đóng ngay khi nối xong
      if (daDung) {
        ketNoi.onopen = () => ketNoi.close();
        return;
      }
      ws = ketNoi;
      ws.onopen = () => {
        henPing = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, CHU_KY_PING_MS);
      };
      ws.onmessage = (suKien) => {
        if (suKien.data === "pong") return;
        let goi;
        try {
          goi = JSON.parse(suKien.data);
        } catch {
          return;
        }
        if (goi?.eventType) xuLyRef.current?.(goi.eventType, goi.data || {});
      };
      ws.onclose = () => clearInterval(henPing);
    });

    return () => {
      daDung = true;
      clearInterval(henPing);
      if (!ws) return;
      ws.onmessage = null;
      // Đang nối dở (rời trang ngay sau khi mở): đợi nối xong rồi đóng, tránh lỗi "closed before established"
      if (ws.readyState === WebSocket.CONNECTING) ws.onopen = () => ws.close();
      else ws.close();
    };
  }, [pickListId]);
}
