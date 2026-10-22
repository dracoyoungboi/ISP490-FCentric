import { Info } from 'lucide-react';
import { formatDate } from '@/utils/formatters';

const LINK = 'text-bo-primary hover:underline break-words';

const soGoi = (sdt) => sdt.replace(/[^\d+]/g, '');

function thongTin(orderData) {
    const kho = orderData?.khoNhap;
    const nguoi = orderData?.nguoiTao;
    return {
        tenKho: kho?.tenKho || '—',
        diaChiKho: kho?.diaChi || '',
        hoTen: nguoi?.hoTen || '—',
        soDienThoai: String(nguoi?.soDienThoai ?? '').trim(),
        email: nguoi?.email || '',
    };
}

/** "Cần giao trước 18/10/2026" — ngày tô màu cam để nhà cung cấp chú ý. */
export function CanGiaoTruoc({ ngay, className }) {
    return (
        <span className={className}>
            Cần giao trước <strong className="font-semibold text-bo-warning tabular-nums">{formatDate(ngay)}</strong>
        </span>
    );
}

/** Dòng thông tin đơn ngay dưới tiêu đề trang (từ 768px): ngày cần giao, kho nhận, người phụ trách, ngày đặt. */
export function DongThongTinDon({ orderData }) {
    const tt = thongTin(orderData);
    return (
        <p className="m-0 hidden flex-wrap gap-x-[18px] gap-y-1 text-sm leading-6 text-slate-600 md:flex">
            <CanGiaoTruoc ngay={orderData?.ngayGiaoDuKien} />
            <span>
                Kho nhận <strong className="font-semibold text-bo-foreground">{tt.tenKho}</strong>
                {tt.diaChiKho && ` · ${tt.diaChiKho}`}
            </span>
            <span>
                Phụ trách <strong className="font-semibold text-bo-foreground">{tt.hoTen}</strong>
                {tt.soDienThoai && (
                    <>
                        {' · '}
                        <a href={`tel:${soGoi(tt.soDienThoai)}`} className={LINK}>{tt.soDienThoai}</a>
                    </>
                )}
                {tt.email && (
                    <>
                        {' · '}
                        <a href={`mailto:${tt.email}`} className={LINK}>{tt.email}</a>
                    </>
                )}
            </span>
            <span>Đặt ngày {formatDate(orderData?.ngayDatHang)}</span>
        </p>
    );
}

/** "Ghi chú từ {tên cửa hàng}:" — chưa biết tên cửa hàng thì "Ghi chú:". */
const nhanGhiChu = (tenCuaHang) => (tenCuaHang ? `Ghi chú từ ${tenCuaHang}:` : 'Ghi chú:');

/**
 * Phần thông tin đơn dưới tiêu đề:
 * - từ 768px: chỉ còn khung ghi chú của cửa hàng (nếu có); các thông tin khác nằm ở DongThongTinDon;
 * - dưới 768px: một thẻ gọn gồm kho nhận, người phụ trách (Gọi · Email), ngày đặt và ghi chú của cửa hàng.
 * `tenCuaHang`: `cuaHang.ten` máy chủ trả ở bước xác nhận mã (có thể rỗng).
 */
export default function ThongTinDonMua({ orderData, tenCuaHang }) {
    const tt = thongTin(orderData);
    const ghiChu = orderData?.ghiChu;

    return (
        <>
            {ghiChu && (
                <div role="note" className="hidden items-start gap-2 rounded-lg border border-bo-border bg-white px-3.5 py-2.5 text-sm leading-5 text-slate-700 md:flex">
                    <Info className="mt-0.5 size-4 shrink-0 text-bo-muted" aria-hidden="true" />
                    <span className="min-w-0 whitespace-pre-line break-words">
                        <strong className="font-semibold">{nhanGhiChu(tenCuaHang)}</strong> {ghiChu}
                    </span>
                </div>
            )}

            <section aria-label="Thông tin đơn mua hàng" className="flex flex-col gap-1.5 rounded-lg border border-bo-border bg-white px-3.5 py-3 text-[13px] leading-5 text-slate-700 md:hidden">
                <div className="break-words">
                    <span className="text-bo-muted">Kho nhận</span> <strong className="font-semibold text-bo-foreground">{tt.tenKho}</strong>
                    {tt.diaChiKho && ` · ${tt.diaChiKho}`}
                </div>
                <div className="break-words">
                    <span className="text-bo-muted">Phụ trách</span> <strong className="font-semibold text-bo-foreground">{tt.hoTen}</strong>
                    {tt.soDienThoai && (
                        <>
                            {' · '}
                            <a href={`tel:${soGoi(tt.soDienThoai)}`} aria-label={`Gọi ${tt.soDienThoai}`} className={LINK}>Gọi</a>
                        </>
                    )}
                    {tt.email && (
                        <>
                            {' · '}
                            <a href={`mailto:${tt.email}`} aria-label={`Gửi email tới ${tt.email}`} className={LINK}>Email</a>
                        </>
                    )}
                </div>
                <div>
                    <span className="text-bo-muted">Đặt ngày</span> <span className="tabular-nums">{formatDate(orderData?.ngayDatHang)}</span>
                </div>
                {ghiChu && (
                    <div className="mt-1 border-t border-bo-border pt-2 whitespace-pre-line break-words">
                        <strong className="font-semibold">{nhanGhiChu(tenCuaHang)}</strong> {ghiChu}
                    </div>
                )}
            </section>
        </>
    );
}
