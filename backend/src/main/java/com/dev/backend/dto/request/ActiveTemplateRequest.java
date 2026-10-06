package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

/** Đặt mẫu đang áp dụng cho một loại chứng từ. */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ActiveTemplateRequest {
    String templateId;
}
