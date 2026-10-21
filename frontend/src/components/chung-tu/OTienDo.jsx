import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { docSo, soVN } from "./bangChungTu.js";

/**
 * Ô tiến độ "thanh + x/y" dùng chung (rà soát N11: Đã nhặt của phiếu nhặt, Đã lấy của phiếu xuất và phiếu chuyển kho).
 * Thanh 6px nền xám nhạt: xanh dương khi còn thiếu, xanh lá khi đủ (chỉ để nhìn). Số:
 * - đủ (`can` > 0 và `da` ≥ `can`): dấu ✓ + "x/y" xanh lá đậm, kèm "(đủ)" cho trình đọc màn hình;
 * - thiếu: **x** đậm + "/y" xám; `canhBaoKhiThieu` → x màu cam (phiếu xuất / chuyển kho đang thiếu lô).
 * `hienCan = false`: chỉ ghi số đã làm (dòng con khi cột bên cạnh đã có số cần). `nhanDoc`: câu đọc thay cho "x/y",
 * vd. "Đã nhặt 3 trên 5".
 */
export default function OTienDo({ da, can, hienCan = true, canhBaoKhiThieu = false, nhanDoc, className }) {
  const soDa = docSo(da);
  const soCan = docSo(can);
  const du = soCan > 0 && soDa >= soCan;
  const tiLe = soCan > 0 ? Math.min(100, Math.round((soDa / soCan) * 100)) : 0;

  const so = du ? (
    <span className="inline-flex items-center gap-1 font-semibold text-bo-success">
      <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
      {soVN(soDa)}
      {hienCan ? `/${soVN(soCan)}` : null}
    </span>
  ) : (
    <span>
      <b className={cn("font-semibold", canhBaoKhiThieu ? "text-bo-warning" : "text-bo-foreground")}>{soVN(soDa)}</b>
      {hienCan ? <span className="text-bo-muted">/{soVN(soCan)}</span> : null}
    </span>
  );

  return (
    <div className={cn("relative grid min-w-[120px] grid-cols-[minmax(40px,1fr)_auto] items-center gap-2.5", className)}>
      <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-slate-200/70">
        <span
          className={cn("block h-full rounded-full", du ? "bg-bo-success" : "bg-bo-primary")}
          // data-viz: bề rộng theo tỉ lệ đã làm / cần
          style={{ width: `${tiLe}%` }}
        />
      </span>
      <span className="whitespace-nowrap text-right text-[13px] tabular-nums">
        {nhanDoc ? <span aria-hidden="true">{so}</span> : so}
        {nhanDoc ? <span className="sr-only">{nhanDoc}</span> : du ? <span className="sr-only"> (đủ)</span> : null}
      </span>
    </div>
  );
}
