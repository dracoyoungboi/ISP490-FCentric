package com.dev.backend.dto.response.customize;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;
import java.util.List;

/**
 * Đơn hàng TikTok Shop Open API v202309.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonIgnoreProperties(ignoreUnknown = true)
public class TikTokOrderDto implements Serializable {

    @JsonProperty("id")
    String id;

    @JsonProperty("status")
    String status;

    @JsonProperty("create_time")
    Long createTime;

    @JsonProperty("update_time")
    Long updateTime;

    @JsonProperty("paid_time")
    Long paidTime;

    @JsonProperty("buyer_uid")
    String buyerUid;

    @JsonProperty("buyer_message")
    String buyerMessage;

    @JsonProperty("cancel_reason")
    String cancelReason;

    @JsonProperty("cancel_user")
    String cancelUser;

    @JsonProperty("is_on_hold")
    Boolean isOnHold;

    @JsonProperty("tracking_number")
    String trackingNumber;

    @JsonProperty("shipping_provider")
    String shippingProvider;

    @JsonProperty("payment_method_name")
    String paymentMethodName;

    @JsonProperty("total_amount")
    String totalAmount;

    @JsonProperty("shipping_fee")
    String shippingFee;

    @JsonProperty("recipient_address")
    TikTokRecipientAddressDto recipientAddress;

    @JsonProperty("line_items")
    List<TikTokOrderItemDto> lineItems;

    /**
     * Kiểm tra xem đơn hàng có yêu cầu hủy từ phía người mua hay không.
     */
    public boolean laYeuCauHuy() {
        return (cancelReason != null && !cancelReason.isBlank())
                || "BUYER".equalsIgnoreCase(cancelUser)
                || Boolean.TRUE.equals(isOnHold);
    }
}
