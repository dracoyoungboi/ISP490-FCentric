// Dữ liệu mẫu cho liên kết mã vạch nhà cung cấp ↔ biến thể (FO-095).
// Chạy khi máy chủ chưa có API (cờ *_DA_CO_MAY_CHU còn false); tắt bằng VITE_NHAP_KHO_MOCK=false.
// Liên kết tạo ở màn kiểm đếm được giữ trong bộ nhớ trình duyệt, tải lại trang là về ban đầu.
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { clone, isoMinutesAgo, mockDelay, mockError, normalizeText, paginate } from "./mockHelpers";

const NCC_MAU = [
  { id: 9001, tenNhaCungCap: "Xưởng may Việt Hưng" },
  { id: 9002, tenNhaCungCap: "May Minh Phát" },
];

// [mã vạch, mã hàng NCC, chỉ số NCC, tên biến thể, SKU, số phiếu nhập, ngày trước]
const LIEN_KET_MAU = [
  ["8935001234021", "VH-AT-01", 0, "Áo thun Oversize · Đen / M", "AT2610-DEN-M", "PNK-20261016-005", 0],
  ["8935001234038", "VH-AT-02", 0, "Áo thun Oversize · Trắng / L", "AT2610-TRG-L", "PNK-20261016-005", 0],
  ["VH-TS-0192", "VH-TS-01", 0, "Áo thun Basic · Xám / S", "AT2611-XAM-S", "PNK-20261014-003", 2],
  ["8935001234106", null, 1, "Quần short Active · Đen / L", "QS2610-DEN-L", "PNK-20261013-002", 3],
  ["MV-2026-0045", "MV-QS-07", 1, "Quần short Active · Be / M", "QS2610-BE-M", "PNK-20261013-002", 3],
  ["8935001234205", "MV-AK-02", 1, "Áo khoác lót lông · Be / S", "AK2610-BE-S", "PNK-20261010-001", 6],
  ["8935001239911", null, 1, "Áo polo Classic · Navy / XL", "PL2610-NVY-XL", "PNK-20261010-001", 6],
];

let idTiep = 1;
const lienKets = LIEN_KET_MAU.map(([maVach, maHangNcc, ncc, tenBienThe, sku, soPhieuNhap, ngay], i) => ({
  id: idTiep++,
  maVach,
  maHangNcc,
  nhaCungCapId: NCC_MAU[ncc].id,
  tenNhaCungCap: NCC_MAU[ncc].tenNhaCungCap,
  bienTheSanPhamId: 8000 + i,
  tenBienThe,
  sku,
  ngayLienKet: isoMinutesAgo(ngay * 1440 + 60),
  phieuNhapKhoId: null,
  soPhieuNhap,
}));

export const maVachNhaCungCapMock = {
  /** Danh sách nhà cung cấp cho ô lọc: mẫu + nhà cung cấp thật đã liên kết trong phiên. */
  async dsNhaCungCap() {
    await mockDelay();
    const ds = new Map(NCC_MAU.map((n) => [n.id, n]));
    for (const l of lienKets) if (!ds.has(l.nhaCungCapId)) ds.set(l.nhaCungCapId, { id: l.nhaCungCapId, tenNhaCungCap: l.tenNhaCungCap });
    return [...ds.values()];
  },

  async timKiem({ q, nhaCungCapId, page = 0, size = 20 } = {}) {
    await mockDelay();
    const tu = normalizeText(q);
    const kq = lienKets
      .filter((l) => !nhaCungCapId || l.nhaCungCapId === Number(nhaCungCapId))
      .filter((l) => !tu || [l.maVach, l.maHangNcc, l.sku, l.tenBienThe].some((x) => normalizeText(x).includes(tu)))
      .sort((a, b) => String(b.ngayLienKet).localeCompare(String(a.ngayLienKet)));
    return clone(paginate(kq, page, size));
  },

  async tra(maVach, nhaCungCapId) {
    await mockDelay(80, 150);
    const l = lienKets.find((x) => x.maVach === maVach && (!nhaCungCapId || x.nhaCungCapId === Number(nhaCungCapId)));
    return l ? clone(l) : null;
  },

  /** Lấy tên biến thể từ phiếu nhập thật (API phiếu nhập đã có) để bảng tra cứu hiện đúng tên. */
  async lienKet({ maVach, maHangNcc, nhaCungCapId, bienTheSanPhamId, phieuNhapKhoId }) {
    await mockDelay();
    if (lienKets.some((x) => x.maVach === maVach && x.nhaCungCapId === Number(nhaCungCapId))) {
      throw mockError(409, `Mã ${maVach} đã được liên kết.`);
    }
    let phieu = null;
    try {
      const res = await phieuNhapKhoService.getDetail(phieuNhapKhoId);
      phieu = res?.data ?? res;
    } catch {
      phieu = null;
    }
    const item = phieu?.items?.find((i) => i.bienTheSanPhamId === Number(bienTheSanPhamId));
    const moi = {
      id: idTiep++,
      maVach,
      maHangNcc: maHangNcc ?? null,
      nhaCungCapId: Number(nhaCungCapId),
      tenNhaCungCap: phieu?.tenNhaCungCap ?? "Nhà cung cấp",
      bienTheSanPhamId: Number(bienTheSanPhamId),
      tenBienThe: item?.tenBienThe ?? `Biến thể #${bienTheSanPhamId}`,
      sku: item?.sku ?? "",
      ngayLienKet: new Date().toISOString(),
      phieuNhapKhoId: phieuNhapKhoId ?? null,
      soPhieuNhap: phieu?.soPhieuNhap ?? null,
    };
    lienKets.push(moi);
    return clone(moi);
  },

  async huyLienKet(id) {
    await mockDelay();
    const i = lienKets.findIndex((x) => x.id === Number(id));
    if (i < 0) throw mockError(404, "Không tìm thấy liên kết.");
    lienKets.splice(i, 1);
    return null;
  },
};
