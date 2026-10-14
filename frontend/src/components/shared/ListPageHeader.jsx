import { Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hàng mỏng phía trên khung bảng (bố cục A+G). Tên trang đã có ở thanh trên cùng nên không lặp lại ở đây.
 * - scope: ghi chú phạm vi dữ liệu cho người không phải quản trị viên (R3), ví dụ "Kho bạn phụ trách: Kho Hà Nội".
 * - actions: nút chính của trang (Thêm…, Tạo…), đặt bên phải.
 * Không có gì để hiện thì không render.
 */
export default function ListPageHeader({ scope, actions, className }) {
  if (!scope && !actions) return null;
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      {scope ? (
        <p className="flex min-w-0 items-center gap-1.5 text-sm text-bo-muted">
          <Warehouse className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="min-w-0 truncate">{scope}</span>
        </p>
      ) : <span />}
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
