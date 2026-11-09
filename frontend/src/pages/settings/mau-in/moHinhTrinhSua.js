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
import { t } from "../../../i18n/t.js";

export const GROUP_LAYOUT = "trinhBay";
export const GROUP_HEADER = "dau";
export const GROUP_FOOTER = "chan";

/** Thương hiệu ở đầu phiếu — thứ tự như trên giấy. */
const BRANDING_ROWS = [
    { key: "showLogo", label: "Logo" },
    { key: "showCompanyName", label: t("Tên cửa hàng") },
    // Cùng một dòng trên đầu phiếu "{tên đăng ký kinh doanh} · MST: …" (PrintHeader); giữ khóa showTaxCode cho mẫu đã lưu
    {
        key: "showTaxCode",
        // Không dùng dấu phẩy: câu tóm tắt lịch sử ghép các mục bằng ", … và …"
        label: t("Tên đăng ký kinh doanh · Mã số thuế"),
        hint: t("In khi Thông tin cửa hàng có tên đăng ký kinh doanh hoặc mã số thuế"),
    },
    { key: "showAddress", label: t("Địa chỉ") },
    { key: "showPhone", label: t("Điện thoại") },
    { key: "showEmail", label: "Email" },
];

export const MARGIN_OPTIONS = [
    { value: "narrow", label: t("Hẹp") },
    { value: "default", label: t("Vừa") },
    { value: "wide", label: t("Rộng") },
];

export const ORIENTATION_OPTIONS = [
    { value: "portrait", label: t("Dọc") },
    { value: "landscape", label: t("Ngang") },
];

/**
 * Màu tên chứng từ gợi ý — màu tối để in trắng đen vẫn ra xám đậm, đọc rõ. Mẫu cũ có màu khác
 * vẫn giữ nguyên (ô "Màu khác").
 */
export const ACCENT_PRESETS = [
    { value: "#0F2A43", label: t("Xanh than") },
    { value: "#111827", label: t("Đen") },
    { value: "#1D4ED8", label: t("Xanh dương") },
    { value: "#7C2D12", label: t("Nâu đỏ") },
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
                // Mã vạch không in nhãn nên không có ô đổi tên
                labelKeyValue: field.labelModelPath || field.kind === "barcode" ? null : labelKey(section.key, field.key),
                locked: Boolean(field.essential),
                hint: field.labelModelPath ? field.hint ?? t("Nhãn tự đổi theo dữ liệu của {{docNoun}}", { docNoun }) : field.hint,
                on: sectionConfig[field.key] !== false,
            })
        );
}

function itemsRows(section, config, compact, docNoun) {
    const sectionConfig = config.sections?.[section.key] ?? {};
    const rows = [];
    // Bảng đang tắt: cột và dòng tổng của bảng không in (khóa lại, không tính vào số mục)
    const tableOn = Boolean(section.essentialShow) || sectionConfig.show !== false;
    const tableOffHint = t("Chỉ in khi bật “In bảng này”");
    if (!section.essentialShow) {
        rows.push(
            makeRow(config, {
                id: labelKey(section.key, "$show"),
                path: `sections.${section.key}.show`,
                defaultLabel: t("In bảng này"),
                hint: section.hint,
                on: sectionConfig.show !== false,
                summaryName: () => t("bảng {{title}}", { title: t(section.title) }),
            })
        );
    }
    const columns = compact && section.compactColumns ? section.compactColumns : section.columns;
    for (const column of columns) {
        // Cột in ở dòng phụ không có nhãn riêng — trừ cột in kèm nhãn ("Đơn giá 120.000 ₫")
        const renameable = (!column.inline || Boolean(column.inlineLabel)) && !column.inlineIn;
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
                    ? t("In ở dòng phụ dưới tên hàng")
                    : column.inlineIn
                      ? null
                      : column.hideWhenAllEmpty
                        ? t("Tự ẩn khi cả {{docNoun}} không có số liệu ở cột này", { docNoun })
                        : null,
                on: config.columns?.[column.key] !== false,
                inactive: !tableOn || !hostOn,
                inactiveHint: !tableOn ? tableOffHint : t("Chỉ in khi bật cột {{hostLabel}}", { hostLabel }),
                summaryName: (label) => (renameable ? t("cột {{label}}", { label }) : label),
            })
        );
    }
    if (section.totals?.length) {
        rows.push(
            makeRow(config, {
                id: labelKey(section.key, "$total"),
                path: `sections.${section.key}.showTotal`,
                defaultLabel: t("Dòng tổng cuối bảng"),
                on: sectionConfig.showTotal !== false,
                inactive: !tableOn,
                inactiveHint: tableOffHint,
                summaryName: () => t("dòng tổng cuối bảng"),
            })
        );
    }
    return rows;
}

function summaryRows(section, config) {
    const sectionConfig = config.sections?.[section.key] ?? {};
    const isOn = (row) => Boolean(row.essential) || sectionConfig[row.key] !== false;
    const labelOf = (row) => getCustomLabel(config, labelKey(section.key, row.key)) ?? row.label;
    const rows = section.rows.map((row, index) => {
        const sameAs = row.hideWhenSameAs ? section.rows.find((other) => other.modelPath === row.hideWhenSameAs) : null;
        // Mục in trong ngoặc sau nhãn dòng khác (thuế suất sau "Thuế GTGT"): dòng đó tắt thì mục này không in
        const host = row.attachTo ? section.rows.find((other) => other.key === row.attachTo) : null;
        // Dòng chú thích chỉ in khi còn dòng con ngay sau nó đang bật
        const subs = [];
        for (let next = index + 1; row.note && section.rows[next]?.sub; next += 1) subs.push(section.rows[next]);
        const needed = host ? [host] : subs;
        const inactive = needed.length > 0 && !needed.some(isOn);
        return makeRow(config, {
            id: labelKey(section.key, row.key),
            path: `sections.${section.key}.${row.key}`,
            defaultLabel: row.label,
            labelKeyValue: host ? null : labelKey(section.key, row.key),
            locked: Boolean(row.essential),
            hint: host
                ? t("In trong ngoặc sau nhãn {{host}}", { host: labelOf(host) })
                : row.hint ??
                  (sameAs ? t("Tự ẩn khi bằng {{nhan}}", { nhan: sameAs.label.toLocaleLowerCase("vi") }) : row.hideWhenZero ? t("Tự ẩn khi bằng 0") : null),
            on: sectionConfig[row.key] !== false,
            inactive,
            inactiveHint: t("Chỉ in khi bật {{danhSach}}", { danhSach: needed.map(labelOf).join(t(" hoặc ")) }),
            // Nhãn chú thích có dấu phẩy, dấu hai chấm — tên ngắn để câu tóm tắt lịch sử không rối
            summaryName: row.note ? () => t("dòng chú thích thuế GTGT") : undefined,
        });
    });
    if (section.words) {
        rows.push(
            makeRow(config, {
                id: labelKey(section.key, section.words.key),
                path: `sections.${section.key}.${section.words.key}`,
                defaultLabel: section.words.label,
                labelKeyValue: labelKey(section.key, section.words.key),
                hint: t("Số tiền tổng viết bằng chữ"),
                on: sectionConfig[section.words.key] !== false,
                summaryName: () => t("số tiền bằng chữ"),
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
            hint: t("{{docNoun}} không có ghi chú thì không in dòng này", { docNoun: `${docNoun.charAt(0).toLocaleUpperCase("vi")}${docNoun.slice(1)}` }),
            on: sectionConfig.show !== false,
            summaryName: (label) => t("dòng {{nhan}}", { nhan: label.toLocaleLowerCase("vi") }),
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
            summaryName: (label) => t("ô ký {{label}}", { label }),
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
    const docNoun = t(schema.docNoun ?? "phiếu", { context: "mau_in" });
    const groups = [
        { key: GROUP_LAYOUT, title: t("Khổ giấy và trình bày"), kind: "layout", rows: [] },
        { key: GROUP_HEADER, title: t("Đầu {{docNoun}}", { docNoun }), kind: "header", rows: brandingRows(config) },
    ];
    for (const section of schema.sections) {
        if (compact && section.compactHidden) continue;
        let rows = [];
        if (section.type === "info") rows = infoRows(section, config, compact, docNoun);
        else if (section.type === "items") rows = itemsRows(section, config, compact, docNoun);
        else if (section.type === "summary") rows = summaryRows(section, config);
        else if (section.type === "notes") rows = notesRows(section, config, docNoun);
        else if (section.type === "signatures") rows = signatureRows(section, config);
        groups.push({ key: section.key, title: t(section.title), kind: section.type, rows });
    }
    groups.push({ key: GROUP_FOOTER, title: t("Chân {{docNoun}}", { docNoun }), kind: "footer", rows: [] });
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
    t(options.find((option) => option.value === value)?.label ?? String(value ?? "")).toLocaleLowerCase("vi");

/** "A, B và C"; quá `max` mục thì "A, B và 3 mục khác". */
function listNames(names, max = 3) {
    if (names.length <= max) {
        return names.length <= 1 ? names.join("") : t("{{dauDanhSach}} và {{cuoi}}", { dauDanhSach: names.slice(0, -1).join(", "), cuoi: names[names.length - 1] });
    }
    return t("{{dauDanhSach}} và {{count}} mục khác", { dauDanhSach: names.slice(0, max - 1).join(", "), count: names.length - (max - 1) });
}

/**
 * Câu tóm tắt những gì khác giữa hai cấu hình (vd. "Đổi tiêu đề thành “…”, bật mã số thuế, tắt cột Lô").
 * `before` null = trước đó chưa có cấu hình (so với mặc định do nơi gọi truyền vào).
 * Không khác gì -> "Lưu lại, không đổi nội dung".
 */
export function summarizeChanges(schema, before, after) {
    if (!schema || !after) return "";
    if (!before) return t("Lưu lần đầu");
    const a = normalizeConfig(schema, before);
    const b = normalizeConfig(schema, after);
    const docNoun = t(schema.docNoun ?? "phiếu", { context: "mau_in" });
    const parts = [];

    if (a.paperSize !== b.paperSize) parts.push(t("chuyển sang khổ {{paperSize}}", { paperSize: b.paperSize }));
    if (!isThermalPaper(b.paperSize) && !isThermalPaper(a.paperSize)) {
        if (a.orientation !== b.orientation) parts.push(t("đổi hướng giấy sang {{huong}}", { huong: optionLabel(ORIENTATION_OPTIONS, b.orientation) }));
        if (a.margin !== b.margin) parts.push(t("đổi lề giấy sang {{le}}", { le: optionLabel(MARGIN_OPTIONS, b.margin) }));
    }
    if (getFontSize(a) !== getFontSize(b)) parts.push(t("đổi cỡ chữ sang {{coChu}}", { coChu: optionLabel(FONT_SIZE_OPTIONS, getFontSize(b)) }));
    if ((a.accentColor ?? "").toLowerCase() !== (b.accentColor ?? "").toLowerCase()) parts.push(t("đổi màu tên {{docNoun}}", { docNoun }));

    const titleA = getDocTitle(schema, a);
    const titleB = getDocTitle(schema, b);
    if (titleA.toLocaleUpperCase("vi") !== titleB.toLocaleUpperCase("vi")) {
        parts.push(titleB === schema.docTitle ? t("trả tiêu đề về tên gốc") : t("đổi tiêu đề thành “{{tieuDe}}”", { tieuDe: titleB }));
    }

    const codeA = getDocCodeMode(a);
    const codeB = getDocCodeMode(b);
    if (codeA !== codeB) {
        parts.push(
            codeB === "ma_vach" ? t("in mã vạch số {{docNoun}}", { docNoun }) : codeB === "ma_qr" ? t("in mã QR số {{docNoun}}", { docNoun }) : t("bỏ mã số {{docNoun}}", { docNoun })
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
    if (turnedOn.length) parts.push(t("bật {{danhSach}}", { danhSach: listNames(turnedOn) }));
    if (turnedOff.length) parts.push(t("tắt {{danhSach}}", { danhSach: listNames(turnedOff) }));
    if (renamed.length === 1) parts.push(t("đổi tên “{{from}}” thành “{{to}}”", { from: renamed[0].from, to: renamed[0].to }));
    else if (renamed.length > 1) parts.push(t("đổi tên {{count}} nhãn", { count: renamed.length }));

    const footerA = getFooterNoteDraft(schema, a).trim();
    const footerB = getFooterNoteDraft(schema, b).trim();
    if (footerA !== footerB) {
        parts.push(!footerB ? t("bỏ lời chân {{docNoun}}", { docNoun }) : !footerA ? t("thêm lời chân {{docNoun}}", { docNoun }) : t("sửa lời chân {{docNoun}}", { docNoun }));
    }

    const text = parts.length ? parts.join(", ") : t("lưu lại, không đổi nội dung");
    return text.charAt(0).toLocaleUpperCase("vi") + text.slice(1);
}

/** Giá trị đọc theo đường dẫn — cho ô nhập của trình sửa. */
export { readPath };
