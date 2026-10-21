import { useState } from "react";
import { SO_LO_HIEN } from "@/config/bangChungTu";
import { cn } from "@/lib/utils";
import { soVN } from "./bangChungTu.js";

const NUT_THEM =
  "inline-flex h-[22px] items-center whitespace-nowrap rounded border border-dashed border-slate-300 bg-white px-1.5 text-xs text-slate-600 transition-colors hover:border-bo-primary hover:text-bo-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary";

/**
 * Thẻ lô trên một dòng chứng từ: "maLo × số lượng" (thiếu số lượng thì chỉ mã lô).
 * Hiện tối đa `soHien` thẻ (config/bangChungTu.js → SO_LO_HIEN), còn lại gom vào nút "+n lô" mở ngay tại chỗ, mở rồi có "Thu gọn".
 * `lo`: `[{ maLo, soLuong }]` hoặc mảng mã lô. `cuaDong`: tên dòng cho nhãn đọc màn hình, vd. SKU ("Xem thêm 3 lô của …").
 * Không có lô: hiện `khiTrong` (mặc định "—").
 */
export default function ChipLo({ lo, soHien = SO_LO_HIEN, cuaDong, khiTrong = "—", className }) {
  const [mo, setMo] = useState(false);
  const ds = (Array.isArray(lo) ? lo : [])
    .map((l) => (l && typeof l === "object" ? l : { maLo: l }))
    .filter((l) => l.maLo != null && String(l.maLo).trim() !== "");

  if (!ds.length) return <span className="text-bo-muted">{khiTrong}</span>;

  const gioiHan = Math.max(1, Number(soHien) || SO_LO_HIEN);
  const an = ds.length - gioiHan;
  const hien = mo || an <= 0 ? ds : ds.slice(0, gioiHan);

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {hien.map((l, i) => (
        <span
          key={`${l.maLo}-${i}`}
          className="inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded border border-slate-200 bg-slate-100 px-1.5 font-mono text-xs text-bo-foreground"
        >
          {l.maLo}
          {l.soLuong != null ? (
            <span className="font-sans tabular-nums text-bo-muted">× {soVN(l.soLuong)}</span>
          ) : null}
        </span>
      ))}
      {an > 0 ? (
        <button
          type="button"
          aria-expanded={mo}
          aria-label={mo ? "Thu gọn danh sách lô" : `Xem thêm ${an} lô${cuaDong ? ` của ${cuaDong}` : ""}`}
          onClick={() => setMo((x) => !x)}
          className={NUT_THEM}
        >
          {mo ? "Thu gọn" : `+${an} lô`}
        </button>
      ) : null}
    </div>
  );
}
