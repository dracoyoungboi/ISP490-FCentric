package com.dev.backend.services.shopify;

import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

/** Durable identifiers only: webhook customer/payment payloads are never stored. */
@Repository
public class ShopifyWebhookInbox {
    private final JdbcTemplate jdbc;
    public ShopifyWebhookInbox(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @PostConstruct
    void initialize() {
        new ResourceDatabasePopulator(new ClassPathResource("db/shopify_realtime.sql")).execute(
                java.util.Objects.requireNonNull(jdbc.getDataSource()));
    }

    public record Delivery(long id, String shop, String type, String reference, int attempts) {}

    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void accept(String key, String shop, String type, String reference) {
        try {
            jdbc.update("INSERT INTO shopify_webhook_inbox(event_key,shop_domain,reference_type,reference_id) VALUES (?,?,?,?)",
                    key, shop, type, reference);
        } catch (DuplicateKeyException duplicate) {
            // Already durably accepted. Pending/failed deliveries remain eligible for processing.
        }
    }

    public List<Delivery> pending() {
        return jdbc.query("SELECT id,shop_domain,reference_type,reference_id,attempts FROM shopify_webhook_inbox "
                        + "WHERE completed_at IS NULL AND available_at<=CURRENT_TIMESTAMP "
                        + "AND (lease_until IS NULL OR lease_until<CURRENT_TIMESTAMP) ORDER BY id LIMIT 25",
                (r, n) -> new Delivery(r.getLong(1), r.getString(2), r.getString(3), r.getString(4), r.getInt(5)));
    }

    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void retryProgress(String shop, String orderId) {
        try {
            String key = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest((shop + ":outbound-progress:" + orderId).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            jdbc.update("INSERT INTO shopify_webhook_inbox(event_key,shop_domain,reference_type,reference_id) VALUES (?,?,'OutboundProgress',?) "
                            + "ON DUPLICATE KEY UPDATE available_at=CASE WHEN completed_at IS NOT NULL THEN CURRENT_TIMESTAMP ELSE available_at END,"
                            + "attempts=CASE WHEN completed_at IS NOT NULL THEN 0 ELSE attempts END,completed_at=NULL", key, shop, orderId);
        } catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }

    public boolean claim(long id, String owner) {
        return jdbc.update("UPDATE shopify_webhook_inbox SET lease_owner=?,lease_until=? WHERE id=? "
                        + "AND completed_at IS NULL AND (lease_until IS NULL OR lease_until<CURRENT_TIMESTAMP)",
                owner, Timestamp.from(Instant.now().plusSeconds(120)), id) == 1;
    }

    public void complete(long id, String owner) {
        jdbc.update("UPDATE shopify_webhook_inbox SET completed_at=CURRENT_TIMESTAMP,lease_until=NULL,lease_owner=NULL WHERE id=? AND lease_owner=?", id, owner);
    }

    public void retry(Delivery item, String owner) {
        long seconds = Math.min(300, 1L << Math.min(item.attempts() + 1, 8));
        jdbc.update("UPDATE shopify_webhook_inbox SET attempts=attempts+1,available_at=?,lease_until=NULL,lease_owner=NULL WHERE id=? AND lease_owner=?",
                Timestamp.from(Instant.now().plusSeconds(seconds)), item.id(), owner);
    }

    public void cleanup() {
        jdbc.update("DELETE FROM shopify_webhook_inbox WHERE completed_at < ? LIMIT 1000", Timestamp.from(Instant.now().minusSeconds(7 * 86400)));
    }
}
