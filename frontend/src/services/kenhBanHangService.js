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

    const isDayTonSaved = localStorage.getItem(`fcentric_sync_${code}_tuDongDayTon`);
    const isLayDonSaved = localStorage.getItem(`fcentric_sync_${code}_tuDongLayDon`);
    const tuDongDayTon = isDayTonSaved !== null ? JSON.parse(isDayTonSaved) : (config?.trangThai === 1);
    const tuDongLayDon = isLayDonSaved !== null ? JSON.parse(isLayDonSaved) : (config?.trangThai === 1);
    const khachHangIdSaved = localStorage.getItem(`fcentric_sync_${code}_khachHangMacDinhId`);
    const layDonTuSaved = localStorage.getItem(`fcentric_sync_${code}_layDonTu`);

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
      coTheBatDongBo: true,
      tuDongDayTon,
      tuDongLayDon,
      khachHangMacDinhId: khachHangIdSaved ? Number(khachHangIdSaved) : 1,
      layDonTu: layDonTuSaved || new Date(Date.now() - 30 * 86400000).toISOString(),
      khoId: 1,
      tenKho: "Toàn bộ chuỗi kho & cửa hàng",
      tyLeDayTon: 100,
      tonDem: 0,
      nguongVe0: 0,
      lanDayTonCuoi: tongQuan?.lanDayTonCuoi ?? null,
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

  luuCauHinh: (id, payload) => {
    const code = resolveChannelCode(id);
    if (payload?.khachHangMacDinhId) {
      localStorage.setItem(`fcentric_sync_${code}_khachHangMacDinhId`, String(payload.khachHangMacDinhId));
    }
    if (payload?.layDonTu) {
      localStorage.setItem(`fcentric_sync_${code}_layDonTu`, String(payload.layDonTu));
    }
    return apiClient
      .put(`${BASE}/${code}/cai-dat`, payload)
      .then(data)
      .catch(() => kenhBanHangMock.luuCauHinh(id, payload));
  },

  batTatDongBo: (id, payload) => {
    const code = resolveChannelCode(id);
    if (payload?.tuDongDayTon !== undefined) {
      localStorage.setItem(`fcentric_sync_${code}_tuDongDayTon`, JSON.stringify(payload.tuDongDayTon));
    }
    if (payload?.tuDongLayDon !== undefined) {
      localStorage.setItem(`fcentric_sync_${code}_tuDongLayDon`, JSON.stringify(payload.tuDongLayDon));
    }
    return apiClient
      .put(`${BASE}/${code}/cai-dat`, payload)
      .then(data)
      .catch(() => kenhBanHangMock.batTatDongBo(id, payload));
  },

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
        // Chu kỳ và thời điểm đẩy tồn / lấy đơn lấy từ backend (OMNI_SYNC_INTERVAL_MINS + lần chạy thật)
        chuKyDongBoTonPhut: tq?.chuKyDongBoTonPhut ?? null,
        chuKyLayDonPhut: tq?.chuKyLayDonPhut ?? null,
        ketNois: [
          {
            id: 2,
            maKenh: "SHOPIFY",
            tenHienThi: "Shopify Official",
            trangThai: "dang_hoat_dong",
            lanDayTonCuoi: tq?.lanDayTonCuoi ?? null,
            lanLayDonCuoi: tq?.lanLayDonCuoi ?? null,
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
          id: kh.id,
          maKhachHang: kh.maKhachHang || (kh.soDienThoai ? kh.soDienThoai : `KH${kh.id}`),
          tenKhachHang: kh.tenKhachHang,
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
