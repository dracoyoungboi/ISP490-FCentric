// Chạy: node --test src/components/channel/noiDungSan.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { khoMacDinhSan, noiDungSan } from "./noiDungSan.js";

test("khoMacDinhSan: chon kho mac dinh tu san va du phong kho hop le dau tien", () => {
  const ds = [
    { maKhoSan: "VN34-WH-1", tenKhoSan: "Kho 1", macDinh: false },
    { maKhoSan: "dropshipping", tenKhoSan: "FCentric", macDinh: true },
  ];
  assert.deepEqual(khoMacDinhSan(ds), ds[1]);
  assert.deepEqual(khoMacDinhSan([{ maKhoSan: "A", macDinh: false }]), { maKhoSan: "A", macDinh: false });
  assert.equal(khoMacDinhSan([]), null);
  assert.equal(khoMacDinhSan(null), null);
});

test("noiDungSan: cac san tru Shopify deu chi doc theo kho mac dinh cua san, khong cho chon thu cong", () => {
  for (const maKenh of ["LAZADA", "SHOPEE", "SHOPEE_OFFICIAL", "TIKTOK"]) {
    const nd = noiDungSan(maKenh);
    assert.ok(nd, `Thiếu nội dung cho ${maKenh}`);
    assert.equal(nd.khoSan.moTa.includes("Tải lại từ sàn"), true, `${maKenh} phải hướng dẫn dùng nút Tải lại từ sàn`);
    assert.equal(nd.khoSan.moTa.startsWith("Chọn kho"), false, `${maKenh} không còn câu cho chọn kho`);
    assert.equal(nd.khoSan.moTa.startsWith("Chọn địa chỉ"), false, `${maKenh} không còn câu cho chọn địa chỉ`);
  }
  assert.equal(noiDungSan("SHOPIFY"), null);
  assert.equal(noiDungSan("SHOPEE_SANDBOX"), null);
  assert.equal(noiDungSan("LAZADA_SANDBOX"), null);
});
