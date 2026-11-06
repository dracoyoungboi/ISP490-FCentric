import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeftRight, RefreshCcw, Shirt, X } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Tooltip, XAxis, YAxis } from "recharts";
import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import KhungBieuDo from "@/components/shared/KhungBieuDo";
import NutXuatExcel from "@/components/shared/NutXuatExcel";
import TablePagination from "@/components/shared/TablePagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, LE, MoreLink } from "@/pages/dashboard/admin/tong-quan-moi/ui";
import { FOCUS } from "@/pages/dashboard/admin/tong-quan-moi/boLoc";
import { MAU2 } from "@/pages/dashboard/admin/tong-quan-moi/mau";
import { parseRoles } from "@/components/settings/settings.config";
import { laKhoAo } from "@/pages/warehouse/loaiKho";
import { khoService, getMineKhoList } from "@/services/khoService";
import { baoCaoNhapXuatService } from "@/services/baoCaoNhapXuatService";
import useCoQuyenXuatBaoCao from "@/hooks/useCoQuyenXuatBaoCao";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import { LUA_CHON_SO_DONG, SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { cn } from "@/lib/utils";
import { formatAxisMoney, formatCurrency, formatCurrencyCompact, formatNumber, formatPercent } from "@/utils/formatters";
import { KhoangTuyChon, Menu, Muc } from "./BoLocKy";
import { tyLeTang } from "./tinhBaoCaoDoanhThu";
import {
  LOAI_KY,
  MAU,
  MOC_NGAY,
  SO_NAM,
  TAB_BANG,
  bienDong,
  boLocTuUrl,
  chuyenNoiBo,
  donKy,
  dongKy,
  duLieuBieuDo,
  ghiBoLoc,
  khoangMoc,
  linkLichSu,
  ngayVN,
  nhanTrucX,
  nhomLoai,
  tenNhom,
  tenTepExcel,
  thamSo,
} from "./tinhNhapXuat";

/*
 * Báo cáo nhập xuất (phương án A chốt 05/11/2026, cùng khung với Báo cáo doanh thu):
 * - Dải đầu trang: ô phạm vi (kho, cách xem, kỳ) và Tồn đầu kỳ + Nhập − Xuất = Tồn cuối kỳ.
 * - Biểu đồ nhập, xuất đủ mọi kỳ con (số lượng hoặc giá trị); bên phải thẻ Nhập từ đâu, xuất đi đâu — bấm một dòng để
 *   lọc biểu đồ và bảng theo loại đó.
 * - Bảng nhập xuất tồn hai tầng (Số lượng | Giá trị) theo kỳ, theo sản phẩm, theo kho.
 * Bộ lọc và tab bảng ghi trên URL. Số đọc từ sổ giao dịch kho, tồn cuối khớp tồn thật (máy chủ tính).
 */

const N = (v) => Number(v) || 0;

/** Ô kết quả của dải đầu trang. dau: dấu phép tính (+, −, =) trước nhãn. */
function OSo({ dau, ten, so, mau, phu, loading, coSo, className }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 px-4 py-3 @min-[640px]/dau:px-5 max-md:px-3", className)}>
      <span className="flex min-w-0 items-center gap-1.5 truncate text-sm text-bo-muted">
        {dau ? (
          <span aria-hidden="true" className="grid size-[18px] shrink-0 place-items-center rounded-full border border-bo-border bg-bo-surface-subtle text-xs font-semibold leading-none text-bo-muted">{dau}</span>
        ) : null}
        <span className="truncate">{ten}</span>
      </span>
      {loading && !coSo ? (
        <span className="flex flex-col gap-1.5 py-1" aria-hidden="true">
          <Skeleton className="h-6 w-3/4 bg-slate-100" />
          <Skeleton className="h-3 w-1/2 bg-slate-100" />
        </span>
      ) : (
        <>
          <span className="truncate whitespace-nowrap text-xl font-bold leading-7 tracking-[-0.025em] tabular-nums text-bo-foreground @min-[800px]/dau:text-2xl @min-[800px]/dau:leading-8" style={mau ? { color: mau } : undefined}>
            {coSo ? so : "—"}
          </span>
          <span className="flex min-h-4 flex-col text-xs text-bo-muted">{coSo ? phu : null}</span>
        </>
      )}
    </div>
  );
}

/** "▲ 12,8% so với cùng kỳ" / "Chưa có số cùng kỳ"; theo năm (không có cùng kỳ) thì không ghi. */
function CungKy({ nay, truoc, coCungKy }) {
  if (!coCungKy) return null;
  const tyLe = tyLeTang(nay, truoc);
  if (tyLe == null) return <span>Chưa có số cùng kỳ</span>;
  const tang = tyLe >= 0;
  return (
    <span className="whitespace-nowrap max-md:whitespace-normal">
      <span className={cn("font-medium", tang ? "text-bo-success" : "text-bo-danger")}>
        <span aria-hidden="true">{tang ? "▲" : "▼"}</span>
        <span className="sr-only">{tang ? "Tăng" : "Giảm"}</span> {formatPercent(Math.abs(tyLe))}
      </span>
      {" "}so với cùng kỳ
    </span>
  );
}

/** Dải đầu trang: ô phạm vi bên trái, Tồn đầu + Nhập − Xuất = Tồn cuối bên phải. */
function DauTrang({ boLoc, setBoLoc, dsKho, data, loading, gio, onTaiLai }) {
  const tenKho = boLoc.khoId ? dsKho.find((k) => String(k.id) === String(boLoc.khoId))?.tenKho ?? "Kho đã chọn" : "Tất cả kho";
  const homNay = new Date();
  const namHienTai = homNay.getFullYear();
  const nhanLoai = LOAI_KY.find((x) => x.value === boLoc.loai)?.label;
  const nhanMoc = boLoc.loai === "ngay"
    ? MOC_NGAY.find((x) => x.value === boLoc.moc)?.label
    : boLoc.loai === "nam" ? `${boLoc.soNam} năm gần nhất` : `Năm ${boLoc.nam}`;
  const coSo = Boolean(data);
  const coCungKy = Boolean(data?.cungKy);
  const bd = bienDong(data?.dauKy?.soLuong, data?.cuoiKy?.soLuong);
  return (
    <div className="@container/dau">
      <section aria-label="Phạm vi và nhập xuất tồn của kỳ" className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)] @min-[980px]/dau:flex-row">
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
            {data ? `${ngayVN(data.tuNgay)} – ${ngayVN(data.denNgay)}` : " "}
            {gio ? ` · lúc ${gio} · ` : " · "}
            <button className={cn(FOCUS, "inline-flex cursor-pointer items-center gap-1 rounded font-medium text-bo-primary hover:underline")} onClick={onTaiLai} type="button">
              <RefreshCcw className={cn("size-3", loading && "animate-spin")} aria-hidden="true" />Cập nhật
            </button>
          </span>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-2 @min-[640px]/dau:grid-cols-4">
          <OSo coSo={coSo} loading={loading} ten="Tồn đầu kỳ" so={formatNumber(data?.dauKy?.soLuong)}
            phu={<span>Giá trị <b className="font-semibold text-bo-foreground">{formatCurrencyCompact(data?.dauKy?.giaTri)}</b></span>} />
          <OSo className="border-l border-l-[#eef1f5]" coSo={coSo} dau="+" loading={loading} mau={MAU.chuNhap} ten="Nhập trong kỳ" so={formatNumber(data?.nhap?.soLuong)}
            phu={(
              <>
                <span>Giá trị <b className="font-semibold text-bo-foreground">{formatCurrencyCompact(data?.nhap?.giaTri)}</b> <span className="whitespace-nowrap">· {formatNumber(data?.nhap?.soPhieu)} phiếu</span></span>
                <CungKy coCungKy={coCungKy} nay={data?.nhap?.soLuong} truoc={data?.cungKy?.nhap} />
              </>
            )} />
          <OSo className="border-t border-t-[#eef1f5] @min-[640px]/dau:border-t-0 @min-[640px]/dau:border-l @min-[640px]/dau:border-l-[#eef1f5]" coSo={coSo} dau="−" loading={loading} mau={MAU.chuXuat} ten="Xuất trong kỳ" so={formatNumber(data?.xuat?.soLuong)}
            phu={(
              <>
                <span>Giá trị <b className="font-semibold text-bo-foreground">{formatCurrencyCompact(data?.xuat?.giaTri)}</b> <span className="whitespace-nowrap">· {formatNumber(data?.xuat?.soPhieu)} phiếu</span></span>
                <CungKy coCungKy={coCungKy} nay={data?.xuat?.soLuong} truoc={data?.cungKy?.xuat} />
              </>
            )} />
          <OSo className="border-l border-t border-l-[#eef1f5] border-t-[#eef1f5] @min-[640px]/dau:border-t-0" coSo={coSo} dau="=" loading={loading} ten="Tồn cuối kỳ" so={formatNumber(data?.cuoiKy?.soLuong)}
            phu={(
              <>
                <span>Giá trị <b className="font-semibold text-bo-foreground">{formatCurrencyCompact(data?.cuoiKy?.giaTri)}</b></span>
                <span>
                  {bd.d ? (
                    <span className={cn("font-medium", bd.tang ? "text-bo-success" : "text-bo-danger")}>
                      <span aria-hidden="true">{bd.tang ? "▲" : "▼"}</span>
                      <span className="sr-only">{bd.tang ? "Tăng" : "Giảm"}</span> {formatNumber(Math.abs(bd.d))}
                    </span>
                  ) : "Không đổi"}
                  {" so với đầu kỳ"}
                </span>
              </>
            )} />
        </div>
      </section>
    </div>
  );
}

function TipBieuDo({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (d.chuaToi) {
    return (
      <div className="min-w-[180px] rounded-lg border border-bo-border bg-bo-surface p-3 text-xs shadow-sm">
        <p className="font-semibold text-bo-foreground">{d.nhanDay}</p>
        <p className="mt-1 text-bo-muted">Chưa tới kỳ này</p>
      </div>
    );
  }
  const chenh = d.nhapSl - d.xuatSl;
  const dong = (ten, gt) => (
    <p className="mt-1 flex justify-between gap-4 first:mt-0"><span className="text-bo-muted">{ten}</span><b className="tabular-nums text-bo-foreground">{gt}</b></p>
  );
  return (
    <div className="min-w-[210px] rounded-lg border border-bo-border bg-bo-surface p-3 text-xs shadow-sm">
      <p className="mb-2 font-semibold text-bo-foreground">{d.nhanDay}</p>
      {dong("Nhập", `${formatNumber(d.nhapSl)} · ${formatCurrencyCompact(d.nhapGt)}`)}
      {dong("Xuất", `${formatNumber(d.xuatSl)} · ${formatCurrencyCompact(d.xuatGt)}`)}
      {dong("Chênh lệch", `${chenh > 0 ? "+" : chenh < 0 ? "−" : ""}${formatNumber(Math.abs(chenh))}`)}
      {dong("Phiếu nhập / xuất", `${formatNumber(d.phieuNhap)} / ${formatNumber(d.phieuXuat)}`)}
    </div>
  );
}

const CHE_DO = [
  { value: "sl", ten: "Số lượng" },
  { value: "gt", ten: "Giá trị" },
];

function TheBieuDo({ data, loading, loi, onTaiLai, tenLoc, onBoLoc, className }) {
  const [cheDo, setCheDo] = useState("sl");
  const rows = useMemo(() => duLieuBieuDo(data, cheDo), [data, cheDo]);
  const trong = !rows.some((r) => r.nhap || r.xuat);
  const moiKy = donKy(data?.loai);
  const nhanX = nhanTrucX(rows);
  return (
    <Card
      bodyClassName={cn(LE, "pb-4 pt-3.5")}
      className={className}
      error={Boolean(loi)}
      id="bc-bieu-do"
      loading={loading && !data}
      onRetry={onTaiLai}
      right={(
        <div role="group" aria-label="Đơn vị biểu đồ" className="inline-flex rounded-md bg-slate-100 p-0.5">
          {CHE_DO.map((x) => (
            <button key={x.value} type="button" aria-pressed={cheDo === x.value} onClick={() => setCheDo(x.value)}
              className={cn("h-6 cursor-pointer rounded px-2 text-xs font-medium text-bo-muted hover:text-bo-foreground", FOCUS, cheDo === x.value && "bg-bo-surface text-bo-primary shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:text-bo-primary")}>
              {x.ten}
            </button>
          ))}
        </div>
      )}
      scope={cheDo === "gt" ? "giá trị theo giá vốn" : "số lượng"}
      scopeClassName="@max-[520px]:hidden"
      title={`Nhập xuất theo ${moiKy}`}
    >
      <div className="mb-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs leading-4 text-bo-muted">
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <i className="inline-block size-2.5 rounded-[2px]" style={{ background: MAU.nhap }} aria-hidden="true" />
          <b className="font-medium text-bo-foreground">Nhập kho</b>
        </span>
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <i className="inline-block size-2.5 rounded-[2px]" style={{ background: MAU.xuat }} aria-hidden="true" />
          <b className="font-medium text-bo-foreground">Xuất kho</b>
        </span>
        {tenLoc ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-bo-primary-soft py-0.5 pl-2.5 pr-1 font-medium text-bo-primary">
            Đang lọc: {tenLoc}
            <button type="button" onClick={onBoLoc} aria-label={`Bỏ lọc ${tenLoc}`} className={cn(FOCUS, "grid size-5 cursor-pointer place-items-center rounded-full hover:bg-white/70")}>
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </div>
      {trong ? (
        <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-center text-[13px] text-bo-muted">
          <ArrowLeftRight className="size-5 text-slate-400" aria-hidden="true" />
          {tenLoc ? `Kỳ này không có ${tenLoc.toLowerCase()}.` : "Kỳ này chưa có nhập, xuất kho nào."}
        </div>
      ) : (
        // Giãn theo thẻ bên cạnh (thẻ Nhập từ đâu cao hơn) để không chừa khoảng trắng dưới biểu đồ
        <div className="min-h-[280px] flex-1 @max-[520px]:min-h-[220px]" role="figure" aria-label={`Số ${cheDo === "gt" ? "giá trị" : "lượng"} nhập, xuất theo ${moiKy}. Số từng ${moiKy} có ở bảng bên dưới.`}>
          <KhungBieuDo>
            <ComposedChart accessibilityLayer barCategoryGap="22%" barGap={2} data={rows} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={MAU2.luoi} vertical={false} />
              <XAxis axisLine={{ stroke: MAU2.truc }} dataKey="nhan" interval={0} tick={{ fill: MAU2.chu, fontSize: 12 }} tickLine={false} tickMargin={8} ticks={nhanX} />
              <YAxis axisLine={false} tick={{ fill: MAU2.chu, fontSize: 12 }} tickFormatter={cheDo === "gt" ? formatAxisMoney : (v) => formatNumber(v)} tickLine={false} width={48} />
              <Tooltip content={<TipBieuDo />} cursor={{ fill: "rgba(22, 119, 255, 0.06)" }} isAnimationActive={false} wrapperStyle={{ outline: "none", zIndex: 10 }} />
              <Bar dataKey="nhap" fill={MAU.nhap} isAnimationActive={false} maxBarSize={18} name="Nhập kho" radius={[3, 3, 0, 0]} />
              <Bar dataKey="xuat" fill={MAU.xuat} isAnimationActive={false} maxBarSize={18} name="Xuất kho" radius={[3, 3, 0, 0]} />
            </ComposedChart>
          </KhungBieuDo>
        </div>
      )}
    </Card>
  );
}

/** Thẻ Nhập từ đâu, xuất đi đâu. Bấm một dòng: lọc biểu đồ và bảng theo loại đó (bấm lại để bỏ). */
function TheLoai({ data, loading, loi, onTaiLai, nhom, onChon, nhieuKho, className }) {
  const nhomDs = useMemo(() => nhomLoai(data), [data]);
  const nb = chuyenNoiBo(data);
  return (
    <Card bodyClassName={cn(LE, "pb-4 pt-1")} className={className} error={Boolean(loi)} loading={loading && !data} onRetry={onTaiLai} title="Nhập từ đâu, xuất đi đâu">
      {nhomDs.map((g) => (
        <div key={g.chieu} className="flex flex-col">
          <p className="mb-1 mt-3 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.06em] text-bo-muted">
            <span>{g.ten}</span>
            <b className="text-[13px] font-semibold tracking-normal tabular-nums text-bo-foreground">{formatNumber(g.tong)}</b>
          </p>
          {g.dong.map((l) => {
            const on = nhom === l.ma;
            const mau = g.chieu === "nhap" ? MAU.nhap : MAU.xuat;
            return (
              <button key={l.ma} type="button" aria-pressed={on} onClick={() => onChon(on ? "" : l.ma)}
                title={on ? "Bỏ lọc" : `Lọc biểu đồ và bảng: ${l.ten}`}
                className={cn(FOCUS, "-mx-2 grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 rounded-md px-2 py-1.5 text-left", on ? "bg-bo-primary-soft" : "hover:bg-bo-surface-subtle")}>
                <span className="flex min-w-0 items-center gap-2 text-[13px] text-bo-foreground">
                  <i className="size-2 shrink-0 rounded-[2px]" style={{ background: mau }} aria-hidden="true" />
                  <span className={cn("truncate", on && "font-medium")}>{l.ten}</span>
                </span>
                <b className="text-right text-[13px] font-semibold tabular-nums text-bo-foreground">{formatNumber(l.soLuong)}</b>
                <span className="pl-4 text-xs text-bo-muted">{formatNumber(l.soPhieu)} phiếu</span>
                <span className="text-right text-xs tabular-nums text-bo-muted">{formatCurrencyCompact(l.giaTri)}</span>
                <span className="col-span-2 ml-4 mt-1 block h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <span className="block h-full rounded-full" style={{ width: `${Math.max(2, l.tyLe * 100)}%`, background: mau }} />
                </span>
              </button>
            );
          })}
          {g.khongCo.length ? <p className="mt-1 pl-4 text-xs text-bo-muted">Không có: {g.khongCo.join(", ").toLowerCase()}</p> : null}
        </div>
      ))}
      {nhieuKho && (nb.nhan || nb.di) ? (
        <p className="mt-3 rounded-md border border-dashed border-bo-border bg-bo-surface-subtle px-3 py-2.5 text-xs leading-5 text-bo-muted">
          <b className="font-semibold text-bo-foreground">Chuyển nội bộ</b> giữa các kho: nhận {formatNumber(nb.nhan)}, chuyển đi {formatNumber(nb.di)}.
          {" "}Khi xem nhiều kho, hai số này phần lớn bù trừ nhau, không làm tăng giảm tồn của cả hệ thống
          {nb.di > nb.nhan ? `; ${formatNumber(nb.di - nb.nhan)} cái chênh là hàng còn đang chuyển hoặc hao hụt khi chuyển` : ""}.
        </p>
      ) : null}
    </Card>
  );
}

const TH = "h-9 whitespace-nowrap px-3 text-right text-xs font-semibold text-bo-muted";
const TD = "whitespace-nowrap px-3 py-2.5 text-right tabular-nums";
const KE = "border-l border-bo-border";

/** Ô số: 0 thì xám nhạt. */
function SoO({ v, mau, dam }) {
  const n = N(v);
  if (!n) return <span className="text-bo-muted">0</span>;
  return <span className={cn(dam && "font-semibold")} style={mau ? { color: mau } : undefined}>{formatNumber(n)}</span>;
}

function TienO({ v }) {
  const n = N(v);
  return n ? formatCurrency(n) : <span className="text-bo-muted">{formatCurrency(0)}</span>;
}

function AnhSanPham({ anh, ten }) {
  const [hong, setHong] = useState(false);
  if (!anh || hong) {
    return <span className="grid h-11 w-9 shrink-0 place-items-center rounded border border-bo-border bg-bo-surface-subtle text-bo-muted" aria-hidden="true"><Shirt className="size-4" /></span>;
  }
  return <img alt="" className="h-11 w-9 shrink-0 rounded border border-bo-border object-cover" loading="lazy" onError={() => setHong(true)} src={anh} title={ten} />;
}

const TEN_TAB = (moiKy) => ({ ky: `Theo ${moiKy}`, "san-pham": "Theo sản phẩm", kho: "Theo kho" });

/** Bảng nhập xuất tồn theo kỳ / sản phẩm / kho. Đang lọc một loại: bỏ cột tồn (tồn không theo loại). */
function BangNXT({ data, loading, loi, onTaiLai, tab, setTab, khoId, tenLoc }) {
  const [trang, setTrang] = useState({ page: 0, size: SO_DONG_MAC_DINH });
  const moiKy = donKy(data?.loai);
  const coTon = !tenLoc;
  const rows = useMemo(() => {
    if (tab === "ky") {
      return dongKy(data).map((k) => ({ khoa: k.tuNgay, ten: k.nhanDay, ...k }));
    }
    return (tab === "kho" ? data?.theoKho : data?.theoSanPham)?.map((d) => ({ khoa: d.id, ...d })) ?? [];
  }, [data, tab]);
  // Đổi tab, đổi dữ liệu thì về trang đầu (chỉ bảng sản phẩm phân trang)
  const [khoaTrang, setKhoaTrang] = useState({ tab, data });
  if (khoaTrang.tab !== tab || khoaTrang.data !== data) {
    setKhoaTrang({ tab, data });
    if (trang.page) setTrang((t) => ({ ...t, page: 0 }));
  }
  const phanTrang = tab === "san-pham";
  const hien = phanTrang ? rows.slice(trang.page * trang.size, (trang.page + 1) * trang.size) : rows;
  const tong = rows.reduce((t, r) => ({
    nhapSl: t.nhapSl + N(r.nhapSl), nhapGt: t.nhapGt + N(r.nhapGt), xuatSl: t.xuatSl + N(r.xuatSl), xuatGt: t.xuatGt + N(r.xuatGt),
    dauSl: t.dauSl + N(r.dauSl), dauGt: t.dauGt + N(r.dauGt), cuoiSl: t.cuoiSl + N(r.cuoiSl), cuoiGt: t.cuoiGt + N(r.cuoiGt),
    phieuNhap: t.phieuNhap + N(r.phieuNhap), phieuXuat: t.phieuXuat + N(r.phieuXuat),
  }), { nhapSl: 0, nhapGt: 0, xuatSl: 0, xuatGt: 0, dauSl: 0, dauGt: 0, cuoiSl: 0, cuoiGt: 0, phieuNhap: 0, phieuXuat: 0 });
  // Theo kỳ: tồn đầu, tồn cuối của cả kỳ (không cộng các kỳ con)
  if (tab === "ky" && data) {
    tong.dauSl = N(data.dauKy?.soLuong); tong.dauGt = N(data.dauKy?.giaTri);
    tong.cuoiSl = N(data.cuoiKy?.soLuong); tong.cuoiGt = N(data.cuoiKy?.giaTri);
  }
  const tenCot = tab === "ky" ? (moiKy.charAt(0).toUpperCase() + moiKy.slice(1)) : tab === "kho" ? "Kho" : "Sản phẩm";
  const nhanTong = tab === "ky" ? `Cả kỳ · ${rows.length} ${moiKy} có phát sinh` : tab === "kho" ? `${rows.length} kho` : `${rows.length} sản phẩm`;
  const coPhieu = tab === "ky";
  const soCotSl = coTon ? 4 : 2;
  const tenTab = TEN_TAB(moiKy);
  const empty = !loading && !loi && Boolean(data) && rows.length === 0;

  const oDong = (r) => (
    <>
      {coTon ? <td className={cn(TD, KE)}><SoO v={r.dauSl} /></td> : null}
      <td className={cn(TD, !coTon && KE)}><SoO mau={MAU.chuNhap} v={r.nhapSl} dam /></td>
      <td className={TD}><SoO mau={MAU.chuXuat} v={r.xuatSl} dam /></td>
      {coTon ? <td className={cn(TD, "font-semibold text-bo-foreground")}>{formatNumber(N(r.cuoiSl))}</td> : null}
      {coTon ? <td className={cn(TD, KE, "text-slate-600")}><TienO v={r.dauGt} /></td> : null}
      <td className={cn(TD, !coTon && KE)}><TienO v={r.nhapGt} /></td>
      <td className={TD}><TienO v={r.xuatGt} /></td>
      {coTon ? <td className={cn(TD, "font-semibold text-bo-foreground")}>{formatCurrency(N(r.cuoiGt))}</td> : null}
      {coPhieu ? <td className={cn(TD, KE, "pr-5 text-slate-600")}>{N(r.phieuNhap) || N(r.phieuXuat) ? `${formatNumber(r.phieuNhap)} / ${formatNumber(r.phieuXuat)}` : <span className="text-bo-muted">—</span>}</td> : null}
    </>
  );

  const tabs = (
    <div role="tablist" aria-label="Xem bảng theo" className="-mb-px flex min-w-0 items-end gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TAB_BANG.map((t) => (
        <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
          className={cn(FOCUS, "cursor-pointer whitespace-nowrap border-b-2 px-3 py-3 text-sm", tab === t ? "border-bo-primary font-semibold text-bo-foreground" : "border-transparent text-bo-muted hover:text-bo-foreground")}>
          {tenTab[t]}
        </button>
      ))}
    </div>
  );

  return (
    <section aria-label="Bảng nhập xuất tồn" className="@container flex min-w-0 flex-col rounded-lg border border-bo-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <header className={cn("flex min-h-[52px] flex-wrap items-end justify-between gap-x-3 border-b border-[#eef1f5]", LE)}>
        {tabs}
        <MoreLink className="py-3" to={linkLichSu(data, khoId)}>Xem từng giao dịch</MoreLink>
      </header>
      {loading && !data ? (
        <div className={cn(LE, "flex flex-col gap-3 py-4")} aria-hidden="true">
          <Skeleton className="h-5 w-1/3 bg-slate-100" />
          <Skeleton className="h-24 bg-slate-100" />
        </div>
      ) : loi ? (
        <div role="alert" className="flex flex-col items-center gap-2 py-8 text-center text-sm">
          <p className="font-medium text-bo-foreground">Không tải được số liệu</p>
          <button type="button" onClick={onTaiLai} className={cn(FOCUS, "cursor-pointer rounded font-medium text-bo-primary hover:underline")}>Thử lại</button>
        </div>
      ) : empty ? (
        <p className="py-10 text-center text-[13px] text-bo-muted">{tenLoc ? `Kỳ này không có ${tenLoc.toLowerCase()}.` : "Kỳ này chưa có nhập, xuất kho nào."}</p>
      ) : (
        <>
          {/* Máy tính, máy tính bảng: bảng hai tầng tiêu đề, cuộn ngang trong khung */}
          <div className="hidden overflow-x-auto @min-[640px]:block">
            <table className={cn("w-full border-collapse text-sm tabular-nums", coTon ? "min-w-[1040px]" : "min-w-[680px]")}>
              <thead>
                <tr className="bg-bo-surface-subtle">
                  <th rowSpan={2} scope="col" className={cn(TH, "border-b border-bo-border pl-5 text-left align-bottom")}>{tenCot}</th>
                  <th colSpan={soCotSl} scope="colgroup" className={cn(TH, KE, "h-7 text-center uppercase tracking-[0.05em] text-[11px]")}>Số lượng</th>
                  <th colSpan={soCotSl} scope="colgroup" className={cn(TH, KE, "h-7 text-center uppercase tracking-[0.05em] text-[11px]")}>Giá trị (giá vốn)</th>
                  {coPhieu ? <th rowSpan={2} scope="col" className={cn(TH, KE, "border-b border-bo-border pr-5 align-bottom")}>Phiếu N / X</th> : null}
                </tr>
                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                  {[0, 1].map((nhom) => (
                    [coTon ? "Tồn đầu" : null, "Nhập", "Xuất", coTon ? "Tồn cuối" : null].filter(Boolean).map((t, i) => (
                      <th key={`${nhom}-${t}`} scope="col" className={cn(TH, i === 0 && KE)}>{t}</th>
                    ))
                  ))}
                </tr>
              </thead>
              <tbody>
                {hien.map((r) => (
                  <tr key={r.khoa} className="border-b border-[#eef1f5] hover:bg-bo-surface-subtle">
                    <th scope="row" className="py-2 pl-5 pr-3 text-left font-normal">
                      {tab === "san-pham" ? (
                        <span className="flex min-w-[220px] max-w-[360px] items-center gap-3">
                          <AnhSanPham anh={r.anh} ten={r.ten} />
                          <span className="min-w-0">
                            <span className="line-clamp-2 font-medium text-bo-foreground">{r.ten}</span>
                            <span className="block truncate text-xs text-bo-muted">{[r.ma, r.soSku ? `${formatNumber(r.soSku)} mã SKU` : null, r.danhMuc].filter(Boolean).join(" · ")}</span>
                          </span>
                        </span>
                      ) : (
                        <span className="whitespace-nowrap font-medium text-bo-foreground">{r.ten}</span>
                      )}
                    </th>
                    {oDong(r)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-bo-surface-subtle font-bold text-bo-foreground">
                  <th scope="row" className="whitespace-nowrap py-3 pl-5 pr-3 text-left">{nhanTong}</th>
                  {coTon ? <td className={cn(TD, KE)}>{formatNumber(tong.dauSl)}</td> : null}
                  <td className={cn(TD, !coTon && KE)} style={{ color: MAU.chuNhap }}>{formatNumber(tong.nhapSl)}</td>
                  <td className={TD} style={{ color: MAU.chuXuat }}>{formatNumber(tong.xuatSl)}</td>
                  {coTon ? <td className={TD}>{formatNumber(tong.cuoiSl)}</td> : null}
                  {coTon ? <td className={cn(TD, KE)}>{formatCurrency(tong.dauGt)}</td> : null}
                  <td className={cn(TD, !coTon && KE)}>{formatCurrency(tong.nhapGt)}</td>
                  <td className={TD}>{formatCurrency(tong.xuatGt)}</td>
                  {coTon ? <td className={TD}>{formatCurrency(tong.cuoiGt)}</td> : null}
                  {coPhieu ? <td className={cn(TD, KE, "pr-5")}>{`${formatNumber(tong.phieuNhap)} / ${formatNumber(tong.phieuXuat)}`}</td> : null}
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Điện thoại: mỗi dòng một khối — tên và tồn cuối, dòng phụ đầu kỳ, nhập, xuất */}
          <ul className="m-0 list-none p-0 @min-[640px]:hidden">
            {hien.map((r) => (
              <li key={r.khoa} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-b border-[#eef1f5] px-4 py-3 text-sm">
                <b className="line-clamp-2 font-semibold">{r.ten}</b>
                <b className="text-right font-semibold tabular-nums">{coTon ? formatNumber(N(r.cuoiSl)) : ""}</b>
                <span className="text-xs tabular-nums text-bo-muted">
                  {[
                    coTon ? <span key="d">Đầu kỳ {formatNumber(N(r.dauSl))}</span> : null,
                    N(r.nhapSl) ? <span key="n" style={{ color: MAU.chuNhap }}>+{formatNumber(N(r.nhapSl))}</span> : null,
                    N(r.xuatSl) ? <span key="x" style={{ color: MAU.chuXuat }}>−{formatNumber(N(r.xuatSl))}</span> : null,
                  ].filter(Boolean).flatMap((x, i) => (i ? [" · ", x] : [x]))}
                </span>
                <span className="text-right text-xs text-bo-muted">{coTon ? "tồn cuối" : ""}</span>
              </li>
            ))}
            <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 bg-bo-surface-subtle px-4 py-3 text-sm font-semibold">
              <span>{nhanTong}</span>
              <span className="text-right tabular-nums">{coTon ? formatNumber(tong.cuoiSl) : ""}</span>
              <span className="col-span-2 text-xs font-normal tabular-nums text-bo-muted">
                {coTon ? `Đầu kỳ ${formatNumber(tong.dauSl)} · ` : ""}+{formatNumber(tong.nhapSl)} · −{formatNumber(tong.xuatSl)}
              </span>
            </li>
          </ul>
          {phanTrang && rows.length > LUA_CHON_SO_DONG[0] ? (
            <div className="border-t border-bo-border px-4 py-3">
              <TablePagination
                onPageChange={(p) => setTrang((t) => ({ ...t, page: p }))}
                onSizeChange={(s) => setTrang({ page: 0, size: s })}
                page={trang.page}
                size={trang.size}
                total={rows.length}
              />
            </div>
          ) : null}
        </>
      )}
      <p className={cn(LE, "border-t border-bo-border py-2.5 text-xs leading-5 text-bo-muted")}>
        Giá trị tính theo giá vốn của lô. Tồn cuối kỳ khớp tồn kho thật; tồn đầu kỳ = tồn cuối − nhập + xuất trong kỳ. Không tính Kho Trung Chuyển (hàng đang trên đường).
        {tenLoc ? " Đang lọc một loại nên bảng không có cột tồn." : ""}
      </p>
    </section>
  );
}

const loiCua = (e) => e?.response?.data?.message || e?.message || "";

export default function NhatKyNhapXuat() {
  const coQuyenXuat = useCoQuyenXuatBaoCao();
  const laQtv = parseRoles(localStorage.getItem("role")).includes("quan_tri_vien");
  const [searchParams, setSearchParams] = useSearchParams();
  // Tab bảng (?bang=) không thuộc bộ lọc: đổi tab không tải lại số liệu
  const chuoiUrl = (() => { const p = new URLSearchParams(searchParams); p.delete("bang"); return p.toString(); })();
  const boLoc = useMemo(() => boLocTuUrl(new URLSearchParams(chuoiUrl)), [chuoiUrl]);
  const setBoLoc = useCallback((x) => setSearchParams((prev) => ghiBoLoc(prev, x), { replace: true }), [setSearchParams]);
  const [tab, setTab] = useTabTrenUrl(TAB_BANG, "ky", { ten: "bang" });
  const [dsKho, setDsKho] = useState([]);
  const [tongHop, setTongHop] = useState({ data: null, loading: true, loi: null, gio: null });
  const [lan, setLan] = useState(0);

  // Kho cho bộ lọc: quản trị viên mọi kho; quản lý kho các kho mình phụ trách. Bỏ kho ảo, kho ngừng hoạt động.
  useEffect(() => {
    let huy = false;
    const tai = laQtv ? khoService.getAllKho().then((body) => body?.data?.content ?? []) : getMineKhoList();
    tai.then((ds) => { if (!huy) setDsKho(ds.filter((k) => !laKhoAo(k) && Number(k.trangThai ?? 1) === 1)); })
      .catch(() => {});
    return () => { huy = true; };
  }, [laQtv]);

  const ts = useMemo(() => thamSo(boLoc), [boLoc]);

  useEffect(() => {
    const ctrl = new AbortController();
    queueMicrotask(() => {
      if (!ctrl.signal.aborted) setTongHop((cu) => ({ ...cu, loading: true }));
    });
    baoCaoNhapXuatService.tongHop(ts, { signal: ctrl.signal })
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setTongHop({ data: d, loading: false, loi: null, gio: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) });
      })
      .catch((e) => { if (!ctrl.signal.aborted) setTongHop({ data: null, loading: false, loi: loiCua(e) || "Không tải được", gio: null }); });
    return () => ctrl.abort();
  }, [ts, lan]);

  const taiLai = () => setLan((n) => n + 1);
  const { data, loading, loi, gio } = tongHop;
  const tenLoc = boLoc.nhom ? tenNhom(data, boLoc.nhom) ?? "loại đã chọn" : null;
  const chonNhom = (ma) => setBoLoc({ nhom: ma });
  // Xem tất cả kho, hoặc quản lý kho phụ trách nhiều kho: chuyển kho nội bộ bù trừ nhau
  const nhieuKho = !boLoc.khoId && (laQtv || dsKho.length > 1);

  return (
    <PageContainer className="flex flex-col gap-4">
      <PageHeader
        className="mb-0"
        title="Báo cáo nhập xuất"
        actions={coQuyenXuat ? (
          <NutXuatExcel
            taiTep={() => baoCaoNhapXuatService.xuatExcel(ts)}
            tenTep={() => tenTepExcel(ts)}
            disabled={!data || loading}
          />
        ) : null}
      />

      <DauTrang boLoc={boLoc} data={data} dsKho={dsKho} gio={gio} loading={loading} onTaiLai={taiLai} setBoLoc={setBoLoc} />
      {loi ? (
        <p role="alert" className="m-0 rounded-lg border border-red-200 bg-bo-danger-soft px-4 py-2.5 text-sm text-red-800">
          Không tải được báo cáo nhập xuất: {loi}
        </p>
      ) : null}
      {data?.theoKhoPhuTrach ? <p className="-mt-2 mb-0 text-xs text-bo-muted">Chỉ tính các kho bạn phụ trách.</p> : null}

      <div className="flex flex-wrap items-stretch gap-4">
        <TheBieuDo className="min-w-0 flex-[999_1_560px]" data={data} loading={loading} loi={loi} onBoLoc={() => chonNhom("")} onTaiLai={taiLai} tenLoc={tenLoc} />
        <TheLoai className="min-w-0 flex-[1_1_320px] xl:max-w-[380px]" data={data} loading={loading} loi={loi} nhieuKho={nhieuKho} nhom={boLoc.nhom} onChon={chonNhom} onTaiLai={taiLai} />
      </div>

      <BangNXT data={data} khoId={boLoc.khoId} loading={loading} loi={loi} onTaiLai={taiLai} setTab={setTab} tab={tab} tenLoc={tenLoc} />
    </PageContainer>
  );
}
