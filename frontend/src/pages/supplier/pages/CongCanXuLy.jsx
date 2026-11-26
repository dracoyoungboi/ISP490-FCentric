import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronRight, Clock, Info, Mail, MessageSquareReply, Phone, ReceiptText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import TablePagination from '@/components/shared/TablePagination';
import { LUA_CHON_SO_DONG } from '@/constants/phanTrang';
import KhungCongNhaCungCap from '@/components/supplier-portal/KhungCongNhaCungCap';
import { KhungLoiTai, KhungXuongCong } from '@/components/supplier-portal/TrangThaiTaiCong';
import { demViec, xepViecCanLam } from '@/components/supplier-portal/congUtils';
import { xuLyLoiTai } from '@/components/supplier-portal/loiCong';
import { DUONG_DAN_CONG, duongDanBaoGia, duongDanBienBan } from '@/components/supplier-portal/phienCong';
import { datSoViec, useCongNcc, useTieuDeCong } from '@/components/supplier-portal/useCongNcc';
import congNhaCungCapService from '@/services/congNhaCungCapService';
import useTaiDuLieu from '@/hooks/useTaiDuLieu';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate, formatNumber } from '@/utils/formatters';
import { t, tDuLieu } from '@/i18n';

const TIEU_DE_TRANG = 'text-xl leading-7 font-bold tracking-tight text-bo-heading md:text-2xl md:leading-8';
const LIEN_KET_FOCUS = 'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40';
/** Màu chữ ngày hạn theo mức gấp (xepViecCanLam). */
const MAU_HAN = { do: 'text-bo-danger', cam: 'text-bo-warning', xam: 'text-bo-foreground' };
/** 10 việc mỗi trang như Lịch sử; danh sách không quá số này thì không có chân phân trang. */
const SO_DONG_MAC_DINH = 10;

/** Đổi vài tham số trên địa chỉ (null / rỗng: bỏ tham số), giữ các tham số khác. */
function datThamSo(thamSo, moi) {
    const ts = new URLSearchParams(thamSo);
    for (const [k, v] of Object.entries(moi)) {
        if (v === null || v === '' || v === undefined) ts.delete(k);
        else ts.set(k, v);
    }
    return ts;
}

/**
 * Cổng nhà cung cấp · Cần xử lý (/supplier/portal): cả trang trong MỘT khối trắng — tiêu đề + người phụ trách mua hàng,
 * nhắc việc quá hạn, lọc theo loại + ô tìm, một danh sách chung biên bản hàng lỗi chờ trả lời và đơn chờ báo giá, gấp
 * nhất trước (xepViecCanLam). Số việc chỉ hiện ở tab và nút lọc; số liệu 30 ngày để ở Lịch sử.
 * Dữ liệu: GET /cong-ncc/viec-can-lam.
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
    const tenNcc = viec.nhaCungCap?.ten || phien.nhaCungCap?.ten;
    const emailNcc = viec.nhaCungCap?.email || phien.nhaCungCap?.email;

    return (
        <KhungCongNhaCungCap tenNhaCungCap={tenNcc} email={emailNcc} onThoat={thoat} tab="can-xu-ly" tuTaiSoViec={false}>
            <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6">
                <div className="overflow-hidden rounded-xl border border-bo-border bg-bo-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                    <div className="flex flex-col gap-4 px-4 pt-5 pb-4 md:flex-row md:items-center md:justify-between md:gap-8 md:px-6 md:pt-6">
                        <h1 className={TIEU_DE_TRANG}>{t("Việc cần Quý công ty xử lý")}</h1>
                        {tai.trangThai === 'xong' && viec.nguoiPhuTrach ? <NguoiPhuTrachGon nguoi={viec.nguoiPhuTrach} /> : null}
                    </div>

                    {tai.trangThai === 'dang-tai' ? (
                        <KhungXuongCong kieu="bang" className="border-t border-bo-border" />
                    ) : tai.trangThai === 'loi' ? (
                        <KhungLoiTai cau={tai.cau} onThuLai={reload} className="mx-4 mb-5 md:mx-6" />
                    ) : (
                        <DanhSachViec viec={viec} />
                    )}
                </div>
            </main>
        </KhungCongNhaCungCap>
    );
}

const soGoi = (sdt) => String(sdt ?? '').replace(/[^\d+]/g, '');

/** Người phụ trách mua hàng gọn trong một ô ở đầu khối: tên, số điện thoại, email (bấm gọi / gửi thư). */
function NguoiPhuTrachGon({ nguoi }) {
    const sdt = String(nguoi?.soDienThoai ?? '').trim();
    const email = String(nguoi?.email ?? '').trim();
    return (
        <section aria-label={t("Người phụ trách mua hàng")} className="min-w-0 rounded-lg bg-bo-surface-subtle px-4 py-2.5 md:max-w-[460px]">
            <div className="min-w-0 text-sm">
                <p className="truncate">
                    <span className="text-bo-muted">{t("Phụ trách mua hàng:")}</span>{' '}
                    <span className="font-semibold text-bo-heading">{nguoi?.hoTen}</span>
                </p>
                {sdt || email ? (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px]">
                        {sdt ? (
                            <a href={`tel:${soGoi(sdt)}`} className={cn('inline-flex items-center gap-1 text-bo-primary hover:underline', LIEN_KET_FOCUS)}>
                                <Phone className="size-3.5" aria-hidden="true" /> {sdt}
                            </a>
                        ) : null}
                        {email ? (
                            <a href={`mailto:${email}`} className={cn('inline-flex min-w-0 items-center gap-1 break-all text-bo-primary hover:underline', LIEN_KET_FOCUS)}>
                                <Mail className="size-3.5 shrink-0" aria-hidden="true" /> {email}
                            </a>
                        ) : null}
                    </p>
                ) : null}
            </div>
        </section>
    );
}

const LOC = [
    { ma: 'tat-ca', ten: () => t("Tất cả") },
    { ma: 'bien-ban', ten: () => t("Biên bản hàng lỗi") },
    { ma: 'bao-gia', ten: () => t("Chờ báo giá") },
    { ma: 'qua-han', ten: () => t("Quá hạn") },
];
const MA_LOC = new Set(LOC.map((l) => l.ma));

/**
 * Phần dưới đầu khối khi đã tải: nhắc quá hạn, thanh lọc + tìm, danh sách việc (hoặc màn không có việc), chân phân
 * trang khi quá 10 việc. Lọc, từ khóa, trang, số dòng nằm trên địa chỉ (?loc=&q=&trang=&so=) để F5 / Quay lại giữ chỗ.
 * Lọc "Quá hạn" chỉ hiện khi có việc quá hạn (biên bản quá hạn trả lời, đơn đã qua ngày cần giao).
 */
function DanhSachViec({ viec }) {
    // Mốc so hạn: lấy một lần khi dựng (không gọi đồng hồ mỗi lần vẽ)
    const [bayGio] = useState(() => new Date());
    const [thamSo, setThamSo] = useSearchParams();
    const dauDanhSachRef = useRef(null);
    const ds = useMemo(() => xepViecCanLam(viec, bayGio), [viec, bayGio]);

    if (ds.length === 0) return <KhongCoViec />;

    const dem = {
        'tat-ca': ds.length,
        'bien-ban': ds.filter((v) => v.loai === 'bien-ban').length,
        'bao-gia': ds.filter((v) => v.loai === 'bao-gia').length,
        'qua-han': ds.filter((v) => v.quaHan).length,
    };
    const locDiaChi = thamSo.get('loc');
    // ?loc=qua-han mà không còn việc quá hạn (vừa báo giá xong rồi Quay lại) thì về Tất cả
    const loc = MA_LOC.has(locDiaChi) && (locDiaChi !== 'qua-han' || dem['qua-han'] > 0) ? locDiaChi : 'tat-ca';
    const tim = thamSo.get('q') ?? '';
    const soDongDiaChi = Number(thamSo.get('so'));
    const soDong = LUA_CHON_SO_DONG.includes(soDongDiaChi) ? soDongDiaChi : SO_DONG_MAC_DINH;

    const tuKhoa = tim.trim().toLowerCase();
    const dsLoc = ds.filter(
        (v) =>
            (loc === 'tat-ca' || (loc === 'qua-han' ? v.quaHan : v.loai === loc)) &&
            (!tuKhoa || [v.so, v.duLieu.soDonMua].some((s) => String(s ?? '').toLowerCase().includes(tuKhoa))),
    );
    const soTrang = Math.max(1, Math.ceil(dsLoc.length / soDong));
    const trang = Math.min(Math.max(0, (Number.parseInt(thamSo.get('trang'), 10) || 1) - 1), soTrang - 1);
    const dongTrang = dsLoc.slice(trang * soDong, (trang + 1) * soDong);

    // Đổi lọc / từ khóa / số dòng thì về trang 1; chỉ đổi trang thì giữ bộ lọc
    const doiThamSo = (moi) => setThamSo(datThamSo(thamSo, { trang: null, ...moi }), { replace: true });
    const doiLoc = (ma) => doiThamSo({ loc: ma === 'tat-ca' ? null : ma });
    const doiTrang = (so) => {
        setThamSo(datThamSo(thamSo, { trang: so > 0 ? String(so + 1) : null }), { replace: true });
        // Đang cuộn quá đầu danh sách thì đưa đầu danh sách lên; danh sách còn trong màn thì không nhảy
        const dau = dauDanhSachRef.current;
        if (dau && dau.getBoundingClientRect().top < 0) {
            const giam = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            dau.scrollIntoView({ block: 'start', behavior: giam ? 'auto' : 'smooth' });
        }
    };

    return (
        <>
            <NhacQuaHan ds={ds} dangLocQuaHan={loc === 'qua-han'} onXemQuaHan={() => doiLoc('qua-han')} />
            <div ref={dauDanhSachRef} className="flex scroll-mt-4 flex-col gap-3 border-y border-bo-border px-4 py-2.5 md:flex-row md:items-center md:justify-between md:px-6">
                <div role="group" aria-label={t("Lọc theo loại việc")} className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {LOC.filter(({ ma }) => ma !== 'qua-han' || dem['qua-han'] > 0).map(({ ma, ten }) => {
                        const bat = loc === ma;
                        return (
                            <button
                                key={ma}
                                type="button"
                                aria-pressed={bat}
                                onClick={() => doiLoc(ma)}
                                className={cn(
                                    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30',
                                    bat ? 'bg-bo-primary-soft text-bo-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-bo-foreground',
                                )}
                            >
                                {ten()}
                                <span className={cn('tabular-nums', !bat && (ma === 'qua-han' ? 'text-bo-danger' : 'text-bo-muted'))}>{dem[ma]}</span>
                            </button>
                        );
                    })}
                </div>
                <label className="relative block md:w-64">
                    <span className="sr-only">{t("Tìm số đơn hoặc số biên bản")}</span>
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-bo-muted" aria-hidden="true" />
                    <input
                        type="search"
                        value={tim}
                        onChange={(e) => doiThamSo({ q: e.target.value })}
                        placeholder={t("Tìm số đơn, số biên bản")}
                        className="h-9 w-full rounded-md border border-bo-input-border bg-bo-surface pr-3 pl-8 text-sm placeholder:text-slate-400 focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/20"
                    />
                </label>
            </div>
            {dsLoc.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-bo-muted">{t("Không có việc khớp với ô tìm.")}</p>
            ) : (
                <>
                    <ul className="divide-y divide-bo-border">
                        {dongTrang.map((v) => (
                            <DongViec key={`${v.loai}-${v.id}`} v={v} />
                        ))}
                    </ul>
                    {dsLoc.length > SO_DONG_MAC_DINH ? (
                        <div className="border-t border-bo-border px-4 py-3 md:px-6">
                            <TablePagination
                                page={trang}
                                size={soDong}
                                total={dsLoc.length}
                                onPageChange={doiTrang}
                                onSizeChange={(so) => doiThamSo({ so: so === SO_DONG_MAC_DINH ? null : String(so) })}
                                canGiua
                            />
                        </div>
                    ) : null}
                </>
            )}
        </>
    );
}

/** Dải cam nhắc việc quá hạn: biên bản quá hạn trả lời (sẽ bị trừ tiền), đơn đã qua ngày cần giao (vẫn báo giá được). */
function NhacQuaHan({ ds, dangLocQuaHan, onXemQuaHan }) {
    const soBienBan = ds.filter((v) => v.loai === 'bien-ban' && v.quaHan).length;
    const soDon = ds.filter((v) => v.loai === 'bao-gia' && v.quaHan).length;
    if (!soBienBan && !soDon) return null;
    return (
        <p className="mx-4 mb-4 flex gap-2 rounded-lg bg-bo-warning-soft px-3 py-2.5 text-[13px] leading-5 text-orange-800 md:mx-6">
            <Info className="mt-0.5 size-4 shrink-0 text-orange-600" aria-hidden="true" />
            <span>
                {soBienBan ? t("{{count}} biên bản đã quá hạn trả lời: chưa chọn cách bù thì chúng tôi trừ tiền hàng.", { count: soBienBan }) : null}
                {soBienBan && soDon ? ' ' : null}
                {soDon ? t("{{count}} đơn đã qua ngày cần giao, vẫn báo giá được; ngày giao mới xin thống nhất với người phụ trách.", { count: soDon }) : null}
                {dangLocQuaHan ? null : (
                    <>
                        {' '}
                        <button
                            type="button"
                            onClick={onXemQuaHan}
                            className="rounded-sm font-semibold whitespace-nowrap text-orange-800 underline underline-offset-2 hover:text-orange-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40"
                        >
                            {soBienBan + soDon > 1 ? t("Xem các việc này") : t("Xem việc này")}
                        </button>
                    </>
                )}
            </span>
        </p>
    );
}

/** Chữ trong ngoặc sau ngày hạn: "đã qua 2 ngày", "quá hạn 1 ngày", "hôm nay", "còn 3 ngày". */
function chuMucGap(v) {
    if (v.soNgay == null) return null;
    if (v.loai === 'bien-ban' && v.quaHan) {
        return v.soNgay < 0 ? t("quá hạn {{count}} ngày", { count: -v.soNgay }) : t("đã quá hạn");
    }
    if (v.soNgay < 0) return t("đã qua {{count}} ngày", { count: -v.soNgay });
    if (v.soNgay === 0) return t("hôm nay");
    return t("còn {{count}} ngày", { count: v.soNgay });
}

/** Hàng lỗi của biên bản đang ở đâu (cuối dòng ngày). `moTa` máy chủ ghép sẵn (tên kho / người nhận). */
function chuHangLoi(hangLoi) {
    const moTa = String(hangLoi?.moTa ?? '').trim();
    switch (hangLoi?.trangThai) {
        case 'DA_TRA':
            return moTa ? t("đã giao {{nguoiNhan}}", { nguoiNhan: tDuLieu(moTa) }) : t("đã trả hàng lỗi cho Quý công ty");
        case 'DA_TIEU_HUY':
            return t("hàng lỗi đã tiêu hủy");
        case 'DA_XU_LY':
            return t("hàng lỗi đã giao trả và tiêu hủy");
        default:
            return moTa ? t("hàng lỗi đang ở {{kho}}", { kho: tDuLieu(moTa) }) : t("hàng lỗi đang ở kho của chúng tôi");
    }
}

/** Một việc: cả dòng là liên kết. Số chứng từ + nhãn · dòng số liệu · dòng ngày hạn (tô theo mức gấp); nút bên phải. */
function DongViec({ v }) {
    const laBienBan = v.loai === 'bien-ban';
    const d = v.duLieu;
    const mucGap = chuMucGap(v);
    const moc = laBienBan ? d.hanTraLoi : d.ngayCanGiao;
    return (
        <li>
            <Link
                to={laBienBan ? duongDanBienBan(v.id) : duongDanBaoGia(v.id)}
                aria-label={laBienBan ? t("Trả lời biên bản {{so}}", { so: v.so }) : t("Báo giá đơn {{soDon}}", { soDon: v.so })}
                className="group flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-bo-surface-subtle focus-visible:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/40 md:flex-row md:items-center md:gap-5 md:px-6"
            >
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-[15px] font-semibold break-all text-bo-heading tabular-nums transition-colors group-hover:text-bo-primary">{v.so}</span>
                        {laBienBan ? (
                            <StatusBadge quyTrinh="traHangNcc" label="Chờ bạn xác nhận" />
                        ) : (
                            <StatusBadge quyTrinh="yeuCauBaoGia" label="Chờ báo giá" />
                        )}
                    </div>
                    <p className="mt-1 text-sm text-slate-700 tabular-nums">
                        {laBienBan ? (
                            <>
                                <strong className="font-semibold">{t("{{count}} sản phẩm lỗi", { count: Number(d.tongSoLuong) || 0 })}</strong>
                                <span className="text-bo-muted"> · {t("giá trị")} </span>
                                {formatCurrency(d.tongGiaTri)}
                                {d.soDonMua ? (
                                    <>
                                        <span className="text-bo-muted"> · </span>
                                        <span className="break-all">{t("đơn {{soDon}}", { soDon: d.soDonMua })}</span>
                                    </>
                                ) : null}
                            </>
                        ) : (
                            <>
                                {t("{{soMatHang}} mặt hàng · {{soLuong}} sản phẩm", {
                                    soMatHang: formatNumber(d.soMatHang),
                                    soLuong: formatNumber(d.tongSoLuong),
                                })}
                                {d.tenKho ? <> · {t("giao tại {{kho}}", { kho: tDuLieu(d.tenKho) })}</> : null}
                            </>
                        )}
                    </p>
                    <p className="mt-0.5 text-[13px] text-bo-muted tabular-nums">
                        {moc ? (
                            <>
                                {v.mucGap !== 'xam' ? <Clock className={cn('mr-1 inline-block size-3.5 align-[-2px]', MAU_HAN[v.mucGap])} aria-hidden="true" /> : null}
                                {laBienBan ? t("Trả lời trước hết ngày") : t("Cần giao trước")}{' '}
                                <strong className={cn('font-semibold', MAU_HAN[v.mucGap])}>{formatDate(moc)}</strong>
                                {mucGap ? <span className={cn(v.mucGap !== 'xam' && cn('font-medium', MAU_HAN[v.mucGap]))}> ({mucGap})</span> : null}
                            </>
                        ) : null}
                        {laBienBan ? (
                            <>{moc ? ' · ' : null}{chuHangLoi(d.hangLoi)}</>
                        ) : d.ngayGuiYeuCau ? (
                            <>{moc ? ' · ' : null}{t("yêu cầu ngày {{ngay}}", { ngay: formatDate(d.ngayGuiYeuCau) })}</>
                        ) : null}
                    </p>
                </div>
                {/* Nút chỉ là phần nhìn (cả dòng là liên kết): cùng một kiểu viền, cùng bề rộng, biểu tượng theo loại;
                    rê hoặc chọn dòng thì nút đổ xanh. Mức gấp đã tô ở dòng ngày nên nút không đổi màu theo loại. */}
                <span className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-bo-border bg-bo-surface px-4 text-sm font-medium whitespace-nowrap text-bo-foreground shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-colors group-hover:border-bo-primary group-hover:bg-bo-primary group-hover:text-white group-focus-visible:border-bo-primary group-focus-visible:bg-bo-primary group-focus-visible:text-white max-md:w-full md:w-[132px]">
                    {laBienBan ? (
                        <MessageSquareReply className="size-4 text-bo-muted transition-colors group-hover:text-white group-focus-visible:text-white" aria-hidden="true" />
                    ) : (
                        <ReceiptText className="size-4 text-bo-muted transition-colors group-hover:text-white group-focus-visible:text-white" aria-hidden="true" />
                    )}
                    {laBienBan ? t("Trả lời") : t("Báo giá", { context: "nut" })}
                </span>
            </Link>
        </li>
    );
}

function KhongCoViec() {
    return (
        <div className="flex flex-col items-center gap-3 border-t border-bo-border px-6 py-14 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-bo-success-soft text-bo-success">
                <Check className="size-5" aria-hidden="true" />
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
        </div>
    );
}
