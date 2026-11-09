import { CircleCheck, Info, MapPin, ScanBarcode, TriangleAlert, X } from "lucide-react";
import { NutChu } from "@/components/chung-tu/DongThongBao";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

// Phản hồi lần quét: ô nền nhạt theo kết quả, chữ 15px — người cầm máy quét đứng cách màn hình vẫn thấy đã cộng chưa
const KIEU_PHAN_HOI = {
  ok: { icon: CircleCheck, mau: "text-bo-success", khung: "border-bo-success/30 bg-bo-success-soft" },
  canhBao: { icon: TriangleAlert, mau: "text-bo-warning", khung: "border-amber-300/70 bg-bo-warning-soft" },
  loi: { icon: TriangleAlert, mau: "text-bo-danger", khung: "border-bo-danger/25 bg-bo-danger-soft" },
  thongTin: { icon: Info, mau: "text-bo-primary", khung: "border-bo-primary/25 bg-bo-primary-soft" },
};

/**
 * Thanh quét dính đầu màn khi đếm (vùng `dinh` của KhungChungTu): quét mã kệ để đếm theo kệ, quét tem lô / SKU để cộng 1,
 * gõ "12*LO100" để cộng 12 (mẹo hiện ở dòng phản hồi khi chưa quét). Màn xử lý mã (`onQuet(chu)`), thanh chỉ vẽ ô quét,
 * kệ đang đếm và câu phản hồi lần quét cuối.
 *
 * - `phanHoi`: `{ kieu: "ok" | "canhBao" | "loi" | "thongTin", chu, nhanNut?, onNut? }` — đọc tự động bằng trình đọc màn hình.
 * - `lanQuet`: đếm số lần quét, đổi mỗi lần để khung phản hồi hiện lại dù câu giống lần trước.
 * - `keDangDem`: `{ ma }` kệ đang lọc; `onBoKe` bỏ lọc kệ.
 */
export default function ThanhQuetKiemKe({ oQuetRef, giaTri, onDoi, onQuet, phanHoi, lanQuet = 0, keDangDem, onBoKe, khoa = false }) {
  const k = phanHoi ? KIEU_PHAN_HOI[phanHoi.kieu] ?? KIEU_PHAN_HOI.thongTin : null;
  const Icon = k?.icon;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-[220px] flex-1 items-center">
          <span className="sr-only">{t("Quét mã kệ, tem lô hoặc SKU")}</span>
          <ScanBarcode className="pointer-events-none absolute left-3 size-[18px] text-bo-primary" aria-hidden="true" />
          <input
            ref={oQuetRef}
            type="text"
            autoComplete="off"
            enterKeyHint="go"
            disabled={khoa}
            value={giaTri}
            onChange={(e) => onDoi(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              onQuet(giaTri);
            }}
            placeholder={t("Quét mã kệ, tem lô hoặc SKU")}
            className="h-11 w-full rounded-lg border border-bo-input-border bg-white pl-10 pr-3 text-[15px] text-bo-foreground outline-none placeholder:text-[13px] placeholder:text-slate-500 focus:border-bo-primary focus:ring-[3px] focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle"
          />
        </label>
        {keDangDem ? (
          <span className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-bo-primary/30 bg-bo-primary-soft pl-3 pr-1.5 text-[13px] font-semibold text-bo-primary-strong">
            <MapPin className="size-4" aria-hidden="true" />
            <span className="whitespace-nowrap">
              {t("Đang đếm kệ")} <span className="font-mono">{keDangDem.ma}</span>
            </span>
            <button
              type="button"
              aria-label={t("Bỏ kệ đang đếm")}
              onClick={onBoKe}
              className="grid size-8 place-items-center rounded-md hover:bg-bo-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </div>
      <div role="status" aria-live="polite">
        {phanHoi ? (
          // key đổi mỗi lần quét: khung hiện lại (mờ dần vào) kể cả khi câu giống lần trước
          <p
            key={lanQuet}
            className={cn(
              "flex min-h-11 items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[15px] font-medium leading-6 text-bo-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300",
              k.khung,
            )}
          >
            <Icon className={cn("mt-0.5 size-5 shrink-0", k.mau)} aria-hidden="true" />
            <span className="min-w-0">
              {phanHoi.chu}
              {phanHoi.nhanNut && phanHoi.onNut ? (
                <>
                  {" "}
                  <NutChu onClick={phanHoi.onNut} className="text-sm">
                    {phanHoi.nhanNut}
                  </NutChu>
                </>
              ) : null}
            </span>
          </p>
        ) : (
          <p className="flex min-h-5 items-start text-[13px] leading-5 text-bo-muted">
            <span>
              {t("Mẹo: gõ")} <kbd className="rounded border border-bo-border bg-bo-surface-subtle px-1 font-mono text-xs">{t("12*mã")}</kbd> {t("rồi Enter để cộng 12 sản phẩm một lần.")}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
