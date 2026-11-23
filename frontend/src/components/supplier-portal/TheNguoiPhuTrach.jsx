import { Mail, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';

const LIEN_KET_FOCUS = 'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40';
const soGoi = (sdt) => String(sdt ?? '').replace(/[^\d+]/g, '');

/** Thẻ "Người phụ trách mua hàng" của cổng nhà cung cấp (tên, gọi, email). Máy chủ trả null thì trang không vẽ thẻ. */
export default function TheNguoiPhuTrach({ nguoi, className }) {
    const sdt = String(nguoi?.soDienThoai ?? '').trim();
    const email = String(nguoi?.email ?? '').trim();
    return (
        <section aria-labelledby="cong-phu-trach" className={cn('rounded-lg border border-bo-border bg-bo-surface p-4 md:p-5', className)}>
            <h2 id="cong-phu-trach" className="text-sm font-semibold text-bo-heading">{t("Người phụ trách mua hàng")}</h2>
            {nguoi?.hoTen ? <p className="mt-2 text-sm font-medium text-bo-foreground">{nguoi.hoTen}</p> : null}
            {sdt || email ? (
                <div className="mt-2 flex flex-col items-start gap-1.5 text-sm">
                    {sdt ? (
                        <a href={`tel:${soGoi(sdt)}`} className={cn('inline-flex items-center gap-2 text-bo-primary hover:underline', LIEN_KET_FOCUS)}>
                            <Phone className="size-4" aria-hidden="true" /> {sdt}
                        </a>
                    ) : null}
                    {email ? (
                        <a href={`mailto:${email}`} className={cn('inline-flex min-w-0 items-center gap-2 break-all text-bo-primary hover:underline', LIEN_KET_FOCUS)}>
                            <Mail className="size-4 shrink-0" aria-hidden="true" /> {email}
                        </a>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}
