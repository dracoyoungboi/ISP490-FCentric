/**
 * Mô hình của trình sửa mẫu in (PA1 — một màn): các nhóm tùy chọn ở cột phải, thao tác bật/tắt,
 * đổi tên nhãn, và câu tóm tắt "đã đổi gì" cho lịch sử chỉnh sửa. Hàm THUẦN, chỉ import đường dẫn
 * tương đối để chạy được bằng `node --test`.
 *
 * Mỗi nhóm khớp một khối trên tờ giấy (data-pdoc-khoi của PrintTemplateDocument): bấm khối trên
 * giấy mở đúng nhóm. Mỗi dòng (row) là một mục bật/tắt được, có thể kèm nhãn đổi tên được.
 */
import { isThermalPaper } from "../../../components/print/paperStyles.js";
import {
    CUSTOM_SECTION_KEY,
    DOC_CODE_OPTIONS,
    FONT_SIZE_OPTIONS,
    NOTES_LABEL_ITEM,
    getCustomLabel,
    getDocCodeMode,
    getDocTitle,
    getFontSize,
    getFooterNoteDraft,
    labelKey,
} from "../../../components/print/schemas/printSchemas.js";
import { normalizeConfig } from "../../../components/print/cauHinhMauIn.js";

export const GROUP_LAYOUT = "trinhBay";
export const GROUP_HEADER = "dau";
export const GROUP_FOOTER = "chan";

/** Thương hiệu ở đầu phiếu — thứ tự như trên giấy. */
const BRANDING_ROWS = [
    { key: "showLogo", label: "Logo" },
    { key: "showCompanyName", label: "Tên cửa hàng" },
    { key: "showTaxCode", label: "Mã số thuế", hint: "Chỉ in khi Thông tin cửa hàng có mã số thuế" },
    { key: "showAddress", label: "Địa chỉ" },
    { key: "showPhone", label: "Điện thoại" },
    { key: "showEmail", label: "Email" },
];

export const MARGIN_OPTIONS = [
    { value: "narrow", label: "Hẹp" },
    { value: "default", label: "Vừa" },
    { value: "wide", label: "Rộng" },
];

export const ORIENTATION_OPTIONS = [
    { value: "portrait", label: "Dọc" },
    { value: "landscape", label: "Ngang" },
];

/**
 * Màu tên chứng từ gợi ý — màu tối để in trắng đen vẫn ra xám đậm, đọc rõ. Mẫu cũ có màu khác
 * vẫn giữ nguyên (ô "Màu khác").
 */
export const ACCENT_PRESETS = [
    { value: "#0F2A43", label: "Xanh than" },
    { value: "#111827", label: "Đen" },
    { value: "#1D4ED8", label: "Xanh dương" },
    { value: "#7C2D12", label: "Nâu đỏ" },
];

export { DOC_CODE_OPTIONS, FONT_SIZE_OPTIONS };

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Đọc giá trị theo đường dẫn "sections.items.show". */
function readPath(config, path) {
    return path.split(".").reduce((node, key) => (node === null || node === undefined ? undefined : node[key]), config);
}

/** Bản sao cấu hình với giá trị mới ở `path` (tạo nhánh còn thiếu). */
export function setPath(config, path, value) {
    const next = structuredClone(config);
    const keys = path.split(".");
    let node = next;
    for (const key of keys.slice(0, -1)) {
        if (!isPlainObject(node[key])) node[key] = {};
        node = node[key];
    }
    node[keys[keys.length - 1]] = value;
    return next;
}

/**
 * Dòng bật/tắt; `labelKey` có giá trị khi nhãn đổi tên được. `inactive`: mục phụ thuộc một mục
 * khác đang tắt (cột của bảng đang tắt, ngày sản xuất khi tắt cột Lô) — không in dù đang bật, ô
 * chọn khóa lại kèm gợi ý `inactiveHint`, không tính vào số mục của nhóm.
 */
function makeRow(
    config,
    { id, path, defaultLabel, labelKeyValue = null, locked = false, hint, summaryName, on, inactive = false, inactiveHint = null }
) {
    const custom = labelKeyValue ? getCustomLabel(config, labelKeyValue) : null;
    const label = custom ?? defaultLabel;
    return {
        id,
        path,
        label,
        defaultLabel,
        renamed: Boolean(custom),
        labelKey: labelKeyValue,
        locked,
        on: locked ? true : on,
        inactive: Boolean(inactive),
        hint: (inactive ? inactiveHint : hint) ?? null,
        summaryName: summaryName ? summaryName(label) : label,
    };
}

function infoRows(section, config, compact, docNoun) {
    const sectionConfig = config.sections?.[section.key] ?? {};
    return section.fields
        .filter((field) => !(field.compactOnly && !compact) && !(field.compactHidden && compact))
        .map((field) =>
            makeRow(config, {
                id: labelKey(section.key, field.key),
                path: `sections.${section.key}.${field.key}`,
                defaultLabel: field.label,
                labelKeyValue: field.labelModelPath ? null : labelKey(section.key, field.key),
                locked: Boolean(field.essential),
                hint: field.labelModelPath ? field.hint ?? `Nhãn tự đổi theo dữ liệu của ${docNoun}` : field.hint,
                on: sectionConfig[field.key] !== false,
            })
        );
}

function itemsRows(section, config, compact, docNoun) {
    const sectionConfig = config.sections?.[section.key] ?? {};
    const rows = [];
    // Bảng đang tắt: cột và dòng tổng của bảng không in (khóa lại, không tính vào số mục)
    const tableOn = Boolean(section.essentialShow) || sectionConfig.show !== false;
    const tableOffHint = "Chỉ in khi bật “In bảng này”";
    if (!section.essentialShow) {
        rows.push(
            makeRow(config, {
                id: labelKey(section.key, "$show"),
                path: `sections.${section.key}.show`,
                defaultLabel: "In bảng này",
                hint: section.hint,
                on: sectionConfig.show !== false,
                summaryName: () => `bảng ${section.title}`,
            })
        );
    }
    const columns = compact && section.compactColumns ? section.compactColumns : section.columns;
    for (const column of columns) {
        const renameable = !column.inline && !column.inlineIn;
        // Mục in kèm trong ô của cột khác (ngày sản xuất sau mã lô): cột đó tắt thì mục này không in
        const host = column.inlineIn ? columns.find((other) => other.key === column.inlineIn) : null;
        const hostOn = !host || Boolean(host.essential) || config.columns?.[host.key] !== false;
        const hostLabel = host ? getCustomLabel(config, labelKey(section.key, host.key)) ?? host.label : null;
        rows.push(
            makeRow(config, {
                id: labelKey(section.key, column.key),
                path: `columns.${column.key}`,
                defaultLabel: column.label,
                labelKeyValue: renameable ? labelKey(section.key, column.key) : null,
                locked: Boolean(column.essential),
                hint: column.inline
                    ? "In ở dòng phụ dưới tên hàng"
                    : column.inlineIn
                      ? null
                      : column.hideWhenAllEmpty
                        ? `Tự ẩn khi cả ${docNoun} không có số liệu ở cột này`
                        : null,
                on: config.columns?.[column.key] !== false,
                inactive: !tableOn || !hostOn,
                inactiveHint: !tableOn ? tableOffHint : `Chỉ in khi bật cột ${hostLabel}`,
                summaryName: (label) => (renameable ? `cột ${label}` : label),
            })
        );
    }
    if (section.totals?.length) {
        rows.push(
            makeRow(config, {
                id: labelKey(section.key, "$total"),
                path: `sections.${section.key}.showTotal`,
                defaultLabel: "Dòng tổng cuối bảng",
                on: sectionConfig.showTotal !== false,
                inactive: !tableOn,
                inactiveHint: tableOffHint,
                summaryName: () => "dòng tổng cuối bảng",
            })
        );
    }
    return rows;
}

function summaryRows(section, config) {
    const sectionConfig = config.sections?.[section.key] ?? {};
    const rows = section.rows.map((row) => {
        const sameAs = row.hideWhenSameAs ? section.rows.find((other) => other.modelPath === row.hideWhenSameAs) : null;
        return makeRow(config, {
            id: labelKey(section.key, row.key),
            path: `sections.${section.key}.${row.key}`,
            defaultLabel: row.label,
            labelKeyValue: labelKey(section.key, row.key),
            locked: Boolean(row.essential),
            hint:
                row.hint ??
                (sameAs ? `Tự ẩn khi bằng ${sameAs.label.toLocaleLowerCase("vi")}` : row.hideWhenZero ? "Tự ẩn khi bằng 0" : null),
            on: sectionConfig[row.key] !== false,
        });
    });
    if (section.words) {
        rows.push(
            makeRow(config, {
                id: labelKey(section.key, section.words.key),
                path: `sections.${section.key}.${section.words.key}`,
                defaultLabel: section.words.label,
                labelKeyValue: labelKey(section.key, section.words.key),
                hint: "Số tiền tổng viết bằng chữ",
                on: sectionConfig[section.words.key] !== false,
                summaryName: () => "số tiền bằng chữ",
            })
        );
    }
    return rows;
}

function notesRows(section, config, docNoun) {
    const sectionConfig = config.sections?.[section.key] ?? {};
    return [
        makeRow(config, {
            id: labelKey(section.key, NOTES_LABEL_ITEM),
            path: `sections.${section.key}.show`,
            defaultLabel: section.title,
            labelKeyValue: labelKey(section.key, NOTES_LABEL_ITEM),
            hint: `${docNoun.charAt(0).toLocaleUpperCase("vi")}${docNoun.slice(1)} không có ghi chú thì không in dòng này`,
            on: sectionConfig.show !== false,
            summaryName: (label) => `dòng ${label.toLocaleLowerCase("vi")}`,
        }),
    ];
}

function signatureRows(section, config) {
    const sectionConfig = config.sections?.[section.key] ?? {};
    return section.blocks.map((block) =>
        makeRow(config, {
            id: labelKey(section.key, block.key),
            path: `sections.${section.key}.${block.key}`,
            defaultLabel: block.label,
            labelKeyValue: labelKey(section.key, block.key),
            hint: block.hint,
            on: sectionConfig[block.key] !== false,
            summaryName: (label) => `ô ký ${label}`,
        })
    );
}

function brandingRows(config) {
    const branding = config.branding ?? {};
    return BRANDING_ROWS.map((row) =>
        makeRow(config, {
            id: `branding.${row.key}`,
            path: `branding.${row.key}`,
            defaultLabel: row.label,
            hint: row.hint,
            // Mẫu lưu trước khi có tùy chọn MST: thiếu cờ vẫn in (khớp PrintHeader)
            on: row.key === "showTaxCode" ? branding.showTaxCode !== false : Boolean(branding[row.key]),
            summaryName: (label) => (row.key === "showLogo" ? "logo" : label.toLocaleLowerCase("vi")),
        })
    );
}

/**
 * Đếm và trạng thái ô chọn của nhóm: all / some / none theo các dòng KHÔNG bắt buộc. Dòng đang
 * không có hiệu lực (phụ thuộc mục đang tắt) không tính.
 */
function withCounts(group) {
    const rows = group.rows ?? [];
    const counted = rows.filter((row) => !row.inactive);
    const editable = counted.filter((row) => !row.locked);
    const onCount = counted.filter((row) => row.on).length;
    const editableOn = editable.filter((row) => row.on).length;
    let state = "none";
    if (editable.length > 0 && editableOn === editable.length) state = "all";
    else if (editableOn > 0) state = "some";
    return { ...group, rows, onCount, total: counted.length, canToggleAll: editable.length > 0, state };
}

/**
 * Các nhóm tùy chọn theo bố cục của khổ giấy đang sửa:
 * Khổ giấy và trình bày · Đầu phiếu · <các khối của chứng từ theo schema> · Chân phiếu.
 */
export function buildEditorGroups(schema, config) {
    if (!schema || !config) return [];
    const compact = isThermalPaper(config.paperSize);
    const docNoun = schema.docNoun ?? "phiếu";
    const groups = [
        { key: GROUP_LAYOUT, title: "Khổ giấy và trình bày", kind: "layout", rows: [] },
        { key: GROUP_HEADER, title: `Đầu ${docNoun}`, kind: "header", rows: brandingRows(config) },
    ];
    for (const section of schema.sections) {
        if (compact && section.compactHidden) continue;
        let rows = [];
        if (section.type === "info") rows = infoRows(section, config, compact, docNoun);
        else if (section.type === "items") rows = itemsRows(section, config, compact, docNoun);
        else if (section.type === "summary") rows = summaryRows(section, config);
        else if (section.type === "notes") rows = notesRows(section, config, docNoun);
        else if (section.type === "signatures") rows = signatureRows(section, config);
        groups.push({ key: section.key, title: section.title, kind: section.type, rows });
    }
    groups.push({ key: GROUP_FOOTER, title: `Chân ${docNoun}`, kind: "footer", rows: [] });
    return groups.map(withCounts);
}

/** Bật/tắt một dòng (dòng bắt buộc giữ nguyên). */
export function toggleRow(config, row, value) {
    if (!row || row.locked) return config;
    return setPath(config, row.path, Boolean(value));
}

/** Bật hoặc tắt cả nhóm: mọi dòng không bắt buộc nhận cùng một giá trị. */
export function toggleGroup(config, group, value) {
    let next = config;
    for (const row of group?.rows ?? []) {
        if (!row.locked) next = setPath(next, row.path, Boolean(value));
    }
    return next;
}

/** Bản sao cấu hình với một tùy chỉnh chung (sections._tuyChinh.<key>). */
export function setCustomOption(config, key, value) {
    return setPath(config, `sections.${CUSTOM_SECTION_KEY}.${key}`, value);
}

/**
 * Đổi tên nhãn: để trống hoặc trùng nhãn gốc = trả về nhãn gốc (xóa nhãn tự đặt).
 * Nhãn được cắt khoảng trắng hai đầu; độ dài do ô nhập giới hạn (LABEL_MAX_LENGTH).
 */
export function setLabel(config, key, value, defaultLabel) {
    const next = structuredClone(config);
    next.sections = isPlainObject(next.sections) ? next.sections : {};
    const custom = isPlainObject(next.sections[CUSTOM_SECTION_KEY]) ? next.sections[CUSTOM_SECTION_KEY] : {};
    const labels = isPlainObject(custom.nhan) ? { ...custom.nhan } : {};
    const label = typeof value === "string" ? value.trim() : "";
    if (!label || label === defaultLabel) delete labels[key];
    else labels[key] = label;
    const nextCustom = { ...custom };
    if (Object.keys(labels).length > 0) nextCustom.nhan = labels;
    else delete nextCustom.nhan;
    next.sections[CUSTOM_SECTION_KEY] = nextCustom;
    return next;
}

// ── Tóm tắt thay đổi (lịch sử chỉnh sửa) ─────────────────────────────────────

const optionLabel = (options, value) =>
    (options.find((option) => option.value === value)?.label ?? String(value ?? "")).toLocaleLowerCase("vi");

/** "A, B và C"; quá `max` mục thì "A, B và 3 mục khác". */
function listNames(names, max = 3) {
    if (names.length <= max) {
        return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} và ${names[names.length - 1]}`;
    }
    return `${names.slice(0, max - 1).join(", ")} và ${names.length - (max - 1)} mục khác`;
}

/**
 * Câu tóm tắt những gì khác giữa hai cấu hình (vd. "Đổi tiêu đề thành “…”, bật mã số thuế, tắt cột Lô").
 * `before` null = trước đó chưa có cấu hình (so với mặc định do nơi gọi truyền vào).
 * Không khác gì -> "Lưu lại, không đổi nội dung".
 */
export function summarizeChanges(schema, before, after) {
    if (!schema || !after) return "";
    if (!before) return "Lưu lần đầu";
    const a = normalizeConfig(schema, before);
    const b = normalizeConfig(schema, after);
    const docNoun = schema.docNoun ?? "phiếu";
    const parts = [];

    if (a.paperSize !== b.paperSize) parts.push(`chuyển sang khổ ${b.paperSize}`);
    if (!isThermalPaper(b.paperSize) && !isThermalPaper(a.paperSize)) {
        if (a.orientation !== b.orientation) parts.push(`đổi hướng giấy sang ${optionLabel(ORIENTATION_OPTIONS, b.orientation)}`);
        if (a.margin !== b.margin) parts.push(`đổi lề giấy sang ${optionLabel(MARGIN_OPTIONS, b.margin)}`);
    }
    if (getFontSize(a) !== getFontSize(b)) parts.push(`đổi cỡ chữ sang ${optionLabel(FONT_SIZE_OPTIONS, getFontSize(b))}`);
    if ((a.accentColor ?? "").toLowerCase() !== (b.accentColor ?? "").toLowerCase()) parts.push(`đổi màu tên ${docNoun}`);

    const titleA = getDocTitle(schema, a);
    const titleB = getDocTitle(schema, b);
    if (titleA.toLocaleUpperCase("vi") !== titleB.toLocaleUpperCase("vi")) {
        parts.push(titleB === schema.docTitle ? "trả tiêu đề về tên gốc" : `đổi tiêu đề thành “${titleB}”`);
    }

    const codeA = getDocCodeMode(a);
    const codeB = getDocCodeMode(b);
    if (codeA !== codeB) {
        parts.push(
            codeB === "ma_vach" ? `in mã vạch số ${docNoun}` : codeB === "ma_qr" ? `in mã QR số ${docNoun}` : `bỏ mã số ${docNoun}`
        );
    }

    // Bật/tắt và đổi tên: so từng dòng có mặt ở cả hai bố cục
    const rowsA = new Map(buildEditorGroups(schema, a).flatMap((group) => group.rows).map((row) => [row.id, row]));
    const turnedOn = [];
    const turnedOff = [];
    const renamed = [];
    for (const row of buildEditorGroups(schema, b).flatMap((group) => group.rows)) {
        const old = rowsA.get(row.id);
        if (!old) continue;
        if (!row.locked && old.on !== row.on) (row.on ? turnedOn : turnedOff).push(row.summaryName);
        if (row.labelKey && old.label !== row.label) renamed.push({ from: old.label, to: row.label });
    }
    if (turnedOn.length) parts.push(`bật ${listNames(turnedOn)}`);
    if (turnedOff.length) parts.push(`tắt ${listNames(turnedOff)}`);
    if (renamed.length === 1) parts.push(`đổi tên “${renamed[0].from}” thành “${renamed[0].to}”`);
    else if (renamed.length > 1) parts.push(`đổi tên ${renamed.length} nhãn`);

    const footerA = getFooterNoteDraft(schema, a).trim();
    const footerB = getFooterNoteDraft(schema, b).trim();
    if (footerA !== footerB) {
        parts.push(!footerB ? `bỏ lời chân ${docNoun}` : !footerA ? `thêm lời chân ${docNoun}` : `sửa lời chân ${docNoun}`);
    }

    const text = parts.length ? parts.join(", ") : "lưu lại, không đổi nội dung";
    return text.charAt(0).toLocaleUpperCase("vi") + text.slice(1);
}

/** Giá trị đọc theo đường dẫn — cho ô nhập của trình sửa. */
export { readPath };
