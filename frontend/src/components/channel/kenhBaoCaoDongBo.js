/**
 * Danh sách giá trị bộ lọc kênh được hỗ trợ trên màn Báo cáo đồng bộ kênh (/channels/analytics).
 */
export const MA_KENH_BAO_CAO = Object.freeze(["ALL", "SHOPIFY", "SHOPEE", "LAZADA", "TIKTOK"]);

const ALIAS_KENH_BAO_CAO = Object.freeze({
  SHOPIFY: "SHOPIFY",
  SHOPEE: "SHOPEE",
  SHOPEE_OFFICIAL: "SHOPEE",
  "SHOPEE-OFFICIAL": "SHOPEE",
  LAZADA: "LAZADA",
  TIKTOK: "TIKTOK",
  TIKTOK_SHOP: "TIKTOK",
  "TIKTOK-SHOP": "TIKTOK",
});

/**
 * Chuẩn hóa mã kênh (mã DB, mã sàn hoặc slug đường dẫn) về đúng giá trị dropdown bộ lọc trên Báo cáo đồng bộ kênh.
 * Mã rỗng, "ALL" hoặc không thuộc các kênh hỗ trợ trả về "ALL".
 */
export function chuanHoaKenhBaoCao(raw) {
  const ma = String(raw ?? "").trim().toUpperCase();
  if (!ma || ma === "ALL") return "ALL";
  return ALIAS_KENH_BAO_CAO[ma] ?? "ALL";
}

/**
 * Tạo đường dẫn mở màn Báo cáo đồng bộ kênh đã lọc sẵn theo gian hàng/sàn truyền vào.
 */
export function duongDanBaoCaoDongBoKenh(maKenh) {
  const kenh = chuanHoaKenhBaoCao(maKenh);
  if (kenh === "ALL") return "/channels/analytics";
  return `/channels/analytics?channel=${encodeURIComponent(kenh)}`;
}

/**
 * Đọc và chuẩn hóa kênh đang lọc từ URLSearchParams (?channel=... hoặc ?kenh=...).
 */
export function layKenhTuSearchParams(searchParams) {
  if (!searchParams) return "ALL";
  const raw = searchParams.get?.("channel") ?? searchParams.get?.("kenh");
  return chuanHoaKenhBaoCao(raw);
}
