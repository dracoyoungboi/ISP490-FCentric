import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { gioVaNgay } from './baoGiaUtils';

const NUT_CHINH = 'bg-bo-primary text-white hover:bg-bo-primary-hover';
const NUT_PHU = 'border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle';
const KHUNG_HOP =
    'max-w-[calc(100%-2rem)] gap-5 rounded-lg border-bo-border p-5 font-backoffice text-bo-foreground sm:max-w-[448px] sm:p-6';
const NUT_DONG_X =
    'absolute top-2 right-2 flex size-11 items-center justify-center rounded-md text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:pointer-events-none disabled:opacity-50 sm:top-3 sm:right-3 sm:size-9';

/** "3 sản phẩm · 9 phân loại" (đơn có nhiều phân loại của cùng sản phẩm), không thì "3". */
const moTaSoSanPham = ({ soNhom, soSanPham }) =>
    soNhom && soNhom < soSanPham ? `${soNhom} sản phẩm · ${soSanPham} phân loại` : String(soSanPham);

function Dong({ nhan, children, noiBat = false }) {
    return (
        <div
            className={
                noiBat
                    ? 'flex items-baseline justify-between gap-3 bg-bo-surface-subtle px-3.5 py-3'
                    : 'flex justify-between gap-3 border-b border-bo-border px-3.5 py-2.5'
            }
        >
            <dt className={noiBat ? 'font-semibold' : 'text-bo-muted'}>{nhan}</dt>
            <dd
                className={
                    noiBat
                        ? 'm-0 text-right text-lg leading-[26px] font-bold text-bo-heading tabular-nums'
                        : 'm-0 text-right font-semibold tabular-nums'
                }
            >
                {children}
            </dd>
        </div>
    );
}

/**
 * Hộp gửi báo giá, 4 trạng thái:
 * - 'xac-nhan' / 'loi': tóm tắt + nút Gửi (lỗi thì hiện khung đỏ, nút đổi thành "Gửi lại");
 * - 'dang-gui': khóa nút, KHÔNG đóng được bằng Esc / bấm ra ngoài / nút X (như confirm-modal);
 * - 'thanh-cong': hộp đổi sang "Đã gửi báo giá", nút Đóng.
 * `trangThai = null` là hộp đóng.
 */
export default function HopGuiBaoGia({ trangThai, tomTat, guiLuc, loiGui, onGui, onDong }) {
    // Lúc đóng, hộp còn hiện ~200ms (hiệu ứng mờ dần): vẽ theo trạng thái cuối cùng để nội dung không nhảy
    // về bước xác nhận, và khóa các nút trong khoảng đó để không bấm nhầm "Gửi báo giá" lần nữa.
    const [hienThi, setHienThi] = useState(trangThai);
    if (trangThai && trangThai !== hienThi) setHienThi(trangThai);
    const dangDong = !trangThai;
    const dangGui = trangThai === 'dang-gui';
    const thanhCong = hienThi === 'thanh-cong';
    const nutChinhRef = useRef(null);

    // Hộp đổi nội dung khi đang mở (gửi xong / gửi lỗi): đưa con trỏ về nút chính để không mất tiêu điểm
    useEffect(() => {
        if (trangThai === 'thanh-cong' || trangThai === 'loi') nutChinhRef.current?.focus();
    }, [trangThai]);

    return (
        <Dialog open={Boolean(trangThai)} onOpenChange={(mo) => { if (!mo && !dangGui) onDong(); }}>
            <DialogContent showCloseButton={false} className={KHUNG_HOP}>
                <button type="button" aria-label="Đóng" className={NUT_DONG_X} onClick={onDong} disabled={dangGui || dangDong}>
                    <X className="size-4" aria-hidden="true" />
                </button>

                {thanhCong ? (
                    <div className="flex flex-col items-center gap-[18px] pt-1 text-center">
                        <div aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-bo-success-soft text-bo-success">
                            <Check className="size-6" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <DialogTitle className="text-lg leading-7 font-semibold text-bo-heading">Đã gửi báo giá</DialogTitle>
                            <DialogDescription className="text-sm leading-[22px] text-slate-600">
                                FCentric đã nhận báo giá cho đơn{' '}
                                <strong className="font-semibold text-bo-foreground">{tomTat.soDonMua}</strong>. Nhân viên mua hàng sẽ liên hệ
                                nếu cần trao đổi thêm.
                            </DialogDescription>
                        </div>
                        <dl className="m-0 w-full overflow-hidden rounded-lg border border-bo-border text-left text-sm leading-5 [&>div:last-child]:border-b-0">
                            <Dong nhan="Sản phẩm">{moTaSoSanPham(tomTat)}</Dong>
                            <Dong nhan="Tổng tiền báo giá">{formatCurrency(tomTat.tongTien)}</Dong>
                            <Dong nhan="Gửi lúc">{gioVaNgay(guiLuc)}</Dong>
                        </dl>
                        <Button ref={nutChinhRef} type="button" onClick={onDong} disabled={dangDong} className={`h-11 w-full text-[15px] sm:h-10 sm:text-sm ${NUT_CHINH}`}>
                            Đóng
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col gap-1 pr-8">
                            <DialogTitle className="text-lg leading-7 font-semibold text-bo-heading">Gửi báo giá cho FCentric?</DialogTitle>
                            <DialogDescription className="text-sm leading-[22px] text-bo-muted">
                                {dangGui ? 'Đang gửi, vui lòng không đóng trang.' : 'Kiểm tra lại các thông tin dưới đây trước khi gửi.'}
                            </DialogDescription>
                        </div>

                        <dl className="m-0 overflow-hidden rounded-lg border border-bo-border text-sm leading-5">
                            <Dong nhan="Mã đơn">{tomTat.soDonMua}</Dong>
                            <Dong nhan="Sản phẩm">{moTaSoSanPham(tomTat)}</Dong>
                            <Dong nhan="Tổng số lượng">{tomTat.tongSoLuong.toLocaleString('vi-VN')}</Dong>
                            <Dong nhan="Ngày cần giao">{formatDate(tomTat.ngayCanGiao)}</Dong>
                            <Dong nhan="Tổng tiền báo giá" noiBat>{formatCurrency(tomTat.tongTien)}</Dong>
                        </dl>

                        {hienThi === 'loi' ? (
                            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-bo-danger-soft px-3 py-2.5 text-sm text-red-700">
                                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <span>{loiGui}</span>
                            </div>
                        ) : (
                            <p className="m-0 text-[13px] leading-5 text-slate-600">
                                Sau khi gửi, nếu cần điều chỉnh đơn giá, vui lòng liên hệ người phụ trách đơn.
                            </p>
                        )}

                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button type="button" variant="outline" onClick={onDong} disabled={dangGui || dangDong} className={`h-11 sm:h-9 ${NUT_PHU}`}>
                                Kiểm tra lại
                            </Button>
                            <Button ref={nutChinhRef} type="button" onClick={onGui} disabled={dangGui || dangDong} className={`h-11 sm:h-9 ${NUT_CHINH}`}>
                                {dangGui ? (
                                    <><Loader2 className="animate-spin" aria-hidden="true" /> Đang gửi...</>
                                ) : hienThi === 'loi' ? (
                                    'Gửi lại'
                                ) : (
                                    'Gửi báo giá'
                                )}
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** Hỏi lại khi bấm Thoát lúc còn đơn giá/ghi chú chưa gửi. */
export function HopXacNhanThoat({ mo, onO, onThoat }) {
    return (
        <Dialog open={mo} onOpenChange={(m) => { if (!m) onO(); }}>
            <DialogContent showCloseButton={false} className={KHUNG_HOP}>
                <div className="flex flex-col gap-1">
                    <DialogTitle className="text-lg leading-7 font-semibold text-bo-heading">Thoát khỏi trang báo giá?</DialogTitle>
                    <DialogDescription className="text-sm leading-[22px] text-bo-muted">
                        Đơn giá bạn đã nhập chưa được gửi và sẽ mất khi thoát.
                    </DialogDescription>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={onO} className={`h-11 sm:h-9 ${NUT_PHU}`}>
                        Ở lại
                    </Button>
                    <Button type="button" onClick={onThoat} className="h-11 bg-bo-danger text-white hover:bg-red-700 sm:h-9">
                        Thoát
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
