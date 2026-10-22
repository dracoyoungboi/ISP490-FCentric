package com.dev.backend.dto.response.congncc;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.time.Instant;

/** Kết quả POST /xac-nhan-otp. phienBaoGia gửi lại trong header X-Phien-Bao-Gia khi báo giá. */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class XacNhanMaNccDto implements Serializable {
    DonMuaHangCongNccDto donMua;
    String phienBaoGia;
    Instant hetHanPhien;
    CuaHangCongDto cuaHang;
}
