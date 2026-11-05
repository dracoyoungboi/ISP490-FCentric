import { useMemo } from "react";
import { FileText, ShoppingBag, Store, UserRound, UsersRound, Waypoints } from "lucide-react";
import { Card } from "@/pages/dashboard/admin/tong-quan-moi/ui";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPercent } from "@/utils/formatters";
import { dongKenh, dongNhanVien } from "./tinhBaoCaoDoanhThu";

/*
 * Hai thẻ dưới biểu đồ của Báo cáo doanh thu (FO-090, phương án A chốt 05/11/2026): Theo kênh bán, Theo nhân viên.
 * Cùng kỳ và kho với đầu trang. Mỗi dòng: biểu tượng / chữ tắt, tên, dòng phụ, số tiền, thanh tỷ trọng một màu.
 * Nhân viên bán hàng không có số lợi nhuận (máy chủ gửi null): dòng phụ bỏ phần lãi gộp; dòng của mình tô nền, gắn "Bạn".
 */

const LE = "px-5 @max-[520px]:px-4";
const BIEU_TUONG = { quay: Store, don: FileText, san: ShoppingBag };

function Thanh({ tyLe, xam = false, tyTrong }) {
  return (
    <span className="col-start-2 col-end-4 flex items-center gap-2.5">
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#eef1f5]" aria-hidden="true">
        <span className={cn("block h-full rounded-full", xam ? "bg-[#c3cbd6]" : "bg-[#1677ff]")} style={{ width: `${Math.max(0, Math.min(1, tyLe)) * 100}%` }} />
      </span>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-bo-muted">{formatPercent(tyTrong, 0)}</span>
    </span>
  );
}

function TangGiam({ tyLe }) {
  if (tyLe == null) return <span className="text-xs text-bo-muted">Chưa có cùng kỳ</span>;
  const tang = tyLe >= 0;
  return (
    <span className={cn("text-xs font-medium tabular-nums", tang ? "text-bo-success" : "text-bo-danger")}>
      <span aria-hidden="true">{tang ? "▲" : "▼"}</span>
      <span className="sr-only">{tang ? "Tăng" : "Giảm"}</span> {formatPercent(Math.abs(tyLe))}
    </span>
  );
}

/** Dòng cuối thẻ: tổng cả kỳ. */
function ChanThe({ nhan, soDon, doanhThu }) {
  return (
    <div className={cn("mt-auto flex items-center justify-between gap-3 rounded-b-lg border-t border-[#eef1f5] bg-bo-surface-subtle py-3 text-[13px]", LE)}>
      <span className="text-bo-muted">{nhan} · {formatNumber(soDon)} đơn</span>
      <b className="font-semibold tabular-nums text-bo-foreground">{formatCurrency(doanhThu)}</b>
    </div>
  );
}

export function TheTheoKenh({ data, loading, loi, onTaiLai, className }) {
  const dong = useMemo(() => dongKenh(data), [data]);
  const coDon = dong.filter((d) => d.soDon > 0);
  const tong = dong.reduce((s, d) => ({ soDon: s.soDon + d.soDon, doanhThu: s.doanhThu + d.doanhThu }), { soDon: 0, doanhThu: 0 });
  return (
    <Card
      className={className}
      empty={!loading && !loi && Boolean(data) && dong.length === 0}
      emptyIcon={Waypoints}
      emptyText="Chưa có đơn đã giao trong kỳ này."
      error={Boolean(loi)}
      loading={loading && !data}
      onRetry={onTaiLai}
      right={dong.length ? <span className="text-[13px] text-bo-muted">{coDon.length} kênh có đơn</span> : null}
      title="Theo kênh bán"
    >
      <ul className={cn("m-0 list-none py-1", LE)}>
        {dong.map((d) => {
          const Icon = BIEU_TUONG[d.loai];
          const phu = [
            `${formatNumber(d.soDon)} đơn`,
            d.soDonHoan ? `${formatNumber(d.soDonHoan)} bị hoàn` : null,
            d.tb != null ? `TB ${formatCurrency(d.tb)}` : null,
            d.loiNhuan != null ? `lãi gộp ${formatCurrencyCompact(d.loiNhuan)}` : null,
          ].filter(Boolean).join(" · ");
          return (
            <li key={d.ma} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-[#eef1f5] py-3 last:border-b-0">
              <span className="grid size-8 place-items-center rounded-lg border border-bo-border bg-bo-surface-subtle text-slate-600" aria-hidden="true">
                <Icon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-bo-foreground">{d.ten}</span>
                <span className="truncate text-xs text-bo-muted" title={phu}>{phu}</span>
              </span>
              <span className="flex flex-col items-end">
                <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-bo-foreground">{formatCurrency(d.doanhThu)}</span>
                <TangGiam tyLe={d.tang} />
              </span>
              <Thanh tyLe={d.thanh} tyTrong={d.tyTrong} />
            </li>
          );
        })}
      </ul>
      <ChanThe doanhThu={tong.doanhThu} nhan="Cả kỳ" soDon={tong.soDon} />
    </Card>
  );
}

export function TheTheoNhanVien({ data, loading, loi, onTaiLai, className }) {
  const dong = useMemo(() => dongNhanVien(data), [data]);
  const coSan = dong.some((d) => d.loai === "DON_SAN");
  const tong = dong.reduce((s, d) => ({ soDon: s.soDon + d.soDon, doanhThu: s.doanhThu + d.doanhThu }), { soDon: 0, doanhThu: 0 });
  return (
    <Card
      className={className}
      empty={!loading && !loi && Boolean(data) && dong.length === 0}
      emptyIcon={UsersRound}
      emptyText="Chưa có đơn đã giao trong kỳ này."
      error={Boolean(loi)}
      loading={loading && !data}
      onRetry={onTaiLai}
      right={dong.length ? <span className="text-[13px] text-bo-muted">Người lập đơn</span> : null}
      title="Theo nhân viên"
    >
      <ul className={cn("m-0 list-none py-1", LE)}>
        {dong.map((d, i) => {
          const laNguoi = d.loai === "NHAN_VIEN";
          // Dòng nhân viên cuối (ngay trên đơn không rõ người lập / đơn sàn): vạch dưới đứt nét để tách nhóm
          const cuoiNhom = laNguoi && i < dong.length - 1 && dong[i + 1].loai !== "NHAN_VIEN";
          const phu = d.loai === "DON_SAN"
            ? `${formatNumber(d.soDon)} đơn · không gắn nhân viên`
            : [
              `${formatNumber(d.soDon)} đơn`,
              d.tb != null ? `TB ${formatCurrency(d.tb)}` : null,
              d.loiNhuan != null ? `lãi gộp ${formatCurrencyCompact(d.loiNhuan)}` : null,
            ].filter(Boolean).join(" · ");
          return (
            <li
              key={d.khoa}
              className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-[#eef1f5] py-3 last:border-b-0",
                cuoiNhom && "border-dashed border-b-bo-border",
                d.laToi && "-mx-5 bg-bo-primary-soft/60 px-5 @max-[520px]:-mx-4 @max-[520px]:px-4",
              )}
            >
              {laNguoi ? (
                <span className="grid size-8 place-items-center rounded-full bg-bo-primary-soft text-[11px] font-semibold text-bo-primary" aria-hidden="true">{d.chuTat}</span>
              ) : (
                <span className="grid size-8 place-items-center rounded-full bg-[#eef1f5] text-bo-muted" aria-hidden="true">
                  {d.loai === "DON_SAN" ? <ShoppingBag className="size-4" /> : <UserRound className="size-4" />}
                </span>
              )}
              <span className="flex min-w-0 flex-col">
                <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-bo-foreground">
                  <span className="truncate">{d.ten}</span>
                  {d.laToi ? <span className="shrink-0 text-[11px] font-semibold text-bo-primary">Bạn</span> : null}
                </span>
                <span className="truncate text-xs text-bo-muted" title={phu}>{phu}</span>
              </span>
              <span className="flex flex-col items-end">
                <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-bo-foreground">{formatCurrency(d.doanhThu)}</span>
                <span className="text-xs tabular-nums text-bo-muted">{d.hang ? `#${d.hang}` : " "}</span>
              </span>
              <Thanh tyLe={d.thanh} tyTrong={d.tyTrong} xam={!laNguoi} />
            </li>
          );
        })}
      </ul>
      {coSan ? <p className={cn("m-0 -mt-1 pb-3 text-xs text-bo-muted", LE)}>Đơn sàn tự đồng bộ về hệ thống nên không có người lập.</p> : null}
      <ChanThe doanhThu={tong.doanhThu} nhan="Cả kỳ" soDon={tong.soDon} />
    </Card>
  );
}
