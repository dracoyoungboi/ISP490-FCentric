/** Câu báo kết quả các thao tác bấm tay với sàn, dùng chung cho Thiết lập, Sản phẩm và Công cụ. */

const soVN = (n) => Number(n || 0).toLocaleString("vi-VN");

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
      title: `Đã tải ${soVN(soSku)} SKU từ ${tenSan}: ${soVN(Math.max(0, soSku - khongKhop - ngung))} ghép tự động, ${soVN(khongKhop)} chưa có mã trùng${ngung ? `, ${soVN(ngung)} ngừng` : ""}`,
      message: null,
    };
  }
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
      title: `Đã đẩy ${soVN(daDay)}/${soVN(tong)} SKU lên ${tenSan}${soLoi > 0 ? ` · ${soVN(soLoi)} lỗi` : ""}`,
      message: `Dừng giữa chừng: ${loiKenh}. ${soVN(chuaDay)} SKU chưa đẩy sẽ được đẩy ở lần sau.`,
    };
  }
  if (soLoi > 0) {
    return {
      ok: false,
      tone: "warning",
      title: `Đã đẩy ${soVN(daDay)}/${soVN(tong)} SKU lên ${tenSan} · ${soVN(soLoi)} lỗi`,
      message: "Xem lý do ở tab Lỗi. Lần đẩy sau sẽ tự thử lại các SKU này.",
    };
  }
  if (tong === 0) {
    return { ok: true, tone: "success", title: "Không có SKU nào đang đồng bộ để đẩy tồn", message: null };
  }
  return {
    ok: true,
    tone: "success",
    title: `Đã đẩy tồn ${soVN(daDay)} SKU lên ${tenSan}`,
    message: "Dòng ngừng đồng bộ không được đẩy.",
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
