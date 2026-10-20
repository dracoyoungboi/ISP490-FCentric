import { test } from "node:test";
import assert from "node:assert/strict";
import { barsFromBits, encodeCode128, toBarcodeText, toQrText } from "./maVach.js";

test("mã vạch Code 128: bắt đầu bằng ký tự start, kết thúc bằng stop, chỉ 0/1", () => {
    const bits = encodeCode128("PNK-0001");
    assert.match(bits, /^[01]+$/);
    assert.ok(bits.startsWith("11010010000")); // START B
    assert.ok(bits.endsWith("1100011101011")); // STOP
    // Dãy số dài được nén (tập C): ngắn hơn hẳn mã hóa từng ký tự
    assert.ok(encodeCode128("SO20261019000123").length < 11 * 18);
});

test("số phiếu có dấu / trống: bỏ dấu cho máy quét, không có gì thì không in", () => {
    assert.equal(toBarcodeText("MẪU-PNK-0001"), "MAU-PNK-0001");
    assert.equal(toBarcodeText("Đơn-01"), "Don-01");
    assert.equal(toBarcodeText("—"), null);
    assert.equal(toBarcodeText("  "), null);
    assert.equal(toBarcodeText(null), null);
    assert.equal(encodeCode128(""), null);
});

test("gạch nối / khoảng trắng Unicode trong số phiếu: đổi về ASCII thay vì bỏ mất", () => {
    assert.equal(toBarcodeText("PNK\u20130001"), "PNK-0001"); // en dash
    assert.equal(toBarcodeText("PNK\u22120001"), "PNK-0001"); // dấu trừ
    assert.equal(toBarcodeText("PNK\u00A00001"), "PNK 0001"); // khoảng trắng không ngắt
    assert.equal(toBarcodeText("PNK\u202F0001"), "PNK 0001");
});

test("mã QR giữ đúng số phiếu (QR chứa được chữ có dấu), chỉ bỏ ký tự điều khiển và khoảng trắng hai đầu", () => {
    assert.equal(toQrText("MẪU-PNK-0001"), "MẪU-PNK-0001");
    assert.equal(toQrText("  PNK-0001\n"), "PNK-0001");
    assert.equal(toQrText("PNK\u0007-01"), "PNK-01");
    assert.equal(toQrText("—"), null);
    assert.equal(toQrText(" "), null);
    assert.equal(toQrText(undefined), null);
});

test("vạch đen liền nhau gom thành một hình chữ nhật", () => {
    assert.deepEqual(barsFromBits("1101001"), [
        { x: 0, width: 2 },
        { x: 3, width: 1 },
        { x: 6, width: 1 },
    ]);
    assert.deepEqual(barsFromBits(""), []);
});
