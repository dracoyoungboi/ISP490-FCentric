import { test } from "node:test";
import assert from "node:assert/strict";
import { PRINT_SCHEMAS } from "./schemas/printSchemas.js";
import {
    applyEssentials,
    buildDefaultTemplateConfig,
    buildVariantFromDraft,
    configFromSaved,
    getRenameableLabels,
    normalizeConfig,
    sameConfig,
    stableStringify,
} from "./cauHinhMauIn.js";

const PNK = PRINT_SCHEMAS.goods_receipt;
const POS = PRINT_SCHEMAS.pos_invoice;
const macDinh = (schema, index = 0) => applyEssentials(schema, buildDefaultTemplateConfig(schema, schema.templates[index]));
const voiTuyChinh = (config, custom) => ({ ...config, sections: { ...config.sections, _tuyChinh: custom } });
/** Cấu hình in ra khác mẫu mặc định của loại chứng từ (khổ mặc định)? */
const khacMacDinh = (schema, config) => !sameConfig(schema, config, macDinh(schema));

test("mặc định không có _tuyChinh và giống chính nó sau chuẩn hóa", () => {
    for (const schema of Object.values(PRINT_SCHEMAS)) {
        const config = macDinh(schema);
        assert.equal(config.sections._tuyChinh, undefined, schema.key);
        assert.equal(khacMacDinh(schema, config), false, schema.key);
    }
});

test("chuẩn hóa: bỏ mục trùng mặc định, cắt khoảng trắng, bỏ khóa lạ và nhãn không còn trên bố cục", () => {
    const config = voiTuyChinh(macDinh(PNK), {
        tieuDe: "  phiếu nhập kho ",
        coChu: "vua",
        maSoPhieu: "khong",
        loiChanPhieu: "",
        khoaLa: 1,
        nhan: { "items.sku": "  Mã hàng ", "items.lot": "Lô", "items.khongCo": "X", "receiptInfo.partner": "Nguồn" },
    });
    const n = normalizeConfig(PNK, config);
    // tiêu đề trùng tên gốc (không phân biệt hoa thường) -> bỏ; Vừa / Không -> bỏ; lời chân rỗng khác mặc định "" ? mặc định PNK rỗng -> bỏ
    assert.deepEqual(n.sections._tuyChinh, { nhan: { "items.sku": "Mã hàng" } });
    // Không sửa cấu hình gốc
    assert.equal(config.sections._tuyChinh.tieuDe, "  phiếu nhập kho ");
});

test("chuẩn hóa: lời chân rỗng của hóa đơn (mặc định có lời chân) vẫn được giữ = không in", () => {
    const hd = PRINT_SCHEMAS.sales_invoice;
    const n = normalizeConfig(hd, voiTuyChinh(macDinh(hd), { loiChanPhieu: "" }));
    assert.deepEqual(n.sections._tuyChinh, { loiChanPhieu: "" });
    const giong = normalizeConfig(hd, voiTuyChinh(macDinh(hd), { loiChanPhieu: hd.footerNote }));
    assert.equal(giong.sections._tuyChinh, undefined);
});

test("so sánh cấu hình không phụ thuộc thứ tự khóa", () => {
    const a = macDinh(PNK);
    const b = JSON.parse(JSON.stringify(a, Object.keys(a).reverse()));
    const reordered = Object.fromEntries(Object.entries(a).reverse());
    assert.equal(sameConfig(PNK, a, reordered), true);
    assert.equal(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] }), stableStringify({ a: [2, { c: 2, d: 1 }], b: 1 }));
    assert.ok(b);
});

test("đổi khổ A4 -> A5 giữ mọi tùy chỉnh; nhãn và tiêu đề đi theo", () => {
    const draft = voiTuyChinh(macDinh(PNK), { tieuDe: "Phiếu nhập hàng", coChu: "lon", maSoPhieu: "ma_qr", nhan: { "items.sku": "Mã hàng" } });
    draft.columns = { ...draft.columns, lot: false };
    const a5 = buildVariantFromDraft(PNK, draft, "A5");
    assert.equal(a5.id, "goods_receipt_default_A5");
    assert.equal(a5.paperSize, "A5");
    assert.deepEqual(a5.sections._tuyChinh, draft.sections._tuyChinh);
    assert.equal(a5.columns.lot, false);
    assert.equal(buildVariantFromDraft(PNK, draft, "K80"), null);
});

test("khổ nhiệt K80 -> K57 giữ tùy chỉnh, luôn khổ dọc", () => {
    const draft = voiTuyChinh(macDinh(POS), { maSoPhieu: "ma_vach" });
    const k57 = buildVariantFromDraft(POS, draft, "K57");
    assert.equal(k57.orientation, "portrait");
    assert.equal(k57.sections._tuyChinh.maSoPhieu, "ma_vach");
});

test("bản đã lưu -> cấu hình đầy đủ: khổ theo định danh, cột bắt buộc luôn bật, định danh lạ -> null", () => {
    const saved = { name: "Mẫu", paperSize: "A4", orientation: "landscape", margin: "wide", accentColor: "#111827", branding: {}, sections: { items: { show: false } }, columns: { sku: false, lot: false } };
    const config = configFromSaved(PNK, "goods_receipt_default_A5", saved);
    assert.equal(config.paperSize, "A5");
    assert.equal(config.sections.items.show, true);
    assert.equal(config.columns.sku, true);
    assert.equal(config.columns.lot, false);
    assert.equal(configFromSaved(PNK, "goods_receipt_custom_A4", saved), null);
    assert.equal(configFromSaved(PNK, "goods_receipt_default_A4", null), null);
});

test("nhãn đổi tên được theo bố cục: không gồm nhãn tự đổi theo dữ liệu, cột dòng phụ", () => {
    const sheet = getRenameableLabels(PNK, false);
    assert.equal(sheet.get("items.sku"), "Mã SKU");
    assert.equal(sheet.has("receiptInfo.partner"), false); // nhãn theo nguồn hàng
    assert.equal(sheet.has("items.productionDate"), false); // in sau mã lô
    assert.equal(sheet.get("signatures.accountant"), "Kế toán");
    const k80 = getRenameableLabels(POS, true);
    assert.equal(k80.get("items.productName"), "Tên hàng");
    assert.equal(k80.has("items.unitPrice"), false); // đơn giá in dưới tên hàng
    assert.equal(k80.has("invoiceInfo.cashier"), true);
    assert.equal(getRenameableLabels(PRINT_SCHEMAS.sales_invoice, false).has("invoiceInfo.cashier"), false);
});

test("khác mặc định: đổi khổ hoặc một tùy chỉnh bất kỳ; tùy chỉnh trùng mặc định thì không", () => {
    assert.equal(khacMacDinh(PNK, macDinh(PNK, 1)), true);
    assert.equal(khacMacDinh(PNK, voiTuyChinh(macDinh(PNK), { coChu: "nho" })), true);
    assert.equal(khacMacDinh(PNK, voiTuyChinh(macDinh(PNK), { coChu: "vua", tieuDe: " " })), false);
});

test("mã màu khác hoa/thường là một màu: không tính là thay đổi, bản đã lưu đọc ra chữ hoa", () => {
    const a = macDinh(PNK);
    assert.ok(sameConfig(PNK, a, { ...a, accentColor: a.accentColor.toLowerCase() }));
    assert.equal(normalizeConfig(PNK, { ...a, accentColor: "#0f2a43" }).accentColor, "#0F2A43");
    const saved = { name: "Mẫu", paperSize: "A4", orientation: "portrait", margin: "default", accentColor: "#1d4ed8", branding: {}, sections: {}, columns: {} };
    assert.equal(configFromSaved(PNK, PNK.templates[0].id, saved).accentColor, "#1D4ED8");
});

test("so sánh chỉ tính thứ làm bản in khác: khóa cũ không còn trên bố cục, tên mẫu, lề / hướng khổ nhiệt không tính", () => {
    const PR = PRINT_SCHEMAS.purchase_request;
    const a = macDinh(PR);
    // Cấu hình lưu từ phiên bản cũ: mục "Số phiếu" / "Ngày lập" (nay in ở đầu phiếu), section và cột đã bỏ
    const cu = structuredClone(a);
    cu.name = "Mẫu cũ";
    cu.sections.requestInfo = { ...cu.sections.requestInfo, documentNumber: true, createdAt: true };
    cu.sections.users = { creator: true, approver: true };
    cu.columns = { ...cu.columns, cotDaBo: true };
    cu.branding = { ...cu.branding, showWebsite: true };
    assert.equal(khacMacDinh(PR, cu), false);
    assert.ok(sameConfig(PR, a, cu));
    // Lưu lại thì khóa thừa được dọn
    const saved = normalizeConfig(PR, cu);
    assert.equal(saved.sections.users, undefined);
    assert.equal(saved.sections.requestInfo.documentNumber, undefined);
    assert.equal(saved.columns.cotDaBo, undefined);
    assert.equal(saved.branding.showWebsite, undefined);
    assert.equal(saved.name, "Mẫu cũ");
    // Thay đổi thật vẫn tính
    assert.equal(khacMacDinh(PR, { ...cu, branding: { ...cu.branding, showLogo: false } }), true);

    const k80 = macDinh(POS);
    assert.equal(khacMacDinh(POS, { ...k80, margin: "narrow", orientation: "landscape" }), false);
    // Bảng hàng của hóa đơn có dòng tổng: bật dòng tổng trên K80 là thay đổi thật
    assert.equal(khacMacDinh(POS, { ...k80, sections: { ...k80.sections, items: { ...k80.sections.items, showTotal: true } } }), true);
});

