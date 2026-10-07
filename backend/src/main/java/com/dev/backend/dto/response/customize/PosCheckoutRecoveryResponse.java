package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Kết quả phục hồi yêu cầu checkout: SUCCESS kèm kết quả đã lưu (chính xác bản
 * gốc), FAILED kèm thông điệp lỗi xác định. Không tìm thấy = kết quả chưa rõ
 * (client được phép thử lại cùng requestId + cùng payload).
 */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PosCheckoutRecoveryResponse {
    String requestId;
    String trangThai;
    PosCheckoutResponse result;
    String errorMessage;
}
