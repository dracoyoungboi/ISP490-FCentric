import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { History, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DUONG_DAN_CONG } from './phienCong';
import { taiLaiSoViec, useSoViec } from './useCongNcc';
import { t } from '@/i18n';

/**
 * Thanh tab dưới thanh trên của cổng: "Cần xử lý (số việc)" / "Lịch sử". Là liên kết (mở thẻ mới, Tab bàn phím được).
 * Chốt 26/11 (giữ đường kẻ ngăn với thanh trên): mỗi tab có biểu tượng, tab đang mở chữ xanh + gạch xanh bo tròn ở đáy,
 * tab khác rê chuột hiện nền xám nhạt; số việc trên ô xanh nhạt. Điện thoại: hai tab chia đôi bề ngang.
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
        { ma: 'can-xu-ly', ten: t("Cần xử lý"), dich: DUONG_DAN_CONG.canXuLy, dem: soViec, BieuTuong: Inbox },
        { ma: 'lich-su', ten: t("Lịch sử"), dich: DUONG_DAN_CONG.lichSu, dem: null, BieuTuong: History },
    ];

    return (
        <nav aria-label={t("Cổng nhà cung cấp")} className="shrink-0 border-b border-bo-border bg-bo-surface">
            {/* Lề 6px / 14px + lề trong 10px của mỗi tab = 16px / 24px: biểu tượng tab đầu thẳng mép trái logo */}
            <div className="mx-auto flex w-full max-w-[1600px] gap-1 px-1.5 md:px-3.5">
                {muc.map((m) => {
                    const { ma, ten, dich, dem, BieuTuong } = m;
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
                            className="group relative flex h-12 items-center focus-visible:outline-none max-md:flex-1 max-md:justify-center"
                        >
                            {/* Rê chuột: nền xám nhạt bo góc quanh chữ; vòng nhấn phím bàn phím cũng bao đúng phần này */}
                            <span
                                className={cn(
                                    'flex h-9 items-center gap-2 rounded-md px-2.5 text-sm transition-colors group-focus-visible:ring-2 group-focus-visible:ring-bo-primary/40 motion-reduce:transition-none',
                                    bat ? 'font-semibold text-bo-primary' : 'font-medium text-slate-600 group-hover:bg-slate-100 group-hover:text-bo-foreground',
                                )}
                            >
                                <BieuTuong className="size-4 shrink-0" aria-hidden="true" />
                                {ten}
                                {dem ? (
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                                            bat ? 'bg-bo-primary-soft text-bo-primary-strong' : 'bg-slate-100 text-slate-700',
                                        )}
                                    >
                                        {dem}
                                    </span>
                                ) : null}
                            </span>
                            {/* Gạch xanh bo tròn, dài bằng phần chữ, đè lên đường kẻ đáy thanh */}
                            {bat ? <span aria-hidden="true" className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-bo-primary" /> : null}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
