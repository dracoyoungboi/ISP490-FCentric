import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// 5 ô: rộng thì một hàng; hẹp thì 2 cột, ô cuối (Còn phải thu) trải hết hàng thứ ba
const O_LOP =
  "min-w-0 border-bo-border/70 px-4 py-3.5 odd:border-r @max-5xl:[&:nth-child(-n+4)]:border-b @max-5xl:last:col-span-2 @max-5xl:last:border-r-0 sm:px-6 sm:py-4 @5xl:border-r @5xl:last:border-r-0";

function DangTai() {
  return (
    <div className="@container border-t border-bo-border bg-bo-surface-subtle" aria-busy="true" aria-label="Đang tải tình hình mua hàng">
      <div className="grid grid-cols-2 @5xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={O_LOP}>
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            <div className="mt-2.5 h-6 w-28 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Dải "Tình hình mua hàng" ngay dưới đầu khối (cùng kiểu dải "Tình hình hợp tác" bên Chi tiết nhà cung cấp):
 * 5 ô tính sẵn bằng `tinhKpi`. 5 ô một hàng khi khối đủ rộng (container query), hẹp thì 2 cột (ô cuối trải hết hàng).
 * Lỗi tải: các ô hiện "—" kèm "Không tải được" và nút Thử lại ở ô cuối, không chặn phần còn lại của trang.
 */
export default function TinhHinhMuaHang({ kpi, dangTai, loi, onThuLai }) {
  if (dangTai) return <DangTai />;

  return (
    <section aria-label="Tình hình mua hàng" className="@container border-t border-bo-border bg-bo-surface-subtle">
      <div className="grid grid-cols-2 @5xl:grid-cols-5">
        {kpi.map((o, i) => {
          const coGiaTri = !loi && o.coGiaTri;
          let phu = o.phu;
          if (loi) {
            phu =
              i === kpi.length - 1 ? (
                <>
                  Không tải được ·{" "}
                  <button
                    type="button"
                    onClick={onThuLai}
                    className="font-medium text-bo-primary hover:text-bo-primary-hover hover:underline"
                  >
                    Thử lại
                  </button>
                </>
              ) : (
                "Không tải được"
              );
          } else if (o.donGanNhat) {
            phu = (
              <>
                {o.phu} ·{" "}
                <Link
                  to={`/sales-orders/${o.donGanNhat.id}`}
                  className="font-mono font-medium text-bo-primary hover:text-bo-primary-hover hover:underline"
                >
                  {o.donGanNhat.soDonHang || `#${o.donGanNhat.id}`}
                </Link>
              </>
            );
          }
          return (
            <div key={o.ma} className={O_LOP}>
              <div className="text-xs font-medium leading-4 text-bo-muted">{o.nhan}</div>
              <div
                className={cn(
                  "mt-1 truncate text-lg font-bold leading-7 tracking-tight tabular-nums sm:text-xl",
                  coGiaTri ? "text-bo-heading" : "text-slate-400",
                )}
                title={coGiaTri ? o.giaTri : undefined}
              >
                {coGiaTri ? o.giaTri : "—"}
              </div>
              <div className="mt-1 text-xs leading-4 text-bo-muted">{phu}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
