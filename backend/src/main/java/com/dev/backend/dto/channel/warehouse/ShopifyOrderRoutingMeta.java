package com.dev.backend.dto.channel.warehouse;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * Snapshot gợi ý định tuyến kho và danh sách FulfillmentOrder của đơn hàng Shopify,
 * lưu làm metadata điều phối khi đơn đang ở trạng thái Nháp hoặc đang xử lý kho.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ShopifyOrderRoutingMeta implements Serializable {
    private static final long serialVersionUID = 1L;

    /** ID đơn hàng trên Shopify (numeric). */
    private String maDonHangKenh;

    /** ID kho FCentric được gợi ý từ Location trên Shopify (không ghi đè khoXuat ở trạng thái Nháp). */
    private Integer khoDeXuatId;

    /** Tên kho FCentric được gợi ý. */
    private String tenKhoDeXuat;

    /** Shopify Location ID gốc được sàn gán (numeric). */
    private String shopifyLocationId;

    /** Tên Location gốc trên Shopify. */
    private String shopifyLocationName;

    /** Phương thức giao hàng ưu tiên: SHIPPING, PICKUP, LOCAL, ... */
    private String deliveryMethodType;

    /** true nếu đơn hàng trên Shopify tách thành >= 2 FulfillmentOrders mở. */
    private boolean splitMultiLocation;

    /** Thời điểm cập nhật (epoch seconds) phục vụ dọn dẹp các đơn cũ. */
    private long updatedAtEpochSec;

    @Builder.Default
    private List<FulfillmentOrderSnapshot> fulfillmentOrders = new ArrayList<>();

    /** Trạng thái từng FulfillmentOrder đọc từ GraphQL Shopify. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class FulfillmentOrderSnapshot implements Serializable {
        private static final long serialVersionUID = 1L;

        /** Shopify GID hoặc numeric ID của FulfillmentOrder. */
        private String id;
        private String status;
        private String assignedLocationId;
        private String assignedLocationName;
        private String deliveryMethodType;
        @Builder.Default
        private List<String> skus = new ArrayList<>();
    }
}
