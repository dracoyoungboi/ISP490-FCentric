package com.dev.backend.dto.response.customize;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.util.List;

/**
 * Phản hồi tìm kiếm danh sách đơn hàng từ TikTok Shop API v202309.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonIgnoreProperties(ignoreUnknown = true)
public class TikTokOrderSearchResponse implements Serializable {

    @JsonProperty("code")
    Integer code;

    @JsonProperty("message")
    String message;

    @JsonProperty("request_id")
    String requestId;

    @JsonProperty("data")
    OrderSearchData data;

    public List<TikTokOrderDto> getOrders() {
        return data != null ? data.getOrders() : null;
    }

    public String getNextPageToken() {
        return data != null ? data.getNextPageToken() : null;
    }

    public Integer getTotalCount() {
        return data != null ? data.getTotalCount() : null;
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class OrderSearchData implements Serializable {
        @JsonProperty("orders")
        List<TikTokOrderDto> orders;

        @JsonProperty("next_page_token")
        String nextPageToken;

        @JsonProperty("total_count")
        Integer totalCount;
    }
}
