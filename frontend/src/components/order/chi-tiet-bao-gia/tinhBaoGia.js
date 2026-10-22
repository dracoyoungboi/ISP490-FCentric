/*
 * Hàm thuần cho màn Chi tiết báo giá (bản "một khối") và phần đọc giá dùng chung với So sánh báo giá:
 * dòng đã có giá, thành tiền, tổng cả báo giá, nhãn suy diễn "Chờ báo giá", 4 bước tiến trình, điều kiện và lý do khóa
 * "Chấp nhận", thân lời gọi xét báo giá và cách xử lý lỗi của nó, người chốt báo giá.
 * Không gọi API, không phụ thuộc React, chạy được bằng `node --test`.
 *
 * Quy ước dữ liệu (HOP-DONG 2.3, 6.3–6.5):
 * - Gửi yêu cầu báo giá tạo cho mỗi nhà cung cấp một don_mua_hang ở trạng thái 2, mọi `donGia` = 0.
 *   Nhà cung cấp gửi giá qua cổng: vẫn trạng thái 2, máy chủ điền giá và ghi `ngayBaoGia` (lần cuối nhận báo giá).
 *   "Đã báo giá" ⇔ `ngayBaoGia != null` (không suy từ `donGia > 0`).
 * - `ngayGuiYeuCau`: lúc email yêu cầu báo giá gửi được; `chuaGuiDuocYeuCau`: cờ máy chủ tính (K11);
 *   `ghiChuNhaCungCap`: ghi chú nhà cung cấp gửi kèm báo giá; `lyDoTuChoi`: lý do không chấp nhận (có thể trống).
 * - 3: chấp nhận (thành đơn mua hàng cùng mã) · 4: không chấp nhận (kể cả K1: chấp nhận báo giá khác cùng yêu cầu thì
 *   báo giá còn chờ tự chuyển 4, không có người duyệt; giữ nhãn "Không chấp nhận báo giá", đặc tả K1) · 5: đã nhận đủ
 *   hàng · 0: đã xóa · 1: chỉ đơn tạo tay (đã gửi, chờ giá).
 * - Xét (PUT duyet-don/{id}/3 hoặc /4, body `{ lyDo, ngayBaoGiaDaXem }`): chỉ báo giá đang 2, đã có `ngayBaoGia`, yêu cầu
 *   ở 3; `ngayBaoGiaDaXem` khác máy chủ (nhà cung cấp vừa gửi lại) thì 409. Máy chủ ghi người bấm vào `nguoiDuyet`.
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

/** Trạng thái yêu cầu mua hàng cho phép xét báo giá: "Đã gửi yêu cầu báo giá" (YeuCauMuaHangService, mã 3). */
export const TRANG_THAI_YEU_CAU_DANG_NHAN_BAO_GIA = 3;

/** Nhãn suy ra ở giao diện cho báo giá trạng thái 2 mà nhà cung cấp chưa gửi báo giá (có trong constants/trangThai.js). */
export const NHAN_CHO_BAO_GIA = "Chờ báo giá";

/** Số ký tự tối đa của lý do không chấp nhận, khớp máy chủ (HOP-DONG 2.3, cột ly_do_tu_choi VARCHAR(500)). */
export const LY_DO_KHONG_CHAP_NHAN_TOI_DA = 500;

/** Báo giá đã chấp nhận: thành đơn mua hàng (3) hoặc đã nhận đủ hàng (5). */
export const laDaChot = (trangThai) => {
  const tt = docSo(trangThai);
  return tt === TRANG_THAI_BAO_GIA.DA_CHOT || tt === TRANG_THAI_BAO_GIA.DA_NHAN_DU;
};

/**
 * Báo giá còn chờ giá: đã gửi nhà cung cấp (1) hoặc chờ chốt (2). Chỉ lúc này dòng chưa có giá mới là "Chờ báo giá";
 * báo giá đã không chấp nhận, đã xóa, đã chốt thì dòng chưa có giá hiện "—".
 */
export const laConChoGia = (trangThai) => {
  const tt = docSo(trangThai);
  return tt === TRANG_THAI_BAO_GIA.DA_GUI || tt === TRANG_THAI_BAO_GIA.CHO_CHOT;
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

/**
 * Tổng tiền một báo giá: `tongTien` của máy chủ; thiếu (0 / trống) thì cộng các dòng đã có giá (congGia).
 */
export function tongTienBaoGia(don) {
  const tong = docSo(don?.tongTien);
  return tong > 0 ? tong : congGia(don?.chiTietDonMuaHangs).tongTien;
}

/**
 * Người chốt báo giá: `nguoiDuyet` (máy chủ ghi người bấm Chấp nhận / Không chấp nhận). Chỉ khi là báo giá của một
 * yêu cầu mua hàng (`yeuCauMuaHang` gốc) đã chốt (3, 5) hoặc không chấp nhận (4) và có tên; dữ liệu cũ không có người
 * chốt → null (màn ẩn). Đơn mua tạo tay không có yêu cầu gốc: `nguoiDuyet` là người tạo (quản trị viên tạo đơn tự
 * được ghi là người duyệt), không phải người chốt báo giá → null.
 * @param tuyChon `coYeuCauGoc`: nơi gọi đã biết báo giá thuộc một yêu cầu (vd. `donMuaHangs` của yêu cầu); mặc định đọc
 *   `don.yeuCauMuaHang`
 * @returns `{ hoTen, email, khongChapNhan, nhan, chu }` | null — `nhan`: nhãn cột thuộc tính, luôn "Người chốt" (thẻ
 *   trạng thái đã nói chấp nhận hay không; nhãn ngắn để không xuống dòng), `chu`: câu ngắn dưới tên nhà cung cấp
 *   ("Chốt bởi A" / "Không chấp nhận bởi A").
 */
export function nguoiChotBaoGia(don, { coYeuCauGoc = don?.yeuCauMuaHang != null } = {}) {
  if (!coYeuCauGoc) return null;
  const tt = docSo(don?.trangThai);
  const khongChapNhan = tt === TRANG_THAI_BAO_GIA.TU_CHOI;
  if (!khongChapNhan && !laDaChot(tt)) return null;
  const email = String(don?.nguoiDuyet?.email ?? "").trim();
  const hoTen = String(don?.nguoiDuyet?.hoTen ?? "").trim() || email;
  if (!hoTen) return null;
  return {
    hoTen,
    email,
    khongChapNhan,
    nhan: "Người chốt",
    chu: khongChapNhan ? `Không chấp nhận bởi ${hoTen}` : `Chốt bởi ${hoTen}`,
  };
}

/** Nhà cung cấp đã gửi báo giá: máy chủ ghi `ngayBaoGia` mỗi lần nhận báo giá qua cổng. */
export const daCoBaoGia = (don) => Boolean(don?.ngayBaoGia);

/** Báo giá trạng thái 2 mà nhà cung cấp chưa gửi báo giá → hiện "Chờ báo giá" thay cho "Đã nhận báo giá". */
export function laChoBaoGia(don) {
  return docSo(don?.trangThai) === TRANG_THAI_BAO_GIA.CHO_CHOT && !daCoBaoGia(don);
}

/**
 * Nhãn trạng thái báo giá để hiện: `nhanGoc` (BAO_GIA_NCC_STATUS của constants/donMuaHang.js, màn truyền vào),
 * riêng trạng thái 2 chưa báo giá thì "Chờ báo giá".
 */
export function nhanTrangThaiBaoGia(don, nhanGoc) {
  return laChoBaoGia(don) ? NHAN_CHO_BAO_GIA : nhanGoc;
}

/**
 * Hiện nút Chấp nhận / Không chấp nhận: báo giá đang 2, nhà cung cấp đã gửi báo giá (`ngayBaoGia`) và yêu cầu gốc
 * đang ở 3. Không biết trạng thái yêu cầu (dữ liệu cũ không có yêu cầu gốc) thì không hiện; máy chủ cũng từ chối.
 */
export function coTheXetBaoGia(don) {
  return (
    docSo(don?.trangThai) === TRANG_THAI_BAO_GIA.CHO_CHOT &&
    daCoBaoGia(don) &&
    don?.yeuCauMuaHang?.trangThai != null &&
    docSo(don.yeuCauMuaHang.trangThai) === TRANG_THAI_YEU_CAU_DANG_NHAN_BAO_GIA
  );
}

/**
 * Lý do khóa nút "Chấp nhận báo giá" (chuỗi rỗng: chấp nhận được). `don` (tùy chọn): chưa có `ngayBaoGia` thì
 * "Nhà cung cấp chưa gửi báo giá"; còn lại kiểm từng dòng cho dữ liệu cũ (dòng thiếu giá).
 */
export function lyDoKhoaChapNhan(tomTat, don) {
  if (don !== undefined && !daCoBaoGia(don)) return "Nhà cung cấp chưa gửi báo giá";
  if (!tomTat?.soDong) return "Báo giá chưa có sản phẩm nào";
  if (!tomTat.coMotPhan) return "Nhà cung cấp chưa gửi giá";
  if (tomTat.thieu > 0) return `Còn ${soVN(tomTat.thieu)} dòng chưa có giá`;
  return "";
}

/** Câu của dòng cảnh báo trong khối khi người được chốt giá mở báo giá chưa đủ giá (chuỗi rỗng: không cần). */
export function cauCanhBaoChapNhan(tomTat, don) {
  const lyDo = lyDoKhoaChapNhan(tomTat, don);
  if (!lyDo) return "";
  if (don !== undefined && !daCoBaoGia(don)) return `${lyDo}.`;
  if (!tomTat?.soDong) return "Báo giá chưa có sản phẩm nào nên chưa chấp nhận được.";
  return `${lyDo}. Chấp nhận được khi mọi dòng đã có đơn giá.`;
}

/**
 * Thân PUT duyet-don/{id}/{3|4}: `lyDo` đã cắt khoảng trắng (trống → null, quá LY_DO_KHONG_CHAP_NHAN_TOI_DA thì cắt),
 * `ngayBaoGiaDaXem` = đúng chuỗi `ngayBaoGia` máy chủ trả lúc màn mở hộp (không qua Date để không đổi phần lẻ giây).
 */
export function taoBodyXetBaoGia({ lyDo, ngayBaoGiaDaXem } = {}) {
  const gon = String(lyDo ?? "").trim().slice(0, LY_DO_KHONG_CHAP_NHAN_TOI_DA);
  return { lyDo: gon || null, ngayBaoGiaDaXem: ngayBaoGiaDaXem ?? null };
}

/** Ngày gửi yêu cầu báo giá cho nhà cung cấp: lúc email gửi được (`ngayGuiYeuCau`), dữ liệu cũ thì ngày tạo đơn. */
export function ngayGuiYeuCau(don) {
  return don?.ngayGuiYeuCau ?? don?.ngayDatHang ?? null;
}

/**
 * K11 · dòng "Chưa gửi được email yêu cầu báo giá cho nhà cung cấp này." của một báo giá. Theo cờ `chuaGuiDuocYeuCau`
 * máy chủ tính (đơn ở 2, chưa báo giá, email chưa gửi được, đã tạo quá thời gian chờ) — màn không tự tính thời gian chờ.
 * Kiểm lại các trường cơ bản phòng khi màn vừa đổi trạng thái tại chỗ.
 * @param tuyChon `duocGui`: vai trò thuộc VAI_TRO_GUI_YEU_CAU_BAO_GIA · `daGuiLai`: màn vừa gửi lại thành công (ẩn
 *   dòng tới khi dựng lại màn: máy chủ chặn bấm lại trong thời gian chờ, email đang được gửi)
 * @returns null (không hiện) | `{ coNut }` (`coNut`: hiện nút "Gửi lại email yêu cầu báo giá")
 */
export function trangThaiGuiLaiYeuCau(don, { duocGui = false, daGuiLai = false } = {}) {
  const canGuiLai =
    Boolean(don?.chuaGuiDuocYeuCau) &&
    docSo(don?.trangThai) === TRANG_THAI_BAO_GIA.CHO_CHOT &&
    !daCoBaoGia(don) &&
    !don?.ngayGuiYeuCau;
  if (!canGuiLai || daGuiLai) return null;
  return { coNut: Boolean(duocGui) };
}

/**
 * Cách màn Chi tiết báo giá xử lý lỗi máy chủ của Chấp nhận / Không chấp nhận (PUT duyet-don):
 * - `"dongVaTaiLai"`: mọi 409 (đặc tả 6.3 "Lỗi 409 hiện đúng câu máy chủ trả về, rồi tải lại đơn"): có mã
 *   (DON_DA_CO_KET_QUA, CHUA_CO_BAO_GIA, BAO_GIA_DA_DOI, YEU_CAU_KHONG_CON_MO) hoặc không mã (đang có thao tác khác trên
 *   cùng dữ liệu: đơn trên màn có thể đã cũ); và 404 (đơn không còn). Đóng hộp, hiện nguyên câu máy chủ, tải lại;
 * - `"giuHop"`: còn lại → giữ hộp (không mất lý do vừa gõ, soát chéo R11), hiện câu lỗi trong hộp để sửa hoặc bấm lại:
 *   400 (lý do quá dài, dữ liệu sai), 403, 500, mất mạng.
 * Theo mã HTTP, không theo mã lỗi: mọi 409 cùng một cách xử lý.
 * @param status HTTP status (getApiErrorStatus)
 */
export function cachXuLyLoiXetBaoGia(status) {
  return status === 409 || status === 404 ? "dongVaTaiLai" : "giuHop";
}

/** Ghi chú nhà cung cấp gửi kèm báo giá (đã cắt khoảng trắng), không có thì "". */
export function ghiChuNhaCungCap(don) {
  return String(don?.ghiChuNhaCungCap ?? "").trim();
}

/**
 * 4 bước của báo giá: Gửi yêu cầu → Nhà cung cấp gửi giá → Chốt báo giá → Thành đơn mua hàng.
 * Mỗi bước `{ ma, nhan, trangThai: "xong" | "dangLam" | "chua" | "dung", phu, ngay, coGio }` (TienTrinhChungTu).
 * - Gửi yêu cầu: xong khi email yêu cầu đã gửi được (mốc `ngayGuiYeuCau`) hoặc báo giá đã qua bước này (đã báo giá,
 *   đã xét; dữ liệu cũ không có `ngayGuiYeuCau` thì mốc là ngày tạo đơn). Báo giá đang chờ (2), chưa báo giá mà email
 *   chưa gửi được (còn trong hàng đợi, hoặc K11) thì "đang làm", không mốc giờ (K11: dòng cảnh báo của màn đã nói lý
 *   do, không lặp ở đây); bước Nhà cung cấp gửi giá khi đó "chưa" (một bước đang làm).
 * - Nhà cung cấp gửi giá: xong khi có `ngayBaoGia` (mốc giờ là lần gửi cuối).
 * Máy chủ ghi người chốt (`nguoiDuyet`, xem nguoiChotBaoGia) nhưng không lưu ngày chốt nên bước Chốt không có mốc giờ.
 * @param tomTat  `congGia(don.chiTietDonMuaHangs)`
 * @param nhanDonMua  tên trạng thái đơn mua hàng của mã 3 / 5 (DON_MUA_HANG_STATUS), hiện dưới bước cuối
 */
export function tinhBuocBaoGia(don, tomTat = congGia(don?.chiTietDonMuaHangs), { nhanDonMua = "" } = {}) {
  const tt = docSo(don?.trangThai);
  const daChot = laDaChot(tt);
  const choGia = laConChoGia(tt);
  const daBaoGia = daCoBaoGia(don);
  const dongCoGia = `${soVN(tomTat.soCoGia)}/${soVN(tomTat.soDong)} dòng có giá`;

  const chuaGuiEmail = tt === TRANG_THAI_BAO_GIA.CHO_CHOT && !daBaoGia && !don?.ngayGuiYeuCau;

  let guiGia;
  if (chuaGuiEmail) {
    guiGia = { trangThai: "chua", phu: "Chưa gửi giá" };
  } else if (daBaoGia) {
    guiGia = { trangThai: "xong", phu: dongCoGia, ngay: don.ngayBaoGia, coGio: true };
  } else if (daChot && tomTat.coMotPhan) {
    // Dữ liệu cũ đã chốt mà không có ngayBaoGia: vẫn là đã gửi giá, chỉ không có mốc giờ
    guiGia = { trangThai: "xong", phu: dongCoGia };
  } else {
    guiGia = choGia ? { trangThai: "dangLam", phu: "Chờ nhà cung cấp" } : { trangThai: "chua", phu: "Chưa gửi giá" };
  }

  let chot;
  if (daChot) chot = { trangThai: "xong", phu: "Đã chấp nhận" };
  else if (tt === TRANG_THAI_BAO_GIA.TU_CHOI) chot = { trangThai: "dung", phu: "Không chấp nhận" };
  else if (tt === TRANG_THAI_BAO_GIA.DA_XOA) chot = { trangThai: "dung", phu: "Đã xóa" };
  else if (tt === TRANG_THAI_BAO_GIA.CHO_CHOT && daBaoGia) chot = { trangThai: "dangLam", phu: "Chờ nhân viên mua hàng chốt" };
  else chot = { trangThai: "chua", phu: "" };

  const gui = chuaGuiEmail
    ? { trangThai: "dangLam", ngay: null }
    : { trangThai: "xong", ngay: ngayGuiYeuCau(don), coGio: true };

  return [
    { ma: "gui", nhan: "Gửi yêu cầu", ...gui },
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
