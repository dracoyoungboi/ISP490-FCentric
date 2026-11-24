import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Inbox, Search, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import KhungCongNhaCungCap from '@/components/supplier-portal/KhungCongNhaCungCap';
import { KhungLoiTai, KhungXuongCong } from '@/components/supplier-portal/TrangThaiTaiCong';
import {
    KHOANG_LICH_SU,
    cachXuLyLichSu,
    nhanHangLoi,
    chuanHoaKhoang,
    tenKhoang,
    tuNgayTheoKhoang,
} from '@/components/supplier-portal/congUtils';
import { xuLyLoiTai } from '@/components/supplier-portal/loiCong';
import { NHAN_KET_QUA_BAO_GIA } from '@/constants/congNhaCungCap';
import { duongDanBaoGia, duongDanBienBan } from '@/components/supplier-portal/phienCong';
import { useCongNcc, useTieuDeCong } from '@/components/supplier-portal/useCongNcc';
import congNhaCungCapService from '@/services/congNhaCungCapService';
import useTaiDuLieu from '@/hooks/useTaiDuLieu';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate, formatNumber } from '@/utils/formatters';
import { t } from '@/i18n';

const THE = 'rounded-lg border border-bo-border bg-bo-surface';
const TIEU_DE_COT = 'h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted';
const LIEN_KET_O = 'rounded-sm font-semibold text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40';
const TRE_TIM = 300;

/** Đổi vài tham số trên địa chỉ (null / rỗng: bỏ tham số), giữ các tham số khác. */
function datThamSo(thamSo, moi) {
    const ts = new URLSearchParams(thamSo);
    for (const [k, v] of Object.entries(moi)) {
        if (v === null || v === '' || v === undefined) ts.delete(k);
        else ts.set(k, v);
    }
    return ts;
}

const chuanHoaLichSu = (kq) => ({ items: Array.isArray(kq?.items) ? kq.items : [], tomTat: kq?.tomTat ?? {} });

async function taiLichSu(khoang, tuKhoa) {
    const thamSo = { tuNgay: tuNgayTheoKhoang(khoang), tuKhoa };
    const [baoGia, traHang] = await Promise.all([
        congNhaCungCapService.lichSuBaoGia(thamSo),
        congNhaCungCapService.lichSuTraHang(thamSo),
    ]);
    return { baoGia: chuanHoaLichSu(baoGia), traHang: chuanHoaLichSu(traHang) };
}

const CAC_THE = [
    { ma: 'bao-gia', ten: () => t("Báo giá", { context: "the" }) },
    { ma: 'tra-hang', ten: () => t("Hàng lỗi trả lại") },
];

/**
 * Cổng nhà cung cấp · Lịch sử (/supplier/portal/history?the=bao-gia|tra-hang&khoang=1|6|12&q=):
 * hai thẻ Báo giá / Hàng lỗi trả lại, ô tìm (gõ là lọc, chờ 300ms), khoảng thời gian, dải 4 số tóm tắt, bảng (máy tính)
 * hoặc thẻ (điện thoại). Bấm dòng báo giá → trang báo giá đơn đó; bấm dòng biên bản → trang biên bản.
 */
export default function CongLichSu() {
    const { phien, hetPhien, thoat } = useCongNcc();
    const navigate = useNavigate();
    const [thamSo, setThamSo] = useSearchParams();
    const the = thamSo.get('the') === 'tra-hang' ? 'tra-hang' : 'bao-gia';
    const khoang = chuanHoaKhoang(thamSo.get('khoang'));
    const tuKhoa = thamSo.get('q') ?? '';
    const [oTim, setOTim] = useState(tuKhoa);
    // Ô tìm theo ?q hai chiều: ?q đổi từ ngoài (bấm tab Lịch sử trên thanh trên, Quay lại…) thì ô đổi theo, không ghi
    // từ khóa cũ trở lại. Chỉnh state ngay lúc vẽ (cách React khuyên) để hiệu ứng chờ gõ bên dưới thấy giá trị mới.
    const [qDaThay, setQDaThay] = useState(tuKhoa);
    if (qDaThay !== tuKhoa) {
        setQDaThay(tuKhoa);
        if (oTim.trim() !== tuKhoa.trim()) setOTim(tuKhoa);
    }
    // Tải cả hai thẻ một lần (cùng khoảng thời gian và từ khóa): đổi thẻ không phải chờ, và thẻ nào cũng có số kết quả
    const { data, error, loading, dungKhoa, reload } = useTaiDuLieu(
        () => taiLichSu(khoang, tuKhoa),
        `${khoang}|${tuKhoa.trim()}`,
        { enabled: Boolean(phien) },
    );
    const loiTai = error ? xuLyLoiTai(error) : null;
    const duLieu = data ? (the === 'tra-hang' ? data.traHang : data.baoGia) : null;

    useTieuDeCong(t("Lịch sử"));

    useEffect(() => {
        if (loiTai?.loai === 'phien-het-han') hetPhien();
    }, [loiTai?.loai, hetPhien]);

    // Gõ là lọc: chờ 300ms sau phím cuối mới đổi từ khóa trên địa chỉ (và gọi máy chủ)
    useEffect(() => {
        if (oTim.trim() === tuKhoa.trim()) return undefined;
        const hen = setTimeout(() => setThamSo(datThamSo(thamSo, { q: oTim.trim() || null }), { replace: true }), TRE_TIM);
        return () => clearTimeout(hen);
    }, [oTim, tuKhoa, thamSo, setThamSo]);

    const doiThamSo = (moi) => setThamSo(datThamSo(thamSo, moi), { replace: true });
    const demThe = { 'bao-gia': data?.baoGia.items.length ?? null, 'tra-hang': data?.traHang.items.length ?? null };

    if (!phien) return null;
    const traHang = the === 'tra-hang';
    const dangLoc = Boolean(tuKhoa.trim());

    return (
        <KhungCongNhaCungCap tenNhaCungCap={phien.nhaCungCap?.ten} email={phien.nhaCungCap?.email} onThoat={thoat} tab="lich-su">
            <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 md:gap-5 md:p-6">
                <div className="flex flex-col gap-1">
                    <h1 className="text-xl leading-7 font-bold tracking-tight text-bo-heading md:text-2xl md:leading-8">{t("Lịch sử")}</h1>
                    <p className="text-sm text-slate-600">{t("Các đơn Quý công ty đã báo giá và biên bản hàng lỗi chúng tôi đã lập.")}</p>
                </div>

                <section className={cn(THE, 'overflow-hidden')}>
                    <div className="flex flex-col gap-3 border-b border-bo-border px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
                        <div role="tablist" aria-label={t("Loại lịch sử")} className="inline-flex w-full rounded-lg bg-bo-surface-subtle p-1 md:w-auto">
                            {CAC_THE.map(({ ma, ten }) => {
                                const bat = the === ma;
                                return (
                                    <button
                                        key={ma}
                                        type="button"
                                        role="tab"
                                        id={`ls-the-${ma}`}
                                        aria-selected={bat}
                                        aria-controls="ls-noi-dung"
                                        onClick={() => {
                                            if (!bat) doiThamSo({ the: ma === 'tra-hang' ? ma : null });
                                        }}
                                        className={cn(
                                            'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-3.5 text-sm font-semibold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40 md:flex-none',
                                            bat ? 'bg-bo-surface text-bo-heading shadow-sm' : 'text-bo-muted hover:text-bo-foreground',
                                        )}
                                    >
                                        {ten()}
                                        {demThe[ma] != null ? <span className="text-xs font-medium tabular-nums text-bo-muted">{demThe[ma]}</span> : null}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <label className="relative block sm:w-[280px]">
                                <span className="sr-only">{traHang ? t("Tìm mã biên bản, mã đơn") : t("Tìm mã đơn mua")}</span>
                                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-bo-muted" aria-hidden="true" />
                                <input
                                    type="search"
                                    value={oTim}
                                    onChange={(e) => setOTim(e.target.value)}
                                    placeholder={traHang ? t("Tìm mã biên bản, mã đơn") : t("Tìm mã đơn mua")}
                                    maxLength={100}
                                    className="h-10 w-full rounded-md border border-bo-border bg-bo-surface pr-3 pl-9 text-base placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-2 focus-visible:ring-bo-primary/15 focus-visible:outline-none sm:h-9 md:text-sm"
                                />
                            </label>
                            <select
                                value={khoang}
                                aria-label={t("Khoảng thời gian")}
                                onChange={(e) => doiThamSo({ khoang: e.target.value === '6' ? null : e.target.value })}
                                className="h-10 rounded-md border border-bo-border bg-bo-surface px-3 text-base text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-2 focus-visible:ring-bo-primary/15 focus-visible:outline-none sm:h-9 sm:w-[180px] md:text-sm"
                            >
                                {KHOANG_LICH_SU.map((k) => (
                                    <option key={k} value={k}>{tenKhoang(k)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div
                        id="ls-noi-dung"
                        role="tabpanel"
                        aria-labelledby={`ls-the-${the}`}
                        aria-busy={loading || undefined}
                        className={cn('transition-opacity', loading && !dungKhoa && duLieu && 'opacity-60')}
                    >
                        {/* Lỗi của lần tải theo bộ lọc đang chọn: báo lỗi, không để bảng của bộ lọc cũ như thể là kết quả */}
                        {loiTai && (!duLieu || !dungKhoa) ? (
                            <div className="p-4 md:p-5">
                                <KhungLoiTai cau={loiTai.cau} onThuLai={reload} />
                            </div>
                        ) : !duLieu ? (
                            <KhungXuongCong kieu="bang" />
                        ) : (
                            <>
                                <DaiSo traHang={traHang} tomTat={duLieu.tomTat} />
                                {duLieu.items.length === 0 ? (
                                    <Rong
                                        dangLoc={dangLoc}
                                        traHang={traHang}
                                        khoang={khoang}
                                        onBoLoc={() => {
                                            setOTim('');
                                            doiThamSo({ q: null });
                                        }}
                                        onMoRong={khoang !== '12' ? () => doiThamSo({ khoang: '12' }) : null}
                                    />
                                ) : traHang ? (
                                    <BangTraHang ds={duLieu.items} onMo={(id) => navigate(duongDanBienBan(id))} />
                                ) : (
                                    <BangBaoGia ds={duLieu.items} onMo={(id) => navigate(duongDanBaoGia(id))} />
                                )}
                                <ChanBang tong={duLieu.items.length} khoang={khoang} tenNcc={phien.nhaCungCap?.ten} />
                            </>
                        )}
                    </div>
                </section>
            </main>
        </KhungCongNhaCungCap>
    );
}

function DaiSo({ traHang, tomTat }) {
    const tt = tomTat ?? {};
    const o = traHang
        ? [
              [t("Biên bản"), formatNumber(tt.bienBan)],
              [t("Sản phẩm lỗi"), formatNumber(tt.sanPhamLoi)],
              [t("Đã trừ tiền"), formatCurrency(tt.tienTru)],
              [t("Chờ bạn chọn"), formatNumber(tt.choChon), Number(tt.choChon) > 0],
          ]
        : [
              [t("Đã báo giá"), formatNumber(tt.daBaoGia)],
              [t("Được chấp nhận"), formatNumber(tt.duocChapNhan)],
              [t("Không chấp nhận"), formatNumber(tt.khongChapNhan)],
              [t("Chờ báo giá"), formatNumber(tt.choBaoGia), Number(tt.choBaoGia) > 0],
          ];
    return (
        <dl className="grid grid-cols-2 border-b border-bo-border md:grid-cols-4">
            {o.map(([nhan, giaTri, nhanManh], i) => (
                <div
                    key={nhan}
                    className={cn('min-w-0 border-bo-border px-4 py-3 md:px-5', i % 2 === 1 && 'border-l', i >= 2 && 'max-md:border-t md:border-l')}
                >
                    <dt className="text-xs text-bo-muted">{nhan}</dt>
                    <dd className={cn('mt-0.5 truncate text-lg leading-6 font-bold tabular-nums', nhanManh ? 'text-bo-warning' : 'text-bo-heading')}>{giaTri}</dd>
                </div>
            ))}
        </dl>
    );
}

function Rong({ dangLoc, traHang, khoang, onBoLoc, onMoRong }) {
    return (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-bo-surface-subtle text-bo-muted">
                {dangLoc ? <SearchX className="size-5" aria-hidden="true" /> : <Inbox className="size-5" aria-hidden="true" />}
            </span>
            <p className="text-[15px] font-semibold text-bo-heading">
                {dangLoc
                    ? t("Không có kết quả khớp từ khóa")
                    : traHang
                      ? t("Chưa có biên bản hàng lỗi trong {{khoang}}", { khoang: tenKhoang(khoang).toLocaleLowerCase('vi') })
                      : t("Chưa có yêu cầu báo giá trong {{khoang}}", { khoang: tenKhoang(khoang).toLocaleLowerCase('vi') })}
            </p>
            <p className="max-w-md text-sm leading-[22px] text-slate-600">
                {dangLoc
                    ? t("Kiểm tra lại mã vừa gõ, hoặc bỏ từ khóa để xem tất cả.")
                    : t("Chọn khoảng thời gian dài hơn để xem các chứng từ cũ.")}
            </p>
            {dangLoc ? (
                <Button type="button" variant="outline" onClick={onBoLoc} className="mt-1 h-10 border-bo-border bg-bo-surface px-4 text-bo-foreground hover:bg-bo-surface-subtle">
                    {t("Bỏ từ khóa")}
                </Button>
            ) : onMoRong ? (
                <Button type="button" variant="outline" onClick={onMoRong} className="mt-1 h-10 border-bo-border bg-bo-surface px-4 text-bo-foreground hover:bg-bo-surface-subtle">
                    {t("Xem 12 tháng gần nhất")}
                </Button>
            ) : null}
        </div>
    );
}

function KetQua({ ketQua }) {
    const nhan = NHAN_KET_QUA_BAO_GIA[ketQua] ?? null;
    if (!nhan) return <span className="text-bo-muted">—</span>;
    return <StatusBadge label={nhan} quyTrinh={ketQua === 'CHO_BAO_GIA' ? 'yeuCauBaoGia' : undefined} />;
}

/** Bấm cả dòng mở chi tiết; liên kết trong dòng (cho bàn phím) tự xử lý nên dòng bỏ qua. */
const moKhiBamDong = (onMo, id) => (e) => {
    if (e.target.closest('a, button')) return;
    onMo(id);
};

function BangBaoGia({ ds, onMo }) {
    return (
        <>
            <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-sm">
                    <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th scope="col" className={TIEU_DE_COT}>{t("Đơn mua", { context: "nhan" })}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Ngày yêu cầu")}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Ngày báo giá")}</th>
                            <th scope="col" className={cn(TIEU_DE_COT, 'text-right')}>{t("Mặt hàng")}</th>
                            <th scope="col" className={cn(TIEU_DE_COT, 'text-right')}>{t("Tổng báo giá")}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Kết quả")}</th>
                            <th scope="col" className="w-10"><span className="sr-only">{t("Mở")}</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {ds.map((d) => (
                            <tr key={d.id} onClick={moKhiBamDong(onMo, d.id)} className="cursor-pointer hover:bg-bo-surface-subtle/60">
                                <td className="h-14 px-4">
                                    <Link to={duongDanBaoGia(d.id)} className={LIEN_KET_O}>{d.soDonMua}</Link>
                                </td>
                                <td className="px-4 tabular-nums text-slate-600">{formatDate(d.ngayYeuCau)}</td>
                                <td className="px-4 tabular-nums text-slate-600">{d.ngayBaoGia ? formatDate(d.ngayBaoGia) : <span className="text-bo-muted">—</span>}</td>
                                <td className="px-4 text-right tabular-nums">{formatNumber(d.soMatHang)}</td>
                                <td className="px-4 text-right font-semibold tabular-nums">
                                    {d.tongTien != null ? formatCurrency(d.tongTien) : <span className="font-normal text-bo-muted">—</span>}
                                </td>
                                <td className="px-4"><KetQua ketQua={d.ketQua} /></td>
                                <td className="px-2 text-bo-muted"><ChevronRight className="size-4" aria-hidden="true" /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ul className="divide-y divide-bo-border md:hidden">
                {ds.map((d) => (
                    <li key={d.id}>
                        <Link
                            to={duongDanBaoGia(d.id)}
                            className="flex flex-col gap-1 px-4 py-3 hover:bg-bo-surface-subtle/60 focus-visible:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/40"
                        >
                            <span className="flex items-center justify-between gap-3">
                                <span className="min-w-0 font-semibold break-all text-bo-primary">{d.soDonMua}</span>
                                <span className="shrink-0 font-semibold tabular-nums text-bo-foreground">{d.tongTien != null ? formatCurrency(d.tongTien) : '—'}</span>
                            </span>
                            <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] text-bo-muted">
                                <span>
                                    {t("{{soMatHang}} mặt hàng", { soMatHang: formatNumber(d.soMatHang) })} ·{' '}
                                    {d.ngayBaoGia
                                        ? t("báo giá {{ngay}}", { ngay: formatDate(d.ngayBaoGia) })
                                        : t("yêu cầu {{ngay}}", { ngay: formatDate(d.ngayYeuCau) })}
                                </span>
                                <KetQua ketQua={d.ketQua} />
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    );
}

/** Cột "Cách xử lý" của lịch sử trả hàng. `lienKet`: còn chờ chọn thì là liên kết cam tới biên bản (máy tính). */
function CachXuLy({ dong, lienKet }) {
    const c = cachXuLyLichSu(dong);
    if (c.loai === 'huy') return <StatusBadge label="Đã hủy" />;
    if (c.loai === 'cho') {
        const noiDung = (
            <>
                {t("Chờ bạn chọn")} <ChevronRight className="size-3.5" aria-hidden="true" />
            </>
        );
        return lienKet ? (
            <Link to={duongDanBienBan(dong.id)} className="inline-flex items-center gap-1 rounded-sm font-semibold text-bo-warning hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40">
                {noiDung}
            </Link>
        ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-bo-warning">{noiDung}</span>
        );
    }
    if (c.loai === 'tru') {
        return (
            <span className="flex flex-col leading-5">
                <span className="font-medium">{t("Trừ tiền")}</span>
                {c.tien ? <span className="text-[13px] tabular-nums text-bo-muted">−{formatCurrency(c.tien)}</span> : null}
            </span>
        );
    }
    if (c.loai === 'hon') {
        // Mỗi sản phẩm một cách: phần trừ tiền và phần giao bù còn chờ
        const phu = [
            c.tien ? `−${formatCurrency(c.tien)}` : null,
            c.conLai > 0 && !c.xong ? t("còn {{count}} chờ giao", { count: c.conLai }) : null,
        ].filter(Boolean);
        return (
            <span className="flex flex-col leading-5">
                <span className="font-medium">{t("Trừ tiền và giao bù")}</span>
                {phu.length ? <span className="text-[13px] tabular-nums text-bo-muted">{phu.join(' · ')}</span> : null}
            </span>
        );
    }
    return (
        <span className="flex flex-col leading-5">
            <span className="font-medium">{t("Giao bù")}</span>
            {c.xong || c.conLai > 0 ? (
                <span className={cn('text-[13px]', c.xong ? 'text-bo-success' : 'text-bo-muted')}>
                    {c.xong ? t("đã giao đủ") : t("còn {{count}} chờ giao", { count: c.conLai })}
                </span>
            ) : null}
        </span>
    );
}

function HangLoi({ dong }) {
    const nhan = nhanHangLoi(dong);
    return nhan ? <StatusBadge label={nhan} /> : <span className="text-bo-muted">—</span>;
}

function BangTraHang({ ds, onMo }) {
    return (
        <>
            <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[820px] text-sm">
                    <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th scope="col" className={TIEU_DE_COT}>{t("Biên bản")}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Ngày lập")}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Đơn mua", { context: "nhan" })}</th>
                            <th scope="col" className={cn(TIEU_DE_COT, 'text-right')}>{t("SP lỗi")}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Cách xử lý")}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Hàng lỗi")}</th>
                            <th scope="col" className="w-10"><span className="sr-only">{t("Mở")}</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {ds.map((b) => (
                            <tr key={b.id} onClick={moKhiBamDong(onMo, b.id)} className={cn('cursor-pointer hover:bg-bo-surface-subtle/60', b.daHuy && 'text-bo-muted')}>
                                <td className="h-14 px-4">
                                    <Link to={duongDanBienBan(b.id)} className={LIEN_KET_O}>{b.soBienBan}</Link>
                                </td>
                                <td className="px-4 tabular-nums text-slate-600">{formatDate(b.ngayLap)}</td>
                                <td className="px-4 text-slate-700">{b.soDonMua || '—'}</td>
                                <td className="px-4 text-right font-semibold tabular-nums">{formatNumber(b.soLuongLoi)}</td>
                                <td className="px-4 py-2"><CachXuLy dong={b} lienKet /></td>
                                <td className="px-4"><HangLoi dong={b} /></td>
                                <td className="px-2 text-bo-muted"><ChevronRight className="size-4" aria-hidden="true" /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ul className="divide-y divide-bo-border md:hidden">
                {ds.map((b) => (
                    <li key={b.id}>
                        <Link
                            to={duongDanBienBan(b.id)}
                            className="flex flex-col gap-1.5 px-4 py-3 hover:bg-bo-surface-subtle/60 focus-visible:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/40"
                        >
                            <span className="flex items-start justify-between gap-3">
                                <span className="min-w-0">
                                    <span className="block font-semibold break-all text-bo-primary">{b.soBienBan}</span>
                                    <span className="block text-[13px] text-bo-muted">
                                        {[formatDate(b.ngayLap), b.soDonMua, t("{{count}} SP lỗi", { count: Number(b.soLuongLoi) || 0 })].filter(Boolean).join(' · ')}
                                    </span>
                                </span>
                                <span className="shrink-0 text-right text-sm text-bo-foreground"><CachXuLy dong={b} /></span>
                            </span>
                            <span className="self-start">
                                <HangLoi dong={b} />
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    );
}

function ChanBang({ tong, khoang, tenNcc }) {
    return (
        <div className="flex flex-col gap-1 border-t border-bo-border px-4 py-3 text-[13px] text-bo-muted sm:flex-row sm:items-center sm:justify-between md:px-5">
            <span>{t("{{count}} kết quả trong {{khoang}}", { count: tong, khoang: tenKhoang(khoang).toLocaleLowerCase('vi') })}</span>
            {tenNcc ? (
                <span className="inline-flex items-center gap-1.5">
                    <Inbox className="size-4 shrink-0" aria-hidden="true" /> {t("Chỉ hiện chứng từ của {{ten}}", { ten: tenNcc })}
                </span>
            ) : null}
        </div>
    );
}
