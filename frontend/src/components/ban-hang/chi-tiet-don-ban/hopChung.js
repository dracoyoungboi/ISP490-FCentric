// Dùng chung cho các hộp ghi phiếu thu / hoàn / hủy của đơn (KhoiPhieuThu).

export const loiCua = (error, macDinh) => error?.response?.data?.message || macDinh;
/** Mã lỗi nghiệp vụ của câu trả 409 (máy chủ: data.code). */
export const maLoi = (error) => (error?.response?.status === 409 ? error.response.data?.data?.code : undefined);
export const oNhap = "mt-1.5 h-9 w-full rounded-md border border-bo-border bg-white px-3 text-sm text-bo-foreground outline-none focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 disabled:bg-bo-surface-subtle disabled:text-bo-muted";
/** Hộp cao hơn màn hình điện thoại (câu hỏi lại, bàn phím bật): cuộn trong hộp, nút luôn bấm tới được. */
export const KHUNG_HOP = "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md";
/** Khóa chống gửi trùng cho một lần mở hộp: gửi lại sau khi mất phản hồi thì máy chủ không ghi lần thứ hai. */
export const taoKhoa = () => (globalThis.crypto?.randomUUID
  ? globalThis.crypto.randomUUID()
  : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);
export const CHUA_RO = "Chưa rõ đã ghi được chưa (mất kết nối hoặc máy chủ lỗi). Bấm ghi lại: hệ thống không ghi trùng lần này.";
