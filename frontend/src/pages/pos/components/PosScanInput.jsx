import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import { isTextEntry } from '../pos-scan';

/**
 * Ô quét của chế độ quét mã: súng quét USB / Barcode to PC gõ mã như bàn phím rồi gửi Enter.
 * Mã giữ riêng (không đụng từ khóa tìm kiếm của danh mục) và xóa trắng ngay khi gửi, kể cả
 * khi lần quét đó lỗi — lần quét sau không bị dính mã cũ.
 * Đèn: xanh = phím quét sẽ vào ô này (đang chọn nút khác thì POS tự chuyển phím về đây);
 * cam = con trỏ đang ở một ô nhập chữ khác (ghi chú...) — bấm vào để quét tiếp.
 * ref: { element, focus(), select(), insert(text) } — insert dùng khi POS chuyển phím về ô quét.
 */
const PosScanInput = forwardRef(function PosScanInput({ onScan }, ref) {
  const inputRef = useRef(null);
  const [code, setCode] = useState('');
  const [ready, setReady] = useState(true);

  useImperativeHandle(ref, () => ({
    get element() { return inputRef.current; },
    focus: () => inputRef.current?.focus(),
    select: () => inputRef.current?.select(),
    insert: (text) => {
      inputRef.current?.focus();
      setCode((current) => current + text);
    },
  }), []);

  useEffect(() => {
    const update = () => {
      const active = document.activeElement;
      setReady(active === inputRef.current || !isTextEntry(active));
    };
    update();
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);

  const onKeyDown = (event) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.repeat) return;
    event.preventDefault();
    const value = code.trim();
    setCode('');
    if (value) onScan(value);
  };

  return (
    <div className="relative min-w-0 flex-1">
      <ScanBarcode aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bo-primary" size={18} />
      <input
        aria-label="Ô quét mã vạch"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        autoFocus
        className="min-h-10 w-full rounded-lg border border-bo-primary/50 bg-bo-surface py-2 pl-9 pr-11 font-mono text-sm text-bo-foreground outline-none placeholder:font-sans placeholder:text-bo-muted focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 sm:pr-40"
        data-pos-scan-input=""
        onChange={(event) => setCode(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Quét mã vạch hoặc nhập mã SKU rồi Enter"
        ref={inputRef}
        spellCheck={false}
        type="text"
        value={code}
      />
      <button
        className={`absolute right-1.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${ready ? 'bg-bo-success-soft text-bo-success' : 'bg-bo-warning-soft text-bo-warning'}`}
        onClick={() => inputRef.current?.focus()}
        tabIndex={-1}
        title={ready ? 'Sẵn sàng nhận mã quét' : 'Con trỏ đang ở ô nhập khác — bấm để quét tiếp'}
        type="button"
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        <span className="hidden sm:inline">{ready ? 'Sẵn sàng quét' : 'Bấm để quét tiếp'}</span>
      </button>
    </div>
  );
});

export default PosScanInput;
