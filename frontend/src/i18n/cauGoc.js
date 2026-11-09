/**
 * Câu gốc tiếng Việt của câu lỗi máy chủ đã dịch.
 *
 * Giao diện tiếng Anh: máy chủ trả `message` tiếng Anh kèm `messageGoc` tiếng Việt. Vài chỗ phân loại lỗi bằng cách dò
 * chữ trong câu ("không tìm thấy", "thuộc kho khác", "số điện thoại"…) — các chỗ đó dò trên câu GỐC qua cauGocMayChu(),
 * còn câu hiện cho người dùng vẫn là câu đã dịch. apiClient ghi lại từng cặp khi nhận lỗi (ghiCauGoc).
 * Giao diện tiếng Việt: không có messageGoc, các hàm trả nguyên câu.
 * Thuần, không dùng alias "@/" để chạy được bằng `node --test`.
 */

const TOI_DA = 200;
const CAU_GOC = new Map();

const chuan = (cau) => cau.replace(/\s+/g, " ").trim();

/** Ghi cặp câu đã dịch → câu gốc từ thân phản hồi lỗi `{ message, messageGoc }`. */
export function ghiCauGoc(data) {
  const daDich = data?.message;
  const goc = data?.messageGoc;
  if (typeof daDich !== "string" || typeof goc !== "string" || daDich === goc) return;
  CAU_GOC.delete(chuan(daDich));
  CAU_GOC.set(chuan(daDich), goc);
  if (CAU_GOC.size > TOI_DA) CAU_GOC.delete(CAU_GOC.keys().next().value);
}

/** Câu gốc tiếng Việt của một câu máy chủ (đã dịch hoặc chưa); không biết thì trả nguyên. */
export function cauGocMayChu(cau) {
  if (typeof cau !== "string" || !cau) return cau;
  return CAU_GOC.get(chuan(cau)) ?? cau;
}

/** Câu máy chủ đã được dịch (tiếng Anh) hay chưa. */
export function laCauDaDich(cau) {
  return typeof cau === "string" && cauGocMayChu(cau) !== cau;
}

/** Câu gốc tiếng Việt của lỗi axios: `messageGoc` nếu có, không thì `message`. */
export function cauGocCuaLoi(error) {
  const data = error?.response?.data;
  if (typeof data?.messageGoc === "string" && data.messageGoc) return data.messageGoc;
  return typeof data?.message === "string" ? data.message : "";
}
