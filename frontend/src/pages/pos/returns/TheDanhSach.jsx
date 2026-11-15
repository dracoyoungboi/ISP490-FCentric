import { RefreshCw } from 'lucide-react';
import { t } from "@/i18n";

export const THE_HOA_DON = 'hoa_don';
export const THE_PHIEU = 'phieu';

/**
 * Hai thẻ của khung trái màn trả hàng khi chưa mở hóa đơn: Hóa đơn còn hạn trả (chọn hóa đơn để trả) và Phiếu đã
 * trả (xem lại, in lại phiếu đã lập tại cửa hàng). Hàng thẻ chỉ để chuyển thẻ; bộ lọc của từng thẻ nằm ở hàng ngay dưới.
 */
export default function TheDanhSach({ the, onDoi }) {
  const muc = [
    [THE_HOA_DON, t("Hóa đơn còn hạn trả")],
    [THE_PHIEU, t("Phiếu đã trả")],
  ];
  return (
    <div aria-label={t("Danh sách trả hàng")} className="flex min-w-0 gap-5" role="tablist">
      {muc.map(([ma, nhan]) => {
        const dangChon = the === ma;
        return (
          <button
            aria-selected={dangChon}
            className={`-mb-px inline-flex h-10 shrink-0 items-center border-b-2 px-0.5 text-sm transition focus-visible:outline-2 focus-visible:outline-bo-primary ${dangChon
              ? 'border-bo-primary font-semibold text-bo-heading'
              : 'border-transparent font-medium text-bo-muted hover:text-bo-foreground'}`}
            key={ma}
            onClick={() => onDoi(ma)}
            role="tab"
            type="button"
          >
            {nhan}
          </button>
        );
      })}
    </div>
  );
}

/** Nút tải lại ở cuối hàng lọc của hai thẻ: xoay khi đang tải, khóa để không bấm chồng. */
export function NutTaiLai({ dangTai, onBam }) {
  return (
    <button
      aria-label={t("Tải lại danh sách")}
      className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg border border-bo-border text-bo-muted transition hover:bg-bo-surface-subtle hover:text-bo-foreground disabled:opacity-50"
      disabled={dangTai}
      onClick={onBam}
      title={t("Tải lại danh sách")}
      type="button"
    >
      <RefreshCw aria-hidden="true" className={dangTai ? 'animate-spin motion-reduce:animate-none' : ''} size={14} />
    </button>
  );
}
