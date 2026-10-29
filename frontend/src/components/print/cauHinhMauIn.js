/**
 * Cấu hình mẫu in — các hàm THUẦN (không gọi máy chủ) dùng chung cho service, trình sửa mẫu,
 * trang in thật và kiểm thử. Chỉ import đường dẫn tương đối để chạy được bằng `node --test`.
 *
 * Tùy chỉnh không thuộc section nào nằm ở `sections._tuyChinh` (CUSTOM_SECTION_KEY):
 * - loiChanPhieu: lời chân phiếu (chuỗi; rỗng = không in)
 * - tieuDe:       tên chứng từ tự đặt (để trống = tên gốc của loại chứng từ)
 * - coChu:        "nho" | "vua" | "lon"
 * - maSoPhieu:    "khong" | "ma_vach" | "ma_qr" (mã của số phiếu ở đầu phiếu / cuối hóa đơn nhiệt)
 * - nhan:         { "<khóa section>.<khóa mục>": "nhãn tự đặt" }
 * Thiếu khóa = dùng mặc định, nên cấu hình lưu trước khi có tùy chỉnh vẫn in y như cũ.
 */
import { isThermalPaper } from "./paperStyles.js";
import {
    CUSTOM_SECTION_KEY,
    DEFAULT_DOC_CODE,
    DEFAULT_FONT_SIZE,
    DOC_CODE_OPTIONS,
    FONT_SIZE_OPTIONS,
    NOTES_LABEL_ITEM,
    labelKey,
} from "./schemas/printSchemas.js";

export const CONFIG_VERSION = 2;

export const DEFAULT_ACCENT_COLOR = "#0F2A43";

/** Mặc định bật trừ khi schema khai báo `defaultOn: false`. */
const isOnByDefault = (item) => item.defaultOn !== false;

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * Merge đệ quy: giá trị đã lưu đè lên mặc định, bù các trường mới được thêm sau này để cấu hình cũ
 * không bị vỡ.
 */
export function deepMerge(base, over) {
    const result = { ...base };
    if (!isPlainObject(over)) return result;
    for (const [key, value] of Object.entries(over)) {
        if (value === undefined) continue;
        const baseValue = base?.[key];
        result[key] = isPlainObject(baseValue) && isPlainObject(value) ? deepMerge(baseValue, value) : value;
    }
    return result;
}

/**
 * Sinh cấu hình mặc định đầy đủ cho một mẫu từ schema: bật các section / field / cột theo khai báo
 * của loại chứng từ đó (trừ mục `defaultOn: false`, vd. ô ký Kế toán, trạng thái trên phiếu gửi khách).
 */
export function buildDefaultTemplateConfig(schema, templateDef) {
    const sections = {};
    for (const section of schema.sections) {
        if (section.type === "info") {
            sections[section.key] = Object.fromEntries(
                section.fields.map((field) => [field.key, isOnByDefault(field)])
            );
        } else if (section.type === "items") {
            sections[section.key] = {
                show: section.defaultShow !== false,
                showTotal: Boolean(section.totals?.length),
            };
        } else if (section.type === "summary") {
            sections[section.key] = Object.fromEntries([
                ...section.rows.map((row) => [row.key, isOnByDefault(row)]),
                ...(section.words ? [[section.words.key, isOnByDefault(section.words)]] : []),
            ]);
        } else if (section.type === "notes") {
            sections[section.key] = { show: true };
        } else if (section.type === "signatures") {
            sections[section.key] = Object.fromEntries(
                section.blocks.map((block) => [block.key, isOnByDefault(block)])
            );
        }
    }

    const columns = {};
    for (const section of schema.sections) {
        if (section.type !== "items") continue;
        for (const column of [...section.columns, ...(section.compactColumns ?? [])]) {
            if (!(column.key in columns)) columns[column.key] = isOnByDefault(column);
        }
    }

    const config = {
        version: CONFIG_VERSION,
        documentType: schema.key,
        id: templateDef.id,
        name: templateDef.name,
        paperSize: templateDef.paperSize,
        orientation: templateDef.orientation,
        margin: templateDef.margin,
        accentColor: DEFAULT_ACCENT_COLOR,
        branding: {
            showLogo: true,
            showCompanyName: true,
            showTaxCode: true,
            showEmail: true,
            showPhone: true,
            showAddress: true,
        },
        sections,
        columns,
    };
    // Mặc định riêng của mẫu (vd. K80 gọn cho quầy) ghi đè "bật tất cả"
    return templateDef.defaults ? deepMerge(config, templateDef.defaults) : config;
}

/**
 * Ép các trường THIẾT YẾU (bảng hàng, cột tên hàng/SKU/số lượng/tiền, tổng chính) luôn hiển thị —
 * ngăn cấu hình khiến chứng từ in ra không thể nhận diện hoặc đối chiếu (kể cả cấu hình cũ đã lưu
 * trước khi có ràng buộc). Sửa trực tiếp `config` và trả lại chính nó.
 */
export function applyEssentials(schema, config) {
    config.sections = isPlainObject(config.sections) ? config.sections : {};
    config.columns = isPlainObject(config.columns) ? config.columns : {};
    for (const section of schema.sections) {
        // Chỉ section BẢNG mới có danh sách cột — section "info" dùng `columns` là SỐ cột của lưới
        const tableColumns =
            section.type === "items" ? [...(section.columns ?? []), ...(section.compactColumns ?? [])] : [];
        for (const column of tableColumns) {
            if (column.essential) config.columns = { ...config.columns, [column.key]: true };
        }
        if (section.essentialShow) {
            config.sections[section.key] = { ...config.sections[section.key], show: true };
        }
        for (const field of [...(section.fields ?? []), ...(section.rows ?? [])]) {
            if (field.essential) {
                config.sections[section.key] = { ...config.sections[section.key], [field.key]: true };
            }
        }
    }
    return config;
}

/** Chỉ giữ các trường server lưu (bỏ documentType/id/version…). */
export const toServerConfig = (config) => ({
    name: config.name,
    paperSize: config.paperSize,
    orientation: config.orientation,
    margin: config.margin,
    accentColor: config.accentColor,
    branding: config.branding ?? {},
    sections: config.sections ?? {},
    columns: config.columns ?? {},
});

export const fromServerConfig = (saved) => ({
    name: saved.name,
    paperSize: saved.paperSize,
    orientation: saved.orientation,
    margin: saved.margin,
    accentColor: saved.accentColor,
    branding: saved.branding ?? {},
    sections: saved.sections ?? {},
    columns: saved.columns ?? {},
});

/**
 * Cấu hình đầy đủ từ một bản đã lưu trên server (bảng cấu hình hoặc ảnh chụp trong lịch sử):
 * merge đè lên mặc định của đúng biến thể khổ giấy rồi ép trường thiết yếu.
 * null khi định danh mẫu không còn trong registry (không đoán sang mẫu khác).
 */
export function configFromSaved(schema, templateId, saved) {
    const def = schema?.templates.find((template) => template.id === templateId);
    if (!def || !isPlainObject(saved)) return null;
    const merged = deepMerge(buildDefaultTemplateConfig(schema, def), fromServerConfig(saved));
    // Khổ giấy luôn theo định danh mẫu (server cũng chặn lệch khổ ↔ định danh)
    merged.paperSize = def.paperSize;
    // Mã màu viết hoa như ô chọn màu ghi ra: "#0f2a43" của mẫu cũ vẫn khớp màu gợi ý "#0F2A43"
    if (typeof merged.accentColor === "string") merged.accentColor = merged.accentColor.toUpperCase();
    if (isThermalPaper(def.paperSize)) merged.orientation = "portrait";
    return applyEssentials(schema, structuredClone(merged));
}

/**
 * Biến thể khổ giấy ĐANG DÙNG cho in thật của một loại chứng từ (mô hình MỘT MẪU):
 * - có cấu hình đã lưu -> biến thể đang áp dụng theo bảng server nếu nó có cấu hình lưu, ngược lại
 *   biến thể đã lưu đầu tiên;
 * - chưa lưu gì -> mẫu mặc định của registry.
 * Chỉ xét các định danh có trong registry (bỏ qua dữ liệu lạ trên server).
 */
export function resolveInUseTemplateId(bundle, schema) {
    if (!schema) return null;
    const registryIds = new Set(schema.templates.map((template) => template.id));
    const savedIds = (bundle?.configs ?? [])
        .filter((config) => config.documentType === schema.key && registryIds.has(config.templateId))
        .map((config) => config.templateId);
    const activeId = bundle?.active?.[schema.key];
    if (savedIds.length > 0) {
        return savedIds.includes(activeId) ? activeId : savedIds[0];
    }
    return (schema.templates.find((template) => template.isDefault) ?? schema.templates[0])?.id ?? null;
}

/**
 * Đổi khổ giấy trong trình sửa = đổi BIẾN THỂ nhưng GIỮ tùy chỉnh của bản nháp:
 * - Cùng nhóm khổ tờ (A4 <-> A5) hoặc cùng khổ nhiệt (K80 <-> K57): giữ màu nhấn, thương hiệu,
 *   section/field, cột, lề, hướng giấy và mọi tùy chỉnh (tiêu đề, nhãn, cỡ chữ, mã số phiếu, lời chân).
 * - Qua lại khổ nhiệt và khổ tờ: bố cục khác hẳn nên section/cột lấy theo MẶC ĐỊNH của khổ đích;
 *   vẫn giữ màu nhấn, thương hiệu, tên và tùy chỉnh chung.
 * - Tên mẫu: còn là tên mặc định của khổ cũ -> dùng tên mặc định của khổ mới; tên riêng -> giữ.
 * - Khổ nhiệt luôn khổ dọc.
 * Trả null nếu loại chứng từ không hỗ trợ khổ giấy đích.
 */
export function buildVariantFromDraft(schema, draft, targetPaper) {
    const targetDef = schema.templates.find((template) => template.paperSize === targetPaper);
    if (!targetDef || !draft) return null;
    const sourceDef = schema.templates.find((template) => template.id === draft.id);
    const customName = draft.name?.trim() && draft.name !== sourceDef?.name;
    const crossesThermal = isThermalPaper(draft.paperSize) !== isThermalPaper(targetPaper);
    const carried = {
        name: customName ? draft.name : targetDef.name,
        accentColor: draft.accentColor,
        branding: draft.branding,
    };
    if (!crossesThermal) {
        Object.assign(carried, {
            orientation: isThermalPaper(targetPaper) ? "portrait" : draft.orientation,
            margin: draft.margin,
            sections: draft.sections,
            columns: draft.columns,
        });
    } else if (isPlainObject(draft.sections?.[CUSTOM_SECTION_KEY])) {
        carried.sections = { [CUSTOM_SECTION_KEY]: draft.sections[CUSTOM_SECTION_KEY] };
    }
    const next = deepMerge(buildDefaultTemplateConfig(schema, targetDef), carried);
    return applyEssentials(schema, structuredClone(next));
}

// ── Nhãn đổi tên được ─────────────────────────────────────────────────────────

/**
 * Các nhãn in trên giấy mà người dùng đổi tên được, theo bố cục của khổ giấy:
 * Map "<section>.<mục>" -> nhãn gốc. Không gồm nhãn tự đổi theo dữ liệu (labelModelPath),
 * cột in ở dòng phụ (inline, trừ cột in kèm nhãn — inlineLabel) hay gắn sau cột khác (inlineIn), dòng tổng
 * in sau nhãn dòng khác (attachTo) — những mục này không in nhãn riêng.
 */
export function getRenameableLabels(schema, compact) {
    const labels = new Map();
    if (!schema) return labels;
    for (const section of schema.sections) {
        if (compact && section.compactHidden) continue;
        if (section.type === "info") {
            for (const field of section.fields) {
                if (field.labelModelPath) continue;
                if ((field.compactOnly && !compact) || (field.compactHidden && compact)) continue;
                labels.set(labelKey(section.key, field.key), field.label);
            }
        } else if (section.type === "items") {
            const columns = compact && section.compactColumns ? section.compactColumns : section.columns;
            for (const column of columns) {
                if ((column.inline && !column.inlineLabel) || column.inlineIn) continue;
                labels.set(labelKey(section.key, column.key), column.label);
            }
        } else if (section.type === "summary") {
            for (const row of section.rows) {
                if (!row.attachTo) labels.set(labelKey(section.key, row.key), row.label);
            }
            if (section.words) labels.set(labelKey(section.key, section.words.key), section.words.label);
        } else if (section.type === "notes") {
            labels.set(labelKey(section.key, NOTES_LABEL_ITEM), section.title);
        } else if (section.type === "signatures") {
            for (const block of section.blocks) labels.set(labelKey(section.key, block.key), block.label);
        }
    }
    return labels;
}

/** Các khóa hợp lệ trong `sections._tuyChinh`. */
export const CUSTOM_OPTION_KEYS = ["loiChanPhieu", "tieuDe", "coChu", "maSoPhieu", "nhan"];

const FONT_SIZE_VALUES = new Set(FONT_SIZE_OPTIONS.map((option) => option.value));
const DOC_CODE_VALUES = new Set(DOC_CODE_OPTIONS.map((option) => option.value));

/** Các mục thương hiệu ở đầu phiếu (khớp buildDefaultTemplateConfig / PrintHeader). */
const BRANDING_KEYS = ["showLogo", "showCompanyName", "showTaxCode", "showEmail", "showPhone", "showAddress"];

/**
 * Bỏ các khóa cấu hình KHÔNG còn tác dụng với bố cục hiện tại của loại chứng từ: section / mục / cột
 * đã bỏ khỏi schema (vd. "Số phiếu", "Ngày lập" cũ nay in ở đầu phiếu), dòng tổng của bảng không có
 * dòng tổng, mục thương hiệu lạ; khổ nhiệt luôn dọc và lề nhiệt cố định nên hướng / lề không tính.
 * Cấu hình lưu từ phiên bản cũ nhờ vậy không bị coi là "đã chỉnh" chỉ vì khóa thừa. Sửa trực tiếp `next`.
 */
function pruneInactiveKeys(schema, next) {
    if (!schema?.sections) return;
    const sections = {};
    const columns = new Set();
    for (const section of schema.sections) {
        let keys = null;
        if (section.type === "info") keys = section.fields.map((field) => field.key);
        else if (section.type === "items") {
            keys = ["show", ...(section.totals?.length ? ["showTotal"] : [])];
            for (const column of [...(section.columns ?? []), ...(section.compactColumns ?? [])]) columns.add(column.key);
        } else if (section.type === "summary") {
            keys = [...section.rows.map((row) => row.key), ...(section.words ? [section.words.key] : [])];
        } else if (section.type === "notes") keys = ["show"];
        else if (section.type === "signatures") keys = section.blocks.map((block) => block.key);
        const current = next.sections[section.key];
        if (!isPlainObject(current)) continue;
        sections[section.key] = keys
            ? Object.fromEntries(Object.entries(current).filter(([key]) => keys.includes(key)))
            : current;
    }
    if (CUSTOM_SECTION_KEY in next.sections) sections[CUSTOM_SECTION_KEY] = next.sections[CUSTOM_SECTION_KEY];
    next.sections = sections;
    if (isPlainObject(next.columns)) {
        next.columns = Object.fromEntries(Object.entries(next.columns).filter(([key]) => columns.has(key)));
    }
    if (isPlainObject(next.branding)) {
        next.branding = Object.fromEntries(Object.entries(next.branding).filter(([key]) => BRANDING_KEYS.includes(key)));
    }
    if (isThermalPaper(next.paperSize)) {
        const def = schema.templates?.find((template) => template.id === next.id);
        next.orientation = "portrait";
        next.margin = def?.margin ?? "default";
    }
}

/**
 * Chuẩn hóa trước khi lưu và trước khi so sánh "có thay đổi": bỏ khóa không còn tác dụng
 * (pruneInactiveKeys), bỏ khoảng trắng thừa, bỏ tùy chỉnh trùng mặc định (tiêu đề = tên gốc, nhãn =
 * nhãn gốc, cỡ chữ Vừa, không in mã, lời chân = lời chân mặc định) và nhãn của mục không còn trên bố
 * cục. Nhờ vậy "không tùy chỉnh gì" luôn ra đúng cấu hình mặc định. Trả bản sao, không sửa `config`.
 */
export function normalizeConfig(schema, config) {
    if (!config) return config;
    const next = structuredClone(config);
    // "#0f2a43" và "#0F2A43" là một màu — không tính là thay đổi
    if (typeof next.accentColor === "string") next.accentColor = next.accentColor.toUpperCase();
    next.sections = isPlainObject(next.sections) ? next.sections : {};
    pruneInactiveKeys(schema, next);
    const saved = next.sections[CUSTOM_SECTION_KEY];
    if (!isPlainObject(saved)) {
        delete next.sections[CUSTOM_SECTION_KEY];
        return next;
    }
    // Chỉ giữ các khóa máy chủ chấp nhận (CauHinhMauInService kiểm tra đúng danh sách này)
    const custom = Object.fromEntries(CUSTOM_OPTION_KEYS.filter((key) => key in saved).map((key) => [key, saved[key]]));

    if (typeof custom.tieuDe === "string") {
        const title = custom.tieuDe.trim();
        if (!title || title.toLocaleUpperCase("vi") === (schema?.docTitle ?? "").toLocaleUpperCase("vi")) {
            delete custom.tieuDe;
        } else {
            custom.tieuDe = title;
        }
    } else {
        delete custom.tieuDe;
    }

    if (!FONT_SIZE_VALUES.has(custom.coChu) || custom.coChu === DEFAULT_FONT_SIZE) delete custom.coChu;
    if (!DOC_CODE_VALUES.has(custom.maSoPhieu) || custom.maSoPhieu === DEFAULT_DOC_CODE) delete custom.maSoPhieu;

    if (typeof custom.loiChanPhieu !== "string" || custom.loiChanPhieu === (schema?.footerNote ?? "")) {
        delete custom.loiChanPhieu;
    }

    if (isPlainObject(custom.nhan)) {
        const defaults = getRenameableLabels(schema, isThermalPaper(next.paperSize));
        const labels = {};
        for (const [key, value] of Object.entries(custom.nhan)) {
            if (typeof value !== "string" || !defaults.has(key)) continue;
            const label = value.trim();
            if (label && label !== defaults.get(key)) labels[key] = label;
        }
        if (Object.keys(labels).length > 0) custom.nhan = labels;
        else delete custom.nhan;
    } else {
        delete custom.nhan;
    }

    if (Object.keys(custom).length > 0) next.sections[CUSTOM_SECTION_KEY] = custom;
    else delete next.sections[CUSTOM_SECTION_KEY];
    return next;
}

/** JSON với khóa sắp theo thứ tự — so sánh hai cấu hình không phụ thuộc thứ tự khóa. */
export function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (isPlainObject(value)) {
        return `{${Object.keys(value)
            .filter((key) => value[key] !== undefined)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
            .join(",")}}`;
    }
    return JSON.stringify(value ?? null);
}

/**
 * Hai cấu hình in ra giống hệt nhau (sau chuẩn hóa)? Tên mẫu là tên nội bộ, không in và không sửa ở
 * trình sửa (đổi theo khổ giấy) nên không tính.
 */
export function sameConfig(schema, a, b) {
    if (!a || !b) return a === b;
    const comparable = (config) => {
        const normalized = normalizeConfig(schema, config);
        delete normalized.name;
        return stableStringify(normalized);
    };
    return comparable(a) === comparable(b);
}

