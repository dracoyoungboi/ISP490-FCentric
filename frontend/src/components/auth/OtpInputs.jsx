import { useRef } from 'react';

const OTP_LENGTH = 6;

/**
 * Nhóm 6 ô nhập OTP dùng chung cho ForgotPassword và đăng nhập cổng nhà cung cấp.
 * value/onChange: mảng 6 chuỗi (mỗi ô 1 ký tự số), do trang cha quản lý.
 * Hỗ trợ: auto-focus ô kế tiếp, Backspace lùi ô, dán (paste) mã 6 số, inputMode numeric.
 * Ô rộng tối đa 44px (48px từ sm) và tự co lại trên màn rất hẹp (dưới ~360px) để không tràn khung.
 */
export default function OtpInputs({
    value,
    onChange,
    disabled = false,
    error = false,
    idPrefix = 'otp',
}) {
    const refs = useRef([]);

    const focusAt = (index) => {
        const clamped = Math.max(0, Math.min(OTP_LENGTH - 1, index));
        refs.current[clamped]?.focus();
    };

    const handleChange = (index, e) => {
        const digit = e.target.value.replace(/\D/g, '').slice(0, 1);
        const next = [...value];
        next[index] = digit;
        onChange(next);
        if (digit) focusAt(index + 1);
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !value[index] && index > 0) {
            focusAt(index - 1);
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (!digits) return;
        const next = [...value];
        for (let i = 0; i < digits.length; i += 1) next[i] = digits[i];
        onChange(next);
        focusAt(digits.length);
    };

    return (
        <div className="flex gap-2 justify-between">
            {value.map((digit, index) => (
                <input
                    key={index}
                    id={`${idPrefix}-${index}`}
                    ref={(el) => {
                        refs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={1}
                    autoFocus={index === 0 && !disabled}
                    disabled={disabled}
                    aria-label={`Ô nhập OTP thứ ${index + 1}`}
                    aria-invalid={error}
                    value={digit}
                    onChange={(e) => handleChange(index, e)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className={`h-12 w-full min-w-0 max-w-11 sm:h-14 sm:max-w-12 rounded-lg border bg-white text-center text-xl font-bold text-gray-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50 ${
                        error ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
            ))}
        </div>
    );
}
