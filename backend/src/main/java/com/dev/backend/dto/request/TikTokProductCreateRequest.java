package com.dev.backend.dto.request;

import com.fasterxml.jackson.annotation.JsonInclude;
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
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TikTokProductCreateRequest implements Serializable {

    @JsonProperty("title")
    String title;

    @JsonProperty("description")
    String description;

    @JsonProperty("category_id")
    String categoryId;

    @JsonProperty("category_version")
    @Builder.Default
    String categoryVersion = "v2";

    @JsonProperty("brand_id")
    String brandId;

    @JsonProperty("main_images")
    List<ImageUri> mainImages;

    @JsonProperty("package_weight")
    PackageWeight packageWeight;

    @JsonProperty("package_dimensions")
    PackageDimensions packageDimensions;

    @JsonProperty("product_attributes")
    List<ProductAttribute> productAttributes;

    @JsonProperty("size_chart")
    SizeChart sizeChart;

    @JsonProperty("skus")
    List<CreateSku> skus;

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonInclude(JsonInclude.Include.NON_NULL)
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
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PackageWeight implements Serializable {
        @JsonProperty("value")
        String value;

        @JsonProperty("unit")
        String unit; // "KILOGRAM", "GRAM"
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PackageDimensions implements Serializable {
        @JsonProperty("length")
        String length;

        @JsonProperty("width")
        String width;

        @JsonProperty("height")
        String height;

        @JsonProperty("unit")
        String unit; // "CENTIMETER"
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CreateSku implements Serializable {
        @JsonProperty("id")
        String id;

        @JsonProperty("seller_sku")
        String sellerSku;

        @JsonProperty("price")
        SkuPrice price;

        @JsonProperty("inventory")
        List<SkuInventoryQuantity> inventory;

        @JsonProperty("sales_attributes")
        List<SalesAttribute> salesAttributes;

        @JsonProperty("sku_img")
        ImageUri skuImg;
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SalesAttribute implements Serializable {
        @JsonProperty("id")
        String id;

        @JsonProperty("name")
        String name;

        @JsonProperty("value_id")
        String valueId;

        @JsonProperty("value_name")
        String valueName;

        @JsonProperty("custom_value")
        String customValue;

        @JsonProperty("sku_img")
        ImageUri skuImg;

        // Giữ tương thích ngược với code gọi attributeName / attributeId
        public static class SalesAttributeBuilder {
            public SalesAttributeBuilder attributeName(String attributeName) {
                this.name = attributeName;
                return this;
            }

            public SalesAttributeBuilder attributeId(String attributeId) {
                this.id = attributeId;
                return this;
            }
        }
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonInclude(JsonInclude.Include.NON_NULL)
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
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SkuInventoryQuantity implements Serializable {
        @JsonProperty("warehouse_id")
        String warehouseId;

        @JsonProperty("quantity")
        Integer quantity;
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ProductAttribute implements Serializable {
        @JsonProperty("id")
        String id;

        @JsonProperty("values")
        List<AttributeValue> values;
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AttributeValue implements Serializable {
        @JsonProperty("id")
        String id;

        @JsonProperty("name")
        String name;
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SizeChart implements Serializable {
        @JsonProperty("image")
        SizeChartImage image;

        @JsonProperty("template")
        SizeChartTemplate template;
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SizeChartImage implements Serializable {
        @JsonProperty("uri")
        String uri;
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SizeChartTemplate implements Serializable {
        @JsonProperty("id")
        String id;
    }
}
