package com.dev.backend.services.omnichannel;

import com.dev.backend.dto.omnichannel.ApplySyncRecommendationsRequest;
import com.dev.backend.dto.omnichannel.OmnichannelAnalyticsOverviewDto;
import com.dev.backend.entities.LichSuDongBoMetric;
import com.dev.backend.entities.TrangThaiDongBoSanPham;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.LichSuDongBoMetricRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.TongQuanAdminRepository;
import com.dev.backend.repository.TrangThaiDongBoSanPhamRepository;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OmnichannelAnalyticsServiceTest {

    @Mock private LichSuDongBoMetricRepository metricRepository;
    @Mock private TrangThaiDongBoSanPhamRepository mappingRepository;
    @Mock private NamedParameterJdbcTemplate jdbc;
    @Mock private TongQuanAdminRepository adminRepo;
    @Mock private DieuHanhHeThongService dieuHanhHeThongService;
    @Mock private LichSuThayDoiService lichSuThayDoiService;
    @Mock private NguoiDungRepository nguoiDungRepository;

    private OmnichannelRateLimitState rateLimitState;
    private OmnichannelAnalyticsService service;

    @BeforeEach
    void setUp() {
        rateLimitState = new OmnichannelRateLimitState();
        service = new OmnichannelAnalyticsService(
                metricRepository,
                rateLimitState,
                mappingRepository,
                jdbc,
                adminRepo,
                dieuHanhHeThongService,
                lichSuThayDoiService,
                nguoiDungRepository);
        when(adminRepo.coBang("lich_su_dong_bo_metric")).thenReturn(true);
        when(jdbc.queryForMap(anyString(), any(MapSqlParameterSource.class)))
                .thenReturn(Map.of("tong_don", 100L, "don_huy_thieu_hang", 2L));
        when(jdbc.queryForObject(anyString(), any(MapSqlParameterSource.class), eq(Long.class)))
                .thenReturn(0L);
    }

    @Test
    void getOverview_tinhDungLatencyP95_successRate_vaBucket() {
        Instant now = Instant.now();
        List<LichSuDongBoMetric> logs = List.of(
                LichSuDongBoMetric.builder().id(1L).channel("SHOPIFY").syncDirection("PUSH_STOCK").triggerSource("SCHEDULED_BATCH")
                        .latencyMs(100).httpStatus(200).errorCategory("NONE").bucketUsed(10).bucketMax(40).createdAt(now).build(),
                LichSuDongBoMetric.builder().id(2L).channel("SHOPIFY").syncDirection("PUSH_STOCK").triggerSource("SCHEDULED_BATCH")
                        .latencyMs(200).httpStatus(200).errorCategory("NONE").bucketUsed(20).bucketMax(40).createdAt(now).build(),
                LichSuDongBoMetric.builder().id(3L).channel("SHOPIFY").syncDirection("PULL_ORDER").triggerSource("SCHEDULED_BATCH")
                        .latencyMs(1800).httpStatus(429).errorCategory("RATE_LIMIT").bucketUsed(38).bucketMax(40).createdAt(now).build(),
                LichSuDongBoMetric.builder().id(4L).channel("SHOPIFY").syncDirection("WEBHOOK_IN").triggerSource("WEBHOOK_IN")
                        .latencyMs(45).httpStatus(200).errorCategory("NONE").createdAt(now).build()
        );
        when(metricRepository.findInWindow(any(), isNull())).thenReturn(logs);
        rateLimitState.updateFromHeader("SHOPIFY", "35/40", 200);

        OmnichannelAnalyticsOverviewDto dto = service.getOverview("24h", "ALL");

        assertEquals(4L, dto.getTotalCalls());
        assertEquals(3L, dto.getSuccessCalls());
        assertEquals(1L, dto.getFailedCalls());
        assertEquals(75.0d, dto.getSyncSuccessRatePercent());
        assertEquals(1800.0d, dto.getP95LatencyMs());
        assertEquals(45.0d, dto.getWebhookDelayP95Ms());
        assertEquals(87.5d, dto.getMaxRateLimitUtilizationPercent());
        assertTrue(dto.isThrottlingActive());
        assertEquals(2.0d, dto.getOversellRatePercent());
        assertEquals(1, dto.getErrorBreakdown().size());
        assertEquals("RATE_LIMIT", dto.getErrorBreakdown().get(0).getErrorCategory());
    }

    @Test
    void getOverview_khoangThoiGianSai_nemLoi() {
        assertThrows(CommonException.class, () -> service.getOverview("30d", null));
    }

    @Test
    void applyRecommendations_capNhatBufferVaRealtimeThreshold() {
        TrangThaiDongBoSanPham row = TrangThaiDongBoSanPham.builder().id(10).build();
        when(mappingRepository.findById(10)).thenReturn(Optional.of(row));

        ApplySyncRecommendationsRequest req = ApplySyncRecommendationsRequest.builder()
                .items(List.of(ApplySyncRecommendationsRequest.Item.builder()
                        .mappingId(10)
                        .bufferPercent(25)
                        .realtimeThreshold(8)
                        .build()))
                .build();

        int updated = service.applyRecommendations(req);
        assertEquals(1, updated);
        assertEquals(25, row.getBufferPercent());
        assertEquals(8, row.getRealtimeThreshold());
        verify(mappingRepository).saveAll(anyList());
    }

    @Test
    void getSyncRecommendations_tinhDungBufferTheoParetoAbc_vaMoRongFilterTiktok() {
        when(adminRepo.coBang("pos_checkout_request")).thenReturn(true);
        when(dieuHanhHeThongService.getCauHinhInt("REALTIME_SYNC_THRESHOLD", 3)).thenReturn(3);
        when(dieuHanhHeThongService.getCauHinhString("DSS_REPLENISHMENT_MODE", "BY_ABC_CLASS")).thenReturn("BY_ABC_CLASS");
        when(dieuHanhHeThongService.getCauHinhString("DSS_GLOBAL_PRESET_CODE", "PRESET_01_STANDARD")).thenReturn("PRESET_01_STANDARD");
        when(dieuHanhHeThongService.getCauHinhInt("DSS_DEFAULT_LEAD_TIME_AVG", 5)).thenReturn(5);
        when(dieuHanhHeThongService.getCauHinhInt("DSS_DEFAULT_LEAD_TIME_MAX", 7)).thenReturn(7);

        List<Map<String, Object>> mappings = List.of(
                new java.util.HashMap<>(Map.ofEntries(
                        Map.entry("mapping_id", 101), Map.entry("bien_the_san_pham_id", 1), Map.entry("ma_sku", "SKU-A"),
                        Map.entry("ten_san_pham", "Áo A"), Map.entry("kenh_ban_id", 2),
                        Map.entry("ma_kenh", "SHOPEE"), Map.entry("ten_kenh", "k flex"))),
                new java.util.HashMap<>(Map.ofEntries(
                        Map.entry("mapping_id", 102), Map.entry("bien_the_san_pham_id", 2), Map.entry("ma_sku", "SKU-B"),
                        Map.entry("ten_san_pham", "Áo B"), Map.entry("kenh_ban_id", 3),
                        Map.entry("ma_kenh", "TIKTOK_SHOP"), Map.entry("ten_kenh", "TikTok Official"))),
                new java.util.HashMap<>(Map.ofEntries(
                        Map.entry("mapping_id", 103), Map.entry("bien_the_san_pham_id", 3), Map.entry("ma_sku", "SKU-C"),
                        Map.entry("ten_san_pham", "Áo C"), Map.entry("kenh_ban_id", 4),
                        Map.entry("ma_kenh", "LAZADA"), Map.entry("ten_kenh", "Lazada Store")))
        );
        when(jdbc.queryForList(anyString(), any(MapSqlParameterSource.class))).thenReturn(mappings);

        // Stub 3 jdbc.query calls in order: ftuMap -> daily sales/rev
        doAnswer(inv -> {
            String sql = inv.getArgument(0);
            if (sql.contains("ton_kho_theo_lo")) {
                var rch = (org.springframework.jdbc.core.RowCallbackHandler) inv.getArgument(1);
                var rs = mock(java.sql.ResultSet.class);
                when(rs.getInt("bt_id")).thenReturn(1, 2, 3);
                when(rs.getBigDecimal("ftu")).thenReturn(
                        java.math.BigDecimal.valueOf(100),
                        java.math.BigDecimal.valueOf(50),
                        java.math.BigDecimal.valueOf(40));
                rch.processRow(rs);
                rch.processRow(rs);
                rch.processRow(rs);
            }
            return null;
        }).when(jdbc).query(anyString(), any(org.springframework.jdbc.core.RowCallbackHandler.class));

        doAnswer(inv -> {
            var rch = (org.springframework.jdbc.core.RowCallbackHandler) inv.getArgument(2);
            var rs = mock(java.sql.ResultSet.class);
            // Row 1 (Class A): rev=8000 (<70% cumBefore), pos=55, online=45 => rPos=0.55 => Buffer = min(25, max(10, round(0.55*30))) = 17
            // Row 2 (Class B): rev=1500 (cumBefore=80%), pos=50, online=50 => rPos=0.50 => Buffer = 10
            // Row 3 (Class C): rev=500  (cumBefore=95%), pos=80, online=20 => rPos=0.80 => Buffer = 0
            when(rs.getInt("bt_id")).thenReturn(1, 2, 3);
            when(rs.getBigDecimal("pos_qty")).thenReturn(
                    java.math.BigDecimal.valueOf(55), java.math.BigDecimal.valueOf(50), java.math.BigDecimal.valueOf(80));
            when(rs.getBigDecimal("online_qty")).thenReturn(
                    java.math.BigDecimal.valueOf(45), java.math.BigDecimal.valueOf(50), java.math.BigDecimal.valueOf(20));
            when(rs.getBigDecimal("doanh_thu")).thenReturn(
                    java.math.BigDecimal.valueOf(8000), java.math.BigDecimal.valueOf(1500), java.math.BigDecimal.valueOf(500));
            when(rs.getDate("ngay_ban")).thenReturn(java.sql.Date.valueOf("2026-11-20"));
            rch.processRow(rs);
            rch.processRow(rs);
            rch.processRow(rs);
            return null;
        }).when(jdbc).query(anyString(), any(MapSqlParameterSource.class), any(org.springframework.jdbc.core.RowCallbackHandler.class));

        var rec = service.getSyncRecommendations(14, "TIKTOK");
        assertEquals(14, rec.getObservationDays());
        assertEquals(3, rec.getItems().size());

        var bySku = new java.util.HashMap<String, com.dev.backend.dto.omnichannel.OmnichannelSyncRecommendationDto.ItemDto>();
        rec.getItems().forEach(i -> bySku.put(i.getMaSku(), i));

        assertEquals("A", bySku.get("SKU-A").getAbcClass());
        assertEquals("SHOPEE", bySku.get("SKU-A").getPlatformCode());
        assertEquals(17, bySku.get("SKU-A").getRecommendedBufferPercent());
        assertEquals(665, bySku.get("SKU-A").getRecommendedRealtimeThreshold()); // Peak SS = ceil(100*7 - (100/14)*5) = 665

        assertEquals("B", bySku.get("SKU-B").getAbcClass());
        assertEquals("TIKTOK_SHOP", bySku.get("SKU-B").getPlatformCode());
        assertEquals(10, bySku.get("SKU-B").getRecommendedBufferPercent());
        assertEquals(4, bySku.get("SKU-B").getRecommendedRealtimeThreshold()); // max(3, ceil(0.5 * 7.14)) = 4

        assertEquals("C", bySku.get("SKU-C").getAbcClass());
        assertEquals(0, bySku.get("SKU-C").getRecommendedBufferPercent());
        assertEquals(4, bySku.get("SKU-C").getRecommendedRealtimeThreshold());

        // Chế độ Bình thường (GLOBAL_PRESET = PRESET_01_STANDARD): Hạng A dùng max(3, ceil(0.5 * D_avg)) = 4
        when(dieuHanhHeThongService.getCauHinhString("DSS_REPLENISHMENT_MODE", "BY_ABC_CLASS")).thenReturn("GLOBAL_PRESET");
        var recNormal = service.getSyncRecommendations(14, "ALL");
        var skuANormal = recNormal.getItems().stream()
                .filter(i -> "SKU-A".equals(i.getMaSku()))
                .findFirst()
                .orElseThrow();
        assertEquals(17, skuANormal.getRecommendedBufferPercent());
        assertEquals(4, skuANormal.getRecommendedRealtimeThreshold());
    }
}

