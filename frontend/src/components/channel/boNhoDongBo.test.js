import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { docBoNho, ghiBoNho, ngheBoNho, trangThaiDau, xoaBoNho } from "./boNhoDongBo.js";

const dangChay = { maPhien: "p1", trangThai: "dang_chay", giaiDoan: "day_ton" };
const daXong = { maPhien: "p1", trangThai: "xong", giaiDoan: "lay_don" };

beforeEach(() => xoaBoNho());

test("kênh chưa có gì: mục rỗng, trang mới không theo dõi đợt nào", () => {
  const muc = docBoNho("SHOPIFY");
  assert.deepEqual(muc, { phien: null, theoDoi: null, daXem: null });
  assert.deepEqual(trangThaiDau(muc), { phien: null, maTheoDoi: null, daXem: null, daThayChay: [], daBaoXong: [] });
});

test("ghi một phần giữ phần còn lại; mã kênh không phân biệt hoa thường, bỏ khoảng trắng", () => {
  ghiBoNho("shopify", { phien: dangChay });
  ghiBoNho(" SHOPIFY ", { theoDoi: "p1" });
  assert.deepEqual(docBoNho("Shopify"), { phien: dangChay, theoDoi: "p1", daXem: null });
  assert.deepEqual(docBoNho("LAZADA"), { phien: null, theoDoi: null, daXem: null });
});

test("mục rỗng trả về không bị sửa khi ghi kênh khác", () => {
  const rong = docBoNho("A");
  ghiBoNho("B", { daXem: "x" });
  assert.equal(rong.daXem, null);
  assert.equal(docBoNho("A").daXem, null);
});

test("đợt đang chạy: trang mới theo dõi luôn và sẽ báo khi xong", () => {
  const dau = trangThaiDau({ phien: dangChay, theoDoi: null, daXem: null });
  assert.equal(dau.phien, dangChay);
  assert.equal(dau.maTheoDoi, "p1");
  assert.deepEqual(dau.daThayChay, ["p1"]);
  assert.deepEqual(dau.daBaoXong, []);
});

test("đợt đã xong mà trang trước theo dõi: vẫn là của trang này (hiện kết quả) nhưng không báo xong lần nữa", () => {
  const dau = trangThaiDau({ phien: daXong, theoDoi: "p1", daXem: null });
  assert.equal(dau.maTheoDoi, "p1");
  assert.deepEqual(dau.daThayChay, ["p1"]);
  assert.deepEqual(dau.daBaoXong, ["p1"]);
});

test("đợt cũ không ai theo dõi (có từ trước khi mở trang): chỉ giữ ảnh chụp", () => {
  const dau = trangThaiDau({ phien: daXong, theoDoi: "p0", daXem: null });
  assert.equal(dau.phien, daXong);
  assert.equal(dau.maTheoDoi, null);
  assert.deepEqual(dau.daThayChay, []);
  assert.deepEqual(dau.daBaoXong, []);
});

test("đã xem kết quả ở trang trước thì trang mới nhớ là đã xem", () => {
  const dau = trangThaiDau({ phien: daXong, theoDoi: "p1", daXem: "p1" });
  assert.equal(dau.daXem, "p1");
});

test("ảnh chụp thiếu mã đợt: coi như chưa có đợt", () => {
  const dau = trangThaiDau({ phien: { trangThai: "dang_chay" }, theoDoi: null, daXem: null });
  assert.equal(dau.maTheoDoi, null);
  assert.deepEqual(dau.daThayChay, []);
});

test("mục null / undefined không lỗi", () => {
  assert.deepEqual(trangThaiDau(undefined), { phien: null, maTheoDoi: null, daXem: null, daThayChay: [], daBaoXong: [] });
  assert.deepEqual(trangThaiDau(null), { phien: null, maTheoDoi: null, daXem: null, daThayChay: [], daBaoXong: [] });
});

test("trang đang nghe nhận mỗi lần ghi của đúng kênh; thôi nghe thì không nhận nữa", () => {
  const nhan = [];
  const thoi = ngheBoNho("shopify@1", (muc) => nhan.push(muc));
  ghiBoNho("SHOPIFY@1", { phien: dangChay });
  ghiBoNho("SHOPIFY@2", { phien: daXong });
  ghiBoNho("SHOPIFY@1", { daXem: "p1" });
  assert.equal(nhan.length, 2);
  assert.equal(nhan[0].phien, dangChay);
  assert.deepEqual(nhan[1], { phien: dangChay, theoDoi: null, daXem: "p1" });
  thoi();
  ghiBoNho("SHOPIFY@1", { phien: daXong });
  assert.equal(nhan.length, 2);
});

test("người nghe ghi lại ngay trong lúc được báo không làm lặp vô hạn, người nghe khác vẫn nhận", () => {
  let lan = 0;
  let cuoi = null;
  const thoi1 = ngheBoNho("K", (muc) => {
    lan += 1;
    const ma = muc.phien?.maPhien ?? null;
    if (muc.theoDoi !== ma) ghiBoNho("K", { theoDoi: ma });
  });
  const thoi2 = ngheBoNho("K", (muc) => {
    cuoi = muc;
  });
  try {
    ghiBoNho("K", { phien: dangChay });
    assert.ok(lan <= 3);
    // Người nghe sau nhận bản cuối cùng (đã có theoDoi), không bị bản cũ đè lên
    assert.equal(cuoi.theoDoi, "p1");
    assert.equal(docBoNho("K").theoDoi, "p1");
  } finally {
    thoi1();
    thoi2();
  }
});

test("thôi nghe hai lần không lỗi", () => {
  const thoi = ngheBoNho("K", () => {});
  thoi();
  thoi();
  ghiBoNho("K", { daXem: "x" });
  assert.equal(docBoNho("K").daXem, "x");
});
