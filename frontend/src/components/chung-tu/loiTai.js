/*
 * Nhận diện lỗi khi tải một chứng từ (rà soát 21/10/2026, N2): "không tìm thấy" hay "không tải được", và câu hiện cho
 * người dùng. Thuần, không phụ thuộc React, chạy được bằng `node --test`. Dùng cùng KhungLoiChungTu / KhungKhongThay /
 * KhungLoiTai để 8 màn nói giống nhau.
 */

export const CAU_MAT_KET_NOI = "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
export const CAU_LOI_MAY_CHU = "Máy chủ gặp lỗi khi tải. Vui lòng thử lại.";
const MAU_KHONG_THAY = /không tìm thấy|kho khác/i;

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
 * Phân loại lỗi tải chứng từ.
 * - Không có lỗi (dữ liệu rỗng) → không thấy.
 * - 404 → không thấy. 400 (và 500 khi `coi500LaKhongThay`, vd. phiếu xuất: backend ném RuntimeException) kèm câu khớp
 *   `mauKhongThay` (mặc định "không tìm thấy" / "kho khác") → không thấy.
 * - Không có phản hồi (mất mạng, máy chủ tắt) → "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại."
 * - Còn lại → câu của máy chủ, không có thì "Máy chủ gặp lỗi khi tải. Vui lòng thử lại."
 * @returns {{ khongThay: boolean, cauMayChu: string | null, moTaLoi: string, trangThai: number | null }}
 */
export function phanLoaiLoiTai(error, { mauKhongThay = MAU_KHONG_THAY, coi500LaKhongThay = false } = {}) {
  if (!error) return { khongThay: true, cauMayChu: null, moTaLoi: CAU_LOI_MAY_CHU, trangThai: null };
  const trangThai = Number(error?.response?.status) || null;
  const cauMayChu = cauMayChuCua(error);
  const khopCau = Boolean(cauMayChu) && mauKhongThay.test(cauMayChu);
  const khongThay = trangThai === 404 || ((trangThai === 400 || (coi500LaKhongThay && trangThai === 500)) && khopCau);
  const moTaLoi = !error?.response ? CAU_MAT_KET_NOI : cauMayChu ?? CAU_LOI_MAY_CHU;
  return { khongThay, cauMayChu, moTaLoi, trangThai };
}

/** Chữ hoa đầu câu: "phiếu nhặt hàng" → "Phiếu nhặt hàng". */
export const vietHoaDau = (chu) => {
  const s = String(chu ?? "").trim();
  return s ? s[0].toLocaleUpperCase("vi-VN") + s.slice(1) : "";
};

/**
 * Chữ của màn "không tìm thấy" / "không tải được" theo tên chứng từ viết thường, vd. "phiếu nhặt hàng":
 * `{ tieuDeKhongThay, moTaKhongThay, nhanVeDanhSach, tieuDeLoi }`.
 */
export function chuLoiTai(tenChungTu) {
  const ten = String(tenChungTu ?? "").trim() || "chứng từ";
  return {
    tieuDeKhongThay: `Không tìm thấy ${ten}`,
    moTaKhongThay: `${vietHoaDau(ten)} không tồn tại hoặc đã bị xóa khỏi hệ thống.`,
    nhanVeDanhSach: `Về danh sách ${ten}`,
    tieuDeLoi: `Không tải được ${ten}`,
  };
}
