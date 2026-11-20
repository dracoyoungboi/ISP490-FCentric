import { useSearchParams } from "react-router-dom";
import PrintRoutePage from "@/components/print/PrintRoutePage";
import { NGUON_IN_HOA_DON, NGUON_IN_HOA_DON_TAI_QUAY } from "@/components/in-tai-cho/nguonIn";
import { t } from "@/i18n";

/** `?mau=tai-quay`: in bằng mẫu hóa đơn tại quầy (khổ nhiệt) thay cho mẫu in từ đơn bán. */
const MAU_HOA_DON_TAI_QUAY = "tai-quay";

/**
 * Trang in thật của hóa đơn bán hàng — dữ liệu API thật
 * (`GET /api/v1/don-ban-hang/{id}/detail`, cùng service với DonBanHangDetail).
 * Mẫu đang hoạt động: `sales_invoice` (A4 / A5) khi in từ trang đơn bán; `pos_invoice` (K80 / K57) khi in lại đơn
 * bán tại quầy (màn bán hàng in tại chỗ bằng useInTaiCho, không mở trang này).
 */
export default function DonBanHangInvoice() {
    const [searchParams] = useSearchParams();
    const taiQuay = searchParams.get("mau") === MAU_HOA_DON_TAI_QUAY;
    return (
        <PrintRoutePage
            {...(taiQuay ? NGUON_IN_HOA_DON_TAI_QUAY : NGUON_IN_HOA_DON)}
            backPath="/sales-orders/:id"
            loadingLabel={t("Đang tải dữ liệu hóa đơn")}
            titleFallback={t("In hóa đơn bán hàng")}
            notFoundTitle={t("Không tìm thấy hóa đơn")}
            notFoundDescription={t("Đơn bán hàng có thể đã bị xóa hoặc bạn không có quyền truy cập.")}
        />
    );
}
