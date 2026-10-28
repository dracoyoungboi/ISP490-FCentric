import { cn } from "@/lib/utils";

export default function FilterBar({
  primary,
  filters,
  actions,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-bo-border bg-bo-surface p-4 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        {primary}
        {filters ? (
          <div className="flex flex-wrap items-center gap-2">{filters}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
