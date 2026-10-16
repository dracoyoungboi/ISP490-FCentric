import PrintRoutePage from "@/components/print/PrintRoutePage";
import { toSalesQuotationPrintModel } from "@/components/print/adapters/donBanHangPrintAdapter";
import { donBanHangService } from '@/services/donBanHangService';

/**
 * Trang in thật của báo giá bán — dữ liệu API thật
 * (`GET /api/v1/don-ban-hang/{id}/detail`, cùng service với BaoGiaDetail)
 * + mẫu đang hoạt động của sales_quotation.
 */
export default function BaoGiaPrint() {
    return (
        <PrintRoutePage
            documentType="sales_quotation"
            fetcher={async (id) => {
                const result = await donBanHangService.getDetail(id);
                return result?.data ?? null;
            }}
            adapter={toSalesQuotationPrintModel}
            backPath="/sales-quotations/:id"
            loadingLabel="Đang tải dữ liệu báo giá"
            titleFallback="In báo giá bán"
            notFoundTitle="Không tìm thấy báo giá"
            notFoundDescription="Báo giá có thể đã bị xóa hoặc bạn không có quyền truy cập."
        />
    );
}
