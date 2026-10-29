package com.dev.backend.workers;

import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.repository.*;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.lazada.LazadaClient;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.services.multitable.NhatHangService;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.services.impl.entities.DonBanHangService;
import com.dev.backend.services.impl.entities.KhoService;
import com.dev.backend.utils.KenhCauHinhDongBo;
import com.dev.backend.dto.response.customize.TikTokOrderDto;
import com.dev.backend.dto.response.customize.TikTokOrderItemDto;
import com.dev.backend.dto.response.customize.TikTokRecipientAddressDto;
import com.dev.backend.utils.TikTokOrderMapper;
import com.dev.backend.services.tiktok.TikTokShopClient;
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
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

/**
 * JOB-01 (SRS 12.1): Sync Omnichannel Orders.
 * Quét đơn hàng mới từ các kênh bán hàng (Shopify, Shopee, Lazada)
 * và đưa vào hệ thống FCentric với tiền tố mã đơn chuẩn (SHP-, SHO-, LZD-) ở trạng thái "Chờ xử lý" (0).
 * Chu kỳ quét chạy ĐỘNG theo cấu hình OMNI_SYNC_INTERVAL_MINS (mặc định 10 phút).
 */
@Component
@Slf4j

@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class OmnichannelOrderSyncJob {

    public static final String MA_KENH_SHOPIFY = "SHOPIFY";
    public static final String DEFAULT_API_VERSION = "2024-01";
    public static final String MA_KENH_LAZADA = "LAZADA";
    public static final String MA_KENH_TIKTOK = "TIKTOK";

    KenhBanHangRepository kenhBanHangRepository;
    DonBanHangRepository donBanHangRepository;
    ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    KhachHangRepository khachHangRepository;
    BienTheSanPhamRepository bienTheSanPhamRepository;
    TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository;
    KenhBanHangService kenhBanHangService;
    KhoRepository khoRepository;
    NhatHangService nhatHangService;
    PhieuXuatKhoRepository phieuXuatKhoRepository;
    DieuHanhHeThongService dieuHanhHeThongService;
    DonBanHangService donBanHangService;
    LazadaClient lazadaClient;
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    TikTokShopClient tiktokShopClient;
    ObjectMapper objectMapper = new ObjectMapper();
    AtomicReference<Instant> lastSyncTime = new AtomicReference<>(Instant.EPOCH);
    // Lần gọi API đơn hàng của sàn thành công gần nhất, theo id kênh (màn Theo dõi đồng bộ)
    Map<Integer, Instant> lanLayDonCuoi = new ConcurrentHashMap<>();

    @org.springframework.beans.factory.annotation.Autowired
    public OmnichannelOrderSyncJob(
            KenhBanHangRepository kenhBanHangRepository,
            DonBanHangRepository donBanHangRepository,
            ChiTietDonBanHangRepository chiTietDonBanHangRepository,
            KhachHangRepository khachHangRepository,
            BienTheSanPhamRepository bienTheSanPhamRepository,
            TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository,
            KenhBanHangService kenhBanHangService,
            KhoRepository khoRepository,
            NhatHangService nhatHangService,
            PhieuXuatKhoRepository phieuXuatKhoRepository,
            DieuHanhHeThongService dieuHanhHeThongService,
            DonBanHangService donBanHangService,
            @org.springframework.beans.factory.annotation.Autowired(required = false) LazadaClient lazadaClient) {
        this.kenhBanHangRepository = kenhBanHangRepository;
        this.donBanHangRepository = donBanHangRepository;
        this.chiTietDonBanHangRepository = chiTietDonBanHangRepository;
        this.khachHangRepository = khachHangRepository;
        this.bienTheSanPhamRepository = bienTheSanPhamRepository;
        this.trangThaiDongBoSanPhamRepository = trangThaiDongBoSanPhamRepository;
        this.kenhBanHangService = kenhBanHangService;
        this.khoRepository = khoRepository;
        this.nhatHangService = nhatHangService;
        this.phieuXuatKhoRepository = phieuXuatKhoRepository;
        this.dieuHanhHeThongService = dieuHanhHeThongService;
        this.donBanHangService = donBanHangService;
        this.lazadaClient = lazadaClient != null ? lazadaClient : new LazadaClient();
    }

    public OmnichannelOrderSyncJob(
            KenhBanHangRepository kenhBanHangRepository,
            DonBanHangRepository donBanHangRepository,
            ChiTietDonBanHangRepository chiTietDonBanHangRepository,
            KhachHangRepository khachHangRepository,
            BienTheSanPhamRepository bienTheSanPhamRepository,
            TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository,
            KenhBanHangService kenhBanHangService,
            KhoRepository khoRepository,
            NhatHangService nhatHangService,
            PhieuXuatKhoRepository phieuXuatKhoRepository,
            DieuHanhHeThongService dieuHanhHeThongService,
            DonBanHangService donBanHangService) {
        this(kenhBanHangRepository, donBanHangRepository, chiTietDonBanHangRepository,
                khachHangRepository, bienTheSanPhamRepository, trangThaiDongBoSanPhamRepository,
                kenhBanHangService, khoRepository, nhatHangService, phieuXuatKhoRepository,
                dieuHanhHeThongService, donBanHangService, null);
    }

    /** Chu kỳ quét đơn (phút) theo cấu hình OMNI_SYNC_INTERVAL_MINS, giới hạn 1..1440. */
    public int getChuKyPhut() {
        int intervalMins = 10;
        if (dieuHanhHeThongService != null) {
            intervalMins = dieuHanhHeThongService.getCauHinhInt("OMNI_SYNC_INTERVAL_MINS", 10);
        }
        return Math.max(1, Math.min(intervalMins, 1440));
    }

    /** Thời điểm lấy đơn thành công gần nhất của kênh; null nếu chưa lấy được lần nào từ khi khởi động. */
    public Instant getLanLayDonCuoi(Integer kenhId) {
        return kenhId == null ? null : lanLayDonCuoi.get(kenhId);
    }

    /** Quên mốc lấy đơn của kênh (sau khi ngắt kết nối), để Tổng quan không hiện giờ của cửa hàng cũ. */
    public void xoaLanLayDonCuoi(Integer kenhId) {
        if (kenhId != null) {
            lanLayDonCuoi.remove(kenhId);
        }
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void scheduledOrderSync() {
        int intervalMins = getChuKyPhut();

        Instant last = lastSyncTime.get();
        Instant now = Instant.now();
        if (last != Instant.EPOCH && Duration.between(last, now).toMinutes() < intervalMins) {
            return;
        }

        lastSyncTime.set(now);
        List<KenhBanHang> activeChannels = kenhBanHangRepository.findByTrangThai(1);
        if (activeChannels.isEmpty()) {
            return;
        }

        log.info("[JOB-01 Heartbeat] Bắt đầu quét đơn hàng mới từ các kênh bán (Chu kỳ cấu hình: {} phút)", intervalMins);
        for (KenhBanHang kenh : activeChannels) {
            if (MA_KENH_SHOPIFY.equalsIgnoreCase(kenh.getMaKenh())) {
                // Cấu hình theo kênh; chưa lưu thì mặc định bật như trước
                if (!KenhCauHinhDongBo.tuDongLayDon(dieuHanhHeThongService, kenh.getMaKenh())) {
                    log.info("[JOB-01] Kênh {} đang tắt tự động lấy đơn, bỏ qua", kenh.getMaKenh());
                    continue;
                }
                try {
                    syncShopifyOrders(kenh, intervalMins);
                } catch (LoiCoMaException e) {
                    log.warn("[JOB-01] Kênh {} bỏ qua đợt lấy đơn: {}", kenh.getMaKenh(), e.getMessage());
                }
            } else if (MA_KENH_LAZADA.equalsIgnoreCase(kenh.getMaKenh())) {
                if (!KenhCauHinhDongBo.tuDongLayDon(dieuHanhHeThongService, kenh.getMaKenh())) {
                    log.info("[JOB-01] Kênh {} đang tắt tự động lấy đơn, bỏ qua", kenh.getMaKenh());
                    continue;
                }
                syncLazadaOrders(kenh, intervalMins);
            }
        }
    }

    public int syncShopifyOrders(KenhBanHang kenh) {
        return syncShopifyOrders(kenh, getChuKyPhut());
    }

    public int syncShopifyOrders(KenhBanHang kenh, int intervalMins) {
        int bufferMinutes = Math.max(intervalMins + 5, 10);
        return syncShopifyOrders(kenh, Instant.now().minus(Duration.ofMinutes(bufferMinutes)), null);
    }

    public int syncShopifyOrders(KenhBanHang kenh, Instant tuNgay, Instant denNgay) {
        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        if (token == null || token.isBlank()) {
            log.warn("[JOB-01] Kênh {} chưa có Access Token hợp lệ, bỏ qua đợt sync", kenh.getMaKenh());
            return 0;
        }

        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        if (domain.isBlank()) {
            return 0;
        }

        StringBuilder urlBuilder = new StringBuilder("https://")
                .append(domain)
                .append("/admin/api/")
                .append(DEFAULT_API_VERSION)
                .append("/orders.json?status=any&limit=50");

        if (tuNgay != null) {
            urlBuilder.append("&updated_at_min=").append(tuNgay.toString());
        }
        if (denNgay != null) {
            urlBuilder.append("&updated_at_max=").append(denNgay.toString());
        }
        String url = urlBuilder.toString();

        int syncedCount = 0;
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
                if (kenh.getId() != null) {
                    lanLayDonCuoi.put(kenh.getId(), Instant.now());
                }
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode orders = root.path("orders");
                if (orders.isArray()) {
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
        return syncedCount;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean processSingleOrder(JsonNode orderNode, KenhBanHang kenh) {
        String orderId = orderNode.path("id").asText();
        String orderNumber = orderNode.path("order_number").asText(orderId);
        String soDonHang = "SHP-" + orderNumber;

        // Đơn đã có: tìm theo id đơn Shopify trước (duy nhất trên toàn Shopify). Số đơn hiển thị thì mỗi cửa hàng
        // đánh số riêng (từ #1001), nên sau khi đổi sang cửa hàng khác, SHP-<số> có thể là đơn của cửa hàng cũ
        Optional<DonBanHang> existingOpt = kenh.getId() != null
                ? donBanHangRepository.findByKenhBanHangIdAndMaDonHangKenh(kenh.getId(), orderId)
                : Optional.empty();
        if (existingOpt.isEmpty()) {
            existingOpt = donBanHangRepository.findByMaDonHangKenh(orderId);
        }
        if (existingOpt.isEmpty()) {
            Optional<DonBanHang> trungSo = donBanHangRepository.findBySoDonHang(soDonHang);
            if (trungSo.isPresent()) {
                String maCu = trungSo.get().getMaDonHangKenh();
                if (maCu == null || maCu.isBlank() || maCu.equals(orderId)) {
                    // Đơn cũ chưa lưu id trên sàn: coi là cùng đơn như trước, không sinh đơn trùng
                    existingOpt = trungSo;
                } else {
                    soDonHang = soDonHangKhongTrung(soDonHang, orderId);
                    log.info("[JOB-01] {} đã thuộc đơn Shopify khác (cửa hàng cũ), đơn {} lấy số {}", "SHP-" + orderNumber, orderId, soDonHang);
                }
            }
        }

        if (existingOpt.isPresent()) {
            DonBanHang existing = existingOpt.get();
            // Nếu sàn hủy đơn -> cập nhật trạng thái đã hủy (4)
            if ("cancelled".equalsIgnoreCase(orderNode.path("financial_status").asText())
                    || !orderNode.path("cancelled_at").isNull()) {
                // Xử lý trong giao dịch riêng của DonBanHangService (nạp lại đơn, phiếu nhặt, phiếu xuất) — không
                // truyền entity tách rời. Đơn đã xuất / hoàn thành / hoàn trả được giữ nguyên, chỉ ghi nhật ký.
                if (existing.getTrangThai() != null && existing.getTrangThai() != ITrangThaiDonBanHang.DA_HUY) {
                    try {
                        boolean daHuy = donBanHangService.huyDonTuSan(existing.getId(),
                                "Hủy từ sàn Shopify: " + orderNode.path("cancel_reason").asText(""));
                        if (daHuy) {
                            log.info("[JOB-01] Đơn {} đã bị hủy trên Shopify -> Cập nhật trạng thái FCentric = 4", soDonHang);
                        }
                    } catch (Exception ex) {
                        log.error("[JOB-01] Lỗi khi hủy đơn {} theo sàn (giữ nguyên, thử lại lượt sau): {}", soDonHang, ex.getMessage());
                    }
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
        // Kho tạm cho đơn sàn: Kho tổng đang hoạt động; nhân viên bán hàng định tuyến lại bằng "Gửi sang kho".
        List<Kho> khoHoatDong = khoRepository.findByTrangThai(1);
        Kho defaultKho = khoHoatDong.stream().filter(KhoService::laKhoTong).findFirst()
                .orElse(khoHoatDong.stream().filter(k -> !KhoService.laKhoAo(k)).findFirst().orElse(null));

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

    /** Số đơn khi SHP-&lt;số&gt; đã thuộc đơn khác: thêm 4 số cuối id đơn Shopify, vẫn trùng thì thêm cả id (cột UNIQUE, 50 ký tự). */
    String soDonHangKhongTrung(String soDonHang, String orderId) {
        String duoi = orderId.length() > 4 ? orderId.substring(orderId.length() - 4) : orderId;
        String ung = soDonHang + "-" + duoi;
        if (donBanHangRepository.findBySoDonHang(ung).isEmpty()) {
            return ung;
        }
        return soDonHang + "-" + orderId;
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

        String suffix = !phone.isBlank() ? phone.replaceAll("\\D", "") : String.valueOf(System.currentTimeMillis() % 1000000);
        String maKh = "KH-SP-" + suffix;
        if (maKh.length() > 30) maKh = maKh.substring(0, 30);

        return khachHangRepository.save(KhachHang.builder()
                .maKhachHang(maKh)
                .tenKhachHang(finalName.isBlank() ? "Khách hàng Shopify" : finalName)
                .soDienThoai(finalPhone)
                .email(finalEmail)
                .trangThai(1)
                .build());
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

    // ═══════════════════════════════════════════════════════════════════
    // LAZADA ORDER SYNCING
    // ═══════════════════════════════════════════════════════════════════

    public int syncLazadaOrders(KenhBanHang kenh) {
        return syncLazadaOrders(kenh, getChuKyPhut());
    }

    public int syncLazadaOrders(KenhBanHang kenh, int intervalMins) {
        int bufferMinutes = Math.max(intervalMins + 5, 10);
        return syncLazadaOrders(kenh, Instant.now().minus(Duration.ofMinutes(bufferMinutes)), null);
    }

    public int syncLazadaOrders(KenhBanHang kenh, Instant tuNgay, Instant denNgay) {
        String appKey = kenhBanHangService.getLazadaAppKey();
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret();
        String accessToken = kenhBanHangService.getDecryptedLazadaAccessToken();

        if (appKey == null || appSecret == null || accessToken == null) {
            log.warn("[JOB-01] Kênh {} chưa có credential đầy đủ (AppKey/Secret/Token), bỏ qua đợt sync", kenh.getMaKenh());
            return 0;
        }

        int syncedCount = 0;
        try {
            JsonNode root = lazadaClient.getOrders(appKey, appSecret, accessToken, tuNgay, 50, 0);
            if (kenh.getId() != null) {
                lanLayDonCuoi.put(kenh.getId(), Instant.now());
            }

            String code = root.path("code").asText("");
            if ("0".equals(code)) {
                JsonNode orders = root.path("data").path("orders");
                if (orders.isArray()) {
                    for (JsonNode orderNode : orders) {
                        try {
                            if (processSingleLazadaOrder(orderNode, kenh, appKey, appSecret, accessToken)) {
                                syncedCount++;
                            }
                        } catch (Exception ex) {
                            log.error("[JOB-01] Lỗi xử lý đơn hàng Lazada ID {}: {}", orderNode.path("order_id").asText(), ex.getMessage());
                        }
                    }
                    if (syncedCount > 0) {
                        log.info("[JOB-01] Đã đồng bộ thành công {} đơn hàng mới từ Lazada", syncedCount);
                    }
                }
            } else {
                log.warn("[JOB-01] Lazada trả mã lỗi khi lấy đơn: {} - {}", code, root.path("message").asText());
            }
        } catch (Exception e) {
            log.warn("[JOB-01 Error] Lỗi kết nối API đơn hàng Lazada: {}", e.getMessage());
        }
        return syncedCount;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean processSingleTikTokOrder(TikTokOrderDto order, KenhBanHang kenh) {
        if (order == null || order.getId() == null || order.getId().isBlank()) return false;
        String orderId = order.getId().trim();
        String soDonHang = "TTS-" + orderId;

        Optional<DonBanHang> existingOpt = donBanHangRepository.findBySoDonHang(soDonHang);
        if (existingOpt.isEmpty()) {
            existingOpt = donBanHangRepository.findByMaDonHangKenh(orderId);
        }

        if (existingOpt.isPresent()) {
            DonBanHang existing = existingOpt.get();
            if ("CANCELLED".equalsIgnoreCase(order.getStatus())) {
                if (existing.getTrangThai() != null && existing.getTrangThai() != ITrangThaiDonBanHang.DA_HUY) {
                    try {
                        String lyDoHuy = order.getCancelReason() != null && !order.getCancelReason().isBlank()
                                ? order.getCancelReason() : "Hủy từ sàn TikTok Shop";
                        donBanHangService.huyDonTuSan(existing.getId(), lyDoHuy);
                        log.info("[JOB-01] Đơn {} đã bị hủy trên TikTok Shop -> Cập nhật trạng thái FCentric = 4", soDonHang);
                    } catch (Exception ex) {
                        log.error("[JOB-01] Lỗi khi hủy đơn {} theo sàn TikTok Shop: {}", soDonHang, ex.getMessage());
                    }
                }
            } else if (order.laYeuCauHuy()) {
                String ghiChuCu = existing.getGhiChu() != null ? existing.getGhiChu() : "";
                if (!ghiChuCu.contains("[KHÁCH YÊU CẦU HỦY]")) {
                    String lyDo = order.getCancelReason() != null && !order.getCancelReason().isBlank()
                            ? order.getCancelReason() : "Khách yêu cầu hủy đơn trên TikTok Shop";
                    existing.setGhiChu("[KHÁCH YÊU CẦU HỦY] " + lyDo + " | " + ghiChuCu);
                    existing.setNgayCapNhat(Instant.now());
                    donBanHangRepository.save(existing);
                    log.warn("[JOB-01] Đơn {} có cờ khách yêu cầu hủy từ TikTok Shop: {}", soDonHang, lyDo);
                }
            }
            return false;
        }

        TikTokRecipientAddressDto addr = order.getRecipientAddress();
        String phone = addr != null && addr.getPhoneNumber() != null ? addr.getPhoneNumber().trim() : "";
        KhachHang khachHang = null;
        if (!phone.isBlank()) {
            khachHang = khachHangRepository.findFirstBySoDienThoai(phone).orElse(null);
        }
        if (khachHang == null) {
            khachHang = khachHangRepository.findById(1).orElse(null);
        }

        BigDecimal totalPrice = BigDecimal.ZERO;
        if (order.getTotalAmount() != null && !order.getTotalAmount().isBlank()) {
            try {
                totalPrice = new BigDecimal(order.getTotalAmount().trim());
            } catch (Exception ignored) {}
        }

        BigDecimal shippingFee = BigDecimal.ZERO;
        if (order.getShippingFee() != null && !order.getShippingFee().isBlank()) {
            try {
                shippingFee = new BigDecimal(order.getShippingFee().trim());
            } catch (Exception ignored) {}
        }
        BigDecimal price = totalPrice.subtract(shippingFee).max(BigDecimal.ZERO);

        String address = addr != null && addr.getFullAddress() != null ? addr.getFullAddress() : "";
        List<Kho> khoHoatDong = khoRepository.findByTrangThai(1);
        Kho defaultKho = khoHoatDong.stream().filter(KhoService::laKhoTong).findFirst()
                .orElse(khoHoatDong.stream().filter(k -> !KhoService.laKhoAo(k)).findFirst().orElse(null));

        Instant ngayDat = order.getCreateTime() != null ? Instant.ofEpochMilli(order.getCreateTime() * 1000L) : Instant.now();
        int trangThai = TikTokOrderMapper.mapTrangThaiDonHang(order.getStatus());
        String ttThanhToan = TikTokOrderMapper.mapTrangThaiThanhToan(order.getStatus(), order.getPaidTime(), order.getPaymentMethodName());

        DonBanHang don = DonBanHang.builder()
                .soDonHang(soDonHang)
                .maDonHangKenh(orderId)
                .kenhBanHang(kenh)
                .khachHang(khachHang)
                .khoXuat(defaultKho)
                .loaiChungTu("don_ban_hang")
                .ngayDatHang(ngayDat)
                .trangThai(trangThai)
                .tienHang(price)
                .phiVanChuyen(shippingFee)
                .tongCong(totalPrice)
                .trangThaiThanhToan(ttThanhToan)
                .diaChiGiaoHang(address)
                .ghiChu(order.laYeuCauHuy() ? "[KHÁCH YÊU CẦU HỦY] " + (order.getCancelReason() != null ? order.getCancelReason() : "") + " | Đơn hàng đồng bộ từ TikTok Shop #" + orderId : "Đơn hàng đồng bộ tự động từ TikTok Shop #" + orderId)
                .build();

        DonBanHang savedOrder = donBanHangRepository.save(don);

        if (order.getLineItems() != null) {
            for (TikTokOrderItemDto it : order.getLineItems()) {
                String sellerSku = it.getSellerSku() != null ? it.getSellerSku().trim() : "";
                String skuId = it.getSkuId() != null ? it.getSkuId().trim() : "";

                BienTheSanPham bt = null;
                if (!sellerSku.isBlank()) {
                    bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(sellerSku).orElse(null);
                }
                if (bt == null && !skuId.isBlank()) {
                    bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(skuId).orElse(null);
                }
                if (bt == null && !sellerSku.isBlank()) {
                    var mapping = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndMaSanPhamKenh(kenh.getId(), sellerSku);
                    if (mapping.isPresent()) {
                        bt = mapping.get().getBienTheSanPham();
                    }
                }

                BigDecimal itemPrice = BigDecimal.ZERO;
                if (it.getSalePrice() != null && !it.getSalePrice().isBlank()) {
                    try {
                        itemPrice = new BigDecimal(it.getSalePrice().trim());
                    } catch (Exception ignored) {}
                }
                BigDecimal sl = it.getQuantity() != null ? BigDecimal.valueOf(it.getQuantity()) : BigDecimal.ONE;

                if (bt != null) {
                    ChiTietDonBanHang chiTiet = ChiTietDonBanHang.builder()
                            .donBanHang(savedOrder)
                            .bienTheSanPham(bt)
                            .soLuongDat(sl)
                            .soLuongDaGiao(BigDecimal.ZERO)
                            .donGia(itemPrice)
                            .ghiChu(it.getProductName() != null ? it.getProductName() : "")
                            .build();
                    chiTietDonBanHangRepository.save(chiTiet);
                }
            }
        }

        return true;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean processSingleLazadaOrder(JsonNode orderNode, KenhBanHang kenh, String appKey, String appSecret, String accessToken) {
        String orderId = orderNode.path("order_id").asText();
        String orderNumber = orderNode.path("order_number").asText(orderId);
        String soDonHang = "LZD-" + orderNumber;

        Optional<DonBanHang> existingOpt = donBanHangRepository.findBySoDonHang(soDonHang);
        if (existingOpt.isEmpty()) {
            existingOpt = donBanHangRepository.findByMaDonHangKenh(orderId);
        }

        if (existingOpt.isPresent()) {
            DonBanHang existing = existingOpt.get();
            String statuses = orderNode.path("statuses").toString().toLowerCase();
            if (statuses.contains("canceled") || statuses.contains("cancelled")) {
                if (existing.getTrangThai() != null && existing.getTrangThai() != ITrangThaiDonBanHang.DA_HUY) {
                    try {
                        donBanHangService.huyDonTuSan(existing.getId(), "Hủy từ sàn Lazada");
                        log.info("[JOB-01] Đơn {} đã bị hủy trên Lazada -> Cập nhật trạng thái FCentric = 4", soDonHang);
                    } catch (Exception ex) {
                        log.error("[JOB-01] Lỗi khi hủy đơn {} theo sàn Lazada: {}", soDonHang, ex.getMessage());
                    }
                }
            }
            return false;
        }

        String customerName = orderNode.path("customer_first_name").asText("") + " " + orderNode.path("customer_last_name").asText("");
        if (customerName.trim().isBlank()) {
            customerName = "Khách hàng Lazada";
        }
        String phone = orderNode.path("address_shipping").path("phone").asText("");
        KhachHang khachHang = null;
        if (!phone.isBlank()) {
            khachHang = khachHangRepository.findFirstBySoDienThoai(phone.trim()).orElse(null);
        }
        if (khachHang == null) {
            khachHang = khachHangRepository.findById(1).orElse(null);
        }

        BigDecimal price = new BigDecimal(orderNode.path("price").asText("0.00"));
        BigDecimal shippingFee = new BigDecimal(orderNode.path("shipping_fee").asText("0.00"));
        String address = extractLazadaAddress(orderNode.path("address_shipping"));

        List<Kho> khoHoatDong = khoRepository.findByTrangThai(1);
        Kho defaultKho = khoHoatDong.stream().filter(KhoService::laKhoTong).findFirst()
                .orElse(khoHoatDong.stream().filter(k -> !KhoService.laKhoAo(k)).findFirst().orElse(null));

        DonBanHang don = DonBanHang.builder()
                .soDonHang(soDonHang)
                .maDonHangKenh(orderId)
                .kenhBanHang(kenh)
                .khachHang(khachHang)
                .khoXuat(defaultKho)
                .loaiChungTu("don_ban_hang")
                .ngayDatHang(Instant.now())
                .trangThai(0)
                .tienHang(price)
                .phiVanChuyen(shippingFee)
                .tongCong(price.add(shippingFee))
                .trangThaiThanhToan("paid".equalsIgnoreCase(orderNode.path("payment_method").asText()) ? "da_thanh_toan" : "chua_thanh_toan")
                .diaChiGiaoHang(address)
                .ghiChu("Đơn hàng đồng bộ tự động từ Lazada #" + orderNumber)
                .build();

        DonBanHang savedOrder = donBanHangRepository.save(don);

        try {
            JsonNode itemsRes = lazadaClient.getOrderItems(appKey, appSecret, accessToken, orderId);
            if ("0".equals(itemsRes.path("code").asText(""))) {
                JsonNode items = itemsRes.path("data");
                if (items.isArray()) {
                    for (JsonNode it : items) {
                        String sku = it.path("sku").asText("");
                        String shopSku = it.path("shop_sku").asText(sku);
                        BigDecimal itemPrice = new BigDecimal(it.path("item_price").asText("0.00"));

                        BienTheSanPham bt = null;
                        if (!shopSku.isBlank()) {
                            bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(shopSku.trim()).orElse(null);
                        }
                        if (bt == null && !sku.isBlank()) {
                            bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(sku.trim()).orElse(null);
                        }
                        if (bt == null) {
                            var mapping = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndMaSanPhamKenh(kenh.getId(), shopSku);
                            if (mapping.isPresent()) {
                                bt = mapping.get().getBienTheSanPham();
                            }
                        }

                        if (bt != null) {
                            ChiTietDonBanHang chiTiet = ChiTietDonBanHang.builder()
                                    .donBanHang(savedOrder)
                                    .bienTheSanPham(bt)
                                    .soLuongDat(BigDecimal.ONE)
                                    .soLuongDaGiao(BigDecimal.ZERO)
                                    .donGia(itemPrice)
                                    .ghiChu(it.path("name").asText(""))
                                    .build();
                            chiTietDonBanHangRepository.save(chiTiet);
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.error("[JOB-01] Lỗi lấy line items cho đơn Lazada {}: {}", orderId, ex.getMessage());
        }

        return true;
    }

    private String extractLazadaAddress(JsonNode shipping) {
        if (shipping == null || shipping.isMissingNode() || shipping.isNull()) return "";
        StringBuilder sb = new StringBuilder();
        String addr1 = shipping.path("address1").asText("");
        String city = shipping.path("city").asText("");
        String country = shipping.path("country").asText("");
        if (!addr1.isBlank()) sb.append(addr1);
        if (!city.isBlank()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(city);
        }
        if (!country.isBlank()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(country);
        }
        return sb.toString();
    }

    private String extractDomainFromApiUrl(String apiUrl) {
        if (apiUrl == null || apiUrl.isBlank()) return "";
        String clean = apiUrl.trim().replaceFirst("^(?i)https?://", "");
        int slashIdx = clean.indexOf('/');
        return (slashIdx > 0 ? clean.substring(0, slashIdx) : clean).trim().toLowerCase();
    }
}
