import PrintRoutePage from "@/components/print/PrintRoutePage";
import { toSalesInvoicePrintModel } from "@/components/print/adapters/donBanHangPrintAdapter";
import { donBanHangService } from '@/services/donBanHangService';

/**
 * Trang in thật của hóa đơn bán hàng — dữ liệu API thật
 * (`GET /api/v1/don-ban-hang/{id}/detail`, cùng service với DonBanHangDetail)
 * + mẫu đang hoạt động của sales_invoice (A4 / A5 / K80).
 * Thay thế trang in kiểu gold/ivory cũ bằng hệ thống in FCentric chung.
 */
export default function DonBanHangInvoice() {
    return (
        <PrintRoutePage
            documentType="sales_invoice"
            fetcher={async (id) => {
                const result = await donBanHangService.getDetail(id);
                return result?.data ?? null;
            }}
            adapter={toSalesInvoicePrintModel}
            backPath="/sales-orders/:id"
            loadingLabel="Đang tải dữ liệu hóa đơn"
            titleFallback="In hóa đơn bán hàng"
            notFoundTitle="Không tìm thấy hóa đơn"
            notFoundDescription="Hóa đơn có thể đã bị xóa hoặc bạn không có quyền truy cập."
        />
    );
}
