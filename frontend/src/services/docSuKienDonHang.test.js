import test from "node:test";
import assert from "node:assert/strict";
import { docSuKienDonHang } from "./docSuKienDonHang.js";

test("SSE: arbitrary chunk boundaries, CRLF, heartbeats and ready recovery", async () => {
  const chunks = ["event: re", "ady\r", "\ndata: refresh\r\n\r", "\nevent: heartbeat\ndata: refresh\n\nevent: orders-", "changed\ndata: refresh\n\n"];
  const stream = new ReadableStream({ start(controller) {
    chunks.forEach((chunk) => controller.enqueue(new TextEncoder().encode(chunk)));
    controller.close();
  } });
  let refreshes = 0;
  await docSuKienDonHang(stream, () => refreshes++);
  assert.equal(refreshes, 2);
});

test("SSE: unknown events do not refresh and a partial frame is not trusted", async () => {
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode("event: admin-data\ndata: untrusted\n\nevent: orders-changed\n"));
    controller.close();
  } });
  let refreshes = 0;
  await docSuKienDonHang(stream, () => refreshes++);
  assert.equal(refreshes, 0);
});
