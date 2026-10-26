import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { formatCount } from '../pos-format';
import { gridPriceLabelOf, groupTitle, isKnownOut, knownStock, matchesCode, priceLabelOf } from '../pos-group';
import { GRID_MAX_ROWS, LIST_SLOT, fitSizes, priceSummary } from '../pos-size-layout';
import PosProductImage from './PosProductImage';
import { MoreSizesChip, SizeChip } from './PosSizeChip';
import PosSizeTray from './PosSizeTray';

// Thời gian ô kích cỡ sáng xanh sau khi thêm vào hóa đơn.
const ADDED_FLASH_MS = 1200;
// Chỗ cho dòng giá ở thẻ Lưới = bề rộng thẻ trừ viền 2, p-1.5 hai bên 12, mx-1 hai bên 8; chừa thêm 2px vì
// bề rộng vùng danh mục đo được làm tròn xuống.
const GRID_PRICE_INSET = 24;

function ColorSwatch({ hex }) {
  if (!hex || !/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
  return (
    <span
      aria-hidden="true"
      className="mr-1.5 inline-block size-2.5 shrink-0 rounded-full border border-black/15 align-[-1px]"
      style={{ backgroundColor: hex }}
    />
  );
}

/** "Màu: Đen · Polyester" — thiếu màu thì không ghi chữ "Màu:" trống. */
function ColorText({ group }) {
  return (
    <>
      <ColorSwatch hex={group.colorHex} />
      {group.colorName ? <>Màu: <b className="font-semibold text-slate-700">{group.colorName}</b></> : null}
      {group.materialName ? `${group.colorName ? ' · ' : ''}${group.materialName}` : null}
    </>
  );
}

/**
 * Một dòng (Danh sách) hoặc thẻ (Lưới) của danh mục POS dạng gộp kích cỡ: mỗi mẫu + màu (+ chất liệu),
 * các kích cỡ là ô bấm kèm số tồn của kho đang bán. Bấm một ô = thêm đúng SKU đó (1 cái) vào hóa đơn,
 * cùng luồng kiểm tra tồn/khóa giỏ như trước (onAdd trả true khi đã thêm).
 *
 * Ô kích cỡ xếp theo khe cố định (pos-size-layout.js), dùng chung `layout` của cả trang nên các dòng
 * thẳng cột. Danh sách hiện 1 dòng ô, Lưới tối đa 2 dòng; không đủ chỗ thì ô cuối "+N cỡ" mở khay chọn
 * cỡ (bấm tên / ảnh cũng mở khay). Kích cỡ đã hết vẫn hiện mờ + gạch ngang ("Hết") để báo khách.
 */
function PosProductCard({
  group,
  onAdd,
  view = 'grid',
  cartQuantities,
  matchCode = '',
  layout,
  trayOpen = false,
  onToggleTray,
  onCloseTray,
  trayAnchorRef,
}) {
  const [justAddedId, setJustAddedId] = useState(null);
  const flashTimer = useRef(null);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const pick = (variant) => {
    if (onAdd(variant)) {
      setJustAddedId(variant.id);
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setJustAddedId(null), ADDED_FLASH_MS);
    }
  };

  const isList = view === 'list';
  const variants = group.variants;
  const groupLabel = groupTitle(group);
  const totalLeft = variants.reduce((sum, variant) => sum + Math.max(0, knownStock(variant) ?? 0), 0);
  const allOut = variants.length > 0 && variants.every(isKnownOut);
  // Giá theo các cỡ còn bán và có giá (cỡ đã hết, giá 0 không kéo khoảng giá đi).
  const summary = useMemo(() => priceSummary(variants), [variants]);
  const priceLabel = priceLabelOf(summary);
  const priceTone = summary.none ? 'text-bo-warning' : 'text-bo-primary';

  const perRow = isList ? layout.list.slots : layout.grid.slotsPerRow;
  const fit = useMemo(() => {
    const kind = isList ? 'list' : 'grid';
    const spans = variants.map((variant) => layout.spanOf(variant.tenSize, kind));
    return {
      spans,
      ...fitSizes(variants, {
        spans,
        perRow,
        maxRows: isList ? 1 : GRID_MAX_ROWS,
        // Ưu tiên hiện cỡ khớp mã đang tìm và cỡ đang có trong hóa đơn (để thấy số đã chọn ngay trên dòng).
        isMatched: (variant) => matchesCode(variant, matchCode) || (cartQuantities?.get(variant.id) ?? 0) > 0,
      }),
    };
  }, [variants, layout, isList, perRow, matchCode, cartQuantities]);

  const trayId = `pos-size-tray-${String(group.key).replace(/[^\w-]/g, '_')}`;
  const nameRef = useRef(null);
  const openTray = (event) => onToggleTray(group.key, event.currentTarget);
  // Ảnh chỉ để bấm chuột/chạm (bàn phím dùng nút tên): đóng khay thì trả con trỏ về tên mẫu.
  const openTrayFromImage = () => onToggleTray(group.key, nameRef.current);
  const chipSize = isList ? 'list' : 'grid';
  const chips = (
    <div
      aria-label={`Chọn kích cỡ ${groupLabel}`}
      className={`grid ${isList ? 'gap-1.5' : 'gap-1'}`}
      role="group"
      style={{ gridTemplateColumns: isList ? `repeat(${perRow}, ${LIST_SLOT}px)` : `repeat(${perRow}, minmax(0, 1fr))` }}
    >
      {fit.visible.map((index) => {
        const variant = variants[index];
        return (
          <SizeChip
            group={group}
            inCart={cartQuantities?.get(variant.id) ?? 0}
            justAdded={justAddedId === variant.id}
            key={variant.id}
            matched={matchesCode(variant, matchCode)}
            onPick={pick}
            showPrice={summary.multi}
            size={chipSize}
            span={Math.min(fit.spans[index], perRow)}
            variant={variant}
          />
        );
      })}
      {fit.hidden.length ? (
        <MoreSizesChip
          controls={trayId}
          count={fit.hidden.length}
          expanded={trayOpen}
          label={`Xem đủ ${variants.length} kích cỡ của ${groupLabel}`}
          onClick={openTray}
          showPrice={summary.multi}
          size={chipSize}
        />
      ) : null}
    </div>
  );
  const tray = trayOpen ? (
    <PosSizeTray
      anchorRef={trayAnchorRef}
      cartQuantities={cartQuantities}
      group={group}
      id={trayId}
      justAddedId={justAddedId}
      matchCode={matchCode}
      onClose={onCloseTray}
      onPick={pick}
      placement={isList ? 'list' : 'grid'}
    />
  ) : null;
  // Tên / ảnh cũng mở khay: xem tên đầy đủ, giá và tồn từng cỡ (màn cảm ứng không có chú thích khi rê chuột).
  const nameButtonProps = {
    'aria-expanded': trayOpen,
    'aria-haspopup': 'dialog',
    onClick: openTray,
    title: groupLabel,
    type: 'button',
  };

  if (isList) {
    const { stacked, sizesWidth, priceWidth } = layout.list;
    return (
      <div
        aria-label={groupLabel}
        className="relative grid items-center gap-x-3 gap-y-2 rounded-lg px-2 py-2"
        data-pos-group={group.key}
        role="group"
        style={{ gridTemplateColumns: stacked ? '44px minmax(0, 1fr) auto' : `44px minmax(0, 1fr) ${sizesWidth}px ${priceWidth ?? 160}px` }}
      >
        <span aria-hidden="true" className="size-11 shrink-0 cursor-pointer overflow-hidden rounded-md" data-pos-image="" onClick={openTrayFromImage}>
          <PosProductImage className="size-11" src={group.image} />
        </span>
        <button className="min-w-0 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary" ref={nameRef} {...nameButtonProps}>
          <span className="line-clamp-1 text-[13px] font-medium text-bo-foreground">{group.name}</span>
          {/* Màn hẹp: dòng phụ được xuống dòng (tối đa 2 dòng) thay vì cắt mất "còn N". */}
          <span className="line-clamp-2 text-[11px] leading-4 text-bo-muted sm:line-clamp-1">
            <ColorText group={group} />
            {group.colorName || group.materialName ? ' · ' : ''}{variants.length} kích cỡ · {allOut ? 'hết hàng' : `còn ${formatCount(totalLeft)}`}
          </span>
        </button>
        {stacked ? null : chips}
        <span className={`whitespace-nowrap text-right text-[13px] font-semibold tabular-nums ${priceTone}`}>{priceLabel}</span>
        {stacked ? <div className="col-span-full">{chips}</div> : null}
        {tray}
      </div>
    );
  }

  // Khoảng giá không vừa một dòng của thẻ thì ghi gọn như ô cỡ: dòng giá luôn 1 dòng nên ô cỡ thẳng hàng với
  // thẻ bên cạnh. Giá đầy đủ vẫn ở chú thích, khay chọn cỡ, chế độ Danh sách và cho trình đọc màn hình.
  const gridPriceLabel = gridPriceLabelOf(summary, (text) => layout.textWidth(text, 'price'), layout.grid.cardWidth - GRID_PRICE_INSET);
  const priceShortened = gridPriceLabel !== priceLabel;
  return (
    <div aria-label={groupLabel} className="relative flex min-w-0 flex-col rounded-lg border border-bo-border bg-bo-surface p-1.5" data-pos-group={group.key} role="group">
      <span className="relative block h-[132px] w-full shrink-0 cursor-pointer overflow-hidden rounded-md" data-pos-image="" onClick={openTrayFromImage}>
        {/* Khung ngang thấp, ảnh thường chụp dọc: hiện trọn ảnh, hai bên lấp bằng ảnh làm mờ (không cắt ngang
            mặt người mẫu, không để hai dải trống). Ảnh to hơn có ở khay chọn cỡ. */}
        <PosProductImage className="h-full w-full" fit="fill" iconSize={28} src={group.image} />
        <span className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium shadow-sm ${allOut ? 'bg-slate-200 text-slate-600' : 'bg-white/95 text-slate-700'}`}>
          {allOut ? 'Hết hàng' : `Còn ${formatCount(totalLeft)}`}
        </span>
      </span>
      <div className="flex flex-1 flex-col pt-2">
        <button className="mx-1 min-w-0 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary" ref={nameRef} {...nameButtonProps}>
          <span className="line-clamp-2 min-h-9 text-[13px] font-medium leading-[18px] text-bo-foreground">{group.name}</span>
        </button>
        {/* min-h-4: thiếu cả màu lẫn chất liệu thì dòng vẫn giữ chỗ, ô cỡ không lệch lên so với thẻ bên cạnh. */}
        <span className="mx-1 mt-0.5 block min-h-4 truncate text-[11px] leading-4 text-bo-muted"><ColorText group={group} /></span>
        <span className={`mx-1 mt-1 truncate text-[13px] font-semibold leading-5 tabular-nums ${priceTone}`} title={priceShortened ? priceLabel : undefined}>
          {priceShortened ? (
            <>
              <span aria-hidden="true">{gridPriceLabel}</span>
              <span className="sr-only">{priceLabel}</span>
            </>
          ) : priceLabel}
        </span>
        {/* Ô cỡ ngay dưới giá, không dính đáy thẻ: phần trên cao cố định nên hàng ô đầu thẳng hàng cả dãy;
            thẻ ít dòng ô hơn thẻ bên cạnh thì trống ở cuối thẻ, không hở giữa giá và ô cỡ. */}
        <div className="pt-2">{chips}</div>
      </div>
      {tray}
    </div>
  );
}

/**
 * Chỉ vẽ lại khi dữ liệu dòng, chế độ xem, bố cục, trạng thái khay hoặc số lượng trong giỏ của CHÍNH các
 * kích cỡ của dòng đổi — thêm hàng vào giỏ không vẽ lại cả trang danh mục.
 */
const sameCartForGroup = (prev, next) => prev.group.variants.every(
  (variant) => (prev.cartQuantities?.get(variant.id) ?? 0) === (next.cartQuantities?.get(variant.id) ?? 0),
);

export default memo(PosProductCard, (prev, next) => prev.group === next.group
  && prev.view === next.view
  && prev.matchCode === next.matchCode
  && prev.onAdd === next.onAdd
  && prev.layout === next.layout
  && prev.trayOpen === next.trayOpen
  && prev.onToggleTray === next.onToggleTray
  && prev.onCloseTray === next.onCloseTray
  && sameCartForGroup(prev, next));
