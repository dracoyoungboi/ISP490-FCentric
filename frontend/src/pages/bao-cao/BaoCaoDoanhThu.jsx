import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Check, ChevronDown, Download, LineChart as LineChartIcon, RefreshCcw, TrendingUp } from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import KhungBieuDo from "@/components/shared/KhungBieuDo";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, LE } from "@/pages/dashboard/admin/tong-quan-moi/ui";
import { FOCUS, MENU } from "@/pages/dashboard/admin/tong-quan-moi/boLoc";
import { MAU2 } from "@/pages/dashboard/admin/tong-quan-moi/mau";
import { parseRoles } from "@/components/settings/settings.config";
import { laKhoAo } from "@/pages/warehouse/loaiKho";
import { khoService, getMineKhoList } from "@/services/khoService";
import { baoCaoDoanhThuService } from "@/services/baoCaoDoanhThuService";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { formatAxisMoney, formatCurrency, formatNumber, formatPercent } from "@/utils/formatters";
import KhoiTienThu from "./KhoiTienThu";
import {
  CHI_SO,
  LOAI_KY,
  MOC_NGAY,
  SO_NAM,
  bienLai,
  dongBang,
  duLieuBieuDo,
  khoangMoc,
  loiKhoangNgay,
  ngayMay,
  ngayVN,
  soGon,
  tenTepExcel,
  thamSo,
  tyLeTang,
} from "./tinhBaoCaoDoanhThu";

/*
 * Báo cáo doanh thu (bố cục Kiểu 3 như màn Tổng quan, phương án A chốt 27/10/2026):
 * - Dải đầu trang: ô phạm vi (kho, kỳ, giờ số liệu) và 4 chỉ số của kỳ so với cùng kỳ năm trước; chọn chỉ số thì biểu đồ đổi.
 * - Biểu đồ chỉ số theo kỳ (cột / đường), cùng kỳ năm trước là nét đứt xám; bên phải thẻ Tiền thu trong kỳ.
 * - Bảng chi tiết theo kỳ (mới nhất trước), điện thoại thành danh sách.
 * - Xuất Excel do máy chủ dựng (cùng số với màn).
 * Doanh thu tính theo ngày giao hàng, tiền thu theo ngày thu tiền. Kỳ đang chạy so với đúng phần đã qua của cùng kỳ năm trước.
 */

const MUC = "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] text-slate-700 focus:bg-bo-surface-subtle focus:text-bo-foreground";
const NUT_KY = cn(FOCUS, "inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-1 rounded-md border border-bo-border bg-white px-2 text-sm font-medium text-bo-foreground shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-bo-surface-subtle");
const O_NGAY = "h-[30px] min-w-0 rounded-md border border-bo-border bg-white px-2 text-sm text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15";

function Menu({ nhan, ariaLabel, children, rong = "w-60", align = "start", icon = false, className }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={ariaLabel} className={className ?? NUT_KY}>
          {icon ? <CalendarDays className="size-4 text-bo-muted" aria-hidden="true" /> : null}
          <span className="truncate">{nhan}</span>
          <ChevronDown className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} sideOffset={6} className={cn(MENU, rong)}>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function Muc({ chon, onChon, ten, phu }) {
  return (
    <DropdownMenuItem onClick={onChon} className={MUC}>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate", chon ? "font-medium text-bo-primary-hover" : "text-bo-foreground")}>{ten}</span>
        {phu ? <span className="block text-xs text-bo-muted">{phu}</span> : null}
      </span>
      {chon ? <Check className="size-4 shrink-0 text-bo-primary" aria-hidden="true" /> : <span className="size-4 shrink-0" />}
    </DropdownMenuItem>
  );
}

/** "▲ 12,8%" xanh / "▼ 3,1%" đỏ. tyLe null: không có số cùng kỳ. */
function SoVoi({ tyLe, sau = "so với cùng kỳ" }) {
  if (tyLe == null) return <span className="text-bo-muted">Chưa có số cùng kỳ</span>;
  const tang = tyLe >= 0;
  return (
    <span className="whitespace-nowrap">
      <span className={cn("font-medium", tang ? "text-bo-success" : "text-bo-danger")}>
        <span aria-hidden="true">{tang ? "▲" : "▼"}</span>
        <span className="sr-only">{tang ? "Tăng" : "Giảm"}</span> {formatPercent(Math.abs(tyLe))}
      </span>
      {sau ? <span className="text-bo-muted"> {sau}</span> : null}
    </span>
  );
}

function BienLai({ a, b }) {
  const nay = bienLai(a?.loiNhuan, a?.doanhThu);
  const truoc = bienLai(b?.loiNhuan, b?.doanhThu);
  const diem = nay != null && truoc != null ? (nay - truoc) * 100 : null;
  return (
    <span className="whitespace-nowrap">
      <span className="text-bo-muted">Biên lãi {nay == null ? "—" : formatPercent(nay)}</span>
      {diem == null ? null : (
        <span className={cn("font-medium", diem >= 0 ? "text-bo-success" : "text-bo-danger")}>
          {" · "}<span aria-hidden="true">{diem >= 0 ? "▲" : "▼"}</span>
          <span className="sr-only">{diem >= 0 ? "tăng" : "giảm"}</span> {Math.abs(diem).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} điểm
        </span>
      )}
    </span>
  );
}

/**
 * Hai ô ngày của khoảng tùy chọn: giữ bản nhập riêng, chỉ đưa lên bộ lọc khi hợp lệ (năm gõ dở như 0002, quá 1 năm, sau
 * hôm nay thì báo dưới ô, không gọi máy chủ).
 */
function KhoangTuyChon({ khoang, onDoi }) {
  const [nhap, setNhap] = useState(khoang);
  const loi = loiKhoangNgay(nhap.tuNgay, nhap.denNgay);
  const homNay = ngayMay(new Date());
  const doi = (x) => {
    const moi = { ...nhap, ...x };
    setNhap(moi);
    if (!loiKhoangNgay(moi.tuNgay, moi.denNgay)) onDoi(moi);
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <label className="sr-only" htmlFor="bc-tu-ngay">Từ ngày</label>
        <input aria-describedby={loi ? "bc-loi-ngay" : undefined} aria-invalid={loi ? true : undefined} className={O_NGAY} id="bc-tu-ngay" max={nhap.denNgay || homNay} min="2000-01-01" onChange={(e) => doi({ tuNgay: e.target.value })} type="date" value={nhap.tuNgay} />
        <span className="text-bo-muted" aria-hidden="true">–</span>
        <label className="sr-only" htmlFor="bc-den-ngay">Đến ngày</label>
        <input aria-describedby={loi ? "bc-loi-ngay" : undefined} aria-invalid={loi ? true : undefined} className={O_NGAY} id="bc-den-ngay" max={homNay} min={nhap.tuNgay || "2000-01-01"} onChange={(e) => doi({ denNgay: e.target.value })} type="date" value={nhap.denNgay} />
      </div>
      {loi ? <p className="text-xs text-bo-danger" id="bc-loi-ngay" role="alert">{loi}</p> : null}
    </div>
  );
}

/** Dải đầu trang: ô phạm vi bên trái, 4 chỉ số (chọn được) bên phải — cùng bố cục với Tổng quan. */
function DauTrang({ boLoc, setBoLoc, dsKho, data, loading, gio, onTaiLai, chiSo, setChiSo }) {
  const tenKho = boLoc.khoId ? dsKho.find((k) => String(k.id) === String(boLoc.khoId))?.tenKho ?? "Kho đã chọn" : "Tất cả kho";
  const homNay = new Date();
  const namHienTai = homNay.getFullYear();
  const nhanLoai = LOAI_KY.find((x) => x.value === boLoc.loai)?.label;
  const nhanMoc = boLoc.loai === "ngay"
    ? MOC_NGAY.find((x) => x.value === boLoc.moc)?.label
    : boLoc.loai === "nam" ? `${boLoc.soNam} năm gần nhất` : `Năm ${boLoc.nam}`;
  const a = data?.kyNay;
  const b = data?.cungKy;
  const o = [
    { ...CHI_SO[0], gt: a?.doanhThu, phu: <SoVoi tyLe={tyLeTang(a?.doanhThu, b?.doanhThu)} /> },
    { ...CHI_SO[1], gt: a?.loiNhuan, phu: <BienLai a={a} b={b} /> },
    { ...CHI_SO[2], gt: a?.giaVon, phu: <span className="text-bo-muted">{a && Number(a.doanhThu) ? `${formatPercent(Number(a.giaVon) / Number(a.doanhThu))} doanh thu` : "—"}</span> },
    { ...CHI_SO[3], gt: a?.soDon, phu: <span className="text-bo-muted">{a && Number(a.soDon) ? `TB ${formatCurrency(Number(a.doanhThu) / Number(a.soDon))} / đơn` : "—"}</span> },
  ];
  return (
    <div className="@container/dau">
      <section aria-label="Phạm vi và kết quả của kỳ" className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)] @min-[980px]/dau:flex-row">
        <div className="flex min-w-0 flex-col gap-2 border-b border-bo-border bg-bo-surface-subtle px-4 py-3 @min-[980px]/dau:w-[300px] @min-[980px]/dau:shrink-0 @min-[980px]/dau:justify-center @min-[980px]/dau:border-b-0 @min-[980px]/dau:border-r @min-[980px]/dau:px-5">
          <Menu ariaLabel={`Chọn kho, đang xem: ${tenKho}`} className={cn(FOCUS, "inline-flex max-w-full cursor-pointer items-center gap-1.5 self-start rounded text-base font-semibold leading-6 text-bo-foreground hover:text-bo-primary-hover")} nhan={tenKho} rong="w-72">
            <Muc chon={!boLoc.khoId} onChon={() => setBoLoc({ khoId: "" })} phu={dsKho.length ? `${dsKho.length} kho` : null} ten="Tất cả kho" />
            {dsKho.map((k) => <Muc key={k.id} chon={String(boLoc.khoId) === String(k.id)} onChon={() => setBoLoc({ khoId: String(k.id) })} ten={k.tenKho} />)}
          </Menu>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Menu ariaLabel={`Chọn cách xem, đang xem: ${nhanLoai}`} icon nhan={nhanLoai}>
              {LOAI_KY.map((x) => <Muc key={x.value} chon={boLoc.loai === x.value} onChon={() => setBoLoc({ loai: x.value })} ten={x.label} />)}
            </Menu>
            <Menu ariaLabel={`Chọn kỳ, đang xem: ${nhanMoc}`} nhan={nhanMoc}>
              {boLoc.loai === "ngay" ? MOC_NGAY.map((x) => {
                const k = x.value === "tuy-chon" ? null : khoangMoc(x.value, homNay);
                return (
                  <Muc key={x.value} chon={boLoc.moc === x.value} onChon={() => setBoLoc({ moc: x.value, khoang: khoangMoc(x.value, homNay, boLoc.khoang) })}
                    phu={k ? `${ngayVN(k.tuNgay)} – ${ngayVN(k.denNgay)}` : null} ten={x.label} />
                );
              }) : boLoc.loai === "nam" ? SO_NAM.map((n) => (
                <Muc key={n} chon={boLoc.soNam === n} onChon={() => setBoLoc({ soNam: n })} phu={`${namHienTai - n + 1} – ${namHienTai}`} ten={`${n} năm gần nhất`} />
              )) : Array.from({ length: 6 }, (_, i) => namHienTai - i).map((y) => (
                <Muc key={y} chon={boLoc.nam === y} onChon={() => setBoLoc({ nam: y })} ten={`Năm ${y}`} />
              ))}
            </Menu>
          </div>
          {boLoc.loai === "ngay" && boLoc.moc === "tuy-chon" ? (
            <KhoangTuyChon khoang={boLoc.khoang} onDoi={(k) => setBoLoc({ khoang: k })} />
          ) : null}
          <span className="text-xs text-bo-muted">
            {data ? `${ngayVN(data.tuNgay)} – ${ngayVN(data.denNgay)}` : " "}
            {gio ? ` · lúc ${gio} · ` : " · "}
            <button className={cn(FOCUS, "inline-flex cursor-pointer items-center gap-1 rounded font-medium text-bo-primary hover:underline")} onClick={onTaiLai} type="button">
              <RefreshCcw className={cn("size-3", loading && "animate-spin")} aria-hidden="true" />Cập nhật
            </button>
          </span>
        </div>
        <div role="tablist" aria-label="Chỉ số của kỳ, chọn để xem trên biểu đồ" className="grid min-w-0 flex-1 grid-cols-2 @min-[640px]/dau:grid-cols-4">
          {o.map((c, i) => {
            const on = chiSo === c.ma;
            const so = c.tien ? soGon(c.gt) : { so: formatNumber(Number(c.gt) || 0), donVi: "đơn" };
            return (
              <button
                key={c.ma}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="bc-bieu-do"
                onClick={() => setChiSo(c.ma)}
                className={cn(
                  FOCUS,
                  "flex min-w-0 cursor-pointer flex-col gap-0.5 border-b-2 px-4 py-3 text-left transition-colors @min-[640px]/dau:px-5",
                  i % 2 === 1 && "border-l border-l-[#eef1f5]",
                  i >= 2 && "border-t border-t-[#eef1f5] @min-[640px]/dau:border-t-0 @min-[640px]/dau:border-l @min-[640px]/dau:border-l-[#eef1f5]",
                  on ? "border-b-bo-primary bg-[#f5f9ff]" : "border-b-transparent hover:bg-bo-surface-subtle",
                )}
              >
                <span className={cn("truncate text-sm", on ? "font-medium text-bo-foreground" : "text-bo-muted")}>{c.ten}</span>
                {loading && !data ? (
                  <span className="flex flex-col gap-1.5 py-1" aria-hidden="true">
                    <Skeleton className="h-6 w-3/4 bg-slate-100" />
                    <Skeleton className="h-3 w-1/2 bg-slate-100" />
                  </span>
                ) : (
                  <>
                    <span className="truncate whitespace-nowrap text-xl font-bold leading-7 tracking-[-0.025em] text-bo-foreground @min-[800px]/dau:text-2xl @min-[800px]/dau:leading-8">
                      {data ? so.so : "—"}<span className="ml-1 text-sm font-medium tracking-normal text-bo-muted">{data ? so.donVi : ""}</span>
                    </span>
                    <span className="min-h-4 truncate text-xs">{data ? c.phu : null}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TipBieuDo({ active, payload, fmt, coTruoc }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (d.nay == null) {
    return (
      <div className="min-w-[180px] rounded-lg border border-bo-border bg-bo-surface p-3 text-xs shadow-sm">
        <p className="font-semibold text-bo-foreground">{d.nhanDay}</p>
        <p className="mt-1 text-bo-muted">Chưa tới kỳ này</p>
      </div>
    );
  }
  const tang = coTruoc ? tyLeTang(d.nay, d.truoc) : null;
  return (
    <div className="min-w-[180px] rounded-lg border border-bo-border bg-bo-surface p-3 text-xs shadow-sm">
      <p className="mb-2 font-semibold text-bo-foreground">{d.nhanDay}</p>
      <p className="flex justify-between gap-4"><span className="text-bo-muted">Kỳ này</span><b className="tabular-nums text-bo-foreground">{fmt(d.nay)}</b></p>
      {coTruoc ? <p className="mt-1 flex justify-between gap-4"><span className="text-bo-muted">Cùng kỳ năm trước</span><span className="tabular-nums">{fmt(d.truoc)}</span></p> : null}
      {tang != null ? <p className="mt-1.5"><SoVoi sau="" tyLe={tang} /></p> : null}
    </div>
  );
}

const KIEU = [
  { value: "cot", ten: "Biểu đồ cột", icon: BarChart3 },
  { value: "duong", ten: "Biểu đồ đường", icon: LineChartIcon },
];

function TheBieuDo({ data, chiSo, loading, loi, onTaiLai, className }) {
  const [kieu, setKieu] = useState("cot");
  const cs = CHI_SO.find((c) => c.ma === chiSo);
  const rows = useMemo(() => duLieuBieuDo(data, chiSo), [data, chiSo]);
  const coTruoc = data?.loai !== "nam";
  const trong = !rows.some((r) => r.nay || r.truoc);
  const fmt = cs.tien ? formatCurrency : (v) => `${formatNumber(v)} đơn`;
  const moiKy = data?.loai === "ngay" ? "ngày" : data?.loai === "nam" ? "năm" : "tháng";
  // Nhiều ngày: thưa nhãn trục để không chồng chữ; luôn có nhãn kỳ cuối, bỏ nhãn liền trước nếu quá sát
  const buoc = rows.length > 12 ? Math.ceil(rows.length / 6) : 1;
  const viTri = rows.map((_, i) => i).filter((i) => i % buoc === 0);
  const cuoi = rows.length - 1;
  if (cuoi >= 0 && viTri[viTri.length - 1] !== cuoi) {
    if (cuoi - viTri[viTri.length - 1] < buoc / 2) viTri.pop();
    viTri.push(cuoi);
  }
  const nhanX = viTri.map((i) => rows[i].nhan);
  return (
    <Card
      bodyClassName={cn(LE, "pb-4 pt-3.5")}
      className={className}
      error={Boolean(loi)}
      id="bc-bieu-do"
      loading={loading && !data}
      onRetry={onTaiLai}
      right={trong ? null : (
        <div role="group" aria-label="Cách xem" className="inline-flex rounded-md bg-slate-100 p-0.5">
          {KIEU.map((x) => {
            const Icon = x.icon;
            const on = kieu === x.value;
            return (
              <button key={x.value} type="button" aria-pressed={on} aria-label={x.ten} title={x.ten} onClick={() => setKieu(x.value)}
                className={cn("grid h-6 w-7 cursor-pointer place-items-center rounded text-bo-muted hover:text-bo-foreground", FOCUS, on && "bg-bo-surface text-bo-primary shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:text-bo-primary")}>
                <Icon className="size-4" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
      scope={cs.tien ? "đồng" : "đơn"}
      title={`${cs.ten} theo ${moiKy}`}
    >
      {trong ? (
        <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-center text-[13px] text-bo-muted">
          <TrendingUp className="size-5 text-slate-400" aria-hidden="true" />
          Chưa có đơn đã giao trong kỳ này và cùng kỳ năm trước.
        </div>
      ) : (
        <>
          <div className="mb-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs leading-4 text-bo-muted">
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              {kieu === "cot" ? <i className="inline-block size-2.5 rounded-[2px] bg-bo-primary" aria-hidden="true" /> : <i className="inline-block w-4 border-t-2 border-bo-primary" aria-hidden="true" />}
              <b className="font-medium text-bo-foreground">Kỳ này</b>
            </span>
            {coTruoc ? (
              <span className="inline-flex flex-wrap items-center gap-x-2">
                <i className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: MAU2.kyTruoc }} aria-hidden="true" />
                <b className="font-medium text-bo-foreground">Cùng kỳ năm trước</b>
                {data ? <span className="whitespace-nowrap">{`${ngayVN(data.tuNgayCungKy)} – ${ngayVN(data.denNgayCungKy)}`}</span> : null}
              </span>
            ) : null}
          </div>
          <div className="h-[260px] @max-[520px]:h-[200px]" role="figure" aria-label={`${cs.ten} theo ${moiKy}${coTruoc ? ", so với cùng kỳ năm trước" : ""}. Số từng ${moiKy} có ở bảng Chi tiết bên dưới.`}>
            <KhungBieuDo>
              <ComposedChart accessibilityLayer barCategoryGap="30%" data={rows} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={MAU2.luoi} vertical={false} />
                <XAxis axisLine={{ stroke: MAU2.truc }} dataKey="nhan" interval={0} tick={{ fill: MAU2.chu, fontSize: 12 }} tickLine={false} tickMargin={8} ticks={nhanX} />
                <YAxis axisLine={false} tick={{ fill: MAU2.chu, fontSize: 12 }} tickFormatter={cs.tien ? formatAxisMoney : (v) => formatNumber(v)} tickLine={false} width={44} />
                <Tooltip content={<TipBieuDo coTruoc={coTruoc} fmt={fmt} />} cursor={kieu === "cot" ? { fill: "rgba(22, 119, 255, 0.06)" } : { stroke: MAU2.truc, strokeWidth: 1 }} isAnimationActive={false} wrapperStyle={{ outline: "none", zIndex: 10 }} />
                {kieu === "duong" ? (
                  <Area activeDot={false} dataKey="nay" fill={MAU2.nenVung} fillOpacity={1} isAnimationActive={false} stroke="none" type="linear" />
                ) : (
                  <Bar dataKey="nay" fill={MAU2.chinh} isAnimationActive={false} maxBarSize={28} radius={[3, 3, 0, 0]} />
                )}
                {coTruoc ? (
                  <Line activeDot={{ r: 5, fill: MAU2.kyTruoc, stroke: "#fff", strokeWidth: 2 }} dataKey="truoc" dot={false} isAnimationActive={false} stroke={MAU2.kyTruoc} strokeDasharray="5 4" strokeWidth={2} type="linear" />
                ) : null}
                {kieu === "duong" ? (
                  <Line activeDot={{ r: 5, fill: MAU2.chinh, stroke: "#fff", strokeWidth: 2 }} dataKey="nay" dot={false} isAnimationActive={false} stroke={MAU2.chinh} strokeLinejoin="round" strokeWidth={2} type="linear" />
                ) : null}
              </ComposedChart>
            </KhungBieuDo>
          </div>
        </>
      )}
    </Card>
  );
}

const TH = "h-10 whitespace-nowrap px-3 text-right text-xs font-semibold text-bo-muted";
const TD = "whitespace-nowrap px-3 py-2.5 text-right tabular-nums";

function TangGiam({ tyLe }) {
  if (tyLe == null) return <span className="text-bo-muted">—</span>;
  return <span className={tyLe >= 0 ? "text-bo-success" : "text-bo-danger"}>{tyLe >= 0 ? "+" : "−"}{formatPercent(Math.abs(tyLe))}</span>;
}

function BangChiTiet({ data, tienThu, loading, loi, onTaiLai }) {
  const rows = useMemo(() => dongBang(data, tienThu), [data, tienThu]);
  const coThu = Boolean(tienThu);
  const a = data?.kyNay;
  const b = data?.cungKy;
  const tenKy = data?.loai === "ngay" ? "Ngày" : data?.loai === "nam" ? "Năm" : "Tháng";
  const bienCaKy = bienLai(a?.loiNhuan, a?.doanhThu);
  return (
    <Card
      empty={!loading && !loi && Boolean(data) && rows.length === 0}
      emptyIcon={TrendingUp}
      emptyText="Kỳ này chưa có đơn đã giao hay khoản thu nào."
      error={Boolean(loi)}
      loading={loading && !data}
      onRetry={onTaiLai}
      right={<span className="hidden text-xs text-bo-muted @min-[720px]:inline">Doanh thu theo ngày giao hàng · tiền thu theo ngày thu</span>}
      scope={data ? `${rows.length} ${tenKy.toLowerCase()} có số liệu` : null}
      title={`Chi tiết theo ${tenKy.toLowerCase()}`}
    >
      {/* Máy tính, máy tính bảng: bảng cuộn ngang trong khung */}
      <div className="hidden overflow-x-auto @min-[640px]:block">
        <table className="w-full min-w-[1060px] border-collapse text-sm tabular-nums">
          <thead>
            <tr className="border-b border-bo-border bg-bo-surface-subtle">
              <th scope="col" className={cn(TH, "pl-5 text-left")}>{tenKy}</th>
              <th scope="col" className={TH}>Doanh thu</th>
              <th scope="col" className={TH}>Cùng kỳ năm trước</th>
              <th scope="col" className={TH}>Tăng / giảm</th>
              <th scope="col" className={TH}>Giá vốn</th>
              <th scope="col" className={TH}>Lợi nhuận gộp</th>
              <th scope="col" className={TH}>Biên lãi</th>
              <th scope="col" className={TH}>Đơn</th>
              {coThu ? <th scope="col" className={cn(TH, "border-l border-bo-border")}>Tiền mặt</th> : null}
              {coThu ? <th scope="col" className={TH}>Chuyển khoản</th> : null}
              {coThu ? <th scope="col" className={cn(TH, "pr-5")}>Hoàn</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.khoa} className="border-b border-[#eef1f5] hover:bg-bo-surface-subtle">
                <th scope="row" className="whitespace-nowrap py-2.5 pl-5 pr-3 text-left font-medium text-bo-foreground">{r.ten}</th>
                <td className={cn(TD, "font-semibold text-bo-foreground")}>{formatCurrency(r.doanhThu)}</td>
                <td className={cn(TD, "text-slate-600")}>{formatCurrency(r.doanhThuCungKy)}</td>
                <td className={TD}><TangGiam tyLe={r.tang} /></td>
                <td className={cn(TD, "text-slate-600")}>{formatCurrency(r.giaVon)}</td>
                <td className={TD}>{formatCurrency(r.loiNhuan)}</td>
                <td className={TD}>{r.bien == null ? <span className="text-bo-muted">—</span> : formatPercent(r.bien)}</td>
                <td className={cn(TD, "text-slate-600")}>{formatNumber(r.soDon)}</td>
                {coThu ? <td className={cn(TD, "border-l border-bo-border")}>{formatCurrency(r.tienMat)}</td> : null}
                {coThu ? <td className={TD}>{formatCurrency(r.chuyenKhoan)}</td> : null}
                {coThu ? <td className={cn(TD, "pr-5 text-slate-600")}>{r.hoan ? `−${formatCurrency(r.hoan)}` : formatCurrency(0)}</td> : null}
              </tr>
            ))}
          </tbody>
          {a ? (
            <tfoot>
              <tr className="bg-bo-surface-subtle font-bold text-bo-foreground">
                <th scope="row" className="py-3 pl-5 pr-3 text-left">Cả kỳ</th>
                <td className={TD}>{formatCurrency(a.doanhThu)}</td>
                <td className={TD}>{formatCurrency(b?.doanhThu)}</td>
                <td className={TD}><TangGiam tyLe={tyLeTang(a.doanhThu, b?.doanhThu)} /></td>
                <td className={TD}>{formatCurrency(a.giaVon)}</td>
                <td className={TD}>{formatCurrency(a.loiNhuan)}</td>
                <td className={TD}>{bienCaKy == null ? "—" : formatPercent(bienCaKy)}</td>
                <td className={TD}>{formatNumber(a.soDon)}</td>
                {coThu ? <td className={cn(TD, "border-l border-bo-border")}>{formatCurrency(tienThu.tienMat)}</td> : null}
                {coThu ? <td className={TD}>{formatCurrency(tienThu.chuyenKhoan)}</td> : null}
                {coThu ? <td className={cn(TD, "pr-5")}>{Number(tienThu.hoan) ? `−${formatCurrency(tienThu.hoan)}` : formatCurrency(0)}</td> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {/* Điện thoại: mỗi kỳ một dòng */}
      <ul className="m-0 list-none p-0 @min-[640px]:hidden">
        {rows.map((r) => (
          <li key={r.khoa} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 border-b border-[#eef1f5] px-4 py-3 text-sm">
            <b className="font-semibold">{r.ten}</b>
            <b className="text-right font-semibold tabular-nums">{formatCurrency(r.doanhThu)}</b>
            <span className="text-xs text-bo-muted">{formatNumber(r.soDon)} đơn · biên lãi {r.bien == null ? "—" : formatPercent(r.bien)}</span>
            <span className="text-right text-xs"><TangGiam tyLe={r.tang} /></span>
            {coThu ? <span className="col-span-2 text-xs text-slate-600">Thu: tiền mặt {formatCurrency(r.tienMat)} · CK {formatCurrency(r.chuyenKhoan)}{r.hoan ? ` · hoàn −${formatCurrency(r.hoan)}` : ""}</span> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

const loiCua = (e) => e?.response?.data?.message || e?.message || "";

export default function BaoCaoDoanhThu() {
  const laQtv = parseRoles(localStorage.getItem("role")).includes("quan_tri_vien");
  const [boLoc, datBoLoc] = useState(() => ({
    loai: "thang",
    nam: new Date().getFullYear(),
    moc: "30",
    khoang: khoangMoc("30"),
    soNam: 5,
    khoId: "",
  }));
  const setBoLoc = useCallback((x) => datBoLoc((cu) => ({ ...cu, ...x })), []);
  const [chiSo, setChiSo] = useState("doanhThu");
  const [dsKho, setDsKho] = useState([]);
  const [tongHop, setTongHop] = useState({ data: null, loading: true, loi: null, gio: null });
  const [tienThu, setTienThu] = useState({ data: null, loading: true, loi: null });
  const [lan, setLan] = useState(0);
  const [dangXuat, setDangXuat] = useState(false);

  // Kho cho bộ lọc: quản trị viên mọi kho; quản lý kho các kho mình phụ trách. Bỏ kho ảo, kho ngừng hoạt động.
  useEffect(() => {
    let huy = false;
    const tai = laQtv ? khoService.getAllKho().then((body) => body?.data?.content ?? []) : getMineKhoList();
    tai.then((ds) => { if (!huy) setDsKho(ds.filter((k) => !laKhoAo(k) && Number(k.trangThai ?? 1) === 1)); }).catch(() => {});
    return () => { huy = true; };
  }, [laQtv]);

  const ts = useMemo(() => thamSo(boLoc), [boLoc]);

  // Doanh thu và tiền thu tải song song, mỗi khối tự báo đang tải / lỗi (khối này chậm không giữ khối kia)
  useEffect(() => {
    const ctrl = new AbortController();
    queueMicrotask(() => {
      if (ctrl.signal.aborted) return;
      setTongHop((cu) => ({ ...cu, loading: true }));
      setTienThu((cu) => ({ ...cu, loading: true }));
    });
    baoCaoDoanhThuService.tongHop(ts, { signal: ctrl.signal })
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setTongHop({ data: d, loading: false, loi: null, gio: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) });
      })
      .catch((e) => { if (!ctrl.signal.aborted) setTongHop({ data: null, loading: false, loi: loiCua(e) || "Không tải được", gio: null }); });
    baoCaoDoanhThuService.tienThu(ts, { signal: ctrl.signal })
      .then((d) => { if (!ctrl.signal.aborted) setTienThu({ data: d, loading: false, loi: null }); })
      .catch((e) => { if (!ctrl.signal.aborted) setTienThu({ data: null, loading: false, loi: loiCua(e) || "Không tải được" }); });
    return () => ctrl.abort();
  }, [ts, lan]);

  const taiLai = () => setLan((n) => n + 1);

  const xuatExcel = async () => {
    if (dangXuat) return;
    setDangXuat(true);
    try {
      const blob = await baoCaoDoanhThuService.xuatExcel(ts);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = tenTepExcel(ts);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      // Lỗi trả về dạng Blob: đọc ra chữ để báo đúng câu của máy chủ
      let cau = "";
      try { cau = JSON.parse(await e?.response?.data?.text?.())?.message ?? ""; } catch { /* không đọc được */ }
      toast.error(cau || "Không xuất được tệp Excel. Thử lại.");
    } finally {
      setDangXuat(false);
    }
  };

  return (
    <PageContainer className="flex flex-col gap-4">
      <PageHeader
        className="mb-0"
        title="Báo cáo doanh thu"
        actions={(
        <button
          type="button"
          onClick={xuatExcel}
          disabled={dangXuat || !tongHop.data}
          className={cn(FOCUS, "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-bo-input-border bg-bo-surface px-3.5 text-sm font-medium text-bo-foreground shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-bo-surface-subtle disabled:cursor-not-allowed disabled:opacity-60")}
        >
          <Download className="size-4 text-bo-muted" aria-hidden="true" />
          {dangXuat ? "Đang xuất…" : "Xuất Excel"}
        </button>
        )}
      />

      <DauTrang
        boLoc={boLoc}
        chiSo={chiSo}
        data={tongHop.data}
        dsKho={dsKho}
        gio={tongHop.gio}
        loading={tongHop.loading || tienThu.loading}
        onTaiLai={taiLai}
        setBoLoc={setBoLoc}
        setChiSo={setChiSo}
      />
      {tongHop.loi ? (
        <p role="alert" className="m-0 rounded-lg border border-red-200 bg-bo-danger-soft px-4 py-2.5 text-sm text-red-800">
          Không tải được doanh thu: {tongHop.loi}
        </p>
      ) : null}
      {tongHop.data?.theoKhoPhuTrach ? <p className="-mt-2 mb-0 text-xs text-bo-muted">Chỉ tính các cửa hàng bạn phụ trách.</p> : null}

      <div className="flex flex-wrap items-stretch gap-4">
        <TheBieuDo chiSo={chiSo} className="min-w-0 flex-[999_1_560px]" data={tongHop.data} loading={tongHop.loading} loi={tongHop.loi} onTaiLai={taiLai} />
        <KhoiTienThu
          className="min-w-0 flex-[1_1_340px] xl:max-w-[420px]"
          khoId={boLoc.khoId || undefined}
          loading={tienThu.loading}
          loi={tienThu.loi}
          onTaiLai={taiLai}
          tienThu={tienThu.data}
        />
      </div>

      <BangChiTiet data={tongHop.data} loading={tongHop.loading} loi={tongHop.loi} onTaiLai={taiLai} tienThu={tienThu.data} />
    </PageContainer>
  );
}
