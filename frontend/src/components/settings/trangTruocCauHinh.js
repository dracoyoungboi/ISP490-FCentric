import { laDuongDanCauHinh } from "@/lib/lichSuDieuHuong";

// Trang ngoài Cấu hình xem gần nhất trong thẻ này: nút X của Cấu hình về đúng trang đó (SettingsLayout).
// sessionStorage riêng từng thẻ và còn sau F5, khác vị trí lịch sử chỉ ghi lúc khung Cấu hình dựng.
const KHOA = "fcentric.cauHinh.trangTruoc";

/** Gọi mỗi lần đổi trang trong khung quản trị; trang thuộc Cấu hình thì bỏ qua. */
export function ghiTrangTruocCauHinh(pathname, search) {
  if (laDuongDanCauHinh(pathname)) return;
  try {
    sessionStorage.setItem(KHOA, JSON.stringify({ idx: window.history.state?.idx ?? null, path: pathname + search }));
  } catch {
    // Trình duyệt chặn lưu trữ: nút X về Tổng quan
  }
}

/** { idx, path } hoặc null. */
export function docTrangTruocCauHinh() {
  try {
    const daLuu = JSON.parse(sessionStorage.getItem(KHOA) ?? "null");
    return typeof daLuu?.path === "string" && daLuu.path.startsWith("/") && !laDuongDanCauHinh(daLuu.path) ? daLuu : null;
  } catch {
    return null;
  }
}
