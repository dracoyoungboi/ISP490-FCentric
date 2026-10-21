import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";

const MAU_CHU = { ok: "text-bo-success", warn: "text-bo-warning", bad: "text-bo-danger" };

/**
 * Dải tổng duy nhất của màn Chọn lô hàng (ngay dưới đầu khối): "Đã chọn x / y cần xuất" (chỉ xem: "Đã lấy"), thanh tiến độ
 * và câu kiểm tra trực tiếp (chỉ khi sửa, `kiemTra` của trangThaiChonLo). Tổng luôn tính trên mọi lô, kể cả lô ở trang
 * khác hay đang bị ô tìm ẩn. Thanh cùng màu với ô OTienDo của bảng. Vùng đọc tự động (role status) nên gõ số là
 * trình đọc màn hình báo câu kiểm tra mới.
 */
export default function DaiTongChonLo({ nhan, tong, can, kiemTra }) {
  const tiLe = can > 0 ? Math.min(100, Math.round((tong / can) * 100)) : 0;
  const khop = kiemTra ? kiemTra.tone === "ok" : tong >= can && can > 0;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-bo-border bg-bo-surface-subtle px-4 py-3 text-sm sm:px-6 sm:py-3.5"
    >
      <div className="whitespace-nowrap tabular-nums">
        <span className="text-bo-foreground">{nhan}</span>{" "}
        <b className="text-base font-semibold text-bo-heading">{soVN(tong)}</b>
        <span className="text-bo-muted"> / {soVN(can)} cần xuất</span>
      </div>
      <span aria-hidden="true" className="h-1.5 min-w-10 max-w-80 flex-[1_1_160px] overflow-hidden rounded-full bg-slate-200/70">
        <span
          className={cn("block h-full rounded-full", khop ? "bg-bo-success" : "bg-bo-primary")}
          // data-viz: bề rộng theo tỉ lệ đã chọn
          style={{ width: `${tiLe}%` }}
        />
      </span>
      {kiemTra ? <span className={cn("text-[13px] font-semibold", MAU_CHU[kiemTra.tone])}>{kiemTra.chu}</span> : null}
    </div>
  );
}
