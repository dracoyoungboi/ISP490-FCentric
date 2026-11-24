import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import { t } from "@/i18n";
import { tomTatPhaiTra } from "./phaiTraDonMua";

/**
 * Ô "Phải trả" của danh sách đơn mua: chỉ một con số. Đơn có điều chỉnh (trừ hàng lỗi, đóng thiếu) hoặc còn hàng lỗi chưa
 * chốt cách bù thì số có biểu tượng i đứng sau và bấm được: mở hộp cách tính. Bấm số không mở chi tiết đơn (dòng bảng
 * có onClick); bấm chỗ khác trên dòng vẫn mở như cũ.
 *
 * - `don`: DonMuaHangDto từ API danh sách (máy chủ đã điền phaiTra, giamTruLoi, khongGiao, soLoiChoChot…).
 * - `className`: lớp thêm cho số (cỡ chữ thẻ điện thoại).
 */
export default function OPhaiTra({ don, className }) {
  const [mo, setMo] = useState(false);
  const tt = tomTatPhaiTra(don);

  // Dòng không có ⓘ vẫn giữ một ô trống cùng cỡ bên phải số: số mọi dòng thẳng lề phải, ⓘ thẳng một hàng dọc
  const giuCho = <span className="size-3.5 shrink-0" aria-hidden="true" />;
  if (tt.phaiTra == null) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="font-normal text-bo-muted">—</span>
        {giuCho}
      </span>
    );
  }
  const chu = formatCurrency(tt.phaiTra);
  if (!tt.coChiTiet) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 tabular-nums", className)}>
        {chu}
        {giuCho}
      </span>
    );
  }

  const chanBam = (e) => e.stopPropagation();
  return (
    <Popover open={mo} onOpenChange={setMo}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={chanBam}
          aria-label={t("{{tien}}, xem cách tính", { tien: chu })}
          className={cn(
            "-mx-1.5 -my-0.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-semibold tabular-nums text-bo-foreground transition-colors",
            "hover:bg-bo-primary-soft hover:text-bo-primary data-[state=open]:bg-bo-primary-soft data-[state=open]:text-bo-primary",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary",
            "group",
            className,
          )}
        >
          {chu}
          <Info className="size-3.5 shrink-0 text-slate-400 group-hover:text-bo-primary group-data-[state=open]:text-bo-primary" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        onClick={chanBam}
        aria-label={t("Cách tính phải trả {{ma}}", { ma: don?.soDonMua || "" })}
        className="w-[300px] max-w-[calc(100vw-32px)] rounded-[10px] border-bo-border bg-bo-surface p-3.5 text-bo-foreground shadow-[0_16px_40px_-12px_rgba(16,24,40,0.28),0_2px_6px_rgba(16,24,40,0.06)]"
      >
        <p className="mb-2 text-xs font-semibold text-bo-muted">{t("Phải trả {{ma}}", { ma: don?.soDonMua || "" })}</p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[13px] leading-5 tabular-nums">
          <dt className="text-bo-muted">{t("Tiền theo số đặt")}</dt>
          <dd className="text-right">{formatCurrency(tt.tienTheoDat)}</dd>
          {tt.giamTruLoi > 0 ? (
            <>
              <dt className="text-bo-muted">{t("Giảm trừ {{n}} sản phẩm lỗi", { n: formatNumber(tt.soLoiTruTien) })}</dt>
              <dd className="text-right text-bo-tt-chu-y-chu">−{formatCurrency(tt.giamTruLoi)}</dd>
            </>
          ) : null}
          {tt.khongGiao > 0 ? (
            <>
              <dt className="text-bo-muted">{t("Không giao, đã đóng đơn ({{count}} sản phẩm)", { count: tt.soKhongGiao })}</dt>
              <dd className="text-right text-bo-tt-chu-y-chu">−{formatCurrency(tt.khongGiao)}</dd>
            </>
          ) : null}
          <dt className="border-t border-bo-border pt-1.5 font-semibold">{t("Phải trả nhà cung cấp")}</dt>
          <dd className="border-t border-bo-border pt-1.5 text-right font-semibold">{chu}</dd>
        </dl>
        {tt.soLoiChoChot > 0 ? (
          <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-4 text-bo-tt-chu-y-chu">
            <Clock className="mt-px size-3 shrink-0" aria-hidden="true" />
            {t("{{count}} sản phẩm lỗi chưa chốt cách bù với nhà cung cấp. Nếu nhà cung cấp chọn trừ tiền, số phải trả sẽ giảm.", { count: tt.soLoiChoChot })}
          </p>
        ) : null}
        {don?.id != null ? (
          <Link
            to={`/purchase-orders/${don.id}`}
            className="mt-2.5 inline-block text-xs font-semibold text-bo-primary hover:underline"
          >
            {t("Mở chi tiết đơn")}
          </Link>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
