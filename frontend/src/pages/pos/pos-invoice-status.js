import { AlertTriangle, CheckCircle2, Lock, QrCode } from 'lucide-react';
import { canTraLaiTienMat } from './pos-payment';
import { t } from "@/i18n";

/** Trạng thái hiển thị trên tab để thu ngân nhìn là biết hóa đơn nào đang chờ/đã xong. */
export function getTabStatus(invoice) {
  if (invoice.attempt?.status === 'succeeded') return { icon: CheckCircle2, label: t("Đã thanh toán"), className: 'text-emerald-600' };
  if (invoice.payos?.trangThai === 'PENDING') return { icon: QrCode, label: t("Đang chờ chuyển khoản"), className: 'text-amber-600' };
  // Trước PAID_ERROR: tiền về muộn sau khi hủy mã thì quầy vẫn phải trả lại tiền mặt khách đưa trước
  if (canTraLaiTienMat(invoice.payos)) return { icon: AlertTriangle, label: t("Cần trả lại tiền mặt khách đưa trước"), className: 'text-red-600' };
  if (invoice.payos?.trangThai === 'PAID_ERROR') return { icon: AlertTriangle, label: t("Đã nhận tiền, chờ quản lý xử lý"), className: 'text-red-600' };
  if (invoice.attempt?.status === 'pending' || invoice.attempt?.status === 'unknown') return { icon: Lock, label: t("Đang xử lý thanh toán"), className: 'text-amber-600' };
  return null;
}

/** Tên gọi ngắn của khách để hiện trên tab (chữ cuối của họ tên). Khách lẻ / chưa chọn khách: rỗng. */
export function tenKhachTrenTab(customer, walkInCustomerId) {
  if (!customer?.name || (walkInCustomerId != null && customer.id === walkInCustomerId)) return '';
  const parts = String(customer.name).trim().split(/\s+/);
  return parts[parts.length - 1] || '';
}
