package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

/** Trang Đặt mật khẩu mở ra: kiểm mã trong liên kết (không tiêu mã). */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class KiemTraLienKetMatKhauRequest {
    String ma;

    @Override
    public String toString() {
        return "KiemTraLienKetMatKhauRequest[ma=***]";
    }
}
