import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ChanTrangVanHanh from '@/components/auth/ChanTrangVanHanh';
import ThanhTabCong from './ThanhTabCong';
import { t } from "@/i18n";

/**
 * Khung trang của cổng nhà cung cấp sau khi xác nhận mã: thanh trên (chữ "Cổng nhà cung cấp", nhà cung cấp đang đăng
 * nhập, nút Thoát) và vùng nội dung nền bo-canvas. Thanh trên không có logo: FCentric chỉ là tên phần mềm, logo cửa hàng
 * chưa có trong đặc tả (đặc tả 6.2).
 * Dưới 768px: thanh trên thu gọn, nút Thoát chỉ còn biểu tượng (vùng bấm 44px).
 *
 * Thanh tab "Cần xử lý" / "Lịch sử" (ThanhTabCong) nằm ngay dưới thanh trên ở mọi trang sau đăng nhập:
 * `tab` = tab đang mở (null ở trang biên bản / báo giá), `tuTaiSoViec`, `onRoiTrang` truyền thẳng cho ThanhTabCong.
 * `chanTrang`: vẽ chân trang đơn vị vận hành ở cuối (trang báo giá tự đặt chân trang trước thanh Gửi báo giá).
 */
export default function KhungCongNhaCungCap({
    tenNhaCungCap,
    email,
    onThoat,
    tab = null,
    tuTaiSoViec = true,
    onRoiTrang,
    chanTrang = true,
    children,
}) {
    return (
        <div className="flex min-h-dvh flex-col bg-bo-canvas font-backoffice text-bo-foreground">
            <header className="shrink-0 border-b border-bo-border bg-bo-surface">
                {/* Cùng bề rộng tối đa 1600px với nội dung trang để tên cổng và nút Thoát thẳng mép nội dung trên màn rộng */}
                <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 pr-1.5 pl-4 md:h-16 md:gap-3.5 md:px-6">
                    <span className="whitespace-nowrap text-sm leading-5 font-semibold text-bo-heading md:text-base">{t("Cổng nhà cung cấp")}</span>

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
                            className="hidden gap-2 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle md:inline-flex"
                        >
                            <LogOut aria-hidden="true" />
                            {t("Thoát")}
                        </Button>
                        <button
                            type="button"
                            onClick={onThoat}
                            aria-label={t("Thoát")}
                            className="flex size-11 items-center justify-center rounded-md text-slate-600 hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 md:hidden"
                        >
                            <LogOut className="size-5" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </header>

            <ThanhTabCong tab={tab} tuTaiSoViec={tuTaiSoViec} onRoiTrang={onRoiTrang} />

            {children}

            {/* Nền xám bo-canvas nên chữ đậm hơn một bậc để đủ tương phản 4.5:1 */}
            {chanTrang ? <ChanTrangVanHanh className="mt-auto pt-0 text-slate-600" /> : null}
        </div>
    );
}
