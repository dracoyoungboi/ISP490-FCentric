import { Fragment, createElement, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpFromLine,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  ListChecks,
  Loader2,
  Package,
  PackageOpen,
  Plus,
  RefreshCw,
  Table2,
} from "lucide-react";
import KhungBieuDo from "@/components/shared/KhungBieuDo";
import { cn } from "@/lib/utils";
import { Card, CardError, LE, MoreLink } from "@/pages/dashboard/admin/tong-quan-moi/ui";
import { MAU2 } from "@/pages/dashboard/admin/tong-quan-moi/mau";
import { formatPhanTram, formatSo, tyLe } from "@/pages/dashboard/admin/tong-quan/tongQuanFormat";
import { gioPhut, nhanNgay, ngayThangNgan, vachTron } from "./soLieuVaiTro";

/* =====================================================================================
   KHUNG GIAO DIỆN CỦA TỔNG QUAN THEO VAI TRÒ (bản 5 – một màu nhấn, đã chốt 17/10/2026)
   - Màu nhấn duy nhất: xanh thương hiệu cho liên kết, nút chính (mỗi màn tối đa 1), mục đang chọn và nét dữ liệu
     (mỗi biểu đồ một chuỗi xanh; chuỗi so sánh xám nét đứt).
   - Đỏ / cam chỉ cho việc có vấn đề và chỉ ở CHỮ hoặc nét mảnh — không nền màu, không ô biểu tượng màu.
   - Biểu tượng xám, không khung. Thẻ trạng thái R8 giữ nguyên (chuẩn chung của hệ thống).
   ===================================================================================== */
export const XANH = "#1677ff";
export const DO = "text-[#b42318]";
export const CAM = "text-[#a34a06]";
export const VIEN = "border-[#eef1f5]";
const MAU_DO = "#d92d20";
const MAU_CAM = "#e08a00";

/* ---------- Bố cục hai cột như Tổng quan quản trị viên (container query theo bề rộng trang) ---------- */
const HANG = "flex flex-col gap-4 @min-[968px]/tq:flex-row @min-[968px]/tq:items-start";
const COT_CHINH = "contents @min-[968px]/tq:flex @min-[968px]/tq:min-w-0 @min-[968px]/tq:flex-[999_1_600px] @min-[968px]/tq:flex-col @min-[968px]/tq:gap-4";
const COT_PHAI = "contents @min-[968px]/tq:flex @min-[968px]/tq:min-w-0 @min-[968px]/tq:flex-[1_1_352px] @min-[968px]/tq:flex-col @min-[968px]/tq:gap-4";
export function BoCuc({ chinh, phai }) {
  return (
    <div className={HANG}>
      <div className={COT_CHINH}>{chinh}</div>
      <div className={COT_PHAI}>{phai}</div>
    </div>
  );
}

export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30";

/* Biểu tượng xám, không khung — chỉ để mắt bắt nhanh loại việc. */
const ICON = {
  nhan: PackageOpen,
  nhat: ListChecks,
  dongGoi: Package,
  xuat: ArrowUpFromLine,
  chuyen: ArrowLeftRight,
  kiemKe: ClipboardCheck,
  duyet: FileCheck2,
};
export function BieuTuong({ icon, className }) {
  return createElement(ICON[icon] ?? ClipboardCheck, { className: cn("size-4 shrink-0 text-[#8792a2]", className), "aria-hidden": true });
}

/* ---------- Nút: hai kiểu (chính xanh / phụ trắng viền xám), ba cỡ ---------- */
const NUT_GOC =
  "inline-flex min-w-0 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 focus-visible:ring-offset-1";
const KIEU_NUT = {
  chinh: "bg-bo-primary text-white hover:bg-bo-primary-hover",
  phu: "border border-[#d5dbe3] bg-white text-bo-foreground hover:border-[#c2cad6] hover:bg-bo-surface-subtle",
};
const CO_NUT = { lon: "h-10 px-4", vua: "h-9 px-4", nho: "h-8 px-3 @max-[520px]:h-9" };

export function Nut({ to, kieu = "phu", co = "nho", className, children, title }) {
  return (
    <Link to={to} title={title} className={cn(NUT_GOC, KIEU_NUT[kieu], CO_NUT[co], className)}>
      {children}
    </Link>
  );
}

/* Dòng phụ "A · B": chỉ xuống dòng ở chỗ dấu "·", không bẻ giữa cụm. */
export function NgatTaiCham({ chu }) {
  const cum = String(chu ?? "").split(" · ");
  return cum.map((c, i) => (
    <Fragment key={`${i}-${c}`}>
      <span className="whitespace-nowrap">
        {c}
        {i < cum.length - 1 ? " ·" : ""}
      </span>
      {i < cum.length - 1 ? " " : ""}
    </Fragment>
  ));
}

/* Hàng có một nút (hoặc chữ) bên phải. Thẻ hẹp: tên một dòng riêng, dòng phụ + nút chung hàng dưới. */
export function HangCoNut({ ten, phu, nut, className }) {
  return (
    <li className={cn(LE, "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t py-3 first:border-t-0 @min-[520px]:gap-y-0", VIEN, className)}>
      <span className="col-span-2 min-w-0 text-sm text-bo-foreground @min-[520px]:col-span-1">{ten}</span>
      <span className="col-start-1 row-start-2 min-w-0 text-xs text-bo-muted">{typeof phu === "string" ? <NgatTaiCham chu={phu} /> : phu}</span>
      <span className="col-start-2 row-start-2 flex justify-end @min-[520px]:row-span-2 @min-[520px]:row-start-1">{nut}</span>
    </li>
  );
}

/* ================= DẢI SỐ (4 chỉ số trong một thẻ, ngăn bằng vạch mảnh) =================
   Mỗi ô: tên · số · mức thay đổi (xanh lá / đỏ, có mũi tên) · một nét nhỏ ở đáy. Ô có danh sách tương ứng thì bấm được. */
export function DaySo({ the, loading, error, onRetry }) {
  if (error) {
    return (
      <section aria-label="Số liệu chính" className="rounded-lg border border-bo-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <CardError onRetry={onRetry} text="Không tải được số liệu chính" />
      </section>
    );
  }
  if (loading) {
    return (
      <section aria-label="Số liệu chính" aria-busy="true" className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="grid grid-cols-2 gap-px bg-[#eef1f5] @min-[880px]/tq:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex h-[132px] flex-col gap-2 bg-white px-5 py-4" aria-hidden="true">
              <span className="h-4 w-24 rounded bg-slate-100" />
              <span className="h-7 w-28 rounded bg-slate-100" />
              <span className="mt-auto h-8 w-full rounded bg-slate-50" />
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (!the?.length) return null;
  return (
    <section aria-label="Số liệu chính" className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className={cn("grid grid-cols-2 gap-px bg-[#eef1f5]", the.length >= 4 ? "@min-[880px]/tq:grid-cols-4" : the.length === 3 ? "@min-[880px]/tq:grid-cols-3" : "")}>
        {the.map((t, i) => (
          // Số ô lẻ: ô cuối rộng hết hàng ở bố cục hai cột để không lộ ô trống
          <OSo key={t.key} {...t} className={the.length % 2 && i === the.length - 1 ? "col-span-2 @min-[880px]/tq:col-span-1" : undefined} />
        ))}
      </div>
    </section>
  );
}

function OSo({ ten, so, donVi, phu, bd, xuHuong, thanh, chia, to, className }) {
  const noiDung = (
    <>
      <span className="text-[13px] leading-5 text-bo-muted">{ten}</span>
      <span className="mt-1 text-2xl font-semibold leading-8 tracking-[-0.02em] text-bo-heading @max-[200px]/so:text-xl">
        <span className="whitespace-nowrap">{so}</span>
        {donVi ? (
          <>
            {donVi === "%" ? null : " "}
            <span className="text-[13px] font-normal tracking-normal text-bo-muted">{donVi}</span>
          </>
        ) : null}
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs leading-5 text-bo-muted">
        {bd ? <BienDong {...bd} /> : null}
        {bd ? <span>{bd.soVoi}</span> : null}
        {!bd && phu ? <span>{phu}</span> : null}
      </span>
      {bd && phu && thanh == null ? <span className="text-xs leading-5 text-bo-muted">{phu}</span> : null}
      <span className="mt-auto block pt-3">
        {xuHuong ? <DuongXuHuong {...xuHuong} ten={ten} /> : null}
        {thanh != null ? <ThanhTyLe phanTram={thanh} phu={bd ? phu : null} /> : null}
        {chia ? <ThanhChia phan={chia} /> : null}
      </span>
    </>
  );
  const lop = cn("@container/so flex min-w-0 flex-col bg-white px-5 py-4 @max-[440px]/tq:px-4", className);
  if (!to) return <div className={lop}>{noiDung}</div>;
  return (
    <Link to={to} className={cn(FOCUS, lop, "transition-colors hover:bg-[#fafbfc]")}>
      {noiDung}
    </Link>
  );
}

/** Mức thay đổi: len null = không đổi (chữ xám, không mũi tên). */
export function BienDong({ chu, len, tot }) {
  if (len == null) return <span className="font-semibold">{chu}</span>;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold", tot ? "text-[#137a3f]" : DO)}>
      <span className="sr-only">{len ? "Tăng" : "Giảm"} </span>
      {len ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />}
      {chu}
    </span>
  );
}

/* Nét xu hướng: một màu xanh, nền rất nhạt; rê chuột hiện số từng kỳ trong ô nổi. */
function DuongXuHuong({ gt, nhan, dinhDang = formatSo, ten }) {
  const [chon, setChon] = useState(null);
  const W = 240;
  const H = 32;
  const n = gt.length;
  const min = Math.min(...gt);
  const max = Math.max(...gt);
  const x = (i) => (i * W) / (n - 1);
  const y = (v) => (max === min ? H / 2 : 4 + (1 - (v - min) / (max - min)) * (H - 8));
  const duong = gt.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const i = chon ?? n - 1;
  const trai = (x(i) / W) * 100;
  const buoc = W / (n - 1);
  return (
    <span className="relative block h-8" onMouseLeave={() => setChon(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-8 w-full"
        role="img"
        aria-label={`${ten}: ${gt.map((v, k) => `${nhan[k]} ${dinhDang(v)}`).join(", ")}`}
      >
        <path d={`${duong} L${W},${H} L0,${H} Z`} fill="rgba(22,119,255,0.06)" />
        <path d={duong} fill="none" stroke={XANH} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {gt.map((_, k) => (
          <rect key={k} x={Math.max(0, x(k) - buoc / 2)} y={0} width={Math.min(W, x(k) + buoc / 2) - Math.max(0, x(k) - buoc / 2)} height={H} fill="transparent" onMouseEnter={() => setChon(k)} />
        ))}
      </svg>
      <span
        className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
        style={{ left: `${trai}%`, top: `${(y(gt[i]) / H) * 100}%`, background: XANH }}
        aria-hidden="true"
      />
      {chon != null ? (
        <span
          className={cn(
            "pointer-events-none absolute bottom-full z-10 mb-1.5 whitespace-nowrap rounded-md border border-bo-border bg-white px-2 py-1 text-[11px] leading-4 text-bo-foreground shadow-md",
            trai < 25 ? "left-0" : trai > 75 ? "right-0" : "-translate-x-1/2",
          )}
          style={trai >= 25 && trai <= 75 ? { left: `${trai}%` } : undefined}
          aria-hidden="true"
        >
          {nhan[chon]}: <b className="font-semibold">{dinhDang(gt[chon])}</b>
        </span>
      ) : null}
    </span>
  );
}

function ThanhTyLe({ phanTram, phu }) {
  const pt = Math.max(0, Math.min(100, phanTram));
  return (
    <span className="block">
      <span className="block h-1.5 overflow-hidden rounded-full bg-[#eceff4]" role="img" aria-label={`${pt}%`}>
        <span className="block h-full rounded-full" style={{ width: `${pt}%`, background: XANH }} />
      </span>
      {phu ? <span className="mt-1.5 block text-xs leading-4 text-bo-muted">{phu}</span> : null}
    </span>
  );
}

/* Thanh chia phần: phần có vấn đề tô cam, phần còn lại xám. Chú thích bằng chữ, không chấm màu. */
function ThanhChia({ phan }) {
  const coSo = phan.filter((p) => p.so > 0);
  return (
    <span className="block">
      <span className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={phan.map((p) => `${p.so} ${p.nhan}`).join(", ")}>
        {coSo.map((p) => (
          <span key={p.nhan} className="block h-full" style={{ flexGrow: p.so, flexBasis: 0, background: p.vanDe ? MAU_CAM : "#cbd5e1" }} />
        ))}
      </span>
      <span className="mt-1.5 flex flex-wrap gap-x-3 text-xs leading-4 text-bo-muted">
        {phan.map((p) => (
          <span key={p.nhan} className={cn("whitespace-nowrap", p.vanDe && p.so > 0 && CAM)}>
            <b className="font-semibold">{formatSo(p.so)}</b> {p.nhan}
          </span>
        ))}
      </span>
    </span>
  );
}

/* ================= CÔNG VIỆC TRONG KHO =================
   Lưới ô ngăn bằng vạch mảnh. Mỗi ô: tên nghiệp vụ · số việc chờ (bấm mở đúng danh sách) · dòng đếm phụ
   (chữ có vấn đề mới đỏ / cam) · nút "+" tạo chứng từ. */
export function LuoiNghiepVu({ tieuDe, scope, the, className, loading, error, onRetry }) {
  return (
    <Card className={className} title={tieuDe} scope={scope} loading={loading} error={error} onRetry={onRetry}>
      <ul className="grid grid-cols-2 gap-px bg-[#eef1f5] @min-[700px]:grid-cols-3">
        {(the ?? []).map((t) => (
          <ONghiepVu key={t.key} {...t} />
        ))}
      </ul>
    </Card>
  );
}

const CHU_CHIP = { tre: DO, chuY: CAM };

function ONghiepVu({ ten, icon, so, nhanSo, to, chip = [], tao }) {
  return (
    <li className="group/nv relative flex min-w-0 flex-col bg-white px-5 py-4 transition-colors hover:bg-[#fafbfc] @max-[440px]:px-4">
      <div className="flex items-center gap-2">
        <BieuTuong icon={icon} />
        <span className="min-w-0 flex-1 text-[13px] font-medium text-bo-foreground">{ten}</span>
        {tao ? (
          <Link
            to={tao.to}
            title={tao.nhan}
            aria-label={tao.nhan}
            className="relative z-[1] -my-1 -mr-1.5 grid size-7 shrink-0 place-items-center rounded-md text-[#8792a2] transition-colors hover:bg-[#eef3fb] hover:text-bo-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 @max-[440px]:hidden"
          >
            <Plus className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      {/* Liên kết phủ cả ô (các liên kết nhỏ bên trong nằm trên lớp phủ) */}
      <Link
        to={to}
        className="mt-2 flex items-baseline gap-2 rounded after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-bo-primary/30"
      >
        <span className={cn("text-2xl font-semibold leading-8 tracking-[-0.02em]", so ? "text-bo-heading" : "text-[#8792a2]")}>{formatSo(so)}</span>
        <span className="min-w-0 text-[13px] leading-5 text-bo-muted">{so ? nhanSo : "Không có việc chờ"}</span>
      </Link>
      {chip.length ? (
        <p className="relative z-[1] mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs leading-5">
          {chip.map((c) => (
            <Link key={c.nhan} to={c.to} className={cn("whitespace-nowrap rounded hover:underline", FOCUS, CHU_CHIP[c.kieu] ?? "text-bo-muted", c.kieu && "font-medium")}>
              {c.nhan}
              {c.so != null ? <b className="ml-1 font-semibold">{formatSo(c.so)}</b> : null}
            </Link>
          ))}
        </p>
      ) : null}
    </li>
  );
}

/* ================= HÀNG ĐỢI "CẦN BẠN XỬ LÝ" =================
   Việc phải tự quyết, gấp lên đầu. Một tín hiệu gấp duy nhất: số màu đỏ. */
export function HangDoiViec({ tieuDe, viec, className, toiDa = 5, loading, error, onRetry }) {
  const [moRong, setMoRong] = useState(false);
  const ds = viec ?? [];
  const hien = moRong ? ds : ds.slice(0, toiDa);
  const soGap = ds.filter((v) => v.gap).reduce((s, v) => s + v.so, 0);
  return (
    <Card
      className={className}
      title={tieuDe}
      scope={soGap ? <span className={cn("text-[13px] font-medium", DO)}>{formatSo(soGap)} việc gấp</span> : null}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      {ds.length === 0 ? (
        <p className={cn(LE, "flex items-center gap-2 py-6 text-sm text-bo-muted")}>
          <CheckCircle2 className="size-4 text-bo-success" aria-hidden="true" /> Không có việc nào đang chờ bạn.
        </p>
      ) : (
        <>
          <ul>
            {hien.map((d) => (
              <li key={d.key} className={cn("border-t first:border-t-0", VIEN)}>
                <Link to={d.to} className={cn(LE, FOCUS, "group flex items-start gap-3 py-3 transition-colors hover:bg-[#fafbfc]")}>
                  <BieuTuong icon={d.loai} className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-bo-foreground">{d.ten}</span>
                    <span className="block text-xs leading-5 text-bo-muted">
                      <NgatTaiCham chu={d.tuoi ? `${d.phu} · ${d.tuoi}` : d.phu} />
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-sm font-semibold tabular-nums", d.gap ? DO : "text-bo-foreground")}>{formatSo(d.so)}</span>
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-[#c2cad6] transition-colors group-hover:text-bo-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {ds.length > toiDa ? (
            <button
              type="button"
              onClick={() => setMoRong((x) => !x)}
              className={cn(LE, FOCUS, "cursor-pointer border-t py-3 text-left text-[13px] font-medium text-bo-primary hover:text-bo-primary-hover", VIEN)}
            >
              {moRong ? "Thu gọn" : `Xem thêm ${ds.length - toiDa} việc`}
            </button>
          ) : null}
        </>
      )}
    </Card>
  );
}

/* ================= NÚT CHỌN KỲ VÀ NÚT BẢNG ================= */
const KY = [7, 14, 30];

export function NutKy({ ky, setKy, ds = KY, nhan = (k) => `${k} ngày` }) {
  return (
    <div role="group" aria-label="Khoảng thời gian" className="flex rounded-md bg-[#f1f4f8] p-0.5">
      {ds.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={k === ky}
          onClick={() => setKy(k)}
          className={cn(
            "h-7 cursor-pointer rounded-[5px] px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
            k === ky ? "bg-white text-bo-foreground shadow-[0_1px_2px_rgba(16,24,40,0.10)]" : "text-bo-muted hover:text-bo-foreground",
          )}
        >
          {nhan(k)}
        </button>
      ))}
    </div>
  );
}

export function NutBang({ bang, setBang }) {
  return (
    <button
      type="button"
      title={bang ? "Xem biểu đồ" : "Xem bảng số liệu"}
      aria-label={bang ? "Xem biểu đồ" : "Xem bảng số liệu"}
      onClick={() => setBang((x) => !x)}
      className={cn(
        "grid size-8 cursor-pointer place-items-center rounded-md text-bo-muted transition-colors hover:bg-[#f1f4f8] hover:text-bo-foreground",
        bang && "bg-[#eef3fb] text-bo-primary",
        FOCUS,
      )}
    >
      {bang ? <BarChart3 className="size-4" aria-hidden="true" /> : <Table2 className="size-4" aria-hidden="true" />}
    </button>
  );
}

/* ================= BIỂU ĐỒ NHẬP / XUẤT =================
   Một chuỗi một màu: chọn "Nhập kho" hoặc "Xuất kho" ở hai ô số đầu thẻ, chọn 7 / 14 / 30 ngày, nút bảng để đọc số.
   Ô nổi khi rê chuột vẫn ghi cả nhập và xuất. */
const CHUOI = [
  { key: "nhap", ten: "Nhập kho" },
  { key: "xuat", ten: "Xuất kho" },
];

export function BieuDoNhapXuat({ du, thoiDiem, className, loading, error, onRetry }) {
  const [ky, setKy] = useState(14);
  const [chuoi, setChuoi] = useState("nhap");
  const [bang, setBang] = useState(false);
  const rows = useMemo(
    () =>
      (du ?? []).slice(-ky).map((d) => {
        const homNay = nhanNgay(d.ngay, thoiDiem) === "Hôm nay";
        return { nhan: ngayThangNgan(d.ngay), ngayDayDu: homNay ? "Hôm nay" : nhanNgay(d.ngay, thoiDiem), homNay, nhap: d.nhap, xuat: d.xuat };
      }),
    [ky, du, thoiDiem],
  );
  const tong = { nhap: rows.reduce((s, r) => s + r.nhap, 0), xuat: rows.reduce((s, r) => s + r.xuat, 0) };
  const buoc = ky === 7 ? 1 : ky === 14 ? 3 : 6;
  const nhanX = rows.filter((_, i) => (rows.length - 1 - i) % buoc === 0).map((r) => r.nhan);
  const vachY = vachTron(Math.max(0, ...rows.map((r) => r[chuoi])));
  const gio = gioPhut(thoiDiem);
  return (
    <Card
      className={className}
      title="Nhập và xuất kho"
      scope="sản phẩm mỗi ngày"
      scopeClassName="@max-[440px]:hidden"
      right={<NutBang bang={bang} setBang={setBang} />}
      bodyClassName={cn(LE, "pb-4 pt-3")}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div role="group" aria-label="Chọn chuỗi số" className="flex gap-6">
          {CHUOI.map((c) => {
            const on = c.key === chuoi;
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => setChuoi(c.key)}
                className={cn(
                  "-mb-px cursor-pointer border-b-2 pb-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
                  on ? "border-bo-primary" : "border-transparent hover:border-[#d5dbe3]",
                )}
              >
                <span className={cn("block text-xs", on ? "font-medium text-bo-foreground" : "text-bo-muted")}>
                  {c.ten} {ky} ngày
                </span>
                <span className={cn("block text-lg font-semibold leading-7", on ? "text-bo-heading" : "text-bo-muted")}>
                  {formatSo(tong[c.key])} <span className="text-[13px] font-normal text-bo-muted">sản phẩm</span>
                </span>
              </button>
            );
          })}
        </div>
        <NutKy ky={ky} setKy={setKy} />
      </div>
      {bang ? (
        <div className="mt-3 max-h-[220px] overflow-y-auto rounded-md border border-[#eef1f5]">
          <table className="w-full text-sm">
            <caption className="sr-only">Nhập và xuất kho theo ngày</caption>
            <thead className="sticky top-0 bg-bo-surface-subtle text-left text-xs text-bo-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Ngày</th>
                <th className="px-3 py-2 text-right font-medium">Nhập</th>
                <th className="px-3 py-2 text-right font-medium">Xuất</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.nhan} className="border-t border-[#eef1f5]">
                  <td className="px-3 py-1.5">{r.homNay ? `Hôm nay (đến ${gio})` : r.ngayDayDu}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatSo(r.nhap)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatSo(r.xuat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : rows.length ? (
        <div className="mt-4 h-[200px] @max-[520px]:h-[180px]" role="figure" aria-label={`${chuoi === "nhap" ? "Nhập kho" : "Xuất kho"} ${ky} ngày qua. Bấm nút bảng để đọc từng ngày.`}>
          <KhungBieuDo>
            <BarChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barCategoryGap={ky === 30 ? "22%" : "38%"} accessibilityLayer>
              <CartesianGrid vertical={false} stroke={MAU2.luoi} />
              <XAxis dataKey="nhan" ticks={nhanX} interval={0} tickLine={false} axisLine={{ stroke: MAU2.truc }} tick={<NhanTrucX cuoi={rows[rows.length - 1].nhan} />} tickMargin={8} />
              <YAxis width={44} domain={[0, vachY[4]]} ticks={vachY} tickLine={false} axisLine={false} tick={{ fill: MAU2.chu, fontSize: 12 }} tickFormatter={(v) => formatSo(v)} />
              <Tooltip cursor={{ fill: "rgba(22,119,255,0.06)" }} isAnimationActive={false} content={<TipNgay chuoi={chuoi} gio={gio} />} />
              <Bar dataKey={chuoi} fill={XANH} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            </BarChart>
          </KhungBieuDo>
        </div>
      ) : null}
    </Card>
  );
}

/* Nhãn trục X: nhãn cuối (sát mép phải) căn phải để không bị cắt chữ. */
export function NhanTrucX({ x, y, payload, cuoi, dinhDang = (v) => v }) {
  return (
    <text x={x} y={y + 12} textAnchor={payload.value === cuoi ? "end" : "middle"} fill={MAU2.chu} fontSize={12}>
      {dinhDang(payload.value)}
    </text>
  );
}

/* Chú giải kèm tổng: một nét mẫu (liền / đứt) + tên + số. */
export function ChuGiai({ mau, ten, so, donVi = "sản phẩm", net = "solid" }) {
  return (
    <p className="min-w-0">
      <span className="flex items-center gap-1.5 text-xs text-bo-muted">
        <i className="inline-block w-4 border-t-2" style={{ borderColor: mau, borderStyle: net }} aria-hidden="true" />
        {ten}
      </span>
      <span className="mt-0.5 block text-lg font-semibold leading-7 text-bo-heading">
        {typeof so === "number" ? formatSo(so) : so} {donVi ? <span className="text-[13px] font-normal text-bo-muted">{donVi}</span> : null}
      </span>
    </p>
  );
}

function TipNgay({ active, payload, chuoi, gio }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="min-w-40 rounded-md border border-bo-border bg-white px-3 py-2.5 text-xs leading-4 shadow-lg">
      <p className="mb-1.5 font-medium text-bo-foreground">{r.homNay ? `Hôm nay (đến ${gio})` : r.ngayDayDu}</p>
      {CHUOI.map((c) => (
        <p key={c.key} className="mt-1 flex items-center gap-2">
          <span className={cn("flex-1", c.key === chuoi ? "text-bo-foreground" : "text-bo-muted")}>{c.ten}</span>
          <b className={cn("text-sm tabular-nums", c.key === chuoi ? "font-semibold text-bo-foreground" : "font-normal text-bo-muted")}>{formatSo(r[c.key])}</b>
        </p>
      ))}
    </div>
  );
}

/* ================= TỒN KHO: 4 MỨC + MÃ CẦN BỔ SUNG =================
   Một thanh mảnh: hết hàng đỏ, sắp hết cam, còn lại xám (bình thường nhạt, dư đậm hơn). Số đọc bằng chữ. */
const MUC = [
  { key: "het", ten: "Hết hàng", mau: MAU_DO, chu: DO, tab: "het-hang" },
  { key: "thieu", ten: "Sắp hết", mau: MAU_CAM, chu: CAM, tab: "thieu-hang" },
  { key: "binhThuong", ten: "Bình thường", mau: "#dfe4ea", tab: "binh-thuong" },
  { key: "du", ten: "Dư hàng", mau: "#a6b0bf", tab: "du-hang" },
];

export function TonKhoKho({ khoId, ton, boSung, className, loading, error, loiTon, onRetry, children }) {
  return (
    <Card
      className={className}
      title="Tồn kho"
      scope={ton ? `${formatSo(ton.soDong)} mã hàng` : null}
      right={<MoreLink to={`/reports/inventory?kho=${khoId}`}>Báo cáo</MoreLink>}
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      {ton ? (
        <div className={cn(LE, "py-4", boSung ? "border-b" : "", VIEN)}>
          <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-[#f1f4f8]" role="img" aria-label={MUC.map((m) => `${m.ten} ${ton[m.key]}`).join(", ")}>
            {MUC.map((m) => (ton[m.key] ? <span key={m.key} className="block h-full" style={{ flexGrow: ton[m.key], flexBasis: 0, background: m.mau }} /> : null))}
          </div>
          <ul className="mt-3 grid grid-cols-4 gap-2">
            {MUC.map((m) => (
              <li key={m.key} className="min-w-0">
                <Link to={`/reports/inventory?kho=${khoId}&tinhTrang=${m.tab}`} className={cn(FOCUS, "group block rounded")}>
                  <span className={cn("block text-lg font-semibold leading-6", m.chu && ton[m.key] ? m.chu : "text-bo-heading")}>{formatSo(ton[m.key])}</span>
                  <span className="block text-xs leading-4 text-bo-muted group-hover:text-bo-foreground group-hover:underline">{m.ten}</span>
                  <span className="sr-only">{formatPhanTram(tyLe(ton[m.key], ton.soDong), 0)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : loiTon ? (
        <p className={cn(LE, "flex items-center justify-between gap-3 border-b py-3 text-[13px] text-bo-muted", VIEN)}>
          Chưa tải được số tồn kho.
          <button type="button" onClick={onRetry} className={cn(FOCUS, "cursor-pointer rounded font-medium text-bo-primary")}>
            Thử lại
          </button>
        </p>
      ) : null}
      {children}
    </Card>
  );
}

/* ================= TẠO NHANH =================
   Một nút chính rộng hết thẻ + các nút phụ viền xám. */
export function ThaoTacNhanh({ tieuDe = "Tạo nhanh", ds, className }) {
  const [chinh, ...phu] = ds;
  return (
    <Card className={className} title={tieuDe} bodyClassName={cn(LE, "flex flex-col gap-2 py-4")}>
      <Nut to={chinh.to} kieu="chinh" co="lon" className="w-full">
        {chinh.ten}
      </Nut>
      {phu.length ? (
        <div className="grid grid-cols-2 gap-2">
          {phu.map((p) => (
            <Nut key={p.to} to={p.to} co="lon" className="w-full">
              {p.ten}
            </Nut>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

/* ================= DÒNG THỜI GIAN (hàng sắp về) =================
   nhom: [{ ten, tre, ds: [{ key, doiTac, ma, sl, ben, tre, to }] }] — nhóm đầu là nhóm cần để ý nhất. */
export function DongThoiGian({ tieuDe, nhom, right, className, loading, error, onRetry, trong }) {
  // Chấm xanh cho nhóm sắp tới gần nhất; nhóm quá hạn đã báo bằng chữ đỏ ở tiêu đề nhóm, chấm giữ xám
  const nhomNoiBat = nhom?.find((g) => !g.tre)?.ten;
  return (
    <Card className={className} title={tieuDe} right={right} bodyClassName={cn(LE, "py-4")} loading={loading} error={error} onRetry={onRetry}>
      {nhom?.length ? (
        <ol className="flex flex-col gap-3.5">
          {nhom.map((g) => (
            <li key={g.ten}>
              <p className={cn("mb-1.5 text-xs font-medium", g.tre ? DO : g.ten === nhomNoiBat ? "text-bo-foreground" : "text-bo-muted")}>{g.ten}</p>
              <ol className="relative ml-[3px] border-l border-[#e4e8ee] pl-4">
                {g.ds.map((m) => (
                  <li key={m.key} className="relative pb-2.5 last:pb-0">
                    <span className={cn("absolute -left-[20.5px] top-[7px] size-2 rounded-full ring-2 ring-white", g.ten === nhomNoiBat ? "bg-bo-primary" : "bg-[#c2cad6]")} aria-hidden="true" />
                    <Link to={m.to} className={cn(FOCUS, "flex items-start gap-3 rounded-md")}>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-bo-foreground">{m.doiTac}</span>
                        <span className="block text-xs text-bo-muted">
                          {m.ma} · {m.sl}
                        </span>
                      </span>
                      {m.ben ? <span className={cn("shrink-0 text-xs tabular-nums", m.tre ? cn(DO, "font-medium") : "text-bo-muted")}>{m.ben}</span> : null}
                    </Link>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-2 text-sm text-bo-muted">{trong}</p>
      )}
    </Card>
  );
}

/* ================= CHÂN TRANG: giờ số liệu + tải lại ================= */
export function ChanTrang({ thoiDiem, onReload, dangTai }) {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-1.5 pb-2 text-xs text-bo-muted">
      {thoiDiem ? <span>Số liệu lúc {gioPhut(thoiDiem)} · tự cập nhật mỗi phút</span> : null}
      <button
        type="button"
        onClick={onReload}
        disabled={dangTai}
        className={cn(FOCUS, "inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 font-medium text-bo-primary hover:bg-[#eef3fb] disabled:cursor-default disabled:opacity-60")}
      >
        {dangTai ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
        {dangTai ? "Đang tải…" : "Tải lại"}
      </button>
    </footer>
  );
}
