import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { LY_DO_ROI_TRANG } from '@/lib/chanRoiTrang';
import { t } from "@/i18n";

const KHUNG_HOP =
    'max-w-[calc(100%-2rem)] gap-5 rounded-lg border-bo-border p-5 font-backoffice text-bo-foreground sm:max-w-[448px] sm:p-6';

/**
 * Câu hỏi đúng việc người dùng vừa bấm khi trang còn dữ liệu chưa gửi:
 * `lyDo` (LY_DO_ROI_TRANG) = Thoát / đổi ngôn ngữ (tải lại trang) / không có (link, tab, nút Back của trình duyệt).
 * `cau`: câu riêng của trang — `{ roi, mat }`: tiêu đề khi rời trang, câu nói thứ sẽ mất.
 */
function cauHoiRoiTrang(lyDo, cau) {
    if (lyDo === LY_DO_ROI_TRANG.doiNgonNgu) {
        return { tieuDe: t("Đổi ngôn ngữ?"), moTa: `${t("Trang sẽ tải lại.")} ${cau.mat}`, nutDi: t("Đổi ngôn ngữ") };
    }
    if (lyDo === LY_DO_ROI_TRANG.thoat) return { tieuDe: t("Thoát khỏi Cổng nhà cung cấp?"), moTa: cau.mat, nutDi: t("Thoát") };
    return { tieuDe: cau.roi, moTa: cau.mat, nutDi: t("Rời trang") };
}

/**
 * Hộp hỏi lại trước khi rời trang cổng nhà cung cấp khi còn dữ liệu chưa gửi (đơn giá báo giá, lựa chọn biên bản).
 * `hoi`: null (đóng) | `{ lyDo, tiepTuc }` từ useHoiKhiRoiTrang; `cau`: xem cauHoiRoiTrang.
 */
export default function HopHoiRoiTrang({ hoi, cau, onO }) {
    const { tieuDe, moTa, nutDi } = cauHoiRoiTrang(hoi?.lyDo, cau);
    return (
        <Dialog open={Boolean(hoi)} onOpenChange={(m) => { if (!m) onO(); }}>
            <DialogContent showCloseButton={false} className={KHUNG_HOP}>
                <div className="flex flex-col gap-1">
                    <DialogTitle className="text-lg leading-7 font-semibold text-bo-heading">{tieuDe}</DialogTitle>
                    <DialogDescription className="text-sm leading-[22px] text-bo-muted">{moTa}</DialogDescription>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onO}
                        className="h-11 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle sm:h-9"
                    >
                        {t("Ở lại")}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => {
                            const tiepTuc = hoi?.tiepTuc;
                            onO();
                            tiepTuc?.();
                        }}
                        className="h-11 bg-bo-danger text-white hover:bg-red-700 sm:h-9"
                    >
                        {nutDi}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
