package com.dev.backend.services.impl.dss;

import com.dev.backend.dto.dss.DssConfigDto;
import com.dev.backend.dto.dss.DssRecommendationItemDto;
import com.dev.backend.dto.dss.DssSummaryDto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * Bộ máy tính toán thuần cho thuật toán DSS bổ sung hàng (FE-04.4):
 * - Phân loại ABC theo nguyên tắc Pareto 70% / 20% / 10%.
 * - Trích xuất biến số động D_avg, D_max, sigma_D, L_avg, L_max.
 * - Áp dụng 4 kịch bản kinh doanh: Chuẩn, Cao điểm, Tinh gọn, Ngừng nhập/Xả hàng.
 */
public final class DssPolicyEngine {

    public static final String MODE_BY_ABC = "BY_ABC_CLASS";
    public static final String MODE_GLOBAL = "GLOBAL_PRESET";

    public static final String PRESET_STANDARD = "PRESET_01_STANDARD";
    public static final String PRESET_PEAK = "PRESET_02_PEAK";
    public static final String PRESET_LEAN = "PRESET_03_LEAN";
    public static final String PRESET_PHASE_OUT = "PRESET_04_PHASE_OUT";

    public static final String URGENCY_CRITICAL = "CRITICAL";
    public static final String URGENCY_HIGH = "HIGH";
    public static final String URGENCY_NORMAL = "NORMAL";
    public static final String URGENCY_EXCESS = "EXCESS_OR_PHASE_OUT";

    private DssPolicyEngine() {
    }

    public record SkuRawInput(
            Integer sanPhamId,
            Integer bienTheSanPhamId,
            String maSanPham,
            String maSku,
            String tenSanPham,
            String tenMau,
            String maMauHex,
            String tenSize,
            String tenChatLieu,
            String tenDanhMuc,
            String anh,
            long onHand,
            long outgoing,
            long incoming,
            long ftu,
            boolean daTungNhap,
            double[] dailySoldN,
            long revenueN,
            long totalSold30Days,
            Map<String, Long> soldByChannel,
            List<Double> leadTimeSamples,
            String openPrCode,
            Integer openPrCount,
            BigDecimal donGiaNhapGanNhat
    ) {}

    public record CalculationOutput(
            List<DssRecommendationItemDto> items,
            DssSummaryDto summary
    ) {}

    public static CalculationOutput calculate(List<SkuRawInput> inputs, DssConfigDto config, LocalDate today) {
        if (inputs == null || inputs.isEmpty()) {
            return new CalculationOutput(List.of(), DssSummaryDto.builder().build());
        }

        int n = Math.max(1, config.getObservationDaysN());
        LocalDate refDate = today != null ? today : LocalDate.now();

        long totalRevenue = 0L;
        for (SkuRawInput in : inputs) {
            totalRevenue += Math.max(0L, in.revenueN());
        }

        // Sắp xếp giảm dần theo doanh thu trong N ngày để phân loại Pareto 70% / 20% / 10%
        List<SkuRawInput> ordered = new ArrayList<>(inputs);
        ordered.sort((a, b) -> {
            int revCmp = Long.compare(Math.max(0L, b.revenueN()), Math.max(0L, a.revenueN()));
            if (revCmp != 0) return revCmp;
            long soldA = sum(a.dailySoldN());
            long soldB = sum(b.dailySoldN());
            int soldCmp = Long.compare(soldB, soldA);
            if (soldCmp != 0) return soldCmp;
            return Integer.compare(a.bienTheSanPhamId(), b.bienTheSanPhamId());
        });

        List<DssRecommendationItemDto> result = new ArrayList<>(ordered.size());
        long cumRevenue = 0L;

        int criticalCount = 0;
        int highCount = 0;
        int normalCount = 0;
        int phaseOutOrExcessCount = 0;
        int needReorderCount = 0;
        long totalSuggestedQty = 0L;
        int classACount = 0;
        int classBCount = 0;
        int classCCount = 0;

        for (SkuRawInput in : ordered) {
            long rev = Math.max(0L, in.revenueN());
            double cumBeforeRatio = totalRevenue > 0 ? (double) cumRevenue / totalRevenue : 1.0;
            cumRevenue += rev;
            double sharePct = totalRevenue > 0 ? round2((double) rev * 100.0 / totalRevenue) : 0.0;
            double cumPct = totalRevenue > 0 ? round2((double) cumRevenue * 100.0 / totalRevenue) : 0.0;

            String abcClass;
            if (totalRevenue <= 0 || rev <= 0) {
                abcClass = "C";
            } else if (cumBeforeRatio < 0.70d) {
                abcClass = "A";
            } else if (cumBeforeRatio < 0.90d) {
                abcClass = "B";
            } else {
                abcClass = "C";
            }

            switch (abcClass) {
                case "A" -> classACount++;
                case "B" -> classBCount++;
                default -> classCCount++;
            }

            // Trích xuất dAvg, dMax, sigmaD trên cửa sổ N ngày
            double[] series = normalizedSeries(in.dailySoldN(), n);
            long totalSoldN = 0L;
            double dMax = 0.0;
            for (double d : series) {
                double positive = Math.max(0.0, d);
                totalSoldN += Math.round(positive);
                if (positive > dMax) dMax = positive;
            }
            double sumSold = 0.0;
            for (double d : series) {
                sumSold += Math.max(0.0, d);
            }
            double dAvg = sumSold / n;
            double varianceSum = 0.0;
            for (double d : series) {
                double diff = Math.max(0.0, d) - dAvg;
                varianceSum += diff * diff;
            }
            double sigmaD = Math.sqrt(varianceSum / n);

            // Trích xuất Lead Time (L_avg, L_max) từ M phiếu nhập hoàn tất gần nhất hoặc fallback mặc định
            List<Double> ltSamples = in.leadTimeSamples() != null ? in.leadTimeSamples() : List.of();
            double lAvg;
            double lMax;
            int sampleCount = ltSamples.size();
            if (sampleCount > 0) {
                double ltSum = 0.0;
                double ltMax = 0.0;
                for (Double sample : ltSamples) {
                    double val = sample != null && sample > 0 ? sample : 1.0;
                    ltSum += val;
                    if (val > ltMax) ltMax = val;
                }
                lAvg = ltSum / sampleCount;
                lMax = Math.max(lAvg, ltMax);
            } else {
                lAvg = Math.max(1.0, config.getDefaultLeadTimeAvg());
                lMax = Math.max(lAvg, config.getDefaultLeadTimeMax());
            }

            String appliedPreset = resolvePreset(config, abcClass);
            boolean isPhaseOut = PRESET_PHASE_OUT.equals(appliedPreset);

            long ftu = in.ftu();
            long incoming = Math.max(0L, in.incoming());
            long safetyStock;
            long reorderPoint;
            long suggestedOrderQty;
            long excessStock = 0L;

            if (isPhaseOut) {
                safetyStock = 0L;
                reorderPoint = 0L;
                suggestedOrderQty = 0L;
                long minNeededRemaining = ceilLong(dAvg * Math.max(1, config.getPhaseOutRemainingDays()));
                excessStock = Math.max(0L, ftu - minNeededRemaining);
            } else if (PRESET_PEAK.equals(appliedPreset)) {
                double growthFactor = Math.max(0.0, 1.0 + config.getPeakGrowthPercentG() / 100.0);
                double dTarget = dAvg * growthFactor;
                safetyStock = Math.max(0L, ceilLong(dMax * lMax - dAvg * lAvg));
                reorderPoint = ceilLong(dTarget * lMax + safetyStock);
                long targetQty = ceilLong(dTarget * Math.max(1, config.getPeakCampaignDays()) + safetyStock - (ftu + incoming));
                suggestedOrderQty = Math.max(0L, targetQty);
            } else if (PRESET_LEAN.equals(appliedPreset)) {
                safetyStock = Math.max(0L, ceilLong(dAvg * Math.max(1, config.getLeanBufferDaysB())));
                reorderPoint = ceilLong(dAvg * lAvg + safetyStock);
                long targetQty = ceilLong(dAvg * Math.max(1, config.getCycleDaysT()) + safetyStock - (ftu + incoming));
                suggestedOrderQty = Math.max(0L, targetQty);
            } else {
                // PRESET_01_STANDARD
                safetyStock = Math.max(0L, ceilLong(Math.max(0.0, config.getServiceLevelZ()) * sigmaD * Math.sqrt(lAvg)));
                reorderPoint = ceilLong(dAvg * lAvg + safetyStock);
                long targetQty = ceilLong(dAvg * Math.max(1, config.getCycleDaysT()) + safetyStock - (ftu + incoming));
                suggestedOrderQty = Math.max(0L, targetQty);
            }

            Double doi = null;
            String stockoutDate = null;
            String latestOrderDate = null;
            if (dAvg > 0.0001d) {
                double effectiveFtu = Math.max(0.0d, ftu);
                doi = round1(effectiveFtu / dAvg);
                long daysToZero = (long) Math.floor(effectiveFtu / dAvg);
                stockoutDate = refDate.plusDays(daysToZero).toString();
                if (!isPhaseOut) {
                    long daysToOrder = (long) Math.floor((effectiveFtu / dAvg) - lAvg);
                    latestOrderDate = refDate.plusDays(daysToOrder).toString();
                }
            }

            boolean deadStock = ftu > 0L && (in.totalSold30Days() <= 0L || (doi != null && doi > 60.0d));
            boolean needsReorder = !isPhaseOut && ftu <= reorderPoint && suggestedOrderQty > 0;
            boolean flashSale = (isPhaseOut && (excessStock > 0 || (doi != null && doi > 60.0))) || deadStock;

            String urgencyLevel;
            if (isPhaseOut) {
                urgencyLevel = URGENCY_EXCESS;
                phaseOutOrExcessCount++;
            } else if (dAvg > 0.0001d && ((doi != null && doi < lAvg) || ftu <= 0)) {
                urgencyLevel = URGENCY_CRITICAL;
                criticalCount++;
            } else if (ftu <= reorderPoint && (suggestedOrderQty > 0 || dAvg > 0.0001d)) {
                urgencyLevel = URGENCY_HIGH;
                highCount++;
            } else if (deadStock || (doi != null && doi > 60.0)) {
                urgencyLevel = URGENCY_EXCESS;
                phaseOutOrExcessCount++;
            } else {
                urgencyLevel = URGENCY_NORMAL;
                normalCount++;
            }

            if (needsReorder) {
                needReorderCount++;
                totalSuggestedQty += suggestedOrderQty;
            }

            result.add(DssRecommendationItemDto.builder()
                    .sanPhamId(in.sanPhamId())
                    .bienTheSanPhamId(in.bienTheSanPhamId())
                    .maSanPham(in.maSanPham())
                    .maSku(in.maSku())
                    .tenSanPham(in.tenSanPham())
                    .tenMau(in.tenMau())
                    .maMauHex(in.maMauHex())
                    .tenSize(in.tenSize())
                    .tenChatLieu(in.tenChatLieu())
                    .tenDanhMuc(in.tenDanhMuc())
                    .anh(in.anh())
                    .onHand(in.onHand())
                    .outgoing(in.outgoing())
                    .incoming(incoming)
                    .ftu(ftu)
                    .avgDailyDemand(round2(dAvg))
                    .maxDailyDemand(round2(dMax))
                    .demandStdDev(round2(sigmaD))
                    .totalSoldN(totalSoldN)
                    .revenueN(rev)
                    .soldByChannel(in.soldByChannel() != null ? in.soldByChannel() : Map.of())
                    .leadTimeAvg(round2(lAvg))
                    .leadTimeMax(round2(lMax))
                    .leadTimeSampleCount(sampleCount)
                    .abcClass(abcClass)
                    .revenueSharePercent(sharePct)
                    .cumulativeRevenuePercent(cumPct)
                    .deadStock(deadStock)
                    .daTungNhap(in.daTungNhap())
                    .appliedPreset(appliedPreset)
                    .safetyStock(safetyStock)
                    .reorderPoint(reorderPoint)
                    .suggestedOrderQty(suggestedOrderQty)
                    .excessStock(excessStock)
                    .daysOfInventory(doi)
                    .estimatedStockoutDate(stockoutDate)
                    .latestOrderDate(latestOrderDate)
                    .urgencyLevel(urgencyLevel)
                    .needsReorder(needsReorder)
                    .flashSaleRecommended(flashSale)
                    .prCreationLocked(isPhaseOut)
                    .openPrCode(in.openPrCode())
                    .openPrCount(in.openPrCount())
                    .donGiaNhapGanNhat(in.donGiaNhapGanNhat())
                    .build());
        }

        // Sắp xếp lại cho giao diện vận hành: Mức độ khẩn cấp -> Ngày dự kiến cạn -> FTU thấp -> Class A trước
        result.sort(Comparator
                .comparingInt((DssRecommendationItemDto d) -> urgencyOrder(d.getUrgencyLevel()))
                .thenComparing(d -> d.getDaysOfInventory() != null ? d.getDaysOfInventory() : Double.MAX_VALUE)
                .thenComparingLong(d -> -d.getSuggestedOrderQty())
                .thenComparing(d -> d.getAbcClass() != null ? d.getAbcClass() : "C")
                .thenComparing(d -> d.getMaSku() != null ? d.getMaSku() : ""));

        DssSummaryDto summary = DssSummaryDto.builder()
                .totalSkus(result.size())
                .criticalCount(criticalCount)
                .highCount(highCount)
                .normalCount(normalCount)
                .phaseOutOrExcessCount(phaseOutOrExcessCount)
                .needReorderCount(needReorderCount)
                .totalSuggestedQty(totalSuggestedQty)
                .classACount(classACount)
                .classBCount(classBCount)
                .classCCount(classCCount)
                .build();

        return new CalculationOutput(result, summary);
    }

    public static String resolvePreset(DssConfigDto config, String abcClass) {
        if (config != null && MODE_GLOBAL.equalsIgnoreCase(config.getMode())) {
            String g = config.getGlobalPresetCode();
            if (g != null && !g.isBlank()) {
                return g;
            }
        }
        return switch (abcClass != null ? abcClass : "C") {
            case "A" -> PRESET_PEAK;
            case "B" -> PRESET_STANDARD;
            default -> PRESET_LEAN;
        };
    }

    private static int urgencyOrder(String urgency) {
        if (URGENCY_CRITICAL.equals(urgency)) return 0;
        if (URGENCY_HIGH.equals(urgency)) return 1;
        if (URGENCY_NORMAL.equals(urgency)) return 2;
        return 3;
    }

    private static double[] normalizedSeries(double[] raw, int n) {
        double[] out = new double[n];
        if (raw == null) return out;
        int len = Math.min(raw.length, n);
        System.arraycopy(raw, 0, out, 0, len);
        return out;
    }

    private static long sum(double[] arr) {
        if (arr == null) return 0L;
        long total = 0L;
        for (double v : arr) {
            total += Math.round(Math.max(0.0, v));
        }
        return total;
    }

    private static long ceilLong(double v) {
        if (Double.isNaN(v) || Double.isInfinite(v) || v <= 0.0d) return 0L;
        return (long) Math.ceil(v - 1e-9d);
    }

    private static double round1(double v) {
        return Math.round(v * 10.0d) / 10.0d;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0d) / 100.0d;
    }
}

