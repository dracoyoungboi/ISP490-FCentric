// Dữ liệu mẫu cho danh sách / chi tiết đơn bán có đơn từ sàn (S-OC-05, S-OC-06).
// Hình dạng bám DonBanHangDto (thêm ketNoiKenhId, kenhBanHang, maDonHangKenh, trangThaiSan, canXuLy)
// và ThongTinKenhDto ở API-KENH-BAN-HANG.md mục 3.
import { parseFlags } from "@/constants/channel";
import { clone, isoMinutesAgo, mockDelay, mockError, normalizeText, paginate } from "./mockHelpers";

const KENH = {
  SHOPIFY: { id: 2, maKenh: "SHOPIFY", tenKenh: "Shopify", loaiKenh: "online" },
  LAZADA: { id: 3, maKenh: "LAZADA", tenKenh: "Lazada", loaiKenh: "online" },
  TIKTOK: { id: 5, maKenh: "TIKTOK", tenKenh: "TikTok Shop", loaiKenh: "online" },
  POS: { id: 1, maKenh: "POS", tenKenh: "POS", loaiKenh: "offline" },
};
// Tên gian hàng trùng kenhBanHangMock.js (Shopify) và kenhSanMock.js (Lazada, TikTok Shop: "Fashion House VN")
const KET_NOI = {
  SHOPIFY: { id: 10, tenHienThi: "FCentric Official" },
  LAZADA: { id: 20, tenHienThi: "Fashion House VN" },
  TIKTOK: { id: 30, tenHienThi: "Fashion House VN" },
};
const KHO = { id: 1, maKho: "KHO_HN", tenKho: "Kho tổng Hà Nội" };
const KHACH = {
  SHOPIFY: { id: 5, tenKhachHang: "Khách Shopify" },
  LAZADA: { id: 6, tenKhachHang: "Khách Lazada" },
  TIKTOK: { id: 7, tenKhachHang: "Khách TikTok Shop" },
  POS: { id: 1, tenKhachHang: "Khách lẻ" },
};

// [id, số đơn, kênh, mã đơn sàn, trạng thái, trạng thái sàn, cờ, phút trước, địa chỉ, dòng [sku, skuSan, tên, sl, đơn giá, đã giao]]
const SEED = [
  [9001, "SHP-5550011", "SHOPIFY", "5550011", 1, "PAID", null, 140, "Ng*** V** A · 09***382 · Q. Cầu Giấy, Hà Nội",
    [["AO-THUN-DEN-M", "AO-THUN-DEN-M", "Áo thun cotton basic / Đen / M", 1, 320000, 0], ["AO-THUN-TRANG-M", " ao-thun-trang-m", "Áo thun cotton basic / Trắng / M", 1, 320000, 0]]],
  [9002, "SHP-5550009", "SHOPIFY", "5550009", 2, "PAID · đã hủy trên Shopify", "XUNG_DOT_HUY", 230, "Tr*** T** B · 09***715 · Q. 3, TP. HCM",
    [["AO-THUN-TRANG-M", "AO-THUN-TRANG-M", "Áo thun cotton basic / Trắng / M", 2, 320000, 0]]],
  [9003, "SHP-5550004", "SHOPIFY", "5550004", 3, "PAID", null, 1600, "Lê *** C · 09***004 · TP. Thủ Đức",
    [["QUAN-JEAN-XANH-30", "QJ-SLIM-30", "Quần jean slim / Xanh đậm / 30", 1, 459000, 1]]],
  [9004, "LZD-781203344", "LAZADA", "781203344", 1, "pending", "THIEU_HANG", 80, "Ph*** Q** D · 08***266 · TP. Đà Nẵng",
    [["VAY-MIDI-BE-S", "VAY-MIDI-BE-S", "Váy midi xếp ly / Be / S", 2, 445000, 0]]],
  [9005, "TTS-57720019931", "TIKTOK", "57720019931", 1, "AWAITING_SHIPMENT", "YEU_CAU_HUY", 60, "Ho*** M** E · 09***871 · TP. Hải Phòng",
    [["AO-KHOAC-GIO-DEN-L", "AO-KHOAC-GIO-DEN-L", "Áo khoác gió / Đen / L", 1, 590000, 0], ["AO-THUN-DEN-L", "AO-THUN-DEN-L", "Áo thun cotton basic / Đen / L", 2, 280000, 0]]],
  [9006, "SHP-5550002", "SHOPIFY", "5550002", 5, "REFUNDED", "HOAN_HANG", 4300, "Đỗ *** G · 09***112 · Q. Ba Đình, Hà Nội",
    [["SO-MI-OXFORD-XANH-M", "SO-MI-OXFORD-XANH-M", "Sơ mi oxford / Xanh nhạt / M", 1, 520000, 1]]],
  [9007, "LZD-781200777", "LAZADA", "781200777", 0, "unpaid · giao thất bại", "CAN_KIEM_TRA,THIEU_HANG", 300, "Vũ *** H · 03***559 · TP. Cần Thơ",
    [["QUAN-JEAN-XANH-32", "QUAN-JEAN-XANH-32", "Quần jean slim / Xanh đậm / 32", 3, 459000, 0]]],
  [9008, "SO202610101", null, null, 1, null, null, 300, "Công ty TNHH An Phú, 12 Duy Tân, Hà Nội",
    [["AO-THUN-DEN-M", null, "Áo thun cotton basic / Đen / M", 5, 300000, 0], ["QUAN-JEAN-XANH-30", null, "Quần jean slim / Xanh đậm / 30", 3, 450000, 0]]],
  [9009, "SO202610088", null, null, 5, null, null, 5000, "Shop Thời trang Mộc, 45 Lê Lợi, Huế",
    [["VAY-MIDI-BE-M", null, "Váy midi xếp ly / Be / M", 4, 420000, 4]]],
  [9010, "POS202610100015", "POS", null, 5, null, null, 25, "",
    [["TUI-TOTE-CANVAS-KEM", null, "Túi tote canvas / Kem / Free size", 1, 190000, 1]]],
];

function seedOrder([id, soDonHang, kenh, maDonHangKenh, trangThai, trangThaiSan, canXuLy, minutesAgo, diaChi, lines]) {
  const chiTiet = lines.map(([sku, skuSan, tenSanPham, sl, donGia, daGiao], index) => ({
    id: id * 10 + index + 1,
    bienTheSanPhamId: 70 + index,
    sku,
    skuSan,
    tenSanPham,
    soLuongDat: sl,
    soLuongDaGiao: daGiao ? sl : 0,
    donGia,
    thanhTien: sl * donGia,
    ghiChu: null,
  }));
  const tienHang = chiTiet.reduce((sum, ct) => sum + ct.thanhTien, 0);
  const isMarketplace = kenh && kenh !== "POS";
  return {
    donBanHang: {
      id,
      soDonHang,
      loaiChungTu: "don_ban_hang",
      khachHang: KHACH[kenh ?? "POS"] ?? { id: 99, tenKhachHang: "Công ty TNHH An Phú" },
      khoXuat: KHO,
      ngayDatHang: isoMinutesAgo(minutesAgo),
      trangThai,
      tienHang,
      phiVanChuyen: isMarketplace ? 30000 : 0,
      tongCong: tienHang + (isMarketplace ? 30000 : 0),
      trangThaiThanhToan: "da_thanh_toan",
      diaChiGiaoHang: diaChi,
      ghiChu: null,
      ketNoiKenhId: isMarketplace ? KET_NOI[kenh].id : null,
      kenhBanHang: kenh ? KENH[kenh] : null,
      maDonHangKenh,
      trangThaiSan,
      ngayCapNhatSan: isMarketplace ? isoMinutesAgo(Math.max(1, minutesAgo - 20)) : null,
      canXuLy,
      ngayTao: isoMinutesAgo(minutesAgo),
    },
    chiTiet,
    phieuXuatKhoList: trangThai >= 3 && trangThai !== 4
      ? [{ id: id + 50000, soPhieuXuat: `PX${soDonHang.replace(/\D/g, "").slice(-6)}`, ngayXuat: isoMinutesAgo(minutesAgo - 60), trangThai: 3, ghiChu: null }]
      : [],
    giuCho: isMarketplace && trangThai <= 2
      ? chiTiet.map((ct, index) => ({
        chiTietId: ct.id,
        maSku: ct.sku,
        maLo: `LO-2026-0${index + 3}`,
        soLuong: String(canXuLy ?? "").includes("THIEU_HANG") ? Math.max(0, ct.soLuongDat - 1) : ct.soLuongDat,
        trangThai: "dang_giu",
      }))
      : [],
    sanHuyCaDon: String(trangThaiSan ?? "").includes("đã hủy"),
  };
}

// Lazada / TikTok Shop: 9 đơn mỗi sàn như bản demo (KH mục B.7) — khách mặc định của sàn, người nhận do sàn che.
// [phút trước, trạng thái, trạng thái Lazada, trạng thái TikTok, người nhận, khách yêu cầu hủy (TikTok), dòng [sku, tên, sl, đơn giá]]
const DON_SAN_UY_QUYEN = [
  [35, 0, "pending", "AWAITING_SHIPMENT", "N*n T. · 09***382", true, [["AO-THUN-DEN-M", "Áo thun cotton basic / Đen / M", 1, 459000]]],
  [68, 0, "pending", "AWAITING_SHIPMENT", "L*h P. · 03***116", false, [["QUAN-JEAN-XANH-32", "Quần jean slim / Xanh đậm / 32", 2, 614000]]],
  [190, 1, "topack", "AWAITING_SHIPMENT", "T*n V. · 09***904", true, [["AO-THUN-TRANG-M", "Áo thun cotton basic / Trắng / M", 1, 299000]]],
  [320, 1, "topack", "AWAITING_SHIPMENT", "H*g M. · 08***771", false, [["AO-KHOAC-GIO-DEN-L", "Áo khoác gió / Đen / L", 1, 849000]]],
  [1240, 7, "topack", "AWAITING_SHIPMENT", "P*g A. · 09***233", false, [["VAY-MIDI-BE-S", "Váy midi xếp ly / Be / S", 1, 629000]]],
  [1350, 8, "ready_to_ship", "AWAITING_COLLECTION", "D*c H. · 03***640", false, [["QUAN-JEAN-XANH-30", "Quần jean slim / Xanh đậm / 30", 2, 534500]]],
  [1910, 3, "shipped", "IN_TRANSIT", "V*n K. · 09***518", false, [["AO-THUN-DEN-L", "Áo thun cotton basic / Đen / L", 1, 429000]]],
  [2715, 5, "delivered", "COMPLETED", "B*o N. · 07***305", false, [["AO-KHOAC-GIO-DEN-XL", "Áo khoác gió / Đen / XL", 1, 699000]]],
  [2980, 4, "canceled", "CANCELLED", "Q*h L. · 09***092", false, [["AO-THUN-DEN-XL", "Áo thun cotton basic / Đen / XL", 1, 259000]]],
];

function seedDonSan(kenh, batDauId, tienTo) {
  return DON_SAN_UY_QUYEN.map(([phut, trangThai, ttLazada, ttTiktok, nguoiNhan, yeuCauHuy, dong], i) => {
    const maDon = String(2610200913 - i * 7);
    const daGiao = trangThai === 3 || trangThai === 5 ? 1 : 0;
    const don = seedOrder([
      batDauId + i, `${tienTo}-${maDon}`, kenh, maDon, trangThai, kenh === "LAZADA" ? ttLazada : ttTiktok, null, phut,
      [nguoiNhan, "Q. Cầu Giấy, Hà Nội"].filter(Boolean).join(" · "),
      dong.map(([sku, ten, sl, gia]) => [sku, sku, ten, sl, gia, daGiao]),
    ]);
    don.donBanHang.nguoiNhan = nguoiNhan || null;
    don.donBanHang.yeuCauHuy = kenh === "TIKTOK" && yeuCauHuy;
    return don;
  });
}

const state = { orders: [...SEED.map(seedOrder), ...seedDonSan("LAZADA", 9101, "LZD"), ...seedDonSan("TIKTOK", 9201, "TTS")] };
// Đơn sàn ủy quyền: người nhận (đã che) là hai phần đầu của địa chỉ giao; cờ YEU_CAU_HUY ứng với yeuCauHuy (KH mục C.2)
state.orders.forEach(({ donBanHang: don }) => {
  if (don.kenhBanHang?.maKenh !== "LAZADA" && don.kenhBanHang?.maKenh !== "TIKTOK") return;
  if (don.nguoiNhan === undefined) don.nguoiNhan = String(don.diaChiGiaoHang ?? "").split(" · ").slice(0, 2).join(" · ") || null;
  if (parseFlags(don.canXuLy).includes("YEU_CAU_HUY")) don.yeuCauHuy = true;
  don.yeuCauHuy = Boolean(don.yeuCauHuy);
});

// "Khách yêu cầu hủy" chỉ tính đơn chưa xuất kho, chưa hủy: Nháp, Chờ nhặt hàng, Chờ đóng gói, Chờ xuất kho.
// Cùng định nghĩa với thanh nhắc và bộ lọc ?yeuCauHuy=1 của trang Đơn hàng (TRANG_THAI_CHUA_XUAT_KHO ở ChannelOrdersPage.jsx).
const TRANG_THAI_CHUA_XUAT_KHO = [0, 1, 7, 8];

/** Số đơn khách đang yêu cầu hủy của một kênh (Tổng quan gian hàng TikTok Shop, soYeuCauHuy). */
export function demYeuCauHuy(kenhBanId) {
  return state.orders.filter(
    ({ donBanHang: don }) =>
      don.kenhBanHang?.id === Number(kenhBanId) && don.yeuCauHuy && TRANG_THAI_CHUA_XUAT_KHO.includes(don.trangThai),
  ).length;
}

function findOrder(id) {
  const order = state.orders.find((item) => item.donBanHang.id === Number(id));
  if (!order) throw mockError(404, "Không tìm thấy đơn bán hàng.");
  return order;
}

function setFlags(order, flags) {
  order.donBanHang.canXuLy = flags.length ? flags.join(",") : null;
}

function hanhDong(order) {
  const { trangThai } = order.donBanHang;
  const flags = parseFlags(order.donBanHang.canXuLy);
  return {
    xacNhanHuy: flags.includes("XUNG_DOT_HUY") && order.sanHuyCaDon && [0, 1, 2].includes(trangThai),
    apDungThayDoi: flags.includes("XUNG_DOT_HUY") && !order.sanHuyCaDon && [0, 1].includes(trangThai),
    giuBu: flags.includes("THIEU_HANG") && [0, 1].includes(trangThai),
    xuLyCo: flags.filter((flag) => flag === "HOAN_HANG" || flag === "CAN_KIEM_TRA"),
  };
}

/** Ngày gửi lên không kèm múi giờ hiểu theo giờ Việt Nam, như BaseServiceImpl.chuyenChuoiThoiGian của máy chủ. */
function thoiDiem(value) {
  const chuoi = String(value ?? "").trim().replace(" ", "T");
  if (chuoi.length === 10) return Date.parse(`${chuoi}T00:00:00+07:00`);
  return Date.parse(/(Z|[+-]\d{2}:?\d{2})$/i.test(chuoi) ? chuoi : `${chuoi}+07:00`);
}

/** Phép so của bộ lọc (FilterOperation); IN nhận mảng. */
function soSanh(operation, giaTri, mau) {
  switch (operation) {
    case "IN":
      return Array.isArray(mau) && mau.includes(giaTri);
    case "GREATER_THAN":
      return giaTri > mau;
    case "GREATER_THAN_OR_EQUAL":
      return giaTri >= mau;
    case "LESS_THAN":
      return giaTri < mau;
    case "LESS_THAN_OR_EQUAL":
      return giaTri <= mau;
    default:
      return giaTri === mau;
  }
}

function matchFilter(order, filter) {
  const value = filter.value;
  const don = order.donBanHang;
  const moiGiaTri = (doi) => (Array.isArray(value) ? value.map(doi) : doi(value));
  switch (filter.fieldName) {
    case "loaiChungTu":
      return don.loaiChungTu === value;
    case "soDonHang":
      return normalizeText(don.soDonHang).includes(normalizeText(value));
    case "trangThai":
      // Tab nhiều trạng thái (Đã hủy / hoàn trả) gửi IN với mảng
      return Array.isArray(value) ? value.map(Number).includes(don.trangThai) : don.trangThai === Number(value);
    case "kenhBanHang.id":
      return soSanh(filter.operation, don.kenhBanHang?.id, moiGiaTri(Number));
    case "kenhBanHang.maKenh":
      return soSanh(filter.operation, String(don.kenhBanHang?.maKenh ?? "").toUpperCase(), moiGiaTri((v) => String(v).toUpperCase()));
    case "khoXuat.id":
      return soSanh(filter.operation, don.khoXuat?.id, moiGiaTri(Number));
    case "ngayDatHang":
      return soSanh(filter.operation, Date.parse(don.ngayDatHang), moiGiaTri(thoiDiem));
    case "yeuCauHuy":
      return Boolean(don.yeuCauHuy) === (value === true || value === "true");
    default:
      return true;
  }
}

// Như API thật: không gửi thứ tự thì đơn đặt mới nhất trước
const THU_TU_MAC_DINH = [
  { fieldName: "ngayDatHang", direction: "DESC" },
  { fieldName: "id", direction: "DESC" },
];

/** Xếp theo `sorts` của yêu cầu (trường lồng "a.b" được), giá trị trống xếp cuối. */
function xepTheo(sorts) {
  const ds = sorts?.length ? sorts : THU_TU_MAC_DINH;
  const lay = (don, truong) => truong.split(".").reduce((v, k) => v?.[k], don);
  return (a, b) => {
    for (const { fieldName, direction } of ds) {
      const x = lay(a.donBanHang, fieldName);
      const y = lay(b.donBanHang, fieldName);
      if (x === y) continue;
      if (x == null) return 1;
      if (y == null) return -1;
      const ss = x < y ? -1 : 1;
      return String(direction).toUpperCase() === "DESC" ? -ss : ss;
    }
    return 0;
  };
}

export const donBanHangKenhMock = {
  async filterDonBan(payload = {}) {
    await mockDelay();
    const filters = payload.filters ?? [];
    const list = state.orders
      .filter((order) => filters.every((filter) => matchFilter(order, filter)))
      .sort(xepTheo(payload.sorts))
      .map((order) => clone(order.donBanHang));
    return paginate(list, payload.page, payload.size);
  },

  async getDetail(id) {
    await mockDelay();
    const order = findOrder(id);
    return { status: 200, data: clone({ donBanHang: order.donBanHang, chiTiet: order.chiTiet, phieuXuatKhoList: order.phieuXuatKhoList }) };
  },

  async markAsDelivered(id) {
    await mockDelay();
    const order = findOrder(id);
    if (order.donBanHang.trangThai !== 3) throw mockError(409, "Chỉ xác nhận đã giao khi đơn đã xuất kho đủ.");
    order.donBanHang.trangThai = 5;
    order.chiTiet.forEach((ct) => {
      ct.soLuongDaGiao = ct.soLuongDat;
    });
    return { status: 200, data: null };
  },

  async getThongTinKenh(id) {
    await mockDelay();
    const order = findOrder(id);
    const don = order.donBanHang;
    if (!don.ketNoiKenhId) throw mockError(404, "Đơn này không phải đơn từ sàn.");
    const ketNoi = Object.values(KET_NOI).find((kn) => kn.id === don.ketNoiKenhId);
    return {
      ketNoiKenhId: don.ketNoiKenhId,
      maKenh: don.kenhBanHang.maKenh,
      tenKenh: don.kenhBanHang.tenKenh,
      tenHienThi: ketNoi?.tenHienThi,
      maDonHangKenh: don.maDonHangKenh,
      trangThaiSan: don.trangThaiSan,
      ngayCapNhatSan: don.ngayCapNhatSan,
      canXuLy: parseFlags(don.canXuLy),
      hanhDong: hanhDong(order),
      giuCho: clone(order.giuCho),
    };
  },

  async xacNhanHuy(id, { lyDo } = {}) {
    await mockDelay(400, 700);
    const order = findOrder(id);
    if (!hanhDong(order).xacNhanHuy) throw mockError(409, "Đơn không còn ở trạng thái cần xác nhận hủy.");
    if (order.donBanHang.ketNoiKenhId === KET_NOI.LAZADA.id && !lyDo?.trim()) {
      throw mockError(400, "Kết nối không còn hoạt động, vui lòng nhập lý do hủy.");
    }
    order.donBanHang.trangThai = 4;
    setFlags(order, []);
    order.giuCho = order.giuCho.map((row) => ({ ...row, trangThai: "da_nha" }));
    return null;
  },

  async apDungThayDoi(id) {
    await mockDelay(400, 700);
    const order = findOrder(id);
    if (!hanhDong(order).apDungThayDoi) throw mockError(409, "Không còn thay đổi nào từ sàn để áp dụng.");
    setFlags(order, parseFlags(order.donBanHang.canXuLy).filter((flag) => flag !== "XUNG_DOT_HUY"));
    return null;
  },

  async giuBu(id) {
    await mockDelay(300, 500);
    const order = findOrder(id);
    if (!hanhDong(order).giuBu) throw mockError(409, "Đơn không thiếu hàng.");
    order.giuCho = order.chiTiet.map((ct, index) => ({
      chiTietId: ct.id, maSku: ct.sku, maLo: `LO-2026-0${index + 3}`, soLuong: ct.soLuongDat, trangThai: "dang_giu",
    }));
    setFlags(order, parseFlags(order.donBanHang.canXuLy).filter((flag) => flag !== "THIEU_HANG"));
    return { du: true };
  },

  async xuLyCo(id, { co, ghiChu } = {}) {
    await mockDelay(300, 500);
    const order = findOrder(id);
    if (!ghiChu?.trim()) throw mockError(400, "Vui lòng nhập ghi chú xử lý.");
    if (!hanhDong(order).xuLyCo.includes(co)) throw mockError(409, "Cờ này không còn trên đơn.");
    setFlags(order, parseFlags(order.donBanHang.canXuLy).filter((flag) => flag !== co));
    return null;
  },
};
