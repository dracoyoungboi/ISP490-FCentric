import { cn } from "@/lib/utils";

/**
 * Khung bảng của trang danh sách.
 * - toolbar: hàng tab + tìm kiếm (ListToolbar).
 * - footer: phân trang (TablePagination).
 * - fill: khung giãn hết phần còn lại của màn (dùng cùng `PageContainer fill`). Thân bảng tự cuộn,
 *   tiêu đề cột (thead `sticky top-0`) đứng yên, phân trang luôn ở đáy. Màn hẹp/thấp tự về kiểu cũ.
 *   Bảng bên trong KHÔNG được bọc thêm khung giới hạn chiều cao (`max-h-…`).
 */
export default function TableShell({
  title,
  description,
  toolbar,
  children,
  footer,
  fill = false,
  className,
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm",
        fill && "bo-table-fill",
        className,
      )}
    >
      {title || description ? (
        <div className="border-b border-bo-border px-4 py-3.5 sm:px-5">
          {title ? (
            <h2 className="text-sm font-semibold text-bo-foreground sm:text-base">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-bo-muted sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}

      {toolbar}
      <div className={cn("w-full overflow-x-auto", fill && "bo-table-body")}>{children}</div>
      {footer ? (
        <div className="border-t border-bo-border px-4 py-3">{footer}</div>
      ) : null}
    </section>
  );
}
