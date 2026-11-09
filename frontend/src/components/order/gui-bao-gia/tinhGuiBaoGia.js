/*
 * Hàm thuần của màn Gửi yêu cầu báo giá (/purchase-requests/:id/send-quotation): màn chặn theo trạng thái yêu cầu, lọc /
 * tìm nhà cung cấp, chọn tất cả, phân loại lỗi khi gửi. Không gọi API, không phụ thuộc React, chạy được bằng `node --test`.
 *
 * Máy chủ (DonMuaHangService.guiYeuCauBaoGiaDenNhaCungCap, @Transactional): chỉ gửi khi yêu cầu ở 2 Đã duyệt (khác →
 * 400 "Đơn mua hàng chưa được duyệt"); kiểm HẾT nhà cung cấp trước khi tạo (ngừng hoạt động / chưa có email / không tìm
 * thấy → 400, chưa gửi cho ai); gửi email đồng bộ trong giao dịch — lỗi email → 500 câu tiếng Anh, dữ liệu hoàn tác nhưng
 * email đã đi thì không thu hồi được.
 */
import { docSo, khopTuKhoa, soVN, tachTuKhoa } from "../../chung-tu/bangChungTu.js";
import { coTheGuiYeuCauBaoGia } from "../../supplier/quyTacNhaCungCap.js";
import { TRANG_THAI_YEU_CAU, baoGiaDaChot, ngayGuiBaoGia } from "../chi-tiet-yeu-cau/tinhYeuCau.js";
import { t } from "../../../i18n/t.js";
import { cauGocMayChu } from "../../../i18n/cauGoc.js";

/** Mã hiện của yêu cầu: `soYeuCauMuaHang`, trống thì "#id". */
export const maYeuCau = (yc, id) => yc?.soYeuCauMuaHang || `#${yc?.id ?? id ?? ""}`;

const pad2 = (n) => String(n).padStart(2, "0");
const gioNgay = (d) => (d ? `${pad2(d.getHours())}:${pad2(d.getMinutes())} · ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}` : "");

/**
 * Màn chặn (không gửi được) theo yêu cầu, hoặc null khi gửi được (2 Đã duyệt, có sản phẩm).
 * `{ ma, tieuDe, moTa, nut: [{ ma: "soSanh" | "donMua", nhan, to }] }` — nút "Về yêu cầu nhập hàng" màn tự thêm.
 * `xemDonMua`: người này mở được Chi tiết đơn mua hàng (tinhYeuCau.VAI_TRO_XEM_DON_MUA); không thì trạng thái 5 chỉ có
 * "Mở so sánh báo giá" (đọc qua API yêu cầu).
 */
export function chanGuiBaoGia(yc, { xemDonMua = true } = {}) {
  if (!yc) return null;
  const ma = maYeuCau(yc);
  const tt = docSo(yc.trangThai);
  if (tt === TRANG_THAI_YEU_CAU.DA_GUI_BAO_GIA) {
    const luc = gioNgay(ngayGuiBaoGia(yc));
    return {
      ma: "daGui",
      tieuDe: t("Yêu cầu này đã gửi yêu cầu báo giá"),
      moTa: luc
        ? t("{{ma}} đã gửi cho nhà cung cấp lúc {{luc}}. Mỗi yêu cầu chỉ gửi một lần.", { ma, luc })
        : t("{{ma}} đã gửi cho nhà cung cấp. Mỗi yêu cầu chỉ gửi một lần.", { ma }),
      nut: [{ ma: "soSanh", nhan: t("Mở so sánh báo giá"), to: `/quotation-requests/${yc.id}` }],
    };
  }
  if (tt === TRANG_THAI_YEU_CAU.TU_CHOI) {
    const lyDo = String(yc.lyDoTuChoi ?? "").trim();
    return {
      ma: "tuChoi",
      tieuDe: t("Yêu cầu nhập hàng đã bị từ chối"),
      moTa: lyDo
        ? t("{{ma}} bị từ chối: {{lyDo}}. Không gửi yêu cầu báo giá được.", { ma, lyDo: lyDo.replace(/[.\s]+$/, "") })
        : t("{{ma}} đã bị từ chối. Không gửi yêu cầu báo giá được.", { ma }),
      nut: [],
    };
  }
  if (tt === TRANG_THAI_YEU_CAU.DA_CHUYEN_DON_MUA) {
    const don = baoGiaDaChot(yc);
    const maDon = don.map((d) => d.soDonMua).filter(Boolean);
    return {
      ma: "daChuyen",
      tieuDe: t("Yêu cầu đã chuyển thành đơn mua hàng"),
      moTa: t("{{ma}} đã chốt nhà cung cấp và chuyển thành đơn mua hàng{{dsMaDon}}.", { ma, dsMaDon: maDon.length ? ` ${maDon.join(", ")}` : "" }),
      nut:
        xemDonMua && don.length === 1 && don[0].id != null
          ? [{ ma: "donMua", nhan: t("Mở đơn mua hàng"), to: `/purchase-orders/${don[0].id}` }]
          : [{ ma: "soSanh", nhan: t("Mở so sánh báo giá"), to: `/quotation-requests/${yc.id}` }],
    };
  }
  if (tt !== TRANG_THAI_YEU_CAU.DA_DUYET) {
    return {
      ma: "chuaDuyet",
      tieuDe: t("Yêu cầu nhập hàng chưa được duyệt"),
      moTa: t("{{ma}} chưa được duyệt. Quản lý kho phê duyệt xong mới gửi yêu cầu báo giá được.", { ma }),
      nut: [],
    };
  }
  if (!(Array.isArray(yc.chiTietYeuCauMuaHangs) && yc.chiTietYeuCauMuaHangs.length)) {
    return {
      ma: "rong",
      tieuDe: t("Yêu cầu chưa có sản phẩm nào"),
      moTa: t("{{ma}} chưa có dòng sản phẩm nên không gửi yêu cầu báo giá được.", { ma }),
      nut: [],
    };
  }
  return null;
}

/** Tổng số lượng đặt của yêu cầu (`soLuongDat` từng dòng). */
export const tongSoLuongDat = (yc) =>
  (Array.isArray(yc?.chiTietYeuCauMuaHangs) ? yc.chiTietYeuCauMuaHangs : []).reduce((tong, ct) => tong + docSo(ct?.soLuongDat), 0);

/** Tên một dòng sản phẩm của yêu cầu ở cột phải: tên biến thể của máy chủ, thiếu thì tên sản phẩm, rồi SKU. */
export const tenDongYeuCau = (ct) =>
  ct?.bienTheSanPham?.tenBienThe || ct?.bienTheSanPham?.tenSanPham || ct?.bienTheSanPham?.maSku || "—";

// ── Nhà cung cấp ─────────────────────────────────────────────────────────────

/** Dòng bảng nhà cung cấp: kèm trường cho ô tìm dùng chung (tên, mã, email, người liên hệ) và `guiDuoc`. */
export function dongNhaCungCap(ds) {
  return (Array.isArray(ds) ? ds : []).filter((n) => n?.id != null).map((n) => ({
    id: n.id,
    ncc: n,
    ten: n.tenNhaCungCap || n.maNhaCungCap || "—",
    ma: n.maNhaCungCap || "",
    email: String(n.email ?? "").trim(),
    nguoiLienHe: n.nguoiLienHe || "",
    guiDuoc: coTheGuiYeuCauBaoGia(n),
    hoatDong: Number(n.trangThai) === 1,
    // Ô tìm dùng chung (bangChungTu.khopTuKhoa) đọc các trường này
    tenSanPham: n.tenNhaCungCap || "",
    sku: n.maNhaCungCap || "",
    chuTimThem: [n.email || "", n.nguoiLienHe || ""],
  }));
}

/** Lọc: "duoc" (gửi được) | "tatCa", rồi tìm theo từ khóa (không dấu; từ 1–2 ký tự phải trùng nguyên từ). */
/**
 * Câu khi tìm ở bộ lọc "Gửi được" không ra nhưng ở "Tất cả" có (nhà cung cấp chưa có email / ngừng hoạt động — nơi có
 * "Cập nhật email"); "" khi không cần.
 */
export function cauKhopNgoaiLoc(dong, { loc, tuKhoa }) {
  if (loc !== "duoc" || !String(tuKhoa ?? "").trim()) return "";
  if (locNhaCungCap(dong, { loc, tuKhoa }).length) return "";
  const n = locNhaCungCap(dong, { loc: "tatCa", tuKhoa }).length;
  return n ? t("Có {{n}} nhà cung cấp khớp “{{tuKhoa}}” nhưng chưa gửi được (ngừng hoạt động hoặc chưa có email).", { count: n, n: soVN(n), tuKhoa: String(tuKhoa).trim() }) : "";
}

export function locNhaCungCap(dong, { loc = "duoc", tuKhoa = "" } = {}) {
  const tu = tachTuKhoa(tuKhoa);
  return (Array.isArray(dong) ? dong : []).filter((d) => (loc !== "duoc" || d.guiDuoc) && (!tu.length || khopTuKhoa(d, tu)));
}

/** Nhãn "Chọn tất cả …": các nhà cung cấp gửi được trong kết quả đang xem mà chưa chọn. */
export function chuChonTatCa(soChuaChon, dangTim) {
  return dangTim
    ? t("Chọn {{soChuaChon}} nhà cung cấp gửi được trong kết quả", { count: soChuaChon, soChuaChon: soVN(soChuaChon) })
    : t("Chọn tất cả {{soChuaChon}} nhà cung cấp gửi được", { count: soChuaChon, soChuaChon: soVN(soChuaChon) });
}

/** Chữ viết tắt trên ô tròn: chữ cái đầu của hai từ cuối tên. */
export const chuVietTat = (ten) =>
  String(ten ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0].toUpperCase())
    .join("");

// ── Lỗi khi gửi ──────────────────────────────────────────────────────────────

// Câu máy chủ khi yêu cầu không còn ở Đã duyệt (tab khác đã gửi, đã bị từ chối…)
const MAU_KHONG_CON_DUYET = /chưa được duyệt/i;

export const CAU_LOI_EMAIL =
  t("Gửi email bị lỗi giữa chừng. Hệ thống chưa ghi nhận yêu cầu báo giá, nhưng có thể vài nhà cung cấp đã nhận email với mã không còn dùng. Liên hệ các nhà cung cấp đó trước khi gửi lại.");
export const CAU_CHUA_RO_GUI =
  t("Chưa rõ yêu cầu đã gửi hay chưa: máy chủ phản hồi quá lâu hoặc mất kết nối, trong khi việc gửi có thể vẫn đang chạy. Nút Gửi tạm khóa, màn tự tải lại yêu cầu sau ít phút; nếu yêu cầu vẫn ở Đã duyệt thì gửi lại, để nhà cung cấp không nhận hai email.");

const cauCua = (cau) => (cau ? `${cau.replace(/[.\s]+$/, "")}. ` : "");

/**
 * Phân loại lỗi của lần gửi. `{ loai, chu }`:
 * - "doiTrangThai": yêu cầu không còn Đã duyệt (gửi lần hai, tab khác đã gửi) → tải lại yêu cầu, hiện màn chặn.
 * - "ncc": 400 (máy chủ kiểm hết nhà cung cấp trước khi tạo) → chưa gửi cho ai; tải lại danh sách nhà cung cấp (nhà cung
 *   cấp hết gửi được tự bỏ chọn).
 * - "quyen": 403 (vai trò không được gửi) → câu về quyền, không tải lại.
 * - "khac": 4xx khác (vd. 409 trùng mã đơn khi đã gửi một phần) → không khẳng định gì; tải lại yêu cầu và nhà cung cấp.
 * - "email": 500 của máy chủ (trả JSON — lỗi gửi email, câu tiếng Anh nên thay bằng câu riêng; giao dịch đã hoàn tác).
 * - "chuaRo": không có trả lời, hoặc 5xx không phải của máy chủ (502/503/504 của proxy, trang HTML) → máy chủ có thể vẫn
 *   đang gửi; khóa nút Gửi một lúc rồi mới tải lại (CHO_GUI_LAI_MS).
 * @param laJson  trả lời có thân JSON của máy chủ (không phải trang lỗi của proxy)
 */
export function phanLoaiLoiGui(trangThai, cauMayChu, { laJson = true } = {}) {
  const st = Number(trangThai) || 0;
  const cau = String(cauMayChu ?? "").trim();
  if (!st || (st >= 500 && (!laJson || st !== 500))) return { loai: "chuaRo", chu: CAU_CHUA_RO_GUI };
  if (st >= 500) return { loai: "email", chu: CAU_LOI_EMAIL };
  if (st === 403) return { loai: "quyen", chu: t("{{cau}}Tài khoản của bạn không gửi được yêu cầu báo giá.", { cau: cauCua(cau) }) };
  if (MAU_KHONG_CON_DUYET.test(cauGocMayChu(cau))) return { loai: "doiTrangThai", chu: "" };
  if (st === 400) {
    return {
      loai: "ncc",
      chu: t("{{cau}}Chưa gửi cho nhà cung cấp nào. Danh sách nhà cung cấp được tải lại; nhà cung cấp không còn gửi được tự bỏ chọn.", { cau: cauCua(cau) }),
    };
  }
  return { loai: "khac", chu: t("{{cau}}Đã tải lại yêu cầu và danh sách nhà cung cấp: kiểm tra trạng thái yêu cầu trước khi gửi lại.", { cau: cauCua(cau) }) };
}
