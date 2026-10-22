// Chặn gửi yêu cầu báo giá khi Thông tin cửa hàng thiếu tên đăng ký kinh doanh / địa chỉ đăng ký
// (demo-email/TT-ChanGuiBaoGia.dc.html) và xử lý mã lỗi của POST /gui-yeu-cau-bao-gia (HOP-DONG 2.1, 2.3).
// Hàm thuần, chạy được với node --test.
import { NHAN_THONG_TIN_CUA_HANG, oThieuDeGuiNhaCungCap } from "../../validations/companyProfileSchema.js";
import { getApiErrorCode } from "../../utils/apiError.js";

/** Mã lỗi máy chủ (LoiCoMaException): thiếu thông tin cửa hàng — 409, data.thieu = nhãn các ô thiếu. */
export const MA_THIEU_THONG_TIN_CUA_HANG = "THIEU_THONG_TIN_CUA_HANG";
/** Mã lỗi máy chủ: yêu cầu không còn ở trạng thái chờ gửi (bấm 2 lần, hoặc người khác vừa gửi) — 409. */
export const MA_YEU_CAU_DA_GUI = "YEU_CAU_DA_GUI";

export const TIEU_DE_KHUNG_CHAN = "Chưa gửi được yêu cầu báo giá";
export const CAU_LY_DO_KHUNG_CHAN = "Email gửi nhà cung cấp phải có tên đăng ký kinh doanh và địa chỉ đăng ký của cửa hàng.";
export const LIEN_KET_NHAP_THONG_TIN = "Nhập ở Cấu hình › Thông tin cửa hàng ›";
export const CAU_BAO_NGUOI_CO_QUYEN = "Hãy báo quản trị viên hoặc quản lý kho nhập thông tin này.";

const NHAN_BAT_BUOC = [NHAN_THONG_TIN_CUA_HANG.legalName, NHAN_THONG_TIN_CUA_HANG.address];

/** Nhãn ô thiếu máy chủ gửi kèm 409 (chỉ giữ nhãn đã biết, đúng thứ tự); không đọc được thì null. */
export function thieuTuLoi(error) {
  const thieu = error?.response?.data?.data?.thieu;
  if (!Array.isArray(thieu)) return null;
  const biet = NHAN_BAT_BUOC.filter((nhan) => thieu.includes(nhan));
  return biet.length ? biet : null;
}

/**
 * Ô còn thiếu để hiện khung chặn: ưu tiên kết quả máy chủ vừa trả (409), không có thì tính từ hồ sơ đã tải.
 * Hồ sơ chưa tải được (lỗi mạng) thì không chặn ở giao diện — máy chủ vẫn chặn.
 */
export function oThieuHienTai({ hoSo, thieuTuMayChu = null }) {
  if (Array.isArray(thieuTuMayChu) && thieuTuMayChu.length) return thieuTuMayChu;
  return oThieuDeGuiNhaCungCap(hoSo);
}

/** Tách nhãn thiếu thành các đoạn để in đậm từng nhãn: ["A"] hoặc ["A", " và ", "B"]. */
export function doanNhanThieu(thieu) {
  return (thieu ?? []).flatMap((nhan, i) => (i === 0 ? [nhan] : [" và ", nhan]));
}

/**
 * Cách xử lý lỗi khi gửi:
 * - { loai: "thieu", thieu }: đóng hộp xác nhận, hiện khung chặn (không toast trùng câu);
 *   `thieu` null nghĩa là máy chủ không kèm danh sách — tải lại hồ sơ để tính;
 * - { loai: "daGui", message }: báo câu máy chủ rồi về chi tiết yêu cầu;
 * - { loai: "khac", message }.
 */
export function xuLyLoiGui(error, cauDuPhong = "Gửi yêu cầu thất bại. Vui lòng thử lại.") {
  const ma = getApiErrorCode(error);
  const message = error?.response?.data?.message;
  const cau = typeof message === "string" && message.trim() ? message.trim() : cauDuPhong;
  if (ma === MA_THIEU_THONG_TIN_CUA_HANG) return { loai: "thieu", thieu: thieuTuLoi(error) };
  if (ma === MA_YEU_CAU_DA_GUI) return { loai: "daGui", message: cau };
  if (!error?.response && error?.request) {
    return { loai: "khac", message: "Không nhận được phản hồi từ máy chủ. Vui lòng thử lại." };
  }
  return { loai: "khac", message: cau };
}

/**
 * Câu cho 500 có thân JSON khi gửi. Máy chủ mới chỉ gửi email yêu cầu báo giá sau khi lưu xong (HOP-DONG 2.5, 6.11;
 * EmailDispatcher.guiSauCommit không ném lỗi ra nơi gọi): 500 nghĩa là giao dịch đã hoàn tác và chưa nhà cung cấp nào
 * nhận email.
 */
export const CAU_LOI_MAY_CHU_KHI_GUI =
  "Máy chủ gặp lỗi nên chưa ghi nhận yêu cầu báo giá; chưa nhà cung cấp nào nhận email. Vui lòng thử lại.";

/**
 * Chỉnh kết quả gui-bao-gia/tinhGuiBaoGia.phanLoaiLoiGui theo máy chủ mới: loại "email" (500 JSON) viết cho máy chủ cũ
 * gửi email trong giao dịch ("có thể vài nhà cung cấp đã nhận email…") → dùng CAU_LOI_MAY_CHU_KHI_GUI. Loại khác giữ nguyên.
 */
export function loiGuiTheoMayChuMoi(loi) {
  return loi?.loai === "email" ? { ...loi, chu: CAU_LOI_MAY_CHU_KHI_GUI } : loi;
}

/** Nút "Gửi báo giá" khóa khi: chưa chọn NCC, yêu cầu chưa tải được, thiếu thông tin cửa hàng, đang gửi, đã gửi. */
export function khoaNutGui({ soDaChon, dangTaiYeuCau, coYeuCau, thieu, dangGui = false, daGui = false }) {
  return soDaChon === 0 || dangTaiYeuCau || !coYeuCau || (thieu?.length ?? 0) > 0 || dangGui || daGui;
}

/** Toast sau khi gửi (HOP-DONG 6.11): email gửi sau khi lưu đơn nên không khẳng định email đã đi. */
export function cauDaGui(soNhaCungCap) {
  return `Đã tạo báo giá cho ${soNhaCungCap} nhà cung cấp. Email yêu cầu đang được gửi.`;
}

/** Đầu cột "Danh sách sẽ gửi": "{n} nhà cung cấp". */
export function nhanSoNhaCungCap(n) {
  return `${n} nhà cung cấp`;
}
