import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle2,
  ChevronRight,
  Printer,
  Receipt,
  RefreshCcw,
  PanelTop,
  Search,
  ShoppingBag,
  SquarePen,
  UserPlus,
  QrCode,
  Clock,
  Landmark,
  WifiOff,
} from 'lucide-react';
import MoneyInput from '@/components/shared/MoneyInput';
import PayosLogo from '@/components/shared/PayosLogo';
import PosModal from './PosModal';
import { WALKIN_CUSTOMER_CODE, posService, toPosCustomer } from '@/services/posService';
import { formatMoney } from '../pos-format';
import { canTraLaiTienMat, chiaThanhToanKetHop, kiemTienMatTruocQr, msToiHetHan, phaMaQr, tienMatTruocCua } from '../pos-payment';
import { t } from "@/i18n";

const primaryButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-bo-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-bo-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary disabled:cursor-not-allowed disabled:bg-slate-300';
const secondaryButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-bo-border bg-bo-surface px-4 py-2 text-sm font-medium text-bo-foreground transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary disabled:cursor-not-allowed disabled:opacity-50';
const fieldClass = 'mt-1.5 min-h-10 w-full rounded-lg border border-bo-border bg-bo-surface px-3 py-2 text-sm text-bo-foreground outline-none placeholder:text-bo-muted focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/10';

/*
 * Bảng phím tắt (F1), chia nhóm theo CHỖ phím có tác dụng. Mỗi dòng: keys là các lựa chọn, mỗi lựa chọn là các phím
 * bấm cùng lúc ([['Shift', 'F10']] = Shift + F10; [['←'], ['→']] = ← hoặc →). Tên phím giữ nguyên như in trên bàn phím.
 * Thêm/đổi phím tắt ở PosSalesPage, PosInvoiceTabs, PosCartPanel hay PosModeTabs thì sửa cả bảng này.
 */
const SHORTCUT_GROUPS = [
  {
    icon: ShoppingBag,
    title: t("Bán hàng"),
    rows: [
      { keys: [['F2']], label: t("Thêm hóa đơn mới") },
      { keys: [['F3']], label: t("Tìm hàng") },
      { keys: [['F4']], label: t("Chọn khách hàng") },
      { keys: [['F8']], label: t("Bật / tắt quét mã vạch"), hint: t("Quét mã là thêm thẳng vào hóa đơn.") },
      { keys: [['F9']], label: t("Thanh toán"), hint: t("Trong màn thanh toán: bấm lần nữa để xác nhận.") },
      { keys: [['F7']], label: t("Chuyển sang trả hàng") },
    ],
  },
  {
    icon: PanelTop,
    title: t("Trên tab hóa đơn"),
    rows: [
      { keys: [['←'], ['→']], label: t("Hóa đơn trước / sau") },
      { keys: [['Home'], ['End']], label: t("Hóa đơn đầu / cuối") },
      { keys: [['Delete']], label: t("Đóng hóa đơn đang chọn") },
      { keys: [['Shift', 'F10']], label: t("Đóng hóa đơn trống / đóng tất cả"), hint: t("Hoặc bấm chuột phải vào tab.") },
    ],
  },
  {
    icon: Search,
    title: t("Trong ô tìm kiếm"),
    rows: [{ keys: [['Enter']], label: t("Thêm theo SKU / mã vạch"), hint: t("Ưu tiên mã khớp đúng.") }],
  },
  {
    icon: SquarePen,
    title: t("Trong ô số lượng"),
    rows: [{ keys: [['Enter'], ['Esc']], joiner: '/', label: t("Chốt số / bỏ số vừa gõ") }],
  },
];

/** Nắp phím: mỗi phím một nắp, viền đáy dày hơn cho giống phím thật. */
function Kbd({ children, small = false }) {
  return <kbd className={`inline-flex items-center justify-center rounded-[5px] border border-b-2 border-slate-200 border-b-slate-300 bg-white font-sans font-semibold leading-none text-slate-700 ${small ? 'h-5 min-w-5 px-1 text-[10px]' : 'h-6 min-w-6 px-1.5 text-[11px]'}`}>{children}</kbd>;
}

function ShortcutKeys({ keys, joiner }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((combo, index) => (
        <span className="flex items-center gap-1" key={combo.join('+')}>
          {index > 0 && joiner ? <span aria-hidden="true" className="px-0.5 text-[11px] text-bo-muted">{joiner}</span> : null}
          {combo.map((key, keyIndex) => (
            <span className="flex items-center gap-1" key={key}>
              {keyIndex > 0 ? <span aria-hidden="true" className="text-[11px] text-bo-muted">+</span> : null}
              <Kbd>{key}</Kbd>
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

function ShortcutGroup({ group }) {
  const Icon = group.icon;
  return (
    <section className="min-w-0">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-bo-muted"><Icon aria-hidden="true" size={14} strokeWidth={2} />{group.title}</h3>
      <ul className="mt-1 divide-y divide-bo-border">
        {group.rows.map((row) => (
          <li className="flex items-center justify-between gap-4 py-2.5" key={row.label}>
            <span className="min-w-0">
              <span className="block text-sm text-bo-foreground">{row.label}</span>
              {row.hint ? <span className="mt-0.5 block text-xs leading-5 text-bo-muted">{row.hint}</span> : null}
            </span>
            <ShortcutKeys joiner={row.joiner} keys={row.keys} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ShortcutsDialog({ onClose }) {
  const [sales, ...contextual] = SHORTCUT_GROUPS;
  return (
    <PosModal
      description={t("Bán nhanh bằng bàn phím, không cần chuột.")}
      footer={(
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-bo-muted">{t("Mở lại bảng này:")} <Kbd small>F1</Kbd></p>
          <button className={secondaryButton} onClick={onClose} type="button">{t("Đóng")}</button>
        </div>
      )}
      onClose={onClose}
      size="lg"
      title={t("Phím tắt")}
    >
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        <ShortcutGroup group={sales} />
        <div className="grid content-start gap-5">
          {contextual.map((group) => <ShortcutGroup group={group} key={group.title} />)}
        </div>
      </div>
    </PosModal>
  );
}

function FooterButtons({ onClose, onConfirm, confirmText = t("Xác nhận"), cancelText = t("Đóng"), disabled = false, destructive = false, busy = false, cancelAutoFocus = false }) {
  return (
    <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
      <button autoFocus={cancelAutoFocus} className={secondaryButton} onClick={onClose} type="button">{cancelText}</button>
      <button className={destructive ? 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:bg-slate-300' : primaryButton} disabled={disabled || busy} onClick={onConfirm} type="button">
        {busy ? t("Đang xử lý…") : confirmText}
      </button>
    </div>
  );
}

function Field({ id, label, value, onChange, placeholder, autoFocus = false }) {
  return (
    <label className="block text-sm font-medium text-bo-foreground" htmlFor={id}>
      {label}
      <input autoFocus={autoFocus} className={fieldClass} id={id} onChange={onChange} placeholder={placeholder} type="text" value={value} />
    </label>
  );
}

function MethodButton({ active, icon, label, onClick, disabled = false }) {
  return (
    <button aria-pressed={active} className={`flex min-h-[72px] w-full flex-col items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'border-bo-primary bg-bo-primary-soft text-bo-primary' : 'border-bo-border bg-bo-surface text-bo-muted hover:border-bo-primary/50'}`} disabled={disabled} onClick={onClick} type="button">
      {icon}{label}
    </button>
  );
}

/** Ô cảnh báo mất mạng dùng chung trong các hộp thoại thanh toán. */
function OfflineNotice({ children }) {
  return (
    <div aria-live="polite" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-bo-danger-soft p-3 text-xs leading-5 text-bo-danger" role="alert">
      <WifiOff aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
      <span>{children}</span>
    </div>
  );
}

/** Dòng cách trả của hóa đơn trả kết hợp: tiền mặt khách đưa trước + phần quét QR payOS (dữ liệu máy chủ). */
function PhanThanhToanKetHop({ ketHop }) {
  return (
    <div className="mt-1 space-y-0.5 text-xs text-bo-muted">
      <p>{t("Tiền mặt:")} <strong className="tabular-nums text-bo-foreground">{formatMoney(ketHop.tienMat)}</strong></p>
      <p>{t("Chuyển khoản (QR payOS):")} <strong className="tabular-nums text-bo-foreground">{formatMoney(ketHop.chuyenKhoan)}</strong></p>
      <p>{t("Đã nhận đủ tiền")}</p>
    </div>
  );
}

const PAYOS_STATUS_TEXT = {
  CANCELLED: t("Mã QR đã bị hủy."),
  EXPIRED: t("Mã QR đã hết hạn — hàng giữ chỗ đã được trả lại kho."),
  FAILED: t("Không tạo được mã QR."),
  PAID_ERROR: t("Đã nhận tiền nhưng chưa tạo được đơn hàng."),
  REFUNDED: t("Quản lý đã hoàn tiền chuyển khoản cho khách."),
};

/** Ô thay chỗ mã QR khi mã đã đóng (mã không còn được vẽ ra). */
const MA_DONG_TIEU_DE = {
  EXPIRED: t("Mã QR đã hết hạn"),
  CANCELLED: t("Mã QR đã bị hủy"),
  FAILED: t("Không tạo được mã QR"),
  PAID_ERROR: t("Đã nhận chuyển khoản"),
  REFUNDED: t("Đã hoàn tiền chuyển khoản"),
  PAID: t("Đã nhận đủ tiền"),
};

/** Mã đã đóng mà không nhận được tiền: số tiền quét QR chuyển xám. */
const MA_KHONG_THANH = ['EXPIRED', 'CANCELLED', 'FAILED', 'REFUNDED'];

const formatCountdown = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const gioPhut = (value) => new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Mã QR payOS: khách quét bằng app ngân hàng; màn hình tự chuyển sang hóa đơn khi tiền về. */
function PayosQrDialog({ state, actions, onClose }) {
  const link = state.payos;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!link) return null;
  const pending = link.trangThai === 'PENDING';
  const remaining = msToiHetHan(link, now);
  // Pha theo đồng hồ quầy: 30 giây cuối nhắc trước; về 00:00 thì ẩn mã ngay (máy quầy tự hủy mã, xem PosSalesPage)
  // dù máy chủ chưa kịp đóng. Mã đã đóng thì KHÔNG vẽ mã: làm mờ thì camera điện thoại vẫn đọc được.
  const pha = phaMaQr(link, now);
  const sapHet = pha === 'sapHet';
  const hetGio = pha === 'hetGio';
  const hienMa = pending && !hetGio;
  // Máy quầy tự hủy mã hết giờ bị lỗi: final = không tự thử lại nữa (mở lại nút Hủy mã QR cho thu ngân)
  const loiDongMa = hetGio ? state.autoCloseError : null;
  const terminalText = PAYOS_STATUS_TEXT[link.trangThai];
  // Trả kết hợp: tiền mặt khách đưa trước (mã QR chỉ mang phần còn lại); mã không thành thì phải trả lại khách.
  const tienMat = tienMatTruocCua(link);
  const canTraLai = canTraLaiTienMat(link);
  const daTraLai = tienMat > 0 && Boolean(link.tienMatTraLaiLuc);

  return (
    <PosModal description={t("Khách mở ứng dụng ngân hàng, quét mã để chuyển khoản. Tiền về là đơn tự hoàn tất.")} onClose={onClose} title={t("Chuyển khoản qua mã QR")} size="md">
      <div className="grid gap-5 sm:grid-cols-[240px_minmax(0,1fr)]">
        <div className="flex flex-col items-center">
          {hienMa ? (
            <>
              <div className="rounded-xl border border-bo-border bg-white p-3">
                {link.qrCode ? <QRCodeSVG level="M" size={208} value={link.qrCode} /> : <div className="grid size-[208px] place-items-center text-xs text-bo-muted">{t("Không có mã QR")}</div>}
              </div>
              {remaining != null ? (
                <p className={`mt-2 inline-flex items-center gap-1.5 text-xs ${sapHet ? 'text-amber-700' : 'text-bo-muted'}`}>
                  <Clock aria-hidden="true" size={13} />{sapHet ? t("Sắp hết hạn") : t("Hết hạn sau")}{' '}
                  <strong className={`tabular-nums ${sapHet ? 'text-amber-700' : 'text-bo-foreground'}`}>{formatCountdown(remaining)}</strong>
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex size-[234px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                {hetGio ? (
                  <>
                    <RefreshCcw aria-hidden="true" className="text-bo-primary motion-safe:animate-spin" size={28} />
                    <span className="text-sm font-semibold text-bo-foreground">{t("Đang đóng mã…")}</span>
                    <span className="text-xs text-bo-muted">{t("Mã đã ẩn khỏi màn hình")}</span>
                  </>
                ) : (
                  <>
                    <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-bo-muted"><QrCode aria-hidden="true" size={24} /></span>
                    <span className="text-sm font-semibold text-bo-foreground">{MA_DONG_TIEU_DE[link.trangThai] || t("Mã QR đã đóng")}</span>
                    <span className="text-xs text-bo-muted">{link.qrCode ? t("Đã ẩn mã — khách không quét được nữa") : t("Không có mã nào để khách quét")}</span>
                  </>
                )}
              </div>
              {hetGio ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-bo-muted"><Clock aria-hidden="true" size={13} />{t("Hết hạn sau")} <strong className="tabular-nums text-bo-foreground">00:00</strong></p>
              ) : link.trangThai === 'EXPIRED' && link.hetHanLuc ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-bo-muted"><Clock aria-hidden="true" size={13} />{t("Hết hạn lúc")} {gioPhut(link.hetHanLuc)}</p>
              ) : null}
            </>
          )}
          {/* Nhận diện cổng thanh toán cho khách đang quét; mờ đi khi mã hết hiệu lực.
              "Cổng thanh toán" thay vì "Thanh toán qua": khách quét bằng app ngân hàng bất kỳ, không cần app payOS */}
          <p className={`mt-3 inline-flex items-center gap-2 text-xs text-bo-muted ${hienMa ? '' : 'opacity-40'}`}>{t("Cổng thanh toán")} <PayosLogo height={24} /></p>
        </div>
        <div className="min-w-0 space-y-3 text-sm">
          <div className="rounded-lg border border-bo-border bg-slate-50 p-3">
            <p className="text-xs text-bo-muted">{tienMat > 0 ? t("Số tiền quét QR") : t("Số tiền")}</p>
            <p className={`text-2xl font-bold tabular-nums ${MA_KHONG_THANH.includes(link.trangThai) ? 'text-slate-400' : 'text-bo-primary'}`}>{formatMoney(link.soTien)}</p>
            {link.trangThai === 'PAID_ERROR' && link.soTienDaNhan != null ? (
              <p className="mt-1 text-xs text-bo-muted">{t("Đã nhận:")} <strong className="text-bo-foreground">{formatMoney(link.soTienDaNhan)}</strong></p>
            ) : null}
            {/* Trả kết hợp: một dòng tiền mặt + tổng hóa đơn; đã trả lại khách thì dòng này báo đã trả (không thêm hộp) */}
            {tienMat > 0 && daTraLai ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-bo-success">
                <Check aria-hidden="true" className="shrink-0" size={13} />
                <span>{t("Đã trả lại")} <strong className="font-semibold tabular-nums">{formatMoney(tienMat)}</strong> {t("tiền mặt ·")} {gioPhut(link.tienMatTraLaiLuc)}</span>
              </p>
            ) : tienMat > 0 ? (
              <p className="mt-0.5 text-xs text-bo-muted">
                {t("Tiền mặt")} <strong className="font-medium tabular-nums text-bo-foreground">{formatMoney(tienMat)}</strong>
                {t("· Tổng")} <strong className="font-medium tabular-nums text-bo-foreground">{formatMoney(tienMat + Number(link.soTien || 0))}</strong>
              </p>
            ) : null}
          </div>
          {canTraLai ? (
            <div aria-live="assertive" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900" role="alert">
              <p className="text-[13px] font-semibold">{t("Trả lại khách {{tienMat}} tiền mặt", { tienMat: formatMoney(tienMat) })}</p>
              <p className="mt-0.5">
                {link.trangThai === 'REFUNDED'
                  ? t("Quản lý đã hoàn khoản chuyển khoản cho khách; phần tiền mặt khách đưa trước vẫn ở quầy.")
                  : t("Mã không thành nên khách chưa mua được hàng.")}{' '}
                {t("Trả xong bấm")} <strong>{t("Đã trả lại tiền mặt")}</strong>.
              </p>
              {state.returnCashError ? <p className="mt-2 flex items-start gap-1.5 font-medium text-red-700"><AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={14} />{state.returnCashError}</p> : null}
            </div>
          ) : null}
          <dl className="space-y-1.5 text-xs">
            {hienMa || link.trangThai === 'PAID_ERROR' ? (
              <div className="flex justify-between gap-3"><dt className="text-bo-muted">{t("Chủ tài khoản")}</dt><dd className="truncate text-right font-medium text-bo-foreground">{link.tenTaiKhoan || '—'}</dd></div>
            ) : null}
            {/* Không hiện số tài khoản / nội dung CK: chỉ cho quét mã. Chuyển tay dễ sai số tiền hoặc thiếu mã nhận
                diện payOS ("CS…") -> payOS không ghi nhận, tiền vào tài khoản mà hệ thống không biết.
                Mã giao dịch giữ cả khi mã đã đóng: để tra ở màn Đối soát chuyển khoản. */}
            <div className="flex justify-between gap-3"><dt className="text-bo-muted">{t("Mã giao dịch")}</dt><dd className="font-mono text-bo-muted">{link.orderCode}</dd></div>
          </dl>
          {hienMa ? (
            <p className="text-[11px] leading-4 text-bo-muted">{t("Khách")} <strong className="text-bo-foreground">{t("chỉ quét mã")}</strong> {t("bằng app ngân hàng, không chuyển tay theo số tài khoản — chuyển tay hệ thống không nhận ra.")}</p>
          ) : null}
          {hienMa && state.online === false ? (
            <OfflineNotice>
              <strong>{t("Máy đang mất mạng.")}</strong> {t("Khách vẫn chuyển khoản được bình thường; màn hình sẽ tự cập nhật khi có mạng lại.")}
            </OfflineNotice>
          ) : null}
          {hienMa ? (
            <div aria-live="polite" className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${sapHet ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
              {sapHet
                ? <AlertCircle aria-hidden="true" className="shrink-0" size={14} />
                : <RefreshCcw aria-hidden="true" className="shrink-0 animate-spin" size={14} />}
              <span>{sapHet ? t("Mã sắp hết hạn. Khách chưa quét thì bấm Hủy mã QR rồi Thanh toán lại.") : t("Đang chờ khách chuyển khoản… Hàng trong giỏ đang được giữ chỗ.")}</span>
            </div>
          ) : hetGio ? (
            <div aria-live="polite" className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${loiDongMa ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-bo-border bg-slate-50 text-slate-700'}`}>
              {loiDongMa
                ? <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
                : <RefreshCcw aria-hidden="true" className="mt-0.5 shrink-0 motion-safe:animate-spin" size={14} />}
              <span>
                {loiDongMa
                  ? t("Chưa đóng được mã: {{message}}. {{huongDan}}", { message: loiDongMa.message, huongDan: loiDongMa.final ? t("Bấm Hủy mã QR để thử lại.") : t("Máy tự thử lại sau ít giây.") })
                  : t("Mã đã hết giờ. Chờ thêm ít giây phòng khách vừa bấm chuyển rồi đóng mã — tiền về kịp thì đơn vẫn tự hoàn tất.")}
              </span>
            </div>
          ) : terminalText && !canTraLai ? (
            <div aria-live="polite" className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${link.trangThai === 'PAID_ERROR' ? 'border-red-200 bg-red-50 text-red-700' : daTraLai ? 'border-bo-border bg-slate-50 text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
              {link.trangThai === 'PAID_ERROR' ? (
                <span>
                  <strong>{t("Khách đã chuyển khoản — không thu tiền lại.")}</strong> {t("Hóa đơn đã khóa và chuyển cho quản lý xử lý (bán cho khách hoặc trả lại tiền) ở màn Đối soát chuyển khoản; xử lý xong màn này tự cập nhật.")}
                  {tienMat > 0 ? <span className="mt-1 block">{t("Giữ lại {{tienMat}} tiền mặt khách đưa trước, chưa trả lại khách, tới khi quản lý xử lý.", { tienMat: formatMoney(tienMat) })}</span> : null}
                  {link.errorMessage ? <span className="mt-1 block opacity-80">{link.errorMessage}</span> : null}
                </span>
              ) : (
                // Lý do máy chủ ghi chỉ có ích khi không tạo được mã; hết hạn / hủy thì lặp lại đúng câu trên
                <span>{terminalText}{link.trangThai === 'FAILED' && link.errorMessage ? ` ${link.errorMessage}` : ''}{daTraLai ? t(" Khách muốn mua tiếp thì bấm Thanh toán lại.") : ''}</span>
              )}
            </div>
          ) : null}
          {link.checkoutUrl && hienMa ? (
            <a className="inline-flex items-center gap-1.5 text-xs font-medium text-bo-primary hover:underline" href={link.checkoutUrl} rel="noopener noreferrer" target="_blank"><Landmark aria-hidden="true" size={13} />{t("Mở trang thanh toán payOS")}</a>
          ) : null}
        </div>
      </div>
      <div className="mt-5 flex flex-col-reverse justify-end gap-2 border-t border-bo-border pt-4 sm:flex-row">
        {pending ? (
          <>
            <button className={secondaryButton} onClick={onClose} type="button">{t("Ẩn (vẫn chờ tiền)")}</button>
            {/* Hết giờ: máy quầy đang tự hủy mã (thử lại tới khi payOS xác nhận), không cho bấm chồng; tự hủy gặp lỗi
                không tự hết thì mở lại nút cho thu ngân */}
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300" disabled={(hetGio && !loiDongMa?.final) || state.isSubmitting || state.online === false} onClick={actions.onCancelPayos} title={state.online === false ? t("Đang mất mạng — chưa hủy được mã QR") : undefined} type="button">{hetGio && !loiDongMa?.final ? t("Đang đóng mã…") : state.isSubmitting ? t("Đang hủy…") : t("Hủy mã QR")}</button>
          </>
        ) : (
          <>
            <button className={secondaryButton} disabled={canTraLai && state.isSubmitting} onClick={onClose} type="button">{canTraLai ? t("Để sau") : t("Đóng")}</button>
            {canTraLai ? (
              <button className={primaryButton} disabled={state.isSubmitting || state.online === false} onClick={() => actions.onReturnPayosCash(link.orderCode)} title={state.online === false ? t("Đang mất mạng — chưa ghi nhận được") : undefined} type="button">
                {state.isSubmitting ? t("Đang ghi nhận…") : t("Đã trả lại tiền mặt")}
              </button>
            ) : link.trangThai !== 'PAID_ERROR' && link.trangThai !== 'PAID' ? <button className={primaryButton} onClick={actions.onRecreatePayos} type="button">{t("Thanh toán lại")}</button> : null}
          </>
        )}
      </div>
    </PosModal>
  );
}

const CUSTOMER_SEARCH_DELAY_MS = 300;
const CUSTOMER_PAGE_SIZE = 20;

/**
 * Dialog chọn khách hàng + thêm nhanh khách hàng mới (tên + SĐT).
 * Tìm trên SERVER (trễ 300 ms sau lần gõ cuối) để thấy cả khách quầy khác vừa thêm; trong lúc
 * chờ hoặc khi mất mạng thì lọc tạm trên danh sách đã tải lúc mở trang.
 */
function CustomerDialog({ state, actions, onClose }) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [remote, setRemote] = useState({ keyword: null, items: [], total: 0, error: false });
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickError, setQuickError] = useState('');
  const [quickExisting, setQuickExisting] = useState(null);

  useEffect(() => {
    const keyword = customerSearch.trim();
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      posService.searchCustomers(keyword, { size: CUSTOMER_PAGE_SIZE, signal: controller.signal })
        .then(({ items, total }) => setRemote({ keyword, items, total, error: false }))
        .catch((error) => {
          if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return;
          setRemote({ keyword, items: [], total: 0, error: true });
        });
    }, CUSTOMER_SEARCH_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [customerSearch]);

  const keyword = customerSearch.trim();
  const remoteReady = remote.keyword === keyword && !remote.error;
  const localMatches = state.customers.filter((customer) => `${customer.name} ${customer.phone ?? ''}`.toLowerCase().includes(keyword.toLowerCase()));
  const matchingCustomers = remoteReady ? remote.items : localMatches;
  // Câu "Hiển thị x/y khách" không đếm Khách lẻ (khách của hệ thống, luôn đứng đầu trang đầu nếu khớp từ khóa)
  const coKhachLe = remote.items.some((customer) => customer.code === WALKIN_CUSTOMER_CODE) ? 1 : 0;
  const soKhachHien = remote.items.length - coKhachLe;
  const tongKhach = Math.max(0, remote.total - coKhachLe);

  const resetQuickAdd = () => {
    setQuickAddOpen(false);
    setQuickName('');
    setQuickPhone('');
    setQuickBusy(false);
    setQuickError('');
    setQuickExisting(null);
  };
  const closeCustomerDialog = () => {
    resetQuickAdd();
    setCustomerSearch('');
    onClose();
  };
  const openQuickAdd = () => {
    // Điền sẵn từ ô tìm kiếm: toàn chữ số -> SĐT, còn lại -> tên.
    const keyword = customerSearch.trim();
    if (/^[\d\s.-]+$/.test(keyword)) setQuickPhone(keyword);
    else if (keyword) setQuickName(keyword);
    setQuickError('');
    setQuickExisting(null);
    setQuickAddOpen(true);
  };
  const phoneDigits = quickPhone.replace(/[\s.-]/g, '');
  const quickInvalid = !quickName.trim() || !/^0\d{9}$/.test(phoneDigits);
  const submitQuickAdd = async (event) => {
    event.preventDefault();
    if (quickInvalid || quickBusy) return;
    setQuickBusy(true);
    setQuickError('');
    setQuickExisting(null);
    try {
      await actions.onQuickCreateCustomer({ name: quickName.trim(), phone: phoneDigits });
      closeCustomerDialog();
    } catch (error) {
      const envelope = error?.response?.data;
      setQuickError(envelope?.message || t("Không thể thêm khách hàng. Vui lòng thử lại."));
      if (error?.response?.status === 409 && envelope?.data?.id) setQuickExisting(envelope.data);
      setQuickBusy(false);
    }
  };
  const selectExisting = () => {
    actions.onSelectCustomer(toPosCustomer(quickExisting));
    closeCustomerDialog();
  };
  return (
    <PosModal description={t("Chọn khách hàng cho hóa đơn hiện tại.")} onClose={closeCustomerDialog} title={t("Chọn khách hàng")} size="md">
      <label className="relative block">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-bo-muted" size={17} />
        <input autoFocus className={`${fieldClass} mt-0 pl-9`} onChange={(event) => setCustomerSearch(event.target.value)} placeholder={t("Tìm theo tên hoặc số điện thoại")} value={customerSearch} />
      </label>
      <ul className="mt-3 max-h-64 divide-y divide-bo-border overflow-y-auto rounded-lg border border-bo-border">
        {matchingCustomers.length ? matchingCustomers.map((customer) => (
          <li key={customer.id}>
            <button className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-slate-50" onClick={() => { actions.onSelectCustomer(customer); closeCustomerDialog(); }} type="button">
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-bo-foreground">{customer.name}</span><span className="mt-0.5 block text-xs text-bo-muted">{customer.phone || customer.tier}</span></span>
              {state.customer?.id === customer.id ? <Check aria-hidden="true" className="shrink-0 text-bo-primary" size={17} /> : <ChevronRight aria-hidden="true" className="shrink-0 text-bo-muted" size={16} />}
            </button>
          </li>
        )) : <li className="px-4 py-8 text-center text-sm text-bo-muted">{remote.keyword === keyword || remote.error ? t("Không tìm thấy khách hàng phù hợp.") : t("Đang tìm…")}</li>}
      </ul>
      {remote.error && remote.keyword === keyword ? (
        <p className="mt-2 text-xs text-amber-700">{t("Không tải được danh sách mới nhất — đang hiện danh sách lúc mở trang.")}</p>
      ) : remoteReady && tongKhach > soKhachHien ? (
        <p className="mt-2 text-xs text-bo-muted">{t("Hiển thị {{soKhachHien}}/{{tongKhach}} khách — gõ thêm tên hoặc SĐT để lọc.", { soKhachHien, tongKhach, count: tongKhach })}</p>
      ) : null}
      {quickAddOpen ? (
        <form className="mt-4 rounded-lg border border-bo-border p-3" onSubmit={submitQuickAdd}>
          <p className="text-sm font-semibold text-bo-foreground">{t("Thêm khách hàng mới")}</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field autoFocus={!quickName} id="quick-customer-name" label={t("Tên khách hàng *")} onChange={(event) => setQuickName(event.target.value)} placeholder={t("VD: Nguyễn Văn A")} value={quickName} />
            <Field autoFocus={Boolean(quickName)} id="quick-customer-phone" label={t("Số điện thoại *")} onChange={(event) => setQuickPhone(event.target.value)} placeholder={t("VD: 0912345678")} value={quickPhone} />
          </div>
          {quickPhone && !/^0\d{9}$/.test(phoneDigits) ? <p className="mt-2 text-xs text-red-600">{t("Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.")}</p> : null}
          {quickError ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              <span>{quickError}</span>
              {quickExisting && quickExisting.trangThai === 1 ? <button className="font-semibold text-bo-primary underline" onClick={selectExisting} type="button">{t("Chọn khách này")}</button> : null}
            </div>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <button className={secondaryButton} disabled={quickBusy} onClick={resetQuickAdd} type="button">{t("Hủy")}</button>
            <button className={primaryButton} disabled={quickInvalid || quickBusy} type="submit">{quickBusy ? t("Đang lưu…") : t("Lưu và chọn")}</button>
          </div>
        </form>
      ) : (
        <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-bo-primary/40 px-3 py-2.5 text-sm font-medium text-bo-primary transition hover:bg-bo-primary-soft" onClick={openQuickAdd} type="button">
          <UserPlus aria-hidden="true" size={16} /> {t("Thêm khách hàng mới")}
        </button>
      )}
    </PosModal>
  );
}

/**
 * Dialog POS bản live: khách hàng thật; thanh toán chỉ Tiền mặt. Khi checkoutEnabled
 * đang tắt -> nút xác nhận khóa kèm thông báo. Attempt-aware:
 * - pending -> nút bận (chặn click đúp);
 * - unknown -> dialog riêng yêu cầu kiểm tra recovery trước, thử lại chỉ với CÙNG key+payload;
 * - failed -> người bán sửa draft rồi gửi lại với key MỚI (do PosSalesPage quản lý).
 * Receipt dùng dữ liệu SERVER (soDonHang chính thức), không dùng receipt mẫu.
 */
export default function PosDialogs({ dialog, state, actions, onClose, checkoutEnabled }) {
  if (!dialog) return null;

  if (dialog === 'customer') {
    // Component riêng: đóng dialog là unmount -> ô tìm kiếm và form thêm nhanh tự reset.
    return <CustomerDialog actions={actions} onClose={onClose} state={state} />;
  }

  if (dialog === 'clear') {
    return (
      <PosModal description={t("Nội dung hóa đơn hiện tại sẽ bị xóa.")} onClose={onClose} title={t("Xóa hóa đơn?")} size="sm">
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} /><p>{t("Thao tác này xóa các sản phẩm và ghi chú khỏi hóa đơn hiện tại.")}</p></div>
        <div className="mt-5"><FooterButtons confirmText={t("Xóa hóa đơn")} destructive onClose={onClose} onConfirm={() => { actions.onClearCart(); onClose(); }} /></div>
      </PosModal>
    );
  }

  if (dialog === 'change-warehouse') {
    const count = state.cart.reduce((sum, line) => sum + line.quantity, 0);
    return (
      <PosModal description={t("Tồn kho và giá được tính theo từng kho.")} onClose={actions.onCancelWarehouseChange} title={t("Đổi kho bán hàng?")} size="sm">
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p>
            {t("Chuyển từ")} <strong>{state.activeWarehouse?.tenKho || t("kho hiện tại")}</strong> {t("sang")} <strong>{state.pendingWarehouse?.tenKho || t("kho mới")}</strong> {t("sẽ xóa {{count}} sản phẩm trong hóa đơn {{invoiceNumber}}, để không bán nhầm tồn của kho khác. Các hóa đơn khác giữ nguyên.", { count, invoiceNumber: state.invoiceNumber })}
          </p>
        </div>
        <div className="mt-5"><FooterButtons cancelAutoFocus cancelText={t("Giữ kho hiện tại")} confirmText={t("Đổi kho và xóa giỏ")} destructive onClose={actions.onCancelWarehouseChange} onConfirm={actions.onConfirmWarehouseChange} /></div>
      </PosModal>
    );
  }

  if (dialog === 'close-invoice') {
    // Đã thanh toán xong (tiền chuyển khoản về khi đang ở tab khác) nhưng chưa in / hoàn tất: đơn đã lưu, không mất gì.
    const daThanhToan = state.closingInvoice?.attempt?.status === 'succeeded';
    return (
      <PosModal description={daThanhToan ? t("Hóa đơn đã thanh toán, chưa in.") : t("Hóa đơn đang có nội dung chưa thanh toán.")} onClose={onClose} title={t("Đóng hóa đơn {{number}}?", { number: state.closingInvoice?.number })} size="sm">
        <p className="text-sm leading-6 text-bo-muted">{daThanhToan
          ? t("Đơn bán đã được lưu. Khách cần hóa đơn thì in trước khi đóng; sau khi đóng vẫn in lại được ở trang Đơn bán.")
          : t("Sản phẩm, khách hàng và ghi chú của hóa đơn này sẽ bị bỏ. Các hóa đơn khác được giữ lại.")}</p>
        <div className="mt-5"><FooterButtons cancelText={t("Hủy")} confirmText={t("Đóng hóa đơn")} destructive={!daThanhToan} onClose={onClose} onConfirm={actions.onCloseInvoice} /></div>
      </PosModal>
    );
  }

  if (dialog === 'close-many' && state.closingMany) {
    const { total, emptyCount, items, kept } = state.closingMany;
    return (
      <PosModal description={t("Hóa đơn có nội dung chưa thanh toán sẽ bị bỏ.")} onClose={actions.onCancelBulkClose} title={t("Đóng {{count}} hóa đơn?", { count: total })} size="sm">
        <ul className="divide-y divide-bo-border rounded-lg border border-bo-border text-sm">
          {items.map((item) => (
            <li className="flex items-start justify-between gap-3 px-3 py-2" key={item.number}>
              <span className="min-w-0">
                <span className="block font-medium text-bo-foreground">{t("Hóa đơn {{number}}", { number: item.number })}</span>
                {item.customerName || item.storeName ? <span className="block truncate text-xs text-bo-muted">{[item.customerName, item.storeName].filter(Boolean).join(' · ')}</span> : null}
              </span>
              <span className="shrink-0 tabular-nums text-bo-muted">{item.count ? t("{{count}} sản phẩm", { count: item.count }) : t("Có khách hoặc ghi chú")}</span>
            </li>
          ))}
        </ul>
        {emptyCount ? <p className="mt-2 text-xs leading-5 text-bo-muted">{t("Kèm {{count}} hóa đơn trống.", { count: emptyCount })}</p> : null}
        {kept.length ? (
          <p className="mt-2 rounded-md bg-bo-surface-subtle px-3 py-2 text-xs leading-5 text-bo-muted">
            {t("Giữ lại vì thanh toán chưa xong: {{danhSach}}.", { danhSach: kept.map((item) => (item.label ? t("Hóa đơn {{number}} ({{trangThai}})", { number: item.number, trangThai: item.label.toLowerCase() }) : t("Hóa đơn {{number}}", { number: item.number }))).join(', ') })}
          </p>
        ) : null}
        <div className="mt-5"><FooterButtons cancelAutoFocus cancelText={t("Không đóng")} confirmText={t("Đóng {{count}} hóa đơn", { count: total })} destructive onClose={actions.onCancelBulkClose} onConfirm={actions.onConfirmBulkClose} /></div>
      </PosModal>
    );
  }

  if (dialog === 'close-paid-error') {
    return (
      <PosModal description={t("Khách đã chuyển khoản nhưng chưa tạo được đơn.")} onClose={onClose} title={t("Đóng hóa đơn {{number}}?", { number: state.closingInvoice?.number })} size="sm">
        <p className="text-sm leading-6 text-bo-muted">{t("Giao dịch đã chuyển cho quản lý xử lý ở màn Đối soát chuyển khoản (bán cho khách hoặc trả lại tiền) và vẫn nằm ở đó sau khi đóng tab. Không thu tiền lại của khách cho các món này.")}</p>
        {tienMatTruocCua(state.closingInvoice?.payos) > 0 ? (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{t("Khách còn đưa trước")} <strong>{formatMoney(tienMatTruocCua(state.closingInvoice.payos))}</strong> {t("tiền mặt: giữ lại tới khi quản lý xử lý; quản lý trả lại tiền chuyển khoản thì cũng trả lại khách số tiền mặt này.")}</p>
        ) : null}
        <div className="mt-5"><FooterButtons cancelText={t("Giữ tab")} confirmText={t("Đóng hóa đơn")} destructive onClose={onClose} onConfirm={actions.onCloseInvoice} /></div>
      </PosModal>
    );
  }

  if (dialog === 'payos-qr') {
    return <PayosQrDialog actions={actions} onClose={onClose} state={state} />;
  }

  if (dialog === 'payment') {
    const isTransfer = state.paymentMethod === 'transfer' && state.payosEnabled;
    const paid = Number(state.paymentAmount || 0);
    const amountInvalid = !isTransfer && (!Number.isFinite(paid) || paid < state.total);
    const pending = state.attemptStatus === 'pending';
    const offline = state.online === false;
    const roundedAmount = Math.ceil(state.total / 100000) * 100000;
    const quickAmounts = [...new Set([state.total, roundedAmount, roundedAmount + 200000, roundedAmount + 500000].filter((amount) => amount > 0))];
    // Chuyển khoản QR có thể kèm tiền mặt khách đưa trước (trả kết hợp); ô trống = mã QR trọn hóa đơn như cũ.
    const qr = isTransfer ? kiemTienMatTruocQr(state.total, state.tienMatTruoc) : null;
    const kemTienMat = Boolean(qr && qr.tienMat > 0 && !qr.loi);
    const canCreateQr = checkoutEnabled && !offline && !state.frozen && !qr?.loi && !state.isSubmitting;
    const transferError = state.paymentError || qr?.loi || '';
    return (
      <PosModal description={isTransfer ? t("Tạo mã QR để khách chuyển khoản qua payOS.") : t("Xác nhận số tiền khách thanh toán bằng tiền mặt.")} onClose={onClose} title={t("Thanh toán")} size="lg">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-bo-muted">{t("Phương thức thanh toán")}</p>
            <div className={`mt-2 grid gap-2 ${state.payosEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <MethodButton active={!isTransfer} disabled={state.frozen} icon={<Banknote aria-hidden="true" size={18} />} label={t("Tiền mặt")} onClick={() => actions.onPaymentMethod('cash')} />
              {state.payosEnabled ? <MethodButton active={isTransfer} disabled={state.frozen} icon={<QrCode aria-hidden="true" size={18} />} label={t("Chuyển khoản (QR)")} onClick={() => actions.onPaymentMethod('transfer')} /> : null}
            </div>
            {isTransfer ? (
              <div className="mt-5 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-bo-foreground" htmlFor="payment-cash-before-qr">
                    {t("Khách đưa trước tiền mặt")} <span className="font-normal text-bo-muted">{t("(không bắt buộc)")}</span>
                  </label>
                  {/* Form để Enter trong ô số tiền = tạo mã QR (thao tác quầy nhanh hơn) */}
                  <form className="relative mt-1.5" noValidate onSubmit={(event) => { event.preventDefault(); if (canCreateQr) actions.onCreatePayosQr(); }}>
                    <MoneyInput aria-describedby="payment-cash-before-qr-hint" aria-invalid={Boolean(qr?.loi)} className={`${fieldClass} mt-0 h-auto pr-10 text-right font-semibold tabular-nums disabled:bg-slate-50 disabled:opacity-60`} disabled={state.frozen} id="payment-cash-before-qr" onChange={actions.onTienMatTruoc} onFocus={(event) => event.target.select()} placeholder="0" value={state.tienMatTruoc ?? ''} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-bo-muted">₫</span>
                  </form>
                  <p className="mt-1 text-[11px] leading-4 text-bo-muted" id="payment-cash-before-qr-hint">{t("Khách trả một phần bằng tiền mặt thì nhập số đã nhận; mã QR chỉ mang phần còn lại. Bỏ trống nếu khách quét QR cả hóa đơn.")}</p>
                </div>
                <div className="rounded-lg border border-bo-border bg-slate-50 p-3 text-xs leading-5 text-bo-muted">
                  {kemTienMat ? (
                    <dl className="space-y-1">
                      <div className="flex justify-between gap-3"><dt>{t("Tổng hóa đơn")}</dt><dd className="tabular-nums text-bo-foreground">{formatMoney(state.total)}</dd></div>
                      <div className="flex justify-between gap-3"><dt>{t("Tiền mặt khách đưa")}</dt><dd className="tabular-nums text-bo-foreground">− {formatMoney(qr.tienMat)}</dd></div>
                      <div className="flex justify-between gap-3 border-t border-dashed border-bo-border pt-1 font-semibold text-bo-foreground"><dt>{t("Phần quét QR")}</dt><dd className="tabular-nums text-bo-primary">{formatMoney(qr.soTienQr)}</dd></div>
                    </dl>
                  ) : (
                    <p className="font-semibold text-bo-foreground">{t("Cần thu: {{total}}", { total: formatMoney(state.total) })}</p>
                  )}
                  <p className="mt-1">{t("Bấm")} <strong className="text-bo-foreground">{t("Tạo mã QR")}</strong>{t(", khách quét bằng ứng dụng ngân hàng. Hàng trong giỏ được giữ chỗ cho tới khi khách trả tiền, hủy hoặc hết hạn.")}</p>
                  {kemTienMat ? <p className="mt-1">{t("Mã QR bị hủy hoặc hết hạn thì trả lại khách")} <strong className="text-bo-foreground">{formatMoney(qr.tienMat)}</strong> {t("tiền mặt.")}</p> : null}
                </div>
                {transferError ? <p className="flex items-start gap-1.5 text-xs text-red-600" role="alert"><AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={14} />{transferError}</p> : null}
              </div>
            ) : (
            <div className="mt-5">
              <div className="flex items-end justify-between gap-3">
                <label className="flex-1 text-sm font-medium text-bo-foreground" htmlFor="payment-amount">{t("Khách thanh toán")}</label>
                <span className="text-xs text-bo-muted">{t("Cần thu:")} <strong className="text-bo-foreground">{formatMoney(state.total)}</strong></span>
              </div>
              {/* Form để Enter trong ô số tiền = xác nhận thanh toán (thao tác quầy nhanh hơn) */}
              <form className="relative mt-1.5" onSubmit={(event) => { event.preventDefault(); if (checkoutEnabled && !offline && !pending && !amountInvalid && !state.isSubmitting) actions.onConfirmPayment(); }}>
                {/* 0 hiện ô trống (chữ mờ "0"): xóa hết rồi gõ không bị dính số 0 đầu */}
                <MoneyInput autoFocus className={`${fieldClass} h-auto pr-12 text-right text-lg font-semibold disabled:bg-slate-50 disabled:opacity-60`} disabled={state.frozen} id="payment-amount" onChange={actions.onPaymentAmount} onFocus={(event) => event.target.select()} placeholder="0" value={state.paymentAmount || ''} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-bo-muted">₫</span>
              </form>
              <div className="mt-2 flex flex-wrap gap-2">
                {quickAmounts.map((amount) => <button className="rounded-md border border-bo-border px-2.5 py-1.5 text-xs font-medium text-bo-foreground transition hover:border-bo-primary hover:bg-bo-primary-soft hover:text-bo-primary disabled:cursor-not-allowed disabled:opacity-50" disabled={state.frozen} key={amount} onClick={() => actions.onPaymentAmount(amount)} type="button">{amount === state.total ? t("Đủ tiền") : formatMoney(amount)}</button>)}
                <button className="rounded-md px-2.5 py-1.5 text-xs font-medium text-bo-primary transition hover:bg-bo-primary-soft disabled:cursor-not-allowed disabled:opacity-50" disabled={state.frozen} onClick={() => actions.onPaymentAmount(0)} type="button">{t("Xóa số tiền")}</button>
              </div>
              {state.paymentError ? <p className="mt-2 flex items-start gap-1.5 text-xs text-red-600"><AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={14} />{state.paymentError}</p> : null}
              <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-bo-muted">{t("Tiền thừa trả khách:")} <strong className="text-bo-foreground">{formatMoney(Math.max(0, paid - state.total))}</strong></p>
            </div>
            )}
          </div>
          <aside className="rounded-lg border border-bo-border bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-2"><div><p className="text-xs text-bo-muted">{t("Khách hàng")}</p><p className="mt-1 text-sm font-semibold text-bo-foreground">{state.customer?.name || t("Khách lẻ")}</p></div><span className="grid size-8 place-items-center rounded-full bg-white text-bo-primary"><Receipt aria-hidden="true" size={17} /></span></div>
            <div className="my-4 border-t border-dashed border-bo-border" />
            <div className="flex items-center justify-between text-xs text-bo-muted"><span>{t("Tổng tiền hàng")}</span><span>{formatMoney(state.subtotal)}</span></div>
            <div className="mt-3 flex items-end justify-between gap-2"><span className="text-sm font-semibold text-bo-foreground">{t("Khách cần trả")}</span><span className="text-lg font-bold text-bo-primary">{formatMoney(state.total)}</span></div>
          </aside>
        </div>
        {checkoutEnabled && offline ? (
          <div className="mt-4">
            <OfflineNotice>
              <strong>{t("Mất kết nối mạng — chưa thể thanh toán.")}</strong> {t("Chưa có tiền hay đơn hàng nào được ghi nhận. Khi có mạng lại, nút xác nhận sẽ tự mở.")}
            </OfflineNotice>
          </div>
        ) : null}
        {!checkoutEnabled ? (
          <div aria-live="polite" className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
            <span><strong>{t("Chức năng thanh toán chưa được kích hoạt.")}</strong> {t("Sản phẩm trong giỏ được giữ nguyên; không có đơn hàng, phiếu thu hay giao dịch nào được tạo.")}</span>
          </div>
        ) : null}
        <div className="mt-5 border-t border-bo-border pt-4">
          {isTransfer ? (
            <FooterButtons busy={state.isSubmitting} confirmText={!checkoutEnabled ? t("Thanh toán chưa kích hoạt") : offline ? t("Mất kết nối mạng") : kemTienMat ? t("Tạo mã QR {{soTienQr}}", { soTienQr: formatMoney(qr.soTienQr) }) : t("Tạo mã QR")} disabled={!checkoutEnabled || offline || state.frozen || Boolean(qr?.loi)} onClose={onClose} onConfirm={actions.onCreatePayosQr} />
          ) : (
            <FooterButtons busy={state.isSubmitting} confirmText={!checkoutEnabled ? t("Thanh toán chưa kích hoạt") : pending ? t("Đang xử lý…") : offline ? t("Mất kết nối mạng") : t("Xác nhận thanh toán")} disabled={!checkoutEnabled || offline || pending || amountInvalid} onClose={onClose} onConfirm={actions.onConfirmPayment} />
          )}
        </div>
      </PosModal>
    );
  }

  if (dialog === 'checkout-unknown') {
    return (
      <PosModal description={t("Không thể xác nhận kết quả giao dịch (mất kết nối hoặc hết thời gian chờ).")} onClose={onClose} title={t("Giao dịch chưa rõ kết quả")} size="md">
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p>{t("Giao dịch đã được gửi nhưng chưa rõ máy chủ đã lưu hay chưa. Hóa đơn vẫn được khóa để giữ nguyên nội dung đã gửi. Hãy kiểm tra kết quả bằng đúng mã giao dịch trước khi quyết định.")}</p>
        </div>
        {state.online === false ? (
          <div className="mt-3">
            <OfflineNotice>
              <strong>{t("Máy đang mất mạng.")}</strong> {t("Chờ có mạng lại rồi bấm \"Kiểm tra kết quả giao dịch\" — không thu tiền lại của khách khi chưa kiểm tra.")}
            </OfflineNotice>
          </div>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          <button className={primaryButton} disabled={state.isSubmitting || state.online === false} onClick={actions.onCheckRecovery} type="button">
            <RefreshCcw aria-hidden="true" size={16} />{state.isSubmitting ? t("Đang kiểm tra…") : t("Kiểm tra kết quả giao dịch")}
          </button>
          <button className={secondaryButton} disabled={state.isSubmitting || state.online === false} onClick={actions.onRetrySameAttempt} type="button">
            {t("Thử lại với cùng mã giao dịch")}
          </button>
          <p className="text-center text-[11px] leading-4 text-bo-muted">{t("Nếu máy chủ báo chưa có kết quả, \"Thử lại\" sẽ gửi lại CHÍNH XÁC nội dung đã đóng băng (cùng mã) — không tạo đơn trùng.")}</p>
        </div>
      </PosModal>
    );
  }

  if (dialog === 'price-change') {
    const items = state.priceChange?.items ?? [];
    return (
      <PosModal description={t("Giá trên hệ thống đã đổi so với giá đang hiển thị.")} onClose={onClose} title={t("Giá đã thay đổi")} size="md">
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p>{t("Hệ thống KHÔNG tự thu số tiền theo giá mới. Vui lòng xem lại giá và tổng tiền mới, báo lại khách trước khi thanh toán.")}</p>
        </div>
        <ul className="mt-4 divide-y divide-bo-border rounded-lg border border-bo-border">
          {items.map((item) => (
            <li className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm" key={item.bienTheSanPhamId}>
              <span className="min-w-0 truncate text-bo-foreground">{item.maSku}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs">
                <span className="text-bo-muted line-through">{formatMoney(item.giaHienThi)}</span>
                <span className="font-semibold text-bo-primary">{formatMoney(item.giaMoi)}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-end justify-between border-t border-dashed border-bo-border pt-3">
          <span className="text-sm font-semibold text-bo-foreground">{t("Tổng tiền mới")}</span>
          <span className="text-lg font-bold text-bo-primary">{formatMoney(state.total)}</span>
        </div>
        <div className="mt-5">
          <FooterButtons confirmText={t("Đã xem giá mới")} onClose={actions.onConfirmNewPrice} onConfirm={actions.onConfirmNewPrice} />
        </div>
      </PosModal>
    );
  }

  if (dialog === 'receipt') {
    const receipt = state.receipt;
    // Trả kết hợp (tiền mặt đưa trước + QR payOS): tách hai phần; QR trọn hóa đơn / tiền mặt giữ nguyên dòng cũ.
    const ketHop = chiaThanhToanKetHop(receipt);
    return (
      <PosModal description={t("Giao dịch đã được hệ thống xác nhận và lưu.")} onClose={actions.onCloseReceipt} title={t("Thanh toán thành công")} size="sm">
        <div className="flex flex-col items-center rounded-lg border border-bo-border bg-slate-50 px-4 py-5 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 aria-hidden="true" size={24} /></span>
          <p className="mt-3 text-xs text-bo-muted">{t("Số hóa đơn chính thức")}</p>
          <p className="text-base font-bold text-bo-foreground">{receipt?.soDonHang || '—'}</p>
          <p className="mt-3 text-2xl font-bold text-bo-primary">{formatMoney(receipt?.tongCong)}</p>
          {ketHop ? <PhanThanhToanKetHop ketHop={ketHop} /> : <p className="mt-1 text-xs text-bo-muted">{receipt?.phuongThuc === 'PAYOS' ? t("Chuyển khoản qua payOS · Đã nhận đủ tiền") : t("Tiền mặt · Khách đưa {{soTienThu}} · Tiền thừa {{soTienThua}}", { soTienThu: formatMoney(receipt?.soTienThu), soTienThua: formatMoney(receipt?.soTienThua) })}</p>}
        </div>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
          <button className={`${secondaryButton} flex-1`} onClick={actions.onPrintReceipt} type="button"><Printer aria-hidden="true" size={16} />{t("In hóa đơn")}</button>
          <button className={`${primaryButton} flex-1`} onClick={actions.onCloseReceipt} type="button">{t("Hoàn tất")}</button>
        </div>
        <p className="mt-3 text-center text-[11px] leading-4 text-bo-muted">{t("In lỗi chỉ cần thử in lại từ đơn đã lưu — giao dịch không chạy lại.")}</p>
      </PosModal>
    );
  }

  if (dialog === 'recovered-result') {
    const receipt = state.recoveredResult;
    const ketHop = chiaThanhToanKetHop(receipt);
    return (
      <PosModal description={t("Phát hiện giao dịch đã hoàn tất từ trước (trước khi tải lại trang).")} onClose={actions.onCloseRecovered} title={t("Giao dịch đã hoàn tất")} size="sm">
        <div className="flex flex-col items-center rounded-lg border border-bo-border bg-slate-50 px-4 py-5 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 aria-hidden="true" size={24} /></span>
          <p className="mt-3 text-xs text-bo-muted">{t("Số hóa đơn chính thức")}</p>
          <p className="text-base font-bold text-bo-foreground">{receipt?.soDonHang || '—'}</p>
          <p className="mt-3 text-2xl font-bold text-bo-primary">{formatMoney(receipt?.tongCong)}</p>
          {ketHop ? <PhanThanhToanKetHop ketHop={ketHop} /> : <p className="mt-1 text-xs text-bo-muted">{t("Tiền thừa")} {formatMoney(receipt?.soTienThua)}</p>}
        </div>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
          <button className={`${secondaryButton} flex-1`} onClick={actions.onPrintRecovered} type="button"><Printer aria-hidden="true" size={16} />{t("In hóa đơn")}</button>
          <button className={`${primaryButton} flex-1`} onClick={actions.onCloseRecovered} type="button">{t("Đóng")}</button>
        </div>
      </PosModal>
    );
  }

  if (dialog === 'shortcuts') return <ShortcutsDialog onClose={onClose} />;

  return null;
}
