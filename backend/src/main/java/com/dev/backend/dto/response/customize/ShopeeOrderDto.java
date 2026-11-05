package com.dev.backend.dto.response.customize;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShopeeOrderDto {

    @JsonProperty("order_sn")
    String orderSn;

    @JsonProperty("order_status")
    String orderStatus;

    @JsonProperty("create_time")
    Long createTime;

    @JsonProperty("update_time")
    Long updateTime;

    @JsonProperty("total_amount")
    Double totalAmount;

    @JsonProperty("actual_shipping_fee")
    Double actualShippingFee;

    @JsonProperty("payment_method")
    String paymentMethod;

    @JsonProperty("buyer_user_id")
    Long buyerUserId;

    @JsonProperty("cancel_reason")
    String cancelReason;

    @JsonProperty("cancel_user")
    String cancelUser;

    @JsonProperty("shipping_carrier")
    String shippingCarrier;

    @JsonProperty("tracking_number")
    String trackingNumber;

    @JsonProperty("recipient_address")
    ShopeeRecipientAddressDto recipientAddress;

    @JsonProperty("item_list")
    List<ShopeeOrderItemDto> itemList;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ShopeeRecipientAddressDto {
        String name;
        String phone;
        @JsonProperty("full_address")
        String fullAddress;
        String district;
        String city;
        String state;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ShopeeOrderItemDto {
        @JsonProperty("item_id")
        Long itemId;

        @JsonProperty("item_name")
        String itemName;

        @JsonProperty("item_sku")
        String itemSku;

        @JsonProperty("model_id")
        Long modelId;

        @JsonProperty("model_name")
        String modelName;

        @JsonProperty("model_sku")
        String modelSku;

        @JsonProperty("model_quantity_purchased")
        Integer modelQuantityPurchased;

        @JsonProperty("model_discounted_price")
        Double modelDiscountedPrice;
    }
}

