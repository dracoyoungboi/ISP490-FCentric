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
public class TikTokSkuDto implements Serializable {

    @JsonProperty("id")
    String id;

    @JsonProperty("seller_sku")
    String sellerSku;

    @JsonProperty("price")
    Price price;

    @JsonProperty("inventory")
    List<Inventory> inventory;

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Price implements Serializable {
        @JsonProperty("currency")
        String currency;

        @JsonProperty("tax_exclusive_price")
        String taxExclusivePrice;
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Inventory implements Serializable {
        @JsonProperty("warehouse_id")
        String warehouseId;

        @JsonProperty("quantity")
        Integer quantity;
    }
}
