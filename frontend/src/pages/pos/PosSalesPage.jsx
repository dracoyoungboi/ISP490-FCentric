import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleHelp,
  Plus,
  ShoppingBag,
  Warehouse,
  X,
} from 'lucide-react';
import PosCartPanel from './components/PosCartPanel';
import PosInvoiceTabs from './components/PosInvoiceTabs';
import PosDialogs from './components/PosDialogs';
import PosProductCatalog from './components/PosProductCatalog';
import { formatMoney } from './pos-format';
import {
  posService,
  toPosProduct,
  WALKIN_CUSTOMER_CODE,
  newCheckoutRequestId,
  getPendingCheckoutIds,
  addPendingCheckoutId,
  removePendingCheckoutId,
} from '@/services/posService';

const PAGE_SIZE = 120;

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
  };
}

const isFrozenInvoice = (invoice) =>
  Boolean(invoice?.attempt && (invoice.attempt.status === 'pending' || invoice.attempt.status === 'unknown'));

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
}) {
  const walkInCustomer = useMemo(
    () => customers.find((customer) => customer.code === WALKIN_CUSTOMER_CODE) || null,
    [customers]
  );
  const defaultWarehouseId =
    initialWarehouseId && warehouses.some((w) => w.id === initialWarehouseId)
      ? initialWarehouseId
      : warehouses[0]?.id ?? null;

  const [invoices, setInvoices] = useState(() => [
    createInvoice(1, { warehouseId: defaultWarehouseId, customer: walkInCustomer }),
  ]);
  const [activeInvoice, setActiveInvoice] = useState(1);
  const nextInvoiceNumber = useRef(2);

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
  const [toast, setToast] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeError, setBarcodeError] = useState('');
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [catalog, setCatalog] = useState({ items: [], totalElements: 0, page: 0, pageCount: 1, loading: false, error: null });
  const catalogSeq = useRef(0);
  const searchRef = useRef(null);
  const keyboardContext = useRef(null);

  // Kết quả thanh toán chính thức (dữ liệu server) cho dialog receipt + kết quả phục hồi sau refresh.
  const [receiptResult, setReceiptResult] = useState(null);
  const [priceChangeInfo, setPriceChangeInfo] = useState(null);
  const [recoveredResult, setRecoveredResult] = useState(null);

  // Kết quả phục hồi sau refresh -> mở dialog thông báo chính thức (không tự submit).
  useEffect(() => {
    if (recoveredResult) setDialog('recovered-result');
  }, [recoveredResult]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0), [cart]);
  const total = subtotal;
  const currentInvoiceLabel = `HD${String(ticketNumber).padStart(6, '0')}`;

  const showToast = (message) => setToast(message);

  // Sau thất bại XÁC ĐỊNH, mọi sửa đổi draft phải mở khóa attempt để lần sau dùng key MỚI.
  const clearFailedAttemptAfterEdit = () => {
    if (attempt && attempt.status === 'failed') {
      updateInvoice('attempt', null);
    }
  };

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
    posService.getCatalog(warehouseId, { q: search, page: catalogPage, size: PAGE_SIZE, signal: controller.signal })
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
  }, [warehouseId, search, catalogPage, refreshKey]);

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

  const changeWarehouse = (nextWarehouseId) => {
    if (frozen) {
      showToast('Hóa đơn đang trong giao dịch thanh toán — không thể đổi kho lúc này.');
      return;
    }
    const target = Number(nextWarehouseId);
    if (!target || target === warehouseId) return;
    // Chính sách Phase 01 mục 5: đổi kho -> xóa giỏ hóa đơn hiện tại (không giữ nhầm dòng hàng).
    updateInvoice('warehouseId', target);
    updateInvoice('cart', []);
    setSearch('');
    setCatalogPage(0);
    clearFailedAttemptAfterEdit();
    showToast('Đã đổi kho bán hàng. Giỏ của hóa đơn hiện tại được xóa để tránh nhầm tồn kho giữa các kho.');
  };

  // ===== Giỏ (key = bienTheSanPhamId — không gộp hai size/màu khác nhau) =====
  const addProduct = (product) => {
    if (frozen) {
      showToast('Hóa đơn đang trong giao dịch thanh toán — giỏ đã được khóa.');
      return;
    }
    const variantId = product.id;
    const stock = Number(product.stock);
    setCart((current) => {
      const line = current.find((item) => item.product.id === variantId);
      if (line) {
        if (Number.isFinite(stock) && line.quantity + 1 > stock) {
          showToast(`Chỉ còn ${stock} sản phẩm khả dụng tại kho này.`);
          return current;
        }
        return current.map((item) => item.product.id === variantId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, { product, quantity: 1 }];
    });
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
    showToast('Đã xóa nội dung hóa đơn.');
  };

  const selectCustomerForInvoice = (selectedCustomer) => {
    if (frozen) return;
    updateInvoice('customer', selectedCustomer);
    clearFailedAttemptAfterEdit();
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
  const requestNewInvoice = () => {
    if (isSubmitting || dialog || frozen) return;
    const number = nextInvoiceNumber.current++;
    setInvoices((current) => [...current, createInvoice(number, { warehouseId, customer: walkInCustomer })]);
    setActiveInvoice(number);
    setPaymentError('');
    setMobileCartOpen(false);
  };

  const selectInvoice = (number) => {
    if (isSubmitting || dialog || frozen) return;
    setActiveInvoice(number);
    setPaymentError('');
    setMobileCartOpen(false);
  };

  const isInvoiceUntouched = (invoice) => !invoice.cart.length
    && !invoice.note.trim()
    && !invoice.attempt
    && (!invoice.customer || (walkInCustomer && invoice.customer.id === walkInCustomer.id));

  const removeInvoice = (number) => {
    const remaining = invoices.filter((invoice) => invoice.number !== number);
    if (!remaining.length) {
      const replacement = createInvoice(nextInvoiceNumber.current++, { warehouseId, customer: walkInCustomer });
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
      showToast('Hóa đơn đang trong giao dịch thanh toán — không thể đóng.');
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
        showToast(`Không tìm thấy mã hàng bắt đầu bằng "${query}".`);
        return;
      }
      const product = toPosProduct(first);
      if (Number(product.stock) <= 0) {
        showToast(`${product.name} đã hết hàng tại kho này.`);
        return;
      }
      addProduct(product);
      showToast(`Đã thêm ${product.name}.`);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Không thể tra cứu mã hàng. Vui lòng thử lại.');
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
      addProduct(product);
      setBarcodeError('');
      setBarcodeInput('');
      setDialog(null);
      showToast(`Đã thêm ${product.name}.`);
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

  const handleCheckoutSuccess = (invoiceNumber, result, attemptState) => {
    finishAttempt(invoiceNumber, { status: 'succeeded', result, error: null });
    removePendingCheckoutId(attemptState.requestId);
    // Cập nhật tồn hiển thị: refetch catalog của kho đang bán.
    setRefreshKey((key) => key + 1);
    setReceiptResult(result);
    setDialog('receipt');
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
        showToast('Server chưa có kết quả cho giao dịch này. Có thể thử lại cùng mã giao dịch.');
      }
    } catch (error) {
      if (error?.response?.status === 404) {
        // Kết quả chưa rõ (server đã rollback): được phép thử lại CÙNG key + CÙNG payload.
        showToast('Giao dịch chưa có kết quả trên server — có thể thử lại cùng mã giao dịch.');
      } else {
        showToast(error?.response?.data?.message || 'Không thể kiểm tra kết quả. Vui lòng thử lại.');
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
    showToast('Giá đã được cập nhật về giá server. Vui lòng kiểm tra tổng mới và bấm Thanh toán lại.');
  };

  const openPayment = () => {
    if (!cart.length) {
      showToast('Thêm ít nhất một sản phẩm trước khi thanh toán.');
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

  const printReceipt = (result) => {
    if (!result?.donBanHangId) {
      showToast('Không có thông tin hóa đơn để in.');
      return;
    }
    // In từ đơn ĐÃ LƯU trên server (route dự án hiện hữu); lỗi in chỉ thử lại in,
    // không bao giờ chạy lại checkout.
    window.open(`/sales-orders/${result.donBanHangId}/invoice`, '_blank', 'noopener');
  };

  const closeReceipt = () => {
    // Chỉ đóng ĐÚNG tab đã gửi; các tab khác giữ nguyên.
    const submittedNumber = invoices.find((inv) => inv.attempt?.status === 'succeeded')?.number;
    setReceiptResult(null);
    setDialog(null);
    if (submittedNumber != null) {
      removeInvoice(submittedNumber);
    }
  };

  const actions = {
    onSelectCustomer: selectCustomerForInvoice,
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
    onCloseRecovered: () => setRecoveredResult(null),
    onBarcodeInput: (value) => { setBarcodeInput(value); setBarcodeError(''); },
    onFindBarcode: findBarcode,
  };

  const dialogState = {
    customers,
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
    invoiceCode: currentInvoiceLabel,
    attemptStatus: attempt?.status ?? null,
    receipt: receiptResult,
    priceChange: priceChangeInfo,
    frozen,
    recoveredResult,
  };

  keyboardContext.current = {
    isSubmitting,
    frozen,
    dialog,
    cartLength: cart.length,
    searchRef,
    requestNewInvoice,
    openPayment,
    setDialog,
    setMobileCartOpen,
    showToast,
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const context = keyboardContext.current;
      if (!context) return;
      if (context.isSubmitting) { event.preventDefault(); return; }
      if (event.key === 'Escape') {
        if (context.dialog) context.setDialog(null);
        else context.setMobileCartOpen(false);
        return;
      }
      // Phím tắt KHÔNG được vượt guard giao dịch đang treo (frozen).
      if (event.key === 'F1') {
        event.preventDefault();
        context.setDialog('shortcuts');
      } else if (event.key === 'F2') {
        event.preventDefault();
        if (!context.frozen) context.requestNewInvoice();
      } else if (event.key === 'F3') {
        event.preventDefault();
        context.searchRef.current?.focus();
      } else if (event.key === 'F4') {
        event.preventDefault();
        if (!context.frozen) context.setDialog('customer');
      } else if (event.key === 'F9') {
        event.preventDefault();
        if (!context.frozen) context.openPayment();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const renderCartPanel = () => (
    <PosCartPanel
      cart={cart}
      customer={customer}
      frozen={frozen}
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
    <div className="relative flex h-full min-h-0 flex-col bg-bo-canvas text-bo-foreground">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-bo-border bg-bo-surface px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold text-bo-foreground">Bán hàng tại quầy</h1>
            </div>
            <p className="mt-0.5 truncate text-xs text-bo-muted">{activeWarehouse ? `${activeWarehouse.tenKho} (${activeWarehouse.maKho})` : 'Chưa chọn kho'} · {currentInvoiceLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-9 items-center gap-1.5 rounded-lg border border-bo-border bg-bo-surface px-2.5 text-xs font-medium text-bo-foreground transition hover:border-bo-primary/40" htmlFor="pos-warehouse">
            <Warehouse aria-hidden="true" size={14} className="text-bo-muted" />
            <span className="hidden text-bo-muted sm:inline">Kho bán hàng:</span>
            <select
              className="max-w-52 truncate bg-transparent py-1.5 pl-1 pr-6 text-xs font-semibold outline-none"
              disabled={!warehouses.length || isSubmitting || frozen}
              id="pos-warehouse"
              onChange={(event) => changeWarehouse(event.target.value)}
              value={warehouseId ?? ''}
            >
              {!warehouses.length ? <option value="">Chưa có kho</option> : null}
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.tenKho} ({w.maKho})</option>)}
            </select>
          </label>
          <button aria-label="Hướng dẫn phím tắt" className="grid size-9 place-items-center rounded-lg border border-bo-border text-bo-muted transition hover:bg-slate-50 hover:text-bo-foreground" onClick={() => setDialog('shortcuts')} title="Phím tắt (F1)" type="button"><CircleHelp aria-hidden="true" size={16} /></button>
        </div>
      </header>

      <PosInvoiceTabs
        activeInvoice={activeInvoice}
        disabled={isSubmitting || Boolean(dialog) || frozen}
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
      {toast ? <div aria-live="polite" className="fixed bottom-20 left-1/2 z-[100] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm xl:bottom-5"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/15"><Plus aria-hidden="true" size={13} /></span><span>{toast}</span></div> : null}
    </div>
  );
}
