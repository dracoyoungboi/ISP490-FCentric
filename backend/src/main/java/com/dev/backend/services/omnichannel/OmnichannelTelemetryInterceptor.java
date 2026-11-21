package com.dev.backend.services.omnichannel;

import org.springframework.http.HttpMethod;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Interceptor gắn vào các {@link RestTemplate} gọi API sàn TMĐT:
 * 1. Thực thi Throttling Guard (+500ms cho SCHEDULED_BATCH khi RateLimitUtilization >= 85%).
 * 2. Đo độ trễ thực tế (ms), HTTP Status, Rate Limit Bucket, Error Category.
 * 3. Đẩy dữ liệu telemetry qua {@link OmnichannelTelemetryRecorder}.
 */
public final class OmnichannelTelemetryInterceptor implements ClientHttpRequestInterceptor {

    public static final OmnichannelTelemetryInterceptor INSTANCE = new OmnichannelTelemetryInterceptor();

    private static volatile OmnichannelTelemetryRecorder recorderBridge;
    private static volatile OmnichannelRateLimitState rateLimitBridge;

    private OmnichannelTelemetryInterceptor() {
    }

    public static void bindBridge(OmnichannelTelemetryRecorder recorder, OmnichannelRateLimitState rateLimitState) {
        recorderBridge = recorder;
        rateLimitBridge = rateLimitState;
    }

    public static RestTemplate attach(RestTemplate restTemplate) {
        if (restTemplate == null) return null;
        List<ClientHttpRequestInterceptor> current = restTemplate.getInterceptors();
        for (ClientHttpRequestInterceptor it : current) {
            if (it instanceof OmnichannelTelemetryInterceptor) {
                return restTemplate;
            }
        }
        List<ClientHttpRequestInterceptor> updated = new ArrayList<>(current);
        updated.add(INSTANCE);
        restTemplate.setInterceptors(updated);
        return restTemplate;
    }

    @Override
    public ClientHttpResponse intercept(
            HttpRequest request,
            byte[] body,
            ClientHttpRequestExecution execution) throws IOException {
        OmnichannelTelemetryContext.Frame ctx = OmnichannelTelemetryContext.current();
        String channel = ctx != null && ctx.channelCode() != null && !ctx.channelCode().isBlank()
                ? normalizeChannel(ctx.channelCode())
                : inferChannelFromUri(request.getURI());
        String jobType = ctx != null && ctx.jobType() != null && !ctx.jobType().isBlank()
                ? ctx.jobType()
                : OmnichannelTelemetryContext.JOB_MANUAL;
        String syncDirection = inferDirection(request.getMethod(), request.getURI());

        OmnichannelRateLimitState rateState = rateLimitBridge;
        if (rateState != null) {
            rateState.throttleBatchIfNeeded(channel, jobType);
        }

        long startNs = System.nanoTime();
        Integer httpStatus = null;
        String errorCategory = "NONE";
        try {
            ClientHttpResponse response = execution.execute(request, body);
            httpStatus = response.getStatusCode().value();
            if (rateState != null) {
                String bucketHeader = response.getHeaders().getFirst("X-Shopify-Shop-Api-Call-Limit");
                rateState.updateFromHeader(channel, bucketHeader, httpStatus);
            }
            errorCategory = classifyStatus(httpStatus);
            return response;
        } catch (SocketTimeoutException timeoutEx) {
            errorCategory = "TIMEOUT";
            throw timeoutEx;
        } catch (IOException ioEx) {
            errorCategory = ioEx.getMessage() != null && ioEx.getMessage().toLowerCase(Locale.ROOT).contains("timed out")
                    ? "TIMEOUT"
                    : "NETWORK_ERROR";
            throw ioEx;
        } catch (RuntimeException rtEx) {
            errorCategory = "CLIENT_RUNTIME_ERROR";
            throw rtEx;
        } finally {
            int latencyMs = (int) Math.max(0L, (System.nanoTime() - startNs) / 1_000_000L);
            OmnichannelTelemetryRecorder rec = recorderBridge;
            if (rec != null) {
                OmnichannelRateLimitState.BucketSnapshot snap =
                        rateState != null ? rateState.getSnapshot(channel) : null;
                rec.recordAsync(
                        channel,
                        syncDirection,
                        jobType,
                        latencyMs,
                        httpStatus,
                        errorCategory,
                        snap != null ? snap.used() : null,
                        snap != null ? snap.limit() : null,
                        0);
            }
        }
    }

    static String classifyStatus(int status) {
        if (status >= 200 && status < 300) return "NONE";
        if (status == 429) return "RATE_LIMIT";
        if (status == 401 || status == 403) return "AUTH_EXPIRED";
        if (status >= 400 && status < 500) return "CLIENT_4XX";
        if (status >= 500) return "SERVER_5XX";
        return "UNKNOWN";
    }

    static String inferChannelFromUri(URI uri) {
        if (uri == null || uri.getHost() == null) return "OMNICHANNEL";
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        if (host.contains("shopify")) return "SHOPIFY";
        if (host.contains("test-stable") || host.contains("sandbox.partner")) return "SHOPEE_SANDBOX";
        if (host.contains("shopee")) return "SHOPEE";
        if (host.contains("lazada")) return "LAZADA";
        if (host.contains("tiktok")) return "TIKTOK";
        return "OMNICHANNEL";
    }

    static String inferDirection(HttpMethod method, URI uri) {
        String path = uri != null && uri.getPath() != null ? uri.getPath().toLowerCase(Locale.ROOT) : "";
        if (path.contains("inventory") || path.contains("stock") || path.contains("fulfillment")) {
            return (method == HttpMethod.GET) ? "PULL_STATUS" : "PUSH_STOCK";
        }
        if (path.contains("order")) {
            return (method == HttpMethod.GET || path.contains("search")) ? "PULL_ORDER" : "PUSH_ORDER";
        }
        if (path.contains("oauth") || path.contains("token")) {
            return "AUTH";
        }
        if (path.contains("graphql")) {
            return "GRAPHQL";
        }
        return (method == HttpMethod.GET) ? "PULL_CATALOG" : "PUSH_DATA";
    }

    private static String normalizeChannel(String code) {
        String c = code.trim().toUpperCase(Locale.ROOT);
        if (c.contains("SHOPEE")) return c.contains("SANDBOX") ? "SHOPEE_SANDBOX" : "SHOPEE";
        if (c.contains("SHOPIFY")) return "SHOPIFY";
        if (c.contains("LAZADA")) return c.contains("SANDBOX") ? "LAZADA_SANDBOX" : "LAZADA";
        if (c.contains("TIKTOK")) return "TIKTOK";
        return c;
    }
}

