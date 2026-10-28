import { useState } from "react";
import { BarChart3, LineChart as LineChartIcon, Table2, TrendingUp } from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import KhungBieuDo from "@/components/shared/KhungBieuDo";
import { cn } from "@/lib/utils";
import { Card, LE, MoreLink } from "./ui";
import { MAU2 } from "./mau";
import { khoangKy } from "./boLoc";
import { ID_BIEU_DO } from "./KpiStrip";
import { docNgay, formatSo, formatTienNgan, nhanTruc, tenThu } from "../tong-quan/tongQuanFormat";
import { CHI_SO, diemDaTron, giaTriDiem, vachTruc } from "../tong-quan/tongQuanSoLieu";

const nfTruc = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const hai = (n) => String(n).padStart(2, "0");

const KIEU = [
  { value: "duong", ten: "Biểu đồ đường", icon: LineChartIcon },
  { value: "cot", ten: "Biểu đồ cột", icon: BarChart3 },
  { value: "bang", ten: "Bảng số liệu", icon: Table2 },
];

/** Nhãn ngày trong tooltip và bảng: "Thứ Bảy, 10/10" hoặc "Tháng 10/2025". */
function nhanNgan(tu, nhom) {
  const d = docNgay(tu);
  if (!d) return "";
  if (nhom === "thang") return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
  return `${tenThu(d)}, ${hai(d.getDate())}/${hai(d.getMonth() + 1)}`;
}

/**
 * Biểu đồ theo ngày (hoặc tháng) của chỉ số đang chọn ở dải đầu trang.
 * - Kỳ này: đường 2px màu chính nối thẳng từng ngày (không làm mượt, để đỉnh và đáy đúng ngày), nền nhạt;
 *   kỳ trước (diemKyTruoc): nét đứt xám, cùng một trục. Chú thích chỉ ghi đường có vẽ: kỳ trước chưa có số liệu
 *   thì đã ghi ở ô Doanh thu của dải chỉ số, không nhắc lại ở đây.
 * - Mặc định tự chọn: số liệu thưa (dưới nửa số ngày có bán) vẽ cột, dày thì vẽ đường; người xem đổi được,
 *   kèm dạng bảng số liệu cho trình đọc màn hình và để đọc số chính xác.
 * - Chỉ vẽ ngày/tháng đã trọn để khớp tổng ở dải chỉ số; hôm nay xem ở thẻ Hôm nay.
 * - Giá trị đơn trung bình của ngày không có đơn bỏ trống (đứt đoạn), ngày lẻ hiện thành chấm.
 */
export default function TrendCard({ data, ky, chon, loading, error, onRetry, className }) {
  const [kieuChon, setKieu] = useState(null);
  const dt = data?.doanhThu;
  const nhom = dt?.nhom ?? "ngay";
  const cs = CHI_SO.find((c) => c.key === chon) ?? CHI_SO[0];
  const k = khoangKy(ky, data?.thoiDiem);
  const namTruoc = dt?.kieuSoSanh === "cung_ky_nam_truoc";

  const nay = diemDaTron(dt);
  const dsTruoc = Array.isArray(dt?.diemKyTruoc) ? dt.diemKyTruoc : null;
  const n = nay.length;
  const rows = nay.map((d, i) => {
    const p = dsTruoc?.[i] ?? null;
    return { tu: d.tu, nhan: nhanTruc(d.tu, nhom, n, i), nay: giaTriDiem(d, cs.key), truoc: p ? giaTriDiem(p, cs.key) : null, d, p };
  });
  const coTruoc = Boolean(dsTruoc) && rows.some((r) => r.truoc != null && r.truoc !== 0);
  const thua = nay.filter((d) => d.doanhThu > 0).length < n / 2;
  const kieu = kieuChon ?? (thua ? "cot" : "duong");
  const trong = n === 0 || nay.every((d) => d.doanhThu === 0 && d.soDon === 0);

  const giaTri = rows.flatMap((r) => [r.nay, coTruoc ? r.truoc : null]).filter((v) => v != null);
  const max = Math.max(0, ...giaTri);
  const min = Math.min(0, ...giaTri);
  const lonNhat = Math.max(max, -min);
  const donVi = !cs.tien ? { chia: 1, ten: "đơn" } : lonNhat >= 1e9 ? { chia: 1e9, ten: "tỷ ₫" } : { chia: 1e6, ten: "triệu ₫" };
  const { ticks, day, dinh } = vachTruc(min, max > 0 || min < 0 ? max : 1, !cs.tien);
  const nhanX = rows.filter((r, i) => n <= 12 || i % 7 === 0).map((r) => r.nhan);
  const viTriCuoi = rows.reduce((cuoi, r, i) => (r.nay != null ? i : cuoi), -1);

  const fmt = (v) => (v == null ? "Không có đơn" : cs.tien ? formatTienNgan(v) : `${formatSo(v)} đơn`);
  const moiKy = nhom === "thang" ? "tháng" : "ngày";
  // Ô Giá trị đơn trung bình đã ghi số của cả kỳ ở đầu trang nên biểu đồ không nhắc lại (mỗi thông tin một chỗ)
  const tb =
    cs.key === "tbDon"
      ? null
      : cs.key === "soDon"
        ? `${n ? nf1.format(rows.reduce((s, r) => s + (r.nay ?? 0), 0) / n) : 0} đơn/${moiKy}`
        : `${n ? formatTienNgan(rows.reduce((s, r) => s + (r.nay ?? 0), 0) / n) : "—"}/${moiKy}`;
  const tieuDe = nhom === "thang" ? cs.theoThang : cs.theoNgay;
  const tenTruoc = namTruoc ? "Cùng kỳ năm trước" : "Kỳ trước";

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
          {/* Chưa có số liệu hoặc lỗi thì không có gì để đổi cách xem */}
          {trong || error ? null : (
            <div role="group" aria-label="Cách xem" className="inline-flex rounded-md bg-slate-100 p-0.5">
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
            <span className="@max-[520px]:sr-only">Xem báo cáo</span>
          </MoreLink>
        </>
      }
      bodyClassName={cn(LE, "pb-4 pt-3.5")}
    >
      {trong ? null : (
        <div className="mb-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs leading-4 text-bo-muted">
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            {kieu === "cot" ? <i className="inline-block size-2.5 rounded-[2px] bg-bo-primary" aria-hidden="true" /> : <i className="inline-block w-4 border-t-2 border-bo-primary" aria-hidden="true" />}
            <b className="font-medium text-bo-foreground">Kỳ này</b>
          </span>
          {coTruoc ? (
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <i className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: MAU2.kyTruoc }} aria-hidden="true" />
              <b className="font-medium text-bo-foreground">{tenTruoc}</b>
              {k.soSanhGon}
            </span>
          ) : null}
          {/* Điện thoại: đơn vị ẩn khỏi đầu thẻ (chật) nên ghi ở đây */}
          {kieu !== "bang" ? <span className="hidden whitespace-nowrap @max-[440px]:inline">Đơn vị: {donVi.ten}</span> : null}
          {tb ? (
            <span className="ml-auto whitespace-nowrap @max-[560px]:hidden">
              Trung bình <b className="font-medium text-bo-foreground">{tb}</b>
            </span>
          ) : null}
        </div>
      )}

      {trong ? (
        <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center text-[13px] text-bo-muted @max-[520px]:h-[190px]">
          <TrendingUp className="size-5 text-slate-400" aria-hidden="true" />
          Chưa có đơn đã giao trong kỳ này.
        </div>
      ) : kieu === "bang" ? (
        <div className="max-h-[220px] overflow-auto rounded-md border border-[#eef1f5]">
          <table className="w-full text-[13px] tabular-nums">
            <caption className="sr-only">{`${tieuDe}, ${k.day}, so với ${tenTruoc.toLowerCase()}`}</caption>
            <thead className="sticky top-0 bg-bo-surface-subtle text-left text-xs text-bo-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{nhom === "thang" ? "Tháng" : "Ngày"}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Kỳ này</th>
                {dsTruoc ? <th scope="col" className="px-3 py-2 font-medium">{nhom === "thang" ? "Tháng so sánh" : "Ngày so sánh"}</th> : null}
                {dsTruoc ? <th scope="col" className="px-3 py-2 text-right font-medium">{tenTruoc}</th> : null}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.tu} className="border-t border-[#eef1f5]">
                  <td className="px-3 py-1.5">{nhanNgan(r.tu, nhom)}</td>
                  <td className="px-3 py-1.5 text-right font-medium text-bo-foreground">{fmt(r.nay)}</td>
                  {dsTruoc ? <td className="px-3 py-1.5 text-bo-muted">{r.p ? nhanNgan(r.p.tu, nhom) : "—"}</td> : null}
                  {dsTruoc ? <td className="px-3 py-1.5 text-right">{r.p ? fmt(r.truoc) : "—"}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="h-[220px] @max-[520px]:h-[190px]"
          role="figure"
          aria-label={`${tieuDe} (${donVi.ten}), ${k.day}${coTruoc ? `, so với ${tenTruoc.toLowerCase()} ${k.soSanh}` : ""}. Bấm nút Bảng số liệu để đọc từng ${moiKy}.`}
        >
          <KhungBieuDo>
            <ComposedChart data={rows} margin={{ top: 8, right: kieu === "duong" ? 22 : 6, bottom: 0, left: 0 }} barCategoryGap="30%" accessibilityLayer>
              <CartesianGrid vertical={false} stroke={MAU2.luoi} />
              <XAxis
                dataKey="nhan"
                ticks={nhanX}
                interval={0}
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
                width={36}
              />
              <Tooltip
                isAnimationActive={false}
                cursor={kieu === "cot" ? { fill: "rgba(22, 119, 255, 0.06)" } : { stroke: MAU2.truc, strokeWidth: 1 }}
                wrapperStyle={{ outline: "none", zIndex: 10 }}
                content={<TipBieuDo nhom={nhom} chiSo={cs.key} fmt={fmt} coTruoc={coTruoc} kieu={kieu} tenTruoc={tenTruoc} />}
              />
              {kieu === "duong" ? (
                <Area type="linear" dataKey="nay" stroke="none" fill={MAU2.nenVung} fillOpacity={1} connectNulls={false} isAnimationActive={false} activeDot={false} />
              ) : (
                <Bar dataKey="nay" fill={MAU2.chinh} radius={[3, 3, 0, 0]} maxBarSize={12} isAnimationActive={false} />
              )}
              {coTruoc ? (
                <Line
                  type="linear"
                  dataKey="truoc"
                  stroke={MAU2.kyTruoc}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 5, fill: MAU2.kyTruoc, stroke: "#fff", strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ) : null}
              {kieu === "duong" ? (
                <Line
                  type="linear"
                  dataKey="nay"
                  stroke={MAU2.chinh}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  connectNulls={false}
                  isAnimationActive={false}
                  activeDot={{ r: 5, fill: MAU2.chinh, stroke: "#fff", strokeWidth: 2 }}
                  dot={({ key, ...p }) => <DiemDuong key={key} {...p} rows={rows} viTriCuoi={viTriCuoi} />}
                />
              ) : null}
            </ComposedChart>
          </KhungBieuDo>
        </div>
      )}
    </Card>
  );
}

/** Chấm trên đường kỳ này: chỉ ở ngày cuối và ở ngày đứng lẻ (hai bên không có số), không chấm mọi điểm. */
function DiemDuong({ cx, cy, index, rows, viTriCuoi }) {
  const r = rows[index];
  if (r?.nay == null || cx == null || cy == null) return null;
  const le = (index === 0 || rows[index - 1].nay == null) && (index === rows.length - 1 || rows[index + 1].nay == null);
  if (!le && index !== viTriCuoi) return null;
  return <circle cx={cx} cy={cy} r={4} fill={MAU2.chinh} stroke="#fff" strokeWidth={2} />;
}

function TipBieuDo({ active, payload, nhom, chiSo, fmt, coTruoc, kieu, tenTruoc }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const phu = chiSo === "soDon" ? `Doanh thu ${formatTienNgan(r.d.doanhThu)}` : `${formatSo(r.d.soDon)} đơn đã giao`;
  return (
    <div className="min-w-52 rounded-md border border-bo-border bg-bo-surface px-3 py-2.5 text-xs leading-4 shadow-lg">
      <p className="flex items-center gap-2">
        {kieu === "cot" ? <i className="inline-block size-2.5 rounded-[2px] bg-bo-primary" aria-hidden="true" /> : <i className="inline-block w-4 border-t-2 border-bo-primary" aria-hidden="true" />}
        <span className="flex-1 text-bo-muted">{nhanNgan(r.tu, nhom)}</span>
        <b className="text-sm font-semibold tabular-nums text-bo-foreground">{fmt(r.nay)}</b>
      </p>
      {coTruoc && r.p ? (
        <p className="mt-1.5 flex items-center gap-2" title={tenTruoc}>
          <i className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: MAU2.kyTruoc }} aria-hidden="true" />
          <span className="flex-1 text-bo-muted">{nhanNgan(r.p.tu, nhom)}</span>
          <b className="text-sm font-semibold tabular-nums text-bo-foreground">{fmt(r.truoc)}</b>
        </p>
      ) : null}
      <p className="mt-2 border-t border-[#eef1f5] pt-2 text-bo-muted">{phu}</p>
    </div>
  );
}
