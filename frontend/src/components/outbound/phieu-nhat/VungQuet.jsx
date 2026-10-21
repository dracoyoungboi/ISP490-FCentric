import ScanBar from "@/components/outbound/ScanBar";
import { Progress } from "@/components/ui/progress";
import { formatQuantity } from "@/constants/outbound";
import { cn } from "@/lib/utils";

const GOI_Y_QUET =
  "Dùng súng quét hoặc ứng dụng quét mã (hậu tố Enter). Gõ SKU rồi nhấn Enter cũng được. Nghe tiếng rè là mã chưa được cộng.";

/**
 * Vùng quét của màn Thực hiện nhặt hàng (chỉ người được phân công), ngay dưới tiến trình: ô quét (ScanBar kiểu gọn;
 * trang gửi mã tuần tự qua useScanQueue) và thẻ "Tiến độ nhặt" — nơi duy nhất hiện tiến độ khi đang nhặt.
 * Thẻ tiến độ đứng cạnh ô quét khi KHỐI chứng từ ≥ 672px (`@2xl/khoi`); hẹp hơn (điện thoại, 768px có thanh bên) thì
 * xuống dưới để ô quét luôn đủ rộng.
 * `tienDo`: kết quả tinhTienDo (đã, cần, pct, xong).
 */
export default function VungQuet({ scanRef, onQuet, dangGui = 0, ketQua, tienDo }) {
  return (
    <section
      aria-label="Quét mã vạch"
      className="grid gap-x-6 gap-y-3 rounded-lg border border-bo-border bg-white px-4 py-3.5 @2xl/khoi:grid-cols-[minmax(0,1fr)_240px] @2xl/khoi:items-start"
    >
      <ScanBar ref={scanRef} gon goiY={GOI_Y_QUET} onScan={onQuet} pending={dangGui} lastResult={ketQua} />
      <div className="grid gap-2 rounded-lg border border-slate-100 bg-bo-surface-subtle p-3">
        <div className="text-xs font-medium leading-4 text-bo-muted">Tiến độ nhặt</div>
        <div className="text-[22px] font-semibold leading-7 text-bo-heading tabular-nums">
          {formatQuantity(tienDo.da)}
          <span className="text-[13px] font-medium text-bo-muted">
            /{formatQuantity(tienDo.can)} sản phẩm · {tienDo.pct}%
          </span>
        </div>
        <Progress
          value={tienDo.pct}
          aria-label="Tiến độ nhặt hàng"
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
