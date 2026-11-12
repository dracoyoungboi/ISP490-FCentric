import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { DON_VI_VAN_HANH } from '@/constants/donViVanHanh';

// Màn cảm ứng: đệm dọc cho vùng chạm đủ 44px, bù bằng lề âm nên hai dòng chân trang không giãn (như liên kết chữ
// trong trang, index.css; chân trang nằm ngoài vùng nội dung nên không ăn quy tắc chung đó)
const LIEN_KET =
    'rounded-sm hover:text-bo-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 cam-ung:inline-block cam-ung:py-[calc((44px-1lh)/2)] cam-ung:-my-[calc((44px-1lh)/2)]';

/**
 * Chân trang ghi đơn vị vận hành (Shopee yêu cầu ở website khi duyệt ứng dụng), dùng ở các trang không cần đăng nhập.
 * Tiếng Anh chỉ dịch câu dẫn và nhãn mã số; tên "Hộ kinh doanh KAIZ" giữ đúng tên đăng ký.
 * Hai dòng theo nhóm: đơn vị + mã số, rồi hotline | email; đọc liền vẫn đúng câu đã nộp cho Shopee.
 * Cụm "(Mã số HKD …)", hotline, email không bị cắt giữa chừng khi xuống dòng.
 * `phanDau` (tùy chọn): nội dung đặt trên hai dòng đó, như ô chọn ngôn ngữ ở trang Đăng nhập.
 */
export default function ChanTrangVanHanh({ className, phanDau }) {
    const { banQuyen, ten, maSoHkd, hotline, email } = DON_VI_VAN_HANH;
    return (
        <footer className={cn('shrink-0 px-6 pt-4 pb-5 text-center text-xs leading-5 text-bo-muted', className)}>
            {phanDau ? <div className="mb-1.5">{phanDau}</div> : null}
            <p>
                {/* Tiếng Việt (mặc định) ra đúng nguyên văn đã nộp Shopee; tên đơn vị giữ nguyên ở mọi ngôn ngữ */}
                {t('{{banQuyen}} - Vận hành bởi {{ten}}', { banQuyen, ten })}{' '}
                <span className="whitespace-nowrap">{t('(Mã số HKD: {{maSoHkd}})', { maSoHkd })}</span>
            </p>
            <p>
                <span className="whitespace-nowrap">
                    Hotline:{' '}
                    <a href={`tel:${hotline}`} className={LIEN_KET}>
                        {hotline}
                    </a>
                </span>
                {/* Dấu cách nằm trong chữ để chép ra vẫn đúng " | "; lề nhỏ bù cho khoảng hở */}
                <span aria-hidden="true" className="mx-1 text-slate-300">
                    {' | '}
                </span>
                <span className="whitespace-nowrap">
                    Email:{' '}
                    <a href={`mailto:${email}`} className={LIEN_KET}>
                        {email}
                    </a>
                </span>
            </p>
        </footer>
    );
}
