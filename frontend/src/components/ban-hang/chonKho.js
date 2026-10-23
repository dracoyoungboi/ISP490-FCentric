/*
 * Hàm thuần của hộp chọn kho theo tồn khả dụng (GET /don-ban-hang/{id}/kho-kha-dung): dùng cho "Gửi sang kho" ở
 * Chi tiết đơn bán hàng (và "Chốt thành đơn" của báo giá khi được duyệt). Không React, chạy được bằng `node --test`.
 *
 * Mỗi kho của máy chủ (KhoKhaDungDto): `{ khoId, maKho, tenKho, diaChi, duHang, soLuongMatHangDu, tongSoMatHang,
 * chiTietTonKho: [{ bienTheId, maSku, tenSanPham, tenBienThe, soLuongDat, tonKhaDung, duHang }] }`.
 */
import { NGUONG_TIM_KHO, SO_MAT_HANG_THIEU_HIEN } from "../../config/bangChungTu.js";
import { laKhoAo } from "../../utils/kho.js";
import { boDau, docSo, soVN } from "../chung-tu/bangChungTu.js";

/** Id của một kho trong danh sách tồn khả dụng (bản cũ có thể trả `id`). */
export const idKho = (kho) => kho?.khoId ?? kho?.id ?? null;

const giongId = (a, b) => a != null && b != null && String(a) === String(b);

/** Bỏ kho ảo (kho trung chuyển) và phần tử rỗng: không gợi ý kho ảo làm kho xuất. */
export function khoChonDuoc(ds) {
  return (Array.isArray(ds) ? ds : []).filter((k) => k && idKho(k) != null && !laKhoAo(k));
}

/** Xếp như máy chủ: kho đủ hàng trước → nhiều mặt hàng đủ hơn → tên kho (A–Z, theo tiếng Việt). */
export function xepKho(ds) {
  return [...(Array.isArray(ds) ? ds : [])].sort(
    (a, b) =>
      Number(Boolean(b?.duHang)) - Number(Boolean(a?.duHang))
      || docSo(b?.soLuongMatHangDu) - docSo(a?.soLuongMatHangDu)
      || String(a?.tenKho ?? "").localeCompare(String(b?.tenKho ?? ""), "vi"),
  );
}

/** Có hiện ô tìm kho không: quá NGUONG_TIM_KHO kho. */
export const coTimKho = (soKho, nguong = NGUONG_TIM_KHO) => docSo(soKho) > nguong;

/** Lọc kho theo tên, mã hoặc địa chỉ (không dấu, không phân biệt hoa thường). */
export function locKho(ds, tuKhoa) {
  const tu = boDau(String(tuKhoa ?? "").trim());
  const mang = Array.isArray(ds) ? ds : [];
  if (!tu) return mang;
  return mang.filter((k) => boDau(`${k?.tenKho ?? ""} ${k?.maKho ?? ""} ${k?.diaChi ?? ""}`).includes(tu));
}

/**
 * Kho chọn sẵn khi mở hộp: chỉ kho hiện tại của đơn và chỉ khi kho đó đủ hàng; còn lại (thiếu hàng, không có trong
 * danh sách, đơn chưa có kho) thì `null` — người dùng tự chọn.
 */
export function khoChonSan(ds, khoHienTaiId) {
  const k = (Array.isArray(ds) ? ds : []).find((x) => giongId(idKho(x), khoHienTaiId));
  return k && k.duHang ? idKho(k) : null;
}

/** Số mặt hàng đủ / tổng số mặt hàng của một kho. */
export function demMatHang(kho) {
  const tong = docSo(kho?.tongSoMatHang);
  const du = Math.min(tong, Math.max(0, docSo(kho?.soLuongMatHangDu)));
  return { du, tong, thieu: tong - du };
}

/** Nhãn thẻ của kho: "Đủ hàng (5/5)" hoặc "Thiếu hàng (2/5)" (số mặt hàng thiếu / tổng). */
export function nhanKho(kho) {
  const { du, tong, thieu } = demMatHang(kho);
  return kho?.duHang ? `Đủ hàng (${soVN(du)}/${soVN(tong)})` : `Thiếu hàng (${soVN(thieu)}/${soVN(tong)})`;
}

/** Tên một mặt hàng trong danh sách thiếu: "Tên sản phẩm · Màu / Cỡ" (thiếu tên thì SKU). */
export function tenMatHang(ct) {
  const ten = String(ct?.tenSanPham ?? "").trim() || String(ct?.maSku ?? "").trim() || "—";
  const bt = String(ct?.tenBienThe ?? "").trim();
  return bt ? `${ten} · ${bt}` : ten;
}

/**
 * Mặt hàng thiếu của một kho để hiện dưới kho: tối đa `toiDa` dòng `{ khoa, ten, so: "cần 3 · còn 1" }`,
 * `conLai`: số mặt hàng thiếu không hiện.
 */
export function matHangThieu(kho, toiDa = SO_MAT_HANG_THIEU_HIEN) {
  const thieu = (Array.isArray(kho?.chiTietTonKho) ? kho.chiTietTonKho : []).filter((ct) => ct && !ct.duHang);
  return {
    hien: thieu.slice(0, toiDa).map((ct, i) => ({
      khoa: `${ct.bienTheId ?? ct.maSku ?? "mh"}-${i}`,
      ten: tenMatHang(ct),
      so: `cần ${soVN(ct.soLuongDat)} · còn ${soVN(ct.tonKhaDung)}`,
    })),
    conLai: Math.max(0, thieu.length - toiDa),
  };
}

/** Câu cảnh báo khi đã chọn kho thiếu hàng ở "Gửi sang kho" (vẫn gửi được). */
export function cauKhoThieu(kho) {
  const { du, tong } = demMatHang(kho);
  return `${kho?.tenKho || "Kho này"} chỉ đủ ${soVN(du)}/${soVN(tong)} mặt hàng. Vẫn gửi được, nhưng kho sẽ không nhặt đủ cho đơn: nên chuyển kho nội bộ trước hoặc chọn kho đủ hàng.`;
}
