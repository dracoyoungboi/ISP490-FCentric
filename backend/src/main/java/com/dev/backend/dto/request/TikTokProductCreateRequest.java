package com.dev.backend.dto.request;

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
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TikTokProductCreateRequest implements Serializable {

    @JsonProperty("title")
    String title;

    @JsonProperty("description")
    String description;

    @JsonProperty("category_id")
    String categoryId;

    @JsonProperty("brand_id")
    String brandId;

    @JsonProperty("main_images")
    List<ImageUri> mainImages;

    @JsonProperty("package_weight")
    String packageWeight;

    @JsonProperty("package_dimensions")
    PackageDimensions packageDimensions;

    @JsonProperty("skus")
    List<CreateSku> skus;

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class ImageUri implements Serializable {
        @JsonProperty("uri")
        String uri;
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class PackageDimensions implements Serializable {
        @JsonProperty("length")
        String length;

        @JsonProperty("width")
        String width;

        @JsonProperty("height")
        String height;
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class CreateSku implements Serializable {
        @JsonProperty("seller_sku")
        String sellerSku;

        @JsonProperty("price")
        SkuPrice price;

        @JsonProperty("inventory")
        List<SkuInventoryQuantity> inventory;
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class SkuPrice implements Serializable {
        @JsonProperty("amount")
        String amount;

        @JsonProperty("currency")
        String currency;
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class SkuInventoryQuantity implements Serializable {
        @JsonProperty("warehouse_id")
        String warehouseId;

        @JsonProperty("quantity")
        Integer quantity;
    }
}

