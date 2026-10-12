package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

@FieldDefaults(level = AccessLevel.PRIVATE)
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class OtpDonMuaHangGetting {
    Integer donMuaHangId;
    String email;
    // Mã đơn (VD: PO202610115101) khi nhà cung cấp tự nhập ở trang đăng nhập; dùng thay cho donMuaHangId
    String soDonMua;
}
