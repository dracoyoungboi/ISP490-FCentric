/**
 * Đọc dữ liệu của bản in (model do adapter dựng) và dựng các dòng của khối tổng tiền — hàm THUẦN dùng chung cho
 * renderer (PrintTemplateDocument) và kiểm thử. Chỉ import đường dẫn tương đối để chạy được bằng `node --test`.
 */
import { getLabel } from "./schemas/printSchemas.js";

/** Giá trị "không áp dụng" do adapter trả về (null/undefined/chuỗi rỗng). */
export const isEmptyValue = (value) => value === null || value === undefined || value === "";

/** Đọc giá trị theo đường dẫn "warehouse.name", "totals.items", ... */
export function getByPath(model, path) {
    if (!path) return model;
    return path.split(".").reduce(
        (value, key) => (value === null || value === undefined ? value : value[key]),
        model
    );
}

/**
 * Các dòng in của khối tổng (section `summary`) theo cấu hình mẫu và dữ liệu phiếu:
 * [{ key, label, value, emphasis, sub, note, afterSub }].
 * - Dòng tắt trong cấu hình, dòng không có dữ liệu, dòng bằng 0 (hideWhenZero), dòng trùng số (hideWhenSameAs): bỏ.
 * - Dòng `attachTo` không thành dòng riêng: giá trị in trong ngoặc sau nhãn dòng đích ("Thuế GTGT (10%)").
 * - Dòng chú thích (`note`) chỉ in khi ngay sau nó còn dòng con — tắt cả hai dòng thuế thì bỏ luôn chú thích.
 * - `afterSub`: dòng thường đầu tiên sau nhóm dòng con (renderer chừa khoảng cách để tách nhóm).
 * Nhãn trả ra là chuỗi (nhãn tự đặt > nhãn gốc); renderer tự bọc nhãn dài.
 */
export function dongKhoiTong(section, config, model) {
    const sectionConfig = config.sections?.[section.key] ?? {};
    const isOn = (row) => row.essential || sectionConfig[row.key] !== false;
    const visible = section.rows
        .filter((row) => !row.attachTo && isOn(row))
        .filter((row) => {
            const value = getByPath(model, row.modelPath);
            if (isEmptyValue(value)) return false;
            if (row.hideWhenZero && !getByPath(model, row.rawPath ?? row.modelPath)) return false;
            if (row.hideWhenSameAs && value === getByPath(model, row.hideWhenSameAs)) return false;
            return true;
        })
        .map((row) => {
            let label = getLabel(config, section.key, row.key, row.label);
            for (const extra of section.rows) {
                if (extra.attachTo !== row.key || !isOn(extra)) continue;
                const value = getByPath(model, extra.modelPath);
                if (!isEmptyValue(value)) label = `${label} (${value})`;
            }
            return {
                key: row.key,
                label,
                value: row.note ? null : getByPath(model, row.modelPath),
                emphasis: Boolean(row.emphasis),
                sub: Boolean(row.sub),
                note: Boolean(row.note),
            };
        });
    return visible
        .filter((row, index) => !row.note || visible[index + 1]?.sub)
        .map((row, index, rows) => ({ ...row, afterSub: !row.sub && !row.note && Boolean(rows[index - 1]?.sub) }));
}
