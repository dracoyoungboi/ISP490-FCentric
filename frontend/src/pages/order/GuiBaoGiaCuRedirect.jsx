import { Navigate, useParams } from "react-router-dom";

/**
 * Đường dẫn cũ /purchase-requests/:id/gui-bao-gia (trang SendQuotationRequest đã bỏ: gọi API cũ đã hỏng và không có
 * khung chặn khi thiếu thông tin cửa hàng) → trang Gửi yêu cầu báo giá hiện tại của cùng yêu cầu.
 */
export default function GuiBaoGiaCuRedirect() {
  const { id } = useParams();
  return <Navigate to={`/purchase-requests/${id}/send-quotation`} replace />;
}
