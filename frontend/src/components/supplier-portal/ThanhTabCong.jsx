import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { DUONG_DAN_CONG } from './phienCong';
import { taiLaiSoViec, useSoViec } from './useCongNcc';
import { t } from '@/i18n';

/**
 * Thanh tab dưới thanh trên của cổng: "Cần xử lý (số việc)" / "Lịch sử". Là liên kết (mở thẻ mới, Tab bàn phím được).
 * `tab`: tab đang mở ("can-xu-ly" | "lich-su" | null khi đang ở trang biên bản / báo giá).
 * `tuTaiSoViec`: tự gọi /viec-can-lam lấy số việc khi chưa có (trang Cần xử lý tự đặt số nên truyền false).
 * `onRoiTrang(dich)`: trả true nếu trang tự xử lý việc rời đi (vd. hỏi lại khi còn đơn giá chưa gửi).
 */
export default function ThanhTabCong({ tab, tuTaiSoViec = true, onRoiTrang }) {
    const soViec = useSoViec();

    useEffect(() => {
        if (tuTaiSoViec && soViec === undefined) taiLaiSoViec();
        // Chỉ tải một lần khi vào trang; số việc đổi thì trang gọi taiLaiSoViec
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tuTaiSoViec]);

    const muc = [
        { ma: 'can-xu-ly', ten: t("Cần xử lý"), dich: DUONG_DAN_CONG.canXuLy, dem: soViec },
        { ma: 'lich-su', ten: t("Lịch sử"), dich: DUONG_DAN_CONG.lichSu, dem: null },
    ];

    return (
        <nav aria-label={t("Cổng nhà cung cấp")} className="shrink-0 border-b border-bo-border bg-bo-surface">
            <div className="mx-auto flex w-full max-w-[1600px] gap-6 px-4 md:px-6">
                {muc.map(({ ma, ten, dich, dem }) => {
                    const bat = tab === ma;
                    return (
                        <Link
                            key={ma}
                            to={dich}
                            aria-current={bat ? 'page' : undefined}
                            aria-label={dem ? t("{{ten}}, {{count}} việc", { ten, count: dem }) : undefined}
                            onClick={(e) => {
                                if (!onRoiTrang || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                                if (onRoiTrang(dich)) e.preventDefault();
                            }}
                            className={cn(
                                '-mb-px flex h-11 items-center gap-2 border-b-2 text-sm font-semibold focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40 max-md:flex-1 max-md:justify-center',
                                bat ? 'border-bo-primary text-bo-primary' : 'border-transparent text-bo-muted hover:text-bo-foreground',
                            )}
                        >
                            {ten}
                            {dem ? (
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs tabular-nums',
                                        bat ? 'bg-bo-primary text-white' : 'bg-bo-surface-subtle text-bo-foreground',
                                    )}
                                >
                                    {dem}
                                </span>
                            ) : null}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
