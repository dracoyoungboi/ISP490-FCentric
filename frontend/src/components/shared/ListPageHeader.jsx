import { Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeading from "@/components/backoffice/PageHeading";
import { useClaimPageTitle, usePageTitle } from "@/components/backoffice/pageTitle";

/**
 * Hàng tiêu đề của trang danh sách: tiêu đề trang bên trái, nút chính bên phải, cùng một hàng cao 36px.
 * - title: mặc định lấy tên trang từ layout (trùng nhãn menu bên trái); truyền vào nếu cần tên khác.
 * - scope: phạm vi dữ liệu cho người không phải quản trị viên (R3), hiện thành nhãn nhỏ cạnh tiêu đề,
 *   ví dụ "Kho bạn phụ trách: Kho Hà Nội".
 * - actions: nút chính của trang (Thêm…, Tạo…).
 */
export default function ListPageHeader({ title, scope, actions, className }) {
  const { title: layoutTitle } = usePageTitle();
  const heading = title ?? layoutTitle;
  useClaimPageTitle(Boolean(heading));

  if (!heading && !scope && !actions) return null;
  return (
    <div className={cn("flex min-h-9 flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        {heading ? <PageHeading>{heading}</PageHeading> : null}
        {scope ? (
          <span
            className="inline-flex h-6 min-w-0 max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-600"
            title="Dữ liệu trong phạm vi kho bạn phụ trách"
          >
            <Warehouse className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate">{scope}</span>
          </span>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
