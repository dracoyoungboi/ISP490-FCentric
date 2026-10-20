package com.dev.backend.constant.variables;

import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Hằng số + quy tắc validate cho cấu hình mẫu in.
 * Registry mẫu nằm ở frontend (printSchemas.js) — backend chỉ cho lưu / kích
 * hoạt templateId mà frontend in được (isFrontendTemplateId: chứng từ khổ tờ
 * A4/A5, hóa đơn tại quầy K80/K57), và paperSize phải khớp hậu tố của
 * templateId (chặn việc A5 bị lưu dưới id A4).
 */
public interface IPrintTemplateConfig {

    List<String> PRINT_DOCUMENT_TYPES = List.of(
            "purchase_request",
            "quotation_request",
            "purchase_order",
            "goods_receipt",
            "goods_issue",
            "sales_quotation",
            "sales_invoice",
            // Hóa đơn bán hàng in tại quầy (máy in nhiệt K80/K57) — mẫu riêng để đơn bán in A4/A5 không đổi theo
            "pos_invoice"
    );

    Set<String> PAPER_SIZES = Set.of("A4", "A5", "K80", "K57");

    /** Khổ giấy nhiệt (máy in hóa đơn) — luôn in khổ dọc. */
    Set<String> THERMAL_PAPER_SIZES = Set.of("K80", "K57");

    /** Loại chứng từ chỉ in khổ nhiệt: mẫu mặc định là K80 thay vì A4. */
    Set<String> THERMAL_ONLY_DOCUMENT_TYPES = Set.of("pos_invoice");
    Set<String> ORIENTATIONS = Set.of("portrait", "landscape");
    Set<String> MARGINS = Set.of("narrow", "default", "wide");

    String DEFAULT_LOGO_PATH = "/branding/f-centric-icon.svg";

    /**
     * Tùy chỉnh không thuộc section nào nằm ở sections._tuyChinh (khớp printSchemas.js / cauHinhMauIn.js
     * ở frontend): loiChanPhieu (lời chân), tieuDe (tên chứng từ tự đặt), coChu (cỡ chữ), maSoPhieu
     * (mã vạch / QR của số phiếu), nhan (nhãn tự đặt: "<section>.<mục>" -> nhãn). Thiếu khóa = mặc định.
     */
    String CUSTOM_SECTION_KEY = "_tuyChinh";
    Set<String> CUSTOM_OPTION_KEYS = Set.of("loiChanPhieu", "tieuDe", "coChu", "maSoPhieu", "nhan");
    Set<String> FONT_SIZES = Set.of("nho", "vua", "lon");
    Set<String> DOC_CODE_MODES = Set.of("khong", "ma_vach", "ma_qr");
    int FOOTER_NOTE_MAX_LENGTH = 300;
    int TITLE_MAX_LENGTH = 100;
    int LABEL_MAX_LENGTH = 60;
    /** Khóa nhãn "<section>.<mục>": chữ, số, gạch dưới, đúng một dấu chấm. */
    Pattern LABEL_KEY = Pattern.compile("^[A-Za-z0-9_$]{1,50}\\.[A-Za-z0-9_$]{1,50}$");
    /** Số nhãn tự đặt tối đa của một mẫu (registry hiện có dưới 40 mục đổi tên được). */
    int MAX_CUSTOM_LABELS = 200;

    /** Số phiên bản gần nhất trả về cho ngăn "Lịch sử chỉnh sửa" của trình sửa mẫu in. */
    int HISTORY_LIMIT = 50;

    /**
     * templateId đúng DẠNG <documentType>_default_<khổ giấy> với mọi khổ (kể cả khổ loại chứng từ không
     * dùng). KHÔNG dùng để quyết định lưu / kích hoạt mẫu — dùng {@link #isFrontendTemplateId}.
     */
    static boolean isRegistryTemplateId(String documentType, String templateId) {
        if (templateId == null) return false;
        return templateId.matches(Pattern.quote(documentType) + "_default_(A4|A5|K80|K57)");
    }

    /**
     * templateId mà frontend thực sự dùng để in (khớp paperProfiles trong printSchemas.js): chứng từ khổ
     * tờ chỉ A4/A5, loại chỉ in nhiệt (hóa đơn tại quầy) chỉ K80/K57. Dòng cũ khác khổ còn trong DB
     * (vd. sales_invoice_default_K80 trước khi tách mẫu tại quầy) không bao giờ là mẫu đang in.
     */
    static boolean isFrontendTemplateId(String documentType, String templateId) {
        if (documentType == null || templateId == null) return false;
        Set<String> sizes = THERMAL_ONLY_DOCUMENT_TYPES.contains(documentType) ? THERMAL_PAPER_SIZES : Set.of("A4", "A5");
        for (String size : sizes) {
            if (templateId.equals(documentType + "_default_" + size)) return true;
        }
        return false;
    }

    /** templateId mặc định của một loại chứng từ khi không có lựa chọn nào khác. */
    static String defaultTemplateId(String documentType) {
        return documentType + (THERMAL_ONLY_DOCUMENT_TYPES.contains(documentType) ? "_default_K80" : "_default_A4");
    }
}
