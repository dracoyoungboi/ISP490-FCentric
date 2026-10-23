import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Khung trang của cổng nhà cung cấp sau khi xác nhận mã: thanh trên (chữ "Cổng nhà cung cấp", nhà cung cấp đang đăng
 * nhập, nút Thoát) và vùng nội dung nền bo-canvas. Thanh trên không có logo: FCentric chỉ là tên phần mềm, logo cửa hàng
 * chưa có trong đặc tả (đặc tả 6.2).
 * Dưới 768px: thanh trên thu gọn, nút Thoát chỉ còn biểu tượng (vùng bấm 44px).
 */
export default function KhungCongNhaCungCap({ tenNhaCungCap, email, onThoat, children }) {
    return (
        <div className="flex min-h-dvh flex-col bg-bo-canvas font-backoffice text-bo-foreground">
            <header className="shrink-0 border-b border-bo-border bg-white">
                {/* Cùng bề rộng tối đa 1600px với nội dung trang để tên cổng và nút Thoát thẳng mép nội dung trên màn rộng */}
                <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 pr-1.5 pl-4 md:h-16 md:gap-3.5 md:px-6">
                    <span className="whitespace-nowrap text-sm leading-5 font-semibold text-bo-heading md:text-base">Cổng nhà cung cấp</span>

                    <div className="ml-auto flex min-w-0 items-center gap-4">
                        {(tenNhaCungCap || email) && (
                            <div className="hidden min-w-0 flex-col items-end md:flex">
                                {tenNhaCungCap && <span className="max-w-[360px] truncate text-sm font-semibold">{tenNhaCungCap}</span>}
                                {email && <span className="max-w-[360px] truncate text-xs text-bo-muted">{email}</span>}
                            </div>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onThoat}
                            className="hidden gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle md:inline-flex"
                        >
                            <LogOut aria-hidden="true" />
                            Thoát
                        </Button>
                        <button
                            type="button"
                            onClick={onThoat}
                            aria-label="Thoát"
                            className="flex size-11 items-center justify-center rounded-md text-slate-600 hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 md:hidden"
                        >
                            <LogOut className="size-5" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </header>

            {children}
        </div>
    );
}
