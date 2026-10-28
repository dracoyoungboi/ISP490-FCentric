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

/** "2 ảnh" / "1 video" / "1 video, 1 ảnh": số tệp đang lưu theo loại. */
function demTep(o) {
  const video = o.filter((x) => x.laVideo).length;
  const anh = o.length - video;
  return [video ? `${video} video` : "", anh ? `${anh} ảnh` : ""].filter(Boolean).join(", ");
}

/**
 * Nội dung khối theo dữ liệu bằng chứng và trạng thái đơn. Không dùng nhãn trạng thái: trường hợp bình thường chỉ là một
 * dòng chữ mờ như các nhóm khác của cột phải; màu cảnh báo chỉ khi đơn còn Chờ đóng gói mà thiếu tệp (`canChuY`).
 * - `co`: còn tệp → các ô có tệp (`o`, theo thứ tự yêu cầu), `dem` ("2 ảnh"), `hanLuu` (hạn sớm nhất của các tệp);
 *   Chờ đóng gói chưa đủ → `canChuY` + `thieu` (tên ngắn các loại còn thiếu). Đơn đã qua đóng gói mà máy chủ tính "chưa đủ"
 *   (video cũ không ghi thời lượng, đơn đổi tổng tiền qua ngưỡng video sau khi chụp) không báo thiếu: đơn đã qua cổng hoàn tất.
 * - `chuaCo`: Chờ đóng gói, chưa có tệp nào (`canChuY`).
 * - `daXoa`: đã đóng gói xong nhưng tệp đã tự xóa sau hạn lưu (`ngay` = `ngayTuXoa`).
 * - `khongCo`: đã qua đóng gói mà không có tệp (`cau` theo trạng thái).
 * - `an`: đơn hủy không còn tệp → không vẽ khối.
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
    const hanLuu = o.map((x) => x.bangChung.ngayHetHan).filter(Boolean).sort()[0] ?? null;
    const canChuY = tt === TT.CHO_DONG_GOI && !duLieu?.daDuBangChung;
    const thieu = canChuY ? tatCa.filter((x) => !x.bangChung).map((x) => TEN_NGAN_BANG_CHUNG[x.loai] ?? x.ten) : [];
    return { kieu: "co", o, dem: demTep(o), hanLuu, canChuY, thieu };
  }
  if (tt === TT.DA_HUY) return { kieu: "an" };
  if (tt === TT.CHO_DONG_GOI) return { kieu: "chuaCo", canChuY: true, cau: "Chưa chụp hoặc quay bằng chứng đóng gói." };
  if (duLieu?.ngayTuXoa) return { kieu: "daXoa", ngay: duLieu.ngayTuXoa };
  // Chờ xuất kho (đã đóng gói, chưa xuất) mà không còn tệp: không phải đơn cũ, không nói "xuất trước khi có bước đóng gói"
  const cau = tt === TT.DA_DONG_GOI
    ? "Không tìm thấy tệp bằng chứng của đơn."
    : "Đơn xuất kho trước khi có bước đóng gói nên không có bằng chứng.";
  return { kieu: "khongCo", cau };
}
