package com.dev.backend.dto.response.customize;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

/**
 * Chi tiết dòng hàng (item / SKU) trong đơn hàng TikTok Shop v202309.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonIgnoreProperties(ignoreUnknown = true)
public class TikTokOrderItemDto implements Serializable {

    @JsonProperty("id")
    String id;

    @JsonProperty("sku_id")
    String skuId;

    @JsonProperty("seller_sku")
    String sellerSku;

    @JsonProperty("product_name")
    String productName;

    @JsonProperty("sku_name")
    String skuName;

    @JsonProperty("quantity")
    Integer quantity;

    @JsonProperty("sale_price")
    String salePrice;

    @JsonProperty("original_price")
    String originalPrice;
}
