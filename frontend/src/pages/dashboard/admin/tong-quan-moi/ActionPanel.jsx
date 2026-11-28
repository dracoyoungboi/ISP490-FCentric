import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight,
  Ban,
  ClipboardList,
  FilePen,
  FileText,
  Inbox,
  ListChecks,
  Lock,
  MapPinOff,
  PackageOpen,
  PackageX,
  RefreshCwOff,
  Scale,
  Send,
  TimerOff,
  TriangleAlert,
  Truck,
  Undo2,
  Unplug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DauTichDong from "./DauTichDong";
import { Card, LE } from "./ui";
import { formatSo } from "../tong-quan/tongQuanFormat";
import { chiaViec } from "../tong-quan/viecCanXuLy";
import { setKhoLamViecId } from "@/utils/khoLamViec";
import { t } from "@/i18n";

const BIEU_TUONG = {
  ban: Ban,
  unplug: Unplug,
  alert: TriangleAlert,
  dongBo: RefreshCwOff,
  nhap: FilePen,
  treHen: TimerOff,
  khoa: Lock,
  nhat: ListChecks,
  dongGoi: PackageOpen,
  giao: Send,
  nhapKho: Inbox,
  chuyen: ArrowLeftRight,
  lech: Scale,
  hoanKe: Undo2,
  chuaKe: MapPinOff,
  kiemKe: ClipboardList,
  traNcc: PackageX,
  xeTai: Truck,
  yeuCau: FileText,
};

/**
 * Cần xử lý (đặc tả bản 2, mục 7; quyết định 28/11/2026 bỏ tab): một khối lăn bên trong, chia nhóm Bán hàng / Kho / Mua hàng
 * có tiêu đề nhỏ trên vạch kẻ mảnh, dính đầu khối khi lăn, kèm tổng số việc của nhóm (đỏ khi nhóm có việc gấp); đầu thẻ
 * ghi tổng số việc, các dòng liền nhau không kẻ (kiểu A, chốt 28/11/2026). Nhóm không có việc thì ẩn,
 * nhóm có việc gấp xếp lên trước. Mỗi dòng một LOẠI việc với số kèm đơn vị (đơn, phiếu, mã, đợt, lệnh, lô, biên bản), gấp
 * lên đầu. Màn rộng: khối cao bằng biểu đồ bên trái, đáy mờ khi còn việc ở dưới; màn hẹp: cao tối đa 420px. Không đổi theo
 * kỳ; lọc theo kho đang xem. Dòng mở trang chỉ xem kho làm việc thì đổi kho làm việc sang kho của việc trước khi mở.
 */
export default function ActionPanel({ data, khoId, dsKho, loading, error, onRetry, className }) {
  const nhom = chiaViec(data?.viecCanXuLy ?? [], data?.thoiDiem, khoId == null);
  const tongViec = nhom.reduce((s, n) => s + n.so, 0);
  const tenKho = khoId == null ? null : dsKho.find((x) => x.id === khoId)?.tenKho;
  const lanRef = useRef(null);
  const [conDuoi, setConDuoi] = useState(false);

  const doLan = useCallback(() => {
    const el = lanRef.current;
    setConDuoi(Boolean(el) && el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);
  // ResizeObserver gọi lần đầu ngay khi bắt đầu theo dõi; theo dõi cả từng nhóm để biết khi danh sách dài ra hay ngắn lại.
  useEffect(() => {
    const el = lanRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(doLan);
    ro.observe(el);
    for (const con of el.children) ro.observe(con);
    return () => ro.disconnect();
  }, [doLan, data]);

  return (
    <Card
      className={className}
      title={t("Cần xử lý")}
      right={tongViec > 0 ? <span className="text-[13px] tabular-nums text-bo-muted">{t("{{n}} việc", { n: formatSo(tongViec), count: tongViec })}</span> : null}
      loading={loading} error={error} onRetry={onRetry}>
      {data?.viecCanXuLy ? (
        nhom.length === 0 ? (
          <div className={cn(LE, "flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center")}>
            <DauTichDong key={data?.thoiDiem} className="size-9" />
            <p className="text-sm font-medium text-bo-foreground">{t("Không có việc nào đang chờ")}</p>
            <p className="text-xs text-bo-muted">
              {tenKho ? t("Việc mới của {{kho}} sẽ hiện ở đây.", { kho: tenKho }) : t("Việc mới sẽ hiện ở đây.")}
            </p>
          </div>
        ) : (
          <div className="relative @min-[968px]/tq:min-h-[240px] @min-[968px]/tq:flex-1">
            <div
              ref={lanRef}
              onScroll={doLan}
              className="tq-cuon max-h-[420px] overflow-y-auto overscroll-contain @min-[968px]/tq:absolute @min-[968px]/tq:inset-0 @min-[968px]/tq:max-h-none"
            >
              {nhom.map((n) => (
                <section key={n.id} aria-labelledby={`tq-viec-${n.id}`}>
                  <h3 id={`tq-viec-${n.id}`} className={cn(LE, "sticky top-0 z-[1] flex items-center gap-2 bg-white pb-1 pt-3 text-xs font-medium text-bo-muted")}>
                    {n.ten}
                    <span className={cn("tabular-nums", n.gap ? "font-semibold text-[#b42318]" : "text-slate-400")}>{formatSo(n.so)}</span>
                    <span aria-hidden="true" className="h-px flex-1 bg-[#eef1f5]" />
                  </h3>
                  <ul>
                    {n.dong.map((d) => (
                      <li key={d.key}>
                        <Link
                          to={d.to}
                          title={d.phu ? `${d.ten} – ${d.phu}` : d.ten}
                          onClick={() => {
                            if (d.khoId != null) setKhoLamViecId(d.khoId);
                          }}
                          className={cn(LE, "group flex items-center gap-3 py-2 hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30")}
                        >
                          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", d.gap ? "bg-bo-danger-soft text-red-600" : "bg-slate-100 text-slate-500")}>
                            {createElement(BIEU_TUONG[d.icon] ?? ClipboardList, { className: "size-4", "aria-hidden": true })}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-bo-foreground">{d.ten}</span>
                            <span className="block truncate text-xs text-bo-muted">{d.phu}</span>
                          </span>
                          {d.lam ? (
                            <span className="shrink-0 whitespace-nowrap text-[13px] font-medium text-bo-primary group-hover:text-bo-primary-hover">{d.lam}</span>
                          ) : (
                            <span className={cn("shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums", d.gap ? "text-[#b42318]" : "text-bo-foreground")}>
                              {formatSo(d.so)}
                              {d.donVi ? <small className="ml-1 text-xs font-normal text-bo-muted">{d.donVi}</small> : null}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-lg bg-gradient-to-t from-white to-transparent transition-opacity",
                conDuoi ? "opacity-100" : "opacity-0",
              )}
            />
          </div>
        )
      ) : null}
    </Card>
  );
}
