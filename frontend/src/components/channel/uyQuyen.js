import { kenhBanHangService } from "@/services/kenhBanHangService";
import { getApiErrorMessage } from "@/utils/apiError";

/**
 * Mở trang đồng ý của sàn ủy quyền (POST /{maKenh}/uy-quyen → authUrl) và ghi nhớ đây là lần đầu hay ủy quyền lại:
 * sàn đưa về /channels/oauth/callback/:maKenh, trang đó đọc lại để chọn câu (gia hạn thì về Tổng quan, không đưa
 * vào Thiết lập). Lưu trong sessionStorage vì cả trang chuyển sang sàn rồi quay lại.
 */
const khoaUyQuyenLai = (maKenh) => `fc:uy-quyen-lai:${String(maKenh ?? "").toUpperCase()}`;

export async function moTrangUyQuyen(san, { uyQuyenLai = false } = {}) {
  const { authUrl } = (await kenhBanHangService.batDauUyQuyen(san.maKenh)) ?? {};
  if (!authUrl) throw new Error(`Máy chủ không trả đường dẫn ủy quyền của ${san.ten}.`);
  try {
    if (uyQuyenLai) window.sessionStorage.setItem(khoaUyQuyenLai(san.maKenh), "1");
    else window.sessionStorage.removeItem(khoaUyQuyenLai(san.maKenh));
  } catch {
    // Trình duyệt chặn lưu: trang quay về dùng câu của lần kết nối đầu
  }
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
