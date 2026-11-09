package com.dev.backend.services.shopee;

import com.dev.backend.i18n.LoiChungException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.dto.response.customize.ShopeeOrderDto;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.ShopeeMockOrder;
import com.dev.backend.entities.ShopeeMockProduct;
import com.dev.backend.repository.BienTheSanPhamRepository;
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
    @Transactional(readOnly = true)
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
    @Transactional(readOnly = true)
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
                .orElseThrow(() -> new LoiChungException(ThongDiep.of("kenhBan.sanPhamKhongTonTaiTrenSan")));

        if (prod.getStockQuantity() < quantity) {
            throw new LoiChungException(ThongDiep.of("kenhBan.tonTrenSanKhongDu", prod.getStockQuantity(), quantity));
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
                .orElseThrow(() -> new LoiChungException(ThongDiep.of("kenhBan.donShopeeKhongTonTai", orderSn)));

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
    @Transactional(readOnly = true)
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
}
