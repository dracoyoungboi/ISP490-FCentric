/**
 * Cấu hình mẫu in — MỖI LOẠI CHỨNG TỪ MỘT BỘ CẤU HÌNH RIÊNG.
 *
 * Lưu trữ SERVER-SIDE (bảng cau_hinh_mau_in + mau_in_dang_ap_dung):
 * - Mỗi biến thể khổ giấy (A4/A5/K80) có định danh riêng; khổ giấy luôn
 *   khớp hậu tố của định danh nên A5 không thể lưu dưới id A4 (backend
 *   cũng chặn bằng validate).
 * - "Mẫu đang áp dụng" = active map từ server (đúng 1 mẫu/loại chứng từ) —
 *   nguồn sự thật duy nhất cho badge "Đang áp dụng" và luồng in thật.
 *   Không còn isDefault đa trị ở client.
 *
 * Service là lớp trừu tượng duy nhất mà editor / trang cấu hình / trang in
 * thật sử dụng. Dữ liệu localStorage cũ (fcentric.printTemplateConfigs.v2)
 * được migrate một lần lên server khi mở trang cấu hình — server chỉ nhận
 * dữ liệu của loại chứng từ CHƯA có cấu hình, không bao giờ ghi đè.
 */
import apiClient from "./apiClient";
import {
    getPrintSchema,
    PRINT_SCHEMAS,
} from "@/components/print/schemas/printSchemas";

export const CONFIG_VERSION = 2;
const LEGACY_STORAGE_KEY = "fcentric.printTemplateConfigs.v2";
const MIGRATED_FLAG_KEY = "fcentric.printTemplateConfigs.migrated";

const DEFAULT_ACCENT_COLOR = "#0F2A43";

/**
 * Sinh cấu hình mặc định đầy đủ cho một mẫu từ schema:
 * bật toàn bộ section / field / cột theo khai báo của loại chứng từ đó.
 */
export function buildDefaultTemplateConfig(schema, templateDef) {
    const sections = {};
    for (const section of schema.sections) {
        if (section.type === "info") {
            sections[section.key] = Object.fromEntries(
                section.fields.map((field) => [field.key, true])
            );
        } else if (section.type === "items") {
            sections[section.key] = { show: true, showTotal: Boolean(section.total) };
        } else if (section.type === "notes") {
            sections[section.key] = { show: true };
        } else if (section.type === "signatures") {
            sections[section.key] = Object.fromEntries(
                section.blocks.map((block) => [block.key, true])
            );
        }
    }

    const columns = {};
    for (const section of schema.sections) {
        if (section.type !== "items") continue;
        for (const column of section.columns) {
            columns[column.key] = true;
        }
    }

    return {
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
            showEmail: true,
            showPhone: true,
            showAddress: true,
        },
        sections,
        columns,
    };
}

// Merge đệ quy: giá trị đã lưu đè lên default, bù các trường mới được thêm
// sau này để cấu hình cũ không bị vỡ
const deepMerge = (base, over) => {
    const result = { ...base };
    if (!over || typeof over !== "object") return result;
    for (const [key, value] of Object.entries(over)) {
        if (value === undefined) continue;
        const baseValue = base[key];
        result[key] =
            baseValue && typeof baseValue === "object" && !Array.isArray(baseValue) &&
            value && typeof value === "object" && !Array.isArray(value)
                ? deepMerge(baseValue, value)
                : value;
    }
    return result;
};

// ── Cache bundle server ────────────────────────────────────────────────────

let bundlePromise = null;
let bundleCache = null;

async function loadBundle({ force = false } = {}) {
    if (bundlePromise && !force) return bundlePromise;
    bundlePromise = (async () => {
        const response = await apiClient.get("/api/v1/cau-hinh-mau-in");
        bundleCache = response.data?.data ?? { configs: [], active: {} };
        return bundleCache;
    })().catch((error) => {
        bundlePromise = null; // cho phép thử lại ở lần sau
        throw error;
    });
    return bundlePromise;
}

/** Chỉ giữ các trường server chấp nhận khi lưu (bỏ documentType/id/version...). */
const toServerConfig = (config) => ({
    name: config.name,
    paperSize: config.paperSize,
    orientation: config.orientation,
    margin: config.margin,
    accentColor: config.accentColor,
    branding: config.branding ?? {},
    sections: config.sections ?? {},
    columns: config.columns ?? {},
});

const fromServerConfig = (saved) => ({
    name: saved.name,
    paperSize: saved.paperSize,
    orientation: saved.orientation,
    margin: saved.margin,
    accentColor: saved.accentColor,
    branding: saved.branding ?? {},
    sections: saved.sections ?? {},
    columns: saved.columns ?? {},
});

/** Cấu hình mặc định của một mẫu từ registry — null nếu id không tồn tại. */
const registryDefault = (documentType, templateId) => {
    const schema = getPrintSchema(documentType);
    if (!schema) return null;
    const def = schema.templates.find((template) => template.id === templateId);
    return def ? buildDefaultTemplateConfig(schema, def) : null;
};

/**
 * Ép các trường THIẾT YẾU (số phiếu, bảng hàng hóa) luôn hiển thị — ngăn
 * cấu hình khiến chứng từ in ra không thể nhận diện hoặc đối chiếu.
 */
const applyEssentials = (schema, config) => {
    for (const section of schema.sections) {
        if (section.essentialShow) {
            config.sections[section.key] = { ...config.sections[section.key], show: true };
        }
        for (const field of section.fields ?? []) {
            if (field.essential) {
                config.sections[section.key] = {
                    ...config.sections[section.key],
                    [field.key]: true,
                };
            }
        }
    }
    return config;
};

export const printTemplateConfigService = {
    /** Nạp bundle từ server (cache; force = refetch). */
    load({ force = false } = {}) {
        return loadBundle({ force });
    },

    /**
     * Cấu hình một mẫu cụ thể: bản đã lưu (merge đè lên default của registry)
     * hoặc default nếu chưa từng lưu / sai version.
     * Trả null khi định danh mẫu không có trong registry (không còn âm thầm
     * mở mẫu đầu tiên).
     */
    async getTemplate(documentType, templateId) {
        const schema = getPrintSchema(documentType);
        if (!schema) return null;
        const fallback = registryDefault(documentType, templateId);
        if (!fallback) return null;
        const bundle = await loadBundle();
        const saved = bundle.configs.find(
            (config) =>
                config.documentType === documentType && config.templateId === templateId
        );
        if (!saved || saved.version !== CONFIG_VERSION) return fallback;
        return applyEssentials(schema, deepMerge(fallback, fromServerConfig(saved)));
    },

    /** Toàn bộ mẫu của một loại chứng từ (thứ tự theo registry). */
    async getTemplates(documentType) {
        const schema = getPrintSchema(documentType);
        if (!schema) return [];
        return Promise.all(
            schema.templates.map((def) => this.getTemplate(documentType, def.id))
        );
    },

    /**
     * Cấu hình dùng cho IN THẬT của loại chứng từ — mô hình MỘT MẪU:
     * - có cấu hình đã lưu -> dùng cấu hình đã lưu (của biến thể đang dùng
     *   theo bảng server, hoặc biến thể đã lưu đầu tiên nếu dữ liệu active cũ
     *   không còn khớp — cờ kích hoạt legacy KHÔNG được chặn cấu hình duy nhất);
     * - chưa lưu gì -> dùng mẫu mặc định của registry.
     */
    async getActiveTemplate(documentType) {
        const schema = getPrintSchema(documentType);
        if (!schema) return null;
        const bundle = await loadBundle();
        const saved = bundle.configs.filter(
            (config) => config.documentType === documentType
        );
        const activeId = bundle.active?.[documentType];
        const targetId =
            saved.length > 0
                ? saved.some((config) => config.templateId === activeId)
                    ? activeId
                    : saved[0].templateId
                : (schema.templates.find((template) => template.isDefault) ??
                      schema.templates[0])?.id;
        if (!targetId) return null;
        return this.getTemplate(documentType, targetId);
    },

    /**
     * Khổ giấy hiển thị ban đầu cho một loại chứng từ trên trang xem:
     * khổ của biến thể đang dùng (nếu nó có cấu hình đã lưu), ngược lại
     * khổ của cấu hình đã lưu đầu tiên, ngược lại khổ đầu tiên của loại.
     */
    async getDefaultPaper(documentType) {
        const schema = getPrintSchema(documentType);
        if (!schema) return null;
        const bundle = await loadBundle();
        const saved = bundle.configs.filter(
            (config) => config.documentType === documentType
        );
        if (saved.length === 0) return schema.paperProfiles[0] ?? null;
        const activeId = bundle.active?.[documentType];
        const targetId = saved.some((config) => config.templateId === activeId)
            ? activeId
            : saved[0].templateId;
        return schema.templates.find((template) => template.id === targetId)?.paperSize ?? null;
    },

    /** Lưu cấu hình một biến thể — KHÔNG đổi mẫu đang áp dụng. */
    async saveTemplate(config) {
        const { documentType, id } = config;
        const response = await apiClient.put(
            `/api/v1/cau-hinh-mau-in/${documentType}/${id}`,
            toServerConfig(config)
        );
        await loadBundle({ force: true });
        return response.data?.data ?? null;
    },

    /**
     * Xóa cấu hình đã lưu của biến thể -> quay về mặc định registry.
     * (Không còn dùng trong UI — reset trong editor chỉ đổi bản nháp,
     * lưu mới ghi server. Giữ cho tương thích API.)
     */
    async resetTemplate(documentType, templateId) {
        await apiClient.delete(`/api/v1/cau-hinh-mau-in/${documentType}/${templateId}`);
        await loadBundle({ force: true });
    },

    /**
     * Migrate cấu hình localStorage cũ lên server (một lần).
     * - Mục có id khớp khổ giấy được ưu tiên; mục lệch id↔khổ giấy (bug cũ
     *   đổi khổ giữ id) được chuyển sang đúng biến thể nếu chưa có.
     * - Chỉ xóa localStorage legacy sau khi server trả 200.
     */
    async migrateLegacyLocalIfNeeded() {
        if (window.localStorage.getItem(MIGRATED_FLAG_KEY)) {
            return { migrated: [], skipped: [] };
        }
        const raw = readLegacyStorage();
        if (!raw || Object.keys(raw).length === 0) {
            window.localStorage.setItem(MIGRATED_FLAG_KEY, "true");
            return { migrated: [], skipped: [] };
        }

        const payload = buildMigratePayload(raw);
        if (Object.keys(payload.configs).length === 0) {
            window.localStorage.removeItem(LEGACY_STORAGE_KEY);
            window.localStorage.setItem(MIGRATED_FLAG_KEY, "true");
            return { migrated: [], skipped: [] };
        }

        const response = await apiClient.post("/api/v1/cau-hinh-mau-in/migrate", payload);
        // Server đã nhận (200) — legacy hết giá trị, xóa để không gửi lại
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        window.localStorage.setItem(MIGRATED_FLAG_KEY, "true");
        await loadBundle({ force: true });
        return response.data?.data ?? { migrated: [], skipped: [] };
    },
};

// ── Legacy migration helpers ───────────────────────────────────────────────

const readLegacyStorage = () => {
    try {
        const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const buildMigratePayload = (raw) => {
    const payload = { configs: {}, active: {} };
    for (const schema of Object.values(PRINT_SCHEMAS)) {
        const entries = raw[schema.key];
        if (!entries || typeof entries !== "object") continue;

        const wellKeyed = [];
        const stray = [];
        for (const [templateId, saved] of Object.entries(entries)) {
            const def = schema.templates.find((template) => template.id === templateId);
            if (!def || !saved || typeof saved !== "object") continue;
            if (def.paperSize === saved.paperSize) {
                wellKeyed.push([templateId, def, saved]);
            } else {
                stray.push([def, saved]);
            }
        }

        const merged = {};
        for (const [templateId, def, saved] of wellKeyed) {
            merged[templateId] = toServerConfig(
                deepMerge(buildDefaultTemplateConfig(schema, def), saved)
            );
            if (saved.isDefault && !payload.active[schema.key]) {
                payload.active[schema.key] = templateId;
            }
        }
        for (const [, saved] of stray) {
            const targetDef = schema.templates.find(
                (template) => template.paperSize === saved.paperSize
            );
            if (!targetDef || merged[targetDef.id]) continue;
            merged[targetDef.id] = toServerConfig(
                deepMerge(buildDefaultTemplateConfig(schema, targetDef), saved)
            );
            if (saved.isDefault && !payload.active[schema.key]) {
                payload.active[schema.key] = targetDef.id;
            }
        }

        if (Object.keys(merged).length > 0) {
            payload.configs[schema.key] = merged;
        }
        if (!payload.active[schema.key]) {
            payload.active[schema.key] =
                (schema.templates.find((template) => template.isDefault) ??
                    schema.templates[0])?.id;
        }
    }
    return payload;
};
