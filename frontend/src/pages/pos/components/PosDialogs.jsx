import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle2,
  ChevronRight,
  Printer,
  Receipt,
  RefreshCcw,
  Search,
  UserPlus,
  QrCode,
  Clock,
  Landmark,
  WifiOff,
} from 'lucide-react';
import PosModal from './PosModal';
import { posService, toPosCustomer } from '@/services/posService';
import { formatMoney } from '../pos-format';

const primaryButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-bo-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-bo-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary disabled:cursor-not-allowed disabled:bg-slate-300';
const secondaryButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-bo-border bg-bo-surface px-4 py-2 text-sm font-medium text-bo-foreground transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary disabled:cursor-not-allowed disabled:opacity-50';
const fieldClass = 'mt-1.5 min-h-10 w-full rounded-lg border border-bo-border bg-bo-surface px-3 py-2 text-sm text-bo-foreground outline-none placeholder:text-bo-muted focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/10';

// Bảng phím tắt là văn bản UI tĩnh (không phải dữ liệu nghiệp vụ).
const POS_SHORTCUTS = [
  { key: 'F1', label: 'Mở bảng phím tắt' },
  { key: 'F2', label: 'Thêm hóa đơn mới' },
  { key: 'F3', label: 'Tìm kiếm hàng hóa' },
  { key: 'Enter', label: 'Trong ô tìm kiếm: thêm nhanh theo mã SKU / mã vạch' },
  { key: 'F4', label: 'Chọn khách hàng' },
  { key: 'F9', label: 'Mở thanh toán · trong màn thanh toán: xác nhận' },
  { key: '← →', label: 'Chuyển giữa các hóa đơn (khi đang chọn tab)' },
  { key: 'Esc', label: 'Đóng cửa sổ đang mở' },
];

function FooterButtons({ onClose, onConfirm, confirmText = 'Xác nhận', cancelText = 'Đóng', disabled = false, destructive = false, busy = false }) {
  return (
    <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
      <button className={secondaryButton} onClick={onClose} type="button">{cancelText}</button>
      <button className={destructive ? 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:bg-slate-300' : primaryButton} disabled={disabled || busy} onClick={onConfirm} type="button">
        {busy ? 'Đang xử lý…' : confirmText}
      </button>
    </div>
  );
}

function Field({ id, label, value, onChange, placeholder, autoFocus = false }) {
  return (
    <label className="block text-sm font-medium text-bo-foreground" htmlFor={id}>
      {label}
      <input autoFocus={autoFocus} className={fieldClass} id={id} onChange={onChange} placeholder={placeholder} type="text" value={value} />
    </label>
  );
}

function MethodButton({ active, icon, label, onClick, disabled = false }) {
  return (
    <button aria-pressed={active} className={`flex min-h-[72px] w-full flex-col items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'border-bo-primary bg-bo-primary-soft text-bo-primary' : 'border-bo-border bg-bo-surface text-bo-muted hover:border-bo-primary/50'}`} disabled={disabled} onClick={onClick} type="button">
      {icon}{label}
    </button>
  );
}

/** Ô cảnh báo mất mạng dùng chung trong các hộp thoại thanh toán. */
function OfflineNotice({ children }) {
  return (
    <div aria-live="polite" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-bo-danger-soft p-3 text-xs leading-5 text-bo-danger" role="alert">
      <WifiOff aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
      <span>{children}</span>
    </div>
  );
}

const PAYOS_STATUS_TEXT = {
  CANCELLED: 'Mã QR đã bị hủy.',
  EXPIRED: 'Mã QR đã hết hạn — hàng giữ chỗ đã được trả lại kho.',
  FAILED: 'Không tạo được mã QR.',
  PAID_ERROR: 'Đã nhận tiền nhưng chưa tạo được đơn hàng.',
};

const formatCountdown = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** Mã QR payOS: khách quét bằng app ngân hàng; màn hình tự chuyển sang hóa đơn khi tiền về. */
function PayosQrDialog({ state, actions, onClose }) {
  const link = state.payos;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!link) return null;
  const pending = link.trangThai === 'PENDING';
  const remaining = link.hetHanLuc ? new Date(link.hetHanLuc).getTime() - now : 0;
  const terminalText = PAYOS_STATUS_TEXT[link.trangThai];

  return (
    <PosModal description="Khách mở app ngân hàng, quét mã để chuyển khoản. Tiền về là đơn tự hoàn tất." onClose={onClose} title="Chuyển khoản qua mã QR" size="md">
      <div className="grid gap-5 sm:grid-cols-[240px_minmax(0,1fr)]">
        <div className="flex flex-col items-center">
          <div className={`rounded-xl border border-bo-border bg-white p-3 ${pending ? '' : 'opacity-30'}`}>
            {link.qrCode ? <QRCodeSVG level="M" size={208} value={link.qrCode} /> : <div className="grid size-[208px] place-items-center text-xs text-bo-muted">Không có mã QR</div>}
          </div>
          {pending ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-bo-muted"><Clock aria-hidden="true" size={13} />Hết hạn sau <strong className="text-bo-foreground tabular-nums">{formatCountdown(remaining)}</strong></p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-3 text-sm">
          <div className="rounded-lg border border-bo-border bg-slate-50 p-3">
            <p className="text-xs text-bo-muted">Số tiền</p>
            <p className="text-2xl font-bold text-bo-primary">{formatMoney(link.soTien)}</p>
          </div>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-3"><dt className="text-bo-muted">Chủ tài khoản</dt><dd className="truncate text-right font-medium text-bo-foreground">{link.tenTaiKhoan || '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-bo-muted">Số tài khoản</dt><dd className="font-mono font-medium text-bo-foreground">{link.soTaiKhoan || '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-bo-muted">Nội dung CK</dt><dd className="font-mono font-medium text-bo-foreground">{link.noiDungCk || '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-bo-muted">Mã giao dịch</dt><dd className="font-mono text-bo-muted">{link.orderCode}</dd></div>
          </dl>
          {pending && state.online === false ? (
            <OfflineNotice>
              <strong>Máy đang mất mạng.</strong> Khách vẫn chuyển khoản được bình thường; màn hình sẽ tự cập nhật khi có mạng lại.
            </OfflineNotice>
          ) : null}
          {pending ? (
            <div aria-live="polite" className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              <RefreshCcw aria-hidden="true" className="shrink-0 animate-spin" size={14} />
              <span>Đang chờ khách chuyển khoản… Hàng trong giỏ đang được giữ chỗ.</span>
            </div>
          ) : terminalText ? (
            <div aria-live="polite" className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${link.trangThai === 'PAID_ERROR' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
              <span>{terminalText}{link.errorMessage ? ` ${link.errorMessage}` : ''}{link.trangThai === 'PAID_ERROR' ? ' Liên hệ quản lý để xử lý — không thu tiền lại của khách.' : ''}</span>
            </div>
          ) : null}
          {link.checkoutUrl && pending ? (
            <a className="inline-flex items-center gap-1.5 text-xs font-medium text-bo-primary hover:underline" href={link.checkoutUrl} rel="noopener noreferrer" target="_blank"><Landmark aria-hidden="true" size={13} />Mở trang thanh toán payOS</a>
          ) : null}
        </div>
      </div>
      <div className="mt-5 flex flex-col-reverse justify-end gap-2 border-t border-bo-border pt-4 sm:flex-row">
        {pending ? (
          <>
            <button className={secondaryButton} onClick={onClose} type="button">Ẩn (vẫn chờ tiền)</button>
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300" disabled={state.isSubmitting || state.online === false} onClick={actions.onCancelPayos} title={state.online === false ? 'Đang mất mạng — chưa hủy được mã QR' : undefined} type="button">{state.isSubmitting ? 'Đang hủy…' : 'Hủy mã QR'}</button>
          </>
        ) : (
          <>
            <button className={secondaryButton} onClick={onClose} type="button">Đóng</button>
            {link.trangThai !== 'PAID_ERROR' && link.trangThai !== 'PAID' ? <button className={primaryButton} onClick={actions.onRecreatePayos} type="button">Thanh toán lại</button> : null}
          </>
        )}
      </div>
    </PosModal>
  );
}

const CUSTOMER_SEARCH_DELAY_MS = 300;
const CUSTOMER_PAGE_SIZE = 20;

/**
 * Dialog chọn khách hàng + thêm nhanh khách hàng mới (tên + SĐT).
 * Tìm trên SERVER (trễ 300 ms sau lần gõ cuối) để thấy cả khách quầy khác vừa thêm; trong lúc
 * chờ hoặc khi mất mạng thì lọc tạm trên danh sách đã tải lúc mở trang.
 */
function CustomerDialog({ state, actions, onClose }) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [remote, setRemote] = useState({ keyword: null, items: [], total: 0, error: false });
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickError, setQuickError] = useState('');
  const [quickExisting, setQuickExisting] = useState(null);

  useEffect(() => {
    const keyword = customerSearch.trim();
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      posService.searchCustomers(keyword, { size: CUSTOMER_PAGE_SIZE, signal: controller.signal })
        .then(({ items, total }) => setRemote({ keyword, items, total, error: false }))
        .catch((error) => {
          if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return;
          setRemote({ keyword, items: [], total: 0, error: true });
        });
    }, CUSTOMER_SEARCH_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [customerSearch]);

  const keyword = customerSearch.trim();
  const remoteReady = remote.keyword === keyword && !remote.error;
  const localMatches = state.customers.filter((customer) => `${customer.name} ${customer.phone ?? ''}`.toLowerCase().includes(keyword.toLowerCase()));
  const matchingCustomers = remoteReady ? remote.items : localMatches;

  const resetQuickAdd = () => {
    setQuickAddOpen(false);
    setQuickName('');
    setQuickPhone('');
    setQuickBusy(false);
    setQuickError('');
    setQuickExisting(null);
  };
  const closeCustomerDialog = () => {
    resetQuickAdd();
    setCustomerSearch('');
    onClose();
  };
  const openQuickAdd = () => {
    // Điền sẵn từ ô tìm kiếm: toàn chữ số -> SĐT, còn lại -> tên.
    const keyword = customerSearch.trim();
    if (/^[\d\s.-]+$/.test(keyword)) setQuickPhone(keyword);
    else if (keyword) setQuickName(keyword);
    setQuickError('');
    setQuickExisting(null);
    setQuickAddOpen(true);
  };
  const phoneDigits = quickPhone.replace(/[\s.-]/g, '');
  const quickInvalid = !quickName.trim() || !/^0\d{9}$/.test(phoneDigits);
  const submitQuickAdd = async (event) => {
    event.preventDefault();
    if (quickInvalid || quickBusy) return;
    setQuickBusy(true);
    setQuickError('');
    setQuickExisting(null);
    try {
      await actions.onQuickCreateCustomer({ name: quickName.trim(), phone: phoneDigits });
      closeCustomerDialog();
    } catch (error) {
      const envelope = error?.response?.data;
      setQuickError(envelope?.message || 'Không thể thêm khách hàng. Vui lòng thử lại.');
      if (error?.response?.status === 409 && envelope?.data?.id) setQuickExisting(envelope.data);
      setQuickBusy(false);
    }
  };
  const selectExisting = () => {
    actions.onSelectCustomer(toPosCustomer(quickExisting));
    closeCustomerDialog();
  };
  return (
    <PosModal description="Chọn khách hàng cho hóa đơn hiện tại." onClose={closeCustomerDialog} title="Chọn khách hàng" size="md">
      <label className="relative block">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-bo-muted" size={17} />
        <input autoFocus className={`${fieldClass} mt-0 pl-9`} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Tìm theo tên hoặc số điện thoại" value={customerSearch} />
      </label>
      <ul className="mt-3 max-h-64 divide-y divide-bo-border overflow-y-auto rounded-lg border border-bo-border">
        {matchingCustomers.length ? matchingCustomers.map((customer) => (
          <li key={customer.id}>
            <button className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-slate-50" onClick={() => { actions.onSelectCustomer(customer); closeCustomerDialog(); }} type="button">
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-bo-foreground">{customer.name}</span><span className="mt-0.5 block text-xs text-bo-muted">{customer.phone || customer.tier}</span></span>
              {state.customer?.id === customer.id ? <Check aria-hidden="true" className="shrink-0 text-bo-primary" size={17} /> : <ChevronRight aria-hidden="true" className="shrink-0 text-bo-muted" size={16} />}
            </button>
          </li>
        )) : <li className="px-4 py-8 text-center text-sm text-bo-muted">{remote.keyword === keyword || remote.error ? 'Không tìm thấy khách hàng phù hợp.' : 'Đang tìm…'}</li>}
      </ul>
      {remote.error && remote.keyword === keyword ? (
        <p className="mt-2 text-xs text-amber-700">Không tải được danh sách mới nhất — đang hiện danh sách lúc mở trang.</p>
      ) : remoteReady && remote.total > remote.items.length ? (
        <p className="mt-2 text-xs text-bo-muted">Hiển thị {remote.items.length}/{remote.total} khách — gõ thêm tên hoặc SĐT để lọc.</p>
      ) : null}
      {quickAddOpen ? (
        <form className="mt-4 rounded-lg border border-bo-border p-3" onSubmit={submitQuickAdd}>
          <p className="text-sm font-semibold text-bo-foreground">Thêm khách hàng mới</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field autoFocus={!quickName} id="quick-customer-name" label="Tên khách hàng *" onChange={(event) => setQuickName(event.target.value)} placeholder="VD: Nguyễn Văn A" value={quickName} />
            <Field autoFocus={Boolean(quickName)} id="quick-customer-phone" label="Số điện thoại *" onChange={(event) => setQuickPhone(event.target.value)} placeholder="VD: 0912345678" value={quickPhone} />
          </div>
          {quickPhone && !/^0\d{9}$/.test(phoneDigits) ? <p className="mt-2 text-xs text-red-600">Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.</p> : null}
          {quickError ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              <span>{quickError}</span>
              {quickExisting && quickExisting.trangThai === 1 ? <button className="font-semibold text-bo-primary underline" onClick={selectExisting} type="button">Chọn khách này</button> : null}
            </div>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <button className={secondaryButton} disabled={quickBusy} onClick={resetQuickAdd} type="button">Hủy</button>
            <button className={primaryButton} disabled={quickInvalid || quickBusy} type="submit">{quickBusy ? 'Đang lưu…' : 'Lưu và chọn'}</button>
          </div>
        </form>
      ) : (
        <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-bo-primary/40 px-3 py-2.5 text-sm font-medium text-bo-primary transition hover:bg-bo-primary-soft" onClick={openQuickAdd} type="button">
          <UserPlus aria-hidden="true" size={16} /> Thêm khách hàng mới
        </button>
      )}
    </PosModal>
  );
}

/**
 * Dialog POS bản live: khách hàng thật; thanh toán chỉ Tiền mặt. Khi checkoutEnabled
 * đang tắt -> nút xác nhận khóa kèm thông báo. Attempt-aware:
 * - pending -> nút bận (chặn click đúp);
 * - unknown -> dialog riêng yêu cầu kiểm tra recovery trước, thử lại chỉ với CÙNG key+payload;
 * - failed -> người bán sửa draft rồi gửi lại với key MỚI (do PosSalesPage quản lý).
 * Receipt dùng dữ liệu SERVER (soDonHang chính thức), không dùng receipt mẫu.
 */
export default function PosDialogs({ dialog, state, actions, onClose, checkoutEnabled }) {
  if (!dialog) return null;

  if (dialog === 'customer') {
    // Component riêng: đóng dialog là unmount -> ô tìm kiếm và form thêm nhanh tự reset.
    return <CustomerDialog actions={actions} onClose={onClose} state={state} />;
  }

  if (dialog === 'clear') {
    return (
      <PosModal description="Nội dung hóa đơn hiện tại sẽ bị xóa." onClose={onClose} title="Xóa hóa đơn?" size="sm">
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} /><p>Thao tác này xóa các sản phẩm và ghi chú khỏi hóa đơn hiện tại.</p></div>
        <div className="mt-5"><FooterButtons confirmText="Xóa hóa đơn" destructive onClose={onClose} onConfirm={() => { actions.onClearCart(); onClose(); }} /></div>
      </PosModal>
    );
  }

  if (dialog === 'change-warehouse') {
    const count = state.cart.reduce((sum, line) => sum + line.quantity, 0);
    return (
      <PosModal description="Tồn kho và giá được tính theo từng kho." onClose={actions.onCancelWarehouseChange} title="Đổi kho bán hàng?" size="sm">
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p>
            Chuyển từ <strong>{state.activeWarehouse?.tenKho || 'kho hiện tại'}</strong> sang <strong>{state.pendingWarehouse?.tenKho || 'kho mới'}</strong> sẽ xóa {count} sản phẩm trong hóa đơn {state.invoiceNumber}, để không bán nhầm tồn của kho khác. Các hóa đơn khác giữ nguyên.
          </p>
        </div>
        <div className="mt-5"><FooterButtons cancelText="Giữ kho hiện tại" confirmText="Đổi kho và xóa giỏ" destructive onClose={actions.onCancelWarehouseChange} onConfirm={actions.onConfirmWarehouseChange} /></div>
      </PosModal>
    );
  }

  if (dialog === 'close-invoice') {
    return (
      <PosModal description="Hóa đơn đang có nội dung chưa thanh toán." onClose={onClose} title={`Đóng hóa đơn ${state.closingInvoice?.number}?`} size="sm">
        <p className="text-sm leading-6 text-bo-muted">Sản phẩm, khách hàng và ghi chú của hóa đơn này sẽ bị bỏ. Các hóa đơn khác được giữ lại.</p>
        <div className="mt-5"><FooterButtons cancelText="Hủy" confirmText="Đóng hóa đơn" destructive onClose={onClose} onConfirm={actions.onCloseInvoice} /></div>
      </PosModal>
    );
  }

  if (dialog === 'payos-qr') {
    return <PayosQrDialog actions={actions} onClose={onClose} state={state} />;
  }

  if (dialog === 'payment') {
    const isTransfer = state.paymentMethod === 'transfer' && state.payosEnabled;
    const paid = Number(state.paymentAmount || 0);
    const amountInvalid = !isTransfer && (!Number.isFinite(paid) || paid < state.total);
    const pending = state.attemptStatus === 'pending';
    const offline = state.online === false;
    const roundedAmount = Math.ceil(state.total / 100000) * 100000;
    const quickAmounts = [...new Set([state.total, roundedAmount, roundedAmount + 200000, roundedAmount + 500000].filter((amount) => amount > 0))];
    return (
      <PosModal description={isTransfer ? 'Tạo mã QR để khách chuyển khoản qua payOS.' : 'Xác nhận số tiền khách thanh toán bằng tiền mặt.'} onClose={onClose} title="Thanh toán" size="lg">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-bo-muted">Phương thức thanh toán</p>
            <div className={`mt-2 grid gap-2 ${state.payosEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <MethodButton active={!isTransfer} disabled={state.frozen} icon={<Banknote aria-hidden="true" size={18} />} label="Tiền mặt" onClick={() => actions.onPaymentMethod('cash')} />
              {state.payosEnabled ? <MethodButton active={isTransfer} disabled={state.frozen} icon={<QrCode aria-hidden="true" size={18} />} label="Chuyển khoản (QR)" onClick={() => actions.onPaymentMethod('transfer')} /> : null}
            </div>
            {isTransfer ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-lg border border-bo-border bg-slate-50 p-3 text-xs leading-5 text-bo-muted">
                  <p className="font-semibold text-bo-foreground">Cần thu: {formatMoney(state.total)}</p>
                  <p className="mt-1">Bấm <strong className="text-bo-foreground">Tạo mã QR</strong>, khách quét bằng app ngân hàng. Hàng trong giỏ được giữ chỗ cho tới khi khách trả tiền, hủy hoặc hết hạn.</p>
                </div>
                {state.paymentError ? <p className="flex items-start gap-1.5 text-xs text-red-600"><AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={14} />{state.paymentError}</p> : null}
              </div>
            ) : (
            <div className="mt-5">
              <div className="flex items-end justify-between gap-3">
                <label className="flex-1 text-sm font-medium text-bo-foreground" htmlFor="payment-amount">Khách thanh toán</label>
                <span className="text-xs text-bo-muted">Cần thu: <strong className="text-bo-foreground">{formatMoney(state.total)}</strong></span>
              </div>
              {/* Form để Enter trong ô số tiền = xác nhận thanh toán (thao tác quầy nhanh hơn) */}
              <form className="relative mt-1.5" onSubmit={(event) => { event.preventDefault(); if (checkoutEnabled && !offline && !pending && !amountInvalid && !state.isSubmitting) actions.onConfirmPayment(); }}>
                <input autoFocus className={`${fieldClass} pr-12 text-right text-lg font-semibold disabled:bg-slate-50 disabled:opacity-60`} disabled={state.frozen} id="payment-amount" inputMode="numeric" min="0" onChange={(event) => actions.onPaymentAmount(event.target.value)} onFocus={(event) => event.target.select()} placeholder="0" step="1000" type="number" value={state.paymentAmount} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-bo-muted">₫</span>
              </form>
              <div className="mt-2 flex flex-wrap gap-2">
                {quickAmounts.map((amount) => <button className="rounded-md border border-bo-border px-2.5 py-1.5 text-xs font-medium text-bo-foreground transition hover:border-bo-primary hover:bg-bo-primary-soft hover:text-bo-primary disabled:cursor-not-allowed disabled:opacity-50" disabled={state.frozen} key={amount} onClick={() => actions.onPaymentAmount(amount)} type="button">{amount === state.total ? 'Đủ tiền' : formatMoney(amount)}</button>)}
                <button className="rounded-md px-2.5 py-1.5 text-xs font-medium text-bo-primary transition hover:bg-bo-primary-soft disabled:cursor-not-allowed disabled:opacity-50" disabled={state.frozen} onClick={() => actions.onPaymentAmount(0)} type="button">Xóa số tiền</button>
              </div>
              {state.paymentError ? <p className="mt-2 flex items-start gap-1.5 text-xs text-red-600"><AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={14} />{state.paymentError}</p> : null}
              <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-bo-muted">Tiền thừa trả khách: <strong className="text-bo-foreground">{formatMoney(Math.max(0, paid - state.total))}</strong></p>
            </div>
            )}
          </div>
          <aside className="rounded-lg border border-bo-border bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-2"><div><p className="text-xs text-bo-muted">Khách hàng</p><p className="mt-1 text-sm font-semibold text-bo-foreground">{state.customer?.name || 'Chưa chọn khách hàng'}</p></div><span className="grid size-8 place-items-center rounded-full bg-white text-bo-primary"><Receipt aria-hidden="true" size={17} /></span></div>
            <div className="my-4 border-t border-dashed border-bo-border" />
            <div className="flex items-center justify-between text-xs text-bo-muted"><span>Tổng tiền hàng</span><span>{formatMoney(state.subtotal)}</span></div>
            <div className="mt-3 flex items-end justify-between gap-2"><span className="text-sm font-semibold text-bo-foreground">Khách cần trả</span><span className="text-lg font-bold text-bo-primary">{formatMoney(state.total)}</span></div>
          </aside>
        </div>
        {checkoutEnabled && offline ? (
          <div className="mt-4">
            <OfflineNotice>
              <strong>Mất kết nối mạng — chưa thể thanh toán.</strong> Chưa có tiền hay đơn hàng nào được ghi nhận. Khi có mạng lại, nút xác nhận sẽ tự mở.
            </OfflineNotice>
          </div>
        ) : null}
        {!checkoutEnabled ? (
          <div aria-live="polite" className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
            <span><strong>Chức năng thanh toán chưa được kích hoạt.</strong> Sản phẩm trong giỏ được giữ nguyên; không có đơn hàng, phiếu thu hay giao dịch nào được tạo.</span>
          </div>
        ) : null}
        <div className="mt-5 border-t border-bo-border pt-4">
          {isTransfer ? (
            <FooterButtons busy={state.isSubmitting} confirmText={!checkoutEnabled ? 'Thanh toán chưa kích hoạt' : offline ? 'Mất kết nối mạng' : 'Tạo mã QR'} disabled={!checkoutEnabled || offline || state.frozen} onClose={onClose} onConfirm={actions.onCreatePayosQr} />
          ) : (
            <FooterButtons busy={state.isSubmitting} confirmText={!checkoutEnabled ? 'Thanh toán chưa kích hoạt' : pending ? 'Đang xử lý…' : offline ? 'Mất kết nối mạng' : 'Xác nhận thanh toán'} disabled={!checkoutEnabled || offline || pending || amountInvalid} onClose={onClose} onConfirm={actions.onConfirmPayment} />
          )}
        </div>
      </PosModal>
    );
  }

  if (dialog === 'checkout-unknown') {
    return (
      <PosModal description="Không thể xác nhận kết quả giao dịch (mất kết nối hoặc hết thời gian chờ)." onClose={onClose} title="Giao dịch chưa rõ kết quả" size="md">
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p>Giao dịch đã được gửi nhưng chưa rõ server đã lưu hay chưa. Hóa đơn vẫn được khóa để giữ nguyên nội dung đã gửi. Hãy kiểm tra kết quả bằng đúng mã giao dịch trước khi quyết định.</p>
        </div>
        {state.online === false ? (
          <div className="mt-3">
            <OfflineNotice>
              <strong>Máy đang mất mạng.</strong> Chờ có mạng lại rồi bấm "Kiểm tra kết quả giao dịch" — không thu tiền lại của khách khi chưa kiểm tra.
            </OfflineNotice>
          </div>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          <button className={primaryButton} disabled={state.isSubmitting || state.online === false} onClick={actions.onCheckRecovery} type="button">
            <RefreshCcw aria-hidden="true" size={16} />{state.isSubmitting ? 'Đang kiểm tra…' : 'Kiểm tra kết quả giao dịch'}
          </button>
          <button className={secondaryButton} disabled={state.isSubmitting || state.online === false} onClick={actions.onRetrySameAttempt} type="button">
            Thử lại với cùng mã giao dịch
          </button>
          <p className="text-center text-[11px] leading-4 text-bo-muted">Nếu server báo chưa có kết quả, "Thử lại" sẽ gửi lại CHÍNH XÁC nội dung đã đóng băng (cùng mã) — không tạo đơn trùng.</p>
        </div>
      </PosModal>
    );
  }

  if (dialog === 'price-change') {
    const items = state.priceChange?.items ?? [];
    return (
      <PosModal description="Giá trên server đã đổi so với giá đang hiển thị." onClose={onClose} title="Giá đã thay đổi" size="md">
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p>Hệ thống KHÔNG tự thu số tiền theo giá mới. Vui lòng xem lại giá và tổng tiền mới, báo lại khách trước khi thanh toán.</p>
        </div>
        <ul className="mt-4 divide-y divide-bo-border rounded-lg border border-bo-border">
          {items.map((item) => (
            <li className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm" key={item.bienTheSanPhamId}>
              <span className="min-w-0 truncate text-bo-foreground">{item.maSku}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs">
                <span className="text-bo-muted line-through">{formatMoney(item.giaHienThi)}</span>
                <span className="font-semibold text-bo-primary">{formatMoney(item.giaMoi)}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-end justify-between border-t border-dashed border-bo-border pt-3">
          <span className="text-sm font-semibold text-bo-foreground">Tổng tiền mới</span>
          <span className="text-lg font-bold text-bo-primary">{formatMoney(state.total)}</span>
        </div>
        <div className="mt-5">
          <FooterButtons confirmText="Đã xem giá mới" onClose={actions.onConfirmNewPrice} onConfirm={actions.onConfirmNewPrice} />
        </div>
      </PosModal>
    );
  }

  if (dialog === 'receipt') {
    const receipt = state.receipt;
    return (
      <PosModal description="Giao dịch đã được server xác nhận và lưu." onClose={actions.onCloseReceipt} title="Thanh toán thành công" size="sm">
        <div className="flex flex-col items-center rounded-lg border border-bo-border bg-slate-50 px-4 py-5 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 aria-hidden="true" size={24} /></span>
          <p className="mt-3 text-xs text-bo-muted">Số hóa đơn chính thức</p>
          <p className="text-base font-bold text-bo-foreground">{receipt?.soDonHang || '—'}</p>
          <p className="mt-3 text-2xl font-bold text-bo-primary">{formatMoney(receipt?.tongCong)}</p>
          <p className="mt-1 text-xs text-bo-muted">{receipt?.phuongThuc === 'PAYOS' ? 'Chuyển khoản qua payOS · Đã nhận đủ tiền' : `Tiền mặt · Khách đưa ${formatMoney(receipt?.soTienThu)} · Tiền thừa ${formatMoney(receipt?.soTienThua)}`}</p>
        </div>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
          <button className={`${secondaryButton} flex-1`} onClick={actions.onPrintReceipt} type="button"><Printer aria-hidden="true" size={16} />In hóa đơn</button>
          <button className={`${primaryButton} flex-1`} onClick={actions.onCloseReceipt} type="button">Hoàn tất</button>
        </div>
        <p className="mt-3 text-center text-[11px] leading-4 text-bo-muted">In lỗi chỉ cần thử in lại từ đơn đã lưu — giao dịch không chạy lại.</p>
      </PosModal>
    );
  }

  if (dialog === 'recovered-result') {
    const receipt = state.recoveredResult;
    return (
      <PosModal description="Phát hiện giao dịch đã hoàn tất từ trước (trước khi tải lại trang)." onClose={actions.onCloseRecovered} title="Giao dịch đã hoàn tất" size="sm">
        <div className="flex flex-col items-center rounded-lg border border-bo-border bg-slate-50 px-4 py-5 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 aria-hidden="true" size={24} /></span>
          <p className="mt-3 text-xs text-bo-muted">Số hóa đơn chính thức</p>
          <p className="text-base font-bold text-bo-foreground">{receipt?.soDonHang || '—'}</p>
          <p className="mt-3 text-2xl font-bold text-bo-primary">{formatMoney(receipt?.tongCong)}</p>
          <p className="mt-1 text-xs text-bo-muted">Tiền thừa {formatMoney(receipt?.soTienThua)}</p>
        </div>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
          <button className={`${secondaryButton} flex-1`} onClick={actions.onPrintRecovered} type="button"><Printer aria-hidden="true" size={16} />In hóa đơn</button>
          <button className={`${primaryButton} flex-1`} onClick={actions.onCloseRecovered} type="button">Đóng</button>
        </div>
      </PosModal>
    );
  }

  if (dialog === 'barcode') {
    return (
      <PosModal description="Nhập mã SKU hoặc mã vạch biến thể để thêm nhanh vào hóa đơn." onClose={onClose} title="Quét mã hàng hóa" size="sm">
        <form onSubmit={(event) => { event.preventDefault(); actions.onFindBarcode(); }}>
          <Field autoFocus id="barcode-value" label="Mã biến thể / mã vạch" onChange={(event) => actions.onBarcodeInput(event.target.value)} placeholder="Mã SKU hoặc mã vạch biến thể" value={state.barcodeInput} />
          {state.barcodeError ? <p className="mt-2 text-xs text-red-600">{state.barcodeError}</p> : <p className="mt-2 text-xs text-bo-muted">Chỉ khớp chính xác mã của một biến thể; mã trùng nhiều biến thể sẽ báo lỗi để chọn thủ công.</p>}
          <div className="mt-5"><FooterButtons busy={state.barcodeBusy} confirmText={state.barcodeBusy ? 'Đang tra cứu…' : 'Tìm và thêm hàng'} onClose={onClose} onConfirm={actions.onFindBarcode} /></div>
        </form>
      </PosModal>
    );
  }

  if (dialog === 'shortcuts') {
    return (
      <PosModal description="Phím tắt dùng được khi màn POS đang mở." onClose={onClose} title="Phím tắt chức năng" size="sm">
        <ul className="divide-y divide-bo-border rounded-lg border border-bo-border">
          {POS_SHORTCUTS.map((shortcut) => <li className="flex items-center justify-between gap-4 px-3 py-3" key={shortcut.key}><span className="text-sm text-bo-foreground">{shortcut.label}</span><kbd className="min-w-11 rounded-md border border-bo-border bg-slate-50 px-2 py-1 text-center text-xs font-semibold text-bo-muted">{shortcut.key}</kbd></li>)}
        </ul>
      </PosModal>
    );
  }

  return null;
}
