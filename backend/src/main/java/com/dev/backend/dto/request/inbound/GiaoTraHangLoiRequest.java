package com.dev.backend.dto.request.inbound;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

/**
 * Kho ghi hàng lỗi đã rời kho theo lựa chọn của nhà cung cấp: giao trả ({@code cachGiao} NCC_LAY / VAN_CHUYEN) hoặc
 * tiêu hủy (chỉ dùng {@code thoiDiem}, {@code ghiChu}; người đồng ý lấy từ câu trả lời của nhà cung cấp trên cổng).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GiaoTraHangLoiRequest {
    Instant thoiDiem;
    /** NCC_LAY | VAN_CHUYEN (bỏ qua khi tiêu hủy). */
    String cachGiao;
    /** Người nhận / đơn vị vận chuyển. */
    String nguoiNhan;
    String maVanDon;
    String ghiChu;
}
