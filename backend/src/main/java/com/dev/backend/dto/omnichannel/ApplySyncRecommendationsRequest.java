package com.dev.backend.dto.omnichannel;

import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApplySyncRecommendationsRequest {
    private List<Item> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Item {
        private Integer mappingId;
        private Integer bufferPercent;
        private Integer realtimeThreshold;
    }
}

