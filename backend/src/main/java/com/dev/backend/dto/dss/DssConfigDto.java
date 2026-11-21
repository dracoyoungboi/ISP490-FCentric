package com.dev.backend.dto.dss;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DssConfigDto {
    private String mode;
    private String globalPresetCode;
    private int observationDaysN;
    private double serviceLevelZ;
    private int cycleDaysT;
    private int peakGrowthPercentG;
    private int peakCampaignDays;
    private int leanBufferDaysB;
    private int phaseOutRemainingDays;
    private int defaultLeadTimeAvg;
    private int defaultLeadTimeMax;
    private int leadTimeSampleM;
}

