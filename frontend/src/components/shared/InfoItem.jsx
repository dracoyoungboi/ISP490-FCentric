import { createElement } from "react";

/** Ô thông tin nhãn + giá trị, cùng kiểu InfoItem ở PhieuXuatKhoDetail. */
export default function InfoItem({ icon, label, value, highlight = false }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {icon ? createElement(icon, { className: "size-3.5 text-bo-primary" }) : null}
        <span className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{label}</span>
      </div>
      <div className={`min-w-0 break-words text-sm font-semibold ${highlight ? "text-bo-primary" : "text-bo-foreground"}`}>
        {empty ? "---" : value}
      </div>
    </div>
  );
}
