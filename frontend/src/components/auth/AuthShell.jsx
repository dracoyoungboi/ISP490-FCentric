import AuthImagePanel from './AuthImagePanel';
import ChanTrangVanHanh from './ChanTrangVanHanh';
import BrandLogo from '@/components/brand/BrandLogo';

/**
 * Khung layout chung cho các màn hình xác thực:
 * - Desktop (lg+): 2 cột 50/50 — trái là panel ảnh slider, phải là form trên nền trắng.
 * - Mobile (< lg): ẩn panel ảnh, logo hiển thị phía trên form, trang cuộn dọc tự do.
 * - Đáy cột form có chân trang đơn vị vận hành; form dài hơn màn hình thì chân trang nằm sau form.
 * `slides` (tùy chọn): bộ ảnh riêng cho panel trái; bỏ trống thì dùng bộ ảnh mặc định.
 */
export default function AuthShell({ children, slides }) {
    return (
        <div
            data-auth-page
            className="min-h-dvh w-full flex flex-col lg:flex-row bg-bo-surface lg:h-dvh lg:overflow-hidden"
        >
            <AuthImagePanel slides={slides} />

            {/* grow: dưới lg cột cao hết màn hình để chân trang nằm ở đáy (lg hai cột đã đủ 50/50 nên không đổi) */}
            <div className="relative z-30 w-full grow lg:w-1/2 lg:h-full overflow-y-auto bg-bo-surface flex flex-col shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.1)]">
                {/* my-auto thay cho justify-center: không cắt phần đầu form khi nội dung dài hơn màn hình; dưới lg form
                    vẫn sát trên như cũ (mb-auto). lg:py-16: màn cao form vẫn ở chỗ cũ, màn thấp ~650px thì form Đăng nhập
                    + chân trang vừa một màn; form dài hơn (bước OTP, có lỗi) thì cuộn, chân trang nằm sau form */}
                <div className="w-full max-w-md mx-auto mb-auto lg:my-auto px-6 py-10 sm:px-12 lg:px-0 lg:py-16">
                    {/* Logo trên mobile: nền trắng nên dùng bản chữ tối (bản "auth" chữ trắng gần như không thấy) */}
                    <div className="lg:hidden mb-10 fade-in-up">
                        <BrandLogo variant="light" className="h-10" />
                    </div>

                    {children}
                </div>

                <ChanTrangVanHanh />
            </div>
        </div>
    );
}
