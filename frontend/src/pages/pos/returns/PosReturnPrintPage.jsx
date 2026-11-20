import PrintRoutePage from "@/components/print/PrintRoutePage";
import { NGUON_IN_BIEN_BAN_TRA } from "@/components/in-tai-cho/nguonIn";
import { t } from "@/i18n";

/**
 * Trang in biên bản trả hàng 02 liên bằng khung in chung của hệ thống (đường dẫn trực tiếp, in lại từ đường dẫn cũ).
 * Màn trả hàng tại quầy in tại chỗ bằng useInTaiCho với cùng nguồn NGUON_IN_BIEN_BAN_TRA, không mở trang này.
 */
export default function PosReturnPrintPage() {
    return (
        <PrintRoutePage
            {...NGUON_IN_BIEN_BAN_TRA}
            backPath="/pos/returns"
            loadingLabel={t("Đang tải biên bản")}
            notFoundDescription={t("Phiếu có thể đã bị xóa hoặc bạn không có quyền truy cập.")}
            notFoundTitle={t("Không tìm thấy phiếu trả hàng")}
            titleFallback={t("In biên bản trả hàng")}
        />
    );
}
