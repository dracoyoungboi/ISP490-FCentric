/**
 * Đa ngôn ngữ (tiếng Việt mặc định + tiếng Anh) — phần lõi, không dùng tính năng riêng của Vite để chạy được bằng `node --test`.
 *
 * Khóa dịch CHÍNH LÀ câu tiếng Việt: t("Lưu"), t("Đã xóa {{ten}}", { ten }).
 *   - Tiếng Việt không cần tệp dịch: chưa khởi tạo hay thiếu khóa thì trả nguyên câu (đã điền tham số).
 *   - Tiếng Anh: src/i18n/en/*.json (mỗi module một tệp, gộp lại khi tải).
 * Ngôn ngữ cố định trong một lần tải trang (đổi ngôn ngữ = lưu lựa chọn rồi tải lại trang), nên gọi t() ở đâu cũng được,
 * kể cả hằng số cấp module — nhưng KHÔNG dịch giá trị dùng làm khóa tra cứu, so sánh, gửi máy chủ, hay chứng từ in.
 */
import i18next from "i18next";

export const KHOA_LUU_NGON_NGU = "fcentric_ngon_ngu";
export const NGON_NGU = { vi: "vi", en: "en" };

/** Ngôn ngữ người dùng đã chọn trên trình duyệt này; chưa chọn hoặc không đọc được thì tiếng Việt. */
export function layNgonNguDaLuu() {
  try {
    return globalThis.localStorage?.getItem(KHOA_LUU_NGON_NGU) === NGON_NGU.en ? NGON_NGU.en : NGON_NGU.vi;
  } catch {
    return NGON_NGU.vi;
  }
}

const DIEN_THAM_SO = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Điền {{thamSo}} khi i18next chưa khởi tạo (test, hoặc mã chạy trước lúc khởi tạo). */
function dienThamSo(khoa, thamSo) {
  if (!thamSo || typeof khoa !== "string") return khoa;
  return khoa.replace(DIEN_THAM_SO, (goc, ten) => (thamSo[ten] === undefined || thamSo[ten] === null ? goc : String(thamSo[ten])));
}

/**
 * Dịch một câu tiếng Việt sang ngôn ngữ đang dùng. Câu chưa có bản dịch giữ nguyên tiếng Việt.
 * Số nhiều tiếng Anh: truyền `{ count }` và khai báo "<câu>_one" / "<câu>_other" trong tệp en.
 */
export function t(khoa, thamSo) {
  if (khoa === null || khoa === undefined || khoa === "") return khoa;
  if (!i18next.isInitialized) return dienThamSo(String(khoa), thamSo);
  // i18next chỉ chia số ít/nhiều khi count là số: API trả số dạng chuỗi ("1") thì đổi sang số
  if (typeof thamSo?.count === "string" && thamSo.count.trim() !== "" && Number.isFinite(Number(thamSo.count))) {
    thamSo = { ...thamSo, count: Number(thamSo.count) };
  }
  return i18next.t(String(khoa), thamSo);
}

/** Dịch nếu là chuỗi, giữ nguyên nếu không (nhãn tùy chọn có thể là phần tử React). */
export function tNeuChuoi(giaTri, thamSo) {
  return typeof giaTri === "string" ? t(giaTri, thamSo) : giaTri;
}

export function ngonNguHienTai() {
  return i18next.isInitialized && i18next.language === NGON_NGU.en ? NGON_NGU.en : NGON_NGU.vi;
}

export function laTiengAnh() {
  return ngonNguHienTai() === NGON_NGU.en;
}

/**
 * Locale cho TÊN tháng, thứ và so sánh chữ theo ngôn ngữ giao diện ("vi-VN" / "en-US").
 * Định dạng SỐ và TIỀN giữ kiểu Việt Nam ("1.500.000 ₫") ở cả hai ngôn ngữ: ô nhập tiền đọc theo kiểu đó.
 */
export function localeHienThi() {
  return laTiengAnh() ? "en-US" : "vi-VN";
}

/** Khởi tạo với bản dịch đã nạp (`banDich` = object phẳng câu Việt → câu Anh). Gọi một lần trước khi vẽ ứng dụng. */
export async function khoiTaoI18n(ngonNgu, banDich = {}) {
  const lng = ngonNgu === NGON_NGU.en ? NGON_NGU.en : NGON_NGU.vi;
  await i18next.init({
    lng,
    fallbackLng: false,
    resources: lng === NGON_NGU.en ? { en: { translation: banDich } } : {},
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    returnNull: false,
    initAsync: false,
  });
  return lng;
}

/** Đổi ngôn ngữ: lưu lựa chọn rồi tải lại trang để mọi câu (kể cả hằng số đã tính sẵn) đổi theo. */
export function doiNgonNgu(ngonNgu) {
  const lng = ngonNgu === NGON_NGU.en ? NGON_NGU.en : NGON_NGU.vi;
  if (lng === ngonNguHienTai()) return;
  try {
    globalThis.localStorage?.setItem(KHOA_LUU_NGON_NGU, lng);
  } catch {
    return;
  }
  globalThis.location?.reload();
}
