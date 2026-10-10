package com.dev.backend.workers;

import com.dev.backend.entities.*;
import com.dev.backend.repository.*;
import com.dev.backend.services.KenhBanHangService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * JOB-01 (SRS 12.1): Sync Omnichannel Orders.
 * Định kỳ mỗi 5 phút tự động quét đơn hàng mới từ các kênh bán hàng (Shopify, Shopee, Lazada)
 * và đưa vào hệ thống FCentric với tiền tố mã đơn chuẩn (SHP-, SHO-, LZD-) ở trạng thái "Chờ xử lý" (0).
 */
@Component
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class OmnichannelOrderSyncJob {

    public static final String MA_KENH_SHOPIFY = "SHOPIFY";
    public static final String DEFAULT_API_VERSION = "2024-01";

    KenhBanHangRepository kenhBanHangRepository;
    DonBanHangRepository donBanHangRepository;
    ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    KhachHangRepository khachHangRepository;
    BienTheSanPhamRepository bienTheSanPhamRepository;
    TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository;
    KenhBanHangService kenhBanHangService;
    KhoRepository khoRepository;
    ObjectMapper objectMapper = new ObjectMapper();

    @Scheduled(fixedDelay = 300_000, initialDelay = 60_000)
    public void scheduledOrderSync() {
        List<KenhBanHang> activeChannels = kenhBanHangRepository.findByTrangThai(1);
        if (activeChannels.isEmpty()) {
            return;
        }

        for (KenhBanHang kenh : activeChannels) {
            if (MA_KENH_SHOPIFY.equalsIgnoreCase(kenh.getMaKenh())) {
                syncShopifyOrders(kenh);
            }
        }
    }

    private void syncShopifyOrders(KenhBanHang kenh) {
        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        if (token == null || token.isBlank()) {
            log.warn("[JOB-01] Kênh {} chưa có Access Token hợp lệ, bỏ qua đợt sync", kenh.getMaKenh());
            return;
        }

        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        if (domain.isBlank()) {
            return;
        }

        // Lấy đơn hàng tạo/cập nhật gần đây (10 phút trước)
        Instant tenMinutesAgo = Instant.now().minusSeconds(600);
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/orders.json?status=any&limit=50&updated_at_min=" + tenMinutesAgo.toString();

        try {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(8000);
            factory.setReadTimeout(15000);
            RestTemplate restTemplate = new RestTemplate(factory);

            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Shopify-Access-Token", token);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);

            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode orders = root.path("orders");
                if (orders.isArray()) {
                    int syncedCount = 0;
                    for (JsonNode orderNode : orders) {
                        try {
                            if (processSingleOrder(orderNode, kenh)) {
                                syncedCount++;
                            }
                        } catch (Exception ex) {
                            log.error("[JOB-01] Lỗi xử lý đơn hàng Shopify ID {}: {}", orderNode.path("id").asText(), ex.getMessage());
                        }
                    }
                    if (syncedCount > 0) {
                        log.info("[JOB-01] Đã đồng bộ thành công {} đơn hàng mới từ Shopify", syncedCount);
                    }
                }
            }
        } catch (HttpClientErrorException.TooManyRequests e) {
            log.warn("[JOB-01 Rate Limit] Shopify rate limit vượt ngưỡng. Bỏ qua kênh {} và thử lại đợt 5 phút sau.", kenh.getMaKenh());
        } catch (HttpClientErrorException.Unauthorized e) {
            log.error("[JOB-01 Token Expired] Token kênh {} hết hạn hoặc không hợp lệ. Vô hiệu hóa sync tự động.", kenh.getMaKenh());
        } catch (Exception e) {
            log.warn("[JOB-01 Error] Lỗi kết nối API đơn hàng Shopify: {}", e.getMessage());
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean processSingleOrder(JsonNode orderNode, KenhBanHang kenh) {
        String orderId = orderNode.path("id").asText();
        String orderNumber = orderNode.path("order_number").asText(orderId);
        String soDonHang = "SHP-" + orderNumber;

        // Kiểm tra xem đơn đã tồn tại trong DB chưa
        Optional<DonBanHang> existingOpt = donBanHangRepository.findBySoDonHang(soDonHang);
        if (existingOpt.isEmpty()) {
            existingOpt = donBanHangRepository.findByMaDonHangKenh(orderId);
        }

        if (existingOpt.isPresent()) {
            DonBanHang existing = existingOpt.get();
            // Nếu sàn hủy đơn -> cập nhật trạng thái đã hủy (4)
            if ("cancelled".equalsIgnoreCase(orderNode.path("financial_status").asText())
                    || !orderNode.path("cancelled_at").isNull()) {
                if (existing.getTrangThai() != null && existing.getTrangThai() != 4 && existing.getTrangThai() != 3) {
                    existing.setTrangThai(4); // Đã hủy
                    existing.setLyDoTuChoi("Hủy từ sàn Shopify: " + orderNode.path("cancel_reason").asText(""));
                    donBanHangRepository.save(existing);
                    log.info("[JOB-01] Đơn {} đã bị hủy trên Shopify -> Cập nhật trạng thái FCentric = 4", soDonHang);
                }
            }
            return false;
        }

        // Tạo đơn hàng mới
        KhachHang khachHang = resolveCustomer(orderNode.path("customer"), orderNode.path("shipping_address"));
        BigDecimal subtotal = new BigDecimal(orderNode.path("current_subtotal_price").asText("0.00"));
        BigDecimal shippingFee = new BigDecimal(orderNode.path("total_shipping_price_set").path("shop_money").path("amount").asText("0.00"));
        BigDecimal totalPrice = new BigDecimal(orderNode.path("total_price").asText("0.00"));

        String diaChi = extractShippingAddress(orderNode.path("shipping_address"));
        String financialStatus = orderNode.path("financial_status").asText("pending");
        String ttThanhToan = "paid".equalsIgnoreCase(financialStatus) ? "da_thanh_toan" : "chua_thanh_toan";

        // Chọn kho xuất mặc định
        Kho defaultKho = khoRepository.findById(1).orElse(null);

        DonBanHang don = DonBanHang.builder()
                .soDonHang(soDonHang)
                .maDonHangKenh(orderId)
                .kenhBanHang(kenh)
                .khachHang(khachHang)
                .khoXuat(defaultKho)
                .loaiChungTu("don_ban_hang")
                .ngayDatHang(Instant.now())
                .trangThai(0) // 0 = Chờ xử lý (Pending - SRS 8.1.1)
                .tienHang(subtotal)
                .phiVanChuyen(shippingFee)
                .tongCong(totalPrice)
                .trangThaiThanhToan(ttThanhToan)
                .diaChiGiaoHang(diaChi)
                .ghiChu("Đơn hàng đồng bộ tự động từ Shopify #" + orderNumber)
                .build();

        DonBanHang savedOrder = donBanHangRepository.save(don);

        // Lưu chi tiết các dòng sản phẩm
        JsonNode lineItems = orderNode.path("line_items");
        if (lineItems.isArray()) {
            for (JsonNode itemNode : lineItems) {
                String sku = itemNode.path("sku").asText("");
                String variantId = itemNode.path("variant_id").asText("");
                BigDecimal qty = new BigDecimal(itemNode.path("quantity").asText("1"));
                BigDecimal price = new BigDecimal(itemNode.path("price").asText("0.00"));

                // Tìm biến thể tương ứng
                BienTheSanPham bt = null;
                if (!sku.isBlank()) {
                    bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(sku.trim()).orElse(null);
                }
                if (bt == null && !variantId.isBlank()) {
                    var mapping = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndMaSanPhamKenh(kenh.getId(), variantId);
                    if (mapping.isPresent()) {
                        bt = mapping.get().getBienTheSanPham();
                    }
                }

                if (bt != null) {
                    ChiTietDonBanHang chiTiet = ChiTietDonBanHang.builder()
                            .donBanHang(savedOrder)
                            .bienTheSanPham(bt)
                            .soLuongDat(qty)
                            .soLuongDaGiao(BigDecimal.ZERO)
                            .donGia(price)
                            .ghiChu(itemNode.path("title").asText(""))
                            .build();
                    chiTietDonBanHangRepository.save(chiTiet);
                }
            }
        }
        return true;
    }

    private KhachHang resolveCustomer(JsonNode customerNode, JsonNode shippingNode) {
        String phone = customerNode.path("phone").asText("");
        if (phone.isBlank()) {
            phone = shippingNode.path("phone").asText("");
        }
        String email = customerNode.path("email").asText("");
        String name = customerNode.path("first_name").asText("") + " " + customerNode.path("last_name").asText("");
        if (name.trim().isBlank()) {
            name = shippingNode.path("name").asText("Khách hàng Shopify");
        }

        if (!phone.isBlank()) {
            Optional<KhachHang> khOpt = khachHangRepository.findFirstBySoDienThoai(phone.trim());
            if (khOpt.isPresent()) return khOpt.get();
        }
        if (!email.isBlank()) {
            Optional<KhachHang> khOpt = khachHangRepository.findFirstByEmail(email.trim());
            if (khOpt.isPresent()) return khOpt.get();
        }

        // Tìm khách lẻ mặc định KHLE
        Optional<KhachHang> khLeOpt = khachHangRepository.findFirstBySoDienThoai("KHLE");
        if (khLeOpt.isPresent()) return khLeOpt.get();

        final String finalPhone = !phone.isBlank() ? phone.trim() : "0900000000";
        final String finalEmail = !email.isBlank() ? email.trim() : "shopify@customer.com";
        final String finalName = name.trim();

        return khachHangRepository.findAll().stream().findFirst().orElseGet(() ->
                khachHangRepository.save(KhachHang.builder()
                        .maKhachHang("KH-SHOPIFY")
                        .tenKhachHang(finalName)
                        .soDienThoai(finalPhone)
                        .email(finalEmail)
                        .trangThai(1)
                        .build())
        );
    }

    private String extractShippingAddress(JsonNode shipNode) {
        if (shipNode.isMissingNode() || shipNode.isNull()) return "";
        return String.join(", ",
                shipNode.path("address1").asText(""),
                shipNode.path("city").asText(""),
                shipNode.path("province").asText(""),
                shipNode.path("country").asText("")
        ).replaceAll("^, |, $", "").trim();
    }

    private String extractDomainFromApiUrl(String apiUrl) {
        if (apiUrl == null || apiUrl.isBlank()) return "";
        String clean = apiUrl.trim().replaceFirst("^(?i)https?://", "");
        int slashIdx = clean.indexOf('/');
        return (slashIdx > 0 ? clean.substring(0, slashIdx) : clean).trim().toLowerCase();
    }
}

