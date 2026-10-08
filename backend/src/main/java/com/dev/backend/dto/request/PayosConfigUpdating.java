package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Cập nhật cấu hình payOS. Trường khóa để trống (null/"") = GIỮ khóa đang lưu,
 * nên admin có thể bật/tắt hay đổi thời gian hết hạn mà không phải nhập lại khóa.
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PayosConfigUpdating {
    String clientId;
    String apiKey;
    String checksumKey;
    Boolean kichHoat;
    Integer thoiGianHetHanPhut;
    String webhookUrl;
}
