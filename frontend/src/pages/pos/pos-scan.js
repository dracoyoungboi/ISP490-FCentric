// Tiện ích cho chế độ quét mã ở POS (không phụ thuộc React — kiểm thử độc lập được).

/** Cờ bật/tắt nhớ theo máy. localStorage có thể bị chặn -> dùng mặc định, giữ trong phiên. */
export function readFlag(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
}

export function writeFlag(key, value) {
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* Storage bị chặn: giữ lựa chọn trong phiên. */
  }
}

const TEXT_INPUT_TYPES = new Set([
  'text', 'search', 'number', 'tel', 'email', 'password', 'url',
  'date', 'time', 'datetime-local', 'month', 'week',
]);

/** Phần tử đang nhận chữ gõ vào (ô nhập, ô ghi chú...) — gõ vào đó là có chủ đích. */
export function isTextEntry(element) {
  if (!element || element.readOnly) return false;
  if (element.isContentEditable) return true;
  if (element.tagName === 'TEXTAREA') return true;
  return element.tagName === 'INPUT' && TEXT_INPUT_TYPES.has(element.type);
}

/** Phím sinh ra một ký tự (không kèm Ctrl/Alt/Meta — đó là phím tắt). */
export const isPrintableKey = (event) =>
  typeof event.key === 'string' && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

/** Mã SKU của hệ thống luôn không dấu: mã có chữ có dấu gần như chắc chắn do bộ gõ tiếng Việt đổi. */
export const hasNonAscii = (text) => /[^\x20-\x7e]/.test(text);

// Hướng dẫn chế độ quét (chốt A4: không còn hiện thường trực dưới ô tìm kiếm). Hiện ở chú thích nút quét,
// bảng phím tắt (F1) và mô tả ô tìm kiếm cho trình đọc màn hình.
export const SCAN_HINT = 'Quét mã: thêm thẳng vào hóa đơn · gõ tên: tìm trong danh mục. Tiếng “bíp”: đã thêm · tiếng “rè”: chưa thêm, xem thông báo ngay dưới ô tìm kiếm.';

// Phím không làm đứt một lần quét: Shift đi kèm chữ hoa; phím bộ gõ/không xác định.
const PASS_THROUGH_KEYS = new Set(['Shift', 'CapsLock', 'Unidentified', 'Process', 'Dead']);

/**
 * Nhận diện chuỗi phím do máy quét gõ (súng quét USB, Barcode to PC): máy gõ rất nhanh, đều
 * và kết thúc bằng Enter — người gõ tay không đạt tốc độ này. Phím giữ lì (repeat) không tính.
 * - Khoảng nghỉ > resetGapMs giữa hai phím -> bắt đầu chuỗi mới (gọi snapshot() để chụp trạng thái
 *   TRƯỚC ký tự đầu tiên, dùng để trả lại ô bị quét nhầm). Ngưỡng rộng (150 ms) để một lần máy bận
 *   giữa lần quét không cắt đôi mã thành "chữ gõ" + "mã quét" sai; người gõ tay vẫn bị loại nhờ
 *   điều kiện trung bình <= maxAvgGapMs trên cả chuỗi.
 * - Gặp Enter: là lần quét khi đủ minChars ký tự, trung bình <= maxAvgGapMs/ký tự và Enter đến
 *   trong enterGapMs sau ký tự cuối -> trả về { code, count, snapshot }; ngược lại null.
 */
export function createScanBurstTracker({
  minChars = 6,
  maxAvgGapMs = 30,
  resetGapMs = 150,
  enterGapMs = 150,
} = {}) {
  let run = null;
  const timeOf = (event) => (event.timeStamp > 0 ? event.timeStamp : performance.now());

  return {
    track(event, snapshot) {
      const now = timeOf(event);
      if (event.key === 'Enter') {
        const done = run;
        run = null;
        if (!done || event.repeat) return null;
        const avgGap = done.count > 1 ? (done.last - done.first) / (done.count - 1) : Infinity;
        const isScan = done.count >= minChars && avgGap <= maxAvgGapMs && now - done.last <= enterGapMs;
        return isScan ? { code: done.code, count: done.count, snapshot: done.snapshot } : null;
      }
      if (PASS_THROUGH_KEYS.has(event.key)) return null;
      if (event.key === 'Backspace') {
        // Bộ gõ tiếng Việt xóa-rồi-gõ-lại ký tự ngay giữa lần quét: không làm đứt chuỗi.
        if (run && now - run.last <= resetGapMs) {
          run.code = run.code.slice(0, -1);
          run.last = now;
        } else {
          run = null;
        }
        return null;
      }
      if (event.repeat || !isPrintableKey(event)) {
        run = null;
        return null;
      }
      if (!run || now - run.last > resetGapMs) {
        run = { code: '', count: 0, first: now, last: now, snapshot: snapshot ? snapshot() : null };
      }
      run.code += event.key;
      run.count += 1;
      run.last = now;
      return null;
    },
    reset() {
      run = null;
    },
  };
}
