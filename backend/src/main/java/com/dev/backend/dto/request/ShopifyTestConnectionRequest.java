package com.dev.backend.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShopifyTestConnectionRequest implements Serializable {

    String shopDomain;
    /**
     * Token để test. Nếu để trống, hệ thống sẽ sử dụng token đã lưu trong DB để test.
     */
    String accessToken;
}

