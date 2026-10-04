import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPaperPageCss, getPaperSheetClasses } from "@/components/print/paperStyles";
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
 */
export default function PrintLayout({
    title,
    onBack,
    onPrint,
    disablePrint = false,
    paper,
    children,
}) {
    const paperConfig = paper ?? DEFAULT_PAPER;

    return (
        <div className="print-root min-h-screen bg-bo-canvas">
            <style>{getPaperPageCss(paperConfig)}</style>

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

            <div className="print-container overflow-x-auto px-4 py-6 sm:px-6">
                <div
                    className={`mx-auto bg-white shadow-sm print:min-h-0! print:shadow-none! ${getPaperSheetClasses(paperConfig)}`}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
