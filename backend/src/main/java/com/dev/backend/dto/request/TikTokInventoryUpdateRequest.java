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
public class TikTokInventoryUpdateRequest implements Serializable {

    @JsonProperty("skus")
    List<SkuInventory> skus;

    @JsonProperty("sku_warehouse_stock_update_mode")
    String skuWarehouseStockUpdateMode;

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SkuInventory implements Serializable {
        @JsonProperty("id")
        String id;

        @JsonProperty("inventory")
        List<WarehouseQuantity> inventory;

        @JsonProperty("unlink_warehouse_ids")
        List<String> unlinkWarehouseIds;
    }

    @AllArgsConstructor
    @Getter
    @Setter
    @NoArgsConstructor
    @Builder
    @FieldDefaults(level = AccessLevel.PRIVATE)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WarehouseQuantity implements Serializable {
        @JsonProperty("warehouse_id")
        String warehouseId;

        @JsonProperty("quantity")
        Integer quantity;
    }
}
