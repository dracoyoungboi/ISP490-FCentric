import apiClient from "./apiClient";
import { API_BASE_URL } from "../config/apiBase";

/**
 * Địa chỉ kênh realtime, cùng máy chủ với API (http → ws, https → wss). API gọi cùng tên miền với trang (bản chạy
 * thật) thì kênh cũng vậy.
 */
export function diaChiKenh(duongDan, goc = API_BASE_URL, nguonTrang = window.location.origin) {
  return `${(goc || nguonTrang).replace(/^http/i, "ws")}${duongDan}`;
}

/**
 * Mở kênh realtime: xin vé dùng một lần qua API có đăng nhập (máy chủ kiểm người dùng xem được đơn / phiếu), rồi kết
 * nối kèm vé. Không xin được vé (không có quyền, mất mạng, máy chủ bận) hoặc trình duyệt chặn WebSocket thì trả null:
 * màn vẫn chạy nhờ hỏi định kỳ hoặc tải lại, chỉ không nhận tin tức thời.
 *
 * @param {string} duongDanVe API cấp vé, VD `/api/v1/realtime/ve/thanh-toan/123`
 * @param {string} duongDanKenh VD `/ws-pos`
 * @param {Record<string, string>} [thamSoThem] tham số phụ của kênh (VD `{ lang: "en" }`)
 * @returns {Promise<WebSocket | null>}
 */
export async function moKenhRealtime(duongDanVe, duongDanKenh, thamSoThem = {}) {
  let ve;
  try {
    const res = await apiClient.post(duongDanVe);
    ve = res?.data?.data?.ve;
  } catch {
    return null;
  }
  if (!ve) return null;
  try {
    return new WebSocket(`${diaChiKenh(duongDanKenh)}?${new URLSearchParams({ ...thamSoThem, ve })}`);
  } catch {
    return null;
  }
}
