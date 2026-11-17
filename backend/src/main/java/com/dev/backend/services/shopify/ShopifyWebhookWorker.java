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

    // The request also calls kick immediately. This timer recovers after restarts, rejected submissions or failures.
    @Scheduled(fixedDelay = 1000, initialDelay = 5000, scheduler = "shopifyRealtimeScheduler")
    public void kick() {
        if (!running.compareAndSet(false, true)) return;
        try { executor.execute(this::drain); }
        catch (RuntimeException rejected) { running.set(false); }
    }

    void drain() {
        try {
            for (int batch = 0; batch < 20; batch++) {
                var deliveries = inbox.pending();
                if (deliveries.isEmpty()) break;
                for (var item : deliveries) {
                    String owner = UUID.randomUUID().toString();
                    if (!inbox.claim(item.id(), owner)) continue;
                    try {
                        var channel = connection.current();
                        if (channel == null || !item.shop().equals(connection.domain(channel))) {
                            inbox.complete(item.id(), owner); // Old/disconnected shop must never use the new shop's credentials.
                            continue;
                        }
                        String token = credentials.getDecryptedShopifyAccessToken();
                        if (token == null || token.isBlank()) throw new IllegalStateException("Shopify disconnected");
                        if ("OutboundProgress".equals(item.type())) {
                            var local = localOrders.findByKenhBanHangIdAndMaDonHangKenh(channel.getId(), item.reference()).orElse(null);
                            if (local != null && WAITING_STATES.contains(local.getTrangThai() == null ? -1 : local.getTrangThai())
                                    && !progressClient.reportProgress(item.shop(), token, item.reference())) throw new IllegalStateException("Progress pending retry");
                            inbox.complete(item.id(), owner);
                            realtime.changed();
                            continue;
                        }
                        var snapshot = client.fetch(item.shop(), token, item.type(), item.reference());
                        orders.processShopifyWebhookOrder(snapshot.order(), channel, snapshot.inProgress());
                        inbox.complete(item.id(), owner);
                        realtime.changed();
                    } catch (Exception failure) {
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
