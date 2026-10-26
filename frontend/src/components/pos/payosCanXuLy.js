import { useSyncExternalStore } from "react";
import { posService } from "@/services/posService";

/**
 * Số giao dịch chuyển khoản tại quầy đã nhận tiền nhưng chưa có đơn (PAID_ERROR) — số đếm cạnh mục
 * "Đối soát chuyển khoản" trên menu. BackofficeLayout tải khi vào khung quản trị và định kỳ (chỉ quản trị viên);
 * màn Đối soát chuyển khoản tải lại sau mỗi lần xử lý.
 */
let soCanXuLy = 0;
const nguoiNghe = new Set();
let lanTai = 0;

/** Tải lại số đếm; lỗi thì giữ số cũ. */
export async function taiLaiSoChuyenKhoanCanXuLy() {
  const lan = ++lanTai;
  try {
    const so = await posService.countPayosNeedsAttention();
    if (lan !== lanTai || so === soCanXuLy) return;
    soCanXuLy = so;
    nguoiNghe.forEach((nghe) => nghe());
  } catch {
    // Giữ số cũ
  }
}

function dangKy(nghe) {
  nguoiNghe.add(nghe);
  return () => nguoiNghe.delete(nghe);
}

export function useSoChuyenKhoanCanXuLy() {
  return useSyncExternalStore(dangKy, () => soCanXuLy, () => 0);
}
