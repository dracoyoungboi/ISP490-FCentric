import PrintRoutePage from "@/components/print/PrintRoutePage";
import { toPosReturnPrintModel } from "@/components/print/adapters/posReturnPrintAdapter";
import { traHangService } from "@/services/traHangService";
import { t } from "@/i18n";

/**
 * In biên bản trả hàng 02 liên (đặc tả BA bước 5.5) bằng khung in chung của hệ thống: đầu trang theo Thông tin cửa
 * hàng, khổ giấy và các mục bật/tắt theo Cấu hình › Mẫu in › Biên bản trả hàng (mặc định A5). Mở ngay sau khi xác nhận
 * trả hàng nên tự mở hộp in một lần.
 */
// i18n-giu-nguyen: nhãn liên in trên giấy (mẫu in giữ tiếng Việt)
const LIEN = ["1 · Giao khách hàng giữ", "2 · Lưu quầy, kẹp hóa đơn gốc"];

export default function PosReturnPrintPage() {
    return (
        <PrintRoutePage
            autoPrint
            adapter={toPosReturnPrintModel}
            backPath="/pos/returns"
            copies={LIEN}
            documentType="pos_return"
            fetcher={(id) => traHangService.phieu(id)}
            loadingLabel={t("Đang tải biên bản")}
            notFoundDescription={t("Phiếu có thể đã bị xóa hoặc bạn không có quyền truy cập.")}
            notFoundTitle={t("Không tìm thấy phiếu trả hàng")}
            titleFallback={t("In biên bản trả hàng")}
        />
    );
}
