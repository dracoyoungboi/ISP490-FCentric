import {
  AlertTriangle,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  UserRound,
  ChevronDown,
  Lock,
  ImageOff,
  WifiOff,
} from 'lucide-react';
import { formatMoney } from '../pos-format';

const iconButton = 'grid size-7 place-items-center rounded-md text-bo-muted transition hover:bg-slate-100 hover:text-bo-foreground disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Giỏ hàng hóa đơn hiện tại. `frozen=true` khi giao dịch thanh toán đang treo
 * (pending/unknown): khóa mọi sửa đổi draft nhưng vẫn mở được dialog thanh toán
 * để kiểm tra kết quả — phím tắt cũng không được vượt guard này.
 * `offline=true` (máy mất mạng): khóa nút Thanh toán cho hóa đơn mới; hóa đơn đang treo vẫn
 * mở được để xem lại mã QR / tình trạng giao dịch.
 */
export default function PosCartPanel({
  cart,
  customer,
  subtotal,
  total,
  note,
  frozen = false,
  isSubmitting = false,
  overStockMessage = '',
  offline = false,
  onCustomer,
  onQuantity,
  onRemove,
  onClear,
  onPayment,
  onNote,
}) {
  const totalQuantity = cart.reduce((sum, row) => sum + row.quantity, 0);
  const blockedByNetwork = offline && !frozen;
  return (
    <section aria-label="Hóa đơn hiện tại" className="flex min-h-0 w-full flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface">
      <header className="flex shrink-0 items-center justify-between border-b border-bo-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-bo-primary-soft text-bo-primary"><ShoppingBag aria-hidden="true" size={17} /></span>
          <div>
            <h2 className="text-sm font-semibold text-bo-foreground">Hóa đơn hiện tại</h2>
            {/* Tách "mặt hàng" (số dòng) và "số lượng" để không hiểu nhầm 1 dòng SL 2 là 2 sản phẩm khác nhau */}
            <p className="text-xs text-bo-muted">{cart.length ? `${cart.length} mặt hàng · SL ${totalQuantity}` : 'Chưa có sản phẩm'}</p>
          </div>
        </div>
        <button aria-label="Xóa nội dung hóa đơn" className={iconButton} disabled={!cart.length || frozen} onClick={onClear} title="Xóa nội dung hóa đơn" type="button"><Trash2 aria-hidden="true" size={16} /></button>
      </header>

      {frozen ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-bo-border bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <Lock aria-hidden="true" className="shrink-0" size={14} />
          <span>Giao dịch thanh toán đang được xử lý — hóa đơn đã khóa để giữ nguyên nội dung đã gửi. Mở nút Thanh toán để kiểm tra kết quả.</span>
        </div>
      ) : null}

      <div className="shrink-0 border-b border-bo-border px-4 py-3">
        <button className="flex w-full items-center gap-3 rounded-lg border border-bo-border px-3 py-2.5 text-left transition hover:border-bo-primary/50 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60" disabled={frozen} onClick={onCustomer} type="button">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 text-bo-primary"><UserRound aria-hidden="true" size={16} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-bo-muted">Khách hàng</span>
            <span className="block truncate text-sm font-medium text-bo-foreground">{customer?.name || 'Chưa chọn khách hàng'}</span>
          </span>
          <ChevronDown aria-hidden="true" className="text-bo-muted" size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {cart.length ? (
          <ul className="divide-y divide-bo-border">
            {cart.map(({ product, quantity }) => (
              <li className="flex gap-2.5 py-3" key={product.id}>
                {product.image ? (
                  <img alt="" className="size-12 shrink-0 rounded-md border border-bo-border bg-slate-50 object-cover" loading="lazy" src={product.image} />
                ) : (
                  <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-md border border-bo-border bg-slate-50 text-slate-400"><ImageOff size={16} /></span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[13px] font-medium leading-5 text-bo-foreground">{product.name}</p>
                      <p className="mt-0.5 text-[11px] text-bo-muted">{product.sku} · {formatMoney(product.price)}</p>
                      {!frozen && Number.isFinite(product.stock) && quantity > product.stock ? (
                        <p className="mt-1 inline-flex items-center gap-1 rounded bg-bo-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-bo-danger" role="status">
                          <AlertTriangle aria-hidden="true" size={12} />Chỉ còn {Math.max(0, product.stock)}
                        </p>
                      ) : null}
                    </div>
                    <button aria-label={`Xóa ${product.name}`} className="grid size-6 shrink-0 place-items-center rounded text-bo-muted transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40" disabled={frozen} onClick={() => onRemove(product.id)} type="button"><Trash2 aria-hidden="true" size={14} /></button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center rounded-md border border-bo-border">
                      <button aria-label={`Giảm số lượng ${product.name}`} className={iconButton} disabled={frozen} onClick={() => onQuantity(product.id, quantity - 1)} type="button"><Minus aria-hidden="true" size={13} /></button>
                      <span aria-live="polite" className="min-w-7 text-center text-xs font-semibold text-bo-foreground">{quantity}</span>
                      <button aria-label={`Tăng số lượng ${product.name}`} className={iconButton} disabled={frozen || (Number.isFinite(product.stock) && quantity >= product.stock)} onClick={() => onQuantity(product.id, quantity + 1)} title={Number.isFinite(product.stock) && quantity >= product.stock ? `Tối đa ${product.stock} (tồn khả dụng)` : undefined} type="button"><Plus aria-hidden="true" size={13} /></button>
                    </div>
                    <span className="text-sm font-semibold text-bo-foreground">{formatMoney(product.price * quantity)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex h-full min-h-40 flex-col items-center justify-center px-4 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-bo-muted"><ShoppingBag aria-hidden="true" size={20} /></span>
            <p className="mt-3 text-sm font-medium text-bo-foreground">Chưa có sản phẩm</p>
            <p className="mt-1 text-xs text-bo-muted">Chọn hàng hóa để bắt đầu hóa đơn.</p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-bo-border px-4 py-3">
        <label className="mb-3 block">
          <span className="sr-only">Ghi chú hóa đơn</span>
          <input className="w-full rounded-md border border-bo-border bg-bo-surface px-3 py-2 text-xs text-bo-foreground outline-none placeholder:text-bo-muted focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60" disabled={frozen} onChange={(event) => onNote(event.target.value)} placeholder="Ghi chú cho hóa đơn..." value={note} />
        </label>
        <div className="space-y-2 text-[13px]">
          <div className="flex items-center justify-between text-bo-muted"><span>Tổng tiền hàng</span><span className="font-medium text-bo-foreground">{formatMoney(subtotal)}</span></div>
          <div className="flex items-end justify-between border-t border-dashed border-bo-border pt-3">
            <span className="text-sm font-semibold text-bo-foreground">Khách cần trả</span>
            <span className="text-xl font-bold tracking-tight text-bo-primary">{formatMoney(total)}</span>
          </div>
        </div>
        {overStockMessage ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-md bg-bo-danger-soft px-3 py-2 text-xs text-bo-danger" role="alert">
            <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={14} />{overStockMessage}
          </p>
        ) : null}
        <button className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-bo-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-bo-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!cart.length || isSubmitting || Boolean(overStockMessage) || blockedByNetwork} onClick={onPayment} title={blockedByNetwork ? 'Mất kết nối mạng — chưa thể thanh toán' : undefined} type="button">
          {blockedByNetwork ? (
            <><WifiOff aria-hidden="true" size={16} /><span>Mất kết nối mạng</span></>
          ) : (
            <><span>{isSubmitting ? 'Đang xử lý…' : 'Thanh toán'}</span><span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-medium">F9</span></>
          )}
        </button>
      </div>
    </section>
  );
}
