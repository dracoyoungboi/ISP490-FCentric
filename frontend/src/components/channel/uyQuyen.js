import { kenhBanHangService } from "@/services/kenhBanHangService";
import { getApiErrorMessage } from "@/utils/apiError";
import { t } from "@/i18n";

/**
 * Mở trang đồng ý của sàn ủy quyền (POST /{maKenh}/uy-quyen → authUrl) và ghi nhớ đây là lần đầu hay ủy quyền lại:
 * sàn đưa về /channels/oauth/callback/:maKenh, trang đó đọc lại để chọn câu (gia hạn thì về Tổng quan, không đưa
 * vào Thiết lập). Lưu trong sessionStorage vì cả trang chuyển sang sàn rồi quay lại.
 */
const khoaUyQuyenLai = (maKenh) => `fc:uy-quyen-lai:${String(maKenh ?? "").toUpperCase()}`;
export const KHOA_DANG_UY_QUYEN_KENH = "fc:dang-uy-quyen-kenh";

export async function moTrangUyQuyen(san, { uyQuyenLai = false } = {}) {
  const slug = san.duongDan ? san.duongDan.split("/").pop() : String(san.maKenh ?? "").toLowerCase();
  const redirectUri = `${window.location.origin}/channels/oauth/callback/${slug}`;
  try {
    window.sessionStorage.setItem(KHOA_DANG_UY_QUYEN_KENH, String(san.maKenh ?? "").toLowerCase());
    if (uyQuyenLai) window.sessionStorage.setItem(khoaUyQuyenLai(san.maKenh), "1");
    else window.sessionStorage.removeItem(khoaUyQuyenLai(san.maKenh));
  } catch {
    // Trình duyệt chặn lưu: trang quay về dùng câu của lần kết nối đầu
  }
  const { authUrl } = (await kenhBanHangService.batDauUyQuyen(san.maKenh, redirectUri)) ?? {};
  if (!authUrl) throw new Error(t("Máy chủ không trả đường dẫn ủy quyền của {{ten}}.", { ten: san.ten }));
  window.location.assign(authUrl);
}

/** Lần ủy quyền đang hoàn tất là ủy quyền lại (gia hạn)? Chỉ đọc (gọi trong lúc vẽ trang được). */
export function laUyQuyenLai(maKenh) {
  try {
    return window.sessionStorage.getItem(khoaUyQuyenLai(maKenh)) === "1";
  } catch {
    return false;
  }
}

/** Xóa đánh dấu ủy quyền lại khi đã có kết quả. */
export function xoaDanhDauUyQuyenLai(maKenh) {
  try {
    window.sessionStorage.removeItem(khoaUyQuyenLai(maKenh));
  } catch {
    // Bỏ qua: lần ủy quyền sau ghi đè
  }
}

/** Câu lỗi tiếng Việt: chỉ dùng message của lỗi do chính trang tạo (lỗi mạng / HTTP của thư viện là tiếng Anh). */
export function cauLoiUyQuyen(error, macDinh) {
  const loiTuTao = error instanceof Error && !error.response && !error.request;
  return getApiErrorMessage(error, loiTuTao && error.message ? error.message : macDinh);
}
