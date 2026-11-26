import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    AlertCircle, ArrowLeft, ArrowRight, Ban, Banknote, CalendarClock, Check, CheckCircle2, Info, Loader2, Lock, PackageX,
    Plus, Scale, ShieldCheck, Trash2, TriangleAlert, Truck, Undo2, Warehouse,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusBadge from '@/components/shared/StatusBadge';
import KhungCongNhaCungCap from '@/components/supplier-portal/KhungCongNhaCungCap';
import HopHoiRoiTrang from '@/components/supplier-portal/HopHoiRoiTrang';
import useHoiKhiRoiTrang from '@/hooks/useHoiKhiRoiTrang';
import TheNguoiPhuTrach from '@/components/supplier-portal/TheNguoiPhuTrach';
import { KhungKhongTimThay, KhungLoiTai, KhungXuongCong } from '@/components/supplier-portal/TrangThaiTaiCong';
import { gioVaNgay } from '@/components/supplier-portal/baoGiaUtils';
import { lyDoBienBanTraHang } from '@/constants/nhapKho';
import {
    GHI_CHU_BIEN_BAN_HIEN_DEM,
    GHI_CHU_BIEN_BAN_TOI_DA,
    HANG_LOI,
    PHUONG_AN,
    apDungNhanh,
    choTraLoi,
    chuKyLuaChon,
    coDongDoi,
    coTheChon,
    dongConThieu,
    dongOKho,
    giaTriChung,
    khoiTaoLuaChon,
    loiNguoiXacNhan,
    luaChonHienTai,
    luaChonHieuLuc,
    moCachBu,
    moHangLoi,
    nhanTrangThaiBienBan,
    soDongMo,
    soSanPhamConThieu,
    soTieuHuyMoi,
    taoPayloadTheoDong,
    thuocTinhDong,
    tomTatLuaChon,
    trangThaiTheDong,
    truTienDong,
} from '@/components/supplier-portal/congUtils';
import { xuLyLoiTai, xuLyLoiXacNhanBienBan } from '@/components/supplier-portal/loiCong';
import { DUONG_DAN_CONG } from '@/components/supplier-portal/phienCong';
import { taiLaiSoViec, useCongNcc, useTieuDeCong } from '@/components/supplier-portal/useCongNcc';
import { chuanHoaHoTen } from '@/validations/hoTen';
import congNhaCungCapService from '@/services/congNhaCungCapService';
import useTaiDuLieu from '@/hooks/useTaiDuLieu';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { t, tDuLieu } from '@/i18n';

/** Lề trong của khối biên bản (20px điện thoại, 32px máy tính), thẳng mép các phần chia bằng đường kẻ. */
const LE = 'px-5 md:px-8';
const O_NHAP =
    'w-full rounded-lg border bg-bo-surface px-3 text-base text-bo-foreground placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-2 focus-visible:ring-bo-primary/15 focus-visible:outline-none md:text-sm';
const NUT_PHU = 'border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle';
const TIEU_DE_PHAN = 'text-[13px] font-semibold tracking-wide text-bo-muted uppercase';

const tenKho = (bb) => (bb.tenKho ? tDuLieu(bb.tenKho) : t("kho của chúng tôi"));

/** Hai cách bù của một dòng (thứ tự như bản demo đã duyệt: Trừ tiền trước). Mô tả theo số lượng, giá trị của dòng. */
const CACH_BU = [
    {
        ma: PHUONG_AN.TRU_TIEN,
        icon: Banknote,
        ten: () => t("Trừ tiền hàng"),
        phu: (d) =>
            Number(d.giaTri) > 0 ? `−${formatCurrency(Number(d.giaTri))}` : t("{{count}} sản phẩm", { count: Number(d.soLuong) || 0 }),
        moTa: (d, bb) =>
            t("Không giao lại. Đơn {{soDon}} giảm {{count}} sản phẩm, trừ {{tien}} khi thanh toán.", {
                soDon: bb.soDonMua,
                count: Number(d.soLuong) || 0,
                tien: formatCurrency(Number(d.giaTri) || 0),
            }),
    },
    {
        ma: PHUONG_AN.GIAO_BU,
        icon: Truck,
        ten: () => t("Giao bù hàng"),
        phu: (d) => t("{{count}} sản phẩm", { count: Number(d.soLuong) || 0 }),
        moTa: (d, bb) =>
            t("Giao lại {{count}} sản phẩm đạt chất lượng. Đơn {{soDon}} vẫn chờ nhận số này.", {
                soDon: bb.soDonMua,
                count: Number(d.soLuong) || 0,
            }),
    },
];

/** Hàng lỗi của dòng còn ở kho: nhận lại hay đồng ý tiêu hủy. */
const CACH_HANG_LOI = [
    {
        ma: HANG_LOI.NHAN_LAI,
        icon: Undo2,
        ten: () => t("Nhận lại"),
        phu: (d, bb) => t("tại {{kho}}", { kho: tenKho(bb) }),
        moTa: (d, bb) =>
            bb.tenKho
                ? t("Quý công ty đến lấy tại {{kho}} hoặc nhờ chúng tôi gửi đơn vị vận chuyển.", { kho: tDuLieu(bb.tenKho) })
                : t("Quý công ty đến lấy hoặc nhờ chúng tôi gửi đơn vị vận chuyển."),
    },
    {
        ma: HANG_LOI.TIEU_HUY,
        icon: Trash2,
        ten: () => t("Đồng ý tiêu hủy"),
        phu: () => t("không cần lấy về"),
        moTa: () => t("Chúng tôi tiêu hủy hàng lỗi, Quý công ty không cần lấy về."),
    },
];
const theoMa = (ds, ma) => ds.find((c) => c.ma === ma) ?? null;

/** GET biên bản; máy chủ trả rỗng thì coi như không tìm thấy. */
async function taiBienBan(id) {
    const kq = await congNhaCungCapService.bienBan(id);
    if (!kq) throw Object.assign(new Error('khong-co-bien-ban'), { response: { status: 404, data: {} } });
    return kq;
}

/**
 * Cổng nhà cung cấp · Biên bản trả hàng (/supplier/portal/returns/:id). Cả biên bản trong một khối: đầu biên bản, tiến
 * trình, hàng lỗi đang ở đâu, danh sách sản phẩm không đạt — mỗi sản phẩm một thẻ với hai câu của riêng nó (bù hàng lỗi:
 * trừ tiền / giao bù; hàng lỗi ở kho: nhận lại / đồng ý tiêu hủy) — và cột trả lời bên phải (tóm tắt phương án, người
 * xác nhận, ghi chú, nút Xem lại và xác nhận mở hộp xác nhận chính thức). Câu nào đã chốt thì khóa trên thẻ; còn đổi được
 * thì có nút Đổi lựa chọn. Biên bản đã hủy: chỉ thông báo.
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
                        nhaCungCap={phien.nhaCungCap}
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

function NoiDungBienBan({ bb, nhaCungCap, baoKhongConNhan, onCapNhat, onKhongConNhan, onHetPhien }) {
    const daHuy = bb.trangThai === 'DA_HUY';
    const cho = choTraLoi(bb);
    const mo = coTheChon(bb);
    // Đang mở lại các thẻ để đổi lựa chọn (chỉ khi còn gì đổi được)
    const [dangDoi, setDangDoi] = useState(false);
    const moKhungChon = !daHuy && mo && (cho || dangDoi);
    const tieuDeRef = useRef(null);
    const veTieuDe = () => requestAnimationFrame(() => tieuDeRef.current?.focus());

    return (
        <article aria-labelledby="bb-tieu-de" className="overflow-clip rounded-xl border border-bo-border bg-bo-surface shadow-[0_1px_2px_rgb(16_24_40/0.04)]">
            <DauBienBan bb={bb} />
            <TienTrinh bb={bb} />
            {baoKhongConNhan ? (
                <div role="alert" className={cn(LE, 'flex items-start gap-2 border-b border-orange-200 bg-bo-tt-chu-y py-3 text-sm leading-5 text-bo-tt-chu-y-chu')}>
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{baoKhongConNhan}</span>
                </div>
            ) : null}

            {moKhungChon ? (
                <TraLoiTheoDong
                    // Dữ liệu biên bản đổi (tải lại sau khi máy chủ từ chối, kho vừa ghi…): dựng lại từ lựa chọn mới
                    key={`${dangDoi ? 'doi' : 'chon'}-${chuKyLuaChon(bb)}`}
                    bb={bb}
                    nhaCungCap={nhaCungCap}
                    dangDoi={dangDoi && !cho}
                    onHuyDoi={() => {
                        setDangDoi(false);
                        veTieuDe();
                    }}
                    onXong={(moi) => {
                        setDangDoi(false);
                        onCapNhat(moi);
                        // Đọc ngay kết quả: con trỏ về tiêu đề khung "Đã ghi nhận…"
                        veTieuDe();
                    }}
                    onKhongConNhan={(cau) => {
                        setDangDoi(false);
                        onKhongConNhan(cau);
                    }}
                    onHetPhien={onHetPhien}
                />
            ) : (
                <BoCuc
                    trai={
                        <>
                            <KhoiHangLoi bb={bb} />
                            <DanhSachDong bb={bb} />
                        </>
                    }
                    phai={
                        daHuy ? (
                            <BienBanDaHuy bb={bb} />
                        ) : cho && !mo ? (
                            <DonDaKetThuc bb={bb} />
                        ) : (
                            <DaXacNhan bb={bb} emailNcc={nhaCungCap?.email} tieuDeRef={tieuDeRef} doiDuoc={mo} onDoi={() => setDangDoi(true)} />
                        )
                    }
                />
            )}
        </article>
    );
}

/** Hai cột của khối: trái là hàng lỗi + danh sách sản phẩm, phải là khung trả lời (dính khi cuộn trên máy tính). */
function BoCuc({ trai, phai }) {
    return (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="min-w-0 pb-6 lg:pb-8">{trai}</div>
            <aside className="border-t border-bo-border bg-bo-surface-subtle lg:border-t-0 lg:border-l">
                <div className="flex flex-col gap-4 px-5 py-6 md:px-8 lg:sticky lg:top-6 lg:px-6">{phai}</div>
            </aside>
        </div>
    );
}

function DauBienBan({ bb }) {
    return (
        <header className={cn(LE, 'flex flex-col gap-1.5 pt-6 pb-5')}>
            <div className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:gap-3">
                <h1 id="bb-tieu-de" className="text-xl leading-7 font-bold tracking-tight break-words text-bo-heading md:text-2xl md:leading-8">
                    {t("Biên bản trả hàng {{so}}", { so: bb.soBienBan })}
                </h1>
                <span className="self-start md:self-auto">
                    <StatusBadge label={nhanTrangThaiBienBan(bb)} size="lg" />
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
        </header>
    );
}

/** Lần nhà cung cấp trả lời gần nhất (cách bù / hàng lỗi), hoặc null. */
function lanTraLoiCuoi(bb) {
    return [bb.cachBuDaChon, bb.hangLoiDaChon]
        .filter((x) => x?.nguon === 'CONG_NCC' && x.luc)
        .sort((a, b) => new Date(b.luc) - new Date(a.luc))[0] ?? null;
}

/** Tiến trình 4 bước: lập biên bản → Quý công ty trả lời → xử lý hàng lỗi → hoàn tất. Biên bản đã hủy: không vẽ. */
function TienTrinh({ bb }) {
    if (bb.trangThai === 'DA_HUY') return null;
    const dong = bb.dong ?? [];
    const conOKho = bb.hangLoi?.trangThai === 'O_KHO';
    const choBu = Number(bb.conChoGiao) > 0 && !bb.buXong;
    const hienTai = choTraLoi(bb) ? 1 : conOKho || choBu ? 2 : 4;
    const chon = new Set(dong.map((d) => d.hangLoi).filter(Boolean));
    let buoc3 = t("Xử lý hàng lỗi");
    if (chon.size === 1 && chon.has(HANG_LOI.NHAN_LAI)) buoc3 = t("Giao trả hàng lỗi");
    else if (chon.size === 1 && chon.has(HANG_LOI.TIEU_HUY)) buoc3 = t("Tiêu hủy hàng lỗi");
    const lan = lanTraLoiCuoi(bb);
    const ds = [
        [t("Lập biên bản"), bb.ngayLap ? formatDate(bb.ngayLap) : ''],
        [t("Quý công ty trả lời"), hienTai === 1 && bb.hanTraLoi ? t("hạn {{ngay}}", { ngay: formatDate(bb.hanTraLoi) }) : lan ? formatDate(lan.luc) : ''],
        [buoc3, !conOKho && bb.hangLoi?.thoiDiem ? formatDate(bb.hangLoi.thoiDiem) : ''],
        [t("Hoàn tất"), ''],
    ];
    return (
        <ol aria-label={t("Tiến trình biên bản")} className={cn(LE, 'flex border-y border-bo-border bg-bo-surface-subtle py-4')}>
            {ds.map(([ten, phu], i) => {
                const xong = i < hienTai;
                const dang = i === hienTai;
                const cuoi = i === ds.length - 1;
                return (
                    <li key={ten} className={cn('min-w-0', cuoi ? 'flex-none' : 'flex-1')} aria-current={dang ? 'step' : undefined}>
                        <div className="flex items-center">
                            <span
                                className={cn(
                                    'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums',
                                    xong ? 'bg-bo-tt-xong-hinh text-white' : dang ? 'bg-bo-primary text-white ring-4 ring-bo-primary/15' : 'border border-slate-300 bg-white text-bo-muted',
                                )}
                            >
                                {xong ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                            </span>
                            {cuoi ? null : <span className={cn('mx-2 h-0.5 flex-1 rounded-full', xong ? 'bg-bo-tt-xong-hinh' : 'bg-slate-200')} />}
                        </div>
                        <p className={cn('mt-2 pr-2 text-[13px] leading-4', dang ? 'font-semibold text-bo-heading' : xong ? 'text-bo-foreground' : 'text-bo-muted')}>
                            {ten}
                        </p>
                        {phu ? <p className="mt-0.5 hidden text-xs text-bo-muted tabular-nums sm:block">{phu}</p> : null}
                    </li>
                );
            })}
        </ol>
    );
}

/** Khối "Hàng lỗi …": hàng lỗi của các dòng đang ở đâu, theo lựa chọn Quý công ty đã gửi. */
function KhoiHangLoi({ bb }) {
    const h = bb.hangLoi ?? {};
    const dong = bb.dong ?? [];
    let Icon = Warehouse;
    let mauIcon = 'bg-amber-50 text-amber-600';
    let tieuDe;
    const moTa = [];
    if (h.trangThai === 'DA_TRA') {
        Icon = Undo2;
        mauIcon = 'bg-bo-surface-subtle text-slate-600';
        tieuDe = h.nguoiNhan
            ? t("Hàng lỗi đã giao {{nguoiNhan}}", { nguoiNhan: h.bienSoXe ? `${h.nguoiNhan} (${h.bienSoXe})` : h.nguoiNhan })
            : t("Hàng lỗi đã trả cho Quý công ty");
        if (h.thoiDiem) moTa.push(t("Bàn giao lúc {{luc}}.", { luc: gioVaNgay(h.thoiDiem) }));
    } else if (h.trangThai === 'DA_TIEU_HUY') {
        Icon = PackageX;
        mauIcon = 'bg-bo-surface-subtle text-slate-600';
        tieuDe = t("Hàng lỗi đã được tiêu hủy theo đồng ý của Quý công ty");
        if (h.thoiDiem) moTa.push(t("Tiêu hủy lúc {{luc}}.", { luc: gioVaNgay(h.thoiDiem) }));
    } else if (h.trangThai === 'DA_XU_LY') {
        Icon = CheckCircle2;
        mauIcon = 'bg-bo-surface-subtle text-slate-600';
        tieuDe = t("Hàng lỗi đã giao trả và tiêu hủy theo lựa chọn của Quý công ty");
    } else {
        // Còn dòng ở kho: nói theo số sản phẩm của từng việc
        const oKho = dong.filter(dongOKho);
        const so = (hl) => oKho.filter((d) => (d.hangLoi ?? null) === hl).reduce((s, d) => s + (Number(d.soLuong) || 0), 0);
        const nhanLai = so(HANG_LOI.NHAN_LAI);
        const tieuHuy = so(HANG_LOI.TIEU_HUY);
        const chuaChon = so(null);
        const daRoi = dong.filter((d) => !dongOKho(d)).reduce((s, d) => s + (Number(d.soLuong) || 0), 0);
        const kho = tenKho(bb);
        if (nhanLai === 0 && tieuHuy === 0) {
            tieuDe = t("Hàng lỗi đang ở {{kho}}, chờ Quý công ty chọn nhận lại hay tiêu hủy", { kho });
            moTa.push(t("Chúng tôi giữ hàng lỗi ở kho và chỉ tiêu hủy khi Quý công ty đồng ý."));
        } else if (tieuHuy === 0 && chuaChon === 0) {
            tieuDe = t("Hàng lỗi đang ở {{kho}}, chờ Quý công ty lấy về", { kho });
        } else if (nhanLai === 0 && chuaChon === 0) {
            Icon = Trash2;
            tieuDe = t("Hàng lỗi đang ở {{kho}}, chờ tiêu hủy theo đồng ý của Quý công ty", { kho });
        } else {
            tieuDe = t("Hàng lỗi đang ở {{kho}}", { kho });
            if (nhanLai) moTa.push(t("{{count}} sản phẩm chờ Quý công ty lấy về.", { count: nhanLai }));
            if (tieuHuy) moTa.push(t("{{count}} sản phẩm chờ tiêu hủy theo đồng ý của Quý công ty.", { count: tieuHuy }));
            if (chuaChon) moTa.push(t("{{count}} sản phẩm chờ Quý công ty chọn.", { count: chuaChon }));
        }
        if (daRoi) moTa.push(t("{{count}} sản phẩm đã giao trả hoặc tiêu hủy.", { count: daRoi }));
        if (nhanLai) {
            moTa.push(
                bb.diaChiKho
                    ? t("Địa chỉ lấy hàng: {{diaChi}}. Báo trước cho người phụ trách để chúng tôi chuẩn bị hàng và biên bản bàn giao.", { diaChi: bb.diaChiKho })
                    : t("Báo trước cho người phụ trách để chúng tôi chuẩn bị hàng và biên bản bàn giao."),
            );
        }
    }
    return (
        <section aria-label={t("Hàng lỗi")} className={cn(LE, 'flex items-start gap-3 py-5')}>
            <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-md', mauIcon)}>
                <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 text-sm">
                <p className="font-semibold break-words text-bo-heading">{tieuDe}</p>
                {moTa.map((c) => (
                    <p key={c} className="mt-0.5 text-[13px] leading-5 break-words text-bo-muted">{c}</p>
                ))}
            </div>
        </section>
    );
}

/**
 * Danh sách sản phẩm không đạt: mỗi dòng một thẻ. `chon` / `onChon`: đang trả lời (thẻ có nút chọn); thiếu thì thẻ chỉ
 * hiện lựa chọn đang áp dụng. `dauDanhSach`: thanh Áp dụng nhanh (khi đang trả lời). `dongLoi`: id dòng đang báo thiếu.
 */
function DanhSachDong({ bb, chon, onChon, dangGui, dongLoi, dauDanhSach, theRef }) {
    const dong = bb.dong ?? [];
    const tongSl = Number(bb.tongSoLuong) || dong.reduce((s, d) => s + (Number(d.soLuong) || 0), 0);
    const tongTien = Number(bb.tongGiaTri) || dong.reduce((s, d) => s + (Number(d.giaTri) || 0), 0);
    return (
        <section aria-labelledby="bb-san-pham">
            <div className={cn(LE, 'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-2 pb-3')}>
                <h2 id="bb-san-pham" className={TIEU_DE_PHAN}>
                    {t("Sản phẩm không đạt")} · <span className="tabular-nums">{tongSl}</span>
                </h2>
                <span className="text-xs text-bo-muted">
                    {onChon
                        ? t("{{count}} dòng · mỗi sản phẩm chọn riêng", { count: dong.length })
                        : t("{{count}} dòng", { count: dong.length })}
                </span>
            </div>
            {dauDanhSach}
            <ul className={cn(LE, 'flex flex-col gap-3')}>
                {dong.map((d) => (
                    <TheDong
                        key={d.id ?? `${d.sku}-${d.maLo}-${d.lyDo}`}
                        d={d}
                        bb={bb}
                        chon={chon ? chon[d.id] : undefined}
                        onChon={onChon ? (loai, ma) => onChon(d.id, loai, ma) : undefined}
                        dangGui={dangGui}
                        baoLoi={dongLoi?.includes(d.id)}
                        theRef={theRef}
                    />
                ))}
            </ul>
            <div className={cn(LE, 'mt-3 flex items-center justify-between border-t border-bo-border pt-3.5')}>
                <span className="text-sm font-semibold">{t("Tổng giá trị hàng lỗi")}</span>
                <span className="text-base font-bold text-bo-heading tabular-nums">{formatCurrency(tongTien)}</span>
            </div>
        </section>
    );
}

/** Nhãn nhỏ ở góc thẻ dòng. */
function NhanThe({ trangThai }) {
    const KIEU = {
        'chua-chon': ['bg-bo-tt-chu-y text-bo-tt-chu-y-chu', null, t("Chưa chọn")],
        'thieu-mot': ['bg-bo-tt-chu-y text-bo-tt-chu-y-chu', null, t("Còn 1 mục")],
        'chon-lai': ['bg-bo-tt-chu-y text-bo-tt-chu-y-chu', null, t("Cần chọn lại")],
        'da-chon': ['bg-bo-success-soft text-bo-success', Check, t("Đã chọn")],
        'da-chot': ['bg-bo-surface-subtle text-bo-muted', Lock, t("Đã chốt")],
    };
    const [lop, Icon, chu] = KIEU[trangThai] ?? KIEU['chua-chon'];
    return (
        <span className={cn('inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-semibold whitespace-nowrap', lop)}>
            {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
            {chu}
        </span>
    );
}

/** Tên cách bù đang áp dụng của dòng, kèm nguồn khi không phải nhà cung cấp tự chọn (quá hạn, bên mua đóng đơn). */
function tenCachBuDong(d) {
    const cach = theoMa(CACH_BU, luaChonHienTai(d).cachBu);
    if (!cach) return null;
    if (d.nguonCachBu === 'TU_DONG') return t("{{cach}} (quá hạn trả lời)", { cach: cach.ten() });
    if (d.nguonCachBu === 'DONG_DON') return t("{{cach}} (bên mua đóng đơn)", { cach: cach.ten() });
    return cach.ten();
}

/** Dòng phụ của cách bù đã chọn: số tiền trừ, hàng bù đã nhận đủ / còn chờ. */
function phuCachBuDong(d, bb) {
    const cb = luaChonHienTai(d).cachBu;
    if (cb === PHUONG_AN.TRU_TIEN) {
        const tru = truTienDong(d, cb);
        const sl = Number(d.soLuong) || 0;
        const phan = [];
        if (tru.tien > 0) phan.push(`−${formatCurrency(tru.tien)}`);
        if (tru.soLuong < sl) {
            phan.push(t("trừ {{soTru}}/{{tong}} sản phẩm, phần còn lại coi như đã giao bù", { soTru: tru.soLuong, tong: sl }));
        }
        return phan.join(' · ') || null;
    }
    if (cb === PHUONG_AN.GIAO_BU && bb.phieuDaNhap) return d.buXong ? t("đã nhận đủ hàng bù") : t("chờ hàng bù");
    return null;
}

/** Hàng lỗi của dòng đã rời kho: đã giao trả / đã tiêu hủy / trả ngay cho người giao hàng. */
function hangLoiDaRoi(d, bb) {
    if (dongOKho(d)) return null;
    const luc = d.thoiDiemRoiKho ? gioVaNgay(d.thoiDiemRoiKho) : null;
    if (d.viTriHang === 'DA_TIEU_HUY') return luc ? t("Đã tiêu hủy lúc {{luc}}", { luc }) : t("Đã tiêu hủy");
    if (bb.hangLoi?.cachXuLy === 'TRA_NGAY' && !d.hangLoi) {
        return d.nguoiNhanHang ? t("Đã trả cho người giao hàng {{ten}} lúc giao", { ten: d.nguoiNhanHang }) : t("Đã trả cho người giao hàng lúc giao");
    }
    return luc ? t("Đã giao trả lúc {{luc}}", { luc }) : t("Đã giao trả");
}

/**
 * Thẻ một sản phẩm không đạt: phần trên là thông tin sản phẩm (tên, phân loại, lý do, SKU, lô, số lượng × đơn giá = giá
 * trị) kèm nhãn trạng thái; phần dưới chia hai cột cho hai câu của riêng dòng này.
 */
function TheDong({ d, bb, chon, onChon: onChonDong, dangGui, baoLoi, theRef }) {
    // Dòng thiếu id không gửi được lựa chọn: chỉ xem
    const onChon = d.id != null ? onChonDong : undefined;
    const dangChon = Boolean(onChon);
    const luaChon = chon ?? luaChonHienTai(d);
    const thuocTinh = thuocTinhDong(d);
    let trangThai = trangThaiTheDong(d, luaChon);
    // Chỉ xem: dòng chưa có lựa chọn nào mà cũng không chọn được nữa (đơn mua đã kết thúc) thì vẫn là "Chưa chọn"
    if (!dangChon && !luaChon.cachBu && !luaChon.hangLoi && trangThai === 'da-chot') trangThai = 'chua-chon';
    const tenId = `dong-${d.id}-ten`;
    return (
        <li>
            <article
                id={`dong-${d.id}`}
                ref={(el) => {
                    if (theRef && d.id != null) theRef.current[d.id] = el;
                }}
                tabIndex={-1}
                aria-labelledby={tenId}
                className={cn(
                    'scroll-mt-6 rounded-lg border bg-bo-surface focus:outline-none',
                    baoLoi ? 'border-orange-300 ring-2 ring-orange-100' : 'border-bo-border',
                )}
            >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3.5">
                    <div className="min-w-0">
                        <h3 id={tenId} className="font-semibold break-words text-bo-foreground">
                            {d.tenSanPham}
                            {thuocTinh ? <span className="font-normal text-bo-muted"> · {thuocTinh}</span> : null}
                        </h3>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-bo-muted">
                            {d.lyDo ? <span className="inline-flex max-w-full items-center break-words rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-700">{lyDoBienBanTraHang(d.lyDo, d.ghiChu, tDuLieu)}</span> : null}
                            {d.sku ? <span className="font-mono break-all">{d.sku}</span> : null}
                            {d.maLo ? <span className="font-mono break-all">{t("Lô {{ma}}", { ma: d.maLo })}</span> : null}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                        <NhanThe trangThai={trangThai} />
                        <p className="font-semibold text-bo-foreground tabular-nums">{formatCurrency(Number(d.giaTri) || 0)}</p>
                        <p className="text-xs whitespace-nowrap text-bo-muted tabular-nums">
                            {d.soLuong} × {formatCurrency(Number(d.donGia) || 0)}
                        </p>
                    </div>
                </div>
                {trangThai === 'chon-lai' && dangChon ? (
                    <p className="mx-4 mb-3 flex items-start gap-2 rounded-md bg-bo-tt-chu-y px-3 py-2 text-[13px] leading-5 text-bo-tt-chu-y-chu">
                        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        {t("Lúc nhập kho chúng tôi chưa trừ tiền được cho sản phẩm này vì đơn không còn chờ đủ số này. Vui lòng chọn lại cách bù.")}
                    </p>
                ) : null}
                <div className="grid gap-4 border-t border-bo-border bg-bo-surface-subtle/60 px-4 py-3.5 md:grid-cols-2">
                    <CauDong
                        ten={t("Bù hàng lỗi")}
                        ds={CACH_BU}
                        d={d}
                        bb={bb}
                        name={`bb-cach-bu-${d.id}`}
                        giaTri={luaChon.cachBu}
                        hienTai={luaChonHienTai(d).cachBu}
                        mo={dangChon ? moCachBu(d) : []}
                        tenDaChon={tenCachBuDong(d)}
                        phuDaChon={phuCachBuDong(d, bb)}
                        thieu={baoLoi && !luaChon.cachBu && moCachBu(d).length > 0}
                        khoa={moCachBu(d).length === 0}
                        dangGui={dangGui}
                        onChon={onChon ? (ma) => onChon('cachBu', ma) : undefined}
                    />
                    {dongOKho(d) ? (
                        <CauDong
                            ten={t("Hàng lỗi đang ở kho")}
                            ds={CACH_HANG_LOI}
                            d={d}
                            bb={bb}
                            name={`bb-hang-loi-${d.id}`}
                            giaTri={luaChon.hangLoi}
                            hienTai={d.hangLoi ?? null}
                            mo={dangChon ? moHangLoi(d) : []}
                            tenDaChon={theoMa(CACH_HANG_LOI, d.hangLoi)?.ten() ?? null}
                            phuDaChon={d.hangLoi === HANG_LOI.NHAN_LAI ? t("chờ Quý công ty lấy") : d.hangLoi === HANG_LOI.TIEU_HUY ? t("chờ tiêu hủy") : null}
                            thieu={baoLoi && !luaChon.hangLoi && moHangLoi(d).length > 0}
                            khoa={moHangLoi(d).length === 0}
                            dangGui={dangGui}
                            onChon={onChon ? (ma) => onChon('hangLoi', ma) : undefined}
                        />
                    ) : (
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <p className="text-sm font-semibold text-bo-foreground">{t("Hàng lỗi")}</p>
                            <p className="flex items-start gap-2 text-sm text-bo-foreground">
                                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-bo-success" aria-hidden="true" />
                                <span className="min-w-0 break-words">{hangLoiDaRoi(d, bb)}</span>
                            </p>
                        </div>
                    )}
                </div>
            </article>
        </li>
    );
}

/**
 * Một câu của một dòng. Đang trả lời và câu còn mở: hai ô chọn cạnh nhau (biểu tượng + tên ngắn + số tiền / số lượng),
 * mô tả đầy đủ chỉ hiện cho ô đang chọn. Không thì một dòng lựa chọn đang áp dụng (khóa: "đã chốt").
 */
function CauDong({ ten, ds, d, bb, name, giaTri, hienTai, mo, tenDaChon, phuDaChon, thieu, khoa, dangGui, onChon }) {
    if (!mo.length) {
        return (
            <div className="flex min-w-0 flex-col gap-1.5">
                <p className="text-sm font-semibold text-bo-foreground">{ten}</p>
                {tenDaChon ? (
                    <p className="flex items-start gap-2 text-sm">
                        {khoa ? <Lock className="mt-0.5 size-4 shrink-0 text-bo-muted" aria-hidden="true" /> : <Check className="mt-0.5 size-4 shrink-0 text-bo-success" aria-hidden="true" />}
                        <span className="min-w-0">
                            <span className="font-medium text-bo-foreground">{tenDaChon}</span>
                            {phuDaChon ? <span className="text-bo-muted tabular-nums"> · {phuDaChon}</span> : null}
                            {khoa ? <span className="text-bo-muted"> · {t("đã chốt")}</span> : null}
                        </span>
                    </p>
                ) : (
                    <p className="text-sm text-bo-muted">{t("Chưa chọn")}</p>
                )}
            </div>
        );
    }
    const chon = theoMa(ds, giaTri);
    const idLoi = `${name}-loi`;
    return (
        <fieldset className="flex min-w-0 flex-col gap-2" disabled={dangGui} aria-describedby={thieu ? idLoi : undefined}>
            <legend className="mb-2 text-sm font-semibold text-bo-foreground">
                {ten} <span className="text-bo-danger" aria-hidden="true">*</span>
                {d.tenSanPham ? <span className="sr-only"> · {d.tenSanPham}{thuocTinhDong(d) ? ` · ${thuocTinhDong(d)}` : ''}</span> : null}
            </legend>
            <div className="grid grid-cols-2 gap-2">
                {ds.map((c) => {
                    const bat = giaTri === c.ma;
                    const khoaO = c.ma !== hienTai && !mo.includes(c.ma);
                    const Icon = c.icon;
                    return (
                        <label
                            key={c.ma}
                            className={cn(
                                // Điện thoại: hai ô một hàng nên bỏ ô biểu tượng, chữ được hết bề rộng (số tiền không bị cắt)
                                'relative grid min-h-14 grid-cols-1 items-center gap-x-2.5 rounded-lg border bg-bo-surface p-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bo-primary/30 sm:grid-cols-[32px_minmax(0,1fr)]',
                                khoaO ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                                bat ? 'border-bo-primary bg-bo-primary-soft/50 shadow-[inset_0_0_0_1px_var(--color-bo-primary)]' : thieu ? 'border-orange-300' : 'border-bo-border',
                                !bat && !khoaO && 'hover:border-slate-400',
                            )}
                        >
                            <input
                                type="radio"
                                name={name}
                                value={c.ma}
                                checked={bat}
                                disabled={khoaO}
                                onChange={() => onChon?.(c.ma)}
                                className="sr-only"
                            />
                            <span aria-hidden="true" className={cn('hidden size-8 place-items-center rounded-md sm:grid', bat ? 'bg-bo-primary text-white' : 'bg-slate-100 text-slate-600')}>
                                <Icon className="size-4" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm leading-5 font-semibold text-bo-foreground">{c.ten()}</span>
                                <span className="block text-xs break-words text-bo-muted tabular-nums">{c.phu(d, bb)}</span>
                            </span>
                        </label>
                    );
                })}
            </div>
            {thieu ? (
                <p id={idLoi} className="flex items-center gap-1.5 text-[13px] leading-5 text-bo-tt-chu-y-chu">
                    <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                    {t("Chọn một cách cho sản phẩm này")}
                </p>
            ) : chon ? (
                <p className="text-[13px] leading-5 text-slate-600">{chon.moTa(d, bb)}</p>
            ) : null}
        </fieldset>
    );
}

/** Thanh "Áp dụng nhanh cho tất cả": chọn một lần cho mọi sản phẩm còn chọn được, vẫn sửa riêng từng thẻ bên dưới. */
function ThanhApDungNhanh({ bb, chon, dangGui, onApDung, boQua }) {
    const nhom = (loai, ten, ds) => {
        if (soDongMo(bb, loai) < 2) return null;
        const chung = giaTriChung(bb, chon, loai);
        return (
            <div role="group" aria-label={ten} className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-[13px] text-bo-muted">{ten}</span>
                <div className="grid grid-cols-2 rounded-lg border border-bo-border bg-bo-surface p-0.5">
                    {ds.map((c) => (
                        <button
                            key={c.ma}
                            type="button"
                            disabled={dangGui}
                            aria-pressed={chung === c.ma}
                            onClick={() => onApDung(loai, c.ma)}
                            className={cn(
                                'min-h-8 rounded-md px-3 py-1 text-[13px] leading-4 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:opacity-50',
                                chung === c.ma ? 'bg-bo-primary text-white' : 'text-bo-foreground hover:bg-bo-surface-subtle',
                            )}
                        >
                            {c.ten()}
                        </button>
                    ))}
                </div>
            </div>
        );
    };
    const cachBu = nhom('cachBu', t("Bù hàng lỗi"), CACH_BU);
    const hangLoi = nhom('hangLoi', t("Hàng lỗi"), CACH_HANG_LOI);
    if (!cachBu && !hangLoi) return null;
    return (
        <div className={cn(LE, 'pb-3')}>
            <div className="flex flex-col gap-x-6 gap-y-2.5 rounded-lg border border-dashed border-slate-300 bg-bo-surface-subtle px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center">
                <span className="text-sm font-semibold text-bo-foreground">{t("Áp dụng nhanh cho tất cả")}</span>
                {cachBu}
                {hangLoi}
            </div>
            {/* Vùng báo luôn có sẵn để trình đọc màn hình đọc câu mới khi bấm áp dụng */}
            <p role="status" className={cn('text-xs text-bo-muted', boQua > 0 && 'mt-1.5')}>
                {boQua > 0 ? t("{{count}} sản phẩm đã chốt nên giữ lựa chọn cũ.", { count: boQua }) : null}
            </p>
        </div>
    );
}

/** Hàng lỗi đã rời kho: trả ngay cho người giao hàng lúc giao, hoặc kho đã giao trả / tiêu hủy. */
const tenDaRoiKho = (bb) => (bb.hangLoi?.cachXuLy === 'TRA_NGAY' ? t("Đã trả lúc giao") : t("Đã giao trả hoặc tiêu hủy"));

/** Khung "Tóm tắt phương án xử lý": cộng dồn từ lựa chọn có hiệu lực của các dòng (đơn vị: sản phẩm). */
function TomTatPhuongAn({ bb, chon }) {
    const tt = tomTatLuaChon(bb, chon);
    const dong = [];
    if (tt.truTien.soLuong) {
        dong.push([
            bb.phieuDaNhap ? t("Trừ tiền hàng") : t("Trừ tiền hàng (dự kiến)"),
            tt.truTien.tien > 0 ? (
                <>
                    <span className="text-bo-muted">{t("{{count}} sản phẩm", { count: tt.truTien.soLuong })} · </span>
                    <span className="font-semibold">−{formatCurrency(tt.truTien.tien)}</span>
                </>
            ) : (
                t("{{count}} sản phẩm", { count: tt.truTien.soLuong })
            ),
        ]);
    }
    if (tt.giaoBu) dong.push([t("Giao bù hàng"), t("{{count}} sản phẩm", { count: tt.giaoBu })]);
    if (tt.coiNhuDaBu) dong.push([t("Coi như đã giao bù"), t("{{count}} sản phẩm", { count: tt.coiNhuDaBu })]);
    if (tt.nhanLai) dong.push([t("Nhận lại"), t("{{count}} sản phẩm", { count: tt.nhanLai })]);
    if (tt.tieuHuy) dong.push([t("Đồng ý tiêu hủy"), t("{{count}} sản phẩm", { count: tt.tieuHuy })]);
    if (tt.daRoiKho) dong.push([tenDaRoiKho(bb), t("{{count}} sản phẩm", { count: tt.daRoiKho })]);
    const chuaChon = tt.chuaChon;
    return (
        <section aria-labelledby="bb-tom-tat" className="rounded-lg border border-bo-border bg-bo-surface">
            <h3 id="bb-tom-tat" className="border-b border-bo-border px-3.5 py-2.5 text-[13px] font-semibold text-bo-heading">
                {t("Tóm tắt phương án xử lý")}
            </h3>
            {dong.length || chuaChon ? (
                <dl className="flex flex-col gap-1.5 px-3.5 py-3 text-sm">
                    {dong.map(([k, v]) => (
                        <div key={k} className="flex items-baseline justify-between gap-3">
                            <dt className="min-w-0 text-bo-muted">{k}</dt>
                            <dd className="shrink-0 text-right whitespace-nowrap tabular-nums">{v}</dd>
                        </div>
                    ))}
                    {chuaChon ? (
                        <div className="flex items-baseline justify-between gap-3 text-bo-tt-chu-y-chu">
                            <dt>{t("Chưa chọn đủ")}</dt>
                            <dd className="text-right font-semibold tabular-nums">{t("{{count}} sản phẩm", { count: chuaChon })}</dd>
                        </div>
                    ) : null}
                </dl>
            ) : null}
        </section>
    );
}

const CAU_ROI_BIEN_BAN = {
    roi: t("Rời trang biên bản?"),
    mat: t("Các lựa chọn chưa được xác nhận sẽ mất."),
};

/**
 * Trả lời theo từng dòng: giữ lựa chọn của mọi thẻ (cột trái) và khung trả lời (cột phải). Lần đầu phải chọn đủ mọi câu
 * còn mở của mọi dòng; `dangDoi`: mở lại để đổi (điền sẵn lựa chọn đang áp dụng, phải đổi ít nhất một câu mới gửi được).
 * Nút chỉ bấm được khi mọi dòng đã chọn đủ và có người xác nhận; bấm thì mở hộp xác nhận chính thức.
 */
function TraLoiTheoDong({ bb, nhaCungCap, dangDoi, onHuyDoi, onXong, onKhongConNhan, onHetPhien }) {
    const [chon, setChon] = useState(() => khoiTaoLuaChon(bb));
    const [boQua, setBoQua] = useState(0);
    const [nguoi, setNguoi] = useState(
        () => bb.hangLoiDaChon?.nguoiXacNhan || bb.cachBuDaChon?.nguoiXacNhan || bb.nguoiLienHeNcc || '',
    );
    const [ghiChu, setGhiChu] = useState('');
    const [moGhiChu, setMoGhiChu] = useState(false);
    const [loiNguoi, setLoiNguoi] = useState('');
    // Dòng máy chủ báo thiếu / sai, hoặc người dùng bấm "Đến sản phẩm chưa chọn"
    const [dongLoi, setDongLoi] = useState([]);
    const [hopMo, setHopMo] = useState(false);
    const [loiGui, setLoiGui] = useState('');
    const oNguoiRef = useRef(null);
    const theRef = useRef({});

    const thieu = dongConThieu(bb, chon);
    const soThieu = soSanPhamConThieu(bb, chon);
    const coDoi = coDongDoi(bb, chon);
    const coNguoi = Boolean(chuanHoaHoTen(nguoi));
    const guiDuoc = thieu.length === 0 && coDoi && coNguoi;

    // Đã chọn mà chưa xác nhận: Thoát, đổi ngôn ngữ (menu tài khoản), tab, link, nút Back hỏi lại bằng HopHoiRoiTrang;
    // đóng thẻ / tải lại trang hỏi bằng hộp của trình duyệt
    const [hoiRoi, setHoiRoi] = useState(null);
    useHoiKhiRoiTrang(coDoi || ghiChu.trim() !== '', (tiepTuc, lyDo) => setHoiRoi({ tiepTuc, lyDo }));

    const chonDong = (dongId, loai, ma) => {
        setChon((cu) => ({ ...cu, [dongId]: { ...(cu[dongId] ?? {}), [loai]: ma } }));
        setLoiGui('');
        setBoQua(0);
    };
    const apDung = (loai, ma) => {
        const kq = apDungNhanh(bb, chon, loai, ma);
        setChon(kq.chon);
        setBoQua(kq.boQua);
        setLoiGui('');
    };
    // Bỏ đánh dấu các dòng đã chọn đủ
    const dongLoiConThieu = dongLoi.filter((x) => thieu.includes(x));

    const denDongThieu = (ds = thieu) => {
        if (!ds.length) return;
        setDongLoi(ds);
        const the = theRef.current[ds[0]];
        if (the) {
            the.scrollIntoView({ behavior: 'smooth', block: 'center' });
            the.focus({ preventScroll: true });
        }
    };

    const moHopXacNhan = (e) => {
        e.preventDefault();
        if (thieu.length) {
            denDongThieu();
            return;
        }
        if (!guiDuoc) return;
        const loi = loiNguoiXacNhan(nguoi);
        if (loi) {
            setLoiNguoi(loi);
            oNguoiRef.current?.focus();
            return;
        }
        setLoiGui('');
        setHopMo(true);
    };

    const xuLyLoiGui = (err) => {
        const kq = xuLyLoiXacNhanBienBan(err);
        setHopMo(false);
        if (kq.loai === 'phien-het-han') onHetPhien();
        else if (kq.loai === 'khong-con-nhan') onKhongConNhan(kq.cau);
        else if (kq.loai === 'khong-tim-thay') onKhongConNhan(kq.cau || t("Biên bản không còn trên cổng. Tải lại trang để xem việc mới nhất."));
        else if (kq.loai === 'du-lieu-sai' && kq.o === 'nguoiXacNhan') {
            // Máy chủ chỉ ra ô sai: báo ngay dưới ô và đưa con trỏ về đó
            setLoiNguoi(kq.cau);
            requestAnimationFrame(() => oNguoiRef.current?.focus());
        } else if (kq.loai === 'du-lieu-sai' && kq.dong != null) {
            // Dòng không còn trên bản đang xem (kho vừa lập lại): tải lại biên bản; còn thì chỉ ra thẻ đó
            if (!(bb.dong ?? []).some((d) => d.id === kq.dong)) {
                onKhongConNhan(kq.cau);
                return;
            }
            setLoiGui(kq.cau);
            requestAnimationFrame(() => denDongThieu([kq.dong]));
        } else setLoiGui(kq.cau || t("Chưa gửi được lựa chọn. Kiểm tra kết nối mạng rồi thử lại."));
    };

    let nhanNut = t("Xem lại và xác nhận");
    if (thieu.length) nhanNut = t("Chọn đủ các mục ở trên");
    else if (!coDoi) nhanNut = t("Chọn khác để đổi");
    else if (!coNguoi) nhanNut = t("Nhập tên người xác nhận");

    const conLaiKyTu = GHI_CHU_BIEN_BAN_TOI_DA - ghiChu.length;
    const dong = bb.dong ?? [];

    return (
        <>
            <BoCuc
                trai={
                    <>
                        <KhoiHangLoi bb={bb} />
                        <DanhSachDong
                            bb={bb}
                            chon={chon}
                            onChon={chonDong}
                            dangGui={hopMo}
                            dongLoi={dongLoiConThieu}
                            theRef={theRef}
                            dauDanhSach={<ThanhApDungNhanh bb={bb} chon={chon} dangGui={hopMo} onApDung={apDung} boQua={boQua} />}
                        />
                    </>
                }
                phai={
                    <form onSubmit={moHopXacNhan} noValidate className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h2 id="bb-khung-tieu-de" className="text-base font-semibold text-bo-heading">
                                    {dangDoi ? t("Đổi lựa chọn") : t("Trả lời biên bản")}
                                </h2>
                                {!dangDoi && bb.hanTraLoi ? (
                                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-bo-warning">
                                        <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
                                        {t("Trả lời trước hết ngày {{ngay}}", { ngay: formatDate(bb.hanTraLoi) })}
                                    </span>
                                ) : null}
                            </div>
                            <p className="text-[13px] leading-5 text-bo-muted">
                                {dong.length > 1
                                    ? t("Chọn cách xử lý riêng cho từng sản phẩm không đạt. Hàng lỗi chỉ tiêu hủy khi Quý công ty đồng ý.")
                                    : t("Hàng lỗi chỉ tiêu hủy khi Quý công ty đồng ý.")}
                            </p>
                        </div>

                        <TomTatPhuongAn bb={bb} chon={chon} />

                        {thieu.length ? (
                            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 text-bo-tt-chu-y-chu">
                                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                                <span>{t("Còn {{count}} sản phẩm chưa chọn đủ.", { count: soThieu })}</span>
                                <button
                                    type="button"
                                    onClick={() => denDongThieu()}
                                    className="rounded-sm font-semibold underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40"
                                >
                                    {t("Đến sản phẩm chưa chọn")}
                                </button>
                            </p>
                        ) : null}

                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="bb-nguoi-xac-nhan" className="text-sm font-medium text-bo-foreground">
                                {t("Người xác nhận")} <span className="text-bo-danger" aria-hidden="true">*</span>
                            </label>
                            <input
                                ref={oNguoiRef}
                                id="bb-nguoi-xac-nhan"
                                autoComplete="name"
                                value={nguoi}
                                disabled={hopMo}
                                required
                                aria-required="true"
                                aria-invalid={Boolean(loiNguoi)}
                                aria-describedby={loiNguoi ? 'bb-nguoi-loi' : undefined}
                                onChange={(e) => {
                                    setNguoi(e.target.value);
                                    if (loiNguoi) setLoiNguoi('');
                                }}
                                onBlur={(e) => setLoiNguoi(e.target.value.trim() ? loiNguoiXacNhan(e.target.value) : '')}
                                className={cn(O_NHAP, 'h-10', loiNguoi ? 'border-bo-danger' : 'border-bo-input-border')}
                            />
                            {loiNguoi ? (
                                <p id="bb-nguoi-loi" className="flex items-center gap-1.5 text-[13px] leading-5 text-bo-danger">
                                    <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                                    {loiNguoi}
                                </p>
                            ) : null}
                        </div>

                        {moGhiChu || ghiChu ? (
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="bb-ghi-chu" className="text-sm font-medium text-bo-foreground">
                                    {t("Ghi chú")} <span className="font-normal text-bo-muted">{t("(không bắt buộc)")}</span>
                                </label>
                                <textarea
                                    id="bb-ghi-chu"
                                    rows={2}
                                    value={ghiChu}
                                    disabled={hopMo}
                                    maxLength={GHI_CHU_BIEN_BAN_TOI_DA}
                                    aria-describedby={ghiChu.length >= GHI_CHU_BIEN_BAN_HIEN_DEM ? 'bb-ghi-chu-dem' : undefined}
                                    placeholder={t("VD: Giao bù cùng đợt hàng tới, xe đến lấy hàng lỗi thứ Sáu")}
                                    onChange={(e) => setGhiChu(e.target.value.slice(0, GHI_CHU_BIEN_BAN_TOI_DA))}
                                    className={cn(O_NHAP, 'resize-y border-bo-input-border py-2')}
                                />
                                {ghiChu.length >= GHI_CHU_BIEN_BAN_HIEN_DEM ? (
                                    <p id="bb-ghi-chu-dem" className={cn('text-right text-xs tabular-nums', conLaiKyTu <= 0 ? 'text-bo-warning' : 'text-bo-muted')}>
                                        {ghiChu.length}/{GHI_CHU_BIEN_BAN_TOI_DA}
                                    </p>
                                ) : null}
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    setMoGhiChu(true);
                                    requestAnimationFrame(() => document.getElementById('bb-ghi-chu')?.focus());
                                }}
                                className="-mt-1 inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/40"
                            >
                                <Plus className="size-4" aria-hidden="true" /> {t("Thêm ghi chú")}
                            </button>
                        )}

                        {loiGui ? (
                            <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-bo-danger-soft px-3 py-2.5 text-sm leading-5 text-bo-danger-strong">
                                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <span>{loiGui}</span>
                            </div>
                        ) : null}

                        <div className="flex flex-col gap-2 border-t border-bo-border pt-4">
                            <Button
                                type="submit"
                                disabled={!guiDuoc}
                                className="h-11 w-full gap-2 bg-bo-primary text-[15px] text-white hover:bg-bo-primary-hover disabled:opacity-50"
                            >
                                <ShieldCheck className="size-4" aria-hidden="true" /> {nhanNut}
                            </Button>
                            {dangDoi ? (
                                <Button type="button" variant="outline" onClick={onHuyDoi} className={cn('h-10 w-full', NUT_PHU)}>
                                    {t("Giữ lựa chọn cũ")}
                                </Button>
                            ) : null}
                            <p className="text-xs leading-5 text-bo-muted">
                                {t("Bước sau: xem lại toàn bộ nội dung và xác nhận chính thức.")}
                                {!bb.phieuDaNhap && bb.soPhieuNhap
                                    ? ` ${t("Cách bù đổi được đến khi chúng tôi nhập kho phiếu {{soPhieu}}.", { soPhieu: bb.soPhieuNhap })}`
                                    : null}
                            </p>
                        </div>
                    </form>
                }
            />
            <HopXacNhan
                open={hopMo}
                bb={bb}
                chon={chon}
                nguoi={chuanHoaHoTen(nguoi)}
                ghiChu={ghiChu}
                nhaCungCap={nhaCungCap}
                lanDau={!dangDoi}
                onDong={() => setHopMo(false)}
                onGui={async (camKet) => {
                    try {
                        const moi = await congNhaCungCapService.xacNhanBienBan(bb.id, taoPayloadTheoDong(bb, chon, nguoi, ghiChu, bb.phienBan, camKet));
                        setHopMo(false);
                        onXong(moi);
                    } catch (err) {
                        xuLyLoiGui(err);
                    }
                }}
            />
            <HopHoiRoiTrang hoi={hoiRoi} cau={CAU_ROI_BIEN_BAN} onO={() => setHoiRoi(null)} />
        </>
    );
}

/**
 * Hộp xác nhận chính thức trước khi gửi: tóm tắt (bên xác nhận, biên bản, hàng không đạt, cách xử lý theo từng sản
 * phẩm, người xác nhận) và MỘT ô cam kết; có dòng vừa chọn tiêu hủy thì câu cam kết nói rõ không hoàn tác.
 */
function HopXacNhan({ open, bb, chon, nguoi, ghiChu, nhaCungCap, lanDau, onDong, onGui }) {
    const [camKet, setCamKet] = useState(false);
    const [loiCamKet, setLoiCamKet] = useState(false);
    const [dangGui, setDangGui] = useState(false);
    const dangGuiRef = useRef(false);
    useEffect(() => {
        if (open) {
            setCamKet(false);
            setLoiCamKet(false);
        }
    }, [open]);

    const tt = tomTatLuaChon(bb, chon);
    const soHuy = soTieuHuyMoi(bb, chon);
    const tongSl = Number(bb.tongSoLuong) || 0;
    const tenNcc = nhaCungCap?.ten || t("Quý công ty");
    const dong = bb.dong ?? [];
    const cachBu = [
        tt.truTien.soLuong
            ? tt.truTien.tien > 0
                ? t("Trừ {{tien}} cho {{count}} sản phẩm", { tien: formatCurrency(tt.truTien.tien), count: tt.truTien.soLuong })
                : t("Trừ tiền {{count}} sản phẩm", { count: tt.truTien.soLuong })
            : null,
        tt.giaoBu ? t("Giao bù {{count}} sản phẩm", { count: tt.giaoBu }) : null,
        tt.coiNhuDaBu ? t("{{count}} sản phẩm coi như đã giao bù", { count: tt.coiNhuDaBu }) : null,
    ].filter(Boolean);
    const hangLoi = [
        tt.nhanLai ? t("Nhận lại {{count}} sản phẩm", { count: tt.nhanLai }) : null,
        tt.tieuHuy ? t("Đồng ý tiêu hủy {{count}} sản phẩm", { count: tt.tieuHuy }) : null,
        tt.daRoiKho
            ? bb.hangLoi?.cachXuLy === 'TRA_NGAY'
                ? t("{{count}} sản phẩm đã trả lúc giao", { count: tt.daRoiKho })
                : t("{{count}} sản phẩm đã giao trả hoặc tiêu hủy", { count: tt.daRoiKho })
            : null,
    ].filter(Boolean);

    const gui = async () => {
        if (dangGuiRef.current) return;
        if (!camKet) {
            setLoiCamKet(true);
            return;
        }
        dangGuiRef.current = true;
        setDangGui(true);
        try {
            await onGui(true);
        } finally {
            dangGuiRef.current = false;
            setDangGui(false);
        }
    };

    const dongTt = (k, v, phu) => (
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
            <dt className="text-[13px] text-bo-muted">{k}</dt>
            <dd className="min-w-0 text-sm break-words text-bo-foreground">
                {v}
                {phu ? <span className="mt-0.5 block text-[13px] text-bo-muted">{phu}</span> : null}
            </dd>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={(m) => !m && !dangGui && onDong()}>
            <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0 sm:max-w-[min(640px,calc(100%-2rem))]">
                <DialogHeader className="shrink-0 border-b border-bo-border px-5 pt-5 pb-4 pr-12 text-left sm:px-6">
                    <DialogTitle className="text-lg text-bo-heading">{t("Xác nhận trả lời biên bản {{so}}", { so: bb.soBienBan })}</DialogTitle>
                    <DialogDescription className="text-[13px] leading-5 text-bo-muted">
                        {t("Kiểm tra nội dung trước khi gửi. Sau khi gửi, đây là xác nhận chính thức của Quý công ty với biên bản này.")}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden overflow-y-auto px-5 py-4 sm:px-6">
                    <dl className="divide-y divide-bo-border rounded-lg border border-bo-border">
                        {dongTt(
                            t("Bên xác nhận"),
                            <strong className="font-semibold">{tenNcc}</strong>,
                            nhaCungCap?.email ? t("Đăng nhập bằng {{email}}, đã xác thực mã", { email: nhaCungCap.email }) : null,
                        )}
                        {dongTt(t("Biên bản"), bb.ngayLap ? t("{{so}} · lập {{ngay}}", { so: bb.soBienBan, ngay: formatDate(bb.ngayLap) }) : bb.soBienBan)}
                        {dongTt(
                            t("Hàng không đạt"),
                            <strong className="font-semibold tabular-nums">
                                {t("{{count}} sản phẩm", { count: tongSl })} · {formatCurrency(Number(bb.tongGiaTri) || 0)}
                            </strong>,
                        )}
                        {dongTt(t("Bù hàng lỗi"), cachBu.join(' · ') || '—', !bb.phieuDaNhap && tt.truTien.soLuong ? t("Số tiền trừ áp vào đơn khi chúng tôi nhập kho.") : null)}
                        {dongTt(t("Hàng lỗi"), hangLoi.join(' · ') || '—', tt.nhanLai && bb.tenKho ? t("Nhận tại {{kho}}", { kho: tDuLieu(bb.tenKho) }) : null)}
                        {ghiChu.trim() ? dongTt(t("Ghi chú"), <span className="whitespace-pre-line">{ghiChu.trim()}</span>) : null}
                        {dongTt(t("Người xác nhận"), <strong className="font-semibold">{nguoi}</strong>)}
                    </dl>

                    {dong.length > 1 ? (
                        <section aria-labelledby="hop-tung-sp">
                            <h3 id="hop-tung-sp" className="mb-2 text-sm font-semibold text-bo-foreground">{t("Từng sản phẩm")}</h3>
                            <ul className="divide-y divide-bo-border rounded-lg border border-bo-border text-sm">
                                {dong.map((d) => {
                                    const c = luaChonHieuLuc(d, chon[d.id]);
                                    const cb = theoMa(CACH_BU, c.cachBu)?.ten() ?? t("Chưa chọn");
                                    const hl = dongOKho(d) ? theoMa(CACH_HANG_LOI, c.hangLoi)?.ten() ?? t("Chưa chọn") : hangLoiDaRoi(d, bb);
                                    return (
                                        <li key={d.id} className="flex flex-col gap-0.5 px-3.5 py-2.5">
                                            <span className="min-w-0 break-words">
                                                <span className="font-medium">{d.tenSanPham}</span>
                                                <span className="text-bo-muted">
                                                    {thuocTinhDong(d) ? ` · ${thuocTinhDong(d)}` : ''}
                                                    {d.lyDo ? ` · ${tDuLieu(d.lyDo)}` : ''} · {t("{{count}} sản phẩm", { count: Number(d.soLuong) || 0 })}
                                                </span>
                                            </span>
                                            <span className="font-medium text-bo-foreground">
                                                {cb} · {hl}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ) : null}

                    {soHuy > 0 ? (
                        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] leading-5 text-amber-900">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
                            <span>
                                {t("Hàng đã tiêu hủy không thể khôi phục. Khi đồng ý, Quý công ty từ bỏ quyền nhận lại số hàng này. Quý công ty còn đổi sang Nhận lại được cho tới khi chúng tôi ghi nhận đã tiêu hủy.")}
                            </span>
                        </div>
                    ) : null}

                    <label
                        className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 text-sm leading-5',
                            loiCamKet ? 'border-red-300 bg-red-50/50' : camKet ? 'border-bo-primary/40 bg-bo-primary-soft/40' : 'border-bo-border hover:border-slate-400',
                        )}
                    >
                        <input
                            type="checkbox"
                            checked={camKet}
                            disabled={dangGui}
                            onChange={(e) => {
                                setCamKet(e.target.checked);
                                if (e.target.checked) setLoiCamKet(false);
                            }}
                            aria-invalid={loiCamKet}
                            aria-describedby={loiCamKet ? 'hop-cam-ket-loi' : undefined}
                            className="mt-0.5 size-4 shrink-0 accent-[#0d61e4]"
                        />
                        <span className="min-w-0 text-bo-foreground">
                            {lanDau
                                ? t("Tôi, {{nguoi}}, được {{ncc}} ủy quyền, xác nhận số lượng và lý do hàng không đạt trong biên bản {{so}} là đúng, và đồng ý cách xử lý nêu trên", { nguoi, ncc: tenNcc, so: bb.soBienBan })
                                : t("Tôi, {{nguoi}}, được {{ncc}} ủy quyền, đồng ý cách xử lý nêu trên thay cho lựa chọn trước", { nguoi, ncc: tenNcc })}
                            {soHuy > 0 ? (
                                <>
                                    {t(", kể cả việc để chúng tôi ")}
                                    <strong>{t("tiêu hủy {{count}} sản phẩm lỗi; việc tiêu hủy không thể hoàn tác", { count: soHuy })}</strong>
                                </>
                            ) : null}
                            .
                            {loiCamKet ? (
                                <span id="hop-cam-ket-loi" className="mt-1 flex items-center gap-1.5 text-[13px] text-bo-danger">
                                    <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                                    {t("Đánh dấu để xác nhận")}
                                </span>
                            ) : null}
                        </span>
                    </label>
                </div>
                <DialogFooter className="shrink-0 flex-col gap-3 border-t border-bo-border bg-bo-surface-subtle px-5 py-4 sm:flex-col sm:px-6">
                    <p className="flex items-start gap-2 text-xs leading-5 text-bo-muted">
                        <Scale className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        <span>
                            {nhaCungCap?.email
                                ? t("Xác nhận trên cổng có giá trị như văn bản theo Luật Giao dịch điện tử 2023. Chúng tôi lưu thời điểm, người xác nhận, email đăng nhập đã xác thực và gửi bản xác nhận tới {{email}}.", { email: nhaCungCap.email })
                                : t("Xác nhận trên cổng có giá trị như văn bản theo Luật Giao dịch điện tử 2023. Chúng tôi lưu thời điểm, người xác nhận và email đăng nhập đã xác thực.")}
                        </span>
                    </p>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" disabled={dangGui} onClick={onDong} className={cn('h-10', NUT_PHU)}>
                            {t("Quay lại sửa")}
                        </Button>
                        <Button
                            type="button"
                            disabled={dangGui}
                            aria-busy={dangGui || undefined}
                            onClick={gui}
                            className="h-10 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
                        >
                            {dangGui ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
                            {dangGui ? t("Đang gửi...") : t("Xác nhận và gửi")}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Dòng "Đơn mua" sau khi xác nhận: số đã trừ, hàng bù đã nhận / còn chờ. */
function dongDonMua(bb) {
    const phan = [];
    const daTru = Number(bb.soLuongTruTien) || 0;
    if (daTru > 0) phan.push(t("giảm {{count}} sản phẩm", { count: daTru }));
    const tt = tomTatLuaChon(bb, null);
    if (tt.giaoBu > 0) {
        if (bb.buXong) phan.push(t("đã nhận đủ hàng bù"));
        else if (Number(bb.conChoGiao) > 0) phan.push(t("còn {{count}} sản phẩm chờ giao bù", { count: Number(bb.conChoGiao) }));
    }
    return phan.length ? `${bb.soDonMua} · ${phan.join(', ')}` : bb.soDonMua;
}

function DaXacNhan({ bb, emailNcc, tieuDeRef, doiDuoc, onDoi }) {
    const lanNcc = lanTraLoiCuoi(bb);
    const luc = lanNcc ? gioVaNgay(lanNcc.luc) : null;
    const ghiChu = [...new Set([bb.cachBuDaChon, bb.hangLoiDaChon].filter((x) => x?.nguon === 'CONG_NCC').map((x) => x.ghiChu).filter(Boolean))].join(' · ');
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
                    <h2 id="bb-khung-tieu-de" ref={tieuDeRef} tabIndex={-1} className="text-base font-semibold text-bo-heading focus:outline-none">
                        {t("Đã ghi nhận lựa chọn")}
                    </h2>
                    {dongPhu ? <p className="mt-0.5 text-[13px] leading-5 break-words text-bo-muted">{dongPhu}</p> : null}
                </div>
            </div>
            <TomTatPhuongAn bb={bb} chon={null} />
            <dl className="grid grid-cols-[minmax(96px,auto)_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg border border-bo-border bg-bo-surface px-3.5 py-3 text-sm">
                {bb.soDonMua ? (
                    <>
                        <dt className="text-bo-muted">{t("Đơn mua", { context: "nhan" })}</dt>
                        <dd className="break-words">{dongDonMua(bb)}</dd>
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
            {!doiDuoc && bb.nguoiPhuTrach ? <TheNguoiPhuTrach nguoi={bb.nguoiPhuTrach} className="border-0 bg-bo-surface p-3.5 md:p-3.5" /> : null}
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
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bo-surface text-bo-muted">
                    <Info className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h2 id="bb-khung-tieu-de" className="text-base font-semibold text-bo-heading">{t("Không còn chọn được trên cổng")}</h2>
                    <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">
                        {t("Đơn mua của biên bản này đã kết thúc, vui lòng liên hệ người phụ trách.")}
                    </p>
                </div>
            </div>
            {bb.nguoiPhuTrach ? <TheNguoiPhuTrach nguoi={bb.nguoiPhuTrach} className="border-0 bg-bo-surface p-3.5 md:p-3.5" /> : null}
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
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bo-surface text-bo-muted">
                    <Ban className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h2 id="bb-khung-tieu-de" className="text-base font-semibold text-bo-heading">{t("Biên bản đã hủy")}</h2>
                    <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">
                        {t("Chúng tôi đã hủy biên bản này nên Quý công ty không cần trả lời. Cần trao đổi, vui lòng liên hệ người phụ trách mua hàng.")}
                    </p>
                </div>
            </div>
            {bb.nguoiPhuTrach ? <TheNguoiPhuTrach nguoi={bb.nguoiPhuTrach} className="border-0 bg-bo-surface p-3.5 md:p-3.5" /> : null}
            <Button asChild className="h-10 w-full gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                <Link to={DUONG_DAN_CONG.canXuLy}>
                    {t("Việc tiếp theo")} <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
            </Button>
        </>
    );
}
