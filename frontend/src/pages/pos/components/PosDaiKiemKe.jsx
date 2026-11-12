import DongThongBao from '@/components/nhap-kho/DongThongBao';
import { t } from "@/i18n";

/**
 * Dải báo ở quầy khi kho đang bán có đợt kiểm kê giữ khóa (đặc tả kiểm kê khoanh vùng 8.2: quầy chỉ bán hàng ở kệ
 * tự do). Kiểm toàn kho: không bán được mã nào. Kiểm một phần: ô cỡ của mã đang kiểm ghi "Kiểm", mã khác bán bình thường.
 */
export default function PosDaiKiemKe({ kiemKe }) {
  if (!kiemKe?.dangKiemKe) return null;
  const ma = kiemKe.dots.map((d) => d.maDot).filter(Boolean).join(', ');
  const choDuyet = kiemKe.dots.length > 0 && kiemKe.dots.every((d) => d.trangThai === 2);
  return (
    <DongThongBao tone="warn">
      {kiemKe.toanKho ? (
        <>
          <strong className="font-semibold">{t("Kho này đang kiểm kê toàn bộ (đợt {{ma}}).", { ma })}</strong>{' '}
          {t("Tạm dừng bán tại quầy tới khi đợt được duyệt hoặc hủy.")}
        </>
      ) : (
        <>
          <strong className="font-semibold">{t("Kho này đang kiểm kê một phần (đợt {{ma}}).", { ma })}</strong>{' '}
          {t("Mã đang kiểm kê tạm chưa bán được, các mã khác bán bình thường.")}
        </>
      )}
      {choDuyet ? <> {t("Đợt đã đếm xong, đang chờ duyệt.")}</> : null}
    </DongThongBao>
  );
}
