import { cn } from "@/lib/utils";

/**
 * Thanh thao tác cố định ở đáy vùng nội dung (Hủy bỏ / Quay lại / Tiếp theo / Lưu).
 * Đặt làm con cuối của PageContainer `flex min-h-full flex-col`, phần nội dung phía trên `flex-1`.
 * Tràn hết bề ngang PageContainer (bù phần đệm p-4 / sm:p-5 / lg:p-6) và luôn nằm dưới cùng khi cuộn.
 * `note`: chữ nhỏ bên trái (vd. "Có thay đổi chưa lưu").
 */
export default function BottomActionBar({ note, children, className }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 -mb-4 flex flex-wrap items-center justify-end gap-2 border-t border-bo-border bg-bo-surface/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:-mb-5 sm:px-5 lg:-mx-6 lg:-mb-6 lg:px-6",
        className,
      )}
    >
      {note ? <p className="mr-auto text-sm text-bo-muted">{note}</p> : null}
      {children}
    </div>
  );
}

/** Kiểu nút dùng trên thanh đáy và trong trang kênh: chính (xanh đặc) và phụ (viền xám). */
// Điện thoại (dưới 640 px): cao 44 px cho dễ chạm
export const NUT_CHINH =
  "h-10 gap-2 rounded-lg bg-bo-primary px-4 text-white hover:bg-bo-primary-hover disabled:bg-slate-200 disabled:text-slate-600 disabled:opacity-100 max-sm:h-11";
export const NUT_PHU =
  "h-10 gap-2 rounded-lg border-bo-border bg-white px-4 text-bo-foreground hover:bg-bo-surface-subtle max-sm:h-11";
