import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nguoiDungService } from '../services/nguoiDungService';
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import AuthShell from '../components/auth/AuthShell';
import AuthProgress from '../components/auth/AuthProgress';
import OtpInputs from '../components/auth/OtpInputs';

/* ── Class patterns dùng chung (theo thiết kế modern white/gray) ── */
const INPUT_BASE =
    'flex h-11 w-full rounded-lg border bg-white px-3 py-2 text-base text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';
const INPUT_NORMAL = 'border-gray-300';
const INPUT_ERROR = 'border-red-500 focus:ring-red-500';
const LABEL = 'text-sm font-medium leading-none text-gray-900';
const PRIMARY_BTN =
    'inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const ERROR_BANNER =
    'flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700';
const SUCCESS_BANNER =
    'flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800';
const FIELD_ERROR = 'mt-1.5 flex items-center gap-1.5 text-sm text-red-600';
const EYE_BTN =
    'absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 transition-colors';

const STEP_TITLES = {
    1: 'Khôi phục mật khẩu',
    2: 'Xác thực OTP',
    3: 'Đặt mật khẩu mới',
    4: 'Thành công',
};
const STEP_SUBS = {
    1: 'Nhập email hoặc tên đăng nhập của bạn để nhận mã OTP.',
    2: 'Nhập mã 6 số đã được gửi về email đăng ký của tài khoản',
    3: 'Nhập mật khẩu mới và xác nhận để hoàn tất',
    4: 'Mật khẩu đã được đặt lại thành công',
};
// data.code BE trả về khi OTP đặt lại mật khẩu không hợp lệ
const OTP_ERROR_CODES = ['RESET_OTP_WRONG', 'RESET_OTP_EXPIRED'];
// khớp PasswordResetRateLimiter.COOLDOWN phía BE (60 giây giữa 2 lần gửi mã)
const RESEND_COOLDOWN_SECONDS = 60;
const SENT_FALLBACK_MESSAGE = 'Nếu thông tin tài khoản hợp lệ, mã xác nhận đã được gửi tới email đã đăng ký.';

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);

    const [username, setUsername] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    // số giây còn phải chờ trước khi được gửi lại mã
    const [resendIn, setResendIn] = useState(0);
    // thông báo chung sau khi gửi mã (BE không cho biết tài khoản có tồn tại hay không)
    const [sentNotice, setSentNotice] = useState('');

    useEffect(() => {
        if (resendIn <= 0) return undefined;
        const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendIn]);

    // 429 (gửi quá nhanh / quá nhiều) hoặc 503 (hệ thống tạm ngưng gửi): chờ đúng số giây BE trả về
    const applyRetryAfter = (err) => {
        const retry = Number(err?.response?.data?.data?.retryAfterSeconds);
        if (Number.isFinite(retry) && retry > 0) setResendIn(Math.ceil(retry));
    };

    const otpValue = otp.join('');
    const clearMsgTimeoutRef = useRef(null);

    // Cleanup timer tự xoá thông báo khi unmount / chuyển route
    useEffect(() => () => {
        if (clearMsgTimeoutRef.current) clearTimeout(clearMsgTimeoutRef.current);
    }, []);

    // OTP sai -> các ô đã bị xoá, đưa con trỏ về ô đầu để nhập lại ngay (đợi hết loading vì ô bị disabled)
    useEffect(() => {
        if (step === 2 && errors.otp && !isLoading) document.getElementById('forgot-otp-0')?.focus();
    }, [step, errors.otp, isLoading]);

    const clearErrors = () => setErrors({});
    const setFieldError = (key, msg) => setErrors((prev) => ({ ...prev, [key]: msg }));

    const isLikelyEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

    const handleSendOTP = async (e) => {
        e.preventDefault();
        clearErrors();
        const trimmed = username.trim();
        if (!trimmed) return setFieldError('username', 'Vui lòng nhập email / tên đăng nhập');
        if (trimmed.includes('@') && !isLikelyEmail(trimmed)) return setFieldError('username', 'Email không hợp lệ');
        setIsLoading(true);
        try {
            const res = await nguoiDungService.sendForgotPasswordOTP(trimmed);
            if (res?.status === 200) {
                setUsername(trimmed);
                setOtp(['', '', '', '', '', '']);
                setSentNotice(res?.message || SENT_FALLBACK_MESSAGE);
                setResendIn(RESEND_COOLDOWN_SECONDS);
                setStep(2);
            } else setFieldError('username', res?.message || 'Gửi OTP thất bại');
        } catch (err) {
            applyRetryAfter(err);
            setFieldError('username', err?.response?.data?.message || 'Có lỗi xảy ra khi gửi OTP');
        } finally {
            setIsLoading(false);
        }
    };

    // Lỗi OTP từ BE (data.code): mã sai / hết hạn / đã huỷ -> nhập lại mã ở bước 2
    const isOtpError = (err) => OTP_ERROR_CODES.includes(err?.response?.data?.data?.code);

    const backToOtpStep = (msg) => {
        setOtp(['', '', '', '', '', '']);
        setStep(2);
        setFieldError('otp', msg);
    };

    // Kiểm tra OTP với server trước khi cho sang bước đặt mật khẩu mới (mã chưa bị tiêu thụ)
    const handleGoStep3 = async (e) => {
        e.preventDefault();
        clearErrors();
        if (otpValue.length !== 6) return setFieldError('otp', 'Vui lòng nhập đủ 6 số OTP');
        setIsLoading(true);
        try {
            const res = await nguoiDungService.verifyResetOtp({ username: username.trim(), otp: otpValue });
            if (res?.status === 200) setStep(3);
            else setFieldError('otp', res?.message || 'Xác thực OTP thất bại');
        } catch (err) {
            setOtp(['', '', '', '', '', '']);
            setFieldError('otp', err?.response?.data?.message || 'Có lỗi xảy ra khi xác thực OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        clearErrors();
        const trimmed = username.trim();
        if (!trimmed) return setFieldError('general', 'Thiếu tên đăng nhập/email');
        if (otpValue.length !== 6) return backToOtpStep('Vui lòng nhập mã OTP');
        if (!newPassword.trim()) return setFieldError('newPassword', 'Vui lòng nhập mật khẩu mới');
        if (newPassword.length < 6) return setFieldError('newPassword', 'Mật khẩu tối thiểu 6 ký tự');
        // BCrypt giới hạn 72 byte; ký tự có dấu chiếm 2-3 byte
        if (new TextEncoder().encode(newPassword).length > 72) {
            return setFieldError('newPassword', 'Mật khẩu quá dài (tối đa 72 ký tự không dấu, ít hơn nếu có dấu)');
        }
        if (newPassword !== confirmPassword) return setFieldError('confirmPassword', 'Mật khẩu xác nhận không khớp');
        setIsLoading(true);
        try {
            const res = await nguoiDungService.resetPassword({ username: trimmed, otp: otpValue, password: newPassword });
            if (res?.status === 200) setStep(4);
            else setFieldError('general', res?.message || 'Đặt lại mật khẩu thất bại');
        } catch (err) {
            // mã hết hạn / bị huỷ trong lúc nhập mật khẩu -> quay lại bước OTP để gửi lại mã
            if (isOtpError(err)) backToOtpStep(err.response.data.message);
            else setFieldError('general', err?.response?.data?.message || 'Có lỗi xảy ra khi đặt lại mật khẩu');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOTP = async () => {
        if (resendIn > 0) return;
        clearErrors();
        const trimmed = username.trim();
        if (!trimmed) return setFieldError('general', 'Vui lòng nhập email/tên đăng nhập trước');
        setIsLoading(true);
        try {
            const res = await nguoiDungService.sendForgotPasswordOTP(trimmed);
            if (res?.status === 200) {
                setOtp(['', '', '', '', '', '']);
                setResendIn(RESEND_COOLDOWN_SECONDS);
                setFieldError('success', 'Đã gửi lại mã OTP. Vui lòng kiểm tra email.');
                if (clearMsgTimeoutRef.current) clearTimeout(clearMsgTimeoutRef.current);
                // chỉ ẩn thông báo "đã gửi lại" — không xoá lỗi mới phát sinh trong 2,5s (vd. nhập sai mã ngay sau đó)
                clearMsgTimeoutRef.current = setTimeout(() => setErrors((prev) => {
                    if (!prev.success) return prev;
                    const rest = { ...prev };
                    delete rest.success;
                    return rest;
                }), 2500);
            } else setFieldError('general', res?.message || 'Gửi lại OTP thất bại');
        } catch (err) {
            applyRetryAfter(err);
            setFieldError('general', err?.response?.data?.message || 'Có lỗi xảy ra khi gửi lại OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        if (step === 1) navigate('/login');
        else setStep((s) => s - 1);
    };

    return (
        <AuthShell>
            {step !== 4 && (
                <button
                    type="button"
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors mb-6 fade-in-up"
                    onClick={handleBack}
                >
                    <ArrowLeft size={16} /> Quay lại
                </button>
            )}

            <div className="text-center lg:text-left mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-3 text-gray-900 fade-in-up delay-1">
                    {STEP_TITLES[step]}
                </h1>
                <p className="text-gray-500 text-base fade-in-up delay-2">{STEP_SUBS[step]}</p>
            </div>

            {step !== 4 && <AuthProgress currentStep={Math.min(step, 3)} />}

            {/* ── STEP 1: EMAIL / USERNAME ── */}
            {step === 1 && (
                <form className="space-y-5 fade-in-up delay-4" onSubmit={handleSendOTP} noValidate>
                    {errors.username && (
                        <div className={ERROR_BANNER} role="alert">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{errors.username}</span>
                        </div>
                    )}
                    <div className="space-y-2">
                        <label htmlFor="forgot-username" className={LABEL}>Email / Tên đăng nhập</label>
                        <input
                            id="forgot-username"
                            type="text"
                            placeholder="example@gmail.com hoặc tên đăng nhập"
                            className={`${INPUT_BASE} ${errors.username ? INPUT_ERROR : INPUT_NORMAL}`}
                            value={username}
                            onChange={(e) => { setUsername(e.target.value); clearErrors(); }}
                            autoComplete="username"
                            aria-invalid={Boolean(errors.username)}
                        />
                    </div>
                    <button type="submit" className={`${PRIMARY_BTN} mt-4`} disabled={isLoading}>
                        {isLoading ? (
                            <><Loader2 size={16} className="animate-spin" /> Đang gửi...</>
                        ) : (
                            'Gửi mã OTP'
                        )}
                    </button>
                </form>
            )}

            {/* ── STEP 2: OTP ── */}
            {step === 2 && (
                <form className="space-y-5 fade-in-up delay-4" onSubmit={handleGoStep3} noValidate>
                    {sentNotice && !errors.general && !errors.otp && !errors.success && (
                        <div className={SUCCESS_BANNER} role="status">
                            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                            <span>{sentNotice}</span>
                        </div>
                    )}
                    {errors.general && (
                        <div className={ERROR_BANNER} role="alert">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{errors.general}</span>
                        </div>
                    )}
                    {errors.success && (
                        <div className={SUCCESS_BANNER} role="status">
                            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                            <span>{errors.success}</span>
                        </div>
                    )}
                    {errors.otp && (
                        <div className={ERROR_BANNER} role="alert">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{errors.otp}</span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label htmlFor="forgot-otp-0" className={LABEL}>Mã OTP 6 số</label>
                        <OtpInputs
                            value={otp}
                            onChange={setOtp}
                            disabled={isLoading}
                            error={Boolean(errors.otp)}
                            idPrefix="forgot-otp"
                        />
                        <p className="text-sm text-gray-600 pt-1">
                            Không nhận được mã?{' '}
                            <button
                                type="button"
                                className="font-medium text-black hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                                onClick={handleResendOTP}
                                disabled={isLoading || resendIn > 0}
                            >
                                {resendIn > 0 ? `Gửi lại OTP sau ${resendIn} giây` : 'Gửi lại OTP'}
                            </button>
                        </p>
                    </div>

                    <button
                        type="submit"
                        className={`${PRIMARY_BTN} mt-4`}
                        disabled={isLoading || otpValue.length !== 6}
                    >
                        {isLoading ? (
                            <><Loader2 size={16} className="animate-spin" /> Đang xử lý...</>
                        ) : (
                            'Tiếp tục'
                        )}
                    </button>
                </form>
            )}

            {/* ── STEP 3: MẬT KHẨU MỚI ── */}
            {step === 3 && (
                <form className="space-y-5 fade-in-up delay-4" onSubmit={handleResetPassword} noValidate>
                    {errors.general && (
                        <div className={ERROR_BANNER} role="alert">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <span>{errors.general}</span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label htmlFor="forgot-new-password" className={LABEL}>Mật khẩu mới</label>
                        <div className="relative">
                            <input
                                id="forgot-new-password"
                                type={showNewPassword ? 'text' : 'password'}
                                placeholder="Tối thiểu 6 ký tự"
                                className={`${INPUT_BASE} ${errors.newPassword ? INPUT_ERROR : INPUT_NORMAL} pr-10`}
                                value={newPassword}
                                onChange={(e) => { setNewPassword(e.target.value); clearErrors(); }}
                                autoComplete="new-password"
                                aria-invalid={Boolean(errors.newPassword)}
                                aria-describedby={errors.newPassword ? 'forgot-new-password-error' : undefined}
                            />
                            <button
                                type="button"
                                className={EYE_BTN}
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            >
                                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        {errors.newPassword && (
                            <p id="forgot-new-password-error" className={FIELD_ERROR}>
                                <AlertCircle size={13} className="shrink-0" />{errors.newPassword}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="forgot-confirm-password" className={LABEL}>Xác nhận mật khẩu</label>
                        <div className="relative">
                            <input
                                id="forgot-confirm-password"
                                type={showConfirmPassword ? 'text' : 'password'}
                                placeholder="Nhập lại mật khẩu mới"
                                className={`${INPUT_BASE} ${errors.confirmPassword ? INPUT_ERROR : INPUT_NORMAL} pr-10`}
                                value={confirmPassword}
                                onChange={(e) => { setConfirmPassword(e.target.value); clearErrors(); }}
                                autoComplete="new-password"
                                aria-invalid={Boolean(errors.confirmPassword)}
                                aria-describedby={errors.confirmPassword ? 'forgot-confirm-password-error' : undefined}
                            />
                            <button
                                type="button"
                                className={EYE_BTN}
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            >
                                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        {errors.confirmPassword && (
                            <p id="forgot-confirm-password-error" className={FIELD_ERROR}>
                                <AlertCircle size={13} className="shrink-0" />{errors.confirmPassword}
                            </p>
                        )}
                    </div>

                    <button type="submit" className={`${PRIMARY_BTN} mt-4`} disabled={isLoading}>
                        {isLoading ? (
                            <><Loader2 size={16} className="animate-spin" /> Đang xử lý...</>
                        ) : (
                            'Đặt lại mật khẩu'
                        )}
                    </button>
                </form>
            )}

            {/* ── STEP 4: THÀNH CÔNG ── */}
            {step === 4 && (
                <div className="text-center space-y-6 fade-in-up delay-4">
                    <CheckCircle2 className="w-16 h-16 mx-auto text-green-600" />
                    <div>
                        <p className="text-lg font-semibold text-gray-900">Mật khẩu đã được đặt lại thành công!</p>
                        <p className="mt-2 text-gray-600">Bạn có thể đăng nhập với mật khẩu mới ngay bây giờ.</p>
                    </div>
                    <button
                        type="button"
                        className={PRIMARY_BTN}
                        onClick={() => navigate('/login')}
                    >
                        Đăng nhập ngay
                    </button>
                </div>
            )}
        </AuthShell>
    );
}
