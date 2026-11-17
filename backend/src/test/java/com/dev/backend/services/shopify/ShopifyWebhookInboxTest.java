package com.dev.backend.services.shopify;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class ShopifyWebhookInboxTest {
    JdbcTemplate jdbc;
    ShopifyWebhookInbox inbox;
    @BeforeEach void setup() {
        jdbc = new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", ""));
        inbox = new ShopifyWebhookInbox(jdbc);
        inbox.initialize();
    }
    @Test void duplicateDeliverySurvivesRestartAndIsClaimedOnlyOnce() {
        inbox.accept("key", "test.myshopify.com", "Order", "123");
        inbox.accept("key", "test.myshopify.com", "Order", "123");
        var restarted = new ShopifyWebhookInbox(jdbc);
        var items = restarted.pending();
        assertEquals(1, items.size());
        long id = items.get(0).id();
        assertTrue(restarted.claim(id, "owner-1"));
        assertFalse(restarted.claim(id, "owner-2"));
        restarted.complete(id, "owner-2");
        assertNull(jdbc.queryForObject("select completed_at from shopify_webhook_inbox where id=?", java.sql.Timestamp.class, id));
        restarted.complete(id, "owner-1");
        assertTrue(restarted.pending().isEmpty());
    }
    @Test void failureIsRetainedWithBackoffAndExpiredLeaseCanRecover() {
        inbox.accept("key", "test.myshopify.com", "Order", "123");
        var item = inbox.pending().get(0);
        assertTrue(inbox.claim(item.id(), "owner-1"));
        inbox.retry(item, "owner-1");
        assertTrue(inbox.pending().isEmpty());
        jdbc.update("UPDATE shopify_webhook_inbox SET available_at=DATEADD('SECOND',-5,CURRENT_TIMESTAMP)");
        assertEquals(1, inbox.pending().get(0).attempts());
        assertTrue(inbox.claim(item.id(), "owner-2"));
        jdbc.update("UPDATE shopify_webhook_inbox SET lease_until=DATEADD('SECOND',-5,CURRENT_TIMESTAMP)");
        assertTrue(inbox.claim(item.id(), "owner-3"));
        assertFalse(inbox.claim(item.id(), "owner-4"));
    }
    @Test void outgoingProgressCoalescesAndCanBeRetriedAfterACompletedAttempt() {
        inbox.retryProgress("test.myshopify.com", "123");
        inbox.retryProgress("test.myshopify.com", "123");
        var item = inbox.pending().get(0);
        assertEquals(1, inbox.pending().size());
        assertTrue(inbox.claim(item.id(), "owner"));
        inbox.complete(item.id(), "owner");
        inbox.retryProgress("test.myshopify.com", "123");
        assertEquals(1, inbox.pending().size());
        assertEquals("OutboundProgress", inbox.pending().get(0).type());
    }

    @Test void retryRegisteredAfterWarehouseCommitIsCommittedInItsOwnTransaction() {
        var manager = new org.springframework.jdbc.datasource.DataSourceTransactionManager(jdbc.getDataSource());
        var factory = new org.springframework.aop.framework.ProxyFactory(inbox);
        factory.addAdvice(new org.springframework.transaction.interceptor.TransactionInterceptor(manager,
                new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource()));
        var proxied = (ShopifyWebhookInbox) factory.getProxy();
        new org.springframework.transaction.support.TransactionTemplate(manager).executeWithoutResult(status ->
                org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                        new org.springframework.transaction.support.TransactionSynchronization() {
                            @Override public void afterCommit() { proxied.retryProgress("test.myshopify.com", "123"); }
                        }));
        assertEquals(1, new ShopifyWebhookInbox(jdbc).pending().size());
    }
}
