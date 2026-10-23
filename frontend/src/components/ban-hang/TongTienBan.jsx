import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * Dải tổng tiền dưới bảng hàng của đơn bán / báo giá bán: bên trái `trai` (thanh toán, câu ghi chú), bên phải các dòng
 * `muc: [{ ma, nhan, giaTri, tong }]` (`tong`: dòng Tổng cộng, chữ lớn, có vạch trên). `chuThich`: câu nhỏ dưới tổng
 * (vd. tiền hàng + phí khác tổng cộng). Số hiện nguyên như máy chủ trả, màn không tự cộng.
 */
export default function TongTienBan({ trai, muc, chuThich, className }) {
  const ds = (Array.isArray(muc) ? muc : []).filter(Boolean);
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-8 gap-y-4 border-t border-bo-border px-4 pb-5 pt-4 sm:px-6",
        className,
      )}
    >
      {trai ? <div className="min-w-0 max-w-[360px] text-[13px] leading-5 text-bo-muted">{trai}</div> : null}
      <div className="ml-auto grid gap-1.5 max-sm:ml-0 max-sm:w-full">
        <dl className="m-0 grid grid-cols-[auto_minmax(140px,auto)] gap-x-10 gap-y-2 text-sm leading-5">
          {ds.map((m) => (
            <Fragment key={m.ma ?? m.nhan}>
              <dt className={cn(m.tong ? "border-t border-bo-border pt-2.5 text-base font-semibold leading-6 text-bo-heading" : "text-bo-muted")}>
                {m.nhan}
              </dt>
              <dd
                className={cn(
                  "m-0 text-right tabular-nums text-bo-foreground",
                  m.tong && "border-t border-bo-border pt-2.5 text-lg font-semibold leading-6 text-bo-heading",
                )}
              >
                {m.giaTri}
              </dd>
            </Fragment>
          ))}
        </dl>
        {chuThich ? <p className="m-0 text-right text-xs leading-4 text-bo-muted">{chuThich}</p> : null}
      </div>
    </div>
  );
}
