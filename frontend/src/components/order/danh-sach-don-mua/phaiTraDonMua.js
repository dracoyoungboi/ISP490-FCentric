// Số phải trả nhà cung cấp của một đơn mua: máy chủ tính (DonMuaHangService.tinhPhaiTra), giao diện chỉ đọc và quyết định
// có hiện hộp cách tính hay không. Không import "@/": chạy được bằng node --test.

/** Mã trạng thái đơn mua (constants/donMuaHang.js). */
const DANG_VAN_CHUYEN = 3;
const DA_HUY = 7;

function so(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Tóm tắt ô Phải trả.
 * - `phaiTra`: số hiện trong ô; `null` khi đơn đã hủy (hiện "—"). Máy chủ cũ chưa có trường thì lấy `tongTien`.
 * - `coChiTiet`: có điều chỉnh (trừ hàng lỗi, đóng thiếu) hoặc còn hàng lỗi chưa chốt cách bù → số bấm được, mở hộp.
 * - `tienTheoDat`, `giamTruLoi`, `soLoiTruTien`, `khongGiao`, `soKhongGiao`, `soLoiChoChot`: các dòng của hộp.
 */
export function tomTatPhaiTra(don) {
  if (Number(don?.trangThai) === DA_HUY) {
    return { phaiTra: null, coChiTiet: false };
  }
  const coMayChu = don?.phaiTra != null;
  const phaiTra = coMayChu ? so(don.phaiTra) : don?.tongTien != null ? so(don.tongTien) : null;
  const giamTruLoi = so(don?.giamTruLoi);
  const khongGiao = so(don?.khongGiao);
  const soLoiChoChot = Math.max(0, Math.trunc(so(don?.soLoiChoChot)));
  return {
    phaiTra,
    coChiTiet: coMayChu && (giamTruLoi > 0 || khongGiao > 0 || soLoiChoChot > 0),
    tienTheoDat: don?.tienTheoDat != null ? so(don.tienTheoDat) : phaiTra,
    giamTruLoi,
    soLoiTruTien: Math.max(0, Math.trunc(so(don?.soLoiTruTien))),
    khongGiao,
    soKhongGiao: Math.max(0, Math.trunc(so(don?.soKhongGiao))),
    soLoiChoChot,
  };
}

/**
 * Nút Tạo phiếu nhập kho ở danh sách: chỉ đơn Đang vận chuyển. Đơn Đã nhận đủ không còn gì để nhập (máy chủ báo 409),
 * đơn đã đóng / hủy không nhập thêm được.
 */
export function coTheTaoPhieuNhap(don) {
  return Number(don?.trangThai) === DANG_VAN_CHUYEN;
}
