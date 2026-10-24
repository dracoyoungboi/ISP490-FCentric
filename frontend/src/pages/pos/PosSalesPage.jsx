import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { toast as sonnerToast } from '@/lib/thongBaoNhanh';
import {
  ShoppingBag,
  X,
} from 'lucide-react';
import PosTopBar from './components/PosTopBar';
import PosWarehousePicker from './components/PosWarehousePicker';
import PosCartPanel from './components/PosCartPanel';
import PosInvoiceTabs from './components/PosInvoiceTabs';
import PosDialogs from './components/PosDialogs';
import PosProductCatalog from './components/PosProductCatalog';
import { formatMoney } from './pos-format';
import { createScanBurstTracker, hasNonAscii, isPrintableKey, isTextEntry, QTY_REVERT_EVENT, readFlag, writeFlag } from './pos-scan';
import useOnlineStatus, { useOnReconnect, isNetworkError } from '@/hooks/useOnlineStatus';
import useScanQueue from '@/hooks/useScanQueue';
import { playScanBeep } from '@/utils/scanBeep';
import {
  posService,
  toPosGroup,
  toPosProduct,
  toPosCustomer,
  WALKIN_CUSTOMER_CODE,
  newCheckoutRequestId,
  getPendingCheckoutIds,
  addPendingCheckoutId,
  loadPosDrafts,
  savePosDrafts,
  removePendingCheckoutId,
} from '@/services/posService';

// Danh mục gộp kích cỡ: mỗi trang 60 dòng mẫu + màu (mỗi dòng gồm đủ các kích cỡ của nó).
const PAGE_SIZE = 60;
// Từ 1280px (cùng mốc xl hiện giỏ cố định bên phải) dải hóa đơn nằm trên thanh trên cùng (chốt Mẫu B).
const WIDE_SCREEN_QUERY = '(min-width: 1280px)';
const SEARCH_DEBOUNCE_MS = 250;
const PAYOS_POLL_MS = 3000;
// Giao dịch lỗi chờ quản lý: hỏi thưa hơn (quản lý xử lý tính bằng phút), WebSocket vẫn báo ngay.
const PAYOS_PAID_ERROR_POLL_MS = 15000;
const PAYOS_LOCKING_STATUSES = ['PENDING', 'PAID_ERROR'];
// Tồn đổi do quầy khác bán: tải ngầm lại trang catalog đang xem theo chu kỳ (khi tab đang hiển thị).
const CATALOG_REFRESH_MS = 30000;
// Bộ lọc tồn kho khi mở POS: chỉ hiện hàng còn bán được (con_hang | het_hang | tat_ca).
const DEFAULT_STOCK_FILTER = 'con_hang';
// Giới hạn số SKU mỗi lần hỏi tồn cho giỏ (khớp giới hạn server).
const MAX_STOCK_IDS = 200;
// Chế độ quét mã nhớ theo máy: máy quầy có súng quét mở POS là quét được ngay.
const SCAN_MODE_KEY = 'fcentric.pos.scanMode';
// Lookup barcode trả tối đa 10 dòng (server) — đủ 10 nghĩa là "nhiều", không phải đúng 10.
const LOOKUP_BARCODE_LIMIT = 10;

function countCart(cart) {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

/** Theo dõi một media query (an toàn khi trình duyệt/môi trường test không có matchMedia). */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => Boolean(window.matchMedia?.(query)?.matches));
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return undefined;
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

const NO_CART_QUANTITIES = new Map();

/** Trang danh mục rỗng (chưa chọn kho / đổi kho). */
const EMPTY_CATALOG = { groups: [], items: [], totalElements: 0, page: 0, pageCount: 1, loading: false, error: null };

/**
 * Một trang danh mục gộp từ server -> { groups: dòng mẫu + màu cho lưới, items: mọi kích cỡ (SKU) của
 * trang để cập nhật tồn vào giỏ như trước }.
 */
const readCatalogPage = (pageData) => {
  const groups = (pageData?.content ?? []).map(toPosGroup);
  return { groups, items: groups.flatMap((group) => group.variants) };
};

/**
 * Hóa đơn (tab) giữ riêng: giỏ (key = bienTheSanPhamId), khách, ghi chú, phương thức,
 * tiền thanh toán, KHO và attempt thanh toán (requestId + payload đã đóng băng) của
 * chính nó. Đổi kho chỉ xóa giỏ của hóa đơn hiện tại — không giữ dòng hàng của kho A
 * hiển thị dưới kho B. Thay đổi giỏ/khách sau thất bại xác định sẽ hủy attempt cũ để
 * lần sau dùng requestId MỚI (không bao giờ tái dùng key cho payload đã sửa).
 */
function createInvoice(number, { warehouseId = null, customer = null } = {}) {
  return {
    number,
    warehouseId,
    cart: [],
    customer,
    note: '',
    paymentMethod: 'cash',
    paymentAmount: 0,
    attempt: null, // {requestId, status: pending|unknown|failed|succeeded, payload, result, error}
    payos: null, // giao dịch chuyển khoản payOS đang mở: {orderCode, requestId, trangThai, qrCode, ...}
  };
}

/**
 * Số tab hóa đơn là nhãn tạm trên màn hình (mã đơn thật SO… do server cấp khi thanh toán),
 * nên luôn lấy số nhỏ nhất còn trống: đóng "Hóa đơn 1" trống thì tab mới vẫn là "Hóa đơn 1",
 * không nhảy lên 2, 3, 4…
 */
const nextFreeInvoiceNumber = (invoices) => {
  const used = new Set(invoices.map((invoice) => invoice.number));
  let number = 1;
  while (used.has(number)) number += 1;
  return number;
};

/** Phần của hóa đơn được lưu nháp. Hóa đơn đã thanh toán thành công thì không lưu (tránh bán lại). */
const toDraft = (invoice) => {
  if (invoice.attempt?.status === 'succeeded' || invoice.payos?.trangThai === 'PAID') return null;
  const keepAttempt = invoice.attempt && ['pending', 'unknown'].includes(invoice.attempt.status);
  return {
    number: invoice.number,
    warehouseId: invoice.warehouseId,
    cart: invoice.cart,
    customer: invoice.customer,
    note: invoice.note,
    paymentMethod: invoice.paymentMethod,
    paymentAmount: invoice.paymentAmount,
    // Giao dịch tiền mặt đã gửi mà chưa rõ kết quả: giữ để bắt buộc kiểm tra lại, không cho gửi trùng.
    attempt: keepAttempt ? { ...invoice.attempt, status: 'unknown', result: null } : null,
    // Chờ quét QR hoặc đã nhận tiền nhưng lỗi (chờ quản lý): giữ để hóa đơn vẫn khóa sau F5, không thu tiền lại.
    payos: PAYOS_LOCKING_STATUSES.includes(invoice.payos?.trangThai) ? invoice.payos : null,
  };
};

/** Dựng lại danh sách hóa đơn từ bản nháp; kho không còn quyền thì chuyển về kho mặc định. */
const restoreDrafts = (drafts, warehouses, defaultWarehouseId) => {
  if (!drafts) return null;
  const used = new Set();
  const invoices = drafts.invoices
    .filter((d) => d && Number.isInteger(d.number) && d.number > 0 && !used.has(d.number) && used.add(d.number))
    .map((d) => ({
      ...createInvoice(d.number),
      ...d,
      warehouseId: warehouses.some((w) => w.id === d.warehouseId) ? d.warehouseId : defaultWarehouseId,
      cart: Array.isArray(d.cart) ? d.cart : [],
      note: d.note || '',
    }));
  if (!invoices.length) return null;
  const activeInvoice = invoices.some((i) => i.number === drafts.activeInvoice) ? drafts.activeInvoice : invoices[0].number;
  return { invoices, activeInvoice };
};

const isFrozenInvoice = (invoice) =>
  Boolean(invoice?.attempt && (invoice.attempt.status === 'pending' || invoice.attempt.status === 'unknown'))
  // Đang chờ khách quét QR (hàng đã giữ chỗ theo đúng giỏ này), hoặc khách ĐÃ chuyển tiền nhưng chưa tạo
  // được đơn (PAID_ERROR, chờ quản lý xử lý) -> khóa sửa giỏ, F9 không mở thu tiền mặt.
  || PAYOS_LOCKING_STATUSES.includes(invoice?.payos?.trangThai);

/** Khách đã chuyển khoản nhưng chưa có đơn: quản lý xử lý ở màn Đối soát chuyển khoản. */
const isPayosPaidError = (invoice) => invoice?.payos?.trangThai === 'PAID_ERROR';

/** Tồn khả dụng đã biết (số) hoặc null = chưa biết — không coi null/'' là hết hàng như Number(null) = 0. */
const knownStock = (stock) => (stock === null || stock === undefined || stock === '' || !Number.isFinite(Number(stock)) ? null : Number(stock));
/** Dòng giỏ có số lượng vượt tồn khả dụng đã biết (tồn chưa biết = không chặn, server vẫn kiểm). */
const isOverStock = (line) => Number.isFinite(line.product.stock) && line.quantity > line.product.stock;
const OVER_STOCK_MESSAGE = 'Có sản phẩm vượt tồn khả dụng — giảm số lượng hoặc xóa dòng đó trước khi thanh toán.';
const OFFLINE_PAYMENT_MESSAGE = 'Mất kết nối mạng — chưa thể thanh toán. Kiểm tra mạng rồi thử lại; hóa đơn vẫn được giữ.';
const OFFLINE_CHECK_MESSAGE = 'Đang mất mạng — chưa kiểm tra được giao dịch. Có mạng lại hãy bấm kiểm tra kết quả.';
const NETWORK_ERROR_MESSAGE = 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';

/**
 * Cập nhật tồn khả dụng mới (từ catalog vừa tải) vào các dòng giỏ của mọi hóa đơn CÙNG kho.
 * Bỏ qua hóa đơn đang treo thanh toán: tồn khả dụng đã trừ phần QR của chính nó giữ chỗ.
 * Không có gì đổi -> trả lại đúng mảng cũ (không render/lưu nháp thừa).
 */
const withCartStock = (invoices, warehouseId, products) => {
  const stockById = new Map(products.filter((p) => Number.isFinite(p.stock)).map((p) => [p.id, p.stock]));
  if (!stockById.size) return invoices;
  let changed = false;
  const next = invoices.map((invoice) => {
    if (invoice.warehouseId !== warehouseId || isFrozenInvoice(invoice)) return invoice;
    let cartChanged = false;
    const cart = invoice.cart.map((line) => {
      const stock = stockById.get(line.product.id);
      if (stock === undefined || stock === line.product.stock) return line;
      cartChanged = true;
      return { ...line, product: { ...line.product, stock } };
    });
    if (!cartChanged) return invoice;
    changed = true;
    return { ...invoice, cart };
  });
  return changed ? next : invoices;
};

/**
 * Dòng giỏ (cùng kho, hóa đơn không bị khóa) KHÔNG nằm trong trang catalog vừa tải thì không được
 * withCartStock cập nhật — ví dụ đang lọc "Còn hàng" mà SKU trong giỏ vừa bị quầy khác bán hết nên
 * biến khỏi danh sách. Hỏi riêng tồn của các dòng đó để vẫn đánh dấu được "Chỉ còn N"/hết hàng.
 * Lỗi mạng: bỏ qua (lượt sau thử lại; server vẫn kiểm tồn khi thanh toán).
 * isCurrent(): false nếu đã có lượt tải catalog mới hơn -> bỏ kết quả cũ, không ghi đè tồn mới hơn.
 */
const refreshMissingCartStock = (warehouseId, loadedItems, invoicesNow, setInvoices, signal, isCurrent) => {
  const loaded = new Set(loadedItems.map((product) => product.id));
  const missing = new Set();
  invoicesNow.forEach((invoice) => {
    if (invoice.warehouseId !== warehouseId || isFrozenInvoice(invoice)) return;
    invoice.cart.forEach((line) => {
      if (!loaded.has(line.product.id)) missing.add(line.product.id);
    });
  });
  const ids = [...missing].slice(0, MAX_STOCK_IDS);
  if (!ids.length) return;
  posService.getStock(warehouseId, ids, { signal })
    .then((stockById) => {
      if (isCurrent && !isCurrent()) return;
      const products = ids
        .filter((id) => stockById?.[id] != null)
        .map((id) => ({ id, stock: Number(stockById[id]) }));
      setInvoices((current) => withCartStock(current, warehouseId, products));
    })
    .catch(() => { /* tải ngầm lỗi: giữ tồn đang có */ });
};

/**
 * Danh sách co lại (đã bán bớt, hàng hết khi đang lọc "Còn hàng"...) trong khi đang xem trang cuối cũ
 * -> server trả trang rỗng. Trả về trang cuối còn hợp lệ để tải lại; trang vẫn hợp lệ -> null.
 */
const pageToClamp = (requestedPage, pageData) => {
  const lastPage = Math.max((pageData?.totalPages ?? 1) - 1, 0);
  return requestedPage > lastPage ? lastPage : null;
};

/** Server báo thiếu hàng (409 insufficient): ghi số còn lại vào đúng dòng của hóa đơn đó. */
const withInsufficientStock = (invoices, invoiceNumber, insufficient) => {
  const remaining = new Map(insufficient.map((item) => [item.bienTheSanPhamId, Math.max(0, Number(item.conLai) || 0)]));
  return invoices.map((invoice) => invoice.number !== invoiceNumber ? invoice : {
    ...invoice,
    cart: invoice.cart.map((line) => remaining.has(line.product.variantId)
      ? { ...line, product: { ...line.product, stock: remaining.get(line.product.variantId) } }
      : line),
  });
};

/**
 * Tra mã để thêm vào hóa đơn: khớp CHÍNH XÁC mã SKU / mã vạch biến thể trước. Chỉ khi không có mã
 * khớp đúng và cho phép (Enter gõ tay) mới lấy mã đầu tiên BẮT ĐẦU bằng từ khóa như trước — mã đầy đủ
 * không bao giờ bị thay bằng một biến thể khác chỉ trùng phần đầu mã.
 * Trả về { kind: 'found', product } | { kind: 'ambiguous', count } | { kind: 'not_found' }.
 */
const lookupForAdd = async (khoId, code, { allowPrefix = false } = {}) => {
  const exact = await posService.lookup(khoId, { barcode: code });
  if (exact.length > 1) return { kind: 'ambiguous', count: exact.length };
  if (exact.length === 1) return { kind: 'found', product: toPosProduct(exact[0]) };
  if (!allowPrefix) return { kind: 'not_found' };
  const byPrefix = await posService.lookup(khoId, { skuPrefix: code });
  return byPrefix[0] ? { kind: 'found', product: toPosProduct(byPrefix[0]) } : { kind: 'not_found' };
};

/**
 * Màn Bán hàng tại quầy (Phase 04 — nối checkout CASH + recovery):
 * - Checkout chỉ khả dụng khi checkoutEnabled=true (env gate, mặc định tắt) và
 *   callback thật posService.checkout luôn được dùng — KHÔNG có nhánh giả thành công.
 * - requestId sinh 1 lần cho mỗi lần đóng băng payload; timeout/mất mạng = CHƯA RÕ,
 *   phải hỏi recovery bằng đúng key trước khi quyết; refresh giữ metadata tối thiểu
 *   (chỉ requestId) để phục hồi, KHÔNG tự gửi lại khi mount.
 * - Chỉ khi server xác nhận SUCCESS mới cập nhật tồn, hiện receipt chính thức và đóng
 *   ĐÚNG tab đã gửi; in lỗi chỉ thử lại in, không chạy lại checkout.
 */
export default function PosSalesPage({
  warehouses = [],
  initialWarehouseId = null,
  customers = [],
  checkoutEnabled = false,
  tabId = null,
}) {
  // Khách thêm nhanh tại quầy trong phiên này (chưa có trong danh sách tải lúc mở trang).
  const [addedCustomers, setAddedCustomers] = useState([]);
  // Danh sách hiển thị: Khách lẻ luôn ở đầu, khách vừa thêm kế tiếp, rồi các khách còn lại.
  const customerOptions = useMemo(() => {
    const addedIds = new Set(addedCustomers.map((item) => item.id));
    const all = [...addedCustomers, ...customers.filter((item) => !addedIds.has(item.id))];
    const walkIn = all.filter((item) => item.code === WALKIN_CUSTOMER_CODE);
    return [...walkIn, ...all.filter((item) => item.code !== WALKIN_CUSTOMER_CODE)];
  }, [customers, addedCustomers]);
  const walkInCustomer = useMemo(
    () => customers.find((customer) => customer.code === WALKIN_CUSTOMER_CODE) || null,
    [customers]
  );
  const defaultWarehouseId =
    initialWarehouseId && warehouses.some((w) => w.id === initialWarehouseId)
      ? initialWarehouseId
      : warehouses[0]?.id ?? null;

  // Khôi phục hóa đơn đang làm dở sau F5 (một lần, lúc mở trang).
  const [restoredDrafts] = useState(() => restoreDrafts(loadPosDrafts(), warehouses, defaultWarehouseId));
  const [invoices, setInvoices] = useState(() => restoredDrafts?.invoices ?? [
    createInvoice(1, { warehouseId: defaultWarehouseId, customer: walkInCustomer }),
  ]);
  const [activeInvoice, setActiveInvoice] = useState(() => restoredDrafts?.activeInvoice ?? 1);

  // Mỗi thay đổi hóa đơn -> lưu nháp (chỉ phần cần để khôi phục, bỏ hóa đơn đã thanh toán xong).
  // Chỉ tab đang giữ quyền POS (tabId) được ghi — tab đã bị tab khác giành quyền bị từ chối.
  useEffect(() => {
    savePosDrafts(invoices.map(toDraft).filter(Boolean), activeInvoice, tabId);
  }, [invoices, activeInvoice, tabId]);

  const currentInvoice = invoices.find((invoice) => invoice.number === activeInvoice) || invoices[0];
  const { cart, customer, note, paymentMethod, paymentAmount, warehouseId, attempt, number: ticketNumber } = currentInvoice;
  const frozen = isFrozenInvoice(currentInvoice);
  // Có dòng vượt tồn khả dụng (quầy khác vừa bán / server báo thiếu) -> khóa thanh toán tới khi sửa giỏ.
  const overStock = !frozen && cart.some(isOverStock);
  const activeWarehouse = warehouses.find((w) => w.id === warehouseId) || null;

  const updateInvoice = (key, value) => setInvoices((current) => current.map((invoice) => invoice.number === activeInvoice
    ? { ...invoice, [key]: typeof value === 'function' ? value(invoice[key]) : value } : invoice));
  const patchInvoice = (invoiceNumber, patch) => setInvoices((current) => current.map((invoice) =>
    invoice.number === invoiceNumber ? { ...invoice, ...patch } : invoice));
  const setCart = (value) => updateInvoice('cart', value);
  const setNote = (value) => updateInvoice('note', value);
  const setPaymentAmount = (value) => updateInvoice('paymentAmount', value);

  const [dialog, setDialog] = useState(null);
  const [closingInvoiceNumber, setClosingInvoiceNumber] = useState(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Chế độ quét mã: ô quét thay ô tìm kiếm, mỗi mã quét được tra CHÍNH XÁC rồi thêm 1 vào hóa đơn.
  const [scanMode, setScanMode] = useState(() => readFlag(SCAN_MODE_KEY, false));
  const [lastScan, setLastScan] = useState(null); // {ok, message, code, seq, ambiguous?}
  // Số thứ tự kết quả quét: đèn báo chớp đúng một lần cho mỗi kết quả, kể cả khi trùng nội dung lần trước.
  const scanSeq = useRef(0);
  // Trạng thái/handler mới nhất cho hàng đợi quét (chạy nền qua await) — tránh closure cũ.
  const scanContext = useRef(null);
  const [search, setSearch] = useState('');
  // Từ khóa gửi lên server: trễ 250ms sau lần gõ cuối để không gọi API ở MỖI phím.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(0);
  // Bộ lọc tồn kho của danh mục hàng (lọc ở server). Không lưu lại — mỗi lần mở POS về mặc định.
  const [stockFilter, setStockFilter] = useState(DEFAULT_STOCK_FILTER);
  const [refreshKey, setRefreshKey] = useState(0);
  const [catalog, setCatalog] = useState(EMPTY_CATALOG);
  const catalogSeq = useRef(0);
  // Bản mới nhất của danh sách hóa đơn cho các lượt tải catalog (không đưa invoices vào deps
  // để sửa giỏ không kéo theo tải lại catalog).
  const invoicesRef = useRef(invoices);
  const searchRef = useRef(null);
  const keyboardContext = useRef(null);
  // Mất mạng (navigator.onLine=false) -> chặn gửi thanh toán MỚI; hóa đơn đang treo vẫn xem được.
  const online = useOnlineStatus();
  const wideScreen = useMediaQuery(WIDE_SCREEN_QUERY);
  const uiRef = useRef({ dialog: null, isSubmitting: false, activeInvoice: null, invoices: [] });
  // "orderCode:trạng thái" đã áp vào hóa đơn — WebSocket và lượt hỏi định kỳ báo cùng kết quả thì chỉ xử lý một lần
  const appliedPayosRef = useRef(new Set());

  // Kết quả thanh toán chính thức (dữ liệu server) cho dialog receipt + kết quả phục hồi sau refresh.
  const [receiptResult, setReceiptResult] = useState(null);
  // Hóa đơn (tab) ứng với receipt đang hiện — đóng receipt sẽ đóng ĐÚNG tab này.
  const [receiptInvoiceNumber, setReceiptInvoiceNumber] = useState(null);
  const [priceChangeInfo, setPriceChangeInfo] = useState(null);
  const [recoveredResult, setRecoveredResult] = useState(null);

  // Kết quả phục hồi sau refresh -> mở dialog thông báo chính thức (không tự submit).
  useEffect(() => {
    if (recoveredResult) setDialog('recovered-result');
  }, [recoveredResult]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0), [cart]);
  const total = subtotal;
  // Thông báo nhanh toàn cục: thời gian tự tắt theo loại lấy từ config/thongBaoNhanh.js.
  const showToast = (message, type = 'info') => {
    const notify = sonnerToast[type] || sonnerToast;
    notify(message);
  };

  // Sau thất bại XÁC ĐỊNH, mọi sửa đổi draft phải mở khóa attempt để lần sau dùng key MỚI.
  const clearFailedAttemptAfterEdit = () => {
    if (attempt && attempt.status === 'failed') {
      updateInvoice('attempt', null);
    }
  };

  // Về trang 1 khi TỪ KHÓA THẬT SỰ ĐỔI (sau debounce), cùng lượt render với từ khóa -> một lần tải.
  // Không reset theo từng phím: mã quét lỡ gõ vào ô tìm kiếm rồi được trả lại chữ cũ thì danh mục
  // giữ nguyên trang, vị trí cuộn và không tải lại.
  const debouncedSearchRef = useRef('');
  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = search.trim();
      if (next === debouncedSearchRef.current) return;
      debouncedSearchRef.current = next;
      setDebouncedSearch(next);
      setCatalogPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    invoicesRef.current = invoices;
  }, [invoices]);

  useEffect(() => { writeFlag(SCAN_MODE_KEY, scanMode); }, [scanMode]);
  // Kết quả quét thuộc hóa đơn/kho trước — đổi hóa đơn hoặc kho thì bỏ, tránh đọc nhầm "SL trong hóa đơn".
  useEffect(() => { setLastScan(null); }, [activeInvoice, warehouseId]);

  // ===== Catalog: fetch theo (kho của hóa đơn đang mở, từ khóa, bộ lọc tồn, trang) =====
  useEffect(() => {
    if (!warehouseId) {
      catalogSeq.current += 1;
      setCatalog(EMPTY_CATALOG);
      return undefined;
    }
    const controller = new AbortController();
    const seq = ++catalogSeq.current;
    setCatalog((prev) => ({ ...prev, loading: true, error: null }));
    posService.getCatalogGroups(warehouseId, {
      q: debouncedSearch,
      trangThaiTon: stockFilter,
      page: catalogPage,
      size: PAGE_SIZE,
      signal: controller.signal,
    })
      .then((pageData) => {
        if (seq !== catalogSeq.current) return;
        const clampedPage = pageToClamp(catalogPage, pageData);
        if (clampedPage !== null) {
          setCatalogPage(clampedPage); // tải lại đúng trang cuối còn dữ liệu
          return;
        }
        const { groups, items } = readCatalogPage(pageData);
        setCatalog({
          groups,
          items,
          totalElements: pageData?.totalElements ?? 0,
          page: pageData?.number ?? 0,
          pageCount: pageData?.totalPages ?? 1,
          loading: false,
          error: null,
        });
        setInvoices((current) => withCartStock(current, warehouseId, items));
        refreshMissingCartStock(warehouseId, items, invoicesRef.current, setInvoices, controller.signal,
          () => seq === catalogSeq.current);
      })
      .catch((error) => {
        if (seq !== catalogSeq.current) return;
        if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return;
        setCatalog((prev) => ({ ...prev, loading: false, error }));
      });
    return () => controller.abort();
  }, [warehouseId, debouncedSearch, stockFilter, catalogPage, refreshKey]);

  // ===== Tải ngầm tồn: quay lại tab (focus/visibilitychange) và mỗi 30 giây khi tab đang hiển thị =====
  // Không bật trạng thái tải, giữ danh sách + vị trí cuộn; bỏ kết quả nếu người bán đã đổi
  // kho/từ khóa/bộ lọc/trang hoặc đang tải lại có hiển thị (catalogSeq đã tăng).
  useEffect(() => {
    if (!warehouseId) return undefined;
    let controller = null;
    const refresh = () => {
      if (controller || document.visibilityState !== 'visible') return;
      const seq = catalogSeq.current;
      const current = new AbortController();
      controller = current;
      posService.getCatalogGroups(warehouseId, {
        q: debouncedSearch,
        trangThaiTon: stockFilter,
        page: catalogPage,
        size: PAGE_SIZE,
        signal: current.signal,
      })
        .then((pageData) => {
          if (seq !== catalogSeq.current) return;
          const clampedPage = pageToClamp(catalogPage, pageData);
          if (clampedPage !== null) {
            setCatalogPage(clampedPage);
            return;
          }
          const { groups, items } = readCatalogPage(pageData);
          setCatalog((prev) => (prev.loading ? prev : {
            ...prev,
            groups,
            items,
            totalElements: pageData?.totalElements ?? prev.totalElements,
            pageCount: pageData?.totalPages ?? prev.pageCount,
            error: null,
          }));
          setInvoices((invoicesNow) => withCartStock(invoicesNow, warehouseId, items));
          // Lượt tải ngầm không giữ controller tới khi hỏi tồn xong -> dùng catalogSeq để bỏ kết quả cũ.
          refreshMissingCartStock(warehouseId, items, invoicesRef.current, setInvoices, current.signal,
            () => seq === catalogSeq.current);
        })
        .catch(() => { /* tải ngầm lỗi (mất mạng...): giữ danh sách đang hiện, lượt sau thử lại */ })
        .finally(() => { if (controller === current) controller = null; });
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, CATALOG_REFRESH_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
      controller?.abort();
    };
  }, [warehouseId, debouncedSearch, stockFilter, catalogPage]);

  // ===== Sau F5: hỏi lại trạng thái các mã QR payOS đang chờ (tiền có thể đã về trong lúc tải lại) =====
  // và các giao dịch lỗi chờ quản lý (có thể đã được tạo đơn / hoàn tiền trong lúc tải lại).
  useEffect(() => {
    const pending = (restoredDrafts?.invoices || []).filter((invoice) => PAYOS_LOCKING_STATUSES.includes(invoice.payos?.trangThai));
    if (!pending.length) return undefined;
    let cancelled = false;
    (async () => {
      for (const invoice of pending) {
        try {
          const link = await posService.getPayosStatus(invoice.payos.orderCode);
          if (cancelled || !link) continue;
          if (['PENDING', 'PAID', 'PAID_ERROR', 'REFUNDED'].includes(link.trangThai)) {
            applyPayosUpdate(invoice.number, link, { quiet: invoice.number === restoredDrafts.activeInvoice });
            if (PAYOS_LOCKING_STATUSES.includes(link.trangThai) && invoice.number === restoredDrafts.activeInvoice) setDialog('payos-qr');
          } else {
            // Mã đã hết hạn/bị hủy: mở khóa giỏ để thanh toán lại (hàng giữ chỗ đã được server trả về kho).
            patchInvoice(invoice.number, { payos: null });
            showToast('Mã QR trước đó đã hết hạn hoặc bị hủy — hóa đơn đã được mở lại.', 'warning');
          }
        } catch {
          /* mất mạng: giữ nguyên, người bán bấm Thanh toán để xem lại mã QR */
        }
      }
    })();
    return () => { cancelled = true; };
    // chỉ chạy một lần với bản nháp khôi phục lúc mở trang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Phục hồi sau refresh/đăng nhập lại: chỉ HỎI kết quả bằng requestId đã gửi, KHÔNG tự gửi lại =====
  // Nguồn requestId: giao dịch chưa rõ trong bản nháp (còn sau khi đăng xuất/đăng nhập lại hay
  // chuyển tab) + metadata trong phiên (sessionStorage). Kiểm tra HẾT danh sách:
  // SUCCESS -> đánh dấu đúng hóa đơn đã thanh toán và mở hóa đơn chính thức của nó;
  // FAILED -> mở khóa hóa đơn để sửa; 404/mất mạng -> giữ "chưa rõ" để người bán kiểm tra lại.
  useEffect(() => {
    const fromDrafts = (restoredDrafts?.invoices || [])
      .filter((invoice) => invoice.attempt?.status === 'unknown' && invoice.attempt.requestId)
      .map((invoice) => ({ requestId: invoice.attempt.requestId, invoiceNumber: invoice.number }));
    const known = new Set(fromDrafts.map((target) => target.requestId));
    const targets = [
      ...fromDrafts,
      ...getPendingCheckoutIds().filter((id) => !known.has(id)).map((requestId) => ({ requestId, invoiceNumber: null })),
    ];
    if (!targets.length) return undefined;
    const setAttempt = (invoiceNumber, patch) => setInvoices((current) => current.map((invoice) =>
      invoice.number === invoiceNumber ? { ...invoice, attempt: { ...(invoice.attempt ?? {}), ...patch } } : invoice));
    let cancelled = false;
    (async () => {
      let resultShown = false;
      for (const target of targets) {
        if (cancelled) return;
        try {
          const res = await posService.getCheckoutRequest(target.requestId);
          if (cancelled) return;
          if (res?.trangThai === 'SUCCESS' && res.result) {
            removePendingCheckoutId(target.requestId);
            setRefreshKey((key) => key + 1);
            if (target.invoiceNumber != null) {
              setAttempt(target.invoiceNumber, { status: 'succeeded', result: res.result, error: null });
              if (!resultShown) {
                // Mở hóa đơn chính thức của ĐÚNG tab đó; "Hoàn tất" sẽ đóng tab này.
                resultShown = true;
                setActiveInvoice(target.invoiceNumber);
                setReceiptInvoiceNumber(target.invoiceNumber);
                setReceiptResult(res.result);
                setDialog('receipt');
              }
              // Các tab còn lại đã thanh toán: mở tab nào sẽ hiện hóa đơn của tab đó.
            } else if (!resultShown) {
              resultShown = true;
              setRecoveredResult(res.result); // giao dịch không còn hóa đơn nháp tương ứng
            }
          } else if (res?.trangThai === 'FAILED') {
            removePendingCheckoutId(target.requestId); // lỗi xác định — không cần giữ metadata
            if (target.invoiceNumber != null) {
              setAttempt(target.invoiceNumber, { status: 'failed', error: res.errorMessage || 'Giao dịch đã thất bại trước đó' });
              sonnerToast.warning(`Giao dịch của hóa đơn ${target.invoiceNumber} không thành công${res.errorMessage ? `: ${res.errorMessage}` : ''}. Hóa đơn đã được mở lại.`);
            }
          }
        } catch (error) {
          // 401/403 đã được apiClient xử lý (về trang đăng nhập) — dừng; 404/mất mạng: giữ "chưa rõ".
          if (error?.response?.status === 401 || error?.response?.status === 403) return;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [restoredDrafts]);

  // Trang danh mục về 1 khi từ khóa (đã debounce) đổi — xem effect debounce ở trên.
  const onSearch = (value) => setSearch(value);

  // Đổi bộ lọc -> quay về trang 1 (trang cũ có thể không còn tồn tại sau khi lọc).
  const onStockFilterChange = (value) => {
    if (value === stockFilter) return;
    setStockFilter(value);
    setCatalogPage(0);
  };

  const [pendingWarehouseId, setPendingWarehouseId] = useState(null);
  // Lần chọn kho vừa rồi có mở hộp hỏi lại không: có -> con trỏ ở nút "Giữ kho hiện tại", không -> về ô tìm kiếm.
  const warehouseConfirmOpening = useRef(false);

  const applyWarehouseChange = (target) => {
    // Chính sách Phase 01 mục 5: đổi kho -> xóa giỏ hóa đơn hiện tại (không giữ nhầm dòng hàng).
    const hadItems = cart.length > 0;
    setInvoices((current) => current.map((invoice) => invoice.number === activeInvoice
      ? { ...invoice, warehouseId: target, cart: [], attempt: invoice.attempt?.status === 'failed' ? null : invoice.attempt }
      : invoice));
    setSearch('');
    setCatalogPage(0);
    setPendingWarehouseId(null);
    const name = warehouses.find((w) => w.id === target)?.tenKho;
    showToast(hadItems
      ? `Đã chuyển sang ${name || 'kho mới'}. Giỏ của hóa đơn hiện tại đã được xóa để tránh nhầm tồn kho.`
      : `Đã chuyển sang ${name || 'kho mới'}.`, 'success');
  };

  const changeWarehouse = (nextWarehouseId) => {
    // Đang có hộp thoại (biên lai, thanh toán…) hoặc đang gửi thanh toán: không đổi kho đè lên.
    if (dialog || isSubmitting) return;
    if (frozen) {
      showToast('Hóa đơn đang trong giao dịch thanh toán — không thể đổi kho lúc này.', 'warning');
      return;
    }
    const target = Number(nextWarehouseId);
    warehouseConfirmOpening.current = false;
    if (!target || target === warehouseId) return;
    // Giỏ đang có hàng -> hỏi lại trước khi xóa, tránh lỡ tay mất cả hóa đơn.
    if (cart.length) {
      warehouseConfirmOpening.current = true;
      setPendingWarehouseId(target);
      setDialog('change-warehouse');
      return;
    }
    applyWarehouseChange(target);
  };

  // ===== Giỏ (key = bienTheSanPhamId — không gộp hai size/màu khác nhau) =====
  const cartQuantity = (variantId) => cart.find((item) => item.product.id === variantId)?.quantity ?? 0;
  // Số lượng đang có trong giỏ theo SKU — ô kích cỡ trong danh mục mờ đi khi đã thêm đủ tồn.
  // Hóa đơn đang treo thanh toán: tồn trên danh mục ĐÃ trừ phần hóa đơn này giữ chỗ (QR payOS) nên không
  // trừ thêm lần nữa (cùng lý do withCartStock bỏ qua hóa đơn bị khóa); bấm vẫn bị chặn và có thông báo.
  const cartQuantities = useMemo(
    () => (frozen ? NO_CART_QUANTITIES : new Map(cart.map((line) => [line.product.id, line.quantity]))),
    [cart, frozen],
  );

  /** Lý do KHÔNG được thêm 1 sản phẩm vào giỏ hiện tại (null = thêm được). */
  const getAddProblem = (product) => {
    if (frozen) return 'Hóa đơn đang trong giao dịch thanh toán — giỏ đã được khóa.';
    const stock = Number(product.stock);
    // Kiểm tra tồn NGOÀI state updater (updater phải thuần — StrictMode gọi 2 lần sẽ bắn toast 2 lần).
    if (Number.isFinite(stock) && cartQuantity(product.id) + 1 > stock) {
      return stock > 0 ? `Chỉ còn ${stock} sản phẩm khả dụng tại kho này.` : `${product.name} đã hết hàng tại kho này.`;
    }
    return null;
  };

  /** Thêm 1 sản phẩm vào giỏ — gọi sau khi getAddProblem đã cho phép. */
  const commitAddProduct = (product) => {
    const variantId = product.id;
    setCart((current) => {
      const existing = current.find((item) => item.product.id === variantId);
      if (existing) {
        // Cập nhật luôn tồn mới nhất từ catalog vào dòng giỏ.
        return current.map((item) => item.product.id === variantId ? { product, quantity: item.quantity + 1 } : item);
      }
      return [...current, { product, quantity: 1 }];
    });
    clearFailedAttemptAfterEdit();
  };

  const addProduct = (product) => {
    const problem = getAddProblem(product);
    if (problem) {
      showToast(problem, 'warning');
      return false;
    }
    commitAddProduct(product);
    return true;
  };
  // Hàm thêm ỔN ĐỊNH cho lưới sản phẩm (luôn gọi addProduct mới nhất): lưới không phải vẽ lại
  // cả trang danh mục ở mỗi phím gõ / mã quét đi qua ô tìm kiếm.
  const addProductRef = useRef(addProduct);
  addProductRef.current = addProduct;
  const addFromCatalog = useCallback((product) => addProductRef.current(product), []);

  const removeLine = (variantId) => {
    if (frozen) return;
    setCart((current) => current.filter((item) => item.product.id !== variantId));
    clearFailedAttemptAfterEdit();
  };

  // Giảm luôn được (kể cả dòng đang vượt tồn). Tăng quá tồn khả dụng -> GIỮ số cũ và báo, không tự hạ
  // về mức tối đa: số quá tồn thường là gõ nhầm / mã quét lọt vào ô, hạ về tối đa sẽ bán nhầm cả kho.
  // Chỉ xóa dòng khi bấm − ở 1 hoặc nút thùng rác.
  const setQuantity = (variantId, quantity) => {
    if (frozen) return;
    const line = cart.find((item) => item.product.id === variantId);
    if (!line || quantity === line.quantity) return;
    if (quantity <= 0) {
      removeLine(variantId);
      return;
    }
    const stock = knownStock(line.product.stock);
    if (stock !== null && quantity > stock && quantity > line.quantity) {
      showToast(stock > 0
        ? `Chỉ còn ${stock} sản phẩm khả dụng tại kho này — số lượng giữ nguyên ${line.quantity}.`
        : `${line.product.name} đã hết hàng tại kho này — số lượng giữ nguyên ${line.quantity}.`, 'warning');
      return;
    }
    setCart((current) => current.map((item) => item.product.id === variantId ? { ...item, quantity } : item));
    clearFailedAttemptAfterEdit();
  };

  const clearCart = () => {
    if (frozen) return;
    setCart([]);
    setNote('');
    setPaymentAmount(0);
    clearFailedAttemptAfterEdit();
    showToast('Đã xóa nội dung hóa đơn.', 'success');
  };

  const selectCustomerForInvoice = (selectedCustomer) => {
    if (frozen) return;
    updateInvoice('customer', selectedCustomer);
    clearFailedAttemptAfterEdit();
  };

  // Thêm nhanh khách hàng (tên + SĐT) rồi chọn luôn cho hóa đơn hiện tại.
  // Lỗi (SĐT sai, trùng...) được ném lại để dialog hiển thị.
  const quickCreateCustomer = async ({ name, phone }) => {
    const created = toPosCustomer(await posService.quickCreateCustomer({ tenKhachHang: name, soDienThoai: phone }));
    setAddedCustomers((current) => [created, ...current.filter((item) => item.id !== created.id)]);
    selectCustomerForInvoice(created);
    showToast(`Đã thêm và chọn khách hàng ${created.name}.`, 'success');
    return created;
  };

  const setNoteForInvoice = (value) => {
    if (frozen) return;
    updateInvoice('note', value);
    clearFailedAttemptAfterEdit();
  };

  const setPaymentAmountForInvoice = (value) => {
    // Tiền mặt tính theo đồng: làm tròn về số nguyên, không âm (server cũng từ chối số âm / số lẻ).
    const amount = Number(value);
    const cash = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
    updateInvoice('paymentAmount', cash);
    setPaymentError(cash < total ? 'Số tiền khách thanh toán chưa đủ.' : '');
    clearFailedAttemptAfterEdit();
  };

  // ===== Tab hóa đơn =====
  // Hóa đơn đang chờ thanh toán (frozen) chỉ khóa SỬA hóa đơn đó — vẫn được mở/chuyển sang
  // hóa đơn khác để phục vụ khách tiếp theo trong lúc chờ khách trước quét QR.
  const requestNewInvoice = () => {
    if (isSubmitting || dialog) return;
    const number = nextFreeInvoiceNumber(invoices);
    setInvoices((current) => [...current, createInvoice(number, { warehouseId, customer: walkInCustomer })]);
    setActiveInvoice(number);
    setPaymentError('');
    setMobileCartOpen(false);
  };

  const selectInvoice = (number) => {
    if (isSubmitting || dialog) return;
    setActiveInvoice(number);
    setPaymentError('');
    setMobileCartOpen(false);
  };

  const isInvoiceUntouched = (invoice) => !invoice.cart.length
    && !invoice.note.trim()
    && !invoice.attempt
    && !invoice.payos
    && (!invoice.customer || (walkInCustomer && invoice.customer.id === walkInCustomer.id));

  const removeInvoice = (number) => {
    const remaining = invoices.filter((invoice) => invoice.number !== number);
    if (!remaining.length) {
      const replacement = createInvoice(1, { warehouseId, customer: walkInCustomer });
      setInvoices([replacement]);
      setActiveInvoice(replacement.number);
    } else {
      setInvoices(remaining);
      if (activeInvoice === number) {
        const index = invoices.findIndex((invoice) => invoice.number === number);
        setActiveInvoice(remaining[Math.min(index, remaining.length - 1)].number);
      }
    }
    setDialog(null);
    setPaymentError('');
    setMobileCartOpen(false);
  };

  const requestCloseInvoice = (number) => {
    if (isSubmitting || dialog) return;
    const target = invoices.find((invoice) => invoice.number === number);
    if (!target) return;
    // Giao dịch lỗi đã chuyển cho quản lý (còn nằm ở màn Đối soát chuyển khoản): cho đóng tab sau khi hỏi lại.
    if (isPayosPaidError(target)) {
      setClosingInvoiceNumber(number);
      setDialog('close-paid-error');
      return;
    }
    if (isFrozenInvoice(target)) {
      showToast('Hóa đơn đang trong giao dịch thanh toán — không thể đóng.', 'warning');
      return;
    }
    if (!isInvoiceUntouched(target)) {
      setClosingInvoiceNumber(number);
      setDialog('close-invoice');
    } else removeInvoice(number);
  };

  // ===== Tra cứu phím tắt / mã vạch (server-side) =====
  const [lookupBusy, setLookupBusy] = useState(false);

  // Enter trong ô tìm kiếm: thêm nhanh theo mã (ưu tiên mã khớp đúng, rồi mới tới đầu mã).
  // Chế độ quét: đi chung hàng đợi quét để có dòng kết quả + âm báo như khi quét.
  const handleEnterAdd = async () => {
    const query = search.trim();
    if (!query) return;
    if (scanMode) {
      // Xóa ô NGAY để mã kế tiếp (máy quét gõ chậm, không nhận ra là lần quét) không dính vào mã này;
      // không thêm được thì processScan trả chữ lại vào ô.
      setSearch('');
      enqueueScan(query, { typed: true });
      return;
    }
    if (lookupBusy || isSubmitting || frozen) return;
    if (!warehouseId) return;
    setLookupBusy(true);
    try {
      const result = await lookupForAdd(warehouseId, query, { allowPrefix: true });
      if (result.kind === 'ambiguous') {
        showToast(`Mã “${query}” trùng ${result.count >= LOOKUP_BARCODE_LIMIT ? 'nhiều' : result.count} biến thể — chọn đúng màu/size trong danh mục.`, 'warning');
        return;
      }
      if (result.kind === 'not_found') {
        showToast(`Không tìm thấy mã hàng bắt đầu bằng "${query}".`, 'warning');
        return;
      }
      const { product } = result;
      if (Number(product.stock) <= 0) {
        showToast(`${product.name} đã hết hàng tại kho này.`, 'warning');
        return;
      }
      if (addProduct(product)) {
        showToast(`Đã thêm ${product.name}.`, 'success');
        setSearch(''); // sẵn sàng cho lần quét/gõ mã tiếp theo
      }
    } catch (error) {
      showToast(isNetworkError(error) ? NETWORK_ERROR_MESSAGE : error?.response?.data?.message || 'Không thể tra cứu mã hàng. Vui lòng thử lại.', 'error');
    } finally {
      setLookupBusy(false);
    }
  };

  // ===== Chế độ quét mã: hàng đợi tuần tự, tra CHÍNH XÁC mã SKU / mã vạch biến thể =====
  // Mỗi mã mang theo hóa đơn + kho LÚC QUÉT; chỉ thêm khi đó vẫn là hóa đơn/kho đang mở,
  // không bị khóa và không có cửa sổ nào đang mở (vd. màn thanh toán) — không bao giờ thêm
  // hàng của kho A vào hóa đơn kho B hay thêm hàng sau lưng màn thanh toán.
  // typed = Enter gõ tay trong ô tìm kiếm (ô đã được xóa ngay khi Enter): cho phép khớp đầu mã khi
  // không có mã khớp đúng; không thêm được thì trả chữ lại vào ô (vd. gõ tên rồi lỡ Enter vẫn giữ từ
  // khóa và kết quả lọc). Mã quét thì chỉ khớp đúng, không đụng tới ô.
  const processScan = async ({ code, invoiceNumber, warehouseId: scanWarehouseId, typed = false }) => {
    const report = (ok, message, extra = {}) => {
      if (!ok && typed) setSearch((current) => (current === '' ? code : current));
      scanSeq.current += 1;
      setLastScan({ ok, message, code, seq: scanSeq.current, ...extra });
      // Chỉ kêu khi KHÔNG thêm được (mã sai, hết hàng, trùng mã…): máy quét đã tự kêu "bíp" khi đọc được mã,
      // nhưng không biết hàng có vào hóa đơn hay không.
      if (!ok) playScanBeep(false);
      // Đã tắt chế độ quét khi mã còn đang tra: dòng kết quả không hiện -> báo bằng toast.
      if (!scanContext.current?.scanMode) showToast(message, ok ? 'success' : 'warning');
    };
    const blocked = () => {
      const ctx = scanContext.current;
      if (ctx.activeInvoice !== invoiceNumber || ctx.warehouseId !== scanWarehouseId) {
        return `Mã “${code}” chưa được thêm vì đã đổi hóa đơn hoặc kho — quét lại.`;
      }
      if (ctx.frozen) return 'Hóa đơn đang chờ thanh toán — giỏ đã khóa. Bấm F2 để mở hóa đơn mới rồi quét.';
      if (ctx.dialog || ctx.isSubmitting) return `Mã “${code}” chưa được thêm vì đang mở cửa sổ khác — đóng cửa sổ rồi quét lại.`;
      return null;
    };
    if (!scanWarehouseId) {
      report(false, 'Chưa chọn kho bán — chọn kho rồi quét lại.');
      return;
    }
    const before = blocked();
    if (before) {
      report(false, before);
      return;
    }
    let result;
    try {
      result = await lookupForAdd(scanWarehouseId, code, { allowPrefix: typed });
    } catch (error) {
      // Không tự thử lại: tránh một lần quét bị thêm hai lần.
      report(false, isNetworkError(error) ? NETWORK_ERROR_MESSAGE : error?.response?.data?.message || `Không tra được mã “${code}” — quét lại.`);
      return;
    }
    const after = blocked();
    if (after) {
      report(false, after);
      return;
    }
    if (result.kind === 'not_found') {
      if (typed) report(false, `Không tìm thấy mã “${code}”. Enter chỉ thêm theo mã SKU / mã vạch — tìm theo tên thì bấm chọn hàng trong danh mục.`);
      else if (hasNonAscii(code)) report(false, `Không tìm thấy mã “${code}”. Mã có chữ có dấu — có thể bộ gõ tiếng Việt (Unikey/EVKey) đang bật: chuyển sang E rồi quét lại.`);
      else report(false, `Không tìm thấy mã “${code}”.`);
      return;
    }
    if (result.kind === 'ambiguous') {
      const count = result.count >= LOOKUP_BARCODE_LIMIT ? 'nhiều' : result.count;
      report(false, `Mã “${code}” trùng ${count} biến thể — chọn đúng màu/size trong danh mục.`, { ambiguous: true });
      return;
    }
    const { product } = result;
    const ctx = scanContext.current;
    const problem = ctx.getAddProblem(product);
    if (problem) {
      report(false, problem.startsWith(product.name) ? problem : `${product.name}: ${problem}`);
      return;
    }
    const quantity = ctx.cartQuantity(product.id) + 1;
    // Render ngay để lần quét kế tiếp kiểm tồn theo giỏ MỚI NHẤT (quét nhanh cùng một món).
    flushSync(() => ctx.commitAddProduct(product));
    report(true, `Đã thêm ${product.name} — SL trong hóa đơn: ${quantity}`);
  };
  const { enqueue: enqueueScanJob, pending: scanPending } = useScanQueue(processScan);
  const enqueueScan = (code, { typed = false } = {}) => {
    const ctx = scanContext.current;
    enqueueScanJob({ code, invoiceNumber: ctx.activeInvoice, warehouseId: ctx.warehouseId, typed });
  };

  const toggleScanMode = () => {
    setScanMode((on) => !on);
    setLastScan(null);
    // Bật hay tắt, ô tìm kiếm vẫn là chỗ nhận mã/gõ tìm -> đưa con trỏ về đó.
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  // Mã trùng nhiều biến thể: lọc danh mục theo mã để chọn tay đúng màu/size (vẫn ở chế độ quét).
  const showScanMatches = (code) => {
    onSearch(code);
    setLastScan(null);
  };

  // ===== Checkout: attempt + requestId + recovery =====
  const buildPayload = (invoice) => ({
    requestId: invoice.attempt?.requestId ?? newCheckoutRequestId(),
    khoId: invoice.warehouseId,
    khachHangId: invoice.customer?.id ?? null,
    items: invoice.cart.map(({ product, quantity }) => ({
      bienTheSanPhamId: product.variantId,
      quantity,
      unitPriceClient: product.price,
    })),
    payment: { method: 'CASH', tenderedAmount: Number(invoice.paymentAmount || 0) },
    note: invoice.note || '',
  });

  const beginAttempt = (invoice) => {
    // Đóng băng payload + key: mọi retry cùng key dùng ĐÚNG payload này.
    const payload = buildPayload(invoice);
    const attemptState = { requestId: payload.requestId, status: 'pending', payload, result: null, error: null };
    patchInvoice(invoice.number, { attempt: attemptState });
    addPendingCheckoutId(payload.requestId);
    return attemptState;
  };

  const finishAttempt = (invoiceNumber, patch) => setInvoices((current) => current.map((invoice) =>
    invoice.number === invoiceNumber
      ? { ...invoice, attempt: { ...(invoice.attempt ?? {}), ...patch } }
      : invoice));

  const openReceipt = (invoiceNumber, result) => {
    setReceiptInvoiceNumber(invoiceNumber);
    setReceiptResult(result);
    setDialog('receipt');
  };

  const handleCheckoutSuccess = (invoiceNumber, result, attemptState) => {
    finishAttempt(invoiceNumber, { status: 'succeeded', result, error: null });
    removePendingCheckoutId(attemptState.requestId);
    // Cập nhật tồn hiển thị: refetch catalog của kho đang bán.
    setRefreshKey((key) => key + 1);
    openReceipt(invoiceNumber, result);
  };

  const handleCheckoutError = (invoiceNumber, error, attemptState) => {
    const status = error?.response?.status;
    const envelope = error?.response?.data;
    // Thiếu hàng (409 có cấu trúc): ghi số còn lại vào đúng dòng để đánh dấu "Chỉ còn N",
    // tải lại tồn trên catalog; sau đó xử lý như lỗi xác định ở nhánh 4xx bên dưới.
    if (status === 409 && Array.isArray(envelope?.data?.insufficient)) {
      setInvoices((current) => withInsufficientStock(current, invoiceNumber, envelope.data.insufficient));
      setRefreshKey((key) => key + 1);
    }
    // 1. Giá đã đổi -> phản hồi có cấu trúc, yêu cầu xác nhận lại giá mới.
    if (status === 409 && envelope?.data?.priceChanged) {
      finishAttempt(invoiceNumber, { status: 'failed', error: 'price-change' });
      removePendingCheckoutId(attemptState.requestId);
      const info = envelope.data;
      // cập nhật giá hiển thị về giá server để người bán xem lại tổng mới (không tự thu tiền mới)
      setInvoices((current) => current.map((invoice) => invoice.number === invoiceNumber
        ? {
            ...invoice,
            cart: invoice.cart.map((line) => {
              const changed = info.items?.find((item) => item.bienTheSanPhamId === line.product.variantId);
              return changed ? { ...line, product: { ...line.product, price: Number(changed.giaMoi) } } : line;
            }),
          }
        : invoice));
      setPriceChangeInfo(info);
      setDialog('price-change');
      setPaymentError('');
      return;
    }
    // 2. Lỗi nghiệp vụ/xung đột XÁC ĐỊNH (4xx, kể cả 503 gate chưa mở): giữ draft, mở khóa.
    if (status && (status < 500 || status === 503)) {
      const message = envelope?.message || 'Không thể hoàn tất thanh toán.';
      finishAttempt(invoiceNumber, { status: 'failed', error: message });
      removePendingCheckoutId(attemptState.requestId);
      setPaymentError(message);
      return;
    }
    // 3. Timeout/mạng/5xx: CHƯA RÕ kết quả — giữ nguyên key+payload, hỏi recovery.
    finishAttempt(invoiceNumber, { status: 'unknown', error: null });
    setPaymentError('');
    setDialog('checkout-unknown');
  };

  const submitCheckout = async () => {
    if (!checkoutEnabled || isSubmitting) return;
    const invoice = currentInvoice;
    if (invoice.attempt?.status === 'pending') return; // chặn click đúp
    if (!online) {
      setPaymentError(OFFLINE_PAYMENT_MESSAGE);
      return;
    }
    if (!invoice.customer) {
      setPaymentError('Vui lòng chọn khách hàng trước khi thanh toán.');
      return;
    }
    const paid = Number(invoice.paymentAmount || 0);
    if (!invoice.cart.length || !Number.isFinite(paid) || paid < total || paid < 0) {
      setPaymentError('Số tiền khách thanh toán chưa đủ.');
      return;
    }
    if (!isFrozenInvoice(invoice) && invoice.cart.some(isOverStock)) {
      setPaymentError(OVER_STOCK_MESSAGE);
      return;
    }
    let attemptState = invoice.attempt;
    if (!attemptState || attemptState.status === 'failed') {
      attemptState = beginAttempt(invoice); // lần gửi mới -> key MỚI (không tái dùng key của payload đã sửa)
    } else if (attemptState.status === 'succeeded') {
      return;
    }
    // status 'unknown' được xử lý riêng qua dialog (recovery/retry cùng key) — không submit trực tiếp.
    if (attemptState.status === 'unknown') {
      setDialog('checkout-unknown');
      return;
    }
    setIsSubmitting(true);
    setPaymentError('');
    try {
      const result = await posService.checkout(attemptState.payload);
      handleCheckoutSuccess(invoice.number, result, attemptState);
    } catch (error) {
      handleCheckoutError(invoice.number, error, attemptState);
    } finally {
      setIsSubmitting(false);
    }
  };

  const recoverCurrentAttempt = async () => {
    const invoice = currentInvoice;
    const attemptState = invoice.attempt;
    if (!attemptState || isSubmitting) return;
    if (!online) {
      showToast(OFFLINE_CHECK_MESSAGE, 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await posService.getCheckoutRequest(attemptState.requestId);
      if (res?.trangThai === 'SUCCESS' && res.result) {
        handleCheckoutSuccess(invoice.number, res.result, attemptState);
      } else if (res?.trangThai === 'FAILED') {
        finishAttempt(invoice.number, { status: 'failed', error: res.errorMessage || 'Giao dịch đã thất bại trước đó' });
        removePendingCheckoutId(attemptState.requestId);
        setPaymentError(res.errorMessage || 'Giao dịch đã thất bại trước đó');
        setDialog(null);
      } else {
        showToast('Máy chủ chưa có kết quả cho giao dịch này. Có thể thử lại cùng mã giao dịch.', 'warning');
      }
    } catch (error) {
      if (error?.response?.status === 404) {
        // Kết quả chưa rõ (server đã rollback): được phép thử lại CÙNG key + CÙNG payload.
        showToast('Giao dịch chưa có kết quả trên máy chủ — có thể thử lại cùng mã giao dịch.', 'warning');
      } else {
        showToast(error?.response?.data?.message || 'Không thể kiểm tra kết quả. Vui lòng thử lại.', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const retrySameAttempt = async () => {
    const invoice = currentInvoice;
    const attemptState = invoice.attempt;
    if (!attemptState || attemptState.status !== 'unknown' || isSubmitting) return;
    if (!online) {
      showToast(OFFLINE_CHECK_MESSAGE, 'warning');
      return;
    }
    // Gửi lại CHÍNH XÁC payload đã đóng băng (cùng key, cùng nội dung).
    setIsSubmitting(true);
    setPaymentError('');
    try {
      const result = await posService.checkout(attemptState.payload);
      handleCheckoutSuccess(invoice.number, result, attemptState);
    } catch (error) {
      handleCheckoutError(invoice.number, error, attemptState);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmNewPrice = () => {
    // Giá mới đã được hiển thị để người bán xem lại tổng mới; giữ draft, mở khóa để gửi lại
    // với key MỚI (payload đã đổi giá nên không tái dùng key cũ).
    setPriceChangeInfo(null);
    setDialog(null);
    showToast('Giá đã được cập nhật theo giá mới nhất trên hệ thống. Vui lòng kiểm tra tổng mới và bấm Thanh toán lại.', 'warning');
  };

  const openPayment = () => {
    if (!cart.length) {
      showToast('Thêm ít nhất một sản phẩm trước khi thanh toán.', 'warning');
      return;
    }
    if (PAYOS_LOCKING_STATUSES.includes(currentInvoice.payos?.trangThai)) {
      // Đang chờ khách quét QR -> mở lại đúng mã QR (xem được cả khi mất mạng).
      // Đã nhận tiền nhưng lỗi -> hiện tình trạng chờ quản lý, KHÔNG mở thu tiền mặt.
      setDialog('payos-qr');
      return;
    }
    if (checkoutEnabled && attempt?.status === 'unknown') {
      setDialog('checkout-unknown');
      return;
    }
    // Hóa đơn mới khi mất mạng: báo ngay, không mở màn thanh toán rồi chờ 30 giây mới lỗi.
    if (!online) {
      showToast(OFFLINE_PAYMENT_MESSAGE, 'error');
      return;
    }
    if (overStock) {
      showToast(OVER_STOCK_MESSAGE, 'warning');
      return;
    }
    if (!checkoutEnabled) {
      setPaymentAmount(total);
      setPaymentError('');
      setDialog('payment');
      return;
    }
    setPaymentAmount(total);
    setPaymentError('');
    setDialog('payment');
  };

  // ===== Chuyển khoản payOS =====
  const [payosEnabled, setPayosEnabled] = useState(false);
  // Tải lỗi (vd. mở trang lúc mất mạng) -> tải lại khi có mạng, không ẩn hẳn Chuyển khoản tới lúc F5.
  const [paymentMethodsFailed, setPaymentMethodsFailed] = useState(false);
  const [paymentMethodsKey, setPaymentMethodsKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    posService.getPaymentMethods()
      .then((methods) => {
        if (cancelled) return;
        setPayosEnabled(Boolean(methods?.payos));
        setPaymentMethodsFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPayosEnabled(false);
        setPaymentMethodsFailed(true);
      });
    return () => { cancelled = true; };
  }, [paymentMethodsKey]);

  // Có mạng lại: tải lại những gì đã lỗi trong lúc mất mạng (danh sách hàng, phương thức thanh toán).
  // Mã QR đang chờ và giao dịch chưa rõ tự được hỏi lại bởi vòng polling / nút kiểm tra kết quả.
  useOnReconnect(() => {
    if (catalog.error) setRefreshKey((key) => key + 1);
    if (paymentMethodsFailed) setPaymentMethodsKey((key) => key + 1);
  });

  const setPaymentMethodForInvoice = (method) => {
    if (frozen) return;
    updateInvoice('paymentMethod', method);
    setPaymentError('');
  };

  /**
   * Áp trạng thái chuyển khoản mới về hóa đơn. Chỉ áp khi hóa đơn còn đúng giao dịch đó (đã đóng tab rồi
   * F2 lấy lại cùng số thì kết quả cũ không được ghi vào hóa đơn mới) và trạng thái thật sự đổi
   * (WebSocket và lượt hỏi định kỳ có thể cùng báo một kết quả). `quiet`: không báo lỗi PAID_ERROR vì
   * nơi gọi sẽ mở ngay hộp thoại mã QR của hóa đơn đó.
   */
  const applyPayosUpdate = (invoiceNumber, link, { quiet = false } = {}) => {
    if (!link) return;
    const ui = uiRef.current;
    const target = ui.invoices.find((invoice) => invoice.number === invoiceNumber);
    if (!target?.payos || String(target.payos.orderCode) !== String(link.orderCode)) return;
    const appliedKey = `${link.orderCode}:${link.trangThai}`;
    if (appliedPayosRef.current.has(appliedKey)) return;
    appliedPayosRef.current.add(appliedKey);
    const previousStatus = target.payos.trangThai;
    patchInvoice(invoiceNumber, { payos: link });
    const isActive = invoiceNumber === ui.activeInvoice;
    if (link.trangThai === 'PAID' && link.result) {
      // Tiền đã về, server đã tạo đơn + trừ kho -> hiện hóa đơn như thanh toán tiền mặt.
      finishAttempt(invoiceNumber, { status: 'succeeded', result: link.result, error: null });
      setRefreshKey((key) => key + 1);
      // Quản lý xử lý giao dịch lỗi sau vài phút/giờ: không kéo thu ngân khỏi hóa đơn đang bán dở.
      const mayTakeScreen = !ui.dialog && !ui.isSubmitting && previousStatus !== 'PAID_ERROR';
      if (isActive || mayTakeScreen) {
        setActiveInvoice(invoiceNumber);
        openReceipt(invoiceNumber, link.result);
      } else {
        // Thu ngân đang thao tác hóa đơn khác: không cướp màn hình, chỉ báo; mở tab đó sẽ hiện receipt.
        showToast(`Hóa đơn ${invoiceNumber} đã nhận đủ tiền chuyển khoản. Mở tab hóa đơn đó để in và hoàn tất.`, 'success');
      }
    } else if (link.trangThai === 'PAID_ERROR') {
      // Đang mở đúng mã QR của hóa đơn này thì hộp thoại đã hiện lỗi; còn lại báo để thu ngân không thu tiền lại.
      if (!(isActive && (quiet || ui.dialog === 'payos-qr'))) {
        showToast(`Hóa đơn ${invoiceNumber}: khách đã chuyển khoản nhưng chưa tạo được đơn — hóa đơn đã khóa, chờ quản lý xử lý. Không thu tiền lại của khách.`, 'error');
      }
    } else if (link.trangThai === 'REFUNDED') {
      // Quản lý đã hoàn tiền chuyển khoản, hàng giữ chỗ đã trả kho -> mở lại giỏ để bán lại nếu khách muốn.
      patchInvoice(invoiceNumber, { payos: null });
      if (isActive && ui.dialog === 'payos-qr') setDialog(null);
      showToast(`Hóa đơn ${invoiceNumber}: quản lý đã hoàn tiền chuyển khoản cho khách — hóa đơn đã mở lại.`, 'warning');
    } else if (!isActive && ['EXPIRED', 'CANCELLED', 'FAILED'].includes(link.trangThai)) {
      showToast(`Mã QR của hóa đơn ${invoiceNumber} đã hết hạn hoặc bị hủy — hóa đơn đã được mở khóa.`, 'warning');
    }
  };

  const createPayosQr = async () => {
    if (!checkoutEnabled || isSubmitting) return;
    const invoice = currentInvoice;
    if (!online) {
      setPaymentError(OFFLINE_PAYMENT_MESSAGE);
      return;
    }
    if (!invoice.customer) {
      setPaymentError('Vui lòng chọn khách hàng trước khi thanh toán.');
      return;
    }
    if (!invoice.cart.length) return;
    if (!isFrozenInvoice(invoice) && invoice.cart.some(isOverStock)) {
      setPaymentError(OVER_STOCK_MESSAGE);
      return;
    }
    const requestId = invoice.payos?.trangThai === 'PENDING' ? invoice.payos.requestId : newCheckoutRequestId();
    const payload = buildPayload({ ...invoice, attempt: { requestId } });
    setIsSubmitting(true);
    setPaymentError('');
    try {
      const link = await posService.createPayosLink(payload);
      patchInvoice(invoice.number, { payos: link });
      setDialog('payos-qr');
    } catch (error) {
      const envelope = error?.response?.data;
      if (error?.response?.status === 409 && envelope?.data?.priceChanged) {
        handleCheckoutError(invoice.number, error, { requestId });
      } else {
        if (error?.response?.status === 409 && Array.isArray(envelope?.data?.insufficient)) {
          setInvoices((current) => withInsufficientStock(current, invoice.number, envelope.data.insufficient));
          setRefreshKey((key) => key + 1);
        }
        setPaymentError(isNetworkError(error) ? NETWORK_ERROR_MESSAGE : envelope?.message || 'Không tạo được mã QR. Kiểm tra kết nối rồi thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelPayosQr = async () => {
    const invoice = currentInvoice;
    if (!invoice.payos?.orderCode || isSubmitting) return;
    if (!online) {
      showToast('Đang mất mạng — chưa hủy được mã QR. Có mạng lại hãy thử lại.', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const link = await posService.cancelPayos(invoice.payos.orderCode);
      if (['PAID', 'PAID_ERROR', 'REFUNDED'].includes(link?.trangThai)) {
        // Khách đã kịp chuyển tiền (đơn đã tạo, hoặc lỗi chờ quản lý): KHÔNG mở thu tiền mặt.
        applyPayosUpdate(invoice.number, link);
      } else if (link?.trangThai === 'PENDING') {
        showToast('Mã QR vẫn đang chờ khách chuyển khoản — chưa hủy được, thử lại sau ít phút.', 'warning');
      } else {
        patchInvoice(invoice.number, { payos: null });
        setDialog('payment');
        showToast('Đã hủy mã QR, hàng giữ chỗ đã được trả lại kho.', 'success');
      }
    } catch (error) {
      showToast(isNetworkError(error) ? NETWORK_ERROR_MESSAGE : error?.response?.data?.message || 'Không hủy được mã QR. Vui lòng thử lại.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const recreatePayosQr = () => {
    patchInvoice(currentInvoice.number, { payos: null });
    setDialog('payment');
  };

  /**
   * Theo dõi các hóa đơn đang ở trạng thái chuyển khoản `waitingStatus` (key = "số HĐ:orderCode,..."):
   * WebSocket báo ngay + hỏi trạng thái định kỳ dự phòng. Trạng thái đổi khác -> applyPayosUpdate.
   * Trả về hàm dọn dẹp cho useEffect.
   */
  const watchPayos = (key, waitingStatus, intervalMs) => {
    const targets = key.split(',').map((entry) => {
      const [number, orderCode] = entry.split(':');
      return { number: Number(number), orderCode };
    });
    let stopped = false;
    let inFlight = false;
    const controller = new AbortController();

    // 1. Kết nối WebSocket native real-time (< 50ms) cho từng đơn hàng đang chờ thanh toán
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.port === '5173' ? `${window.location.hostname}:8080` : window.location.host;
    const sockets = [];

    targets.forEach((target) => {
      try {
        const wsUrl = `${wsProtocol}//${wsHost}/ws-pos?orderCode=${target.orderCode}`;
        const ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          if (stopped) return;
          try {
            const link = JSON.parse(event.data);
            if (link && link.trangThai !== waitingStatus) {
              applyPayosUpdate(target.number, link);
            }
          } catch (err) {
            console.debug('Lỗi parse dữ liệu WebSocket payOS:', err);
          }
        };
        sockets.push(ws);
      } catch (err) {
        console.debug('Không thể khởi tạo kết nối WebSocket, tiếp tục dùng polling dự phòng:', err);
      }
    });

    // 2. Polling dự phòng (Fail-safe Fallback): đảm bảo không bao giờ kẹt đơn nếu WebSocket bị chập chờn
    const tick = async () => {
      if (inFlight) return; // lần hỏi trước chưa xong (mạng chậm) -> bỏ lượt, không dồn request
      inFlight = true;
      try {
        for (const target of targets) {
          try {
            const link = await posService.getPayosStatus(target.orderCode, { signal: controller.signal });
            if (stopped) return;
            if (link && link.trangThai !== waitingStatus) applyPayosUpdate(target.number, link);
          } catch {
            /* mất mạng tạm thời: lần hỏi sau sẽ thử lại */
          }
        }
      } finally {
        inFlight = false;
      }
    };
    const id = window.setInterval(tick, intervalMs);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(id);
      sockets.forEach((s) => {
        try { s.close(); } catch (_) {}
      });
    };
  };
  const payosWatchKey = (status) => invoices
    .filter((invoice) => invoice.payos?.trangThai === status && invoice.payos.orderCode)
    .map((invoice) => `${invoice.number}:${invoice.payos.orderCode}`)
    .join(',');

  // Mọi hóa đơn đang chờ quét QR -> hỏi trạng thái mỗi 3 giây (server tự hỏi payOS nếu webhook
  // chưa về). Chạy cả khi đã ẩn mã QR hoặc đang ở tab khác, để tiền về là biết ngay.
  const pendingPayosKey = payosWatchKey('PENDING');
  useEffect(() => (pendingPayosKey ? watchPayos(pendingPayosKey, 'PENDING', PAYOS_POLL_MS) : undefined),
    // watchPayos/applyPayosUpdate chỉ dùng setter ổn định + uiRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingPayosKey]);

  // Đã nhận tiền nhưng lỗi, chờ quản lý: quản lý tạo đơn -> hiện hóa đơn để in; hoàn tiền -> mở lại giỏ.
  const paidErrorPayosKey = payosWatchKey('PAID_ERROR');
  useEffect(() => (paidErrorPayosKey ? watchPayos(paidErrorPayosKey, 'PAID_ERROR', PAYOS_PAID_ERROR_POLL_MS) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paidErrorPayosKey]);

  // Mở lại một hóa đơn đã thanh toán xong (vd. tiền CK về khi đang ở tab khác) -> hiện receipt để hoàn tất.
  useEffect(() => {
    if (dialog || !currentInvoice.attempt || currentInvoice.attempt.status !== 'succeeded' || !currentInvoice.attempt.result) return;
    openReceipt(currentInvoice.number, currentInvoice.attempt.result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInvoice, dialog]);

  // Đang gửi thanh toán / có giao dịch chưa rõ kết quả -> cảnh báo trước khi đóng/tải lại tab.
  const hasInFlightPayment = isSubmitting || invoices.some((invoice) => invoice.attempt?.status === 'pending');
  useEffect(() => {
    if (!hasInFlightPayment) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasInFlightPayment]);

  const printReceipt = (result) => {
    if (!result?.donBanHangId) {
      showToast('Không có thông tin hóa đơn để in.', 'error');
      return;
    }
    // In từ đơn ĐÃ LƯU trên server bằng mẫu hóa đơn tại quầy (khổ nhiệt); lỗi in chỉ thử lại in,
    // không bao giờ chạy lại checkout.
    window.open(`/sales-orders/${result.donBanHangId}/invoice?mau=tai-quay`, '_blank', 'noopener');
  };

  const closeReceipt = () => {
    // Chỉ đóng ĐÚNG tab đã thanh toán; các tab khác giữ nguyên.
    const submittedNumber = receiptInvoiceNumber;
    setReceiptResult(null);
    setReceiptInvoiceNumber(null);
    setDialog(null);
    if (submittedNumber != null && invoices.some((inv) => inv.number === submittedNumber)) {
      removeInvoice(submittedNumber);
    }
    window.setTimeout(() => searchRef.current?.focus(), 0); // sẵn sàng cho khách tiếp theo
  };

  const confirmWarehouseChange = () => {
    if (pendingWarehouseId != null) applyWarehouseChange(pendingWarehouseId);
    setDialog(null);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };
  const cancelWarehouseChange = () => {
    setPendingWarehouseId(null);
    setDialog(null);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  };
  // Đã chọn kho trong menu (menu đã đóng): đổi ngay -> con trỏ về ô tìm kiếm để quét/gõ tiếp; đang hỏi lại -> để
  // nút trong hộp thoại giữ con trỏ (không đưa về nút kho nằm phía sau hộp thoại).
  const afterWarehousePicked = () => {
    if (!warehouseConfirmOpening.current) searchRef.current?.focus();
    warehouseConfirmOpening.current = false;
  };

  // Phím F9 trong hộp thoại thanh toán = xác nhận (tiền mặt) / tạo mã QR (chuyển khoản).
  const confirmPaymentShortcut = () => {
    if (paymentMethod === 'transfer' && payosEnabled) createPayosQr();
    else submitCheckout();
  };

  const actions = {
    onSelectCustomer: selectCustomerForInvoice,
    onPaymentMethod: setPaymentMethodForInvoice,
    onCreatePayosQr: createPayosQr,
    onCancelPayos: cancelPayosQr,
    onRecreatePayos: recreatePayosQr,
    onQuickCreateCustomer: quickCreateCustomer,
    onClearCart: clearCart,
    onNote: setNoteForInvoice,
    onCloseInvoice: () => {
      if (closingInvoiceNumber != null) removeInvoice(closingInvoiceNumber);
      setClosingInvoiceNumber(null);
    },
    onPaymentAmount: setPaymentAmountForInvoice,
    onConfirmPayment: submitCheckout,
    onCheckRecovery: recoverCurrentAttempt,
    onRetrySameAttempt: retrySameAttempt,
    onConfirmNewPrice: confirmNewPrice,
    onPrintReceipt: () => printReceipt(receiptResult),
    onCloseReceipt: closeReceipt,
    onPrintRecovered: () => printReceipt(recoveredResult),
    onCloseRecovered: () => { setRecoveredResult(null); setDialog(null); },
    onConfirmWarehouseChange: confirmWarehouseChange,
    onCancelWarehouseChange: cancelWarehouseChange,
  };

  const dialogState = {
    payosEnabled,
    online,
    payos: currentInvoice.payos,
    customers: customerOptions,
    customer,
    cart,
    subtotal,
    total,
    paymentMethod,
    paymentAmount,
    paymentError,
    isSubmitting,
    closingInvoice: closingInvoiceNumber != null
      ? invoices.find((invoice) => invoice.number === closingInvoiceNumber) || null
      : null,
    invoiceNumber: ticketNumber,
    attemptStatus: attempt?.status ?? null,
    receipt: receiptResult,
    priceChange: priceChangeInfo,
    frozen,
    recoveredResult,
    pendingWarehouse: pendingWarehouseId != null ? warehouses.find((w) => w.id === pendingWarehouseId) || null : null,
    activeWarehouse,
  };

  // ===== Nhận mã quét ở mọi chỗ + chống quét nhầm (áp dụng cả khi tắt chế độ quét) =====
  // Máy quét gõ mã + Enter vào BẤT KỲ chỗ nào đang có con trỏ. Enter cuối một lần quét bị chặn ở mọi
  // chỗ (trừ ô tìm kiếm khi TẮT chế độ quét — Enter thêm nhanh như cũ) để không xác nhận thanh toán với
  // "tiền khách đưa" = mã vạch, không bấm lại thẻ sản phẩm đang chọn, không gửi form khác.
  // Chế độ quét: mã quét được thêm vào hóa đơn dù con trỏ đang ở ô tìm kiếm / ô ghi chú; chữ trong ô đó
  // được trả về như trước khi quét (danh mục không bị lọc theo mã vừa quét).
  const handleMisplacedScan = (scan, target) => {
    if (dialog === 'payment' && target?.id === 'payment-amount') {
      const amount = Number(scan.snapshot?.paymentAmount) || 0;
      setPaymentAmountForInvoice(amount);
      // Ô số có thể còn hiện chữ dở dang của mã (state không đổi thì React không vẽ lại) -> ghi lại số tiền.
      target.value = String(amount);
      setPaymentError('Vừa quét mã khi đang ở màn thanh toán — CHƯA xác nhận thanh toán, số tiền khách đưa đã trả về như trước. Cần thêm hàng: đóng màn thanh toán (Esc) rồi quét.');
      playScanBeep(false);
      return;
    }
    // Mã gõ vào ô tìm kiếm / ô ghi chú: trả nội dung ô về như trước khi quét.
    if (target === searchRef.current) setSearch(scan.snapshot?.search ?? '');
    if (target?.dataset && 'posNote' in target.dataset) setNoteForInvoice(scan.snapshot?.note ?? '');
    // Ô số lượng: trả về số cũ ngay (trước khi rời ô), để mã quét không bị chốt thành số lượng.
    if (target?.dataset && 'posQty' in target.dataset) target.dispatchEvent(new Event(QTY_REVERT_EVENT));
    const warn = (message) => {
      playScanBeep(false);
      showToast(message, 'warning');
    };
    if (dialog || isSubmitting) {
      warn('Vừa quét mã khi đang mở cửa sổ khác — mã chưa được thêm. Đóng cửa sổ rồi quét lại.');
      return;
    }
    const code = scan.code.trim();
    if (scanMode && code) {
      enqueueScan(code);
      searchRef.current?.focus();
      return;
    }
    warn('Mã vừa quét chưa được thêm vào hóa đơn. Bật chế độ quét mã (F8) để quét.');
  };

  // Trạng thái/handler mới nhất cho callback chạy nền (polling payOS, phím tắt) — tránh closure cũ.
  uiRef.current = { dialog, isSubmitting, activeInvoice, invoices };
  keyboardContext.current = {
    isSubmitting,
    frozen,
    dialog,
    searchRef,
    requestNewInvoice,
    openPayment,
    confirmPaymentShortcut,
    closeReceipt,
    closeRecovered: actions.onCloseRecovered,
    confirmNewPrice,
    cancelWarehouseChange,
    setDialog,
    setMobileCartOpen,
    scanMode,
    toggleScanMode,
    handleMisplacedScan,
    // Chế độ quét: phím gõ khi chưa đứng ở ô nhập nào -> đưa về ô tìm kiếm (không mất ký tự).
    insertIntoSearch: (text) => {
      searchRef.current?.focus();
      setSearch((current) => current + text);
    },
    // Chụp lúc bắt đầu một chuỗi phím nhanh: giá trị TRƯỚC khi mã quét gõ vào ô.
    scanSnapshot: () => ({ paymentAmount, note, search }),
  };
  scanContext.current = {
    scanMode,
    activeInvoice,
    warehouseId,
    frozen,
    dialog,
    isSubmitting,
    cartQuantity,
    getAddProblem,
    commitAddProduct,
  };

  // Bắt phím ở pha capture (trước mọi nút/ô/form): nhận diện lần quét + chuyển phím về ô tìm kiếm.
  useEffect(() => {
    const tracker = createScanBurstTracker();
    const handleKeyDownCapture = (event) => {
      const context = keyboardContext.current;
      if (!context) return;
      const scan = tracker.track(event, context.scanSnapshot);
      if (scan) {
        const target = event.target;
        // Tắt chế độ quét: Enter ở ô tìm kiếm vẫn là "thêm nhanh theo mã" như trước.
        if (!context.scanMode && target === context.searchRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        context.handleMisplacedScan(scan, target);
        return;
      }
      // Chế độ quét: phím ký tự gõ khi con trỏ KHÔNG ở ô nhập chữ (đang chọn nút, thẻ sản phẩm, ô chọn
      // kho...) được chuyển về ô tìm kiếm — mã không rơi mất và Enter cuối mã không bấm nhầm nút đó.
      if (!context.scanMode || context.dialog || context.isSubmitting) return;
      if (event.defaultPrevented || event.isComposing || event.repeat || !isPrintableKey(event) || event.key === ' ') return;
      if (isTextEntry(event.target) || !context.searchRef.current) return;
      event.preventDefault();
      // Không để phím đi tiếp tới chỗ đang chọn (vd. tìm nhanh theo chữ cái trong menu kho kéo con trỏ đi).
      event.stopPropagation();
      context.insertIntoSearch(event.key);
    };
    window.addEventListener('keydown', handleKeyDownCapture, true);
    return () => window.removeEventListener('keydown', handleKeyDownCapture, true);
  }, []);

  useEffect(() => {
    const HANDLED_KEYS = new Set(['Escape', 'F1', 'F2', 'F3', 'F4', 'F8', 'F9']);
    const handleKeyDown = (event) => {
      const context = keyboardContext.current;
      if (!context || !HANDLED_KEYS.has(event.key)) return;
      if (context.isSubmitting) { event.preventDefault(); return; }
      if (event.key === 'Escape') {
        // Esc đã được menu đang mở (chọn kho, tài khoản…) dùng để tự đóng: không đóng thêm hộp thoại phía dưới.
        if (event.defaultPrevented) return;
        // Mỗi hộp thoại đóng theo đúng hành động của nó (receipt -> hoàn tất & đóng tab đã bán).
        if (context.dialog === 'receipt') context.closeReceipt();
        else if (context.dialog === 'recovered-result') context.closeRecovered();
        else if (context.dialog === 'price-change') context.confirmNewPrice();
        else if (context.dialog === 'change-warehouse') context.cancelWarehouseChange();
        else if (context.dialog) context.setDialog(null);
        else context.setMobileCartOpen(false);
        return;
      }
      event.preventDefault();
      const active = document.activeElement;
      if (active?.dataset && 'posQty' in active.dataset) {
        // Đang gõ dở số lượng: rời ô để chốt số trước, phím tắt chạy sau khi giỏ đã cập nhật
        // (không thì F9 mở thanh toán với tổng tiền cũ).
        active.blur();
        const { key } = event;
        setTimeout(() => runShortcut(key), 0);
        return;
      }
      runShortcut(event.key);
    };
    const runShortcut = (key) => {
      const context = keyboardContext.current;
      if (!context || context.isSubmitting) return;
      if (context.dialog) {
        // Đang mở hộp thoại: chỉ F9 trong màn thanh toán (= xác nhận); các phím khác bỏ qua,
        // tránh F9 lần hai đặt lại số tiền đã nhập hoặc F4 đè mất hộp thoại đang dở.
        if (key === 'F9' && context.dialog === 'payment') context.confirmPaymentShortcut();
        return;
      }
      if (key === 'F1') context.setDialog('shortcuts');
      else if (key === 'F2') context.requestNewInvoice();
      else if (key === 'F3') {
        context.searchRef.current?.focus();
        context.searchRef.current?.select();
      } else if (key === 'F8') context.toggleScanMode();
      else if (key === 'F4') {
        // Phím tắt KHÔNG được vượt guard giao dịch đang treo (frozen).
        if (!context.frozen) context.setDialog('customer');
      } else if (key === 'F9') context.openPayment();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderCartPanel = () => (
    <PosCartPanel
      cart={cart}
      invoiceKey={activeInvoice}
      customer={customer}
      frozen={frozen}
      frozenMessage={isPayosPaidError(currentInvoice)
        ? 'Khách đã chuyển khoản nhưng chưa tạo được đơn — không thu tiền lại. Hóa đơn chờ quản lý xử lý ở màn Đối soát chuyển khoản.'
        : ''}
      isSubmitting={isSubmitting}
      note={note}
      onClear={() => setDialog('clear')}
      onCustomer={() => setDialog('customer')}
      onNote={setNoteForInvoice}
      onPayment={openPayment}
      onQuantity={setQuantity}
      onRemove={removeLine}
      offline={!online}
      overStockMessage={overStock ? OVER_STOCK_MESSAGE : ''}
      subtotal={subtotal}
      total={total}
    />
  );

  const renderInvoiceTabs = (variant) => (
    <PosInvoiceTabs
      activeInvoice={activeInvoice}
      disabled={isSubmitting || Boolean(dialog)}
      invoices={invoices}
      onAdd={requestNewInvoice}
      onClose={requestCloseInvoice}
      onSelect={selectInvoice}
      variant={variant}
    />
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-bo-canvas text-bo-foreground">
      <PosTopBar
        onHelp={() => { if (!dialog && !isSubmitting) setDialog('shortcuts'); }}
        pendingPaymentCount={invoices.filter(isFrozenInvoice).length}
        tabs={wideScreen ? renderInvoiceTabs('bar') : null}
      >
        <PosWarehousePicker
          blocked={Boolean(dialog)}
          disabled={isSubmitting || frozen}
          disabledReason={frozen ? 'Hóa đơn đang chờ thanh toán nên chưa đổi được kho.' : 'Đang xử lý thanh toán nên chưa đổi được kho.'}
          onBlockedOpen={() => showToast(frozen
            ? 'Hóa đơn đang trong giao dịch thanh toán — không thể đổi kho lúc này.'
            : 'Đang xử lý thanh toán — đợi xong rồi đổi kho.', 'warning')}
          onChange={changeWarehouse}
          onPicked={afterWarehousePicked}
          value={warehouseId}
          warehouses={warehouses}
        />
      </PosTopBar>

      {/* Màn hẹp hơn 1280px: thanh trên cùng không đủ chỗ -> dải hóa đơn giữ hàng riêng như cũ. */}
      {wideScreen ? null : renderInvoiceTabs('strip')}

      <main aria-labelledby={`pos-invoice-tab-${ticketNumber}`} id="pos-invoice-panel" role="tabpanel" className="grid min-h-0 flex-1 gap-3 overflow-hidden bg-bo-surface px-3 pb-24 pt-3 sm:px-4 xl:grid-cols-[minmax(0,1fr)_390px] xl:pb-3">
        <PosProductCatalog
          error={catalog.error}
          loading={catalog.loading}
          lastScan={lastScan}
          cartQuantities={cartQuantities}
          groups={catalog.groups}
          onAdd={addFromCatalog}
          onEnterAdd={handleEnterAdd}
          onShowScanMatches={showScanMatches}
          onToggleScanMode={toggleScanMode}
          onPageChange={(nextPage) => setCatalogPage(Math.max(0, nextPage))}
          onRetry={() => setRefreshKey((key) => key + 1)}
          onSearch={onSearch}
          onStockFilterChange={onStockFilterChange}
          page={catalog.page}
          pageCount={catalog.pageCount}
          pageSize={PAGE_SIZE}
          resultQuery={debouncedSearch}
          scanMode={scanMode}
          scanPending={scanPending}
          search={search}
          searchRef={searchRef}
          stockFilter={stockFilter}
          totalElements={catalog.totalElements}
        />

        <div className="hidden min-h-0 xl:flex">{renderCartPanel()}</div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-bo-border bg-bo-surface px-3 py-2.5 shadow-sm xl:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => setMobileCartOpen(true)} type="button">
            <span className="relative grid size-9 shrink-0 place-items-center rounded-lg bg-bo-primary-soft text-bo-primary"><ShoppingBag aria-hidden="true" size={17} /><span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-bo-primary px-1 text-[9px] font-bold text-white">{countCart(cart)}</span></span>
            <span className="min-w-0"><span className="block text-[11px] text-bo-muted">Mở hóa đơn</span><span className="block truncate text-sm font-bold text-bo-foreground">{formatMoney(total)}</span></span>
          </button>
          <button className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-bo-primary px-4 text-sm font-semibold text-white transition hover:bg-bo-primary-hover disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!cart.length || isSubmitting || overStock || (!online && !frozen)} onClick={openPayment} title={!online && !frozen ? OFFLINE_PAYMENT_MESSAGE : overStock ? OVER_STOCK_MESSAGE : undefined} type="button">{!online && !frozen ? 'Mất mạng' : 'Thanh toán'}</button>
        </div>
      </div>

      {mobileCartOpen ? <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-3 sm:items-center xl:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileCartOpen(false); }}>
        <div className="flex h-[min(84dvh,760px)] w-full max-w-xl flex-col">
          <div className="mb-2 flex justify-end"><button aria-label="Đóng hóa đơn" className="grid size-9 place-items-center rounded-full bg-white text-bo-foreground shadow-sm" onClick={() => setMobileCartOpen(false)} type="button"><X aria-hidden="true" size={18} /></button></div>
          {renderCartPanel()}
        </div>
      </div> : null}

      <PosDialogs actions={actions} checkoutEnabled={checkoutEnabled} dialog={dialog} onClose={() => { if (!isSubmitting) setDialog(null); }} state={dialogState} />
    </div>
  );
}
