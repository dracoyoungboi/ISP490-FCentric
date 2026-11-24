package com.dev.backend.dto.dss;

import com.dev.backend.repository.DssReplenishmentRepository.KhoInfo;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DssReplenishmentResponse {
    public static final String SCOPE_ALL_WAREHOUSES = "ALL_WAREHOUSES";

    private Integer khoId;
    private String tenKho;
    private boolean laKhoTong;
    private String scope;
    private int includedWarehouseCount;
    private List<KhoInfo> includedWarehouses;
    private DssConfigDto config;
    private DssSummaryDto summary;
    private String calculatedAt;
    private List<DssRecommendationItemDto> items;
}

