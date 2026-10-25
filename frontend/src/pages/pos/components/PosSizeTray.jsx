import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { groupTitle, matchesCode, priceLabelOf } from '../pos-group';
import { priceSummary } from '../pos-size-layout';
import PosProductImage from './PosProductImage';
import { SizeChip } from './PosSizeChip';

const PHONE_QUERY = '(max-width: 639px)';

/**
 * Khay chọn cỡ của một mẫu + màu: mọi kích cỡ theo đúng thứ tự, kèm tồn và giá từng cỡ. Mở từ ô "+N cỡ"
 * hoặc khi bấm tên / ảnh của mẫu. Bấm một cỡ = thêm 1 cái qua đúng hàm thêm hàng của danh mục (cùng kiểm
 * tồn, cùng khóa khi hóa đơn đang chờ thanh toán); khay KHÔNG đóng để thêm tiếp nhiều cỡ.
 *
 * Không phải hộp thoại của POS (không lớp phủ trên máy tính, máy quét vẫn nhận mã). Đóng bằng ×, Esc,
 * bấm ra ngoài; danh mục tự đóng khay khi đổi trang / bộ lọc / từ khóa / kho / chế độ xem hoặc có mã quét.
 * Màn hẹp (< 640px): tấm trượt từ dưới lên.
 *
 * onClose(refocus): refocus = true khi đóng bằng phím/nút (trả con trỏ về chỗ đã mở khay).
 */
export default function PosSizeTray({ id, group, cartQuantities, justAddedId, matchCode = '', onPick, onClose, anchorRef, placement = 'list' }) {
  const trayRef = useRef(null);
  const sheetRef = useRef(null);
  const [phone] = useState(() => Boolean(window.matchMedia?.(PHONE_QUERY)?.matches));

  // Thẻ Lưới: khay không được tràn ra ngoài vùng danh mục đang nhìn thấy (sinh thanh cuộn ngang / bị che).
  // Tràn mép phải -> neo theo mép phải của thẻ; vẫn tràn mép trái (thẻ cột giữa, vùng hẹp) -> kẹp vào trong
  // vùng. Sửa thẳng vị trí trước khi vẽ lên màn, không qua state.
  useLayoutEffect(() => {
    const node = trayRef.current;
    const scroller = node?.closest('[data-pos-catalog-scroll]');
    if (!node || !scroller || phone || placement === 'list') return;
    const visibleLeft = scroller.getBoundingClientRect().left + scroller.clientLeft;
    const visibleRight = visibleLeft + scroller.clientWidth;
    node.style.width = `${Math.min(440, scroller.clientWidth - 8)}px`;
    let rect = node.getBoundingClientRect();
    if (rect.right > visibleRight - 4) {
      node.style.left = 'auto';
      node.style.right = '0px';
      rect = node.getBoundingClientRect();
    }
    if (rect.left < visibleLeft + 4) {
      const parentLeft = node.offsetParent?.getBoundingClientRect().left ?? rect.left;
      node.style.right = 'auto';
      node.style.left = `${visibleLeft + 4 - parentLeft}px`;
    }
  }, [phone, placement]);

  useEffect(() => {
    const node = trayRef.current;
    if (!node) return;
    // Con trỏ vào chính khay, KHÔNG vào một ô cỡ: Enter/Space lặp lại (bấm đúp, giữ phím) ngay sau khi mở
    // khay không được thêm nhầm hàng. Tab đi tiếp vào các ô. Cuộn khay vào tầm nhìn theo chiều dọc
    // (khung POS không cuộn được — chỉ vùng danh mục).
    node.focus({ preventScroll: true });
    if (!phone) node.scrollIntoView({ block: 'nearest' });
  }, [phone]);

  useEffect(() => {
    const onKeyDown = (event) => {
      // Menu đang mở đã dùng Esc để tự đóng -> không đóng thêm khay.
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // Hộp thoại của POS (F1, F4, F9…) mở đè lên khay: Esc thuộc về hộp thoại (kể cả khi con trỏ còn ở
      // trong khay — hộp thoại POS không giành con trỏ), khay nằm dưới giữ nguyên.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      // Chặn Esc lan ra phím tắt chung của POS (đóng giỏ trên màn hẹp).
      event.preventDefault();
      // Chỉ trả con trỏ về chỗ đã mở khay khi con trỏ đang ở trong khay (đang gõ ở ô tìm kiếm thì để yên).
      onClose(Boolean(trayRef.current?.contains(document.activeElement)));
    };
    const onPointerDown = (event) => {
      const target = event.target;
      if (trayRef.current?.contains(target)) return;
      // Nền mờ của tấm trượt (màn hẹp): đóng bằng click của chính nền — đóng ngay lúc chạm thì cú chạm
      // "rơi" xuống ô cỡ nằm dưới và thêm nhầm hàng.
      if (sheetRef.current?.contains(target)) return;
      // Chính dòng/thẻ của mẫu đang mở (ảnh, tên, "+N", ô cỡ): để nút đó tự bật/tắt khay hoặc thêm hàng.
      if (anchorRef?.current?.closest('[data-pos-group]')?.contains(target)) return;
      onClose(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [onClose, anchorRef]);

  const summary = priceSummary(group.variants);
  const priceLabel = priceLabelOf(summary);
  const details = [group.colorName ? `Màu: ${group.colorName}` : null, group.materialName, `${group.variants.length} cỡ`, priceLabel].filter(Boolean).join(' · ');
  const inCart = group.variants
    .filter((variant) => (cartQuantities?.get(variant.id) ?? 0) > 0)
    .map((variant) => `${variant.tenSize} ×${cartQuantities.get(variant.id)}`);

  const panel = (
    <div
      aria-label={`Chọn cỡ ${groupTitle(group)}`}
      className={phone
        ? 'w-full rounded-t-2xl border border-bo-border bg-bo-surface p-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-xl outline-none animate-in slide-in-from-bottom duration-200 motion-reduce:animate-none'
        : `absolute top-full z-30 mt-1 w-[min(440px,calc(100vw-32px))] rounded-xl border border-bo-border bg-bo-surface p-3 text-left shadow-[0_16px_40px_rgba(15,23,42,0.18)] outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 ${placement === 'list' ? 'right-2' : 'left-0'}`}
      data-pos-size-tray=""
      id={id}
      ref={trayRef}
      role="dialog"
      tabIndex={-1}
    >
      <div className="flex items-start gap-2.5">
        {/* Ảnh trọn vẹn, to hơn ảnh trên thẻ (thẻ chỉ hiện phần thân áo): nhận mặt hàng, màu, kiểu dáng. */}
        <PosProductImage className="h-28 w-[84px] shrink-0 rounded-md border border-bo-border" fit="contain" iconSize={22} src={group.image} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-semibold leading-[18px] text-bo-foreground">{group.name}</p>
          <p className="mt-0.5 text-[11px] leading-4 text-bo-muted">{details}</p>
        </div>
        <button aria-label="Đóng khay chọn cỡ" className="grid size-8 shrink-0 place-items-center rounded-md border border-bo-border text-bo-muted transition hover:bg-slate-50 hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-bo-primary" onClick={() => onClose(true)} type="button">
          <X aria-hidden="true" size={16} />
        </button>
      </div>
      {/* pt/pr chừa chỗ cho số "trong hóa đơn" ở góc ô. */}
      <div aria-label="Các kích cỡ" className="mt-2 grid max-h-64 grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-1.5 overflow-y-auto pb-0.5 pr-1.5 pt-1.5" role="group">
        {group.variants.map((variant) => (
          <SizeChip
            group={group}
            inCart={cartQuantities?.get(variant.id) ?? 0}
            justAdded={justAddedId === variant.id}
            key={variant.id}
            matched={matchesCode(variant, matchCode)}
            onPick={onPick}
            showPrice
            size="tray"
            variant={variant}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11px] leading-4 text-bo-muted">
        <span className="min-w-0">{inCart.length ? `Trong hóa đơn: ${inCart.join(', ')}` : 'Bấm một cỡ để thêm 1 cái vào hóa đơn'}</span>
        <span className="shrink-0">Esc để đóng</span>
      </div>
    </div>
  );

  if (!phone) return panel;
  // Màn hẹp: tấm trượt trên nền mờ, gắn vào body (ngoài vùng danh mục) — bấm nền mờ là đóng.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end bg-slate-950/30 font-backoffice text-bo-foreground animate-in fade-in duration-200 motion-reduce:animate-none"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(false); }}
      ref={sheetRef}
    >
      {panel}
    </div>,
    document.body,
  );
}
