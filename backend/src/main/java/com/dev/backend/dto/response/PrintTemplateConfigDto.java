package com.dev.backend.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.Map;

/** Cấu hình mẫu in đã lưu trả về cho frontend. */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PrintTemplateConfigDto {
    String documentType;
    String templateId;
    String name;
    String paperSize;
    String orientation;
    String margin;
    String accentColor;
    Map<String, Boolean> branding;
    Map<String, Object> sections;
    Map<String, Boolean> columns;
    Integer version;
    Instant ngayCapNhat;
}
