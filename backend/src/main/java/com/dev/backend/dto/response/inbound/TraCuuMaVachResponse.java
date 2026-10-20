package com.dev.backend.dto.response.inbound;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TraCuuMaVachResponse {
    Boolean timThay;
    String loaiMa; // "FCENTRIC", "NCC", "LA"
    Integer bienTheSanPhamId;
    String sku;
    String tenBienThe;
    String barcode;
    Boolean canMapNhanh;
    String mauSac;
    String kichCo;
}

