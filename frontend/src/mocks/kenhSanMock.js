// Dữ liệu mẫu cho kết nối Lazada / TikTok Shop bằng ủy quyền (KH mục C.1, C.3): khóa ứng dụng, phiên ủy quyền,
// hạn ủy quyền, kho trên sàn. Liên kết sản phẩm và đơn của hai sàn nằm ở kenhBanHangMock.js và donBanHangKenhMock.js.
//
// Trạng thái lưu trong sessionStorage (khóa "fc:mock-kenh") vì bước ủy quyền chuyển cả trang sang trang quay về:
// dữ liệu chỉ trong bộ nhớ sẽ mất giữa chừng. Muốn thử tình huống khác: đặt
//   sessionStorage.setItem("fc:mock-kenh:tinh-huong", JSON.stringify({ LAZADA: "het_han", TIKTOK: "chua_ket_noi" }))
// (binh_thuong | sap_het | het_han | chua_ket_noi), xóa khóa "fc:mock-kenh" rồi tải lại trang.
import { clone, mockDelay } from "./mockHelpers";

const KHOA_LUU = "fc:mock-kenh";
const KHOA_TINH_HUONG = "fc:mock-kenh:tinh-huong";
const MOT_NGAY = 86_400_000;
const HAN_PHIEN_MS = 10 * 60_000;

const SAN = {
  LAZADA: {
    tenKenh: "Gian hàng Lazada",
    shopIdSan: "2004518320",
    appKey: "131204",
    serviceId: null,
    hanUyQuyenNgay: 50,
    hanKhoaNgay: 10,
    kho: [{ maKhoSan: "dropshipping", tenKhoSan: "Kho mặc định", loai: "kho_mac_dinh", macDinh: true }],
  },
  TIKTOK: {
    tenKenh: "Gian hàng TikTok Shop",
    shopIdSan: "7496018834521",
    appKey: "6f2kq81n4lhd2",
    serviceId: "7493021",
    hanUyQuyenNgay: 365,
    hanKhoaNgay: 7,
    kho: [
      { maKhoSan: "7210448810001", tenKhoSan: "Kho Hà Nội", loai: "SALES_WAREHOUSE", macDinh: true },
      { maKhoSan: "7210448810002", tenKhoSan: "Kho Hồ Chí Minh", loai: "SALES_WAREHOUSE", macDinh: false },
    ],
  },
};

const TEN_GIAN_HANG = "Fashion House VN";

/** Lỗi giả cùng hình dạng LoiCoMaException của máy chủ: mã ở `data.code` (đọc bằng getApiErrorCode). */
function loiCoMa(status, code, message) {
  const error = new Error(message);
  error.response = { status, data: { status, message, error: code, data: { code } } };
  return error;
}

function docJson(khoa) {
  try {
    const raw = window.sessionStorage.getItem(khoa);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function ghiJson(khoa, giaTri) {
  try {
    window.sessionStorage.setItem(khoa, JSON.stringify(giaTri));
  } catch {
    // Trình duyệt chặn lưu: vẫn chạy trong bộ nhớ, chỉ mất khi chuyển trang ủy quyền
  }
}

const iso = (ms) => new Date(ms).toISOString();

function chuaKetNoi(maKenh) {
  const san = SAN[maKenh];
  return {
    maKenh,
    tenKenh: san.tenKenh,
    kieuKetNoi: "uy_quyen",
    tenGianHang: null,
    shopIdSan: null,
    shopDomain: null,
    appKey: null,
    serviceId: null,
    hasAppSecret: false,
    hasAccessToken: false,
    accessTokenMasked: null,
    tokenExpiresAt: null,
    hanUyQuyen: null,
    soNgayConUyQuyen: null,
    ngayUyQuyen: null,
    trangThai: 1,
    trangThaiKetNoi: "chua_ket_noi",
    maKhoSan: null,
    tenKhoSan: null,
    hoTroWebhook: false,
    ngayCapNhat: iso(Date.now()),
  };
}

/** Đã ủy quyền; `hanConNgay` âm là đã hết hạn. */
function daUyQuyen(maKenh, hanConNgay, cu = null) {
  const san = SAN[maKenh];
  const bayGio = Date.now();
  const khoMacDinh = san.kho.find((k) => k.macDinh);
  return {
    ...chuaKetNoi(maKenh),
    tenGianHang: TEN_GIAN_HANG,
    shopIdSan: san.shopIdSan,
    appKey: cu?.appKey ?? san.appKey,
    serviceId: cu?.serviceId ?? san.serviceId,
    hasAppSecret: true,
    hasAccessToken: true,
    accessTokenMasked: maKenh === "LAZADA" ? "5000••••••••a1f3" : "ROW_••••••••9kQe",
    tokenExpiresAt: iso(bayGio + Math.min(san.hanKhoaNgay, Math.max(hanConNgay, 0)) * MOT_NGAY),
    hanUyQuyen: iso(bayGio + hanConNgay * MOT_NGAY),
    soNgayConUyQuyen: Math.max(0, Math.ceil(hanConNgay)),
    ngayUyQuyen: iso(bayGio - (san.hanUyQuyenNgay - hanConNgay) * MOT_NGAY),
    trangThai: cu?.trangThai ?? 1,
    trangThaiKetNoi: hanConNgay > 0 ? "dang_hoat_dong" : "het_han",
    maKhoSan: cu?.maKhoSan ?? (maKenh === "TIKTOK" ? khoMacDinh.maKhoSan : null),
    tenKhoSan: cu?.tenKhoSan ?? khoMacDinh.tenKhoSan,
  };
}

function taoTheoTinhHuong(maKenh, tinhHuong) {
  if (tinhHuong === "chua_ket_noi") return chuaKetNoi(maKenh);
  if (tinhHuong === "het_han") return daUyQuyen(maKenh, -1);
  if (tinhHuong === "sap_het") return daUyQuyen(maKenh, maKenh === "LAZADA" ? 5.5 : 4.5);
  return daUyQuyen(maKenh, SAN[maKenh].hanUyQuyenNgay - 3);
}

function taiTrangThai() {
  const daLuu = docJson(KHOA_LUU);
  if (daLuu?.LAZADA && daLuu?.TIKTOK) return { phien: {}, ...daLuu };
  const tinhHuong = docJson(KHOA_TINH_HUONG) ?? {};
  return {
    LAZADA: taoTheoTinhHuong("LAZADA", tinhHuong.LAZADA),
    TIKTOK: taoTheoTinhHuong("TIKTOK", tinhHuong.TIKTOK),
    phien: {},
  };
}

const state = taiTrangThai();
const luu = () => ghiJson(KHOA_LUU, state);

function ketNoi(maKenh) {
  const ma = String(maKenh ?? "").toUpperCase();
  if (!SAN[ma]) throw loiCoMa(400, "SAN_KHONG_HO_TRO", "Sàn không hỗ trợ kết nối bằng ủy quyền.");
  return { ma, dto: state[ma] };
}

function thieuKhoa(ma, dto) {
  return !dto.appKey || !dto.hasAppSecret || (ma === "TIKTOK" && !dto.serviceId);
}

export const kenhSanMock = {
  laSanUyQuyen: (maKenh) => Boolean(SAN[String(maKenh ?? "").toUpperCase()]),

  async getKetNoi(maKenh) {
    await mockDelay();
    return clone(ketNoi(maKenh).dto);
  },

  async luuKhoa(maKenh, { appKey, appSecret, serviceId, trangThai } = {}) {
    await mockDelay(300, 500);
    const { ma, dto } = ketNoi(maKenh);
    if (appKey !== undefined && appKey !== null) {
      const moi = String(appKey).trim() || null;
      // Như máy chủ (KH mục C.1): đổi App Key lúc đang kết nối thì khóa truy cập cũ hết dùng được → hết hạn
      if (moi !== dto.appKey && dto.trangThaiKetNoi === "dang_hoat_dong") dto.trangThaiKetNoi = "het_han";
      dto.appKey = moi;
    }
    if (appSecret) dto.hasAppSecret = true;
    if (ma === "TIKTOK" && serviceId !== undefined && serviceId !== null) dto.serviceId = String(serviceId).trim() || null;
    if (trangThai !== undefined && trangThai !== null) dto.trangThai = Number(trangThai) ? 1 : 0;
    dto.ngayCapNhat = iso(Date.now());
    luu();
    return clone(dto);
  },

  async batDauUyQuyen(maKenh) {
    await mockDelay(250, 450);
    const { ma, dto } = ketNoi(maKenh);
    if (thieuKhoa(ma, dto)) {
      throw loiCoMa(400, "THIEU_KHOA_UNG_DUNG", "Nhập đủ khóa ứng dụng trước khi ủy quyền.");
    }
    const maPhien = `mau${Math.random().toString(36).slice(2, 12)}`;
    state.phien[maPhien] = { maKenh: ma, hetHan: Date.now() + HAN_PHIEN_MS, daDung: false };
    luu();
    const code = `mau-${Math.random().toString(36).slice(2, 10)}`;
    const authUrl = `${window.location.origin}/channels/oauth/callback/${ma.toLowerCase()}?code=${code}&state=${maPhien}`;
    return { authUrl };
  },

  /** `state` null: nhập tay mã của tài khoản thử (chỉ TikTok Shop, như channel.cho-phep-ma-thu-cong=true). */
  async hoanTatUyQuyen(maKenh, { code, state: maPhien } = {}) {
    await mockDelay(900, 1400);
    const { ma, dto } = ketNoi(maKenh);
    if (!String(code ?? "").trim()) throw loiCoMa(400, "MA_UY_QUYEN_SAI", "Mã ủy quyền không hợp lệ hoặc đã dùng.");
    if (maPhien == null) {
      if (ma !== "TIKTOK") throw loiCoMa(400, "STATE_KHONG_HOP_LE", "Phiên ủy quyền không hợp lệ.");
    } else {
      const phien = state.phien[maPhien];
      if (!phien || phien.maKenh !== ma || phien.daDung || phien.hetHan < Date.now()) {
        throw loiCoMa(400, "STATE_KHONG_HOP_LE", "Phiên ủy quyền đã hết hạn hoặc đã dùng.");
      }
      phien.daDung = true;
    }
    // Kết nối lại sau khi ngắt (ngắt đặt trạng thái 0): bật lại đồng bộ, như Shopify ở máy chủ
    const ketNoiLai = dto.trangThaiKetNoi === "chua_ket_noi" ? { trangThai: 1 } : {};
    state[ma] = { ...daUyQuyen(ma, SAN[ma].hanUyQuyenNgay, dto), ngayUyQuyen: iso(Date.now()), ...ketNoiLai };
    luu();
    return clone(state[ma]);
  },

  async kiemTraKetNoi(maKenh) {
    await mockDelay(500, 800);
    const { dto } = ketNoi(maKenh);
    if (dto.trangThaiKetNoi === "chua_ket_noi") return { connected: false, message: "Gian hàng chưa được ủy quyền." };
    if (dto.trangThaiKetNoi === "het_han") {
      return { connected: false, message: "Khóa truy cập không còn hiệu lực, cần ủy quyền lại" };
    }
    return { connected: true, message: "Kết nối tốt", tenGianHang: dto.tenGianHang, shopIdSan: dto.shopIdSan, hanKhoa: dto.tokenExpiresAt };
  },

  async lamMoiToken(maKenh) {
    await mockDelay(500, 800);
    const { ma, dto } = ketNoi(maKenh);
    if (dto.trangThaiKetNoi !== "dang_hoat_dong") throw loiCoMa(409, "UY_QUYEN_HET_HAN", "Ủy quyền đã hết hạn, hãy ủy quyền lại.");
    dto.tokenExpiresAt = iso(Date.now() + SAN[ma].hanKhoaNgay * MOT_NGAY);
    luu();
    return clone(dto);
  },

  /**
   * Ngắt kết nối (KH mục C.1): xóa khóa truy cập và thông tin ủy quyền, dừng đồng bộ; giữ khóa ứng dụng (App Key,
   * App Secret, Service ID) để ủy quyền lại không phải nhập lại, và kho trên sàn đã chọn. Liên kết sản phẩm và đơn đã
   * nhận giữ nguyên.
   */
  async ngatKetNoi(maKenh) {
    await mockDelay(400, 700);
    const { ma, dto } = ketNoi(maKenh);
    // Như máy chủ Shopify (NgatKetNoiKenhService): đặt trạng thái 0 để job bỏ qua kênh; ủy quyền lại thì bật lại
    const { appKey, serviceId, hasAppSecret, maKhoSan, tenKhoSan } = dto;
    state[ma] = { ...chuaKetNoi(ma), appKey, serviceId, hasAppSecret, maKhoSan, tenKhoSan, trangThai: 0 };
    luu();
    return clone(state[ma]);
  },

  async getKhoSan(maKenh) {
    await mockDelay();
    const { ma, dto } = ketNoi(maKenh);
    return dto.hasAccessToken ? clone(SAN[ma].kho) : [];
  },

  async luuCaiDat(maKenh, { maKhoSan, tenKhoSan } = {}) {
    await mockDelay(250, 450);
    const { ma, dto } = ketNoi(maKenh);
    if (maKhoSan) {
      const kho = SAN[ma].kho.find((k) => k.maKhoSan === maKhoSan);
      dto.maKhoSan = maKhoSan;
      dto.tenKhoSan = kho?.tenKhoSan ?? tenKhoSan ?? null;
      luu();
    }
    return clone(dto);
  },
};
