import PrintRoutePage from "@/components/print/PrintRoutePage";
import { NGUON_IN_PHIEU_XUAT } from "@/components/in-tai-cho/nguonIn";
import { t } from "@/i18n";

/**
 * Trang in thật của phiếu xuất kho — dữ liệu API thật (phiếu + lô đã nhặt / tên lô, xem NGUON_IN_PHIEU_XUAT)
 * + mẫu đang hoạt động của goods_issue. Lỗi tải lô chặn in, hiện nút "Thử lại".
 */
export default function PhieuXuatKhoPrint() {
    return (
        <PrintRoutePage
            {...NGUON_IN_PHIEU_XUAT}
            backPath="/goods-issues/:id"
            loadingLabel={t("Đang tải dữ liệu phiếu xuất kho")}
            titleFallback={t("In phiếu xuất kho")}
            notFoundTitle={t("Không tìm thấy phiếu xuất kho")}
            notFoundDescription={t("Phiếu có thể đã bị xóa hoặc bạn không có quyền truy cập.")}
        />
    );
}
