import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

// Số ô kệ hiện trước (khoảng 2 hàng trên máy tính); còn lại mở bằng "Xem tất cả"
const SO_KE_HIEN = 14;

/**
 * Tiến độ theo kệ của đợt đang kiểm kê: mỗi kệ một ô (mã kệ, vạch tiến độ, số dòng đã đếm, người đếm gần nhất). Bấm ô để
 * chỉ xem / đếm kệ đó, bấm lại ô đang chọn để bỏ lọc. Máy tính: lưới; khối hẹp (điện thoại): một hàng cuộn ngang.
 *
 * - `dsKe`: kệ của đợt theo thứ tự đi đếm `[{ id, ma }]` (kể cả kệ trống, chưa có dòng).
 * - `tienDo`: kiemKe.tienDoTheoKe (trên mọi dòng, không theo bộ lọc).
 * - `keDangXem`: id kệ đang lọc. `onChonKe(id | null)`.
 */
export default function BanDoTienDoKe({ dsKe, tienDo, keDangXem, onChonKe, tongDong, daDem }) {
  const [moHet, setMoHet] = useState(false);
  if (dsKe.length < 2) return null;
  const phanTram = tongDong ? Math.floor((daDem / tongDong) * 100) : 0;
  // Đợt nhiều kệ (toàn kho 100–300 kệ): thu gọn, luôn giữ kệ đang xem trong phần hiện
  const thuGon = !moHet && dsKe.length > SO_KE_HIEN;
  const keHien = thuGon
    ? dsKe.filter((k, i) => i < SO_KE_HIEN || k.id === keDangXem)
    : dsKe;
  return (
    <section aria-label={t("Tiến độ theo kệ")} className="grid gap-2.5 px-4 pt-5 sm:px-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold leading-6 text-bo-foreground">{t("Tiến độ theo kệ")}</h2>
        <span className="text-sm text-bo-muted tabular-nums">
          {t("{{daDem}}/{{tongDong}} dòng · {{phanTram}}%", { count: tongDong, daDem: soVN(daDem), tongDong: soVN(tongDong), phanTram })}
        </span>
        {keDangXem != null ? (
          <button
            type="button"
            onClick={() => onChonKe(null)}
            className="ml-auto rounded text-xs font-semibold text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
          >
            {t("Xem mọi kệ")}
          </button>
        ) : null}
      </div>
      <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1 [scrollbar-width:thin] @2xl/khoi:grid @2xl/khoi:grid-cols-[repeat(auto-fill,minmax(132px,1fr))] @2xl/khoi:overflow-visible @2xl/khoi:pb-0">
        {keHien.map((k) => {
          const td = tienDo.get(k.id) ?? { tong: 0, daDem: 0, nguoi: null };
          const trong = td.tong === 0;
          const xong = !trong && td.daDem === td.tong;
          const dangXem = keDangXem === k.id;
          return (
            <li key={k.id} className="shrink-0 basis-[132px] @2xl/khoi:basis-auto">
              <button
                type="button"
                aria-pressed={dangXem}
                onClick={() => onChonKe(dangXem ? null : k.id)}
                className={cn(
                  "grid w-full gap-1.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
                  dangXem
                    ? "border-bo-primary bg-bo-primary-soft shadow-[0_0_0_1px_var(--color-bo-primary)]"
                    : trong
                      ? "border-bo-border bg-bo-surface-subtle hover:border-slate-300"
                      : "border-bo-border bg-bo-surface hover:border-slate-300 hover:bg-bo-surface-subtle",
                )}
              >
                <span className="flex items-center gap-1">
                  <span className="truncate font-mono text-[13px] font-semibold tracking-wide text-bo-heading">{k.ma}</span>
                  {xong ? <CircleCheck className="ml-auto size-4 shrink-0 text-bo-success" aria-hidden="true" /> : null}
                </span>
                <span className="block h-1.5 overflow-hidden rounded-full bg-slate-200/80" aria-hidden="true">
                  <span
                    className={cn("block h-full rounded-full transition-[width] duration-300", xong ? "bg-bo-success" : "bg-bo-primary")}
                    // data-viz: bề rộng theo phần trăm dòng đã đếm của kệ
                    style={{ width: `${trong ? 0 : Math.floor((td.daDem / td.tong) * 100)}%` }}
                  />
                </span>
                <span className="text-xs leading-4 text-bo-muted tabular-nums">
                  {trong ? t("Trống trên sổ") : xong ? t("Đã đếm hết") : t("{{daDem}}/{{tongDong}} dòng", { count: td.tong, daDem: soVN(td.daDem), tongDong: soVN(td.tong) })}
                </span>
                <span className="block min-h-4 truncate text-[11px] font-medium leading-4 text-slate-500">{td.nguoi ?? ""}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {dsKe.length > SO_KE_HIEN ? (
        <button
          type="button"
          onClick={() => setMoHet((x) => !x)}
          className="justify-self-start rounded text-xs font-semibold text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
        >
          {moHet ? t("Thu gọn") : t("Xem tất cả {{soKe}} kệ", { count: dsKe.length, soKe: soVN(dsKe.length) })}
        </button>
      ) : null}
    </section>
  );
}
