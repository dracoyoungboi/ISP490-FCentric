/*
 * Hàm thuần của khối "Bằng chứng đóng gói" ở cột phải Chi tiết đơn bán (chỉ xem). Không React, không alias "@/…" để chạy
 * `node --test`. Dữ liệu từ GET /dong-goi/don/{id}/bang-chung (ThongTinBangChungDonDto): `yeuCauVideo`,
 * `danhSachBangChung` (tệp đang lưu), `daDuBangChung`, `ngayTuXoa` (tệp đã bị dọn sau hạn lưu).
 */
import { TRANG_THAI_DON } from "../../../constants/trangThaiXuatBan.js";
import { oBangChung } from "../../outbound/dong-goi/tinhDongGoi.js";

const TT = TRANG_THAI_DON;

/** Tên ngắn dưới ảnh thu nhỏ (cột hẹp); hộp xem lớn dùng tên đầy đủ của máy chủ. */
export const TEN_NGAN_BANG_CHUNG = Object.freeze({
  VIDEO_DONG_GOI: "Video đóng gói",
  ANH_HANG_TRONG_HOP: "Hàng trong hộp",
  ANH_NIEM_PHONG_TEM_VC: "Niêm phong, tem vận chuyển",
});

/** Trạng thái đơn đã tới bước đóng gói trở đi: khối có thể có nội dung. Đơn hủy chỉ hiện khi còn tệp. */
const TRANG_THAI_CO_KHOI = new Set([TT.CHO_DONG_GOI, TT.DA_DONG_GOI, TT.DA_XUAT_MOT_PHAN, TT.DA_XUAT_KHO, TT.HOAN_THANH, TT.BI_HOAN_TRA, TT.DA_HUY]);

/**
 * Có tải và hiện khối không: đơn bán (không phải báo giá, không phải đơn tại quầy — bán tại quầy không qua đóng gói),
 * đã tới bước đóng gói, và người xem có vai trò bán hàng hoặc kho (máy chủ mở GET bằng chứng cho đúng các vai trò này).
 */
export function coKhoiBangChung({ trangThai, laPos = false, laBaoGia = false, laBan = false, laKho = false } = {}) {
  if (laPos || laBaoGia || !(laBan || laKho)) return false;
  return TRANG_THAI_CO_KHOI.has(Number(trangThai));
}

/**
 * Nội dung khối theo dữ liệu bằng chứng và trạng thái đơn:
 * - `co`: còn tệp → các ô có tệp (`o`, theo thứ tự yêu cầu), nhãn Đủ / Chưa đủ.
 * - `chuaCo`: Chờ đóng gói, chưa có tệp nào.
 * - `daXoa`: đã đóng gói xong nhưng tệp đã tự xóa sau hạn lưu (`ngayTuXoa`).
 * - `khongCo`: đã qua đóng gói mà chưa từng có bằng chứng (đơn xuất trước khi có bước đóng gói).
 * - `an`: đơn hủy không còn tệp → không vẽ khối.
 * Mỗi kết quả `{ kieu, nhan, nhom, cau? }`; `nhom`: nhóm màu của StatusBadge (xong | canChuY | thuong); `cau`: câu giải
 * thích khi không có tệp. Đơn đã qua đóng gói còn tệp mà máy chủ tính "chưa đủ" (video cũ không ghi thời lượng, đơn đổi
 * tổng tiền qua ngưỡng video sau khi chụp) không báo thiếu: đơn đã qua cổng hoàn tất, nhãn trung tính "Đã lưu".
 */
export function noiDungBangChung(duLieu, trangThai) {
  const tt = Number(trangThai);
  const ds = Array.isArray(duLieu?.danhSachBangChung) ? duLieu.danhSachBangChung.filter(Boolean) : [];
  if (ds.length) {
    const tatCa = oBangChung({ yeuCauVideo: Boolean(duLieu?.yeuCauVideo), danhSach: ds });
    // Tệp khác loại yêu cầu (đơn đổi tổng tiền qua ngưỡng video sau khi chụp) vẫn hiện, xếp sau các ô yêu cầu
    const ngoai = ds
      .filter((b) => !tatCa.some((x) => x.bangChung === b))
      .map((b) => oBangChung({ yeuCauVideo: b.loaiBangChung === "VIDEO_DONG_GOI", danhSach: [b] }).find((x) => x.bangChung === b))
      .filter(Boolean);
    const o = [...tatCa.filter((x) => x.bangChung), ...ngoai];
    const du = Boolean(duLieu?.daDuBangChung);
    if (du) return { kieu: "co", o, nhan: "Đủ", nhom: "xong" };
    return tt === TT.CHO_DONG_GOI
      ? { kieu: "co", o, nhan: "Chưa đủ", nhom: "canChuY" }
      : { kieu: "co", o, nhan: "Đã lưu", nhom: "thuong" };
  }
  if (tt === TT.DA_HUY) return { kieu: "an" };
  if (tt === TT.CHO_DONG_GOI) return { kieu: "chuaCo", nhan: "Chưa có", nhom: "canChuY", cau: "Chưa chụp hoặc quay bằng chứng đóng gói." };
  if (duLieu?.ngayTuXoa) return { kieu: "daXoa", nhan: "Đã tự xóa", nhom: "thuong", ngay: duLieu.ngayTuXoa };
  // Chờ xuất kho (đã đóng gói, chưa xuất) mà không còn tệp: không phải đơn cũ, không nói "xuất trước khi có bước đóng gói"
  const cau = tt === TT.DA_DONG_GOI
    ? "Không tìm thấy tệp bằng chứng của đơn."
    : "Đơn xuất kho trước khi có bước đóng gói nên không có bằng chứng.";
  return { kieu: "khongCo", nhan: "Không có", nhom: "thuong", cau };
}
