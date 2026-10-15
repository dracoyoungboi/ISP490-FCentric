/** Câu báo kết quả các thao tác bấm tay với sàn, dùng chung cho Thiết lập, Sản phẩm và Công cụ. */

const soVN = (n) => Number(n || 0).toLocaleString("vi-VN");

/** POST tai-san-pham: đọc sản phẩm trên sàn, ghép theo SKU, không đổi gì trên sàn. */
export function ketQuaTaiSanPham(res, tenSan) {
  return {
    ok: true,
    title: `Đã đọc ${soVN(res?.soSku)} SKU trên ${tenSan}`,
    message: `Ghép mới ${soVN(res?.soMoi)}, cập nhật ${soVN(res?.soCapNhat)}. SKU không trùng với FCentric được bỏ qua; dòng đang ngừng đồng bộ giữ nguyên.`,
  };
}

/** POST tu-dong-lien-ket: tạo / cập nhật sản phẩm trên sàn, ghép và đẩy tồn. */
export function ketQuaDayLenSan(res, tenSan) {
  const loi = Number(res?.soThatBai || 0);
  return {
    ok: loi === 0,
    title: `Đã ghép ${soVN(res?.soDaGhep)} SKU`,
    message: [
      `tạo mới trên ${tenSan} ${soVN(res?.soTaoMoiTrenShopify)} sản phẩm`,
      `cập nhật ${soVN(res?.soCapNhatTrenShopify)} sản phẩm`,
      `đẩy tồn ${soVN(res?.soTonKhoDaDay)} SKU`,
      res?.soAnhDaDay ? `${soVN(res.soAnhDaDay)} ảnh` : null,
      loi > 0 ? `lỗi ${soVN(loi)}` : null,
    ]
      .filter(Boolean)
      .join(", ")
      .replace(/^./, (c) => c.toUpperCase())
      .concat("."),
  };
}

/** POST day-ton: đẩy số tồn theo quy tắc cho mọi dòng đang đồng bộ. */
export function ketQuaDayTon(res, tenSan) {
  return {
    ok: true,
    title: `Đã đẩy tồn ${soVN(res?.soDong)} SKU lên ${tenSan}`,
    message: "Chỉ các sản phẩm đang đồng bộ; dòng ngừng hoặc lỗi không được đẩy.",
  };
}

/** POST lay-don */
export function ketQuaLayDon(res, tenSan) {
  return {
    ok: true,
    title: `Đã lấy ${soVN(res?.soDonMoi)} đơn mới từ ${tenSan}`,
    message: res?.soDonCapNhat ? `Cập nhật ${soVN(res.soDonCapNhat)} đơn đã có.` : null,
  };
}
