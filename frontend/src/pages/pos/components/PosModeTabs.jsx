import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { t } from "@/i18n";
import { HoaDonQuayVe, MayTinhTien } from './BieuTuongCheDoQuay';

const base = 'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-sm transition focus-visible:outline-2 focus-visible:outline-bo-primary sm:px-3';
const off = `${base} font-medium text-bo-muted hover:text-bo-foreground`;
// Chế độ đang chọn nổi lên khỏi khung xám, biểu tượng tô màu đậm của chế độ: xanh khi bán, cam khi trả,
// để thu ngân liếc là biết đang trả chứ không phải đang bán.
const on = {
  ban: `${base} bg-bo-surface font-semibold text-bo-primary-strong shadow-[0_1px_2px_rgba(15,23,42,0.14),0_0_0_1px_rgba(15,23,42,0.05)]`,
  tra: `${base} bg-bo-surface font-semibold text-orange-800 shadow-[0_1px_2px_rgba(154,52,18,0.18),0_0_0_1px_#fed7aa]`,
};
const mauBieuTuong = { ban: 'text-bo-primary', tra: 'text-orange-600' };

const MUC = [
  { ma: 'ban', href: '/pos', nhan: t("Bán hàng"), BieuTuong: MayTinhTien },
  { ma: 'tra', href: '/pos/returns', nhan: t("Trả hàng"), BieuTuong: HoaDonQuayVe },
];

// Chip phím tắt trên chế độ còn lại: thu ngân dùng bàn phím thấy ngay F7, không phải rê chuột mới biết.
// Màn hẹp chỉ còn biểu tượng, màn cảm ứng thường không có bàn phím: ẩn chip. Trình đọc màn hình đã có aria-keyshortcuts.
// F7 tạm tắt thì chỉ làm chip vô hình (vẫn giữ chỗ) để ô chọn kho và dải hóa đơn không xê dịch mỗi lần mở hộp thoại.
const ChipF7 = ({ tam }) => (
  <kbd aria-hidden="true" className={`ml-0.5 hidden rounded border border-b-2 border-bo-border bg-bo-surface px-1 font-[inherit] text-[10.5px] font-semibold leading-4 text-bo-muted sm:inline-block cam-ung:hidden!${tam ? ' invisible' : ''}`}>
    F7
  </kbd>
);

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
      {MUC.map((muc) => {
        const { ma, href, nhan, BieuTuong } = muc;
        const dangChon = ma === hienTai;
        const noiDung = (
          <>
            <BieuTuong className={`size-4 shrink-0${dangChon ? ` ${mauBieuTuong[ma]}` : ''}`} />
            {/* Màn hẹp chỉ còn biểu tượng; chữ vẫn đọc được bằng trình đọc màn hình */}
            <span className="sr-only sm:not-sr-only">{nhan}</span>
          </>
        );
        if (dangChon) {
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
          <Link aria-keyshortcuts={tatPhimTat ? undefined : 'F7'} className={off} key={ma} title={tatPhimTat ? nhan : t("{{nhan}} (F7)", { nhan })} to={href}>
            {noiDung}
            {/* F7 đang tắt (mở hộp thoại / đang làm dở phiếu trả) thì chip vô hình, tránh hứa phím không chạy */}
            <ChipF7 tam={tatPhimTat} />
          </Link>
        );
      })}
    </nav>
  );
}
