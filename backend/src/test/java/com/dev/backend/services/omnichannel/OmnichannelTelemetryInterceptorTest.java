package com.dev.backend.services.omnichannel;

import com.dev.backend.repository.LichSuDongBoMetricRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class OmnichannelTelemetryInterceptorTest {

    @Mock
    private LichSuDongBoMetricRepository repository;

    @Test
    void rateLimitState_throttlingGuardChiApDungChoScheduledBatchKhiTren85PhanTram() {
        OmnichannelRateLimitState state = new OmnichannelRateLimitState();
        state.updateFromHeader("SHOPIFY", "36/40", 200);

        assertEquals(90.0d, state.getUtilizationPct("SHOPIFY"));
        assertTrue(state.shouldThrottleScheduledBatch("SHOPIFY"));

        long t0 = System.nanoTime();
        boolean delayedRealtime = state.throttleBatchIfNeeded("SHOPIFY", OmnichannelTelemetryContext.JOB_REALTIME_CRITICAL);
        long realtimeMs = (System.nanoTime() - t0) / 1_000_000L;
        assertFalse(delayedRealtime, "REALTIME_CRITICAL tuyệt đối không bị trì hoãn");
        assertTrue(realtimeMs < 150, "REALTIME_CRITICAL phải chạy ngay");

        long t1 = System.nanoTime();
        boolean delayedBatch = state.throttleBatchIfNeeded("SHOPIFY", OmnichannelTelemetryContext.JOB_SCHEDULED_BATCH);
        long batchMs = (System.nanoTime() - t1) / 1_000_000L;
        assertTrue(delayedBatch, "SCHEDULED_BATCH phải tự động trễ +500ms khi bucket >= 85%");
        assertTrue(batchMs >= 450);
    }

    @Test
    void rateLimitState_khongThrottleDuoi85PhanTramVaCapNhat429() {
        OmnichannelRateLimitState state = new OmnichannelRateLimitState();
        state.updateFromHeader("SHOPIFY", "20/40", 200);
        assertEquals(50.0d, state.getUtilizationPct("SHOPIFY"));
        assertFalse(state.shouldThrottleScheduledBatch("SHOPIFY"));

        state.updateFromHeader("SHOPIFY", null, 429);
        assertEquals(100.0d, state.getUtilizationPct("SHOPIFY"));
        assertTrue(state.shouldThrottleScheduledBatch("SHOPIFY"));
    }

    @Test
    void telemetryContext_pushPopStackDungChuan() {
        assertNull(OmnichannelTelemetryContext.current());
        OmnichannelTelemetryContext.runWith("SHOPEE", OmnichannelTelemetryContext.JOB_SCHEDULED_BATCH, () -> {
            assertEquals("SHOPEE", OmnichannelTelemetryContext.current().channelCode());
            assertEquals(OmnichannelTelemetryContext.JOB_SCHEDULED_BATCH, OmnichannelTelemetryContext.current().jobType());
            OmnichannelTelemetryContext.runWith("SHOPIFY", OmnichannelTelemetryContext.JOB_REALTIME_CRITICAL, () -> {
                assertEquals("SHOPIFY", OmnichannelTelemetryContext.current().channelCode());
                assertEquals(OmnichannelTelemetryContext.JOB_REALTIME_CRITICAL, OmnichannelTelemetryContext.current().jobType());
            });
            assertEquals("SHOPEE", OmnichannelTelemetryContext.current().channelCode());
        });
        assertNull(OmnichannelTelemetryContext.current());
    }
}

