package com.dev.backend.constant.variables;

import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Hằng số + quy tắc validate cho cấu hình mẫu in.
 * Registry mẫu nằm ở frontend (printSchemas.js) — backend chỉ chấp nhận
 * templateId khớp pattern "<documentType>_default_(A4|A5|K80)" hoặc đã
 * tồn tại trong bảng cau_hinh_mau_in, và paperSize phải khớp hậu tố
 * của templateId (chặn việc A5 bị lưu dưới id A4).
 */
public interface IPrintTemplateConfig {

    List<String> PRINT_DOCUMENT_TYPES = List.of(
            "purchase_request",
            "quotation_request",
            "purchase_order",
            "goods_receipt",
            "goods_issue",
            "sales_quotation",
            "sales_invoice"
    );

    Set<String> PAPER_SIZES = Set.of("A4", "A5", "K80");
    Set<String> ORIENTATIONS = Set.of("portrait", "landscape");
    Set<String> MARGINS = Set.of("narrow", "default", "wide");

    String DEFAULT_LOGO_PATH = "/branding/f-centric-icon.svg";

    /** templateId hợp lệ theo registry frontend: <documentType>_default_<khổ giấy>. */
    static boolean isRegistryTemplateId(String documentType, String templateId) {
        if (templateId == null) return false;
        return templateId.matches(Pattern.quote(documentType) + "_default_(A4|A5|K80)");
    }

    /** templateId mặc định của một loại chứng từ khi không có lựa chọn nào khác. */
    static String defaultTemplateId(String documentType) {
        return documentType + "_default_A4";
    }
}
