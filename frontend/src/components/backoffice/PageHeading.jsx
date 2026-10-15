import { cn } from "@/lib/utils";

/** Kiểu chữ chuẩn của tiêu đề trang: 20px, đậm 600, một dòng (dài thì cắt "…"). */
export default function PageHeading({ children, className }) {
  return (
    <h1
      className={cn(
        "min-w-0 truncate text-xl font-semibold leading-7 tracking-[-0.01em] text-bo-foreground",
        className,
      )}
    >
      {children}
    </h1>
  );
}
