import AuthImagePanel from './AuthImagePanel';
import BrandLogo from '@/components/brand/BrandLogo';

/**
 * Khung layout chung cho các màn hình xác thực:
 * - Desktop (lg+): 2 cột 50/50 — trái là panel ảnh slider, phải là form trên nền trắng.
 * - Mobile (< lg): ẩn panel ảnh, logo hiển thị phía trên form, trang cuộn dọc tự do.
 */
export default function AuthShell({ children }) {
    return (
        <div
            data-auth-page
            className="min-h-dvh w-full flex flex-col lg:flex-row bg-white lg:h-dvh lg:overflow-hidden"
        >
            <AuthImagePanel />

            <div className="relative z-30 w-full lg:w-1/2 lg:h-full overflow-y-auto bg-white flex flex-col shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.1)]">
                {/* my-auto thay cho justify-center: không cắt phần đầu form khi nội dung dài hơn màn hình */}
                <div className="w-full max-w-md mx-auto my-auto px-6 py-10 sm:px-12 lg:px-0 lg:py-24">
                    {/* Logo trên mobile: nền trắng nên dùng bản chữ tối (bản "auth" chữ trắng gần như không thấy) */}
                    <div className="lg:hidden mb-10 fade-in-up">
                        <BrandLogo variant="light" className="h-10" />
                    </div>

                    {children}
                </div>
            </div>
        </div>
    );
}
