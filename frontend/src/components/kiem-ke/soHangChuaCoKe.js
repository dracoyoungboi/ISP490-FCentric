import { useSyncExternalStore } from "react";
import { demHangChuaCoKe } from "@/services/stockTakeService";
import { getKhoLamViecId } from "@/utils/khoLamViec";

/**
 * Số lô chưa có kệ ở kho làm việc — số đếm cạnh mục "Hàng chưa có kệ" trên menu (giống payosCanXuLy).
 * BackofficeLayout tải khi vào khung quản trị, định kỳ và khi đổi kho làm việc (vai trò kho); màn Hàng chưa có kệ,
 * phiếu chuyển kho tải lại sau khi xếp. Chưa chọn kho làm việc thì 0.
 */
/** Vai trò xem và xếp hàng chưa có kệ (khớp @RequireAuth của /api/v1/kiem-ke/hang-chua-co-ke, /xep-ke-nhieu). */
export const VAI_TRO_XEP_KE = ["quan_tri_vien", "quan_ly_kho", "nhan_vien_kho"];

let soLo = 0;
const nguoiNghe = new Set();
let lanTai = 0;

const dat = (moi) => {
  if (moi === soLo) return;
  soLo = moi;
  nguoiNghe.forEach((nghe) => nghe());
};

/** Tải lại số đếm của kho làm việc; lỗi thì giữ số cũ. */
export async function taiLaiSoHangChuaCoKe() {
  const lan = ++lanTai;
  const khoId = getKhoLamViecId();
  if (khoId == null) {
    dat(0);
    return;
  }
  try {
    const kq = await demHangChuaCoKe(khoId);
    if (lan === lanTai) dat(Number(kq?.soLo) || 0);
  } catch {
    // Giữ số cũ (mất mạng, hết phiên…)
  }
}

function dangKy(nghe) {
  nguoiNghe.add(nghe);
  return () => nguoiNghe.delete(nghe);
}

export function useSoHangChuaCoKe() {
  return useSyncExternalStore(dangKy, () => soLo, () => 0);
}
