package com.dev.backend.dto.response.customize;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TikTokShopDto implements Serializable {

    @JsonProperty("id")
    String id;

    @JsonProperty("name")
    String name;

    @JsonProperty("region")
    String region;

    @JsonProperty("seller_type")
    String sellerType;

    @JsonProperty("cipher")
    String cipher;

    @JsonProperty("code")
    String code;
}
