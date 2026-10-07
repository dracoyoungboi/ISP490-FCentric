package com.dev.backend.dto.response.entities;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.math.BigDecimal;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@EqualsAndHashCode(of = {"id"})
public class ChiTietNhatHangDto implements Serializable {
    Integer id;
    Integer bienTheSanPhamId;
    String maSku;
    String maVachSku;
    String viTriKho;
    String tenSanPham;
    String tenMau;
    String maMauHex;
    String tenSize;
    String tenChatLieu;
    String anhBienTheUrl;
    BigDecimal soLuongCanNhat;
    BigDecimal soLuongDaQuet;
}

