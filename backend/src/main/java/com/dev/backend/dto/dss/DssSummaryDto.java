package com.dev.backend.dto.dss;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DssSummaryDto {
    private int totalSkus;
    private int criticalCount;
    private int highCount;
    private int normalCount;
    private int phaseOutOrExcessCount;
    private int needReorderCount;
    private long totalSuggestedQty;
    private int classACount;
    private int classBCount;
    private int classCCount;
    private int alertedInCanhBaoCount;
}

