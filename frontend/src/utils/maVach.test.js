import { test } from "node:test";
import assert from "node:assert/strict";
import { ganGiong, gs1, kyTuHopLe, lev, moTaDangMa, phanDauCua, tachSoLuong, trongNhuMa } from "./maVach.js";

test("ký tự mã vạch: chữ không dấu, số, . _ / -", () => {
  assert.equal(kyTuHopLe("QJ2610141-XN-30"), true);
  assert.equal(kyTuHopLe("8935001200307"), true);
  assert.equal(kyTuHopLe("A.B_C/D-1"), true);
  assert.equal(kyTuHopLe("QJ261014đ1-XN-30"), false);
  assert.equal(kyTuHopLe("ABC 123"), false);
  assert.equal(kyTuHopLe(""), false);
  assert.equal(kyTuHopLe(null), false);
});

test("tách tiền tố số lượng kiểu POS", () => {
  assert.deepEqual(tachSoLuong("12*QJ2610141-XN-30"), { soLuong: 12, ma: "QJ2610141-XN-30" });
  assert.deepEqual(tachSoLuong("  3 * 8935001200307 "), { soLuong: 3, ma: "8935001200307" });
  assert.deepEqual(tachSoLuong("8935001200307"), { soLuong: 1, ma: "8935001200307" });
  assert.equal(tachSoLuong("0*ABC").soLuong, null, "0 không tự thành 1");
  assert.match(tachSoLuong("0*ABC").loi, /từ 1 đến 999/);
  assert.match(tachSoLuong("1000*ABC").loi, /từ 1 đến 999/, "quá 999 báo đúng nguyên nhân");
  assert.deepEqual(tachSoLuong("999*ABC"), { soLuong: 999, ma: "ABC" });
  assert.deepEqual(tachSoLuong(""), { soLuong: 1, ma: "" });
});

test("GS1: EAN-13, EAN-8, UPC-A, GTIN-14 và mã không phải GS1", () => {
  assert.deepEqual(gs1("8935001200307"), { kieu: "EAN-13", ok: true });
  assert.deepEqual(gs1("8935001200387"), { kieu: "EAN-13", ok: false });
  assert.deepEqual(gs1("96385074"), { kieu: "EAN-8", ok: true });
  assert.deepEqual(gs1("036000291452"), { kieu: "UPC-A", ok: true });
  assert.deepEqual(gs1("10012345678902"), { kieu: "GTIN-14", ok: true });
  assert.deepEqual(gs1("QJ2610141-XN-30"), { kieu: null, ok: null });
  assert.deepEqual(gs1("12345"), { kieu: null, ok: null });
});

test("mô tả dạng mã", () => {
  assert.equal(moTaDangMa("8935001200307").chu, "13 chữ số · dạng EAN-13 · đúng số kiểm tra");
  assert.equal(moTaDangMa("8935001200307").tone, "ok");
  assert.equal(moTaDangMa("8935001200387").tone, "bad");
  assert.equal(moTaDangMa("PN-JB-030").chu, "9 ký tự, có chữ");
});

test("Levenshtein", () => {
  assert.equal(lev("abc", "abc"), 0);
  assert.equal(lev("abc", "abd"), 1);
  assert.equal(lev("abc", "ab"), 1);
  assert.equal(lev("", "abc"), 3);
  assert.equal(lev("kitten", "sitting"), 3);
});

test("mã gần giống: ngưỡng 1 với mã ngắn, 2 với mã dài, chỉ nhóm lệch ít nhất", () => {
  const ung = [
    { ma: "QJ2610141-XN-30", nhan: "SKU · 30" },
    { ma: "QJ2610141-XN-31", nhan: "SKU · 31" },
    { ma: "8935001200307", nhan: "NCC · 30" },
  ];
  const kq = ganGiong("QJ2610I41-XN-30", ung);
  assert.equal(kq.length, 1, "chỉ lấy nhóm lệch 1, bỏ mã lệch 2");
  assert.equal(kq[0].ma, "QJ2610141-XN-30");
  assert.equal(kq[0].lech, 1);
  assert.deepEqual(kq[0].kyTu.filter((k) => k.lech).map((k) => k.c), ["1"]);

  assert.deepEqual(ganGiong("ABCDE", [{ ma: "ABCXY" }]), [], "mã ngắn lệch 2 thì không gợi ý");
  assert.equal(ganGiong("ABCDE", [{ ma: "abcdf" }]).length, 1, "không phân biệt hoa thường");
  assert.deepEqual(ganGiong("ABC", [{ ma: "ABC" }]), [], "trùng hẳn thì không phải gần giống");
  assert.equal(ganGiong("8935001200387", [{ ma: "8935001200307" }, { ma: "8935001200307" }]).length, 1, "bỏ ứng viên trùng");
});

test("từ khóa trông như mã", () => {
  assert.equal(trongNhuMa("893500"), true);
  assert.equal(trongNhuMa("ao thun"), false);
  assert.equal(trongNhuMa("abc12"), false);
});

test("phanDauCua: mã quét là phần đầu của mã đã có (đọc thiếu đuôi)", () => {
  const ung = [
    { ma: "QJ2610141-CL003-22-MS-9363", nhan: "đang kiểm" },
    { ma: "QJ2610141-CL003-21-MS-9363", nhan: "21" },
    { ma: "QJ2610141-CL003-22-MS-9363", nhan: "trùng" },
    { ma: "AK2610051-CL005-1-MS-2691", nhan: "khác" },
  ];
  const kq = phanDauCua("qj2610141-cl003", ung);
  assert.equal(kq.length, 2, "không lặp mã, không lấy mã khác đầu");
  assert.equal(kq[0].thieu, 11);
  assert.equal(kq[0].kyTu.filter((k) => k.lech).length, 11);
  assert.deepEqual(phanDauCua("QJ261", ung), [], "dưới 6 ký tự không gợi ý");
  assert.deepEqual(phanDauCua("QJ2610141-CL003-22-MS-9363", ung), [], "trùng nguyên mã không phải phần đầu");
});
