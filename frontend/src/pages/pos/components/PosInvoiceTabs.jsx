import { useEffect, useRef, useState } from 'react';
import { FileText, Plus, X } from 'lucide-react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { getTabStatus, tenKhachTrenTab } from '../pos-invoice-status';
import './pos-invoice-tabs.css';
import { t } from "@/i18n";

const menuItemClass = 'gap-4 rounded-md px-2.5 py-1.5 text-[13px] text-bo-foreground focus:bg-bo-primary-soft focus:text-bo-primary';

/**
 * Dải hóa đơn đang mở. variant:
 * - 'bar'  : nằm trên thanh trên cùng (màn từ 1280px — chốt Mẫu B), tab dạng viên, cuộn ngang khi nhiều.
 * - 'strip': hàng riêng dưới thanh trên cùng (màn hẹp hơn 1280px), giữ kiểu thẻ cũ.
 * Cả hai giữ nguyên hành vi: chọn/đóng/thêm, phím mũi tên/Home/End/Delete, tự cuộn tới hóa đơn đang chọn.
 * Chuột phải (giữ tay trên màn cảm ứng, Shift+F10 / phím Menu) trên một tab: Đóng hóa đơn trống, Đóng tất cả
 * và — khi vừa đóng hóa đơn có nội dung — Mở lại hóa đơn vừa đóng. Số đếm do getCloseCounts(số tab) tính.
 */
export default function PosInvoiceTabs({
  invoices, activeInvoice, disabled, onSelect, onClose, onAdd, variant = 'strip',
  walkInCustomerId = null, getCloseCounts, onCloseEmpty, onCloseAll, undoCount = 0, onUndoClose,
}) {
  const tabRefs = useRef(new Map());
  const listRef = useRef(null);
  // Còn tab bị khuất bên trái/phải (nhiều hóa đơn): làm mờ mép tương ứng để thu ngân biết có thể cuộn.
  const [overflow, setOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const update = () => {
      const left = list.scrollLeft > 1;
      const right = list.scrollLeft + list.clientWidth < list.scrollWidth - 1;
      setOverflow((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
    };
    update();
    list.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    observer?.observe(list);
    return () => {
      list.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [invoices.length]);

  useEffect(() => {
    const revealActive = () => tabRefs.current.get(activeInvoice)?.parentElement?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    revealActive();
    window.addEventListener('resize', revealActive);
    return () => window.removeEventListener('resize', revealActive);
  }, [activeInvoice]);

  // Đóng menu chuột phải: lệnh vừa chọn có thể mở hộp hỏi (hộp đó giữ con trỏ) hoặc đổi tab đang chọn.
  // Chờ một nhịp rồi mới trả con trỏ về tab ĐANG chọn, và chỉ khi con trỏ đang rơi ra ngoài (body).
  const focusActiveTab = () => {
    window.setTimeout(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      listRef.current?.querySelector('[role="tab"][aria-selected="true"]')?.focus();
    }, 0);
  };

  const handleKeyDown = (event, index) => {
    if (disabled) return;
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % invoices.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + invoices.length) % invoices.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = invoices.length - 1;
    else if (event.key === 'Delete') {
      event.preventDefault();
      onClose(invoices[index].number);
      return;
    } else return;
    event.preventDefault();
    const number = invoices[nextIndex].number;
    onSelect(number);
    tabRefs.current.get(number)?.focus();
  };

  return (
    <div className={`pos-invoice-strip${variant === 'bar' ? ' is-bar' : ''}`}>
      <div
        aria-label={t("Các hóa đơn đang mở")}
        className={`pos-invoice-tabs${overflow.left ? ' has-left' : ''}${overflow.right ? ' has-right' : ''}`}
        ref={listRef}
        role="tablist"
      >
        {invoices.map((invoice, index) => {
          const active = invoice.number === activeInvoice;
          const status = getTabStatus(invoice);
          const StatusIcon = status?.icon ?? FileText;
          const itemCount = invoice.cart.reduce((sum, line) => sum + line.quantity, 0);
          const tenKhach = tenKhachTrenTab(invoice.customer, walkInCustomerId);
          const title = t("Hóa đơn {{number}}{{khach}}{{soSanPham}}{{trangThai}}", { number: invoice.number, khach: tenKhach ? ` · ${invoice.customer.name}` : '', soSanPham: itemCount ? t(" · {{count}} sản phẩm", { count: itemCount }) : '', trangThai: status ? ` · ${status.label}` : '' });
          return (
            <ContextMenu key={invoice.number}>
            <ContextMenuTrigger asChild disabled={disabled || !getCloseCounts}>
            <div className={`pos-invoice-tab${active ? ' is-active' : ''}`}>
              <button
                aria-controls="pos-invoice-panel"
                aria-selected={active}
                className="pos-invoice-tab-select"
                disabled={disabled}
                id={`pos-invoice-tab-${invoice.number}`}
                onClick={() => onSelect(invoice.number)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                ref={(node) => { if (node) tabRefs.current.set(invoice.number, node); else tabRefs.current.delete(invoice.number); }}
                role="tab"
                tabIndex={active ? 0 : -1}
                title={title}
                type="button"
              >
                <StatusIcon aria-hidden="true" className={status?.className ?? 'pos-invoice-tab-icon'} size={15} strokeWidth={1.8} />
                <span className="pos-invoice-tab-label">{t("Hóa đơn {{number}}", { number: invoice.number })}</span>
                {tenKhach ? <span className="pos-invoice-tab-customer">· {tenKhach}</span> : null}
                {status ? <span className="sr-only">({status.label})</span> : null}
                {itemCount ? <span className="pos-invoice-tab-count" aria-label={t("{{count}} sản phẩm", { count: itemCount })}>{itemCount}</span> : null}
              </button>
              <button aria-label={t("Đóng hóa đơn {{number}}", { number: invoice.number })} className="pos-invoice-tab-close" disabled={disabled} onClick={() => onClose(invoice.number)} title={t("Đóng hóa đơn {{number}}", { number: invoice.number })} type="button"><X aria-hidden="true" size={14} strokeWidth={1.8} /></button>
            </div>
            </ContextMenuTrigger>
            {getCloseCounts ? <TabMenu counts={getCloseCounts(invoice.number)} number={invoice.number} onCloseAll={onCloseAll} onCloseEmpty={onCloseEmpty} onRestoreFocus={focusActiveTab} onUndoClose={onUndoClose} undoCount={undoCount} /> : null}
            </ContextMenu>
          );
        })}
      </div>
      <button aria-label={t("Thêm hóa đơn")} className="pos-invoice-add" disabled={disabled} onClick={onAdd} title={t("Thêm hóa đơn (F2)")} type="button"><Plus aria-hidden="true" size={19} strokeWidth={1.8} /></button>
    </div>
  );
}

/**
 * Menu chuột phải của một tab. Mục không có gì để làm thì mờ đi (không ẩn) để vị trí các mục không đổi.
 * Radix không tự trả con trỏ về tab (lệnh có thể mở hộp hỏi cần giữ con trỏ): onRestoreFocus lo việc đó.
 */
function TabMenu({ number, counts, onCloseEmpty, onCloseAll, undoCount, onUndoClose, onRestoreFocus }) {
  return (
    <ContextMenuContent className="min-w-[196px] rounded-lg border-bo-border bg-bo-surface p-1 text-bo-foreground shadow-lg" onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus(); }}>
      <ContextMenuItem className={menuItemClass} disabled={!counts.empty} onSelect={() => onCloseEmpty(number)}>
        <span className="flex-1">{t("Đóng hóa đơn trống")}</span>
        {counts.empty ? <span className="text-xs tabular-nums text-bo-muted">{counts.empty}</span> : null}
      </ContextMenuItem>
      <ContextMenuItem className={`${menuItemClass} focus:bg-red-50 focus:text-red-600`} disabled={!counts.all} onSelect={() => onCloseAll(number)}>
        <span className="flex-1">{t("Đóng tất cả")}</span>
        {counts.all ? <span className="text-xs tabular-nums text-bo-muted">{counts.all}</span> : null}
      </ContextMenuItem>
      {undoCount ? (
        <>
          <ContextMenuSeparator className="bg-bo-border" />
          <ContextMenuItem className={menuItemClass} onSelect={() => onUndoClose()}>
            <span className="flex-1">{t("Mở lại hóa đơn vừa đóng")}</span>
            <span className="text-xs tabular-nums text-bo-muted">{undoCount}</span>
          </ContextMenuItem>
        </>
      ) : null}
    </ContextMenuContent>
  );
}
