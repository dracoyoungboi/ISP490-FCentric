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
    TRANG_THAI_CHI_XEM,
    capNhatDonSauKhiGui,
    coThayDoiChuaGui,
    daCoBaoGiaTruoc,
    gioVaNgay,
    taoDongBaoGia,
    taoPayloadBaoGia,
    timDongThieuGia,
    tinhTong,
} from '@/components/supplier-portal/baoGiaUtils';
import { noiTenNhom, nhomTheoSanPham, tenNhomChua } from '@/components/supplier-portal/nhomBaoGia';
import { getDonMuaHangStatus } from '@/constants/donMuaHang';
import { formatCurrency } from '@/utils/formatters';
import supplierQuotationService from '@/services/supplierQuotationService';

const TB_CAN_DANG_NHAP = 'Vui lòng đăng nhập để xem và gửi báo giá.';
// Trang cũ không cho gửi khi đơn chưa có ngày giao dự kiến (ô ngày chỉ đọc) — giữ nguyên điều kiện này
const LOI_THIEU_NGAY_GIAO = 'Đơn mua hàng chưa có ngày cần giao nên chưa gửi được báo giá. Vui lòng liên hệ người phụ trách đơn.';
// Tên trạng thái hiển thị cho nhà cung cấp (phía nhà cung cấp, khác tên trạng thái đơn ở phần quản trị)
const NHAN_CHO_BAO_GIA = { label: 'Chờ báo giá' };
const NHAN_DA_GUI = { label: 'Đã gửi báo giá' };
const LOI_GUI_MAC_DINH = 'Không gửi được báo giá. Đơn giá bạn đã nhập vẫn còn trên trang. Kiểm tra kết nối mạng rồi thử lại.';

const O_GHI_CHU_CHUNG =
    'block min-h-[84px] w-full resize-y rounded-md border border-bo-border bg-white px-3 py-2.5 text-base leading-[22px] text-bo-foreground placeholder:text-bo-muted/70 focus-visible:border-bo-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/15 md:text-sm';

const loiKhiGui = (err) => {
    const msg = err?.response?.data?.message;
    return err?.response && msg ? `Không gửi được báo giá. ${msg}` : LOI_GUI_MAC_DINH;
};

function TrangBaoGia({ orderData, daGuiLuc }) {
    const location = useLocation();
    const navigate = useNavigate();

    // Ảnh chụp lúc mở trang: so để biết còn thay đổi chưa gửi khi bấm Thoát
    const [dongBanDau] = useState(() => taoDongBaoGia(orderData));
    const [ghiChuBanDau] = useState(() => orderData.ghiChuNCC || '');
    const [dong, setDong] = useState(dongBanDau);
    // Gom theo sản phẩm chỉ để hiển thị; chỉ phụ thuộc sản phẩm của đơn nên tính một lần
    const [nhom] = useState(() => nhomTheoSanPham(dongBanDau));
    // Ghi chú chung: thu thành nút, bấm mới mở ô (đã có ghi chú từ lần báo giá trước thì mở sẵn)
    const [moGhiChuChung, setMoGhiChuChung] = useState(() => Boolean(ghiChuBanDau));
    // Mở bằng nút thì đặt con trỏ vào ô; mở sẵn lúc vào trang thì không
    const [vuaMoGhiChuChung, setVuaMoGhiChuChung] = useState(false);
    const [ghiChu, setGhiChu] = useState(ghiChuBanDau);
    const [dongLoi, setDongLoi] = useState([]);
    // null | 'xac-nhan' | 'dang-gui' | 'loi' | 'thanh-cong'
    const [hop, setHop] = useState(null);
    const [loiGui, setLoiGui] = useState('');
    // Đơn chưa có ngày cần giao thì báo ngay khi mở trang (không đợi tới lúc bấm Gửi mới biết)
    const [loiChung, setLoiChung] = useState(() => (orderData.ngayGiaoDuKien ? '' : LOI_THIEU_NGAY_GIAO));
    const [hoiThoat, setHoiThoat] = useState(false);
    // Giờ gửi của lần gửi trong phiên này (dùng ngay cho hộp thành công, không chờ router cập nhật state)
    const [guiLuc, setGuiLuc] = useState(null);
    const loiChungRef = useRef(null);
    const bangRef = useRef(null);
    const nutThemGhiChuRef = useRef(null);
    const conMoRef = useRef(true);

    useEffect(() => {
        conMoRef.current = true;
        return () => {
            conMoRef.current = false;
        };
    }, []);

    const daGui = guiLuc || daGuiLuc;
    const chiXem = Boolean(daGui) || orderData.trangThai === TRANG_THAI_CHI_XEM;
    const tong = useMemo(() => tinhTong(dong), [dong]);
    const daBaoGiaTruoc = !chiXem && daCoBaoGiaTruoc(orderData);
    const tenNhaCungCap = orderData.nhaCungCap?.tenNhaCungCap;
    const email = location.state?.supplierEmail || orderData.nhaCungCap?.email;

    const coBienThe = nhom.length < dong.length;
    const donVi = coBienThe ? 'phân loại' : 'sản phẩm';
    const viTriThieu = timDongThieuGia(dong);
    // Chỉ nêu tên khi đã nhập được ít nhất một giá (đơn mới thì mọi sản phẩm đều thiếu, nêu tên không giúp gì)
    const conThieu = tong.daNhapGia > 0 && viTriThieu.length ? noiTenNhom(tenNhomChua(nhom, viTriThieu)) : '';
    const phanTram = tong.soSanPham ? Math.round((tong.daNhapGia / tong.soSanPham) * 100) : 0;

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
        // Chặn gửi trùng (bấm liên tiếp, hoặc bấm trúng nút trong lúc hộp đang đóng)
        if (chiXem || hop === 'dang-gui') return;
        setHop('dang-gui');
        try {
            await supplierQuotationService.submitQuote(taoPayloadBaoGia(orderData, dong, ghiChu));
            if (!conMoRef.current) return;
            const luc = new Date().toISOString();
            setGuiLuc(luc);
            setHop('thanh-cong');
            // Ghi vào lịch sử: tải lại trang vẫn ở chế độ chỉ xem với đơn giá vừa gửi
            navigate(location.pathname, {
                replace: true,
                state: {
                    ...location.state,
                    orderData: capNhatDonSauKhiGui(orderData, dong, ghiChu),
                    daGuiLuc: luc,
                },
            });
        } catch (err) {
            if (!conMoRef.current) return;
            setLoiGui(loiKhiGui(err));
            setHop('loi');
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

    // Đơn ở trạng thái chỉ xem (không phải vừa gửi) thì dùng tên trạng thái chung của đơn mua hàng
    const nhan = daGui ? NHAN_DA_GUI : chiXem ? getDonMuaHangStatus(orderData.trangThai) : NHAN_CHO_BAO_GIA;

    return (
        <KhungCongNhaCungCap tenNhaCungCap={tenNhaCungCap} email={email} onThoat={bamThoat}>
            <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 md:gap-5 md:p-6">
                <div className="flex flex-col gap-1.5">
                    <div className="flex flex-col gap-1.5 md:flex-row md:flex-wrap md:items-center md:gap-3">
                        <h1 className="text-xl leading-7 font-bold tracking-tight break-words text-bo-heading md:text-2xl md:leading-8">
                            Báo giá đơn {orderData.soDonMua}
                        </h1>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <StatusBadge label={nhan.label} />
                            <CanGiaoTruoc ngay={orderData.ngayGiaoDuKien} className="text-[13px] leading-5 text-slate-600 md:hidden" />
                        </div>
                    </div>
                    <DongThongTinDon orderData={orderData} />
                </div>

                {loiChung && !chiXem && (
                    <div ref={loiChungRef} role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-bo-danger-soft px-3.5 py-3 text-sm leading-5 text-red-700">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>{loiChung}</span>
                    </div>
                )}

                {daGui ? (
                    <div role="status" className="flex items-start gap-2 rounded-lg border border-green-200 bg-bo-success-soft px-3.5 py-3 text-sm leading-5 text-bo-success">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>Đã gửi báo giá lúc {gioVaNgay(daGui)}. Nếu cần điều chỉnh, vui lòng liên hệ người phụ trách đơn.</span>
                    </div>
                ) : chiXem ? (
                    <div role="status" className="flex items-start gap-2 rounded-lg border border-bo-border bg-white px-3.5 py-3 text-sm leading-5 text-slate-700">
                        <Info className="mt-0.5 size-4 shrink-0 text-bo-muted" aria-hidden="true" />
                        <span>Đơn này không còn nhận báo giá. Nếu cần trao đổi, vui lòng liên hệ người phụ trách đơn.</span>
                    </div>
                ) : daBaoGiaTruoc ? (
                    <div role="status" className="flex items-start gap-2 rounded-lg border border-blue-200 bg-bo-primary-soft px-3 py-2.5 text-sm leading-5 text-blue-700">
                        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>Bạn đã gửi báo giá cho đơn này trước đó. Đơn giá đã gửi đang hiện sẵn bên dưới; gửi lại sẽ thay đơn giá cũ.</span>
                    </div>
                ) : null}

                <ThongTinDonMua orderData={orderData} />

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
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3.5 text-sm font-medium text-bo-primary hover:border-bo-primary hover:bg-bo-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 md:h-10 md:w-auto md:self-start"
                    >
                        <Plus className="size-4" aria-hidden="true" />
                        Thêm ghi chú cho FCentric
                        <span className="font-normal text-bo-muted">(không bắt buộc)</span>
                    </button>
                ) : (
                    <SurfaceCard
                        title="Ghi chú cho FCentric"
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
                            <textarea
                                aria-label="Ghi chú cho FCentric"
                                rows={3}
                                autoFocus={vuaMoGhiChuChung}
                                placeholder="VD: Giá đã gồm vận chuyển đến kho; thanh toán 50% khi xác nhận đơn."
                                value={ghiChu}
                                onChange={(e) => setGhiChu(e.target.value)}
                                onBlur={(e) => {
                                    // Mở ra mà để trống rồi bấm chỗ khác thì tự thu lại (bấm "Bỏ ghi chú" thì để nút đó xử lý)
                                    const theGhiChu = e.currentTarget.closest('section');
                                    if (!e.currentTarget.value.trim() && !theGhiChu?.contains(e.relatedTarget)) thuGhiChu(false);
                                }}
                                className={O_GHI_CHU_CHUNG}
                            />
                        )}
                    </SurfaceCard>
                )}
            </main>

            {!chiXem && dong.length > 0 && (
                <div className="sticky bottom-0 z-10 border-t border-bo-border bg-white shadow-[0_-1px_3px_0_rgba(0,0,0,0.06)]">
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
                onGui={guiBaoGia}
                onDong={dongHop}
            />
            <HopXacNhanThoat mo={hoiThoat} onO={() => setHoiThoat(false)} onThoat={thoat} />
        </KhungCongNhaCungCap>
    );
}

/**
 * Trang báo giá của nhà cung cấp. Dữ liệu đơn chỉ đến từ bước xác thực OTP (location.state.orderData);
 * mở thẳng đường dẫn khi chưa xác thực thì về trang đăng nhập, không gọi API nào.
 */
export default function SupplierQuotation() {
    const location = useLocation();
    const navigate = useNavigate();
    const orderData = location.state?.orderData;

    useEffect(() => {
        if (!orderData) navigate('/supplier/login', { replace: true, state: { thongBao: TB_CAN_DANG_NHAP } });
    }, [orderData, navigate]);

    if (!orderData) return null;
    return <TrangBaoGia key={orderData.id} orderData={orderData} daGuiLuc={location.state?.daGuiLuc} />;
}
