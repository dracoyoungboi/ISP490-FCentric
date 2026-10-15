import { useState, useEffect, useCallback, useRef } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { Search, RefreshCw, BarChart2, Calendar } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MetricStrip from "@/components/shared/MetricStrip";
import StatusTabs from "@/components/shared/StatusTabs";
import FilterSelect from "@/components/shared/FilterSelect";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/config/apiBase";
import { Input } from "@/components/ui/input";
import { khoService } from "@/services/khoService";
import { laKhoAo } from "@/pages/warehouse/loaiKho";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "@/utils/formatters";

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
// Số lượng có dấu (+/-) cho cột chênh lệch
const fmtChenhLech = (n) => `${n >= 0 ? "+" : ""}${formatNumber(n)}`;

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
// Ô có nhãn nằm trong ô (theo mẫu ô ngày của PurchaseRequestList) để hàng công cụ gọn một dòng
const O_NHAN_CLASS =
  "flex h-9 w-full items-center gap-2 rounded-md border border-bo-border bg-white pl-3 pr-2 text-sm focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 sm:w-auto";
const O_NGAY_CLASS =
  "h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-bo-foreground shadow-none focus-visible:ring-0";
const O_CHON_CLASS =
  "h-8 min-w-0 flex-1 cursor-pointer border-0 bg-transparent text-sm text-bo-foreground focus:outline-none sm:w-[76px] sm:flex-none";

// Kỳ / kiểu báo cáo: giữ đủ 7 kiểu như trước, đổi sang tab chung
const TAB_KY = [
  { value: "ngay", label: "Theo ngày" },
  { value: "tuan", label: "Theo tuần" },
  { value: "thang", label: "Theo tháng" },
  { value: "nam", label: "Theo năm" },
  { value: "so_sanh", label: "So sánh" },
  { value: "chi_tiet", label: "Chi tiết GD" },
  { value: "theo_kho", label: "Theo kho" },
];

// Giữ nguyên danh sách loại giao dịch của ô chọn cũ (danh sách kho tải từ máy chủ)
const LOAI_GD_OPTIONS = [
  { value: "ALL", label: "Tất cả loại GD" },
  { value: "nhap_kho", label: "Nhập kho" },
  { value: "xuat_kho", label: "Xuất kho" },
  { value: "chuyen_kho", label: "Chuyển kho" },
  { value: "dieu_chinh", label: "Điều chỉnh" },
];

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
          <span className="text-xs font-bold tabular-nums text-bo-foreground">{formatNumber(entry.value)}</span>
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
  const [khoList, setKhoList] = useState([]);
  const [loaiGiaoDich, setLoaiGiaoDich] = useState("ALL");
  const [data, setData] = useState([]);
  // Trang tự tải ngay khi mở nên bắt đầu ở trạng thái đang tải (không hiện số 0 trước khi có số)
  const [loading, setLoading] = useState(true);
  // null: không lỗi; { moTa }: lần tải gần nhất lỗi
  const [loi, setLoi] = useState(null);
  const requestIdRef = useRef(0);

  // Danh sách kho cho bộ lọc: bỏ kho ảo và kho ngừng hoạt động.
  // Lỗi tải thì chỉ còn "Tất cả kho", trang vẫn dùng được.
  useEffect(() => {
    let huy = false;
    khoService.getAllKho()
      .then((body) => {
        const ds = body?.data?.content ?? [];
        if (!huy) setKhoList(ds.filter((k) => !laKhoAo(k) && Number(k.trangThai) === 1));
      })
      .catch(() => {});
    return () => { huy = true; };
  }, []);

  const khoOptions = [
    { value: "ALL", label: "Tất cả kho" },
    ...khoList.map((k) => ({ value: String(k.id), label: k.tenKho })),
  ];

  const fetchData = useCallback(async () => {
    // Đổi tab / kho / loại giao dịch liên tiếp có thể chạy 2 yêu cầu cùng lúc: chỉ nhận kết quả mới nhất
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const params = buildParams({ loai, nam, thang, tuNam, denNam, tuNgay, denNgay, khoId, loaiGiaoDich });
      const res = await fetch(`${BASE_URL}?${params}`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json().catch(() => null);
      // Máy chủ báo lỗi thì ném lỗi để trang không hiện số 0 giả
      if (!res.ok) throw new Error(json?.message ?? "");
      if (requestId !== requestIdRef.current) return;
      setData(Array.isArray(json) ? json : json?.data ?? []);
      setLoi(null);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setData([]);
      setLoi({ moTa: e?.message ?? "" });
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
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

  // Chưa có số thật (đang tải lần đầu hoặc lỗi): hiện "—", không hiện số 0 giả
  const coSo = !loi && !(loading && chartData.length === 0);
  // Gợi ý phụ có số tính từ dữ liệu: ẩn khi đang tải hoặc lỗi
  const anGoiYSo = loading || Boolean(loi);

  // Dải chỉ số: giữ đủ 4 chỉ số, nhãn, cách tính và định dạng như các ô cũ
  const chiSo = [
    {
      label: "Tổng SL nhập",
      value: loi ? "—" : formatNumber(kpi.tongNhap),
      hint: anGoiYSo ? null : `${chartData.length} kỳ thống kê`,
    },
    {
      label: "Tổng SL xuất",
      value: loi ? "—" : formatNumber(kpi.tongXuat),
      hint: anGoiYSo ? null : `Chênh lệch: ${fmtChenhLech(tongChenhLech)}`,
    },
    {
      label: "Giá trị nhập",
      value: loi ? "—" : formatCurrencyCompact(kpi.tongGtrNhap),
      hint: anGoiYSo ? null : `${gtrNhapPct}% tổng giá trị`,
    },
    { label: "Giá trị xuất", value: loi ? "—" : formatCurrencyCompact(kpi.tongGtrXuat), hint: "Giá trị xuất kho" },
  ];

  return (
    <PageContainer className="space-y-4">

      {/* ── HÀNG CÔNG CỤ (thay khung "Bộ lọc nhật ký") ──
          Trái: kiểu báo cáo; phải: mốc thời gian, kho, loại giao dịch, nút xem.
          Màn hẹp: bộ lọc lên trên, tab xuống dưới (tab tự cuộn ngang) để gạch chân tab nằm sát đường kẻ */}
      <div className="flex flex-wrap-reverse items-start gap-x-3 border-b border-bo-border">
        <div className="min-w-0 max-w-full">
          <StatusTabs tabs={TAB_KY} value={loai} onChange={setLoai} label="Kiểu báo cáo" />
        </div>

        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 py-2 sm:w-auto">
          {/* Khoảng ngày */}
          {["ngay", "chi_tiet", "theo_kho"].includes(loai) && (
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

          {/* Năm */}
          {["tuan", "thang", "so_sanh"].includes(loai) && (
            <ONhan label="Năm">
              <select
                aria-label="Năm"
                value={nam}
                onChange={e => setNam(+e.target.value)}
                className={O_CHON_CLASS}
              >
                {Array.from({ length: 8 }, (_, i) => thisYear - 7 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </ONhan>
          )}

          {/* Tháng đem so sánh */}
          {loai === "so_sanh" && (
            <ONhan label="Tháng">
              <select
                aria-label="Tháng"
                value={thang}
                onChange={e => setThang(+e.target.value)}
                className={O_CHON_CLASS}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>T{i + 1}</option>
                ))}
              </select>
            </ONhan>
          )}

          {/* Khoảng năm */}
          {loai === "nam" && (
            <>
              <ONhan label="Từ năm">
                <select aria-label="Từ năm" value={tuNam} onChange={e => setTuNam(+e.target.value)}
                  className={O_CHON_CLASS}>
                  {Array.from({ length: 10 }, (_, i) => thisYear - 9 + i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </ONhan>
              <ONhan label="Đến năm">
                <select aria-label="Đến năm" value={denNam} onChange={e => setDenNam(+e.target.value)}
                  className={O_CHON_CLASS}>
                  {Array.from({ length: 10 }, (_, i) => thisYear - 9 + i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </ONhan>
            </>
          )}

          <FilterSelect
            label="Lọc theo kho"
            value={khoId}
            options={khoOptions}
            onChange={setKhoId}
            align="end"
            className="sm:w-[180px]"
          />

          <FilterSelect
            label="Lọc theo loại giao dịch"
            value={loaiGiaoDich}
            options={LOAI_GD_OPTIONS}
            onChange={setLoaiGiaoDich}
            align="end"
            className="sm:w-[170px]"
          />

          <Button
            onClick={fetchData}
            disabled={loading}
            className="h-9 w-full gap-2 bg-bo-primary px-4 text-sm font-medium text-white hover:bg-bo-primary-hover disabled:opacity-50 sm:w-auto"
          >
            {loading ? <RefreshCw className="size-4 animate-spin" /> : <Search className="size-4" />}
            Xem báo cáo
          </Button>
        </div>
      </div>

      {/* ── DẢI CHỈ SỐ (một khung, thay 4 ô rời) ── */}
      <MetricStrip label="Chỉ số nhập xuất" items={chiSo} loading={loading} />

      {/* ── CHART + SUMMARY (lỗi tải thì ẩn, báo lỗi ở khung bảng) ── */}
      {!loi && (
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
                  <YAxis tickFormatter={formatNumber} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
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
              { label: "Nhập kho", value: formatNumber(kpi.tongNhap), pct: nhapPct, barClass: "bg-bo-success", textClass: "text-bo-success", bg: "bg-bo-success-soft" },
              { label: "Xuất kho", value: formatNumber(kpi.tongXuat), pct: xuatPct, barClass: "bg-bo-danger", textClass: "text-bo-danger", bg: "bg-bo-danger-soft" },
              { label: "Giá trị nhập", value: formatCurrencyCompact(kpi.tongGtrNhap), pct: gtrNhapPct, barClass: "bg-bo-primary", textClass: "text-bo-primary", bg: "bg-bo-primary-soft" },
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
                <p className="mb-2 text-xs font-medium text-bo-muted">Xu hướng nhập kho</p>
                <MiniSparkline data={chartData} dataKey="tongNhap" color={CHART_COLORS.nhap} />
              </div>
            )}

            <div className="rounded-lg border border-bo-border bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-medium text-bo-muted">Chỉ số nhanh</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-bo-muted">Nhập TB / kỳ</span>
                <span className="text-xs font-bold tabular-nums text-bo-success">
                  {chartData.length > 0 ? formatNumber(Math.round(kpi.tongNhap / chartData.length)) : "—"}
                </span>
              </div>
              <div className="my-3 h-px bg-bo-border" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-bo-muted">Xuất TB / kỳ</span>
                <span className="text-xs font-bold tabular-nums text-bo-danger">
                  {chartData.length > 0 ? formatNumber(Math.round(kpi.tongXuat / chartData.length)) : "—"}
                </span>
              </div>
              <div className="my-3 h-px bg-bo-border" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-bo-muted">Tỷ lệ nhập/xuất</span>
                <span className={`text-xs font-bold tabular-nums ${tongChenhLech >= 0 ? "text-bo-success" : "text-bo-danger"}`}>
                  {/* Không có số xuất thì chỉ hiện "—" (trước đây hiện "—x"); dấu phẩy thập phân */}
                  {kpi.tongXuat > 0 ? `${formatNumber(Math.round((kpi.tongNhap / kpi.tongXuat) * 100) / 100)}x` : "—"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── DATA TABLE ── */}
      <TableShell
        title="Chi tiết nhật ký nhập xuất"
        description={coSo ? `${chartData.length} kỳ được tổng hợp` : undefined}
      >
        {loading && chartData.length === 0 ? (
          <LoadingState rows={5} label="Đang tải nhật ký nhập xuất" />
        ) : loi ? (
          <ErrorState description={loi.moTa || undefined} onRetry={fetchData} />
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
                {["#", "Thời kỳ", "SL nhập", "SL xuất", "Chênh lệch", "Giá trị nhập", "Giá trị xuất", "Loại GD"].map((h, i) => (
                  <th key={i} className={`${TH_CLASS} ${i === 7 ? "text-center" : i > 1 ? "text-right tabular-nums" : "text-left"}`}>
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
                    <td className="px-4 py-3.5 text-xs font-medium tabular-nums text-bo-muted">{String(i + 1).padStart(2, "0")}</td>
                    <td className="px-4 py-3.5 font-medium text-bo-foreground">{row.nhanThoiGian}</td>
                    <td className="px-4 py-3.5 text-right font-bold tabular-nums text-bo-success">{formatNumber(row.tongNhap)}</td>
                    <td className="px-4 py-3.5 text-right font-bold tabular-nums text-bo-danger">{formatNumber(row.tongXuat)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${cl >= 0
                        ? "border-bo-success/20 bg-bo-success-soft text-bo-success"
                        : "border-bo-danger/20 bg-bo-danger-soft text-bo-danger"
                        }`}>
                        {fmtChenhLech(cl)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-bo-primary">{formatCurrency(row.tongGiaTriNhap)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-slate-600">{formatCurrency(row.tongGiaTriXuat)}</td>
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
                <td className="px-4 py-3.5 text-right text-sm font-extrabold tabular-nums text-bo-success">{formatNumber(kpi.tongNhap)}</td>
                <td className="px-4 py-3.5 text-right text-sm font-extrabold tabular-nums text-bo-danger">{formatNumber(kpi.tongXuat)}</td>
                <td className="px-4 py-3.5 text-right tabular-nums">
                  <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${tongChenhLech >= 0
                    ? "border-bo-success/20 bg-bo-success-soft text-bo-success"
                    : "border-bo-danger/20 bg-bo-danger-soft text-bo-danger"
                    }`}>
                    {fmtChenhLech(tongChenhLech)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-extrabold tabular-nums text-bo-primary">{formatCurrency(kpi.tongGtrNhap)}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-extrabold tabular-nums text-slate-600">{formatCurrency(kpi.tongGtrXuat)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </TableShell>

    </PageContainer>
  );
}
