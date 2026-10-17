package com.dev.backend.dto.request;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;
import lombok.experimental.FieldDefaults;
import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class KhaiBaoLoRequest {
    Integer bienTheSanPhamId;
    String maLo;
    @JsonFormat(
            shape = JsonFormat.Shape.STRING,
            pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSX",
            timezone = "UTC"
    )
    Instant ngaySanXuat;
    BigDecimal soLuongNhap;
    Integer viTriKhoId;
    BigDecimal soLuongLoi;
    String lyDoLoi;
    BigDecimal giaVon;
    String ghiChu;
}
