package com.dev.backend.services.shopify;

import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.services.KenhBanHangService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
@Slf4j
public class ShopifyRealtimeRegistration {
    private final ShopifyRealtimeConnection connection;
    private final KenhBanHangService credentials;
    private final ShopifyWebhookInbox inbox;
    private final RestTemplate rest = new RestTemplate(ShopifyOrderSnapshotClient.factory());
    private final ObjectMapper mapper;
    private final String publicBase;

    public ShopifyRealtimeRegistration(ShopifyRealtimeConnection connection, KenhBanHangService credentials,
            ShopifyWebhookInbox inbox, ObjectMapper mapper, @Value("${shopify.webhook.public-base-url:https://fcentric.net}") String publicBase) {
        this.connection = connection; this.credentials = credentials; this.inbox = inbox; this.mapper = mapper;
        this.publicBase = publicBase.replaceAll("/+$", "").replaceFirst("/api$", "");
    }

    @Scheduled(fixedDelay = 300_000, initialDelay = 5000, scheduler = "shopifyRealtimeScheduler")
    public void autoRegister() {
        // Retry registration after deployment/restart, not on every order operation.
        try { register(); } catch (Exception error) { log.warn("[SHOPIFY-WEBHOOK] Registration pending ({})", error.getClass().getSimpleName()); }
    }

    public synchronized Map<String, Object> register() {
        try {
            var channel = connection.current();
            String domain = connection.domain(channel);
            if (domain.isBlank() || connection.signingSecret(channel) == null) return result(false, 0, "kenhBan.shopifyRealtimeCanKhoaBiMat");
            try { inbox.checkStorage(); }
            catch (org.springframework.dao.DataAccessException unavailable) {
                return result(false, 0, "kenhBan.shopifyRealtimeCanBangDuLieu");
            }
            String token = credentials.getDecryptedShopifyAccessToken();
            if (token == null || token.isBlank()) return result(false, 0, "kenhBan.chuaCoAdminAccessToken");
            if (!publicBase.startsWith("https://")) return result(false, 0, "kenhBan.shopifyRealtimeChuaTrienKhai");
            String callback = publicBase + ShopifyWebhookService.PATH;
            // Never register Shopify against an old deployment/SPA fallback that cannot verify and persist events.
            var probe = rest.getForEntity(callback, String.class);
            if (probe.getBody() == null || !"fcentric-shopify-realtime-v1".equals(mapper.readTree(probe.getBody()).path("service").asText())) {
                return result(false, 0, "kenhBan.shopifyRealtimeChuaTrienKhai");
            }
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Shopify-Access-Token", token);
            headers.setContentType(MediaType.APPLICATION_JSON);
            String base = "https://" + domain + "/admin/api/2026-04/";
            Set<String> existing = new HashSet<>();
            String cursor = null;
            do {
                Map<String, Object> variables = new HashMap<>();
                variables.put("after", cursor);
                JsonNode connection = graphql(base, headers, "query($after:String){webhookSubscriptions(first:100,after:$after){nodes{topic uri} pageInfo{hasNextPage endCursor}}}", variables).path("webhookSubscriptions");
                if (!connection.path("nodes").isArray()) throw new IllegalStateException("Missing subscriptions");
                for (JsonNode subscription : connection.path("nodes")) {
                    if (callback.equals(subscription.path("uri").asText())) existing.add(subscription.path("topic").asText());
                }
                if (!connection.path("pageInfo").path("hasNextPage").asBoolean()) break;
                String next = connection.path("pageInfo").path("endCursor").asText("");
                if (next.isBlank() || next.equals(cursor)) throw new IllegalStateException("Invalid subscriptions cursor");
                cursor = next;
            } while (true);
            int active = 0;
            for (String topic : ShopifyWebhookService.TOPICS.stream().sorted().toList()) {
                String enumTopic = topic.toUpperCase(Locale.ROOT).replace('/', '_');
                if (existing.contains(enumTopic)) { active++; continue; }
                try {
                    JsonNode created = graphql(base, headers,
                            "mutation($topic:WebhookSubscriptionTopic!,$subscription:WebhookSubscriptionInput!){webhookSubscriptionCreate(topic:$topic,webhookSubscription:$subscription){webhookSubscription{id} userErrors{field message}}}",
                            Map.of("topic", enumTopic, "subscription", Map.of("uri", callback, "format", "JSON")))
                            .path("webhookSubscriptionCreate");
                    if (created.path("userErrors").isArray() && created.path("userErrors").isEmpty()
                            && !created.path("webhookSubscription").path("id").asText("").isBlank()) active++;
                    else log.warn("[SHOPIFY-WEBHOOK] Topic {} not registered; check app permissions", topic);
                } catch (Exception rejected) {
                    log.warn("[SHOPIFY-WEBHOOK] Topic {} pending permission/registration ({})", topic, rejected.getClass().getSimpleName());
                }
            }
            boolean registered = active == ShopifyWebhookService.TOPICS.size();
            return result(registered, active, registered ? "kenhBan.shopifyRealtimeDaBat" : "kenhBan.shopifyRealtimeMotPhan");
        } catch (Exception error) {
            log.warn("[SHOPIFY-WEBHOOK] Could not confirm public endpoint/subscriptions ({})", error.getClass().getSimpleName());
            return result(false, 0, "kenhBan.shopifyRealtimeChuaTrienKhai");
        }
    }

    private Map<String, Object> result(boolean ready, int active, String key) {
        return Map.of("ready", ready, "activeTopics", active, "totalTopics", ShopifyWebhookService.TOPICS.size(), "message", ThongDiep.dich(key));
    }

    private JsonNode graphql(String base, HttpHeaders headers, String query, Map<String, ?> variables) throws Exception {
        var response = rest.exchange(base + "graphql.json", HttpMethod.POST, new HttpEntity<>(Map.of("query", query, "variables", variables), headers), String.class);
        JsonNode root = mapper.readTree(response.getBody());
        if (root.has("errors") || !root.path("data").isObject()) throw new IllegalStateException("Webhook subscription request rejected");
        return root.path("data");
    }
}
