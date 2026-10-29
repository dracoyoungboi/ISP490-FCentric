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
public class TikTokProductSearchResponse implements Serializable {

    @JsonProperty("code")
    Integer code;

    @JsonProperty("message")
    String message;

    @JsonProperty("request_id")
    String requestId;

    @JsonProperty("data")
    ProductSearchData data;

    public List<TikTokProductDto> getProducts() {
        return data != null ? data.getProducts() : null;
    }

    public String getNextPageToken() {
        return data != null ? data.getNextPageToken() : null;
    }

    public Integer getTotalCount() {
        return data != null ? data.getTotalCount() : null;
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ProductSearchData implements Serializable {
        @JsonProperty("products")
        List<TikTokProductDto> products;

        @JsonProperty("next_page_token")
        String nextPageToken;

        @JsonProperty("total_count")
        Integer totalCount;
    }
}
