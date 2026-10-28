import apiClient from "./apiClient";

/**
 * Mã khách hàng lẻ (walk-in) theo chính sách hợp đồng Phase 01 mục 6.1:
 * bản ghi thật có ma_khach_hang = KHLE, loai_khach_hang = 'le' (được seed
 * ở Phase 03 qua migration additive). Phase 02: nếu bản ghi chưa tồn tại,
 * POS KHÔNG mặc định chọn khách nào và bắt chọn tường minh — không dùng id demo.
 */
export const WALKIN_CUSTOMER_CODE = "KHLE";

/**
 * Metadata phục hồi tối thiểu cho các giao dịch CHƯA RÕ kết quả (timeout/mất mạng
 * sau khi đã gửi): chỉ lưu requestId trong sessionStorage (sống sót khi refresh
 * cùng tab). KHÔNG lưu token, thông tin khách hàng hay nội dung giỏ.
 */
const PENDING_CHECKOUTS_KEY = "fcentric.pos.pendingCheckouts";

export const getPendingCheckoutIds = () => {
  try {
    const raw = sessionStorage.getItem(PENDING_CHECKOUTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const addPendingCheckoutId = (requestId) => {
  try {
    const ids = getPendingCheckoutIds();
    if (!ids.includes(requestId)) {
      sessionStorage.setItem(PENDING_CHECKOUTS_KEY, JSON.stringify([...ids, requestId]));
    }
  } catch {
    /* storage bị chặn: bỏ qua — recovery vẫn chạy được trong phiên */
  }
};

export const removePendingCheckoutId = (requestId) => {
  try {
    sessionStorage.setItem(
      PENDING_CHECKOUTS_KEY,
      JSON.stringify(getPendingCheckoutIds().filter((id) => id !== requestId))
    );
  } catch {
    /* bỏ qua */
  }
};

/**
 * Lưu tạm các hóa đơn đang làm dở (giỏ hàng, khách, ghi chú, mã QR đang chờ) để bấm F5
 * hay lỡ tắt tab vẫn khôi phục được. Lưu theo từng tài khoản trên trình duyệt này,
 * tự bỏ bản nháp cũ hơn 12 giờ. KHÔNG lưu token hay thông tin thanh toán nhạy cảm.
 */
const DRAFT_KEY_PREFIX = "fcentric.pos.drafts.v1:";
const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export const currentUserKey = () => {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return "anon";
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return String(payload.id ?? payload.userId ?? payload.sub ?? payload.tenDangNhap ?? "anon");
  } catch {
    return "anon";
  }
};

export const loadPosDrafts = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY_PREFIX + currentUserKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.invoices) || !parsed.invoices.length) return null;
    if (Date.now() - Number(parsed.savedAt || 0) > DRAFT_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Mỗi tài khoản chỉ một tab POS được GHI nháp: tab đang giữ quyền ghi id của nó vào đây
 * (đồng bộ, dùng chung mọi tab cùng trình duyệt). Tab đã bị tab khác giành quyền sẽ bị
 * savePosDrafts từ chối ngay, kể cả trước khi nó kịp nhận thông báo mất quyền.
 */
const OWNER_KEY_PREFIX = "fcentric.pos.owner.v1:";

export const posOwnerStorageKey = (userKey) => OWNER_KEY_PREFIX + userKey;

export const getPosOwner = (userKey) => {
  try {
    return localStorage.getItem(posOwnerStorageKey(userKey));
  } catch {
    return null;
  }
};

export const setPosOwner = (userKey, tabId) => {
  try {
    localStorage.setItem(posOwnerStorageKey(userKey), tabId);
  } catch {
    /* storage bị chặn: không phối hợp được giữa các tab */
  }
};

export const releasePosOwner = (userKey, tabId) => {
  try {
    if (localStorage.getItem(posOwnerStorageKey(userKey)) === tabId) {
      localStorage.removeItem(posOwnerStorageKey(userKey));
    }
  } catch {
    /* bỏ qua */
  }
};

/** ownerTabId: tab đang mở POS — chỉ ghi khi tab này còn giữ quyền ghi nháp. */
export const savePosDrafts = (invoices, activeInvoice, ownerTabId) => {
  try {
    if (ownerTabId) {
      const userKey = currentUserKey();
      const owner = getPosOwner(userKey);
      if (owner && owner !== ownerTabId) return; // tab khác đã giành quyền
      // Khóa bị xóa từ bên ngoài (xóa dữ liệu trang...): tab đang mở POS ghi lại quyền của mình.
      if (!owner) setPosOwner(userKey, ownerTabId);
    }
    localStorage.setItem(
      DRAFT_KEY_PREFIX + currentUserKey(),
      JSON.stringify({ v: 1, savedAt: Date.now(), activeInvoice, invoices })
    );
  } catch {
    /* storage đầy hoặc bị chặn: bỏ qua — POS vẫn chạy bình thường */
  }
};

export const posService = {
  /**
   * Catalog SKU bán được của một kho được ủy quyền, phân trang server-side.
   * trangThaiTon: 'con_hang' | 'het_hang' | 'tat_ca' (bỏ trống = tat_ca) — lọc ở server,
   * nên tổng số + phân trang luôn đúng theo bộ lọc.
   * Trả về envelope data (Page) hoặc null khi response không hợp lệ.
   */
  async getCatalog(khoId, { q, trangThaiTon, page = 0, size = 120, signal } = {}) {
    const res = await apiClient.get("/api/v1/pos/catalog", {
      params: {
        khoId,
        q: q || undefined,
        trangThaiTon: trangThaiTon || undefined,
        page,
        size,
      },
      signal,
    });
    return res.data?.data ?? null;
  },

  /**
   * Danh mục GỘP KÍCH CỠ: mỗi phần tử là một mẫu + màu (+ chất liệu) kèm đủ các kích cỡ (bienThes).
   * Phân trang và bộ lọc tồn tính THEO NHÓM ở server: con_hang = còn ít nhất một kích cỡ có hàng
   * (kích cỡ đã hết vẫn trả về để làm mờ), het_hang = mọi kích cỡ đều hết, tat_ca = không lọc.
   * Trả về envelope data (Page) hoặc null khi response không hợp lệ.
   */
  async getCatalogGroups(khoId, { q, trangThaiTon, page = 0, size = 60, signal } = {}) {
    const res = await apiClient.get("/api/v1/pos/catalog/groups", {
      params: {
        khoId,
        q: q || undefined,
        trangThaiTon: trangThaiTon || undefined,
        page,
        size,
      },
      signal,
    });
    return res.data?.data ?? null;
  },

  /**
   * Tồn khả dụng hiện tại của các SKU (thường là dòng trong giỏ) tại kho đang bán.
   * Trả về object { [bienTheSanPhamId]: tồn }. ids gửi dạng "1,2,3" để Spring đọc được
   * (axios mặc định gửi mảng thành ids[]=1&ids[]=2, server không nhận).
   */
  async getStock(khoId, ids, { signal } = {}) {
    if (!ids?.length) return {};
    const res = await apiClient.get("/api/v1/pos/stock", {
      params: { khoId, ids: ids.join(",") },
      signal,
    });
    return res.data?.data ?? {};
  },

  /**
   * Tra cứu: skuPrefix (phím tắt Enter — kết quả đầu tiên của toàn bộ truy vấn
   * server-side, chỉ khớp mã SKU/mã vạch SKU) hoặc barcode (khớp CHÍNH XÁC).
   */
  async lookup(khoId, { skuPrefix, barcode, signal } = {}) {
    const res = await apiClient.get("/api/v1/pos/lookup", {
      params: {
        khoId,
        skuPrefix: skuPrefix || undefined,
        barcode: barcode || undefined,
      },
      signal,
    });
    return res.data?.data ?? [];
  },

  /**
   * Checkout tiền mặt. Idempotency: requestId do client sinh và GIỮ NGUYÊN khi
   * retry (cùng key + cùng payload). Timeout 30s: sau đó client phải hỏi recovery
   * — không tự sinh key mới cho một kết quả chưa rõ.
   */
  async checkout(payload, { signal } = {}) {
    const res = await apiClient.post("/api/v1/pos/checkout", payload, {
      timeout: 30000,
      signal,
    });
    return res.data?.data ?? null;
  },

  /**
   * Phục hồi kết quả checkout bằng CHÍNH requestId đã gửi.
   * SUCCESS -> {requestId, trangThai, result}; FAILED -> {..., errorMessage};
   * 404 (không tìm thấy) = kết quả chưa rõ -> client được phép thử lại cùng payload.
   */
  /** Phương thức thanh toán đang bật: { cash: true, payos: true|false }. */
  async getPaymentMethods() {
    const res = await apiClient.get("/api/v1/pos/payment-methods");
    return res.data?.data ?? { cash: true, payos: false };
  },

  /**
   * Chuyển khoản payOS: giữ chỗ hàng + tạo mã QR. Body giống checkout (requestId, khoId,
   * khachHangId, items, note). Gọi lại cùng requestId khi QR còn hạn -> trả lại đúng QR cũ.
   * Trả kết hợp: thêm tienMatTruoc (tiền mặt khách đã đưa, số đồng nguyên) -> mã QR chỉ mang phần còn lại
   * (soTien = tổng − tienMatTruoc). Không có tiền mặt thì KHÔNG gửi trường này (mã QR trọn hóa đơn như cũ).
   */
  async createPayosLink(payload) {
    const res = await apiClient.post("/api/v1/pos/payos/payment-links", payload, { timeout: 30000 });
    return res.data?.data ?? null;
  },

  /** Trạng thái giao dịch chuyển khoản: PENDING | PAID (kèm result) | CANCELLED | EXPIRED | FAILED | PAID_ERROR. */
  async getPayosStatus(orderCode, { signal } = {}) {
    const res = await apiClient.get(`/api/v1/pos/payos/payment-links/${orderCode}`, { signal });
    return res.data?.data ?? null;
  },

  /** Hủy mã QR, trả lại hàng giữ chỗ (nếu khách đã kịp trả thì server trả về PAID). */
  async cancelPayos(orderCode) {
    const res = await apiClient.post(`/api/v1/pos/payos/payment-links/${orderCode}/cancel`);
    return res.data?.data ?? null;
  },

  /**
   * Mã QR không thành (hủy / hết hạn / lỗi / quản lý đã hoàn khoản chuyển khoản): xác nhận đã trả lại khách tiền mặt
   * đưa trước. Bấm lại trả nguyên kết quả cũ; mã còn chờ / đơn đã tạo / đang chờ quản lý xử lý -> 409 kèm câu báo.
   * Trả trạng thái mã QR mới (tienMatTraLaiLuc đã có).
   */
  async returnPayosCash(orderCode) {
    const res = await apiClient.post(`/api/v1/pos/payos/payment-links/${orderCode}/tra-lai-tien-mat`);
    return res.data?.data ?? null;
  },

  // ===== Màn quản lý "Đối soát chuyển khoản" (quản trị viên) =====

  /** Danh sách giao dịch payOS (Page). trangThai = PAID_ERROR: đã nhận tiền nhưng chưa có đơn. */
  async listPayosTransactions({ trangThai, daXuLy, khoId, tuNgay, denNgay, page = 0, size = 20 } = {}, { signal } = {}) {
    const res = await apiClient.get("/api/v1/pos/payos/payment-links", {
      params: { trangThai: trangThai || undefined, daXuLy: daXuLy || undefined, khoId: khoId || undefined, tuNgay: tuNgay || undefined, denNgay: denNgay || undefined, page, size },
      signal,
    });
    return res.data?.data ?? null;
  },

  async countPayosNeedsAttention() {
    const res = await apiClient.get("/api/v1/pos/payos/payment-links/needs-attention-count");
    return Number(res.data?.data ?? 0);
  },

  /** Giao dịch lỗi -> tạo đơn bán (đã nhận đủ tiền, còn hàng). */
  async createOrderFromPayosError(orderCode, ghiChu) {
    const res = await apiClient.post(`/api/v1/pos/payos/payment-links/${orderCode}/create-order`, { ghiChu: ghiChu || null });
    return res.data?.data ?? null;
  },

  /** Giao dịch lỗi -> đã hoàn tiền cho khách (ghi chú bắt buộc). */
  async markPayosRefunded(orderCode, ghiChu) {
    const res = await apiClient.post(`/api/v1/pos/payos/payment-links/${orderCode}/refunded`, { ghiChu });
    return res.data?.data ?? null;
  },

  /**
   * Thêm nhanh khách hàng tại quầy (tên + SĐT). Trả về KhachHangDto vừa tạo.
   * SĐT trùng -> lỗi 409, response.data.data = khách hàng đã có.
   */
  async quickCreateCustomer({ tenKhachHang, soDienThoai }) {
    const res = await apiClient.post("/api/v1/pos/customers", { tenKhachHang, soDienThoai });
    return res.data?.data ?? null;
  },

  /**
   * Tìm khách hàng đang hoạt động trên server (tên / SĐT / mã), Khách lẻ đứng đầu.
   * Trả về { items: khách đã ánh xạ cho POS, total }.
   */
  async searchCustomers(q, { page = 0, size = 20, signal } = {}) {
    const res = await apiClient.get("/api/v1/pos/customers", {
      params: { q: q || undefined, page, size },
      signal,
    });
    const data = res.data?.data;
    return { items: (data?.content ?? []).map(toPosCustomer), total: data?.totalElements ?? 0 };
  },

  async getCheckoutRequest(requestId, { signal } = {}) {
    const res = await apiClient.get(
      `/api/v1/pos/checkout-requests/${encodeURIComponent(requestId)}`,
      { signal }
    );
    return res.data?.data ?? null;
  },
};

/** Ánh xạ PosCatalogItemDto (server) -> đối tượng sản phẩm cho card/giỏ. */
export const toPosProduct = (item) => ({
  id: item.bienTheSanPhamId,
  variantId: item.bienTheSanPhamId,
  sanPhamId: item.sanPhamId,
  // Hiển thị màu + size để hai biến thể không nhìn giống hệt nhau (thiếu phần nào thì bỏ, không ghi "null")
  name: [item.tenSanPham, item.tenMau, item.tenSize].filter(Boolean).join(' · '),
  sku: item.maSku,
  barcode: item.maVachSku || null,
  price: Number(item.giaBan ?? 0),
  // Tồn khả dụng của ĐÚNG kho đang bán (server đã SUM theo kho); null = chưa biết
  stock: item.soLuongKhaDung != null ? Number(item.soLuongKhaDung) : null,
  image: item.anhUrl || null,
  tenMau: item.tenMau,
  tenSize: item.tenSize,
  tenChatLieu: item.tenChatLieu,
});

/**
 * Ánh xạ PosCatalogNhomDto (server) -> một dòng danh mục gộp kích cỡ.
 * variants: từng kích cỡ là một sản phẩm đầy đủ (toPosProduct) để thêm thẳng vào giỏ như trước,
 * đã xếp theo thứ tự kích cỡ của server.
 */
export const toPosGroup = (group) => {
  const variants = (group.bienThes ?? []).map(toPosProduct);
  const minPrice = Number(group.giaThapNhat ?? 0);
  const maxPrice = Number(group.giaCaoNhat ?? minPrice);
  return {
    key: group.khoaNhom ?? `${group.sanPhamId}-${group.mauSacId}-${group.chatLieuId}`,
    sanPhamId: group.sanPhamId,
    name: group.tenSanPham,
    colorName: group.tenMau,
    colorHex: group.maMauHex || null,
    materialName: group.tenChatLieu || null,
    image: group.anhUrl || variants.find((variant) => variant.image)?.image || null,
    minPrice,
    maxPrice,
    variants,
  };
};

/** Ánh xạ KhachHangDto (server) -> khách hàng cho dialog chọn khách. */
export const toPosCustomer = (customer) => ({
  id: customer.id,
  code: customer.maKhachHang,
  name: customer.tenKhachHang,
  phone: customer.soDienThoai,
  tier:
    { le: "Khách lẻ", si: "Khách sỉ", doanh_nghiep: "Doanh nghiệp" }[
      customer.loaiKhachHang
    ] || customer.loaiKhachHang,
});

/** Sinh requestId ổn định cho một lần đóng băng thanh toán. */
export const newCheckoutRequestId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `rq-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};
