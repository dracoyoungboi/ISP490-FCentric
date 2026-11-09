import { formatNumber } from "../../utils/formatters.js";
import { t } from "@/i18n";

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
      title: t("Đã tải {{soSku}} SKU từ {{tenSan}}: {{soGhep}} ghép tự động, {{khongKhop}} chưa có mã trùng{{phanNgung}}", { count: soSku, soSku: formatNumber(soSku), tenSan, soGhep: formatNumber(Math.max(0, soSku - khongKhop - ngung)), khongKhop: formatNumber(khongKhop), phanNgung: ngung ? t(", {{ngung}} ngừng", { ngung: formatNumber(ngung) }) : "" }),
      message: null,
    };
  }
  return {
    ok: true,
    title: t("Đã đọc {{soSku}} SKU trên {{tenSan}}", { count: Number(res?.soSku) || 0, soSku: formatNumber(res?.soSku), tenSan }),
    message: t("Ghép mới {{soMoi}}, cập nhật {{soCapNhat}}. SKU không trùng với FCentric được bỏ qua; dòng đang ngừng đồng bộ giữ nguyên.", { soMoi: formatNumber(res?.soMoi), soCapNhat: formatNumber(res?.soCapNhat) }),
  };
}

/** POST tu-dong-lien-ket: tạo / cập nhật sản phẩm trên sàn, ghép và đẩy tồn. */
export function ketQuaDayLenSan(res, tenSan) {
  const loi = Number(res?.soThatBai || 0);
  return {
    ok: loi === 0,
    title: t("Đã ghép {{soDaGhep}} SKU", { soDaGhep: formatNumber(res?.soDaGhep), count: Number(res?.soDaGhep) || 0 }),
    message: [
      t("tạo mới trên {{tenSan}} {{soTaoMoiTrenShopify}} sản phẩm", { tenSan, count: Number(res?.soTaoMoiTrenShopify) || 0, soTaoMoiTrenShopify: formatNumber(res?.soTaoMoiTrenShopify) }),
      t("cập nhật {{soCapNhatTrenShopify}} sản phẩm", { count: Number(res?.soCapNhatTrenShopify) || 0, soCapNhatTrenShopify: formatNumber(res?.soCapNhatTrenShopify) }),
      t("đẩy tồn {{soTonKhoDaDay}} SKU", { soTonKhoDaDay: formatNumber(res?.soTonKhoDaDay) }),
      res?.soAnhDaDay ? t("{{soAnhDaDay}} ảnh", { count: Number(res.soAnhDaDay) || 0, soAnhDaDay: formatNumber(res.soAnhDaDay) }) : null,
      loi > 0 ? t("lỗi {{loi}}", { loi: formatNumber(loi) }) : null,
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
    return { ok: false, tone: "error", title: t("Không đẩy được tồn lên {{tenSan}}", { tenSan }), message: loiKenh };
  }
  if (loiKenh) {
    return {
      ok: false,
      tone: "warning",
      title: t("Đã đẩy {{daDay}}/{{tong}} SKU lên {{tenSan}}{{phanLoi}}", { count: tong, daDay: formatNumber(daDay), tong: formatNumber(tong), tenSan, phanLoi: soLoi > 0 ? t(" · {{soLoi}} lỗi", { count: soLoi, soLoi: formatNumber(soLoi) }) : "" }),
      message: t("Dừng giữa chừng: {{loiKenh}}. {{chuaDay}} SKU chưa đẩy sẽ được đẩy ở lần sau.", { count: chuaDay, loiKenh, chuaDay: formatNumber(chuaDay) }),
    };
  }
  if (soLoi > 0) {
    return {
      ok: false,
      tone: "warning",
      title: t("Đã đẩy {{daDay}}/{{tong}} SKU lên {{tenSan}} · {{soLoi}} lỗi", { count: tong, daDay: formatNumber(daDay), tong: formatNumber(tong), tenSan, soLoi: formatNumber(soLoi) }),
      message: t("Xem lý do ở tab Lỗi. Lần đẩy sau sẽ tự thử lại các SKU này."),
    };
  }
  if (tong === 0) {
    return { ok: true, tone: "success", title: t("Không có SKU nào đang đồng bộ để đẩy tồn"), message: null };
  }
  return {
    ok: true,
    tone: "success",
    title: t("Đã đẩy tồn {{daDay}} SKU lên {{tenSan}}", { daDay: formatNumber(daDay), tenSan, count: daDay }),
    message: t("Dòng ngừng đồng bộ không được đẩy."),
  };
}

/** POST lay-don */
export function ketQuaLayDon(res, tenSan) {
  return {
    ok: true,
    title: t("Đã lấy {{soDonMoi}} đơn mới từ {{tenSan}}", { soDonMoi: formatNumber(res?.soDonMoi), tenSan, count: Number(res?.soDonMoi) || 0 }),
    message: res?.soDonCapNhat ? t("Cập nhật {{soDonCapNhat}} đơn đã có.", { soDonCapNhat: formatNumber(res.soDonCapNhat), count: Number(res.soDonCapNhat) || 0 }) : null,
  };
}
