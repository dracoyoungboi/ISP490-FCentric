package com.dev.backend.dto.dss;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DssConfigUpdateRequest {
    private String mode;
    private String globalPresetCode;
    private Integer observationDaysN;
    private Double serviceLevelZ;
    private Integer cycleDaysT;
    private Integer peakGrowthPercentG;
    private Integer peakCampaignDays;
    private Integer leanBufferDaysB;
    private Integer phaseOutRemainingDays;
    private Integer defaultLeadTimeAvg;
    private Integer defaultLeadTimeMax;
    private Integer leadTimeSampleM;
    private Integer khoId;
    private Boolean recalculateNow;
}

