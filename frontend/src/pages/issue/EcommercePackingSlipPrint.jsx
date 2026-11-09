import PrintRoutePage from "@/components/print/PrintRoutePage";
import { toEcommercePrintModel } from "@/components/print/adapters/ecommercePrintAdapter";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { t } from "@/i18n";

/**
 * Trang in thật của Phiếu đóng gói đơn sàn TMĐT (Lazada, Shopee, TikTok Shop).
 * Sử dụng mẫu in `ecommerce_packing_slip` (mặc định tem nhiệt A6 100 × 150 mm, hoặc A5 / A4 / K80).
 * Tem dán lên kiện hàng (thay cho nút in vận đơn Lazada AWB đã gỡ ở commit aab0952b).
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
      backPath="/goods-issues/:id"
      loadingLabel={t("Đang tải dữ liệu phiếu đóng gói đơn sàn")}
      titleFallback={t("In phiếu vận đơn / đóng gói đơn sàn (A6)")}
      notFoundTitle={t("Không tìm thấy phiếu xuất kho")}
      notFoundDescription={t("Phiếu có thể đã bị xóa hoặc bạn không có quyền truy cập.")}
    />
  );
}
