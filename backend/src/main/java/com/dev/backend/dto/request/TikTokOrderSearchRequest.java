package com.dev.backend.dto.request;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

/**
 * Payload tìm kiếm đơn hàng TikTok Shop Open API v202309.
 * Endpoint: POST /order/202309/orders/search
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TikTokOrderSearchRequest implements Serializable {

    @JsonProperty("order_status")
    String orderStatus;

    @JsonProperty("buyer_user_id")
    String buyerUserId;

    @JsonProperty("create_time_from")
    Long createTimeFrom;

    @JsonProperty("create_time_to")
    Long createTimeTo;

    @JsonProperty("update_time_from")
    Long updateTimeFrom;

    @JsonProperty("update_time_to")
    Long updateTimeTo;

    @JsonProperty("page_size")
    Integer pageSize;

    @JsonProperty("page_token")
    String pageToken;
}
