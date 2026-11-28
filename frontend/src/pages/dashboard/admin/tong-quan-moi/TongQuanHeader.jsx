import { CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { gioPhut } from "../tong-quan/tongQuanFormat";
import { khoangKy, moTaKy, ngayCuaKy, ngayMay, nhanNutKy } from "../tong-quan/kyXem";
import { KhoMenu, KyMenu } from "./BoLocMenu";
import { FOCUS, tenKhoDangXem } from "./boLoc";
import KpiStrip from "./KpiStrip";
import { t } from "@/i18n";

/*
 * Dải đầu trang Tổng quan: một thẻ gồm ô phạm vi và 4 chỉ số của kỳ. Ô phạm vi giữ gọn như cũ: kho đang xem, nút kỳ kèm
 * khoảng ngày giờ thật (rê chuột thấy khoảng đem so), giờ số liệu và nút Cập nhật. Không hiện tiêu đề nhìn thấy; thẻ h1
 * vẫn giữ cho trình đọc màn hình.
 * Xếp theo bề rộng thẻ: ≥ 980px ô phạm vi bên trái (276px), 4 chỉ số bên phải; 640–979px ô phạm vi một hàng ở trên;
 * < 640px ô phạm vi ở trên, 4 chỉ số 2 × 2.
 */
export default function TongQuanHeader({ data, k, kyChon, setKyChon, khoId, setKhoId, dsKho, loading, refreshing, onReload, chon, setChon, loiKetQua }) {
  const tenKho = tenKhoDangXem(khoId, dsKho);
  const gio = data?.thoiDiem ? gioPhut(data.thoiDiem) : null;
  // Vừa đổi kỳ mà số mới chưa về: dòng ngày theo kỳ vừa chọn (tính ở trình duyệt), không giữ khoảng của kỳ cũ
  const kyHien = k && k.ma === kyChon.ma && (kyChon.ma !== "tuy_chon" || !kyChon.tuNgay || (k.tu.getTime() === kyChon.tuNgay.getTime() && (!kyChon.denNgay || ngayCuaKy(k).denNgay === ngayMay(kyChon.denNgay))))
    ? k
    : khoangKy(kyChon.ma, data?.thoiDiem, kyChon.tuNgay, kyChon.denNgay);
  const [dong1, dong2] = moTaKy(kyHien);
  const nhanKy = nhanNutKy(kyChon.ma, kyHien);

  return (
    <div className="@container/dau">
      <section
        aria-label={t("Phạm vi và kết quả kinh doanh")}
        className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)] @min-[980px]/dau:flex-row"
      >
        <h1 className="sr-only">{t("Tổng quan")}</h1>

        <div
          className={cn(
            "flex min-w-0 flex-col justify-center gap-1.5 border-b border-bo-border bg-bo-surface-subtle px-4 py-3",
            "@min-[640px]/dau:flex-row @min-[640px]/dau:flex-wrap @min-[640px]/dau:items-center @min-[640px]/dau:justify-start @min-[640px]/dau:gap-x-6 @min-[640px]/dau:gap-y-2 @min-[640px]/dau:px-5",
            "@min-[980px]/dau:w-[276px] @min-[980px]/dau:shrink-0 @min-[980px]/dau:flex-col @min-[980px]/dau:flex-nowrap @min-[980px]/dau:items-stretch @min-[980px]/dau:justify-center @min-[980px]/dau:gap-1.5 @min-[980px]/dau:border-b-0 @min-[980px]/dau:border-r @min-[980px]/dau:py-3.5",
          )}
        >
          <KhoMenu dsKho={dsKho} khoId={khoId} onChange={setKhoId} disabled={loading}>
            <button
              type="button"
              aria-label={t("Chọn kho, đang xem: {{tenKho}}", { tenKho })}
              title={tenKho}
              className={cn(FOCUS, "inline-flex max-w-full cursor-pointer items-center gap-1.5 self-start rounded text-base font-semibold leading-6 text-bo-foreground hover:text-bo-primary-hover disabled:opacity-60")}
            >
              <span className="truncate">{tenKho}</span>
              <ChevronDown className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
            </button>
          </KhoMenu>

          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <KyMenu value={kyChon} onChange={setKyChon} thoiDiem={data?.thoiDiem} ngayDauDuLieu={data?.ngayDauDuLieu} kyDangXem={k}>
              <button
                type="button"
                aria-label={t("Chọn kỳ xem, đang xem: {{ky}}", { ky: nhanKy })}
                className={cn(
                  FOCUS,
                  "inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-1 rounded-md border border-bo-border bg-bo-surface px-2 text-sm font-medium text-bo-foreground shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-bo-surface-subtle",
                )}
              >
                <CalendarDays className="size-4 text-bo-muted" aria-hidden="true" />
                {nhanKy}
                <ChevronDown className="size-3.5 text-bo-muted" aria-hidden="true" />
              </button>
            </KyMenu>
            {dong1 ? (
              <span className="whitespace-nowrap text-xs tabular-nums text-bo-muted" title={`${dong1} · ${dong2}`}>
                {dong1}
              </span>
            ) : null}
          </div>

          <p className="text-xs text-bo-muted @min-[640px]/dau:ml-auto @min-[980px]/dau:ml-0" aria-live="polite">
            {gio ? t("Số liệu lúc {{gio}} · ", { gio }) : t("Đang tải số liệu… ")}
            <button
              type="button"
              onClick={onReload}
              disabled={refreshing}
              className={cn(FOCUS, "cursor-pointer rounded font-medium text-bo-primary hover:text-bo-primary-hover hover:underline disabled:cursor-default disabled:text-bo-muted disabled:no-underline")}
            >
              {refreshing && !loading ? t("Đang cập nhật…") : t("Cập nhật", { context: "lam_moi" })}
            </button>
          </p>
        </div>

        {/* Hộp giải thích, dòng kho mới mở: theo kho của số đang hiện, không theo kho vừa chọn mà số chưa về */}
        <KpiStrip data={data} k={k} khoId={data ? data.khoId ?? null : khoId} dsKho={dsKho} loading={loading} error={loiKetQua} onRetry={onReload} chon={chon} setChon={setChon} />
      </section>
    </div>
  );
}
