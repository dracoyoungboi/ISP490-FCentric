import PrintRoutePage from "@/components/print/PrintRoutePage";
import { NGUON_IN_BIEN_BAN_TRA } from "@/components/in-tai-cho/nguonIn";
import { t } from "@/i18n";

/**
 * In biên bản trả hàng 02 liên bằng khung in chung của hệ thống (nguồn NGUON_IN_BIEN_BAN_TRA). Mở ngay sau khi xác
 * nhận trả hàng nên tự mở hộp in một lần.
 */
export default function PosReturnPrintPage() {
    return (
        <PrintRoutePage
            {...NGUON_IN_BIEN_BAN_TRA}
            autoPrint
            backPath="/pos/returns"
            loadingLabel={t("Đang tải biên bản")}
            notFoundDescription={t("Phiếu có thể đã bị xóa hoặc bạn không có quyền truy cập.")}
            notFoundTitle={t("Không tìm thấy phiếu trả hàng")}
            titleFallback={t("In biên bản trả hàng")}
        />
    );
}
