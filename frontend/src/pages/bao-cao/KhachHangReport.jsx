import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import KhungBieuDo from "@/components/shared/KhungBieuDo";

import { Users, Calendar } from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MetricStrip from "@/components/shared/MetricStrip";
import StatusTabs from "@/components/shared/StatusTabs";
import FilterSelect from "@/components/shared/FilterSelect";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import SearchInput from "@/components/shared/SearchInput";
import TablePagination from "@/components/shared/TablePagination";
import NutXuatExcel from "@/components/shared/NutXuatExcel";
import useCoQuyenXuatBaoCao from "@/hooks/useCoQuyenXuatBaoCao";
import { tenTepTheoThamSo, xuatBaoCaoService } from "@/services/xuatBaoCaoService";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/config/apiBase";
import { khoService, getMineKhoList } from "@/services/khoService";
import { parseRoles } from "@/components/settings/settings.config";
import { laKhoAo } from "@/pages/warehouse/loaiKho";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { ngonNguHienTai, t } from "@/i18n";
import { dichNhanKy, loiKhoangNgay, ngayMay } from "./tinhBaoCaoDoanhThu";
import {
  cacNam,
  cacThang,
  chiTieuTrungBinh,
  khoangNgayNgan,
  kyCoDon,
  moTaBangKy,
  ngayVN,
  tyLeQuayLai,
} from "./tinhBaoCaoKhachHang";


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

const defaultDenNgay = ngayMay(today);


// Màu biểu đồ lấy từ token bo-* (recharts cần giá trị màu cụ thể); biểu đồ giữ xanh #1677ff
const CHART_COLORS = {
  khachMoi: "#1677ff",
  quayLai: "#93c5fd",
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

// Ô chọn năm / tháng / kho trong hàng công cụ: điện thoại chia đều một hàng, máy tính cỡ cố định
const O_CHON_NHO = "w-auto min-w-0 flex-1 sm:w-[132px] sm:flex-none";
const O_CHON_KHO = "w-auto min-w-0 flex-1 sm:w-[200px] sm:flex-none";


// Kỳ báo cáo
const TAB_KY = [
  { value: "ngay", label: t("Ngày") },
  { value: "tuan", label: t("Tuần") },
  { value: "thang", label: t("Tháng") },
  { value: "nam", label: t("Năm") },
  { value: "so_sanh", label: t("So sánh") },
];

// Nhóm khách trong danh sách "Khách mua trong kỳ"
const NHOM_KHACH = [
  { value: "tat_ca", label: t("Tất cả"), dem: "tatCa" },
  { value: "mot_lan", label: t("Mua 1 lần"), dem: "motLan" },
  { value: "mua_lai", label: t("Mua lại"), dem: "muaLai" },
];

const SO_DONG_KHACH = 10;

const NAM_OPTIONS = cacNam(today).map((y) => ({ value: String(y), label: t("Năm {{y}}", { y }) }));


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


async function taiJson(url, signal) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getToken()}`, "Accept-Language": ngonNguHienTai() },
    signal,
  });
  const json = await res.json().catch(() => null);
  // Yêu cầu đã hủy giữa lúc đọc thân (json() lỗi bị nuốt ở trên): báo hủy, không coi là thành công
  signal?.throwIfAborted();
  // Máy chủ báo lỗi (vd. thiếu năm) thì ném lỗi để trang không hiện số 0 giả; kèm mã HTTP (403: ô lỗi không "Thử lại")
  if (!res.ok) throw Object.assign(new Error(json?.message ?? ""), { status: res.status });
  return json?.data;
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


// Nhãn trục X: kỳ chưa tới (vd. tháng 12 khi đang ở tháng 11) nhạt đi
function NhanTrucX({ x, y, payload, ky }) {
  const chuaToi = ky[payload?.index]?.chuaToi;
  return (
    <text
      x={x}
      y={y + 12}
      textAnchor="middle"
      fontSize={11}
      fill={CHART_COLORS.axis}
      opacity={chuaToi ? 0.45 : 1}
    >
      {dichNhanKy(payload?.value)}
    </text>
  );
}


// Khung số khi rê chuột lên một kỳ
function KhungSo({ active, payload, loai }) {
  const k = payload?.[0]?.payload;
  if (!active || !k) return null;
  const tyLe = tyLeQuayLai(k.soKhachQuayLai, k.tongKhachMua);
  const tieuDe = loai === "tuan"
    ? `${dichNhanKy(k.nhanThoiGian)} (${khoangNgayNgan(k.tuNgay, k.denNgay)})`
    : dichNhanKy(k.nhanThoiGian);
  return (
    <div className="min-w-[180px] rounded-lg border border-bo-border bg-bo-surface px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-1.5 text-[13px] font-semibold text-bo-foreground">{tieuDe}</p>
      {k.chuaToi ? (
        <p className="text-bo-muted">{t("Chưa tới kỳ này")}</p>
      ) : (
        <>
          <DongSo mau={CHART_COLORS.khachMoi} nhan={t("Khách mới")} so={k.soKhachMoi} />
          <DongSo mau={CHART_COLORS.quayLai} nhan={t("Khách quay lại")} so={k.soKhachQuayLai} />
          <div className="mt-1.5 flex justify-between gap-4 border-t border-bo-border pt-1.5 font-semibold tabular-nums text-bo-foreground">
            <span>{t("Khách mua")}</span>
            <span>{fmt(k.tongKhachMua)}{tyLe != null ? t(" · {{tyLe}}% quay lại", { tyLe }) : ""}</span>
          </div>
        </>
      )}
    </div>
  );
}

function DongSo({ mau, nhan, so }) {
  return (
    <div className="flex justify-between gap-4 tabular-nums">
      <span className="inline-flex items-center gap-1.5 text-bo-muted">
        <i className="inline-block size-2 rounded-sm" style={{ background: mau }} aria-hidden="true" />
        {nhan}
      </span>
      <span className="text-bo-foreground">{fmt(so)}</span>
    </div>
  );
}


// Chú thích màu của biểu đồ
function ChuThich() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-bo-muted">
      {[
        [CHART_COLORS.khachMoi, t("Khách mới")],
        [CHART_COLORS.quayLai, t("Khách quay lại")],
      ].map(([mau, nhan]) => (
        <span key={nhan} className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-[3px]" style={{ background: mau }} aria-hidden="true" />
          {nhan}
        </span>
      ))}
    </div>
  );
}


// Khách mới so kỳ trước: tăng xanh, giảm đỏ, không có kỳ trước thì "—"
function SoKyTruoc({ giaTri }) {
  if (giaTri == null) return <span className="text-bo-muted">—</span>;
  const so = Number(giaTri);
  const chu = `${so > 0 ? "+" : ""}${so.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
  return (
    <span
      className={cn(
        "inline-flex rounded-[5px] px-1.5 py-px text-xs font-semibold tabular-nums",
        so > 0 && "bg-bo-success-soft text-bo-success",
        so < 0 && "bg-bo-danger-soft text-bo-danger-strong",
        so === 0 && "bg-bo-surface-subtle text-bo-muted",
      )}
    >
      {chu}
    </span>
  );
}


// Nhãn kỳ trong bảng: tuần kèm khoảng ngày
function NhanKy({ row, loai }) {
  return (
    <>
      <span>{dichNhanKy(row.nhanThoiGian)}</span>
      {loai === "tuan" ? (
        <span className="block text-xs font-normal text-bo-muted">{khoangNgayNgan(row.tuNgay, row.denNgay)}</span>
      ) : null}
    </>
  );
}


function NhanNhom({ muaLai }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-px text-xs font-medium",
        muaLai ? "bg-bo-success-soft text-bo-success" : "bg-bo-primary-soft text-bo-primary-strong",
      )}
    >
      {muaLai ? t("Mua lại") : t("Mua 1 lần")}
    </span>
  );
}


export default function KhachHangReport() {
  const coQuyenXuat = useCoQuyenXuatBaoCao();
  const navigate = useNavigate();
  const laQtv = parseRoles(localStorage.getItem("role")).includes("quan_tri_vien");

  const [loai, setLoai] = useState("thang");

  // Mặc định kỳ hiện tại như Báo cáo doanh thu
  const [nam, setNam] = useState(thisYear);
  const [thang, setThang] = useState(thisMonth);

  const [tuNam, setTuNam] = useState(thisYear - 4);
  const [denNam, setDenNam] = useState(thisYear);

  const [tuNgay, setTuNgay] = useState(defaultTuNgay);
  const [denNgay, setDenNgay] = useState(defaultDenNgay);

  const [khoId, setKhoId] = useState("");

  const [khoList, setKhoList] = useState([]);

  // { ky: [...], tong: {...} } của lần tải gần nhất
  const [data, setData] = useState(null);

  // Trang tự tải ngay khi mở nên bắt đầu ở trạng thái đang tải (không hiện số 0 trước khi có số)
  const [loading, setLoading] = useState(true);

  // null: không lỗi; { moTa }: lần tải gần nhất lỗi
  const [loi, setLoi] = useState(null);
  // Tham số của số liệu đang hiện: tệp Excel và danh sách khách đọc đúng theo đây
  const [thamSoDaXem, setThamSoDaXem] = useState(null);

  const requestIdRef = useRef(0);

  // Danh sách khách mua trong kỳ
  const [nhom, setNhom] = useState("tat_ca");
  const [tim, setTim] = useState("");
  const [timGui, setTimGui] = useState("");
  const [trang, setTrang] = useState(0);
  const [soDong, setSoDong] = useState(SO_DONG_KHACH);
  const [khach, setKhach] = useState(null);
  const [taiKhach, setTaiKhach] = useState(false);
  const [loiKhach, setLoiKhach] = useState(null);
  const [lanTaiKhach, setLanTaiKhach] = useState(0);


  // Danh sách kho cho bộ lọc như Báo cáo doanh thu: quản trị viên mọi kho, quản lý kho các cửa hàng mình phụ trách
  // (máy chủ chặn kho khác). Bỏ kho ảo và kho ngừng hoạt động. Lỗi tải thì chỉ còn "Tất cả kho", trang vẫn dùng được.
  useEffect(() => {
    let huy = false;
    const tai = laQtv ? khoService.getAllKho().then((body) => body?.data?.content ?? []) : getMineKhoList();
    tai
      .then((ds) => {
        if (!huy) setKhoList((ds ?? []).filter((k) => !laKhoAo(k) && Number(k.trangThai ?? 1) === 1));
      })
      .catch(() => {});
    return () => { huy = true; };
  }, [laQtv]);

  // "" = tất cả kho (quản lý kho: mọi nơi làm việc của mình)
  const khoOptions = [
    { value: "", label: laQtv ? t("Tất cả kho") : t("Tất cả nơi làm việc") },
    ...khoList.map((k) => ({ value: String(k.id), label: k.tenKho })),
  ];

  // Ngày gõ dở, quá 1 năm, sau hôm nay: báo dưới hàng công cụ, không gọi máy chủ
  const loiNgay = loai === "ngay" ? loiKhoangNgay(tuNgay, denNgay) : "";


  const fetchData = useCallback(async () => {

    if (loiNgay) return;

    // Đổi bộ lọc liên tiếp chạy nhiều yêu cầu cùng lúc: chỉ nhận kết quả của yêu cầu mới nhất
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
      const kq = await taiJson(`${BASE_URL}?${params}`);

      if (requestId !== requestIdRef.current) return;

      setData(kq && Array.isArray(kq.ky) ? kq : { ky: [], tong: null });
      setThamSoDaXem(params);
      setLoi(null);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;

      setData(null);
      setThamSoDaXem(null);
      setLoi({ moTa: e?.message ?? "", status: e?.status });
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }

  }, [loiNgay, loai, nam, thang, tuNam, denNam, tuNgay, denNgay, khoId]);


  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn tải lại mỗi khi bộ lọc đổi.
  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);


  // Ô tìm khách: gửi sau khi ngừng gõ 300ms
  useEffect(() => {
    const hen = setTimeout(() => setTimGui(tim.trim()), 300);
    return () => clearTimeout(hen);
  }, [tim]);

  // Đổi nhóm, số dòng thì về trang đầu ngay lúc đổi; đổi kỳ / kho (số liệu mới) hoặc từ khóa đã gửi thì đặt lại
  // trong lúc dựng (không đợi effect, để danh sách không tải một lượt với trang cũ)
  const doiNhom = (v) => { setNhom(v); setTrang(0); };
  const doiSoDong = (v) => { setSoDong(v); setTrang(0); };
  const khoaDanhSach = `${thamSoDaXem}|${timGui}`;
  const [khoaTruoc, setKhoaTruoc] = useState(khoaDanhSach);
  if (khoaTruoc !== khoaDanhSach) {
    setKhoaTruoc(khoaDanhSach);
    setTrang(0);
  }

  // Danh sách khách mua: đọc đúng tham số của số liệu đang hiện
  useEffect(() => {
    if (!thamSoDaXem) return undefined;
    const ctl = new AbortController();
    const p = new URLSearchParams(thamSoDaXem);
    p.set("nhom", nhom);
    if (timGui) p.set("q", timGui);
    p.set("page", String(trang));
    p.set("size", String(soDong));
    queueMicrotask(() => {
      if (ctl.signal.aborted) return;
      setTaiKhach(true);
      taiJson(`${BASE_URL}/khach-mua?${p}`, ctl.signal)
        .then((kq) => {
          if (ctl.signal.aborted) return;
          setKhach(kq ?? null);
          setLoiKhach(null);
        })
        .catch((e) => {
          if (ctl.signal.aborted || e?.name === "AbortError") return;
          setKhach(null);
          setLoiKhach({ moTa: e?.message ?? "", status: e?.status });
        })
        .finally(() => {
          if (!ctl.signal.aborted) setTaiKhach(false);
        });
    });
    return () => ctl.abort();
  }, [thamSoDaXem, nhom, timGui, trang, soDong, lanTaiKhach]);


  const ky = data?.ky ?? [];
  const tong = data?.tong ?? null;
  const dongBang = kyCoDon(ky);
  const dangTaiLanDau = loading && !data;
  // Đang tải lại sau khi đổi bộ lọc: số cũ còn trên màn thì làm mờ đi
  const mo = loading && data ? "opacity-60 transition-opacity" : undefined;
  // Kiểu báo cáo của số liệu đang hiện (tab có thể đã đổi trong lúc chờ số mới)
  const loaiDaXem = (thamSoDaXem && new URLSearchParams(thamSoDaXem).get("loai")) || loai;

  const tyLeMuaLai = tyLeQuayLai(tong?.khachMuaLai, tong?.khachMua);
  const chiTieuTb = chiTieuTrungBinh(tong);
  const tienToKy = loaiDaXem === "so_sanh" && tong?.tuNgay ? t("Tháng {{thang}}/{{nam}} · ", { thang: Number(tong.tuNgay.slice(5, 7)), nam: tong.tuNgay.slice(0, 4) }) : "";

  // Dải chỉ số: mỗi khách đếm một lần trên cả kỳ (máy chủ tính, không cộng các dòng)
  const chiSo = [
    {
      label: t("Khách mua"),
      value: loi || !tong ? "—" : fmt(tong.khachMua),
      hint: tong
        ? t("{{tienToKy}}Mỗi khách đếm một lần{{khachLe}}", { tienToKy, khachLe: tong.donKhachLe > 0 ? t(" · chưa tính {{donKhachLe}} đơn khách lẻ", { donKhachLe: fmt(tong.donKhachLe), count: tong.donKhachLe }) : "" })
        : undefined,
    },
    {
      label: t("Khách mới"),
      value: loi || !tong ? "—" : fmt(tong.khachMoi),
      hint: tong ? t("Lần đầu mua rơi vào kỳ đang xem") : undefined,
    },
    {
      label: t("Khách mua lại"),
      value: loi || !tong ? "—" : (
        <>
          {fmt(tong.khachMuaLai)}
          {tyLeMuaLai != null ? (
            <span className="ml-1.5 text-[13px] font-medium text-bo-muted">{tyLeMuaLai}%</span>
          ) : null}
        </>
      ),
      hint: tong ? t("Có từ 2 đơn trở lên tính tới cuối kỳ") : undefined,
    },
    {
      label: t("Chi tiêu TB mỗi khách"),
      // Điện thoại 2 cột: số tiền dài thu nhỏ chữ để không bị cắt
      value: loi || !tong ? "—" : chiTieuTb == null ? "—" : (
        <span className="max-md:text-lg">{formatCurrency(chiTieuTb)}</span>
      ),
      hint: tong ? t("Doanh thu đơn đã giao ÷ khách mua") : undefined,
    },
  ];

  const nhomTabs = NHOM_KHACH.map((n) => ({ value: n.value, label: n.label, count: khach ? khach[n.dem] : null }));
  const dsKhach = khach?.content ?? [];
  const moKhach = (id) => navigate(`/customers/${id}`);


  return (
    <PageContainer className="space-y-4">
      <ListPageHeader
        actions={coQuyenXuat ? (
          <NutXuatExcel
            taiTep={() => xuatBaoCaoService.khachHang(thamSoDaXem)}
            tenTep={() => tenTepTheoThamSo("Bao-cao-khach-hang", thamSoDaXem)}
            disabled={loading || !thamSoDaXem}
          />
        ) : null}
      />

      {/* ── HÀNG CÔNG CỤ ──
          Trái: kỳ báo cáo; phải: mốc thời gian, kho. Đổi bộ lọc là tự tải lại.
          Màn hẹp: bộ lọc lên trên, tab xuống dưới để gạch chân tab nằm sát đường kẻ */}
      <div className="flex flex-wrap-reverse items-start gap-x-3 border-b border-bo-border">
        <div className="min-w-0 max-w-full">
          <StatusTabs
            tabs={TAB_KY}
            value={loai}
            onChange={setLoai}
            label={t("Kỳ báo cáo")}
          />
        </div>

        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 py-2 sm:w-auto">

          {loai === "ngay" && (
            <>
              <ONhan
                label={t("Từ ngày")}
                icon={<Calendar className="size-4 shrink-0 text-bo-muted" />}
              >
                <Input
                  type="date"
                  aria-label={t("Từ ngày")}
                  value={tuNgay}
                  max={denNgay || defaultDenNgay}
                  min="2000-01-01"
                  aria-invalid={loiNgay ? true : undefined}
                  onChange={(e) => setTuNgay(e.target.value)}
                  className={O_NGAY_CLASS}
                />
              </ONhan>

              <ONhan
                label={t("Đến ngày")}
                icon={<Calendar className="size-4 shrink-0 text-bo-muted" />}
              >
                <Input
                  type="date"
                  aria-label={t("Đến ngày")}
                  value={denNgay}
                  max={defaultDenNgay}
                  min={tuNgay || "2000-01-01"}
                  aria-invalid={loiNgay ? true : undefined}
                  onChange={(e) => setDenNgay(e.target.value)}
                  className={O_NGAY_CLASS}
                />
              </ONhan>
            </>
          )}


          {(loai === "thang" || loai === "tuan" || loai === "so_sanh") && (
            <FilterSelect
              label={t("Chọn năm")}
              value={String(nam)}
              options={NAM_OPTIONS}
              onChange={(v) => {
                const y = Number(v);
                setNam(y);
                // Năm nay chỉ chọn được tới tháng hiện tại
                if (y === thisYear && thang > thisMonth) setThang(thisMonth);
              }}
              align="end"
              className={O_CHON_NHO}
            />
          )}


          {loai === "so_sanh" && (
            <FilterSelect
              label={t("Chọn tháng")}
              value={String(thang)}
              options={cacThang(nam, today).map((m) => ({ value: String(m), label: t("Tháng {{m}}", { m }) }))}
              onChange={(v) => setThang(Number(v))}
              align="end"
              className={O_CHON_NHO}
            />
          )}


          {loai === "nam" && (
            <>
              <FilterSelect
                label={t("Từ năm")}
                value={String(tuNam)}
                options={NAM_OPTIONS.map((o) => ({ ...o, label: t("Từ {{value}}", { value: o.value }) }))}
                onChange={(v) => {
                  const y = Number(v);
                  setTuNam(y);
                  if (y > denNam) setDenNam(y);
                }}
                align="end"
                className={O_CHON_NHO}
              />
              <FilterSelect
                label={t("Đến năm")}
                value={String(denNam)}
                options={NAM_OPTIONS.filter((o) => Number(o.value) >= tuNam).map((o) => ({ ...o, label: t("Đến {{value}}", { value: o.value }) }))}
                onChange={(v) => setDenNam(Number(v))}
                align="end"
                className={O_CHON_NHO}
              />
            </>
          )}


          <FilterSelect
            label={t("Lọc theo kho")}
            value={khoId}
            options={khoOptions}
            onChange={setKhoId}
            align="end"
            className={O_CHON_KHO}
          />
        </div>
      </div>

      {loiNgay ? (
        <p className="-mt-2 text-right text-xs text-bo-danger" role="alert">{loiNgay}</p>
      ) : null}

      {/* ── DẢI CHỈ SỐ ── Điện thoại: 2 cột × 2 hàng */}
      <MetricStrip
        label={t("Chỉ số khách hàng")}
        items={chiSo}
        loading={dangTaiLanDau}
        className={cn("max-md:grid-cols-2 max-md:[&>div]:px-3", mo)}
      />



      {/* ── BIỂU ĐỒ (lỗi tải thì ẩn, báo lỗi ở khung bảng) ── */}
      {!loi && (
        <SurfaceCard
          title={t("Khách mua theo kỳ")}
          description={t("Cột chồng: khách mới + khách quay lại = khách mua trong kỳ")}
          action={<ChuThich />}
          className={mo}
          contentClassName="h-[320px] max-md:h-[260px]"
        >
          {dangTaiLanDau ? (
            <LoadingState rows={4} label={t("Đang tải biểu đồ khách hàng")} />
          ) : (
            <KhungBieuDo>
              <BarChart data={ky} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_COLORS.grid}
                  vertical={false}
                />

                <XAxis
                  dataKey="nhanThoiGian"
                  tick={<NhanTrucX ky={ky} />}
                  tickLine={false}
                  axisLine={{ stroke: CHART_COLORS.grid }}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />

                <Tooltip
                  content={<KhungSo loai={loaiDaXem} />}
                  cursor={{ fill: "rgba(13, 97, 228, 0.06)" }}
                />

                <Bar
                  dataKey="soKhachMoi"
                  stackId="khach"
                  fill={CHART_COLORS.khachMoi}
                  name={t("Khách mới")}
                  maxBarSize={36}
                  isAnimationActive={false}
                />

                <Bar
                  dataKey="soKhachQuayLai"
                  stackId="khach"
                  fill={CHART_COLORS.quayLai}
                  name={t("Khách quay lại")}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  isAnimationActive={false}
                />
              </BarChart>
            </KhungBieuDo>
          )}
        </SurfaceCard>
      )}



      {/* ── BẢNG CHI TIẾT THEO KỲ (chỉ các kỳ có đơn) ── */}
      <TableShell
        title={t("Chi tiết theo kỳ")}
        description={!loi && data ? moTaBangKy(ky, loaiDaXem) || undefined : undefined}
        className={mo}
      >
        {dangTaiLanDau ? (
          <LoadingState rows={5} label={t("Đang tải chi tiết khách hàng")} />
        ) : loi ? (
          <ErrorState
            description={loi.moTa || undefined}
            status={loi.status}
            onRetry={fetchData}
          />
        ) : dongBang.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("Không có khách mua trong kỳ")}
            description={t("Hãy chọn kỳ khác hoặc kho khác.")}
          />
        ) : (
          <>
          {/* Điện thoại: mỗi kỳ một thẻ — tên kỳ + so kỳ trước, bốn số như các cột của bảng */}
          <ul className="divide-y divide-bo-border md:hidden">
            {dongBang.map((row) => {
              const tyLe = tyLeQuayLai(row.soKhachQuayLai, row.tongKhachMua);
              return (
                <li key={row.tuNgay} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold text-bo-foreground"><NhanKy row={row} loai={loaiDaXem} /></span>
                    <span className="shrink-0 text-[13px] text-bo-muted">
                      {t("Khách mới so kỳ trước")} <SoKyTruoc giaTri={row.tyLeTangTruong} />
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-4 gap-2 rounded-lg bg-bo-surface-subtle px-2 py-2 text-center">
                    {[
                      [t("Khách mua"), fmt(row.tongKhachMua), "font-semibold text-bo-foreground"],
                      [t("Khách mới"), fmt(row.soKhachMoi), "font-semibold text-bo-primary"],
                      [t("Quay lại"), fmt(row.soKhachQuayLai), "text-bo-foreground"],
                      [t("Tỷ lệ QL"), tyLe != null ? `${tyLe}%` : "—", "text-bo-muted"],
                    ].map(([nhan, so, kieu]) => (
                      <div key={nhan} className="min-w-0">
                        <dt className="truncate text-[11px] leading-4 text-bo-muted">{nhan}</dt>
                        <dd className={`text-[15px] leading-6 tabular-nums ${kieu}`}>{so}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
          {/* Máy tính bảng dọc (cảm ứng): 6 cột số vừa khung nên chỉ bỏ bề rộng tối thiểu, không vuốt ngang */}
          <table className="w-full min-w-[760px] text-sm max-md:hidden cam-ung:max-lg:min-w-0">
            <thead>
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className={`${TH_CLASS} text-left`}>{t("Kỳ")}</th>
                <th className={`${TH_CLASS} text-right`}>{t("Khách mua")}</th>
                <th className={`${TH_CLASS} text-right`}>{t("Khách mới")}</th>
                <th className={`${TH_CLASS} text-right`}>{t("Quay lại")}</th>
                <th className={`${TH_CLASS} text-right`}>{t("Tỷ lệ quay lại")}</th>
                <th className={`${TH_CLASS} text-right`}>{t("Khách mới so kỳ trước")}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-bo-border">
              {dongBang.map((row) => {
                const tyLe = tyLeQuayLai(row.soKhachQuayLai, row.tongKhachMua);
                return (
                  <tr
                    key={row.tuNgay}
                    className="transition-colors hover:bg-bo-surface-subtle"
                  >
                    <td className="px-3 py-3.5 font-medium text-bo-foreground">
                      <NhanKy row={row} loai={loaiDaXem} />
                    </td>

                    <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-bo-foreground">
                      {fmt(row.tongKhachMua)}
                    </td>

                    <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-bo-primary">
                      {fmt(row.soKhachMoi)}
                    </td>

                    <td className="px-3 py-3.5 text-right tabular-nums text-bo-foreground">
                      {fmt(row.soKhachQuayLai)}
                    </td>

                    <td className="px-3 py-3.5 text-right tabular-nums text-bo-muted">
                      {tyLe != null ? `${tyLe}%` : "—"}
                    </td>

                    <td className="px-3 py-3.5 text-right">
                      <SoKyTruoc giaTri={row.tyLeTangTruong} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </>
        )}
      </TableShell>



      {/* ── KHÁCH MUA TRONG KỲ (cùng kỳ, kho với số liệu đang hiện; So sánh: tháng đang chọn) ── */}
      {!loi && thamSoDaXem ? (
        <TableShell
          title={t("Khách mua trong kỳ")}
          description={t("Xếp theo doanh thu · bấm một dòng để mở hồ sơ khách")}
          toolbar={
            <ListToolbar
              tabs={
                <StatusTabs
                  label={t("Lọc khách theo nhóm")}
                  tabs={nhomTabs}
                  value={nhom}
                  onChange={doiNhom}
                />
              }
              hasFilter={Boolean(tim.trim())}
              onClear={() => setTim("")}
            >
              <SearchInput
                value={tim}
                onChange={(e) => setTim(e.target.value)}
                onClear={() => setTim("")}
                placeholder={t("Tìm tên, mã, số điện thoại")}
                label={t("Tìm khách mua")}
              />
            </ListToolbar>
          }
          footer={khach && khach.totalElements > 0 ? (
            <TablePagination
              page={trang}
              size={soDong}
              total={khach.totalElements}
              onPageChange={setTrang}
              onSizeChange={doiSoDong}
              totalLabel={t("khách")}
            />
          ) : null}
        >
          {taiKhach && !khach ? (
            <LoadingState rows={5} label={t("Đang tải danh sách khách mua")} />
          ) : loiKhach ? (
            <ErrorState
              description={loiKhach.moTa || undefined}
              status={loiKhach.status}
              onRetry={() => setLanTaiKhach((n) => n + 1)}
            />
          ) : dsKhach.length === 0 ? (
            <EmptyState
              icon={Users}
              title={timGui || nhom !== "tat_ca" ? t("Không có khách khớp bộ lọc") : t("Không có khách mua trong kỳ")}
              description={timGui || nhom !== "tat_ca" ? t("Hãy đổi nhóm hoặc từ khóa tìm kiếm.") : t("Đơn khách lẻ không có trong danh sách này.")}
            />
          ) : (
            <div className={cn(taiKhach && "opacity-60 transition-opacity")}>
              {/* Điện thoại: mỗi khách một thẻ */}
              <ul className="divide-y divide-bo-border md:hidden">
                {dsKhach.map((k) => (
                  <li key={k.id}>
                    <button
                      type="button"
                      onClick={() => moKhach(k.id)}
                      className="flex w-full flex-col gap-1.5 px-4 py-3 text-left hover:bg-bo-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-bo-foreground">{k.ten}</span>
                          <span className="block truncate text-xs text-bo-muted">{[k.ma, k.soDienThoai].filter(Boolean).join(" · ")}</span>
                        </span>
                        <NhanNhom muaLai={k.muaLai} />
                      </span>
                      <span className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="text-bo-muted">{t("{{soDon}} đơn · gần nhất {{muaGanNhat}}", { soDon: fmt(k.soDon), muaGanNhat: ngayVN(k.muaGanNhat), count: k.soDon })}</span>
                        <span className="font-semibold tabular-nums text-bo-foreground">{formatCurrency(k.doanhThu)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <table className="w-full min-w-[760px] text-sm max-md:hidden cam-ung:max-lg:min-w-0">
                <thead>
                  <tr className="border-b border-bo-border bg-bo-surface-subtle">
                    <th className={`${TH_CLASS} text-left`}>{t("Khách hàng")}</th>
                    <th className={`${TH_CLASS} text-left`}>{t("Nhóm")}</th>
                    <th className={`${TH_CLASS} text-right`}>{t("Số đơn")}</th>
                    <th className={`${TH_CLASS} text-right`}>{t("Doanh thu")}</th>
                    <th className={`${TH_CLASS} text-left`}>{t("Lần đầu mua")}</th>
                    <th className={`${TH_CLASS} text-left`}>{t("Mua gần nhất")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bo-border">
                  {dsKhach.map((k) => (
                    <tr
                      key={k.id}
                      tabIndex={0}
                      onClick={() => moKhach(k.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          moKhach(k.id);
                        }
                      }}
                      title={t("Mở hồ sơ khách")}
                      className="cursor-pointer transition-colors hover:bg-bo-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary"
                    >
                      <td className="px-3 py-3">
                        <span className="block font-medium text-bo-foreground">{k.ten}</span>
                        <span className="block text-xs text-bo-muted">{[k.ma, k.soDienThoai].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className="px-3 py-3"><NhanNhom muaLai={k.muaLai} /></td>
                      <td className="px-3 py-3 text-right tabular-nums text-bo-foreground">{fmt(k.soDon)}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-bo-foreground">{formatCurrency(k.doanhThu)}</td>
                      <td className="px-3 py-3 tabular-nums text-bo-foreground">{ngayVN(k.lanDauMua)}</td>
                      <td className="px-3 py-3 tabular-nums text-bo-foreground">{ngayVN(k.muaGanNhat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableShell>
      ) : null}

    </PageContainer>
  );
}
