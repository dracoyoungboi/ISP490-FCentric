import { useRef, useState } from "react";
import { Check, ChevronUp, CircleCheck, Loader2, Tag, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { LY_DO_CHUYEN_KE, TOI_DA_GHI_CHU } from "./chuyenKe";

/**
 * Nút "Lý do": mở danh sách lý do chọn nhanh (BA: dồn kệ, đón hàng mới, bảo trì) và ô ghi chú thêm. Lý do lưu bằng
 * tiếng Việt (ghép "Lý do · ghi chú" khi gửi), dịch lúc hiện. Đóng hộp thì trả tiêu điểm về ô quét (`onDong`).
 */
function NutLyDo({ lyDo, onLyDo, ghiChu, onGhiChu, onDong }) {
  const [mo, setMo] = useState(false);
  // Đóng do bấm ra ngoài (vd. vào ô số lượng): để tiêu điểm ở chỗ vừa bấm, không kéo về ô quét
  const bamNgoai = useRef(false);
  const dsLyDoRef = useRef(null);
  // Ghi chú lưu dạng "Lý do · ghi chú": phần gõ thêm chỉ còn chỗ sau lý do đã chọn
  const toiDa = TOI_DA_GHI_CHU - (lyDo ? lyDo.length + 3 : 0);
  const coGhiChu = Boolean(ghiChu.trim());
  return (
    <Popover open={mo} onOpenChange={setMo}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={lyDo ? t("Lý do: {{lyDo}}", { lyDo: t(lyDo) }) : t("Thêm lý do")}
          className={cn(
            "h-10 max-w-[240px] gap-2 border-bo-border bg-bo-surface px-3 hover:bg-bo-surface-subtle",
            lyDo || coGhiChu ? "text-bo-foreground" : "text-bo-muted",
            mo && "border-bo-primary",
          )}
        >
          <Tag className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
          <span className="min-w-0 truncate">
            {lyDo ? (
              <>
                <span className="text-bo-muted max-sm:hidden">{t("Lý do:")} </span>
                {t(lyDo)}
              </>
            ) : coGhiChu ? (
              t("Có ghi chú")
            ) : (
              t("Thêm lý do")
            )}
          </span>
          {lyDo && coGhiChu ? <span className="size-1.5 shrink-0 rounded-full bg-bo-primary" title={t("Có ghi chú")} aria-hidden="true" /> : null}
          <ChevronUp className={cn("size-4 shrink-0 text-bo-muted transition-transform", !mo && "rotate-180")} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-[300px] max-w-[calc(100vw-32px)] bg-white p-1.5"
        onOpenAutoFocus={(e) => {
          // Tiêu điểm vào lý do đang chọn (chưa chọn: lý do đầu)
          e.preventDefault();
          bamNgoai.current = false;
          (dsLyDoRef.current?.querySelector('[aria-checked="true"]') ?? dsLyDoRef.current?.querySelector('[role="radio"]'))?.focus();
        }}
        onInteractOutside={() => {
          bamNgoai.current = true;
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (!bamNgoai.current) onDong?.();
        }}
      >
        <div role="radiogroup" aria-label={t("Lý do chuyển")} ref={dsLyDoRef}>
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t("Lý do chuyển")}</p>
          {LY_DO_CHUYEN_KE.map((x) => {
            const chon = lyDo === x;
            return (
              <button
                key={x}
                type="button"
                role="radio"
                aria-checked={chon}
                // Bấm lại lý do đang chọn để bỏ chọn. Chọn xong thì đóng hộp, tiêu điểm về ô quét: máy quét gõ tiếp
                // không rơi vào nút lý do (Enter của máy quét sẽ bấm lại nút, bỏ mất lý do). Ghi chú: mở lại nút.
                onClick={() => {
                  onLyDo(chon ? null : x);
                  setMo(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm",
                  chon ? "bg-bo-primary-soft font-medium text-bo-primary-strong" : "text-bo-foreground hover:bg-bo-surface-subtle",
                )}
              >
                <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border", chon ? "border-bo-primary" : "border-slate-300")} aria-hidden="true">
                  {chon ? <span className="size-2 rounded-full bg-bo-primary" /> : null}
                </span>
                {t(x)}
              </button>
            );
          })}
        </div>
        <div className="mx-1 my-1.5 border-t border-bo-border" />
        <label className="grid gap-1 px-1.5 pb-1">
          <span className="text-[13px] text-bo-muted">{t("Ghi chú thêm")}</span>
          <textarea
            rows={2}
            value={ghiChu}
            maxLength={toiDa}
            onChange={(e) => onGhiChu(e.target.value)}
            placeholder={t("Không bắt buộc")}
            className={cn(O_NHAP_NHIEU_DONG, "min-h-[60px]")}
          />
          {ghiChu.length > toiDa - 40 ? (
            <span className={cn("text-right text-xs tabular-nums", ghiChu.length >= toiDa ? "text-bo-danger" : "text-bo-muted")}>
              {t("Còn {{so}} ký tự", { so: Math.max(0, toiDa - ghiChu.length) })}
            </span>
          ) : null}
        </label>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Chân khối lượt chuyển (dính đáy khi khối dài hơn màn hình): tiến độ "đã có kệ đích", nút Lý do và nút
 * "Xác nhận chuyển kệ". `tong`: số đang chọn; `coCho`: số đã có kệ đích; `coVuot`: có kệ cất vượt sức chứa.
 */
export default function ThanhXacNhan({ tong, coCho, san, dangGui, coVuot, lyDo, onLyDo, ghiChu, onGhiChu, onDongLyDo, onXacNhan }) {
  const du = tong > 0 && coCho >= tong;
  const phanTram = tong > 0 ? Math.min(100, (coCho / tong) * 100) : 0;
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-b-lg border-t border-bo-border bg-bo-surface px-4 py-3 shadow-[0_-8px_16px_-14px_rgba(15,30,60,.4)]">
      <div className="min-w-0 flex-1 sm:min-w-[240px] sm:flex-none">
        {tong > 0 ? (
          <>
            <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
              <span className={cn("font-semibold tabular-nums", du ? (coVuot ? "text-bo-warning" : "text-bo-success") : "text-bo-heading")}>
                {soVN(coCho)}/{soVN(tong)}
              </span>
              <span className={du && !coVuot ? "text-bo-success" : "text-bo-muted"}>{t("sản phẩm đã có kệ đích", { count: tong })}</span>
              {du ? (
                coVuot ? (
                  <span className="inline-flex items-center gap-1 text-bo-warning">
                    <TriangleAlert className="size-4" aria-hidden="true" />
                    {t("có kệ cất vượt sức chứa")}
                  </span>
                ) : (
                  <CircleCheck className="size-4 text-bo-success" aria-hidden="true" />
                )
              ) : null}
            </p>
            <div
              className="mt-1.5 h-1.5 w-64 max-w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={tong}
              aria-valuenow={coCho}
              aria-label={t("sản phẩm đã có kệ đích", { count: tong })}
            >
              <span
                className={cn("block h-full rounded-full transition-[width]", du ? (coVuot ? "bg-amber-500" : "bg-bo-success") : "bg-bo-primary")}
                style={{ width: `${coCho > 0 ? Math.max(3, phanTram) : 0}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-bo-muted">{t("Chưa chọn hàng")}</p>
        )}
      </div>
      <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
        {tong > 0 ? <NutLyDo lyDo={lyDo} onLyDo={onLyDo} ghiChu={ghiChu} onGhiChu={onGhiChu} onDong={onDongLyDo} /> : null}
        <Button onClick={onXacNhan} disabled={!san || dangGui} className="h-10 flex-1 gap-2 bg-bo-primary px-5 text-white hover:bg-bo-primary-hover sm:flex-none max-sm:h-11">
          {dangGui ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
          {t("Xác nhận chuyển kệ")}
        </Button>
      </div>
    </div>
  );
}
