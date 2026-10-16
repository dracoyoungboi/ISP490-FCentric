import { Check } from 'lucide-react';

const STEPS = ['Email', 'OTP', 'Mật khẩu'];

/**
 * Thanh tiến trình các bước xác thực. Mặc định là "Email → OTP → Mật khẩu" của luồng quên mật khẩu;
 * truyền `steps` để dùng cho luồng khác (vd. cổng nhà cung cấp: "Thông tin đơn → Mã OTP").
 * currentStep: 1..steps.length. Bước đã xong = tròn đen có dấu tick, bước hiện tại = tròn đen có số,
 * bước chưa tới = viền xám. Khi có từ 3 bước trở lên, bước cuối bị ẩn dưới sm (giống thiết kế reference).
 */
export default function AuthProgress({ currentStep, steps = STEPS }) {
    const hideLastOnMobile = steps.length > 2;
    return (
        <div className="flex items-center gap-3 sm:gap-4 mb-8 fade-in-up delay-3">
            {steps.map((label, i) => {
                const s = i + 1;
                const isDone = s < currentStep;
                const isActive = s === currentStep;
                const isLast = i === steps.length - 1;
                return (
                    <div
                        key={label}
                        aria-current={isActive ? 'step' : undefined}
                        className={`flex items-center gap-3 sm:gap-4 ${isLast && hideLastOnMobile ? 'hidden sm:flex' : ''}`}
                    >
                        <div className="flex items-center gap-2">
                            <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                                    isDone || isActive
                                        ? 'bg-gray-900 text-white'
                                        : 'border border-gray-300 text-gray-400'
                                }`}
                            >
                                {isDone ? <Check className="w-3.5 h-3.5" /> : s}
                            </span>
                            <span
                                className={`text-sm whitespace-nowrap ${
                                    isDone || isActive
                                        ? 'font-semibold text-gray-900'
                                        : 'font-medium text-gray-400'
                                }`}
                            >
                                {label}
                            </span>
                        </div>
                        {!isLast && (
                            <div className={`w-6 sm:w-8 h-px shrink-0 ${isDone ? 'bg-gray-900' : 'bg-gray-200'}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
