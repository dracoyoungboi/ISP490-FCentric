import { useState, useEffect, useCallback, useRef } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import {
  TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine,
  Search, RefreshCw, BarChart2, Calendar, Warehouse, ArrowLeftRight,
} from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/config/apiBase";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── API ───
const BASE_URL = `${API_BASE_URL}/api/v1/admin/dashboard/bao-cao/nhat-ky-nhap-xuat`;
const getToken = () => localStorage.getItem("access_token") ?? "";

const today = new Date();
const thisYear = today.getFullYear();
const thisMonth = today.getMonth() + 1;
const pad = (n) => String(n).padStart(2, "0");
const defaultTuNgay = `${thisYear}-${pad(thisMonth)}-01`;
const defaultDenNgay = today.toISOString().split("T")[0];

// ─── HELPERS ───
const fmt = (n) => {
  const num = Number(n || 0);
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + " tỷ";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + " tr";
  return num.toLocaleString("vi-VN");
};
const fmtSL = (n) => (n != null ? Number(n).toLocaleString("vi-VN") : "—");

// Màu biểu đồ lấy từ token bo-* (recharts cần giá trị màu cụ thể)
const CHART_COLORS = {
  nhap: "#15803d",
  nhapLight: "#86efac",
  xuat: "#dc2626",
  xuatLight: "#fca5a5",
  chenhLech: "#1677ff",
  grid: "#e1e6ec",
  axis: "#64748b",
};

const TH_CLASS =
  "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
const SELECT_CLASS =
  "h-9 rounded-md border border-bo-border bg-white px-3 text-sm text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15";
const SELECT_ITEM_CLASS =
  "rounded-md text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";

function buildParams({ loai, nam, thang, tuNam, denNam, tuNgay, denNgay, khoId, loaiGiaoDich }) {
  const p = new URLSearchParams({ loai });
  if (["ngay", "chi_tiet", "theo_kho"].includes(loai)) { p.set("tuNgay", tuNgay); p.set("denNgay", denNgay); }
  else if (["tuan", "thang"].includes(loai)) { p.set("nam", nam); }
  else if (loai === "nam") { p.set("tuNam", tuNam); p.set("denNam", denNam); }
  else if (loai === "so_sanh") { p.set("nam", nam); p.set("thang", thang); }
  if (khoId && khoId !== "ALL") p.set("khoId", khoId);
  if (loaiGiaoDich && loaiGiaoDich !== "ALL") p.set("loaiGiaoDich", loaiGiaoDich);
  return p.toString();
}

// ─── CUSTOM TOOLTIP ───
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[190px] rounded-lg border border-bo-border bg-white p-3 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-bo-muted">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="mb-1.5 flex items-center gap-2 last:mb-0">
          <svg className="size-2.5 shrink-0" viewBox="0 0 10 10" aria-hidden="true">
            <circle cx="5" cy="5" r="5" fill={entry.color} />
          </svg>
          <span className="flex-1 text-xs text-slate-600">{entry.name}</span>
          <span className="text-xs font-bold text-bo-foreground">{fmtSL(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── KPI CARD ───
function KpiCard({ icon, label, value, sub, valueClass, iconClass }) {
  return (
    <div className="rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-bo-muted">{label}</p>
          <p className={`mt-1 truncate text-2xl font-bold tracking-tight ${valueClass}`}>{value}</p>
          {sub && <p className="mt-1 text-xs text-bo-muted">{sub}</p>}
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          {icon}
        </span>
      </div>
    </div>
  );
}

// ─── MINI SPARKLINE ───
function MiniSparkline({ data, dataKey, color }) {
  if (!data?.length) return null;
  return (
    <ResponsiveContainer width="100%" height={52}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sparkGrad_${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#sparkGrad_${dataKey})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── PROGRESS BAR ───
function ProgressBar({ pct, barClass }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

// ─── BADGE LOẠI GD ───
function LoaiGdBadge({ loai }) {
  const map = {
    nhap_kho: { label: "Nhập kho", cls: "border-bo-success/20 bg-bo-success-soft text-bo-success" },
    xuat_kho: { label: "Xuất kho", cls: "border-bo-danger/20 bg-bo-danger-soft text-bo-danger" },
    chuyen_kho: { label: "Chuyển kho", cls: "border-bo-primary/20 bg-bo-primary-soft text-bo-primary" },
    dieu_chinh: { label: "Điều chỉnh", cls: "border-bo-warning/20 bg-bo-warning-soft text-bo-warning" },
  };
  const cfg = map[loai] || { label: loai || "—", cls: "border-bo-border bg-bo-surface-subtle text-slate-600" };
  return <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

// ─── MAIN ───
export default function NhatKyNhapXuat() {
  const [loai, setLoai] = useState("thang");
  const [nam, setNam] = useState(thisYear);
  const [thang, setThang] = useState(thisMonth);
  const [tuNam, setTuNam] = useState(thisYear - 4);
  const [denNam, setDenNam] = useState(thisYear);
  const [tuNgay, setTuNgay] = useState(defaultTuNgay);
  const [denNgay, setDenNgay] = useState(defaultDenNgay);
  const [khoId, setKhoId] = useState("ALL");
  const [loaiGiaoDich, setLoaiGiaoDich] = useState("ALL");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams({ loai, nam, thang, tuNam, denNam, tuNgay, denNgay, khoId, loaiGiaoDich });
      const res = await fetch(`${BASE_URL}?${params}`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setData(Array.isArray(json) ? json : json.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [loai, nam, thang, tuNam, denNam, tuNgay, denNgay, khoId, loaiGiaoDich]);

  // Giữ tham chiếu mới nhất của hàm tải dữ liệu để effect tự động tải bên dưới
  // không phụ thuộc vào các mốc thời gian (giữ nguyên hành vi cũ).
  const fetchDataRef = useRef(fetchData);
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); vẫn tự động tải lại khi đổi tab, kho
  // hoặc loại giao dịch như hành vi cũ, không tải khi chỉ đổi mốc thời gian.
  useEffect(() => {
    queueMicrotask(() => fetchDataRef.current());
  }, [loai, khoId, loaiGiaoDich]);

  const chartData = data.map(d => ({
    ...d,
    tongNhap: Number(d.tongNhap || 0),
    tongXuat: Number(d.tongXuat || 0),
    chenhLech: Number(d.chenhLech || 0),
    tongGiaTriNhap: Number(d.tongGiaTriNhap || 0),
    tongGiaTriXuat: Number(d.tongGiaTriXuat || 0),
  }));

  const kpi = chartData.reduce(
    (acc, d) => ({
      tongNhap: acc.tongNhap + d.tongNhap,
      tongXuat: acc.tongXuat + d.tongXuat,
      tongGtrNhap: acc.tongGtrNhap + d.tongGiaTriNhap,
      tongGtrXuat: acc.tongGtrXuat + d.tongGiaTriXuat,
    }),
    { tongNhap: 0, tongXuat: 0, tongGtrNhap: 0, tongGtrXuat: 0 }
  );

  const tongChenhLech = kpi.tongNhap - kpi.tongXuat;
  const nhapPct = kpi.tongNhap + kpi.tongXuat > 0 ? Math.round((kpi.tongNhap / (kpi.tongNhap + kpi.tongXuat)) * 100) : 50;
  const xuatPct = 100 - nhapPct;
  const gtrNhapPct = kpi.tongGtrNhap + kpi.tongGtrXuat > 0
    ? Math.round((kpi.tongGtrNhap / (kpi.tongGtrNhap + kpi.tongGtrXuat)) * 100) : 50;

  const tabConfig = [
    { key: "ngay", label: "Theo ngày" },
    { key: "tuan", label: "Theo tuần" },
    { key: "thang", label: "Theo tháng" },
    { key: "nam", label: "Theo năm" },
    { key: "so_sanh", label: "So sánh" },
    { key: "chi_tiet", label: "Chi tiết GD" },
    { key: "theo_kho", label: "Theo kho" },
  ];

  return (
    <PageContainer className="space-y-5">

      {/* ── KPI CARDS ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<ArrowDownToLine className="size-5" />} label="Tổng SL nhập"
          value={fmtSL(kpi.tongNhap)} sub={`${chartData.length} kỳ thống kê`}
          valueClass="text-bo-success" iconClass="bg-bo-success-soft text-bo-success" />
        <KpiCard icon={<ArrowUpFromLine className="size-5" />} label="Tổng SL xuất"
          value={fmtSL(kpi.tongXuat)} sub={`Chênh lệch: ${tongChenhLech >= 0 ? "+" : ""}${fmtSL(tongChenhLech)}`}
          valueClass="text-bo-danger" iconClass="bg-bo-danger-soft text-bo-danger" />
        <KpiCard icon={<TrendingDown className="size-5" />} label="Giá trị nhập"
          value={fmt(kpi.tongGtrNhap)} sub={`${gtrNhapPct}% tổng giá trị`}
          valueClass="text-bo-primary" iconClass="bg-bo-primary-soft text-bo-primary" />
        <KpiCard icon={<TrendingUp className="size-5" />} label="Giá trị xuất"
          value={fmt(kpi.tongGtrXuat)} sub="Giá trị xuất kho"
          valueClass="text-bo-warning" iconClass="bg-bo-warning-soft text-bo-warning" />
      </section>

      {/* ── FILTER PANEL ── */}
      <section className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-bo-border px-4 py-3 sm:px-5">
          <Calendar className="size-4 text-bo-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-bo-muted">Bộ lọc nhật ký</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
          {/* Tab group */}
          <div className="flex flex-wrap gap-1 rounded-lg border border-bo-border bg-bo-surface-subtle p-1">
            {tabConfig.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setLoai(key)}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${loai === key
                  ? "bg-bo-primary text-white shadow-sm"
                  : "text-slate-600 hover:bg-white hover:text-bo-foreground"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Date range */}
          {["ngay", "chi_tiet", "theo_kho"].includes(loai) && (
            <div className="flex items-center gap-2">
              <Input type="date" value={tuNgay} onChange={e => setTuNgay(e.target.value)}
                className="h-9 w-[160px] border-bo-border bg-white text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20" />
              <span className="font-medium text-bo-muted">→</span>
              <Input type="date" value={denNgay} onChange={e => setDenNgay(e.target.value)}
                className="h-9 w-[160px] border-bo-border bg-white text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20" />
            </div>
          )}

          {/* Year */}
          {["tuan", "thang", "so_sanh"].includes(loai) && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-bo-muted">Năm</span>
              <select
                value={nam}
                onChange={e => setNam(+e.target.value)}
                className={`${SELECT_CLASS} w-[110px]`}
              >
                {Array.from({ length: 8 }, (_, i) => thisYear - 7 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {/* Month for compare */}
          {loai === "so_sanh" && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-bo-muted">Tháng</span>
              <select
                value={thang}
                onChange={e => setThang(+e.target.value)}
                className={`${SELECT_CLASS} w-[90px]`}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>T{i + 1}</option>
                ))}
              </select>
            </div>
          )}

          {/* Year range */}
          {loai === "nam" && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-bo-muted">Từ</span>
              <select value={tuNam} onChange={e => setTuNam(+e.target.value)}
                className={`${SELECT_CLASS} w-[100px]`}>
                {Array.from({ length: 10 }, (_, i) => thisYear - 9 + i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="font-medium text-bo-muted">→</span>
              <span className="text-xs font-medium text-bo-muted">Đến</span>
              <select value={denNam} onChange={e => setDenNam(+e.target.value)}
                className={`${SELECT_CLASS} w-[100px]`}>
                {Array.from({ length: 10 }, (_, i) => thisYear - 9 + i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {/* Kho */}
          <div className="flex items-center gap-2">
            <Warehouse className="size-4 shrink-0 text-bo-muted" />
            <Select value={khoId} onValueChange={setKhoId}>
              <SelectTrigger className="h-9 min-w-[180px] border-bo-border bg-white text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20">
                <SelectValue placeholder="Tất cả kho" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg">
                <SelectItem value="ALL" className={SELECT_ITEM_CLASS}>Tất cả kho</SelectItem>
                <SelectItem value="1" className={SELECT_ITEM_CLASS}>KHO01 – Hà Nội</SelectItem>
                <SelectItem value="2" className={SELECT_ITEM_CLASS}>KHO02 – Miền Nam</SelectItem>
                <SelectItem value="3" className={SELECT_ITEM_CLASS}>KHO03 – Miền Trung</SelectItem>
                <SelectItem value="4" className={SELECT_ITEM_CLASS}>KHO04 – Ngoại thành</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loại GD */}
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="size-4 shrink-0 text-bo-muted" />
            <Select value={loaiGiaoDich} onValueChange={setLoaiGiaoDich}>
              <SelectTrigger className="h-9 min-w-[160px] border-bo-border bg-white text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20">
                <SelectValue placeholder="Tất cả loại GD" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg">
                <SelectItem value="ALL" className={SELECT_ITEM_CLASS}>Tất cả loại GD</SelectItem>
                <SelectItem value="nhap_kho" className={SELECT_ITEM_CLASS}>Nhập kho</SelectItem>
                <SelectItem value="xuat_kho" className={SELECT_ITEM_CLASS}>Xuất kho</SelectItem>
                <SelectItem value="chuyen_kho" className={SELECT_ITEM_CLASS}>Chuyển kho</SelectItem>
                <SelectItem value="dieu_chinh" className={SELECT_ITEM_CLASS}>Điều chỉnh</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={fetchData}
            disabled={loading}
            className="h-9 gap-2 bg-bo-primary px-4 text-sm font-medium text-white hover:bg-bo-primary-hover disabled:opacity-50"
          >
            {loading ? <RefreshCw className="size-4 animate-spin" /> : <Search className="size-4" />}
            Xem báo cáo
          </Button>
        </div>
      </section>

      {/* ── CHART + SUMMARY ── */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">

        <SurfaceCard title="Biểu đồ nhập xuất kho" description="Số lượng nhập, xuất & chênh lệch tồn kho theo kỳ">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-bo-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm bg-bo-success" />Nhập kho
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm bg-bo-danger" />Xuất kho
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 rounded-full bg-bo-primary" />Chênh lệch
            </span>
          </div>

          {loading && chartData.length === 0 ? (
            <LoadingState rows={4} label="Đang tải biểu đồ nhập xuất" />
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradNhap" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.nhapLight} />
                    <stop offset="100%" stopColor={CHART_COLORS.nhap} />
                  </linearGradient>
                  <linearGradient id="gradXuat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.xuatLight} />
                    <stop offset="100%" stopColor={CHART_COLORS.xuat} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis dataKey="nhanThoiGian" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={{ stroke: CHART_COLORS.grid }} tickLine={false} />
                <YAxis tickFormatter={fmtSL} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART_COLORS.grid }} />
                <Bar dataKey="tongNhap" name="Nhập kho" fill="url(#gradNhap)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="tongXuat" name="Xuất kho" fill="url(#gradXuat)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line dataKey="chenhLech" name="Chênh lệch" stroke={CHART_COLORS.chenhLech} strokeWidth={2.5}
                  dot={{ r: 3, fill: CHART_COLORS.chenhLech, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </SurfaceCard>

        {/* Side summary */}
        <div className="flex flex-col gap-3">
          {[
            { label: "Nhập kho", value: fmtSL(kpi.tongNhap), pct: nhapPct, barClass: "bg-bo-success", textClass: "text-bo-success", bg: "bg-bo-success-soft" },
            { label: "Xuất kho", value: fmtSL(kpi.tongXuat), pct: xuatPct, barClass: "bg-bo-danger", textClass: "text-bo-danger", bg: "bg-bo-danger-soft" },
            { label: "Giá trị nhập", value: fmt(kpi.tongGtrNhap), pct: gtrNhapPct, barClass: "bg-bo-primary", textClass: "text-bo-primary", bg: "bg-bo-primary-soft" },
          ].map(item => (
            <div key={item.label} className="rounded-lg border border-bo-border bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-bo-muted">{item.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.bg} ${item.textClass}`}>{item.pct}%</span>
              </div>
              <p className={`mb-3 text-xl font-bold ${item.textClass}`}>{item.value}</p>
              <ProgressBar pct={item.pct} barClass={item.barClass} />
            </div>
          ))}

          {chartData.length > 1 && (
            <div className="rounded-lg border border-bo-border bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-medium text-bo-muted">Xu hướng nhập kho</p>
              <MiniSparkline data={chartData} dataKey="tongNhap" color={CHART_COLORS.nhap} />
            </div>
          )}

          <div className="rounded-lg border border-bo-border bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-medium text-bo-muted">Chỉ số nhanh</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-bo-muted">Nhập TB / kỳ</span>
              <span className="text-xs font-bold text-bo-success">
                {chartData.length > 0 ? fmtSL(Math.round(kpi.tongNhap / chartData.length)) : "—"}
              </span>
            </div>
            <div className="my-3 h-px bg-bo-border" />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-bo-muted">Xuất TB / kỳ</span>
              <span className="text-xs font-bold text-bo-danger">
                {chartData.length > 0 ? fmtSL(Math.round(kpi.tongXuat / chartData.length)) : "—"}
              </span>
            </div>
            <div className="my-3 h-px bg-bo-border" />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-bo-muted">Tỷ lệ nhập/xuất</span>
              <span className={`text-xs font-bold ${tongChenhLech >= 0 ? "text-bo-success" : "text-bo-danger"}`}>
                {kpi.tongXuat > 0 ? (kpi.tongNhap / kpi.tongXuat).toFixed(2) : "—"}x
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── DATA TABLE ── */}
      <TableShell
        title="Chi tiết nhật ký nhập xuất"
        description={`${chartData.length} kỳ được tổng hợp`}
      >
        {loading && chartData.length === 0 ? (
          <LoadingState rows={5} label="Đang tải nhật ký nhập xuất" />
        ) : chartData.length === 0 ? (
          <EmptyState
            icon={BarChart2}
            title="Không có dữ liệu"
            description="Hãy thay đổi bộ lọc và thử lại."
          />
        ) : (
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                {["#", "Thời kỳ", "SL Nhập", "SL Xuất", "Chênh lệch", "Giá trị nhập", "Giá trị xuất", "Loại GD"].map((h, i) => (
                  <th key={i} className={`${TH_CLASS} ${i > 1 ? "text-right" : "text-left"} ${i === 7 ? "text-center" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {chartData.map((row, i) => {
                const cl = row.tongNhap - row.tongXuat;
                return (
                  <tr key={i} className="transition-colors hover:bg-bo-surface-subtle">
                    <td className="px-4 py-3.5 text-xs font-medium text-bo-muted">{String(i + 1).padStart(2, "0")}</td>
                    <td className="px-4 py-3.5 font-medium text-bo-foreground">{row.nhanThoiGian}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-bo-success">{fmtSL(row.tongNhap)}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-bo-danger">{fmtSL(row.tongXuat)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${cl >= 0
                        ? "border-bo-success/20 bg-bo-success-soft text-bo-success"
                        : "border-bo-danger/20 bg-bo-danger-soft text-bo-danger"
                        }`}>
                        {cl >= 0 ? "+" : ""}{fmtSL(cl)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-bo-primary">{fmt(row.tongGiaTriNhap)}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-600">{fmt(row.tongGiaTriXuat)}</td>
                    <td className="px-4 py-3.5 text-center">
                      {row.loaiGiaoDich ? <LoaiGdBadge loai={row.loaiGiaoDich} /> : <span className="text-xs text-bo-muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-bo-border bg-bo-surface-subtle">
                <td colSpan={2} className="px-4 py-3.5 text-xs font-bold uppercase tracking-wide text-bo-foreground">Tổng cộng</td>
                <td className="px-4 py-3.5 text-right text-sm font-extrabold text-bo-success">{fmtSL(kpi.tongNhap)}</td>
                <td className="px-4 py-3.5 text-right text-sm font-extrabold text-bo-danger">{fmtSL(kpi.tongXuat)}</td>
                <td className="px-4 py-3.5 text-right">
                  <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${tongChenhLech >= 0
                    ? "border-bo-success/20 bg-bo-success-soft text-bo-success"
                    : "border-bo-danger/20 bg-bo-danger-soft text-bo-danger"
                    }`}>
                    {tongChenhLech >= 0 ? "+" : ""}{fmtSL(tongChenhLech)}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right text-sm font-extrabold text-bo-primary">{fmt(kpi.tongGtrNhap)}</td>
                <td className="px-4 py-3.5 text-right text-sm font-extrabold text-slate-600">{fmt(kpi.tongGtrXuat)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </TableShell>

    </PageContainer>
  );
}
