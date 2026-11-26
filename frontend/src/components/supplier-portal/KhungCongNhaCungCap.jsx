import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ChanTrangVanHanh from '@/components/auth/ChanTrangVanHanh';
import { DaiNgonNguChanMenu } from '@/components/shared/ChonNgonNgu';
import { LY_DO_ROI_TRANG, xinRoiTrang } from '@/lib/chanRoiTrang';
import ThanhTabCong from './ThanhTabCong';
import { t } from "@/i18n";

/**
 * Khung trang của cổng nhà cung cấp sau khi xác nhận mã: thanh trên (logo FCentric | chữ "Cổng nhà cung cấp", nút tài
 * khoản) và vùng nội dung nền bo-canvas. Nút tài khoản là tên + email nhà cung cấp, bấm mở menu: Thoát và dải đổi ngôn
 * ngữ ở đáy (cùng kiểu menu tài khoản POS). Thoát và đổi ngôn ngữ đi qua xinRoiTrang: trang đang có dữ liệu chưa gửi
 * (báo giá, trả lời biên bản) tự hỏi lại trước.
 * Dưới 768px: logo chỉ còn chữ F, nút tài khoản chỉ còn biểu tượng người (vùng bấm 44px), tên và email ở đầu menu (máy tính không lặp lại trong menu).
 *
 * Thanh tab "Cần xử lý" / "Lịch sử" (ThanhTabCong) nằm ngay dưới thanh trên ở mọi trang sau đăng nhập:
 * `tab` = tab đang mở (null ở trang biên bản / báo giá), `tuTaiSoViec`, `onRoiTrang` truyền thẳng cho ThanhTabCong.
 * `chanTrang`: vẽ chân trang đơn vị vận hành ở cuối (trang báo giá tắt: chân thẻ bảng là phần cuối trang).
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
                    {/* Logo bản chữ tối (nền trắng); dưới 768px chỉ còn chữ F để đủ chỗ cho tên cổng và nút Thoát */}
                    <img
                        src="/branding/f-centric-logo-light.svg"
                        alt="FCentric"
                        draggable={false}
                        className="hidden h-7 w-auto shrink-0 md:block"
                    />
                    <img
                        src="/branding/f-centric-icon.svg"
                        alt="FCentric"
                        draggable={false}
                        className="h-7 w-auto shrink-0 md:hidden"
                    />
                    <span aria-hidden="true" className="h-5 w-px shrink-0 bg-bo-border md:h-6" />
                    <span className="whitespace-nowrap text-sm leading-5 font-semibold text-bo-heading md:text-base">{t("Cổng nhà cung cấp")}</span>

                    <div className="ml-auto flex min-w-0 items-center">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={t("Mở menu tài khoản")}
                                    className="group flex size-11 min-w-0 items-center justify-center gap-2 rounded-md text-bo-foreground hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 data-[state=open]:bg-slate-100 md:h-11 md:w-auto md:pr-2 md:pl-3"
                                >
                                    {/* Điện thoại: không đủ chỗ cho tên, chỉ biểu tượng người (vùng bấm 44px) */}
                                    <UserRound className="size-5 text-slate-600 md:hidden" aria-hidden="true" />
                                    <span className="hidden min-w-0 flex-col items-end text-right md:flex">
                                        {tenNhaCungCap && <span className="max-w-[360px] truncate text-sm leading-4 font-semibold">{tenNhaCungCap}</span>}
                                        {email && <span className="mt-0.5 max-w-[360px] truncate text-xs leading-4 text-bo-muted">{email}</span>}
                                    </span>
                                    <ChevronDown
                                        className="hidden size-3.5 shrink-0 text-bo-muted transition-transform group-hover:text-bo-foreground group-data-[state=open]:rotate-180 group-data-[state=open]:text-bo-foreground motion-reduce:transition-none md:block"
                                        aria-hidden="true"
                                    />
                                </button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent
                                align="end"
                                sideOffset={6}
                                // Máy tính: rộng đúng bằng nút tài khoản (hai mép thẳng hàng), tối thiểu 224px để dải ngôn ngữ
                                // nằm một dòng khi tên công ty ngắn. Điện thoại: nút chỉ là biểu tượng nên giữ 256px.
                                className="z-50 w-64 rounded-lg md:w-[var(--radix-dropdown-menu-trigger-width)] md:min-w-56 border border-bo-border bg-bo-surface p-1 text-bo-foreground shadow-lg"
                            >
                                {/* Tên + email ở đầu menu chỉ trên điện thoại: máy tính đã hiện ngay trên nút, không lặp lại */}
                                {(tenNhaCungCap || email) && (
                                    <div className="md:hidden">
                                        <div className="px-2.5 py-2">
                                            {tenNhaCungCap && <p className="text-sm leading-[18px] font-semibold break-words">{tenNhaCungCap}</p>}
                                            {email && <p className="mt-0.5 text-xs break-all text-bo-muted">{email}</p>}
                                        </div>
                                        <DropdownMenuSeparator className="bg-bo-border" />
                                    </div>
                                )}
                                {/* Một tông xám như dòng khác; rê chuột / chọn bằng phím mới hiện đỏ (cùng menu tài khoản trang quản trị) */}
                                <DropdownMenuItem
                                    onSelect={() => xinRoiTrang(onThoat, LY_DO_ROI_TRANG.thoat)}
                                    className="group cursor-pointer rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-bo-danger-soft focus:text-bo-danger"
                                >
                                    <LogOut className="size-4 text-slate-500 group-focus:text-bo-danger" aria-hidden="true" />
                                    {t("Thoát")}
                                </DropdownMenuItem>
                                <DaiNgonNguChanMenu />
                            </DropdownMenuContent>
                        </DropdownMenu>
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
