import { useEffect, useRef } from "react";

/** Gửi "ping" giữ kết nối (máy chủ trả "pong"). */
const CHU_KY_PING_MS = 30000;

/**
 * Lắng nghe sự kiện tức thời của một phiếu nhặt qua WebSocket `/ws-outbound?pickListId=` (OutboundWebSocketHandler):
 * đơn bị hủy khi đang nhặt (ORDER_CANCELLED_IN_PICK_LIST), sau khi nhặt xong (ORDER_CANCELLED_IN_PACKING), hủy cả phiếu
 * (PICK_LIST_CANCELLED). Chạy `localhost` thì nối thẳng `localhost:8080` như bản cũ.
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
    const giaoThuc = window.location.protocol === "https:" ? "wss:" : "ws:";
    const may = window.location.hostname === "localhost" ? "localhost:8080" : window.location.host;
    let ws = null;
    let henPing = null;

    try {
      ws = new WebSocket(`${giaoThuc}//${may}/ws-outbound?pickListId=${pickListId}`);
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
    } catch {
      ws = null;
    }

    return () => {
      clearInterval(henPing);
      if (!ws) return;
      ws.onmessage = null;
      // Đang nối dở (rời trang ngay sau khi mở): đợi nối xong rồi đóng, tránh lỗi "closed before established"
      if (ws.readyState === WebSocket.CONNECTING) ws.onopen = () => ws.close();
      else ws.close();
    };
  }, [pickListId]);
}
