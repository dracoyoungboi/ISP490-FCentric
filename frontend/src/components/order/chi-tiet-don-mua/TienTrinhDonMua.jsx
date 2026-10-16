import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const pad2 = (n) => String(n).padStart(2, "0");

/** "10/10" hoặc "12/10 · 09:15" (theo giờ máy người dùng, cùng cách các màn khác hiển thị ngày). */
function ngayNgan(value, coGio = false) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const ngay = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
  return coGio ? `${pad2(d.getHours())}:${pad2(d.getMinutes())} · ${ngay}` : ngay;
}

const KIEU_CHAM = {
  xong: "border-bo-primary bg-bo-primary text-white",
  dangLam: "border-bo-primary bg-white ring-4 ring-bo-primary-soft",
  chua: "border-slate-300 bg-white",
  dung: "border-bo-danger bg-bo-danger text-white",
};

const KIEU_NHAN = {
  xong: "font-medium text-bo-foreground",
  dangLam: "font-semibold text-bo-foreground",
  chua: "font-medium text-bo-muted",
  dung: "font-medium text-bo-danger",
};

/**
 * Thanh tiến trình 6 bước của đơn mua hàng (dữ liệu từ `tinhBuocDonMua`).
 * Từ md trở lên: một hàng ngang, có vạch nối; điện thoại: danh sách dọc gọn.
 */
export default function TienTrinhDonMua({ buoc }) {
  return (
    <nav aria-label="Tiến trình đơn mua hàng" className="border-t border-bo-border bg-bo-surface-subtle px-4 py-4 sm:px-6 sm:py-5">
      <ol className="flex flex-col gap-3 md:grid md:grid-cols-6 md:gap-0">
        {buoc.map((b, i) => {
          const cuoi = i === buoc.length - 1;
          const ngay = ngayNgan(b.ngay, b.ma === "gui-yeu-cau-bao-gia");
          const phu = [b.phu, ngay].filter(Boolean).join(" · ");
          return (
            <li
              key={b.ma}
              aria-current={b.trangThai === "dangLam" ? "step" : undefined}
              className="flex min-w-0 gap-3 md:block md:pr-3"
            >
              <div className="flex shrink-0 items-center md:h-6">
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-[1] inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                    KIEU_CHAM[b.trangThai] ?? KIEU_CHAM.chua,
                  )}
                >
                  {b.trangThai === "xong" ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  {b.trangThai === "dangLam" ? <span className="size-2 rounded-full bg-bo-primary" /> : null}
                  {b.trangThai === "dung" ? <X className="size-3.5" strokeWidth={3} /> : null}
                </span>
                {cuoi ? null : (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "ml-2 hidden h-0.5 flex-1 rounded-full md:block",
                      b.trangThai === "xong" ? "bg-bo-primary" : "bg-bo-border",
                    )}
                  />
                )}
              </div>
              <div className="min-w-0 md:mt-2.5">
                <div className={cn("text-[13px] leading-[18px]", KIEU_NHAN[b.trangThai] ?? KIEU_NHAN.chua)}>
                  {b.nhan}
                  <span className="sr-only">
                    {b.trangThai === "xong" ? " (đã xong)" : b.trangThai === "dangLam" ? " (đang làm)" : b.trangThai === "dung" ? " (đã dừng)" : " (chưa tới)"}
                  </span>
                </div>
                {phu || b.canhBao ? (
                  <div className="mt-0.5 text-xs leading-4 text-bo-muted tabular-nums">
                    {phu}
                    {b.canhBao ? (
                      <>
                        {phu ? " · " : ""}
                        <span className="font-medium text-bo-danger">{b.canhBao}</span>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
