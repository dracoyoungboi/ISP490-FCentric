package com.dev.backend.services.shopee;

import com.dev.backend.dto.response.customize.ShopeeOrderDto;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.repository.BienTheSanPhamRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Động cơ giả lập Shopee Sandbox nội bộ (Shopee In-System Mock Engine).
 * Tự động tạo các đơn hàng Shopee sinh động gắn trực tiếp với SKU biến thể thực tế trong CSDL FCentric.
 */
@Service
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ShopeeMockEngine {

    BienTheSanPhamRepository bienTheSanPhamRepository;
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
     * Sinh danh sách đơn hàng Shopee mẫu với các biến thể thực tế từ database.
     */
    public List<ShopeeOrderDto> generateMockOrders(int count, String defaultStatus) {
        List<BienTheSanPham> samples = bienTheSanPhamRepository.findAll(PageRequest.of(0, 10)).getContent();
        if (samples.isEmpty()) {
            log.warn("[SHOPEE-MOCK] CSDL chưa có biến thể sản phẩm, không thể sinh đơn Shopee mẫu");
            return List.of();
        }

        List<ShopeeOrderDto> result = new ArrayList<>();
        long now = Instant.now().getEpochSecond();

        for (int i = 0; i < count; i++) {
            String suffix = String.format("%04d", random.nextInt(10000));
            String charPart = String.valueOf((char) ('A' + random.nextInt(26)));
            String orderSn = "241105" + System.currentTimeMillis() % 100000L + suffix + charPart;

            String khach = KHACH_HANG_MAU[random.nextInt(KHACH_HANG_MAU.length)];
            String sdt = "09" + String.format("%08d", random.nextInt(100000000));
            String diaChi = DIA_CHI_MAU[random.nextInt(DIA_CHI_MAU.length)];

            // Chọn 1-2 biến thể ngẫu nhiên
            BienTheSanPham bt1 = samples.get(random.nextInt(samples.size()));
            double price1 = bt1.getGiaBan() != null ? bt1.getGiaBan().doubleValue() : 250000.0;
            int qty1 = 1 + random.nextInt(2);

            List<ShopeeOrderDto.ShopeeOrderItemDto> items = new ArrayList<>();
            items.add(ShopeeOrderDto.ShopeeOrderItemDto.builder()
                    .itemId(100000L + random.nextInt(900000))
                    .itemName(bt1.getSanPham() != null ? bt1.getSanPham().getTenSanPham() : "Sản phẩm FCentric Shopee")
                    .itemSku(bt1.getMaSku())
                    .modelId(200000L + random.nextInt(900000))
                    .modelName(bt1.getMaSku())
                    .modelSku(bt1.getMaSku())
                    .modelQuantityPurchased(qty1)
                    .modelDiscountedPrice(price1)
                    .build());

            double subtotal = price1 * qty1;

            // Nếu đơn thứ 2 trở lên, thỉnh thoảng thêm 1 món nữa
            if (i > 0 && samples.size() > 1 && random.nextBoolean()) {
                BienTheSanPham bt2 = samples.get(random.nextInt(samples.size()));
                double price2 = bt2.getGiaBan() != null ? bt2.getGiaBan().doubleValue() : 180000.0;
                int qty2 = 1;
                items.add(ShopeeOrderDto.ShopeeOrderItemDto.builder()
                        .itemId(100000L + random.nextInt(900000))
                        .itemName(bt2.getSanPham() != null ? bt2.getSanPham().getTenSanPham() : "Sản phẩm FCentric Shopee")
                        .itemSku(bt2.getMaSku())
                        .modelId(200000L + random.nextInt(900000))
                        .modelName(bt2.getMaSku())
                        .modelSku(bt2.getMaSku())
                        .modelQuantityPurchased(qty2)
                        .modelDiscountedPrice(price2)
                        .build());
                subtotal += price2 * qty2;
            }

            double shippingFee = 25000.0;
            double voucherDiscount = 15000.0;
            double total = Math.max(0.0, subtotal + shippingFee - voucherDiscount);

            String status = defaultStatus != null ? defaultStatus : "READY_TO_SHIP";
            String cancelReason = null;
            String cancelUser = null;

            // Nếu là đơn thứ 2, giả lập có yêu cầu hủy đơn từ người mua (để kiểm thử chốt chặn Wave Picking)
            if (i == 1) {
                cancelReason = "Khách hàng đổi ý muốn đổi địa chỉ giao hàng";
                cancelUser = "BUYER";
            }

            String trackingNumber = "SPXVN0" + String.format("%08d", random.nextInt(100000000)) + "B";

            ShopeeOrderDto order = ShopeeOrderDto.builder()
                    .orderSn(orderSn)
                    .orderStatus(status)
                    .createTime(now - (3600L * (i + 1)))
                    .updateTime(now - (300L * (i + 1)))
                    .totalAmount(total)
                    .actualShippingFee(shippingFee)
                    .paymentMethod(random.nextBoolean() ? "CASH_ON_DELIVERY" : "SHOPEE_PAY")
                    .buyerUserId(1000000L + random.nextInt(9000000))
                    .shippingCarrier("Shopee Xpress")
                    .trackingNumber(trackingNumber)
                    .cancelReason(cancelReason)
                    .cancelUser(cancelUser)
                    .recipientAddress(ShopeeOrderDto.ShopeeRecipientAddressDto.builder()
                            .name(khach + " (Shopee)")
                            .phone(sdt)
                            .fullAddress(diaChi)
                            .district("Quận Ba Đình")
                            .city("Hà Nội")
                            .state("Việt Nam")
                            .build())
                    .itemList(items)
                    .build();

            result.add(order);
        }
        return result;
    }
}

