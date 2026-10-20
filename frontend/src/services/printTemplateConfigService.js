/**
 * Cấu hình mẫu in — MỖI LOẠI CHỨNG TỪ MỘT BỘ CẤU HÌNH RIÊNG.
 *
 * Lưu trữ SERVER-SIDE (bảng cau_hinh_mau_in + mau_in_dang_ap_dung):
 * - Mỗi biến thể khổ giấy (A4/A5/K80/K57) có định danh riêng; khổ giấy luôn
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
    CONFIG_VERSION,
    buildDefaultTemplateConfig,
    buildVariantFromDraft,
    configFromSaved,
    deepMerge,
    normalizeConfig,
    resolveInUseTemplateId,
    toServerConfig,
} from "@/components/print/cauHinhMauIn";
import {
    getPrintSchema,
    PRINT_SCHEMAS,
} from "@/components/print/schemas/printSchemas";

// Các hàm thuần nằm ở components/print/cauHinhMauIn.js (chạy được bằng node --test);
// giữ lối import cũ từ service cho các trang đang dùng.
export { CONFIG_VERSION, buildDefaultTemplateConfig, buildVariantFromDraft, resolveInUseTemplateId };

const LEGACY_STORAGE_KEY = "fcentric.printTemplateConfigs.v2";
const MIGRATED_FLAG_KEY = "fcentric.printTemplateConfigs.migrated";

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

/** Cấu hình mặc định của một mẫu từ registry — null nếu id không tồn tại. */
const registryDefault = (documentType, templateId) => {
    const schema = getPrintSchema(documentType);
    if (!schema) return null;
    const def = schema.templates.find((template) => template.id === templateId);
    return def ? buildDefaultTemplateConfig(schema, def) : null;
};

/** Ảnh chụp cấu hình trong lịch sử -> cấu hình đầy đủ (null nếu không đọc được / mẫu không còn). */
const configFromSnapshot = (schema, snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return null;
    return configFromSaved(schema, snapshot.templateId, snapshot);
};

export const printTemplateConfigService = {
    /** Nạp bundle từ server (cache; force = refetch). */
    load({ force = false } = {}) {
        return loadBundle({ force });
    },

    /** Định danh biến thể đang dùng cho in thật (xem resolveInUseTemplateId). */
    async getInUseTemplateId(documentType) {
        const schema = getPrintSchema(documentType);
        if (!schema) return null;
        return resolveInUseTemplateId(await loadBundle(), schema);
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
        return configFromSaved(schema, templateId, saved) ?? fallback;
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
        const targetId = resolveInUseTemplateId(await loadBundle(), schema);
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

    /**
     * Lưu cấu hình một biến thể. Mô hình một mẫu: backend ghi luôn biến thể này làm mẫu đang dùng
     * cho in thật và ghi một phiên bản vào lịch sử chỉnh sửa. Tùy chỉnh được chuẩn hóa trước khi gửi
     * (bỏ mục trùng mặc định) để "không tùy chỉnh gì" luôn lưu đúng cấu hình mặc định.
     */
    async saveTemplate(config) {
        const { documentType, id } = config;
        const schema = getPrintSchema(documentType);
        const response = await apiClient.put(
            `/api/v1/cau-hinh-mau-in/${documentType}/${id}`,
            toServerConfig(normalizeConfig(schema, config))
        );
        // Đã lưu xong: nạp lại bundle chỉ để các màn khác thấy ngay — lỗi mạng ở bước này KHÔNG được
        // biến lần lưu thành "không lưu được" (loadBundle tự bỏ cache lỗi, lần sau nạp lại).
        try {
            await loadBundle({ force: true });
        } catch (error) {
            console.warn("Đã lưu mẫu in nhưng chưa nạp lại được danh sách mẫu:", error);
        }
        return response.data?.data ?? null;
    },

    /**
     * Lịch sử chỉnh sửa mẫu in của một loại chứng từ, mới nhất trước. Mỗi phiên bản kèm cấu hình
     * đầy đủ sau khi lưu (`config`) và cấu hình đang dùng ngay trước lần lưu đó (`previous`, null nếu
     * trước đó chưa lưu lần nào). Phiên bản có mẫu không còn trong registry -> config null (không khôi phục được).
     */
    async getHistory(documentType) {
        const schema = getPrintSchema(documentType);
        if (!schema) return [];
        const response = await apiClient.get(`/api/v1/cau-hinh-mau-in/${schema.key}/lich-su`);
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        return rows.map((row) => ({
            id: row.id,
            at: row.luc ?? null,
            actorName: row.nguoiThucHien ?? null,
            actorRole: row.vaiTro ?? null,
            templateId: row.templateId ?? null,
            config: configFromSnapshot(schema, row.cauHinh),
            previous: configFromSnapshot(schema, row.cauHinhTruoc),
            // Có ảnh chụp trước nhưng không đọc được (mẫu không còn…) khác với "lưu lần đầu"
            hasPrevious: row.cauHinhTruoc != null,
        }));
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
        if (storage.get(MIGRATED_FLAG_KEY)) {
            return { migrated: [], skipped: [] };
        }
        const raw = readLegacyStorage();
        if (!raw || Object.keys(raw).length === 0) {
            storage.set(MIGRATED_FLAG_KEY, "true");
            return { migrated: [], skipped: [] };
        }

        const payload = buildMigratePayload(raw);
        if (Object.keys(payload.configs).length === 0) {
            storage.remove(LEGACY_STORAGE_KEY);
            storage.set(MIGRATED_FLAG_KEY, "true");
            return { migrated: [], skipped: [] };
        }

        const response = await apiClient.post("/api/v1/cau-hinh-mau-in/migrate", payload);
        // Server đã nhận (200) — legacy hết giá trị, xóa để không gửi lại
        storage.remove(LEGACY_STORAGE_KEY);
        storage.set(MIGRATED_FLAG_KEY, "true");
        await loadBundle({ force: true });
        return response.data?.data ?? { migrated: [], skipped: [] };
    },
};

// ── Legacy migration helpers ───────────────────────────────────────────────

/** localStorage có thể bị chặn (cửa sổ ẩn danh, chính sách trình duyệt) — không để lỗi làm hỏng trang. */
const storage = {
    get(key) {
        try {
            return window.localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    set(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch {
            // bỏ qua: lần sau thử migrate lại, server không bao giờ nhận đè dữ liệu đã có
        }
    },
    remove(key) {
        try {
            window.localStorage.removeItem(key);
        } catch {
            // bỏ qua
        }
    },
};

const readLegacyStorage = () => {
    try {
        const raw = storage.get(LEGACY_STORAGE_KEY);
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
