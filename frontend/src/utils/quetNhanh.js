/**
 * Nhận ra một lần quét của máy quét cầm tay (gõ mã như bàn phím, rất nhanh, kết thúc bằng Enter) khi con trỏ đang
 * nằm ở ô KHÔNG phải ô quét (ô ngày sản xuất, ô mã lô, ô chọn kệ, nút trong hộp thoại…).
 *
 * Người gõ tay không gõ đều dưới ~50ms mỗi phím trong cả chuỗi (rồi Enter ngay); máy quét USB gõ vài ms mỗi phím,
 * máy quét Bluetooth ~20–45ms. Khi nhận ra:
 * - chặn phím Enter (không gửi form / không bấm nút đang có con trỏ);
 * - gọi `khoiPhuc(anhChup)` để trả ô đang có con trỏ về giá trị trước khi máy quét gõ vào;
 * - gọi `onMa(ma)` để xử lý mã như quét ở ô quét.
 * Máy quét giả lập bàn phím USB gửi phím Shift trước mỗi nhóm chữ hoa: Shift / CapsLock không cắt ngang lần quét.
 * Thời điểm phím lấy từ `e.timeStamp` (lúc hệ điều hành nhận phím), không phải lúc trình duyệt xử lý xong: màn đang bận
 * vẽ lại thì các phím xếp hàng chờ, đo bằng giờ xử lý sẽ thấy khoảng cách lớn và bỏ sót lần quét.
 * Không phụ thuộc React để kiểm bằng `node --test`.
 */

/** Nhịp gõ trung bình tối đa của một lần quét (máy quét Bluetooth chậm ~45–60 ms/phím). */
export const KHOANG_PHIM_MAY_QUET_MS = 60;
/**
 * Mã ngắn (dưới 8 ký tự: năm "2026", "LO-01", mã kệ) dễ trùng nhịp người gõ nhanh: đòi nhịp chặt hơn. Máy quét USB
 * gõ vài ms/phím nên không ảnh hưởng.
 */
const DO_DAI_MA_DAI = 8;
const KHOANG_PHIM_MA_NGAN_MS = 50;
/** Một phím trễ hơn mức này (máy bận, sóng Bluetooth chập chờn) vẫn thuộc cùng lần quét; trễ hơn nữa là chuỗi mới. */
const KHOANG_TRE_TOI_DA_MS = 100;
/** Enter phải đến trong khoảng này sau phím cuối. */
const KHOANG_ENTER_MS = 150;
/** Mã ngắn hơn thì không coi là lần quét (tránh nhầm với hai phím gõ tay liền nhau). */
export const DO_DAI_MA_QUET_TOI_THIEU = 4;
/** Phím bổ trợ máy quét gửi kèm (chữ hoa): bỏ qua, không cắt chuỗi. */
const PHIM_BO_QUA = new Set(["Shift", "CapsLock"]);

/**
 * Tạo bộ nghe `keydown`. Trả true khi vừa nhận ra một lần quét (đã gọi onMa).
 * `layAnhChup()` chụp giá trị các ô lúc từng phím tới (trước khi phím đó ghi vào ô); khi nhận ra lần quét thì trả các
 * ô về ảnh chụp ở phím ĐẦU của lần quét. `bayGio(e)` cho phép test truyền đồng hồ giả.
 *
 * Nhận ra lần quét khi bấm Enter: lấy đoạn cuối của chuỗi phím mà mỗi khoảng ≤ 100 ms (phần gõ tay chậm trước đó bị
 * bỏ ra ngoài, kể cả vài chữ gõ tay ngay trước đó mà khoảng sau chúng dài hẳn so với nhịp máy quét), đoạn dài ≥ 4 ký
 * tự, nhịp trung bình ≤ 60 ms (≤ 50 ms với mã dưới 8 ký tự) và Enter đến trong khoảng max(2 lần nhịp, 60 ms).
 * Một phím trễ lẻ (52, 80 ms) giữa lần quét không cắt đôi mã.
 */
export function taoBoNhanQuetNhanh({ onMa, layAnhChup = () => null, khoiPhuc = () => {}, bayGio = thoiDiemPhim }) {
  let phim = [];
  return function nhanPhim(e) {
    if (PHIM_BO_QUA.has(e.key)) return false;
    const luc = bayGio(e);
    if (e.key === "Enter") {
      const ds = phim;
      phim = [];
      const enterSau = ds.length ? luc - ds[ds.length - 1].luc : Infinity;
      if (enterSau > KHOANG_ENTER_MS) return false;
      let dau = ds.length - 1;
      while (dau > 0 && ds[dau].luc - ds[dau - 1].luc <= KHOANG_TRE_TOI_DA_MS) dau -= 1;
      let doan = ds.slice(dau);
      // Vài chữ gõ tay ngay trước khi bóp máy quét (khoảng sau chúng dài hẳn so với nhịp máy quét): bỏ ra khỏi mã
      const khoangCach = doan.slice(1).map((p, i) => p.luc - doan[i].luc);
      const giua = [...khoangCach].sort((a, b) => a - b)[Math.floor(khoangCach.length / 2)] ?? 0;
      let bo = 0;
      while (bo < khoangCach.length && khoangCach[bo] > Math.max(3 * giua, 60)) bo += 1;
      doan = doan.slice(bo);
      if (doan.length < DO_DAI_MA_QUET_TOI_THIEU) return false;
      const nhip = (doan[doan.length - 1].luc - doan[0].luc) / (doan.length - 1);
      if (nhip > (doan.length < DO_DAI_MA_DAI ? KHOANG_PHIM_MA_NGAN_MS : KHOANG_PHIM_MAY_QUET_MS)) return false;
      // Máy quét gửi Enter ngay sau ký tự cuối (cùng nhịp); người gõ thường dừng lâu hơn rồi mới Enter
      if (enterSau > Math.max(2 * nhip, 60)) return false;
      e.preventDefault?.();
      e.stopPropagation?.();
      khoiPhuc(doan[0].anh);
      onMa(doan.map((p) => p.k).join(""));
      return true;
    }
    if (!e.key || e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) {
      phim = [];
      return false;
    }
    if (phim.length && luc - phim[phim.length - 1].luc > KHOANG_ENTER_MS) phim = [];
    phim.push({ k: e.key, luc, anh: layAnhChup() });
    return false;
  };
}

function thoiDiemPhim(e) {
  return typeof e?.timeStamp === "number" && e.timeStamp > 0 ? e.timeStamp : performance.now();
}
