import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { LY_DO_CHUYEN_KE, TOI_DA_GHI_CHU } from "./chuyenKe";

/**
 * Thanh dưới cùng của màn Chuyển kệ (dính đáy vùng nội dung): tóm tắt lượt chuyển, lý do chọn nhanh bằng chip (BA: dồn
 * kệ, đón hàng mới, bảo trì), ô ghi chú thêm và nút "Xác nhận chuyển kệ". `lyDoMo`: hiện hàng chip lý do (khi đã đủ chỗ).
 */
export default function ThanhXacNhan({ tieuDe, phu, san, dangGui, lyDoMo, lyDo, onLyDo, moGhiChu, onMoGhiChu, ghiChu, onGhiChu, coVuot, onXacNhan }) {
  // Ghi chú lưu dạng "Lý do · ghi chú": phần gõ thêm chỉ còn chỗ sau lý do đã chọn
  const toiDa = TOI_DA_GHI_CHU - (lyDo ? lyDo.length + 3 : 0);
  return (
    <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-auto border-t border-bo-border bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:-mb-5 sm:px-5 lg:-mx-6 lg:-mb-6 lg:px-6">
      {lyDoMo ? (
        <div className="mb-3 grid gap-2">
          <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 sm:flex-wrap sm:overflow-visible [scrollbar-width:none]" role="group" aria-label={t("Lý do chuyển")}>
            <span className="shrink-0 whitespace-nowrap text-[13px] text-bo-muted">{t("Lý do")}</span>
            {LY_DO_CHUYEN_KE.map((x) => (
              <button
                key={x}
                type="button"
                aria-pressed={lyDo === x}
                onClick={() => onLyDo(lyDo === x ? null : x)}
                className={cn(
                  "h-7 shrink-0 whitespace-nowrap rounded-full border px-3 text-[13px]",
                  lyDo === x ? "border-bo-primary bg-bo-primary-soft font-medium text-bo-primary-strong" : "border-bo-border bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {t(x)}
              </button>
            ))}
            {!moGhiChu ? (
              <button type="button" onClick={onMoGhiChu} className="shrink-0 whitespace-nowrap text-[13px] font-medium text-bo-primary-strong hover:underline">
                {t("+ Ghi chú")}
              </button>
            ) : null}
          </div>
          {moGhiChu ? (
            <label className="grid max-w-xl gap-1">
              <span className="sr-only">{t("Ghi chú")}</span>
              <textarea
                autoFocus
                rows={2}
                value={ghiChu}
                maxLength={toiDa}
                onChange={(e) => onGhiChu(e.target.value)}
                placeholder={t("Ghi chú thêm (không bắt buộc)")}
                className={cn(O_NHAP_NHIEU_DONG, "min-h-[60px]")}
              />
              {ghiChu.length > toiDa - 40 ? (
                <span className={cn("text-right text-xs tabular-nums", ghiChu.length >= toiDa ? "text-bo-danger" : "text-bo-muted")}>
                  {t("Còn {{so}} ký tự", { so: Math.max(0, toiDa - ghiChu.length) })}
                </span>
              ) : null}
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <p className="text-sm font-semibold text-bo-heading">{tieuDe}</p>
          <p className="truncate text-[13px] text-bo-muted">{phu}</p>
          {coVuot ? <p className="text-xs text-bo-warning">{t("Có kệ đích cất vượt sức chứa (quản lý kho cho phép).")}</p> : null}
        </div>
        <Button onClick={onXacNhan} disabled={!san || dangGui} className="h-10 gap-2 bg-bo-primary px-5 text-white hover:bg-bo-primary-hover">
          {dangGui ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
          {t("Xác nhận chuyển kệ")}
        </Button>
      </div>
    </div>
  );
}
