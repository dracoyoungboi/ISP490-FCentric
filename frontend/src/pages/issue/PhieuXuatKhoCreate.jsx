import { Navigate, useSearchParams } from "react-router-dom";

/**
 * Đường dẫn cũ /goods-issues/create (tạo phiếu xuất chuyển kho tay từ yêu cầu đã duyệt). Nay không tạo phiếu xuất tay:
 * phiếu xuất PX-CK sinh khi Quản lý Kho tổng duyệt phiếu chuyển (đặc tả BA), phiếu xuất bán sinh khi nhặt xong.
 * Liên kết cũ có ?transferId= mở phiếu chuyển đó; còn lại về danh sách phiếu xuất kho.
 */
export default function PhieuXuatKhoCreate() {
    const [searchParams] = useSearchParams();
    const transferId = searchParams.get("transferId");
    return <Navigate to={/^\d+$/.test(transferId ?? "") ? `/transfer-tickets/${transferId}` : "/goods-issues"} replace />;
}
