import { test } from "node:test";
import assert from "node:assert/strict";
import { taoBoNhanQuetNhanh } from "./quetNhanh.js";

function phat(bo, chuoi, khoangMs, batDau = 0) {
  let luc = batDau;
  for (const k of chuoi) {
    bo.dat(luc);
    bo.nhan({ key: k, preventDefault() {}, stopPropagation() {} });
    luc += khoangMs;
  }
  return luc;
}

function taoBo() {
  const daNhan = [];
  const khoiPhuc = [];
  let bayGio = 0;
  const nhan = taoBoNhanQuetNhanh({
    onMa: (ma) => daNhan.push(ma),
    layAnhChup: () => ({ nsx: "2026-10-15" }),
    khoiPhuc: (anh) => khoiPhuc.push(anh),
    bayGio: () => bayGio,
  });
  return { nhan, daNhan, khoiPhuc, dat: (t) => (bayGio = t) };
}

test("máy quét gõ nhanh rồi Enter: nhận mã, khôi phục ô, chặn Enter", () => {
  const bo = taoBo();
  const luc = phat(bo, "A-01-02", 8);
  bo.dat(luc);
  let chan = false;
  const xong = bo.nhan({ key: "Enter", preventDefault: () => (chan = true), stopPropagation() {} });
  assert.equal(xong, true);
  assert.equal(chan, true);
  assert.deepEqual(bo.daNhan, ["A-01-02"]);
  assert.deepEqual(bo.khoiPhuc, [{ nsx: "2026-10-15" }]);
});

test("gõ tay chậm rồi Enter: không coi là lần quét", () => {
  const bo = taoBo();
  const luc = phat(bo, "LO-01", 120);
  bo.dat(luc);
  assert.equal(bo.nhan({ key: "Enter" }), false);
  assert.deepEqual(bo.daNhan, []);
});

test("hai phím gõ tay liền nhau rồi Enter: quá ngắn, không phải lần quét", () => {
  const bo = taoBo();
  const luc = phat(bo, "ab", 10);
  bo.dat(luc);
  assert.equal(bo.nhan({ key: "Enter" }), false);
});

test("đang gõ chậm thì máy quét bắn mã: chỉ lấy phần gõ nhanh, chụp ô lúc bắt đầu phần đó", () => {
  const bo = taoBo();
  let luc = phat(bo, "xy", 300);
  luc = phat(bo, "FC-KHOA-LO", 6, luc + 300);
  bo.dat(luc);
  bo.nhan({ key: "Enter", preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(bo.daNhan, ["FC-KHOA-LO"]);
});

test("máy quét USB gửi Shift trước chữ hoa: không cắt chuỗi, nhận đủ mã", () => {
  const bo = taoBo();
  let luc = 0;
  for (const k of "FC-KHOA-LO") {
    if (k >= "A" && k <= "Z") {
      bo.dat(luc);
      assert.equal(bo.nhan({ key: "Shift" }), false);
      luc += 2;
    }
    bo.dat(luc);
    bo.nhan({ key: k, preventDefault() {}, stopPropagation() {} });
    luc += 4;
  }
  bo.dat(luc);
  assert.equal(bo.nhan({ key: "Enter", preventDefault() {}, stopPropagation() {} }), true);
  assert.deepEqual(bo.daNhan, ["FC-KHOA-LO"]);
});

test("máy quét Bluetooth ~45ms mỗi phím vẫn được nhận (mã từ 8 ký tự)", () => {
  const bo = taoBo();
  const luc = phat(bo, "A-02-01-B", 45);
  bo.dat(luc - 45 + 30);
  assert.equal(bo.nhan({ key: "Enter", preventDefault() {}, stopPropagation() {} }), true);
  assert.deepEqual(bo.daNhan, ["A-02-01-B"]);
});

test("người gõ tay nhanh mã ngắn (\"2026\" nhịp 45–60 ms, \"LO-01\" nhịp 55 ms) rồi Enter: không coi là lần quét", () => {
  for (const [chuoi, nhip] of [["2026", 55], ["2026", 60], ["LO-01", 55], ["2026", 45]]) {
    const bo = taoBo();
    const luc = phat(bo, chuoi, nhip);
    // Người gõ dừng một nhịp dài hơn máy quét rồi mới Enter
    bo.dat(luc - nhip + 120);
    assert.equal(bo.nhan({ key: "Enter", preventDefault() {}, stopPropagation() {} }), false, `${chuoi} @${nhip}`);
  }
  // Gõ nhanh nhưng dừng lâu rồi mới Enter: cũng không phải lần quét
  const bo = taoBo();
  const luc = phat(bo, "LO-PN-0001", 30);
  bo.dat(luc - 30 + 130);
  assert.equal(bo.nhan({ key: "Enter", preventDefault() {}, stopPropagation() {} }), false);
});

test("không truyền đồng hồ: đo bằng e.timeStamp (lúc nhận phím), không bằng lúc xử lý", () => {
  const daNhan = [];
  const nhan = taoBoNhanQuetNhanh({ onMa: (ma) => daNhan.push(ma) });
  // Màn bận: các phím được xử lý muộn nhưng thời điểm nhận cách nhau 5ms
  let ts = 1000;
  for (const k of "SKU-93") {
    nhan({ key: k, timeStamp: ts, preventDefault() {}, stopPropagation() {} });
    ts += 5;
  }
  assert.equal(nhan({ key: "Enter", timeStamp: ts, preventDefault() {}, stopPropagation() {} }), true);
  assert.deepEqual(daNhan, ["SKU-93"]);
});

test("một phím trễ lẻ giữa lần quét (52 ms, 90 ms) không cắt đôi mã; trả ô về ảnh chụp ở phím đầu", () => {
  const anh = [];
  const daNhan = [];
  let gio = 0;
  let dem = 0;
  const nhan = taoBoNhanQuetNhanh({
    onMa: (ma) => daNhan.push(ma),
    layAnhChup: () => ++dem,
    khoiPhuc: (a) => anh.push(a),
    bayGio: () => gio,
  });
  const khoang = [8, 8, 52, 8, 8, 90, 8, 8, 8];
  const ma = "AK2610051-";
  for (let i = 0; i < ma.length; i++) {
    nhan({ key: ma[i], preventDefault() {}, stopPropagation() {} });
    gio += khoang[i] ?? 8;
  }
  assert.equal(nhan({ key: "Enter", preventDefault() {}, stopPropagation() {} }), true);
  assert.deepEqual(daNhan, ["AK2610051-"]);
  assert.deepEqual(anh, [1], "ảnh chụp ở phím đầu tiên của lần quét");
});

test("máy quét chậm ~56 ms/phím (nhịp 47–64 ms) vẫn nhận", () => {
  const bo = taoBo();
  let luc = 0;
  const nhip = [47, 64, 53, 58, 49, 61, 55, 56, 52];
  "FC-KHOA-LO".split("").forEach((k, i) => {
    bo.dat(luc);
    bo.nhan({ key: k, preventDefault() {}, stopPropagation() {} });
    luc += nhip[i] ?? 56;
  });
  bo.dat(luc - 56 + 40);
  assert.equal(bo.nhan({ key: "Enter", preventDefault() {}, stopPropagation() {} }), true);
  assert.deepEqual(bo.daNhan, ["FC-KHOA-LO"]);
});

test("gõ tay một chữ ngay trước khi bóp máy quét (cách 120 ms): chữ đó không vào mã quét", () => {
  const bo = taoBo();
  bo.dat(0);
  bo.nhan({ key: "y" });
  const luc = phat(bo, "A-02-01", 6, 120);
  bo.dat(luc);
  assert.equal(bo.nhan({ key: "Enter", preventDefault() {}, stopPropagation() {} }), true);
  assert.deepEqual(bo.daNhan, ["A-02-01"]);
});

test("máy quét Bluetooth 45 ms với mã ngắn (mã kệ, FC-DAT) vẫn được nhận; USB có Enter trễ 45 ms cũng nhận", () => {
  for (const ma of ["A-01-02", "FC-DAT", "FC-LD-3"]) {
    const bo = taoBo();
    const luc = phat(bo, ma, 45);
    bo.dat(luc);
    assert.equal(bo.nhan({ key: "Enter", preventDefault() {}, stopPropagation() {} }), true, ma);
    assert.deepEqual(bo.daNhan, [ma]);
  }
  const bo = taoBo();
  const luc = phat(bo, "A-01-02", 6);
  bo.dat(luc - 6 + 45);
  assert.equal(bo.nhan({ key: "Enter", preventDefault() {}, stopPropagation() {} }), true);
});

test("gõ tay \"AB\" (nhịp 90 ms) rồi bóp máy quét liền: mã là phần của máy quét", () => {
  const bo = taoBo();
  bo.dat(0);
  bo.nhan({ key: "A" });
  bo.dat(90);
  bo.nhan({ key: "B" });
  const luc = phat(bo, "FC-KHOA-LO", 6, 170);
  bo.dat(luc);
  assert.equal(bo.nhan({ key: "Enter", preventDefault() {}, stopPropagation() {} }), true);
  assert.deepEqual(bo.daNhan, ["FC-KHOA-LO"]);
});
