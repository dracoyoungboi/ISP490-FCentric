import { memo, useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { formatMoney, formatPriceRange } from '../pos-format';

// Tồn từ 1 tới mức này: số tồn trên ô kích cỡ chuyển màu cam để thu ngân để ý.
const LOW_STOCK = 3;
// Thời gian ô kích cỡ sáng xanh sau khi thêm vào hóa đơn.
const ADDED_FLASH_MS = 1200;

/** Tồn đã biết của một kích cỡ (null = chưa có dữ liệu, không coi là hết). */
const knownStock = (variant) => (Number.isFinite(variant.stock) ? variant.stock : null);

/** Kích cỡ đã biết là hết (tồn <= 0). */
const isKnownOut = (variant) => {
  const stock = knownStock(variant);
  return stock !== null && stock <= 0;
};

/**
 * Trạng thái một ô kích cỡ:
 * - out: hết hàng (tồn <= 0) — vẫn hiện để báo khách, không bấm được.
 * - full: đã thêm vào hóa đơn đủ số tồn — bấm chỉ hiện lời nhắc "Chỉ còn N".
 * - low: còn 1..LOW_STOCK.
 */
/** Tên đầy đủ của nhóm: mẫu · màu (· chất liệu) — hai dòng cùng mẫu + màu khác chất liệu không trùng tên. */
const groupTitle = (group) => [group.name, group.colorName, group.materialName].filter(Boolean).join(' · ');

/** Mã SKU / mã vạch của kích cỡ có chứa từ khóa đang tìm (đã viết thường) không. */
const matchesCode = (variant, code) => Boolean(code)
  && [variant.sku, variant.barcode].some((value) => value && String(value).toLowerCase().includes(code));

function sizeState(group, variant, inCart) {
  const stock = knownStock(variant);
  const out = isKnownOut(variant);
  const full = !out && stock !== null && inCart >= stock;
  const low = !out && stock !== null && stock <= LOW_STOCK;
  const label = `${groupTitle(group)} · ${variant.tenSize}`;
  let description;
  if (out) description = `${label}: hết hàng`;
  else if (full) description = `${label}: đã thêm đủ ${stock} sản phẩm tồn`;
  else description = `Thêm ${label} (${stock === null ? 'chưa có số tồn' : `tồn ${stock}`}, giá ${formatMoney(variant.price)})`;
  return {
    out,
    full,
    low,
    stockLabel: out ? 'Hết' : stock === null ? '—' : String(stock),
    description,
  };
}

function SizeChip({ group, variant, inCart, justAdded, matched, compact, onPick }) {
  const state = sizeState(group, variant, inCart);
  const tone = state.out
    ? 'border-dashed border-slate-300 bg-slate-50 text-slate-400'
    : state.full
      ? 'border-bo-border bg-slate-50 text-slate-400'
      : justAdded
        ? 'border-bo-success bg-bo-success-soft text-bo-foreground'
        : 'border-slate-300 bg-bo-surface text-bo-foreground hover:border-bo-primary hover:bg-bo-primary-soft';
  const countTone = state.out || state.full ? 'text-slate-400' : state.low ? 'font-semibold text-bo-warning' : 'text-bo-muted';
  return (
    <button
      aria-disabled={state.full || undefined}
      aria-label={state.description}
      className={`flex min-w-0 flex-col items-center justify-center rounded-lg border px-1 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary ${compact ? 'h-10' : 'h-[42px] min-w-14 px-2'} ${state.out || state.full ? 'cursor-not-allowed' : 'cursor-pointer active:scale-[0.97] motion-reduce:transform-none'} ${matched ? 'ring-2 ring-bo-primary/60 ring-offset-1' : ''} ${tone}`}
      data-pos-size-chip={state.out ? 'out' : state.full ? 'full' : 'available'}
      data-pos-size-match={matched ? '' : undefined}
      disabled={state.out}
      onClick={() => onPick(variant)}
      title={`${state.description} · Mã: ${variant.sku}${matched ? ' · khớp mã đang tìm' : ''}`}
      type="button"
    >
      <span className={`max-w-full truncate text-[13px] font-semibold leading-4 ${state.out ? 'line-through' : ''}`}>{variant.tenSize}</span>
      <span className={`text-[10px] leading-3 tabular-nums ${countTone}`}>{state.stockLabel}</span>
    </button>
  );
}

function ColorSwatch({ hex, inline = false }) {
  if (!hex || !/^#[0-9a-f]{3,8}$/i.test(hex)) return null;
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2.5 shrink-0 rounded-full border border-black/15 ${inline ? 'mr-1.5 align-[-1px]' : ''}`}
      style={{ backgroundColor: hex }}
    />
  );
}

/**
 * Một dòng danh mục POS dạng gộp kích cỡ (chốt Mẫu A): mỗi mẫu + màu (+ chất liệu) là một dòng,
 * các kích cỡ là ô bấm kèm số tồn của kho đang bán. Bấm một ô = thêm đúng SKU đó (1 cái) vào hóa đơn,
 * cùng luồng kiểm tra tồn/khóa giỏ như trước (onAdd trả true khi đã thêm).
 * Kích cỡ đã hết vẫn hiện mờ + gạch ngang ("Hết") để thu ngân báo khách ngay.
 */
function PosProductCard({ group, onAdd, view = 'grid', cartQuantities, matchCode = '' }) {
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

  const variants = group.variants;
  const totalLeft = variants.reduce((sum, variant) => sum + Math.max(0, knownStock(variant) ?? 0), 0);
  const allOut = variants.length > 0 && variants.every(isKnownOut);
  const priceLabel = formatPriceRange(group.minPrice, group.maxPrice);
  const groupLabel = groupTitle(group);
  const chips = variants.map((variant) => (
    <SizeChip
      compact={view === 'grid'}
      group={group}
      inCart={cartQuantities?.get(variant.id) ?? 0}
      justAdded={justAddedId === variant.id}
      key={variant.id}
      matched={matchesCode(variant, matchCode)}
      onPick={pick}
      variant={variant}
    />
  ));
  const colorLine = (
    <>
      <ColorSwatch hex={group.colorHex} />
      <span className="truncate">Màu: <b className="font-semibold text-slate-700">{group.colorName}</b>{group.materialName ? ` · ${group.materialName}` : ''}</span>
    </>
  );

  if (view === 'list') {
    return (
      <div aria-label={groupLabel} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-2 py-2 sm:flex-nowrap" data-pos-group={group.key} role="group">
        {group.image
          ? <img alt="" className="size-11 shrink-0 rounded-md bg-slate-100 object-cover" decoding="async" height="44" loading="lazy" src={group.image} width="44" />
          : <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-400"><ImageOff size={16} /></span>}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 text-[13px] font-medium text-bo-foreground" title={group.name}>{group.name}</span>
          {/* Màn hẹp: dòng phụ được xuống dòng (tối đa 2 dòng) thay vì cắt mất tên màu. */}
          <span className="line-clamp-2 text-[11px] leading-4 text-bo-muted sm:line-clamp-1">
            <ColorSwatch hex={group.colorHex} inline />
            Màu: <b className="font-semibold text-slate-700">{group.colorName}</b>
            {group.materialName ? ` · ${group.materialName}` : ''} · {variants.length} kích cỡ · {allOut ? 'hết hàng' : `còn ${totalLeft}`}
          </span>
        </span>
        <div aria-label={`Chọn kích cỡ ${groupLabel}`} className="order-last flex w-full flex-wrap gap-1.5 sm:order-none sm:w-auto sm:max-w-[55%] sm:justify-end" role="group">
          {chips}
        </div>
        <span className="shrink-0 whitespace-nowrap text-right text-[13px] font-semibold tabular-nums text-bo-primary sm:min-w-24">{priceLabel}</span>
      </div>
    );
  }

  return (
    <div aria-label={groupLabel} className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface p-1.5" data-pos-group={group.key} role="group">
      <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-md bg-slate-100">
        {group.image
          ? <img alt="" className="h-full w-full object-cover" decoding="async" height="250" loading="lazy" src={group.image} width="200" />
          : <span aria-hidden="true" className="grid h-full w-full place-items-center text-slate-400"><ImageOff size={28} /></span>}
        <span className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium shadow-sm ${allOut ? 'bg-slate-200 text-slate-600' : 'bg-white/95 text-slate-700'}`}>
          {allOut ? 'Hết hàng' : `Còn ${totalLeft}`}
        </span>
      </span>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-2">
        <span className="line-clamp-2 min-h-9 text-[13px] font-medium leading-[18px] text-bo-foreground" title={group.name}>{group.name}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-bo-muted">{colorLine}</span>
        <span className="mt-1 text-[13px] font-semibold leading-5 tabular-nums text-bo-primary">{priceLabel}</span>
        <div aria-label={`Chọn kích cỡ ${groupLabel}`} className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-1" role="group">
          {chips}
        </div>
      </div>
    </div>
  );
}

/**
 * Chỉ vẽ lại khi dữ liệu dòng, chế độ xem hoặc số lượng trong giỏ của CHÍNH các kích cỡ của dòng đổi —
 * thêm hàng vào giỏ không vẽ lại cả trang danh mục.
 */
const sameCartForGroup = (prev, next) => prev.group.variants.every(
  (variant) => (prev.cartQuantities?.get(variant.id) ?? 0) === (next.cartQuantities?.get(variant.id) ?? 0),
);

export default memo(PosProductCard, (prev, next) => prev.group === next.group
  && prev.view === next.view
  && prev.matchCode === next.matchCode
  && prev.onAdd === next.onAdd
  && sameCartForGroup(prev, next));
