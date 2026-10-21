import TablePagination from "@/components/shared/TablePagination";
import { cn } from "@/lib/utils";

/**
 * Chân phân trang của bảng hàng trong khối chứng từ: đúng TablePagination dùng chung, đặt trong dải có vạch ngăn trên
 * và lề như khối. Nhận thẳng `bang.phanTrang` của useBangChungTu (`null` → không vẽ gì); các props khác của
 * TablePagination truyền thẳng cũng được (page, size, total, onPageChange, onSizeChange, sizeOptions, sizeLabel,
 * totalLabel, totalNote). Khối chứng từ hẹp hơn 672px thì xếp dọc như trên điện thoại.
 */
export default function PhanTrangBang({ className, ...props }) {
  if (props.page == null || !props.size) return null;
  return (
    <div
      className={cn(
        // Khối hẹp (768px có thanh bên): TablePagination xếp dọc như điện thoại thay vì bóp chữ "Hiển thị…" thành 5 dòng
        "border-t border-slate-100 px-4 py-3 sm:px-6 @max-2xl/khoi:[&>div]:flex-col @max-2xl/khoi:[&>div]:items-start",
        className,
      )}
    >
      <TablePagination {...props} />
    </div>
  );
}
