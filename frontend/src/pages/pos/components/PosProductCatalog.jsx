import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Barcode, CheckCircle2, ChevronLeft, ChevronRight, LayoutGrid, List, Loader2, PenLine, RotateCcw, ScanBarcode, Search } from 'lucide-react';
import PosProductCard from './PosProductCard';
import { SCAN_HINT, isTextEntry } from '../pos-scan';
import './pos-scan-indicator.css';

const VIEW_KEY = 'fcentric.pos.productView';
const iconButton = 'grid size-10 shrink-0 place-items-center rounded-lg border border-bo-border text-bo-muted transition hover:border-bo-primary/40 hover:bg-slate-50 hover:text-bo-primary focus-visible:outline-2 focus-visible:outline-bo-primary';
const scanOnButton = 'grid size-10 shrink-0 place-items-center rounded-lg border border-bo-primary bg-bo-primary-soft text-bo-primary transition hover:bg-bo-primary-soft/70 focus-visible:outline-2 focus-visible:outline-bo-primary';

/** Bộ lọc tồn kho (giá trị = tham số trangThaiTon gửi lên server). */
const STOCK_FILTERS = [
  { value: 'con_hang', label: 'Còn hàng', title: 'Mẫu còn ít nhất một kích cỡ có hàng (kích cỡ đã hết hiện mờ)' },
  { value: 'het_hang', label: 'Hết hàng', title: 'Mẫu đã hết mọi kích cỡ' },
  { value: 'tat_ca', label: 'Tất cả', title: 'Mọi mẫu đang bán' },
];

/**
 * Con trỏ có đang ở chỗ phím gõ về ô tìm kiếm không: ô tìm kiếm, hoặc nút/thẻ sản phẩm (POS tự chuyển
 * phím về ô tìm kiếm). false = đang gõ ở một ô nhập chữ khác (ghi chú, số lượng...). Máy quét vẫn nhận
 * mã ở mọi chỗ; trạng thái này để thu ngân biết chữ gõ tay đang vào ô khác.
 */
function useSearchFocusReady(inputRef, enabled) {
  const [ready, setReady] = useState(true);
  useEffect(() => {
    if (!enabled) return undefined;
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
  }, [inputRef, enabled]);
  return ready;
}

/** Nội dung khi không có hàng nào khớp: nói rõ vì sao (từ khóa / bộ lọc tồn kho). */
function emptyMessage({ search, stockFilter }) {
  if (search.trim()) {
    return { title: 'Không tìm thấy hàng hóa', hint: stockFilter !== 'tat_ca' ? 'Thử đổi từ khóa hoặc xem tất cả hàng hóa.' : 'Thử đổi từ khóa khác.' };
  }
  if (stockFilter === 'con_hang') {
    return { title: 'Không còn hàng khả dụng', hint: 'Kho này không còn mặt hàng nào có tồn.' };
  }
  if (stockFilter === 'het_hang') {
    return { title: 'Không có mẫu nào hết hàng', hint: 'Mọi mẫu tại kho này đều còn ít nhất một kích cỡ.' };
  }
  return { title: 'Chưa có hàng hóa', hint: 'Kho này chưa có mặt hàng nào để bán.' };
}

/**
 * Catalog POS bản live, GỘP KÍCH CỠ (chốt Mẫu A): mỗi dòng/thẻ là một mẫu + màu (+ chất liệu),
 * các kích cỡ là ô bấm kèm số tồn (PosProductCard). Dữ liệu đã được server gộp, phân trang VÀ lọc
 * THEO NHÓM (không lọc/phân trang client, vì client chỉ có trang đang xem). Giữ lưới full-width
 * gap 12px (3/4/5/6 cột tại 1280/1600/1920), chế độ Danh sách, localStorage view preference, cuộn
 * độc lập, F3 (searchRef) và Enter SKU-only (onEnterAdd — tra cứu toàn bộ, KHÔNG phụ thuộc bộ lọc).
 * Bộ lọc tồn kho theo nhóm: Còn hàng = còn ít nhất một kích cỡ; Hết hàng = hết mọi kích cỡ; Tất cả.
 * Chế độ quét mã (scanMode): ô tìm kiếm VẪN dùng để tìm theo tên; mã quét được nhận ở mọi chỗ (kể cả
 * khi đang gõ dở trong ô — PosSalesPage trả lại chữ cũ) và thêm thẳng vào hóa đơn; kết quả từng lần
 * quét + đèn báo hiện ngay tại ô tìm kiếm.
 */
export default function PosProductCatalog({
  groups,
  cartQuantities,
  totalElements,
  page,
  pageCount,
  pageSize,
  loading,
  error,
  onRetry,
  onPageChange,
  search,
  onSearch,
  onEnterAdd,
  searchRef,
  onAdd,
  scanMode = false,
  onToggleScanMode,
  scanPending = 0,
  lastScan = null,
  onShowScanMatches,
  stockFilter = 'tat_ca',
  onStockFilterChange,
  // Từ khóa server đã dùng cho kết quả đang hiện (sau debounce) — để thông báo rỗng
  // không nhảy theo từng phím gõ trước khi kịp tải lại.
  resultQuery,
}) {
  const [view, setView] = useState(() => {
    try { return window.localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; }
    catch { return 'grid'; }
  });
  const scrollRef = useRef(null);

  useEffect(() => {
    try { window.localStorage.setItem(VIEW_KEY, view); } catch { /* Storage có thể bị chặn; giữ chế độ trong phiên. */ }
  }, [view]);
  // Cuộn về đầu khi KẾT QUẢ đổi (từ khóa đã debounce), không theo từng phím gõ / mã quét lướt qua ô.
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [resultQuery, page, view, stockFilter]);

  const empty = emptyMessage({ search: resultQuery ?? search, stockFilter });
  // Thẻ chỉ dựng lại khi danh sách / chế độ xem / giỏ đổi (onAdd ổn định) — gõ phím, mã quét đi qua
  // ô tìm kiếm không vẽ lại cả lưới; mỗi thẻ tự bỏ qua nếu số lượng trong giỏ của nó không đổi.
  // Đang tìm theo mã: ô kích cỡ có mã SKU / mã vạch chứa từ khóa được viền nổi (cả nhóm hiện đủ kích cỡ).
  // Từ khóa quá ngắn (1–2 ký tự) khớp gần như mọi mã nên không tô.
  const typedCode = (resultQuery ?? '').trim().toLowerCase();
  const matchCode = typedCode.length >= 3 ? typedCode : '';
  const cards = useMemo(
    () => groups.map((group) => <PosProductCard cartQuantities={cartQuantities} group={group} key={group.key} matchCode={matchCode} onAdd={onAdd} view={view} />),
    [groups, cartQuantities, matchCode, onAdd, view],
  );

  const onSearchKeyDown = (event) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.repeat) return;
    if (!search.trim()) return;
    // SKU-only: tra cứu server-side kết quả đầu tiên của TOÀN BỘ truy vấn,
    // không dựa trên trang đang hiển thị.
    event.preventDefault();
    onEnterAdd();
  };

  const start = totalElements > 0 ? page * pageSize + 1 : 0;
  const end = Math.min((page + 1) * pageSize, totalElements);

  // Đèn báo chế độ quét: tia quét ở đầu ô. Đang gõ ở ô khác -> tia dừng, biểu tượng cam + lời nhắc.
  const scanReady = useSearchFocusReady(searchRef, scanMode);
  const scanAway = scanMode && !scanReady;
  // Mỗi kết quả quét (seq mới) dựng lại biểu tượng + lớp viền để chớp màu kết quả đúng một lần.
  const scanTone = lastScan ? (lastScan.ok ? 'ok' : 'err') : undefined;
  const scanSeq = lastScan?.seq ?? 0;
  const hasScanRow = Boolean(lastScan) || scanPending > 0;
  const focusSearch = () => searchRef.current?.focus();
  const searchTone = !scanMode ? 'border-bo-border pr-3' : scanAway ? 'border-bo-warning/45 pr-24 sm:pr-40' : 'border-bo-primary/50 pr-3';

  return (
    <section aria-label="Danh mục hàng hóa" className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface">
      <div className="shrink-0 border-b border-bo-border px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <label className="block">
              {scanMode ? (
                <span aria-hidden="true" className={`pos-scan-icon pointer-events-none absolute left-3 top-1/2 size-[17px] -translate-y-1/2 ${scanAway ? 'text-bo-warning' : 'text-bo-primary'}`} data-pos-scan-indicator={scanAway ? 'away' : 'ready'} data-tone={scanTone} key={`scan-icon-${scanSeq}`}>
                  <ScanBarcode className="block" size={17} />
                  {scanAway ? null : <span className="pos-scan-laser" />}
                </span>
              ) : (
                <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-bo-muted" size={17} />
              )}
              <input aria-describedby={scanMode ? 'pos-scan-hint' : undefined} aria-label="Tìm hàng hóa" autoComplete="off" className={`block min-h-10 w-full text-ellipsis rounded-lg border bg-bo-surface py-2 pl-9 text-sm text-bo-foreground outline-none placeholder:text-bo-muted focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/10 ${searchTone}`} onChange={(event) => onSearch(event.target.value)} onKeyDown={onSearchKeyDown} placeholder={scanMode ? 'Quét mã hoặc gõ tên / mã hàng (F3)' : 'Tên hoặc mã hàng (F3)'} ref={searchRef} spellCheck={false} value={search} />
            </label>
            {scanMode ? <span className="sr-only" id="pos-scan-hint">{SCAN_HINT}</span> : null}
            {scanMode && scanTone ? <span aria-hidden="true" className="pos-scan-ring pointer-events-none absolute inset-0 rounded-lg" data-pos-scan-ring={scanTone} data-tone={scanTone} key={`scan-ring-${scanSeq}`} /> : null}
            {scanAway ? (
              // Bấm (chuột/chạm) đưa con trỏ về ô tìm kiếm; chặn mousedown để nút không giành focus rồi biến mất trước khi click.
              <button
                aria-label="Đang gõ ở ô khác — bấm để về ô tìm kiếm"
                className="absolute right-1.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-bo-warning transition hover:bg-bo-warning-soft"
                data-pos-scan-nudge=""
                onClick={focusSearch}
                onMouseDown={(event) => { event.preventDefault(); focusSearch(); }}
                tabIndex={-1}
                title="Con trỏ đang ở ô khác. Máy quét vẫn nhận mã — bấm để gõ tìm kiếm."
                type="button"
              >
                <PenLine aria-hidden="true" size={14} />
                <span className="hidden sm:inline">Đang gõ ở ô khác</span>
                <span className="sm:hidden">Ô khác</span>
              </button>
            ) : null}
          </div>
          <button aria-label="Chế độ quét mã vạch" aria-pressed={scanMode} className={scanMode ? scanOnButton : iconButton} onClick={onToggleScanMode} title={scanMode ? `Đang bật quét mã — bấm để tắt (F8). ${SCAN_HINT}` : 'Bật chế độ quét mã (F8)'} type="button">
            <Barcode aria-hidden="true" size={19} />
          </button>
          <div aria-label="Chế độ xem sản phẩm" className="flex shrink-0 gap-0.5 rounded-lg border border-bo-border p-0.5" role="group">
            <button aria-label="Lưới" aria-pressed={view === 'grid'} className={`grid size-[34px] place-items-center rounded-md transition focus-visible:outline-2 focus-visible:outline-bo-primary ${view === 'grid' ? 'bg-bo-primary-soft text-bo-primary' : 'text-bo-muted hover:bg-slate-100'}`} onClick={() => setView('grid')} title="Lưới" type="button"><LayoutGrid aria-hidden="true" size={17} /></button>
            <button aria-label="Danh sách" aria-pressed={view === 'list'} className={`grid size-[34px] place-items-center rounded-md transition focus-visible:outline-2 focus-visible:outline-bo-primary ${view === 'list' ? 'bg-bo-primary-soft text-bo-primary' : 'text-bo-muted hover:bg-slate-100'}`} onClick={() => setView('list')} title="Danh sách" type="button"><List aria-hidden="true" size={17} /></button>
          </div>
        </div>
        {/* Dòng kết quả quét: chỉ hiện khi đã có kết quả hoặc đang tra mã (chốt A4 — lúc chưa quét không chiếm
            chỗ của danh mục; câu hướng dẫn nằm ở chú thích nút quét và bảng phím tắt F1). Vùng role="status"
            luôn được gắn sẵn khi bật quét để trình đọc màn hình đọc được kết quả lần quét đầu tiên. */}
        {scanMode ? (
          <div
            aria-live="polite"
            className={hasScanRow
              ? `mt-2 flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md px-2.5 py-1.5 text-xs ${lastScan ? (lastScan.ok ? 'bg-bo-success-soft text-bo-success' : 'bg-bo-danger-soft text-bo-danger') : 'bg-slate-50 text-bo-muted'}`
              : 'sr-only'}
            data-pos-scan-status={lastScan ? (lastScan.ok ? 'ok' : 'err') : scanPending > 0 ? 'pending' : 'idle'}
            role="status"
          >
            {lastScan ? (
              <span className="flex min-w-0 items-start gap-1.5">
                {lastScan.ok ? <CheckCircle2 aria-hidden="true" className="mt-px shrink-0" size={14} /> : <AlertCircle aria-hidden="true" className="mt-px shrink-0" size={14} />}
                <span className="min-w-0 break-words font-medium">{lastScan.message}</span>
              </span>
            ) : null}
            {hasScanRow ? (
              <span className="flex shrink-0 items-center gap-3">
                {lastScan?.ambiguous && onShowScanMatches ? (
                  <button className="font-semibold underline-offset-2 hover:underline" onClick={() => onShowScanMatches(lastScan.code)} type="button">Xem trong danh mục</button>
                ) : null}
                {scanPending > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-bo-muted"><Loader2 aria-hidden="true" className="animate-spin" size={13} />Đang tra {scanPending} mã</span>
                ) : null}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div aria-label="Lọc theo tồn kho" className="flex shrink-0 gap-0.5 rounded-lg border border-bo-border p-0.5" role="group">
            {STOCK_FILTERS.map((option) => (
              <button
                aria-pressed={stockFilter === option.value}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-bo-primary ${stockFilter === option.value ? 'bg-bo-primary-soft text-bo-primary' : 'text-bo-muted hover:bg-slate-100'}`}
                key={option.value}
                onClick={() => onStockFilterChange?.(option.value)}
                title={option.title}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="ml-auto hidden shrink-0 text-xs text-bo-muted sm:inline">{totalElements} mẫu (theo màu)</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3" ref={scrollRef}>
        {loading && !groups.length ? (
          <div aria-live="polite" className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <span className="size-6 animate-spin rounded-full border-2 border-bo-primary/25 border-t-bo-primary" />
            <p className="mt-3 text-sm font-semibold text-bo-foreground">Đang tải hàng hóa…</p>
          </div>
        ) : error && !groups.length ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <p className="mt-3 text-sm font-semibold text-bo-foreground">Không thể tải danh mục hàng hóa</p>
            <p className="mt-1 text-xs leading-5 text-bo-muted">Không hiển thị dữ liệu mẫu khi API lỗi. Vui lòng thử lại.</p>
            <button className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-bo-primary hover:underline" onClick={onRetry} type="button"><RotateCcw aria-hidden="true" size={13} />Thử lại</button>
          </div>
        ) : groups.length ? (
          <>
            {error ? (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <span>Không thể tải trang mới — đang hiển thị trang đã tải.</span>
                <button className="shrink-0 font-semibold hover:underline" onClick={onRetry} type="button">Thử lại</button>
              </div>
            ) : null}
            {/* Đang tải kết quả mới (đổi bộ lọc/từ khóa/trang): làm mờ danh sách cũ để không bị hiểu nhầm là kết quả mới. */}
            <div aria-busy={loading} aria-label={view === 'grid' ? 'Lưới sản phẩm' : 'Danh sách sản phẩm'} className={`${view === 'grid' ? 'grid w-full grid-cols-3 gap-3 min-[1280px]:grid-cols-4 min-[1600px]:grid-cols-5 min-[1920px]:grid-cols-6' : 'flex flex-col divide-y divide-bo-border'} transition-opacity ${loading ? 'opacity-60' : ''}`}>
              {cards}
            </div>
          </>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <Search aria-hidden="true" className="text-bo-muted" size={24} />
            <p className="mt-3 text-sm font-semibold text-bo-foreground">{empty.title}</p>
            <p className="mt-1 text-xs leading-5 text-bo-muted">{empty.hint}</p>
            {stockFilter !== 'tat_ca' && onStockFilterChange ? (
              <button className="mt-3 text-xs font-semibold text-bo-primary hover:underline" onClick={() => onStockFilterChange('tat_ca')} type="button">Xem tất cả hàng hóa</button>
            ) : null}
          </div>
        )}
      </div>
      {pageCount > 1 ? (
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-bo-border px-3 py-2 text-xs text-bo-muted">
          <span>{start}–{end} / {totalElements}</span>
          <div className="flex items-center gap-2">
            <button aria-label="Trang sản phẩm trước" className={`${iconButton} disabled:opacity-40`} disabled={loading || page === 0} onClick={() => onPageChange(page - 1)} type="button"><ChevronLeft aria-hidden="true" size={16} /></button>
            <span>{page + 1} / {pageCount}</span>
            <button aria-label="Trang sản phẩm sau" className={`${iconButton} disabled:opacity-40`} disabled={loading || page + 1 >= pageCount} onClick={() => onPageChange(page + 1)} type="button"><ChevronRight aria-hidden="true" size={16} /></button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}
