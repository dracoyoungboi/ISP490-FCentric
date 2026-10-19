/**
 * Bộ nhớ "Đồng bộ ngay" dùng chung cho các trang của một gian hàng (Tổng quan, Sản phẩm, Đơn hàng),
 * giữ trong bộ nhớ của tab trình duyệt (tải lại trang là mất), theo mã kênh:
 * - `phien`: ảnh chụp đợt gần nhất đã nhận từ máy chủ;
 * - `theoDoi`: mã đợt mà một trang đã bấm hoặc đã thấy đang chạy (kết quả của đợt này mới được báo lại);
 * - `daXem`: mã đợt mà người dùng đã mở xem kết quả rồi đóng.
 * Nhờ vậy chuyển trang trong lúc đang đồng bộ, trang mới hiện ngay tiến độ thay vì nháy "Đồng bộ ngay"
 * trong lúc chờ lần hỏi đầu; kết quả chưa xem vẫn hiện ở trang mới.
 * Trang đang mở nghe thay đổi (`ngheBoNho`): bấm Đồng bộ ngay rồi chuyển trang ngay, đợt vừa bắt đầu vẫn tới trang mới.
 * Mã bộ nhớ do trang truyền vào (gồm cả người đang đăng nhập) nên đăng xuất rồi người khác vào không thấy lại.
 */

const RONG = Object.freeze({ phien: null, theoDoi: null, daXem: null });
const boNho = new Map();
const nguoiNghe = new Map();

const khoa = (maKenh) => String(maKenh || "").trim().toUpperCase();

export function docBoNho(maKenh) {
  return boNho.get(khoa(maKenh)) ?? RONG;
}

/** Ghi đè một phần mục của kênh, báo cho các trang đang nghe; trả mục mới. */
export function ghiBoNho(maKenh, thayDoi) {
  const k = khoa(maKenh);
  const moi = { ...docBoNho(maKenh), ...thayDoi };
  boNho.set(k, moi);
  // Báo giá trị mới nhất (không phải `moi`): người nghe ghi lồng lúc đang được báo thì người sau vẫn nhận bản cuối
  const ds = nguoiNghe.get(k);
  if (ds) [...ds].forEach((nghe) => nghe(boNho.get(k)));
  return moi;
}

/** Nghe mọi lần ghi vào mục của kênh; trả hàm thôi nghe. */
export function ngheBoNho(maKenh, nghe) {
  const k = khoa(maKenh);
  const ds = nguoiNghe.get(k) ?? new Set();
  nguoiNghe.set(k, ds);
  ds.add(nghe);
  return () => {
    ds.delete(nghe);
    if (!ds.size && nguoiNghe.get(k) === ds) nguoiNghe.delete(k);
  };
}

/** Chỉ dùng cho kiểm thử (giữ nguyên các trang đang nghe). */
export function xoaBoNho() {
  boNho.clear();
}

/**
 * Trạng thái ban đầu của một trang vừa mở, dựng từ mục bộ nhớ:
 * - đợt đang chạy: trang theo dõi luôn, xong thì báo (`daThayChay`);
 * - đợt đã xong mà trang khác theo dõi: vẫn là "của trang này" để hiện kết quả chưa xem, nhưng đánh dấu đã báo
 *   (`daBaoXong`) để không tải lại số liệu lần nữa — trang vừa mở tự tải số liệu mới rồi.
 * - đợt cũ không ai theo dõi: chỉ giữ ảnh chụp, không coi là của trang này.
 */
export function trangThaiDau(muc) {
  const phien = muc?.phien ?? null;
  const ma = phien?.maPhien ?? null;
  if (!ma) return { phien, maTheoDoi: null, daXem: muc?.daXem ?? null, daThayChay: [], daBaoXong: [] };
  if (phien.trangThai === "dang_chay") {
    return { phien, maTheoDoi: ma, daXem: muc.daXem ?? null, daThayChay: [ma], daBaoXong: [] };
  }
  const daTheoDoi = muc.theoDoi === ma;
  return {
    phien,
    maTheoDoi: daTheoDoi ? ma : null,
    daXem: muc.daXem ?? null,
    daThayChay: daTheoDoi ? [ma] : [],
    daBaoXong: daTheoDoi ? [ma] : [],
  };
}
