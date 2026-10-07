import { useState, useEffect, useCallback } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
} from "recharts";

import {
  Users,
  UserPlus,
  Repeat,
  TrendingUp,
  Search,
  RefreshCw,
} from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { API_BASE_URL } from "@/config/apiBase";


// API
const BASE_URL = `${API_BASE_URL}/api/v1/admin/dashboard/bao-cao/khach-hang`;

const getToken = () =>
  localStorage.getItem("access_token") ?? "";


// helpers
const fmt = (n) =>
  n != null ? Number(n).toLocaleString("vi-VN") : "—";


const today = new Date();
const thisYear = today.getFullYear();
const thisMonth = today.getMonth() + 1;

const defaultTuNgay = `${thisYear}-${String(
  thisMonth
).padStart(2, "0")}-01`;

const defaultDenNgay =
  today.toISOString().split("T")[0];


// Màu biểu đồ lấy từ token bo-* (recharts cần giá trị màu cụ thể)
const CHART_COLORS = {
  khachMoi: "#1677ff",
  quayLai: "#93c5fd",
  tongKhach: "#182537",
  grid: "#e1e6ec",
  axis: "#64748b",
};

const DROPDOWN_CLASS =
  "z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg";
const SELECT_ITEM_CLASS =
  "rounded-md text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";
const TH_CLASS =
  "h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";


// build query
function buildParams({
  loai,
  nam,
  thang,
  tuNam,
  denNam,
  tuNgay,
  denNgay,
  khoId,
}) {

  const p = new URLSearchParams();

  if (loai) p.set("loai", loai);

  if (loai === "ngay") {
    if (tuNgay) p.set("tuNgay", tuNgay);
    if (denNgay) p.set("denNgay", denNgay);
  }

  if (loai === "thang" || loai === "tuan") {
    if (nam != null) p.set("nam", nam);
  }

  if (loai === "nam") {
    if (tuNam != null) p.set("tuNam", tuNam);
    if (denNam != null) p.set("denNam", denNam);
  }

  if (loai === "so_sanh") {
    if (nam != null) p.set("nam", nam);
    if (thang != null) p.set("thang", thang);
  }

  if (khoId) p.set("khoId", khoId);

  return p.toString();
}


// KPI CARD
function KpiCard({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-medium text-bo-muted">
          {label}
        </p>

        <p className="mt-1 break-words text-2xl font-bold tracking-tight text-bo-foreground">
          {fmt(value)}
        </p>
      </div>

      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bo-primary-soft text-bo-primary">
        {icon}
      </span>
    </div>
  );
}


export default function KhachHangReport() {

  const [loai, setLoai] = useState("thang");

  const [nam, setNam] = useState(null);
  const [thang, setThang] = useState(null);

  const [tuNam, setTuNam] = useState(null);
  const [denNam, setDenNam] = useState(null);

  const [tuNgay, setTuNgay] = useState(defaultTuNgay);
  const [denNgay, setDenNgay] = useState(defaultDenNgay);

  const [khoId, setKhoId] = useState("");

  const [data, setData] = useState([]);

  const [loading, setLoading] = useState(false);


  const fetchData = useCallback(async () => {

    setLoading(true);

    const params = buildParams({
      loai,
      nam,
      thang,
      tuNam,
      denNam,
      tuNgay,
      denNgay,
      khoId,
    });

    const res = await fetch(
      `${BASE_URL}?${params}`,
      {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      }
    );

    const json = await res.json();

    setData(Array.isArray(json?.data) ? json.data : []);

    setLoading(false);

  }, [
    loai,
    nam,
    thang,
    tuNam,
    denNam,
    tuNgay,
    denNgay,
    khoId,
  ]);


  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn tải lại mỗi khi bộ lọc đổi.
  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);


  const tongMoi = data.reduce(
    (s, d) => s + (Number(d.soKhachMoi) || 0),
    0
  );

  const tongQuayLai = data.reduce(
    (s, d) => s + (Number(d.soKhachQuayLai) || 0),
    0
  );

  const tongMua = data.reduce(
    (s, d) => s + (Number(d.tongKhachMua) || 0),
    0
  );



  return (
    <PageContainer className="space-y-5">

      {/* ── BỘ LỌC ── */}
      <section className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-3 p-4 sm:p-5">

          <Tabs value={loai} onValueChange={setLoai}>
            <TabsList className="h-9 rounded-lg border border-bo-border bg-bo-surface-subtle p-1">
              <TabsTrigger
                value="ngay"
                className="rounded-md px-3 text-sm text-slate-600 data-[state=active]:bg-white data-[state=active]:text-bo-primary data-[state=active]:shadow-sm"
              >
                Ngày
              </TabsTrigger>
              <TabsTrigger
                value="thang"
                className="rounded-md px-3 text-sm text-slate-600 data-[state=active]:bg-white data-[state=active]:text-bo-primary data-[state=active]:shadow-sm"
              >
                Tháng
              </TabsTrigger>
              <TabsTrigger
                value="nam"
                className="rounded-md px-3 text-sm text-slate-600 data-[state=active]:bg-white data-[state=active]:text-bo-primary data-[state=active]:shadow-sm"
              >
                Năm
              </TabsTrigger>
              <TabsTrigger
                value="so_sanh"
                className="rounded-md px-3 text-sm text-slate-600 data-[state=active]:bg-white data-[state=active]:text-bo-primary data-[state=active]:shadow-sm"
              >
                So sánh
              </TabsTrigger>
            </TabsList>
          </Tabs>


          {loai === "ngay" && (
            <>
              <Input
                type="date"
                value={tuNgay}
                onChange={(e) =>
                  setTuNgay(e.target.value)
                }
                className="h-9 w-[160px] border-bo-border bg-white text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
              />

              <Input
                type="date"
                value={denNgay}
                onChange={(e) =>
                  setDenNgay(e.target.value)
                }
                className="h-9 w-[160px] border-bo-border bg-white text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
              />
            </>
          )}


          {(loai === "thang" ||
            loai === "so_sanh") && (
              <Input
                type="number"
                placeholder="Năm"
                value={nam ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setNam(v === "" ? null : Number(v));
                }}
                className="h-9 w-[120px] border-bo-border bg-white text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
              />
            )}


          {loai === "nam" && (
            <div className="flex gap-2">

              <Input
                type="number"
                placeholder="Từ năm"
                value={tuNam ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setTuNam(v === "" ? null : Number(v));
                }}
                className="h-9 w-[120px] border-bo-border bg-white text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
              />

              <Input
                type="number"
                placeholder="Đến năm"
                value={denNam ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setDenNam(v === "" ? null : Number(v));
                }}
                className="h-9 w-[120px] border-bo-border bg-white text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
              />

            </div>
          )}


          {loai === "so_sanh" && (
            <Input
              type="number"
              placeholder="Tháng"
              value={thang ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setThang(v === "" ? null : Number(v));
              }}
              className="h-9 w-[110px] border-bo-border bg-white text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20"
            />
          )}


          <Select
            value={khoId || "ALL"}
            onValueChange={(v) => setKhoId(v === "ALL" ? "" : v)}
          >
            <SelectTrigger className="h-9 w-[200px] border-bo-border bg-white text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20">
              <SelectValue placeholder="Tất cả kho" />
            </SelectTrigger>

            <SelectContent
              position="popper"
              sideOffset={4}
              className={DROPDOWN_CLASS}
            >

              <SelectItem value="ALL" className={SELECT_ITEM_CLASS}>
                Tất cả kho
              </SelectItem>

              <SelectItem value="1" className={SELECT_ITEM_CLASS}>
                KHO01 – Hà Nội
              </SelectItem>

              <SelectItem value="2" className={SELECT_ITEM_CLASS}>
                KHO02 – Miền Nam
              </SelectItem>

            </SelectContent>
          </Select>


          <Button
            onClick={fetchData}
            disabled={loading}
            className="h-9 gap-2 bg-bo-primary px-4 text-sm font-medium text-white hover:bg-bo-primary-hover disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}

            Xem báo cáo
          </Button>
        </div>
      </section>

      {/* ── KPI ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

        <KpiCard
          icon={<UserPlus className="size-5" />}
          label="Khách mới"
          value={tongMoi}
        />

        <KpiCard
          icon={<Repeat className="size-5" />}
          label="Khách quay lại"
          value={tongQuayLai}
        />

        <KpiCard
          icon={<TrendingUp className="size-5" />}
          label="Tổng khách mua"
          value={tongMua}
        />

      </section>



      {/* ── BIỂU ĐỒ ── */}
      <SurfaceCard
        title="Phân tích khách hàng"
        description="Xu hướng khách mới & quay lại"
        contentClassName="h-[420px]"
      >
        {loading && data.length === 0 ? (
          <LoadingState rows={4} label="Đang tải biểu đồ khách hàng" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">

            <ComposedChart data={data}>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_COLORS.grid}
                vertical={false}
              />

              <XAxis
                dataKey="nhanThoiGian"
                tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                tickLine={false}
              />

              <YAxis
                tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip />

              <Bar
                dataKey="soKhachMoi"
                fill={CHART_COLORS.khachMoi}
                name="Khách mới"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />

              <Bar
                dataKey="soKhachQuayLai"
                fill={CHART_COLORS.quayLai}
                name="Quay lại"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />

              <Line
                dataKey="tongKhachMua"
                stroke={CHART_COLORS.tongKhach}
                strokeWidth={3}
                name="Tổng khách"
                dot={{ r: 3, fill: CHART_COLORS.tongKhach, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />

            </ComposedChart>

          </ResponsiveContainer>
        )}
      </SurfaceCard>



      {/* ── BẢNG CHI TIẾT ── */}
      <TableShell
        title="Chi tiết dữ liệu"
        description={`${data.length} kỳ được tổng hợp`}
      >
        {loading && data.length === 0 ? (
          <LoadingState rows={5} label="Đang tải chi tiết khách hàng" />
        ) : data.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Không có dữ liệu"
            description="Hãy thay đổi bộ lọc và thử lại."
          />
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className={`${TH_CLASS} text-left`}>Kỳ</th>
                <th className={`${TH_CLASS} text-right`}>Khách mới</th>
                <th className={`${TH_CLASS} text-right`}>Quay lại</th>
                <th className={`${TH_CLASS} text-right`}>Tổng mua</th>
                <th className={`${TH_CLASS} text-right`}>Tích lũy</th>
                <th className={`${TH_CLASS} text-right`}>Tăng trưởng</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-bo-border">
              {data.map((row, i) => (
                <tr
                  key={i}
                  className="transition-colors hover:bg-bo-surface-subtle"
                >
                  <td className="px-3 py-3.5 font-medium text-bo-foreground">
                    {row.nhanThoiGian}
                  </td>

                  <td className="px-3 py-3.5 text-right font-semibold text-bo-primary">
                    {fmt(row.soKhachMoi)}
                  </td>

                  <td className="px-3 py-3.5 text-right text-bo-foreground">
                    {fmt(row.soKhachQuayLai)}
                  </td>

                  <td className="px-3 py-3.5 text-right text-bo-foreground">
                    {fmt(row.tongKhachMua)}
                  </td>

                  <td className="px-3 py-3.5 text-right text-bo-muted">
                    {fmt(row.tichLuyKhachMoi)}
                  </td>

                  <td className="px-3 py-3.5 text-right">
                    {row.tyLeTangTruong != null ? (
                      <StatusBadge
                        label={`${row.tyLeTangTruong.toFixed(1)}%`}
                        tone="info"
                        dot={false}
                      />
                    ) : (
                      <span className="text-bo-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableShell>

    </PageContainer>
  );
}
