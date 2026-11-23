import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, FileQuestion, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DUONG_DAN_CONG } from './phienCong';
import { t } from '@/i18n';

/** Trạng thái tải dùng chung của các trang trong cổng nhà cung cấp: khung xương, lỗi tải (Thử lại), không tìm thấy. */

const KHOI = 'animate-pulse rounded-md bg-slate-200/70 motion-reduce:animate-none';

/** Khung xương nhẹ, chỉ hiện khi tải quá 200ms (tải nhanh thì không nháy). `kieu`: "trang" | "bang". */
export function KhungXuongCong({ kieu = 'trang', className }) {
    const [hien, setHien] = useState(false);
    useEffect(() => {
        const hen = setTimeout(() => setHien(true), 200);
        return () => clearTimeout(hen);
    }, []);

    return (
        <div role="status" aria-live="polite" className={cn('flex flex-col gap-4', className)}>
            <span className="sr-only">{t("Đang tải...")}</span>
            {hien ? (
                kieu === 'bang' ? (
                    <div aria-hidden="true" className="flex flex-col divide-y divide-bo-border">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center gap-4 px-4 py-4 md:px-5">
                                <div className={cn(KHOI, 'h-4 w-36')} />
                                <div className={cn(KHOI, 'hidden h-4 w-24 md:block')} />
                                <div className={cn(KHOI, 'ml-auto h-4 w-20')} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div aria-hidden="true" className="flex flex-col gap-4">
                        <div className={cn(KHOI, 'h-7 w-72 max-w-full')} />
                        <div className={cn(KHOI, 'h-4 w-96 max-w-full')} />
                        <div className="rounded-lg border border-bo-border bg-bo-surface p-4 md:p-5">
                            <div className="flex flex-col gap-4">
                                {[0, 1, 2].map((i) => (
                                    <div key={i} className="flex flex-col gap-2">
                                        <div className={cn(KHOI, 'h-4 w-48 max-w-full')} />
                                        <div className={cn(KHOI, 'h-3.5 w-80 max-w-full')} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            ) : null}
        </div>
    );
}

/** Lỗi tải: câu lỗi + nút Thử lại. */
export function KhungLoiTai({ cau, onThuLai, className }) {
    return (
        <div role="alert" className={cn('flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-bo-danger-soft px-4 py-3.5 text-sm leading-5 text-bo-danger-strong sm:flex-row sm:items-center', className)}>
            <span className="flex min-w-0 flex-1 items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{cau}</span>
            </span>
            <Button type="button" variant="outline" onClick={onThuLai} className="h-10 gap-2 border-red-200 bg-white text-bo-danger-strong hover:bg-red-50 max-sm:w-full">
                <RotateCcw className="size-4" aria-hidden="true" />
                {t("Thử lại")}
            </Button>
        </div>
    );
}

/** Đơn / biên bản không thuộc Quý công ty (hoặc liên kết sai): nói rõ và đưa về Cần xử lý. */
export function KhungKhongTimThay({ tieuDe, moTa }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-bo-border bg-bo-surface px-6 py-12 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-bo-surface-subtle text-bo-muted">
                <FileQuestion className="size-5" aria-hidden="true" />
            </span>
            <h1 className="text-lg font-semibold text-bo-heading">{tieuDe}</h1>
            <p className="max-w-md text-sm leading-[22px] text-slate-600">{moTa}</p>
            <Button asChild className="mt-1 h-10 bg-bo-primary px-4 text-white hover:bg-bo-primary-hover">
                <Link to={DUONG_DAN_CONG.canXuLy}>{t("Về Cần xử lý")}</Link>
            </Button>
        </div>
    );
}
