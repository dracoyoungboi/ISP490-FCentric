package com.dev.backend.dto.dss;

import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DssReplenishmentResponse {
    private Integer khoId;
    private String tenKho;
    private boolean laKhoTong;
    private DssConfigDto config;
    private DssSummaryDto summary;
    private String calculatedAt;
    private List<DssRecommendationItemDto> items;
}

