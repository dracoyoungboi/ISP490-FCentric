import { test } from "node:test";
import assert from "node:assert/strict";
import { PRINT_SCHEMAS } from "../../../components/print/schemas/printSchemas.js";
import { applyEssentials, buildDefaultTemplateConfig } from "../../../components/print/cauHinhMauIn.js";
import {
    GROUP_FOOTER,
    GROUP_HEADER,
    GROUP_LAYOUT,
    buildEditorGroups,
    setCustomOption,
    setLabel,
    summarizeChanges,
    toggleGroup,
    toggleRow,
} from "./moHinhTrinhSua.js";

const PNK = PRINT_SCHEMAS.goods_receipt;
const macDinh = (schema, index = 0) => applyEssentials(schema, buildDefaultTemplateConfig(schema, schema.templates[index]));
const nhom = (groups, key) => groups.find((group) => group.key === key);
const dong = (group, id) => group.rows.find((row) => row.id === id);

test("mỗi loại chứng từ có nhóm Khổ giấy, Đầu, các khối theo schema, Chân; khóa nhóm khớp khối trên giấy", () => {
    for (const schema of Object.values(PRINT_SCHEMAS)) {
        for (const template of schema.templates) {
            const groups = buildEditorGroups(schema, macDinh(schema, schema.templates.indexOf(template)));
            assert.equal(groups[0].key, GROUP_LAYOUT);
            assert.equal(groups[1].key, GROUP_HEADER);
            assert.equal(groups.at(-1).key, GROUP_FOOTER);
            const keys = groups.map((group) => group.key);
            assert.equal(new Set(keys).size, keys.length, `${template.id}: khóa nhóm trùng`);
            const ids = groups.flatMap((group) => group.rows.map((row) => row.id));
            assert.equal(new Set(ids).size, ids.length, `${template.id}: dòng trùng`);
            for (const group of groups) {
                assert.ok(group.onCount <= group.total);
                for (const row of group.rows) if (row.locked) assert.equal(row.on, true);
            }
        }
    }
});

test("nhóm ba trạng thái: Chữ ký PNK mặc định một phần (Kế toán tắt), bật hết rồi tắt hết", () => {
    let config = macDinh(PNK);
    let chuKy = nhom(buildEditorGroups(PNK, config), "signatures");
    assert.equal(chuKy.state, "some");
    assert.equal(`${chuKy.onCount}/${chuKy.total}`, "3/4");
    config = toggleGroup(config, chuKy, true);
    chuKy = nhom(buildEditorGroups(PNK, config), "signatures");
    assert.equal(chuKy.state, "all");
    config = toggleGroup(config, chuKy, false);
    chuKy = nhom(buildEditorGroups(PNK, config), "signatures");
    assert.equal(chuKy.state, "none");
    assert.equal(chuKy.onCount, 0);
});

test("cột bắt buộc không tắt được, kể cả khi tắt cả nhóm", () => {
    let config = macDinh(PNK);
    const bang = nhom(buildEditorGroups(PNK, config), "items");
    const sku = dong(bang, "items.sku");
    assert.equal(sku.locked, true);
    assert.equal(toggleRow(config, sku, false), config);
    config = toggleGroup(config, bang, false);
    assert.equal(config.columns.sku, true);
    assert.equal(config.columns.lot, false);
    assert.equal(config.sections.items.showTotal, false);
});

test("đổi tên nhãn: nhãn mới hiện, gốc giữ để hiển thị; rỗng / trùng gốc = trả về gốc", () => {
    let config = setLabel(macDinh(PNK), "items.sku", "  Mã hàng  ", "Mã SKU");
    let row = dong(nhom(buildEditorGroups(PNK, config), "items"), "items.sku");
    assert.equal(row.label, "Mã hàng");
    assert.equal(row.renamed, true);
    assert.equal(row.defaultLabel, "Mã SKU");
    config = setLabel(config, "items.sku", "Mã SKU", "Mã SKU");
    assert.equal(config.sections._tuyChinh.nhan, undefined);
    config = setLabel(setLabel(config, "items.sku", "X", "Mã SKU"), "items.sku", "", "Mã SKU");
    row = dong(nhom(buildEditorGroups(PNK, config), "items"), "items.sku");
    assert.equal(row.renamed, false);
});

test("nhãn tự đổi theo dữ liệu (Nguồn hàng) không có nút đổi tên", () => {
    const thongTin = nhom(buildEditorGroups(PNK, macDinh(PNK)), "receiptInfo");
    assert.equal(dong(thongTin, "receiptInfo.partner").labelKey, null);
    assert.equal(dong(thongTin, "receiptInfo.receiptType").labelKey, "receiptInfo.receiptType");
});

test("tóm tắt thay đổi cho lịch sử", () => {
    const truoc = macDinh(PNK);
    let sau = setCustomOption(truoc, "tieuDe", "Phiếu nhập hàng");
    sau = setCustomOption(sau, "maSoPhieu", "ma_vach");
    sau = setLabel(sau, "items.sku", "Mã hàng", "Mã SKU");
    sau = toggleRow(sau, dong(nhom(buildEditorGroups(PNK, sau), "items"), "items.lot"), false);
    assert.equal(
        summarizeChanges(PNK, truoc, sau),
        "Đổi tiêu đề thành “Phiếu nhập hàng”, in mã vạch số phiếu, tắt cột Lô, đổi tên “Mã SKU” thành “Mã hàng”"
    );
    assert.equal(summarizeChanges(PNK, truoc, structuredClone(truoc)), "Lưu lại, không đổi nội dung");
    assert.equal(summarizeChanges(PNK, sau, setCustomOption(sau, "tieuDe", "")), "Trả tiêu đề về tên gốc");
    assert.equal(summarizeChanges(PNK, null, truoc), "Lưu lần đầu");
    const nhieu = ["accountant", "approver", "receiver", "deliverer"].reduce(
        (config, key) => ({ ...config, sections: { ...config.sections, signatures: { ...config.sections.signatures, [key]: !config.sections.signatures[key] } } }),
        truoc
    );
    assert.match(summarizeChanges(PNK, truoc, nhieu), /^Bật ô ký Kế toán, tắt ô ký Người giao hàng, ô ký Người nhập kho và ô ký Người duyệt$/);
});

test("hóa đơn: lời chân và mã QR ghi đúng danh từ 'hóa đơn'", () => {
    const hd = PRINT_SCHEMAS.sales_invoice;
    const truoc = macDinh(hd);
    const sau = setCustomOption(setCustomOption(truoc, "loiChanPhieu", ""), "maSoPhieu", "ma_qr");
    assert.equal(summarizeChanges(hd, truoc, sau), "In mã QR số hóa đơn, bỏ lời chân hóa đơn");
    const groups = buildEditorGroups(hd, truoc);
    assert.equal(groups[1].title, "Đầu hóa đơn");
    assert.equal(groups.at(-1).title, "Chân hóa đơn");
});

test("bảng đang tắt: cột và dòng tổng khóa lại, không tính vào số mục; bật bảng thì tính lại", () => {
    const BG = PRINT_SCHEMAS.quotation_request;
    const config = macDinh(BG); // bảng "Nhà cung cấp được mời" mặc định tắt
    const group = nhom(buildEditorGroups(BG, config), "suppliers");
    assert.equal(dong(group, "suppliers.$show").on, false);
    const columns = group.rows.filter((row) => row.id !== "suppliers.$show");
    assert.ok(columns.length > 0 && columns.every((row) => row.inactive && row.hint === "Chỉ in khi bật “In bảng này”"));
    assert.equal(group.total, 1);
    assert.equal(group.onCount, 0);
    assert.equal(group.state, "none");

    const bat = nhom(buildEditorGroups(BG, toggleRow(config, dong(group, "suppliers.$show"), true)), "suppliers");
    assert.ok(bat.rows.every((row) => !row.inactive));
    assert.equal(bat.total, group.rows.length);
});

test("ngày sản xuất in sau mã lô: tắt cột Lô thì ngày sản xuất khóa lại, gợi ý theo tên cột đã đổi", () => {
    const config = setLabel(macDinh(PNK), "items.lot", "Số lô", "Lô");
    const group = nhom(buildEditorGroups(PNK, config), "items");
    assert.equal(dong(group, "items.productionDate").inactive, false);
    const tat = nhom(buildEditorGroups(PNK, toggleRow(config, dong(group, "items.lot"), false)), "items");
    const ngaySx = dong(tat, "items.productionDate");
    assert.equal(ngaySx.inactive, true);
    assert.equal(ngaySx.hint, "Chỉ in khi bật cột Số lô");
    assert.equal(tat.total, group.total - 1);
});

test("thuế suất in sau nhãn Thuế GTGT: không đổi tên được, tắt Thuế GTGT thì khóa lại, gợi ý theo tên đã đổi", () => {
    const HD = PRINT_SCHEMAS.pos_invoice;
    const config = setLabel(macDinh(HD), "totals.vatAmount", "Tiền thuế VAT", "Thuế GTGT");
    const group = nhom(buildEditorGroups(HD, config), "totals");
    const thueSuat = dong(group, "totals.vatRate");
    assert.equal(thueSuat.labelKey, null);
    assert.equal(thueSuat.inactive, false);
    assert.equal(thueSuat.hint, "In trong ngoặc sau nhãn Tiền thuế VAT");
    const tat = nhom(buildEditorGroups(HD, toggleRow(config, dong(group, "totals.vatAmount"), false)), "totals");
    assert.equal(dong(tat, "totals.vatRate").inactive, true);
    assert.equal(dong(tat, "totals.vatRate").hint, "Chỉ in khi bật Tiền thuế VAT");
    assert.equal(tat.total, group.total - 1);
    // Dòng chú thích "trong đó" đổi tên được như các dòng tổng khác
    assert.equal(dong(group, "totals.vatNote").labelKey, "totals.vatNote");
});

test("chú thích thuế: tắt cả hai dòng thuế thì khóa lại, không tính vào số mục; tóm tắt lịch sử dùng tên ngắn", () => {
    const HD = PRINT_SCHEMAS.pos_invoice;
    const config = macDinh(HD);
    const group = nhom(buildEditorGroups(HD, config), "totals");
    assert.equal(dong(group, "totals.vatNote").inactive, false);

    const tatMot = toggleRow(config, dong(group, "totals.vatPreTax"), false);
    assert.equal(dong(nhom(buildEditorGroups(HD, tatMot), "totals"), "totals.vatNote").inactive, false);

    const tatHai = toggleRow(tatMot, dong(group, "totals.vatAmount"), false);
    const khoa = nhom(buildEditorGroups(HD, tatHai), "totals");
    const chuThich = dong(khoa, "totals.vatNote");
    assert.equal(chuThich.inactive, true);
    assert.equal(chuThich.hint, "Chỉ in khi bật Tiền trước thuế hoặc Thuế GTGT");
    // Chú thích, thuế suất (theo Thuế GTGT) khóa lại: không tính vào số mục
    assert.equal(khoa.total, group.total - 2);

    assert.equal(
        summarizeChanges(HD, config, toggleRow(config, dong(group, "totals.vatNote"), false)),
        "Tắt dòng chú thích thuế GTGT"
    );
});

test("gợi ý theo danh từ của chứng từ: hóa đơn không gọi là phiếu", () => {
    const HD = PRINT_SCHEMAS.sales_invoice;
    const hints = buildEditorGroups(HD, macDinh(HD)).flatMap((group) => group.rows).map((row) => row.hint ?? "");
    const sai = hints.filter((hint) => hint.toLocaleLowerCase("vi").includes("phiếu"));
    assert.deepEqual(sai, []);
});
