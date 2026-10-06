import { useEffect, useRef, useState } from 'react';
import { Barcode, ChevronLeft, ChevronRight, LayoutGrid, List, RotateCcw, Search } from 'lucide-react';
import PosProductCard from './PosProductCard';

const VIEW_KEY = 'fcentric.pos.productView';
const iconButton = 'grid size-10 shrink-0 place-items-center rounded-lg border border-bo-border text-bo-muted transition hover:border-bo-primary/40 hover:bg-slate-50 hover:text-bo-primary focus-visible:outline-2 focus-visible:outline-bo-primary';

/**
 * Catalog POS bản live: dữ liệu đã được server phân trang (không lọc/phân trang client).
 * Giữ nguyên lưới full-width gap 12px (3/4/5/6 cột tại 1280/1600/1920), chế độ Danh sách,
 * localStorage view preference, cuộn độc lập, F3 (searchRef) và Enter SKU-only (onEnterAdd).
 * Chỉ có nhóm "Tất cả" — không có bộ lọc Nam/Nữ.
 */
export default function PosProductCatalog({
  products,
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
  onBarcode,
  onAdd,
}) {
  const [view, setView] = useState(() => {
    try { return window.localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; }
    catch { return 'grid'; }
  });
  const scrollRef = useRef(null);

  useEffect(() => {
    try { window.localStorage.setItem(VIEW_KEY, view); } catch { /* Storage có thể bị chặn; giữ chế độ trong phiên. */ }
  }, [view]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [search, page, view]);

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

  return (
    <section aria-label="Danh mục hàng hóa" className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface">
      <div className="shrink-0 border-b border-bo-border px-3 py-3">
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-bo-muted" size={17} />
            <input aria-label="Tìm hàng hóa" className="min-h-10 w-full rounded-lg border border-bo-border bg-bo-surface py-2 pl-9 pr-3 text-sm text-bo-foreground outline-none placeholder:text-bo-muted focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/10" onChange={(event) => onSearch(event.target.value)} onKeyDown={onSearchKeyDown} placeholder="Tên hoặc mã hàng (F3)" ref={searchRef} value={search} />
          </label>
          <button aria-label="Nhập mã vạch" className={iconButton} onClick={onBarcode} title="Quét mã hàng hóa" type="button"><Barcode aria-hidden="true" size={19} /></button>
          <div aria-label="Chế độ xem sản phẩm" className="flex shrink-0 gap-0.5 rounded-lg border border-bo-border p-0.5" role="group">
            <button aria-label="Lưới" aria-pressed={view === 'grid'} className={`grid size-[34px] place-items-center rounded-md transition focus-visible:outline-2 focus-visible:outline-bo-primary ${view === 'grid' ? 'bg-bo-primary-soft text-bo-primary' : 'text-bo-muted hover:bg-slate-100'}`} onClick={() => setView('grid')} title="Lưới" type="button"><LayoutGrid aria-hidden="true" size={17} /></button>
            <button aria-label="Danh sách" aria-pressed={view === 'list'} className={`grid size-[34px] place-items-center rounded-md transition focus-visible:outline-2 focus-visible:outline-bo-primary ${view === 'list' ? 'bg-bo-primary-soft text-bo-primary' : 'text-bo-muted hover:bg-slate-100'}`} onClick={() => setView('list')} title="Danh sách" type="button"><List aria-hidden="true" size={17} /></button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div aria-label="Lọc theo nhóm hàng" className="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5" role="tablist">
            <button aria-selected className="shrink-0 rounded-full bg-bo-primary px-3 py-1.5 text-xs font-medium text-white" role="tab" type="button">Tất cả</button>
          </div>
          <span className="hidden shrink-0 text-xs text-bo-muted sm:inline">{totalElements} hàng hóa</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3" ref={scrollRef}>
        {loading && !products.length ? (
          <div aria-live="polite" className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <span className="size-6 animate-spin rounded-full border-2 border-bo-primary/25 border-t-bo-primary" />
            <p className="mt-3 text-sm font-semibold text-bo-foreground">Đang tải hàng hóa…</p>
          </div>
        ) : error && !products.length ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <p className="mt-3 text-sm font-semibold text-bo-foreground">Không thể tải danh mục hàng hóa</p>
            <p className="mt-1 text-xs leading-5 text-bo-muted">Không hiển thị dữ liệu mẫu khi API lỗi. Vui lòng thử lại.</p>
            <button className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-bo-primary hover:underline" onClick={onRetry} type="button"><RotateCcw aria-hidden="true" size={13} />Thử lại</button>
          </div>
        ) : products.length ? (
          <>
            {error ? (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <span>Không thể tải trang mới — đang hiển thị trang đã tải.</span>
                <button className="shrink-0 font-semibold hover:underline" onClick={onRetry} type="button">Thử lại</button>
              </div>
            ) : null}
            <div aria-label={view === 'grid' ? 'Lưới sản phẩm' : 'Danh sách sản phẩm'} className={view === 'grid' ? 'grid w-full grid-cols-3 gap-3 min-[1280px]:grid-cols-4 min-[1600px]:grid-cols-5 min-[1920px]:grid-cols-6' : 'flex flex-col divide-y divide-bo-border'}>
              {products.map((product) => <PosProductCard key={product.id} onAdd={onAdd} product={product} view={view} />)}
            </div>
          </>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <Search aria-hidden="true" className="text-bo-muted" size={24} />
            <p className="mt-3 text-sm font-semibold text-bo-foreground">Không tìm thấy hàng hóa</p>
            <p className="mt-1 text-xs leading-5 text-bo-muted">Thử đổi từ khóa khác.</p>
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
