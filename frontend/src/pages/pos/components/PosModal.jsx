import { X } from 'lucide-react';

export default function PosModal({ title, description, onClose, children, footer, size = 'md' }) {
  const width = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  }[size] || 'max-w-xl';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-modal="true"
        className={`flex max-h-[92dvh] w-full ${width} flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm`}
        role="dialog"
        aria-label={title}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-bo-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-bo-foreground">{title}</h2>
            {description ? <p className="mt-1 text-sm text-bo-muted">{description}</p> : null}
          </div>
          <button
            aria-label="Đóng cửa sổ"
            className="rounded-md p-1.5 text-bo-muted transition hover:bg-slate-100 hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-bo-primary"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <footer className="shrink-0 border-t border-bo-border bg-slate-50/70 px-5 py-4">{footer}</footer> : null}
      </section>
    </div>
  );
}
