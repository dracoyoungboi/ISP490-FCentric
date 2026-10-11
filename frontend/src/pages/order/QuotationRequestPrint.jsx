import PrintRoutePage from "@/components/print/PrintRoutePage";
import { toQuotationRequestPrintModel } from "@/components/print/adapters/quotationRequestPrintAdapter";
import apiClient from '@/services/apiClient';

/**
 * Trang in thật của yêu cầu báo giá — dữ liệu API thật
 * (`GET /api/v1/yeu-cau-mua-hang/get-by-id/{id}`, cùng endpoint với
 * QuotationRequestDetail) + mẫu đang hoạt động của quotation_request.
 */
export default function QuotationRequestPrint() {
    return (
        <PrintRoutePage
            documentType="quotation_request"
            fetcher={async (id) => {
                const result = await apiClient.get(`/api/v1/yeu-cau-mua-hang/get-by-id/${id}`);
                return result?.data?.data ?? null;
            }}
            adapter={toQuotationRequestPrintModel}
            backPath="/quotation-requests/:id"
            loadingLabel="Đang tải dữ liệu phiếu in"
            titleFallback="In phiếu yêu cầu báo giá"
            notFoundTitle="Không tìm thấy yêu cầu báo giá"
            notFoundDescription="Yêu cầu có thể đã bị xóa hoặc bạn không có quyền truy cập."
        />
    );
}
