package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

/** Đặt mật khẩu bằng liên kết trong email: mã trong liên kết + mật khẩu mới (giữ nguyên như người dùng gõ). */
@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class DatMatKhauQuaLienKetRequest {
    String ma;
    String matKhauMoi;

    @Override
    public String toString() {
        return "DatMatKhauQuaLienKetRequest[ma=***, matKhauMoi=***]";
    }
}
