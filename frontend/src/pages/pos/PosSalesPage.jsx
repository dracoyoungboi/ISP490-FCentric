import { useEffect, useMemo, useRef, useState } from 'react';
import { toast as sonnerToast } from 'sonner';
import {
  ShoppingBag,
  Warehouse,
  X,
} from 'lucide-react';
import PosTopBar from './components/PosTopBar';
import PosCartPanel from './components/PosCartPanel';
import PosInvoiceTabs from './components/PosInvoiceTabs';
import PosDialogs from './components/PosDialogs';
import PosProductCatalog from './components/PosProductCatalog';
import { formatMoney } from './pos-format';
import {
  posService,
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

const PAGE_SIZE = 120;
const SEARCH_DEBOUNCE_MS = 250;
const PAYOS_POLL_MS = 3000;

function countCart(cart) {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

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
    payos: invoice.payos?.trangThai === 'PENDING' ? invoice.payos : null,
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
  // Đang chờ khách quét QR: hàng đã giữ chỗ theo đúng giỏ này -> khóa sửa giỏ.
  || invoice?.payos?.trangThai === 'PENDING';

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
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState('');
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [search, setSearch] = useState('');
  // Từ khóa gửi lên server: trễ 250ms sau lần gõ cuối để không gọi API ở MỖI phím.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [catalog, setCatalog] = useState({ items: [], totalElements: 0, page: 0, pageCount: 1, loading: false, error: null });
  const catalogSeq = useRef(0);
  const searchRef = useRef(null);
  const keyboardContext = useRef(null);
  const uiRef = useRef({ dialog: null, isSubmitting: false, activeInvoice: null });

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
  // Thông báo dùng Toaster (sonner) toàn cục: có phân loại, xếp chồng, không đè nhau.
  const showToast = (message, type = 'info') => {
    const notify = sonnerToast[type] || sonnerToast;
    notify(message, { duration: type === 'error' ? 5000 : 3000 });
  };

  // Sau thất bại XÁC ĐỊNH, mọi sửa đổi draft phải mở khóa attempt để lần sau dùng key MỚI.
  const clearFailedAttemptAfterEdit = () => {
    if (attempt && attempt.status === 'failed') {
      updateInvoice('attempt', null);
    }
  };

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [search]);

  // ===== Catalog: fetch theo (kho của hóa đơn đang mở, từ khóa, trang) =====
  useEffect(() => {
    if (!warehouseId) {
      catalogSeq.current += 1;
      setCatalog({ items: [], totalElements: 0, page: 0, pageCount: 1, loading: false, error: null });
      return undefined;
    }
    const controller = new AbortController();
    const seq = ++catalogSeq.current;
    setCatalog((prev) => ({ ...prev, loading: true, error: null }));
    posService.getCatalog(warehouseId, { q: debouncedSearch, page: catalogPage, size: PAGE_SIZE, signal: controller.signal })
      .then((pageData) => {
        if (seq !== catalogSeq.current) return;
        setCatalog({
          items: (pageData?.content ?? []).map(toPosProduct),
          totalElements: pageData?.totalElements ?? 0,
          page: pageData?.number ?? 0,
          pageCount: pageData?.totalPages ?? 1,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (seq !== catalogSeq.current) return;
        if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return;
        setCatalog((prev) => ({ ...prev, loading: false, error }));
      });
    return () => controller.abort();
  }, [warehouseId, debouncedSearch, catalogPage, refreshKey]);

  // ===== Sau F5: hỏi lại trạng thái các mã QR payOS đang chờ (tiền có thể đã về trong lúc tải lại) =====
  useEffect(() => {
    const pending = (restoredDrafts?.invoices || []).filter((invoice) => invoice.payos?.trangThai === 'PENDING');
    if (!pending.length) return undefined;
    let cancelled = false;
    (async () => {
      for (const invoice of pending) {
        try {
          const link = await posService.getPayosStatus(invoice.payos.orderCode);
          if (cancelled || !link) continue;
          if (link.trangThai === 'PENDING' || link.trangThai === 'PAID') {
            applyPayosUpdate(invoice.number, link);
            if (link.trangThai === 'PENDING' && invoice.number === restoredDrafts.activeInvoice) setDialog('payos-qr');
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

  // ===== Phục hồi sau refresh: chỉ HỎI recovery bằng requestId đã lưu, KHÔNG tự gửi lại =====
  useEffect(() => {
    const pendingIds = getPendingCheckoutIds();
    if (!pendingIds.length) return undefined;
    let cancelled = false;
    const check = async () => {
      for (const requestId of pendingIds) {
        if (cancelled) break;
        try {
          const res = await posService.getCheckoutRequest(requestId);
          if (res?.trangThai === 'SUCCESS' && res.result) {
            removePendingCheckoutId(requestId);
            if (!cancelled) setRecoveredResult(res.result);
            break;
          }
          if (res?.trangThai === 'FAILED') {
            removePendingCheckoutId(requestId); // lỗi xác định — không cần giữ metadata
          }
          // 404 -> giữ metadata để người bán kiểm tra lại sau (kết quả chưa rõ)
        } catch (error) {
          if (error?.response?.status === 404) {
            // chưa có kết quả trên server: giữ metadata, không tự quyết
          }
          // 401/403 đã được apiClient xử lý (redirect login) — dừng vòng lặp
          if (error?.response?.status === 401 || error?.response?.status === 403) break;
        }
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  const onSearch = (value) => {
    setSearch(value);
    setCatalogPage(0);
  };

  const [pendingWarehouseId, setPendingWarehouseId] = useState(null);

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
    if (frozen) {
      showToast('Hóa đơn đang trong giao dịch thanh toán — không thể đổi kho lúc này.', 'warning');
      return;
    }
    const target = Number(nextWarehouseId);
    if (!target || target === warehouseId) return;
    // Giỏ đang có hàng -> hỏi lại trước khi xóa, tránh lỡ tay mất cả hóa đơn.
    if (cart.length) {
      setPendingWarehouseId(target);
      setDialog('change-warehouse');
      return;
    }
    applyWarehouseChange(target);
  };

  // ===== Giỏ (key = bienTheSanPhamId — không gộp hai size/màu khác nhau) =====
  const addProduct = (product) => {
    if (frozen) {
      showToast('Hóa đơn đang trong giao dịch thanh toán — giỏ đã được khóa.', 'warning');
      return false;
    }
    const variantId = product.id;
    const stock = Number(product.stock);
    // Kiểm tra tồn NGOÀI state updater (updater phải thuần — StrictMode gọi 2 lần sẽ bắn toast 2 lần).
    const line = cart.find((item) => item.product.id === variantId);
    if (Number.isFinite(stock) && (line?.quantity ?? 0) + 1 > stock) {
      showToast(stock > 0 ? `Chỉ còn ${stock} sản phẩm khả dụng tại kho này.` : `${product.name} đã hết hàng tại kho này.`, 'warning');
      return false;
    }
    setCart((current) => {
      const existing = current.find((item) => item.product.id === variantId);
      if (existing) {
        // Cập nhật luôn tồn mới nhất từ catalog vào dòng giỏ.
        return current.map((item) => item.product.id === variantId ? { product, quantity: item.quantity + 1 } : item);
      }
      return [...current, { product, quantity: 1 }];
    });
    clearFailedAttemptAfterEdit();
    return true;
  };

  const setQuantity = (variantId, quantity) => {
    if (frozen) return;
    const line = cart.find((item) => item.product.id === variantId);
    const stock = line ? Number(line.product.stock) : NaN;
    const nextQuantity = Number.isFinite(stock) ? Math.min(quantity, stock) : quantity;
    setCart((current) => nextQuantity <= 0
      ? current.filter((item) => item.product.id !== variantId)
      : current.map((item) => item.product.id === variantId ? { ...item, quantity: nextQuantity } : item));
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
    updateInvoice('paymentAmount', value);
    setPaymentError(Number(value || 0) < total ? 'Số tiền khách thanh toán chưa đủ.' : '');
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

  const handleEnterAdd = async () => {
    const query = search.trim();
    if (!query || lookupBusy || isSubmitting || frozen) return;
    if (!warehouseId) return;
    setLookupBusy(true);
    try {
      const matches = await posService.lookup(warehouseId, { skuPrefix: query });
      const first = matches?.[0];
      if (!first) {
        showToast(`Không tìm thấy mã hàng bắt đầu bằng "${query}".`, 'warning');
        return;
      }
      const product = toPosProduct(first);
      if (Number(product.stock) <= 0) {
        showToast(`${product.name} đã hết hàng tại kho này.`, 'warning');
        return;
      }
      if (addProduct(product)) {
        showToast(`Đã thêm ${product.name}.`, 'success');
        setSearch(''); // sẵn sàng cho lần quét/gõ mã tiếp theo
      }
    } catch (error) {
      showToast(error?.response?.data?.message || 'Không thể tra cứu mã hàng. Vui lòng thử lại.', 'error');
    } finally {
      setLookupBusy(false);
    }
  };

  const findBarcode = async () => {
    const code = barcodeInput.trim();
    if (!code || barcodeBusy || frozen) return;
    if (!warehouseId) return;
    setBarcodeBusy(true);
    try {
      const matches = await posService.lookup(warehouseId, { barcode: code });
      if (!matches.length) {
        setBarcodeError('Không tìm thấy biến thể nào khớp chính xác mã đã quét. Mã vạch cấp sản phẩm không tự chọn biến thể thay bạn.');
        return;
      }
      if (matches.length > 1) {
        setBarcodeError('Mã vạch khớp nhiều biến thể — vui lòng chọn thủ công từ danh mục để tránh bán nhầm size/màu.');
        return;
      }
      const product = toPosProduct(matches[0]);
      if (Number(product.stock) <= 0) {
        setBarcodeError(`${product.name} đã hết hàng tại kho này.`);
        return;
      }
      if (!addProduct(product)) return;
      setBarcodeError('');
      setBarcodeInput('');
      setDialog(null);
      showToast(`Đã thêm ${product.name}.`, 'success');
    } catch (error) {
      setBarcodeError(error?.response?.data?.message || 'Không thể tra cứu mã vạch. Vui lòng thử lại.');
    } finally {
      setBarcodeBusy(false);
    }
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
    if (!invoice.customer) {
      setPaymentError('Vui lòng chọn khách hàng trước khi thanh toán.');
      return;
    }
    const paid = Number(invoice.paymentAmount || 0);
    if (!invoice.cart.length || !Number.isFinite(paid) || paid < total || paid < 0) {
      setPaymentError('Số tiền khách thanh toán chưa đủ.');
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
        showToast('Server chưa có kết quả cho giao dịch này. Có thể thử lại cùng mã giao dịch.', 'warning');
      }
    } catch (error) {
      if (error?.response?.status === 404) {
        // Kết quả chưa rõ (server đã rollback): được phép thử lại CÙNG key + CÙNG payload.
        showToast('Giao dịch chưa có kết quả trên server — có thể thử lại cùng mã giao dịch.', 'warning');
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
    showToast('Giá đã được cập nhật về giá server. Vui lòng kiểm tra tổng mới và bấm Thanh toán lại.', 'warning');
  };

  const openPayment = () => {
    if (!cart.length) {
      showToast('Thêm ít nhất một sản phẩm trước khi thanh toán.', 'warning');
      return;
    }
    if (currentInvoice.payos?.trangThai === 'PENDING') {
      setDialog('payos-qr'); // đang chờ khách quét QR -> mở lại đúng mã QR
      return;
    }
    if (!checkoutEnabled) {
      setPaymentAmount(total);
      setPaymentError('');
      setDialog('payment');
      return;
    }
    if (attempt?.status === 'unknown') {
      setDialog('checkout-unknown');
      return;
    }
    setPaymentAmount(total);
    setPaymentError('');
    setDialog('payment');
  };

  // ===== Chuyển khoản payOS =====
  const [payosEnabled, setPayosEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    posService.getPaymentMethods()
      .then((methods) => { if (!cancelled) setPayosEnabled(Boolean(methods?.payos)); })
      .catch(() => { if (!cancelled) setPayosEnabled(false); });
    return () => { cancelled = true; };
  }, []);

  const setPaymentMethodForInvoice = (method) => {
    if (frozen) return;
    updateInvoice('paymentMethod', method);
    setPaymentError('');
  };

  const applyPayosUpdate = (invoiceNumber, link) => {
    if (!link) return;
    patchInvoice(invoiceNumber, { payos: link });
    const ui = uiRef.current;
    const isActive = invoiceNumber === ui.activeInvoice;
    if (link.trangThai === 'PAID' && link.result) {
      // Tiền đã về, server đã tạo đơn + trừ kho -> hiện hóa đơn như thanh toán tiền mặt.
      finishAttempt(invoiceNumber, { status: 'succeeded', result: link.result, error: null });
      setRefreshKey((key) => key + 1);
      if (isActive || (!ui.dialog && !ui.isSubmitting)) {
        setActiveInvoice(invoiceNumber);
        openReceipt(invoiceNumber, link.result);
      } else {
        // Thu ngân đang thao tác hóa đơn khác: không cướp màn hình, chỉ báo; mở tab đó sẽ hiện receipt.
        showToast(`Hóa đơn ${invoiceNumber} đã nhận đủ tiền chuyển khoản. Mở tab hóa đơn đó để in và hoàn tất.`, 'success');
      }
    } else if (!isActive && ['EXPIRED', 'CANCELLED', 'FAILED'].includes(link.trangThai)) {
      showToast(`Mã QR của hóa đơn ${invoiceNumber} đã hết hạn hoặc bị hủy — hóa đơn đã được mở khóa.`, 'warning');
    }
  };

  const createPayosQr = async () => {
    if (!checkoutEnabled || isSubmitting) return;
    const invoice = currentInvoice;
    if (!invoice.customer) {
      setPaymentError('Vui lòng chọn khách hàng trước khi thanh toán.');
      return;
    }
    if (!invoice.cart.length) return;
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
        setPaymentError(envelope?.message || 'Không tạo được mã QR. Kiểm tra kết nối rồi thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelPayosQr = async () => {
    const invoice = currentInvoice;
    if (!invoice.payos?.orderCode || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const link = await posService.cancelPayos(invoice.payos.orderCode);
      if (link?.trangThai === 'PAID') {
        applyPayosUpdate(invoice.number, link);
      } else {
        patchInvoice(invoice.number, { payos: null });
        setDialog('payment');
        showToast('Đã hủy mã QR, hàng giữ chỗ đã được trả lại kho.', 'success');
      }
    } catch (error) {
      showToast(error?.response?.data?.message || 'Không hủy được mã QR. Vui lòng thử lại.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const recreatePayosQr = () => {
    patchInvoice(currentInvoice.number, { payos: null });
    setDialog('payment');
  };

  // Mọi hóa đơn đang chờ quét QR -> hỏi trạng thái mỗi 3 giây (server tự hỏi payOS nếu webhook
  // chưa về). Chạy cả khi đã ẩn mã QR hoặc đang ở tab khác, để tiền về là biết ngay.
  const pendingPayosKey = invoices
    .filter((invoice) => invoice.payos?.trangThai === 'PENDING' && invoice.payos.orderCode)
    .map((invoice) => `${invoice.number}:${invoice.payos.orderCode}`)
    .join(',');
  useEffect(() => {
    if (!pendingPayosKey) return undefined;
    const targets = pendingPayosKey.split(',').map((entry) => {
      const [number, orderCode] = entry.split(':');
      return { number: Number(number), orderCode };
    });
    let stopped = false;
    let inFlight = false;
    const controller = new AbortController();
    const tick = async () => {
      if (inFlight) return; // lần hỏi trước chưa xong (mạng chậm) -> bỏ lượt, không dồn request
      inFlight = true;
      try {
        for (const target of targets) {
          try {
            const link = await posService.getPayosStatus(target.orderCode, { signal: controller.signal });
            if (stopped) return;
            if (link && link.trangThai !== 'PENDING') applyPayosUpdate(target.number, link);
          } catch {
            /* mất mạng tạm thời: lần hỏi sau sẽ thử lại */
          }
        }
      } finally {
        inFlight = false;
      }
    };
    const id = window.setInterval(tick, PAYOS_POLL_MS);
    return () => { stopped = true; controller.abort(); window.clearInterval(id); };
    // applyPayosUpdate chỉ dùng setter ổn định + uiRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPayosKey]);

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
    // In từ đơn ĐÃ LƯU trên server (route dự án hiện hữu); lỗi in chỉ thử lại in,
    // không bao giờ chạy lại checkout.
    window.open(`/sales-orders/${result.donBanHangId}/invoice`, '_blank', 'noopener');
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
  };
  const cancelWarehouseChange = () => {
    setPendingWarehouseId(null);
    setDialog(null);
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
    onBarcodeInput: (value) => { setBarcodeInput(value); setBarcodeError(''); },
    onFindBarcode: findBarcode,
  };

  const dialogState = {
    payosEnabled,
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
    barcodeInput,
    barcodeError,
    barcodeBusy,
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

  // Trạng thái/handler mới nhất cho callback chạy nền (polling payOS, phím tắt) — tránh closure cũ.
  uiRef.current = { dialog, isSubmitting, activeInvoice };
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
  };

  useEffect(() => {
    const HANDLED_KEYS = new Set(['Escape', 'F1', 'F2', 'F3', 'F4', 'F9']);
    const handleKeyDown = (event) => {
      const context = keyboardContext.current;
      if (!context || !HANDLED_KEYS.has(event.key)) return;
      if (context.isSubmitting) { event.preventDefault(); return; }
      if (event.key === 'Escape') {
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
      if (context.dialog) {
        // Đang mở hộp thoại: chỉ F9 trong màn thanh toán (= xác nhận); các phím khác bỏ qua,
        // tránh F9 lần hai đặt lại số tiền đã nhập hoặc F4 đè mất hộp thoại đang dở.
        if (event.key === 'F9' && context.dialog === 'payment') context.confirmPaymentShortcut();
        return;
      }
      if (event.key === 'F1') context.setDialog('shortcuts');
      else if (event.key === 'F2') context.requestNewInvoice();
      else if (event.key === 'F3') {
        context.searchRef.current?.focus();
        context.searchRef.current?.select();
      } else if (event.key === 'F4') {
        // Phím tắt KHÔNG được vượt guard giao dịch đang treo (frozen).
        if (!context.frozen) context.setDialog('customer');
      } else if (event.key === 'F9') context.openPayment();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderCartPanel = () => (
    <PosCartPanel
      cart={cart}
      customer={customer}
      frozen={frozen}
      isSubmitting={isSubmitting}
      note={note}
      onClear={() => setDialog('clear')}
      onCustomer={() => setDialog('customer')}
      onNote={setNoteForInvoice}
      onPayment={openPayment}
      onQuantity={setQuantity}
      onRemove={(variantId) => setQuantity(variantId, 0)}
      subtotal={subtotal}
      total={total}
    />
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-bo-canvas text-bo-foreground">
      <PosTopBar onHelp={() => { if (!dialog && !isSubmitting) setDialog('shortcuts'); }}>
        <label className="flex min-h-9 min-w-0 items-center gap-1.5 rounded-lg border border-bo-border bg-bo-surface px-2.5 text-xs font-medium text-bo-foreground transition hover:border-bo-primary/40" htmlFor="pos-warehouse" title={frozen ? 'Hóa đơn đang chờ thanh toán — không đổi kho được' : 'Kho xuất hàng cho hóa đơn đang mở'}>
          <Warehouse aria-hidden="true" size={14} className="shrink-0 text-bo-muted" />
          <span className="hidden shrink-0 text-bo-muted md:inline">Kho bán:</span>
          <select
            className="min-w-0 max-w-56 truncate bg-transparent py-1.5 pl-1 pr-6 text-xs font-semibold outline-none disabled:cursor-not-allowed"
            disabled={!warehouses.length || isSubmitting || frozen}
            id="pos-warehouse"
            onChange={(event) => changeWarehouse(event.target.value)}
            value={warehouseId ?? ''}
          >
            {!warehouses.length ? <option value="">Chưa có kho</option> : null}
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.tenKho} ({w.maKho})</option>)}
          </select>
        </label>
      </PosTopBar>

      <PosInvoiceTabs
        activeInvoice={activeInvoice}
        disabled={isSubmitting || Boolean(dialog)}
        invoices={invoices}
        onAdd={requestNewInvoice}
        onClose={requestCloseInvoice}
        onSelect={selectInvoice}
      />

      <main aria-labelledby={`pos-invoice-tab-${ticketNumber}`} id="pos-invoice-panel" role="tabpanel" className="grid min-h-0 flex-1 gap-3 overflow-hidden bg-bo-surface px-3 pb-24 pt-3 sm:px-4 xl:grid-cols-[minmax(0,1fr)_390px] xl:pb-3">
        <PosProductCatalog
          error={catalog.error}
          loading={catalog.loading}
          onAdd={addProduct}
          onBarcode={() => setDialog('barcode')}
          onEnterAdd={handleEnterAdd}
          onPageChange={(nextPage) => setCatalogPage(Math.max(0, nextPage))}
          onRetry={() => setRefreshKey((key) => key + 1)}
          onSearch={onSearch}
          page={catalog.page}
          pageCount={catalog.pageCount}
          pageSize={PAGE_SIZE}
          products={catalog.items}
          search={search}
          searchRef={searchRef}
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
          <button className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-bo-primary px-4 text-sm font-semibold text-white transition hover:bg-bo-primary-hover disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!cart.length || isSubmitting} onClick={openPayment} type="button">Thanh toán</button>
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
