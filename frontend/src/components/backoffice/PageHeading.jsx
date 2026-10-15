import { cn } from "@/lib/utils";
import { PAGE_HEADING_TYPE } from "@/components/backoffice/pageTitle";

/**
 * Tiêu đề trang chuẩn (kiểu chữ: PAGE_HEADING_TYPE), một dòng (dài thì cắt "…").
 * Dòng chữ cao 32px nên vẫn nằm gọn trong hàng tiêu đề 36px.
 */
export default function PageHeading({ children, className }) {
  return <h1 className={cn("min-w-0 truncate", PAGE_HEADING_TYPE, className)}>{children}</h1>;
}
