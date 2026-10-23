import { useSyncExternalStore } from "react";
import { kenhBanHangService } from "@/services/kenhBanHangService";
import { daKetNoi } from "@/components/channel/ketNoiKenh";

/**
 * Các sàn đã kết nối (mã kênh) cho menu bên trái: BackofficeLayout tải một lần khi vào khung quản trị,
 * các trang tải lại sau khi kết nối hoặc ngắt kết nối (KH mục B.1). Nhớ danh sách lần trước trong trình duyệt
 * để menu không nháy mất mục sàn trong lúc chờ máy chủ.
 */
const KHOA_NHO = "fc:kenh-da-ket-noi";

function docNho() {
  try {
    const ds = JSON.parse(window.localStorage.getItem(KHOA_NHO) ?? "[]");
    return Array.isArray(ds) ? ds.filter((ma) => typeof ma === "string") : [];
  } catch {
    return [];
  }
}

function ghiNho(ds) {
  try {
    window.localStorage.setItem(KHOA_NHO, JSON.stringify(ds));
  } catch {
    // Trình duyệt chặn lưu: lần sau menu chờ máy chủ trả lời mới hiện mục sàn
  }
}

let maDaKetNoi = typeof window === "undefined" ? [] : docNho();
const nguoiNghe = new Set();
let lanTai = 0;

function datDanhSach(ds) {
  if (ds.length === maDaKetNoi.length && ds.every((ma, i) => ma === maDaKetNoi[i])) return;
  maDaKetNoi = ds;
  ghiNho(ds);
  nguoiNghe.forEach((nghe) => nghe());
}

/** Tải lại danh sách sàn đã kết nối; lỗi thì giữ danh sách cũ (menu không mất mục vì một lần mạng chập chờn). */
export async function taiLaiKenhDaKetNoi() {
  const lan = ++lanTai;
  try {
    const ds = await kenhBanHangService.getDanhSachKetNoi();
    if (lan !== lanTai) return;
    // GET gốc trả cả kênh trạng thái "loi": chỉ giữ gian hàng mở được trang (cùng điều kiện daKetNoi của các trang)
    const daMo = ds.filter((k) => daKetNoi(k));
    datDanhSach([...new Set(daMo.map((k) => String(k?.maKenh ?? "").toUpperCase()).filter(Boolean))].sort());
  } catch {
    // Giữ danh sách cũ
  }
}

function dangKy(nghe) {
  nguoiNghe.add(nghe);
  return () => nguoiNghe.delete(nghe);
}

/** Mảng mã kênh đã kết nối ("LAZADA", "SHOPIFY"…), đổi khi tải lại xong. */
export function useKenhDaKetNoi() {
  return useSyncExternalStore(dangKy, () => maDaKetNoi, () => maDaKetNoi);
}
