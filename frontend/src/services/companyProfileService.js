/**
 * Hồ sơ công ty DÙNG CHUNG cho mọi mẫu in.
 *
 * Tên công ty, logo, email, điện thoại, địa chỉ nằm ở đây (một nơi duy nhất);
 * từng mẫu in chỉ quyết định CÓ HIỂN THỊ từng trường hay không (cấu hình
 * `branding` của mẫu), không lưu trùng dữ liệu công ty.
 *
 * Lưu trữ SERVER-SIDE (bảng thong_tin_cong_ty, một dòng duy nhất) để mọi
 * nhân viên in phiếu dùng chung một hồ sơ. Dữ liệu localStorage cũ
 * (fcentric.companyProfile.v1) được migrate một lần — chỉ khi server chưa
 * có dòng nào, không bao giờ ghi đè dữ liệu server bằng dữ liệu local.
 */
import apiClient from "./apiClient";

const LEGACY_STORAGE_KEY = "fcentric.companyProfile.v1";
const MIGRATED_FLAG_KEY = "fcentric.companyProfile.migrated";
const PROFILE_VERSION = 1;

export const DEFAULT_COMPANY_PROFILE = {
    version: PROFILE_VERSION,
    name: "FCentric",
    logoAsset: "/branding/f-centric-icon.svg",
    email: "",
    phone: "",
    address: "",
};

// ── Cache server ───────────────────────────────────────────────────────────

let profilePromise = null;
let profileCache = null;

async function loadProfile({ force = false } = {}) {
    if (profilePromise && !force) return profilePromise;
    profilePromise = (async () => {
        const response = await apiClient.get("/api/v1/thong-tin-cong-ty");
        const dto = response.data?.data;
        profileCache = toProfile(dto);
        return profileCache;
    })().catch((error) => {
        profilePromise = null; // cho phép thử lại ở lần sau
        throw error;
    });
    return profilePromise;
}

const toProfile = (dto) => {
    if (!dto) return null;
    return {
        version: dto.version ?? PROFILE_VERSION,
        name: dto.name ?? DEFAULT_COMPANY_PROFILE.name,
        logoAsset: dto.logoAsset ?? DEFAULT_COMPANY_PROFILE.logoAsset,
        email: dto.email ?? "",
        phone: dto.phone ?? "",
        address: dto.address ?? "",
        ngayCapNhat: dto.ngayCapNhat ?? null,
    };
};

const applyProfileCache = (dto) => {
    profileCache = toProfile(dto);
    profilePromise = Promise.resolve(profileCache);
    return profileCache;
};

export const companyProfileService = {
    /** Hồ sơ công ty từ server (cache). Lỗi -> reject để UI hiện trạng thái lỗi. */
    get() {
        return loadProfile();
    },

    /** Cập nhật hồ sơ (không đổi logo). */
    async save(profile) {
        const response = await apiClient.put("/api/v1/thong-tin-cong-ty", {
            name: profile.name,
            email: profile.email ?? "",
            phone: profile.phone ?? "",
            address: profile.address ?? "",
        });
        return applyProfileCache(response.data?.data);
    },

    /** Tải logo lên MinIO và lưu đường dẫn công khai. */
    async uploadLogo(file) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await apiClient.post("/api/v1/thong-tin-cong-ty/logo", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return applyProfileCache(response.data?.data);
    },

    /**
     * Migrate hồ sơ localStorage cũ lên server (một lần).
     * Chỉ upload khi server CHƯA có dòng nào (ngayCapNhat == null);
     * nếu server đã có dữ liệu thì bỏ dữ liệu local.
     */
    async migrateLegacyLocalIfNeeded() {
        if (window.localStorage.getItem(MIGRATED_FLAG_KEY)) return false;
        let legacy = null;
        try {
            const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
            legacy = raw ? JSON.parse(raw) : null;
        } catch {
            legacy = null;
        }
        if (!legacy || legacy.version !== PROFILE_VERSION) {
            window.localStorage.setItem(MIGRATED_FLAG_KEY, "true");
            return false;
        }

        const current = await loadProfile();
        if (!current || current.ngayCapNhat) {
            // Server đã có dòng (đã được cấu hình) — không ghi đè bằng dữ liệu local
            window.localStorage.removeItem(LEGACY_STORAGE_KEY);
            window.localStorage.setItem(MIGRATED_FLAG_KEY, "true");
            return false;
        }
        await this.save({
            name: legacy.name ?? DEFAULT_COMPANY_PROFILE.name,
            email: legacy.email ?? "",
            phone: legacy.phone ?? "",
            address: legacy.address ?? "",
        });
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        window.localStorage.setItem(MIGRATED_FLAG_KEY, "true");
        return true;
    },
};
