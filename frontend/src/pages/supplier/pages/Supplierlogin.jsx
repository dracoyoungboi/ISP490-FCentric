import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Info, Link2, Loader2 } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import AuthProgress from '@/components/auth/AuthProgress';
import OtpInputs from '@/components/auth/OtpInputs';
import supplierQuotationService from '@/services/supplierQuotationService';
import {
    boThongBaoVaoTrang,
    cauDaGuiMa,
    dinhDangDemNguoc,
    docThoiHanMa,
    xuLyLoiNhanMa,
    xuLyLoiXacNhan,
} from '@/components/supplier-portal/loiCong';

/* ── Class dùng chung với Đăng nhập / Quên mật khẩu (khung AuthShell) ── */
const INPUT_BASE =
    'flex h-11 w-full rounded-lg border bg-white px-3 py-2 text-base text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50';
const INPUT_NORMAL = 'border-gray-300';
const INPUT_ERROR = 'border-red-500 focus:ring-red-500';
const LABEL = 'text-sm font-medium leading-none text-gray-900';
const PRIMARY_BTN =
    'inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const BANNER = 'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm';
const BANNER_TONE = {
    loi: 'border-red-200 bg-red-50 text-red-700',
    'thanh-cong': 'border-green-200 bg-green-50 text-green-800',
    'thong-tin': 'border-gray-200 bg-gray-50 text-gray-700',
};
const BANNER_ICON = { loi: AlertCircle, 'thanh-cong': CheckCircle2, 'thong-tin': Info };
const FIELD_ERROR = 'mt-1.5 flex items-center gap-1.5 text-sm text-red-600';

// Ảnh panel trái riêng của cổng nhà cung cấp (Đăng nhập / Quên mật khẩu vẫn dùng bộ ảnh mặc định)
const ANH_NEN_NCC = [
    {
        src: '/images/auth/supplier-1.jpg',
        fallbackSrc: 'https://images.pexels.com/photos/4484073/pexels-photo-4484073.jpeg?auto=compress&cs=tinysrgb&w=2000',
        alt: 'Ba nhân viên kho đứng giữa lối đi giữa các kệ hàng',
    },
    {
        src: '/images/auth/supplier-2.jpg',
        fallbackSrc: 'https://images.pexels.com/photos/6169641/pexels-photo-6169641.jpeg?auto=compress&cs=tinysrgb&w=2000',
        alt: 'Nhân viên sắp xếp thùng hàng lên kệ và ghi phiếu gửi hàng',
    },
    {
        src: '/images/auth/supplier-3.jpg',
        fallbackSrc: 'https://images.pexels.com/photos/4483775/pexels-photo-4483775.jpeg?auto=compress&cs=tinysrgb&w=2000',
        alt: 'Nhân viên đi kiểm hàng giữa các dãy kệ pallet trong nhà kho',
    },
];

const CAC_BUOC = ['Thông tin đơn', 'Mã xác nhận'];
const OTP_TRONG = ['', '', '', '', '', ''];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Thời hạn mã và thời gian chờ gửi lại lấy từ máy chủ (hetHanGiay, guiLaiSauGiay), không viết cứng ở trang

function Banner({ loai, children }) {
    const Icon = BANNER_ICON[loai];
    return (
        <div className={`${BANNER} ${BANNER_TONE[loai]}`} role={loai === 'loi' ? 'alert' : 'status'}>
            <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{children}</span>
        </div>
    );
}

function LoiO({ id, children }) {
    if (!children) return null;
    return (
        <p id={id} className={FIELD_ERROR}>
            <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
            {children}
        </p>
    );
}

export default function SupplierLoginPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const orderId = searchParams.get('id');
    const emailParam = searchParams.get('email');

    const [email, setEmail] = useState(emailParam || '');
    const [manualSoDonMua, setManualSoDonMua] = useState('');
    const [otp, setOtp] = useState(OTP_TRONG);
    const [buoc, setBuoc] = useState('thong-tin');
    // false | 'gui-ma' | 'gui-lai' | 'xac-thuc'
    const [dangXuLy, setDangXuLy] = useState(false);
    const [loi, setLoi] = useState({});
    // { loai: 'thanh-cong' | 'thong-tin', noiDung } — thông báo ở bước nhập mã
    const [thongBao, setThongBao] = useState(null);
    // thời điểm (ms) được phép gửi lại mã; 0 = gửi lại được ngay
    const [guiLaiLuc, setGuiLaiLuc] = useState(0);
    const [bayGio, setBayGio] = useState(() => Date.now());

    const emailRef = useRef(null);
    const maDonRef = useRef(null);

    // Trang báo giá chuyển về đây khi chưa xác thực (không có dữ liệu đơn)
    const thongBaoVao = location.state?.thongBao;
    const conLaiGiay = Math.max(0, Math.ceil((guiLaiLuc - bayGio) / 1000));

    useEffect(() => {
        if (guiLaiLuc <= Date.now()) return undefined;
        const timer = setInterval(() => {
            const t = Date.now();
            setBayGio(t);
            if (t >= guiLaiLuc) clearInterval(timer);
        }, 1000);
        return () => clearInterval(timer);
    }, [guiLaiLuc]);

    // Ô nhận con trỏ khi hết xử lý (các ô bị khóa lúc gọi API nên con trỏ rơi ra ngoài):
    // sai mã / gửi lại mã -> ô đầu của mã xác nhận (các ô đã bị xóa); lỗi ở bước 1 -> ô email
    const tieuDiemSauRef = useRef(null);
    useEffect(() => {
        if (dangXuLy || !tieuDiemSauRef.current) return;
        document.getElementById(tieuDiemSauRef.current)?.focus();
        tieuDiemSauRef.current = null;
    }, [buoc, dangXuLy]);

    /*
     * Đơn cần đăng nhập: theo id nếu mở từ liên kết có ?id=, ngược lại theo mã đơn nhà cung cấp tự nhập.
     * Không tra mã đơn qua /don-mua-hang/filter: API đó chỉ dành cho nhân viên đã đăng nhập (trả 403 cho nhà cung cấp);
     * backend tự tìm đơn theo mã ở API nhận mã và chỉ nhận khi email khớp nhà cung cấp của đơn.
     */
    const thamChieuDon = () => {
        if (orderId) return { donMuaHangId: Number(orderId) };
        const maDon = manualSoDonMua.trim();
        return maDon ? { soDonMua: maDon } : null;
    };

    /** Đếm ngược nút "Gửi lại mã" theo số giây máy chủ trả (guiLaiSauGiay); 0 hoặc không có thì gửi lại được ngay. */
    const datDemNguoc = (giay) => {
        const t = Date.now();
        setBayGio(t);
        setGuiLaiLuc(giay > 0 ? t + giay * 1000 : 0);
    };

    // Chặn gọi trùng khi bấm / Enter liên tiếp trước khi nút kịp khóa
    const dangGoiRef = useRef(false);
    const chayMotLan = async (loai, viec) => {
        if (dangGoiRef.current) return;
        dangGoiRef.current = true;
        setDangXuLy(loai);
        try {
            await viec();
        } finally {
            dangGoiRef.current = false;
            setDangXuLy(false);
        }
    };

    /** Về bước 1 kèm câu báo (đơn không còn nhận báo giá, hoặc phải chờ mới nhận được mã mới). */
    const veBuocDau = (cau) => {
        setBuoc('thong-tin');
        setOtp(OTP_TRONG);
        setThongBao(null);
        setLoi({ chung: cau });
        tieuDiemSauRef.current = 'ncc-email';
    };

    const handleSendOtp = async (e) => {
        e?.preventDefault?.();
        const loiMoi = {};
        const emailGon = email.trim();
        if (!emailGon) loiMoi.email = 'Vui lòng nhập email';
        else if (!EMAIL_REGEX.test(emailGon)) loiMoi.email = 'Email không hợp lệ';
        const don = thamChieuDon();
        if (!don) loiMoi.maDon = 'Vui lòng nhập mã đơn mua hàng';
        if (loiMoi.email || loiMoi.maDon) {
            setLoi(loiMoi);
            (loiMoi.email ? emailRef : maDonRef).current?.focus();
            return;
        }

        setLoi({});
        await chayMotLan('gui-ma', async () => {
            try {
                const res = await supplierQuotationService.requestOtp({ email: emailGon, ...don });
                const { hetHanGiay, guiLaiSauGiay } = docThoiHanMa(res?.data);
                setThongBao({ loai: 'thanh-cong', noiDung: cauDaGuiMa(hetHanGiay) });
                datDemNguoc(guiLaiSauGiay);
                setOtp(OTP_TRONG);
                setBuoc('otp');
                tieuDiemSauRef.current = 'ncc-otp-0';
                // Đã nhận mã mới: câu báo lúc vào trang (vd. phiên báo giá hết hạn) không còn đúng, bỏ khỏi lịch sử
                const boCauVao = boThongBaoVaoTrang(location);
                if (boCauVao) navigate(...boCauVao);
            } catch (err) {
                const kq = xuLyLoiNhanMa(err);
                if (kq.loai === 'cho-gui-lai') {
                    // Mã gửi trước đó còn dùng được (hoặc phải chờ mới xin mã mới): sang bước nhập mã, đếm ngược theo máy chủ
                    setThongBao({ loai: 'thong-tin', noiDung: kq.cau });
                    datDemNguoc(kq.guiLaiSauGiay);
                    setOtp(OTP_TRONG);
                    setBuoc('otp');
                    tieuDiemSauRef.current = 'ncc-otp-0';
                    return;
                }
                // 'phai-cho': mã cũ đã hết hạn và chưa được nhận mã mới -> không có mã để nhập, ở lại bước 1 (R10)
                if (kq.loai === 'chua-gui-duoc') datDemNguoc(0);
                setLoi({ chung: kq.cau });
                tieuDiemSauRef.current = 'ncc-email';
            }
        });
    };

    const handleResendOtp = async () => {
        const don = thamChieuDon();
        if (!don) return;
        setLoi({});
        tieuDiemSauRef.current = 'ncc-otp-0';
        await chayMotLan('gui-lai', async () => {
            try {
                const res = await supplierQuotationService.requestOtp({ email: email.trim(), ...don });
                const { hetHanGiay, guiLaiSauGiay } = docThoiHanMa(res?.data);
                setThongBao({ loai: 'thanh-cong', noiDung: cauDaGuiMa(hetHanGiay, { guiLai: true }) });
                datDemNguoc(guiLaiSauGiay);
                setOtp(OTP_TRONG);
            } catch (err) {
                const kq = xuLyLoiNhanMa(err);
                if (kq.loai === 'cho-gui-lai') {
                    setThongBao({ loai: 'thong-tin', noiDung: kq.cau });
                    datDemNguoc(kq.guiLaiSauGiay);
                } else if (kq.loai === 'khong-con-nhan' || kq.loai === 'phai-cho') {
                    // 'phai-cho': mã cũ đã hết hạn, chưa nhận được mã mới -> không còn mã để nhập, về bước 1 (R10)
                    veBuocDau(kq.cau);
                } else {
                    if (kq.loai === 'chua-gui-duoc') datDemNguoc(0);
                    setLoi({ chung: kq.cau });
                }
            }
        });
    };

    const handleVerifyOtp = async (e) => {
        e?.preventDefault?.();
        const maOtp = otp.join('');
        if (maOtp.length !== OTP_TRONG.length) {
            setLoi({ otp: 'Vui lòng nhập đủ 6 số của mã xác nhận' });
            return;
        }
        const don = thamChieuDon();
        if (!don) {
            setLoi({ chung: 'Không tìm thấy thông tin đơn hàng.' });
            return;
        }

        setLoi({});
        tieuDiemSauRef.current = 'ncc-otp-0';
        await chayMotLan('xac-thuc', async () => {
            try {
                const res = await supplierQuotationService.verifyOtp({ email: email.trim(), otp: maOtp, ...don });
                const kq = res?.data;
                if (kq?.donMua && kq.phienBaoGia) {
                    tieuDiemSauRef.current = null;
                    // Phiên báo giá chỉ nằm trong state của lịch sử trình duyệt (không lưu localStorage)
                    navigate('/supplier/quotation', {
                        state: {
                            orderData: kq.donMua,
                            supplierEmail: email.trim(),
                            orderId: kq.donMua.id ?? don.donMuaHangId,
                            phienBaoGia: kq.phienBaoGia,
                            hetHanPhien: kq.hetHanPhien ?? null,
                            cuaHang: kq.cuaHang ?? null,
                        },
                    });
                    return;
                }
                setLoi({ chung: 'Không lấy được thông tin đơn mua hàng. Vui lòng thử lại.' });
            } catch (err) {
                const kq = xuLyLoiXacNhan(err);
                if (kq.loai === 'khong-con-nhan') {
                    veBuocDau(kq.cau);
                    return;
                }
                if (kq.loai === 'ma-sai' || kq.loai === 'ma-het-han') {
                    setOtp(OTP_TRONG);
                    setLoi({ otp: kq.cau });
                    // Mã đã hết hạn / bị xóa: cho xin mã mới ngay
                    if (kq.loai === 'ma-het-han') datDemNguoc(0);
                    return;
                }
                setLoi({ chung: kq.cau });
            }
        });
    };

    const handleBack = () => {
        setBuoc('thong-tin');
        setOtp(OTP_TRONG);
        setLoi({});
        setThongBao(null);
    };

    const maDonHienThi = orderId ? '' : manualSoDonMua.trim();

    return (
        <AuthShell slides={ANH_NEN_NCC}>
            {buoc === 'otp' && (
                <button
                    type="button"
                    className="mb-6 flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-black disabled:opacity-50 fade-in-up"
                    onClick={handleBack}
                    disabled={Boolean(dangXuLy)}
                >
                    <ArrowLeft size={16} aria-hidden="true" /> Quay lại
                </button>
            )}

            <div className="mb-8 text-center lg:text-left">
                <h1 className="mb-3 text-3xl font-bold tracking-tight text-gray-900 fade-in-up delay-1">
                    {buoc === 'otp' ? 'Nhập mã xác nhận' : 'Cổng nhà cung cấp'}
                </h1>
                <p className="text-base text-gray-500 fade-in-up delay-2">
                    {buoc === 'otp' ? (
                        <>
                            Mã 6 chữ số đã được gửi tới{' '}
                            <strong className="font-semibold break-words text-gray-900">{email}</strong>.
                        </>
                    ) : orderId ? (
                        'Nhập email nhận yêu cầu báo giá để nhận mã xác nhận.'
                    ) : (
                        'Nhập email và mã đơn mua hàng để nhận mã xác nhận.'
                    )}
                </p>
            </div>

            <AuthProgress steps={CAC_BUOC} currentStep={buoc === 'otp' ? 2 : 1} />

            {/* ── BƯỚC 1: EMAIL + MÃ ĐƠN ── */}
            {buoc === 'thong-tin' && (
                <>
                    <form className="space-y-5 fade-in-up delay-4" onSubmit={handleSendOtp} noValidate>
                        {loi.chung ? (
                            <Banner loai="loi">{loi.chung}</Banner>
                        ) : thongBaoVao ? (
                            <Banner loai="thong-tin">{thongBaoVao}</Banner>
                        ) : null}

                        <div className="space-y-2">
                            <label htmlFor="ncc-email" className={LABEL}>Email</label>
                            <input
                                ref={emailRef}
                                id="ncc-email"
                                type="email"
                                autoComplete="email"
                                placeholder="ten@congty.vn"
                                className={`${INPUT_BASE} ${loi.email ? INPUT_ERROR : INPUT_NORMAL}`}
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setLoi((p) => ({ ...p, email: '', chung: '' }));
                                }}
                                disabled={Boolean(dangXuLy)}
                                aria-invalid={Boolean(loi.email)}
                                aria-describedby={loi.email ? 'ncc-email-loi' : undefined}
                            />
                            <LoiO id="ncc-email-loi">{loi.email}</LoiO>
                        </div>

                        {orderId ? (
                            <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                                <Link2 size={16} className="shrink-0 text-gray-500" aria-hidden="true" />
                                <span>Đơn mua hàng đã lấy từ liên kết trong email</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label htmlFor="ncc-ma-don" className={LABEL}>Mã đơn mua hàng</label>
                                <input
                                    ref={maDonRef}
                                    id="ncc-ma-don"
                                    type="text"
                                    autoComplete="off"
                                    spellCheck={false}
                                    placeholder="VD: PO202610115101"
                                    className={`${INPUT_BASE} ${loi.maDon ? INPUT_ERROR : INPUT_NORMAL}`}
                                    value={manualSoDonMua}
                                    onChange={(e) => {
                                        setManualSoDonMua(e.target.value);
                                        setLoi((p) => ({ ...p, maDon: '', chung: '' }));
                                    }}
                                    disabled={Boolean(dangXuLy)}
                                    aria-invalid={Boolean(loi.maDon)}
                                    aria-describedby={loi.maDon ? 'ncc-ma-don-loi' : 'ncc-ma-don-goi-y'}
                                />
                                {loi.maDon ? (
                                    <LoiO id="ncc-ma-don-loi">{loi.maDon}</LoiO>
                                ) : (
                                    <p id="ncc-ma-don-goi-y" className="text-sm text-gray-500">
                                        Mã đơn có trong email yêu cầu báo giá.
                                    </p>
                                )}
                            </div>
                        )}

                        <button type="submit" className={`${PRIMARY_BTN} mt-4`} disabled={Boolean(dangXuLy)}>
                            {dangXuLy === 'gui-ma' ? (
                                <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Đang gửi mã...</>
                            ) : (
                                'Nhận mã xác nhận'
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-sm text-gray-500 fade-in-up delay-5">
                        Chưa nhận được email yêu cầu báo giá? Hãy liên hệ nhân viên mua hàng đã mời Quý công ty báo giá.
                    </p>
                </>
            )}

            {/* ── BƯỚC 2: MÃ XÁC NHẬN ── */}
            {buoc === 'otp' && (
                <>
                    <form className="space-y-5 fade-in-up delay-4" onSubmit={handleVerifyOtp} noValidate>
                        {loi.otp ? (
                            <Banner loai="loi">{loi.otp}</Banner>
                        ) : loi.chung ? (
                            <Banner loai="loi">{loi.chung}</Banner>
                        ) : thongBao ? (
                            <Banner loai={thongBao.loai}>{thongBao.noiDung}</Banner>
                        ) : null}

                        <div className="space-y-2">
                            <label htmlFor="ncc-otp-0" className={LABEL}>Mã xác nhận 6 số</label>
                            <OtpInputs
                                value={otp}
                                onChange={(next) => {
                                    setOtp(next);
                                    if (loi.otp || loi.chung) setLoi({});
                                }}
                                disabled={Boolean(dangXuLy)}
                                error={Boolean(loi.otp)}
                                idPrefix="ncc-otp"
                            />
                            <p className="pt-1 text-sm text-gray-600">
                                {loi.otp && 'Các ô đã được xóa để nhập lại. '}
                                Không nhận được mã?{' '}
                                {dangXuLy === 'gui-lai' ? (
                                    <span className="font-medium text-gray-400">Đang gửi lại...</span>
                                ) : conLaiGiay > 0 ? (
                                    <span className="font-medium whitespace-nowrap text-gray-400">
                                        Gửi lại mã sau <span className="tabular-nums">{dinhDangDemNguoc(conLaiGiay)}</span>
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        className="font-medium text-black hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
                                        onClick={handleResendOtp}
                                        disabled={Boolean(dangXuLy)}
                                    >
                                        Gửi lại mã
                                    </button>
                                )}
                            </p>
                        </div>

                        <button
                            type="submit"
                            className={`${PRIMARY_BTN} mt-4`}
                            disabled={Boolean(dangXuLy) || otp.join('').length !== OTP_TRONG.length}
                        >
                            {dangXuLy === 'xac-thuc' ? (
                                <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Đang xác thực...</>
                            ) : (
                                'Xác nhận'
                            )}
                        </button>
                    </form>

                    {maDonHienThi && (
                        <div className="mt-8 flex justify-between gap-3 border-t border-gray-200 pt-4 text-sm fade-in-up delay-5">
                            <span className="text-gray-500">Đơn mua hàng</span>
                            <span className="min-w-0 text-right font-semibold break-words tabular-nums text-gray-900">{maDonHienThi}</span>
                        </div>
                    )}
                </>
            )}
        </AuthShell>
    );
}
