import { useState, useEffect, useCallback, useRef } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { Search, RefreshCw, BarChart2, Calendar } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MetricStrip from "@/components/shared/MetricStrip";
import StatusTabs from "@/components/shared/StatusTabs";
import FilterSelect from "@/components/shared/FilterSelect";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/config/apiBase";
import { Input } from "@/components/ui/input";

// ─── API ───
const API_BASE = `${API_BASE_URL}/api/v1`;
const getAuthHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` });

async function fetchKhoList() {
  const res = await fetch(`${API_BASE}/kho/filter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: JSON.stringify({ filters: [], sorts: [], page: 0, size: 100 }),
  });
  const json = await res.json();
  return json?.data?.content ?? [];
}

async function fetchDoanhThu(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== "") query.set(k, v); });
  const res = await fetch(`${API_BASE}/admin/dashboard/bao-cao/doanh-thu?${query}`, { headers: getAuthHeader() });
  const json = await res.json().catch(() => null);
  // Máy chủ báo lỗi (vd. thiếu năm) thì ném lỗi để trang không hiện số 0 giả
  if (!res.ok) throw new Error(json?.message ?? "");
  return json?.data ?? [];
}

// ─── HELPERS ───
const fmt = (n) => {
  const num = Number(n || 0);
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + " tỷ";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + " tr";
  return num.toLocaleString("vi-VN");
};

// Màu biểu đồ lấy từ token bo-* (recharts cần giá trị màu cụ thể)
const CHART_COLORS = {
  giaVon: "#94a3b8",
  giaVonLight: "#cbd5e1",
  loiNhuan: "#15803d",
  loiNhuanLight: "#86efac",
  doanhThu: "#1677ff",
  grid: "#e1e6ec",
  axis: "#64748b",
};

const TH_CLASS =
  "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
// Ô nhập có nhãn nằm trong ô (theo mẫu ô ngày của PurchaseRequestList) để hàng công cụ gọn một dòng
const O_NHAN_CLASS =
  "flex h-9 w-full items-center gap-2 rounded-md border border-bo-border bg-white pl-3 pr-2 text-sm focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 sm:w-auto";
const O_NGAY_CLASS =
  "h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-bo-foreground shadow-none focus-visible:ring-0";
const O_SO_CLASS = `${O_NGAY_CLASS} sm:w-[72px] sm:flex-none`;

// Kỳ báo cáo: giữ đủ 4 kỳ như trước, đổi sang tab chung
const TAB_KY = [
  { value: "ngay", label: "Theo ngày" },
  { value: "thang", label: "Theo tháng" },
  { value: "nam", label: "Theo năm" },
  { value: "so_sanh", label: "So sánh" },
];

// Tông màu tỷ lệ lãi gộp: >= 20% tốt, >= 10% trung bình, còn lại thấp
const laiTone = (value) => (value >= 20 ? "success" : value >= 10 ? "warning" : "danger");

// ─── CUSTOM TOOLTIP ───
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[180px] rounded-lg border border-bo-border bg-white p-3 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-bo-muted">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="mb-1.5 flex items-center gap-2 last:mb-0">
          <svg className="size-2.5 shrink-0" viewBox="0 0 10 10" aria-hidden="true">
            <circle cx="5" cy="5" r="5" fill={entry.color} />
          </svg>
          <span className="flex-1 text-xs text-slate-600">{entry.name}</span>
          <span className="text-xs font-bold text-bo-foreground">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Ô NHẬP CÓ NHÃN TRONG Ô ───
function ONhan({ label, icon, children }) {
  return (
    <label className={O_NHAN_CLASS}>
      {icon}
      <span className="shrink-0 text-xs text-bo-muted">{label}</span>
      {children}
    </label>
  );
}

// ─── MINI SPARKLINE ───
function MiniSparkline({ data, color }) {
  if (!data?.length) return null;
  return (
    <ResponsiveContainer width="100%" height={52}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="doanhThu" stroke={color} strokeWidth={2} fill="url(#sparkGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── PROGRESS BAR ───
function ProgressBar({ pct, barClass }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${barClass}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// ─── MAIN ───
export default function BaoCaoDoanhThu() {
  const [loai, setLoai] = useState("thang");
  const [khoId, setKhoId] = useState("ALL");
  const [khoList, setKhoList] = useState([]);
  const [data, setData] = useState([]);
  // Trang tự tải ngay khi mở nên bắt đầu ở trạng thái đang tải (không hiện số 0 trước khi có số)
  const [loading, setLoading] = useState(true);
  // null: không lỗi; { moTa }: lần tải gần nhất lỗi
  const [loi, setLoi] = useState(null);
  const requestIdRef = useRef(0);
  const [nam, setNam] = useState(new Date().getFullYear());
  const [thang, setThang] = useState(new Date().getMonth() + 1);
  const [tuNam, setTuNam] = useState(new Date().getFullYear() - 4);
  const [denNam, setDenNam] = useState(new Date().getFullYear());
  const [tuNgay, setTuNgay] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [denNgay, setDenNgay] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    fetchKhoList().then(list => setKhoList(list.filter(k => k.trangThai !== 0)));
  }, []);

  const buildParams = useCallback(() => {
    const base = { loai, ...(khoId !== "ALL" ? { khoId } : {}) };
    if (loai === "ngay") return { ...base, tuNgay, denNgay };
    if (loai === "nam") return { ...base, tuNam, denNam };
    if (loai === "so_sanh") return { ...base, nam, thang };
    return { ...base, nam };
  }, [loai, khoId, tuNgay, denNgay, nam, tuNam, denNam, thang]);

  const loadData = useCallback(async () => {
    // Đổi kỳ / kho liên tiếp có thể chạy 2 yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const rows = await fetchDoanhThu(buildParams());
      if (requestId !== requestIdRef.current) return;
      setData(rows);
      setLoi(null);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setData([]);
      setLoi({ moTa: e?.message ?? "" });
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [buildParams]);

  // Giữ tham chiếu mới nhất của hàm tải dữ liệu để effect tự động tải bên dưới
  // không phụ thuộc vào các mốc thời gian (giữ nguyên hành vi cũ).
  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); vẫn tự động tải lại khi đổi loại báo cáo
  // hoặc kho như hành vi cũ, không tải khi chỉ đổi mốc thời gian.
  useEffect(() => {
    queueMicrotask(() => loadDataRef.current());
  }, [loai, khoId]);

  const chartData = data.map(d => ({
    ...d,
    doanhThu: Number(d.doanhThu || 0),
    giaVon: Number(d.giaVon || 0),
    loiNhuan: Number(d.loiNhuan || 0),
    soLuongDon: Number(d.soLuongDon || 0),
    tyLeLaiGop: Number(d.tyLeLaiGop || 0),
  }));

  const totalDoanhThu = chartData.reduce((s, d) => s + d.doanhThu, 0);
  const totalLoiNhuan = chartData.reduce((s, d) => s + d.loiNhuan, 0);
  const totalGiaVon = chartData.reduce((s, d) => s + d.giaVon, 0);
  const totalDon = chartData.reduce((s, d) => s + d.soLuongDon, 0);
  const avgTyLe = chartData.length
    ? (chartData.reduce((s, d) => s + d.tyLeLaiGop, 0) / chartData.length).toFixed(2)
    : 0;

  const loiNhuanPct = totalDoanhThu ? Math.round((totalLoiNhuan / totalDoanhThu) * 100) : 0;
  const giaVonPct = totalDoanhThu ? Math.round((totalGiaVon / totalDoanhThu) * 100) : 0;

  // Chưa có số thật (đang tải lần đầu hoặc lỗi): hiện "—", không hiện số 0 giả
  const coSo = !loi && !(loading && chartData.length === 0);
  // Gợi ý phụ có số tính từ dữ liệu: ẩn khi đang tải hoặc lỗi
  const anGoiYSo = loading || Boolean(loi);

  // Dải chỉ số: giữ đủ 4 chỉ số, nhãn, cách tính và định dạng như các ô cũ
  const chiSo = [
    {
      label: "Tổng doanh thu",
      value: loi ? "—" : fmt(totalDoanhThu),
      hint: anGoiYSo ? null : `${chartData.length} kỳ thống kê`,
    },
    {
      label: "Lợi nhuận gộp",
      value: loi ? "—" : fmt(totalLoiNhuan),
      hint: anGoiYSo ? null : `Chiếm ${loiNhuanPct}% doanh thu`,
    },
    { label: "Tỷ lệ lãi gộp TB", value: loi ? "—" : avgTyLe + "%", hint: "Trung bình các kỳ" },
    { label: "Tổng đơn hàng", value: loi ? "—" : totalDon.toLocaleString("vi-VN"), hint: "Đơn hàng hoàn thành" },
  ];

  const khoOptions = [
    { value: "ALL", label: "Tất cả kho" },
    ...khoList.map(k => ({ value: String(k.id), label: `[${k.maKho}] ${k.tenKho}` })),
  ];

  return (
    <PageContainer className="space-y-4">

      {/* ── HÀNG CÔNG CỤ (thay khung "Bộ lọc báo cáo") ──
          Trái: kỳ báo cáo; phải: mốc thời gian, kho, nút xem.
          Màn hẹp: bộ lọc lên trên, tab xuống dưới để gạch chân tab nằm sát đường kẻ */}
      <div className="flex flex-wrap-reverse items-start gap-x-3 border-b border-bo-border">
        <div className="min-w-0 max-w-full">
          <StatusTabs tabs={TAB_KY} value={loai} onChange={setLoai} label="Kỳ báo cáo" />
        </div>

        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 py-2 sm:w-auto">
          {loai === "ngay" && (
            <>
              <ONhan label="Từ ngày" icon={<Calendar className="size-4 shrink-0 text-bo-muted" />}>
                <Input type="date" aria-label="Từ ngày" value={tuNgay} onChange={e => setTuNgay(e.target.value)}
                  className={O_NGAY_CLASS} />
              </ONhan>
              <ONhan label="Đến ngày" icon={<Calendar className="size-4 shrink-0 text-bo-muted" />}>
                <Input type="date" aria-label="Đến ngày" value={denNgay} onChange={e => setDenNgay(e.target.value)}
                  className={O_NGAY_CLASS} />
              </ONhan>
            </>
          )}

          {(loai === "thang" || loai === "so_sanh") && (
            <ONhan label="Năm">
              <Input type="number" aria-label="Năm" value={nam} onChange={e => setNam(e.target.value)}
                className={O_SO_CLASS} />
            </ONhan>
          )}

          {loai === "nam" && (
            <>
              <ONhan label="Từ năm">
                <Input type="number" aria-label="Từ năm" value={tuNam} onChange={e => setTuNam(e.target.value)}
                  className={O_SO_CLASS} />
              </ONhan>
              <ONhan label="Đến năm">
                <Input type="number" aria-label="Đến năm" value={denNam} onChange={e => setDenNam(e.target.value)}
                  className={O_SO_CLASS} />
              </ONhan>
            </>
          )}

          {loai === "so_sanh" && (
            <ONhan label="Tháng">
              <Input type="number" aria-label="Tháng" value={thang} onChange={e => setThang(e.target.value)}
                className={O_SO_CLASS} />
            </ONhan>
          )}

          <FilterSelect
            label="Lọc theo kho"
            value={khoId}
            options={khoOptions}
            onChange={setKhoId}
            align="end"
            className="sm:w-[200px]"
          />

          <Button
            onClick={loadData}
            disabled={loading}
            className="h-9 w-full gap-2 bg-bo-primary px-4 text-sm font-medium text-white hover:bg-bo-primary-hover disabled:opacity-50 sm:w-auto"
          >
            {loading ? <RefreshCw className="size-4 animate-spin" /> : <Search className="size-4" />}
            Xem báo cáo
          </Button>
        </div>
      </div>

      {/* ── DẢI CHỈ SỐ (một khung, thay 4 ô rời) ── */}
      <MetricStrip label="Chỉ số doanh thu" items={chiSo} loading={loading} />

      {/* ── CHART + SUMMARY (lỗi tải thì ẩn, báo lỗi ở khung bảng) ── */}
      {!loi && (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">

          <SurfaceCard title="Biểu đồ doanh thu" description="Doanh thu, giá vốn & lợi nhuận theo kỳ">
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-bo-muted">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-sm bg-slate-300" />Giá vốn
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-sm bg-bo-success" />Lợi nhuận
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5 rounded-full bg-bo-primary" />Doanh thu
              </span>
            </div>

            {loading && chartData.length === 0 ? (
              <LoadingState rows={4} label="Đang tải biểu đồ doanh thu" />
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradGiaVon" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.giaVonLight} />
                      <stop offset="100%" stopColor={CHART_COLORS.giaVon} />
                    </linearGradient>
                    <linearGradient id="gradLoiNhuan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.loiNhuanLight} />
                      <stop offset="100%" stopColor={CHART_COLORS.loiNhuan} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis dataKey="nhanThoiGian" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={{ stroke: CHART_COLORS.grid }} tickLine={false} />
                  <YAxis tickFormatter={fmt} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART_COLORS.grid }} />
                  <Bar dataKey="giaVon" name="Giá vốn" stackId="a" fill="url(#gradGiaVon)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="loiNhuan" name="Lợi nhuận" stackId="a" fill="url(#gradLoiNhuan)" radius={[4, 4, 0, 0]} />
                  <Line dataKey="doanhThu" name="Doanh thu" stroke={CHART_COLORS.doanhThu} strokeWidth={2.5}
                    dot={{ r: 3, fill: CHART_COLORS.doanhThu, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </SurfaceCard>

          {/* Side summary */}
          <div className="flex flex-col gap-3">
            {[
              { label: "Doanh thu", value: fmt(totalDoanhThu), pct: 100, barClass: "bg-bo-primary", textClass: "text-bo-primary", bg: "bg-bo-primary-soft" },
              { label: "Giá vốn", value: fmt(totalGiaVon), pct: giaVonPct, barClass: "bg-slate-400", textClass: "text-slate-600", bg: "bg-slate-100" },
              { label: "Lợi nhuận", value: fmt(totalLoiNhuan), pct: loiNhuanPct, barClass: "bg-bo-success", textClass: "text-bo-success", bg: "bg-bo-success-soft" },
            ].map(item => (
              <div key={item.label} className="rounded-lg border border-bo-border bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-bo-muted">{item.label}</span>
                  {coSo && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.bg} ${item.textClass}`}>{item.pct}%</span>
                  )}
                </div>
                <p className={`mb-3 text-xl font-bold ${item.textClass}`}>{coSo ? item.value : "—"}</p>
                <ProgressBar pct={coSo ? item.pct : 0} barClass={item.barClass} />
              </div>
            ))}

            {chartData.length > 1 && (
              <div className="rounded-lg border border-bo-border bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-medium text-bo-muted">Xu hướng doanh thu</p>
                <MiniSparkline data={chartData} color={CHART_COLORS.doanhThu} />
              </div>
            )}

            <div className="rounded-lg border border-bo-border bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-medium text-bo-muted">Chỉ số nhanh</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-bo-muted">Giá trị TB / đơn</span>
                <span className="text-xs font-bold text-bo-primary">{totalDon > 0 ? fmt(totalDoanhThu / totalDon) : "—"}</span>
              </div>
              <div className="my-3 h-px bg-bo-border" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-bo-muted">LN trung bình / kỳ</span>
                <span className="text-xs font-bold text-bo-success">{chartData.length > 0 ? fmt(totalLoiNhuan / chartData.length) : "—"}</span>
              </div>
              <div className="my-3 h-px bg-bo-border" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-bo-muted">Tỷ lệ lãi gộp TB</span>
                {coSo ? (
                  <StatusBadge
                    label={`${avgTyLe}%`}
                    tone={laiTone(Number(avgTyLe))}
                    dot={false}
                  />
                ) : (
                  <span className="text-xs font-bold text-bo-muted">—</span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── DATA TABLE ── */}
      <TableShell
        title="Chi tiết số liệu"
        description={coSo ? `${chartData.length} kỳ được tổng hợp` : undefined}
      >
        {loading && chartData.length === 0 ? (
          <LoadingState rows={5} label="Đang tải chi tiết doanh thu" />
        ) : loi ? (
          <ErrorState description={loi.moTa || undefined} onRetry={loadData} />
        ) : chartData.length === 0 ? (
          <EmptyState
            icon={BarChart2}
            title="Không có dữ liệu"
            description="Hãy thay đổi bộ lọc và thử lại."
          />
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                {["#", "Thời kỳ", "Doanh thu", "Giá vốn", "Lợi nhuận", "Tỷ lệ lãi", "Số đơn"].map((h, i) => (
                  <th key={i} className={`${TH_CLASS} ${i > 1 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {chartData.map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-bo-surface-subtle">
                  <td className="px-4 py-3.5 text-xs font-medium text-bo-muted">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-4 py-3.5 font-medium text-bo-foreground">{row.nhanThoiGian}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-bo-primary">{fmt(row.doanhThu)}</td>
                  <td className="px-4 py-3.5 text-right text-slate-600">{fmt(row.giaVon)}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-bo-success">{fmt(row.loiNhuan)}</td>
                  <td className="px-4 py-3.5 text-right">
                    <StatusBadge label={`${row.tyLeLaiGop.toFixed(2)}%`} tone={laiTone(row.tyLeLaiGop)} dot={false} />
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-600">{row.soLuongDon.toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-bo-border bg-bo-surface-subtle">
                <td colSpan={2} className="px-4 py-3.5 text-xs font-bold uppercase tracking-wide text-bo-foreground">Tổng cộng</td>
                <td className="px-4 py-3.5 text-right text-sm font-extrabold text-bo-primary">{fmt(totalDoanhThu)}</td>
                <td className="px-4 py-3.5 text-right text-sm font-bold text-slate-600">{fmt(totalGiaVon)}</td>
                <td className="px-4 py-3.5 text-right text-sm font-extrabold text-bo-success">{fmt(totalLoiNhuan)}</td>
                <td className="px-4 py-3.5 text-right">
                  <StatusBadge label={`${avgTyLe}%`} tone="info" dot={false} />
                </td>
                <td className="px-4 py-3.5 text-right text-sm font-bold text-slate-600">{totalDon.toLocaleString("vi-VN")}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </TableShell>

    </PageContainer>
  );
}
