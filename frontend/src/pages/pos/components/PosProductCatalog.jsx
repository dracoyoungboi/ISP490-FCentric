import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Barcode, CheckCircle2, ChevronLeft, ChevronRight, LayoutGrid, List, Loader2, PenLine, RotateCcw, ScanBarcode, Search } from 'lucide-react';
import PosProductCard from './PosProductCard';
import { SCAN_HINT, isTextEntry } from '../pos-scan';
import { formatCount } from '../pos-format';
import { priceLabelOf } from '../pos-group';
import { GRID_GAP, GRID_SLOT, LIST_GAP, LIST_SLOT, gridLayout, listLayout, priceSummary, slotSpan } from '../pos-size-layout';
import './pos-scan-indicator.css';

// Chỉ lưu khi thu ngân tự bấm Lưới/Danh sách. Khóa cũ (fcentric.pos.productView) bị ghi "grid" ngay lần mở
// đầu dù không ai chọn, nên chỉ coi "list" ở khóa cũ là lựa chọn thật.
const VIEW_KEY = 'fcentric.pos.productView.v2';
const LEGACY_VIEW_KEY = 'fcentric.pos.productView';
// Cửa sổ thấp hơn mức này (laptop 1366×768, 1920 bật Windows 125%, máy tính bảng ngang): Lưới chỉ thấy
// khoảng một hàng thẻ -> mặc định mở Danh sách.
const SHORT_WINDOW_HEIGHT = 820;
// Bề rộng tạm khi chưa đo được vùng danh mục (lần vẽ đầu tiên).
const FALLBACK_WIDTH = 900;
// Font đo chữ: nhãn ô kích cỡ ở Danh sách (13px) và Lưới (12px), cột giá ở Danh sách (13px) — chữ đậm 600.
const LABEL_FONT = { list: '600 13px', grid: '600 12px', price: '600 13px' };
// Cột giá ở Danh sách rộng tối thiểu 10rem; trang có khoảng giá dài hơn thì nới theo chữ dài nhất.
const LIST_PRICE_MIN = 160;

const iconButton = 'grid size-10 shrink-0 place-items-center rounded-lg border border-bo-border text-bo-muted transition hover:border-bo-primary/40 hover:bg-slate-50 hover:text-bo-primary focus-visible:outline-2 focus-visible:outline-bo-primary';
const scanOnButton = 'grid size-10 shrink-0 place-items-center rounded-lg border border-bo-primary bg-bo-primary-soft text-bo-primary transition hover:bg-bo-primary-soft/70 focus-visible:outline-2 focus-visible:outline-bo-primary';

/** Bộ lọc tồn kho (giá trị = tham số trangThaiTon gửi lên server). */
const STOCK_FILTERS = [
  { value: 'con_hang', label: 'Còn hàng', title: 'Mẫu còn ít nhất một kích cỡ có hàng (kích cỡ đã hết hiện mờ)' },
  { value: 'het_hang', label: 'Hết hàng', title: 'Mẫu đã hết mọi kích cỡ' },
  { value: 'tat_ca', label: 'Tất cả', title: 'Mọi mẫu đang bán' },
];

function readInitialView() {
  try {
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (saved === 'grid' || saved === 'list') return saved;
    if (window.localStorage.getItem(LEGACY_VIEW_KEY) === 'list') return 'list';
  } catch { /* Storage bị chặn: dùng mặc định theo màn hình. */ }
  return window.innerHeight < SHORT_WINDOW_HEIGHT ? 'list' : 'grid';
}

/**
 * Đo bề rộng nội dung vùng danh mục (một ResizeObserver cho cả trang) và dựng bố cục ô kích cỡ dùng chung
 * cho mọi dòng/thẻ: số khe Danh sách, số cột Lưới, số khe mỗi nhãn cần (đo chữ thật, nhớ theo nhãn).
 * Vùng cuộn đặt scrollbar-gutter: stable nên thanh cuộn hiện/ẩn không làm đổi bề rộng (không lặp đo).
 */
function useCatalogLayout(scrollRef) {
  const [metrics, setMetrics] = useState({ width: 0, fontFamily: '' });
  const [fontsVersion, setFontsVersion] = useState(0);

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    const read = () => {
      const style = window.getComputedStyle(node);
      const width = Math.floor(node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
      const fontFamily = style.fontFamily;
      setMetrics((current) => (current.width === width && current.fontFamily === fontFamily ? current : { width, fontFamily }));
    };
    if (typeof ResizeObserver === 'undefined') {
      read();
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    // ResizeObserver báo ngay một lần sau khi bắt đầu theo dõi -> có bề rộng thật trước khi vẽ lên màn.
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [scrollRef]);

  // Font Inter tải xong sau lần đo đầu: đo lại nhãn một lần.
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready?.then(() => { if (!cancelled) setFontsVersion((version) => version + 1); });
    return () => { cancelled = true; };
  }, []);

  return useMemo(() => {
    const width = metrics.width || FALLBACK_WIDTH;
    const family = metrics.fontFamily || 'Inter, sans-serif';
    const context = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    const widths = new Map();
    const measure = (text, kind) => {
      const key = `${kind}|${text}`;
      if (!widths.has(key)) {
        let value = text.length * (kind === 'list' ? 8.5 : 8); // ước lượng khi không có canvas
        if (context) {
          context.font = `${LABEL_FONT[kind]} ${family}`;
          value = context.measureText(text).width;
        }
        widths.set(key, value);
      }
      return widths.get(key);
    };
    return {
      fontsVersion,
      list: listLayout(width),
      grid: gridLayout(width),
      textWidth: (text, kind) => measure(String(text ?? ''), kind),
      spanOf: (label, kind) => {
        const text = String(label ?? '');
        return kind === 'list'
          ? slotSpan(measure(text, 'list'), LIST_SLOT, LIST_GAP)
          : slotSpan(measure(text, 'grid'), GRID_SLOT, GRID_GAP);
      },
    };
  }, [metrics, fontsVersion]);
}

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

/** Lý do tải danh mục lỗi: câu máy chủ trả (không phụ trách kho, quyền hết hạn...) hoặc lỗi mạng. */
function loadErrorReason(error) {
  const message = error?.response?.data?.message;
  if (message) return message;
  if (error && !error.response) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi bấm Thử lại.';
  return 'Máy chủ chưa trả được danh mục. Bấm Thử lại.';
}

/**
 * Catalog POS bản live, GỘP KÍCH CỠ (chốt Mẫu A): mỗi dòng/thẻ là một mẫu + màu (+ chất liệu),
 * các kích cỡ là ô bấm kèm số tồn (PosProductCard). Dữ liệu đã được server gộp, phân trang VÀ lọc
 * THEO NHÓM (không lọc/phân trang client, vì client chỉ có trang đang xem).
 * - Bố cục (Đợt A): Danh sách có cột cố định (ô kích cỡ theo khe, giá thẳng cột); Lưới tính số cột theo
 *   bề rộng vùng danh mục (thẻ tối thiểu 190px); ô dư gom vào "+N cỡ" mở khay chọn cỡ (một khay một lúc).
 * - Chế độ xem: chưa chọn tay thì cửa sổ thấp mở Danh sách; lựa chọn tay nhớ theo máy.
 * - Cuộn độc lập, F3 (searchRef) và Enter SKU-only (onEnterAdd — tra cứu toàn bộ, KHÔNG phụ thuộc bộ lọc).
 * - Bộ lọc tồn kho theo nhóm: Còn hàng = còn ít nhất một kích cỡ; Hết hàng = hết mọi kích cỡ; Tất cả.
 * - Chế độ quét mã (scanMode): ô tìm kiếm VẪN dùng để tìm theo tên; mã quét được nhận ở mọi chỗ (kể cả
 *   khi đang gõ dở trong ô — PosSalesPage trả lại chữ cũ) và thêm thẳng vào hóa đơn; kết quả từng lần
 *   quét + đèn báo hiện ngay tại ô tìm kiếm.
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
  // Kho của hóa đơn đang mở: đổi kho thì cuộn về đầu và đóng khay chọn cỡ.
  warehouseId = null,
}) {
  const [view, setView] = useState(readInitialView);
  const scrollRef = useRef(null);
  const baseLayout = useCatalogLayout(scrollRef);
  // Danh sách, theo TRANG đang xem (mọi dòng vẫn thẳng cột):
  // - cột giá nới theo chữ giá dài nhất (khoảng giá trên 10 triệu không lòi ra ngoài), cột ô cỡ bớt khe tương ứng;
  // - cột ô cỡ chỉ rộng bằng dòng cần nhiều khe nhất (tối đa số khe vừa màn) để cột tên rộng hơn khi cả trang
  //   chỉ có 4–5 cỡ.
  const layout = useMemo(() => {
    const { list } = baseLayout;
    if (list.stacked || !groups.length) return baseLayout;
    const widestPrice = Math.max(0, ...groups.map((group) => baseLayout.textWidth(priceLabelOf(priceSummary(group.variants)), 'price')));
    const priceWidth = Math.max(LIST_PRICE_MIN, Math.ceil(widestPrice) + 2);
    const maxSlots = Math.max(1, list.slots - Math.ceil((priceWidth - LIST_PRICE_MIN) / (LIST_SLOT + LIST_GAP)));
    const needed = Math.max(1, ...groups.map((group) => group.variants
      .reduce((sum, variant) => sum + Math.min(baseLayout.spanOf(variant.tenSize, 'list'), maxSlots), 0)));
    const slots = Math.min(maxSlots, needed);
    if (slots === list.slots && priceWidth === LIST_PRICE_MIN) return baseLayout;
    return { ...baseLayout, list: { ...list, slots, priceWidth, sizesWidth: slots * LIST_SLOT + (slots - 1) * LIST_GAP } };
  }, [baseLayout, groups]);

  const chooseView = (next) => {
    setView(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* Storage có thể bị chặn; giữ chế độ trong phiên. */ }
  };

  // Cuộn về đầu khi KẾT QUẢ đổi (từ khóa đã debounce), không theo từng phím gõ / mã quét lướt qua ô.
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [resultQuery, page, view, stockFilter, warehouseId]);

  // Khay chọn cỡ: một khay một lúc (khóa nhóm đang mở). Đổi từ khóa, trang, chế độ xem, bộ lọc, kho hoặc có
  // mã quét vừa được thêm thì đóng khay — đóng hẳn (không chỉ ẩn), để quay lại đúng phạm vi cũ khay không tự
  // bật lại. Điều chỉnh state ngay khi vẽ theo cách React khuyên, không qua effect.
  const trayScope = `${resultQuery ?? ''}|${page}|${view}|${stockFilter}|${warehouseId ?? ''}|${lastScan?.ok ? lastScan.seq : ''}`;
  const [openTrayKey, setOpenTrayKey] = useState(null);
  const [trayScopeSeen, setTrayScopeSeen] = useState(trayScope);
  if (trayScopeSeen !== trayScope) {
    setTrayScopeSeen(trayScope);
    if (openTrayKey !== null) setOpenTrayKey(null);
  } else if (openTrayKey !== null && !groups.some((group) => group.key === openTrayKey)) {
    // Mẫu đang mở khay biến khỏi trang (lượt tải ngầm: quầy khác bán hết) -> đóng hẳn, để lúc mẫu có hàng lại
    // khay không tự bật lên và giành con trỏ.
    setOpenTrayKey(null);
  }
  const trayAnchorRef = useRef(null);
  const toggleTray = useCallback((key, anchor) => {
    trayAnchorRef.current = anchor;
    setOpenTrayKey((current) => (current === key ? null : key));
  }, []);
  const closeTray = useCallback((refocus) => {
    setOpenTrayKey(null);
    if (refocus) trayAnchorRef.current?.focus?.({ preventScroll: true });
  }, []);

  const empty = emptyMessage({ search: resultQuery ?? search, stockFilter });
  // Thẻ chỉ dựng lại khi danh sách / chế độ xem / bố cục / khay / giỏ đổi (onAdd ổn định) — gõ phím, mã
  // quét đi qua ô tìm kiếm không vẽ lại cả lưới; mỗi thẻ tự bỏ qua nếu số lượng trong giỏ của nó không đổi.
  // Đang tìm theo mã: ô kích cỡ có mã SKU / mã vạch chứa từ khóa được viền nổi (và được ưu tiên hiện khi
  // phải gom vào "+N"). Từ khóa quá ngắn (1–2 ký tự) khớp gần như mọi mã nên không tô.
  const typedCode = (resultQuery ?? '').trim().toLowerCase();
  const matchCode = typedCode.length >= 3 ? typedCode : '';
  const cards = useMemo(
    () => groups.map((group) => (
      <PosProductCard
        cartQuantities={cartQuantities}
        group={group}
        key={group.key}
        layout={layout}
        matchCode={matchCode}
        onAdd={onAdd}
        onCloseTray={closeTray}
        onToggleTray={toggleTray}
        trayAnchorRef={trayAnchorRef}
        trayOpen={openTrayKey === group.key}
        view={view}
      />
    )),
    [groups, cartQuantities, layout, matchCode, onAdd, closeTray, toggleTray, openTrayKey, view],
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
  // Chưa có kết quả nào (đang tải lần đầu / lỗi): không ghi "0 mẫu" gây hiểu nhầm là kho trống.
  const showCount = groups.length > 0 || (!loading && !error);

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
    <section aria-label="Danh mục hàng hóa" className="flex min-h-0 min-w-0 flex-col overflow-clip rounded-lg border border-bo-border bg-bo-surface">
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
            <button aria-label="Lưới" aria-pressed={view === 'grid'} className={`grid size-[34px] place-items-center rounded-md transition focus-visible:outline-2 focus-visible:outline-bo-primary ${view === 'grid' ? 'bg-bo-primary-soft text-bo-primary' : 'text-bo-muted hover:bg-slate-100'}`} onClick={() => chooseView('grid')} title="Lưới" type="button"><LayoutGrid aria-hidden="true" size={17} /></button>
            <button aria-label="Danh sách" aria-pressed={view === 'list'} className={`grid size-[34px] place-items-center rounded-md transition focus-visible:outline-2 focus-visible:outline-bo-primary ${view === 'list' ? 'bg-bo-primary-soft text-bo-primary' : 'text-bo-muted hover:bg-slate-100'}`} onClick={() => chooseView('list')} title="Danh sách" type="button"><List aria-hidden="true" size={17} /></button>
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
          {showCount ? <span className="ml-auto hidden shrink-0 text-xs text-bo-muted sm:inline">{formatCount(totalElements)} mẫu (theo màu)</span> : null}
        </div>
      </div>

      {/* scrollbar-gutter: stable — chừa sẵn chỗ thanh cuộn để số cột/khe không đổi khi thanh cuộn hiện/ẩn. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable]" data-pos-catalog-scroll="" ref={scrollRef}>
        {loading && !groups.length ? (
          <div aria-live="polite" className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <span className="size-6 animate-spin rounded-full border-2 border-bo-primary/25 border-t-bo-primary" />
            <p className="mt-3 text-sm font-semibold text-bo-foreground">Đang tải hàng hóa…</p>
          </div>
        ) : error && !groups.length ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center" role="alert">
            <AlertCircle aria-hidden="true" className="text-bo-danger" size={22} />
            <p className="mt-3 text-sm font-semibold text-bo-foreground">Không tải được danh mục hàng hóa</p>
            <p className="mt-1 max-w-md text-xs leading-5 text-bo-muted">{loadErrorReason(error)}</p>
            <button className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-bo-primary hover:underline" onClick={onRetry} type="button"><RotateCcw aria-hidden="true" size={13} />Thử lại</button>
          </div>
        ) : groups.length ? (
          <>
            {error ? (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="status">
                <span>Không tải được trang mới — đang hiện trang đã tải. {loadErrorReason(error)}</span>
                <button className="shrink-0 font-semibold hover:underline" onClick={onRetry} type="button">Thử lại</button>
              </div>
            ) : null}
            {/* Đang tải kết quả mới (đổi bộ lọc/từ khóa/trang): làm mờ danh sách cũ để không bị hiểu nhầm là kết quả mới. */}
            <div
              aria-busy={loading}
              aria-label={view === 'grid' ? 'Lưới sản phẩm' : 'Danh sách sản phẩm'}
              className={`${view === 'grid' ? 'grid w-full gap-3' : 'flex flex-col divide-y divide-bo-border'} transition-opacity ${loading ? 'opacity-60' : ''}`}
              style={view === 'grid' ? { gridTemplateColumns: `repeat(${layout.grid.cols}, minmax(0, 1fr))` } : undefined}
            >
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
          <span className="tabular-nums">{formatCount(start)}–{formatCount(end)} / {formatCount(totalElements)}</span>
          <div className="flex items-center gap-2">
            <button aria-label="Trang sản phẩm trước" className={`${iconButton} disabled:opacity-40`} disabled={loading || page === 0} onClick={() => onPageChange(page - 1)} type="button"><ChevronLeft aria-hidden="true" size={16} /></button>
            <span className="tabular-nums">{formatCount(page + 1)} / {formatCount(pageCount)}</span>
            <button aria-label="Trang sản phẩm sau" className={`${iconButton} disabled:opacity-40`} disabled={loading || page + 1 >= pageCount} onClick={() => onPageChange(page + 1)} type="button"><ChevronRight aria-hidden="true" size={16} /></button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}
