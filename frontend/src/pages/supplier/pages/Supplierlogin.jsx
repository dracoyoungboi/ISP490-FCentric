import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, FileWarning, Info, Link2, Loader2 } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import AuthProgress from '@/components/auth/AuthProgress';
import OtpInputs from '@/components/auth/OtpInputs';
import congNhaCungCapService from '@/services/congNhaCungCapService';
import { cungEmail, dichSauDangNhap, docPhien, loaiLienKet, luuPhien, phienDaHetHan } from '@/components/supplier-portal/phienCong';
import { datSoViec, useTieuDeCong } from '@/components/supplier-portal/useCongNcc';
import {
    boThongBaoVaoTrang,
    cauDaGuiMa,
    dinhDangDemNguoc,
    docThoiHanMa,
    xuLyLoiNhanMa,
    xuLyLoiXacNhan,
} from '@/components/supplier-portal/loiCong';
import { t } from "@/i18n";

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
        alt: t("Ba nhân viên kho đứng giữa lối đi giữa các kệ hàng"),
    },
    {
        src: '/images/auth/supplier-2.jpg',
        fallbackSrc: 'https://images.pexels.com/photos/6169641/pexels-photo-6169641.jpeg?auto=compress&cs=tinysrgb&w=2000',
        alt: t("Nhân viên sắp xếp thùng hàng lên kệ và ghi phiếu gửi hàng"),
    },
    {
        src: '/images/auth/supplier-3.jpg',
        fallbackSrc: 'https://images.pexels.com/photos/4483775/pexels-photo-4483775.jpeg?auto=compress&cs=tinysrgb&w=2000',
        alt: t("Nhân viên đi kiểm hàng giữa các dãy kệ pallet trong nhà kho"),
    },
];

const CAC_BUOC = [t("Email"), t("Mã xác nhận")];
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

/**
 * Đăng nhập cổng nhà cung cấp theo EMAIL (không theo từng đơn): nhập email → nhận mã 6 số → phiên 60 phút cho mọi đơn,
 * biên bản của nhà cung cấp có email đó.
 * Tham số địa chỉ: `?email=` điền sẵn; `?bienBan=ID` (email biên bản trả hàng) / `?id=ID` (email yêu cầu báo giá) mở
 * thẳng biên bản / đơn đó sau khi xác nhận; `?tiep=` trang đang xem lúc phiên hết hạn (xem phienCong.dichSauDangNhap).
 */
export default function SupplierLoginPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const emailParam = searchParams.get('email');
    const lienKet = loaiLienKet(searchParams);

    const [email, setEmail] = useState(emailParam || '');
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

    useTieuDeCong(buoc === 'otp' ? t("Nhập mã xác nhận") : t("Đăng nhập"));

    // Đang có phiên còn hạn của đúng email (vd. bấm liên kết trong email khi đã đăng nhập): mở thẳng trang cần tới
    useEffect(() => {
        const phien = docPhien();
        if (phien && !phienDaHetHan(phien) && cungEmail(phien, emailParam)) {
            navigate(dichSauDangNhap(searchParams), { replace: true });
        }
        // Chỉ xét lúc vào trang
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Trang trong cổng chuyển về đây khi phiên hết hạn (kèm câu báo)
    const thongBaoVao = location.state?.thongBao;
    const conLaiGiay = Math.max(0, Math.ceil((guiLaiLuc - bayGio) / 1000));

    useEffect(() => {
        if (guiLaiLuc <= Date.now()) return undefined;
        const timer = setInterval(() => {
            const luc = Date.now();
            setBayGio(luc);
            if (luc >= guiLaiLuc) clearInterval(timer);
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

    /** Đếm ngược nút "Gửi lại mã" theo số giây máy chủ trả (guiLaiSauGiay); 0 hoặc không có thì gửi lại được ngay. */
    const datDemNguoc = (giay) => {
        const luc = Date.now();
        setBayGio(luc);
        setGuiLaiLuc(giay > 0 ? luc + giay * 1000 : 0);
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

    /** Về bước 1 kèm câu báo (phải chờ mới nhận được mã mới). */
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
        if (!emailGon) loiMoi.email = t("Vui lòng nhập email");
        else if (!EMAIL_REGEX.test(emailGon)) loiMoi.email = t("Email không hợp lệ");
        if (loiMoi.email) {
            setLoi(loiMoi);
            emailRef.current?.focus();
            return;
        }

        setLoi({});
        await chayMotLan('gui-ma', async () => {
            try {
                const res = await congNhaCungCapService.layMa(emailGon);
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
        setLoi({});
        tieuDiemSauRef.current = 'ncc-otp-0';
        await chayMotLan('gui-lai', async () => {
            try {
                const res = await congNhaCungCapService.layMa(email.trim());
                const { hetHanGiay, guiLaiSauGiay } = docThoiHanMa(res?.data);
                setThongBao({ loai: 'thanh-cong', noiDung: cauDaGuiMa(hetHanGiay, { guiLai: true }) });
                datDemNguoc(guiLaiSauGiay);
                setOtp(OTP_TRONG);
            } catch (err) {
                const kq = xuLyLoiNhanMa(err);
                if (kq.loai === 'cho-gui-lai') {
                    setThongBao({ loai: 'thong-tin', noiDung: kq.cau });
                    datDemNguoc(kq.guiLaiSauGiay);
                } else if (kq.loai === 'phai-cho') {
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
            setLoi({ otp: t("Vui lòng nhập đủ 6 số của mã xác nhận") });
            return;
        }

        setLoi({});
        tieuDiemSauRef.current = 'ncc-otp-0';
        await chayMotLan('xac-thuc', async () => {
            try {
                const res = await congNhaCungCapService.xacNhanMa(email.trim(), maOtp);
                // Phiên lưu trong sessionStorage của thẻ này (một khóa); mọi API sau đăng nhập gửi kèm
                if (luuPhien(res?.data)) {
                    tieuDiemSauRef.current = null;
                    datSoViec(undefined);
                    navigate(dichSauDangNhap(searchParams), { replace: true });
                    return;
                }
                setLoi({ chung: t("Chưa đăng nhập được. Vui lòng thử lại.") });
            } catch (err) {
                const kq = xuLyLoiXacNhan(err);
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

    return (
        <AuthShell slides={ANH_NEN_NCC}>
            {buoc === 'otp' && (
                <button
                    type="button"
                    className="mb-6 flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-black disabled:opacity-50 fade-in-up"
                    onClick={handleBack}
                    disabled={Boolean(dangXuLy)}
                >
                    <ArrowLeft size={16} aria-hidden="true" /> {t("Quay lại")}
                </button>
            )}

            <div className="mb-8 text-center lg:text-left">
                <h1 className="mb-3 text-3xl font-bold tracking-tight text-gray-900 fade-in-up delay-1">
                    {buoc === 'otp' ? t("Nhập mã xác nhận") : t("Cổng nhà cung cấp")}
                </h1>
                <p className="text-base text-gray-500 fade-in-up delay-2">
                    {buoc === 'otp' ? (
                        <>
                            {t("Mã 6 chữ số đã được gửi tới")}{' '}
                            <strong className="font-semibold break-words text-gray-900">{email}</strong>.
                        </>
                    ) : (
                        t("Nhập email công ty đã đăng ký với chúng tôi. Mã xác nhận gửi về email này, dùng để xem và xử lý mọi đơn, biên bản của Quý công ty.")
                    )}
                </p>
            </div>

            <AuthProgress steps={CAC_BUOC} currentStep={buoc === 'otp' ? 2 : 1} />

            {/* ── BƯỚC 1: EMAIL ── */}
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

                        {lienKet ? (
                            <div className="flex items-start gap-2.5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                                {lienKet === 'bien-ban' ? (
                                    <FileWarning size={16} className="mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />
                                ) : (
                                    <Link2 size={16} className="mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />
                                )}
                                <span>
                                    {lienKet === 'bien-ban'
                                        ? t("Xác nhận xong sẽ mở thẳng biên bản trả hàng từ liên kết trong email.")
                                        : t("Xác nhận xong sẽ mở thẳng đơn cần báo giá từ liên kết trong email.")}
                                </span>
                            </div>
                        ) : null}

                        <button type="submit" className={`${PRIMARY_BTN} mt-4`} disabled={Boolean(dangXuLy)}>
                            {dangXuLy === 'gui-ma' ? (
                                <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> {t("Đang gửi mã...")}</>
                            ) : (
                                t("Nhận mã xác nhận")
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-sm text-gray-500 fade-in-up delay-5">
                        {t("Email chưa đăng ký hoặc đã đổi? Liên hệ nhân viên mua hàng phụ trách Quý công ty để cập nhật.")}
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
                            <label htmlFor="ncc-otp-0" className={LABEL}>{t("Mã xác nhận 6 số")}</label>
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
                                {loi.otp && `${t("Các ô đã được xóa để nhập lại.")} `}
                                {t("Không nhận được mã?")}{' '}
                                {dangXuLy === 'gui-lai' ? (
                                    <span className="font-medium text-gray-400">{t("Đang gửi lại...")}</span>
                                ) : conLaiGiay > 0 ? (
                                    <span className="font-medium whitespace-nowrap text-gray-400">
                                        {t("Gửi lại mã sau")} <span className="tabular-nums">{dinhDangDemNguoc(conLaiGiay)}</span>
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        className="font-medium text-black hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
                                        onClick={handleResendOtp}
                                        disabled={Boolean(dangXuLy)}
                                    >
                                        {t("Gửi lại mã")}
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
                                <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> {t("Đang xác thực...")}</>
                            ) : (
                                t("Xác nhận")
                            )}
                        </button>
                    </form>

                </>
            )}
        </AuthShell>
    );
}
