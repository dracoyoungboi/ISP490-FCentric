import ScanBar from "@/components/outbound/ScanBar";
import { Progress } from "@/components/ui/progress";
import { formatQuantity } from "@/constants/outbound";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

const GOI_Y_QUET =
  t("Dùng súng quét hoặc ứng dụng quét mã (hậu tố Enter). Gõ SKU rồi nhấn Enter cũng được. Nghe tiếng rè là mã chưa được cộng.");

/**
 * Vùng quét của màn Thực hiện nhặt hàng (chỉ người được phân công), ngay dưới tiến trình: ô quét (ScanBar kiểu gọn;
 * trang gửi mã tuần tự qua useScanQueue) và thẻ "Tiến độ nhặt" — nơi duy nhất hiện tiến độ khi đang nhặt.
 * Thẻ tiến độ đứng cạnh ô quét khi KHỐI chứng từ ≥ 672px (`@2xl/khoi`); hẹp hơn (điện thoại, 768px có thanh bên) thì
 * xuống dưới để ô quét luôn đủ rộng.
 * `tienDo`: kết quả tinhTienDo (đã, cần, pct, xong).
 * `khoa` + `lyDoKhoa`: tạm tắt ô quét (vd. chờ máy chủ trả lời Hoàn tất nhặt đã quá thời hạn), câu lý do thay cho gợi ý
 * và kết quả lần quét trước.
 */
export default function VungQuet({ scanRef, onQuet, dangGui = 0, ketQua, tienDo, khoa = false, lyDoKhoa }) {
  return (
    <section
      aria-label={t("Quét mã vạch")}
      className="grid gap-x-6 gap-y-3 rounded-lg border border-bo-border bg-bo-surface px-4 py-3.5 @2xl/khoi:grid-cols-[minmax(0,1fr)_240px] @2xl/khoi:items-start max-md:gap-y-2 max-md:border-0 max-md:p-0"
    >
      <ScanBar
        ref={scanRef}
        gon
        goiY={khoa && lyDoKhoa ? lyDoKhoa : GOI_Y_QUET}
        onScan={onQuet}
        pending={dangGui}
        lastResult={khoa ? null : ketQua}
        disabled={khoa}
      />
      {/* Điện thoại: tiến độ một dòng ngay dưới ô quét (vùng quét dính đầu màn nên phải thấp) */}
      <div className="flex items-center gap-3 md:hidden">
        <span className="shrink-0 text-[13px] text-bo-muted tabular-nums">
          <b className="text-base font-semibold text-bo-heading">{formatQuantity(tienDo.da)}</b>{t("/{{can}} sản phẩm · {{pct}}%", { can: formatQuantity(tienDo.can), pct: tienDo.pct })}
        </span>
        <Progress
          value={tienDo.pct}
          aria-hidden="true"
          className={cn(
            "h-1.5 flex-1 bg-slate-200/70",
            tienDo.xong ? "[&_[data-slot=progress-indicator]]:bg-bo-success" : "[&_[data-slot=progress-indicator]]:bg-bo-primary",
          )}
        />
      </div>
      <div className="grid gap-2 rounded-lg border border-slate-100 bg-bo-surface-subtle p-3 max-md:hidden">
        <div className="text-xs font-medium leading-4 text-bo-muted">{t("Tiến độ nhặt")}</div>
        <div className="text-[22px] font-semibold leading-7 text-bo-heading tabular-nums">
          {formatQuantity(tienDo.da)}
          <span className="text-[13px] font-medium text-bo-muted">
            {t("/{{can}} sản phẩm · {{pct}}%", { can: formatQuantity(tienDo.can), pct: tienDo.pct })}
          </span>
        </div>
        <Progress
          value={tienDo.pct}
          aria-label={t("Tiến độ nhặt hàng")}
          aria-valuetext={`${tienDo.pct}%`}
          className={cn(
            "h-1.5 bg-slate-200/70",
            tienDo.xong ? "[&_[data-slot=progress-indicator]]:bg-bo-success" : "[&_[data-slot=progress-indicator]]:bg-bo-primary",
          )}
        />
      </div>
    </section>
  );
}
