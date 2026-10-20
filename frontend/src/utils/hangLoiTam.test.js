import { test } from "node:test";
import assert from "node:assert/strict";
import { demLuotChuaKhoa, ghiLoDangKiem } from "./hangLoiTam.js";

function boNhoGia() {
  const du = new Map();
  return {
    get length() {
      return du.size;
    },
    key: (i) => [...du.keys()][i] ?? null,
    getItem: (k) => (du.has(k) ? du.get(k) : null),
    setItem: (k, v) => du.set(k, String(v)),
    removeItem: (k) => du.delete(k),
  };
}

test("đếm lượt chưa khóa của mọi lô đang kiểm, bỏ lượt đã hoàn tác và khóa khác", () => {
  globalThis.window = { sessionStorage: boNhoGia() };
  assert.equal(demLuotChuaKhoa(), 0);
  ghiLoDangKiem(102, 93, { log: [{ id: 1 }, { id: 2, huy: true }, { id: 3 }] });
  ghiLoDangKiem(102, 94, { log: [{ id: 1 }] });
  window.sessionStorage.setItem("fcentric:hang-loi:102", JSON.stringify({ log: [{ id: 9 }] }));
  window.sessionStorage.setItem("token", "x");
  assert.equal(demLuotChuaKhoa(), 3);
  ghiLoDangKiem(102, 94, null);
  assert.equal(demLuotChuaKhoa(), 2);
});

test("bộ nhớ phiên bị chặn: trả 0, không ném lỗi", () => {
  globalThis.window = {
    get sessionStorage() {
      throw new Error("SecurityError");
    },
  };
  assert.equal(demLuotChuaKhoa(), 0);
  delete globalThis.window;
});
