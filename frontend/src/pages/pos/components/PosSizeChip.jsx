import { formatCount, formatMoney, formatPriceShort } from '../pos-format';
import { groupTitle, isKnownOut, knownStock } from '../pos-group';

// Tồn từ 1 tới mức này: số tồn trên ô kích cỡ chuyển màu cam để thu ngân để ý.
const LOW_STOCK = 3;

/**
 * Trạng thái một ô kích cỡ:
 * - out: hết hàng (tồn <= 0) — vẫn hiện để báo khách, không bấm được.
 * - full: đã thêm vào hóa đơn đủ số tồn — ô ghi "Đủ", bấm chỉ hiện lời nhắc "Chỉ còn N".
 * - over: trong hóa đơn NHIỀU hơn tồn (tồn vừa giảm do quầy khác bán) — ô ghi "Còn N" màu đỏ.
 * - low: còn 1..LOW_STOCK.
 */
function sizeState(group, variant, inCart) {
  const stock = knownStock(variant);
  const out = isKnownOut(variant);
  const full = !out && stock !== null && inCart >= stock;
  const over = full && inCart > stock;
  const low = !out && stock !== null && stock <= LOW_STOCK;
  const label = `${groupTitle(group)} · ${variant.tenSize}`;
  const inCartNote = inCart > 0 ? `, đang có ${inCart} trong hóa đơn` : '';
  let description;
  if (out) description = `${label}: hết hàng`;
  else if (over) description = `${label}: trong hóa đơn ${inCart} nhưng chỉ còn ${formatCount(stock)}`;
  else if (full) description = `${label}: đã thêm đủ ${formatCount(stock)} sản phẩm tồn`;
  else description = `Thêm ${label} (${stock === null ? 'chưa có số tồn' : `tồn ${formatCount(stock)}`}, giá ${formatMoney(variant.price)}${inCartNote})`;
  return {
    out,
    full,
    over,
    low,
    stockLabel: out ? 'Hết' : over ? `Còn ${formatCount(stock)}` : full ? 'Đủ' : stock === null ? '—' : formatCount(stock),
    description,
  };
}

// Kích thước theo chỗ đặt ô: dòng Danh sách, thẻ Lưới, khay chọn cỡ (ô to hơn, luôn ghi giá).
// Khay: ô co giãn theo chữ, nhãn dài ("One size fits all") xuống dòng chứ không bị cắt.
const SIZES = {
  list: { box: 'h-[42px]', boxPrice: 'h-[54px]', label: 'text-[13px]' },
  grid: { box: 'h-10', boxPrice: 'h-[52px]', label: 'text-xs' },
  tray: { box: 'min-h-[52px] py-1.5', boxPrice: 'min-h-[52px] py-1.5', label: 'text-sm', wrap: true },
};

/**
 * Một ô kích cỡ. span = số khe ô chiếm (nhãn dài chiếm 2–3 khe thay vì bị cắt — xem pos-size-layout.js).
 * showPrice: nhóm có nhiều mức giá -> ô ghi giá gọn ("133k", "2,6tr"). Số nhỏ ở góc = số đang trong hóa đơn.
 */
export function SizeChip({ group, variant, inCart = 0, justAdded = false, matched = false, size = 'list', span = 1, showPrice = false, onPick }) {
  const state = sizeState(group, variant, inCart);
  const dims = SIZES[size] ?? SIZES.list;
  const tone = state.out
    ? 'border-dashed border-slate-300 bg-slate-50 text-slate-400'
    : state.full
      ? 'border-bo-border bg-slate-50 text-slate-500'
      : justAdded
        ? 'border-bo-success bg-bo-success-soft text-bo-foreground'
        : 'border-slate-300 bg-bo-surface text-bo-foreground hover:border-bo-primary hover:bg-bo-primary-soft';
  const countTone = state.out ? 'text-slate-400' : state.over ? 'font-semibold text-bo-danger' : state.full ? 'font-semibold text-slate-500' : state.low ? 'font-semibold text-bo-warning' : 'text-bo-muted';
  return (
    <button
      aria-disabled={state.full || undefined}
      aria-label={state.description}
      className={`relative flex w-full min-w-0 flex-col items-center justify-center rounded-lg border px-1 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary ${showPrice ? dims.boxPrice : dims.box} ${state.out || state.full ? 'cursor-not-allowed' : 'cursor-pointer active:scale-[0.97] motion-reduce:transform-none'} ${matched ? 'ring-2 ring-bo-primary/60 ring-offset-1' : ''} ${tone}`}
      data-pos-size-chip={state.out ? 'out' : state.full ? 'full' : 'available'}
      data-pos-size-match={matched ? '' : undefined}
      disabled={state.out}
      onClick={() => onPick(variant)}
      style={span > 1 ? { gridColumn: `span ${span} / span ${span}` } : undefined}
      title={`${state.description} · Mã: ${variant.sku}${matched ? ' · khớp mã đang tìm' : ''}`}
      type="button"
    >
      {/* Bố cục đã chia đủ khe cho nhãn; cắt chữ chỉ là chốt chặn khi font chưa tải xong. Khay thì xuống dòng. */}
      <span className={`max-w-full ${dims.wrap ? 'break-words text-center' : 'truncate'} font-semibold leading-4 ${dims.label} ${state.out ? 'line-through' : ''}`}>{variant.tenSize}</span>
      <span className={`text-[10px] leading-3 tabular-nums ${countTone}`}>{state.stockLabel}</span>
      {showPrice ? (
        <span className={`mt-px text-[10px] font-semibold leading-3 tabular-nums ${state.out ? 'text-slate-400' : 'text-bo-primary-strong'}`}>{formatPriceShort(variant.price)}</span>
      ) : null}
      {inCart > 0 ? (
        <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-bo-primary px-1 text-[10px] font-bold leading-none text-white tabular-nums">{inCart}</span>
      ) : null}
    </button>
  );
}

/** Ô "+N cỡ": các kích cỡ không đủ chỗ hiện trên dòng/thẻ — bấm mở khay chọn cỡ. */
export function MoreSizesChip({ count, size = 'list', expanded = false, controls, label, onClick, showPrice = false }) {
  const dims = SIZES[size] ?? SIZES.list;
  return (
    <button
      aria-controls={expanded ? controls : undefined}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      aria-label={label}
      className={`flex w-full min-w-0 flex-col items-center justify-center rounded-lg border px-1 text-bo-primary-strong transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary ${showPrice ? dims.boxPrice : dims.box} ${expanded ? 'border-bo-primary bg-bo-primary-soft' : 'border-bo-primary/35 bg-bo-primary-soft/50 hover:border-bo-primary hover:bg-bo-primary-soft'}`}
      data-pos-size-more=""
      onClick={onClick}
      title={label}
      type="button"
    >
      <span className={`font-semibold leading-4 tabular-nums ${dims.label}`}>+{formatCount(count)}</span>
      <span className="text-[10px] leading-3">cỡ</span>
    </button>
  );
}
