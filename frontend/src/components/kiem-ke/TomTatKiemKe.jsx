import { CircleCheck, EyeOff, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { tienCoDau } from "./kiemKe";

function O({ icon: Icon, nhan, so, phu, mau, children }) {
  return (
    <div className="min-w-0 rounded-lg border border-bo-border bg-bo-surface px-3 py-2.5 @2xl/khoi:px-3.5 @2xl/khoi:py-3">
      <span className="flex items-center gap-1.5 text-xs font-medium leading-4 text-bo-muted">
        {Icon ? <Icon className={cn("size-3.5", mau)} aria-hidden="true" /> : null}
        {nhan}
      </span>
      <span className={cn("mt-1 block text-lg font-semibold leading-6 tabular-nums text-bo-heading @2xl/khoi:text-xl @2xl/khoi:leading-7", mau)}>{so}</span>
      {phu ? <span className="block truncate text-xs leading-4 text-bo-muted tabular-nums">{phu}</span> : null}
      {children}
    </div>
  );
}

/**
 * Dải tổng hợp trên bảng đếm: tiến độ, dòng khớp, thiếu, thừa (số sản phẩm · giá trị theo giá vốn chốt lúc bắt đầu).
 * `tk`: kiemKe.thongKeDong (đã gộp phần đang gõ nên đổi ngay khi nhập). Đếm mù: chỉ còn tiến độ.
 * `coRong`: thêm ô Chênh lệch ròng (chờ duyệt / đã duyệt — lúc số đếm đã chốt).
 */
export default function TomTatKiemKe({ tk, mu = false, coRong = false, className }) {
  const xong = tk.tong > 0 && tk.chua === 0;
  const hienRong = coRong && !mu;
  return (
    <div
      className={cn(
        "grid gap-2.5 px-4 pt-5 sm:px-6",
        mu ? "grid-cols-1 @2xl/khoi:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" : hienRong ? "grid-cols-2 @3xl/khoi:grid-cols-5" : "grid-cols-2 @3xl/khoi:grid-cols-4",
        className,
      )}
    >
      <O
        nhan="Tiến độ đếm"
        so={
          <>
            {soVN(tk.daDem)}
            <span className="text-sm font-medium text-bo-muted">/{soVN(tk.tong)} dòng</span>
          </>
        }
      >
        <span
          role="progressbar"
          aria-label="Tiến độ đếm"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={tk.phanTram}
          className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-200/80"
        >
          <span
            className={cn("block h-full rounded-full transition-[width] duration-300", xong ? "bg-bo-success" : "bg-bo-primary")}
            // data-viz: bề rộng theo phần trăm dòng đã đếm
            style={{ width: `${tk.phanTram}%` }}
          />
        </span>
      </O>
      {mu ? (
        <div className="flex min-w-0 items-start gap-2.5 rounded-lg border border-dashed border-bo-border bg-bo-surface-subtle px-3.5 py-3 text-[13px] leading-5 text-slate-700">
          <EyeOff className="mt-0.5 size-4 shrink-0 text-bo-muted" aria-hidden="true" />
          <span>
            <b className="font-semibold text-bo-foreground">Đang đếm mù.</b> Số trên sổ và chênh lệch được ẩn để không ảnh hưởng
            người đếm. Tắt công tắc Đếm mù để xem.
          </span>
        </div>
      ) : (
        <>
          <O icon={CircleCheck} nhan="Khớp sổ" so={soVN(tk.daDem - tk.lech)} phu="dòng" mau="text-bo-success" />
          <O
            icon={TrendingDown}
            nhan="Thiếu"
            so={tk.thieu ? `−${soVN(tk.thieu)}` : "0"}
            phu={tk.thieu ? `sản phẩm · ${tienCoDau(-Math.abs(tk.giaTriThieu ?? 0))}` : "sản phẩm"}
            mau={tk.thieu ? "text-bo-danger" : undefined}
          />
          <O
            icon={TrendingUp}
            nhan="Thừa"
            so={tk.thua ? `+${soVN(tk.thua)}` : "0"}
            phu={tk.thua ? `sản phẩm · ${tienCoDau(Math.abs(tk.giaTriThua ?? 0))}` : "sản phẩm"}
            mau={tk.thua ? "text-bo-primary-strong" : undefined}
          />
          {hienRong ? (
            // Con số người thẩm định cần nhất; chiếm 2 cột trên khối hẹp
            <div className="col-span-2 @3xl/khoi:col-span-1">
              <O
                icon={Scale}
                nhan="Chênh lệch ròng"
                so={tienCoDau(tk.giaTri)}
                phu="theo giá vốn lúc chốt sổ"
                mau={tk.giaTri < 0 ? "text-bo-danger" : tk.giaTri > 0 ? "text-bo-primary-strong" : undefined}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
