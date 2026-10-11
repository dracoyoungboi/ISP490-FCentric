import PrintRoutePage from "@/components/print/PrintRoutePage";
import { toPurchaseRequestPrintModel } from "@/components/print/adapters/purchaseRequestPrintAdapter";
import purchaseRequestService from '@/services/purchaseRequestService';

/**
 * Trang in thật của yêu cầu nhập hàng — dữ liệu API thật
 * (`GET /api/v1/yeu-cau-mua-hang/get-by-id/{id}`, cùng service với
 * PurchaseRequestDetail) + mẫu đang hoạt động của purchase_request.
 */
export default function PurchaseRequestPrint() {
    return (
        <PrintRoutePage
            documentType="purchase_request"
            fetcher={async (id) => {
                const result = await purchaseRequestService.getById(id);
                return result?.data?.data ?? null;
            }}
            adapter={toPurchaseRequestPrintModel}
            backPath="/purchase-requests/:id"
            loadingLabel="Đang tải dữ liệu phiếu in"
            titleFallback="In phiếu yêu cầu nhập hàng"
            notFoundTitle="Không tìm thấy yêu cầu nhập hàng"
            notFoundDescription="Yêu cầu có thể đã bị xóa hoặc bạn không có quyền truy cập."
        />
    );
}
