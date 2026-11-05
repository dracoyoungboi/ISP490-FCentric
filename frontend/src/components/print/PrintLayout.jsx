import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPaperPageCss, getPaperSheetClasses, getPaperSheetWidthPx, getThermalFixedHeightMm, isThermalPaper } from "@/components/print/paperStyles";
import { useThermalPageHeight } from "@/components/print/useThermalPageHeight";
import "@/styles/print.css";

const DEFAULT_PAPER = { size: "A4", orientation: "portrait", margin: "default" };

/**
 * Khung trang in độc lập (nằm ngoài BackofficeLayout nên không có
 * sidebar/header và không bị shell `h-dvh overflow-hidden` cắt):
 * toolbar màn hình + tờ giấy căn giữa trên nền xám, kích thước/hướng/lề
 * theo cấu hình mẫu in (`paper`).
 *
 * Khi in: toolbar bị ẩn (.no-print + quy tắc `button` của print.css),
 * tờ giấy được bung hết cỡ nhờ .print-root/.print-container trong print.css
 * và các class `print:*!`; @page được ghi đè động theo cấu hình.
 * `pageFooter`: chữ in ở lề dưới mỗi trang kèm "Trang n/N" (khổ tờ).
 */
export default function PrintLayout({
    title,
    onBack,
    onPrint,
    disablePrint = false,
    paper,
    pageFooter = null,
    children,
}) {
    const paperConfig = paper ?? DEFAULT_PAPER;
    // K80 / K57 (giấy cuộn): chiều cao trang = chiều cao thật của phiếu; tem A6 cao cố định nên không cần đo
    const { ref: thermalRef, heightMm: thermalHeightMm } = useThermalPageHeight(
        isThermalPaper(paperConfig.size) && !getThermalFixedHeightMm(paperConfig.size)
    );
    // Điện thoại (< 768px): tờ giấy thu nhỏ vừa bề ngang màn để đọc hết mà không vuốt ngang (vẫn chụm hai ngón để phóng to);
    // chỉ khi xem trên màn hình — lúc in vẫn đủ khổ. Chưa có phiếu để in (đang tải, lỗi, chưa in được): khối thông báo dùng
    // bề ngang màn thay vì khổ giấy
    const khungRef = useRef(null);
    const [tiLe, setTiLe] = useState(1);
    const rongGiay = getPaperSheetWidthPx(paperConfig);
    // Đo trước khi vẽ (không nháy một khung A4 đủ cỡ); chỉ tính dưới 768px, máy tính giữ tỉ lệ 1 và không dựng lại khi đổi
    // cỡ cửa sổ; bỏ qua chênh dưới 2% để thanh cuộn bật / tắt không làm tỉ lệ lặp qua lại
    useLayoutEffect(() => {
        const khung = khungRef.current;
        if (!khung || typeof ResizeObserver === "undefined") return undefined;
        const dienThoai = window.matchMedia("(max-width: 767.98px)");
        const tinh = () => {
            if (!dienThoai.matches) {
                setTiLe(1);
                return;
            }
            const kieu = getComputedStyle(khung);
            const rong = khung.clientWidth - parseFloat(kieu.paddingLeft) - parseFloat(kieu.paddingRight);
            const moi = Math.min(1, rong / rongGiay);
            if (moi > 0) setTiLe((cu) => (Math.abs(cu - moi) < 0.02 && moi < 1 ? cu : moi));
        };
        tinh();
        const theoDoi = new ResizeObserver(tinh);
        theoDoi.observe(khung);
        return () => theoDoi.disconnect();
    }, [rongGiay]);

    return (
        <div className="print-root min-h-screen bg-bo-canvas">
            <style>{getPaperPageCss(paperConfig, { thermalHeightMm, footerText: pageFooter })}</style>

            <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-bo-border bg-white px-4 py-3 shadow-sm sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                    <Button
                        variant="outline"
                        className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                        onClick={onBack}
                    >
                        <ArrowLeft className="size-4" />
                        Quay lại
                    </Button>
                    <span className="truncate text-sm font-semibold text-bo-foreground">
                        {title}
                    </span>
                </div>
                <Button
                    className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                    onClick={onPrint}
                    disabled={disablePrint}
                >
                    <Printer className="size-4" />
                    In phiếu
                </Button>
            </div>

            <div ref={khungRef} className="print-container overflow-x-auto px-4 py-6 sm:px-6">
                <div
                    ref={thermalRef}
                    style={{ "--ti-le-giay": tiLe }}
                    className={`mx-auto bg-white shadow-sm print:min-h-0! print:shadow-none! ${getPaperSheetClasses(paperConfig)} ${disablePrint ? "max-md:w-auto max-md:min-h-0" : "max-md:[zoom:var(--ti-le-giay)] print:[zoom:1]"}`}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
