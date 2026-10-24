import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, Lock, Plus, QrCode, X } from 'lucide-react';
import './pos-invoice-tabs.css';

/** Trạng thái hiển thị trên tab để thu ngân nhìn là biết hóa đơn nào đang chờ/đã xong. */
function getTabStatus(invoice) {
  if (invoice.attempt?.status === 'succeeded') return { icon: CheckCircle2, label: 'Đã thanh toán', className: 'text-emerald-600' };
  if (invoice.payos?.trangThai === 'PENDING') return { icon: QrCode, label: 'Đang chờ chuyển khoản', className: 'text-amber-600' };
  if (invoice.payos?.trangThai === 'PAID_ERROR') return { icon: AlertTriangle, label: 'Đã nhận tiền, chờ quản lý xử lý', className: 'text-red-600' };
  if (invoice.attempt?.status === 'pending' || invoice.attempt?.status === 'unknown') return { icon: Lock, label: 'Đang xử lý thanh toán', className: 'text-amber-600' };
  return null;
}

/**
 * Dải hóa đơn đang mở. variant:
 * - 'bar'  : nằm trên thanh trên cùng (màn từ 1280px — chốt Mẫu B), tab dạng viên, cuộn ngang khi nhiều.
 * - 'strip': hàng riêng dưới thanh trên cùng (màn hẹp hơn 1280px), giữ kiểu thẻ cũ.
 * Cả hai giữ nguyên hành vi: chọn/đóng/thêm, phím mũi tên/Home/End/Delete, tự cuộn tới hóa đơn đang chọn.
 */
export default function PosInvoiceTabs({ invoices, activeInvoice, disabled, onSelect, onClose, onAdd, variant = 'strip' }) {
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
        aria-label="Các hóa đơn đang mở"
        className={`pos-invoice-tabs${overflow.left ? ' has-left' : ''}${overflow.right ? ' has-right' : ''}`}
        ref={listRef}
        role="tablist"
      >
        {invoices.map((invoice, index) => {
          const active = invoice.number === activeInvoice;
          const status = getTabStatus(invoice);
          const StatusIcon = status?.icon ?? FileText;
          const itemCount = invoice.cart.reduce((sum, line) => sum + line.quantity, 0);
          const title = `Hóa đơn ${invoice.number}${itemCount ? ` · ${itemCount} sản phẩm` : ''}${status ? ` · ${status.label}` : ''}`;
          return (
            <div className={`pos-invoice-tab${active ? ' is-active' : ''}`} key={invoice.number}>
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
                <span>Hóa đơn {invoice.number}</span>
                {status ? <span className="sr-only">({status.label})</span> : null}
                {itemCount ? <span className="pos-invoice-tab-count" aria-label={`${itemCount} sản phẩm`}>{itemCount}</span> : null}
              </button>
              <button aria-label={`Đóng hóa đơn ${invoice.number}`} className="pos-invoice-tab-close" disabled={disabled} onClick={() => onClose(invoice.number)} title={`Đóng hóa đơn ${invoice.number}`} type="button"><X aria-hidden="true" size={14} strokeWidth={1.8} /></button>
            </div>
          );
        })}
      </div>
      <button aria-label="Thêm hóa đơn" className="pos-invoice-add" disabled={disabled} onClick={onAdd} title="Thêm hóa đơn (F2)" type="button"><Plus aria-hidden="true" size={19} strokeWidth={1.8} /></button>
    </div>
  );
}
