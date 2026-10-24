package com.dev.backend.dto.response.customize;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LazadaTestConnectionResponse implements Serializable {

    boolean connected;
    String sellerId;
    String shopName;
    String shortCode;
    String country;
    String message;

    // Các trường tương thích chuẩn hiển thị giao diện đa kênh
    String tenGianHang;
    String shopIdSan;
    String hanKhoa;
}
