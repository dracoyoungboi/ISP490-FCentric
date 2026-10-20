// Chạy: node --test src/components/print/adapters/printFormat.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    formatPrintDate,
    formatPrintLongDate,
    formatPrintMoney,
    formatPrintNumber,
    joinParts,
    textOrNull,
    toDate,
} from "./printFormat.js";

test("toDate: chuỗi chỉ có ngày là ngày theo lịch, không lệch theo múi giờ", () => {
    const date = toDate("2026-09-20");
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 8);
    assert.equal(date.getDate(), 20);
    assert.equal(toDate("không phải ngày"), null);
    assert.equal(toDate(null), null);
});

test("formatPrintDate / formatPrintLongDate: đủ 2 chữ số, rỗng thì '—' / null", () => {
    assert.equal(formatPrintDate("2026-09-05"), "05/09/2026");
    assert.equal(formatPrintDate(null), "—");
    assert.equal(formatPrintLongDate("2026-09-05"), "Ngày 05 tháng 09 năm 2026");
    assert.equal(formatPrintLongDate(""), null);
});

test("formatPrintNumber / formatPrintMoney: phân nhóm vi-VN, 0 vẫn in, thiếu thì '—'", () => {
    assert.equal(formatPrintNumber(1250), "1.250");
    assert.equal(formatPrintNumber(1.5), "1,5");
    assert.equal(formatPrintNumber(0), "0");
    assert.equal(formatPrintNumber(null), "—");
    assert.equal(formatPrintMoney(4300000), "4.300.000 ₫");
    assert.equal(formatPrintMoney(0), "0 ₫");
    assert.equal(formatPrintMoney(undefined), "—");
});

test("textOrNull / joinParts: bỏ phần rỗng", () => {
    assert.equal(textOrNull("  "), null);
    assert.equal(textOrNull(" Kho A "), "Kho A");
    assert.equal(joinParts(["Shopify", null, "#1016"]), "Shopify · #1016");
    assert.equal(joinParts([null, ""]), null);
});
