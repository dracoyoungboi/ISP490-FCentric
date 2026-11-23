import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    AlertCircle, ArrowLeft, ArrowRight, Ban, Banknote, CalendarClock, Check, CheckCircle2, Info, Loader2, Lock, PackageX,
    Trash2, Truck, Undo2, Warehouse,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import KhungCongNhaCungCap from '@/components/supplier-portal/KhungCongNhaCungCap';
import TheNguoiPhuTrach from '@/components/supplier-portal/TheNguoiPhuTrach';
import { KhungKhongTimThay, KhungLoiTai, KhungXuongCong } from '@/components/supplier-portal/TrangThaiTaiCong';
import { gioVaNgay } from '@/components/supplier-portal/baoGiaUtils';
import {
    GHI_CHU_BIEN_BAN_HIEN_DEM,
    GHI_CHU_BIEN_BAN_TOI_DA,
    HANG_LOI,
    PHUONG_AN,
    choTraLoi,
    coTheChon,
    loiNguoiXacNhan,
    nhanTrangThaiBienBan,
    taoPayloadXacNhan,
    thuocTinhDong,
    tienTruDaChot,
    tienTruDuKien,
} from '@/components/supplier-portal/congUtils';
import { xuLyLoiTai, xuLyLoiXacNhanBienBan } from '@/components/supplier-portal/loiCong';
import { DUONG_DAN_CONG } from '@/components/supplier-portal/phienCong';
import { taiLaiSoViec, useCongNcc, useTieuDeCong } from '@/components/supplier-portal/useCongNcc';
import congNhaCungCapService from '@/services/congNhaCungCapService';
import useTaiDuLieu from '@/hooks/useTaiDuLieu';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { t, tDuLieu } from '@/i18n';

const THE = 'rounded-lg border border-bo-border bg-bo-surface';
const TIEU_DE_COT = 'h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted';
const O_NHAP =
    'w-full rounded-md border bg-bo-surface px-3 text-base text-bo-foreground placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-2 focus-visible:ring-bo-primary/15 focus-visible:outline-none md:text-sm';
const NUT_PHU = 'border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle';

/** Hai cách bù (thứ tự như bản demo đã duyệt: Trừ tiền trước). */
const CACH_BU = [
    {
        ma: PHUONG_AN.TRU_TIEN,
        icon: Banknote,
        ten: () => t("Trừ tiền hàng"),
        moTa: (bb) =>
            t("Không giao lại. Đơn {{soDon}} giảm {{count}} sản phẩm, trừ {{tien}} khi thanh toán.", {
                soDon: bb.soDonMua,
                count: Number(bb.tongSoLuong) || 0,
                tien: formatCurrency(tienTruDuKien(bb)),
            }),
    },
    {
        ma: PHUONG_AN.GIAO_BU,
        icon: Truck,
        ten: () => t("Giao bù hàng"),
        moTa: (bb) =>
            t("Giao lại {{count}} sản phẩm đạt chất lượng. Đơn {{soDon}} vẫn chờ nhận số này.", {
                soDon: bb.soDonMua,
                count: Number(bb.tongSoLuong) || 0,
            }),
    },
];

/** Hàng lỗi còn ở kho: nhận lại hay đồng ý tiêu hủy. */
const CACH_HANG_LOI = [
    {
        ma: HANG_LOI.NHAN_LAI,
        icon: Undo2,
        ten: () => t("Nhận lại"),
        moTa: (bb) =>
            bb.tenKho
                ? t("Quý công ty đến lấy tại {{kho}} hoặc nhờ chúng tôi gửi đơn vị vận chuyển.", { kho: tDuLieu(bb.tenKho) })
                : t("Quý công ty đến lấy hoặc nhờ chúng tôi gửi đơn vị vận chuyển."),
    },
    {
        ma: HANG_LOI.TIEU_HUY,
        icon: Trash2,
        ten: () => t("Đồng ý tiêu hủy"),
        moTa: () => t("Chúng tôi tiêu hủy hàng lỗi, Quý công ty không cần lấy về."),
    },
];
const theoMa = (ds, ma) => ds.find((c) => c.ma === ma) ?? null;

/** Tên lựa chọn đang áp dụng, kèm nguồn khi không phải nhà cung cấp tự chọn (bên mua đóng đơn, quá hạn). */
function tenCachBuDaChon(bb) {
    const cach = theoMa(CACH_BU, bb.phuongAn);
    if (!cach) return null;
    const nguon = bb.cachBuDaChon?.nguon;
    if (nguon === 'TU_DONG') return t("{{cach}} (quá hạn trả lời)", { cach: cach.ten() });
    if (nguon === 'DONG_DON') return t("{{cach}} (bên mua đóng đơn)", { cach: cach.ten() });
    return cach.ten();
}

/** GET biên bản; máy chủ trả rỗng thì coi như không tìm thấy. */
async function taiBienBan(id) {
    const kq = await congNhaCungCapService.bienBan(id);
    if (!kq) throw Object.assign(new Error('khong-co-bien-ban'), { response: { status: 404, data: {} } });
    return kq;
}

/**
 * Cổng nhà cung cấp · Biên bản trả hàng (/supplier/portal/returns/:id): hàng lỗi đang ở đâu, bảng sản phẩm không đạt,
 * khung trả lời hai câu (POST /cong-ncc/bien-ban/{id}/xac-nhan): bù hàng lỗi (trừ tiền / giao bù) và hàng lỗi còn ở kho
 * (nhận lại / đồng ý tiêu hủy). Câu nào đã chốt thì khóa; còn đổi được (`cachBuMo`, `hangLoiMo`) thì có nút Đổi lựa chọn.
 * Biên bản đã hủy: chỉ thông báo.
 */
export default function CongBienBan() {
    const { id } = useParams();
    const { phien, hetPhien, thoat } = useCongNcc();
    const { data, error, dungKhoa, reload, setData } = useTaiDuLieu(() => taiBienBan(id), String(id), { enabled: Boolean(phien) });
    // Câu báo sau khi máy chủ từ chối vì biên bản không còn nhận trả lời (đã tải lại biên bản); gắn với id biên bản
    const [baoKhongConNhan, setBaoKhongConNhan] = useState(null);
    const bb = dungKhoa ? data : undefined;
    const loiTai = error && !bb ? xuLyLoiTai(error) : null;
    const tai = bb ? { trangThai: 'xong' } : loiTai ? { trangThai: loiTai.loai, cau: loiTai.cau } : { trangThai: 'dang-tai' };

    useTieuDeCong(bb?.soBienBan ? t("Biên bản trả hàng {{so}}", { so: bb.soBienBan }) : t("Biên bản trả hàng"));

    useEffect(() => {
        if (loiTai?.loai === 'phien-het-han') hetPhien();
    }, [loiTai?.loai, hetPhien]);

    if (!phien) return null;

    return (
        <KhungCongNhaCungCap tenNhaCungCap={phien.nhaCungCap?.ten} email={phien.nhaCungCap?.email} onThoat={thoat}>
            <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 md:gap-5 md:p-6">
                <Link
                    to={DUONG_DAN_CONG.canXuLy}
                    className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-bo-muted hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" /> {t("Cần xử lý")}
                </Link>

                {tai.trangThai === 'xong' ? (
                    <NoiDungBienBan
                        key={bb.id}
                        bb={bb}
                        emailNcc={phien.nhaCungCap?.email}
                        baoKhongConNhan={baoKhongConNhan?.id === String(id) ? baoKhongConNhan.cau : ''}
                        onCapNhat={(moi) => {
                            setBaoKhongConNhan(null);
                            setData(moi);
                            taiLaiSoViec();
                        }}
                        onKhongConNhan={(cau) => {
                            setBaoKhongConNhan({ id: String(id), cau });
                            reload();
                            taiLaiSoViec();
                        }}
                        onHetPhien={hetPhien}
                    />
                ) : tai.trangThai === 'dang-tai' ? (
                    <KhungXuongCong />
                ) : tai.trangThai === 'khong-tim-thay' ? (
                    <KhungKhongTimThay
                        tieuDe={t("Không tìm thấy biên bản trả hàng")}
                        moTa={t("Biên bản này không thuộc Quý công ty hoặc liên kết không đúng. Biên bản cần trả lời luôn có ở trang Cần xử lý.")}
                    />
                ) : (
                    <KhungLoiTai cau={tai.cau} onThuLai={reload} />
                )}
            </main>
        </KhungCongNhaCungCap>
    );
}

function NoiDungBienBan({ bb, emailNcc, baoKhongConNhan, onCapNhat, onKhongConNhan, onHetPhien }) {
    const daHuy = bb.trangThai === 'DA_HUY';
    const cho = choTraLoi(bb);
    const mo = coTheChon(bb);
    // Đang mở lại khung chọn để đổi lựa chọn (chỉ khi còn gì đổi được)
    const [dangDoi, setDangDoi] = useState(false);
    const moKhungChon = mo && (cho || dangDoi);
    const nhan = nhanTrangThaiBienBan(bb);
    const tieuDeRef = useRef(null);

    return (
        <>
            <div className="flex flex-col gap-1.5">
                <div className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:gap-3">
                    <h1 className="text-xl leading-7 font-bold tracking-tight break-words text-bo-heading md:text-2xl md:leading-8">
                        {t("Biên bản trả hàng {{so}}", { so: bb.soBienBan })}
                    </h1>
                    <span className="self-start md:self-auto">
                        <StatusBadge label={nhan} size="lg" />
                    </span>
                </div>
                <p className="flex flex-wrap gap-x-[18px] gap-y-1 text-sm leading-6 text-slate-600">
                    {bb.soDonMua ? (
                        <span>
                            {t("Đơn mua", { context: "nhan" })} <strong className="font-semibold break-all text-bo-foreground">{bb.soDonMua}</strong>
                        </span>
                    ) : null}
                    {bb.soPhieuNhap ? (
                        <span>
                            {t("Phiếu nhập")} <strong className="font-semibold break-all text-bo-foreground">{bb.soPhieuNhap}</strong>
                        </span>
                    ) : null}
                    {bb.tenKho ? (
                        <span>
                            {t("Kho nhận")} <strong className="font-semibold text-bo-foreground">{tDuLieu(bb.tenKho)}</strong>
                        </span>
                    ) : null}
                    {bb.ngayLap ? <span>{t("Lập ngày {{ngay}}", { ngay: formatDate(bb.ngayLap) })}</span> : null}
                </p>
            </div>

            {baoKhongConNhan ? (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-orange-200 bg-bo-tt-chu-y px-3.5 py-3 text-sm leading-5 text-bo-tt-chu-y-chu">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{baoKhongConNhan}</span>
                </div>
            ) : null}

            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
                <div className="flex min-w-0 flex-col gap-4">
                    <KhoiHangLoi bb={bb} />
                    <BangSanPhamLoi bb={bb} />
                </div>

                <section
                    aria-labelledby="bb-khung-tieu-de"
                    className={cn(THE, 'flex flex-col gap-4 p-4 md:p-5 lg:sticky lg:top-6')}
                >
                    {daHuy ? (
                        <BienBanDaHuy bb={bb} />
                    ) : cho && !mo ? (
                        <DonDaKetThuc bb={bb} />
                    ) : moKhungChon ? (
                        <KhungChon
                            key={dangDoi ? 'doi' : 'chon'}
                            bb={bb}
                            emailNcc={emailNcc}
                            dangDoi={dangDoi && !cho}
                            onHuyDoi={() => {
                                setDangDoi(false);
                                requestAnimationFrame(() => tieuDeRef.current?.focus());
                            }}
                            onXong={(moi) => {
                                setDangDoi(false);
                                onCapNhat(moi);
                                // Đọc ngay kết quả: con trỏ về tiêu đề khung "Đã ghi nhận…"
                                requestAnimationFrame(() => tieuDeRef.current?.focus());
                            }}
                            onKhongConNhan={(cau) => {
                                setDangDoi(false);
                                onKhongConNhan(cau);
                            }}
                            onHetPhien={onHetPhien}
                        />
                    ) : (
                        <DaXacNhan bb={bb} emailNcc={emailNcc} tieuDeRef={tieuDeRef} doiDuoc={mo} onDoi={() => setDangDoi(true)} />
                    )}
                </section>
            </div>
        </>
    );
}

/** Khối "Hàng lỗi …": đang ở kho (theo lựa chọn của Quý công ty), đã giao cho Quý công ty, hoặc đã tiêu hủy. */
function KhoiHangLoi({ bb }) {
    const h = bb.hangLoi ?? {};
    const chon = bb.hangLoiDaChon?.giaTri;
    let Icon = Warehouse;
    let mauIcon = 'bg-amber-50 text-amber-600';
    let tieuDe;
    let moTa = null;
    if (h.trangThai === 'DA_TRA') {
        Icon = Undo2;
        mauIcon = 'bg-bo-surface-subtle text-slate-600';
        tieuDe = h.nguoiNhan
            ? t("Hàng lỗi đã giao {{nguoiNhan}}", { nguoiNhan: h.bienSoXe ? `${h.nguoiNhan} (${h.bienSoXe})` : h.nguoiNhan })
            : t("Hàng lỗi đã trả cho Quý công ty");
        moTa = h.thoiDiem ? t("Bàn giao lúc {{luc}}.", { luc: gioVaNgay(h.thoiDiem) }) : null;
    } else if (h.trangThai === 'DA_TIEU_HUY') {
        Icon = PackageX;
        mauIcon = 'bg-bo-surface-subtle text-slate-600';
        tieuDe = t("Hàng lỗi đã được tiêu hủy theo đồng ý của Quý công ty");
        moTa = h.thoiDiem ? t("Tiêu hủy lúc {{luc}}.", { luc: gioVaNgay(h.thoiDiem) }) : null;
    } else {
        const kho = bb.tenKho ? tDuLieu(bb.tenKho) : t("kho của chúng tôi");
        if (chon === HANG_LOI.TIEU_HUY) {
            Icon = Trash2;
            tieuDe = t("Hàng lỗi đang ở {{kho}}, chờ tiêu hủy theo đồng ý của Quý công ty", { kho });
        } else if (chon === HANG_LOI.NHAN_LAI) {
            tieuDe = t("Hàng lỗi đang ở {{kho}}, chờ Quý công ty lấy về", { kho });
            moTa = bb.diaChiKho
                ? t("Địa chỉ lấy hàng: {{diaChi}}. Báo trước cho người phụ trách để chúng tôi chuẩn bị hàng và biên bản bàn giao.", { diaChi: bb.diaChiKho })
                : t("Báo trước cho người phụ trách để chúng tôi chuẩn bị hàng và biên bản bàn giao.");
        } else {
            tieuDe = t("Hàng lỗi đang ở {{kho}}, chờ Quý công ty chọn nhận lại hay tiêu hủy", { kho });
            moTa = t("Chúng tôi giữ hàng lỗi ở kho và chỉ tiêu hủy khi Quý công ty đồng ý.");
        }
    }
    return (
        <section aria-label={t("Hàng lỗi")} className={cn(THE, 'flex items-start gap-3 px-4 py-3.5')}>
            <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-md', mauIcon)}>
                <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 text-sm">
                <p className="font-semibold break-words text-bo-heading">{tieuDe}</p>
                {moTa ? <p className="mt-0.5 text-[13px] leading-5 break-words text-bo-muted">{moTa}</p> : null}
            </div>
        </section>
    );
}

function BangSanPhamLoi({ bb }) {
    const dong = bb.dong ?? [];
    const tongSl = Number(bb.tongSoLuong) || dong.reduce((s, d) => s + (Number(d.soLuong) || 0), 0);
    const tongTien = Number(bb.tongGiaTri) || dong.reduce((s, d) => s + (Number(d.giaTri) || 0), 0);
    const giaTri = (d) => (d.giaTri != null ? d.giaTri : (Number(d.soLuong) || 0) * (Number(d.donGia) || 0));
    return (
        <section aria-labelledby="bb-san-pham" className={cn(THE, 'overflow-hidden')}>
            <div className="flex items-center justify-between gap-3 border-b border-bo-border px-4 py-3.5 md:px-5">
                <h2 id="bb-san-pham" className="text-[15px] font-semibold text-bo-heading">{t("Sản phẩm không đạt")}</h2>
                <span className="text-[13px] text-bo-muted">
                    {t("{{soDong}} dòng · {{count}} sản phẩm", { soDong: dong.length, count: tongSl })}
                </span>
            </div>
            {/* Máy tính: bảng; điện thoại: thẻ từng sản phẩm */}
            <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[680px] text-sm">
                    <thead>
                        <tr className="border-b border-bo-border bg-bo-surface-subtle">
                            <th scope="col" className={TIEU_DE_COT}>{t("Sản phẩm")}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Lô")}</th>
                            <th scope="col" className={TIEU_DE_COT}>{t("Lý do")}</th>
                            <th scope="col" className={cn(TIEU_DE_COT, 'text-right')}>{t("SL")}</th>
                            <th scope="col" className={cn(TIEU_DE_COT, 'text-right')}>{t("Đơn giá")}</th>
                            <th scope="col" className={cn(TIEU_DE_COT, 'text-right')}>{t("Giá trị")}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                        {dong.map((d, i) => {
                            const thuocTinh = thuocTinhDong(d);
                            return (
                                <tr key={`${d.sku}-${d.maLo}-${i}`}>
                                    <td className="px-4 py-3">
                                        <div className="font-semibold text-bo-foreground">{d.tenSanPham}</div>
                                        <div className="text-xs text-bo-muted">
                                            {thuocTinh}
                                            {thuocTinh && d.sku ? ' · ' : null}
                                            {d.sku ? <span className="font-mono">{d.sku}</span> : null}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.maLo || '—'}</td>
                                    <td className="px-4 py-3">{tDuLieu(d.lyDo) || '—'}</td>
                                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{d.soLuong}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatCurrency(d.donGia)}</td>
                                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(giaTri(d))}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="border-t border-bo-border bg-bo-surface-subtle font-semibold">
                            <td className="h-12 px-4" colSpan={3}>{t("Tổng cộng")}</td>
                            <td className="px-4 text-right tabular-nums">{tongSl}</td>
                            <td />
                            <td className="px-4 text-right tabular-nums">{formatCurrency(tongTien)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <ul className="divide-y divide-bo-border md:hidden">
                {dong.map((d, i) => (
                    <li key={`${d.sku}-${d.maLo}-${i}`} className="px-4 py-3">
                        <div className="flex justify-between gap-3">
                            <span className="min-w-0 font-semibold break-words text-bo-foreground">{d.tenSanPham}</span>
                            <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(giaTri(d))}</span>
                        </div>
                        <div className="mt-0.5 text-xs break-words text-bo-muted">
                            {[thuocTinhDong(d), tDuLieu(d.lyDo), `${d.soLuong} × ${formatCurrency(d.donGia)}`].filter(Boolean).join(' · ')}
                        </div>
                        {d.maLo ? <div className="mt-0.5 font-mono text-[11px] break-all text-bo-muted">{d.maLo}</div> : null}
                    </li>
                ))}
                <li className="flex justify-between bg-bo-surface-subtle px-4 py-3 font-semibold">
                    <span>{t("Tổng · {{count}} sản phẩm", { count: tongSl })}</span>
                    <span className="tabular-nums">{formatCurrency(tongTien)}</span>
                </li>
            </ul>
        </section>
    );
}

/**
 * Một câu hỏi trong khung trả lời (nhóm nút chọn một). `moDuoc`: các mã còn chọn được; mã đang áp dụng luôn hiện chọn.
 * Không còn gì chọn được thì thành một dòng khóa "đã chốt".
 */
function CauHoi({ id, ten, ds, bb, giaTri, hienTai, tenKhoa, moDuoc, dangGui, onChon }) {
    if (!moDuoc.length) {
        return tenKhoa ? (
            <div className="flex items-start gap-2.5 rounded-md bg-bo-surface-subtle px-3.5 py-3 text-sm">
                <Lock className="mt-0.5 size-4 shrink-0 text-bo-muted" aria-hidden="true" />
                <span className="min-w-0">
                    <span className="text-bo-muted">{ten}: </span>
                    <span className="font-medium text-bo-foreground">{tenKhoa}</span>
                    <span className="text-bo-muted"> · {t("đã chốt")}</span>
                </span>
            </div>
        ) : null;
    }
    return (
        <fieldset className="flex flex-col gap-2" disabled={dangGui}>
            <legend className="mb-2 text-sm font-semibold text-bo-foreground">{ten}</legend>
            {ds.map((c) => {
                const bat = giaTri === c.ma;
                const khoa = c.ma !== hienTai && !moDuoc.includes(c.ma);
                const Icon = c.icon;
                return (
                    <label
                        key={c.ma}
                        className={cn(
                            'grid grid-cols-[16px_minmax(0,1fr)_20px] gap-x-3 gap-y-0.5 rounded-md border bg-bo-surface p-3.5 text-left has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bo-primary/30',
                            khoa ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
                            bat ? 'border-bo-primary shadow-[inset_0_0_0_1px_var(--color-bo-primary)]' : 'border-bo-border',
                            !bat && !khoa && 'hover:border-slate-300',
                        )}
                    >
                        <input
                            type="radio"
                            name={id}
                            value={c.ma}
                            checked={bat}
                            disabled={khoa}
                            onChange={() => onChon(c.ma)}
                            className="sr-only"
                        />
                        <span aria-hidden="true" className={cn('mt-0.5 grid size-4 place-items-center rounded-full border-[1.5px]', bat ? 'border-bo-primary' : 'border-slate-300')}>
                            {bat ? <span className="size-2 rounded-full bg-bo-primary" /> : null}
                        </span>
                        <span className="text-sm font-semibold text-bo-foreground">{c.ten()}</span>
                        <Icon className={cn('size-5', bat ? 'text-bo-primary' : 'text-bo-muted')} aria-hidden="true" />
                        <span className="col-start-2 col-end-4 text-[13px] leading-5 text-bo-muted">{c.moTa(bb)}</span>
                    </label>
                );
            })}
        </fieldset>
    );
}

/**
 * Khung trả lời: bù hàng lỗi và (khi hàng lỗi còn ở kho) nhận lại hay đồng ý tiêu hủy. Lần đầu phải chọn mọi câu còn mở;
 * `dangDoi`: mở lại để đổi (điền sẵn lựa chọn đang áp dụng, phải đổi ít nhất một câu mới gửi được).
 */
function KhungChon({ bb, emailNcc, dangDoi, onHuyDoi, onXong, onKhongConNhan, onHetPhien }) {
    const cachBuHienTai = bb.phuongAn !== PHUONG_AN.CHO_CHOT ? bb.phuongAn : null;
    const hangLoiHienTai = bb.hangLoiDaChon?.giaTri ?? null;
    const cachBuMo = bb.cachBuMo ?? [];
    const hangLoiMo = bb.hangLoiMo ?? [];
    const [cachBu, setCachBu] = useState(cachBuHienTai);
    const [hangLoi, setHangLoi] = useState(hangLoiHienTai);
    const [nguoi, setNguoi] = useState(
        () => bb.hangLoiDaChon?.nguoiXacNhan || bb.cachBuDaChon?.nguoiXacNhan || bb.nguoiLienHeNcc || '',
    );
    const [ghiChu, setGhiChu] = useState('');
    const [loiNguoi, setLoiNguoi] = useState('');
    const [loiGui, setLoiGui] = useState('');
    const [dangGui, setDangGui] = useState(false);
    const dangGuiRef = useRef(false);
    const oNguoiRef = useRef(null);

    // Câu còn mở mà chưa có lựa chọn nào thì bắt buộc chọn; đổi lựa chọn thì phải khác lựa chọn đang áp dụng
    const thieu = (cachBuMo.length > 0 && !cachBu) || (hangLoiMo.length > 0 && !hangLoi);
    const coDoi = cachBu !== cachBuHienTai || hangLoi !== hangLoiHienTai;
    const guiDuoc = !thieu && coDoi;

    const chon = (dat) => (ma) => {
        dat(ma);
        setLoiGui('');
    };

    const gui = async (e) => {
        e.preventDefault();
        if (dangGuiRef.current || !guiDuoc) return;
        const loi = loiNguoiXacNhan(nguoi);
        if (loi) {
            setLoiNguoi(loi);
            oNguoiRef.current?.focus();
            return;
        }
        dangGuiRef.current = true;
        setDangGui(true);
        setLoiGui('');
        try {
            const luaChon = { phuongAn: cachBuMo.length ? cachBu : null, hangLoi: hangLoiMo.length ? hangLoi : null };
            onXong(await congNhaCungCapService.xacNhanBienBan(bb.id, taoPayloadXacNhan(luaChon, nguoi, ghiChu, bb.phienBan)));
        } catch (err) {
            const kq = xuLyLoiXacNhanBienBan(err);
            if (kq.loai === 'phien-het-han') onHetPhien();
            else if (kq.loai === 'khong-con-nhan') onKhongConNhan(kq.cau);
            else if (kq.loai === 'khong-tim-thay') onKhongConNhan(kq.cau || t("Biên bản không còn trên cổng. Tải lại trang để xem việc mới nhất."));
            else if (kq.loai === 'du-lieu-sai' && kq.o === 'nguoiXacNhan') {
                // Máy chủ chỉ ra ô sai: báo ngay dưới ô và đưa con trỏ về đó
                setLoiNguoi(kq.cau);
                requestAnimationFrame(() => oNguoiRef.current?.focus());
            } else setLoiGui(kq.cau || t("Chưa gửi được lựa chọn. Kiểm tra kết nối mạng rồi thử lại."));
        } finally {
            dangGuiRef.current = false;
            setDangGui(false);
        }
    };

    const conLai = GHI_CHU_BIEN_BAN_TOI_DA - ghiChu.length;
    let nhanNut = dangDoi ? t("Lưu thay đổi") : t("Gửi lựa chọn");
    if (thieu) nhanNut = t("Chọn đủ các mục ở trên");
    else if (!coDoi) nhanNut = t("Chọn khác để đổi");

    return (
        <form onSubmit={gui} noValidate className="flex flex-col gap-4">
            <div>
                <h2 id="bb-khung-tieu-de" className="text-[15px] font-semibold text-bo-heading">
                    {dangDoi ? t("Đổi lựa chọn") : t("Quý công ty chọn cách xử lý")}
                </h2>
                <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">
                    {t("Áp dụng cho cả {{count}} sản phẩm của biên bản.", { count: Number(bb.tongSoLuong) || 0 })}
                </p>
                {!dangDoi && bb.hanTraLoi ? (
                    <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-bo-warning">
                        <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
                        {t("Trả lời trước hết ngày {{ngay}}", { ngay: formatDate(bb.hanTraLoi) })}
                    </p>
                ) : null}
            </div>

            <CauHoi
                id="bb-cach-bu"
                ten={t("Bù hàng lỗi")}
                ds={CACH_BU}
                bb={bb}
                giaTri={cachBu}
                hienTai={cachBuHienTai}
                tenKhoa={tenCachBuDaChon(bb)}
                moDuoc={cachBuMo}
                dangGui={dangGui}
                onChon={chon(setCachBu)}
            />
            <CauHoi
                id="bb-hang-loi"
                ten={t("Hàng lỗi đang ở kho")}
                ds={CACH_HANG_LOI}
                bb={bb}
                giaTri={hangLoi}
                hienTai={hangLoiHienTai}
                tenKhoa={null}
                moDuoc={hangLoiMo}
                dangGui={dangGui}
                onChon={chon(setHangLoi)}
            />

            <div className="flex flex-col gap-1.5">
                <label htmlFor="bb-nguoi-xac-nhan" className="text-sm font-medium text-bo-foreground">
                    {t("Người xác nhận")} <span className="text-bo-danger" aria-hidden="true">*</span>
                </label>
                <input
                    ref={oNguoiRef}
                    id="bb-nguoi-xac-nhan"
                    autoComplete="name"
                    value={nguoi}
                    disabled={dangGui}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(loiNguoi)}
                    aria-describedby={loiNguoi ? 'bb-nguoi-loi' : undefined}
                    onChange={(e) => {
                        setNguoi(e.target.value);
                        if (loiNguoi) setLoiNguoi('');
                    }}
                    onBlur={(e) => setLoiNguoi(loiNguoiXacNhan(e.target.value))}
                    className={cn(O_NHAP, 'h-10', loiNguoi ? 'border-bo-danger' : 'border-bo-border')}
                />
                {loiNguoi ? (
                    <p id="bb-nguoi-loi" className="flex items-center gap-1.5 text-[13px] leading-5 text-bo-danger">
                        <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                        {loiNguoi}
                    </p>
                ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
                <label htmlFor="bb-ghi-chu" className="text-sm font-medium text-bo-foreground">
                    {t("Ghi chú")} <span className="font-normal text-bo-muted">{t("(không bắt buộc)")}</span>
                </label>
                <textarea
                    id="bb-ghi-chu"
                    rows={2}
                    value={ghiChu}
                    disabled={dangGui}
                    maxLength={GHI_CHU_BIEN_BAN_TOI_DA}
                    aria-describedby={ghiChu.length >= GHI_CHU_BIEN_BAN_HIEN_DEM ? 'bb-ghi-chu-dem' : undefined}
                    placeholder={t("VD: Giao bù cùng đợt hàng tới, xe đến lấy hàng lỗi thứ Sáu")}
                    onChange={(e) => setGhiChu(e.target.value.slice(0, GHI_CHU_BIEN_BAN_TOI_DA))}
                    className={cn(O_NHAP, 'resize-y border-bo-border py-2')}
                />
                {ghiChu.length >= GHI_CHU_BIEN_BAN_HIEN_DEM ? (
                    <p id="bb-ghi-chu-dem" className={cn('text-right text-xs tabular-nums', conLai <= 0 ? 'text-bo-warning' : 'text-bo-muted')}>
                        {ghiChu.length}/{GHI_CHU_BIEN_BAN_TOI_DA}
                    </p>
                ) : null}
            </div>

            {loiGui ? (
                <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-bo-danger-soft px-3 py-2.5 text-sm leading-5 text-bo-danger-strong">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{loiGui}</span>
                </div>
            ) : null}

            <div className="flex flex-col gap-2">
                {/* Lần trả lời đầu là xác nhận của nhà cung cấp với số hàng lỗi (người giao hàng chỉ ký nhận lúc kiểm) */}
                {!dangDoi ? (
                    <p className="text-[13px] leading-5 text-bo-muted">
                        {t("Gửi lựa chọn nghĩa là Quý công ty đồng ý số hàng lỗi trong biên bản {{so}}.", { so: bb.soBienBan })}
                    </p>
                ) : null}
                <Button
                    type="submit"
                    disabled={!guiDuoc || dangGui}
                    aria-busy={dangGui || undefined}
                    className="h-11 w-full gap-2 bg-bo-primary text-[15px] text-white hover:bg-bo-primary-hover disabled:opacity-50"
                >
                    {dangGui ? (
                        <>
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t("Đang gửi...")}
                        </>
                    ) : (
                        <>
                            <Check className="size-4" aria-hidden="true" /> {nhanNut}
                        </>
                    )}
                </Button>
                {dangDoi ? (
                    <Button type="button" variant="outline" disabled={dangGui} onClick={onHuyDoi} className={cn('h-10 w-full', NUT_PHU)}>
                        {t("Giữ lựa chọn cũ")}
                    </Button>
                ) : null}
            </div>
            <p className="text-xs leading-5 text-bo-muted">
                {emailNcc
                    ? t("Chúng tôi nhận được ngay và gửi email xác nhận kèm biên bản cập nhật tới {{email}}.", { email: emailNcc })
                    : t("Chúng tôi nhận được ngay.")}
                {!bb.phieuDaNhap && bb.soPhieuNhap
                    ? ` ${t("Cách bù đổi được đến khi chúng tôi nhập kho phiếu {{soPhieu}}.", { soPhieu: bb.soPhieuNhap })}`
                    : null}
            </p>
        </form>
    );
}

/** Dòng "Đơn mua" sau khi xác nhận: theo số thật của máy chủ (đã trừ, hàng bù đã nhận / còn chờ). */
function dongDonMua(bb) {
    if (bb.phuongAn === PHUONG_AN.GIAO_BU) {
        if (bb.buXong) return t("{{soDon}} đã nhận đủ hàng bù", { soDon: bb.soDonMua });
        const conLai = Number(bb.conChoGiao) || 0;
        return conLai > 0 ? t("{{soDon}} còn {{count}} sản phẩm chờ giao bù", { soDon: bb.soDonMua, count: conLai }) : bb.soDonMua;
    }
    const daTru = Number(bb.soLuongTruTien) || 0;
    return daTru > 0 ? t("{{soDon}} giảm {{count}} sản phẩm", { soDon: bb.soDonMua, count: daTru }) : bb.soDonMua;
}

/** Hàng lỗi sau khi trả lời: đã rời kho thì nói đã giao / đã tiêu hủy, còn ở kho thì lựa chọn đang áp dụng. */
function dongHangLoi(bb) {
    const h = bb.hangLoi?.trangThai;
    if (h === 'DA_TRA') return t("Đã giao trả");
    if (h === 'DA_TIEU_HUY') return t("Đã tiêu hủy");
    return theoMa(CACH_HANG_LOI, bb.hangLoiDaChon?.giaTri)?.ten() ?? null;
}

function DaXacNhan({ bb, emailNcc, tieuDeRef, doiDuoc, onDoi }) {
    // Lần trả lời gần nhất của nhà cung cấp (cách bù và hàng lỗi thường cùng một lần)
    const lanNcc = [bb.cachBuDaChon, bb.hangLoiDaChon]
        .filter((x) => x?.nguon === 'CONG_NCC' && x.luc)
        .sort((a, b) => new Date(b.luc) - new Date(a.luc))[0];
    const luc = lanNcc ? gioVaNgay(lanNcc.luc) : null;
    const ghiChu = [...new Set([bb.cachBuDaChon, bb.hangLoiDaChon].filter((x) => x?.nguon === 'CONG_NCC').map((x) => x.ghiChu).filter(Boolean))].join(' · ');
    const hangLoi = dongHangLoi(bb);
    let dongPhu = null;
    if (luc && emailNcc) dongPhu = t("Lúc {{luc}} · email xác nhận đã gửi tới {{email}}", { luc, email: emailNcc });
    else if (luc) dongPhu = t("Lúc {{luc}}", { luc });

    return (
        <>
            <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bo-success-soft text-bo-success">
                    <CheckCircle2 className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h2 id="bb-khung-tieu-de" ref={tieuDeRef} tabIndex={-1} className="text-[15px] font-semibold text-bo-heading focus:outline-none">
                        {t("Đã ghi nhận lựa chọn")}
                    </h2>
                    {dongPhu ? <p className="mt-0.5 text-[13px] leading-5 break-words text-bo-muted">{dongPhu}</p> : null}
                </div>
            </div>
            <dl className="grid grid-cols-[minmax(96px,auto)_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-md bg-bo-surface-subtle px-3.5 py-3 text-sm">
                <dt className="text-bo-muted">{t("Bù hàng lỗi")}</dt>
                <dd className="font-medium">{tenCachBuDaChon(bb) ?? '—'}</dd>
                {bb.phuongAn === PHUONG_AN.TRU_TIEN && tienTruDaChot(bb) ? (
                    <>
                        <dt className="text-bo-muted">{bb.phieuDaNhap ? t("Số tiền trừ") : t("Số tiền trừ dự kiến")}</dt>
                        <dd className="font-semibold tabular-nums">−{formatCurrency(tienTruDaChot(bb))}</dd>
                    </>
                ) : null}
                {bb.soDonMua ? (
                    <>
                        <dt className="text-bo-muted">{t("Đơn mua", { context: "nhan" })}</dt>
                        <dd className="break-words">{dongDonMua(bb)}</dd>
                    </>
                ) : null}
                {hangLoi ? (
                    <>
                        <dt className="text-bo-muted">{t("Hàng lỗi")}</dt>
                        <dd className="font-medium">{hangLoi}</dd>
                    </>
                ) : null}
                {lanNcc?.nguoiXacNhan ? (
                    <>
                        <dt className="text-bo-muted">{t("Người xác nhận")}</dt>
                        <dd className="break-words">{lanNcc.nguoiXacNhan}</dd>
                    </>
                ) : null}
                {ghiChu ? (
                    <>
                        <dt className="text-bo-muted">{t("Ghi chú")}</dt>
                        <dd className="break-words whitespace-pre-line">{ghiChu}</dd>
                    </>
                ) : null}
            </dl>
            <p className="flex items-start gap-2 text-[13px] leading-5 text-slate-600">
                <Info className="mt-0.5 size-4 shrink-0 text-bo-muted" aria-hidden="true" />
                <span>
                    {doiDuoc
                        ? t("Quý công ty còn đổi được lựa chọn chưa chốt. Phần đã chốt cần đổi, xin liên hệ người phụ trách mua hàng.")
                        : t("Các lựa chọn đã chốt. Cần đổi, xin liên hệ người phụ trách mua hàng.")}
                </span>
            </p>
            {!doiDuoc && bb.nguoiPhuTrach ? <TheNguoiPhuTrach nguoi={bb.nguoiPhuTrach} className="border-0 bg-bo-surface-subtle p-3.5 md:p-3.5" /> : null}
            <div className="flex flex-col gap-2 sm:flex-row">
                {doiDuoc ? (
                    <Button type="button" variant="outline" onClick={onDoi} className={cn('h-10 flex-1', NUT_PHU)}>
                        {t("Đổi lựa chọn")}
                    </Button>
                ) : null}
                <Button asChild className="h-10 flex-1 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                    <Link to={DUONG_DAN_CONG.canXuLy}>
                        {t("Việc tiếp theo")} <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                </Button>
            </div>
        </>
    );
}


/** Chưa chọn mà máy chủ không còn nhận trả lời (đơn mua đã kết thúc): chỉ thông báo, không có khung chọn. */
function DonDaKetThuc({ bb }) {
    return (
        <>
            <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bo-surface-subtle text-bo-muted">
                    <Info className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h2 id="bb-khung-tieu-de" className="text-[15px] font-semibold text-bo-heading">{t("Không còn chọn được trên cổng")}</h2>
                    <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">
                        {t("Đơn mua của biên bản này đã kết thúc, vui lòng liên hệ người phụ trách.")}
                    </p>
                </div>
            </div>
            {bb.nguoiPhuTrach ? <TheNguoiPhuTrach nguoi={bb.nguoiPhuTrach} className="border-0 bg-bo-surface-subtle p-3.5 md:p-3.5" /> : null}
            <Button asChild className="h-10 w-full gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                <Link to={DUONG_DAN_CONG.canXuLy}>
                    {t("Việc tiếp theo")} <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
            </Button>
        </>
    );
}

function BienBanDaHuy({ bb }) {
    return (
        <>
            <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bo-surface-subtle text-bo-muted">
                    <Ban className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h2 id="bb-khung-tieu-de" className="text-[15px] font-semibold text-bo-heading">{t("Biên bản đã hủy")}</h2>
                    <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">
                        {t("Chúng tôi đã hủy biên bản này nên Quý công ty không cần trả lời. Cần trao đổi, vui lòng liên hệ người phụ trách mua hàng.")}
                    </p>
                </div>
            </div>
            {bb.nguoiPhuTrach ? <TheNguoiPhuTrach nguoi={bb.nguoiPhuTrach} className="border-0 bg-bo-surface-subtle p-3.5 md:p-3.5" /> : null}
            <Button asChild className="h-10 w-full gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                <Link to={DUONG_DAN_CONG.canXuLy}>
                    {t("Việc tiếp theo")} <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
            </Button>
        </>
    );
}
