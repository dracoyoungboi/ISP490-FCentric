package com.dev.backend.dto.response.customize;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

/**
 * Thông tin chi tiết thanh toán của đơn hàng TikTok Shop Open API v202309.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonIgnoreProperties(ignoreUnknown = true)
public class TikTokPaymentDto implements Serializable {

    @JsonProperty("currency")
    String currency;

    @JsonProperty("sub_total")
    String subTotal;

    @JsonProperty("shipping_fee")
    String shippingFee;

    @JsonProperty("seller_discount")
    String sellerDiscount;

    @JsonProperty("platform_discount")
    String platformDiscount;

    @JsonProperty("total_amount")
    String totalAmount;

    @JsonProperty("original_total_product_price")
    String originalTotalProductPrice;

    @JsonProperty("original_shipping_fee")
    String originalShippingFee;
}

