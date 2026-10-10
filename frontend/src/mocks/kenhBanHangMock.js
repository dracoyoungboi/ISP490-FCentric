// Dữ liệu mẫu cho phần Kênh bán hàng, bám đúng hợp đồng docs/omnichannel/API-KENH-BAN-HANG.md
// (KenhTichHopDto, KetNoiKenhDto, LienKetDto, NhatKyDto, TongQuanDto, ThongTinKenhDto).
// Trạng thái giữ trong bộ nhớ: kết nối → thiết lập → liên kết chạy liền mạch trong một lần tải trang.
import { locKhoDongBo } from "@/constants/channel";
import { clone, isoMinutesAgo, mockDelay, mockError, normalizeText, paginate } from "./mockHelpers";

const KHO_FCENTRIC = [
  { id: 1, maKho: "KHO_HN", tenKho: "Kho tổng Hà Nội", trangThai: 1 },
  { id: 2, maKho: "KHO_HCM", tenKho: "Kho Hồ Chí Minh", trangThai: 1 },
  { id: 9, maKho: "KHO_TRANSIT", tenKho: "Kho Trung Chuyển", trangThai: 1 },
];

const KHACH_HANG = [
  { id: 5, maKhachHang: "KH-SHOPIFY", tenKhachHang: "Khách Shopify" },
  { id: 6, maKhachHang: "KH-LAZADA", tenKhachHang: "Khách Lazada" },
  { id: 7, maKhachHang: "KH-TIKTOK", tenKhachHang: "Khách TikTok Shop" },
  { id: 1, maKhachHang: "KH0001", tenKhachHang: "Khách lẻ" },
];

const SHOPIFY_LOCATIONS = [
  { maKhoSan: "gid://shopify/Location/80123", tenKhoSan: "Kho Hà Nội", loai: "location", macDinh: true },
  { maKhoSan: "gid://shopify/Location/80124", tenKhoSan: "Cửa hàng Quận 1", loai: "location", macDinh: false },
];

// Biến thể FCentric (combobox ghép tay) + tồn khả dụng ở Kho tổng Hà Nội
const BIEN_THE = [
  [77, "AO-THUN-DEN-M", "Áo thun cotton basic / Đen / M", 15],
  [78, "AO-THUN-DEN-L", "Áo thun cotton basic / Đen / L", 9],
  [79, "AO-THUN-DEN-XL", "Áo thun cotton basic / Đen / XL", 2],
  [81, "AO-THUN-TRANG-M", "Áo thun cotton basic / Trắng / M", 22],
  [82, "AO-THUN-TRANG-L", "Áo thun cotton basic / Trắng / L", 0],
  [93, "QUAN-JEAN-XANH-30", "Quần jean slim / Xanh đậm / 30", 5],
  [94, "QUAN-JEAN-XANH-32", "Quần jean slim / Xanh đậm / 32", 11],
  [95, "QUAN-JEAN-XANH-34", "Quần jean slim / Xanh đậm / 34", 1],
  [105, "SO-MI-OXFORD-XANH-M", "Sơ mi oxford / Xanh nhạt / M", 8],
  [106, "SO-MI-OXFORD-XANH-L", "Sơ mi oxford / Xanh nhạt / L", 6],
  [112, "VAY-MIDI-BE-S", "Váy midi xếp ly / Be / S", 4],
  [113, "VAY-MIDI-BE-M", "Váy midi xếp ly / Be / M", 7],
  [120, "AO-KHOAC-GIO-DEN-L", "Áo khoác gió / Đen / L", 3],
  [121, "AO-KHOAC-GIO-DEN-XL", "Áo khoác gió / Đen / XL", 12],
  [130, "TUI-TOTE-CANVAS-KEM", "Túi tote canvas / Kem / Free size", 30],
].map(([id, maSku, tenBienThe, khaDung]) => ({ id, maSku, tenBienThe, khaDung }));

const bienTheById = (id) => BIEN_THE.find((bt) => bt.id === id);

/** BR-OC-10: số đẩy = (kd < ngưỡng về 0) ? 0 : max(0, ⌊kd × tỷ lệ / 100⌋ − tồn đệm) */
export function tinhSoDay(kd, { tyLeDayTon = 100, tonDem = 0, nguongVe0 = 0 } = {}) {
  const khaDung = Math.max(0, Number(kd) || 0);
  if (khaDung < Number(nguongVe0 || 0)) return 0;
  return Math.max(0, Math.floor((khaDung * Number(tyLeDayTon || 0)) / 100) - Number(tonDem || 0));
}

// [sku sàn, tên SP sàn, biến thể sàn, id biến thể FCentric | null, trạng thái, lỗi, số đã đẩy]
const SHOPIFY_SKUS = [
  ["AO-THUN-DEN-M", "Áo thun cotton basic", "Đen / M", 77, "da_lien_ket", null, 14],
  ["AO-THUN-DEN-L", "Áo thun cotton basic", "Đen / L", 78, "da_lien_ket", null, 8],
  ["AO-THUN-DEN-XL", "Áo thun cotton basic", "Đen / XL", 79, "da_lien_ket", null, 0],
  ["AO-THUN-TRANG-M", "Áo thun cotton basic", "Trắng / M", 81, "da_lien_ket", null, null],
  ["ao-thun-trang-l ", "Áo thun cotton basic", "Trắng / L", 82, "da_lien_ket", null, 0],
  ["QUAN-JEAN-XANH-30", "Quần jean slim", "Xanh đậm / 30", 93, "da_lien_ket", null, 4],
  ["QUAN-JEAN-XANH-32", "Quần jean slim", "Xanh đậm / 32", 94, "loi", "Shopify trả lỗi 422: inventoryItem không thuộc location đã chọn.", 10],
  ["QJ-XANH-34", "Quần jean slim", "Xanh đậm / 34", null, "chua_lien_ket", null, null],
  ["SO-MI-OXFORD-XANH-M", "Sơ mi oxford", "Xanh nhạt / M", 105, "da_lien_ket", null, 7],
  ["SO-MI-OXFORD-XANH-L", "Sơ mi oxford", "Xanh nhạt / L", 106, "da_lien_ket", null, 5],
  ["VAY-MIDI-BE-S", "Váy midi xếp ly", "Be / S", 112, "da_lien_ket", null, 2],
  ["VAY-MIDI-BE-M", "Váy midi xếp ly", "Be / M", 113, "loi", "Vượt giới hạn gọi API (429), đã thử lại 5 lần.", 6],
  ["AKG-DEN-L", "Áo khoác gió", "Đen / L", null, "chua_lien_ket", null, null],
  ["AO-KHOAC-GIO-DEN-XL", "Áo khoác gió", "Đen / XL", 121, "da_lien_ket", null, 11],
  ["", "Túi tote canvas", "Kem", null, "chua_lien_ket", null, null],
  ["MU-LUOI-TRAI-DEN", "Mũ lưỡi trai", "Đen", null, "chua_lien_ket", null, null],
];

function seedLinks(ketNoiKenhId) {
  return SHOPIFY_SKUS.map(([skuSan, tenSanPhamSan, tenBienTheSan, bienTheId, trangThai, loi, daDay], index) => ({
    id: ketNoiKenhId * 1000 + index + 1,
    ketNoiKenhId,
    maSanPhamKenh: `gid://shopify/Product/${8100 + Math.floor(index / 3)}`,
    maBienTheSan: `gid://shopify/ProductVariant/${45000 + index}`,
    skuSan,
    tenSanPhamSan,
    tenBienTheSan,
    bienTheSanPhamId: bienTheId,
    trangThaiLienKet: trangThai,
    choPhepDongBo: trangThai !== "chua_lien_ket" && index !== 2,
    soLuongDaDay: daDay,
    ngayDayCuoi: daDay !== null ? isoMinutesAgo(4 + index) : null,
    chiTietLoi: loi,
  }));
}

const state = {
  kenhs: [
    { id: 2, maKenh: "SHOPIFY", tenKenh: "Shopify", uuTien: 1, authMode: "CLIENT_CREDENTIALS" },
    { id: 3, maKenh: "LAZADA", tenKenh: "Lazada", uuTien: 2, authMode: "OAUTH" },
    { id: 5, maKenh: "TIKTOK", tenKenh: "TikTok Shop", uuTien: 3, authMode: "OAUTH" },
  ],
  ketNois: [
    {
      id: 10, kenhBanId: 2, maKenh: "SHOPIFY", tenKenh: "Shopify",
      tenHienThi: "FCentric Official", shopIdSan: "fcentric-dev.myshopify.com",
      tenShopSan: "FCentric Dev", tenMienShop: "fcentric-dev.myshopify.com",
      trangThai: "dang_hoat_dong",
      khoId: 1, tenKho: "Kho tổng Hà Nội", maKhoSan: SHOPIFY_LOCATIONS[0].maKhoSan, tenKhoSan: SHOPIFY_LOCATIONS[0].tenKhoSan,
      khachHangMacDinhId: 5, tenKhachHangMacDinh: "Khách Shopify",
      tyLeDayTon: 100, tonDem: 1, nguongVe0: 2, layDonTu: "2026-10-01T00:00:00Z",
      tuDongDayTon: true, tuDongLayDon: true,
      appKeyMasked: "3f9a••••••••c21d", appSecretMasked: "shps••••••••8e04", accessTokenMasked: "shpa••••••••1234",
      hetHanAccess: new Date(Date.now() + 20 * 3_600_000).toISOString(), hetHanRefresh: null,
      lanDayTonCuoi: isoMinutesAgo(3), lanLayDonCuoi: isoMinutesAgo(6), loiGanNhat: null,
      ngayTao: "2026-10-05T03:00:00Z",
    },
    {
      id: 11, kenhBanId: 2, maKenh: "SHOPIFY", tenKenh: "Shopify",
      tenHienThi: "FCentric Outlet", shopIdSan: "fcentric-outlet.myshopify.com",
      tenShopSan: "FCentric Outlet", tenMienShop: "fcentric-outlet.myshopify.com",
      trangThai: "het_han",
      khoId: null, tenKho: null, maKhoSan: null, tenKhoSan: null,
      khachHangMacDinhId: 5, tenKhachHangMacDinh: "Khách Shopify",
      tyLeDayTon: 100, tonDem: 0, nguongVe0: 0, layDonTu: "2026-10-08T00:00:00Z",
      tuDongDayTon: false, tuDongLayDon: false,
      appKeyMasked: "a71b••••••••09ef", appSecretMasked: "shps••••••••77aa", accessTokenMasked: null,
      hetHanAccess: isoMinutesAgo(180), hetHanRefresh: null,
      lanDayTonCuoi: null, lanLayDonCuoi: isoMinutesAgo(1440),
      loiGanNhat: "Không xin được token: Client Secret đã bị thu hồi trên Dev Dashboard (401).",
      ngayTao: "2026-10-08T02:00:00Z",
    },
  ],
  links: { 10: seedLinks(10), 11: [] },
  logs: [],
  seq: { ketNoi: 12, log: 9100 },
};

// ── Nhật ký mẫu ─────────────────────────────────────────────────────────────
const LOG_SEED = [
  ["TON_KHO", "BATCH", "THANH_CONG", "AO-THUN-DEN-M", null, "Đã đẩy 14 lên Kho Hà Nội", 3, 77, { soDay: 14, soDaDay: 15 }],
  ["TON_KHO", "BATCH", "LOI", "QUAN-JEAN-XANH-32", "422", "inventoryItem không thuộc location đã chọn", 4, 94, { soDay: 10, soDaDay: 10 }],
  ["DON_HANG", "WEBHOOK", "THANH_CONG", "SHP-5550013", null, "Nhận đơn mới, đã giữ chỗ đủ", 7, null, { soDong: 1, nguoiNhan: "Ng*** V** A", soDienThoai: "09***382" }],
  ["TON_KHO", "REALTIME", "CHO_THU_LAI", "VAY-MIDI-BE-M", "429", "Vượt giới hạn gọi API", 9, 113, { soDay: 6, thuLaiLuc: "1 phút" }],
  ["DON_HANG", "POLLING", "LOI", "SHP-5550010", "THIEU_LIEN_KET", "Dòng hàng có SKU sàn QJ-XANH-34 chưa liên kết", 12, null, { skuSan: "QJ-XANH-34" }],
  ["HUY_DON", "WEBHOOK", "THANH_CONG", "SHP-5550008", null, "Đơn chưa vào Pick List, đã hủy và nhả giữ chỗ", 18, null, null],
  ["TON_KHO", "BATCH", "THANH_CONG", "SO-MI-OXFORD-XANH-M", null, "Đã đẩy 7 lên Kho Hà Nội", 21, 105, { soDay: 7, soDaDay: 8 }],
  ["TON_KHO", "BATCH", "LOI", "VAY-MIDI-BE-M", "429", "Vượt giới hạn gọi API", 25, 113, { soDay: 6 }],
  ["DON_HANG", "WEBHOOK", "BO_QUA", "SHP-5550006", null, "Sự kiện cũ hơn lần cập nhật gần nhất", 31, null, null],
  ["TOKEN", "BATCH", "THANH_CONG", "fcentric-dev.myshopify.com", null, "Làm mới token thành công", 45, null, { hetHan: "24 giờ" }],
  ["TON_KHO", "BATCH", "THANH_CONG", "AO-THUN-DEN-XL", "CHANGE_FROM_QUANTITY_STALE", "Shopify đã đổi tồn, đẩy lại với số tuyệt đối", 52, 79, { soDay: 0, soDaDay: null }],
  ["DON_HANG", "POLLING", "LOI", "SHP-5550001", "DON_DA_XU_LY_NGOAI_HE_THONG", "Đơn đã giao trước khi kết nối", 70, null, null],
  ["SAN_PHAM", "MANUAL", "THANH_CONG", "fcentric-dev.myshopify.com", null, "Tải 16 SKU, 2 mới, 14 cập nhật", 95, null, { soSanPham: 7, soSku: 16 }],
  ["KET_NOI", "MANUAL", "LOI", "fcentric-outlet.myshopify.com", "401", "Client Secret đã bị thu hồi", 180, null, null],
  ["KET_NOI", "MANUAL", "THANH_CONG", "fcentric-dev.myshopify.com", null, "Kết nối Shopify thành công, đã đăng ký 3 webhook", 7200, null, { webhook: ["ORDERS_CREATE", "ORDERS_UPDATED", "ORDERS_CANCELLED"] }],
];

state.logs = LOG_SEED.map(([loai, nguon, trangThai, maThamChieu, maLoi, thongDiep, minutesAgo, bienTheId, tomTat], index) => {
  const ketNoi = maThamChieu.startsWith("fcentric-outlet") ? state.ketNois[1] : state.ketNois[0];
  return {
    id: 9000 + index,
    ketNoiKenhId: ketNoi.id,
    maKenh: ketNoi.maKenh,
    tenHienThi: ketNoi.tenHienThi,
    loai,
    nguon,
    trangThai,
    maThamChieu,
    duLieuTomTat: tomTat,
    maLoi,
    thongDiep,
    suKienVaoId: loai === "DON_HANG" ? 7000 + index : null,
    bienTheSanPhamId: bienTheId,
    ngayTao: isoMinutesAgo(minutesAgo),
    coTheThuLai: trangThai === "LOI" || trangThai === "CHO_THU_LAI",
  };
});

function addLog(ketNoi, entry) {
  state.seq.log += 1;
  state.logs.unshift({
    id: state.seq.log,
    ketNoiKenhId: ketNoi.id,
    maKenh: ketNoi.maKenh,
    tenHienThi: ketNoi.tenHienThi,
    suKienVaoId: null,
    bienTheSanPhamId: null,
    duLieuTomTat: null,
    maLoi: null,
    ngayTao: new Date().toISOString(),
    coTheThuLai: false,
    ...entry,
  });
}

// ── Tính DTO ───────────────────────────────────────────────────────────────
// Trang Kết nối gian hàng mở Thiết lập / Liên kết bằng id kênh Shopify thật (backend chỉ có một cấu hình
// Shopify), nên id lạ được quy về gian hàng mẫu đầu tiên.
function findKetNoi(id) {
  const kn = state.ketNois.find((item) => item.id === Number(id)) ?? state.ketNois[0];
  if (!kn) throw mockError(404, "Không tìm thấy kết nối.");
  return kn;
}

function linkDto(link, ketNoi) {
  const bt = link.bienTheSanPhamId ? bienTheById(link.bienTheSanPhamId) : null;
  const linked = Boolean(bt);
  return {
    ...link,
    maSku: bt?.maSku ?? null,
    tenBienThe: bt?.tenBienThe ?? null,
    khaDung: linked ? bt.khaDung : null,
    soDay: linked ? tinhSoDay(bt.khaDung, ketNoi) : null,
  };
}

function lyDoKhongTheBat(kn, links) {
  if (!kn.khoId) return "Chưa chọn kho FCentric";
  if (!kn.maKhoSan) return "Chưa chọn vị trí kho trên Shopify";
  if (!kn.khachHangMacDinhId) return "Chưa chọn khách hàng mặc định";
  if (!links.some((l) => l.trangThaiLienKet === "da_lien_ket" && l.choPhepDongBo)) return "Chưa có SKU nào được liên kết và bật đồng bộ";
  if (kn.trangThai !== "dang_hoat_dong") return "Kết nối không ở trạng thái đang hoạt động";
  return null;
}

function ketNoiDto(kn) {
  const links = state.links[kn.id] ?? [];
  const lyDo = lyDoKhongTheBat(kn, links);
  return {
    ...clone(kn),
    soLienKet: links.length,
    soLienKetDangBat: links.filter((l) => l.trangThaiLienKet === "da_lien_ket" && l.choPhepDongBo).length,
    soChuaLienKet: links.filter((l) => l.trangThaiLienKet === "chua_lien_ket").length,
    coTheBatDongBo: !lyDo,
    lyDoKhongTheBat: lyDo,
  };
}

// Cấu hình Shopify một cửa hàng — cùng hình dạng ShopifyConfigResponse của KenhBanHangController
const shopifyState = {
  id: 2,
  maKenh: "SHOPIFY",
  tenKenh: "Cửa hàng Shopify",
  loaiKenh: "online",
  shopDomain: "fcentric-dev.myshopify.com",
  apiUrl: "https://fcentric-dev.myshopify.com/admin/api/2024-01",
  accessTokenMasked: "shpa****c21d",
  hasAccessToken: true,
  hasApiSecret: true,
  clientId: null,
  hasRefreshToken: false,
  refreshTokenMasked: null,
  tokenExpiresAt: null,
  tokenExpired: false,
  secondsUntilExpiration: null,
  trangThai: 1,
  ngayCapNhat: isoMinutesAgo(180),
};

const maskShort = (value) => (value.length > 8 ? `${value.slice(0, 4)}****${value.slice(-4)}` : "****");

// ── API mục 2 ──────────────────────────────────────────────────────────────
export const kenhBanHangMock = {
  async getShopifyConfig() {
    await mockDelay();
    return clone(shopifyState);
  },

  async updateShopifyConfig({ shopDomain, accessToken, apiSecret, clientId, refreshToken, trangThai } = {}) {
    await mockDelay(350, 600);
    const domain = String(shopDomain ?? "").trim().toLowerCase();
    if (!domain) throw mockError(400, "Shopify Store Domain không được để trống");
    shopifyState.shopDomain = domain;
    shopifyState.apiUrl = `https://${domain}/admin/api/2024-01`;
    if (accessToken) {
      shopifyState.accessTokenMasked = maskShort(accessToken);
      shopifyState.hasAccessToken = true;
    }
    if (apiSecret) shopifyState.hasApiSecret = true;
    if (clientId !== undefined && clientId !== null) shopifyState.clientId = clientId || null;
    if (refreshToken) {
      shopifyState.hasRefreshToken = true;
      shopifyState.refreshTokenMasked = maskShort(refreshToken);
      shopifyState.tokenExpiresAt = new Date(Date.now() + 24 * 3_600_000).toISOString();
      shopifyState.secondsUntilExpiration = 24 * 3600;
    }
    if (trangThai !== undefined && trangThai !== null) shopifyState.trangThai = Number(trangThai);
    shopifyState.ngayCapNhat = new Date().toISOString();
    return clone(shopifyState);
  },

  async testShopifyConnection({ shopDomain, accessToken } = {}) {
    await mockDelay(500, 800);
    const domain = String(shopDomain || shopifyState.shopDomain || "").trim().toLowerCase();
    if (!accessToken && !shopifyState.hasAccessToken) {
      return { connected: false, message: "Chưa có Admin Access Token để kiểm tra kết nối" };
    }
    if (domain.includes("sai-khoa") || String(accessToken ?? "").includes("sai")) {
      return { connected: false, message: "Access Token không hợp lệ hoặc không có quyền truy cập Shopify Admin API" };
    }
    return {
      connected: true,
      shopName: "FCentric Dev",
      shopEmail: "admin@fcentric.vn",
      myshopifyDomain: domain,
      message: "Kết nối thành công tới cửa hàng Shopify: FCentric Dev",
    };
  },

  async refreshShopifyToken() {
    await mockDelay(500, 800);
    if (!shopifyState.hasRefreshToken) {
      throw mockError(400, "Kênh Shopify đang sử dụng Static Token hoặc chưa cấu hình Refresh Token OAuth 2.0");
    }
    shopifyState.tokenExpiresAt = new Date(Date.now() + 24 * 3_600_000).toISOString();
    shopifyState.secondsUntilExpiration = 24 * 3600;
    shopifyState.tokenExpired = false;
    return true;
  },


  async getKetNoi(id) {
    await mockDelay();
    return ketNoiDto(findKetNoi(id));
  },

  async getKhoSan(id) {
    await mockDelay();
    findKetNoi(id);
    return clone(SHOPIFY_LOCATIONS);
  },

  async luuCauHinh(id, payload = {}) {
    await mockDelay(350, 600);
    const kn = findKetNoi(id);
    const kho = KHO_FCENTRIC.find((k) => k.id === Number(payload.khoId));
    if (!kho) throw mockError(400, "Vui lòng chọn kho FCentric.");
    if (kho.maKho === "KHO_TRANSIT") throw mockError(400, "Kho Trung Chuyển không dùng để đồng bộ tồn và xuất đơn.");
    if (!payload.maKhoSan) throw mockError(400, "Vui lòng chọn vị trí kho trên Shopify.");
    const tyLe = Number(payload.tyLeDayTon);
    if (!Number.isInteger(tyLe) || tyLe < 1 || tyLe > 100) throw mockError(400, "Tỷ lệ đẩy tồn phải từ 1 đến 100%.");
    const khach = KHACH_HANG.find((k) => k.id === Number(payload.khachHangMacDinhId));
    Object.assign(kn, {
      khoId: kho.id, tenKho: kho.tenKho,
      maKhoSan: payload.maKhoSan, tenKhoSan: payload.tenKhoSan,
      khachHangMacDinhId: khach?.id ?? kn.khachHangMacDinhId,
      tenKhachHangMacDinh: khach?.tenKhachHang ?? kn.tenKhachHangMacDinh,
      tyLeDayTon: tyLe, tonDem: Number(payload.tonDem) || 0, nguongVe0: Number(payload.nguongVe0) || 0,
      layDonTu: payload.layDonTu ?? kn.layDonTu,
    });
    return ketNoiDto(kn);
  },

  async batTatDongBo(id, { tuDongDayTon, tuDongLayDon } = {}) {
    await mockDelay();
    const kn = findKetNoi(id);
    const turningOn = (tuDongDayTon && !kn.tuDongDayTon) || (tuDongLayDon && !kn.tuDongLayDon);
    const lyDo = lyDoKhongTheBat(kn, state.links[kn.id] ?? []);
    if (turningOn && lyDo) throw mockError(409, `Chưa bật được đồng bộ: ${lyDo}.`);
    kn.tuDongDayTon = Boolean(tuDongDayTon);
    kn.tuDongLayDon = Boolean(tuDongLayDon);
    return ketNoiDto(kn);
  },

  async taiSanPham(id) {
    await mockDelay(700, 1100);
    const kn = findKetNoi(id);
    const existing = state.links[kn.id] ?? [];
    if (existing.length === 0) state.links[kn.id] = seedLinks(kn.id).map((l) => ({ ...l, bienTheSanPhamId: null, trangThaiLienKet: "chua_lien_ket", choPhepDongBo: false, soLuongDaDay: null, ngayDayCuoi: null, chiTietLoi: null }));
    const links = state.links[kn.id];
    addLog(kn, { loai: "SAN_PHAM", nguon: "MANUAL", trangThai: "THANH_CONG", maThamChieu: kn.tenMienShop, thongDiep: `Tải ${links.length} SKU từ Shopify` });
    return { soSanPham: new Set(links.map((l) => l.maSanPhamKenh)).size, soSku: links.length, soMoi: existing.length ? 0 : links.length, soCapNhat: existing.length };
  },

  async tuDongLienKet(id) {
    await mockDelay(500, 800);
    const kn = findKetNoi(id);
    const links = state.links[kn.id] ?? [];
    let soDaGhep = 0;
    let soKhongKhop = 0;
    let soNhieuKhop = 0;
    const used = new Set(links.filter((l) => l.bienTheSanPhamId).map((l) => l.bienTheSanPhamId));
    links.forEach((link) => {
      if (link.trangThaiLienKet !== "chua_lien_ket") return;
      const sku = normalizeText(link.skuSan);
      const matches = sku ? BIEN_THE.filter((bt) => normalizeText(bt.maSku) === sku) : [];
      if (matches.length === 1 && !used.has(matches[0].id)) {
        link.bienTheSanPhamId = matches[0].id;
        link.trangThaiLienKet = "da_lien_ket";
        link.choPhepDongBo = true;
        used.add(matches[0].id);
        soDaGhep += 1;
      } else if (matches.length > 1) soNhieuKhop += 1;
      else soKhongKhop += 1;
    });
    return { soDaGhep, soKhongKhop, soNhieuKhop };
  },

  async filterLienKet(id, { page = 0, size = 10, trangThaiLienKet, search } = {}) {
    await mockDelay();
    const kn = findKetNoi(id);
    const key = normalizeText(search);
    const list = (state.links[kn.id] ?? [])
      .filter((l) => !trangThaiLienKet || l.trangThaiLienKet === trangThaiLienKet)
      .map((l) => linkDto(l, kn))
      .filter((l) => !key || normalizeText(`${l.skuSan} ${l.tenSanPhamSan} ${l.tenBienTheSan} ${l.maSku ?? ""}`).includes(key));
    return paginate(list, page, size);
  },

  async capNhatLienKet(lienKetId, { bienTheSanPhamId, choPhepDongBo } = {}) {
    await mockDelay(200, 400);
    const kn = state.ketNois.find((item) => (state.links[item.id] ?? []).some((l) => l.id === Number(lienKetId)));
    if (!kn) throw mockError(404, "Không tìm thấy liên kết.");
    const links = state.links[kn.id];
    const link = links.find((l) => l.id === Number(lienKetId));
    if (bienTheSanPhamId) {
      const dup = links.find((l) => l.id !== link.id && l.bienTheSanPhamId === Number(bienTheSanPhamId));
      if (dup) throw mockError(409, `Biến thể này đã liên kết với SKU sàn ${dup.skuSan || dup.tenBienTheSan} trong cùng kết nối (BR-OC-06).`);
      if (!bienTheById(Number(bienTheSanPhamId))) throw mockError(404, "Không tìm thấy biến thể FCentric.");
    }
    const changedVariant = (link.bienTheSanPhamId ?? null) !== (bienTheSanPhamId ?? null);
    link.bienTheSanPhamId = bienTheSanPhamId ? Number(bienTheSanPhamId) : null;
    link.trangThaiLienKet = link.bienTheSanPhamId ? "da_lien_ket" : "chua_lien_ket";
    link.choPhepDongBo = link.bienTheSanPhamId ? Boolean(choPhepDongBo) : false;
    if (changedVariant) {
      link.soLuongDaDay = null;
      link.chiTietLoi = null;
    }
    return linkDto(link, kn);
  },

  async dayTon(id) {
    await mockDelay(500, 800);
    const kn = findKetNoi(id);
    if (kn.trangThai !== "dang_hoat_dong") throw mockError(409, "Kết nối không hoạt động nên không đẩy tồn được.");
    const links = (state.links[kn.id] ?? []).filter((l) => l.trangThaiLienKet !== "chua_lien_ket" && l.choPhepDongBo);
    links.forEach((l) => {
      if (l.trangThaiLienKet === "loi") return;
      l.soLuongDaDay = tinhSoDay(bienTheById(l.bienTheSanPhamId)?.khaDung, kn);
      l.ngayDayCuoi = new Date().toISOString();
    });
    kn.lanDayTonCuoi = new Date().toISOString();
    addLog(kn, { loai: "TON_KHO", nguon: "MANUAL", trangThai: "THANH_CONG", maThamChieu: kn.tenMienShop, thongDiep: `Đẩy tồn thủ công ${links.length} SKU` });
    return { soDong: links.length };
  },

  async layDon(id, { tu, den } = {}) {
    await mockDelay(500, 800);
    const kn = findKetNoi(id);
    if (kn.trangThai !== "dang_hoat_dong") throw mockError(409, "Kết nối không hoạt động nên không lấy đơn được.");
    if (tu && den && new Date(tu) > new Date(den)) throw mockError(400, "Thời điểm bắt đầu phải trước thời điểm kết thúc.");
    kn.lanLayDonCuoi = new Date().toISOString();
    addLog(kn, { loai: "DON_HANG", nguon: "MANUAL", trangThai: "THANH_CONG", maThamChieu: kn.tenMienShop, thongDiep: "Lấy đơn thủ công: 2 sự kiện mới" });
    return { soSuKien: 2 };
  },

  async dongBoTatCa() {
    await mockDelay(600, 900);
    const active = state.ketNois.filter((kn) => kn.trangThai === "dang_hoat_dong" && kn.tuDongDayTon);
    active.forEach((kn) => {
      kn.lanDayTonCuoi = new Date().toISOString();
    });
    return { soKetNoi: active.length };
  },

  async tongQuan() {
    await mockDelay();
    const dayAgo = Date.now() - 24 * 3_600_000;
    return {
      kenhDangKetNoi: new Set(state.ketNois.filter((kn) => kn.trangThai === "dang_hoat_dong").map((kn) => kn.kenhBanId)).size,
      tongKetNoi: state.ketNois.length,
      suKienTrongNhatKy: state.logs.filter((log) => new Date(log.ngayTao).getTime() >= dayAgo).length,
      suKienCanXuLy: state.logs.filter((log) => log.trangThai === "LOI").length,
      chuKyDongBoTonPhut: 5,
      chuKyLayDonPhut: 15,
      ketNois: state.ketNois.map((kn) => ({
        id: kn.id,
        maKenh: kn.maKenh,
        tenHienThi: kn.tenHienThi,
        trangThai: kn.trangThai,
        lanDayTonCuoi: kn.lanDayTonCuoi,
        lanLayDonCuoi: kn.lanLayDonCuoi,
        soLoi: state.logs.filter((log) => log.ketNoiKenhId === kn.id && log.trangThai === "LOI").length,
        soChoDay: (state.links[kn.id] ?? []).filter((l) => l.soLuongDaDay === null && l.trangThaiLienKet === "da_lien_ket").length,
      })),
    };
  },

  async filterNhatKy({ page = 0, size = 10, ketNoiKenhId, loai, trangThai, search, tu, den } = {}) {
    await mockDelay();
    const key = normalizeText(search);
    const list = state.logs
      .filter((log) => !ketNoiKenhId || log.ketNoiKenhId === Number(ketNoiKenhId))
      .filter((log) => !loai || log.loai === loai)
      .filter((log) => !trangThai || log.trangThai === trangThai)
      .filter((log) => !key || normalizeText(`${log.maThamChieu} ${log.thongDiep} ${log.maLoi ?? ""}`).includes(key))
      .filter((log) => !tu || new Date(log.ngayTao) >= new Date(tu))
      .filter((log) => !den || new Date(log.ngayTao) <= new Date(den));
    return paginate(clone(list), page, size);
  },

  async getNhatKy(id) {
    await mockDelay();
    const log = state.logs.find((item) => item.id === Number(id));
    if (!log) throw mockError(404, "Không tìm thấy dòng nhật ký.");
    return {
      ...clone(log),
      payload: {
        nguon: log.nguon,
        maThamChieu: log.maThamChieu,
        ...(log.loai === "DON_HANG"
          ? { order: { name: `#${String(log.maThamChieu).replace(/\D/g, "").slice(-4)}`, phone: "09***382", shippingAddress: "*** (đã che)" } }
          : {}),
        ...(log.duLieuTomTat ?? {}),
      },
    };
  },

  async thuLai(id) {
    await mockDelay(300, 500);
    const log = state.logs.find((item) => item.id === Number(id));
    if (!log) throw mockError(404, "Không tìm thấy dòng nhật ký.");
    if (!log.coTheThuLai) throw mockError(409, "Dòng nhật ký này không thử lại được.");
    log.trangThai = "CHO";
    log.coTheThuLai = false;
    log.thongDiep = `${log.thongDiep} · đã đưa vào hàng đợi thử lại`;
    return null;
  },

  async timBienThe(q = "", limit = 20) {
    await mockDelay(120, 220);
    const key = normalizeText(q);
    return BIEN_THE.filter((bt) => !key || normalizeText(`${bt.maSku} ${bt.tenBienThe}`).includes(key))
      .slice(0, limit)
      .map(({ id, maSku, tenBienThe }) => ({ id, maSku, tenBienThe }));
  },

  // Dữ liệu chọn trong Wizard (bản thật gọi khoService / khách hàng)
  async getKhoOptions() {
    await mockDelay();
    return locKhoDongBo(clone(KHO_FCENTRIC));
  },

  async getKhachHangOptions() {
    await mockDelay();
    return clone(KHACH_HANG);
  },
};
