/*
 * Nhận diện lỗi khi tải một chứng từ (rà soát 21/10/2026, N2): "không tìm thấy", "thuộc kho khác", "không có quyền" hay
 * "không tải được", và câu hiện cho người dùng. Thuần, không phụ thuộc React, chạy được bằng `node --test`. Dùng cùng
 * KhungLoiChungTu / KhungKhongThay / KhungLoiTai để 8 màn nói giống nhau.
 */

export const CAU_MAT_KET_NOI = "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
export const CAU_LOI_MAY_CHU = "Máy chủ gặp lỗi khi tải. Vui lòng thử lại.";
const MAU_KHONG_THAY = /không tìm thấy/i;
// "… thuộc kho khác …", "… của kho khác": chứng từ có thật nhưng ở kho khác kho đang làm việc (không bắt "chọn kho khác")
const MAU_KHO_KHAC = /(thuộc|của) kho khác/i;
// 404 khi gọi sai đường dẫn API / lệch phiên bản (RestControllerGlobalExceptionHandler.handleNoResourceFound): lỗi của
// ứng dụng, không phải chứng từ không có; câu kỹ thuật ("Không tìm thấy API: GET /api/…") không hiện cho người dùng
const MAU_SAI_API = /^không tìm thấy api\b/i;
// 400 khi tham số sai kiểu (RestControllerGlobalExceptionHandler.handleThamSoSai), vd. mở /quotation/abc
const MAU_THAM_SO_SAI = /^tham số gửi lên thiếu hoặc không hợp lệ/i;
// Mã lỗi axios khi không có phản hồi vì mất mạng, máy chủ tắt hoặc quá thời gian chờ
const MA_LOI_MANG = new Set(["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT"]);

/** Câu lỗi của máy chủ (`message`, hoặc phần tử đầu của `errors`), đã bỏ khoảng trắng thừa; không có thì null. */
export function cauMayChuCua(error) {
  const data = error?.response?.data;
  const cau = typeof data?.message === "string" && data.message.trim()
    ? data.message
    : Array.isArray(data?.errors) && data.errors[0] != null
      ? String(data.errors[0])
      : typeof data === "string" && data.trim() && data.length <= 300 && !/^\s*</.test(data)
        ? data
        : null;
  return cau ? cau.replace(/\s+/g, " ").trim() : null;
}

/**
 * Lỗi mạng thật của axios (không có phản hồi): mất mạng, máy chủ tắt, quá thời gian chờ. Không tính request bị hủy
 * (ERR_CANCELED) và lỗi JS trong hàm tải (TypeError…): hai loại đó không có `request` / mã lỗi mạng của axios.
 */
function laLoiMang(error) {
  if (!error || error.response || error.code === "ERR_CANCELED") return false;
  return MA_LOI_MANG.has(error.code) || Boolean(error.isAxiosError && error.request);
}

// Lời gọi có tham số truy vấn (?a=b): 400 "Tham số …" khi đó có thể do thiếu / sai tham số, không chắc là sai mã chứng từ
function coThamSoTruyVan(config) {
  const params = config?.params;
  const coParams = params instanceof URLSearchParams
    ? params.toString() !== ""
    : params != null && typeof params === "object" && Object.keys(params).length > 0;
  return coParams || String(config?.url ?? "").includes("?");
}

/**
 * Phân loại lỗi tải chứng từ.
 * - Không có lỗi (dữ liệu rỗng) → không thấy.
 * - 404 → không thấy, trừ 404 "Không tìm thấy API: …" (sai đường dẫn API) → lỗi tải, không hiện câu kỹ thuật.
 * - 400 (và 500 khi `coi500LaKhongThay`, vd. phiếu xuất: backend ném RuntimeException) kèm câu khớp `mauKhongThay`
 *   (mặc định "không tìm thấy") hoặc "thuộc / của kho khác" → không thấy.
 * - 400 "Tham số gửi lên thiếu hoặc không hợp lệ…" của lời gọi không có tham số truy vấn (mã trên đường dẫn sai kiểu,
 *   vd. /quotation/abc) → không thấy, không hiện câu kỹ thuật.
 * - `khoKhac`: câu máy chủ nói chứng từ "thuộc / của kho khác" (400, 403, 500 khi `coi500LaKhongThay`) — màn tự nói
 *   riêng, không dùng câu "không tồn tại". 403 kho khác không tính là không thấy.
 * - `khongQuyen`: 403 không phải kho khác (không có quyền xem, không thuộc kho, phiên hết hạn…) — không "Thử lại".
 * - Lỗi mạng thật của axios (mất mạng, máy chủ tắt, quá giờ) → "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại."
 * - Còn lại (kể cả lỗi JS trong hàm tải, request bị hủy) → câu của máy chủ, không có thì "Máy chủ gặp lỗi khi tải.
 *   Vui lòng thử lại."
 * `cauMayChu`: câu của máy chủ để hiện; null khi câu chỉ mang tính kỹ thuật (sai đường dẫn API, tham số sai kiểu).
 * @returns {{ khongThay: boolean, khoKhac: boolean, khongQuyen: boolean, cauMayChu: string | null, moTaLoi: string,
 *   trangThai: number | null }}
 */
export function phanLoaiLoiTai(error, { mauKhongThay = MAU_KHONG_THAY, coi500LaKhongThay = false } = {}) {
  if (!error) {
    return { khongThay: true, khoKhac: false, khongQuyen: false, cauMayChu: null, moTaLoi: CAU_LOI_MAY_CHU, trangThai: null };
  }
  const trangThai = Number(error?.response?.status) || null;
  const cauGoc = cauMayChuCua(error);
  const saiApi = trangThai === 404 && Boolean(cauGoc) && MAU_SAI_API.test(cauGoc);
  const maSai = trangThai === 400 && Boolean(cauGoc) && MAU_THAM_SO_SAI.test(cauGoc) && !coThamSoTruyVan(error?.config);
  const cauMayChu = saiApi || maSai ? null : cauGoc;
  const loiNghiepVu = trangThai === 400 || (coi500LaKhongThay && trangThai === 500);
  const khoKhac = (loiNghiepVu || trangThai === 403) && Boolean(cauMayChu) && MAU_KHO_KHAC.test(cauMayChu);
  const khopCau = Boolean(cauMayChu) && mauKhongThay.test(cauMayChu);
  const khongThay = (trangThai === 404 && !saiApi) || maSai || (loiNghiepVu && (khopCau || khoKhac));
  const khongQuyen = trangThai === 403 && !khoKhac;
  const moTaLoi = laLoiMang(error) ? CAU_MAT_KET_NOI : cauMayChu ?? CAU_LOI_MAY_CHU;
  return { khongThay, khoKhac, khongQuyen, cauMayChu, moTaLoi, trangThai };
}

/** Chữ hoa đầu câu: "phiếu nhặt hàng" → "Phiếu nhặt hàng". */
export const vietHoaDau = (chu) => {
  const s = String(chu ?? "").trim();
  return s ? s[0].toLocaleUpperCase("vi-VN") + s.slice(1) : "";
};

/**
 * Chữ của màn "không tìm thấy" / "thuộc kho khác" / "không có quyền" / "không tải được" theo tên chứng từ viết thường,
 * vd. "phiếu nhặt hàng": `{ tieuDeKhongThay, moTaKhongThay, tieuDeKhoKhac, moTaKhoKhac, tieuDeKhongQuyen,
 * moTaKhongQuyen, nhanVeDanhSach, tieuDeLoi }`.
 */
export function chuLoiTai(tenChungTu) {
  const ten = String(tenChungTu ?? "").trim() || "chứng từ";
  return {
    tieuDeKhongThay: `Không tìm thấy ${ten}`,
    moTaKhongThay: `${vietHoaDau(ten)} không tồn tại hoặc đã bị xóa khỏi hệ thống.`,
    tieuDeKhoKhac: `${vietHoaDau(ten)} thuộc kho khác`,
    // "Nơi làm việc": đúng nhãn ô chọn kho ở sidebar / ở trang (SidebarKhoLamViec, KhoLamViecSelect)
    moTaKhoKhac: `${vietHoaDau(ten)} thuộc kho khác với nơi làm việc đang chọn. Đổi “Nơi làm việc” sang kho đó để xem.`,
    tieuDeKhongQuyen: `Bạn không có quyền xem ${ten}`,
    moTaKhongQuyen: `Tài khoản của bạn không được xem ${ten} này.`,
    nhanVeDanhSach: `Về danh sách ${ten}`,
    tieuDeLoi: `Không tải được ${ten}`,
  };
}
