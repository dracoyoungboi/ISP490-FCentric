/**
 * Logic thuần của thông báo nhanh (không phụ thuộc React, DOM hay thư viện toast) để test được bằng node.
 * Chạy test: node --test src/lib/tinhThongBaoNhanh.test.js
 */
import { CAU_HINH_THONG_BAO_NHANH } from "../config/thongBaoNhanh.js";

/** Loại thông báo của thư viện → khóa thời gian trong cấu hình. */
const KHOA_THOI_GIAN = Object.freeze({
  success: "thanhCong",
  info: "thongTin",
  message: "thongTin",
  warning: "canhBao",
  error: "loi",
});

/** Tổng số ký tự của các phần là chữ (bỏ qua phần không phải chữ như JSX). */
export function demKyTu(...cacPhan) {
  return cacPhan.reduce((tong, phan) => {
    if (typeof phan === "string") return tong + phan.trim().length;
    if (typeof phan === "number") return tong + String(phan).length;
    return tong;
  }, 0);
}

/**
 * Thời gian tự tắt (ms) của một thông báo.
 * - Trang tự truyền `duration` thì giữ nguyên.
 * - Đang xử lý (loading) thì không tự tắt.
 * - Có nút thao tác (action/cancel) dùng thời gian "coNutThaoTac".
 * - Chữ dài thì giữ lâu hơn, nhưng không quá `docChu.toiDa` (và không ngắn hơn mức theo loại).
 */
export function tinhThoiGian(loai, tieuDe, tuyChon = {}, cauHinh = CAU_HINH_THONG_BAO_NHANH) {
  if (tuyChon.duration !== undefined) return tuyChon.duration;
  if (loai === "loading") return Infinity;

  const { thoiGian, docChu } = cauHinh;
  const coNut = Boolean(tuyChon.action || tuyChon.cancel);
  const theoLoai = coNut ? thoiGian.coNutThaoTac : thoiGian[KHOA_THOI_GIAN[loai] ?? "thongTin"];
  if (!Number.isFinite(theoLoai)) return theoLoai;

  const theoDoDai = docChu.msNen + docChu.msMoiKyTu * demKyTu(tieuDe, tuyChon.description);
  return Math.min(Math.max(theoLoai, theoDoDai), Math.max(theoLoai, docChu.toiDa));
}

/** Góc hiện thông báo cho một đường dẫn: khớp tiền tố trong `viTriTheoTrang`, không khớp thì dùng góc mặc định. */
export function viTriTheoTrang(duongDan = "", cauHinh = CAU_HINH_THONG_BAO_NHANH) {
  const khop = cauHinh.viTriTheoTrang.find(
    ({ tienTo }) => duongDan === tienTo || duongDan.startsWith(`${tienTo}/`),
  );
  return khop ? khop.viTri : cauHinh.viTri;
}

/**
 * Chữ của thông báo sau khi sao chép, lấy từ nhãn nút: "Sao chép số điện thoại" → "Đã sao chép số điện thoại".
 * Nhãn không bắt đầu bằng "Sao chép" thì báo chung "Đã sao chép".
 */
export function chuDaSaoChep(nhan) {
  const chu = typeof nhan === "string" ? nhan.trim() : "";
  return /^sao chép/i.test(chu) ? `Đã sao chép${chu.slice("sao chép".length)}` : "Đã sao chép";
}

/** Khóa để gộp thông báo trùng: chỉ áp dụng cho nội dung là chữ. */
export function taoKhoaGop(loai, tieuDe) {
  return typeof tieuDe === "string" && tieuDe.trim() ? `tb:${loai}:${tieuDe.trim()}` : null;
}

/**
 * Số lần đếm của một thông báo trùng.
 * `truoc`: { soLan, luc } của lần gọi trước (hoặc undefined), `dangHien`: ô cũ còn trên màn hình không.
 * Ô cũ đã tắt thì đếm lại từ 1; hai lần gọi sát nhau (dưới msCungMotLan) coi là một lần.
 */
export function tinhSoLan({ truoc, dangHien, bayGio, msCungMotLan = CAU_HINH_THONG_BAO_NHANH.msCungMotLan }) {
  if (!truoc || !dangHien) return { soLan: 1, luc: bayGio };
  if (bayGio - truoc.luc < msCungMotLan) return { soLan: truoc.soLan, luc: bayGio };
  return { soLan: truoc.soLan + 1, luc: bayGio };
}

/**
 * Khoảng cần nâng thông báo lên (px) để không che thanh dính đáy.
 * `cacKhung`: danh sách khung { top, bottom, height } của các thanh; chỉ tính thanh đang hiện,
 * đang nằm sát đáy màn hình (cách đáy không quá `saiSo`) và không chiếm quá nửa màn hình.
 */
export function tinhKhoangTranhDay(cacKhung, chieuCaoManHinh, saiSo = 24) {
  let khoang = 0;
  for (const khung of cacKhung) {
    if (!khung || khung.height <= 0) continue;
    if (khung.height > chieuCaoManHinh / 2) continue;
    if (khung.top >= chieuCaoManHinh) continue;
    if (chieuCaoManHinh - khung.bottom > saiSo) continue;
    khoang = Math.max(khoang, Math.round(chieuCaoManHinh - khung.top));
  }
  return khoang;
}
