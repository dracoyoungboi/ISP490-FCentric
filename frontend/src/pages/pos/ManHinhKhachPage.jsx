import { useEffect, useLayoutEffect, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { currentUserKey } from '@/services/posService';
import PosManKhach from './components/PosManKhach';
import { useNhanManKhach } from './man-hinh-phu';

const TIEU_DE = 'Màn hình khách · FCentric';
const TIEU_DE_MAC_DINH = 'FCentric · Quản lý kho & bán lẻ thời trang đa kênh';

/**
 * Cỡ chữ gốc theo cỡ cửa sổ: màn khách viết bằng rem theo bản thiết kế 1366×768 (ngang) / 800×1280 (dọc), nên màn
 * 1920×1080 hay máy tính bảng đều giữ đúng tỉ lệ, chỉ to / nhỏ hơn. Giới hạn để cửa sổ quá nhỏ vẫn đọc được.
 */
function tiLeManHinh(rong, cao) {
  // Cùng cách chia ngang / dọc với CSS (orientation: portrait khi rộng ≤ cao)
  const tiLe = rong > cao ? Math.min(rong / 1366, cao / 768) : Math.min(rong / 800, cao / 1280);
  return Math.min(2, Math.max(0.6, tiLe));
}

/**
 * Trang /pos/customer-display — màn hình phụ quay về phía khách (cửa sổ riêng mở từ menu tài khoản của màn bán hàng,
 * kéo sang màn thứ hai rồi bật toàn màn hình). Chỉ hiện nội dung màn bán hàng cùng máy, cùng tài khoản gửi sang
 * (man-hinh-phu.js): không gọi API, không có thao tác bán hàng — nên đứng ngoài lớp kiểm tra phiên đăng nhập (tải lại
 * lúc phiên hết hạn / mất mạng không hiện màn đăng nhập hay báo lỗi cho khách; chưa đăng nhập thì chỉ có lời chào).
 * Nút Toàn màn hình và dòng nhắc kết nối chỉ dành cho nhân viên lúc dựng máy: ẩn khi đã toàn màn hình.
 */
export default function ManHinhKhachPage() {
  const [userKey] = useState(currentUserKey);
  const { noiDung, ketNoi } = useNhanManKhach(userKey);
  const [toanManHinh, setToanManHinh] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    document.title = TIEU_DE;
    return () => { document.title = TIEU_DE_MAC_DINH; };
  }, []);

  // Đặt trước khi vẽ để không thấy màn nhảy cỡ lúc mở; trả lại cỡ cũ khi rời trang
  useLayoutEffect(() => {
    const goc = document.documentElement;
    const coCu = goc.style.fontSize;
    const dat = () => { goc.style.fontSize = `${16 * tiLeManHinh(window.innerWidth, window.innerHeight)}px`; };
    dat();
    window.addEventListener('resize', dat);
    return () => {
      window.removeEventListener('resize', dat);
      goc.style.fontSize = coCu;
    };
  }, []);

  useEffect(() => {
    const dongBo = () => setToanManHinh(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', dongBo);
    return () => document.removeEventListener('fullscreenchange', dongBo);
  }, []);

  // Cửa sổ này lỡ giữ con trỏ (vừa mở, vừa bấm Toàn màn hình) mà thu ngân quét mã: trả con trỏ về màn bán hàng.
  // Ký tự đang gõ dở không tới được màn bán hàng — thu ngân quét lại mã đó.
  useEffect(() => {
    const traConTro = () => {
      try { window.opener?.focus(); } catch { /* không còn cửa sổ mở ra trang này */ }
    };
    window.addEventListener('keydown', traConTro);
    return () => window.removeEventListener('keydown', traConTro);
  }, []);

  const coToanManHinh = Boolean(document.documentElement.requestFullscreen);

  return (
    <div className="h-dvh w-full overflow-clip font-backoffice">
      <PosManKhach
        goiYKetNoi={!ketNoi && !toanManHinh}
        noiDung={noiDung}
        thaoTac={coToanManHinh && !toanManHinh ? (
          <button
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-bo-border bg-bo-surface px-3 py-2 text-sm text-bo-muted shadow-sm transition hover:bg-bo-surface-subtle hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-bo-primary"
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
            type="button"
          >
            <Maximize2 aria-hidden="true" className="size-4" />Toàn màn hình
          </button>
        ) : null}
      />
    </div>
  );
}
