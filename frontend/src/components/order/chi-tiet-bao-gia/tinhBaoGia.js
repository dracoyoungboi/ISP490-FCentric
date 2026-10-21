/*
 * Hàm thuần cho màn Chi tiết báo giá (bản "một khối") và phần đọc giá dùng chung với So sánh báo giá:
 * dòng đã có giá, thành tiền, tổng cả báo giá, nhãn suy diễn "Chờ báo giá", 4 bước tiến trình, lý do khóa "Chấp nhận".
 * Không gọi API, không phụ thuộc React, chạy được bằng `node --test`.
 *
 * Quy ước dữ liệu (backend nhánh Khang, DonMuaHangService):
 * - Gửi yêu cầu báo giá tạo cho mỗi nhà cung cấp một don_mua_hang ở trạng thái 2, mọi `donGia` = 0, `thanhTien` = 0.
 *   Nhà cung cấp gửi giá qua cổng báo giá: vẫn trạng thái 2, máy chủ điền `donGia`, `thanhTien`, `tongTien`.
 *   Vì vậy "nhà cung cấp đã gửi giá" chỉ đọc được từ `donGia > 0` (cùng cách supplier-portal/baoGiaUtils).
 * - 3: chấp nhận (thành đơn mua hàng cùng mã) · 4: không chấp nhận (máy chủ gửi email lý do mặc định) ·
 *   5: đã nhận đủ hàng · 0: đã xóa · 1: chỉ đơn tạo tay (đã gửi, chờ giá).
 */
import { docSo, soVN, tuBienThe } from "../../chung-tu/bangChungTu.js";

export const TRANG_THAI_BAO_GIA = Object.freeze({
  DA_XOA: 0,
  DA_GUI: 1,
  CHO_CHOT: 2,
  DA_CHOT: 3,
  TU_CHOI: 4,
  DA_NHAN_DU: 5,
});

/** Nhãn suy ra ở giao diện cho báo giá trạng thái 2 mà nhà cung cấp chưa gửi giá dòng nào (có trong constants/trangThai.js). */
export const NHAN_CHO_BAO_GIA = "Chờ báo giá";

/** Lý do backend luôn gửi trong email khi không chấp nhận báo giá (PUT duyet-don/{id}/4 không nhận lý do). */
export const LY_DO_TU_CHOI_MAC_DINH = "Giá cả chưa phù hợp";

/** Báo giá đã chấp nhận: thành đơn mua hàng (3) hoặc đã nhận đủ hàng (5). */
export const laDaChot = (trangThai) => {
  const tt = docSo(trangThai);
  return tt === TRANG_THAI_BAO_GIA.DA_CHOT || tt === TRANG_THAI_BAO_GIA.DA_NHAN_DU;
};

/** Dòng đã có đơn giá (nhà cung cấp đã gửi giá cho dòng này). */
export const coGiaDong = (ct) => docSo(ct?.donGia) > 0;

/** Thành tiền một dòng có giá: `thanhTien` của máy chủ, thiếu thì đơn giá × số lượng đặt. Dòng chưa có giá: 0. */
export function thanhTienDong(ct) {
  if (!coGiaDong(ct)) return 0;
  const tien = docSo(ct?.thanhTien);
  return tien > 0 ? tien : docSo(ct.donGia) * docSo(ct?.soLuongDat);
}

/**
 * Cộng giá một nhóm dòng (cả báo giá, một sản phẩm, một cột nhà cung cấp).
 * @param cacGia các dòng có `donGia`, `thanhTien`, `soLuongDat` (hoặc null = nhà cung cấp không báo dòng đó)
 * @returns `{ soDong, soCoGia, thieu, tongTien, coGia, coMotPhan, chuaCoGia }`
 *   - `tongTien`: chỉ cộng dòng đã có giá (dòng thiếu giá không được tính là 0 đồng ở nơi hiển thị — xem `thieu`)
 *   - `coGia`: có dòng và mọi dòng đã có giá · `coMotPhan`: ít nhất một dòng có giá · `chuaCoGia`: chưa dòng nào có giá
 */
export function congGia(cacGia) {
  const ds = Array.isArray(cacGia) ? cacGia : [];
  let soCoGia = 0;
  let tongTien = 0;
  for (const ct of ds) {
    if (!coGiaDong(ct)) continue;
    soCoGia += 1;
    tongTien += thanhTienDong(ct);
  }
  const soDong = ds.length;
  return {
    soDong,
    soCoGia,
    thieu: soDong - soCoGia,
    tongTien,
    coGia: soDong > 0 && soCoGia === soDong,
    coMotPhan: soCoGia > 0,
    chuaCoGia: soCoGia === 0,
  };
}

/** Báo giá trạng thái 2 mà chưa dòng nào có giá → hiện "Chờ báo giá" thay cho "Đã nhận báo giá". */
export function laChoBaoGia(don) {
  return docSo(don?.trangThai) === TRANG_THAI_BAO_GIA.CHO_CHOT && congGia(don?.chiTietDonMuaHangs).chuaCoGia;
}

/**
 * Nhãn trạng thái báo giá để hiện: `nhanGoc` (BAO_GIA_NCC_STATUS của constants/donMuaHang.js, màn truyền vào),
 * riêng trạng thái 2 chưa có giá thì "Chờ báo giá".
 */
export function nhanTrangThaiBaoGia(don, nhanGoc) {
  return laChoBaoGia(don) ? NHAN_CHO_BAO_GIA : nhanGoc;
}

/** Lý do khóa nút "Chấp nhận báo giá" (chuỗi rỗng: chấp nhận được). */
export function lyDoKhoaChapNhan(tomTat) {
  if (!tomTat?.soDong) return "Báo giá chưa có sản phẩm nào";
  if (!tomTat.coMotPhan) return "Nhà cung cấp chưa gửi giá";
  if (tomTat.thieu > 0) return `Còn ${soVN(tomTat.thieu)} dòng chưa có giá`;
  return "";
}

/** Câu của dòng cảnh báo trong khối khi người được chốt giá mở báo giá chưa đủ giá (chuỗi rỗng: không cần). */
export function cauCanhBaoChapNhan(tomTat) {
  const lyDo = lyDoKhoaChapNhan(tomTat);
  if (!lyDo) return "";
  if (!tomTat?.soDong) return "Báo giá chưa có sản phẩm nào nên chưa chấp nhận được.";
  return `${lyDo}. Chấp nhận được khi mọi dòng đã có đơn giá.`;
}

/**
 * 4 bước của báo giá: Gửi yêu cầu → Nhà cung cấp gửi giá → Chốt báo giá → Thành đơn mua hàng.
 * Mỗi bước `{ ma, nhan, trangThai: "xong" | "dangLam" | "chua" | "dung", phu, ngay, coGio }` (TienTrinhChungTu).
 * Backend không lưu ngày chốt (duyet-don không ghi người / ngày) nên bước Chốt không có mốc giờ.
 * @param tomTat  `congGia(don.chiTietDonMuaHangs)`
 * @param nhanDonMua  tên trạng thái đơn mua hàng của mã 3 / 5 (DON_MUA_HANG_STATUS), hiện dưới bước cuối
 */
export function tinhBuocBaoGia(don, tomTat = congGia(don?.chiTietDonMuaHangs), { nhanDonMua = "" } = {}) {
  const tt = docSo(don?.trangThai);
  const daChot = laDaChot(tt);
  const choGia = tt === TRANG_THAI_BAO_GIA.DA_GUI || tt === TRANG_THAI_BAO_GIA.CHO_CHOT;
  const dongCoGia = `${soVN(tomTat.soCoGia)}/${soVN(tomTat.soDong)} dòng có giá`;

  let guiGia;
  if (tomTat.coGia || (daChot && tomTat.coMotPhan)) {
    guiGia = { trangThai: "xong", phu: dongCoGia };
  } else if (tomTat.coMotPhan) {
    guiGia = { trangThai: choGia ? "dangLam" : "chua", phu: dongCoGia };
  } else {
    guiGia = choGia ? { trangThai: "dangLam", phu: "Chờ nhà cung cấp" } : { trangThai: "chua", phu: "Chưa gửi giá" };
  }

  let chot;
  if (daChot) chot = { trangThai: "xong", phu: "Đã chấp nhận" };
  else if (tt === TRANG_THAI_BAO_GIA.TU_CHOI) chot = { trangThai: "dung", phu: "Không chấp nhận" };
  else if (tt === TRANG_THAI_BAO_GIA.DA_XOA) chot = { trangThai: "dung", phu: "Đã xóa" };
  else if (tt === TRANG_THAI_BAO_GIA.CHO_CHOT && tomTat.coGia) chot = { trangThai: "dangLam", phu: "Chờ mua hàng chốt" };
  else chot = { trangThai: "chua", phu: "" };

  return [
    { ma: "gui", nhan: "Gửi yêu cầu", trangThai: "xong", ngay: don?.ngayDatHang ?? null, coGio: true },
    { ma: "guiGia", nhan: "Nhà cung cấp gửi giá", ...guiGia },
    { ma: "chot", nhan: "Chốt báo giá", ...chot },
    { ma: "donMua", nhan: "Thành đơn mua hàng", trangThai: daChot ? "xong" : "chua", phu: daChot ? nhanDonMua : "" },
  ];
}

/**
 * Đổi `chiTietDonMuaHangs` sang dòng của bảng chứng từ (xem đầu chung-tu/bangChungTu.js), kèm giá của dòng.
 * `chatLieu` (chất liệu của sản phẩm) hiện ở dòng nhóm và cũng được tìm.
 */
export function dongBaoGia(chiTiets) {
  return (Array.isArray(chiTiets) ? chiTiets : []).map((ct, viTri) => {
    const chatLieu = ct?.bienTheSanPham?.chatLieu?.tenChatLieu || "";
    return {
      id: ct?.id ?? `dong-${viTri}`,
      ...tuBienThe(ct?.bienTheSanPham),
      chatLieu,
      chuTimThem: chatLieu,
      soLuong: docSo(ct?.soLuongDat),
      coGia: coGiaDong(ct),
      donGia: docSo(ct?.donGia),
      thanhTien: thanhTienDong(ct),
    };
  });
}
