package com.dev.backend.services.shopify;

import com.dev.backend.dto.channel.warehouse.KenhKhoMappingConfigDto;
import com.dev.backend.dto.channel.warehouse.KenhKhoMappingItemDto;
import com.dev.backend.dto.channel.warehouse.ShopifyOrderRoutingMeta;
import com.dev.backend.dto.channel.warehouse.ShopifyOrderRoutingMeta.FulfillmentOrderSnapshot;
import com.dev.backend.entities.Kho;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Lưu trữ và tra cứu metadata gợi ý định tuyến kho / FulfillmentOrder của đơn Shopify.
 * Sử dụng một khóa cấu hình tự cắt tỉa trong {@code cau_hinh_he_thong} (SHOPIFY_DON_DINH_TUYEN)
 * nhằm giữ nguyên cấu trúc bảng don_ban_hang (ddl-auto=none) và tự dọn khi đơn kết thúc.
 */
@Slf4j
@Service
public class ShopifyOrderRoutingService {

    public static final String CAU_HINH_SHOPIFY_DINH_TUYEN = "SHOPIFY_DON_DINH_TUYEN";
    private static final long MAX_AGE_SECONDS = 30L * 24L * 3600L;
    private static final int MAX_ENTRIES = 500;

    @Autowired(required = false)
    private DieuHanhHeThongService dieuHanhHeThongService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, ShopifyOrderRoutingMeta> memoryCache = new ConcurrentHashMap<>();
    private final Object storeLock = new Object();
    private volatile boolean hydrated = false;

    public ShopifyOrderRoutingService() {}

    ShopifyOrderRoutingService(DieuHanhHeThongService dieuHanhHeThongService) {
        this.dieuHanhHeThongService = dieuHanhHeThongService;
    }

    /** Trích xuất gợi ý kho xuất và FulfillmentOrder từ payload REST + GraphQL Shopify mà không đổi khoXuat gốc. */
    public ShopifyOrderRoutingMeta buildFromOrderNode(
            String maDonHangKenh,
            JsonNode orderNode,
            KenhKhoMappingConfigDto mapCfg,
            List<Kho> activeKhos) {
        if (orderNode == null || maDonHangKenh == null || maDonHangKenh.isBlank()) {
            return null;
        }
        List<FulfillmentOrderSnapshot> fos = new ArrayList<>();
        JsonNode gqlFos = orderNode.path("fulfillment_orders_gql");
        if (gqlFos.isArray() && !gqlFos.isEmpty()) {
            for (JsonNode n : gqlFos) {
                try {
                    fos.add(objectMapper.treeToValue(n, FulfillmentOrderSnapshot.class));
                } catch (Exception ignored) {}
            }
        }
        if (fos.isEmpty() && orderNode.path("fulfillment_orders").isArray()) {
            for (JsonNode fo : orderNode.path("fulfillment_orders")) {
                String locId = ShopifyMultiLocationClient.toNumericId(fo.path("assigned_location_id").asText(""));
                if (locId == null) {
                    locId = ShopifyMultiLocationClient.toNumericId(fo.path("assigned_location").path("location_id").asText(""));
                }
                fos.add(FulfillmentOrderSnapshot.builder()
                        .id(ShopifyMultiLocationClient.toNumericId(fo.path("id").asText("")))
                        .status(fo.path("status").asText(""))
                        .assignedLocationId(locId)
                        .deliveryMethodType(fo.path("delivery_method").path("method_type").asText(""))
                        .build());
            }
        }

        List<FulfillmentOrderSnapshot> openFos = fos.stream()
                .filter(f -> f != null && !"CLOSED".equalsIgnoreCase(f.getStatus()) && !"CANCELLED".equalsIgnoreCase(f.getStatus()))
                .toList();
        List<FulfillmentOrderSnapshot> effectiveFos = openFos.isEmpty() ? fos : openFos;

        String shopifyLocId = null;
        String shopifyLocName = null;
        String deliveryMethod = null;
        Set<String> distinctLocs = new LinkedHashSet<>();

        for (FulfillmentOrderSnapshot fo : effectiveFos) {
            if (fo.getAssignedLocationId() != null && !fo.getAssignedLocationId().isBlank()) {
                distinctLocs.add(fo.getAssignedLocationId());
                if (shopifyLocId == null) {
                    shopifyLocId = fo.getAssignedLocationId();
                    shopifyLocName = fo.getAssignedLocationName();
                }
            }
            if (fo.getDeliveryMethodType() != null && !fo.getDeliveryMethodType().isBlank()) {
                if ("PICK_UP".equalsIgnoreCase(fo.getDeliveryMethodType())
                        || "PICKUP".equalsIgnoreCase(fo.getDeliveryMethodType())) {
                    deliveryMethod = "PICK_UP";
                } else if (deliveryMethod == null) {
                    deliveryMethod = fo.getDeliveryMethodType().toUpperCase();
                }
            }
        }

        if (shopifyLocId == null && orderNode.hasNonNull("location_id")) {
            shopifyLocId = ShopifyMultiLocationClient.toNumericId(orderNode.path("location_id").asText(""));
        }
        if (shopifyLocId == null && orderNode.path("fulfillments").isArray() && !orderNode.path("fulfillments").isEmpty()) {
            shopifyLocId = ShopifyMultiLocationClient.toNumericId(orderNode.path("fulfillments").get(0).path("location_id").asText(""));
        }
        if (shopifyLocId == null && orderNode.path("line_items").isArray() && !orderNode.path("line_items").isEmpty()) {
            shopifyLocId = ShopifyMultiLocationClient.toNumericId(orderNode.path("line_items").get(0).path("location_id").asText(""));
        }

        Integer khoDeXuatId = null;
        String tenKhoDeXuat = null;
        if (mapCfg != null && Boolean.TRUE.equals(mapCfg.getCheDoDaKho())
                && mapCfg.getDanhSachKho() != null && activeKhos != null && !activeKhos.isEmpty()) {
            KenhKhoMappingItemDto matchedItem = null;
            if (shopifyLocId != null) {
                final String targetLoc = shopifyLocId;
                matchedItem = mapCfg.getDanhSachKho().stream()
                        .filter(m -> m.getKhoIdFCentric() != null && matchesShopifyLocation(m.getMaKhoSan(), targetLoc))
                        .findFirst().orElse(null);
            }
            if (matchedItem == null) {
                matchedItem = mapCfg.getDanhSachKho().stream()
                        .filter(m -> Boolean.TRUE.equals(m.getLaMacDinh()) && m.getKhoIdFCentric() != null)
                        .findFirst().orElse(null);
            }
            if (matchedItem != null) {
                final Integer fcentricId = matchedItem.getKhoIdFCentric();
                Kho found = activeKhos.stream().filter(k -> k.getId() != null && k.getId().equals(fcentricId)).findFirst().orElse(null);
                if (found != null) {
                    khoDeXuatId = found.getId();
                    tenKhoDeXuat = found.getTenKho();
                    if (shopifyLocName == null || shopifyLocName.isBlank()) {
                        shopifyLocName = matchedItem.getTenKhoSan();
                    }
                }
            }
        }

        boolean splitMulti = distinctLocs.size() >= 2 || effectiveFos.size() >= 2;
        if (khoDeXuatId == null && fos.isEmpty() && deliveryMethod == null) {
            return null;
        }

        return ShopifyOrderRoutingMeta.builder()
                .maDonHangKenh(maDonHangKenh.trim())
                .khoDeXuatId(khoDeXuatId)
                .tenKhoDeXuat(tenKhoDeXuat)
                .shopifyLocationId(shopifyLocId)
                .shopifyLocationName(shopifyLocName)
                .deliveryMethodType(deliveryMethod)
                .splitMultiLocation(splitMulti)
                .updatedAtEpochSec(Instant.now().getEpochSecond())
                .fulfillmentOrders(effectiveFos)
                .build();
    }

    public static boolean matchesShopifyLocation(String mappedMaKhoSan, String numericOrGidLocation) {
        String a = ShopifyMultiLocationClient.toNumericId(mappedMaKhoSan);
        String b = ShopifyMultiLocationClient.toNumericId(numericOrGidLocation);
        return a != null && a.equals(b);
    }

    public static String resolveShopifyLocationForKho(KenhKhoMappingConfigDto mapCfg, Integer khoFCentricId) {
        if (mapCfg == null || !Boolean.TRUE.equals(mapCfg.getCheDoDaKho())
                || mapCfg.getDanhSachKho() == null || khoFCentricId == null) {
            return null;
        }
        return mapCfg.getDanhSachKho().stream()
                .filter(m -> Boolean.TRUE.equals(m.getKichHoat()) && khoFCentricId.equals(m.getKhoIdFCentric()))
                .map(m -> ShopifyMultiLocationClient.toNumericId(m.getMaKhoSan()))
                .filter(id -> id != null && !id.isBlank())
                .findFirst()
                .orElse(null);
    }

    public void save(ShopifyOrderRoutingMeta meta) {
        if (meta == null || meta.getMaDonHangKenh() == null || meta.getMaDonHangKenh().isBlank()) return;
        hydrateIfNeeded();
        synchronized (storeLock) {
            memoryCache.put(meta.getMaDonHangKenh().trim(), meta);
            pruneAndFlush();
        }
    }

    public Optional<ShopifyOrderRoutingMeta> find(String maDonHangKenh) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) return Optional.empty();
        hydrateIfNeeded();
        return Optional.ofNullable(memoryCache.get(maDonHangKenh.trim()));
    }

    public boolean isPickupOrder(String maDonHangKenh) {
        return find(maDonHangKenh)
                .map(m -> "PICK_UP".equalsIgnoreCase(m.getDeliveryMethodType())
                        || "PICKUP".equalsIgnoreCase(m.getDeliveryMethodType()))
                .orElse(false);
    }

    public void remove(String maDonHangKenh) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) return;
        hydrateIfNeeded();
        synchronized (storeLock) {
            if (memoryCache.remove(maDonHangKenh.trim()) != null) {
                pruneAndFlush();
            }
        }
    }

    private void hydrateIfNeeded() {
        if (hydrated || dieuHanhHeThongService == null) return;
        synchronized (storeLock) {
            if (hydrated) return;
            try {
                String json = dieuHanhHeThongService.getCauHinhString(CAU_HINH_SHOPIFY_DINH_TUYEN, null);
                if (json != null && !json.isBlank()) {
                    Map<String, ShopifyOrderRoutingMeta> map = objectMapper.readValue(json, new TypeReference<>() {});
                    if (map != null) {
                        memoryCache.putAll(map);
                    }
                }
            } catch (Exception ex) {
                log.debug("[SHOPIFY-ROUTING] Không nạp được metadata định tuyến Shopify: {}", ex.getMessage());
            } finally {
                hydrated = true;
            }
        }
    }

    private void pruneAndFlush() {
        long cutoff = Instant.now().getEpochSecond() - MAX_AGE_SECONDS;
        memoryCache.entrySet().removeIf(e -> e.getValue() == null || e.getValue().getUpdatedAtEpochSec() < cutoff);
        if (memoryCache.size() > MAX_ENTRIES) {
            List<Map.Entry<String, ShopifyOrderRoutingMeta>> entries = new ArrayList<>(memoryCache.entrySet());
            entries.sort((a, b) -> Long.compare(a.getValue().getUpdatedAtEpochSec(), b.getValue().getUpdatedAtEpochSec()));
            int removeCount = memoryCache.size() - MAX_ENTRIES;
            for (int i = 0; i < removeCount; i++) {
                memoryCache.remove(entries.get(i).getKey());
            }
        }
        if (dieuHanhHeThongService != null) {
            try {
                Map<String, ShopifyOrderRoutingMeta> snapshot = new LinkedHashMap<>(memoryCache);
                dieuHanhHeThongService.setCauHinhString(CAU_HINH_SHOPIFY_DINH_TUYEN, objectMapper.writeValueAsString(snapshot));
            } catch (Exception ex) {
                log.warn("[SHOPIFY-ROUTING] Không lưu được metadata định tuyến Shopify: {}", ex.getMessage());
            }
        }
    }
}
