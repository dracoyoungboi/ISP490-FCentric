import { cn } from "@/lib/utils";
import PageHeading from "@/components/backoffice/PageHeading";
import { useClaimPageTitle } from "@/components/backoffice/pageTitle";

/**
 * Hàng tiêu đề của trang chi tiết / tạo mới / cấu hình: tiêu đề trái, thao tác phải.
 * Không còn dòng mô tả và dòng nhãn nhỏ phía trên tiêu đề (quyết định 14/10/2026);
 * nơi gọi vẫn truyền `description` / `eyebrow` được nhưng hai prop này bị bỏ qua.
 * - giaiThich: nút giải thích nằm sát sau tiêu đề (thường là `NutGiaiThich`), như ListPageHeader.
 */
export default function PageHeader({ title, giaiThich, actions, className }) {
  useClaimPageTitle(true);

  return (
    <div
      className={cn(
        "mb-5 flex min-h-9 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {giaiThich ? (
        <span className="flex min-w-0 items-center gap-1">
          <PageHeading>{title}</PageHeading>
          {giaiThich}
        </span>
      ) : (
        <PageHeading>{title}</PageHeading>
      )}

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
