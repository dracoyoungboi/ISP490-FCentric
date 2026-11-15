import { t } from "@/i18n";

const MOT_NGAY_MS = 24 * 60 * 60 * 1000;

export const gioPhut = (d) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/**
 * "Hôm nay 12:58" / "Hôm qua 17:05" / "10/11 09:12": thu ngân đọc nhanh hơn ngày giờ đầy đủ. Dùng chung cho bảng
 * Hóa đơn còn hạn trả và Phiếu đã trả.
 */
export function nhanLuc(iso, bayGio) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const homNay = new Date(bayGio);
  homNay.setHours(0, 0, 0, 0);
  const ngay = new Date(d);
  ngay.setHours(0, 0, 0, 0);
  const lech = Math.round((homNay - ngay) / MOT_NGAY_MS);
  if (lech === 0) return t("Hôm nay {{gio}}", { gio: gioPhut(d) });
  if (lech === 1) return t("Hôm qua {{gio}}", { gio: gioPhut(d) });
  // Ghép tay dd/MM: toLocaleDateString vi-VN không có năm ra "09-11" ở một số trình duyệt. Khác năm (xem phiếu cũ theo
  // khoảng ngày) thì thêm năm để không lẫn tháng 12 năm trước với năm nay
  const hai = (n) => String(n).padStart(2, '0');
  const nam = d.getFullYear() !== homNay.getFullYear() ? `/${d.getFullYear()}` : '';
  return `${hai(d.getDate())}/${hai(d.getMonth() + 1)}${nam} ${gioPhut(d)}`;
}
