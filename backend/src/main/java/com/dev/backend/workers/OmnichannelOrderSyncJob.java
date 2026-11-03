package com.dev.backend.workers;

import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.repository.*;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.lazada.LazadaClient;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.services.multitable.NhatHangService;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.utils.SauCommit;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.services.impl.entities.DonBanHangService;
import com.dev.backend.services.impl.entities.KhoService;
import com.dev.backend.services.impl.entities.ThongBaoHeThongService;
import com.dev.backend.services.impl.entities.ThongBaoXuatKhoService;
import com.dev.backend.utils.KenhCauHinhDongBo;
import com.dev.backend.dto.response.customize.TikTokOrderDto;
import com.dev.backend.dto.response.customize.TikTokOrderItemDto;
import com.dev.backend.dto.response.customize.TikTokRecipientAddressDto;
import com.dev.backend.utils.TikTokOrderMapper;
import com.dev.backend.services.tiktok.TikTokShopClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Objects;

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
    @lombok.experimental.NonFinal
    LazadaClient lazadaClient;

    public void setLazadaClient(LazadaClient lazadaClient) {
        this.lazadaClient = lazadaClient;
    }
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    TikTokShopClient tiktokShopClient;
    /** Tiêm kiểu @Lazy vì KenhBanHangDongBoService nhận job này qua constructor, tiêm thẳng thì Spring báo vòng phụ thuộc khi khởi động. */
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    KenhBanHangDongBoService kenhBanHangDongBoService;
    /** Thông báo đơn sàn: mới chờ gửi sang kho, thiếu dòng, khách yêu cầu hủy (test dựng tay không có thì bỏ qua). */
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    ThongBaoXuatKhoService thongBaoXuatKhoService;
    /** Báo quản trị viên ủy quyền lại khi sàn từ chối khóa (test dựng tay không có thì bỏ qua). */
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    ThongBaoHeThongService thongBaoHeThongService;
    /** Đơn thiếu dòng của lượt lấy đơn đang chạy trên luồng này: gộp thành một thông báo mỗi lượt. */
    ThreadLocal<List<ThongBaoXuatKhoService.DonThieuDong>> donThieuDongLuot = new ThreadLocal<>();
    /** Số đơn Nháp (chờ gửi sang kho) vừa tạo trong lượt lấy đơn đang chạy trên luồng này. */
    ThreadLocal<int[]> donNhapMoiLuot = new ThreadLocal<>();
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
            } else if (MA_KENH_TIKTOK.equalsIgnoreCase(kenh.getMaKenh())) {
                if (!KenhCauHinhDongBo.tuDongLayDon(dieuHanhHeThongService, kenh.getMaKenh())) {
                    log.info("[JOB-01] Kênh {} đang tắt tự động lấy đơn, bỏ qua", kenh.getMaKenh());
                    continue;
                }
                syncTikTokOrders(kenh, intervalMins);
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
                    batDauLuot();
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
                    ketThucLuot(kenh, syncedCount);
                }
            }
        } catch (HttpClientErrorException.TooManyRequests e) {
            log.warn("[JOB-01 Rate Limit] Shopify rate limit vượt ngưỡng. Bỏ qua kênh {} và thử lại đợt 5 phút sau.", kenh.getMaKenh());
        } catch (HttpClientErrorException.Unauthorized e) {
            log.error("[JOB-01 Token Expired] Token kênh {} hết hạn hoặc không hợp lệ. Vô hiệu hóa sync tự động.", kenh.getMaKenh());
            if (thongBaoHeThongService != null) thongBaoHeThongService.kenhCanUyQuyenLai(kenh);
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
        demDonNhapMoi(kenh);

        // Lưu chi tiết các dòng sản phẩm; dòng chưa liên kết SKU bị bỏ → báo quản trị viên
        Map<String, Integer> skuThieu = new LinkedHashMap<>();
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
                            .tienGiamGia(giamGiaCuaDong(itemNode, qty.multiply(price)))
                            .ghiChu(itemNode.path("title").asText(""))
                            .build();
                    chiTietDonBanHangRepository.save(chiTiet);
                    if (kenhBanHangDongBoService != null && bt != null && bt.getId() != null) {
                        Integer btId = bt.getId();
                        SauCommit.chay("Đẩy tồn cập nhật tức thì sau đơn Shopify mới",
                                () -> kenhBanHangDongBoService.dayTonKhoKhanCap(btId));
                    }
                } else {
                    skuThieu.merge(maDongThieu(sku, variantId, itemNode.path("title").asText("")), qty.intValue(), Integer::sum);
                }
            }
        }
        ghiNhanDonThieuDong(kenh, savedOrder.getSoDonHang(), skuThieu, false);
        return true;
    }

    /** Bắt đầu một lượt lấy đơn của kênh: gom đơn thiếu dòng để báo một lần ở cuối lượt. */
    private void batDauLuot() {
        donThieuDongLuot.set(new ArrayList<>());
        donNhapMoiLuot.set(new int[1]);
    }

    /** Vừa tạo một đơn Nháp: trong lượt thì đếm (báo ở cuối lượt), gọi lẻ thì báo ngay. */
    private void demDonNhapMoi(KenhBanHang kenh) {
        int[] dem = donNhapMoiLuot.get();
        if (dem != null) dem[0]++;
        else if (thongBaoXuatKhoService != null) thongBaoXuatKhoService.donSanMoi(kenh);
    }

    /**
     * Cuối lượt lấy đơn: có đơn mới thì báo quản trị viên số đơn chờ gửi sang kho (đếm lại từ dữ liệu, đơn TikTok tạo thẳng
     * ở trạng thái khác không tính); có đơn thiếu dòng thì báo một lần cho cả lượt.
     */
    private void ketThucLuot(KenhBanHang kenh, int soDonMoi) {
        List<ThongBaoXuatKhoService.DonThieuDong> thieu = donThieuDongLuot.get();
        int[] nhapMoi = donNhapMoiLuot.get();
        donThieuDongLuot.remove();
        donNhapMoiLuot.remove();
        if (thongBaoXuatKhoService == null) return;
        // Chỉ đơn mới ở Nháp (đơn TikTok tạo thẳng ở Đã giao / Hoàn thành không cần gửi sang kho)
        if (nhapMoi != null && nhapMoi[0] > 0) thongBaoXuatKhoService.donSanMoi(kenh);
        if (thieu != null && !thieu.isEmpty()) thongBaoXuatKhoService.donSanThieuDong(kenh, thieu);
    }

    /** Đơn vừa tạo thiếu dòng: trong lượt thì gom, gọi lẻ (ngoài lượt) thì báo ngay. */
    private void ghiNhanDonThieuDong(KenhBanHang kenh, String soDon, Map<String, Integer> skuThieu, boolean khongLayDuocDong) {
        if (skuThieu.isEmpty() && !khongLayDuocDong) return;
        ThongBaoXuatKhoService.DonThieuDong d = new ThongBaoXuatKhoService.DonThieuDong(soDon, skuThieu, khongLayDuocDong);
        List<ThongBaoXuatKhoService.DonThieuDong> luot = donThieuDongLuot.get();
        if (luot != null) luot.add(d);
        else if (thongBaoXuatKhoService != null) thongBaoXuatKhoService.donSanThieuDong(kenh, List.of(d));
    }

    /** Mã hiển thị của dòng chưa liên kết: SKU, không có thì mã biến thể / mã của sàn, cuối cùng là tên. */
    private static String maDongThieu(String... ung) {
        for (String m : ung) {
            if (m != null && !m.isBlank()) return m.trim();
        }
        return "?";
    }

    /**
     * Giảm giá của một dòng Shopify (tiền shop, đã gồm thuế như giá dòng): cộng discount_allocations của dòng; đơn cũ
     * không có mảng này thì lấy total_discount. Giữ trong [0, tiền dòng] để xuất kế toán tách được thuế.
     */
    static BigDecimal giamGiaCuaDong(JsonNode itemNode, BigDecimal tienDong) {
        BigDecimal giam = BigDecimal.ZERO;
        JsonNode phanBo = itemNode.path("discount_allocations");
        if (phanBo.isArray() && !phanBo.isEmpty()) {
            for (JsonNode a : phanBo) {
                giam = giam.add(soTien(a.path("amount").asText("0")));
            }
        } else {
            giam = soTien(itemNode.path("total_discount").asText("0"));
        }
        if (giam.signum() < 0) {
            return BigDecimal.ZERO;
        }
        return giam.min(tienDong).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private static BigDecimal soTien(String chu) {
        try {
            return new BigDecimal(chu.trim());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
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
                    batDauLuot();
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
                    ketThucLuot(kenh, syncedCount);
                }
            } else {
                log.warn("[JOB-01] Lazada trả mã lỗi khi lấy đơn: {} - {}", code, root.path("message").asText());
            }
        } catch (Exception e) {
            log.warn("[JOB-01 Error] Lỗi kết nối API đơn hàng Lazada: {}", e.getMessage());
        }
        return syncedCount;
    }

    public int syncTikTokOrders(KenhBanHang kenh) {
        return syncTikTokOrders(kenh, getChuKyPhut());
    }

    public int syncTikTokOrders(KenhBanHang kenh, int intervalMins) {
        int bufferMinutes = Math.max(intervalMins + 5, 10);
        return syncTikTokOrders(kenh, Instant.now().minus(Duration.ofMinutes(bufferMinutes)), Instant.now());
    }

    public int syncTikTokOrders(KenhBanHang kenh, Instant tu, Instant den) {
        String appKey = kenhBanHangService.getTikTokAppKey();
        String appSecret = kenhBanHangService.getDecryptedTikTokAppSecret();
        String accessToken = kenhBanHangService.getDecryptedTikTokAccessToken();
        String shopCipher = kenhBanHangService.getTikTokShopCipher();

        // =========================================================================
        // [SANDBOX MOCK BYPASS] - Tự động sinh đơn hàng mẫu khi kênh đang kết nối Sandbox
        // Giúp kiểm thử luồng trừ kho, đóng gói và chốt chặn hủy đơn mà không cần shop thật
        // =========================================================================
        if (shopCipher != null && (shopCipher.startsWith("mock_") || (accessToken != null && accessToken.startsWith("mock_")))) {
            return syncMockTikTokOrders(kenh);
        }

        // =========================================================================
        // [PRODUCTION FLOW] - Quét đơn hàng thật qua API open-api.tiktokglobalshop.com
        // =========================================================================
        if (appKey == null || appSecret == null || accessToken == null || shopCipher == null || shopCipher.isBlank()) {
            log.warn("[JOB-01] Thiếu thông tin ủy quyền hoặc shopCipher cho TikTok Shop");
            return 0;
        }

        com.dev.backend.dto.request.TikTokOrderSearchRequest req = com.dev.backend.dto.request.TikTokOrderSearchRequest.builder()
                .updateTimeFrom(tu.getEpochSecond())
                .updateTimeTo(den.getEpochSecond())
                .pageSize(50)
                .build();

        int synced = 0;
        try {
            TikTokShopClient client = tiktokShopClient != null ? tiktokShopClient : new TikTokShopClient();
            com.dev.backend.dto.response.customize.TikTokOrderSearchResponse response =
                    client.searchOrders(appKey, appSecret, accessToken, shopCipher, req);

            if (response != null && response.getOrders() != null) {
                batDauLuot();
                try {
                    for (TikTokOrderDto order : response.getOrders()) {
                        boolean ok = processSingleTikTokOrder(order, kenh);
                        if (ok) synced++;
                    }
                } finally {
                    ketThucLuot(kenh, synced);
                }
            }
            lanLayDonCuoi.put(kenh.getId(), Instant.now());
            log.info("[JOB-01] Quét đơn TikTok Shop hoàn tất: {} đơn mới", synced);
        } catch (Exception ex) {
            log.error("[JOB-01] Lỗi khi quét đơn hàng từ TikTok Shop: {}", ex.getMessage());
        }
        return synced;
    }

    private int syncMockTikTokOrders(KenhBanHang kenh) {
        int synced = 0;
        try {
            List<BienTheSanPham> samples = bienTheSanPhamRepository.findAll(org.springframework.data.domain.PageRequest.of(0, 3)).getContent();
            String sku1 = !samples.isEmpty() ? samples.get(0).getMaSku() : "TEST-SKU-01";
            String name1 = !samples.isEmpty() && samples.get(0).getSanPham() != null
                    ? samples.get(0).getSanPham().getTenSanPham() : "Áo Thun Cotton FCentric";
            String sku2 = samples.size() > 1 ? samples.get(1).getMaSku() : sku1;
            String name2 = samples.size() > 1 && samples.get(1).getSanPham() != null
                    ? samples.get(1).getSanPham().getTenSanPham() : "Quần Jeans Slimfit FCentric";

            // Đơn 1: Đang chờ xử lý (Awaiting Shipment - COD)
            com.dev.backend.dto.response.customize.TikTokOrderDto order1 = com.dev.backend.dto.response.customize.TikTokOrderDto.builder()
                    .id("579100234567801")
                    .status("AWAITING_SHIPMENT")
                    .createTime(Instant.now().minus(Duration.ofHours(2)).getEpochSecond())
                    .updateTime(Instant.now().minus(Duration.ofMinutes(30)).getEpochSecond())
                    .totalAmount("500000")
                    .shippingFee("30000")
                    .paymentMethodName("CASH_ON_DELIVERY")
                    .buyerUid("buyer_tiktok_01")
                    .recipientAddress(com.dev.backend.dto.response.customize.TikTokRecipientAddressDto.builder()
                            .name("Nguyễn Văn Test (TikTok Buyer)")
                            .phoneNumber("0987654321")
                            .fullAddress("Tổ dân phố 6, TT. Xuân An, Huyện Nghi Xuân, Tỉnh Hà Tĩnh")
                            .region("Hà Tĩnh")
                            .district("Nghi Xuân")
                            .town("Xuân An")
                            .build())
                    .lineItems(List.of(com.dev.backend.dto.response.customize.TikTokOrderItemDto.builder()
                            .id("item_01")
                            .skuId(sku1)
                            .sellerSku(sku1)
                            .productName(name1)
                            .quantity(2)
                            .salePrice("235000")
                            .build()))
                    .build();

            // Đơn 2: Đang chờ xử lý và CÓ YÊU CẦU HỦY ĐƠN TỪ KHÁCH HÀNG (để test huy hiệu cảnh báo & chốt chặn)
            com.dev.backend.dto.response.customize.TikTokOrderDto order2 = com.dev.backend.dto.response.customize.TikTokOrderDto.builder()
                    .id("579100234567802")
                    .status("AWAITING_SHIPMENT")
                    .createTime(Instant.now().minus(Duration.ofHours(1)).getEpochSecond())
                    .updateTime(Instant.now().minus(Duration.ofMinutes(10)).getEpochSecond())
                    .totalAmount("380000")
                    .shippingFee("30000")
                    .paymentMethodName("E_WALLET")
                    .buyerUid("buyer_tiktok_02")
                    .cancelReason("Người mua đổi ý không muốn nhận hàng nữa")
                    .cancelUser("BUYER")
                    .isOnHold(true)
                    .recipientAddress(com.dev.backend.dto.response.customize.TikTokRecipientAddressDto.builder()
                            .name("Trần Thị B (Khách Test Hủy)")
                            .phoneNumber("0912345678")
                            .fullAddress("Số 18 Hoàng Diệu, Phường Điện Biên, Quận Ba Đình, Hà Nội")
                            .region("Hà Nội")
                            .district("Ba Đình")
                            .build())
                    .lineItems(List.of(com.dev.backend.dto.response.customize.TikTokOrderItemDto.builder()
                            .id("item_02")
                            .skuId(sku2)
                            .sellerSku(sku2)
                            .productName(name2)
                            .quantity(1)
                            .salePrice("350000")
                            .build()))
                    .build();

            // Đơn 3: Đã giao thành công (Delivered / Completed)
            com.dev.backend.dto.response.customize.TikTokOrderDto order3 = com.dev.backend.dto.response.customize.TikTokOrderDto.builder()
                    .id("579100234567803")
                    .status("COMPLETED")
                    .createTime(Instant.now().minus(Duration.ofDays(1)).getEpochSecond())
                    .updateTime(Instant.now().minus(Duration.ofHours(5)).getEpochSecond())
                    .paidTime(Instant.now().minus(Duration.ofDays(1)).getEpochSecond())
                    .totalAmount("229000")
                    .shippingFee("30000")
                    .paymentMethodName("E_WALLET")
                    .buyerUid("buyer_tiktok_03")
                    .recipientAddress(com.dev.backend.dto.response.customize.TikTokRecipientAddressDto.builder()
                            .name("Lê Hoàng C (TikTok VN)")
                            .phoneNumber("0909123456")
                            .fullAddress("Số 123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh")
                            .region("Hồ Chí Minh")
                            .district("Quận 1")
                            .build())
                    .lineItems(List.of(com.dev.backend.dto.response.customize.TikTokOrderItemDto.builder()
                            .id("item_03")
                            .skuId(sku1)
                            .sellerSku(sku1)
                            .productName(name1)
                            .quantity(1)
                            .salePrice("199000")
                            .build()))
                    .build();

            batDauLuot();
            try {
                if (processSingleTikTokOrder(order1, kenh)) synced++;
                if (processSingleTikTokOrder(order2, kenh)) synced++;
                if (processSingleTikTokOrder(order3, kenh)) synced++;
            } finally {
                ketThucLuot(kenh, synced);
            }

            lanLayDonCuoi.put(kenh.getId(), Instant.now());
            log.info("[JOB-01] Quét đơn TikTok Shop Sandbox hoàn tất: {} đơn mới", synced);
        } catch (Exception ex) {
            log.error("[JOB-01] Lỗi khi tạo đơn thử nghiệm TikTok Shop Sandbox: {}", ex.getMessage());
        }
        return synced;
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
                    if (thongBaoXuatKhoService != null) {
                        thongBaoXuatKhoService.khachYeuCauHuy(existing, kenh);
                        // Đơn có cờ không gom phiếu nhặt được: số "đơn chờ xuất" của kho giảm
                        if (existing.getKhoXuat() != null) thongBaoXuatKhoService.lamMoiDonChoXuat(existing.getKhoXuat().getId());
                    }
                }
            }
            return false;
        }

        TikTokRecipientAddressDto addr = order.getRecipientAddress();
        String phone = addr != null && addr.getPhoneNumber() != null ? addr.getPhoneNumber().trim() : "";
        KhachHang khachHang = resolveTikTokCustomer(order, addr, phone);

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
        if (order.laYeuCauHuy() && thongBaoXuatKhoService != null) thongBaoXuatKhoService.khachYeuCauHuy(savedOrder, kenh);
        if (Integer.valueOf(0).equals(savedOrder.getTrangThai())) demDonNhapMoi(kenh);

        Map<String, Integer> skuThieu = new LinkedHashMap<>();
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
                    if (kenhBanHangDongBoService != null && bt != null && bt.getId() != null) {
                        Integer btId = bt.getId();
                        SauCommit.chay("Đẩy tồn cập nhật tức thì sau đơn Lazada mới",
                                () -> kenhBanHangDongBoService.dayTonKhoKhanCap(btId));
                    }
                } else {
                    skuThieu.merge(maDongThieu(sellerSku, skuId, it.getProductName()), sl.intValue(), Integer::sum);
                }
            }
        }
        ghiNhanDonThieuDong(kenh, savedOrder.getSoDonHang(), skuThieu, false);

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

        String address = extractLazadaAddress(orderNode);

        if (existingOpt.isPresent()) {
            DonBanHang existing = existingOpt.get();
            // Khắc phục đơn cũ từng bị gán nhầm sang khách hàng ID 1 hoặc khách hàng dùng chung sai người
            boolean canKhacPhuc = false;
            if (existing.getKhachHang() == null || Objects.equals(existing.getKhachHang().getId(), 1)) {
                canKhacPhuc = true;
            } else {
                String lzdCustomerName = extractLazadaCustomerName(orderNode);
                String currentKhName = existing.getKhachHang().getTenKhachHang();
                if (!lzdCustomerName.isBlank() && currentKhName != null && !currentKhName.isBlank()
                        && !lzdCustomerName.equalsIgnoreCase(currentKhName)) {
                    canKhacPhuc = true;
                }
            }

            if (canKhacPhuc) {
                KhachHang correctKh = resolveLazadaCustomer(orderNode, orderNumber, address);
                if (correctKh != null && !Objects.equals(correctKh.getId(), 1)) {
                    existing.setKhachHang(correctKh);
                    if (orderNode.has("created_at") && !orderNode.path("created_at").asText("").isBlank()) {
                        existing.setNgayDatHang(parseLazadaDate(orderNode.path("created_at").asText("")));
                    }
                    if (existing.getDiaChiGiaoHang() == null || existing.getDiaChiGiaoHang().isBlank()) {
                        existing.setDiaChiGiaoHang(address);
                    }
                    donBanHangRepository.save(existing);
                    log.info("[JOB-01] Khắc phục đơn Lazada {} bị gán nhầm khách -> chuyển sang khách {} (ID {}, Mã {})",
                            soDonHang, correctKh.getTenKhachHang(), correctKh.getId(), correctKh.getMaKhachHang());
                }
            }

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
            } else if (statuses.contains("delivered") || statuses.contains("failed_delivery") || statuses.contains("returned")) {
                try {
                    donBanHangService.capNhatTrangThaiGiaoHangTuSan(existing.getId(), statuses);
                } catch (Exception ex) {
                    log.error("[JOB-01] Lỗi khi cập nhật trạng thái giao hàng đơn {} theo sàn Lazada: {}", soDonHang, ex.getMessage());
                }
            }
            return false;
        }

        KhachHang khachHang = resolveLazadaCustomer(orderNode, orderNumber, address);

        BigDecimal price = new BigDecimal(orderNode.path("price").asText("0.00"));
        BigDecimal shippingFee = new BigDecimal(orderNode.path("shipping_fee").asText("0.00"));
        BigDecimal totalPrice = price.add(shippingFee);

        List<Kho> khoHoatDong = khoRepository.findByTrangThai(1);
        Kho defaultKho = khoHoatDong.stream().filter(KhoService::laKhoTong).findFirst()
                .orElse(khoHoatDong.stream().filter(k -> !KhoService.laKhoAo(k)).findFirst().orElse(null));

        String paymentMethod = orderNode.path("payment_method").asText("").trim();
        boolean daThanhToan = isPaidMethod(paymentMethod);

        String remarks = orderNode.path("remarks").asText("").trim();
        String ghiChu = "Đơn hàng đồng bộ tự động từ Lazada #" + orderNumber;
        if (!remarks.isBlank()) {
            ghiChu += " | Lời nhắn người mua: " + remarks;
        }

        Instant ngayDat = parseLazadaDate(orderNode.path("created_at").asText(""));

        DonBanHang don = DonBanHang.builder()
                .soDonHang(soDonHang)
                .maDonHangKenh(orderId)
                .kenhBanHang(kenh)
                .khachHang(khachHang)
                .khoXuat(defaultKho)
                .loaiChungTu("don_ban_hang")
                .ngayDatHang(ngayDat)
                .trangThai(0)
                .tienHang(price)
                .phiVanChuyen(shippingFee)
                .tongCong(totalPrice)
                .trangThaiThanhToan(daThanhToan ? "da_thanh_toan" : "chua_thanh_toan")
                .diaChiGiaoHang(address)
                .ghiChu(ghiChu)
                .build();

        DonBanHang savedOrder = donBanHangRepository.save(don);
        demDonNhapMoi(kenh);

        // Dòng chưa liên kết SKU bị bỏ, hoặc không lấy được dòng hàng nào: báo quản trị viên
        Map<String, Integer> skuThieu = new LinkedHashMap<>();
        boolean layDuocDong = false;
        try {
            JsonNode itemsRes = lazadaClient.getOrderItems(appKey, appSecret, accessToken, orderId);
            if ("0".equals(itemsRes.path("code").asText(""))) {
                JsonNode items = itemsRes.path("data");
                if (items.isArray()) {
                    layDuocDong = true;
                    for (JsonNode it : items) {
                        String sellerSku = it.path("seller_sku").asText("").trim();
                        String shopSku = it.path("shop_sku").asText("").trim();
                        String sku = it.path("sku").asText("").trim();
                        BigDecimal itemPrice = new BigDecimal(it.path("item_price").asText("0.00"));
                        if (it.has("paid_price") && !it.path("paid_price").asText("").isBlank()) {
                            try {
                                BigDecimal paid = new BigDecimal(it.path("paid_price").asText("0.00"));
                                if (paid.compareTo(BigDecimal.ZERO) > 0) {
                                    itemPrice = paid;
                                }
                            } catch (Exception ignored) {}
                        }

                        BienTheSanPham bt = null;
                        // 1. Ưu tiên cao nhất: tìm trực tiếp bằng Seller SKU do người bán cấu hình trên sàn
                        if (!sellerSku.isBlank()) {
                            bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(sellerSku).orElse(null);
                        }
                        // 2. Tiếp theo: tìm theo shop_sku hoặc sku của sàn
                        if (bt == null && !shopSku.isBlank()) {
                            bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(shopSku).orElse(null);
                        }
                        if (bt == null && !sku.isBlank()) {
                            bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(sku).orElse(null);
                        }
                        // 3. Tra bảng mapping liên kết sản phẩm sàn nếu có
                        if (bt == null && !sellerSku.isBlank()) {
                            var mapping = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndMaSanPhamKenh(kenh.getId(), sellerSku);
                            if (mapping.isPresent()) {
                                bt = mapping.get().getBienTheSanPham();
                            }
                        }
                        if (bt == null && !shopSku.isBlank()) {
                            var mapping = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndMaSanPhamKenh(kenh.getId(), shopSku);
                            if (mapping.isPresent()) {
                                bt = mapping.get().getBienTheSanPham();
                            }
                        }

                        BigDecimal soLuong = BigDecimal.ONE;
                        if (it.has("quantity") && !it.path("quantity").asText("").isBlank()) {
                            try {
                                soLuong = new BigDecimal(it.path("quantity").asText("1"));
                            } catch (Exception ignored) {}
                        }

                        if (bt != null) {
                            ChiTietDonBanHang chiTiet = ChiTietDonBanHang.builder()
                                    .donBanHang(savedOrder)
                                    .bienTheSanPham(bt)
                                    .soLuongDat(soLuong)
                                    .soLuongDaGiao(BigDecimal.ZERO)
                                    .donGia(itemPrice)
                                    .ghiChu(it.path("name").asText(""))
                                    .build();
                            chiTietDonBanHangRepository.save(chiTiet);
                            if (kenhBanHangDongBoService != null && bt != null && bt.getId() != null) {
                                Integer btId = bt.getId();
                                SauCommit.chay("Đẩy tồn cập nhật tức thì sau đơn Lazada mới",
                                        () -> kenhBanHangDongBoService.dayTonKhoKhanCap(btId));
                            }
                        } else {
                            skuThieu.merge(maDongThieu(sellerSku, shopSku, sku, it.path("name").asText("")), soLuong.intValue(), Integer::sum);
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.error("[JOB-01] Lỗi lấy line items cho đơn Lazada {}: {}", orderId, ex.getMessage());
        }
        ghiNhanDonThieuDong(kenh, savedOrder.getSoDonHang(), skuThieu, !layDuocDong);

        return true;
    }

    private String extractLazadaCustomerName(JsonNode orderNode) {
        if (orderNode == null || orderNode.isMissingNode() || orderNode.isNull()) {
            return "Khách hàng Lazada";
        }
        String firstName = orderNode.path("customer_first_name").asText("").trim();
        String lastName = orderNode.path("customer_last_name").asText("").trim();
        String customerName = (firstName + " " + lastName).trim();
        if (customerName.isBlank()) {
            String shipFirst = orderNode.path("address_shipping").path("first_name").asText("").trim();
            String shipLast = orderNode.path("address_shipping").path("last_name").asText("").trim();
            customerName = (shipFirst + " " + shipLast).trim();
        }
        if (customerName.isBlank()) {
            String billFirst = orderNode.path("address_billing").path("first_name").asText("").trim();
            String billLast = orderNode.path("address_billing").path("last_name").asText("").trim();
            customerName = (billFirst + " " + billLast).trim();
        }
        if (customerName.isBlank()) {
            customerName = "Khách hàng Lazada";
        }
        return customerName;
    }

    private KhachHang resolveLazadaCustomer(JsonNode orderNode, String orderNumber, String fullAddress) {
        String customerName = extractLazadaCustomerName(orderNode);

        String phone = orderNode.path("address_shipping").path("phone").asText("").trim();
        if (phone.isBlank()) {
            phone = orderNode.path("address_billing").path("phone").asText("").trim();
        }
        if (phone.isBlank()) {
            phone = orderNode.path("address_shipping").path("phone2").asText("").trim();
        }
        if (phone.isBlank()) {
            phone = orderNode.path("address_billing").path("phone2").asText("").trim();
        }

        String email = orderNode.path("customer_email").asText("").trim();
        if (email.isBlank()) {
            email = orderNode.path("address_billing").path("email").asText("").trim();
        }
        if (email.isBlank()) {
            email = orderNode.path("address_shipping").path("email").asText("").trim();
        }

        // 1. Chỉ tìm kiếm khách hàng theo số điện thoại nếu là số thực (không che mờ, không chứa '*')
        if (!phone.isBlank() && !phone.contains("*")) {
            Optional<KhachHang> khOpt = khachHangRepository.findFirstBySoDienThoai(phone);
            if (khOpt.isPresent()) {
                return khOpt.get();
            }
        }

        // 2. Chỉ tìm kiếm khách hàng theo email nếu là email thực (không phải mặc định và không chứa '*')
        if (!email.isBlank() && !"lazada@customer.com".equalsIgnoreCase(email) && !email.contains("*")) {
            Optional<KhachHang> khOpt = khachHangRepository.findFirstByEmail(email);
            if (khOpt.isPresent()) {
                return khOpt.get();
            }
        }

        // 3. Tra cứu khách hàng theo mã định danh kênh Lazada
        // Nếu số điện thoại chuẩn không che thì lấy số điện thoại, ngược lại dùng mã đơn hàng orderNumber
        String suffix = (!phone.isBlank() && !phone.contains("*"))
                ? phone.replaceAll("\\D", "")
                : orderNumber;
        if (suffix.isBlank()) suffix = orderNumber;
        String maKh = "KH-LZD-" + suffix;
        if (maKh.length() > 30) {
            maKh = maKh.substring(0, 30);
        }

        Optional<KhachHang> khByMaOpt = khachHangRepository.findByMaKhachHang(maKh);
        if (khByMaOpt.isPresent()) {
            return khByMaOpt.get();
        }

        // 4. Tạo mới khách hàng riêng biệt, lưu đầy đủ thông tin thực tế từ sàn
        final String finalPhone = !phone.isBlank() ? phone : "0900000000";
        final String finalEmail = !email.isBlank() ? email : "lazada@customer.com";
        KhachHang moi = KhachHang.builder()
                .maKhachHang(maKh)
                .tenKhachHang(customerName)
                .soDienThoai(finalPhone)
                .email(finalEmail)
                .diaChi(fullAddress)
                .loaiKhachHang("le")
                .trangThai(1)
                .build();
        return khachHangRepository.save(moi);
    }

    private KhachHang resolveTikTokCustomer(TikTokOrderDto order, TikTokRecipientAddressDto addr, String phone) {
        String name = addr != null && addr.getName() != null && !addr.getName().isBlank()
                ? addr.getName().trim() : "Khách hàng TikTok Shop";
        String fullAddress = addr != null && addr.getFullAddress() != null ? addr.getFullAddress().trim() : "";

        // Chỉ tìm theo số điện thoại nếu là số thực không chứa *
        if (!phone.isBlank() && !phone.contains("*")) {
            Optional<KhachHang> khOpt = khachHangRepository.findFirstBySoDienThoai(phone);
            if (khOpt.isPresent()) {
                return khOpt.get();
            }
        }

        String orderId = order.getId() != null ? order.getId().trim() : "";
        String buyerUid = order.getBuyerUid() != null && !order.getBuyerUid().isBlank()
                ? order.getBuyerUid().trim() : orderId;
        String suffix = (!phone.isBlank() && !phone.contains("*"))
                ? phone.replaceAll("\\D", "")
                : buyerUid;
        if (suffix.isBlank()) suffix = orderId;
        String maKh = "KH-TTS-" + suffix;
        if (maKh.length() > 30) {
            maKh = maKh.substring(0, 30);
        }

        Optional<KhachHang> khByMaOpt = khachHangRepository.findByMaKhachHang(maKh);
        if (khByMaOpt.isPresent()) {
            return khByMaOpt.get();
        }

        final String finalPhone = !phone.isBlank() ? phone : "0900000000";
        KhachHang moi = KhachHang.builder()
                .maKhachHang(maKh)
                .tenKhachHang(name)
                .soDienThoai(finalPhone)
                .diaChi(fullAddress)
                .loaiKhachHang("le")
                .trangThai(1)
                .build();
        return khachHangRepository.save(moi);
    }

    private Instant parseLazadaDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) {
            return Instant.now();
        }
        try {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss Z");
            return ZonedDateTime.parse(dateStr.trim(), formatter).toInstant();
        } catch (Exception e1) {
            try {
                return Instant.parse(dateStr.trim());
            } catch (Exception e2) {
                try {
                    DateTimeFormatter isoFormatter = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
                    return ZonedDateTime.parse(dateStr.trim(), isoFormatter).toInstant();
                } catch (Exception e3) {
                    try {
                        DateTimeFormatter noTzFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
                                .withZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
                        return ZonedDateTime.parse(dateStr.trim(), noTzFormatter).toInstant();
                    } catch (Exception e4) {
                        log.warn("[JOB-01] Không thể parse created_at từ Lazada: '{}'. Dùng Instant.now()", dateStr);
                        return Instant.now();
                    }
                }
            }
        }
    }

    private boolean isPaidMethod(String paymentMethod) {
        if (paymentMethod == null || paymentMethod.isBlank()) return false;
        String pm = paymentMethod.toLowerCase();
        return pm.contains("paid") || pm.contains("wallet") || pm.contains("online")
                || pm.contains("card") || pm.contains("banking") || pm.contains("prepaid")
                || pm.contains("cyber");
    }

    private String extractLazadaAddress(JsonNode orderNode) {
        if (orderNode == null || orderNode.isMissingNode() || orderNode.isNull()) return "";
        String addr = extractAddressFromNode(orderNode.path("address_shipping"));
        if (addr.isBlank()) {
            addr = extractAddressFromNode(orderNode.path("address_billing"));
        }
        return addr;
    }

    private String extractAddressFromNode(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return "";
        List<String> parts = new ArrayList<>();
        addAddressPart(parts, node.path("address1").asText(""));
        addAddressPart(parts, node.path("address2").asText(""));
        addAddressPart(parts, node.path("address3").asText(""));
        addAddressPart(parts, node.path("address4").asText(""));
        addAddressPart(parts, node.path("address5").asText(""));
        addAddressPart(parts, node.path("city").asText(""));
        addAddressPart(parts, node.path("country").asText(""));
        return String.join(", ", parts);
    }

    private void addAddressPart(List<String> parts, String val) {
        if (val != null && !val.trim().isBlank() && !"null".equalsIgnoreCase(val.trim())) {
            String trimmed = val.trim();
            if (parts.isEmpty() || !parts.get(parts.size() - 1).equalsIgnoreCase(trimmed)) {
                parts.add(trimmed);
            }
        }
    }

    private String extractDomainFromApiUrl(String apiUrl) {
        if (apiUrl == null || apiUrl.isBlank()) return "";
        String clean = apiUrl.trim().replaceFirst("^(?i)https?://", "");
        int slashIdx = clean.indexOf('/');
        return (slashIdx > 0 ? clean.substring(0, slashIdx) : clean).trim().toLowerCase();
    }
}
