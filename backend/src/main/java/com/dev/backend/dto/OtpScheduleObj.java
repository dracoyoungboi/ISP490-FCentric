package com.dev.backend.dto;

import com.dev.backend.constant.enums.OtpType;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

// KHÔNG override equals/hashCode theo email: trước đây set coi 2 OTP cùng email là trùng
// nên mã gửi lại bị bỏ qua (server giữ mã cũ, email gửi mã mới). So sánh theo đối tượng.
@FieldDefaults(level = AccessLevel.PRIVATE)
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class OtpScheduleObj {

    String email;
    String otp;
    OtpType type;
    @Builder.Default
    Instant createdAt = Instant.now();
    // số lần nhập sai mã (dùng cho giới hạn thử lại khi đặt lại mật khẩu)
    @Builder.Default
    AtomicInteger failedAttempts = new AtomicInteger();
    // Mã xác nhận báo giá (SUPPLIER_MAIL_SIGN_KEY) gắn với một đơn mua: mã của đơn A không mở được đơn B.
    // Loại mã khác để null.
    Integer donMuaHangId;
}
