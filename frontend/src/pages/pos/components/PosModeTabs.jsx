import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Undo2 } from 'lucide-react';
import { t } from "@/i18n";

const base = 'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-sm transition focus-visible:outline-2 focus-visible:outline-bo-primary sm:px-3';
const off = `${base} font-medium text-bo-muted hover:text-bo-foreground`;
// Chế độ đang chọn nổi lên khỏi khung xám; Trả hàng mang màu cam để thu ngân nhìn là biết đang trả, không phải đang bán.
const on = {
  ban: `${base} bg-bo-surface font-semibold text-bo-primary-strong shadow-[0_1px_2px_rgba(15,23,42,0.14),0_0_0_1px_rgba(15,23,42,0.04)]`,
  tra: `${base} bg-orange-50 font-semibold text-orange-800 shadow-[0_1px_2px_rgba(154,52,18,0.18),0_0_0_1px_#fed7aa]`,
};

const MUC = [
  { ma: 'ban', href: '/pos', nhan: t("Bán hàng"), bieuTuong: <ShoppingBag aria-hidden="true" className="size-4 shrink-0" /> },
  { ma: 'tra', href: '/pos/returns', nhan: t("Trả hàng"), bieuTuong: <Undo2 aria-hidden="true" className="size-4 shrink-0" /> },
];

/**
 * Công tắc hai chế độ của quầy trên thanh trên cùng: Bán hàng (/pos) và Trả hàng (/pos/returns), đặt trong một
 * khung xám để không lẫn với tab hóa đơn. Rời màn bán không mất hóa đơn đang làm (bản nháp lưu theo tài khoản).
 * F7 đổi sang chế độ còn lại.
 * {@code khoa}: đang thanh toán / đang ghi trả hàng thì không cho đổi chế độ (bấm và F7 đều không chạy).
 * {@code tatPhimTat}: F7 không làm gì khi đang mở hộp thoại, hoặc (màn trả hàng) đang làm dở một phiếu trả —
 * phiếu trả không lưu nháp nên lỡ tay F7 sẽ mất hết; muốn rời thì bấm chuột vào công tắc.
 */
export default function PosModeTabs({ hienTai, khoa = false, lyDoKhoa = '', tatPhimTat = false }) {
  const navigate = useNavigate();
  const ref = useRef({ khoa, tatPhimTat, hienTai });
  useEffect(() => {
    ref.current = { khoa, tatPhimTat, hienTai };
  });

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'F7' || event.defaultPrevented) return;
      // Chặn cả khi không đổi được: F7 mặc định của trình duyệt là bật duyệt bằng con trỏ, gây hộp hỏi lạ.
      event.preventDefault();
      const { khoa: dangKhoa, tatPhimTat: dangTat, hienTai: cheDo } = ref.current;
      if (dangKhoa || dangTat || event.repeat) return;
      const dich = MUC.find((muc) => muc.ma !== cheDo);
      if (!dich) return;
      // Ô số lượng trong giỏ chỉ chốt số khi rời ô: rời ô trước, đổi trang ở nhịp sau để số vừa gõ được lưu
      // vào bản nháp (như các phím tắt khác của màn bán).
      document.activeElement?.blur?.();
      window.setTimeout(() => navigate(dich.href), 0);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  return (
    <nav aria-label={t("Chế độ quầy")} className="flex shrink-0 items-center gap-0.5 rounded-[10px] bg-slate-100 p-[3px]">
      {MUC.map(({ ma, href, nhan, bieuTuong }) => {
        const noiDung = (
          <>
            {bieuTuong}
            {/* Màn hẹp chỉ còn biểu tượng; chữ vẫn đọc được bằng trình đọc màn hình */}
            <span className="sr-only sm:not-sr-only">{nhan}</span>
          </>
        );
        if (ma === hienTai) {
          return <span aria-current="page" className={on[ma]} key={ma} title={nhan}>{noiDung}</span>;
        }
        if (khoa) {
          return (
            <span aria-disabled="true" className={`${off} cursor-not-allowed opacity-50 hover:text-bo-muted`} key={ma} title={lyDoKhoa || undefined}>
              {noiDung}
            </span>
          );
        }
        return (
          <Link className={off} key={ma} title={t("{{nhan}} (F7)", { nhan })} to={href}>
            {noiDung}
          </Link>
        );
      })}
    </nav>
  );
}
