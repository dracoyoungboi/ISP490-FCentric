import apiClient from "./apiClient";

const BASE = "/api/v1/shopee-mock";

export const shopeeSimulatorService = {
  // 1. Kênh Người Mua (Buyer Storefront)
  getStorefrontProducts: async () => {
    const res = await apiClient.get(`${BASE}/storefront/products`);
    return res.data?.data || [];
  },

  buyerCheckout: async (payload) => {
    const res = await apiClient.post(`${BASE}/storefront/checkout`, payload);
    return res.data?.data;
  },

  // 2. Kênh Người Bán (Seller Center)
  getSellerProducts: async () => {
    const res = await apiClient.get(`${BASE}/seller/products`);
    return res.data?.data || [];
  },

  getSellerOrders: async () => {
    const res = await apiClient.get(`${BASE}/seller/orders`);
    return res.data?.data || [];
  },

  updateOrderStatus: async (orderSn, payload) => {
    const res = await apiClient.post(`${BASE}/seller/orders/${orderSn}/status`, payload);
    return res.data?.data;
  },

  // 3. Quản trị
  resetData: async () => {
    const res = await apiClient.post(`${BASE}/reset`);
    return res.data?.data;
  },

  // 4. Quản lý Ủy quyền Ứng dụng Đối tác (OAuth2 & App Management)
  getAppAuthStatus: async () => {
    const res = await apiClient.get(`${BASE}/app-auth`);
    return res.data?.data;
  },

  revokeAppAuth: async () => {
    const res = await apiClient.post(`${BASE}/app-auth/revoke`);
    return res.data?.data;
  },
};
