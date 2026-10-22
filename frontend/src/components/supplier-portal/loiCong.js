/**
 * Lỗi và thông báo của 3 API cổng nhà cung cấp (lay-otp, xac-nhan-otp, bao-gia).
 * Cổng xử lý theo MÃ LỖI máy chủ trả (`data.code`, rồi `error`), không dò câu chữ (HOP-DONG 2.1, 2.2; đặc tả L15).
 * Thời hạn mã và thời gian chờ gửi lại lấy từ máy chủ (`hetHanGiay`, `guiLaiSauGiay`), không viết cứng ở đây.
 * Hàm thuần, chạy được bằng `node --test`.
 */
import { getApiErrorCode } from "../../utils/apiError.js";

export const MA_LOI_CONG = Object.freeze({
  DON_HOAC_EMAIL_SAI: "DON_HOAC_EMAIL_SAI",
  DON_KHONG_CON_NHAN: "DON_KHONG_CON_NHAN",
  MA_CU_CON_HIEU_LUC: "MA_CU_CON_HIEU_LUC",
  MA_SAI: "MA_SAI",
  MA_HET_HAN: "MA_HET_HAN",
  PHIEN_HET_HAN: "PHIEN_HET_HAN",
  CHUA_GUI_DUOC_MA: "CHUA_GUI_DUOC_MA",
  BAO_GIA_KHONG_HOP_LE: "BAO_GIA_KHONG_HOP_LE",
});

// Câu chép đúng HOP-DONG 2.1 (máy chủ cũng trả đúng câu này trong `message`)
export const CAU_DON_KHONG_CON_NHAN =
  "Đơn mua hàng này không còn nhận báo giá. Vui lòng liên hệ nhân viên mua hàng đã gửi yêu cầu cho Quý công ty.";
export const CAU_PHIEN_HET_HAN = "Phiên báo giá đã hết hạn. Vui lòng nhận mã mới.";

export const LOI_MAT_KET_NOI = "Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.";
export const CAU_MA_CU_CON_HIEU_LUC = "Mã xác nhận gửi trước đó vẫn còn hiệu lực. Hãy dùng mã trong email gần nhất.";
export const CAU_CHO_GUI_LAI = "Đã gửi nhiều mã xác nhận cho đơn này. Vui lòng chờ rồi nhận mã mới.";
export const CAU_CHUA_GUI_DUOC_MA = "Chưa gửi được mã xác nhận. Vui lòng thử lại.";
export const CAU_LOI_NHAN_MA = "Có lỗi khi gửi mã xác nhận. Vui lòng thử lại.";
export const CAU_MA_SAI = "Mã xác nhận không đúng. Vui lòng nhập lại hoặc gửi lại mã.";
export const CAU_MA_HET_HAN =
  "Mã xác nhận đã hết hạn hoặc đã nhập sai quá số lần cho phép. Bấm Gửi lại mã để nhận mã mới.";
export const CAU_LOI_XAC_NHAN = "Không xác nhận được mã. Vui lòng thử lại.";
export const LOI_GUI_MAC_DINH =
  "Không gửi được báo giá. Đơn giá bạn đã nhập vẫn còn trên trang. Kiểm tra kết nối mạng rồi thử lại.";

/** `data` kèm theo lỗi (vd. `guiLaiSauGiay`, `conLaiLanThu`, `dong`); không có thì {}. */
export function duLieuLoi(err) {
  const d = err?.response?.data?.data;
  return d && typeof d === "object" ? d : {};
}

/** Câu `message` của máy chủ (đã cắt khoảng trắng), không có thì "". */
export function cauMayChu(err) {
  const m = err?.response?.data?.message;
  return typeof m === "string" ? m.trim() : "";
}

/** Số giây nguyên ≥ 0 từ máy chủ; thiếu / sai kiểu thì null. */
export function soGiay(giaTri) {
  if (giaTri === null || giaTri === undefined || giaTri === "") return null;
  const so = Number(giaTri);
  return Number.isFinite(so) && so >= 0 ? Math.ceil(so) : null;
}

/** `data` của Nhận mã thành công: `{ hetHanGiay, guiLaiSauGiay }` (số giây hoặc null nếu máy chủ không trả). */
export function docThoiHanMa(data) {
  return { hetHanGiay: soGiay(data?.hetHanGiay), guiLaiSauGiay: soGiay(data?.guiLaiSauGiay) };
}

/** "5 phút" (làm tròn, ít nhất 1 phút). */
const chuPhut = (giay) => `${Math.max(1, Math.round(giay / 60))} phút`;

/**
 * Câu báo ở bước nhập mã sau khi gửi mã. Có `hetHanGiay` thì nói thời hạn theo máy chủ; không có thì bỏ câu thời hạn
 * (không đoán). Lần đầu không nhắc lại "đã gửi mã": dòng dưới tiêu đề "Mã 6 chữ số đã được gửi tới {email}." đã nói
 * (mỗi thông tin một lần trên một màn). `guiLai`: lần bấm "Gửi lại mã" (thông tin mới: vừa gửi lại).
 */
export function cauDaGuiMa(hetHanGiay, { guiLai = false } = {}) {
  const giay = soGiay(hetHanGiay);
  const hieuLuc = giay ? `Mã có hiệu lực trong ${chuPhut(giay)}.` : "";
  return guiLai
    ? `Đã gửi lại mã xác nhận.${hieuLuc ? ` ${hieuLuc}` : ""} Vui lòng kiểm tra email.`
    : `${hieuLuc ? `${hieuLuc} ` : ""}Nếu không thấy email, hãy kiểm tra thư mục Thư rác.`;
}

/** "4:05" — đếm ngược tới lúc được gửi lại mã. */
export const dinhDangDemNguoc = (giay) => {
  const s = Math.max(0, Math.floor(Number(giay) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Lỗi của Nhận mã / Gửi lại mã → việc trang phải làm:
 * - `cho-gui-lai` (429 MA_CU_CON_HIEU_LUC, mã cũ còn hiệu lực): sang bước nhập mã, đếm ngược `guiLaiSauGiay`;
 * - `phai-cho` (429 MA_CU_CON_HIEU_LUC với `hetHanGiay` = 0: mã cũ đã hết hạn, vd. quá số mã trong giờ): không có mã
 *   nào để nhập nên ở lại bước 1 (soát chéo R10), báo câu máy chủ, đếm ngược `guiLaiSauGiay`;
 * - `khong-con-nhan` (409 DON_KHONG_CON_NHAN): về bước 1, báo đơn không còn nhận báo giá;
 * - `chua-gui-duoc` (503 CHUA_GUI_DUOC_MA): máy chủ đã xóa mã, cho bấm lại ngay;
 * - `loi`: còn lại (đơn/email sai, mất mạng…), hiện câu máy chủ.
 */
export function xuLyLoiNhanMa(err) {
  if (!err?.response) return { loai: "loi", cau: LOI_MAT_KET_NOI };
  const d = duLieuLoi(err);
  switch (getApiErrorCode(err)) {
    case MA_LOI_CONG.MA_CU_CON_HIEU_LUC: {
      const guiLaiSauGiay = soGiay(d.guiLaiSauGiay) ?? 0;
      // Thiếu hetHanGiay: coi như mã cũ còn hiệu lực (trường hợp xin lại trong lúc chờ)
      if (soGiay(d.hetHanGiay) === 0) return { loai: "phai-cho", guiLaiSauGiay, cau: cauMayChu(err) || CAU_CHO_GUI_LAI };
      return { loai: "cho-gui-lai", guiLaiSauGiay, cau: CAU_MA_CU_CON_HIEU_LUC };
    }
    case MA_LOI_CONG.DON_KHONG_CON_NHAN:
      return { loai: "khong-con-nhan", cau: CAU_DON_KHONG_CON_NHAN };
    case MA_LOI_CONG.CHUA_GUI_DUOC_MA:
      return { loai: "chua-gui-duoc", cau: cauMayChu(err) || CAU_CHUA_GUI_DUOC_MA };
    default:
      return { loai: "loi", cau: cauMayChu(err) || CAU_LOI_NHAN_MA };
  }
}

/**
 * Lỗi của Xác nhận mã → việc trang phải làm:
 * - `ma-sai` (400 MA_SAI): xóa ô, nhập lại; có `conLaiLanThu` thì nói số lần còn lại;
 * - `ma-het-han` (400 MA_HET_HAN): xóa ô, mở nút Gửi lại mã ngay;
 * - `khong-con-nhan` (409 DON_KHONG_CON_NHAN): về bước 1;
 * - `loi`: còn lại.
 */
export function xuLyLoiXacNhan(err) {
  if (!err?.response) return { loai: "loi", cau: LOI_MAT_KET_NOI };
  switch (getApiErrorCode(err)) {
    case MA_LOI_CONG.MA_SAI: {
      const conLai = soGiay(duLieuLoi(err).conLaiLanThu);
      return { loai: "ma-sai", cau: conLai ? `Mã xác nhận không đúng. Còn ${conLai} lần nhập.` : CAU_MA_SAI };
    }
    case MA_LOI_CONG.MA_HET_HAN:
      return { loai: "ma-het-han", cau: CAU_MA_HET_HAN };
    case MA_LOI_CONG.DON_KHONG_CON_NHAN:
      return { loai: "khong-con-nhan", cau: CAU_DON_KHONG_CON_NHAN };
    default:
      return { loai: "loi", cau: cauMayChu(err) || CAU_LOI_XAC_NHAN };
  }
}

/**
 * Lỗi của Gửi báo giá → việc trang phải làm:
 * - `phien-het-han` (403 PHIEN_HET_HAN): về trang nhận mã, giữ ?id=&email=;
 * - `khong-con-nhan` (409 DON_KHONG_CON_NHAN): chuyển trang sang chỉ xem;
 * - `du-lieu-sai` (400 BAO_GIA_KHONG_HOP_LE): câu máy chủ, `dong` = id dòng sai (nếu có);
 * - `loi`: còn lại (mất mạng: câu nhắc đơn giá vẫn còn trên trang).
 */
export function xuLyLoiGuiBaoGia(err) {
  if (!err?.response) return { loai: "loi", cau: LOI_GUI_MAC_DINH };
  const msg = cauMayChu(err);
  const cau = msg ? `Không gửi được báo giá. ${msg}` : LOI_GUI_MAC_DINH;
  switch (getApiErrorCode(err)) {
    case MA_LOI_CONG.PHIEN_HET_HAN:
      return { loai: "phien-het-han", cau: CAU_PHIEN_HET_HAN };
    case MA_LOI_CONG.DON_KHONG_CON_NHAN:
      return { loai: "khong-con-nhan", cau: CAU_DON_KHONG_CON_NHAN };
    case MA_LOI_CONG.BAO_GIA_KHONG_HOP_LE:
      return { loai: "du-lieu-sai", cau, dong: duLieuLoi(err).dong ?? null };
    default:
      return { loai: "loi", cau };
  }
}

/**
 * Câu báo lúc vào trang nhận mã (`location.state.thongBao`, vd. "Phiên báo giá đã hết hạn…") hết đúng khi đã nhận được
 * mã mới: trả tham số `navigate` để thay mục lịch sử hiện tại bằng cùng địa chỉ không kèm câu đó (bấm Quay lại về bước 1
 * hay tải lại trang không hiện lại). Không có câu nào thì null (không cần điều hướng).
 */
export function boThongBaoVaoTrang(location) {
  if (!location?.state?.thongBao) return null;
  return [`${location.pathname ?? ""}${location.search ?? ""}`, { replace: true, state: null }];
}

/** Đường dẫn trang nhận mã của đúng đơn và email (mã hóa "@"…), như liên kết trong email yêu cầu báo giá. */
export function diaChiDangNhapLai(id, email) {
  const thamSo = new URLSearchParams();
  if (id !== null && id !== undefined && id !== "") thamSo.set("id", String(id));
  const e = String(email ?? "").trim();
  if (e) thamSo.set("email", e);
  const chuoi = thamSo.toString();
  return chuoi ? `/supplier/login?${chuoi}` : "/supplier/login";
}
