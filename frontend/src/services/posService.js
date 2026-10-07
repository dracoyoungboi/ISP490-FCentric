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

export const posService = {
  /**
   * Catalog SKU bán được của một kho được ủy quyền, phân trang server-side.
   * Trả về envelope data (Page) hoặc null khi response không hợp lệ.
   */
  async getCatalog(khoId, { q, page = 0, size = 120, signal } = {}) {
    const res = await apiClient.get("/api/v1/pos/catalog", {
      params: { khoId, q: q || undefined, page, size },
      signal,
    });
    return res.data?.data ?? null;
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
  // Hiển thị màu + size để hai biến thể không nhìn giống hệt nhau
  name: `${item.tenSanPham} · ${item.tenMau} · ${item.tenSize}`,
  sku: item.maSku,
  price: Number(item.giaBan ?? 0),
  // Tồn khả dụng của ĐÚNG kho đang bán (server đã SUM theo kho); null = chưa biết
  stock: item.soLuongKhaDung != null ? Number(item.soLuongKhaDung) : null,
  image: item.anhUrl || null,
  tenMau: item.tenMau,
  tenSize: item.tenSize,
  tenChatLieu: item.tenChatLieu,
});

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
