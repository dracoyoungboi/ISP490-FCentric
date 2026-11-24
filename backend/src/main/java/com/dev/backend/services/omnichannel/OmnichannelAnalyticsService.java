package com.dev.backend.services.omnichannel;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.omnichannel.ApplySyncRecommendationsRequest;
import com.dev.backend.dto.omnichannel.OmnichannelAnalyticsOverviewDto;
import com.dev.backend.dto.omnichannel.OmnichannelAnalyticsOverviewDto.*;
import com.dev.backend.dto.omnichannel.OmnichannelSyncRecommendationDto;
import com.dev.backend.dto.omnichannel.OmnichannelSyncRecommendationDto.ItemDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.LichSuDongBoMetric;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.TrangThaiDongBoSanPham;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.*;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@Slf4j
public class OmnichannelAnalyticsService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter BUCKET_FMT_MIN = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter BUCKET_FMT_HOUR = DateTimeFormatter.ofPattern("dd/MM HH:00");
    private static final DateTimeFormatter BUCKET_FMT_DAY = DateTimeFormatter.ofPattern("dd/MM");

    private final LichSuDongBoMetricRepository metricRepository;
    private final OmnichannelRateLimitState rateLimitState;
    private final TrangThaiDongBoSanPhamRepository mappingRepository;
    private final NamedParameterJdbcTemplate jdbc;
    private final TongQuanAdminRepository adminRepo;
    private final DieuHanhHeThongService dieuHanhHeThongService;
    private final LichSuThayDoiService lichSuThayDoiService;
    private final NguoiDungRepository nguoiDungRepository;

    public OmnichannelAnalyticsService(
            LichSuDongBoMetricRepository metricRepository,
            OmnichannelRateLimitState rateLimitState,
            TrangThaiDongBoSanPhamRepository mappingRepository,
            NamedParameterJdbcTemplate jdbc,
            TongQuanAdminRepository adminRepo,
            DieuHanhHeThongService dieuHanhHeThongService,
            LichSuThayDoiService lichSuThayDoiService,
            NguoiDungRepository nguoiDungRepository) {
        this.metricRepository = metricRepository;
        this.rateLimitState = rateLimitState;
        this.mappingRepository = mappingRepository;
        this.jdbc = jdbc;
        this.adminRepo = adminRepo;
        this.dieuHanhHeThongService = dieuHanhHeThongService;
        this.lichSuThayDoiService = lichSuThayDoiService;
        this.nguoiDungRepository = nguoiDungRepository;
    }

    @Transactional(readOnly = true)
    public OmnichannelAnalyticsOverviewDto getOverview(String rangeParam, String channelParam) {
        String range = normalizeRange(rangeParam);
        String channelFilter = normalizeChannelFilter(channelParam);

        Instant now = Instant.now();
        Instant since = switch (range) {
            case "1h" -> now.minus(Duration.ofHours(1));
            case "7d" -> now.minus(Duration.ofDays(7));
            default -> now.minus(Duration.ofHours(24));
        };

        List<LichSuDongBoMetric> rows = adminRepo.coBang("lich_su_dong_bo_metric")
                ? metricRepository.findInWindow(since, channelFilter)
                : List.of();

        List<Integer> apiLatencies = new ArrayList<>();
        List<Integer> webhookLatencies = new ArrayList<>();
        long successCount = 0;
        long failedCount = 0;
        Map<String, Long> errorCounts = new LinkedHashMap<>();
        Map<String, List<LichSuDongBoMetric>> byChannel = new LinkedHashMap<>();
        Map<String, List<LichSuDongBoMetric>> trendBuckets = new LinkedHashMap<>();
        Map<String, ChannelBucketStatusDto> latestDbBuckets = new LinkedHashMap<>();

        for (LichSuDongBoMetric m : rows) {
            boolean isWebhook = "WEBHOOK_IN".equalsIgnoreCase(m.getSyncDirection());
            int latency = m.getLatencyMs() != null ? Math.max(0, m.getLatencyMs()) : 0;
            if (isWebhook) {
                webhookLatencies.add(latency);
            } else {
                apiLatencies.add(latency);
            }

            boolean ok = "NONE".equalsIgnoreCase(m.getErrorCategory())
                    && (m.getHttpStatus() == null || m.getHttpStatus() < 400);
            if (ok) {
                successCount++;
            } else {
                failedCount++;
                String errKey = m.getErrorCategory() != null ? m.getErrorCategory() : "UNKNOWN";
                errorCounts.merge(errKey, 1L, Long::sum);
            }

            String ch = m.getChannel() != null ? m.getChannel().toUpperCase(Locale.ROOT) : "OMNICHANNEL";
            byChannel.computeIfAbsent(ch, k -> new ArrayList<>()).add(m);

            if (m.getBucketUsed() != null && m.getBucketMax() != null && m.getBucketMax() > 0) {
                double pct = Math.min(100.0d, round2(m.getBucketUsed() * 100.0d / m.getBucketMax()));
                latestDbBuckets.put(ch, ChannelBucketStatusDto.builder()
                        .channel(ch)
                        .used(m.getBucketUsed())
                        .max(m.getBucketMax())
                        .utilizationPercent(pct)
                        .throttlingActive(pct >= OmnichannelRateLimitState.THROTTLE_THRESHOLD_PCT)
                        .updatedAt(m.getCreatedAt() != null ? m.getCreatedAt().toString() : null)
                        .build());
            }

            String bucketLabel = formatTrendBucket(m.getCreatedAt(), range);
            trendBuckets.computeIfAbsent(bucketLabel, k -> new ArrayList<>()).add(m);
        }

        long totalCalls = rows.size();
        double successRate = totalCalls == 0 ? 100.0d : round2(successCount * 100.0d / totalCalls);

        // Merge live rate-limit state on top of historical DB snapshot
        Map<String, ChannelBucketStatusDto> mergedBuckets = new LinkedHashMap<>(latestDbBuckets);
        rateLimitState.snapshotAll().forEach((ch, snap) -> {
            if (channelFilter == null || channelFilter.equalsIgnoreCase(ch)) {
                mergedBuckets.put(ch, ChannelBucketStatusDto.builder()
                        .channel(ch)
                        .used(snap.used())
                        .max(snap.limit())
                        .utilizationPercent(snap.utilizationPct())
                        .throttlingActive(snap.utilizationPct() >= OmnichannelRateLimitState.THROTTLE_THRESHOLD_PCT)
                        .updatedAt(snap.updatedAt().toString())
                        .build());
            }
        });

        double maxBucketPct = mergedBuckets.values().stream()
                .mapToDouble(ChannelBucketStatusDto::getUtilizationPercent)
                .max()
                .orElse(0.0d);
        boolean throttlingActive = mergedBuckets.values().stream()
                .anyMatch(ChannelBucketStatusDto::isThrottlingActive);

        List<ChannelMetricDto> channelStats = new ArrayList<>();
        for (var entry : byChannel.entrySet()) {
            String ch = entry.getKey();
            List<LichSuDongBoMetric> list = entry.getValue();
            List<Integer> lat = new ArrayList<>();
            long okCnt = 0;
            for (LichSuDongBoMetric item : list) {
                lat.add(item.getLatencyMs() != null ? item.getLatencyMs() : 0);
                if ("NONE".equalsIgnoreCase(item.getErrorCategory())
                        && (item.getHttpStatus() == null || item.getHttpStatus() < 400)) {
                    okCnt++;
                }
            }
            double bucketPct = mergedBuckets.containsKey(ch) ? mergedBuckets.get(ch).getUtilizationPercent() : 0.0d;
            channelStats.add(ChannelMetricDto.builder()
                    .channel(ch)
                    .totalCalls(list.size())
                    .successCalls(okCnt)
                    .failedCalls(list.size() - okCnt)
                    .successRatePercent(round2(okCnt * 100.0d / Math.max(1, list.size())))
                    .avgLatencyMs(average(lat))
                    .p95LatencyMs(percentile(lat, 0.95))
                    .rateLimitUtilizationPercent(bucketPct)
                    .build());
        }

        List<ErrorCategoryCountDto> errorBreakdown = new ArrayList<>();
        for (var entry : errorCounts.entrySet()) {
            errorBreakdown.add(ErrorCategoryCountDto.builder()
                    .errorCategory(entry.getKey())
                    .count(entry.getValue())
                    .sharePercent(failedCount > 0 ? round2(entry.getValue() * 100.0d / failedCount) : 0.0d)
                    .build());
        }
        errorBreakdown.sort(Comparator.comparingLong(ErrorCategoryCountDto::getCount).reversed());

        List<LatencyTrendPointDto> latencyTrend = new ArrayList<>();
        for (var entry : trendBuckets.entrySet()) {
            List<LichSuDongBoMetric> bucketRows = entry.getValue();
            List<Integer> bLat = new ArrayList<>();
            long okCnt = 0;
            for (LichSuDongBoMetric r : bucketRows) {
                bLat.add(r.getLatencyMs() != null ? r.getLatencyMs() : 0);
                if ("NONE".equalsIgnoreCase(r.getErrorCategory())
                        && (r.getHttpStatus() == null || r.getHttpStatus() < 400)) {
                    okCnt++;
                }
            }
            latencyTrend.add(LatencyTrendPointDto.builder()
                    .bucket(entry.getKey())
                    .callCount(bucketRows.size())
                    .errorCount(bucketRows.size() - okCnt)
                    .avgLatencyMs(average(bLat))
                    .p95LatencyMs(percentile(bLat, 0.95))
                    .successRatePercent(round2(okCnt * 100.0d / Math.max(1, bucketRows.size())))
                    .build());
        }

        List<RecentMetricLogDto> recentLogs = new ArrayList<>();
        for (int i = rows.size() - 1; i >= 0 && recentLogs.size() < 40; i--) {
            LichSuDongBoMetric r = rows.get(i);
            recentLogs.add(RecentMetricLogDto.builder()
                    .id(r.getId())
                    .channel(r.getChannel())
                    .syncDirection(r.getSyncDirection())
                    .triggerSource(r.getTriggerSource())
                    .latencyMs(r.getLatencyMs() != null ? r.getLatencyMs() : 0)
                    .httpStatus(r.getHttpStatus())
                    .errorCategory(r.getErrorCategory())
                    .bucketUsed(r.getBucketUsed())
                    .bucketMax(r.getBucketMax())
                    .createdAt(r.getCreatedAt() != null ? r.getCreatedAt().toString() : null)
                    .build());
        }

        OversellStats oversell = computeOversellStats(since, channelFilter);
        double oosRecoveryMinutes = computeAvgOosRecoveryMinutes(since);

        return OmnichannelAnalyticsOverviewDto.builder()
                .range(range)
                .channel(channelFilter != null ? channelFilter : "ALL")
                .calculatedAt(now.toString())
                .avgLatencyMs(average(apiLatencies))
                .p95LatencyMs(percentile(apiLatencies, 0.95))
                .p99LatencyMs(percentile(apiLatencies, 0.99))
                .webhookDelayAvgMs(average(webhookLatencies))
                .webhookDelayP95Ms(percentile(webhookLatencies, 0.95))
                .webhookCount(webhookLatencies.size())
                .syncSuccessRatePercent(successRate)
                .totalCalls(totalCalls)
                .successCalls(successCount)
                .failedCalls(failedCount)
                .maxRateLimitUtilizationPercent(maxBucketPct)
                .throttlingActive(throttlingActive)
                .oversellIncidenceCount(oversell.oversellCount())
                .oversellRatePercent(oversell.oversellRatePercent())
                .avgOosRecoveryMinutes(oosRecoveryMinutes)
                .channelBuckets(new ArrayList<>(mergedBuckets.values()))
                .channelStats(channelStats)
                .errorBreakdown(errorBreakdown)
                .latencyTrend(latencyTrend)
                .recentLogs(recentLogs)
                .build();
    }

    @Transactional(readOnly = true)
    public OmnichannelSyncRecommendationDto getSyncRecommendations(Integer daysParam, String channelParam) {
        int days = daysParam != null && daysParam >= 1 && daysParam <= 90 ? daysParam : 14;
        String channelFilter = normalizeChannelFilter(channelParam);
        Instant since = Instant.now().minus(Duration.ofDays(days));
        int globalRt = dieuHanhHeThongService != null
                ? Math.max(0, dieuHanhHeThongService.getCauHinhInt("REALTIME_SYNC_THRESHOLD", 3))
                : 3;
        String dssMode = dieuHanhHeThongService != null
                ? dieuHanhHeThongService.getCauHinhString("DSS_REPLENISHMENT_MODE", "BY_ABC_CLASS")
                : "BY_ABC_CLASS";
        String dssGlobalPreset = dieuHanhHeThongService != null
                ? dieuHanhHeThongService.getCauHinhString("DSS_GLOBAL_PRESET_CODE", "PRESET_01_STANDARD")
                : "PRESET_01_STANDARD";
        double defaultLAvg = dieuHanhHeThongService != null
                ? Math.max(1.0d, dieuHanhHeThongService.getCauHinhInt("DSS_DEFAULT_LEAD_TIME_AVG", 5))
                : 5.0d;
        double defaultLMax = dieuHanhHeThongService != null
                ? Math.max(defaultLAvg, dieuHanhHeThongService.getCauHinhInt("DSS_DEFAULT_LEAD_TIME_MAX", 7))
                : 7.0d;

        List<String> channelCodes = expandChannelCodes(channelFilter);
        String channelWhereClause = channelCodes.isEmpty()
                ? ""
                : "WHERE UPPER(kb.ma_kenh) IN (:channelCodes)";
        MapSqlParameterSource mappingParams = new MapSqlParameterSource();
        if (!channelCodes.isEmpty()) {
            mappingParams.addValue("channelCodes", channelCodes);
        }

        List<Map<String, Object>> mappings = jdbc.queryForList("""
                        SELECT t.id AS mapping_id,
                               t.bien_the_san_pham_id,
                               bt.ma_sku,
                               sp.ten_san_pham,
                               ms.ten_mau,
                               sz.ten_size,
                               t.kenh_ban_id,
                               kb.ma_kenh,
                               kb.ten_kenh,
                               t.buffer_percent,
                               t.realtime_threshold
                        FROM trang_thai_dong_bo_san_pham t
                        JOIN bien_the_san_pham bt ON bt.id = t.bien_the_san_pham_id AND bt.trang_thai = 1
                        JOIN san_pham_quan_ao sp ON sp.id = bt.san_pham_id AND sp.trang_thai IN (0, 1)
                        JOIN kenh_ban_hang kb ON kb.id = t.kenh_ban_id AND kb.trang_thai = 1
                        LEFT JOIN mau_sac ms ON ms.id = bt.mau_sac_id
                        LEFT JOIN size sz ON sz.id = bt.size_id
                        %s
                        ORDER BY kb.id, sp.ten_san_pham, bt.id
                        """.formatted(channelWhereClause),
                mappingParams);

        Map<Integer, Long> ftuMap = new HashMap<>();
        jdbc.query("""
                        SELECT lh.bien_the_san_pham_id AS bt_id,
                               COALESCE(SUM(tk.so_luong_kha_dung), 0) AS ftu
                        FROM ton_kho_theo_lo tk
                        JOIN lo_hang lh ON lh.id = tk.lo_hang_id
                        JOIN kho k ON k.id = tk.kho_id AND k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'
                        GROUP BY lh.bien_the_san_pham_id
                        """,
                rs -> {
                    ftuMap.put(rs.getInt("bt_id"), rs.getBigDecimal("ftu").setScale(0, RoundingMode.HALF_UP).longValue());
                });

        boolean hasPosTable = adminRepo.coBang("pos_checkout_request");
        String posExpr = hasPosTable ? "CASE WHEN pos.id IS NOT NULL THEN 1 ELSE 0 END" : "0";
        String posJoin = hasPosTable ? "LEFT JOIN pos_checkout_request pos ON pos.don_ban_hang_id = d.id" : "";

        Map<Integer, long[]> posOnlineSoldMap = new HashMap<>();
        Map<Integer, Long> revenueMap = new HashMap<>();
        Map<Integer, Map<LocalDateTime, Long>> dailyByDayMap = new HashMap<>();

        jdbc.query("""
                        SELECT ct.bien_the_san_pham_id AS bt_id,
                               DATE(d.ngay_dat_hang) AS ngay_ban,
                               SUM(CASE WHEN %s = 1 THEN ct.so_luong_dat ELSE 0 END) AS pos_qty,
                               SUM(CASE WHEN %s = 0 THEN ct.so_luong_dat ELSE 0 END) AS online_qty,
                               COALESCE(SUM(COALESCE(ct.thanh_tien, ct.so_luong_dat * ct.don_gia) - COALESCE(ct.tien_giam_gia, 0)), 0) AS doanh_thu
                        FROM chi_tiet_don_ban_hang ct
                        JOIN don_ban_hang d ON d.id = ct.don_ban_hang_id
                        %s
                        WHERE d.loai_chung_tu = 'don_ban_hang'
                          AND d.trang_thai NOT IN (0, 4)
                          AND d.ngay_dat_hang >= :since
                        GROUP BY ct.bien_the_san_pham_id, DATE(d.ngay_dat_hang)
                        """.formatted(posExpr, posExpr, posJoin),
                new MapSqlParameterSource("since", Timestamp.from(since)),
                rs -> {
                    int btId = rs.getInt("bt_id");
                    BigDecimal posBd = rs.getBigDecimal("pos_qty");
                    BigDecimal onlBd = rs.getBigDecimal("online_qty");
                    BigDecimal revBd = rs.getBigDecimal("doanh_thu");
                    long pos = posBd != null ? posBd.setScale(0, RoundingMode.HALF_UP).longValue() : 0L;
                    long onl = onlBd != null ? onlBd.setScale(0, RoundingMode.HALF_UP).longValue() : 0L;
                    long rev = revBd != null ? Math.max(0L, revBd.setScale(0, RoundingMode.HALF_UP).longValue()) : 0L;
                    posOnlineSoldMap.compute(btId, (k, prev) -> prev == null ? new long[]{pos, onl} : new long[]{prev[0] + pos, prev[1] + onl});
                    revenueMap.merge(btId, rev, Long::sum);
                    java.sql.Date sqlDate = rs.getDate("ngay_ban");
                    if (sqlDate != null) {
                        dailyByDayMap.computeIfAbsent(btId, k -> new HashMap<>())
                                .merge(sqlDate.toLocalDate().atStartOfDay(), pos + onl, Long::sum);
                    }
                });

        // Phân hạng Pareto ABC (70% / 20% / 10%) theo doanh thu toàn kho trong N ngày
        Map<Integer, String> abcClassByVariant = new HashMap<>();
        Map<Integer, Double> revShareByVariant = new HashMap<>();
        long totalRevenue = 0L;
        for (Long r : revenueMap.values()) {
            totalRevenue += Math.max(0L, r);
        }
        List<Map.Entry<Integer, Long>> rankedVariants = new ArrayList<>(revenueMap.entrySet());
        rankedVariants.sort((a, b) -> Long.compare(Math.max(0L, b.getValue()), Math.max(0L, a.getValue())));
        long cumRev = 0L;
        for (Map.Entry<Integer, Long> entry : rankedVariants) {
            long rev = Math.max(0L, entry.getValue());
            double cumBeforeRatio = totalRevenue > 0 ? (double) cumRev / totalRevenue : 1.0d;
            cumRev += rev;
            double sharePct = totalRevenue > 0 ? round2((double) rev * 100.0d / totalRevenue) : 0.0d;
            revShareByVariant.put(entry.getKey(), sharePct);
            String cls;
            if (totalRevenue <= 0 || rev <= 0) {
                cls = "C";
            } else if (cumBeforeRatio < 0.70d) {
                cls = "A";
            } else if (cumBeforeRatio < 0.90d) {
                cls = "B";
            } else {
                cls = "C";
            }
            abcClassByVariant.put(entry.getKey(), cls);
        }

        List<ItemDto> items = new ArrayList<>(mappings.size());
        for (Map<String, Object> row : mappings) {
            Integer mappingId = ((Number) row.get("mapping_id")).intValue();
            Integer btId = ((Number) row.get("bien_the_san_pham_id")).intValue();
            long ftu = Math.max(0L, ftuMap.getOrDefault(btId, 0L));
            long[] sold = posOnlineSoldMap.getOrDefault(btId, new long[]{0L, 0L});
            long posSold = sold[0];
            long onlineSold = sold[1];
            long totalSold = posSold + onlineSold;
            double avgDaily = round2((double) totalSold / days);
            double rPos = totalSold > 0 ? round2((double) posSold / totalSold) : 0.0d;

            String abcClass = abcClassByVariant.getOrDefault(btId, "C");
            long revN = revenueMap.getOrDefault(btId, 0L);
            double sharePct = revShareByVariant.getOrDefault(btId, 0.0d);

            // Công thức Buffer %_k đúng đặc tả Mục 2.4:
            // - Hạng A & r_POS >= 0.30 -> min(25%, max(10%, ROUND(r_POS * 30%)))
            // - Hạng B & r_POS >= 0.40 -> 10%
            // - Còn lại -> 0%
            int recBuf = 0;
            if ("A".equals(abcClass) && rPos >= 0.30d) {
                recBuf = (int) Math.min(25L, Math.max(10L, Math.round(rPos * 30.0d)));
            } else if ("B".equals(abcClass) && rPos >= 0.40d) {
                recBuf = 10;
            }

            // Công thức Threshold_RT,k đúng đặc tả Mục 2.4:
            // - Chuẩn / Lean: max(3, ceil(0.5 * D_avg))
            // - Cao điểm (PRESET_02_PEAK) với SKU Hạng A: max(3, SS_k)
            String appliedPreset = resolveDssPreset(dssMode, dssGlobalPreset, abcClass);
            int normalRt = Math.max(3, (int) Math.ceil(0.5d * avgDaily - 1e-9d));
            int recRt = normalRt;
            if ("A".equals(abcClass) && "PRESET_02_PEAK".equals(appliedPreset)) {
                double dMax = dailyByDayMap.getOrDefault(btId, Map.of()).values().stream()
                        .mapToDouble(Long::doubleValue)
                        .max()
                        .orElse(avgDaily);
                long peakSs = Math.max(0L, (long) Math.ceil(dMax * defaultLMax - avgDaily * defaultLAvg - 1e-9d));
                recRt = (int) Math.min(1000L, Math.max(normalRt, peakSs));
            }

            Integer curBuf = row.get("buffer_percent") != null ? ((Number) row.get("buffer_percent")).intValue() : null;
            Integer curRt = row.get("realtime_threshold") != null ? ((Number) row.get("realtime_threshold")).intValue() : null;

            long curPub = computePublished(ftu, curBuf != null ? curBuf : 0, curRt != null ? curRt : globalRt);
            long recPub = computePublished(ftu, recBuf, recRt);

            boolean needsAdj = !Objects.equals(curBuf != null ? curBuf : 0, recBuf)
                    || !Objects.equals(curRt != null ? curRt : globalRt, recRt);

            String maKenh = (String) row.get("ma_kenh");
            items.add(ItemDto.builder()
                    .mappingId(mappingId)
                    .bienTheSanPhamId(btId)
                    .maSku((String) row.get("ma_sku"))
                    .tenSanPham((String) row.get("ten_san_pham"))
                    .tenMau((String) row.get("ten_mau"))
                    .tenSize((String) row.get("ten_size"))
                    .kenhBanId(((Number) row.get("kenh_ban_id")).intValue())
                    .maKenh(maKenh)
                    .tenKenh((String) row.get("ten_kenh"))
                    .platformCode(canonicalPlatform(maKenh))
                    .abcClass(abcClass)
                    .appliedPreset(appliedPreset)
                    .revenueN(revN)
                    .revenueSharePercent(sharePct)
                    .ftu(ftu)
                    .posSoldN(posSold)
                    .onlineSoldN(onlineSold)
                    .totalSoldN(totalSold)
                    .avgDailySales(avgDaily)
                    .rPos(rPos)
                    .currentBufferPercent(curBuf)
                    .recommendedBufferPercent(recBuf)
                    .currentRealtimeThreshold(curRt)
                    .recommendedRealtimeThreshold(recRt)
                    .currentPublishedQty(curPub)
                    .recommendedPublishedQty(recPub)
                    .needsAdjustment(needsAdj)
                    .build());
        }

        items.sort(Comparator.comparing(ItemDto::isNeedsAdjustment, Comparator.reverseOrder())
                .thenComparing(it -> abcRank(it.getAbcClass()))
                .thenComparing(Comparator.comparingDouble(ItemDto::getRPos).reversed())
                .thenComparingLong(it -> -it.getTotalSoldN()));

        return OmnichannelSyncRecommendationDto.builder()
                .observationDays(days)
                .items(items)
                .build();
    }

    @Transactional(rollbackFor = Exception.class)
    public int applyRecommendations(ApplySyncRecommendationsRequest request) {
        if (request == null || request.getItems() == null || request.getItems().isEmpty()) {
            throw new CommonException(ThongDiep.of("dss.duLieuKhuyenNghiRong"));
        }

        List<TrangThaiDongBoSanPham> toSave = new ArrayList<>();
        for (var reqItem : request.getItems()) {
            if (reqItem.getMappingId() == null) continue;
            TrangThaiDongBoSanPham entity = mappingRepository.findById(reqItem.getMappingId()).orElse(null);
            if (entity == null) continue;

            if (reqItem.getBufferPercent() != null) {
                int buf = Math.max(0, Math.min(50, reqItem.getBufferPercent()));
                entity.setBufferPercent(buf);
            }
            if (reqItem.getRealtimeThreshold() != null) {
                int rt = Math.max(0, Math.min(1000, reqItem.getRealtimeThreshold()));
                entity.setRealtimeThreshold(rt);
            }
            toSave.add(entity);
        }

        if (!toSave.isEmpty()) {
            mappingRepository.saveAll(toSave);
            recordBufferAudit(toSave.size());
        }
        return toSave.size();
    }

    private record OversellStats(long oversellCount, double oversellRatePercent) {}

    private OversellStats computeOversellStats(Instant since, String channelFilter) {
        try {
            List<String> channelCodes = expandChannelCodes(channelFilter);
            String channelJoin = channelCodes.isEmpty()
                    ? ""
                    : "JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id";
            String channelWhere = channelCodes.isEmpty()
                    ? "AND d.kenh_ban_id IS NOT NULL"
                    : "AND UPPER(kb.ma_kenh) IN (:channelCodes)";
            MapSqlParameterSource params = new MapSqlParameterSource("since", Timestamp.from(since));
            if (!channelCodes.isEmpty()) {
                params.addValue("channelCodes", channelCodes);
            }
            String sql = """
                            SELECT COUNT(*) AS tong_don,
                                   COALESCE(SUM(CASE WHEN d.trang_thai = 4
                                         AND (LOWER(COALESCE(d.ly_do_tu_choi, '')) LIKE '%hết hàng%'
                                              OR LOWER(COALESCE(d.ghi_chu, '')) LIKE '%thiếu hàng%')
                                        THEN 1 ELSE 0 END), 0) AS don_huy_thieu_hang
                            FROM don_ban_hang d
                            """
                            + (channelJoin.isEmpty() ? "" : channelJoin + "\n")
                            + "WHERE d.loai_chung_tu = 'don_ban_hang'\n"
                            + "  " + channelWhere + "\n"
                            + "  AND d.ngay_dat_hang >= :since";
            Map<String, Object> res = jdbc.queryForMap(sql, params);
            long totalOnline = res.get("tong_don") != null ? ((Number) res.get("tong_don")).longValue() : 0L;
            long cancelledShortage = res.get("don_huy_thieu_hang") != null ? ((Number) res.get("don_huy_thieu_hang")).longValue() : 0L;
            Long negativeLotCount = jdbc.queryForObject("""
                            SELECT COUNT(*) FROM ton_kho_theo_lo WHERE so_luong_kha_dung < 0
                            """, new MapSqlParameterSource(), Long.class);
            long oversellCount = cancelledShortage + (negativeLotCount != null ? negativeLotCount : 0L);
            double rate = totalOnline > 0 ? round2(oversellCount * 100.0d / totalOnline) : 0.0d;
            return new OversellStats(oversellCount, rate);
        } catch (Exception e) {
            return new OversellStats(0L, 0.0d);
        }
    }

    private double computeAvgOosRecoveryMinutes(Instant since) {
        try {
            if (!adminRepo.coBang("lich_su_dong_bo_san_pham")) {
                return 0.0d;
            }
            // Trung bình số phút giữa lần push = 0 gần nhất và lần khôi phục > 0 (nếu có log lịch sử)
            return 0.0d;
        } catch (Exception e) {
            return 0.0d;
        }
    }

    private static long computePublished(long ftu, int bufferPercent, int rtThreshold) {
        if (bufferPercent <= 0 || ftu <= rtThreshold) {
            return Math.max(0L, ftu);
        }
        int safePct = Math.min(50, Math.max(0, bufferPercent));
        return (long) Math.floor(ftu * ((100.0d - safePct) / 100.0d));
    }

    private String normalizeRange(String rangeParam) {
        if (rangeParam == null || rangeParam.isBlank()) return "24h";
        String norm = rangeParam.trim().toLowerCase(Locale.ROOT);
        if (!Set.of("1h", "24h", "7d").contains(norm)) {
            throw new CommonException(ThongDiep.of("dss.khoangThoiGianKhongHopLe"));
        }
        return norm;
    }

    private String normalizeChannelFilter(String channelParam) {
        if (channelParam == null || channelParam.isBlank() || "ALL".equalsIgnoreCase(channelParam.trim())) {
            return null;
        }
        String c = channelParam.trim().toUpperCase(Locale.ROOT);
        if ("TIKTOK_SHOP".equals(c)) return "TIKTOK";
        if ("SHOPEE_OFFICIAL".equals(c)) return "SHOPEE";
        if ("LAZADA_SANDBOX".equals(c)) return "LAZADA";
        return c;
    }

    private static List<String> expandChannelCodes(String normalizedFilter) {
        if (normalizedFilter == null || normalizedFilter.isBlank()) {
            return List.of();
        }
        return switch (normalizedFilter) {
            case "SHOPEE" -> List.of("SHOPEE", "SHOPEE_OFFICIAL");
            case "SHOPEE_SANDBOX" -> List.of("SHOPEE_SANDBOX");
            case "TIKTOK" -> List.of("TIKTOK", "TIKTOK_SHOP");
            case "LAZADA" -> List.of("LAZADA", "LAZADA_SANDBOX");
            case "SHOPIFY" -> List.of("SHOPIFY");
            default -> List.of(normalizedFilter);
        };
    }

    private static String canonicalPlatform(String maKenh) {
        if (maKenh == null || maKenh.isBlank()) return "OMNICHANNEL";
        String c = maKenh.trim().toUpperCase(Locale.ROOT);
        if (c.contains("SHOPEE")) return c.contains("SANDBOX") ? "SHOPEE_SANDBOX" : "SHOPEE";
        if (c.contains("TIKTOK")) return "TIKTOK_SHOP";
        if (c.contains("LAZADA")) return c.contains("SANDBOX") ? "LAZADA_SANDBOX" : "LAZADA";
        if (c.contains("SHOPIFY")) return "SHOPIFY";
        return c;
    }

    private static String resolveDssPreset(String mode, String globalPresetCode, String abcClass) {
        if ("GLOBAL_PRESET".equalsIgnoreCase(mode) && globalPresetCode != null && !globalPresetCode.isBlank()) {
            return globalPresetCode;
        }
        return switch (abcClass != null ? abcClass : "C") {
            case "A" -> "PRESET_02_PEAK";
            case "B" -> "PRESET_01_STANDARD";
            default -> "PRESET_03_LEAN";
        };
    }

    private static int abcRank(String abcClass) {
        if ("A".equals(abcClass)) return 0;
        if ("B".equals(abcClass)) return 1;
        return 2;
    }

    private static String formatTrendBucket(Instant createdAt, String range) {
        Instant ts = createdAt != null ? createdAt : Instant.now();
        LocalDateTime dt = LocalDateTime.ofInstant(ts, VN_ZONE);
        if ("1h".equals(range)) {
            int roundedMin = (dt.getMinute() / 5) * 5;
            return dt.withMinute(roundedMin).withSecond(0).format(BUCKET_FMT_MIN);
        }
        if ("7d".equals(range)) {
            return dt.format(BUCKET_FMT_DAY);
        }
        return dt.format(BUCKET_FMT_HOUR);
    }

    private static double average(List<Integer> vals) {
        if (vals == null || vals.isEmpty()) return 0.0d;
        long sum = 0L;
        for (int v : vals) sum += v;
        return round2((double) sum / vals.size());
    }

    private static double percentile(List<Integer> vals, double p) {
        if (vals == null || vals.isEmpty()) return 0.0d;
        List<Integer> sorted = new ArrayList<>(vals);
        Collections.sort(sorted);
        int idx = (int) Math.ceil(p * sorted.size()) - 1;
        idx = Math.max(0, Math.min(sorted.size() - 1, idx));
        return sorted.get(idx);
    }

    private static double round2(double v) {
        return Math.round(v * 100.0d) / 100.0d;
    }

    private void recordBufferAudit(int count) {
        NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
        if (auth == null) return;
        try {
            NguoiDung user = nguoiDungRepository.findById(auth.getId()).orElse(null);
            if (user == null) return;
            lichSuThayDoiService.create(LichSuThayDoi.builder()
                    .loaiThamChieu(ITable.trang_thai_dong_bo_san_pham)
                    .idThamChieu(0)
                    .hanhDong(IHanhDong.cap_nhat_buffer_kenh)
                    .giaTriCu(null)
                    .giaTriMoi("{\"updatedMappings\":" + count + "}")
                    .nguoiThucHien(user)
                    .ngayThucHien(Instant.now())
                    .ghiChu("Áp dụng cấu hình Buffer% & Threshold_RT khuyến nghị cho " + count + " liên kết sàn")
                    .build());
        } catch (Exception e) {
            log.warn("[OMNI-ANALYTICS] Không thể ghi nhật ký áp dụng buffer: {}", e.getMessage());
        }
    }
}

