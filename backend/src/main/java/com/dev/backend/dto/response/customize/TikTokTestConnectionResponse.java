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
public class TikTokTestConnectionResponse implements Serializable {

    boolean connected;
    String shopId;
    String shopName;
    String region;
    String sellerType;
    String cipher;
    String message;

    // Các trường tương thích chuẩn hiển thị giao diện đa kênh FCentric
    String tenGianHang;
    String shopIdSan;
    String hanKhoa;
}
