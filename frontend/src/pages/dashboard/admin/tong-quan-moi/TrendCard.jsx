import { useState } from "react";
import { Info, LineChart as LineChartIcon, Table2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import KhungBieuDo from "@/components/shared/KhungBieuDo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Delta, MoreLink } from "./ui";
import { MAU2 } from "./mau";
import {
  formatPhanTram,
  formatSo,
  formatTien,
  formatTienGon,
  nhanDayDu,
  nhanTruc,
  phanTramThayDoi,
  tyLe,
} from "../tong-quan/tongQuanFormat";

const GHI_CHU_CACH_TINH =
  "Tính theo đơn đã giao (đã xuất đủ hàng hoặc hoàn thành), ghi nhận theo ngày giao. Cột nhạt là ngày hoặc tháng chưa kết thúc. Không tính kho trung chuyển.";

const CHI_SO = [
  { key: "doanhThu", ten: "Doanh thu", tien: true },
  { key: "loiNhuan", ten: "Lợi nhuận gộp", tien: true },
  { key: "soDon", ten: "Đơn đã giao", tien: false },
];

/**
 * Biểu đồ chính: 3 tab chỉ số (Doanh thu / Lợi nhuận gộp / Đơn đã giao), mỗi tab là một con số tổng của kỳ.
 * Một chuỗi số liệu mỗi lúc, cột theo ngày (hoặc tháng), một màu; cột của ngày/tháng chưa kết thúc nhạt hơn.
 */
export default function TrendCard({ data, loading, error, onRetry }) {
  const [chon, setChon] = useState("doanhThu");
  const [bang, setBang] = useState(false);
  const dt = data?.doanhThu;
  const nhom = dt?.nhom ?? "ngay";
  const diem = dt?.diem ?? [];
  const n = diem.length;
  const cs = CHI_SO.find((c) => c.key === chon);
  const chart = diem.map((d, i) => ({ ...d, nhan: nhanTruc(d.tu, nhom, n, i), gt: d[chon] }));
  const du = diem.filter((d) => !d.chuaKetThuc);
  const tb = du.length ? du.reduce((s, d) => s + d[chon], 0) / du.length : 0;
  const trong = dt ? dt.tongDoanhThu === 0 && diem.every((d) => d.doanhThu === 0) : false;
  const maxGt = Math.max(...chart.map((d) => d.gt), 0);
  const donVi = !cs.tien ? null : maxGt >= 1e9 ? { chia: 1e9, ten: "tỷ ₫" } : maxGt >= 1e6 ? { chia: 1e6, ten: "triệu ₫" } : { chia: 1e3, ten: "nghìn ₫" };
  const fmt = donVi ? (v) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(v / donVi.chia) : formatSo;
  const soSanh = dt?.kieuSoSanh === "cung_ky_nam_truoc" ? "so với cùng kỳ năm trước" : "so với kỳ trước";

  const tabs = dt
    ? [
        { key: "doanhThu", value: formatTienGon(dt.tongDoanhThu), sub: <><Delta value={phanTramThayDoi(dt.tongDoanhThu, dt.doanhThuKyTruoc)} /> <span>{soSanh}</span></> },
        { key: "loiNhuan", value: formatTienGon(dt.tongLoiNhuan), sub: <span>Biên lãi gộp {formatPhanTram(tyLe(dt.tongLoiNhuan, dt.tongDoanhThu))}</span> },
        { key: "soDon", value: `${formatSo(dt.tongSoDon)} đơn`, sub: <span>{dt.tongSoDon ? `${formatTien(Math.round(dt.tongDoanhThu / dt.tongSoDon))} mỗi đơn` : "—"}</span> },
      ]
    : [];

  return (
    <section aria-label="Doanh thu, lợi nhuận và đơn đã giao" className="flex min-w-0 flex-col rounded-xl border border-[#e6e9ef] bg-white">
      {loading ? (
        <div className="space-y-3 p-5" aria-hidden="true">
          <Skeleton className="h-14 w-full bg-slate-100" />
          <Skeleton className="h-64 w-full bg-slate-100" />
        </div>
      ) : error ? (
        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-sm text-bo-muted">
          Không tải được số liệu doanh thu.
          <button type="button" onClick={onRetry} className="font-medium text-bo-primary hover:underline">Thử lại</button>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Chọn chỉ số" className="grid grid-cols-3 border-b border-[#eef1f5]">
            {tabs.map((t, i) => {
              const c = CHI_SO[i];
              const active = chon === c.key;
              return (
                <button
                  key={c.key}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setChon(c.key)}
                  className={cn(
                    "relative min-w-0 px-3 pb-3.5 pt-4 text-left sm:px-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30",
                    i > 0 && "border-l border-[#eef1f5]",
                    active ? "bg-white" : "bg-[#fafbfc] hover:bg-slate-50",
                    i === 0 && "rounded-tl-xl",
                    i === 2 && "rounded-tr-xl",
                  )}
                >
                  <span className={cn("block text-[13px] font-medium", active ? "text-bo-foreground" : "text-bo-muted")}>{c.ten}</span>
                  <span className={cn("mt-0.5 block truncate text-base font-semibold tracking-[-0.01em] sm:text-xl", active ? "text-bo-foreground" : "text-slate-500")}>
                    {t.value}
                  </span>
                  <span className="mt-0.5 hidden flex-wrap items-center gap-x-1 text-xs text-bo-muted sm:flex">{t.sub}</span>
                  {active ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-bo-primary" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 px-5 pt-4 sm:justify-between">
            <p className="hidden min-w-0 items-center gap-1.5 text-xs text-bo-muted sm:flex">
              <span className="truncate">
                {cs.ten} theo {nhom === "thang" ? "tháng" : "ngày"}{donVi ? ` (${donVi.ten})` : ""} · trung bình {cs.tien ? formatTienGon(tb) : formatSo(Math.round(tb))}
                {nhom === "thang" ? "/tháng" : "/ngày"}
              </span>
              <span
                tabIndex={0}
                title={GHI_CHU_CACH_TINH}
                aria-label={GHI_CHU_CACH_TINH}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
              >
                <Info className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              </span>
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                aria-pressed={bang}
                onClick={() => setBang((v) => !v)}
                className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-bo-muted hover:bg-slate-50 hover:text-bo-foreground aria-pressed:bg-slate-100 aria-pressed:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
              >
                <Table2 className="size-3.5" aria-hidden="true" />
                Bảng số liệu
              </button>
              <MoreLink to="/reports/revenue">Báo cáo doanh thu</MoreLink>
            </div>
          </div>

          {trong ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 text-center text-[13px] text-bo-muted">
              <LineChartIcon className="size-5 text-slate-400" aria-hidden="true" />
              Chưa có đơn đã giao trong kỳ này.
            </div>
          ) : bang ? (
            <div className="mx-5 mb-5 mt-3 max-h-[280px] overflow-auto rounded-lg border border-[#eef1f5]">
              <table className="w-full text-[13px] tabular-nums">
                <thead className="sticky top-0 bg-[#fafbfc] text-left text-xs text-bo-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">{nhom === "thang" ? "Tháng" : "Ngày"}</th>
                    <th className="px-3 py-2 text-right font-medium">Doanh thu</th>
                    <th className="px-3 py-2 text-right font-medium">Lợi nhuận gộp</th>
                    <th className="px-3 py-2 text-right font-medium">Số đơn</th>
                  </tr>
                </thead>
                <tbody>
                  {[...diem].reverse().map((d) => (
                    <tr key={d.tu} className="border-t border-[#eef1f5]">
                      <td className="px-3 py-1.5">{nhanDayDu(d.tu, nhom)}{d.chuaKetThuc ? <span className="text-bo-muted"> · chưa kết thúc</span> : null}</td>
                      <td className="px-3 py-1.5 text-right">{formatTien(d.doanhThu)}</td>
                      <td className="px-3 py-1.5 text-right">{formatTien(d.loiNhuan)}</td>
                      <td className="px-3 py-1.5 text-right">{formatSo(d.soDon)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="relative h-[292px] px-3 pb-3 pt-2" role="figure" aria-label={`Biểu đồ cột ${cs.ten.toLowerCase()} theo ${nhom === "thang" ? "tháng" : "ngày"}`}>
              <KhungBieuDo>
                <BarChart data={chart} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} barCategoryGap="34%" accessibilityLayer>
                  <CartesianGrid vertical={false} stroke={MAU2.luoi} />
                  <XAxis dataKey="nhan" tickLine={false} axisLine={false} tick={{ fill: MAU2.chu, fontSize: 12 }} interval="preserveStartEnd" minTickGap={24} tickMargin={10} />
                  <YAxis tickFormatter={fmt} tickLine={false} axisLine={false} tick={{ fill: MAU2.chu, fontSize: 12 }} width={44} allowDecimals={false} tickCount={5} />
                  <Tooltip cursor={{ fill: "#f4f6f9" }} content={<Tip nhom={nhom} />} />
                  {tb > 0 ? <ReferenceLine y={tb} stroke="#94a3b8" strokeDasharray="4 4" ifOverflow="extendDomain" /> : null}
                  <Bar dataKey="gt" fill={MAU2.chinh} radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false}>
                    {chart.map((d) => (
                      <Cell key={d.tu} fillOpacity={d.chuaKetThuc ? 0.35 : 1} />
                    ))}
                  </Bar>
                </BarChart>
              </KhungBieuDo>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Tip({ active, payload, nhom }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="min-w-48 rounded-lg bg-[#182537] px-3 py-2.5 text-xs text-white shadow-lg">
      <p className="mb-1.5 font-semibold">{nhanDayDu(d.tu, nhom)}</p>
      <Row label="Doanh thu" value={formatTien(d.doanhThu)} />
      <Row label="Lợi nhuận gộp" value={formatTien(d.loiNhuan)} />
      <Row label="Biên lãi gộp" value={formatPhanTram(tyLe(d.loiNhuan, d.doanhThu))} />
      <Row label="Đơn đã giao" value={formatSo(d.soDon)} />
      {d.chuaKetThuc ? <p className="mt-1.5 border-t border-white/15 pt-1.5 text-white/70">{nhom === "thang" ? "Tháng đang chạy" : "Chưa hết ngày"}</p> : null}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <p className="flex justify-between gap-4 py-0.5">
      <span className="text-white/70">{label}</span>
      <b className="font-semibold tabular-nums">{value}</b>
    </p>
  );
}
