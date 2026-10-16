/**
 * Lưu tạm trong phiên trình duyệt (sessionStorage) những gì máy chủ chưa lưu được khi kiểm đếm:
 * - hàng lỗi theo lô (máy chủ chưa có API hàng lỗi, FO-098),
 * - thùng đang kiểm chưa khóa (để tải lại trang không mất số đã quét).
 * Đóng thẻ trình duyệt là mất. Khi backend có API hàng lỗi thì bỏ phần hàng lỗi ở đây.
 */
const KHOA_LOI = (phieuId) => `fcentric:hang-loi:${phieuId}`;
const KHOA_THUNG = (phieuId, bienTheId) => `fcentric:thung-dang-kiem:${phieuId}:${bienTheId}`;

function doc(khoa, macDinh) {
  try {
    const raw = window.sessionStorage.getItem(khoa);
    return raw ? JSON.parse(raw) : macDinh;
  } catch {
    return macDinh;
  }
}

function ghi(khoa, giaTri) {
  try {
    if (giaTri == null) window.sessionStorage.removeItem(khoa);
    else window.sessionStorage.setItem(khoa, JSON.stringify(giaTri));
  } catch {
    // Trình duyệt chặn bộ nhớ phiên: vẫn chạy, chỉ không giữ được khi tải lại trang
  }
}

/** { [bienTheId]: [{ maLo, lyDo, soLuong }] } */
export function docHangLoi(phieuId) {
  return doc(KHOA_LOI(phieuId), {});
}

export function hangLoiCuaBienThe(phieuId, bienTheId) {
  return docHangLoi(phieuId)[bienTheId] ?? [];
}

/** Thêm các dòng lỗi của một lô vừa khóa. */
export function themHangLoi(phieuId, bienTheId, dong) {
  const tatCa = docHangLoi(phieuId);
  tatCa[bienTheId] = [...(tatCa[bienTheId] ?? []), ...dong.filter((d) => d.soLuong > 0)];
  ghi(KHOA_LOI(phieuId), tatCa);
}

/** Lô bị xóa thì bỏ luôn hàng lỗi của lô đó. */
export function xoaHangLoiCuaLo(phieuId, bienTheId, maLo) {
  const tatCa = docHangLoi(phieuId);
  if (!tatCa[bienTheId]) return;
  tatCa[bienTheId] = tatCa[bienTheId].filter((d) => d.maLo !== maLo);
  ghi(KHOA_LOI(phieuId), tatCa);
}

export const tongSoLuong = (dong) => (dong ?? []).reduce((tong, d) => tong + (Number(d.soLuong) || 0), 0);

/** Thùng đang kiểm: { dat, loi: [{ lyDo, soLuong }], maLo, ngaySanXuat, viTriId } hoặc null. */
export function docThungDangKiem(phieuId, bienTheId) {
  return doc(KHOA_THUNG(phieuId, bienTheId), null);
}

export function ghiThungDangKiem(phieuId, bienTheId, thung) {
  ghi(KHOA_THUNG(phieuId, bienTheId), thung);
}
