import { cn } from "@/lib/utils";
import { NGUONG_SAP_DAY } from "@/constants/nhapKho";

const MUC = [
  { ten: "Trống", o: "border-slate-300 bg-white" },
  { ten: `Dưới ${Math.round(NGUONG_SAP_DAY * 100)}%`, o: "border-bo-primary bg-bo-primary" },
  { ten: `Từ ${Math.round(NGUONG_SAP_DAY * 100)}%`, o: "border-amber-600 bg-amber-600" },
  { ten: "Đầy", o: "border-bo-danger bg-bo-danger" },
  { ten: "Bảo trì", o: "border-dashed border-slate-400 bg-bo-surface-subtle" },
];

/** Chú giải màu mức đầy dùng chung cho sơ đồ kệ và mặt bằng. */
export default function ChuGiaiMucDay({ className }) {
  return (
    <ul aria-label="Chú giải mức đầy" className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-bo-muted", className)}>
      {MUC.map((m) => (
        <li key={m.ten} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("inline-block size-3 rounded-[3px] border", m.o)} />
          {m.ten}
        </li>
      ))}
    </ul>
  );
}
