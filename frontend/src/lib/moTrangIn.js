// Mở trang in của chứng từ — hàm thuần, không phụ thuộc React (chạy được với node --test).

/**
 * Mở trang in (/…/print) ở thẻ mới để màn đang làm giữ nguyên, như Shopify mở hóa đơn, phiếu đóng gói. Gọi ngay
 * trong lúc người dùng bấm (trình duyệt chỉ cho mở thẻ mới từ một cú bấm). Trình duyệt chặn thẻ mới thì mở trang in
 * ngay trong thẻ này như trước (`diTrongThe`, thường là `navigate`). Trả `true` khi đã mở được thẻ mới.
 */
export function moTrangIn(duongDan, diTrongThe, cuaSo = globalThis.window) {
  const the = cuaSo?.open?.(duongDan, "_blank") ?? null;
  if (the) {
    // Trang in không cần điều khiển ngược thẻ đã mở nó
    try {
      the.opener = null;
    } catch {
      /* trình duyệt không cho gán: bỏ qua */
    }
    return true;
  }
  diTrongThe?.(duongDan);
  return false;
}

/**
 * Trang đang đứng một mình trong thẻ (thẻ do moTrangIn mở, chưa đi trang nào khác): nút về của trang in là Đóng thẻ
 * thay cho Quay lại. Truyền vào `window.history`.
 */
export function laTheRieng(lichSu) {
  return Number.isInteger(lichSu?.length) && lichSu.length <= 1;
}
