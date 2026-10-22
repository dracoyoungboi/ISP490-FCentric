/**
 * Thông tin cửa hàng DÙNG CHUNG cho mọi mẫu in và email.
 *
 * Tên cửa hàng, tên đăng ký kinh doanh, mã số thuế, logo, email, điện thoại, địa chỉ đăng ký nằm ở đây
 * (một nơi duy nhất); từng mẫu in chỉ quyết định CÓ HIỂN THỊ từng trường hay không (cấu hình
 * `branding` của mẫu), không lưu trùng dữ liệu cửa hàng.
 *
 * Lưu trữ SERVER-SIDE (bảng thong_tin_cong_ty, một dòng duy nhất) để mọi
 * nhân viên in phiếu dùng chung một hồ sơ. Dữ liệu localStorage cũ
 * (fcentric.companyProfile.v1) được migrate một lần — chỉ khi server chưa
 * có dòng nào, không bao giờ ghi đè dữ liệu server bằng dữ liệu local.
 *
 * Không có giá trị mặc định: cửa hàng chưa nhập thì các ô rỗng, logo null (không dùng tên, logo phần mềm).
 */
import apiClient from "./apiClient";
import { EMAIL_RE, EMAIL_TOI_DA, PHONE_RE } from "@/validations/companyProfileSchema";

const LEGACY_STORAGE_KEY = "fcentric.companyProfile.v1";
const MIGRATED_FLAG_KEY = "fcentric.companyProfile.migrated";
const PROFILE_VERSION = 1;

/** Hồ sơ trống (cửa hàng mới chưa nhập gì). */
export const HO_SO_TRONG = Object.freeze({
    version: PROFILE_VERSION,
    name: "",
    legalName: "",
    logoAsset: null,
    taxCode: "",
    email: "",
    phone: "",
    address: "",
    ngayCapNhat: null,
});

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

// Máy chủ trả đối tượng (các trường null) khi chưa có hồ sơ: luôn trả đối tượng để trang in vẫn in được
const toProfile = (dto) => {
    if (!dto) return { ...HO_SO_TRONG };
    return {
        version: dto.version ?? PROFILE_VERSION,
        name: dto.name ?? "",
        legalName: dto.legalName ?? "",
        logoAsset: dto.logoAsset || null,
        taxCode: dto.taxCode ?? "",
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
    /**
     * Hồ sơ cửa hàng từ server (cache). `force: true` đọc lại máy chủ — trang Thông tin cửa hàng và
     * trang Gửi yêu cầu báo giá cần bản mới nhất (người khác có thể vừa sửa). Lỗi -> reject để UI hiện trạng thái lỗi.
     */
    get({ force = false } = {}) {
        return loadProfile({ force });
    },

    /**
     * Cập nhật hồ sơ (không đổi logo). Chỉ gửi các khóa có trong `payload` (đã chuẩn hóa ở companyProfileSchema):
     * máy chủ coi khóa không gửi là giữ nguyên, nên lưu một thẻ không xóa dữ liệu của thẻ kia.
     */
    async save(payload) {
        const body = Object.fromEntries(Object.entries(payload ?? {}).filter(([, value]) => value !== undefined));
        const response = await apiClient.put("/api/v1/thong-tin-cong-ty", body);
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
     * Chuyển tên cửa hàng (bắt buộc, không có thì bỏ qua) cùng email, điện thoại, địa chỉ còn đúng dạng; máy chủ coi
     * khóa không gửi là giữ nguyên. Bản cũ không có tên đăng ký kinh doanh: người dùng nhập ở Thông tin cửa hàng.
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
        if (!current || current.ngayCapNhat || current.name) {
            // Server đã có dòng (đã được cấu hình) — không ghi đè bằng dữ liệu local
            window.localStorage.removeItem(LEGACY_STORAGE_KEY);
            window.localStorage.setItem(MIGRATED_FLAG_KEY, "true");
            return false;
        }
        const cu = (key) => (typeof legacy[key] === "string" ? legacy[key].trim() : "");
        const tenCu = cu("name");
        if (tenCu) {
            const email = cu("email");
            const dienThoai = cu("phone");
            await this.save({
                name: tenCu,
                email: email && email.length <= EMAIL_TOI_DA && EMAIL_RE.test(email) ? email : undefined,
                phone: dienThoai && PHONE_RE.test(dienThoai) ? dienThoai : undefined,
                address: cu("address") || undefined,
            });
        }
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        window.localStorage.setItem(MIGRATED_FLAG_KEY, "true");
        return Boolean(tenCu);
    },
};
