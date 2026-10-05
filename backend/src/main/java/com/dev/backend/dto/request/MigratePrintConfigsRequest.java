package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.Map;

/**
 * Payload migrate dữ liệu localStorage cũ (fcentric.printTemplateConfigs.v2)
 * lên server. configs: documentType -> (templateId -> config).
 * active: documentType -> templateId đang áp dụng (FE tính từ isDefault cũ).
 * Server CHỈ nhận dữ liệu của loại chứng từ chưa có cấu hình nào trên server
 * (không bao giờ ghi đè dữ liệu server bằng dữ liệu local).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MigratePrintConfigsRequest {
    Map<String, Map<String, PrintTemplateConfigRequest>> configs;
    Map<String, String> active;
}
