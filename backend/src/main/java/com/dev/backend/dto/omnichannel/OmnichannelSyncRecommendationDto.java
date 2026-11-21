package com.dev.backend.dto.omnichannel;

import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OmnichannelSyncRecommendationDto {
    private int observationDays;
    private List<ItemDto> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ItemDto {
        private Integer mappingId;
        private Integer bienTheSanPhamId;
        private String maSku;
        private String tenSanPham;
        private String tenMau;
        private String tenSize;
        private Integer kenhBanId;
        private String maKenh;
        private String tenKenh;
        private String platformCode;
        private String abcClass;
        private String appliedPreset;
        private long revenueN;
        private double revenueSharePercent;
        private long ftu;
        private long posSoldN;
        private long onlineSoldN;
        private long totalSoldN;
        private double avgDailySales;
        private double rPos;
        private Integer currentBufferPercent;
        private int recommendedBufferPercent;
        private Integer currentRealtimeThreshold;
        private int recommendedRealtimeThreshold;
        private long currentPublishedQty;
        private long recommendedPublishedQty;
        private boolean needsAdjustment;
    }
}

