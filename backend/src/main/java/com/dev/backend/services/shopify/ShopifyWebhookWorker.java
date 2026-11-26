package com.dev.backend.services.shopify;

import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.workers.OmnichannelOrderSyncJob;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
@Slf4j
public class ShopifyWebhookWorker {
    private final ShopifyWebhookInbox inbox;
    private final ShopifyRealtimeConnection connection;
    private final KenhBanHangService credentials;
    private final ShopifyOrderSnapshotClient client;
    private final OmnichannelOrderSyncJob orders;
    private final DonHangRealtime realtime;
    private final Executor executor;
    private final com.dev.backend.repository.DonBanHangRepository localOrders;
    private final ShopifyOrderProgressClient progressClient = new ShopifyOrderProgressClient();
    private final AtomicBoolean running = new AtomicBoolean();

    public ShopifyWebhookWorker(ShopifyWebhookInbox inbox, ShopifyRealtimeConnection connection, KenhBanHangService credentials,
                                ShopifyOrderSnapshotClient client, OmnichannelOrderSyncJob orders, DonHangRealtime realtime,
                                @Qualifier("shopifyRealtimeExecutor") Executor executor,
                                com.dev.backend.repository.DonBanHangRepository localOrders) {
        this.inbox = inbox; this.connection = connection; this.credentials = credentials;
        this.client = client; this.orders = orders; this.realtime = realtime; this.executor = executor;
        this.localOrders = localOrders;
    }

    // Tác vụ phục hồi dự phòng: chỉ chạy mỗi 60 giây để phục hồi sau restart hoặc rớt mạng.
    // Các sự kiện webhook thực tế được xử lý ngay lập tức thông qua phương thức kick() bất đồng bộ.
    @Scheduled(fixedDelay = 60_000, initialDelay = 15_000, scheduler = "shopifyRealtimeScheduler")
    public void kick() {
        if (!running.compareAndSet(false, true)) return;
        try { executor.execute(this::drain); }
        catch (RuntimeException rejected) { running.set(false); }
    }

    // Quét tối đa 20 lô x 25 dòng từ shopify_webhook_inbox -> claim lease -> gọi Shopify lấy snapshot mới -> lưu đơn & bắn SSE
    void drain() {
        try {
            for (int batch = 0; batch < 20; batch++) {
                var deliveries = inbox.pending();
                if (deliveries.isEmpty()) break;
                for (var item : deliveries) {
                    // Chiếm khóa dòng theo UUID phiên xử lý (lease 120s) để không 2 luồng cùng xử lý 1 sự kiện
                    String owner = UUID.randomUUID().toString();
                    if (!inbox.claim(item.id(), owner)) continue;
                    try {
                        // Bảo vệ: bỏ qua sự kiện thuộc cửa hàng cũ nếu shop đã đổi hoặc ngắt kết nối
                        var channel = connection.current();
                        if (channel == null || !item.shop().equals(connection.domain(channel))) {
                            inbox.complete(item.id(), owner);
                            continue;
                        }
                        String token = credentials.getDecryptedShopifyAccessToken();
                        if (token == null || token.isBlank()) throw new IllegalStateException("Shopify disconnected");
                        // Nhánh OutboundProgress: đồng bộ lại trạng thái IN_PROGRESS (fulfillmentOrderReportProgress) nếu kho còn giữ đơn
                        if ("OutboundProgress".equals(item.type())) {
                            var local = localOrders.findByKenhBanHangIdAndMaDonHangKenh(channel.getId(), item.reference()).orElse(null);
                            if (local != null && WAITING_STATES.contains(local.getTrangThai() == null ? -1 : local.getTrangThai())
                                    && !progressClient.reportProgress(item.shop(), token, item.reference())) throw new IllegalStateException("Progress pending retry");
                            inbox.complete(item.id(), owner);
                            realtime.changed();
                            continue;
                        }
                        // Nhánh đơn hàng từ Webhook: kéo snapshot đầy đủ từ Shopify API, lưu DB và bắn SSE làm mới UI
                        var snapshot = client.fetch(item.shop(), token, item.type(), item.reference());
                        orders.processShopifyWebhookOrder(snapshot.order(), channel, snapshot.inProgress());
                        inbox.complete(item.id(), owner);
                        realtime.changed();
                    } catch (Exception failure) {
                        // Lỗi mạng/rate limit -> tăng số lần thử và hẹn lịch thử lại theo backoff hàm mũ
                        inbox.retry(item, owner);
                        log.warn("[SHOPIFY-WEBHOOK] Delivery {} pending retry ({})", item.id(), failure.getClass().getSimpleName());
                    }
                }
            }
        } catch (Exception failure) {
            log.warn("[SHOPIFY-WEBHOOK] Inbox unavailable ({})", failure.getClass().getSimpleName());
        } finally { running.set(false); }
    }

    @Scheduled(fixedDelay = 3_600_000, initialDelay = 60_000, scheduler = "shopifyRealtimeScheduler")
    public void cleanup() { inbox.cleanup(); }

    private static final java.util.Set<Integer> WAITING_STATES = java.util.Set.of(
            ITrangThaiDonBanHang.CHO_NHAT_HANG, ITrangThaiDonBanHang.CHO_DONG_GOI, ITrangThaiDonBanHang.DA_DONG_GOI);
}
