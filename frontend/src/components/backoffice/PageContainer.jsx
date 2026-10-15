import { cn } from "@/lib/utils";
import PageHeading from "@/components/backoffice/PageHeading";
import { usePageTitle } from "@/components/backoffice/pageTitle";

/**
 * - fill: trang danh sách giãn hết chiều cao vùng nội dung, để `TableShell fill` (con trực tiếp,
 *   hoặc nằm trong lớp bọc `bo-fill-wrap`) chiếm phần còn lại. Khoảng cách giữa các khối dùng `gap-4`.
 */
export default function PageContainer({ className, children, fill = false }) {
  // Trang chưa tự vẽ hàng tiêu đề (ListPageHeader / PageHeader) thì hiện tiêu đề lấy từ layout
  const { title, showFallback } = usePageTitle();

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1600px] p-4 sm:p-5 lg:p-6",
        fill && "bo-page-fill",
        className,
      )}
    >
      {showFallback ? (
        <div className="mb-4 flex min-h-9 items-center">
          <PageHeading>{title}</PageHeading>
        </div>
      ) : null}
      {children}
    </div>
  );
}
