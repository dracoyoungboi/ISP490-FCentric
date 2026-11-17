package com.dev.backend.services.shopify;

import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.workers.OmnichannelOrderSyncJob;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.concurrent.Executor;
import static org.mockito.Mockito.*;

class ShopifyWebhookWorkerTest {
    ShopifyWebhookInbox inbox = mock(ShopifyWebhookInbox.class);
    ShopifyRealtimeConnection connection = mock(ShopifyRealtimeConnection.class);
    KenhBanHangService credentials = mock(KenhBanHangService.class);
    ShopifyOrderSnapshotClient client = mock(ShopifyOrderSnapshotClient.class);
    OmnichannelOrderSyncJob orders = mock(OmnichannelOrderSyncJob.class);
    DonHangRealtime realtime = mock(DonHangRealtime.class);
    DonBanHangRepository localOrders = mock(DonBanHangRepository.class);
    ShopifyWebhookWorker worker = new ShopifyWebhookWorker(inbox, connection, credentials, client, orders, realtime, Runnable::run, localOrders);
    ShopifyWebhookInbox.Delivery item = new ShopifyWebhookInbox.Delivery(1, "test.myshopify.com", "Order", "123", 0);
    KenhBanHang channel = KenhBanHang.builder().id(2).build();
    @BeforeEach void setup() {
        when(inbox.pending()).thenReturn(List.of(item), List.of());
        when(inbox.claim(eq(1L), anyString())).thenReturn(true);
        when(connection.current()).thenReturn(channel);
        when(connection.domain(channel)).thenReturn("test.myshopify.com");
        when(credentials.getDecryptedShopifyAccessToken()).thenReturn("test-key");
    }
    @Test void authenticatedEventProcessesImmediatelyAndNotifiesOnlyAfterSuccess() throws Exception {
        var snapshot = new ShopifyOrderSnapshotClient.Snapshot(new ObjectMapper().readTree("{\"id\":123,\"fulfillment_status\":\"fulfilled\"}"), false);
        when(client.fetch("test.myshopify.com", "test-key", "Order", "123")).thenReturn(snapshot);
        worker.kick();
        var ordered = inOrder(orders, inbox, realtime);
        ordered.verify(orders).processShopifyWebhookOrder(snapshot.order(), channel, false);
        ordered.verify(inbox).complete(eq(1L), anyString());
        ordered.verify(realtime).changed();
    }
    @Test void failedTransactionIsNotCompletedOrBroadcast() throws Exception {
        var snapshot = new ShopifyOrderSnapshotClient.Snapshot(new ObjectMapper().readTree("{\"id\":123}"), true);
        when(client.fetch(anyString(), anyString(), anyString(), anyString())).thenReturn(snapshot);
        doThrow(new IllegalStateException("database rollback")).when(orders).processShopifyWebhookOrder(any(), any(), anyBoolean());
        worker.kick();
        verify(inbox).retry(eq(item), anyString());
        verify(inbox, never()).complete(anyLong(), anyString());
        verifyNoInteractions(realtime);
    }
    @Test void oldShopDeliveryNeverUsesNewShopCredentials() {
        when(connection.domain(channel)).thenReturn("new.myshopify.com");
        worker.kick();
        verify(inbox).complete(eq(1L), anyString());
        verifyNoInteractions(client, credentials, orders, realtime);
    }
    @Test void rejectedExecutorLeavesDurableWorkAvailableForRecovery() {
        Executor rejected = task -> { throw new java.util.concurrent.RejectedExecutionException(); };
        var worker = new ShopifyWebhookWorker(inbox, connection, credentials, client, orders, realtime, rejected, localOrders);
        worker.kick();
        verifyNoInteractions(inbox, client, orders);
    }
}
