import { useSearchParams } from "react-router-dom";
import PrintRoutePage from "@/components/print/PrintRoutePage";
import { toSalesInvoicePrintModel } from "@/components/print/adapters/donBanHangPrintAdapter";
import { donBanHangService } from '@/services/donBanHangService';

/** `?mau=tai-quay`: in bằng mẫu hóa đơn tại quầy (khổ nhiệt) thay cho mẫu in từ đơn bán. */
const MAU_HOA_DON_TAI_QUAY = "tai-quay";

/**
 * Trang in thật của hóa đơn bán hàng — dữ liệu API thật
 * (`GET /api/v1/don-ban-hang/{id}/detail`, cùng service với DonBanHangDetail).
 * Mẫu đang hoạt động: `sales_invoice` (A4 / A5) khi in từ trang đơn bán;
 * `pos_invoice` (K80 / K57) khi in từ màn bán tại quầy hoặc in lại đơn bán tại quầy.
 */
export default function DonBanHangInvoice() {
    const [searchParams] = useSearchParams();
    const taiQuay = searchParams.get("mau") === MAU_HOA_DON_TAI_QUAY;
    return (
        <PrintRoutePage
            documentType={taiQuay ? "pos_invoice" : "sales_invoice"}
            fetcher={async (id) => {
                const result = await donBanHangService.getDetail(id);
                return result?.data ?? null;
            }}
            adapter={toSalesInvoicePrintModel}
            backPath="/sales-orders/:id"
            loadingLabel="Đang tải dữ liệu hóa đơn"
            titleFallback="In hóa đơn bán hàng"
            notFoundTitle="Không tìm thấy hóa đơn"
            notFoundDescription="Đơn bán hàng có thể đã bị xóa hoặc bạn không có quyền truy cập."
        />
    );
}
