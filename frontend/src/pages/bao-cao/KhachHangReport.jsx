import { useState, useEffect, useCallback, useRef } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ComposedChart,
  Bar,
  Line,
} from "recharts";
import KhungBieuDo from "@/components/shared/KhungBieuDo";

import {
  Users,
  Search,
  RefreshCw,
  Calendar,
} from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/config/apiBase";
import { khoService } from "@/services/khoService";
import { laKhoAo } from "@/pages/warehouse/loaiKho";


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

const TH_CLASS =
  "h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

// Ô có nhãn nằm trong ô (theo mẫu ô ngày của PurchaseRequestList) để hàng công cụ gọn một dòng
const O_NHAN_CLASS =
  "flex h-9 w-full items-center gap-2 rounded-md border border-bo-border bg-white pl-3 pr-2 text-sm focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 sm:w-auto";
const O_NGAY_CLASS =
  "h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-bo-foreground shadow-none focus-visible:ring-0";
const O_SO_CLASS = `${O_NGAY_CLASS} sm:w-[72px] sm:flex-none`;


// Kỳ báo cáo: giữ đủ 4 kỳ và nhãn như trước, đổi sang tab chung
const TAB_KY = [
  { value: "ngay", label: "Ngày" },
  { value: "thang", label: "Tháng" },
  { value: "nam", label: "Năm" },
  { value: "so_sanh", label: "So sánh" },
];


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


// Ô nhập có nhãn trong ô
function ONhan({ label, icon, children }) {
  return (
    <label className={O_NHAN_CLASS}>
      {icon}
      <span className="shrink-0 text-xs text-bo-muted">{label}</span>
      {children}
    </label>
  );
}


export default function KhachHangReport() {

  const [loai, setLoai] = useState("thang");

  // Mặc định kỳ hiện tại như Báo cáo doanh thu (để trống thì máy chủ báo "Vui lòng chọn năm" ngay lần mở đầu)
  const [nam, setNam] = useState(() => new Date().getFullYear());
  const [thang, setThang] = useState(() => new Date().getMonth() + 1);

  const [tuNam, setTuNam] = useState(() => new Date().getFullYear() - 4);
  const [denNam, setDenNam] = useState(() => new Date().getFullYear());

  const [tuNgay, setTuNgay] = useState(defaultTuNgay);
  const [denNgay, setDenNgay] = useState(defaultDenNgay);

  const [khoId, setKhoId] = useState("");

  const [khoList, setKhoList] = useState([]);

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

  // "" = tất cả kho
  const khoOptions = [
    { value: "", label: "Tất cả kho" },
    ...khoList.map((k) => ({ value: String(k.id), label: k.tenKho })),
  ];


  const fetchData = useCallback(async () => {

    // Gõ năm / đổi bộ lọc liên tiếp chạy nhiều yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
    const requestId = ++requestIdRef.current;

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

    try {
      const res = await fetch(
        `${BASE_URL}?${params}`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const json = await res.json().catch(() => null);

      // Máy chủ báo lỗi (vd. thiếu năm) thì ném lỗi để trang không hiện số 0 giả
      if (!res.ok) throw new Error(json?.message ?? "");

      if (requestId !== requestIdRef.current) return;

      setData(Array.isArray(json?.data) ? json.data : []);
      setLoi(null);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;

      setData([]);
      setLoi({ moTa: e?.message ?? "" });
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }

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


  // Chưa có số thật (đang tải lần đầu hoặc lỗi): không hiện số 0 giả
  const coSo = !loi && !(loading && data.length === 0);


  // Dải chỉ số: giữ đủ 3 chỉ số, nhãn và định dạng như các ô cũ
  const chiSo = [
    { label: "Khách mới", value: loi ? "—" : fmt(tongMoi) },
    { label: "Khách quay lại", value: loi ? "—" : fmt(tongQuayLai) },
    { label: "Tổng khách mua", value: loi ? "—" : fmt(tongMua) },
  ];



  return (
    <PageContainer className="space-y-4">

      {/* ── HÀNG CÔNG CỤ (thay khung bộ lọc) ──
          Trái: kỳ báo cáo; phải: mốc thời gian, kho, nút xem.
          Màn hẹp: bộ lọc lên trên, tab xuống dưới để gạch chân tab nằm sát đường kẻ */}
      <div className="flex flex-wrap-reverse items-start gap-x-3 border-b border-bo-border">
        <div className="min-w-0 max-w-full">
          <StatusTabs
            tabs={TAB_KY}
            value={loai}
            onChange={setLoai}
            label="Kỳ báo cáo"
          />
        </div>

        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 py-2 sm:w-auto">

          {loai === "ngay" && (
            <>
              <ONhan
                label="Từ ngày"
                icon={<Calendar className="size-4 shrink-0 text-bo-muted" />}
              >
                <Input
                  type="date"
                  aria-label="Từ ngày"
                  value={tuNgay}
                  onChange={(e) =>
                    setTuNgay(e.target.value)
                  }
                  className={O_NGAY_CLASS}
                />
              </ONhan>

              <ONhan
                label="Đến ngày"
                icon={<Calendar className="size-4 shrink-0 text-bo-muted" />}
              >
                <Input
                  type="date"
                  aria-label="Đến ngày"
                  value={denNgay}
                  onChange={(e) =>
                    setDenNgay(e.target.value)
                  }
                  className={O_NGAY_CLASS}
                />
              </ONhan>
            </>
          )}


          {(loai === "thang" ||
            loai === "so_sanh") && (
              <ONhan label="Năm">
                <Input
                  type="number"
                  aria-label="Năm"
                  value={nam ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNam(v === "" ? null : Number(v));
                  }}
                  className={O_SO_CLASS}
                />
              </ONhan>
            )}


          {loai === "nam" && (
            <>
              <ONhan label="Từ năm">
                <Input
                  type="number"
                  aria-label="Từ năm"
                  value={tuNam ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTuNam(v === "" ? null : Number(v));
                  }}
                  className={O_SO_CLASS}
                />
              </ONhan>

              <ONhan label="Đến năm">
                <Input
                  type="number"
                  aria-label="Đến năm"
                  value={denNam ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDenNam(v === "" ? null : Number(v));
                  }}
                  className={O_SO_CLASS}
                />
              </ONhan>
            </>
          )}


          {loai === "so_sanh" && (
            <ONhan label="Tháng">
              <Input
                type="number"
                aria-label="Tháng"
                value={thang ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setThang(v === "" ? null : Number(v));
                }}
                className={O_SO_CLASS}
              />
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
            onClick={fetchData}
            disabled={loading}
            className="h-9 w-full gap-2 bg-bo-primary px-4 text-sm font-medium text-white hover:bg-bo-primary-hover disabled:opacity-50 sm:w-auto"
          >
            {loading ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}

            Xem báo cáo
          </Button>
        </div>
      </div>

      {/* ── DẢI CHỈ SỐ (một khung, thay 3 ô rời) ── */}
      <MetricStrip
        label="Chỉ số khách hàng"
        items={chiSo}
        loading={loading}
      />



      {/* ── BIỂU ĐỒ (lỗi tải thì ẩn, báo lỗi ở khung bảng) ── */}
      {!loi && (
        <SurfaceCard
          title="Phân tích khách hàng"
          description="Xu hướng khách mới & quay lại"
          contentClassName="h-[420px]"
        >
          {loading && data.length === 0 ? (
            <LoadingState rows={4} label="Đang tải biểu đồ khách hàng" />
          ) : (
            <KhungBieuDo>

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

            </KhungBieuDo>
          )}
        </SurfaceCard>
      )}



      {/* ── BẢNG CHI TIẾT ── */}
      <TableShell
        title="Chi tiết dữ liệu"
        description={coSo ? `${data.length} kỳ được tổng hợp` : undefined}
      >
        {loading && data.length === 0 ? (
          <LoadingState rows={5} label="Đang tải chi tiết khách hàng" />
        ) : loi ? (
          <ErrorState
            description={loi.moTa || undefined}
            onRetry={fetchData}
          />
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
