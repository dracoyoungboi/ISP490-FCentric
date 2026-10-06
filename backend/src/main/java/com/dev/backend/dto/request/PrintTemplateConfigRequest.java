package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.Map;

/**
 * Cấu hình mẫu in gửi lên từ editor (không gồm id/documentType —
 * chúng nằm trên path). branding = bật/tắt logo/tên công ty/email/ĐT/địa chỉ;
 * sections = bật/tắt section/field theo schema; columns = bật/tắt cột bảng.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PrintTemplateConfigRequest {
    String name;
    String paperSize;
    String orientation;
    String margin;
    String accentColor;
    Map<String, Boolean> branding;
    Map<String, Object> sections;
    Map<String, Boolean> columns;
}
