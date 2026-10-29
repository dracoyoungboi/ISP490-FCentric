import { test } from "node:test";
import assert from "node:assert/strict";
import { PRINT_SCHEMAS } from "./schemas/printSchemas.js";
import { applyEssentials, buildDefaultTemplateConfig, getRenameableLabels } from "./cauHinhMauIn.js";
import { dongKhoiTong } from "./khoiTongIn.js";

const POS = PRINT_SCHEMAS.pos_invoice;
const HD = PRINT_SCHEMAS.sales_invoice;
const khoiTong = (schema) => schema.sections.find((section) => section.key === "totals");
const macDinh = (schema) => applyEssentials(schema, buildDefaultTemplateConfig(schema, schema.templates[0]));
const voiTong = (config, tong) => ({ ...config, sections: { ...config.sections, totals: { ...config.sections.totals, ...tong } } });
const tomTat = (rows) => rows.map((row) => [row.key, row.label, row.value]);

/** Hóa đơn tại quầy SO202610294: 1 món 120.000 ₫ đã gồm thuế 10%, trả 20.000 ₫ tiền mặt + 100.000 ₫ chuyển khoản. */
const DON_TAI_QUAY = {
    totals: { items: "120.000 ₫", shippingRaw: 0, shipping: "0 ₫", grandTotal: "120.000 ₫" },
    vat: { included: true, preTax: "109.091 ₫", rate: "10%", amount: "10.909 ₫" },
    payment: { cashPart: "20.000 ₫", transferPart: "100.000 ₫", received: null, changeRaw: null, change: null, paid: null, due: null },
};

/** Đơn bán thường: 1.000.000 ₫ hàng + 30.000 ₫ phí vận chuyển, đã gồm thuế 10% trên tổng, đã thu 500.000 ₫. */
const DON_GIAO_HANG = {
    totals: { items: "1.000.000 ₫", shippingRaw: 30000, shipping: "30.000 ₫", grandTotal: "1.030.000 ₫" },
    vat: { included: true, preTax: "936.364 ₫", rate: "10%", amount: "93.636 ₫" },
    payment: { cashPart: null, transferPart: null, received: null, changeRaw: null, change: null, paid: "500.000 ₫", due: "530.000 ₫" },
};

test("hóa đơn tại quầy có thuế, trả kết hợp: Tổng thanh toán trước, thuế là phần 'trong đó', rồi tiền mặt + chuyển khoản", () => {
    const rows = dongKhoiTong(khoiTong(POS), macDinh(POS), DON_TAI_QUAY);
    assert.deepEqual(tomTat(rows), [
        // Tổng tiền hàng trùng Tổng thanh toán nên ẩn: dòng hàng 120.000 đi thẳng xuống Tổng thanh toán 120.000
        ["grandTotal", "Tổng thanh toán", "120.000 ₫"],
        ["vatNote", "Giá đã gồm thuế GTGT, trong đó:", null],
        ["vatPreTax", "Tiền trước thuế", "109.091 ₫"],
        ["vatAmount", "Thuế GTGT (10%)", "10.909 ₫"],
        ["paidCash", "Tiền mặt", "20.000 ₫"],
        ["paidTransfer", "Chuyển khoản", "100.000 ₫"],
    ]);
    assert.deepEqual(rows.map((row) => row.key).filter((key, index) => rows[index].sub), ["vatPreTax", "vatAmount"]);
    assert.equal(rows.find((row) => row.key === "vatNote").note, true);
    // Chỉ dòng đầu tiên sau nhóm "trong đó" được tách khoảng
    assert.deepEqual(rows.filter((row) => row.afterSub).map((row) => row.key), ["paidCash"]);
});

test("có phí vận chuyển: phần thuế treo dưới Tổng thanh toán (thuế tính trên cả phí), không dưới Tổng tiền hàng", () => {
    const rows = dongKhoiTong(khoiTong(HD), macDinh(HD), DON_GIAO_HANG);
    assert.deepEqual(rows.map((row) => row.key), [
        "items", "shipping", "grandTotal", "vatNote", "vatPreTax", "vatAmount", "paid", "due",
    ]);
    assert.deepEqual(rows.filter((row) => row.emphasis).map((row) => row.key), ["grandTotal", "due"]);
    assert.deepEqual(rows.filter((row) => row.afterSub).map((row) => row.key), ["paid"]);
});

test("tắt thuế suất: nhãn chỉ còn 'Thuế GTGT'; nhãn tự đặt vẫn kèm thuế suất", () => {
    const tatThueSuat = dongKhoiTong(khoiTong(POS), voiTong(macDinh(POS), { vatRate: false }), DON_TAI_QUAY);
    assert.equal(tatThueSuat.find((row) => row.key === "vatAmount").label, "Thuế GTGT");
    assert.equal(tatThueSuat.some((row) => row.key === "vatRate"), false);

    const config = macDinh(POS);
    config.sections._tuyChinh = { nhan: { "totals.vatAmount": "Tiền thuế VAT" } };
    const doiTen = dongKhoiTong(khoiTong(POS), config, DON_TAI_QUAY);
    assert.equal(doiTen.find((row) => row.key === "vatAmount").label, "Tiền thuế VAT (10%)");
});

test("tắt cả hai dòng thuế thì bỏ luôn dòng chú thích; tắt một dòng thì chú thích vẫn in", () => {
    const tatHet = dongKhoiTong(khoiTong(POS), voiTong(macDinh(POS), { vatPreTax: false, vatAmount: false }), DON_TAI_QUAY);
    assert.deepEqual(tatHet.map((row) => row.key), ["grandTotal", "paidCash", "paidTransfer"]);
    assert.equal(tatHet.some((row) => row.afterSub), false);

    const conMot = dongKhoiTong(khoiTong(POS), voiTong(macDinh(POS), { vatPreTax: false }), DON_TAI_QUAY);
    assert.deepEqual(conMot.map((row) => row.key).slice(0, 3), ["grandTotal", "vatNote", "vatAmount"]);
});

test("đơn không mang thuế, trả tiền mặt: không có nhóm thuế, khối tiền như cũ", () => {
    const model = {
        totals: { items: "850.000 ₫", shippingRaw: 0, shipping: "0 ₫", grandTotal: "850.000 ₫" },
        vat: null,
        payment: { cashPart: null, transferPart: null, received: "1.000.000 ₫", changeRaw: 150000, change: "150.000 ₫", paid: null, due: null },
    };
    const rows = dongKhoiTong(khoiTong(POS), macDinh(POS), model);
    assert.deepEqual(tomTat(rows), [
        ["grandTotal", "Tổng thanh toán", "850.000 ₫"],
        ["cashReceived", "Tiền khách đưa", "1.000.000 ₫"],
        ["change", "Tiền thừa trả khách", "150.000 ₫"],
    ]);
    assert.equal(rows.some((row) => row.sub || row.note || row.afterSub), false);
});

test("thuế suất in sau nhãn dòng khác nên không có nhãn riêng để đổi tên; dòng chú thích thì có", () => {
    const labels = getRenameableLabels(POS, true);
    assert.equal(labels.has("totals.vatRate"), false);
    assert.equal(labels.get("totals.vatNote"), "Giá đã gồm thuế GTGT, trong đó:");
    assert.equal(getRenameableLabels(HD, false).get("totals.amountInWords"), "Tổng thanh toán bằng chữ");
});
