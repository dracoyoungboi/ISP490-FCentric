package com.dev.backend.services.shopify;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

/**
 * Kho lưu idempotent sự kiện Webhook Shopify trong MySQL (`shopify_webhook_inbox`).
 * Chỉ giữ định danh sự kiện (`event_key`, `shop_domain`, `reference_id`), không lưu payload khách hàng/thanh toán thô.
 */
@Repository
@Slf4j
public class ShopifyWebhookInbox {
    private final JdbcTemplate jdbc;
    public ShopifyWebhookInbox(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @PostConstruct
    void initialize() {
        try {
            new ResourceDatabasePopulator(new ClassPathResource("db/shopify_realtime.sql")).execute(
                    java.util.Objects.requireNonNull(jdbc.getDataSource()));
        } catch (org.springframework.dao.DataAccessException failure) {
            // Thiếu quyền CREATE cho tính năng bổ sung không được làm sập khởi động các kênh khác.
            log.warn("[SHOPIFY-WEBHOOK] Apply db/shopify_realtime.sql before enabling delivery ({})", failure.getClass().getSimpleName());
        }
    }

    public record Delivery(long id, String shop, String type, String reference, int attempts) {}

    public void checkStorage() {
        jdbc.queryForList("SELECT id FROM shopify_webhook_inbox LIMIT 1");
    }

    // Ghi mới sự kiện trong giao dịch riêng REQUIRES_NEW; nếu trùng event_key (DuplicateKey) thì bỏ qua an toàn
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void accept(String key, String shop, String type, String reference) {
        try {
            jdbc.update("INSERT INTO shopify_webhook_inbox(event_key,shop_domain,reference_type,reference_id) VALUES (?,?,?,?)",
                    key, shop, type, reference);
        } catch (DuplicateKeyException duplicate) {
            // Đã ghi nhận trước đó rồi -> bỏ qua không tạo đơn trùng
        }
    }

    // Lấy tối đa 25 dòng chưa hoàn tất và chưa có luồng nào giữ lease (hoặc lease đã hết hạn)
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
