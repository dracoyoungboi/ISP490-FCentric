import { cn } from "@/lib/utils";

export default function FormSection({
  title,
  description,
  children,
  className,
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="mb-4 border-b border-bo-border pb-3">
        <h2 className="text-sm font-semibold text-bo-foreground sm:text-base">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-bo-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
