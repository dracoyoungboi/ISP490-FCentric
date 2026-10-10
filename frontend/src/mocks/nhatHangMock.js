// Dữ liệu mẫu cho luồng Đơn chờ xuất → Pick List → quét mã → hoàn tất nhặt.
// Hình dạng dữ liệu bám đúng DTO backend: DonChoXuatDto, DanhSachNhatHangDto,
// ChiTietNhatHangDto, KetQuaQuetBarcodeDto (API-KENH-BAN-HANG.md mục 4).
import { clone, isoMinutesAgo, mockDelay, mockError, normalizeText, paginate } from "./mockHelpers";

const KHO = { id: 1, tenKho: "Kho tổng Hà Nội" };

const STAFF = [
  { id: 39, hoTen: "Nguyễn Văn An", tenDangNhap: "nhanvienkho1", vaiTro: "nhan_vien_kho" },
  { id: 40, hoTen: "Trần Thị Bình", tenDangNhap: "nhanvienkho2", vaiTro: "nhan_vien_kho" },
  { id: 41, hoTen: "Lê Minh Châu", tenDangNhap: "nhanvienkho3", vaiTro: "nhan_vien_kho" },
  { id: 12, hoTen: "Phạm Quốc Dũng", tenDangNhap: "quanlykho1", vaiTro: "quan_ly_kho" },
];

const VARIANTS = {
  77: { maSku: "AO-THUN-DEN-M", maVachSku: "8935001000771", tenSanPham: "Áo thun cotton basic", tenMau: "Đen", maMauHex: "#111827", tenSize: "M", tenChatLieu: "Cotton", viTriKho: "A-01-02" },
  78: { maSku: "AO-THUN-DEN-L", maVachSku: "8935001000788", tenSanPham: "Áo thun cotton basic", tenMau: "Đen", maMauHex: "#111827", tenSize: "L", tenChatLieu: "Cotton", viTriKho: "A-01-03" },
  81: { maSku: "AO-THUN-TRANG-M", maVachSku: "8935001000818", tenSanPham: "Áo thun cotton basic", tenMau: "Trắng", maMauHex: "#F9FAFB", tenSize: "M", tenChatLieu: "Cotton", viTriKho: "A-02-01" },
  93: { maSku: "QUAN-JEAN-XANH-30", maVachSku: "8935001000931", tenSanPham: "Quần jean slim", tenMau: "Xanh đậm", maMauHex: "#1E3A8A", tenSize: "30", tenChatLieu: "Denim", viTriKho: "B-03-01" },
  94: { maSku: "QUAN-JEAN-XANH-32", maVachSku: "8935001000948", tenSanPham: "Quần jean slim", tenMau: "Xanh đậm", maMauHex: "#1E3A8A", tenSize: "32", tenChatLieu: "Denim", viTriKho: "B-03-02" },
  105: { maSku: "SO-MI-OXFORD-XANH-M", maVachSku: "8935001001051", tenSanPham: "Sơ mi oxford", tenMau: "Xanh nhạt", maMauHex: "#BFDBFE", tenSize: "M", tenChatLieu: "Oxford", viTriKho: "C-01-04" },
  112: { maSku: "VAY-MIDI-BE-S", maVachSku: "8935001001129", tenSanPham: "Váy midi xếp ly", tenMau: "Be", maMauHex: "#E7D7C1", tenSize: "S", tenChatLieu: "Voan", viTriKho: "D-02-01" },
  120: { maSku: "AO-KHOAC-GIO-DEN-L", maVachSku: "8935001001204", tenSanPham: "Áo khoác gió", tenMau: "Đen", maMauHex: "#111827", tenSize: "L", tenChatLieu: "Polyester", viTriKho: "E-01-01" },
};

const KENH = {
  SHOPIFY: { kenhBanId: 2, maKenhBan: "SHOPIFY", tenKenhBan: "Shopify" },
  LAZADA: { kenhBanId: 3, maKenhBan: "LAZADA", tenKenhBan: "Lazada" },
  TIKTOK: { kenhBanId: 5, maKenhBan: "TIKTOK", tenKenhBan: "TikTok Shop" },
  NONE: { kenhBanId: null, maKenhBan: null, tenKenhBan: null },
};

// Đơn: trangThai 1 = chờ xuất (chưa vào Pick List), 2 = đang trong Pick List.
const ORDERS = [
  { id: 501, soDonHang: "SO202610101", kenh: "NONE", tenKhachHang: "Công ty TNHH An Phú", minutesAgo: 300, tongCong: 2_450_000, duHang: true, trangThai: 1, lines: [[77, 5], [93, 3], [105, 2]] },
  { id: 502, soDonHang: "SHP-5550011", kenh: "SHOPIFY", tenKhachHang: "Khách Shopify", minutesAgo: 140, tongCong: 640_000, duHang: true, trangThai: 1, lines: [[77, 1], [81, 1]] },
  { id: 503, soDonHang: "SHP-5550012", kenh: "SHOPIFY", tenKhachHang: "Khách Shopify", minutesAgo: 95, tongCong: 459_000, duHang: true, trangThai: 1, lines: [[94, 1]] },
  { id: 504, soDonHang: "LZD-781203344", kenh: "LAZADA", tenKhachHang: "Khách Lazada", minutesAgo: 80, tongCong: 890_000, duHang: true, trangThai: 1, lines: [[112, 2]] },
  { id: 505, soDonHang: "TTS-57720019931", kenh: "TIKTOK", tenKhachHang: "Khách TikTok Shop", minutesAgo: 60, tongCong: 1_150_000, duHang: true, trangThai: 1, lines: [[120, 1], [78, 2]] },
  { id: 506, soDonHang: "SO202610102", kenh: "NONE", tenKhachHang: "Shop Thời trang Mộc", minutesAgo: 45, tongCong: 3_960_000, duHang: false, trangThai: 1, lines: [[93, 6], [94, 6]] },
  { id: 507, soDonHang: "SHP-5550013", kenh: "SHOPIFY", tenKhachHang: "Khách Shopify", minutesAgo: 20, tongCong: 320_000, duHang: true, trangThai: 1, lines: [[81, 1]] },
  // Đã vào Pick List
  { id: 480, soDonHang: "SO202610091", kenh: "NONE", tenKhachHang: "Công ty CP Minh Long", minutesAgo: 1500, tongCong: 1_280_000, duHang: true, trangThai: 2, lines: [[77, 2], [105, 2]] },
  { id: 481, soDonHang: "SHP-5550007", kenh: "SHOPIFY", tenKhachHang: "Khách Shopify", minutesAgo: 1450, tongCong: 459_000, duHang: true, trangThai: 2, lines: [[93, 1]] },
  { id: 490, soDonHang: "SO202610095", kenh: "NONE", tenKhachHang: "Shop Thời trang Mộc", minutesAgo: 240, tongCong: 1_890_000, duHang: true, trangThai: 2, lines: [[78, 3], [120, 1]] },
  { id: 491, soDonHang: "SHP-5550009", kenh: "SHOPIFY", tenKhachHang: "Khách Shopify", minutesAgo: 230, tongCong: 640_000, duHang: true, trangThai: 2, lines: [[81, 2]], canXuLy: "XUNG_DOT_HUY" },
  { id: 495, soDonHang: "LZD-781200019", kenh: "LAZADA", tenKhachHang: "Khách Lazada", minutesAgo: 120, tongCong: 445_000, duHang: true, trangThai: 2, lines: [[112, 1]] },
];

let lineSeq = 9000;

function buildLines(orderIds, scanned = {}) {
  const map = new Map();
  orderIds.forEach((orderId) => {
    const order = state.orders.find((o) => o.id === orderId);
    order?.lines.forEach(([bienTheId, qty]) => {
      map.set(bienTheId, (map.get(bienTheId) ?? 0) + qty);
    });
  });
  return [...map.entries()].map(([bienTheId, canNhat]) => ({
    id: (lineSeq += 1),
    bienTheSanPhamId: bienTheId,
    ...VARIANTS[bienTheId],
    anhBienTheUrl: null,
    soLuongCanNhat: canNhat,
    soLuongDaQuet: Math.min(scanned[bienTheId] ?? 0, canNhat),
  }));
}

const state = {
  orders: clone(ORDERS),
  pickLists: [],
  seq: 3,
};

state.pickLists = [
  { id: 31, maPickList: "PL-20261009-004", nguoiNhatId: 39, trangThai: "da_nhat", ghiChu: "Ca chiều", ngayTao: isoMinutesAgo(1440), ngayHoanTat: isoMinutesAgo(1380), donHangIds: [480, 481] },
  { id: 32, maPickList: "PL-20261010-001", nguoiNhatId: 40, trangThai: "dang_nhat", ghiChu: null, ngayTao: isoMinutesAgo(220), ngayHoanTat: null, donHangIds: [490, 491] },
  { id: 33, maPickList: "PL-20261010-002", nguoiNhatId: null, trangThai: "cho_nhat", ghiChu: "Ưu tiên đơn Lazada", ngayTao: isoMinutesAgo(110), ngayHoanTat: null, donHangIds: [495] },
  { id: 30, maPickList: "PL-20261009-003", nguoiNhatId: 41, trangThai: "da_huy", ghiChu: "Gỡ hết đơn", ngayTao: isoMinutesAgo(1600), ngayHoanTat: null, donHangIds: [] },
];
state.pickLists[0].lines = buildLines([480, 481], { 77: 2, 105: 2, 93: 1 });
state.pickLists[1].lines = buildLines([490, 491], { 78: 2, 120: 1 });
state.pickLists[2].lines = buildLines([495]);
state.pickLists[3].lines = [];

function findPickList(id) {
  const pl = state.pickLists.find((item) => item.id === Number(id));
  if (!pl) throw mockError(404, "Không tìm thấy Pick List.");
  return pl;
}

function toDto(pl) {
  const lines = pl.lines.map((line) => ({ ...line }));
  const tongCan = lines.reduce((s, l) => s + l.soLuongCanNhat, 0);
  const tongQuet = lines.reduce((s, l) => s + Math.min(l.soLuongDaQuet, l.soLuongCanNhat), 0);
  const orders = pl.donHangIds.map((id) => state.orders.find((o) => o.id === id)).filter(Boolean);
  const nguoiNhat = STAFF.find((s) => s.id === pl.nguoiNhatId);
  return {
    id: pl.id,
    maPickList: pl.maPickList,
    khoXuatId: KHO.id,
    tenKhoXuat: KHO.tenKho,
    nguoiNhatId: pl.nguoiNhatId,
    tenNguoiNhat: pl.nguoiNhatId ? nguoiNhat?.hoTen ?? "Bạn" : null,
    trangThai: pl.trangThai,
    ghiChu: pl.ghiChu,
    ngayTao: pl.ngayTao,
    ngayHoanTat: pl.ngayHoanTat,
    tongDonHang: orders.length,
    tongSku: lines.filter((l) => l.soLuongCanNhat > 0).length,
    tongSoLuongCanNhat: tongCan,
    tongSoLuongDaQuet: tongQuet,
    phanTramHoanThanh: tongCan > 0 ? Math.round((tongQuet / tongCan) * 10000) / 100 : 0,
    coTheHoanTat: tongCan > 0 && lines.every((l) => l.soLuongDaQuet >= l.soLuongCanNhat) && ["cho_nhat", "dang_nhat"].includes(pl.trangThai),
    danhSachMaDonHang: orders.map((o) => o.soDonHang),
    chiTietNhatHangs: lines,
  };
}

function toDonChoXuat(order) {
  const tongSoLuong = order.lines.reduce((s, [, qty]) => s + qty, 0);
  return {
    id: order.id,
    soDonHang: order.soDonHang,
    ...KENH[order.kenh],
    khachHangId: 1000 + order.id,
    tenKhachHang: order.tenKhachHang,
    khoXuatId: KHO.id,
    tenKhoXuat: KHO.tenKho,
    ngayTao: isoMinutesAgo(order.minutesAgo),
    soLuongSku: order.lines.length,
    tongSoLuong,
    khaDung: order.duHang ? "Đủ hàng" : "Thiếu hàng",
    duHang: order.duHang,
    trangThai: "Chờ nhặt",
    tongCong: order.tongCong,
  };
}

function todayCode() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export const nhatHangMock = {
  async getDonChoXuat(filter = {}) {
    await mockDelay();
    const keyword = normalizeText(filter.searchText);
    const list = state.orders
      .filter((o) => o.trangThai === 1 && !o.canXuLy)
      .filter((o) => !filter.kenhBanId || KENH[o.kenh].kenhBanId === Number(filter.kenhBanId))
      .filter((o) => !keyword || normalizeText(`${o.soDonHang} ${o.tenKhachHang}`).includes(keyword))
      .sort((a, b) => b.minutesAgo - a.minutesAgo)
      .map(toDonChoXuat);
    return paginate(list, filter.page, filter.size);
  },

  async taoPickList({ donBanHangIds = [], ghiChu, nguoiNhatId } = {}) {
    await mockDelay(250, 450);
    if (!donBanHangIds.length) throw mockError(400, "Danh sách ID đơn hàng không được để trống");
    const invalid = donBanHangIds
      .map((id) => state.orders.find((o) => o.id === id))
      .find((o) => !o || o.trangThai !== 1 || o.canXuLy);
    if (invalid) {
      throw mockError(409, `Đơn ${invalid?.soDonHang ?? ""} không còn ở trạng thái chờ xuất. Vui lòng tải lại danh sách.`);
    }
    state.seq += 1;
    const id = 40 + state.seq;
    const pl = {
      id,
      maPickList: `PL-${todayCode()}-${String(state.seq).padStart(3, "0")}`,
      nguoiNhatId: nguoiNhatId ?? null,
      trangThai: "cho_nhat",
      ghiChu: ghiChu?.trim() || null,
      ngayTao: new Date().toISOString(),
      ngayHoanTat: null,
      donHangIds: [...donBanHangIds],
    };
    pl.lines = buildLines(pl.donHangIds);
    donBanHangIds.forEach((orderId) => {
      const order = state.orders.find((o) => o.id === orderId);
      order.trangThai = 2;
    });
    state.pickLists.unshift(pl);
    return toDto(pl);
  },

  async getPickLists({ trangThai, searchText, page = 0, size = 10 } = {}) {
    await mockDelay();
    const keyword = normalizeText(searchText);
    const list = state.pickLists
      .filter((pl) => !trangThai || pl.trangThai === trangThai)
      .filter((pl) => !keyword || normalizeText(pl.maPickList).includes(keyword))
      .sort((a, b) => new Date(b.ngayTao) - new Date(a.ngayTao))
      .map(toDto);
    return paginate(list, page, size);
  },

  async getPickList(id) {
    await mockDelay();
    return toDto(findPickList(id));
  },

  async phanCong(id, { nguoiNhatId } = {}) {
    await mockDelay();
    const pl = findPickList(id);
    if (!["cho_nhat", "dang_nhat"].includes(pl.trangThai)) {
      throw mockError(409, "Pick List đã hoàn tất hoặc đã hủy, không phân công được nữa.");
    }
    if (!nguoiNhatId) throw mockError(400, "ID nhân viên nhặt hàng không được để trống");
    pl.nguoiNhatId = nguoiNhatId;
    return toDto(pl);
  },

  async quetBarcode(id, { barcode, soLuong } = {}) {
    await mockDelay(80, 160);
    const pl = findPickList(id);
    if (!["cho_nhat", "dang_nhat"].includes(pl.trangThai)) {
      throw mockError(409, "Pick List không còn ở trạng thái nhặt hàng.");
    }
    const code = normalizeText(barcode);
    const line = pl.lines.find((l) => normalizeText(l.maVachSku) === code || normalizeText(l.maSku) === code);
    if (!line) throw mockError(400, `Mã "${barcode}" không có trong Pick List này.`);
    const qty = Number(soLuong) > 0 ? Number(soLuong) : 1;
    if (line.soLuongDaQuet + qty > line.soLuongCanNhat) {
      throw mockError(400, `${line.maSku} đã nhặt đủ (${line.soLuongDaQuet}/${line.soLuongCanNhat}).`);
    }
    line.soLuongDaQuet += qty;
    pl.trangThai = "dang_nhat";
    const dto = toDto(pl);
    return {
      chiTietId: line.id,
      bienTheId: line.bienTheSanPhamId,
      maSku: line.maSku,
      maVachSku: line.maVachSku,
      tenSanPham: line.tenSanPham,
      tenMau: line.tenMau,
      tenSize: line.tenSize,
      viTriKho: line.viTriKho,
      soLuongCanNhat: line.soLuongCanNhat,
      soLuongDaQuet: line.soLuongDaQuet,
      soLuongConLai: line.soLuongCanNhat - line.soLuongDaQuet,
      trangThaiDong: line.soLuongDaQuet >= line.soLuongCanNhat ? "da_xong" : "dang_nhat",
      tongSoLuongCanNhat: dto.tongSoLuongCanNhat,
      tongSoLuongDaQuet: dto.tongSoLuongDaQuet,
      tongSoLuongConLai: dto.tongSoLuongCanNhat - dto.tongSoLuongDaQuet,
      phanTramHoanThanh: dto.phanTramHoanThanh,
      coTheHoanTat: dto.coTheHoanTat,
      thongBao: `Đã quét ${qty}x ${line.tenSanPham} ${line.tenMau}/${line.tenSize} (${line.soLuongDaQuet}/${line.soLuongCanNhat})`,
    };
  },

  async hoanTat(id) {
    await mockDelay(300, 500);
    const pl = findPickList(id);
    const dto = toDto(pl);
    if (!dto.coTheHoanTat) throw mockError(409, "Chưa nhặt đủ hàng, chưa thể hoàn tất Pick List.");
    pl.trangThai = "da_nhat";
    pl.ngayHoanTat = new Date().toISOString();
    return toDto(pl);
  },


  async getNguoiNhat() {
    await mockDelay();
    return clone(STAFF);
  },
};
