import { Link } from 'react-router-dom';
import { t } from "@/i18n";

const base = 'inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-sm transition';
const on = `${base} bg-bo-primary-soft font-semibold text-bo-primary-strong`;
const off = `${base} text-bo-muted hover:bg-slate-100 hover:text-bo-foreground`;

/**
 * Hai chế độ của quầy trên thanh trên cùng: Bán hàng (/pos) và Trả hàng (/pos/returns). Rời màn bán không mất hóa đơn
 * đang làm (bản nháp lưu theo tài khoản). {@code khoa}: đang thanh toán / đang ghi trả hàng thì không cho đổi chế độ.
 */
export default function PosModeTabs({ hienTai, khoa = false, lyDoKhoa = '' }) {
  const muc = [
    ['ban', '/pos', t("Bán hàng")],
    ['tra', '/pos/returns', t("Trả hàng")],
  ];
  return (
    <nav aria-label={t("Chế độ quầy")} className="flex shrink-0 items-center gap-1">
      {muc.map(([ma, href, nhan]) => (
        ma === hienTai ? (
          <span aria-current="page" className={on} key={ma}>{nhan}</span>
        ) : khoa ? (
          <span aria-disabled="true" className={`${off} cursor-not-allowed opacity-50`} key={ma} title={lyDoKhoa || undefined}>{nhan}</span>
        ) : (
          <Link className={off} key={ma} to={href}>{nhan}</Link>
        )
      ))}
    </nav>
  );
}
