import { formatNumber } from "../../utils/formatters.js";

/** Câu báo kết quả các thao tác bấm tay với sàn, dùng chung cho Thiết lập, Sản phẩm và Công cụ. */

/**
 * POST tai-san-pham: đọc sản phẩm trên sàn, ghép theo SKU, không đổi gì trên sàn.
 * Máy chủ trả `soKhongKhop` (sàn ủy quyền, KH mục C.1) thì báo theo câu của trang Sản phẩm (KH mục B.6).
 */
export function ketQuaTaiSanPham(res, tenSan) {
  if (res?.soKhongKhop != null) {
    const soSku = Number(res.soSku || 0);
    const khongKhop = Number(res.soKhongKhop || 0);
    const ngung = Number(res.soNgung || 0);
    return {
      ok: true,
      title: `Đã tải ${formatNumber(soSku)} SKU từ ${tenSan}: ${formatNumber(Math.max(0, soSku - khongKhop - ngung))} ghép tự động, ${formatNumber(khongKhop)} chưa có mã trùng${ngung ? `, ${formatNumber(ngung)} ngừng` : ""}`,
      message: null,
    };
  }
  return {
    ok: true,
    title: `Đã đọc ${formatNumber(res?.soSku)} SKU trên ${tenSan}`,
    message: `Ghép mới ${formatNumber(res?.soMoi)}, cập nhật ${formatNumber(res?.soCapNhat)}. SKU không trùng với FCentric được bỏ qua; dòng đang ngừng đồng bộ giữ nguyên.`,
  };
}

/** POST tu-dong-lien-ket: tạo / cập nhật sản phẩm trên sàn, ghép và đẩy tồn. */
export function ketQuaDayLenSan(res, tenSan) {
  const loi = Number(res?.soThatBai || 0);
  return {
    ok: loi === 0,
    title: `Đã ghép ${formatNumber(res?.soDaGhep)} SKU`,
    message: [
      `tạo mới trên ${tenSan} ${formatNumber(res?.soTaoMoiTrenShopify)} sản phẩm`,
      `cập nhật ${formatNumber(res?.soCapNhatTrenShopify)} sản phẩm`,
      `đẩy tồn ${formatNumber(res?.soTonKhoDaDay)} SKU`,
      res?.soAnhDaDay ? `${formatNumber(res.soAnhDaDay)} ảnh` : null,
      loi > 0 ? `lỗi ${formatNumber(loi)}` : null,
    ]
      .filter(Boolean)
      .join(", ")
      .replace(/^./, (c) => c.toUpperCase())
      .concat("."),
  };
}

/**
 * POST day-ton: đẩy số tồn theo quy tắc cho mọi dòng đang đồng bộ hoặc đang lỗi.
 * `tone`: "error" khi không đẩy được SKU nào vì lỗi cả gian hàng, "warning" khi có SKU lỗi hoặc dừng giữa chừng.
 */
export function ketQuaDayTon(res, tenSan) {
  const daDay = Number(res?.soDong || 0);
  const soLoi = Number(res?.soLoi || 0);
  const chuaDay = Number(res?.soChuaDay || 0);
  const tong = daDay + soLoi + chuaDay;
  const loiKenh = res?.loiKenh || null;

  if (loiKenh && daDay === 0 && soLoi === 0) {
    return { ok: false, tone: "error", title: `Không đẩy được tồn lên ${tenSan}`, message: loiKenh };
  }
  if (loiKenh) {
    return {
      ok: false,
      tone: "warning",
      title: `Đã đẩy ${formatNumber(daDay)}/${formatNumber(tong)} SKU lên ${tenSan}${soLoi > 0 ? ` · ${formatNumber(soLoi)} lỗi` : ""}`,
      message: `Dừng giữa chừng: ${loiKenh}. ${formatNumber(chuaDay)} SKU chưa đẩy sẽ được đẩy ở lần sau.`,
    };
  }
  if (soLoi > 0) {
    return {
      ok: false,
      tone: "warning",
      title: `Đã đẩy ${formatNumber(daDay)}/${formatNumber(tong)} SKU lên ${tenSan} · ${formatNumber(soLoi)} lỗi`,
      message: "Xem lý do ở tab Lỗi. Lần đẩy sau sẽ tự thử lại các SKU này.",
    };
  }
  if (tong === 0) {
    return { ok: true, tone: "success", title: "Không có SKU nào đang đồng bộ để đẩy tồn", message: null };
  }
  return {
    ok: true,
    tone: "success",
    title: `Đã đẩy tồn ${formatNumber(daDay)} SKU lên ${tenSan}`,
    message: "Dòng ngừng đồng bộ không được đẩy.",
  };
}

/** POST lay-don */
export function ketQuaLayDon(res, tenSan) {
  return {
    ok: true,
    title: `Đã lấy ${formatNumber(res?.soDonMoi)} đơn mới từ ${tenSan}`,
    message: res?.soDonCapNhat ? `Cập nhật ${formatNumber(res.soDonCapNhat)} đơn đã có.` : null,
  };
}
