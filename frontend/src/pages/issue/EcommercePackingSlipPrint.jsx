import PrintRoutePage from "@/components/print/PrintRoutePage";
import { toEcommercePrintModel } from "@/components/print/adapters/ecommercePrintAdapter";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";

/**
 * Trang in thật của Phiếu đóng gói đơn sàn TMĐT (Lazada, Shopee, TikTok Shop).
 * Sử dụng mẫu in `ecommerce_packing_slip` (mặc định khổ nhiệt A6 100x150mm hoặc A5/A4/K80).
 */
export default function EcommercePackingSlipPrint() {
  return (
    <PrintRoutePage
      documentType="ecommerce_packing_slip"
      fetcher={async (id) => {
        const detail = await phieuXuatKhoService.getDetail(id);
        return detail || null;
      }}
      adapter={toEcommercePrintModel}
      titleFallback="In phiếu đóng gói đơn sàn"
    />
  );
}
