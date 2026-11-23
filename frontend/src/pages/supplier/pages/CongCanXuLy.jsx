import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, ChevronRight, Inbox, PackageX, Receipt, Undo2, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import KhungCongNhaCungCap from '@/components/supplier-portal/KhungCongNhaCungCap';
import TheNguoiPhuTrach from '@/components/supplier-portal/TheNguoiPhuTrach';
import { KhungLoiTai, KhungXuongCong } from '@/components/supplier-portal/TrangThaiTaiCong';
import { demViec, tiLePhanTram } from '@/components/supplier-portal/congUtils';
import { xuLyLoiTai } from '@/components/supplier-portal/loiCong';
import { DUONG_DAN_CONG, duongDanBaoGia, duongDanBienBan } from '@/components/supplier-portal/phienCong';
import { datSoViec, useCongNcc, useTieuDeCong } from '@/components/supplier-portal/useCongNcc';
import congNhaCungCapService from '@/services/congNhaCungCapService';
import useTaiDuLieu from '@/hooks/useTaiDuLieu';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate, formatNumber } from '@/utils/formatters';
import { t, tDuLieu } from '@/i18n';

const THE = 'rounded-lg border border-bo-border bg-bo-surface';
const TIEU_DE_TRANG = 'text-xl leading-7 font-bold tracking-tight text-bo-heading md:text-2xl md:leading-8';
const LIEN_KET_FOCUS = 'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40';

/**
 * Cổng nhà cung cấp · Cần xử lý (/supplier/portal): biên bản hàng lỗi chờ chọn cách xử lý (xếp trước), đơn chờ báo giá;
 * cột phải số liệu 30 ngày qua và người phụ trách mua hàng. Dữ liệu: GET /cong-ncc/viec-can-lam.
 */
export default function CongCanXuLy() {
    const { phien, hetPhien, thoat } = useCongNcc();
    const { data, error, reload } = useTaiDuLieu(() => congNhaCungCapService.viecCanLam(), 'viec-can-lam', { enabled: Boolean(phien) });
    const loiTai = error ? xuLyLoiTai(error) : null;
    const tai = data ? { trangThai: 'xong' } : loiTai ? { trangThai: 'loi', cau: loiTai.cau } : { trangThai: 'dang-tai' };

    useTieuDeCong(t("Cần xử lý"));

    useEffect(() => {
        if (data) datSoViec(demViec(data));
    }, [data]);
    useEffect(() => {
        if (loiTai?.loai === 'phien-het-han') hetPhien();
    }, [loiTai?.loai, hetPhien]);

    if (!phien) return null;

    const viec = data ?? {};
    const bienBanCho = viec.bienBanCho ?? [];
    const donChoBaoGia = viec.donChoBaoGia ?? [];
    const soViec = demViec(viec);
    const tenNcc = viec.nhaCungCap?.ten || phien.nhaCungCap?.ten;
    const emailNcc = viec.nhaCungCap?.email || phien.nhaCungCap?.email;

    return (
        <KhungCongNhaCungCap tenNhaCungCap={tenNcc} email={emailNcc} onThoat={thoat} tab="can-xu-ly" tuTaiSoViec={false}>
            <main className="mx-auto grid w-full max-w-[1600px] flex-1 content-start gap-5 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="flex min-w-0 flex-col gap-5">
                    <div className="flex flex-col gap-1">
                        <h1 className={TIEU_DE_TRANG}>{t("Việc cần Quý công ty xử lý")}</h1>
                        {tai.trangThai === 'xong' && soViec > 0 ? (
                            <p className="text-sm text-slate-600">
                                {bienBanCho.length > 0
                                    ? t("{{count}} việc · biên bản hàng lỗi chờ trả lời được xếp trước", { count: soViec })
                                    : t("{{count}} việc", { count: soViec })}
                            </p>
                        ) : null}
                    </div>

                    {tai.trangThai === 'dang-tai' ? (
                        <KhungXuongCong kieu="trang" />
                    ) : tai.trangThai === 'loi' ? (
                        <KhungLoiTai cau={tai.cau} onThuLai={reload} />
                    ) : soViec === 0 ? (
                        <KhongCoViec />
                    ) : (
                        <>
                            {bienBanCho.length > 0 ? <TheBienBanCho ds={bienBanCho} /> : null}
                            {donChoBaoGia.length > 0 ? <TheDonChoBaoGia ds={donChoBaoGia} /> : null}
                        </>
                    )}
                </div>

                {tai.trangThai === 'xong' ? (
                    <aside className="flex min-w-0 flex-col gap-5">
                        <TheSoLieu soLieu={viec.soLieu30Ngay} />
                        {viec.nguoiPhuTrach ? <TheNguoiPhuTrach nguoi={viec.nguoiPhuTrach} /> : null}
                    </aside>
                ) : null}
            </main>
        </KhungCongNhaCungCap>
    );
}

function KhongCoViec() {
    return (
        <section className={cn(THE, 'flex flex-col items-center gap-3 px-6 py-12 text-center')}>
            <span className="grid size-11 place-items-center rounded-full bg-bo-success-soft text-bo-success">
                <Inbox className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-base font-semibold text-bo-heading">{t("Không có việc nào cần xử lý")}</h2>
            <p className="max-w-md text-sm leading-[22px] text-slate-600">
                {t("Khi chúng tôi gửi yêu cầu báo giá hoặc lập biên bản hàng lỗi, việc sẽ hiện ở đây và Quý công ty nhận email báo. Báo giá đã gửi và biên bản đã trả lời xem ở Lịch sử.")}
            </p>
            <Button asChild variant="outline" className="mt-1 h-10 gap-1.5 border-bo-border bg-bo-surface px-4 text-bo-foreground hover:bg-bo-surface-subtle">
                <Link to={DUONG_DAN_CONG.lichSu}>
                    {t("Xem lịch sử")} <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
            </Button>
        </section>
    );
}

function TieuDeThe({ icon, mau, ten, dem, moTa, id }) {
    const Icon = icon;
    return (
        <div className="flex items-start gap-3 border-b border-bo-border px-4 py-3.5 md:px-5">
            <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-md', mau === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-bo-primary-soft text-bo-primary')}>
                <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
                <h2 id={id} className="flex items-center gap-2 text-[15px] font-semibold text-bo-heading">
                    {ten}
                    <span className="rounded-full bg-bo-surface-subtle px-2 text-xs leading-5 font-semibold tabular-nums text-bo-foreground">{dem}</span>
                </h2>
                {moTa ? <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">{moTa}</p> : null}
            </div>
        </div>
    );
}

/** Hàng lỗi của biên bản đang ở đâu (một dòng dưới số liệu). `moTa` máy chủ ghép sẵn (tên kho / người nhận). */
function DongHangLoi({ hangLoi }) {
    const moTa = String(hangLoi?.moTa ?? '').trim();
    let Icon = Warehouse;
    let chu;
    if (hangLoi?.trangThai === 'DA_TRA') {
        Icon = Undo2;
        chu = moTa ? t("Đã giao {{nguoiNhan}}", { nguoiNhan: tDuLieu(moTa) }) : t("Đã trả hàng lỗi cho Quý công ty");
    } else if (hangLoi?.trangThai === 'DA_TIEU_HUY') {
        Icon = PackageX;
        chu = t("Hàng lỗi đã tiêu hủy");
    } else {
        chu = moTa ? t("Đang ở {{kho}}", { kho: tDuLieu(moTa) }) : t("Đang ở kho của chúng tôi");
    }
    return (
        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-bo-muted">
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{chu}</span>
        </p>
    );
}

function TheBienBanCho({ ds }) {
    // Mốc so hạn trả lời: lấy một lần khi dựng thẻ (không gọi đồng hồ mỗi lần vẽ)
    const [bayGio] = useState(() => Date.now());
    return (
        <section aria-labelledby="cong-bb-cho" className={THE}>
            <TieuDeThe
                id="cong-bb-cho"
                icon={PackageX}
                mau="warning"
                ten={t("Biên bản hàng lỗi chờ trả lời")}
                dem={ds.length}
                moTa={t("Chọn giao bù hay trừ tiền, và nhận lại hay đồng ý tiêu hủy hàng lỗi. Quá hạn chưa chọn cách bù, chúng tôi trừ tiền hàng.")}
            />
            <ul className="divide-y divide-bo-border">
                {ds.map((bb) => {
                    const conLaiMs = bb.hanTraLoi ? new Date(bb.hanTraLoi).getTime() - bayGio : null;
                    const quaHanTraLoi = conLaiMs != null && conLaiMs < 0;
                    // Còn từ 2 ngày trở xuống: tô đỏ
                    const gap = conLaiMs != null && conLaiMs <= 2 * 86400e3;
                    return (
                        <li key={bb.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:gap-5 md:px-5">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="text-[15px] font-semibold break-all text-bo-heading">{bb.soBienBan}</span>
                                    {bb.hanTraLoi ? (
                                        <span className={cn('inline-flex items-center gap-1 text-[13px] font-medium', gap ? 'text-bo-danger' : 'text-bo-warning')}>
                                            <CalendarClock className="size-3.5" aria-hidden="true" />
                                            {quaHanTraLoi
                                                ? t("Quá hạn trả lời")
                                                : t("Trả lời trước hết ngày {{ngay}}", { ngay: formatDate(bb.hanTraLoi) })}
                                        </span>
                                    ) : null}
                                </div>
                                <p className="mt-1 text-sm text-slate-700">
                                    <strong className="font-semibold tabular-nums">{t("{{count}} sản phẩm lỗi", { count: Number(bb.tongSoLuong) || 0 })}</strong>
                                    <span className="text-bo-muted"> · {t("giá trị")} </span>
                                    <span className="tabular-nums">{formatCurrency(bb.tongGiaTri)}</span>
                                    {bb.soDonMua ? (
                                        <>
                                            <span className="text-bo-muted"> · </span>
                                            <span className="break-all">{t("đơn {{soDon}}", { soDon: bb.soDonMua })}</span>
                                        </>
                                    ) : null}
                                </p>
                                <DongHangLoi hangLoi={bb.hangLoi} />
                            </div>
                            <Button asChild className="h-10 gap-2 bg-bo-primary px-4 text-white hover:bg-bo-primary-hover max-md:w-full">
                                <Link to={duongDanBienBan(bb.id)} aria-label={t("Trả lời biên bản {{so}}", { so: bb.soBienBan })}>
                                    {t("Trả lời")} <ArrowRight className="size-4" aria-hidden="true" />
                                </Link>
                            </Button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

function TheDonChoBaoGia({ ds }) {
    return (
        <section aria-labelledby="cong-don-cho" className={THE}>
            <TieuDeThe id="cong-don-cho" icon={Receipt} mau="primary" ten={t("Đơn chờ báo giá")} dem={ds.length} />
            <ul className="divide-y divide-bo-border">
                {ds.map((d) => (
                    <li key={d.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:gap-5 md:px-5">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="text-[15px] font-semibold break-all text-bo-heading">{d.soDonMua}</span>
                                <StatusBadge quyTrinh="yeuCauBaoGia" label="Chờ báo giá" />
                            </div>
                            <p className="mt-1 text-sm text-slate-700">
                                {t("{{soMatHang}} mặt hàng · {{soLuong}} sản phẩm", {
                                    soMatHang: formatNumber(d.soMatHang),
                                    soLuong: formatNumber(d.tongSoLuong),
                                })}
                                {d.tenKho ? <> · {t("giao tại {{kho}}", { kho: tDuLieu(d.tenKho) })}</> : null}
                            </p>
                            <p className="mt-0.5 text-[13px] text-bo-muted">
                                {d.ngayCanGiao ? (
                                    <>
                                        {t("Cần giao trước")}{' '}
                                        <strong className="font-semibold text-bo-warning tabular-nums">{formatDate(d.ngayCanGiao)}</strong>
                                        {d.ngayGuiYeuCau ? ' · ' : null}
                                    </>
                                ) : null}
                                {d.ngayGuiYeuCau ? t("yêu cầu ngày {{ngay}}", { ngay: formatDate(d.ngayGuiYeuCau) }) : null}
                            </p>
                        </div>
                        <Button asChild variant="outline" className="h-10 gap-2 border-bo-border bg-bo-surface px-4 text-bo-foreground hover:bg-bo-surface-subtle max-md:w-full">
                            <Link to={duongDanBaoGia(d.id)} aria-label={t("Báo giá đơn {{soDon}}", { soDon: d.soDonMua })}>
                                {t("Báo giá", { context: "nut" })} <ArrowRight className="size-4" aria-hidden="true" />
                            </Link>
                        </Button>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function O({ nhan, giaTri, phu }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-bo-muted">{nhan}</dt>
            <dd className="mt-0.5 text-lg leading-6 font-bold tabular-nums text-bo-heading">{giaTri}</dd>
            {phu ? <dd className="text-xs text-bo-muted">{phu}</dd> : null}
        </div>
    );
}

function TheSoLieu({ soLieu }) {
    const sl = soLieu ?? {};
    return (
        <section aria-labelledby="cong-30-ngay" className={cn(THE, 'p-4 md:p-5')}>
            <h2 id="cong-30-ngay" className="text-sm font-semibold text-bo-heading">{t("30 ngày qua")}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4">
                <O nhan={t("Báo giá đã gửi")} giaTri={formatNumber(sl.baoGiaDaGui)} />
                <O nhan={t("Được chấp nhận")} giaTri={formatNumber(sl.duocChapNhan)} phu={tiLePhanTram(sl.duocChapNhan, sl.baoGiaDaGui)} />
                <O nhan={t("Sản phẩm lỗi")} giaTri={formatNumber(sl.sanPhamLoi)} />
                <O nhan={t("Đã trừ tiền")} giaTri={formatCurrency(sl.tienTru)} />
            </dl>
            <Link to={DUONG_DAN_CONG.lichSu} className={cn('mt-4 inline-flex items-center gap-1 text-sm font-medium text-bo-primary hover:underline', LIEN_KET_FOCUS)}>
                {t("Xem lịch sử")} <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
        </section>
    );
}
