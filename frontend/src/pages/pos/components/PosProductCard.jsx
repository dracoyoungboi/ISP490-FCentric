import { memo } from 'react';
import { formatMoney } from '../pos-format';

// Optional UI fields. Unknown stock is not treated as zero.
function getProductAvailability(product) {
  const stock = Number.isFinite(product.stock) ? Math.max(0, product.stock) : null;
  const variantCount = Number.isInteger(product.variantCount) && product.variantCount > 0
    ? product.variantCount : Array.isArray(product.variants) ? product.variants.length : 0;
  return { stock, variantCount, outOfStock: stock === 0 };
}

export default memo(function PosProductCard({ product, onAdd, view = 'grid' }) {
  const { stock, variantCount, outOfStock } = getProductAvailability(product);
  const stockLabel = outOfStock ? 'Hết hàng' : stock === null ? 'Tồn: —' : `Tồn: ${stock}`;
  const stockClass = outOfStock ? 'bg-slate-200 text-slate-600' : 'bg-white/95 text-slate-700';
  const interaction = 'transition duration-150 hover:border-bo-primary hover:shadow-sm active:scale-[0.98] motion-reduce:transform-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

  if (view === 'list') {
    return (
      <button aria-label={`Thêm ${product.name} (${product.sku})`} className={`group flex h-14 w-full min-w-0 items-center gap-3 rounded-lg border border-transparent px-2 text-left hover:bg-bo-primary-soft ${interaction}`} disabled={outOfStock} onClick={() => onAdd(product)} title={outOfStock ? 'Hết hàng' : product.name} type="button">
        <img alt="" className="size-10 shrink-0 rounded-md bg-slate-100 object-cover" decoding="async" height="40" loading="lazy" src={product.image} width="40" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 text-[13px] font-medium text-bo-foreground">{product.name}</span>
          <span className="flex items-center gap-2 text-[11px] text-bo-muted"><span>{product.sku}</span>{variantCount > 0 ? <span>{variantCount} biến thể</span> : null}</span>
        </span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${stockClass}`} title={stock === null ? 'Chưa có dữ liệu tồn kho' : stockLabel}>{stockLabel}</span>
        <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold tabular-nums text-bo-primary">{formatMoney(product.price)}</span>
      </button>
    );
  }

  return (
    <button aria-label={`Thêm ${product.name} (${product.sku})`} className={`group flex min-w-0 flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface p-1.5 text-left ${interaction}`} disabled={outOfStock} onClick={() => onAdd(product)} title={outOfStock ? 'Hết hàng' : product.name} type="button">
      <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-md bg-slate-100">
        <img alt={product.name} className="h-full w-full object-cover" decoding="async" height="250" loading="lazy" src={product.image} width="200" />
        <span className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium shadow-sm ${stockClass}`} title={stock === null ? 'Chưa có dữ liệu tồn kho' : stockLabel}>{stockLabel}</span>
        {variantCount > 0 ? <span className="absolute bottom-1.5 left-1.5 rounded bg-white/95 px-1.5 py-0.5 text-[11px] text-slate-600 shadow-sm">{variantCount} biến thể</span> : null}
      </span>
      <span className="flex flex-1 flex-col px-1 pb-1 pt-2">
        <span className="line-clamp-2 min-h-9 text-[13px] font-medium leading-[18px] text-bo-foreground">{product.name}</span>
        <span className="mt-1 text-[11px] leading-4 text-bo-muted">{product.sku}</span>
        <span className="mt-1 whitespace-nowrap text-[13px] font-semibold leading-5 tabular-nums text-bo-primary">{formatMoney(product.price)}</span>
      </span>
    </button>
  );
});
