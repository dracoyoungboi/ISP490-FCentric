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
public class ShopifyTestConnectionResponse implements Serializable {

    boolean connected;
    String shopName;
    String shopEmail;
    String myshopifyDomain;
    String message;
}

