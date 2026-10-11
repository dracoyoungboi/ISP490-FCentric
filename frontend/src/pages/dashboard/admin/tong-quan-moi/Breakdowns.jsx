import { useState } from "react";
import { Globe, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, Delta, MoreLink, Segmented, StackBar } from "./ui";
import { MAU2 } from "./mau";
import { formatPhanTram, formatSo, formatTien, formatTienGon, phanTramThayDoi, tyLe } from "../tong-quan/tongQuanFormat";

/**
 * Theo kho: danh sách thanh ngang thay cho bảng 5 cột. Một tab cho doanh thu, một tab cho giá trị tồn
 * (gộp danh sách "giá trị tồn theo kho" trước đây nằm lẫn trong thẻ Tồn kho).
 */
export function KhoBreakdown({ data, ky, khoId, loading, loiDoanhThu, loiTonKho, onRetry }) {
  const [tab, setTab] = useState("doanhThu");
  const laDoanhThu = tab === "doanhThu";
  const rows = laDoanhThu
    ? (data?.doanhThuTheoKho ?? []).map((r) => ({ id: r.khoId, ten: r.tenKho, khoTong: r.laKhoTong, gt: r.doanhThu, truoc: r.doanhThuKyTruoc, phu: `${formatSo(r.soDon)} đơn · ${r.soDon ? formatTienGon(Math.round(r.doanhThu / r.soDon)) : "—"}/đơn` }))
    : (data?.tonKho?.theoKho ?? []).map((r) => ({ id: r.khoId, ten: r.tenKho, khoTong: r.laKhoTong, gt: r.giaTri, phu: `${formatSo(r.tonThucTe)} sản phẩm` }));
  rows.sort((a, b) => b.gt - a.gt);
  const tong = rows.reduce((s, r) => s + r.gt, 0);
  const max = Math.max(...rows.map((r) => r.gt), 1);
  const loi = laDoanhThu ? loiDoanhThu : loiTonKho;

  return (
    <Card
      title="Theo kho"
      right={
        <Segmented
          label="Chỉ số theo kho"
          value={tab}
          onChange={setTab}
          options={[
            { value: "doanhThu", label: "Doanh thu" },
            { value: "tonKho", label: "Giá trị tồn" },
          ]}
        />
      }
      loading={loading}
      error={loi}
      onRetry={onRetry}
      empty={!loi && tong === 0}
      emptyIcon={Store}
      emptyText={laDoanhThu ? "Chưa có đơn đã giao ở kho nào trong kỳ." : "Chưa có hàng trong kho."}
    >
      <p className="mb-3 text-xs text-bo-muted">
        Tổng <b className="font-semibold text-bo-foreground">{formatTienGon(tong)}</b>
        {laDoanhThu ? ` · ${ky === "12_thang" ? "so với cùng kỳ năm trước" : "so với kỳ trước"}` : " · theo giá vốn lô"}
      </p>
      <ul className="space-y-1">
        {rows.map((r) => {
          const dangChon = khoId === r.id;
          const mo = khoId != null && !dangChon;
          return (
            <li key={r.id} className={cn("grid grid-cols-[minmax(0,1fr)_6.5rem_3.75rem] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_6.5rem_3.75rem] rounded-lg px-2 py-1.5 -mx-2", dangChon && "bg-[#f2f7ff]")}>
              <span className="min-w-0">
                <span className="block truncate text-sm text-bo-foreground">{r.ten}</span>
                <span className="block truncate text-xs text-bo-muted">{r.khoTong && !/kho tổng/i.test(r.ten) ? "Kho tổng · " : ""}{r.phu}</span>
              </span>
              <span className="hidden h-2 rounded-full bg-[#f1f4f8] sm:block" aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(1.5, (r.gt / max) * 100)}%`, background: MAU2.chinh, opacity: mo ? 0.35 : 1 }} />
              </span>
              <span className="text-right text-sm font-semibold tabular-nums text-bo-foreground">
                {formatTienGon(r.gt)}
                <span className="block text-xs font-normal text-bo-muted">{formatPhanTram(tyLe(r.gt, tong), 0)}</span>
              </span>
              <span className="text-right">
                {laDoanhThu ? <Delta value={phanTramThayDoi(r.gt, r.truoc)} text={r.truoc === 0 ? (r.gt > 0 ? "Mới" : "—") : undefined} /> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Theo kênh: một thanh tỷ trọng + một danh sách (bỏ vành khuyên và bảng lặp lại cùng số liệu). */
export function ChannelBreakdown({ data, loading, error, onRetry }) {
  const ds = (data?.theoKenh ?? []).filter((k) => k.doanhThu > 0 || k.soDon > 0 || k.soDonHoan > 0).sort((a, b) => b.doanhThu - a.doanhThu);
  const tong = ds.reduce((s, k) => s + k.doanhThu, 0);
  const tongDon = ds.reduce((s, k) => s + k.soDon, 0);
  const tongHoan = ds.reduce((s, k) => s + k.soDonHoan, 0);
  const mau = (ma) => MAU2.kenh[ma] ?? "#94a3b8";

  return (
    <Card
      title="Theo kênh bán"
      right={<MoreLink to="/channels">Kênh bán</MoreLink>}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={!error && tong === 0}
      emptyIcon={Globe}
      emptyText="Chưa có đơn đã giao trong kỳ."
    >
      <p className="mb-3 text-xs text-bo-muted">
        Tổng <b className="font-semibold text-bo-foreground">{formatTienGon(tong)}</b> · {ds.length} kênh có doanh thu
      </p>
      {ds.length > 1 ? <StackBar height="h-2.5" className="mb-3" segments={ds.map((k) => ({ key: k.maKenh, value: k.doanhThu, color: mau(k.maKenh) }))} /> : null}
      <ul className="mb-4 space-y-1">
        {ds.map((k) => (
          <li key={k.maKenh} className="-mx-2 grid grid-cols-[10px_minmax(0,1fr)_6.5rem] items-center gap-3 rounded-lg px-2 py-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: mau(k.maKenh) }} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate text-sm text-bo-foreground">
                {k.tenKenh}
              </span>
              <span className="block truncate text-xs tabular-nums text-bo-muted">
                {formatSo(k.soDon)} đơn · {k.soDon ? formatTien(Math.round(k.doanhThu / k.soDon)) : "—"}/đơn · hoàn {formatPhanTram(tyLe(k.soDonHoan, k.soDon + k.soDonHoan))}
              </span>
            </span>
            <span className="text-right text-sm font-semibold tabular-nums text-bo-foreground">
              {formatTienGon(k.doanhThu)}
              <span className="block text-xs font-normal text-bo-muted">{formatPhanTram(tyLe(k.doanhThu, tong), 0)}</span>
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-[#eef1f5] pt-4">
        <Tong label="Đơn đã giao" value={formatSo(tongDon)} />
        <Tong label="Trung bình mỗi đơn" value={tongDon ? formatTienGon(Math.round(tong / tongDon)) : "—"} />
        <Tong label="Tỷ lệ hoàn" value={formatPhanTram(tyLe(tongHoan, tongDon + tongHoan))} />
      </dl>
    </Card>
  );
}

function Tong({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-bo-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-[15px] font-semibold text-bo-foreground">{value}</dd>
    </div>
  );
}
