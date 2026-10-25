import { useState } from 'react';
import { ImageOff } from 'lucide-react';

/**
 * Ảnh sản phẩm ở POS: thiếu ảnh hoặc ảnh lỗi (URL hỏng, ảnh đã xóa trên kho ảnh) đều hiện cùng một biểu
 * tượng thay thế, không để lại khung ảnh vỡ của trình duyệt. Ảnh đổi URL thì thử tải lại.
 * fit:
 * - 'cover' (mặc định): phủ kín, cắt bớt mép — ảnh nhỏ vuông (dòng Danh sách, giỏ).
 * - 'contain': hiện trọn ảnh, chừa nền hai bên (khay chọn cỡ — chỗ xem ảnh đầy đủ).
 * - 'fill': hiện trọn ảnh, hai bên lấp bằng chính ảnh đó phóng to và làm mờ — khung ngang thấp (thẻ Lưới)
 *   với ảnh người mẫu chụp dọc: không cắt ngang mặt/thân áo mà khung vẫn đầy, không có hai dải trống.
 */
export default function PosProductImage({ src, className = '', iconSize = 16, fit = 'cover' }) {
  const [failedSrc, setFailedSrc] = useState(null);
  if (!src || failedSrc === src) {
    return (
      <span aria-hidden="true" className={`grid place-items-center bg-slate-100 text-slate-400 ${className}`}>
        <ImageOff size={iconSize} />
      </span>
    );
  }
  if (fit === 'fill') {
    return (
      <span className={`relative block overflow-hidden bg-slate-100 ${className}`}>
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-lg"
          decoding="async"
          loading="lazy"
          src={src}
        />
        <img
          alt=""
          className="relative h-full w-full object-contain"
          decoding="async"
          loading="lazy"
          onError={() => setFailedSrc(src)}
          src={src}
        />
      </span>
    );
  }
  return (
    <img
      alt=""
      className={`bg-slate-100 ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`}
      decoding="async"
      loading="lazy"
      onError={() => setFailedSrc(src)}
      src={src}
    />
  );
}
