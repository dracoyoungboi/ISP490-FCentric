import { useEffect, useRef } from 'react';
import { FileText, Plus, X } from 'lucide-react';
import './pos-invoice-tabs.css';

export default function PosInvoiceTabs({ invoices, activeInvoice, disabled, onSelect, onClose, onAdd }) {
  const tabRefs = useRef(new Map());

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
    <div className="pos-invoice-strip">
      <div aria-label="Các hóa đơn đang mở" className="pos-invoice-tabs" role="tablist">
        {invoices.map((invoice, index) => {
          const active = invoice.number === activeInvoice;
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
                title={`Hóa đơn ${invoice.number}`}
                type="button"
              >
                <FileText aria-hidden="true" size={15} strokeWidth={1.8} />
                <span>Hóa đơn {invoice.number}</span>
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
