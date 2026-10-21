/**
 * Lớp Tailwind của hộp thoại các màn chi tiết chứng từ (chốt sau rà soát 21/10/2026, theo kiểu hộp của màn Phiếu xuất kho,
 * khớp hộp thoại bản demo): khung trắng bo 12px rộng 460px (hộp có biểu mẫu 560px), tiêu đề 18px + mô tả, thân, chân nút
 * căn phải ("Quay lại" viền + nút chính). Dùng cho HopXacNhanChungTu và các hộp có biểu mẫu riêng (vd. DispatchDialog).
 */

/** Khung hộp (DialogContent / AlertDialogContent); hộp có biểu mẫu dùng thêm HOP_RONG. Phần thân tự cuộn khi màn thấp. */
export const HOP =
  "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-xl border-bo-border bg-white p-0 shadow-xl sm:max-w-[460px]";
export const HOP_RONG = "sm:max-w-[560px]";

export const DAU_HOP = "shrink-0 gap-1 px-5 pt-5 text-left sm:px-6";
export const TIEU_DE_HOP = "text-lg font-semibold leading-7 text-bo-heading";
export const MO_TA_HOP = "text-sm leading-[22px] text-slate-600";

export const THAN_HOP = "grid min-h-0 flex-1 gap-3.5 overflow-y-auto px-5 pt-4 sm:px-6";

/** Chân hộp: các nút căn phải, xuống dòng khi hẹp (không đảo thứ tự như mặc định của shadcn trên điện thoại). */
export const CHAN_HOP = "flex shrink-0 flex-row flex-wrap items-center justify-end gap-2 px-5 py-5 sm:px-6";

export const NUT_QUAY_LAI = "border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle";
export const NUT_CHINH =
  "gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:cursor-not-allowed disabled:opacity-60";
export const NUT_NGUY_HIEM =
  "gap-1.5 bg-bo-danger text-white hover:bg-bo-danger-strong disabled:cursor-not-allowed disabled:opacity-60";

/** Câu lỗi trong hộp, ngay trên chân hộp (HopXacNhanChungTu → `loi`): nền đỏ nhạt, chữ đỏ đậm (≥ 4,5:1). */
export const LOI_HOP =
  "mx-5 mt-4 shrink-0 rounded-lg border border-bo-danger/25 bg-bo-danger-soft px-3 py-2.5 text-[13px] leading-5 text-bo-danger-strong sm:mx-6";

/** Nhãn ô nhập trong hộp; dấu * bắt buộc: <span className="text-bo-danger">*</span>. */
export const NHAN_O = "text-[13px] font-medium leading-5 text-bo-foreground";
export const O_NHAP =
  "h-9 w-full rounded-md border border-bo-input-border bg-white px-2.5 text-sm text-bo-foreground outline-none placeholder:text-slate-500 focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle";
/** Ô nhập nhiều dòng (lý do từ chối, ghi chú): cùng viền / tiêu điểm với O_NHAP, kéo giãn theo chiều dọc. */
export const O_NHAP_NHIEU_DONG =
  "min-h-[84px] w-full resize-y rounded-md border border-bo-input-border bg-white px-2.5 py-2 text-sm leading-5 text-bo-foreground outline-none placeholder:text-slate-500 focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle";
/** Dòng phụ dưới ô nhập (vd. "Bắt buộc" · "12/500"). */
export const GOI_Y_O = "flex justify-between gap-3 text-xs leading-4 text-bo-muted tabular-nums";

/** Khung nhắc trong hộp (tổng tiền sẽ chốt, việc máy chủ làm thêm…): nền xám nhạt, viền mảnh. */
export const GHI_CHU_HOP =
  "rounded-lg border border-bo-border bg-bo-surface-subtle px-3 py-2.5 text-[13px] leading-5 text-slate-700";
