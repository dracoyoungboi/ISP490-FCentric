import { toast as toastSonner } from "sonner";
import { CAU_HINH_THONG_BAO_NHANH } from "@/config/thongBaoNhanh";
import { taoKhoaGop, tinhSoLan, tinhThoiGian } from "@/lib/tinhThongBaoNhanh";

/**
 * Thông báo nhanh dùng chung cho cả hệ thống. Cách gọi giữ y như toast của sonner:
 *
 *   import { toast } from "@/lib/thongBaoNhanh";
 *   toast.success("Đã lưu đơn mua");
 *   toast.error("Không lưu được đơn mua", { description: "…", action: { label: "Thử lại", onClick } });
 *
 * Khác sonner gốc:
 * - Thời gian tự tắt lấy theo loại và độ dài chữ trong config/thongBaoNhanh.js (trang không cần tự đặt).
 * - Thông báo giống hệt nhau gộp thành một ô có đếm "×2, ×3…" thay vì xếp chồng.
 * Trang tự truyền `id` hoặc `duration` thì giữ nguyên lựa chọn của trang.
 */

/** khóa gộp → { soLan, luc } của lần gọi gần nhất, xóa khi ô thông báo tắt. */
const lanGoiTheoKhoa = new Map();

function dangHien(id) {
  return toastSonner.getToasts().some((thongBao) => thongBao.id === id);
}

function hien(loai, tieuDe, tuyChon = {}) {
  const goi = loai === "message" ? toastSonner : toastSonner[loai];
  const duration = tinhThoiGian(loai, tieuDe, tuyChon);
  const khoa =
    CAU_HINH_THONG_BAO_NHANH.gopThongBaoTrung && tuyChon.id === undefined ? taoKhoaGop(loai, tieuDe) : null;
  if (!khoa) return goi(tieuDe, { ...tuyChon, duration });

  const lanNay = tinhSoLan({
    truoc: lanGoiTheoKhoa.get(khoa),
    dangHien: dangHien(khoa),
    bayGio: Date.now(),
  });
  lanGoiTheoKhoa.set(khoa, lanNay);

  const quenKhoa = () => lanGoiTheoKhoa.delete(khoa);
  const noiDung =
    lanNay.soLan > 1 ? (
      <>
        {tieuDe}
        <span className="fc-tb-dem">×{lanNay.soLan}</span>
      </>
    ) : (
      tieuDe
    );

  return goi(noiDung, {
    ...tuyChon,
    id: khoa,
    duration,
    onDismiss: (thongBao) => {
      quenKhoa();
      tuyChon.onDismiss?.(thongBao);
    },
    onAutoClose: (thongBao) => {
      quenKhoa();
      tuyChon.onAutoClose?.(thongBao);
    },
  });
}

export const toast = Object.assign((tieuDe, tuyChon) => hien("message", tieuDe, tuyChon), {
  success: (tieuDe, tuyChon) => hien("success", tieuDe, tuyChon),
  info: (tieuDe, tuyChon) => hien("info", tieuDe, tuyChon),
  warning: (tieuDe, tuyChon) => hien("warning", tieuDe, tuyChon),
  error: (tieuDe, tuyChon) => hien("error", tieuDe, tuyChon),
  message: (tieuDe, tuyChon) => hien("message", tieuDe, tuyChon),
  loading: (tieuDe, tuyChon) => toastSonner.loading(tieuDe, tuyChon),
  promise: (...thamSo) => toastSonner.promise(...thamSo),
  custom: (...thamSo) => toastSonner.custom(...thamSo),
  dismiss: (id) => toastSonner.dismiss(id),
  getHistory: () => toastSonner.getHistory(),
  getToasts: () => toastSonner.getToasts(),
});
