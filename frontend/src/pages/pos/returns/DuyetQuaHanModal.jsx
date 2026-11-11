import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, MailCheck, ShieldCheck } from 'lucide-react';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatDateTime } from '@/utils/formatters';
import { traHangService } from '@/services/traHangService';
import PosModal from '../components/PosModal';
import { LY_DO_DUYET } from './tra-hang';
import { t } from "@/i18n";

const KHAC = '__khac__';
const GUI_LAI_SAU_GIAY = 60;

const secondaryButton = 'inline-flex min-h-9 items-center justify-center rounded-lg border border-bo-border bg-bo-surface px-3 text-sm font-medium text-bo-foreground transition hover:bg-bo-surface-subtle disabled:cursor-not-allowed disabled:opacity-60';
const orangeButton = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * MSG-RET-02 + "Yêu cầu Quản lý duyệt" (GBR-RET-02): đơn quá 03 ngày.
 * Thu ngân chọn lý do → hệ thống gửi mã PIN tới email quản lý cửa hàng → thu ngân nhập mã quản lý đọc cho.
 * Người đăng nhập là quản lý cửa hàng (coQuyenDuyet) thì tự duyệt với lý do, không cần mã.
 */
export default function DuyetQuaHanModal({ don, khoId, coQuyenDuyet, onClose, onDaDuyet, onTuDuyet }) {
  const [lyDoChon, setLyDoChon] = useState('');
  const [lyDoKhac, setLyDoKhac] = useState('');
  const [yeuCau, setYeuCau] = useState(null); // { yeuCauId, hetHanLuc, nguoiNhan }
  const [ma, setMa] = useState('');
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState(null);
  const [conCho, setConCho] = useState(0);
  const maRef = useRef(null);

  useEffect(() => {
    if (conCho <= 0) return undefined;
    const id = window.setTimeout(() => setConCho((x) => x - 1), 1000);
    return () => window.clearTimeout(id);
  }, [conCho]);

  // Lý do lưu CSDL và in trong email: giữ câu tiếng Việt gốc, chỉ dịch lúc hiện
  const lyDo = lyDoChon === KHAC ? lyDoKhac.trim() : lyDoChon;

  const guiMa = async () => {
    if (!lyDo || dangGui) return;
    setDangGui(true);
    setLoi(null);
    try {
      const kq = await traHangService.guiYeuCauDuyet({ donBanHangId: don.donBanHangId, khoId, lyDo });
      setYeuCau(kq);
      setMa('');
      setConCho(GUI_LAI_SAU_GIAY);
      setTimeout(() => maRef.current?.focus(), 0);
    } catch (err) {
      setLoi(getApiErrorMessage(err, t("Chưa gửi được mã duyệt. Thử lại sau ít phút.")));
    } finally {
      setDangGui(false);
    }
  };

  const nhapMa = async (event) => {
    event?.preventDefault();
    if (!/^\d{6}$/.test(ma) || dangGui || !yeuCau) return;
    setDangGui(true);
    setLoi(null);
    try {
      const duyet = await traHangService.nhapMaDuyet(yeuCau.yeuCauId, ma);
      onDaDuyet(duyet);
    } catch (err) {
      setLoi(getApiErrorMessage(err, t("Mã duyệt không đúng.")));
      setMa('');
      maRef.current?.focus();
    } finally {
      setDangGui(false);
    }
  };

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button className={secondaryButton} disabled={dangGui} onClick={onClose} type="button">{t("Để sau")}</button>
      {yeuCau ? (
        <button className={orangeButton} disabled={dangGui || !/^\d{6}$/.test(ma)} onClick={nhapMa} type="button">
          <ShieldCheck aria-hidden="true" size={16} />
          {t("Duyệt")}
        </button>
      ) : coQuyenDuyet ? (
        <button className={orangeButton} disabled={!lyDo} onClick={() => onTuDuyet(lyDo)} type="button">
          <ShieldCheck aria-hidden="true" size={16} />
          {t("Duyệt ngoại lệ")}
        </button>
      ) : (
        <button className={orangeButton} disabled={!lyDo || dangGui} onClick={guiMa} type="button">
          <MailCheck aria-hidden="true" size={16} />
          {dangGui ? t("Đang gửi…") : t("Gửi mã cho quản lý")}
        </button>
      )}
    </div>
  );

  return (
    <PosModal footer={footer} onClose={() => { if (!dangGui) onClose(); }} size="sm" title={t("Đơn đã quá hạn đổi trả")}>
      <div className="flex gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-orange-900">
        <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
        <p>
          {t("Đơn hàng đã vượt quá thời hạn đổi trả theo quy định (Quá 03 ngày). Thao tác yêu cầu phê duyệt của Quản lý cửa hàng.")}
          {' '}
          {t("Đơn {{so}} thanh toán lúc {{luc}}.", { so: don.soDonHang, luc: formatDateTime(don.thanhToanLuc) })}
        </p>
      </div>

      {!yeuCau ? (
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-bo-foreground">{t("Lý do phê duyệt ngoại lệ")}</legend>
          <div className="mt-2 space-y-1.5">
            {[...LY_DO_DUYET, KHAC].map((ld) => (
              <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50" key={ld}>
                <input checked={lyDoChon === ld} className="mt-0.5 accent-orange-600" name="ly-do-duyet" onChange={() => setLyDoChon(ld)} type="radio" />
                <span>{ld === KHAC ? t("Lý do khác") : t(ld)}</span>
              </label>
            ))}
          </div>
          {lyDoChon === KHAC ? (
            <textarea
              aria-label={t("Lý do khác")}
              autoFocus
              className="mt-2 h-16 w-full resize-none rounded-md border border-bo-border px-2.5 py-2 text-sm outline-none focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/20"
              maxLength={255}
              onChange={(e) => setLyDoKhac(e.target.value)}
              value={lyDoKhac}
            />
          ) : null}
          <p className="mt-3 text-xs text-bo-muted">
            {coQuyenDuyet
              ? t("Bạn có quyền quản lý cửa hàng nên duyệt được ngay; hệ thống ghi bạn là người duyệt.")
              : t("Mỗi quản lý cửa hàng nhận một mã 6 số riêng qua email, hiệu lực 10 phút. Nhờ quản lý đọc mã cho bạn.")}
          </p>
        </fieldset>
      ) : (
        <form className="mt-4" onSubmit={nhapMa}>
          <p className="text-sm text-bo-foreground">
            {t("Đã gửi mã tới: {{ten}}.", { ten: (yeuCau.nguoiNhan ?? []).join(', ') })}
            {' '}
            <span className="text-bo-muted">{t("Hiệu lực tới {{luc}}.", { luc: formatDateTime(yeuCau.hetHanLuc) })}</span>
          </p>
          <label className="mt-3 block text-sm font-medium" htmlFor="ma-duyet">{t("Mã PIN quản lý cửa hàng")}</label>
          <input
            autoComplete="one-time-code"
            className="mt-1 h-12 w-full rounded-md border border-bo-border text-center text-2xl font-semibold tracking-[0.5em] tabular-nums outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            id="ma-duyet"
            inputMode="numeric"
            maxLength={6}
            onChange={(e) => { setMa(e.target.value.replace(/\D/g, '').slice(0, 6)); setLoi(null); }}
            ref={maRef}
            value={ma}
          />
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-bo-muted">{t("Không nhận được mã?")}</span>
            <button className="font-medium text-bo-primary disabled:text-bo-muted" disabled={conCho > 0 || dangGui} onClick={guiMa} type="button">
              {conCho > 0 ? t("Gửi lại sau {{s}} giây", { s: conCho }) : t("Gửi lại mã")}
            </button>
          </div>
        </form>
      )}

      {loi ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{loi}</p> : null}
    </PosModal>
  );
}
