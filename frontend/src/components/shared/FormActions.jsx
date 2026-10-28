import { cn } from "@/lib/utils";

export default function FormActions({ children, className }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-bo-border bg-bo-surface/95 px-4 py-3 backdrop-blur sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
