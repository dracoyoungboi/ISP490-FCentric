import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { getApiErrorMessage } from '@/utils/apiError';
import { traHangService } from '@/services/traHangService';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import BienBanTraHang from '@/components/print/BienBanTraHang';
import '@/styles/print.css';
import { t } from "@/i18n";

/**
 * In "Biên bản trả hàng / đổi hàng" 02 liên (A5 dọc, mỗi liên một trang). Mở từ màn trả hàng sau khi xác nhận; tự
 * mở hộp in một lần khi tải xong.
 */
export default function PosReturnPrintPage() {
  const { id } = useParams();
  const [phieu, setPhieu] = useState(null);
  const [error, setError] = useState(null);
  const daIn = useRef(false);

  useEffect(() => {
    const ctrl = new AbortController();
    traHangService.phieu(id, { signal: ctrl.signal })
      .then(setPhieu)
      .catch((err) => { if (!ctrl.signal.aborted) setError(getApiErrorMessage(err, t("Không tải được biên bản trả hàng."))); });
    return () => ctrl.abort();
  }, [id]);

  useEffect(() => {
    if (!phieu || daIn.current) return undefined;
    daIn.current = true;
    document.title = phieu.soPhieu;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [phieu]);

  if (error) {
    return <div className="flex min-h-dvh items-center justify-center bg-white p-4"><ErrorState description={error} title={t("Không in được biên bản")} /></div>;
  }
  if (!phieu) {
    return <div className="flex min-h-dvh items-center justify-center bg-white p-4"><LoadingState label={t("Đang tải biên bản")} /></div>;
  }

  return (
    <div className="min-h-dvh bg-slate-100 py-4 print:bg-white print:py-0">
      <style>{'@media print { @page { size: A5 portrait; margin: 8mm; } .lien-bien-ban { box-shadow: none !important; margin: 0 !important; } .lien-bien-ban + .lien-bien-ban { break-before: page; } }'}</style>
      <div className="no-print mx-auto mb-3 flex max-w-[148mm] items-center justify-between gap-2 px-2">
        <p className="text-sm text-slate-600">{t("Biên bản {{so}} · 02 liên", { so: phieu.soPhieu })}</p>
        <button
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-bo-primary px-3 text-sm font-semibold text-white hover:bg-bo-primary-hover"
          onClick={() => window.print()}
          type="button"
        >
          <Printer aria-hidden="true" size={16} />
          {t("In 02 liên")}
        </button>
      </div>
      {[1, 2].map((lien) => (
        <div className="lien-bien-ban mx-auto mb-4 w-full max-w-[148mm] bg-white p-[8mm] shadow" key={lien}>
          <BienBanTraHang lien={lien} phieu={phieu} />
        </div>
      ))}
    </div>
  );
}
