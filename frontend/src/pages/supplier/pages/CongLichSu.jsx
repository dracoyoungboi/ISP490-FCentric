import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarX, ChevronRight, Inbox, Search, SearchX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import LocKhoangNgay from '@/components/shared/LocKhoangNgay';
import TablePagination from '@/components/shared/TablePagination';
import KhungCongNhaCungCap from '@/components/supplier-portal/KhungCongNhaCungCap';
import { KhungLoiTai, KhungXuongCong } from '@/components/supplier-portal/TrangThaiTaiCong';
import { cachXuLyLichSu, nhanHangLoi } from '@/components/supplier-portal/congUtils';
import { xuLyLoiTai } from '@/components/supplier-portal/loiCong';
import { NHAN_KET_QUA_BAO_GIA } from '@/constants/congNhaCungCap';
import { duongDanBaoGia, duongDanBienBan } from '@/components/supplier-portal/phienCong';
import { useCongNcc, useTieuDeCong } from '@/components/supplier-portal/useCongNcc';
import congNhaCungCapService from '@/services/congNhaCungCapService';
import useTaiDuLieu from '@/hooks/useTaiDuLieu';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate, formatNumber } from '@/utils/formatters';
import { t } from '@/i18n';

const TIEU_DE_TRANG = 'text-xl leading-7 font-bold tracking-tight text-bo-heading md:text-2xl md:leading-8';
const TIEU_DE_COT = 'h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted';
/** Cột đầu / cuối bảng thẳng mép 24px của khối (cùng tiêu đề và thanh lọc). */
const COT_DAU = 'md:pl-6';
const LIEN_KET_O = 'rounded-sm font-semibold text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40';
const NUT_PHU = 'h-10 border-bo-border bg-bo-surface px-4 text-bo-foreground hover:bg-bo-surface-subtle';
const TRE_TIM = 300;
/** Cổng mặc định 10 dòng mỗi trang (trang quản trị 20): nhà cung cấp thường chỉ tra vài chứng từ gần đây. */
const SO_DONG_MAC_DINH = 10;
/** Cổng bỏ lựa chọn 100 dòng: nhà cung cấp chỉ có vài chục chứng từ, 50 dòng đã đủ xem một lượt. */
const LUA_CHON_SO_DONG = [10, 20, 50];
/** Máy tính rộng (≥1024px): bảng không cần cuộn ngang nên đầu bảng dính trên cùng khi cuộn trang dài. */
const DAU_BANG_DINH = 'lg:sticky lg:top-0 lg:z-10 lg:shadow-[0_1px_0_var(--color-bo-border)]';
const NGAY = /^\d{4}-\d{2}-\d{2}$/;

/** Đổi vài tham số trên địa chỉ (null / rỗng: bỏ tham số), giữ các tham số khác. */
function datThamSo(thamSo, moi) {
    const ts = new URLSearchParams(thamSo);
    for (const [k, v] of Object.entries(moi)) {
        if (v === null || v === '' || v === undefined) ts.delete(k);
        else ts.set(k, v);
    }
    return ts;
}

const chuanHoaLichSu = (kq) => ({ items: Array.isArray(kq?.items) ? kq.items : [] });
const ngayTuDiaChi = (v) => (NGAY.test(v ?? '') ? v : '');

async function taiLichSu(tuNgay, denNgay, tuKhoa) {
    const thamSo = { tuNgay, denNgay, tuKhoa };
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
 * Cổng nhà cung cấp · Lịch sử (/supplier/portal/history?the=bao-gia|tra-hang&q=&tu=&den=&trang=&so=): cả trang trong
 * MỘT khối trắng như màn Cần xử lý — tiêu đề, thanh lọc (nút Báo giá / Hàng lỗi trả lại, ô tìm gõ là lọc sau 300ms,
 * ô khoảng ngày dùng chung LocKhoangNgay + "Xóa lọc"), bảng (máy tính) hoặc thẻ (điện thoại), chân bảng phân trang.
 * Mặc định mọi thời gian; báo giá lọc theo ngày yêu cầu, biên bản theo ngày lập. Máy chủ trả hết dòng khớp, trang tự
 * chia trang (số trang, số dòng lưu trên địa chỉ để Quay lại đúng chỗ).
 */
export default function CongLichSu() {
    const { phien, hetPhien, thoat } = useCongNcc();
    const navigate = useNavigate();
    const [thamSo, setThamSo] = useSearchParams();
    const the = thamSo.get('the') === 'tra-hang' ? 'tra-hang' : 'bao-gia';
    const tuKhoa = thamSo.get('q') ?? '';
    const tuNgay = ngayTuDiaChi(thamSo.get('tu'));
    const denNgay = ngayTuDiaChi(thamSo.get('den'));
    const soDongDiaChi = Number(thamSo.get('so'));
    const soDong = LUA_CHON_SO_DONG.includes(soDongDiaChi) ? soDongDiaChi : SO_DONG_MAC_DINH;
    const trangDiaChi = Math.max(0, (Number.parseInt(thamSo.get('trang'), 10) || 1) - 1);
    const dauBangRef = useRef(null);
    const [oTim, setOTim] = useState(tuKhoa);
    // Ô tìm theo ?q hai chiều: ?q đổi từ ngoài (bấm tab Lịch sử trên thanh trên, Quay lại…) thì ô đổi theo, không ghi
    // từ khóa cũ trở lại. Chỉnh state ngay lúc vẽ (cách React khuyên) để hiệu ứng chờ gõ bên dưới thấy giá trị mới.
    const [qDaThay, setQDaThay] = useState(tuKhoa);
    if (qDaThay !== tuKhoa) {
        setQDaThay(tuKhoa);
        if (oTim.trim() !== tuKhoa.trim()) setOTim(tuKhoa);
    }
    // Tải cả hai thẻ một lần (cùng khoảng ngày và từ khóa): đổi thẻ không phải chờ, và thẻ nào cũng có số kết quả
    const { data, error, loading, dungKhoa, reload } = useTaiDuLieu(
        () => taiLichSu(tuNgay, denNgay, tuKhoa),
        `${tuNgay}|${denNgay}|${tuKhoa.trim()}`,
        { enabled: Boolean(phien) },
    );
    const loiTai = error ? xuLyLoiTai(error) : null;
    const duLieu = data ? (the === 'tra-hang' ? data.traHang : data.baoGia) : null;

    useTieuDeCong(t("Lịch sử"));

    useEffect(() => {
        if (loiTai?.loai === 'phien-het-han') hetPhien();
    }, [loiTai?.loai, hetPhien]);

    // Gõ là lọc: chờ 300ms sau phím cuối mới đổi từ khóa trên địa chỉ (và gọi máy chủ), về trang 1
    useEffect(() => {
        if (oTim.trim() === tuKhoa.trim()) return undefined;
        const hen = setTimeout(() => setThamSo(datThamSo(thamSo, { q: oTim.trim() || null, trang: null }), { replace: true }), TRE_TIM);
        return () => clearTimeout(hen);
    }, [oTim, tuKhoa, thamSo, setThamSo]);

    // Đổi bộ lọc thì về trang 1; chỉ đổi trang thì giữ bộ lọc
    const doiThamSo = (moi) => setThamSo(datThamSo(thamSo, { trang: null, ...moi }), { replace: true });
    const doiTrang = (trang) => {
        setThamSo(datThamSo(thamSo, { trang: trang > 0 ? String(trang + 1) : null }), { replace: true });
        // Đang cuộn quá đầu bảng thì đưa đầu bảng lên; bảng còn trong màn thì không nhảy
        const dau = dauBangRef.current;
        if (dau && dau.getBoundingClientRect().top < 0) {
            const giam = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            dau.scrollIntoView({ block: 'start', behavior: giam ? 'auto' : 'smooth' });
        }
    };
    const demThe = { 'bao-gia': data?.baoGia.items.length ?? null, 'tra-hang': data?.traHang.items.length ?? null };

    if (!phien) return null;
    const traHang = the === 'tra-hang';
    const dangTim = Boolean(tuKhoa.trim());
    const dangLocNgay = Boolean(tuNgay || denNgay);
    const xoaLocNgay = () => doiThamSo({ tu: null, den: null });

    const tong = duLieu?.items.length ?? 0;
    const soTrang = Math.max(1, Math.ceil(tong / soDong));
    const trang = Math.min(trangDiaChi, soTrang - 1);
    const dongTrang = duLieu ? duLieu.items.slice(trang * soDong, (trang + 1) * soDong) : [];

    return (
        <KhungCongNhaCungCap tenNhaCungCap={phien.nhaCungCap?.ten} email={phien.nhaCungCap?.email} onThoat={thoat} tab="lich-su">
            {/* Khối trắng luôn kéo tới sát chân trang (chốt 26/11), cùng Cần xử lý: mép dưới không nhảy khi đổi tab.
                Không overflow-hidden: khối cắt nội dung thì đầu bảng không dính được khi cuộn trang. */}
            <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col p-4 md:p-6">
                <div className="flex flex-1 flex-col rounded-xl border border-bo-border bg-bo-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                    <div className="px-4 pt-5 pb-4 md:px-6 md:pt-6">
                        <h1 className={TIEU_DE_TRANG}>{t("Lịch sử báo giá và hàng lỗi")}</h1>
                    </div>

                    {/* Thanh lọc: cùng kiểu nút lọc + ô tìm của Cần xử lý; ô khoảng ngày ở cuối hàng */}
                    <div className="flex flex-col gap-3 border-y border-bo-border px-4 py-2.5 md:px-6 lg:flex-row lg:items-center lg:justify-between">
                        <div role="tablist" aria-label={t("Loại lịch sử")} className="-mx-1 -my-1 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                                            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-bo-surface px-3 text-[13px] transition-[color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 motion-reduce:transition-none',
                                            bat
                                                ? 'border-bo-primary font-semibold text-bo-primary-strong shadow-[0_0_0_3px_rgba(13,97,228,0.12)]'
                                                : 'border-bo-border font-medium text-slate-600 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-bo-input-border hover:bg-bo-surface-subtle hover:text-bo-foreground',
                                        )}
                                    >
                                        {ten()}
                                        {demThe[ma] != null ? (
                                            <span
                                                className={cn(
                                                    'inline-flex h-[18px] min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                                                    bat ? 'bg-bo-primary-soft text-bo-primary-strong' : 'bg-slate-100 text-slate-600',
                                                )}
                                            >
                                                {formatNumber(demThe[ma])}
                                            </span>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <label className="relative block sm:w-64">
                                <span className="sr-only">{traHang ? t("Tìm mã biên bản, mã đơn") : t("Tìm mã đơn mua")}</span>
                                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-bo-muted" aria-hidden="true" />
                                <input
                                    type="search"
                                    value={oTim}
                                    onChange={(e) => setOTim(e.target.value)}
                                    placeholder={traHang ? t("Tìm mã biên bản, mã đơn") : t("Tìm mã đơn mua")}
                                    maxLength={100}
                                    className="h-9 w-full rounded-md border border-bo-input-border bg-bo-surface pr-3 pl-8 text-base placeholder:text-slate-400 focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/20 md:text-sm"
                                />
                            </label>
                            <div className="flex items-center gap-1">
                                <LocKhoangNgay
                                    nhan={traHang ? t("Ngày lập") : t("Ngày yêu cầu")}
                                    tuNgay={tuNgay}
                                    denNgay={denNgay}
                                    onDoi={({ tuNgay: tu, denNgay: den }) => doiThamSo({ tu, den })}
                                    canHop="end"
                                    className="min-w-0 flex-1 sm:flex-none"
                                />
                                {dangLocNgay ? (
                                    <Button type="button" variant="ghost" onClick={xoaLocNgay} className="h-9 shrink-0 gap-1 px-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-bo-foreground">
                                        <X className="size-3.5" aria-hidden="true" /> {t("Xóa lọc")}
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div
                        ref={dauBangRef}
                        id="ls-noi-dung"
                        role="tabpanel"
                        aria-labelledby={`ls-the-${the}`}
                        aria-busy={loading || undefined}
                        className={cn('flex flex-1 flex-col scroll-mt-4 transition-opacity', loading && !dungKhoa && duLieu && 'opacity-60')}
                    >
                        {/* Lỗi của lần tải theo bộ lọc đang chọn: báo lỗi, không để bảng của bộ lọc cũ như thể là kết quả */}
                        {loiTai && (!duLieu || !dungKhoa) ? (
                            <div className="p-4 md:p-6">
                                <KhungLoiTai cau={loiTai.cau} onThuLai={reload} />
                            </div>
                        ) : !duLieu ? (
                            <KhungXuongCong kieu="bang" />
                        ) : tong === 0 ? (
                            <Rong
                                dangTim={dangTim}
                                dangLocNgay={dangLocNgay}
                                traHang={traHang}
                                onBoTim={() => {
                                    setOTim('');
                                    doiThamSo({ q: null });
                                }}
                                onXoaLocNgay={xoaLocNgay}
                            />
                        ) : (
                            <>
                                {traHang ? (
                                    <BangTraHang ds={dongTrang} onMo={(id) => navigate(duongDanBienBan(id))} />
                                ) : (
                                    <BangBaoGia ds={dongTrang} onMo={(id) => navigate(duongDanBaoGia(id))} />
                                )}
                                {/* Kẻ cả đáy: khối kéo hết chiều cao nên dưới chân phân trang có thể còn phần trắng */}
                                <div className="border-y border-bo-border px-4 py-3 md:px-6">
                                    <TablePagination
                                        page={trang}
                                        size={soDong}
                                        total={tong}
                                        onPageChange={doiTrang}
                                        onSizeChange={(so) => doiThamSo({ so: so === SO_DONG_MAC_DINH ? null : String(so) })}
                                        sizeOptions={LUA_CHON_SO_DONG}
                                        canGiua
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </KhungCongNhaCungCap>
    );
}

/** Trống: chưa có gì (không lọc) · không có trong khoảng ngày · không khớp từ khóa. Nút gỡ đúng bộ lọc đang chặn. */
function Rong({ dangTim, dangLocNgay, traHang, onBoTim, onXoaLocNgay }) {
    const Icon = dangTim ? SearchX : dangLocNgay ? CalendarX : Inbox;
    const tieuDe = dangTim
        ? t("Không có kết quả khớp từ khóa")
        : dangLocNgay
          ? traHang
              ? t("Không có biên bản hàng lỗi trong khoảng ngày đã chọn")
              : t("Không có yêu cầu báo giá trong khoảng ngày đã chọn")
          : traHang
            ? t("Chưa có biên bản hàng lỗi nào")
            : t("Chưa có yêu cầu báo giá nào");
    const moTa = dangTim
        ? dangLocNgay
            ? t("Kiểm tra lại mã vừa gõ, hoặc xóa lọc ngày để tìm cả chứng từ cũ.")
            : t("Kiểm tra lại mã vừa gõ.")
        : dangLocNgay
          ? t("Xóa lọc ngày để xem tất cả chứng từ.")
          : traHang
            ? t("Khi chúng tôi lập biên bản hàng lỗi, biên bản sẽ hiện ở đây.")
            : t("Khi chúng tôi gửi yêu cầu báo giá, đơn sẽ hiện ở đây.");
    return (
        // flex-1 + căn giữa: khối kéo hết chiều cao nên lời nhắn nằm giữa phần trống, như màn trống Cần xử lý
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-bo-surface-subtle text-bo-muted">
                <Icon className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-base font-semibold text-bo-heading">{tieuDe}</h2>
            <p className="max-w-md text-sm leading-[22px] text-slate-600">{moTa}</p>
            {dangTim || dangLocNgay ? (
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                    {dangTim ? (
                        <Button type="button" variant="outline" onClick={onBoTim} className={NUT_PHU}>
                            {t("Bỏ từ khóa")}
                        </Button>
                    ) : null}
                    {dangLocNgay ? (
                        <Button type="button" variant="outline" onClick={onXoaLocNgay} className={NUT_PHU}>
                            {t("Xóa lọc ngày")}
                        </Button>
                    ) : null}
                </div>
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
            <div className="hidden overflow-x-auto md:block lg:overflow-visible">
                <table className="w-full min-w-[760px] text-sm">
                    <thead className={DAU_BANG_DINH}>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th scope="col" className={cn(TIEU_DE_COT, COT_DAU)}>{t("Đơn mua", { context: "nhan" })}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Ngày yêu cầu")}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Ngày báo giá")}</th>
                            <th scope="col" className={cn(TIEU_DE_COT, 'text-right')}>{t("Mặt hàng")}</th>
                            <th scope="col" className={cn(TIEU_DE_COT, 'text-right')}>{t("Tổng báo giá")}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Kết quả")}</th>
                            <th scope="col" className="w-12"><span className="sr-only">{t("Mở")}</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {ds.map((d) => (
                            <tr key={d.id} onClick={moKhiBamDong(onMo, d.id)} className="cursor-pointer hover:bg-bo-surface-subtle/60">
                                <td className={cn('h-14 px-4', COT_DAU)}>
                                    <Link to={duongDanBaoGia(d.id)} className={LIEN_KET_O}>{d.soDonMua}</Link>
                                </td>
                                <td className="px-4 tabular-nums text-slate-600">{formatDate(d.ngayYeuCau)}</td>
                                <td className="px-4 tabular-nums text-slate-600">{d.ngayBaoGia ? formatDate(d.ngayBaoGia) : <span className="text-bo-muted">—</span>}</td>
                                <td className="px-4 text-right tabular-nums">{formatNumber(d.soMatHang)}</td>
                                <td className="px-4 text-right font-semibold tabular-nums">
                                    {d.tongTien != null ? formatCurrency(d.tongTien) : <span className="font-normal text-bo-muted">—</span>}
                                </td>
                                <td className="px-4"><KetQua ketQua={d.ketQua} /></td>
                                <td className="pr-4 pl-2 text-bo-muted md:pr-6"><ChevronRight className="ml-auto size-4" aria-hidden="true" /></td>
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
            <div className="hidden overflow-x-auto md:block lg:overflow-visible">
                <table className="w-full min-w-[820px] text-sm">
                    <thead className={DAU_BANG_DINH}>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th scope="col" className={cn(TIEU_DE_COT, COT_DAU)}>{t("Biên bản")}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Ngày lập")}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Đơn mua", { context: "nhan" })}</th>
                            <th scope="col" className={cn(TIEU_DE_COT, 'text-right')}>{t("SP lỗi")}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Cách xử lý")}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Hàng lỗi")}</th>
                            <th scope="col" className="w-12"><span className="sr-only">{t("Mở")}</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {ds.map((b) => (
                            <tr key={b.id} onClick={moKhiBamDong(onMo, b.id)} className={cn('cursor-pointer hover:bg-bo-surface-subtle/60', b.daHuy && 'text-bo-muted')}>
                                <td className={cn('h-14 px-4', COT_DAU)}>
                                    <Link to={duongDanBienBan(b.id)} className={LIEN_KET_O}>{b.soBienBan}</Link>
                                </td>
                                <td className="px-4 tabular-nums text-slate-600">{formatDate(b.ngayLap)}</td>
                                <td className="px-4 text-slate-700">{b.soDonMua || '—'}</td>
                                <td className="px-4 text-right font-semibold tabular-nums">{formatNumber(b.soLuongLoi)}</td>
                                <td className="px-4 py-2"><CachXuLy dong={b} lienKet /></td>
                                <td className="px-4"><HangLoi dong={b} /></td>
                                <td className="pr-4 pl-2 text-bo-muted md:pr-6"><ChevronRight className="ml-auto size-4" aria-hidden="true" /></td>
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
