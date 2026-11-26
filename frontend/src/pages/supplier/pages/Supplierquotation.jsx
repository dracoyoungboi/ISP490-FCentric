import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Info, Plus, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import SurfaceCard from '@/components/shared/SurfaceCard';
import KhungCongNhaCungCap from '@/components/supplier-portal/KhungCongNhaCungCap';
import ThongTinDonMua, { CanGiaoTruoc, DongThongTinDon } from '@/components/supplier-portal/ThongTinDonMua';
import BangBaoGia from '@/components/supplier-portal/BangBaoGia';
import HopGuiBaoGia from '@/components/supplier-portal/HopGuiBaoGia';
import HopHoiRoiTrang from '@/components/supplier-portal/HopHoiRoiTrang';
import useHoiKhiRoiTrang from '@/hooks/useHoiKhiRoiTrang';
import {
    GHI_CHU_TOI_DA,
    coThayDoiChuaGui,
    daCoBaoGiaTruoc,
    gioVaNgay,
    laDonNhanBaoGia,
    loaiNhanTrangThaiCong,
    taoDongBaoGia,
    taoPayloadBaoGia,
    timDongThieuGia,
    tinhTong,
} from '@/components/supplier-portal/baoGiaUtils';
import { xuLyLoiGuiBaoGia, xuLyLoiTai } from '@/components/supplier-portal/loiCong';
import { KhungKhongTimThay, KhungLoiTai, KhungXuongCong } from '@/components/supplier-portal/TrangThaiTaiCong';
import { taiLaiSoViec, useCongNcc, useTieuDeCong } from '@/components/supplier-portal/useCongNcc';
import { nhomTheoSanPham } from '@/components/supplier-portal/nhomBaoGia';
import { getDonMuaHangStatus } from '@/constants/donMuaHang';
import { formatCurrency } from '@/utils/formatters';
import congNhaCungCapService from '@/services/congNhaCungCapService';
import useTaiDuLieu from '@/hooks/useTaiDuLieu';
import { cn } from '@/lib/utils';
import { t } from "@/i18n";

// Trang cũ không cho gửi khi đơn chưa có ngày giao dự kiến (ô ngày chỉ đọc) — giữ nguyên điều kiện này
const LOI_THIEU_NGAY_GIAO = t("Đơn mua hàng chưa có ngày cần giao nên chưa gửi được báo giá. Vui lòng liên hệ người phụ trách đơn.");
// Tên trạng thái hiển thị cho nhà cung cấp (phía nhà cung cấp, khác tên trạng thái đơn ở phần quản trị)
// i18n-giu-nguyen: nhãn đưa vào StatusBadge (badge tự dịch và tra màu theo tên Việt)
const NHAN_CHO_BAO_GIA = { label: 'Chờ báo giá' };
// i18n-giu-nguyen: nhãn đưa vào StatusBadge (badge tự dịch và tra màu theo tên Việt)
const NHAN_DA_GUI = { label: 'Đã gửi báo giá' };

// Phiên báo giá hết hạn khi bấm Gửi: đơn giá + ghi chú chưa gửi lưu tạm trong thẻ trình duyệt này (sessionStorage, không
// có mã phiên), nhận mã mới vào lại đúng đơn thì điền lại một lần — không bắt nhà cung cấp nhập lại từ đầu
const khoaNhapChuaGui = (donId) => `fcentric.baoGiaChuaGui.${donId}`;

function luuNhapChuaGui(donId, dong, ghiChu) {
    try {
        const gia = dong.map(({ id, donGia }) => [id, donGia]);
        window.sessionStorage.setItem(khoaNhapChuaGui(donId), JSON.stringify({ gia, ghiChu }));
    } catch {
        // Trình duyệt chặn lưu: bỏ qua, nhà cung cấp nhập lại
    }
}

function docNhapChuaGui(donId) {
    try {
        const nhap = JSON.parse(window.sessionStorage.getItem(khoaNhapChuaGui(donId)) ?? 'null');
        return nhap && Array.isArray(nhap.gia) ? nhap : null;
    } catch {
        return null;
    }
}

function xoaNhapChuaGui(donId) {
    try {
        window.sessionStorage.removeItem(khoaNhapChuaGui(donId));
    } catch {
        // không xóa được thì thôi
    }
}

const CAU_ROI_BAO_GIA = {
    roi: t("Rời trang báo giá?"),
    mat: t("Đơn giá bạn đã nhập chưa được gửi sẽ mất."),
};

/** Phần tử khớp bộ chọn đang hiện trên màn (bảng và thẻ điện thoại cùng có mặt, một bên bị ẩn theo bề rộng). */
const phanTuDangHien = (chon) => [...document.querySelectorAll(chon)].find((el) => el.offsetParent !== null);

const MO_TA_GHI_CHU = t("Không bắt buộc. Điều kiện giao hàng, thanh toán hoặc lưu ý khác.");

const O_GHI_CHU_CHUNG =
    'block min-h-[84px] w-full resize-y rounded-md border border-bo-border bg-white px-3 py-2.5 text-base leading-[22px] text-bo-foreground placeholder:text-bo-muted/70 focus-visible:border-bo-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/15 md:text-sm';

/**
 * `orderData`, `cuaHang`: GET /cong-ncc/don-mua/{id} (đơn của nhà cung cấp đang đăng nhập).
 * `daGuiLuc`: giờ máy chủ nhận báo giá của lần gửi vừa rồi (ghi vào state của lịch sử: tải lại trang vẫn ở khung đã gửi).
 * Sau khi gửi, trang chỉ xem như trước; muốn sửa đơn giá thì mở lại đơn từ Cần xử lý / Lịch sử rồi gửi lại.
 * `nhaCungCap` (phiên): tên và email hiện ở thanh trên. `hetPhien`, `thoat`: từ useCongNcc.
 */
function TrangBaoGia({ orderData, daGuiLuc, cuaHang, nhaCungCap, hetPhien, thoat: thoatCong }) {
    const location = useLocation();
    const navigate = useNavigate();

    // Ảnh chụp lúc mở trang: so để biết còn thay đổi chưa gửi khi bấm Thoát
    const [dongBanDau] = useState(() => taoDongBaoGia(orderData));
    const [ghiChuBanDau] = useState(() => orderData.ghiChuNCC || '');
    // Bản nhập chưa gửi của lần phiên hết hạn trước (chỉ khi đơn còn nhận báo giá); vẫn so với dongBanDau nên Thoát
    // vẫn hỏi vì còn thay đổi chưa gửi
    const [nhapChuaGui] = useState(() =>
        laDonNhanBaoGia(orderData) && !daGuiLuc ? docNhapChuaGui(orderData.id) : null,
    );
    const [dong, setDong] = useState(() => {
        if (!nhapChuaGui) return dongBanDau;
        const gia = new Map(nhapChuaGui.gia);
        return dongBanDau.map((d) => (gia.has(d.id) ? { ...d, donGia: gia.get(d.id) } : d));
    });
    // Gom theo sản phẩm chỉ để hiển thị; chỉ phụ thuộc sản phẩm của đơn nên tính một lần
    const [nhom] = useState(() => nhomTheoSanPham(dongBanDau));
    const ghiChuKhoiTao = nhapChuaGui ? String(nhapChuaGui.ghiChu ?? '') : ghiChuBanDau;
    // Ghi chú chung: thu thành nút, bấm mới mở ô (đã có ghi chú từ lần báo giá trước thì mở sẵn)
    const [moGhiChuChung, setMoGhiChuChung] = useState(() => Boolean(ghiChuKhoiTao));
    const [ghiChu, setGhiChu] = useState(ghiChuKhoiTao);
    const [dongLoi, setDongLoi] = useState([]);
    // null | 'xac-nhan' | 'dang-gui' | 'loi' | 'thanh-cong'
    const [hop, setHop] = useState(null);
    const [loiGui, setLoiGui] = useState('');
    // Đơn chưa có ngày cần giao thì báo ngay khi mở trang (không đợi tới lúc bấm Gửi mới biết)
    const [loiChung, setLoiChung] = useState(() => (orderData.ngayGiaoDuKien ? '' : LOI_THIEU_NGAY_GIAO));
    // Hỏi lại trước khi rời trang khi còn đơn giá chưa gửi: null | { lyDo, tiepTuc } (xem HopHoiRoiTrang)
    const [hoiRoi, setHoiRoi] = useState(null);
    // Giờ máy chủ nhận báo giá của lần gửi trong phiên này (dùng ngay cho hộp thành công, không chờ router cập nhật state)
    const [guiLuc, setGuiLuc] = useState(null);
    // Địa chỉ máy chủ xếp gửi email Đã nhận báo giá (null: không nói gì về email)
    const [emailXacNhan, setEmailXacNhan] = useState(null);
    // Máy chủ báo đơn không còn nhận báo giá (đơn đã có kết quả trong lúc nhà cung cấp đang nhập)
    const [khongConNhan, setKhongConNhan] = useState(false);
    const loiChungRef = useRef(null);
    const bangRef = useRef(null);
    const conMoRef = useRef(true);
    // Chặn gửi trùng (bấm liên tiếp, hoặc bấm trúng nút trong lúc hộp đang đóng)
    const dangGuiRef = useRef(false);

    useEffect(() => {
        conMoRef.current = true;
        return () => {
            conMoRef.current = false;
        };
    }, []);

    // Bản nhập chưa gửi chỉ điền lại một lần (đọc ở lúc khởi tạo, xóa sau khi gắn)
    useEffect(() => {
        xoaNhapChuaGui(orderData.id);
    }, [orderData.id]);

    const daGui = guiLuc || daGuiLuc;
    const conNhan = laDonNhanBaoGia(orderData) && !khongConNhan;
    const chiXem = !conNhan || Boolean(daGui);
    const tong = useMemo(() => tinhTong(dong), [dong]);
    const daBaoGiaTruoc = !chiXem && daCoBaoGiaTruoc(orderData);
    const tenNhaCungCap = orderData.nhaCungCap?.tenNhaCungCap || nhaCungCap?.ten;
    const email = nhaCungCap?.email || orderData.nhaCungCap?.email;
    const tenCuaHang = String(cuaHang?.ten ?? '').trim();

    const coBienThe = nhom.length < dong.length;
    const thieuGia = tong.daNhapGia < tong.soSanPham;

    const bamGui = () => {
        if (!orderData.ngayGiaoDuKien) {
            setLoiChung(LOI_THIEU_NGAY_GIAO);
            requestAnimationFrame(() => loiChungRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
            return;
        }
        setLoiChung('');
        const thieu = timDongThieuGia(dong);
        setDongLoi(thieu);
        if (thieu.length) {
            // Bảng tự bỏ lọc, mở nhóm cần thiết, cuộn tới chỗ thiếu đầu tiên và đặt con trỏ vào đó
            // (nhóm đang bật "Một giá cho cả nhóm" thì vào ô giá chung)
            bangRef.current?.denDongThieuGia(thieu);
            return;
        }
        setLoiGui('');
        setHop('xac-nhan');
    };

    const guiBaoGia = async () => {
        if (chiXem || dangGuiRef.current) return;
        dangGuiRef.current = true;
        setHop('dang-gui');
        try {
            const res = await congNhaCungCapService.guiBaoGia(orderData.id, taoPayloadBaoGia(orderData, dong, ghiChu));
            if (!conMoRef.current) return;
            const kq = res?.data ?? {};
            // Giờ hiện là giờ máy chủ ghi nhận (ngayBaoGia), như email Đã nhận báo giá
            const luc = kq.ngayBaoGia || new Date().toISOString();
            setGuiLuc(luc);
            setEmailXacNhan(kq.emailXacNhan || null);
            setDongLoi([]);
            setHop('thanh-cong');
            // Ghi vào lịch sử: tải lại trang (đọc lại đơn từ máy chủ) vẫn ở chế độ chỉ xem với đơn giá vừa gửi
            navigate(location.pathname, {
                replace: true,
                state: { ...location.state, daGuiLuc: luc },
            });
            taiLaiSoViec();
        } catch (err) {
            if (!conMoRef.current) return;
            const kq = xuLyLoiGuiBaoGia(err);
            if (kq.loai === 'phien-het-han') {
                // Nhận mã mới xong quay lại đúng đơn này (?tiep=) và điền lại đơn giá vừa nhập
                luuNhapChuaGui(orderData.id, dong, ghiChu);
                hetPhien();
                return;
            }
            if (kq.loai === 'khong-con-nhan') {
                // Chỉ xem: hiện lại báo giá máy chủ đang giữ (lần gửi trước, hoặc chưa có giá), không hiện số chưa gửi được
                setDong(dongBanDau);
                setGhiChu(ghiChuBanDau);
                setDongLoi([]);
                setKhongConNhan(true);
                setHop(null);
                return;
            }
            setLoiGui(kq.cau);
            setHop('loi');
        } finally {
            dangGuiRef.current = false;
        }
    };

    const dongHop = () => {
        if (hop !== 'dang-gui') setHop(null);
    };

    // Còn đơn giá / ghi chú chưa gửi: Thoát, đổi ngôn ngữ (menu tài khoản), tab, link, nút Back hỏi lại bằng HopHoiRoiTrang;
    // đóng thẻ / tải lại trang hỏi bằng hộp của trình duyệt. Đang gửi thì thôi hỏi.
    const coThayDoi = !chiXem && hop !== 'dang-gui' && coThayDoiChuaGui(dongBanDau, dong, ghiChuBanDau, ghiChu);
    useHoiKhiRoiTrang(coThayDoi, (tiepTuc, lyDo) => setHoiRoi({ tiepTuc, lyDo }));
    // Ô ghi chú có hai chỗ (trong thẻ bảng từ 768px, thẻ riêng dưới 768px): mở bằng nút thì đặt con trỏ vào ô đang hiện
    const moGhiChu = () => {
        setMoGhiChuChung(true);
        requestAnimationFrame(() => requestAnimationFrame(() => phanTuDangHien('[data-o-ghi-chu]')?.focus()));
    };
    /** Thu ô ghi chú chung về nút "+ Thêm ghi chú…" và xóa nội dung (ghi chú không bắt buộc). */
    const thuGhiChu = (traConTro) => {
        setGhiChu('');
        setMoGhiChuChung(false);
        if (traConTro) requestAnimationFrame(() => phanTuDangHien('[data-nut-them-ghi-chu]')?.focus());
    };

    // Đã gửi (trong phiên này hoặc trước đó) / chờ báo giá / tên trạng thái chung của đơn khi không còn nhận báo giá;
    // máy chủ vừa báo DON_KHONG_CON_NHAN mà đơn trên trang vẫn ở 2 thì không hiện thẻ (xem loaiNhanTrangThaiCong).
    const loaiNhan = loaiNhanTrangThaiCong({
        daGui: Boolean(daGui),
        chiXem,
        daBaoGiaTruoc,
        donConNhanBaoGia: laDonNhanBaoGia(orderData),
    });
    const nhan =
        loaiNhan === 'da-gui'
            ? NHAN_DA_GUI
            : loaiNhan === 'cho-bao-gia'
              ? NHAN_CHO_BAO_GIA
              : loaiNhan === 'theo-don'
                ? getDonMuaHangStatus(orderData.trangThai)
                : null;
    const tieuDeGhiChu = tenCuaHang ? t("Ghi chú cho {{tenCuaHang}}", { tenCuaHang }) : t("Ghi chú");
    const nhanThemGhiChu = tenCuaHang ? t("Thêm ghi chú cho {{tenCuaHang}}", { tenCuaHang }) : t("Thêm ghi chú");

    /** Ô nhập ghi chú chung + bộ đếm ký tự; `idDem`: mỗi chỗ đặt ô một id riêng. */
    const oGhiChu = (idDem) => (
        <>
            <textarea
                data-o-ghi-chu=""
                aria-label={tieuDeGhiChu}
                aria-describedby={idDem}
                rows={3}
                maxLength={GHI_CHU_TOI_DA}
                placeholder={t("VD: Giá đã gồm vận chuyển đến kho; thanh toán 50% khi xác nhận đơn.")}
                value={ghiChu}
                onChange={(e) => setGhiChu(e.target.value.slice(0, GHI_CHU_TOI_DA))}
                onBlur={(e) => {
                    // Mở ra mà để trống rồi bấm chỗ khác thì tự thu lại (bấm "Bỏ ghi chú" thì để nút đó xử lý)
                    const khoi = e.currentTarget.closest('[data-khoi-ghi-chu], section');
                    if (!e.currentTarget.value.trim() && !khoi?.contains(e.relatedTarget)) thuGhiChu(false);
                }}
                className={O_GHI_CHU_CHUNG}
            />
            <p id={idDem} className="m-0 mt-1.5 text-right text-xs leading-4 text-bo-muted tabular-nums">
                {ghiChu.length.toLocaleString('vi-VN')}/{GHI_CHU_TOI_DA.toLocaleString('vi-VN')}
            </p>
        </>
    );
    const nutBoGhiChu = (className) => (
        <button
            type="button"
            onClick={() => thuGhiChu(true)}
            className={cn(
                'flex h-11 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 sm:h-9',
                className,
            )}
        >
            <X className="size-4" aria-hidden="true" />
            {t("Bỏ ghi chú")}
        </button>
    );

    // Từ 768px: ghi chú chung nằm trong thẻ bảng, ngay trên chân thẻ (đã gửi mà không có ghi chú thì không vẽ)
    const khoiGhiChuBang = (chiXem ? Boolean(ghiChu) : moGhiChuChung) && (
        <div data-khoi-ghi-chu="" className="border-t border-bo-border px-4 py-3.5">
            <div className="mb-2 flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <h2 className="m-0 text-sm leading-5 font-semibold text-bo-foreground">{tieuDeGhiChu}</h2>
                    {!chiXem && <span className="text-[13px] leading-5 text-bo-muted">{MO_TA_GHI_CHU}</span>}
                </div>
                {!chiXem && nutBoGhiChu('-my-1.5 -mr-2 h-9')}
            </div>
            {chiXem ? <p className="m-0 text-sm leading-[22px] whitespace-pre-line text-slate-700">{ghiChu}</p> : oGhiChu('bg-ghi-chu-dem')}
        </div>
    );

    // Tổng SL | Đã có giá | Tổng tiền: chân thẻ bảng (từ 768px) và khối dính đáy (dưới 768px). Đã gửi thì bỏ "Đã có giá".
    const soLieuTong = [
        { nhan: t("Tổng SL"), giaTri: tong.tongSoLuong.toLocaleString('vi-VN') },
        !chiXem && { nhan: t("Đã có giá"), giaTri: `${tong.daNhapGia}/${tong.soSanPham}`, mau: thieuGia ? 'text-bo-warning' : 'text-bo-success' },
        { nhan: t("Tổng tiền"), giaTri: formatCurrency(tong.tongTien) },
    ].filter(Boolean);

    // Từ 768px: chân thẻ bảng thay hàng Tổng cộng và thanh Gửi báo giá cũ; dính đáy màn khi bảng dài, cuộn hết thì khép
    // lại thành đáy thẻ
    const chanTheBang = (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-bo-border bg-bo-surface-subtle py-2.5 pr-3 pl-4">
            <div className="min-w-0">
                {!chiXem && !moGhiChuChung ? (
                    <button
                        data-nut-them-ghi-chu=""
                        type="button"
                        onClick={moGhiChu}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md text-sm font-medium text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                    >
                        <Plus className="size-4" aria-hidden="true" />
                        {nhanThemGhiChu}
                        <span className="font-normal text-bo-muted">{t("(không bắt buộc)")}</span>
                    </button>
                ) : (
                    <span className="text-[13px] leading-5 font-semibold">
                        {t("Tổng cộng · {{count}} sản phẩm", { count: nhom.length })}
                        {coBienThe ? t(", {{count}} phân loại", { count: tong.soSanPham }) : ''}
                    </span>
                )}
            </div>
            <dl className="m-0 ml-auto flex items-center divide-x divide-bo-border">
                {soLieuTong.map(({ nhan, giaTri, mau }, k) => (
                    <div key={nhan} className="flex items-baseline gap-2 px-4 first:pl-0 last:pr-0">
                        <dt className="text-[13px] leading-5 text-bo-muted">{nhan}</dt>
                        <dd
                            className={cn(
                                'm-0 font-semibold whitespace-nowrap text-bo-heading tabular-nums',
                                k === soLieuTong.length - 1 ? 'text-base leading-6 font-bold' : 'text-sm leading-5',
                                mau,
                            )}
                        >
                            {giaTri}
                        </dd>
                    </div>
                ))}
            </dl>
            {!chiXem && (
                <Button type="button" onClick={bamGui} className="h-9 gap-2 bg-bo-primary px-4 text-white hover:bg-bo-primary-hover">
                    <Send aria-hidden="true" />
                    {t("Gửi báo giá")}
                </Button>
            )}
        </div>
    );

    return (
        <KhungCongNhaCungCap tenNhaCungCap={tenNhaCungCap} email={email} onThoat={thoatCong} chanTrang={false}>
            <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-4 md:gap-5 md:p-6">
                <div className="flex flex-col gap-1.5">
                    <div className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:gap-3">
                        <h1 className="text-xl leading-7 font-bold tracking-tight break-words text-bo-heading md:text-2xl md:leading-8">
                            {t("Báo giá đơn {{soDon}}", { soDon: orderData.soDonMua })}
                        </h1>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {nhan && <StatusBadge quyTrinh={chiXem && !daGui ? 'donMua' : 'yeuCauBaoGia'} label={nhan.label} />}
                            <CanGiaoTruoc ngay={orderData.ngayGiaoDuKien} className="text-[13px] leading-5 text-slate-600 md:hidden" />
                        </div>
                    </div>
                    <DongThongTinDon orderData={orderData} />
                </div>

                {loiChung && !chiXem && (
                    <div ref={loiChungRef} role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-bo-danger-soft px-3.5 py-3 text-sm leading-5 text-bo-danger-strong">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>{loiChung}</span>
                    </div>
                )}

                {daGui ? (
                    <div role="status" className="flex items-start gap-2 rounded-lg border border-green-200 bg-bo-success-soft px-3.5 py-3 text-sm leading-5 text-bo-success">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        {/* Chữ theo email Đã nhận báo giá (M3) */}
                        <span>
                            {t("Đã gửi báo giá lúc")} <strong className="font-semibold">{gioVaNgay(daGui)}</strong>{t(". Cần sửa đơn giá: gửi lại trên Cổng nhà cung cấp trước khi có kết quả. Báo giá gửi sau sẽ thay báo giá này.")}
                        </span>
                    </div>
                ) : chiXem ? (
                    <div role="status" className="flex items-start gap-2 rounded-lg border border-bo-border bg-bo-surface px-3.5 py-3 text-sm leading-5 text-slate-700">
                        <Info className="mt-0.5 size-4 shrink-0 text-bo-muted" aria-hidden="true" />
                        <span>{t("Đơn này không còn nhận báo giá. Nếu cần trao đổi, vui lòng liên hệ người phụ trách đơn.")}</span>
                    </div>
                ) : nhapChuaGui ? (
                    // Bảng đang hiện số nhập trước khi phiên hết hạn, không phải đơn giá đã gửi: nói rõ là chưa gửi
                    <div role="status" className="flex items-start gap-2 rounded-lg border border-blue-200 bg-bo-primary-soft px-3 py-2.5 text-sm leading-5 text-blue-700">
                        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>
                            {t("Đã điền lại đơn giá và ghi chú bạn nhập trước khi phiên hết hạn. Các số này")} <strong className="font-semibold">{t("chưa được gửi")}</strong>{t(": bấm Gửi báo giá để gửi")}{daBaoGiaTruoc ? t(", báo giá gửi lần này sẽ thay báo giá đã gửi trước đó") : ''}.
                        </span>
                    </div>
                ) : daBaoGiaTruoc ? (
                    <div role="status" className="flex items-start gap-2 rounded-lg border border-blue-200 bg-bo-primary-soft px-3 py-2.5 text-sm leading-5 text-blue-700">
                        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>{t("Bạn đã gửi báo giá cho đơn này trước đó. Đơn giá đã gửi đang hiện sẵn bên dưới; gửi lại sẽ thay đơn giá cũ.")}</span>
                    </div>
                ) : null}

                <ThongTinDonMua orderData={orderData} tenCuaHang={tenCuaHang} />

                <BangBaoGia
                    ref={bangRef}
                    dong={dong}
                    nhom={nhom}
                    tong={tong}
                    chiXem={chiXem}
                    dongLoi={dongLoi}
                    onCapNhatDong={setDong}
                    ghiChu={khoiGhiChuBang}
                    chanThe={chanTheBang}
                />

                {/* Dưới 768px: ghi chú là nút / thẻ riêng sau các thẻ sản phẩm (từ 768px nằm trong thẻ bảng) */}
                <div className="flex flex-col md:hidden">
                    {!chiXem && !moGhiChuChung ? (
                        <button
                            data-nut-them-ghi-chu=""
                            type="button"
                            onClick={moGhiChu}
                            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-bo-surface px-3.5 text-sm font-medium text-bo-primary hover:border-bo-primary hover:bg-bo-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                        >
                            <Plus className="size-4" aria-hidden="true" />
                            {nhanThemGhiChu}
                            <span className="font-normal text-bo-muted">{t("(không bắt buộc)")}</span>
                        </button>
                    ) : (
                        <SurfaceCard
                            title={tieuDeGhiChu}
                            description={chiXem ? undefined : MO_TA_GHI_CHU}
                            action={!chiXem && nutBoGhiChu('-my-1 -mr-2')}
                        >
                            {chiXem ? (
                                <p className={`m-0 text-sm leading-[22px] whitespace-pre-line ${ghiChu ? 'text-slate-700' : 'text-bo-muted'}`}>
                                    {ghiChu || t("Không có ghi chú.")}
                                </p>
                            ) : (
                                oGhiChu('bg-ghi-chu-dem-the')
                            )}
                        </SurfaceCard>
                    )}
                </div>

                {/* Dưới 768px: khối dính đáy (mỗi sản phẩm là một thẻ riêng nên không gộp được vào chân thẻ bảng) */}
                {!chiXem && dong.length > 0 && (
                    <div className="sticky bottom-0 z-10 -mx-4 -mb-4 bg-bo-canvas px-4 pt-1 pb-4 md:hidden">
                        <div className="rounded-lg border border-bo-border bg-bo-surface shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
                            <dl className="m-0 grid grid-cols-[minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1.3fr)] divide-x divide-bo-border border-b border-bo-border text-center">
                                {soLieuTong.map(({ nhan, giaTri, mau }) => (
                                    <div key={nhan} className="flex min-w-0 flex-col gap-0.5 px-2 py-2">
                                        <dt className="text-xs leading-4 text-bo-muted">{nhan}</dt>
                                        <dd className={cn('m-0 text-sm leading-5 font-semibold break-words text-bo-heading tabular-nums', mau)}>{giaTri}</dd>
                                    </div>
                                ))}
                            </dl>
                            <div className="p-3">
                                <Button
                                    type="button"
                                    onClick={bamGui}
                                    className="h-11 w-full gap-2 bg-bo-primary px-5 text-[15px] text-white hover:bg-bo-primary-hover"
                                >
                                    <Send aria-hidden="true" />
                                    {t("Gửi báo giá")}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <HopGuiBaoGia
                trangThai={hop}
                tomTat={{
                    soDonMua: orderData.soDonMua,
                    soSanPham: tong.soSanPham,
                    soNhom: nhom.length,
                    tongSoLuong: tong.tongSoLuong,
                    ngayCanGiao: orderData.ngayGiaoDuKien,
                    tongTien: tong.tongTien,
                }}
                guiLuc={daGui}
                loiGui={loiGui}
                tenCuaHang={tenCuaHang}
                emailXacNhan={emailXacNhan}
                onGui={guiBaoGia}
                onDong={dongHop}
            />
            <HopHoiRoiTrang hoi={hoiRoi} cau={CAU_ROI_BAO_GIA} onO={() => setHoiRoi(null)} />
        </KhungCongNhaCungCap>
    );
}

/** GET đơn của cổng; máy chủ trả thiếu đơn thì coi như không tìm thấy. */
async function taiDonMua(id) {
    const kq = await congNhaCungCapService.donMua(id);
    if (!kq?.donMua) throw Object.assign(new Error('khong-co-don'), { response: { status: 404, data: {} } });
    return kq;
}

/**
 * Trang báo giá của nhà cung cấp: /supplier/portal/quotation/:id. Đọc đơn bằng GET /cong-ncc/don-mua/{id} với phiên
 * cổng; chưa đăng nhập / phiên hết hạn thì về trang nhận mã rồi quay lại đúng đơn.
 */
export default function SupplierQuotation() {
    const { id } = useParams();
    const location = useLocation();
    const { phien, hetPhien, thoat } = useCongNcc();
    const { data, error, dungKhoa, reload } = useTaiDuLieu(() => taiDonMua(id), String(id), { enabled: Boolean(phien) });
    // Đơn vừa gửi báo giá trong thẻ này (state của lịch sử): giữ khung "Đã gửi" và chỉ xem khi tải lại trang
    const daGuiLuc = location.state?.daGuiLuc ?? null;
    const kq = dungKhoa ? data : undefined;
    const loiTai = error && !kq ? xuLyLoiTai(error) : null;
    const tai = kq ? { trangThai: 'xong', donMua: kq.donMua, cuaHang: kq.cuaHang ?? null } : loiTai ? { trangThai: loiTai.loai, cau: loiTai.cau } : { trangThai: 'dang-tai' };

    useTieuDeCong(tai.donMua?.soDonMua ? t("Báo giá đơn {{soDon}}", { soDon: tai.donMua.soDonMua }) : t("Báo giá"));

    useEffect(() => {
        if (loiTai?.loai === 'phien-het-han') hetPhien();
    }, [loiTai?.loai, hetPhien]);

    if (!phien) return null;

    if (tai.trangThai === 'xong') {
        const orderData = tai.donMua;
        return (
            <TrangBaoGia
                key={orderData.id}
                orderData={orderData}
                daGuiLuc={daGuiLuc}
                cuaHang={tai.cuaHang}
                nhaCungCap={phien.nhaCungCap}
                hetPhien={hetPhien}
                thoat={thoat}
            />
        );
    }

    return (
        <KhungCongNhaCungCap tenNhaCungCap={phien.nhaCungCap?.ten} email={phien.nhaCungCap?.email} onThoat={thoat}>
            <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-4 md:gap-5 md:p-6">
                {tai.trangThai === 'dang-tai' ? (
                    <KhungXuongCong />
                ) : tai.trangThai === 'khong-tim-thay' ? (
                    <KhungKhongTimThay
                        tieuDe={t("Không tìm thấy đơn mua hàng")}
                        moTa={t("Đơn này không thuộc Quý công ty hoặc liên kết không đúng. Các đơn cần báo giá luôn có ở trang Cần xử lý.")}
                    />
                ) : (
                    <KhungLoiTai cau={tai.cau} onThuLai={reload} />
                )}
            </main>
        </KhungCongNhaCungCap>
    );
}
