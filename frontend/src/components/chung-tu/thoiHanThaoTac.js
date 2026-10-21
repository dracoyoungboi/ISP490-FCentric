/*
 * Thời hạn cho thao tác chạy từ hộp xác nhận chứng từ (HopXacNhanChungTu). apiClient không đặt thời gian chờ, mà lúc hộp
 * đang chạy thì nút xác nhận, "Quay lại", Esc, bấm ra ngoài đều khóa: một lời gọi treo (mạng chập chờn, máy chủ không trả
 * lời) làm hộp kẹt tới khi F5. Bọc lời gọi bằng chayCoThoiHan; quá thời hạn thì màn:
 *   1. đóng hộp, báo CAU_HET_THOI_HAN + MO_TA_HET_THOI_HAN, tải lại ngầm ngay;
 *   2. khóa các nút thao tác của chứng từ (khoaKhiChoGoc, lý do LY_DO_CHO_GOC) vì máy chủ có thể vẫn đang làm (vd. gửi
 *      email trước khi đổi trạng thái) — bấm lại lúc này dễ làm hai lần;
 *   3. khiGocKetThuc: lời gọi gốc kết thúc (hoặc quá THOI_HAN_CHO_GOC_MS) thì mở khóa và tải lại thêm một lần.
 * Người dùng rời màn trước khi hết thời hạn thì màn bỏ qua cả ba bước (mỗi màn giữ cờ "đã gỡ" đặt trong cleanup).
 * Thuần, chạy được bằng `node --test`.
 */
import { THOI_HAN_CHO_GOC_MS, THOI_HAN_THAO_TAC_MS } from "../../config/bangChungTu.js";

/** Mã của lỗi hết thời hạn (không trùng mã lỗi axios như ECONNABORTED, ERR_NETWORK). */
export const MA_HET_THOI_HAN = "HET_THOI_HAN";

const soGiay = (ms) => Math.max(1, Math.round(Number(ms) / 1000) || 0);

/** Thông báo nhanh khi hết thời hạn: `toast.error(CAU_HET_THOI_HAN, { description: MO_TA_HET_THOI_HAN })`. */
export const CAU_HET_THOI_HAN = `Máy chủ chưa phản hồi sau ${soGiay(THOI_HAN_THAO_TAC_MS)} giây`;
export const MO_TA_HET_THOI_HAN =
  "Thao tác có thể vẫn đang được xử lý. Các nút thao tác tạm khóa tới khi máy chủ trả lời, sau đó màn tự tải lại. Hãy xem trạng thái chứng từ trước khi thao tác lại.";

/** Lý do khóa nút / mục menu trong lúc chờ lời gọi gốc. */
export const LY_DO_CHO_GOC = "Máy chủ đang xử lý thao tác trước";

/**
 * Chạy `viec()` (trả Promise) nhưng chỉ chờ tối đa `ms` (mặc định THOI_HAN_THAO_TAC_MS). Xong trước thời hạn: trả đúng
 * kết quả / lỗi của việc. Quá thời hạn: từ chối bằng một Error có `code` = MA_HET_THOI_HAN (nhận bằng laLoiHetThoiHan)
 * và `ketThucGoc`: Promise xong khi lời gọi gốc (vẫn chạy tiếp ở nền) kết thúc, ra `{ ok: true }` hoặc
 * `{ ok: false, loi }`, không bao giờ bị từ chối. Xong kiểu nào (kể cả `viec` ném lỗi ngay) cũng xóa bộ hẹn giờ.
 */
export function chayCoThoiHan(viec, ms = THOI_HAN_THAO_TAC_MS) {
  // Gọi ngay; `viec` ném lỗi đồng bộ cũng thành Promise bị từ chối
  const chay = new Promise((xong) => xong(viec()));
  const ketThucGoc = chay.then(
    () => ({ ok: true }),
    (loi) => ({ ok: false, loi }),
  );
  let henGio;
  const hetGio = new Promise((_, tuChoi) => {
    henGio = setTimeout(() => {
      const loi = new Error(`Máy chủ chưa phản hồi sau ${soGiay(ms)} giây.`);
      loi.code = MA_HET_THOI_HAN;
      loi.ketThucGoc = ketThucGoc;
      tuChoi(loi);
    }, ms);
  });
  return Promise.race([chay, hetGio]).finally(() => clearTimeout(henGio));
}

/** Lỗi do chayCoThoiHan hết thời hạn (không phải lỗi mạng / lỗi máy chủ thường). */
export const laLoiHetThoiHan = (loi) => loi?.code === MA_HET_THOI_HAN;

/**
 * Gọi `khiXong()` đúng một lần khi lời gọi gốc của lỗi hết thời hạn kết thúc (`loi.ketThucGoc`), hoặc khi đã chờ thêm
 * `toiDa` ms (mặc định THOI_HAN_CHO_GOC_MS) mà vẫn chưa kết thúc — không khóa màn vĩnh viễn. Lỗi không có `ketThucGoc`
 * thì gọi ngay (ở microtask). Trả về hàm hủy: màn gỡ thì gọi để `khiXong` không chạy (không setState / tải lại).
 */
export function khiGocKetThuc(loi, khiXong, toiDa = THOI_HAN_CHO_GOC_MS) {
  let daXong = false;
  let henGio = null;
  const ketThuc = () => {
    if (daXong) return;
    daXong = true;
    clearTimeout(henGio);
    try {
      khiXong?.();
    } catch (e) {
      // Lỗi của hàm mở khóa không được thành lời từ chối không ai bắt
      console.error(e);
    }
  };
  henGio = setTimeout(ketThuc, toiDa);
  Promise.resolve(loi?.ketThucGoc).then(ketThuc, ketThuc);
  return () => {
    daXong = true;
    clearTimeout(henGio);
  };
}

/**
 * Nút chính của DauChungTu (một nút hoặc mảng) khi đang chờ lời gọi gốc: khóa kèm lý do LY_DO_CHO_GOC, lý do hiện
 * thẳng cạnh nút đầu tiên bị khóa (các nút sau đọc lý do qua chú thích). Nút có `dieuHuong: true` (chỉ mở trang khác,
 * vd. "Mở phiếu xuất", "Đóng gói") không bị khóa để vẫn xem được chứng từ liên quan; nút tạo chứng từ và thao tác thật
 * vẫn khóa. Không chờ thì trả nguyên.
 */
export function khoaKhiChoGoc(nut, dangCho) {
  if (!dangCho || !nut) return nut;
  const biKhoa = (n) => Boolean(n) && !n.dieuHuong;
  const khoa = (n, hienLyDo) => ({ ...n, khoa: true, lyDo: LY_DO_CHO_GOC, hienLyDo });
  if (!Array.isArray(nut)) return biKhoa(nut) ? khoa(nut, true) : nut;
  const dau = nut.findIndex(biKhoa);
  return nut.map((n, i) => (biKhoa(n) ? khoa(n, i === dau) : n));
}
