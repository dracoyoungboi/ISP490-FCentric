package com.dev.backend.services.impl.dss;

import com.dev.backend.dto.dss.DssConfigDto;
import com.dev.backend.dto.dss.DssRecommendationItemDto;
import com.dev.backend.services.impl.dss.DssPolicyEngine.CalculationOutput;
import com.dev.backend.services.impl.dss.DssPolicyEngine.SkuRawInput;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DssPolicyEngineTest {

    private static DssConfigDto baseConfig(String mode, String globalPreset) {
        return DssConfigDto.builder()
                .mode(mode)
                .globalPresetCode(globalPreset)
                .observationDaysN(7)
                .serviceLevelZ(1.65d)
                .cycleDaysT(14)
                .peakGrowthPercentG(30)
                .peakCampaignDays(14)
                .leanBufferDaysB(3)
                .phaseOutRemainingDays(15)
                .defaultLeadTimeAvg(5)
                .defaultLeadTimeMax(7)
                .leadTimeSampleM(10)
                .build();
    }

    private static SkuRawInput sku(
            int id,
            String code,
            long ftu,
            long incoming,
            double[] dailySold,
            long revenueN,
            long sold30,
            List<Double> leadTimes) {
        return new SkuRawInput(
                100 + id,
                id,
                "SP-" + id,
                code,
                "Sản phẩm " + id,
                "Đen",
                "#000000",
                "M",
                "Cotton",
                "Áo",
                null,
                ftu + 2,
                2,
                incoming,
                ftu,
                true,
                dailySold,
                revenueN,
                sold30,
                Map.of("POS", revenueN > 0 ? 5L : 0L),
                leadTimes,
                null,
                null,
                BigDecimal.valueOf(120000));
    }

    @Test
    void paretoAbc_phanLoaiDung702010_vaAnhXaKichBanTheoHang() {
        List<SkuRawInput> inputs = List.of(
                sku(1, "SKU-A1", 20, 0, new double[]{5, 5, 5, 5, 5, 5, 5}, 4500L, 35, List.of(4.0)),
                sku(2, "SKU-A2", 20, 0, new double[]{3, 3, 3, 3, 3, 3, 3}, 2500L, 21, List.of(4.0)),
                sku(3, "SKU-B1", 20, 0, new double[]{2, 2, 2, 2, 2, 2, 2}, 1500L, 14, List.of(4.0)),
                sku(4, "SKU-B2", 20, 0, new double[]{1, 1, 1, 1, 1, 1, 1}, 600L, 7, List.of(4.0)),
                sku(5, "SKU-C1", 20, 0, new double[]{1, 0, 1, 0, 1, 0, 1}, 500L, 4, List.of(4.0)),
                sku(6, "SKU-C2", 20, 0, new double[]{1, 0, 0, 0, 0, 0, 1}, 400L, 2, List.of(4.0))
        );

        DssConfigDto cfg = baseConfig(DssPolicyEngine.MODE_BY_ABC, DssPolicyEngine.PRESET_STANDARD);
        CalculationOutput out = DssPolicyEngine.calculate(inputs, cfg, LocalDate.of(2026, 11, 21));

        Map<String, DssRecommendationItemDto> byCode = new java.util.HashMap<>();
        out.items().forEach(i -> byCode.put(i.getMaSku(), i));

        assertEquals("A", byCode.get("SKU-A1").getAbcClass());
        assertEquals("A", byCode.get("SKU-A2").getAbcClass());
        assertEquals("B", byCode.get("SKU-B1").getAbcClass());
        assertEquals("B", byCode.get("SKU-B2").getAbcClass());
        assertEquals("C", byCode.get("SKU-C1").getAbcClass());
        assertEquals("C", byCode.get("SKU-C2").getAbcClass());

        assertEquals(DssPolicyEngine.PRESET_PEAK, byCode.get("SKU-A1").getAppliedPreset());
        assertEquals(DssPolicyEngine.PRESET_STANDARD, byCode.get("SKU-B1").getAppliedPreset());
        assertEquals(DssPolicyEngine.PRESET_LEAN, byCode.get("SKU-C1").getAppliedPreset());
        assertEquals(2, out.summary().getClassACount());
        assertEquals(2, out.summary().getClassBCount());
        assertEquals(2, out.summary().getClassCCount());
    }

    @Test
    void preset01Standard_tinhChinhXacSsRopQVaCanhBaoCritical() {
        // daily: [2, 4, 2, 4, 2, 4, 2] -> sum=20, D_avg=20/7=2.85714, sigma_D=0.98974, L_avg=4 -> SS=ceil(1.65*0.98974*2)=4
        // ROP = ceil(2.85714*4 + 4) = ceil(15.428) = 16
        // Q = ceil(2.85714*14 + 4 - (10 + 5)) = ceil(40 + 4 - 15) = 29
        SkuRawInput in = sku(10, "SKU-STD", 10, 5, new double[]{2, 4, 2, 4, 2, 4, 2}, 10000L, 20, List.of(4.0, 4.0));
        DssConfigDto cfg = baseConfig(DssPolicyEngine.MODE_GLOBAL, DssPolicyEngine.PRESET_STANDARD);

        CalculationOutput out = DssPolicyEngine.calculate(List.of(in), cfg, LocalDate.of(2026, 11, 21));
        DssRecommendationItemDto item = out.items().get(0);

        assertEquals(4L, item.getSafetyStock());
        assertEquals(16L, item.getReorderPoint());
        assertEquals(29L, item.getSuggestedOrderQty());
        assertEquals(3.5d, item.getDaysOfInventory());
        assertEquals("2026-11-24", item.getEstimatedStockoutDate());
        assertEquals(DssPolicyEngine.URGENCY_CRITICAL, item.getUrgencyLevel());
        assertTrue(item.isNeedsReorder());
        assertFalse(item.isPrCreationLocked());
    }

    @Test
    void preset02Peak_tinhChinhXacTheoTangTruongVaDMaxLMax() {
        // N=7, daily=[2, 2, 2, 2, 5, 1, 0] -> sum=14, D_avg=2.0, D_max=5.0, L_avg=4.0, L_max=6.0
        // g=30% -> D_target=2.6
        // SS = ceil(5*6 - 2*4) = 22
        // ROP = ceil(2.6*6 + 22) = ceil(37.6) = 38
        // Q = ceil(2.6*14 + 22 - 20) = ceil(38.4) = 39
        SkuRawInput in = sku(11, "SKU-PK", 20, 0, new double[]{2, 2, 2, 2, 5, 1, 0}, 10000L, 14, List.of(2.0, 6.0));
        DssConfigDto cfg = baseConfig(DssPolicyEngine.MODE_GLOBAL, DssPolicyEngine.PRESET_PEAK);

        CalculationOutput out = DssPolicyEngine.calculate(List.of(in), cfg, LocalDate.of(2026, 11, 21));
        DssRecommendationItemDto item = out.items().get(0);

        assertEquals(22L, item.getSafetyStock());
        assertEquals(38L, item.getReorderPoint());
        assertEquals(39L, item.getSuggestedOrderQty());
        assertEquals(DssPolicyEngine.URGENCY_HIGH, item.getUrgencyLevel());
        assertTrue(item.isNeedsReorder());
    }

    @Test
    void preset03Lean_tinhTheoSoNgayDemB_vaLeadTimeFallbackMacDinh() {
        // Không có phiếu nhập mẫu -> dùng L_avg = 5, D_avg = 4.0, B = 3 -> SS = 12, ROP = 32, Q = ceil(4*14 + 12 - 30) = 38
        SkuRawInput in = sku(12, "SKU-LN", 30, 0, new double[]{4, 4, 4, 4, 4, 4, 4}, 10000L, 28, List.of());
        DssConfigDto cfg = baseConfig(DssPolicyEngine.MODE_GLOBAL, DssPolicyEngine.PRESET_LEAN);

        CalculationOutput out = DssPolicyEngine.calculate(List.of(in), cfg, LocalDate.of(2026, 11, 21));
        DssRecommendationItemDto item = out.items().get(0);

        assertEquals(5.0d, item.getLeadTimeAvg());
        assertEquals(12L, item.getSafetyStock());
        assertEquals(32L, item.getReorderPoint());
        assertEquals(38L, item.getSuggestedOrderQty());
        assertEquals(DssPolicyEngine.URGENCY_HIGH, item.getUrgencyLevel());
    }

    @Test
    void preset04PhaseOut_khoaTaoPr_vaTinhTonDuXaHang() {
        // D_avg = 2.0, T_remaining = 15, FTU = 50 -> Excess = 50 - 30 = 20, SS=0, ROP=0, Q=0, prLocked=true
        SkuRawInput in = sku(13, "SKU-PO", 50, 10, new double[]{2, 2, 2, 2, 2, 2, 2}, 10000L, 14, List.of(4.0));
        DssConfigDto cfg = baseConfig(DssPolicyEngine.MODE_GLOBAL, DssPolicyEngine.PRESET_PHASE_OUT);

        CalculationOutput out = DssPolicyEngine.calculate(List.of(in), cfg, LocalDate.of(2026, 11, 21));
        DssRecommendationItemDto item = out.items().get(0);

        assertEquals(0L, item.getSafetyStock());
        assertEquals(0L, item.getReorderPoint());
        assertEquals(0L, item.getSuggestedOrderQty());
        assertEquals(20L, item.getExcessStock());
        assertTrue(item.isPrCreationLocked());
        assertFalse(item.isNeedsReorder());
        assertTrue(item.isFlashSaleRecommended());
        assertEquals(DssPolicyEngine.URGENCY_EXCESS, item.getUrgencyLevel());
    }

    @Test
    void deadStock_doiLonHon60Ngay_danhDauTonCham() {
        SkuRawInput in = sku(14, "SKU-SLOW", 200, 0, new double[]{1, 0, 0, 0, 0, 0, 0}, 500L, 1, List.of(4.0));
        DssConfigDto cfg = baseConfig(DssPolicyEngine.MODE_GLOBAL, DssPolicyEngine.PRESET_STANDARD);

        CalculationOutput out = DssPolicyEngine.calculate(List.of(in), cfg, LocalDate.of(2026, 11, 21));
        DssRecommendationItemDto item = out.items().get(0);

        assertTrue(item.getDaysOfInventory() > 60.0d);
        assertTrue(item.isDeadStock());
        assertTrue(item.isFlashSaleRecommended());
        assertEquals(DssPolicyEngine.URGENCY_EXCESS, item.getUrgencyLevel());
    }
}
