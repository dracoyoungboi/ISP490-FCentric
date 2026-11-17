/** Parse SSE incrementally. Only invalidations are delivered; no order/customer payload is trusted here. */
export async function docSuKienDonHang(body, onChange, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
      let end;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const event = frame.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
        if (event === "ready" || event === "orders-changed") onChange();
      }
      if (buffer.length > 65536) throw new Error("Invalid event stream");
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
