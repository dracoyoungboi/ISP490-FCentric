import { useState } from "react";
import { BarChart3, LineChart as LineChartIcon, Table2, TrendingUp } from "lucide-react";
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import KhungBieuDo from "@/components/shared/KhungBieuDo";
import { cn } from "@/lib/utils";
import { Card, LE, MoreLink } from "./ui";
import { MAU2 } from "./mau";
import { ID_BIEU_DO } from "./KpiStrip";
import { formatSo, formatTienNgan } from "../tong-quan/tongQuanFormat";
import { CHI_SO, chuoiBieuDo, vachTruc } from "../tong-quan/tongQuanSoLieu";
import { chuThichBieuDo, nhanDiem, nhanTrucDiem, soDiemDaCo, tieuDeBieuDo } from "../tong-quan/kyXem";
import { t } from "@/i18n";

const nfTruc = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const DO_AM = "#d92d20";

const KIEU = [
  { value: "duong", ten: t("Biểu đồ đường"), icon: LineChartIcon },
  { value: "cot", ten: t("Biểu đồ cột"), icon: BarChart3 },
  { value: "bang", ten: t("Bảng số liệu"), icon: Table2 },
];

/**
 * Biểu đồ của chỉ số đang chọn ở dải đầu trang (đặc tả bản 2, mục 3, 10): kỳ 1 ngày theo giờ (mặc định cột), ≤ 62 ngày
 * theo ngày, dài hơn theo tháng; kỳ này đường xanh, kỳ trước nét đứt xám trên cùng một trục (cho phép số âm khi khách trả
 * nhiều hơn số bán). Điểm cuối chưa trọn ngày / tháng vẽ nét đứt và không tính vào "Trung bình". Chú thích ghi khoảng ngày
 * thật; hộp rê chuột ghi thứ và ngày của từng điểm, không dùng chữ "kỳ này / kỳ trước".
 */
export default function TrendCard({ data, k, chon, loading, error, onRetry, className }) {
  const [kieuChon, setKieu] = useState(null);
  const cs = CHI_SO.find((c) => c.key === chon) ?? CHI_SO[0];
  const { nay, truoc } = chuoiBieuDo(data?.bieuDo, k, cs.key);
  const n = k?.soDiem ?? 0;
  const daCo = k ? soDiemDaCo(k) : 0;
  const dangDo = Boolean(k?.dangChay) && daCo > 1;
  const kieu = kieuChon ?? (k?.nhom === "gio" ? "cot" : "duong");

  const rows = Array.from({ length: n }, (_, i) => ({
    i,
    nhan: nhanTrucDiem(k, i),
    nay: nay[i],
    // Đường liền tới điểm trước điểm đang chạy; đoạn cuối nét đứt
    nayChac: dangDo && i >= daCo - 1 ? undefined : nay[i],
    nayCuoi: dangDo && i >= daCo - 2 && i <= daCo - 1 ? nay[i] : undefined,
    truoc: truoc[i],
  }));
  const coSo = nay.some((v) => v != null && v !== 0) || truoc.some((v) => v != null && v !== 0);
  const trong = !loading && !error && !coSo;

  const giaTri = [...nay, ...truoc].filter((v) => v != null);
  const max = Math.max(0, ...giaTri);
  const min = Math.min(0, ...giaTri);
  const lonNhat = Math.max(max, -min);
  const donVi = !cs.tien
    ? { chia: 1, ten: t("đơn") }
    : lonNhat >= 1e9
      ? { chia: 1e9, ten: t("tỷ ₫") }
      : lonNhat >= 1e6
        ? { chia: 1e6, ten: t("triệu ₫") }
        : { chia: 1e3, ten: t("nghìn ₫") };
  const { ticks, day, dinh } = vachTruc(min, max > 0 || min < 0 ? max : 1, !cs.tien);

  const fmt = (v) => (v == null ? t("Không có đơn") : cs.tien ? formatTienNgan(v) : t("{{soDon}} đơn", { soDon: formatSo(v), count: v }));
  // Trung bình theo ngày / tháng của các điểm đã trọn; kỳ theo giờ và giá trị trung bình mỗi đơn không ghi
  const tronVen = nay.slice(0, dangDo ? daCo - 1 : daCo).filter((v) => v != null);
  const tb =
    cs.key === "tbDon" || k?.nhom === "gio" || !tronVen.length
      ? null
      : (() => {
          const v = tronVen.reduce((s, x) => s + x, 0) / tronVen.length;
          const moi = k.nhom === "thang" ? t("tháng") : t("ngày");
          return cs.tien ? `${formatTienNgan(v)}/${moi}` : t("{{so}} đơn/{{moi}}", { so: nf1.format(v), moi });
        })();
  const tieuDe = tieuDeBieuDo(cs.ten, k);
  const [lgNay, lgTruoc] = chuThichBieuDo(k);

  return (
    <Card
      id={ID_BIEU_DO}
      className={className}
      title={tieuDe}
      scope={kieu === "bang" || trong || error ? null : donVi.ten}
      scopeClassName="@max-[440px]:hidden"
      loading={loading}
      error={error}
      onRetry={onRetry}
      right={
        <>
          {trong || error ? null : (
            <div role="group" aria-label={t("Cách xem")} className="inline-flex rounded-md bg-slate-100 p-0.5">
              {KIEU.map((x) => {
                const Icon = x.icon;
                const on = kieu === x.value;
                return (
                  <button
                    key={x.value}
                    type="button"
                    aria-pressed={on}
                    aria-label={x.ten}
                    title={x.ten}
                    onClick={() => setKieu(x.value)}
                    className={cn(
                      "grid h-6 w-7 cursor-pointer place-items-center rounded text-bo-muted hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
                      on && "bg-bo-surface text-bo-primary shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:text-bo-primary",
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
          <MoreLink to="/reports/revenue">
            <span className="@max-[520px]:sr-only">{t("Xem báo cáo")}</span>
          </MoreLink>
        </>
      }
      bodyClassName={cn(LE, "pb-4 pt-3.5")}
    >
      {trong ? null : (
        <div className="mb-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs leading-4 text-bo-muted">
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            {kieu === "cot" ? <i className="inline-block size-2.5 rounded-[2px] bg-bo-primary" aria-hidden="true" /> : <i className="inline-block w-4 border-t-2 border-bo-primary" aria-hidden="true" />}
            <b className="font-medium text-bo-foreground">{lgNay}</b>
          </span>
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            {kieu === "cot" ? <i className="inline-block size-2.5 rounded-[2px] bg-[#cdd5e0]" aria-hidden="true" /> : <i className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: MAU2.kyTruoc }} aria-hidden="true" />}
            {lgTruoc}
          </span>
          {kieu !== "bang" ? <span className="hidden whitespace-nowrap @max-[440px]:inline">{t("Đơn vị: {{ten}}", { ten: donVi.ten })}</span> : null}
          {tb ? (
            <span className="ml-auto whitespace-nowrap @max-[560px]:hidden">
              {t("Trung bình")} <b className="font-medium text-bo-foreground">{tb}</b>
            </span>
          ) : null}
        </div>
      )}

      {trong ? (
        <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center gap-2 text-center text-[13px] text-bo-muted @max-[520px]:min-h-[190px]">
          <TrendingUp className="size-5 text-slate-400" aria-hidden="true" />
          {t("Chưa có đơn xuất kho trong kỳ này và kỳ so sánh.")}
        </div>
      ) : kieu === "bang" ? (
        <div className="max-h-[220px] overflow-auto rounded-md border border-[#eef1f5]">
          <table className="w-full text-[13px] tabular-nums">
            <caption className="sr-only">{`${tieuDe}: ${lgNay}, ${lgTruoc}`}</caption>
            <thead className="sticky top-0 bg-bo-surface-subtle text-left text-xs text-bo-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{lgNay}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{cs.ten}</th>
                <th scope="col" className="px-3 py-2 font-medium">{lgTruoc}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{cs.ten}</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.i} className="border-t border-[#eef1f5]">
                  <td className="px-3 py-1.5">{nhanDiem(k, r.i, false)}</td>
                  <td className="px-3 py-1.5 text-right font-medium text-bo-foreground">{r.nay === undefined ? t("Chưa tới") : fmt(r.nay)}</td>
                  {/* Kỳ đem so ngắn hơn (tháng 2 so với tháng 3): điểm không có trong kỳ trước để trống */}
                  <td className="px-3 py-1.5 text-bo-muted">{r.truoc === undefined ? "—" : nhanDiem(k, r.i, true)}</td>
                  <td className="px-3 py-1.5 text-right">{r.truoc === undefined ? "—" : fmt(r.truoc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="relative min-h-[220px] flex-1 @max-[520px]:min-h-[190px]"
          role="figure"
          aria-label={t("{{tieuDe}} ({{donVi}}): {{nay}}, so với {{truoc}}. Bấm nút Bảng số liệu để đọc từng điểm.", { tieuDe, donVi: donVi.ten, nay: lgNay, truoc: lgTruoc })}
        >
          {/* Giãn theo thẻ (cùng hàng với Cần xử lý, như demo), ít nhất 220px. Khung vẽ đặt tuyệt đối để thẻ còn co lại
              được khi thẻ bên cạnh ngắn đi: chiều cao đo theo ô, không theo hình đã vẽ. */}
          <KhungBieuDo className="absolute inset-0">
            <ComposedChart data={rows} margin={{ top: 8, right: kieu === "duong" ? 22 : 6, bottom: 0, left: 0 }} barCategoryGap="24%" barGap={2} accessibilityLayer>
              <CartesianGrid vertical={false} stroke={MAU2.luoi} />
              <XAxis
                dataKey="nhan"
                interval="preserveStartEnd"
                minTickGap={14}
                tickLine={false}
                axisLine={{ stroke: MAU2.truc }}
                tick={{ fill: MAU2.chu, fontSize: 12 }}
                tickMargin={8}
              />
              <YAxis
                type="number"
                domain={[day, dinh]}
                ticks={ticks}
                tickFormatter={(v) => nfTruc.format(v / donVi.chia)}
                tickLine={false}
                axisLine={false}
                tick={{ fill: MAU2.chu, fontSize: 12 }}
                width={40}
              />
              <Tooltip
                isAnimationActive={false}
                cursor={kieu === "cot" ? { fill: "rgba(22, 119, 255, 0.06)" } : { stroke: MAU2.truc, strokeWidth: 1, strokeDasharray: "3 3" }}
                wrapperStyle={{ outline: "none", zIndex: 10 }}
                content={<TipBieuDo k={k} fmt={fmt} kieu={kieu} />}
              />
              {/* recharts chỉ nhận con trực tiếp (mảng), không nhận Fragment */}
              {kieu === "duong"
                ? [
                    <Area key="vung" type="linear" dataKey="nay" stroke="none" fill={MAU2.nenVung} fillOpacity={1} connectNulls={false} isAnimationActive={false} activeDot={false} />,
                    <Line key="truoc" type="linear" dataKey="truoc" stroke={MAU2.kyTruoc} strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={{ r: 4, fill: MAU2.kyTruoc, stroke: "#fff", strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />,
                    <Line key="chac" type="linear" dataKey="nayChac" stroke={MAU2.chinh} strokeWidth={2} strokeLinejoin="round" connectNulls={false} isAnimationActive={false} activeDot={false}
                      dot={({ key, cx, cy, index }) => (!dangDo && index === daCo - 1 && cx != null ? <circle key={key} cx={cx} cy={cy} r={3} fill={MAU2.chinh} /> : <g key={key} />)} />,
                    dangDo ? (
                      <Line key="cuoi" type="linear" dataKey="nayCuoi" stroke={MAU2.chinh} strokeWidth={2} strokeDasharray="4 4" connectNulls={false} isAnimationActive={false} activeDot={false} legendType="none"
                        dot={({ key, cx, cy, index }) => (index === daCo - 1 && cx != null ? <circle key={key} cx={cx} cy={cy} r={3.5} fill="#fff" stroke={MAU2.chinh} strokeWidth={2} /> : <g key={key} />)} />
                    ) : null,
                    <Line key="diem" type="linear" dataKey="nay" stroke="none" dot={false} activeDot={{ r: 4, fill: "#fff", stroke: MAU2.chinh, strokeWidth: 2 }} isAnimationActive={false} legendType="none" />,
                  ]
                : [
                    <Bar key="truoc" dataKey="truoc" fill="#cdd5e0" radius={[2, 2, 0, 0]} maxBarSize={18} isAnimationActive={false} />,
                    <Bar key="nay" dataKey="nay" fill={MAU2.chinh} radius={[2, 2, 0, 0]} maxBarSize={18} isAnimationActive={false}>
                      {rows.map((r) => <Cell key={r.i} fill={r.nay < 0 ? DO_AM : MAU2.chinh} />)}
                    </Bar>,
                  ]}
            </ComposedChart>
          </KhungBieuDo>
        </div>
      )}
    </Card>
  );
}

function TipBieuDo({ active, payload, k, fmt, kieu }) {
  if (!active || !payload?.length || !k) return null;
  const r = payload[0].payload;
  return (
    <div className="min-w-56 rounded-md border border-bo-border bg-bo-surface px-3 py-2.5 text-xs leading-4 shadow-lg">
      <p className="flex items-center gap-2">
        {kieu === "cot" ? <i className="inline-block size-2.5 rounded-[2px] bg-bo-primary" aria-hidden="true" /> : <i className="inline-block w-4 border-t-2 border-bo-primary" aria-hidden="true" />}
        <span className="flex-1 text-bo-muted">{nhanDiem(k, r.i, false)}</span>
        <b className="text-sm font-semibold tabular-nums text-bo-foreground">{r.nay === undefined ? t("Chưa tới") : fmt(r.nay)}</b>
      </p>
      {r.nay < 0 ? <p className="mt-1 pl-6 text-[#b42318]">{t("Khách trả nhiều hơn số bán trong khung này")}</p> : null}
      {r.truoc === undefined ? null : (
        <p className="mt-1.5 flex items-center gap-2">
          {kieu === "cot" ? <i className="inline-block size-2.5 rounded-[2px] bg-[#cdd5e0]" aria-hidden="true" /> : <i className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: MAU2.kyTruoc }} aria-hidden="true" />}
          <span className="flex-1 text-bo-muted">{nhanDiem(k, r.i, true)}</span>
          <b className="text-sm font-semibold tabular-nums text-bo-foreground">{fmt(r.truoc)}</b>
        </p>
      )}
    </div>
  );
}
