package com.dev.backend.dto.response.customize;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.util.List;

@AllArgsConstructor
@Getter
@Setter
@NoArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TikTokAuthorizedShopsResponse implements Serializable {

    @JsonProperty("code")
    Integer code;

    @JsonProperty("message")
    String message;

    @JsonProperty("request_id")
    String requestId;

    @JsonProperty("data")
    ShopData data;

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ShopData implements Serializable {
        @JsonProperty("shops")
        List<TikTokShopDto> shops;
    }
}
