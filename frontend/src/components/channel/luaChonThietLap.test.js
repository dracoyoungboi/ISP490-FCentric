// Chạy: node --test src/components/channel/luaChonThietLap.test.js
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  coLuaChonTuDong,
  docLuaChonThietLap,
  ghiLuaChonThietLap,
  viecKhiHoanTat,
  xoaLuaChonThietLap,
} from "./luaChonThietLap.js";

// localStorage giả trong bộ nhớ (node không có window)
const kho = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (kho.has(k) ? kho.get(k) : null),
    setItem: (k, v) => kho.set(k, String(v)),
    removeItem: (k) => kho.delete(k),
  },
};

const LAZADA = { shopIdSan: "2004518320" };
const NGAY = 86_400_000;

beforeEach(() => kho.clear());

test("ghi rồi đọc lại đúng gian hàng; gian hàng khác (kết nối lại shop khác) không thấy lựa chọn", () => {
  assert.equal(ghiLuaChonThietLap("lazada", LAZADA, { tuDongDayTon: true }), true);
  assert.equal(ghiLuaChonThietLap("LAZADA", LAZADA, { layDonCu: 7 }), true);
  const luaChon = docLuaChonThietLap("LAZADA", LAZADA);
  assert.equal(luaChon.tuDongDayTon, true);
  assert.equal(luaChon.layDonCu, 7);
  assert.equal(coLuaChonTuDong(luaChon), true);
  assert.deepEqual(docLuaChonThietLap("LAZADA", { shopIdSan: "999" }), {});
  assert.equal(coLuaChonTuDong(docLuaChonThietLap("TIKTOK", LAZADA)), false);
});

test("lựa chọn quá 14 ngày thì bỏ; xóa thì hết", () => {
  ghiLuaChonThietLap("LAZADA", LAZADA, { tuDongLayDon: true });
  assert.deepEqual(docLuaChonThietLap("LAZADA", LAZADA, Date.now() + 15 * NGAY), {});
  assert.equal(docLuaChonThietLap("LAZADA", LAZADA, Date.now() + 13 * NGAY).tuDongLayDon, true);
  xoaLuaChonThietLap("lazada");
  assert.deepEqual(docLuaChonThietLap("LAZADA", LAZADA), {});
});

test("Hoàn tất chỉ bật công tắc máy chủ còn đang tắt (giá trị tạm của Thiết lập)", () => {
  const luaChon = { tuDongDayTon: true, tuDongLayDon: true, layDonCu: 30 };
  assert.deepEqual(viecKhiHoanTat(luaChon, { tuDongDayTon: false, tuDongLayDon: false }), {
    batTuDong: { tuDongDayTon: true, tuDongLayDon: true },
    soNgayDonCu: 30,
    viec: ["bật tự động cập nhật tồn", "bật tự động lấy đơn", "lấy đơn 30 ngày qua"],
  });
  // Đã bật ở nơi khác: không gửi lại; người dùng chọn tắt: không bật
  assert.deepEqual(viecKhiHoanTat({ tuDongDayTon: true, tuDongLayDon: false }, { tuDongDayTon: true, tuDongLayDon: false }), {
    batTuDong: {},
    soNgayDonCu: 0,
    viec: [],
  });
  assert.deepEqual(viecKhiHoanTat({}, null).viec, []);
});

test("trình duyệt chặn lưu: ghi trả false, đọc trả rỗng", () => {
  const goc = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: () => {
        throw new Error("chặn");
      },
      setItem: () => {
        throw new Error("chặn");
      },
      removeItem: () => {
        throw new Error("chặn");
      },
    },
  };
  try {
    assert.equal(ghiLuaChonThietLap("LAZADA", LAZADA, { tuDongDayTon: true }), false);
    assert.deepEqual(docLuaChonThietLap("LAZADA", LAZADA), {});
    assert.doesNotThrow(() => xoaLuaChonThietLap("LAZADA"));
  } finally {
    globalThis.window = goc;
  }
});
