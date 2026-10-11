import apiClient from "./apiClient";
import { CHANNEL_MOCK } from "@/mocks/mockHelpers";
import { kenhBanHangMock } from "@/mocks/kenhBanHangMock";

const BASE = "/api/v1/kenh-ban-hang";
const data = (res) => res.data?.data;

/**
 * Chuẩn hóa mã kênh (Hỗ trợ cả ID số như 2 và chuỗi như 'SHOPIFY')
 */
export function resolveChannelCode(channelIdOrCode) {
  if (!channelIdOrCode) return "SHOPIFY";
  const str = String(channelIdOrCode).trim();
  if (str === "2" || str.toUpperCase() === "SHOPIFY") return "SHOPIFY";
  if (str === "3" || str.toUpperCase() === "LAZADA") return "LAZADA";
  if (str === "5" || str.toUpperCase() === "TIKTOK") return "TIKTOK";
  return str.toUpperCase();
}

/**
 * Chuẩn hóa dữ liệu phân trang liên kết từ backend về frontend model
 */
function normalizeLienKetPage(pageData) {
  if (!pageData) return { content: [], totalElements: 0, totalPages: 0 };
  const content = (pageData.content || []).map((row) => ({
    ...row,
    khaDung: row.soLuongKhaDung !== undefined ? row.soLuongKhaDung : row.khaDung,
    soDay: row.soLuongDaDay !== undefined ? row.soLuongDaDay : row.soDay,
    trangThaiLienKet: row.trangThaiLienKet || (row.bienTheSanPhamId ? "da_lien_ket" : "chua_lien_ket"),
  }));
  return {
    ...pageData,
    content,
  };
}

/**
 * Cấu hình kênh Shopify — ĐÃ CÓ backend (KenhBanHangController, chỉ quan_tri_vien).
 * Token luôn trả về dạng che (accessTokenMasked, refreshTokenMasked).
 */
const shopifyApi = {
  getShopifyConfig: () => apiClient.get(`${BASE}/shopify`).then(data),
  updateShopifyConfig: (payload) => apiClient.put(`${BASE}/shopify`, payload).then(data),
  testShopifyConnection: (payload) => apiClient.post(`${BASE}/shopify/test-connection`, payload).then(data),
  refreshShopifyToken: () => apiClient.post(`${BASE}/shopify/refresh-token`).then(data),
};

const shopifyMock = {
  getShopifyConfig: kenhBanHangMock.getShopifyConfig,
  updateShopifyConfig: kenhBanHangMock.updateShopifyConfig,
  testShopifyConnection: kenhBanHangMock.testShopifyConnection,
  refreshShopifyToken: kenhBanHangMock.refreshShopifyToken,
};

/**
 * API đồng bộ sản phẩm, SKU mapping, tồn kho và KPI kênh bán hàng
 */
const syncApi = {
  getKetNoi: async (id) => {
    const code = resolveChannelCode(id);
    const [configRes, tongQuanRes] = await Promise.allSettled([
      apiClient.get(`${BASE}/shopify`).then(data),
      apiClient.get(`${BASE}/${code}/tong-quan`).then(data),
    ]);

    const config = configRes.status === "fulfilled" ? configRes.value : null;
    const tongQuan = tongQuanRes.status === "fulfilled" ? tongQuanRes.value : null;

    const domain =
      config?.shopDomain ||
      (config?.apiUrl ? config.apiUrl.replace(/^https?:\/\//i, "").split("/")[0] : "fcentric-dev.myshopify.com");
    const total = tongQuan?.tongSkuSan ?? 0;
    const linked = tongQuan?.daLienKet ?? 0;
    const unlinked = tongQuan?.chuaLienKet ?? 0;
    const errors = tongQuan?.loiDongBo ?? 0;

    return {
      id: config?.id || (Number(id) || 2),
      kenhBanId: config?.id || 2,
      maKenh: code,
      tenKenh: code === "SHOPIFY" ? "Shopify" : code,
      tenHienThi: domain ? `Shopify (${domain})` : "Shopify Official",
      shopIdSan: domain,
      tenShopSan: domain,
      tenMienShop: domain,
      trangThai: config?.trangThai === 1 || config?.hasAccessToken ? "dang_hoat_dong" : "tam_dung",
      khoId: 1,
      tenKho: "Kho tổng Hà Nội",
      tyLeDayTon: 100,
      tonDem: 0,
      nguongVe0: 0,
      lanDayTonCuoi: tongQuan?.lanDongBoCuoi || config?.ngayCapNhat,
      soLienKet: total,
      soLienKetDangBat: linked,
      soChuaLienKet: unlinked,
      soLoi: errors,
    };
  },

  getKhoSan: (id) =>
    apiClient
      .get(`${BASE}/${resolveChannelCode(id)}/locations`)
      .then(data)
      .catch(() => kenhBanHangMock.getKhoSan(id)),

  luuCauHinh: (id, payload) =>
    apiClient
      .put(`${BASE}/${resolveChannelCode(id)}/cai-dat`, payload)
      .then(data)
      .catch(() => kenhBanHangMock.luuCauHinh(id, payload)),

  batTatDongBo: (id, payload) =>
    apiClient
      .put(`${BASE}/${resolveChannelCode(id)}/cai-dat`, payload)
      .then(data)
      .catch(() => kenhBanHangMock.batTatDongBo(id, payload)),

  taiSanPham: (id) => apiClient.post(`${BASE}/${resolveChannelCode(id)}/tai-san-pham`).then(data),

  tuDongLienKet: (id) => apiClient.post(`${BASE}/${resolveChannelCode(id)}/tu-dong-lien-ket`).then(data),

  filterLienKet: (id, params = {}) => {
    const code = resolveChannelCode(id);
    const query = {
      page: params.page ?? 0,
      size: params.size ?? 10,
    };
    if (params.search?.trim()) query.search = params.search.trim();
    if (params.trangThaiLienKet) query.trangThai = params.trangThaiLienKet;

    return apiClient.get(`${BASE}/${code}/lien-ket`, { params: query }).then(data).then(normalizeLienKetPage);
  },

  capNhatLienKet: (lienKetId, payload = {}) =>
    apiClient
      .put(`${BASE}/lien-ket/${lienKetId}`, payload)
      .then(data)
      .then((row) => ({
        ...row,
        khaDung: row?.soLuongKhaDung !== undefined ? row.soLuongKhaDung : row?.khaDung,
        soDay: row?.soLuongDaDay !== undefined ? row.soLuongDaDay : row?.soDay,
        trangThaiLienKet: row?.trangThaiLienKet || (row?.bienTheSanPhamId ? "da_lien_ket" : "chua_lien_ket"),
      })),

  dayTon: (id, payload) => apiClient.post(`${BASE}/${resolveChannelCode(id)}/day-ton`, payload || {}).then(data),

  layDon: (id, range) =>
    apiClient
      .post(`${BASE}/${resolveChannelCode(id)}/lay-don`, range)
      .then(data)
      .then((res) => ({
        soSuKien: res?.soDonMoi ?? 0,
        ...res,
      }))
      .catch(() => kenhBanHangMock.layDon(id, range)),

  dongBoTatCa: () =>
    apiClient
      .post(`${BASE}/dong-bo-tat-ca`)
      .then(data)
      .then((res) => ({
        soKetNoi: 1,
        ...res,
      }))
      .catch(() => kenhBanHangMock.dongBoTatCa()),

  tongQuan: () =>
    apiClient
      .get(`${BASE}/tong-quan`)
      .then(data)
      .then((tq) => ({
        kenhDangKetNoi: 1,
        tongKetNoi: 1,
        suKienTrongNhatKy: (tq?.tongSkuSan ?? 0),
        suKienCanXuLy: tq?.loiDongBo ?? 0,
        chuKyDongBoTonPhut: 5,
        chuKyLayDonPhut: 5,
        ketNois: [
          {
            id: 2,
            maKenh: "SHOPIFY",
            tenHienThi: "Shopify Official",
            trangThai: "dang_hoat_dong",
            lanDayTonCuoi: tq?.lanDongBoCuoi,
            lanLayDonCuoi: tq?.lanDongBoCuoi,
            soLoi: tq?.loiDongBo ?? 0,
            soChoDay: tq?.chuaLienKet ?? 0,
          },
        ],
      }))
      .catch(() => kenhBanHangMock.tongQuan()),

  filterNhatKy: (params = {}) => {
    const code = resolveChannelCode(params.ketNoiKenhId);
    const query = {
      page: params.page ?? 0,
      size: params.size ?? 10,
    };
    if (params.loai) query.loai = params.loai;
    if (params.trangThai) query.trangThai = params.trangThai;
    if (params.search?.trim()) query.search = params.search.trim();

    return apiClient
      .get(`${BASE}/${code}/nhat-ky`, { params: query })
      .then(data)
      .catch(() => kenhBanHangMock.filterNhatKy(params));
  },

  getNhatKy: (id) =>
    apiClient
      .get(`${BASE}/nhat-ky/${id}`)
      .then(data)
      .catch(() => kenhBanHangMock.getNhatKy(id)),

  thuLai: (id) =>
    apiClient
      .post(`${BASE}/lien-ket/${id}/thu-lai`)
      .then(data)
      .catch(() => kenhBanHangMock.thuLai(id)),

  timBienThe: (q = "", limit = 20) =>
    apiClient
      .get(`${BASE}/bien-the/tim-kiem`, { params: { q, limit } })
      .then(data)
      .catch(() => kenhBanHangMock.timBienThe(q, limit)),

  getKhoOptions: () =>
    apiClient
      .get("/api/v1/kho/all")
      .then(data)
      .then((list) =>
        (list || []).map((k) => ({
          value: String(k.id),
          label: k.tenKho,
          diaChi: k.diaChi,
        }))
      )
      .catch(() => kenhBanHangMock.getKhoOptions()),

  getKhachHangOptions: () =>
    apiClient
      .post("/api/v1/khach-hang/filter", { page: 0, size: 50, filters: [] })
      .then(data)
      .then((res) =>
        (res?.content || []).map((kh) => ({
          value: String(kh.id),
          label: `${kh.tenKhachHang} ${kh.soDienThoai ? `- ${kh.soDienThoai}` : ""}`,
        }))
      )
      .catch(() => kenhBanHangMock.getKhachHangOptions()),
};

export const kenhBanHangService = {
  ...(CHANNEL_MOCK ? shopifyMock : shopifyApi),
  ...(CHANNEL_MOCK ? kenhBanHangMock : syncApi),
};

/** Cấu hình Shopify chạy dữ liệu mẫu khi bật VITE_CHANNEL_MOCK=true. */
export const isShopifyConfigMock = CHANNEL_MOCK;
/** Chạy dữ liệu mẫu khi bật VITE_CHANNEL_MOCK=true. */
export const isChannelSyncMock = CHANNEL_MOCK;
