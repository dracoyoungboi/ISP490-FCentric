import { useMemo, useRef, useState } from "react";
import Barcode from "react-barcode";
import { useReactToPrint } from "react-to-print";
import { AlertCircle, Loader2, Printer, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const MONEY_FORMAT = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
});

// Chỉ tác động đến tài liệu in mã vạch; không đổi CSS in phiếu của hệ thống.
// Khổ mặc định là A4, hai cột tem rộng 85 mm, chiều cao theo nội dung.
const PRINT_PAGE_STYLE = `
    @page { size: A4 portrait; margin: 10mm; }
    @media print {
        html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
        .sku-barcode-sheet {
            display: grid !important;
            grid-template-columns: repeat(2, 85mm) !important;
            align-items: start !important;
            justify-content: start !important;
            gap: 6mm !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
        }
        .sku-barcode-sheet .sku-barcode-label {
            box-sizing: border-box !important;
            width: 85mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 3mm !important;
            border: 0.2mm solid #ddd !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #000 !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
        }
        .sku-barcode-label * { color: #000 !important; }
        .sku-barcode-label svg {
            display: block !important;
            max-width: 100% !important;
            height: auto !important;
            margin: 0 auto !important;
        }
    }
`;

function getBarcodeValue(item) {
    // Dùng mã có sẵn trong dữ liệu; không tự tạo SP-id / SP-NA.
    const candidates = [item?.maVachSku, item?.maSku, item?.maVach, item?.maBienThe];
    const value = candidates.find((candidate) =>
        candidate != null && String(candidate).trim().length > 0
    );
    return value == null ? "" : String(value);
}

function getPrice(item, product) {
    const value = item?.giaBan ?? item?.giaBanMacDinh ?? product?.giaBanMacDinh;
    if (value == null || String(value).trim() === "") return null;
    const price = Number(value);
    return Number.isFinite(price) && price >= 0 ? price : null;
}

export default function BarcodePrint({ isOpen, onClose, products = [] }) {
    const componentRef = useRef(null);
    const printInProgressRef = useRef(false);
    const [isPrinting, setIsPrinting] = useState(false);

    const printableItems = useMemo(() => {
        const validProducts = Array.isArray(products) ? products.filter(Boolean) : [];
        return validProducts.flatMap((product, productIndex) => {
            const variants = Array.isArray(product.bienTheSanPhams)
                ? product.bienTheSanPhams.filter(Boolean)
                : [];
            const items = variants.length ? variants : [product];
            return items.map((item, itemIndex) => {
                const barcodeValue = getBarcodeValue(item);
                // CODE128 trong JsBarcode: chỉ cho phép ký tự ASCII có thể in.
                const hasValidBarcode = /^[\x20-\x7E]+$/.test(barcodeValue);
                const price = getPrice(item, product);
                return {
                    product,
                    item,
                    barcodeValue,
                    price,
                    error: !hasValidBarcode
                        ? "Thiếu mã vạch hoặc mã chứa ký tự không hỗ trợ CODE128."
                        : price == null ? "Chưa có giá bán hợp lệ." : null,
                    key: `${productIndex}-${itemIndex}-${item.id ?? "item"}`,
                };
            });
        });
    }, [products]);

    const totalLabels = printableItems.length;
    const invalidLabels = printableItems.filter(({ error }) => error).length;
    const canPrint = totalLabels > 0 && invalidLabels === 0;
    const isSingleLabel = totalLabels <= 1;

    const finishPrint = () => {
        printInProgressRef.current = false;
        setIsPrinting(false);
    };

    const printDocument = useReactToPrint({
        contentRef: componentRef,
        documentTitle: "FCentric - In mã vạch",
        pageStyle: PRINT_PAGE_STYLE,
        onAfterPrint: finishPrint,
        onPrintError: () => {
            finishPrint();
            toast.error("Không thể mở bản in mã vạch. Vui lòng thử lại.");
        },
    });

    const handlePrint = () => {
        if (!canPrint || printInProgressRef.current) return;
        printInProgressRef.current = true;
        setIsPrinting(true);
        try {
            printDocument();
        } catch {
            finishPrint();
            toast.error("Không thể mở bản in mã vạch. Vui lòng thử lại.");
        }
    };

    const handleClose = () => {
        if (!printInProgressRef.current) onClose?.();
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
            <DialogContent
                showCloseButton={!isPrinting}
                className={`flex max-h-[90dvh] flex-col gap-0 overflow-hidden border-bo-border bg-white p-0 font-backoffice text-bo-foreground ${isSingleLabel ? "sm:max-w-[460px]" : "sm:max-w-[900px]"}`}
            >
                <DialogHeader className="shrink-0 gap-1.5 border-b border-bo-border px-5 py-4 pr-12 text-left">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold text-bo-foreground">
                        <ScanBarcode className="size-5 shrink-0 text-bo-primary" aria-hidden="true" />
                        In mã vạch
                    </DialogTitle>
                    <DialogDescription className="text-xs text-bo-muted">
                        Xem trước tem sản phẩm
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-bo-foreground">Mẫu tem</p>
                        <span className="text-xs text-bo-muted">{totalLabels} tem</span>
                    </div>

                    {invalidLabels > 0 && (
                        <div role="alert" className="mb-3 flex items-start gap-2 rounded-md border border-bo-warning/20 bg-bo-warning-soft p-2.5 text-sm text-bo-warning">
                            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            <p>Có {invalidLabels} tem thiếu mã vạch hợp lệ hoặc giá bán. Vui lòng cập nhật dữ liệu trước khi in.</p>
                        </div>
                    )}

                    <div className="rounded-lg bg-bo-surface-subtle p-3 sm:p-4">
                        <div
                            ref={componentRef}
                            className={`sku-barcode-sheet grid items-start gap-3 font-backoffice ${isSingleLabel ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}
                        >
                            {printableItems.map(({ product, item, barcodeValue, price, error, key }) => {
                                const skuValue = item.maSku || item.maBienThe;
                                return (
                                    <article key={key} className="sku-barcode-label mx-auto w-full max-w-[420px] break-inside-avoid rounded-md border border-bo-border bg-white p-3.5 text-black">
                                        {/* Tên sản phẩm tối đa 2 dòng */}
                                        <p className="line-clamp-2 break-words text-[13px] font-semibold leading-5">
                                            {product.tenSanPham || item.productName || "Sản phẩm"}
                                        </p>

                                        {/* Màu · Size trái, giá phải trên cùng một hàng */}
                                        <div className="mt-1.5 flex items-start justify-between gap-3">
                                            <p className="min-w-0 break-words text-xs leading-5 text-slate-600">
                                                Màu: {item.mauSac?.tenMau || "—"} · Size: {item.size?.tenSize || "—"}
                                            </p>
                                            <p className="shrink-0 text-sm font-bold leading-5 tabular-nums">
                                                {price == null ? "—" : MONEY_FORMAT.format(price)}
                                            </p>
                                        </div>

                                        {error ? (
                                            <p className="my-3 text-sm text-bo-danger">{error}</p>
                                        ) : (
                                            <div className="mt-2.5 flex min-w-0 justify-center" role="img" aria-label={`Mã vạch ${barcodeValue}`}>
                                                <Barcode
                                                    value={barcodeValue}
                                                    format="CODE128"
                                                    renderer="svg"
                                                    width={1.4}
                                                    height={58}
                                                    displayValue={false}
                                                    background="#ffffff"
                                                    lineColor="#000000"
                                                    margin={0}
                                                    marginLeft={14}
                                                    marginRight={14}
                                                    className="block h-auto max-w-full"
                                                />
                                            </div>
                                        )}

                                        {/* Dòng dưới mã vạch: mã quét trước, SKU căn giữa ngay dưới khi khác mã quét */}
                                        <p className="mt-1 break-all text-center font-mono text-[10px] leading-4">{barcodeValue || "Chưa có mã vạch"}</p>
                                        {skuValue && skuValue !== barcodeValue && (
                                            <p className="break-all text-center font-mono text-[10px] leading-4">{skuValue}</p>
                                        )}
                                    </article>
                                );
                            })}
                            {totalLabels === 0 && (
                                <div className="py-10 text-center">
                                    <ScanBarcode className="mx-auto mb-3 size-8 text-bo-muted" aria-hidden="true" />
                                    <p className="text-sm font-medium text-bo-foreground">Không có dữ liệu in mã vạch</p>
                                    <p className="mt-1 text-xs text-bo-muted">Hãy chọn biến thể sản phẩm để in tem.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="shrink-0 gap-2 border-t border-bo-border bg-white px-5 py-4">
                    <Button type="button" variant="outline" onClick={handleClose} disabled={isPrinting} className="h-9 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle focus-visible:border-bo-primary focus-visible:ring-bo-primary/15">
                        Đóng
                    </Button>
                    <Button type="button" onClick={handlePrint} disabled={!canPrint || isPrinting} className="h-9 bg-bo-primary text-white hover:bg-bo-primary-hover focus-visible:border-bo-primary focus-visible:ring-bo-primary/15">
                        {isPrinting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Printer className="size-4" aria-hidden="true" />}
                        {isPrinting ? "Đang mở bản in..." : "In mã vạch"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
