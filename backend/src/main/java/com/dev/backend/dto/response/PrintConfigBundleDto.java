package com.dev.backend.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.Map;

/**
 * Toàn bộ cấu hình mẫu in + bản đồ mẫu đang áp dụng
 * (documentType -> templateId). Nguồn sự thật duy nhất cho badge
 * "Đang áp dụng" và luồng in thật.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PrintConfigBundleDto {
    List<PrintTemplateConfigDto> configs;
    Map<String, String> active;
}
