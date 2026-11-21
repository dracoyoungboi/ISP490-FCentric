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
}

