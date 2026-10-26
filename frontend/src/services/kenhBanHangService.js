import apiClient from "./apiClient";
import { CHANNEL_MOCK, mockDelay, mockError } from "@/mocks/mockHelpers";
import { kenhBanHangMock, loiCoMa } from "@/mocks/kenhBanHangMock";
import { kenhSanMock } from "@/mocks/kenhSanMock";
import { demYeuCauHuy } from "@/mocks/donBanHangKenhMock";
import { chuanHoaNhom, phanTrangTheoSanPham } from "@/components/channel/nhomLienKet";
import { daKetNoi } from "@/components/channel/ketNoiKenh";
import { CHANNELS, SAN_BAN_HANG, timSan } from "@/constants/channel";

/**
 * Kênh bán hàng — gọi KenhBanHangController (/api/v1/kenh-ban-hang).
 * Mỗi sàn dùng mã kênh (SHOPIFY, LAZADA, TIKTOK) trên đường dẫn; hợp đồng ở docs/omnichannel/KE-HOACH-LAZADA-TIKTOK.md mục C.
 * Bật VITE_CHANNEL_MOCK=true để chạy bằng dữ liệu mẫu (mocks/kenhBanHangMock.js, mocks/kenhSanMock.js).
 */
const BASE = "/api/v1/kenh-ban-hang";
const data = (res) => res.data?.data;
const ma = (maKenh) => encodeURIComponent(String(maKenh || "SHOPIFY").toUpperCase());
const laShopify = (maKenh) => String(maKenh || "SHOPIFY").toUpperCase() === "SHOPIFY";

/**
 * Máy chủ chưa có API kết nối theo sàn (trước KH Phần 2): 405, hoặc 404 "Không tìm thấy API" của
 * RestControllerGlobalExceptionHandler. 404 khác (vd. không tìm thấy kênh) vẫn là lỗi thật.
 */
function laApiChuaCo(error) {
  const status = error?.response?.status;
  if (status === 405) return true;
  return status === 404 && /^Không tìm thấy API/.test(String(error?.response?.data?.message ?? ""));
}

/** Đổi lỗi "API chưa có" thành câu dùng được trên giao diện; lỗi khác giữ nguyên. `viec`: việc máy chủ chưa làm được. */
function baoApiChuaCo(maKenh, viec = "kết nối") {
  return (error) => {
    if (!laApiChuaCo(error)) throw error;
    const tenSan = timSan(maKenh)?.ten ?? "sàn này";
    const loi = new Error(`Máy chủ chưa hỗ trợ ${viec} ${tenSan}. Cập nhật máy chủ rồi thử lại.`);
    loi.response = { status: error.response.status, data: { message: loi.message, data: null } };
    throw loi;
  };
}

/** Kết nối của một sàn ủy quyền khi máy chủ chưa có API kết nối: coi như chưa kết nối. */
function chuaKetNoi(maKenh) {
  const san = timSan(maKenh);
  return { maKenh: san?.maKenh ?? String(maKenh).toUpperCase(), kieuKetNoi: san?.kieuKetNoi ?? "uy_quyen", trangThai: 1, trangThaiKetNoi: "chua_ket_noi" };
}

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
  /**
   * Lưu khóa Shopify bằng PUT /SHOPIFY/ket-noi/khoa (KH mục C.1, trả KetNoiKenhDto có trangThaiKetNoi);
   * máy chủ chưa có API đó (trước KH Phần 2) thì PUT /shopify như trước. Lần gửi đầu bị 404/405 là máy chủ chưa
   * ghi gì, nên gửi lại không ghi hai lần.
   */
  updateShopifyConfig: (payload) =>
    apiClient
      .put(`${BASE}/SHOPIFY/ket-noi/khoa`, payload)
      .then(data)
      .catch((error) => {
        if (!laApiChuaCo(error)) throw error;
        return apiClient.put(`${BASE}/shopify`, payload).then(data);
      }),
  testShopifyConnection: (payload) => apiClient.post(`${BASE}/shopify/test-connection`, payload).then(data),
  /** Cấp lại khóa: POST /SHOPIFY/lam-moi-token (KetNoiKenhDto); máy chủ chưa có thì POST /shopify/refresh-token như trước. */
  refreshShopifyToken: () =>
    apiClient
      .post(`${BASE}/SHOPIFY/lam-moi-token`)
      .then(data)
      .catch((error) => {
        if (!laApiChuaCo(error)) throw error;
        return apiClient.post(`${BASE}/shopify/refresh-token`).then(data);
      }),

  // ── Kết nối theo sàn (KH mục C.1). Máy chủ chưa có API kết nối chung thì Shopify đọc GET /shopify như trước ──
  /**
   * Gian hàng đã kết nối, cho menu bên trái. Mỗi phần tử có ít nhất { maKenh, trangThaiKetNoi, trangThai }.
   * Máy chủ chưa có GET gốc (trước KH Phần 2) thì cũng chưa có API kết nối Lazada / TikTok Shop: chỉ đọc Shopify.
   * Lỗi thật (mạng, 5xx) ném ra để menu giữ danh sách cũ.
   */
  getDanhSachKetNoi: () =>
    apiClient
      .get(BASE)
      .then(data)
      .catch(async (error) => {
        if (!laApiChuaCo(error)) throw error;
        const shopify = await realApi.getKetNoi("SHOPIFY");
        return daKetNoi(shopify) ? [shopify] : [];
      })
      .then((ds) => (Array.isArray(ds) ? ds : [])),
  /**
   * KetNoiKenhDto (KH mục C.3). Máy chủ chưa có API này: Shopify đọc GET /shopify (không có trangThaiKetNoi, các hàm
   * ở ketNoiKenh.js vẫn đọc được và biết máy chủ chưa ngắt kết nối được); sàn ủy quyền coi như chưa kết nối.
   */
  getKetNoi: (maKenh) =>
    apiClient
      .get(`${BASE}/${ma(maKenh)}/ket-noi`)
      .then(data)
      .catch((error) => {
        if (!laApiChuaCo(error)) throw error;
        return laShopify(maKenh)
          ? realApi.getShopifyConfig().then((cfg) => ({ ...cfg, maKenh: "SHOPIFY", kieuKetNoi: "khoa" }))
          : chuaKetNoi(maKenh);
      }),
  /** Sàn ủy quyền: { appKey?, appSecret?, serviceId?, trangThai? } — khóa rỗng = giữ khóa cũ. */
  luuKhoaUngDung: (maKenh, payload) => apiClient.put(`${BASE}/${ma(maKenh)}/ket-noi/khoa`, payload).then(data).catch(baoApiChuaCo(maKenh)),
  /** { authUrl }: trang đồng ý của sàn; lỗi 400 THIEU_KHOA_UNG_DUNG khi chưa có khóa ứng dụng. */
  batDauUyQuyen: (maKenh, redirectUri) =>
    apiClient.post(`${BASE}/${ma(maKenh)}/uy-quyen`, null, { params: redirectUri ? { redirectUri } : {} })
      .then(data)
      .catch(baoApiChuaCo(maKenh)),
  /** { authUrl }: đường dẫn ủy quyền riêng của Lazada Open Platform */
  getLazadaAuthUrl: (redirectUri) =>
    apiClient.get(`${BASE}/lazada/auth-url`, { params: redirectUri ? { redirectUri } : {} })
      .then(data)
      .catch(() => apiClient.post(`${BASE}/LAZADA/uy-quyen`, null, { params: redirectUri ? { redirectUri } : {} }).then(data)),
  /** { code, state } từ trang quay về; state null = mã nhập tay của tài khoản thử. */
  hoanTatUyQuyen: (maKenh, { code, state } = {}) =>
    apiClient.post(`${BASE}/${ma(maKenh)}/uy-quyen/hoan-tat`, { code, state: state ?? null }).then(data).catch(baoApiChuaCo(maKenh)),
  /** { connected, message, tenGianHang, shopIdSan, hanKhoa } */
  kiemTraKetNoi: (maKenh) => apiClient.post(`${BASE}/${ma(maKenh)}/kiem-tra-ket-noi`, {}).then(data).catch(baoApiChuaCo(maKenh)),
  lamMoiToken: (maKenh) => apiClient.post(`${BASE}/${ma(maKenh)}/lam-moi-token`).then(data).catch(baoApiChuaCo(maKenh)),
  /** Mọi sàn, kể cả Shopify: xóa khóa đã lưu, dừng đồng bộ; giữ liên kết sản phẩm và đơn đã nhận (KH mục C.1). */
  ngatKetNoi: (maKenh) => apiClient.delete(`${BASE}/${ma(maKenh)}/ket-noi`).then(data).catch(baoApiChuaCo(maKenh, "ngắt kết nối")),
  /** Kho trên sàn nhận số tồn: { maKhoSan, tenKhoSan } (KenhBanHangCaiDatRequest). */
  luuCaiDatKenh: (maKenh, payload) => apiClient.put(`${BASE}/${ma(maKenh)}/cai-dat`, payload).then(data).catch(baoApiChuaCo(maKenh)),

  // ── Cấu hình đồng bộ theo kênh ──
  getCauHinhDongBo: (maKenh) => apiClient.get(`${BASE}/${ma(maKenh)}/cau-hinh-dong-bo`).then(data),
  luuCauHinhDongBo: (maKenh, payload) => apiClient.put(`${BASE}/${ma(maKenh)}/cau-hinh-dong-bo`, payload).then(data),

  // ── Số liệu ──
  getTongQuan: (maKenh) => apiClient.get(`${BASE}/${ma(maKenh)}/tong-quan`).then(data),
  /** Đơn của kênh theo ngày trong [tu, den] (yyyy-MM-dd, tối đa 92 ngày) và số đơn theo trạng thái. */
  getThongKeDon: (maKenh, { tu, den } = {}) =>
    apiClient.get(`${BASE}/${ma(maKenh)}/thong-ke-don`, { params: { tu, den } }).then(data),
  /**
   * Kho trên sàn nhận số tồn: GET /{maKenh}/kho-san (KH mục C.1). Máy chủ chưa có thì GET /{maKenh}/locations như
   * trước; endpoint cũ chỉ đọc địa điểm Shopify nên sàn khác bỏ các địa điểm Shopify (gid://shopify/…), không coi là
   * kho của sàn.
   */
  getKhoSan: (maKenh) =>
    apiClient
      .get(`${BASE}/${ma(maKenh)}/kho-san`)
      .then(data)
      .catch((error) => {
        if (!laApiChuaCo(error)) throw error;
        return apiClient
          .get(`${BASE}/${ma(maKenh)}/locations`)
          .then(data)
          .then((ds) => {
            const dsKho = Array.isArray(ds) ? ds : [];
            return laShopify(maKenh) ? dsKho : dsKho.filter((k) => !String(k?.maKhoSan ?? "").startsWith("gid://shopify/"));
          });
      }),

  // ── Sản phẩm ──
  taiSanPham: (maKenh) => apiClient.post(`${BASE}/${ma(maKenh)}/tai-san-pham`).then(data),
  dayVaLienKetSanPham: (maKenh) => apiClient.post(`${BASE}/${ma(maKenh)}/tu-dong-lien-ket`).then(data),
  /**
   * Liên kết của kênh, phân trang theo sản phẩm: mỗi phần tử là một sản phẩm kèm đủ SKU khớp bộ lọc
   * (không bị cắt sang trang khác). `size` là số sản phẩm mỗi trang, `totalElements` là số sản phẩm,
   * `tongSku` là tổng SKU khớp bộ lọc trên mọi trang.
   */
  filterLienKetTheoSanPham: (maKenh, { page = 0, size = 20, search, trangThai } = {}) => {
    const params = { page, size };
    if (search?.trim()) params.search = search.trim();
    if (trangThai) params.trangThai = TRANG_THAI_DB[trangThai] ?? trangThai;
    return apiClient
      .get(`${BASE}/${ma(maKenh)}/lien-ket/theo-san-pham`, { params })
      .then(data)
      .then((trang) => ({ ...trang, content: (trang?.content ?? []).map((nhom) => chuanHoaNhom(nhom, chuanHoaLienKet)) }));
  },
  capNhatLienKet: (lienKetId, payload) =>
    apiClient.put(`${BASE}/lien-ket/${lienKetId}`, payload).then(data).then(chuanHoaLienKet),
  thuLaiLienKet: (lienKetId) => apiClient.post(`${BASE}/lien-ket/${lienKetId}/thu-lai`).then(data).then(chuanHoaLienKet),
  timBienThe: (q = "", limit = 20) =>
    apiClient.get(`${BASE}/bien-the/tim-kiem`, { params: { q, limit } }).then(data),

  // ── Tồn kho và đơn hàng ──
  dayTon: (maKenh, payload = {}) => apiClient.post(`${BASE}/${ma(maKenh)}/day-ton`, payload).then(data),
  layDon: (maKenh, { tu, den } = {}) => apiClient.post(`${BASE}/${ma(maKenh)}/lay-don`, { tu, den }).then(data),

  // ── Đồng bộ ngay: máy chủ chạy nền (đẩy tồn theo quy tắc đã lưu rồi lấy đơn 24 giờ qua), trang hỏi tiến độ ──
  batDauDongBoNgay: (maKenh) => apiClient.post(`${BASE}/${ma(maKenh)}/dong-bo-ngay`).then(data),
  /** Đợt gần nhất của kênh; null nếu chưa có đợt nào từ khi máy chủ khởi động. */
  layDongBoNgay: (maKenh) => apiClient.get(`${BASE}/${ma(maKenh)}/dong-bo-ngay`).then(data),
  dungDongBoNgay: (maKenh) => apiClient.post(`${BASE}/${ma(maKenh)}/dong-bo-ngay/dung`).then(data),
};

// ── Dữ liệu mẫu: dựng lại đúng hình dạng API thật từ kenhBanHangMock / kenhSanMock ──
/** Kết nối mẫu của từng sàn trong kenhBanHangMock: 10 Shopify, 20 Lazada, 30 TikTok Shop. */
const MOCK_KET_NOI_ID = { SHOPIFY: 10, LAZADA: 20, TIKTOK: 30 };
const idKetNoi = (maKenh) => MOCK_KET_NOI_ID[String(maKenh || "SHOPIFY").toUpperCase()] ?? MOCK_KET_NOI_ID.SHOPIFY;
const maMau = (maKenh) => String(maKenh || "SHOPIFY").toUpperCase();

const cauHinhMau = (daLuu, tuDong = true) => ({
  tuDongDayTon: tuDong,
  tuDongLayDon: tuDong,
  tyLeDayTon: 100,
  tonDem: 0,
  nguongVe0: 0,
  daLuu,
  daLuuTonKho: daLuu,
  daLuuDonHang: daLuu,
});
// Shopify như trước (chưa lưu, chỉ trong bộ nhớ). Lazada, TikTok Shop mẫu đã thiết lập xong, trừ tình huống
// "chua_ket_noi" (kenhSanMock) để thử lần thiết lập đầu; lưu sessionStorage như kenhSanMock vì ủy quyền chuyển cả trang
const KHOA_CAU_HINH_MAU = "fc:mock-kenh:cau-hinh";
function docSessionMau(khoa) {
  try {
    return JSON.parse(window.sessionStorage.getItem(khoa) ?? "null");
  } catch {
    return null;
  }
}
const daThietLapMau = (ma) => docSessionMau("fc:mock-kenh:tinh-huong")?.[ma] !== "chua_ket_noi";
// Chưa thiết lập: như máy chủ sau lần ủy quyền đầu (KH mục C.1) — tự động tạm tắt, daLuu vẫn false
const cauHinhSanMau = (ma) => (daThietLapMau(ma) ? cauHinhMau(true) : cauHinhMau(false, false));
const mockCauHinh = {
  SHOPIFY: cauHinhMau(false),
  LAZADA: cauHinhSanMau("LAZADA"),
  TIKTOK: cauHinhSanMau("TIKTOK"),
  ...docSessionMau(KHOA_CAU_HINH_MAU),
};
const cauHinhCua = (maKenh) => mockCauHinh[maMau(maKenh)] ?? mockCauHinh.SHOPIFY;
function luuCauHinhMau() {
  try {
    window.sessionStorage.setItem(KHOA_CAU_HINH_MAU, JSON.stringify({ LAZADA: mockCauHinh.LAZADA, TIKTOK: mockCauHinh.TIKTOK }));
  } catch {
    // Trình duyệt chặn lưu: cấu hình mẫu chỉ còn trong bộ nhớ
  }
}

const PHAN_TON_KHO = ["tuDongDayTon", "tyLeDayTon", "tonDem", "nguongVe0"];

/** Số liệu đơn mẫu: cố định theo ngày (lệch theo sàn) để mỗi lần tải ra cùng một biểu đồ. */
function mockThongKeDon(maKenh, tu, den) {
  const lech = { SHOPIFY: 0, LAZADA: 3, TIKTOK: 7 }[maMau(maKenh)] ?? 0;
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const homNay = new Date();
  const ngayDen = den ? new Date(`${den}T00:00:00`) : new Date(homNay.getFullYear(), homNay.getMonth(), homNay.getDate());
  const ngayTu = tu ? new Date(`${tu}T00:00:00`) : new Date(ngayDen.getTime() - 29 * 86_400_000);
  const theoNgay = [];
  for (let d = new Date(ngayTu); d <= ngayDen; d.setDate(d.getDate() + 1)) {
    const hat = (d.getDate() * 7 + d.getMonth() * 3 + lech) % 11;
    const soDon = hat % 4 === 0 ? 0 : (hat % 5) + 1;
    const soHuy = soDon > 3 ? 1 : 0;
    theoNgay.push({ ngay: iso(d), soDon, soHuy, doanhSo: (soDon - soHuy) * (320000 + hat * 15000) });
  }
  const tongDon = theoNgay.reduce((s, n) => s + n.soDon, 0);
  const donHuy = theoNgay.reduce((s, n) => s + n.soHuy, 0);
  return {
    maKenh: maMau(maKenh),
    tu: iso(ngayTu),
    den: iso(ngayDen),
    tongDon,
    donHuy,
    doanhSo: theoNgay.reduce((s, n) => s + n.doanhSo, 0),
    tyLeHuy: tongDon ? Math.round((donHuy * 1000) / tongDon) / 10 : 0,
    theoNgay,
    theoTrangThai: lech ? { 0: 2, 1: 2, 7: 1, 8: 1, 3: 1, 5: 12, 4: donHuy } : { 0: 2, 1: 3, 7: 1, 8: 0, 3: 4, 5: 18, 4: donHuy },
  };
}

/** Đồng bộ ngay mẫu: tiến độ tính theo đồng hồ, cùng hình dạng DongBoNgayDto của máy chủ; mỗi sàn một đợt. */
const MOCK_DONG_BO = { tongSku: 12, docSanPhamMs: 1200, moiSkuMs: 600, layDonMs: 1500 };
const mockPhienDongBo = {};

function mockChupDongBo(maKenh) {
  const p = mockPhienDongBo[maMau(maKenh)];
  if (!p) return null;
  const { docSanPhamMs, moiSkuMs, layDonMs } = MOCK_DONG_BO;
  const tongSku = maMau(maKenh) === "SHOPIFY" ? MOCK_DONG_BO.tongSku : 10;
  const daChayMs = (p.dungLuc ?? Date.now()) - p.batDauLuc;
  const daXuLy = Math.max(0, Math.min(tongSku, Math.floor((daChayMs - docSanPhamMs) / moiSkuMs)));
  const xong = !p.dungLuc && daChayMs >= docSanPhamMs + tongSku * moiSkuMs + layDonMs;
  const giaiDoan = daChayMs < docSanPhamMs ? "doc_san_pham" : daXuLy < tongSku ? "day_ton" : "lay_don";
  const trangThai = p.dungLuc ? "da_dung" : xong ? "xong" : "dang_chay";
  return {
    maPhien: p.maPhien,
    maKenh: maMau(maKenh),
    trangThai,
    giaiDoan,
    tongSku: giaiDoan === "doc_san_pham" ? null : tongSku,
    daXuLy,
    soThanhCong: daXuLy,
    soLoi: 0,
    soChuaDay: trangThai === "dang_chay" ? null : tongSku - daXuLy,
    skuDangDay: trangThai === "dang_chay" && giaiDoan === "day_ton" ? `MAU-${String(daXuLy + 1).padStart(3, "0")}` : null,
    soDonMoi: xong ? 2 : null,
    loi: null,
    yeuCauDung: Boolean(p.dungLuc),
    nguoiBam: "Dữ liệu mẫu",
    batDau: new Date(p.batDauLuc).toISOString(),
    ketThuc: trangThai === "dang_chay" ? null : new Date(p.batDauLuc + daChayMs).toISOString(),
    daChayMs,
    dayTonDaChayMs: daChayMs < docSanPhamMs ? null : Math.min(daChayMs - docSanPhamMs, tongSku * moiSkuMs),
    dsLoi: [],
  };
}

/**
 * Cấu hình Shopify mẫu theo hình dạng KetNoiKenhDto của máy chủ đã có KH Phần 2 (có trangThaiKetNoi). Như máy chủ: có
 * khóa làm mới thì khóa quá hạn vẫn đang hoạt động (máy chủ tự làm mới khi dùng), trừ khi Shopify đã từ chối khóa làm
 * mới và khóa truy cập còn dưới 5 phút.
 */
function ketNoiShopifyMau(cfg) {
  const sapHet = cfg?.secondsUntilExpiration != null && cfg.secondsUntilExpiration < 300;
  const trangThaiKetNoi = !(cfg?.hasAccessToken && cfg?.shopDomain)
    ? "chua_ket_noi"
    : (cfg.tokenExpired && !cfg.hasRefreshToken) || (cfg._khoaLamMoiBiTuChoi && cfg.hasRefreshToken && sapHet)
      ? "het_han"
      : "dang_hoat_dong";
  return { ...cfg, maKenh: "SHOPIFY", kieuKetNoi: "khoa", trangThaiKetNoi };
}

/**
 * Như máy chủ (KenhBanHangDongBoServiceImpl.kiemTraDaKetNoi): việc cần khóa truy cập (tải sản phẩm, ghép, đẩy tồn,
 * lấy đơn, thử lại, đồng bộ ngay) mà kênh đã ngắt ở thẻ khác thì báo 409 KENH_CHUA_KET_NOI.
 */
async function mockKiemTraDaKetNoi(maKenh) {
  const dto = await mockApi.getKetNoi(maKenh);
  if (dto?.trangThaiKetNoi === "chua_ket_noi") {
    throw loiCoMa(409, "KENH_CHUA_KET_NOI", `${timSan(maKenh)?.ten ?? "Sàn này"} chưa kết nối. Kết nối lại ở trình thiết lập rồi thử lại.`);
  }
  // Shopify: đọc khóa như máy chủ (tự làm mới; khóa làm mới đã bị từ chối và khóa truy cập quá hạn thì 424)
  if (laShopify(maKenh)) kenhBanHangMock.docKhoaShopify();
}

async function mockTatCaLienKet(maKenh) {
  const page = await kenhBanHangMock.filterLienKet(idKetNoi(maKenh), { page: 0, size: 1000 });
  return page.content ?? [];
}

const mockApi = {
  getShopifyConfig: kenhBanHangMock.getShopifyConfig,
  updateShopifyConfig: (payload) => kenhBanHangMock.updateShopifyConfig(payload).then(ketNoiShopifyMau),
  testShopifyConnection: kenhBanHangMock.testShopifyConnection,
  refreshShopifyToken: () => kenhBanHangMock.refreshShopifyToken().then(ketNoiShopifyMau),

  async getDanhSachKetNoi() {
    const ds = await Promise.all(SAN_BAN_HANG.filter((s) => s.hoTro).map((s) => mockApi.getKetNoi(s.maKenh)));
    return ds.filter((dto) => daKetNoi(dto));
  },
  getKetNoi: (maKenh) => (laShopify(maKenh) ? kenhBanHangMock.getShopifyConfig().then(ketNoiShopifyMau) : kenhSanMock.getKetNoi(maKenh)),
  luuKhoaUngDung: (maKenh, payload) => kenhSanMock.luuKhoa(maKenh, payload),
  batDauUyQuyen: (maKenh) => kenhSanMock.batDauUyQuyen(maKenh),
  hoanTatUyQuyen: (maKenh, payload) => kenhSanMock.hoanTatUyQuyen(maKenh, payload),
  kiemTraKetNoi: (maKenh) => kenhSanMock.kiemTraKetNoi(maKenh),
  lamMoiToken: (maKenh) => kenhSanMock.lamMoiToken(maKenh),
  async ngatKetNoi(maKenh) {
    // Như máy chủ (NgatKetNoiKenhService): đang đồng bộ thì không ngắt; ngắt xong đặt trạng thái 0 (job bỏ qua kênh),
    // không đụng công tắc tự động đẩy tồn, lấy đơn của người dùng
    if (mockChupDongBo(maKenh)?.trangThai === "dang_chay") {
      await mockDelay(150, 300);
      throw loiCoMa(409, "DANG_DONG_BO", `Đang đồng bộ với ${timSan(maKenh)?.ten ?? "sàn này"}. Đợi lượt này xong rồi ngắt kết nối.`);
    }
    return laShopify(maKenh) ? ketNoiShopifyMau(await kenhBanHangMock.ngatKetNoiShopify()) : kenhSanMock.ngatKetNoi(maKenh);
  },
  luuCaiDatKenh: (maKenh, payload) => kenhSanMock.luuCaiDat(maKenh, payload),

  async getCauHinhDongBo(maKenh) {
    await mockDelay();
    return { maKenh: maMau(maKenh), ...cauHinhCua(maKenh), chuKyPhut: 10, nguongDayNgay: 3 };
  },
  async luuCauHinhDongBo(maKenh, payload = {}) {
    await mockDelay(300, 500);
    const tyLe = payload.tyLeDayTon;
    if (tyLe != null && (tyLe < 1 || tyLe > 100)) throw mockError(400, "Tỷ lệ đẩy tồn phải từ 1 đến 100%");
    const cauHinh = cauHinhCua(maKenh);
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== null && value !== undefined && key in cauHinh) cauHinh[key] = value;
    });
    cauHinh.daLuu = true;
    if (PHAN_TON_KHO.some((key) => payload[key] != null)) cauHinh.daLuuTonKho = true;
    if (payload.tuDongLayDon != null) cauHinh.daLuuDonHang = true;
    luuCauHinhMau();
    return mockApi.getCauHinhDongBo(maKenh);
  },

  async getTongQuan(maKenh) {
    const [links, tq] = await Promise.all([mockTatCaLienKet(maKenh), kenhBanHangMock.tongQuan()]);
    const kn = tq.ketNois?.find((k) => k.id === idKetNoi(maKenh)) ?? {};
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
      // Chỉ TikTok Shop có yêu cầu hủy của khách (KH mục B.5)
      ...(maMau(maKenh) === "TIKTOK" ? { soYeuCauHuy: demYeuCauHuy(CHANNELS.TIKTOK.id) } : {}),
    };
  },
  getKhoSan: (maKenh) => (laShopify(maKenh) ? kenhBanHangMock.getKhoSan(idKetNoi(maKenh)) : kenhSanMock.getKhoSan(maKenh)),
  async getThongKeDon(maKenh, { tu, den } = {}) {
    await mockDelay();
    return mockThongKeDon(maKenh, tu, den);
  },

  async taiSanPham(maKenh) {
    await mockKiemTraDaKetNoi(maKenh);
    const res = await kenhBanHangMock.taiSanPham(idKetNoi(maKenh));
    const chung = { soSku: res.soSku, soMoi: res.soMoi, soCapNhat: res.soCapNhat };
    if (laShopify(maKenh)) return chung;
    return { ...chung, soKhongKhop: res.soKhongKhop, skuKhongKhop: res.skuKhongKhop, soNgung: res.soNgung };
  },
  async dayVaLienKetSanPham(maKenh) {
    if (!laShopify(maKenh)) {
      await mockDelay();
      throw mockError(400, "Sàn không hỗ trợ đưa sản phẩm lên từ FCentric");
    }
    await mockKiemTraDaKetNoi(maKenh);
    const res = await kenhBanHangMock.tuDongLienKet(idKetNoi(maKenh));
    return { soDaGhep: res.soDaGhep, soTaoMoiTrenShopify: 0, soCapNhatTrenShopify: 0, soTonKhoDaDay: res.soDaGhep, soAnhDaDay: 0, soThatBai: res.soKhongKhop };
  },
  async filterLienKetTheoSanPham(maKenh, { page = 0, size = 20, search, trangThai } = {}) {
    // Dữ liệu mẫu không có tên sản phẩm FCentric: dùng tên trên sàn để gom nhóm như dữ liệu thật
    const docDong = (res) =>
      (res.content ?? []).map((row) =>
        chuanHoaLienKet({ ...row, tenSanPham: row.tenSanPham ?? row.tenSanPhamSan, tenBienThe: row.tenBienTheSan ?? row.tenBienThe }),
      );
    const TAT_CA = { page: 0, size: 100000 };
    const id = idKetNoi(maKenh);
    const dongKhop = docDong(await kenhBanHangMock.filterLienKet(id, { ...TAT_CA, search, trangThaiLienKet: trangThai || undefined }));
    const tatCaDong = docDong(await kenhBanHangMock.filterLienKet(id, TAT_CA));
    const trang = phanTrangTheoSanPham(dongKhop, tatCaDong, { page, size });
    return { ...trang, content: trang.content.map((nhom) => chuanHoaNhom(nhom)) };
  },
  capNhatLienKet: (lienKetId, payload) => kenhBanHangMock.capNhatLienKet(lienKetId, payload).then(chuanHoaLienKet),
  async thuLaiLienKet(lienKetId) {
    await mockDelay();
    const maKenh = Object.keys(MOCK_KET_NOI_ID).find((k) => Math.floor(Number(lienKetId) / 1000) === MOCK_KET_NOI_ID[k]) ?? "SHOPIFY";
    await mockKiemTraDaKetNoi(maKenh);
    const links = await mockTatCaLienKet(maKenh);
    return chuanHoaLienKet(links.find((l) => l.id === Number(lienKetId)));
  },
  timBienThe: kenhBanHangMock.timBienThe,

  async dayTon(maKenh, quyTac) {
    await mockKiemTraDaKetNoi(maKenh);
    const res = await kenhBanHangMock.dayTon(idKetNoi(maKenh), quyTac);
    return { soDong: res.soDong, soLoi: 0, soChuaDay: 0, loiKenh: null };
  },
  async layDon(maKenh, range) {
    await mockKiemTraDaKetNoi(maKenh);
    const res = await kenhBanHangMock.layDon(idKetNoi(maKenh), range);
    return { soDonMoi: res.soSuKien ?? 0, soDonCapNhat: 0, thongDiep: `Nhận ${res.soSuKien ?? 0} đơn hàng mới` };
  },

  async batDauDongBoNgay(maKenh) {
    await mockDelay(150, 300);
    if (mockChupDongBo(maKenh)?.trangThai !== "dang_chay") {
      await mockKiemTraDaKetNoi(maKenh);
      mockPhienDongBo[maMau(maKenh)] = { maPhien: `mau-${Date.now()}`, batDauLuc: Date.now(), dungLuc: null };
    }
    return mockChupDongBo(maKenh);
  },
  async layDongBoNgay(maKenh) {
    await mockDelay(80, 160);
    return mockChupDongBo(maKenh);
  },
  async dungDongBoNgay(maKenh) {
    await mockDelay(80, 160);
    // Như máy chủ: dừng được khi chưa tới bước lấy đơn
    const hienTai = mockChupDongBo(maKenh);
    if (hienTai?.trangThai === "dang_chay" && hienTai.giaiDoan !== "lay_don") mockPhienDongBo[maMau(maKenh)].dungLuc = Date.now();
    return mockChupDongBo(maKenh);
  },
};

export const kenhBanHangService = CHANNEL_MOCK ? mockApi : realApi;

/** true khi đang chạy dữ liệu mẫu (VITE_CHANNEL_MOCK=true). */
export const isChannelMock = CHANNEL_MOCK;
/** Câu của MockModeNotice ở các trang kênh: kết nối Lazada, TikTok Shop mẫu lưu sessionStorage nên tải lại vẫn còn. */
export const GHI_CHU_DU_LIEU_MAU_KENH =
  "Thao tác chỉ thay đổi dữ liệu trong trình duyệt; kết nối và cấu hình Lazada, TikTok Shop giữ tới khi đóng thẻ, phần còn lại về ban đầu khi tải lại trang.";
