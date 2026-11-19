import test from "node:test";
import assert from "node:assert/strict";
import { xepKho } from "./chonKho.js";

test("xepKho ưu tiên goiYTuSan ngay sau tiêu chí duHang", () => {
  const ds = [
    { khoId: 1, tenKho: "Kho Tổng", duHang: true, goiYTuSan: false, conBanDuoc: 10 },
    { khoId: 2, tenKho: "Kho HCM", duHang: true, goiYTuSan: true, conBanDuoc: 5 },
    { khoId: 3, tenKho: "Kho Cần Thơ", duHang: false, goiYTuSan: true, conBanDuoc: 2 },
  ];
  const sorted = xepKho(ds);
  assert.deepEqual(
    sorted.map((k) => k.khoId),
    [2, 1, 3],
  );
});
