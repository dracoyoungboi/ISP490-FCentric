import { useContext, useId, useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LocTrongSheetContext } from "@/components/shared/locTrongSheet";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { dsKy, loiKhoangNgayLoc, nhanKhoangNgay, ngayMay } from "@/components/shared/khoangNgayLoc";

function NoiDung({ id, tuNgay, denNgay, onChon, dong, trongSheet }) {
  const kyChon = dsKy().find((k) => k.tuNgay === tuNgay && k.denNgay === denNgay)?.ma ?? null;
  // Đang lọc theo kỳ nhanh thì hai ô ngày để trống: điền sẵn ngày của kỳ dễ tưởng đó là khoảng tùy chọn đang áp
  const [nhap, setNhap] = useState(kyChon === null ? { tuNgay, denNgay } : { tuNgay: "", denNgay: "" });
  const [daBam, setDaBam] = useState(false);
  const loi = loiKhoangNgayLoc(nhap.tuNgay, nhap.denNgay);
  const hom = ngayMay(new Date());
  const hienLoi = daBam && Boolean(loi);
  const apDung = () => {
    setDaBam(true);
    if (loi) return;
    onChon(nhap);
    dong?.();
  };
  const doi = (truong) => (e) => {
    setDaBam(false);
    setNhap((p) => ({ ...p, [truong]: e.target.value }));
  };
  const O_NGAY = cn(
    "w-full min-w-0 rounded-md border bg-bo-surface px-2.5 text-sm tabular-nums text-bo-foreground focus:outline-none focus:ring-2 focus:ring-bo-primary/15",
    trongSheet ? "h-10" : "h-9",
    hienLoi ? "border-red-500 focus:border-red-500" : "border-bo-input-border focus:border-bo-primary",
  );
  const NHAN_O = trongSheet ? "text-sm text-bo-foreground" : "text-[13px] text-bo-foreground";

  return (
    <div className={cn("grid", trongSheet ? "gap-4" : "")}>
      <div
        className={cn("grid", trongSheet ? "overflow-hidden rounded-lg border border-bo-border" : "gap-0.5")}
        role="group"
        aria-label={t("Kỳ nhanh")}
      >
        {dsKy().map((k) => {
          const chon = kyChon === k.ma;
          return (
            <button
              key={k.ma || "tat-ca"}
              type="button"
              onClick={() => {
                onChon({ tuNgay: k.tuNgay, denNgay: k.denNgay });
                dong?.();
              }}
              aria-pressed={chon}
              className={cn(
                "flex items-center justify-between text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary",
                trongSheet
                  ? "min-h-12 border-t border-bo-border px-3.5 text-[15px] first:border-t-0"
                  : "h-8 rounded-md px-2.5 text-sm",
                chon
                  ? "bg-bo-primary-soft font-medium text-bo-primary-strong"
                  : cn("text-slate-700", !trongSheet && "hover:bg-slate-100"),
              )}
            >
              {k.ten}
              {chon ? <Check className="size-4 shrink-0 text-bo-primary" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      <div className={cn("grid gap-2.5", !trongSheet && "-mx-1.5 mt-1.5 border-t border-bo-border px-3 pb-1.5 pt-2.5")}>
        <p className="text-xs font-semibold text-bo-muted">{t("Khoảng tùy chọn")}</p>
        <div className="grid gap-1">
          <label htmlFor={`${id}-tu`} className={NHAN_O}>{t("Từ ngày")}</label>
          <input
            id={`${id}-tu`}
            type="date"
            min="2000-01-01"
            max={nhap.denNgay || hom}
            value={nhap.tuNgay}
            onChange={doi("tuNgay")}
            onKeyDown={(e) => e.key === "Enter" && apDung()}
            aria-invalid={hienLoi || undefined}
            aria-describedby={hienLoi ? `${id}-loi` : undefined}
            className={O_NGAY}
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${id}-den`} className={NHAN_O}>{t("Đến ngày")}</label>
          <input
            id={`${id}-den`}
            type="date"
            min={nhap.tuNgay || "2000-01-01"}
            max={hom}
            value={nhap.denNgay}
            onChange={doi("denNgay")}
            onKeyDown={(e) => e.key === "Enter" && apDung()}
            aria-invalid={hienLoi || undefined}
            aria-describedby={hienLoi ? `${id}-loi` : undefined}
            className={O_NGAY}
          />
        </div>
        {hienLoi ? (
          <p id={`${id}-loi`} role="alert" className="-mt-1 text-xs text-red-600">{loi}</p>
        ) : null}
        <Button
          type="button"
          onClick={apDung}
          className={cn(
            "mt-0.5 w-full bg-bo-primary text-sm font-semibold text-white hover:bg-bo-primary-hover",
            trongSheet ? "h-10" : "h-9",
          )}
        >
          {t("Áp dụng")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Ô lọc khoảng ngày dùng chung cho thanh lọc các màn danh sách: nút "Ngày tạo: Tháng này" mở hộp kỳ nhanh (Hôm nay,
 * 7 ngày qua, Tháng này, Tháng trước) và khoảng tùy chọn có kiểm (từ ≤ đến, không sau hôm nay, bỏ trống một đầu được).
 * Giá trị là chuỗi yyyy-mm-dd ("" = không giới hạn đầu đó); `onDoi({ tuNgay, denNgay })` chỉ gọi khi hợp lệ.
 * Bỏ lọc bằng "Tất cả thời gian" hoặc nút "Xóa lọc" của thanh lọc, nên ô không có × riêng (giống các ô chọn khác).
 * Trong sheet "Bộ lọc" (điện thoại) hiện thẳng danh sách kỳ và hai ô ngày; ListToolbar tạo chip bỏ lọc.
 */
export default function LocKhoangNgay({ nhan, tuNgay = "", denNgay = "", onDoi, className }) {
  const id = useId();
  const [mo, setMo] = useState(false);
  const trongSheet = useContext(LocTrongSheetContext);
  const dangLoc = Boolean(tuNgay || denNgay);
  const chu = nhanKhoangNgay(tuNgay, denNgay);

  if (trongSheet) {
    return (
      <fieldset className="min-w-0">
        <legend className="mb-2 text-[13px] font-semibold text-bo-muted">{nhan}</legend>
        <NoiDung key={`${tuNgay}|${denNgay}`} id={id} tuNgay={tuNgay} denNgay={denNgay} onChon={onDoi} trongSheet />
      </fieldset>
    );
  }

  return (
    <Popover open={mo} onOpenChange={setMo}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={`${nhan}: ${chu}`}
          className={cn(
            "h-9 w-full justify-between gap-2 border-bo-border bg-bo-surface px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle sm:w-auto sm:min-w-[190px]",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays className="size-4 shrink-0 opacity-70" aria-hidden="true" />
            <span className="shrink-0 text-bo-muted">{nhan}:</span>
            <span className={cn("truncate tabular-nums", dangLoc && "font-semibold text-bo-primary-strong")}>{chu}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-64 border-bo-border bg-bo-surface p-1.5 text-bo-foreground shadow-lg">
        {mo ? <NoiDung id={id} tuNgay={tuNgay} denNgay={denNgay} onChon={onDoi} dong={() => setMo(false)} /> : null}
      </PopoverContent>
    </Popover>
  );
}
