import PrintRoutePage from "@/components/print/PrintRoutePage";
import { toPurchaseOrderPrintModel } from "@/components/print/adapters/purchaseOrderPrintAdapter";
import apiClient from '@/services/apiClient';

/**
 * Trang in thật của đơn mua hàng — dùng ĐÚNG cách gọi API của
 * PurchaseOrderDetail:
 *   GET /api/v1/don-mua-hang/get-by-id/{id}
 *   order = response.data.data   (axios response -> ResponseData envelope -> DonMuaHangDto)
 *
 * Lưu ý: purchaseOrderService.getById trả về envelope (response.data) —
 * nếu dùng nó mà đọc tiếp `.data.data` sẽ double-unwrap ra undefined.
 * Vì vậy trang in gọi apiClient trực tiếp với MỘT bước chuẩn hoá duy nhất.
 */
export default function PurchaseOrderPrint() {
    return (
        <PrintRoutePage
            documentType="purchase_order"
            fetcher={async (id) => {
                const response = await apiClient.get(`/api/v1/don-mua-hang/get-by-id/${id}`);
                const order = response?.data?.data ?? null;
                if (!order) {
                    // Envelope báo lỗi nghiệp vụ (vd: status 400 "Không tìm thấy đơn mua hàng...")
                    // -> phân loại thành trạng thái "not found" thay vì lỗi chung.
                    const err = new Error(response?.data?.message || "Không tìm thấy đơn mua hàng");
                    err.isNotFound = (response?.data?.status === 400);
                    throw err;
                }
                return order;
            }}
            adapter={toPurchaseOrderPrintModel}
            backPath="/purchase-orders/:id"
            loadingLabel="Đang tải dữ liệu đơn mua hàng"
            titleFallback="In đơn mua hàng"
            notFoundTitle="Không tìm thấy đơn mua hàng."
            notFoundDescription="Đơn mua hàng có thể đã bị xóa hoặc bạn không có quyền truy cập."
            forbiddenTitle="Bạn không có quyền xem đơn mua hàng này."
            forbiddenDescription="Tài khoản của bạn không có quyền truy cập đơn mua hàng này."
            errorDescription="Không thể tải dữ liệu đơn mua hàng. Vui lòng thử lại."
        />
    );
}
