import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Info, Plus, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import SurfaceCard from '@/components/shared/SurfaceCard';
import KhungCongNhaCungCap from '@/components/supplier-portal/KhungCongNhaCungCap';
import ThongTinDonMua, { CanGiaoTruoc, DongThongTinDon } from '@/components/supplier-portal/ThongTinDonMua';
import BangBaoGia from '@/components/supplier-portal/BangBaoGia';
import HopGuiBaoGia, { HopXacNhanThoat } from '@/components/supplier-portal/HopGuiBaoGia';
import {
    GHI_CHU_TOI_DA,
    capNhatDonSauKhiGui,
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
import { CAU_PHIEN_HET_HAN, diaChiDangNhapLai, xuLyLoiGuiBaoGia } from '@/components/supplier-portal/loiCong';
import { noiTenNhom, nhomTheoSanPham, tenNhomChua } from '@/components/supplier-portal/nhomBaoGia';
import { getDonMuaHangStatus } from '@/constants/donMuaHang';
import { formatCurrency } from '@/utils/formatters';
import supplierQuotationService from '@/services/supplierQuotationService';

const TB_CAN_DANG_NHAP = 'Vui lòng nhận mã xác nhận để xem và gửi báo giá.';
// Trang cũ không cho gửi khi đơn chưa có ngày giao dự kiến (ô ngày chỉ đọc) — giữ nguyên điều kiện này
const LOI_THIEU_NGAY_GIAO = 'Đơn mua hàng chưa có ngày cần giao nên chưa gửi được báo giá. Vui lòng liên hệ người phụ trách đơn.';
// Tên trạng thái hiển thị cho nhà cung cấp (phía nhà cung cấp, khác tên trạng thái đơn ở phần quản trị)
const NHAN_CHO_BAO_GIA = { label: 'Chờ báo giá' };
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

const O_GHI_CHU_CHUNG =
    'block min-h-[84px] w-full resize-y rounded-md border border-bo-border bg-white px-3 py-2.5 text-base leading-[22px] text-bo-foreground placeholder:text-bo-muted/70 focus-visible:border-bo-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/15 md:text-sm';

/**
 * `phienBaoGia`, `cuaHang`: máy chủ trả ở bước xác nhận mã (HOP-DONG 2.2), nằm trong state của lịch sử trình duyệt.
 * `daGuiLuc`: giờ máy chủ nhận báo giá của lần gửi trong phiên này (tải lại trang vẫn ở khung đã gửi).
 * Sau khi gửi, trang chỉ xem như trước; muốn sửa đơn giá thì vào lại cổng (nhận mã mới) rồi gửi lại.
 */
function TrangBaoGia({ orderData, daGuiLuc, phienBaoGia, cuaHang }) {
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
    // Mở bằng nút thì đặt con trỏ vào ô; mở sẵn lúc vào trang thì không
    const [vuaMoGhiChuChung, setVuaMoGhiChuChung] = useState(false);
    const [ghiChu, setGhiChu] = useState(ghiChuKhoiTao);
    const [dongLoi, setDongLoi] = useState([]);
    // null | 'xac-nhan' | 'dang-gui' | 'loi' | 'thanh-cong'
    const [hop, setHop] = useState(null);
    const [loiGui, setLoiGui] = useState('');
    // Đơn chưa có ngày cần giao thì báo ngay khi mở trang (không đợi tới lúc bấm Gửi mới biết)
    const [loiChung, setLoiChung] = useState(() => (orderData.ngayGiaoDuKien ? '' : LOI_THIEU_NGAY_GIAO));
    const [hoiThoat, setHoiThoat] = useState(false);
    // Giờ máy chủ nhận báo giá của lần gửi trong phiên này (dùng ngay cho hộp thành công, không chờ router cập nhật state)
    const [guiLuc, setGuiLuc] = useState(null);
    // Địa chỉ máy chủ xếp gửi email Đã nhận báo giá (null: không nói gì về email)
    const [emailXacNhan, setEmailXacNhan] = useState(null);
    // Máy chủ báo đơn không còn nhận báo giá (đơn đã có kết quả trong lúc nhà cung cấp đang nhập)
    const [khongConNhan, setKhongConNhan] = useState(false);
    const loiChungRef = useRef(null);
    const bangRef = useRef(null);
    const nutThemGhiChuRef = useRef(null);
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
    const tenNhaCungCap = orderData.nhaCungCap?.tenNhaCungCap;
    const email = location.state?.supplierEmail || orderData.nhaCungCap?.email;
    const tenCuaHang = String(cuaHang?.ten ?? '').trim();

    const coBienThe = nhom.length < dong.length;
    const donVi = coBienThe ? 'phân loại' : 'sản phẩm';
    const viTriThieu = timDongThieuGia(dong);
    // Chỉ nêu tên khi đã nhập được ít nhất một giá (đơn mới thì mọi sản phẩm đều thiếu, nêu tên không giúp gì)
    const conThieu = tong.daNhapGia > 0 && viTriThieu.length ? noiTenNhom(tenNhomChua(nhom, viTriThieu)) : '';
    const phanTram = tong.soSanPham ? Math.round((tong.daNhapGia / tong.soSanPham) * 100) : 0;

    /** Phiên báo giá hết hạn: về trang nhận mã của đúng đơn và email, kèm câu báo. */
    const veNhanMaMoi = () =>
        navigate(diaChiDangNhapLai(orderData.id, email), { replace: true, state: { thongBao: CAU_PHIEN_HET_HAN } });

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
            const res = await supplierQuotationService.submitQuote(taoPayloadBaoGia(orderData, dong, ghiChu), phienBaoGia);
            if (!conMoRef.current) return;
            const kq = res?.data ?? {};
            // Giờ hiện là giờ máy chủ ghi nhận (ngayBaoGia), như email Đã nhận báo giá
            const luc = kq.ngayBaoGia || new Date().toISOString();
            setGuiLuc(luc);
            setEmailXacNhan(kq.emailXacNhan || null);
            setDongLoi([]);
            setHop('thanh-cong');
            // Ghi vào lịch sử: tải lại trang vẫn ở chế độ chỉ xem với đơn giá vừa gửi
            navigate(location.pathname, {
                replace: true,
                state: {
                    ...location.state,
                    orderData: capNhatDonSauKhiGui(orderData, dong, ghiChu, luc),
                    daGuiLuc: luc,
                },
            });
        } catch (err) {
            if (!conMoRef.current) return;
            const kq = xuLyLoiGuiBaoGia(err);
            if (kq.loai === 'phien-het-han') {
                luuNhapChuaGui(orderData.id, dong, ghiChu);
                veNhanMaMoi();
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

    const thoat = () => navigate('/supplier/login', { replace: true });
    const moGhiChu = () => {
        setMoGhiChuChung(true);
        setVuaMoGhiChuChung(true);
    };
    /** Thu ô ghi chú chung về nút "+ Thêm ghi chú…" và xóa nội dung (ghi chú không bắt buộc). */
    const thuGhiChu = (traConTro) => {
        setGhiChu('');
        setMoGhiChuChung(false);
        setVuaMoGhiChuChung(false);
        if (traConTro) requestAnimationFrame(() => nutThemGhiChuRef.current?.focus());
    };

    const bamThoat = () => {
        if (!chiXem && coThayDoiChuaGui(dongBanDau, dong, ghiChuBanDau, ghiChu)) setHoiThoat(true);
        else thoat();
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
    const tieuDeGhiChu = tenCuaHang ? `Ghi chú cho ${tenCuaHang}` : 'Ghi chú';

    return (
        <KhungCongNhaCungCap tenNhaCungCap={tenNhaCungCap} email={email} onThoat={bamThoat}>
            <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 md:gap-5 md:p-6">
                <div className="flex flex-col gap-1.5">
                    <div className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:gap-3">
                        <h1 className="text-xl leading-7 font-bold tracking-tight break-words text-bo-heading md:text-2xl md:leading-8">
                            Báo giá đơn {orderData.soDonMua}
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
                            Đã gửi báo giá lúc <strong className="font-semibold">{gioVaNgay(daGui)}</strong>. Cần sửa đơn giá: gửi lại trên Cổng nhà
                            cung cấp trước khi có kết quả. Báo giá gửi sau sẽ thay báo giá này.
                        </span>
                    </div>
                ) : chiXem ? (
                    <div role="status" className="flex items-start gap-2 rounded-lg border border-bo-border bg-bo-surface px-3.5 py-3 text-sm leading-5 text-slate-700">
                        <Info className="mt-0.5 size-4 shrink-0 text-bo-muted" aria-hidden="true" />
                        <span>Đơn này không còn nhận báo giá. Nếu cần trao đổi, vui lòng liên hệ người phụ trách đơn.</span>
                    </div>
                ) : nhapChuaGui ? (
                    // Bảng đang hiện số nhập trước khi phiên hết hạn, không phải đơn giá đã gửi: nói rõ là chưa gửi
                    <div role="status" className="flex items-start gap-2 rounded-lg border border-blue-200 bg-bo-primary-soft px-3 py-2.5 text-sm leading-5 text-blue-700">
                        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>
                            Đã điền lại đơn giá và ghi chú bạn nhập trước khi phiên hết hạn. Các số này <strong className="font-semibold">chưa được gửi</strong>:
                            bấm Gửi báo giá để gửi{daBaoGiaTruoc ? ', báo giá gửi lần này sẽ thay báo giá đã gửi trước đó' : ''}.
                        </span>
                    </div>
                ) : daBaoGiaTruoc ? (
                    <div role="status" className="flex items-start gap-2 rounded-lg border border-blue-200 bg-bo-primary-soft px-3 py-2.5 text-sm leading-5 text-blue-700">
                        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>Bạn đã gửi báo giá cho đơn này trước đó. Đơn giá đã gửi đang hiện sẵn bên dưới; gửi lại sẽ thay đơn giá cũ.</span>
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
                />

                {!chiXem && !moGhiChuChung ? (
                    <button
                        ref={nutThemGhiChuRef}
                        type="button"
                        onClick={moGhiChu}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-bo-surface px-3.5 text-sm font-medium text-bo-primary hover:border-bo-primary hover:bg-bo-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 md:h-10 md:w-auto md:self-start"
                    >
                        <Plus className="size-4" aria-hidden="true" />
                        {tenCuaHang ? `Thêm ghi chú cho ${tenCuaHang}` : 'Thêm ghi chú'}
                        <span className="font-normal text-bo-muted">(không bắt buộc)</span>
                    </button>
                ) : (
                    <SurfaceCard
                        title={tieuDeGhiChu}
                        description={chiXem ? undefined : 'Không bắt buộc. Điều kiện giao hàng, thanh toán hoặc lưu ý khác.'}
                        action={
                            !chiXem && (
                                <button
                                    type="button"
                                    onClick={() => thuGhiChu(true)}
                                    className="-my-1 -mr-2 flex h-11 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 sm:h-9"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                    Bỏ ghi chú
                                </button>
                            )
                        }
                    >
                        {chiXem ? (
                            <p className={`m-0 text-sm leading-[22px] whitespace-pre-line ${ghiChu ? 'text-slate-700' : 'text-bo-muted'}`}>
                                {ghiChu || 'Không có ghi chú.'}
                            </p>
                        ) : (
                            <>
                                <textarea
                                    aria-label={tieuDeGhiChu}
                                    aria-describedby="bg-ghi-chu-dem"
                                    rows={3}
                                    autoFocus={vuaMoGhiChuChung}
                                    maxLength={GHI_CHU_TOI_DA}
                                    placeholder="VD: Giá đã gồm vận chuyển đến kho; thanh toán 50% khi xác nhận đơn."
                                    value={ghiChu}
                                    onChange={(e) => setGhiChu(e.target.value.slice(0, GHI_CHU_TOI_DA))}
                                    onBlur={(e) => {
                                        // Mở ra mà để trống rồi bấm chỗ khác thì tự thu lại (bấm "Bỏ ghi chú" thì để nút đó xử lý)
                                        const theGhiChu = e.currentTarget.closest('section');
                                        if (!e.currentTarget.value.trim() && !theGhiChu?.contains(e.relatedTarget)) thuGhiChu(false);
                                    }}
                                    className={O_GHI_CHU_CHUNG}
                                />
                                <p id="bg-ghi-chu-dem" className="m-0 mt-1.5 text-right text-xs leading-4 text-bo-muted tabular-nums">
                                    {ghiChu.length.toLocaleString('vi-VN')}/{GHI_CHU_TOI_DA.toLocaleString('vi-VN')}
                                </p>
                            </>
                        )}
                    </SurfaceCard>
                )}
            </main>

            {!chiXem && dong.length > 0 && (
                <div className="sticky bottom-0 z-10 border-t border-bo-border bg-bo-surface shadow-[0_-1px_3px_0_rgba(0,0,0,0.06)]">
                    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2.5 px-4 pt-3 pb-4 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4 md:px-6 md:py-3">
                        <div className="flex min-w-0 flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:gap-x-6 md:gap-y-1">
                            <div className="flex items-baseline justify-between gap-2 md:justify-start md:gap-3">
                                <span className="text-[13px] leading-5 text-bo-muted md:hidden">
                                    Tổng tiền · đã có giá {tong.daNhapGia}/{tong.soSanPham}
                                </span>
                                <span className="hidden text-sm leading-5 text-bo-muted md:inline">Tổng tiền báo giá</span>
                                <span className="text-lg leading-[26px] font-bold tracking-tight text-bo-heading tabular-nums md:text-xl md:leading-7">
                                    {formatCurrency(tong.tongTien)}
                                </span>
                            </div>
                            <div className="hidden min-w-0 items-center gap-2.5 md:flex">
                                <div aria-hidden="true" className="h-1.5 w-[120px] shrink-0 overflow-hidden rounded-full bg-bo-border">
                                    <div className="h-full rounded-full bg-bo-primary transition-[width]" style={{ width: `${phanTram}%` }} />
                                </div>
                                <span className="min-w-0 truncate text-sm leading-5 text-bo-muted">
                                    Đã có giá {tong.daNhapGia}/{tong.soSanPham} {donVi}
                                    {conThieu && ` · còn thiếu ${conThieu}`}
                                </span>
                            </div>
                        </div>
                        <Button
                            type="button"
                            onClick={bamGui}
                            className="h-11 w-full gap-2 bg-bo-primary px-5 text-[15px] text-white hover:bg-bo-primary-hover md:h-10 md:w-auto md:text-sm"
                        >
                            <Send aria-hidden="true" />
                            Gửi báo giá
                        </Button>
                    </div>
                </div>
            )}

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
            <HopXacNhanThoat mo={hoiThoat} onO={() => setHoiThoat(false)} onThoat={thoat} />
        </KhungCongNhaCungCap>
    );
}

/**
 * Trang báo giá của nhà cung cấp. Dữ liệu đơn và phiên báo giá chỉ đến từ bước xác nhận mã (location.state);
 * mở thẳng đường dẫn khi chưa xác nhận thì về trang nhận mã, không gọi API nào.
 */
export default function SupplierQuotation() {
    const location = useLocation();
    const navigate = useNavigate();
    const st = location.state;
    const orderData = st?.orderData;
    const coPhien = Boolean(orderData && st?.phienBaoGia);

    useEffect(() => {
        if (coPhien) return;
        const dich = orderData ? diaChiDangNhapLai(orderData.id, st?.supplierEmail) : '/supplier/login';
        navigate(dich, { replace: true, state: { thongBao: TB_CAN_DANG_NHAP } });
    }, [coPhien, orderData, st?.supplierEmail, navigate]);

    if (!coPhien) return null;
    return (
        <TrangBaoGia
            key={orderData.id}
            orderData={orderData}
            daGuiLuc={st.daGuiLuc}
            phienBaoGia={st.phienBaoGia}
            cuaHang={st.cuaHang}
        />
    );
}
