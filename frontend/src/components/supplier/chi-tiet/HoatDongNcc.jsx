import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatDateTime, formatNumber } from "@/utils/formatters";

const LIEN_KET = "font-semibold text-bo-primary hover:text-bo-primary-hover hover:underline";

/** Đơn đã chốt mở trang đơn mua; còn là báo giá thì mở trang báo giá. */
const duongDanDon = (s) => ([3, 5].includes(s.trangThai) ? `/purchase-orders/${s.donId}` : `/quotation/${s.donId}`);

function NoiDung({ s }) {
  if (s.loai === "guiYeuCau") {
    return (
      <>
        <span className="font-semibold text-bo-foreground">Gửi yêu cầu báo giá </span>
        <Link to={duongDanDon(s)} className={LIEN_KET}>
          {s.ma}
        </Link>
        {s.soSanPham > 0 ? <span className="text-slate-700"> · {formatNumber(s.soSanPham)} sản phẩm</span> : null}
      </>
    );
  }
  if (s.loai === "nhapKho") {
    return (
      <>
        <span className="font-semibold text-bo-foreground">Nhập kho </span>
        <Link to={`/goods-receipts/${s.phieuId}`} className={LIEN_KET}>
          {s.ma}
        </Link>
        {s.soDonMua ? (
          <span className="text-slate-700">
            {" · đơn "}
            {s.donId ? (
              <Link to={`/purchase-orders/${s.donId}`} className="text-bo-primary hover:text-bo-primary-hover hover:underline">
                {s.soDonMua}
              </Link>
            ) : (
              s.soDonMua
            )}
          </span>
        ) : null}
        {s.tenKho ? <span className="text-slate-700"> · {s.tenKho}</span> : null}
      </>
    );
  }
  return <span className="font-semibold text-bo-foreground">Tạo nhà cung cấp{s.ma ? ` ${s.ma}` : ""}</span>;
}

const MAU_CHAM = {
  guiYeuCau: "bg-bo-primary",
  nhapKho: "bg-bo-success",
  taoNcc: "bg-slate-400",
};

/** Tab "Hoạt động": dòng thời gian từ ngày trên chứng từ (`dungHoatDong`), mới nhất trên cùng. */
export default function HoatDongNcc({ suKien }) {
  return (
    <ol className="px-4 pb-1 pt-4 sm:px-6">
      {suKien.map((s, i) => (
        <li key={s.khoa} className="relative flex gap-3.5 pb-4">
          <span
            aria-hidden="true"
            className={cn(
              "relative z-[1] mt-[5px] size-2.5 shrink-0 rounded-full ring-2 ring-white outline outline-1 outline-slate-300",
              MAU_CHAM[s.loai],
            )}
          />
          {i < suKien.length - 1 ? (
            <span aria-hidden="true" className="absolute bottom-0 left-[4.5px] top-4 w-px bg-bo-border" />
          ) : null}
          <div className="min-w-0 flex-1 text-sm leading-5">
            <div className="break-words">
              <NoiDung s={s} />
            </div>
            <div className="mt-0.5 text-xs leading-4 tabular-nums text-bo-muted">
              {formatDateTime(s.ngay)}
              {s.nguoi ? ` · ${s.nguoi}` : ""}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
