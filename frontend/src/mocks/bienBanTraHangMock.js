// Dữ liệu mẫu cho biên bản trả hàng nhà cung cấp (FO-099).
// Chạy khi máy chủ chưa có API (cờ *_DA_CO_MAY_CHU còn false); tắt bằng VITE_NHAP_KHO_MOCK=false.
// Biên bản lập trong phiên được giữ trong bộ nhớ trình duyệt, tải lại trang là mất.
import { clone, mockDelay, mockError } from "./mockHelpers";

const p2 = (n) => String(n).padStart(2, "0");
const bienBans = new Map();
let soThuTu = 1;

export const bienBanTraHangMock = {
  async layTheoPhieuNhap(phieuNhapKhoId) {
    await mockDelay();
    const bb = bienBans.get(Number(phieuNhapKhoId));
    return bb ? clone(bb) : null;
  },

  async phatHanh(phieuNhapKhoId, payload) {
    await mockDelay();
    const key = Number(phieuNhapKhoId);
    if (bienBans.has(key)) throw mockError(409, "Phiếu nhập này đã có biên bản trả hàng.");
    const d = new Date();
    const bb = {
      id: soThuTu,
      soBienBan: `BBTH-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(soThuTu++)}`,
      phuongAn: payload?.phuongAn,
      ghiChu: payload?.ghiChu ?? "",
      ngayLap: d.toISOString(),
      items: clone(payload?.items ?? []),
    };
    bienBans.set(key, bb);
    return clone(bb);
  },
};
