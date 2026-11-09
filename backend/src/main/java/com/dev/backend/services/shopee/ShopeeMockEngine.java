package com.dev.backend.services.shopee;

import com.dev.backend.dto.response.customize.ShopeeOrderDto;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.ShopeeMockOrder;
import com.dev.backend.entities.ShopeeMockProduct;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.repository.ShopeeMockOrderRepository;
import com.dev.backend.repository.ShopeeMockProductRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/**
 * Động cơ giả lập Shopee Sandbox Interactive Portal (Shopee Dual-Facing State Engine).
 * Lưu trữ trạng thái bền vững trong CSDL shopee_mock_product và shopee_mock_order,
 * cho phép mô phỏng chu trình tương tác hai chiều thời gian thực giữa Shopee Buyer,
 * Shopee Seller và hệ thống FCentric WMS.
 */
@Service
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ShopeeMockEngine {

    ShopeeMockProductRepository productRepository;
    ShopeeMockOrderRepository orderRepository;
    BienTheSanPhamRepository bienTheSanPhamRepository;
    KenhBanHangRepository kenhBanHangRepository;
    ObjectMapper objectMapper;
    Random random = new Random();

    static final String[] KHACH_HANG_MAU = {
            "Nguyễn Thu Thảo", "Trần Hoàng Nam", "Lê Thị Mai Anh", "Phạm Quốc Bảo",
            "Đỗ Minh Khang", "Vũ Bích Phương", "Hoàng Gia Huy", "Bùi Thanh Trúc"
    };

    static final String[] DIA_CHI_MAU = {
            "Số 18 Hoàng Diệu, P. Điện Biên, Q. Ba Đình, Hà Nội",
            "Tòa nhà Landmark 81, 720A Điện Biên Phủ, P. 22, Q. Bình Thạnh, TP. Hồ Chí Minh",
            "Số 45 Trần Phú, P. Mộ Lao, Q. Hà Đông, Hà Nội",
            "Số 123 Nguyễn Thị Minh Khai, P. Bến Thành, Quận 1, TP. Hồ Chí Minh",
            "Tổ 4, Khu đô thị Ciputra, P. Xuân Đỉnh, Q. Bắc Từ Liêm, Hà Nội"
    };

    /**
     * Tự động khởi tạo dữ liệu sản phẩm trên sàn Shopee Mock nếu bảng trống.
     */
    @Transactional
    public synchronized void initMockProductsIfEmpty() {
        if (productRepository.count() > 0) {
            return;
        }

        List<BienTheSanPham> samples = bienTheSanPhamRepository.findAll(PageRequest.of(0, 30)).getContent();
        if (samples.isEmpty()) {
            log.warn("[SHOPEE-MOCK] CSDL chưa có biến thể sản phẩm, không thể khởi tạo sàn Shopee Mock");
            return;
        }

        Map<Integer, Long> spToItemId = new HashMap<>();
        long baseItemId = 188200000L;
        long baseModelId = 588300000L;

        List<ShopeeMockProduct> toSave = new ArrayList<>();
        for (BienTheSanPham bt : samples) {
            int spId = (bt.getSanPham() != null && bt.getSanPham().getId() != null) ? bt.getSanPham().getId() : 1;
            Long itemId = spToItemId.computeIfAbsent(spId, k -> baseItemId + k * 100L);
            Long modelId = baseModelId + bt.getId();

            String spName = (bt.getSanPham() != null && bt.getSanPham().getTenSanPham() != null)
                    ? bt.getSanPham().getTenSanPham()
                    : "Sản phẩm Thời trang FCentric";
            String itemSku = (bt.getSanPham() != null && bt.getSanPham().getMaSanPham() != null)
                    ? bt.getSanPham().getMaSanPham()
                    : "FC-SP-" + spId;

            String mau = (bt.getMauSac() != null && bt.getMauSac().getTenMau() != null) ? bt.getMauSac().getTenMau() : "Đen";
            String size = (bt.getSize() != null && bt.getSize().getTenSize() != null) ? bt.getSize().getTenSize() : "M";
            String tierVar = "Màu " + mau + " - Size " + size;

            BigDecimal price = bt.getGiaBan() != null ? bt.getGiaBan() : BigDecimal.valueOf(250000);
            int initStock = 45 + random.nextInt(30);

            String img = com.dev.backend.utils.HienThiBienThe.anh(bt);

            ShopeeMockProduct prod = ShopeeMockProduct.builder()
                    .itemId(itemId)
                    .modelId(modelId)
                    .itemSku(itemSku)
                    .modelSku(bt.getMaSku())
                    .itemName(spName)
                    .tierVariation(tierVar)
                    .price(price)
                    .stockQuantity(initStock)
                    .imageUrl(img)
                    .trangThai("NORMAL")
                    .build();

            toSave.add(prod);
        }

        productRepository.saveAll(toSave);
        log.info("[SHOPEE-MOCK] Đã tự động nạp {} biến thể sản phẩm vào sàn Shopee Mock", toSave.size());
    }

    /**
     * Đưa sản phẩm từ FCentric lên sàn Shopee Mock và trả về map SKU -> modelId (Catalog Creation).
     */
    @Transactional
    public synchronized Map<String, Long> addMockProductsFromVariants(List<BienTheSanPham> variants) {
        if (variants == null || variants.isEmpty()) return Map.of();
        List<ShopeeMockProduct> existing = productRepository.findAll();
        Set<String> existingSkus = new HashSet<>();
        Map<Integer, Long> spToItemId = new HashMap<>();
        long baseItemId = 188200000L;
        long baseModelId = 588300000L;

        for (ShopeeMockProduct p : existing) {
            if (p.getModelSku() != null) existingSkus.add(p.getModelSku().trim().toLowerCase(Locale.ROOT));
        }

        List<ShopeeMockProduct> toSave = new ArrayList<>();
        Map<String, Long> resultMap = new HashMap<>();

        for (BienTheSanPham bt : variants) {
            if (bt.getMaSku() == null || bt.getMaSku().isBlank()) continue;
            String norm = bt.getMaSku().trim().toLowerCase(Locale.ROOT);
            int spId = (bt.getSanPham() != null && bt.getSanPham().getId() != null) ? bt.getSanPham().getId() : 1;
            Long itemId = spToItemId.computeIfAbsent(spId, k -> baseItemId + k * 100L);
            Long modelId = baseModelId + bt.getId();

            resultMap.put(norm, modelId);

            if (!existingSkus.contains(norm)) {
                String spName = (bt.getSanPham() != null && bt.getSanPham().getTenSanPham() != null)
                        ? bt.getSanPham().getTenSanPham()
                        : "Sản phẩm Thời trang FCentric";
                String itemSku = (bt.getSanPham() != null && bt.getSanPham().getMaSanPham() != null)
                        ? bt.getSanPham().getMaSanPham()
                        : "FC-SP-" + spId;

                String mau = (bt.getMauSac() != null && bt.getMauSac().getTenMau() != null) ? bt.getMauSac().getTenMau() : "Đen";
                String size = (bt.getSize() != null && bt.getSize().getTenSize() != null) ? bt.getSize().getTenSize() : "M";
                String tierVar = "Màu " + mau + " - Size " + size;

                BigDecimal price = bt.getGiaBan() != null ? bt.getGiaBan() : BigDecimal.valueOf(250000);
                String img = com.dev.backend.utils.HienThiBienThe.anh(bt);

                ShopeeMockProduct prod = ShopeeMockProduct.builder()
                        .itemId(itemId)
                        .modelId(modelId)
                        .itemSku(itemSku)
                        .modelSku(bt.getMaSku().trim())
                        .itemName(spName)
                        .tierVariation(tierVar)
                        .price(price)
                        .stockQuantity(0)
                        .imageUrl(img)
                        .trangThai("NORMAL")
                        .build();

                toSave.add(prod);
                existingSkus.add(norm);
            }
        }

        if (!toSave.isEmpty()) {
            productRepository.saveAll(toSave);
            log.info("[SHOPEE-MOCK] Đã đưa {} sản phẩm mới từ FCentric lên sàn Shopee Mock", toSave.size());
        }
        return resultMap;
    }

    /**
     * Cập nhật số lượng tồn kho trên sàn Shopee khi FCentric gọi API update_stock.
     */
    @Transactional
    public boolean updateStockFromFCentric(Long itemId, Long modelId, int newStock) {
        initMockProductsIfEmpty();
        Optional<ShopeeMockProduct> opt = productRepository.findByItemIdAndModelId(itemId, modelId);
        if (opt.isPresent()) {
            ShopeeMockProduct p = opt.get();
            p.setStockQuantity(Math.max(0, newStock));
            productRepository.save(p);
            log.info("[SHOPEE-MOCK-SYNC] Đã cập nhật tồn sàn Shopee thành công cho item {} model {}: {} cái", itemId, modelId, newStock);
            return true;
        }

        // Tìm theo modelId nếu không thấy cặp itemId + modelId
        for (ShopeeMockProduct p : productRepository.findAll()) {
            if (Objects.equals(p.getModelId(), modelId)) {
                p.setStockQuantity(Math.max(0, newStock));
                productRepository.save(p);
                log.info("[SHOPEE-MOCK-SYNC] Đã cập nhật tồn sàn Shopee cho model {}: {} cái", modelId, newStock);
                return true;
            }
        }

        return false;
    }

    /**
     * Cập nhật tồn kho hàng loạt theo danh sách biến thể của sản phẩm cha (Batch Update Stock).
     */
    @Transactional
    public boolean updateStockBatchFromFCentric(Long itemId, List<Map<String, Object>> stockList) {
        if (stockList == null || stockList.isEmpty()) return true;
        initMockProductsIfEmpty();

        List<ShopeeMockProduct> allProducts = productRepository.findAll();
        List<ShopeeMockProduct> toUpdate = new ArrayList<>();

        for (Map<String, Object> entry : stockList) {
            Long modelId = null;
            Object mVal = entry.get("model_id");
            if (mVal instanceof Number n) {
                modelId = n.longValue();
            } else if (mVal != null) {
                try { modelId = Long.parseLong(mVal.toString()); } catch (Exception ignored) {}
            }

            int stock = 0;
            Object sVal = entry.get("normal_stock");
            if (sVal instanceof Number n) {
                stock = n.intValue();
            } else if (sVal != null) {
                try { stock = Integer.parseInt(sVal.toString()); } catch (Exception ignored) {}
            }

            final Long targetModelId = modelId;
            final int finalStock = Math.max(0, stock);

            Optional<ShopeeMockProduct> matched = allProducts.stream()
                    .filter(p -> Objects.equals(p.getItemId(), itemId) && Objects.equals(p.getModelId(), targetModelId))
                    .findFirst();

            if (matched.isEmpty() && targetModelId != null) {
                matched = allProducts.stream()
                        .filter(p -> Objects.equals(p.getModelId(), targetModelId))
                        .findFirst();
            }

            if (matched.isPresent()) {
                ShopeeMockProduct p = matched.get();
                p.setStockQuantity(finalStock);
                toUpdate.add(p);
            }
        }

        if (!toUpdate.isEmpty()) {
            productRepository.saveAll(toUpdate);
            log.info("[SHOPEE-MOCK-SYNC-BATCH] Đã cập nhật tồn Shopee theo lô cho item {}: {} biến thể", itemId, toUpdate.size());
            return true;
        }
        return false;
    }

    /**
     * Cập nhật tồn kho theo modelSku (Mã SKU FCentric).
     */
    @Transactional
    public boolean updateStockBySku(String sku, int newStock) {
        initMockProductsIfEmpty();
        Optional<ShopeeMockProduct> opt = productRepository.findByModelSku(sku);
        if (opt.isPresent()) {
            ShopeeMockProduct p = opt.get();
            p.setStockQuantity(Math.max(0, newStock));
            productRepository.save(p);
            log.info("[SHOPEE-MOCK-SYNC] Đã cập nhật tồn sàn Shopee theo SKU {}: {} cái", sku, newStock);
            return true;
        }
        return false;
    }

    /**
     * Lấy danh sách sản phẩm hiển thị trên sàn Shopee Buyer Storefront.
     */
    @Transactional
    public List<Map<String, Object>> getStorefrontProducts() {
        initMockProductsIfEmpty();
        List<ShopeeMockProduct> all = productRepository.findAllByTrangThai("NORMAL");

        // Gom nhóm theo itemId
        Map<Long, Map<String, Object>> grouped = new LinkedHashMap<>();
        for (ShopeeMockProduct p : all) {
            Map<String, Object> sp = grouped.computeIfAbsent(p.getItemId(), k -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("itemId", p.getItemId());
                map.put("itemName", p.getItemName());
                map.put("itemSku", p.getItemSku());
                map.put("imageUrl", p.getImageUrl());
                map.put("price", p.getPrice());
                map.put("models", new ArrayList<Map<String, Object>>());
                return map;
            });

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> models = (List<Map<String, Object>>) sp.get("models");
            Map<String, Object> modelMap = new LinkedHashMap<>();
            modelMap.put("modelId", p.getModelId());
            modelMap.put("modelSku", p.getModelSku());
            modelMap.put("tierVariation", p.getTierVariation());
            modelMap.put("price", p.getPrice());
            modelMap.put("stockQuantity", p.getStockQuantity());
            models.add(modelMap);
        }

        return new ArrayList<>(grouped.values());
    }

    /**
     * Lấy danh sách sản phẩm và tồn kho cho Shopee Seller Center.
     */
    @Transactional
    public List<ShopeeMockProduct> getSellerProducts() {
        initMockProductsIfEmpty();
        return productRepository.findAll();
    }

    /**
     * Lấy danh sách đơn hàng cho Shopee Seller Center.
     */
    @Transactional(readOnly = true)
    public List<ShopeeMockOrder> getSellerOrders() {
        return orderRepository.findAllByOrderByCreateTimeDesc();
    }

    /**
     * Khách hàng đặt mua hàng trên Shopee Buyer Storefront.
     */
    @Transactional
    public ShopeeMockOrder buyerCheckout(Long itemId, Long modelId, int quantity,
                                        String buyerName, String buyerPhone, String address, String paymentMethod) {
        initMockProductsIfEmpty();

        ShopeeMockProduct prod = productRepository.findByItemIdAndModelId(itemId, modelId)
                .orElseThrow(() -> new RuntimeException("Sản phẩm hoặc phân loại hàng không tồn tại trên sàn"));

        if (prod.getStockQuantity() < quantity) {
            throw new RuntimeException("Số lượng tồn trên sàn chỉ còn " + prod.getStockQuantity() + " sản phẩm, không đủ để đặt " + quantity);
        }

        // Trừ tồn trên sàn Shopee
        prod.setStockQuantity(prod.getStockQuantity() - quantity);
        productRepository.save(prod);

        long nowSec = Instant.now().getEpochSecond();
        String suffix = String.format("%04d", random.nextInt(10000));
        String orderSn = "241107SHP" + (System.currentTimeMillis() % 100000L) + suffix;
        String trackingNumber = "SPXVN0" + String.format("%08d", random.nextInt(100000000)) + "B";

        BigDecimal itemPrice = prod.getPrice() != null ? prod.getPrice() : BigDecimal.valueOf(250000);
        BigDecimal subtotal = itemPrice.multiply(BigDecimal.valueOf(quantity));
        BigDecimal shippingFee = BigDecimal.valueOf(25000);
        BigDecimal total = subtotal.add(shippingFee);

        List<ShopeeOrderDto.ShopeeOrderItemDto> items = new ArrayList<>();
        items.add(ShopeeOrderDto.ShopeeOrderItemDto.builder()
                .itemId(prod.getItemId())
                .itemName(prod.getItemName())
                .itemSku(prod.getItemSku())
                .modelId(prod.getModelId())
                .modelName(prod.getTierVariation())
                .modelSku(prod.getModelSku())
                .modelQuantityPurchased(quantity)
                .modelDiscountedPrice(itemPrice.doubleValue())
                .build());

        String itemsJson;
        try {
            itemsJson = objectMapper.writeValueAsString(items);
        } catch (Exception e) {
            itemsJson = "[]";
        }

        String safeName = (buyerName != null && !buyerName.isBlank()) ? buyerName.trim() : KHACH_HANG_MAU[random.nextInt(KHACH_HANG_MAU.length)];
        String safePhone = (buyerPhone != null && !buyerPhone.isBlank()) ? buyerPhone.trim() : ("09" + String.format("%08d", random.nextInt(100000000)));
        String safeAddress = (address != null && !address.isBlank()) ? address.trim() : DIA_CHI_MAU[random.nextInt(DIA_CHI_MAU.length)];
        String safeMethod = (paymentMethod != null && !paymentMethod.isBlank()) ? paymentMethod : "CASH_ON_DELIVERY";

        ShopeeMockOrder order = ShopeeMockOrder.builder()
                .orderSn(orderSn)
                .orderStatus("READY_TO_SHIP")
                .buyerName(safeName)
                .buyerPhone(safePhone)
                .shippingAddress(safeAddress)
                .paymentMethod(safeMethod)
                .trackingNumber(trackingNumber)
                .shippingCarrier("Shopee Xpress")
                .totalAmount(total)
                .shippingFee(shippingFee)
                .itemsJson(itemsJson)
                .createTime(nowSec)
                .updateTime(nowSec)
                .build();

        ShopeeMockOrder saved = orderRepository.save(order);
        log.info("[SHOPEE-MOCK-BUYER] Khách hàng {} vừa đặt thành công đơn Shopee {} ({} sản phẩm)", safeName, orderSn, quantity);
        return saved;
    }

    /**
     * Cập nhật trạng thái đơn hàng trên sàn (Hủy đơn, Đang giao, Đã giao).
     */
    @Transactional
    public ShopeeMockOrder updateOrderStatus(String orderSn, String newStatus, String cancelReason, String cancelUser) {
        ShopeeMockOrder order = orderRepository.findByOrderSn(orderSn)
                .orElseThrow(() -> new RuntimeException("Đơn hàng Shopee " + orderSn + " không tồn tại"));

        String oldStatus = order.getOrderStatus();
        order.setOrderStatus(newStatus);
        order.setUpdateTime(Instant.now().getEpochSecond());

        if ("CANCELLED".equalsIgnoreCase(newStatus) || "IN_CANCEL".equalsIgnoreCase(newStatus)) {
            order.setCancelReason(cancelReason != null ? cancelReason : "Người mua đổi ý");
            order.setCancelUser(cancelUser != null ? cancelUser : "BUYER");

            // Nếu hủy đơn và trạng thái cũ chưa hủy -> hoàn lại tồn kho trên sàn
            if (!"CANCELLED".equalsIgnoreCase(oldStatus)) {
                try {
                    List<ShopeeOrderDto.ShopeeOrderItemDto> items = objectMapper.readValue(
                            order.getItemsJson(), new TypeReference<List<ShopeeOrderDto.ShopeeOrderItemDto>>() {});
                    for (ShopeeOrderDto.ShopeeOrderItemDto it : items) {
                        productRepository.findByItemIdAndModelId(it.getItemId(), it.getModelId()).ifPresent(p -> {
                            p.setStockQuantity(p.getStockQuantity() + (it.getModelQuantityPurchased() != null ? it.getModelQuantityPurchased() : 1));
                            productRepository.save(p);
                        });
                    }
                } catch (Exception e) {
                    log.warn("[SHOPEE-MOCK] Không thể hoàn tồn khi hủy đơn {}: {}", orderSn, e.getMessage());
                }
            }
        }

        return orderRepository.save(order);
    }

    /**
     * Trả về danh sách ShopeeOrderDto cho ShopeeClient và OmnichannelOrderSyncJob kéo đơn về FCentric.
     */
    @Transactional
    public List<ShopeeOrderDto> getOrdersForSync(String status, Long timeFrom) {
        initMockProductsIfEmpty();

        List<ShopeeMockOrder> orders;
        if (status != null && !status.isBlank()) {
            orders = orderRepository.findByOrderStatusOrderByCreateTimeDesc(status.toUpperCase());
        } else {
            orders = orderRepository.findAllByOrderByCreateTimeDesc();
        }

        // Nếu chưa có đơn nào từ Buyer đặt, tự động sinh 2 đơn mẫu để sẵn sàng sync
        if (orders.isEmpty()) {
            generateMockOrders(2, "READY_TO_SHIP");
            orders = orderRepository.findAllByOrderByCreateTimeDesc();
        }

        List<ShopeeOrderDto> dtos = new ArrayList<>();
        for (ShopeeMockOrder o : orders) {
            List<ShopeeOrderDto.ShopeeOrderItemDto> items = new ArrayList<>();
            try {
                items = objectMapper.readValue(o.getItemsJson(), new TypeReference<List<ShopeeOrderDto.ShopeeOrderItemDto>>() {});
            } catch (Exception ignored) {}

            ShopeeOrderDto dto = ShopeeOrderDto.builder()
                    .orderSn(o.getOrderSn())
                    .orderStatus(o.getOrderStatus())
                    .createTime(o.getCreateTime())
                    .updateTime(o.getUpdateTime())
                    .totalAmount(o.getTotalAmount() != null ? o.getTotalAmount().doubleValue() : 0.0)
                    .actualShippingFee(o.getShippingFee() != null ? o.getShippingFee().doubleValue() : 25000.0)
                    .paymentMethod(o.getPaymentMethod())
                    .buyerUserId(1000000L + Math.abs(o.getOrderSn().hashCode() % 9000000))
                    .shippingCarrier(o.getShippingCarrier())
                    .trackingNumber(o.getTrackingNumber())
                    .cancelReason(o.getCancelReason())
                    .cancelUser(o.getCancelUser())
                    .recipientAddress(ShopeeOrderDto.ShopeeRecipientAddressDto.builder()
                            .name(o.getBuyerName())
                            .phone(o.getBuyerPhone())
                            .fullAddress(o.getShippingAddress())
                            .district("Quận Ba Đình")
                            .city("Hà Nội")
                            .state("Việt Nam")
                            .build())
                    .itemList(items)
                    .build();

            dtos.add(dto);
        }

        return dtos;
    }

    /**
     * Sinh danh sách đơn hàng Shopee mẫu lưu trực tiếp vào CSDL shopee_mock_order.
     */
    @Transactional
    public List<ShopeeOrderDto> generateMockOrders(int count, String defaultStatus) {
        initMockProductsIfEmpty();
        List<ShopeeMockProduct> products = productRepository.findAll();
        if (products.isEmpty()) {
            return List.of();
        }

        long now = Instant.now().getEpochSecond();
        for (int i = 0; i < count; i++) {
            ShopeeMockProduct p1 = products.get(random.nextInt(products.size()));
            int qty1 = 1 + random.nextInt(2);
            buyerCheckout(p1.getItemId(), p1.getModelId(), qty1,
                    KHACH_HANG_MAU[random.nextInt(KHACH_HANG_MAU.length)],
                    "09" + String.format("%08d", random.nextInt(100000000)),
                    DIA_CHI_MAU[random.nextInt(DIA_CHI_MAU.length)],
                    random.nextBoolean() ? "CASH_ON_DELIVERY" : "SHOPEE_PAY");
        }

        return getOrdersForSync(defaultStatus, now - 86400L);
    }

    /**
     * Đặt lại toàn bộ dữ liệu sàn Shopee Sandbox về mặc định.
     */
    @Transactional
    public void resetSandboxData() {
        orderRepository.deleteAll();
        productRepository.deleteAll();
        initMockProductsIfEmpty();
        log.info("[SHOPEE-MOCK] Đã thiết lập lại toàn bộ dữ liệu sàn Shopee Sandbox");
    }

    /**
     * Tra cứu trạng thái ủy quyền hiện tại của Ứng dụng FCentric trên gian hàng Shopee Mock.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getAppAuthStatus() {
        Optional<com.dev.backend.entities.KenhBanHang> opt = kenhBanHangRepository.findByMaKenh("SHOPEE_SANDBOX");
        if (opt.isEmpty()) {
            opt = kenhBanHangRepository.findByMaKenh("SHOPEE");
        }

        boolean isAuthorized = false;
        String appName = "FCentric Omnichannel Hub & WMS";
        long partnerId = 1000888L;
        String developerName = "FCentric Technology JSC";
        String shopName = "FCentric Official Store";
        long shopId = 10892019L;
        long authorizedAt = Instant.now().getEpochSecond() - 86400L;
        long expireAt = Instant.now().getEpochSecond() + (365L * 86400L);

        if (opt.isPresent()) {
            com.dev.backend.entities.KenhBanHang kenh = opt.get();
            if (Objects.equals(kenh.getTrangThai(), 1)) {
                isAuthorized = true;
                if (kenh.getTenKenh() != null && !kenh.getTenKenh().isBlank()) {
                    shopName = kenh.getTenKenh();
                }
            }
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("isAuthorized", isAuthorized);
        res.put("appName", appName);
        res.put("partnerId", partnerId);
        res.put("developerName", developerName);
        res.put("shopName", shopName);
        res.put("shopId", shopId);
        res.put("authorizedAt", authorizedAt);
        res.put("expireAt", expireAt);

        List<Map<String, String>> scopes = List.of(
                Map.of("code", "product", "name", "Quản lý sản phẩm & tồn kho", "desc", "Đồng bộ danh mục, cập nhật số lượng tồn kho tự động theo thời gian thực"),
                Map.of("code", "order", "name", "Quản lý đơn hàng", "desc", "Đọc đơn hàng mới, cập nhật trạng thái đơn và đồng bộ hủy đơn hai chiều"),
                Map.of("code", "logistics", "name", "Hậu cần & Vận chuyển SPX", "desc", "Cấp mã vận đơn Shopee Xpress, in tem nhãn nhiệt A6 chuẩn sàn"),
                Map.of("code", "payment", "name", "Quyết toán ví Shopee & Escrow", "desc", "Bóc tách doanh thu thực nhận, phí cố định và phí dịch vụ sàn")
        );
        res.put("scopes", scopes);
        return res;
    }

    /**
     * Thu hồi quyền ủy quyền của ứng dụng FCentric từ phía Kênh Người Bán Shopee (Deauthorize).
     */
    @Transactional
    public boolean revokeAppAuth() {
        Optional<com.dev.backend.entities.KenhBanHang> opt = kenhBanHangRepository.findByMaKenh("SHOPEE_SANDBOX");
        if (opt.isPresent()) {
            com.dev.backend.entities.KenhBanHang kenh = opt.get();
            kenh.setTrangThai(0);
            kenhBanHangRepository.save(kenh);
            log.info("[SHOPEE-MOCK-AUTH] Gian hàng Shopee đã thu hồi quyền ủy quyền của ứng dụng FCentric");
            return true;
        }
        return false;
    }

    /**
     * Lấy danh sách Item ID cho ShopeeClient Sandbox.
     */
    @Transactional(readOnly = true)
    public List<Long> getMockItemIds() {
        initMockProductsIfEmpty();
        return productRepository.findAll().stream()
                .map(ShopeeMockProduct::getItemId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    /**
     * Lấy thông tin sản phẩm cha theo danh sách Item ID.
     */
    @Transactional(readOnly = true)
    public List<ShopeeMockProduct> getMockProductsByItemIds(List<Long> itemIds) {
        initMockProductsIfEmpty();
        if (itemIds == null || itemIds.isEmpty()) return productRepository.findAll();
        return productRepository.findAll().stream()
                .filter(p -> itemIds.contains(p.getItemId()))
                .toList();
    }

    /**
     * Lấy danh sách biến thể theo Item ID.
     */
    @Transactional(readOnly = true)
    public List<ShopeeMockProduct> getMockModelsByItemId(Long itemId) {
        initMockProductsIfEmpty();
        return productRepository.findAll().stream()
                .filter(p -> Objects.equals(p.getItemId(), itemId))
                .toList();
    }
}
