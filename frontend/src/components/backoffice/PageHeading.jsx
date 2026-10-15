import { cn } from "@/lib/utils";

/**
 * Kiểu chữ chuẩn của tiêu đề trang: 24px, đậm 560, nét Inter Display (opsz 32), màu bo-heading,
 * một dòng (dài thì cắt "…"). Dòng chữ cao 32px nên vẫn nằm gọn trong hàng tiêu đề 36px.
 */
export default function PageHeading({ children, className }) {
  return (
    <h1
      className={cn(
        "min-w-0 truncate text-[24px] leading-8 font-[560] tracking-[-0.01em] text-bo-heading [font-variation-settings:'opsz'_32]",
        className,
      )}
    >
      {children}
    </h1>
  );
}
