package com.dev.backend.dto.response.customize;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
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

    @JsonProperty("estimated_shipping_fee")
    Double estimatedShippingFee;

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

    @JsonProperty("location_id")
    String locationId;

    @JsonProperty("recipient_address")
    ShopeeRecipientAddressDto recipientAddress;

    @JsonProperty("item_list")
    List<ShopeeOrderItemDto> itemList;

    @JsonProperty("package_list")
    List<ShopeePackageDto> packageList;

    /** Mã chia chọn tuyến (first_recipient_sort_code) làm giàu từ get_shipping_document_data_info. */
    @JsonIgnore
    String maDinhTuyen;

    /** Mã trạm phát / khu vực (second/third_recipient_sort_code) làm giàu từ get_shipping_document_data_info. */
    @JsonIgnore
    String maTramPhat;

    /** Cờ COD thật từ Shopee get_shipping_document_data_info. */
    @JsonIgnore
    Boolean codFlag;

    /** Số tiền thu hộ COD thực tế từ Shopee get_shipping_document_data_info. */
    @JsonIgnore
    BigDecimal codAmount;

    /** Lấy package_number hợp lệ đầu tiên trong package_list của đơn Shopee. */
    public String resolveFirstPackageNumber() {
        if (packageList == null) {
            return null;
        }
        for (ShopeePackageDto pkg : packageList) {
            if (pkg != null && pkg.getPackageNumber() != null && !pkg.getPackageNumber().isBlank()) {
                return pkg.getPackageNumber().trim();
            }
        }
        return null;
    }

    /** Lấy tên đơn vị vận chuyển ưu tiên ở cấp đơn, dự phòng từ package_list. */
    public String resolveShippingCarrier() {
        if (shippingCarrier != null && !shippingCarrier.isBlank()) {
            return shippingCarrier.trim();
        }
        if (packageList != null) {
            for (ShopeePackageDto pkg : packageList) {
                if (pkg != null && pkg.getShippingCarrier() != null && !pkg.getShippingCarrier().isBlank()) {
                    return pkg.getShippingCarrier().trim();
                }
            }
        }
        return null;
    }

    /** Lấy location_id định tuyến kho từ cấp đơn hoặc dòng hàng đầu tiên của Shopee (MWH: location_id / model_location_id). */
    public String resolveLocationId() {
        if (locationId != null && !locationId.isBlank()) {
            return locationId.trim();
        }
        if (itemList != null) {
            for (ShopeeOrderItemDto item : itemList) {
                if (item != null && item.getLocationId() != null && !item.getLocationId().isBlank()) {
                    return item.getLocationId().trim();
                }
                if (item != null && item.getModelLocationId() != null && !item.getModelLocationId().isBlank()) {
                    return item.getModelLocationId().trim();
                }
            }
        }
        return null;
    }

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

        @JsonProperty("location_id")
        String locationId;

        @JsonProperty("model_location_id")
        String modelLocationId;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ShopeePackageDto {
        @JsonProperty("package_number")
        String packageNumber;

        @JsonProperty("shipping_carrier")
        String shippingCarrier;

        @JsonProperty("logistics_status")
        String logisticsStatus;
    }
}

