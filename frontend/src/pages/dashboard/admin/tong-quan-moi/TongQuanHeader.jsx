import { CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { gioPhut } from "../tong-quan/tongQuanFormat";
import { KhoMenu, KyMenu } from "./BoLocMenu";
import { FOCUS, NHAN_KY, khoangKy, tenKhoDangXem } from "./boLoc";
import KpiStrip from "./KpiStrip";

/*
 * Dải đầu trang Tổng quan (Kiểu 3): một thẻ gồm ô phạm vi và 4 chỉ số của kỳ, phủ hết bề ngang để đầu trang không còn
 * khoảng trống. Ô phạm vi: kho đang xem, kỳ xem kèm khoảng ngày, giờ số liệu và nút cập nhật (SRS 11.1.1). Không hiện
 * tiêu đề nhìn thấy (quyết định 14/10); thẻ h1 vẫn giữ cho trình đọc màn hình.
 * Xếp theo bề rộng thẻ (mỗi ô chỉ số cần ~176px để số và dòng so sánh không bị cắt):
 * - ≥ 980px: ô phạm vi bên trái (276px), 4 chỉ số bên phải;
 * - 640–979px (máy tính bảng, cửa sổ hẹp): ô phạm vi thành một hàng ngang ở trên, 4 chỉ số một hàng bên dưới;
 * - < 640px (điện thoại): ô phạm vi ở trên, 4 chỉ số 2 × 2.
 */
export default function TongQuanHeader({ data, ky, setKy, khoId, setKhoId, dsKho, loading, refreshing, onReload, chon, setChon, loiDoanhThu }) {
  const k = khoangKy(ky, data?.thoiDiem);
  const tenKho = tenKhoDangXem(khoId, dsKho);
  const gio = data?.thoiDiem ? gioPhut(data.thoiDiem) : null;

  return (
    <div className="@container/dau">
      <section
        aria-label="Phạm vi và kết quả kinh doanh"
        className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-bo-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] @min-[980px]/dau:flex-row"
      >
        <h1 className="sr-only">Tổng quan</h1>

        <div
          className={cn(
            "flex min-w-0 flex-col justify-center gap-1.5 border-b border-bo-border bg-bo-surface-subtle px-4 py-3",
            "@min-[640px]/dau:flex-row @min-[640px]/dau:flex-wrap @min-[640px]/dau:items-center @min-[640px]/dau:justify-start @min-[640px]/dau:gap-x-6 @min-[640px]/dau:gap-y-2 @min-[640px]/dau:px-5",
            "@min-[980px]/dau:w-[276px] @min-[980px]/dau:shrink-0 @min-[980px]/dau:flex-col @min-[980px]/dau:flex-nowrap @min-[980px]/dau:items-stretch @min-[980px]/dau:justify-center @min-[980px]/dau:gap-1.5 @min-[980px]/dau:border-b-0 @min-[980px]/dau:border-r @min-[980px]/dau:py-3.5",
          )}
        >
          <KhoMenu data={data} dsKho={dsKho} khoId={khoId} onChange={setKhoId} disabled={loading}>
            <button
              type="button"
              aria-label={`Chọn kho, đang xem: ${tenKho}`}
              title={tenKho}
              className={cn(FOCUS, "inline-flex max-w-full cursor-pointer items-center gap-1.5 self-start rounded text-base font-semibold leading-6 text-bo-foreground hover:text-bo-primary-hover disabled:opacity-60")}
            >
              <span className="truncate">{tenKho}</span>
              <ChevronDown className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
            </button>
          </KhoMenu>

          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <KyMenu ky={ky} onChange={setKy} thoiDiem={data?.thoiDiem}>
              <button
                type="button"
                aria-label={`Chọn kỳ xem, đang xem: ${NHAN_KY[ky]}`}
                className={cn(
                  FOCUS,
                  "inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-1 rounded-md border border-bo-border bg-white px-2 text-sm font-medium text-bo-foreground shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-bo-surface-subtle",
                )}
              >
                <CalendarDays className="size-4 text-bo-muted" aria-hidden="true" />
                {NHAN_KY[ky]}
                <ChevronDown className="size-3.5 text-bo-muted" aria-hidden="true" />
              </button>
            </KyMenu>
            <span className="whitespace-nowrap text-xs tabular-nums text-bo-muted" title={`${k.day}, so với ${k.tenSoSanh.toLowerCase()} (${k.soSanh})`}>
              {k.gon}
            </span>
          </div>

          <p className="text-xs text-bo-muted @min-[640px]/dau:ml-auto @min-[980px]/dau:ml-0" aria-live="polite">
            {gio ? `Số liệu lúc ${gio} · ` : "Đang tải số liệu… "}
            <button
              type="button"
              onClick={onReload}
              disabled={refreshing}
              className={cn(FOCUS, "cursor-pointer rounded font-medium text-bo-primary hover:text-bo-primary-hover hover:underline disabled:cursor-default disabled:text-bo-muted disabled:no-underline")}
            >
              {refreshing && !loading ? "Đang cập nhật…" : "Cập nhật"}
            </button>
          </p>
        </div>

        <KpiStrip data={data} ky={ky} loading={loading} error={loiDoanhThu} onRetry={onReload} chon={chon} setChon={setChon} />
      </section>
    </div>
  );
}
