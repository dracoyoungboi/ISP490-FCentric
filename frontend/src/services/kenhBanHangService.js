import apiClient from "./apiClient";
import { CHANNEL_MOCK, mockDelay, mockError } from "@/mocks/mockHelpers";
import { kenhBanHangMock } from "@/mocks/kenhBanHangMock";

/**
 * Kênh bán hàng — gọi KenhBanHangController (/api/v1/kenh-ban-hang).
 * Mỗi sàn dùng mã kênh (SHOPIFY…) trên đường dẫn. Hiện chỉ Shopify có API thật.
 * Bật VITE_CHANNEL_MOCK=true để chạy bằng dữ liệu mẫu (mocks/kenhBanHangMock.js).
 */
const BASE = "/api/v1/kenh-ban-hang";
const data = (res) => res.data?.data;
const ma = (maKenh) => encodeURIComponent(String(maKenh || "SHOPIFY").toUpperCase());

/**
 * Trạng thái liên kết dùng ở giao diện ↔ giá trị lưu trong bảng trang_thai_dong_bo_san_pham.
 * Mỗi dòng liên kết luôn gắn một biến thể FCentric; "chua_lien_ket" nghĩa là đang ngừng đồng bộ dòng đó.
 */
const TRANG_THAI_DB = { da_lien_ket: "thanh_cong", chua_lien_ket: "chua_dong_bo", loi: "that_bai" };

function chuanHoaLienKet(row) {
  if (!row) return row;
  const trangThai = row.trangThaiLienKet === "that_bai" ? "loi" : row.trangThaiLienKet;
  return {
    ...row,
    trangThaiLienKet: trangThai || "chua_lien_ket",
    soLuongKhaDung: row.soLuongKhaDung ?? row.khaDung ?? null,
    // Số Shopify đã nhận ở lần đẩy thành công gần nhất; null = chưa đẩy lần nào
    soLuongDaDay: row.soLuongDaDay ?? null,
    ngayDayTonCuoi: row.ngayDayTonCuoi ?? row.ngayDayCuoi ?? null,
    sanPhamId: row.sanPhamId ?? null,
    anhDaiDien: row.anhDaiDien ?? null,
  };
}

const realApi = {
  // ── Kết nối gian hàng (chỉ quản trị viên) ──
  getShopifyConfig: () => apiClient.get(`${BASE}/shopify`).then(data),
  updateShopifyConfig: (payload) => apiClient.put(`${BASE}/shopify`, payload).then(data),
  testShopifyConnection: (payload) => apiClient.post(`${BASE}/shopify/test-connection`, payload).then(data),
  refreshShopifyToken: () => apiClient.post(`${BASE}/shopify/refresh-token`).then(data),

  // ── Cấu hình đồng bộ theo kênh ──
  getCauHinhDongBo: (maKenh) => apiClient.get(`${BASE}/${ma(maKenh)}/cau-hinh-dong-bo`).then(data),
  luuCauHinhDongBo: (maKenh, payload) => apiClient.put(`${BASE}/${ma(maKenh)}/cau-hinh-dong-bo`, payload).then(data),

  // ── Số liệu ──
  getTongQuan: (maKenh) => apiClient.get(`${BASE}/${ma(maKenh)}/tong-quan`).then(data),
  /** Đơn của kênh theo ngày trong [tu, den] (yyyy-MM-dd, tối đa 92 ngày) và số đơn theo trạng thái. */
  getThongKeDon: (maKenh, { tu, den } = {}) =>
    apiClient.get(`${BASE}/${ma(maKenh)}/thong-ke-don`, { params: { tu, den } }).then(data),
  getKhoSan: (maKenh) => apiClient.get(`${BASE}/${ma(maKenh)}/locations`).then(data),

  // ── Sản phẩm ──
  taiSanPham: (maKenh) => apiClient.post(`${BASE}/${ma(maKenh)}/tai-san-pham`).then(data),
  dayVaLienKetSanPham: (maKenh) => apiClient.post(`${BASE}/${ma(maKenh)}/tu-dong-lien-ket`).then(data),
  filterLienKet: (maKenh, { page = 0, size = 20, search, trangThai } = {}) => {
    const params = { page, size };
    if (search?.trim()) params.search = search.trim();
    if (trangThai) params.trangThai = TRANG_THAI_DB[trangThai] ?? trangThai;
    return apiClient
      .get(`${BASE}/${ma(maKenh)}/lien-ket`, { params })
      .then(data)
      .then((page) => ({ ...page, content: (page?.content ?? []).map(chuanHoaLienKet) }));
  },
  capNhatLienKet: (lienKetId, payload) =>
    apiClient.put(`${BASE}/lien-ket/${lienKetId}`, payload).then(data).then(chuanHoaLienKet),
  thuLaiLienKet: (lienKetId) => apiClient.post(`${BASE}/lien-ket/${lienKetId}/thu-lai`).then(data).then(chuanHoaLienKet),
  timBienThe: (q = "", limit = 20) =>
    apiClient.get(`${BASE}/bien-the/tim-kiem`, { params: { q, limit } }).then(data),

  // ── Tồn kho và đơn hàng ──
  dayTon: (maKenh, payload = {}) => apiClient.post(`${BASE}/${ma(maKenh)}/day-ton`, payload).then(data),
  layDon: (maKenh, { tu, den } = {}) => apiClient.post(`${BASE}/${ma(maKenh)}/lay-don`, { tu, den }).then(data),
};

// ── Dữ liệu mẫu: dựng lại đúng hình dạng API thật từ kenhBanHangMock ──
const MOCK_KET_NOI_ID = 10;
const mockCauHinh = {
  tuDongDayTon: true,
  tuDongLayDon: true,
  tyLeDayTon: 100,
  tonDem: 0,
  nguongVe0: 0,
  daLuu: false,
  daLuuTonKho: false,
  daLuuDonHang: false,
};

const PHAN_TON_KHO = ["tuDongDayTon", "tyLeDayTon", "tonDem", "nguongVe0"];

/** Số liệu đơn mẫu: cố định theo ngày để mỗi lần tải ra cùng một biểu đồ. */
function mockThongKeDon(tu, den) {
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const homNay = new Date();
  const ngayDen = den ? new Date(`${den}T00:00:00`) : new Date(homNay.getFullYear(), homNay.getMonth(), homNay.getDate());
  const ngayTu = tu ? new Date(`${tu}T00:00:00`) : new Date(ngayDen.getTime() - 29 * 86_400_000);
  const theoNgay = [];
  for (let d = new Date(ngayTu); d <= ngayDen; d.setDate(d.getDate() + 1)) {
    const hat = (d.getDate() * 7 + d.getMonth() * 3) % 11;
    const soDon = hat % 4 === 0 ? 0 : (hat % 5) + 1;
    const soHuy = soDon > 3 ? 1 : 0;
    theoNgay.push({ ngay: iso(d), soDon, soHuy, doanhSo: (soDon - soHuy) * (320000 + hat * 15000) });
  }
  const tongDon = theoNgay.reduce((s, n) => s + n.soDon, 0);
  const donHuy = theoNgay.reduce((s, n) => s + n.soHuy, 0);
  return {
    maKenh: "SHOPIFY",
    tu: iso(ngayTu),
    den: iso(ngayDen),
    tongDon,
    donHuy,
    doanhSo: theoNgay.reduce((s, n) => s + n.doanhSo, 0),
    tyLeHuy: tongDon ? Math.round((donHuy * 1000) / tongDon) / 10 : 0,
    theoNgay,
    theoTrangThai: { 0: 2, 1: 3, 7: 1, 8: 0, 3: 4, 5: 18, 4: donHuy },
  };
}

async function mockTatCaLienKet() {
  const page = await kenhBanHangMock.filterLienKet(MOCK_KET_NOI_ID, { page: 0, size: 1000 });
  return page.content ?? [];
}

const mockApi = {
  getShopifyConfig: kenhBanHangMock.getShopifyConfig,
  updateShopifyConfig: kenhBanHangMock.updateShopifyConfig,
  testShopifyConnection: kenhBanHangMock.testShopifyConnection,
  refreshShopifyToken: kenhBanHangMock.refreshShopifyToken,

  async getCauHinhDongBo(maKenh) {
    await mockDelay();
    return { maKenh: String(maKenh).toUpperCase(), ...mockCauHinh, chuKyPhut: 10, nguongDayNgay: 3 };
  },
  async luuCauHinhDongBo(maKenh, payload = {}) {
    await mockDelay(300, 500);
    const tyLe = payload.tyLeDayTon;
    if (tyLe != null && (tyLe < 1 || tyLe > 100)) throw mockError(400, "Tỷ lệ đẩy tồn phải từ 1 đến 100%");
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== null && value !== undefined && key in mockCauHinh) mockCauHinh[key] = value;
    });
    mockCauHinh.daLuu = true;
    if (PHAN_TON_KHO.some((key) => payload[key] != null)) mockCauHinh.daLuuTonKho = true;
    if (payload.tuDongLayDon != null) mockCauHinh.daLuuDonHang = true;
    return mockApi.getCauHinhDongBo(maKenh);
  },

  async getTongQuan() {
    const [links, tq] = await Promise.all([mockTatCaLienKet(), kenhBanHangMock.tongQuan()]);
    const kn = tq.ketNois?.[0] ?? {};
    const daLienKet = links.filter((l) => l.trangThaiLienKet === "da_lien_ket").length;
    const loi = links.filter((l) => l.trangThaiLienKet === "loi").length;
    return {
      tongSkuSan: links.length,
      daLienKet,
      loiDongBo: loi,
      chuaLienKet: Math.max(0, links.length - daLienKet - loi),
      chuKyDongBoTonPhut: 10,
      chuKyLayDonPhut: 10,
      lanDayTonCuoi: kn.lanDayTonCuoi ?? null,
      lanLayDonCuoi: kn.lanLayDonCuoi ?? null,
    };
  },
  getKhoSan: () => kenhBanHangMock.getKhoSan(MOCK_KET_NOI_ID),
  async getThongKeDon(_maKenh, { tu, den } = {}) {
    await mockDelay();
    return mockThongKeDon(tu, den);
  },

  async taiSanPham() {
    const res = await kenhBanHangMock.taiSanPham(MOCK_KET_NOI_ID);
    return { soSku: res.soSku, soMoi: res.soMoi, soCapNhat: res.soCapNhat };
  },
  async dayVaLienKetSanPham() {
    const res = await kenhBanHangMock.tuDongLienKet(MOCK_KET_NOI_ID);
    return { soDaGhep: res.soDaGhep, soTaoMoiTrenShopify: 0, soCapNhatTrenShopify: 0, soTonKhoDaDay: res.soDaGhep, soAnhDaDay: 0, soThatBai: res.soKhongKhop };
  },
  async filterLienKet(_maKenh, { page = 0, size = 20, search, trangThai } = {}) {
    const res = await kenhBanHangMock.filterLienKet(MOCK_KET_NOI_ID, { page, size, search, trangThaiLienKet: trangThai || undefined });
    // Dữ liệu mẫu không có tên sản phẩm FCentric: dùng tên trên sàn để gom nhóm như dữ liệu thật
    return {
      ...res,
      content: (res.content ?? []).map((row) =>
        chuanHoaLienKet({ ...row, tenSanPham: row.tenSanPham ?? row.tenSanPhamSan, tenBienThe: row.tenBienTheSan ?? row.tenBienThe }),
      ),
    };
  },
  capNhatLienKet: (lienKetId, payload) => kenhBanHangMock.capNhatLienKet(lienKetId, payload).then(chuanHoaLienKet),
  async thuLaiLienKet(lienKetId) {
    await mockDelay();
    const links = await mockTatCaLienKet();
    return chuanHoaLienKet(links.find((l) => l.id === Number(lienKetId)));
  },
  timBienThe: kenhBanHangMock.timBienThe,

  async dayTon(_maKenh, quyTac) {
    const res = await kenhBanHangMock.dayTon(MOCK_KET_NOI_ID, quyTac);
    return { soDong: res.soDong, soLoi: 0, soChuaDay: 0, loiKenh: null };
  },
  async layDon(_maKenh, range) {
    const res = await kenhBanHangMock.layDon(MOCK_KET_NOI_ID, range);
    return { soDonMoi: res.soSuKien ?? 0, soDonCapNhat: 0, thongDiep: `Nhận ${res.soSuKien ?? 0} đơn hàng mới` };
  },
};

export const kenhBanHangService = CHANNEL_MOCK ? mockApi : realApi;

/** true khi đang chạy dữ liệu mẫu (VITE_CHANNEL_MOCK=true). */
export const isChannelMock = CHANNEL_MOCK;
