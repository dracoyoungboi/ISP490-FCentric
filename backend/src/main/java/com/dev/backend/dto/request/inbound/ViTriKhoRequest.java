package com.dev.backend.dto.request.inbound;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ViTriKhoRequest {
    Integer khuVucId;
    String maViTri;
    String day;
    String hang;
    String tang;
    Integer sucChua;
    String trangThai;

    // Hỗ trợ sinh hàng loạt
    Integer hangTu;
    Integer hangDen;
    Integer tangTu;
    Integer tangDen;
}

