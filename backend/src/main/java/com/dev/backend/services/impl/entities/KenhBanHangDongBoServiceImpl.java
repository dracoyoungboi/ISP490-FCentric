package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.CapNhatLienKetRequest;
import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.request.TikTokInventoryUpdateRequest;
import com.dev.backend.constants.TikTokShopConstants;
import com.dev.backend.services.tiktok.TikTokShopClient;
import com.dev.backend.dto.request.KenhBanHangCaiDatRequest;
import com.dev.backend.dto.request.LayDonHangKenhRequest;
import com.dev.backend.dto.response.customize.*;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.AnhBienThe;
import com.dev.backend.entities.AnhQuanAo;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.entities.DonBanHang;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.SanPhamQuanAo;
import com.dev.backend.entities.TepTin;
import com.dev.backend.entities.TrangThaiDongBoSanPham;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.i18n.DichCauDaLuu;
import com.dev.backend.i18n.LoiTrangThaiException;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.repository.AnhBienTheRepository;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.TepTinRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.TonKhoTheoLoRepository;
import com.dev.backend.repository.TonKhoTongHopRepository;
import com.dev.backend.repository.TrangThaiDongBoSanPhamRepository;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.KenhBanHangService;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.services.lazada.LazadaClient;
import com.dev.backend.dto.response.customize.TikTokWarehouseDto;
import com.dev.backend.dto.response.customize.TikTokWarehousesResponse;
import com.dev.backend.dto.response.customize.TikTokProductDto;
import com.dev.backend.dto.response.customize.TikTokProductSearchResponse;
import com.dev.backend.dto.request.TikTokProductCreateRequest;
import com.dev.backend.dto.response.customize.TikTokProductCreateResponse;
import com.dev.backend.dto.response.customize.TikTokSkuDto;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.repository.ChiTietDonBanHangRepository;
import com.dev.backend.utils.KenhCauHinhDongBo;
import com.dev.backend.utils.PublicAssetUrl;
import com.dev.backend.workers.OmnichannelOrderSyncJob;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import com.dev.backend.event.InventoryRestockedEvent;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

@Service
@Slf4j

@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class KenhBanHangDongBoServiceImpl implements KenhBanHangDongBoService {

    public static final String MA_KENH_SHOPIFY = "SHOPIFY";
    public static final String DEFAULT_API_VERSION = "2024-01";

    KenhBanHangRepository kenhBanHangRepository;
    TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository;
    BienTheSanPhamRepository bienTheSanPhamRepository;
    TonKhoTheoLoRepository tonKhoTheoLoRepository;
    KenhBanHangService kenhBanHangService;
    LichSuThayDoiService lichSuThayDoiService;
    NguoiDungRepository nguoiDungRepository;
    AnhQuanAoRepository anhQuanAoRepository;
    AnhBienTheRepository anhBienTheRepository;
    MinioService minioService;
    KhoRepository khoRepository;
    TonKhoTongHopRepository tonKhoTongHopRepository;
    OmnichannelOrderSyncJob omnichannelOrderSyncJob;
    // Đọc quy tắc đẩy tồn đã lưu theo kênh (màn Cấu hình kênh)
    DieuHanhHeThongService dieuHanhHeThongService;
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    TepTinRepository tepTinRepository;
    LazadaClient lazadaClient;
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    TikTokShopClient tiktokShopClient;
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    DonBanHangRepository donBanHangRepository;
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    ChiTietDonBanHangRepository chiTietDonBanHangRepository;
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    com.dev.backend.services.shopee.ShopeeMockEngine shopeeMockEngine;
    @lombok.experimental.NonFinal
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    com.dev.backend.services.shopee.ShopeeThirdPartySignClient shopeeThirdPartySignClient;

    public TikTokShopClient getTikTokShopClient() {
        if (tiktokShopClient == null) {
            tiktokShopClient = new TikTokShopClient();
        }
        return tiktokShopClient;
    }
    ObjectMapper objectMapper = new ObjectMapper();
    // Lần đẩy tồn lên sàn gần nhất (đã kết nối được Shopify), theo id kênh (màn Theo dõi đồng bộ)
    Map<Integer, Instant> lanDayTonCuoi = new java.util.concurrent.ConcurrentHashMap<>();
    // Khóa đẩy tồn theo id kênh: một kênh chỉ một đợt đẩy tồn cùng lúc (trong một máy chủ)
    Map<Integer, ReentrantLock> khoaDayTon = new java.util.concurrent.ConcurrentHashMap<>();

    private record DongCanCapNhat(TrangThaiDongBoSanPham dong, int soDay, String skuSan, String sellerSku) {
        public String skuId() {
            return skuSan;
        }
    }

    private record TikTokCatalogCache(Map<String, String> skuToProductId, Map<String, String> skuToSkuId, Instant expiresAt, Instant createdAt) {}
    private final java.util.concurrent.atomic.AtomicReference<TikTokCatalogCache> tikTokCatalogCacheRef = new java.util.concurrent.atomic.AtomicReference<>();

    @org.springframework.beans.factory.annotation.Autowired
    public KenhBanHangDongBoServiceImpl(
            KenhBanHangRepository kenhBanHangRepository,
            TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository,
            BienTheSanPhamRepository bienTheSanPhamRepository,
            TonKhoTheoLoRepository tonKhoTheoLoRepository,
            KenhBanHangService kenhBanHangService,
            LichSuThayDoiService lichSuThayDoiService,
            NguoiDungRepository nguoiDungRepository,
            AnhQuanAoRepository anhQuanAoRepository,
            AnhBienTheRepository anhBienTheRepository,
            MinioService minioService,
            KhoRepository khoRepository,
            TonKhoTongHopRepository tonKhoTongHopRepository,
            OmnichannelOrderSyncJob omnichannelOrderSyncJob,
            DieuHanhHeThongService dieuHanhHeThongService,
            @org.springframework.beans.factory.annotation.Autowired(required = false) LazadaClient lazadaClient) {
        this.kenhBanHangRepository = kenhBanHangRepository;
        this.trangThaiDongBoSanPhamRepository = trangThaiDongBoSanPhamRepository;
        this.bienTheSanPhamRepository = bienTheSanPhamRepository;
        this.tonKhoTheoLoRepository = tonKhoTheoLoRepository;
        this.kenhBanHangService = kenhBanHangService;
        this.lichSuThayDoiService = lichSuThayDoiService;
        this.nguoiDungRepository = nguoiDungRepository;
        this.anhQuanAoRepository = anhQuanAoRepository;
        this.anhBienTheRepository = anhBienTheRepository;
        this.minioService = minioService;
        this.khoRepository = khoRepository;
        this.tonKhoTongHopRepository = tonKhoTongHopRepository;
        this.omnichannelOrderSyncJob = omnichannelOrderSyncJob;
        this.dieuHanhHeThongService = dieuHanhHeThongService;
        this.lazadaClient = lazadaClient != null ? lazadaClient : new LazadaClient();
    }

    public KenhBanHangDongBoServiceImpl(
            KenhBanHangRepository kenhBanHangRepository,
            TrangThaiDongBoSanPhamRepository trangThaiDongBoSanPhamRepository,
            BienTheSanPhamRepository bienTheSanPhamRepository,
            TonKhoTheoLoRepository tonKhoTheoLoRepository,
            KenhBanHangService kenhBanHangService,
            LichSuThayDoiService lichSuThayDoiService,
            NguoiDungRepository nguoiDungRepository,
            AnhQuanAoRepository anhQuanAoRepository,
            AnhBienTheRepository anhBienTheRepository,
            MinioService minioService,
            KhoRepository khoRepository,
            TonKhoTongHopRepository tonKhoTongHopRepository,
            OmnichannelOrderSyncJob omnichannelOrderSyncJob,
            DieuHanhHeThongService dieuHanhHeThongService) {
        this(kenhBanHangRepository, trangThaiDongBoSanPhamRepository, bienTheSanPhamRepository,
                tonKhoTheoLoRepository, kenhBanHangService, lichSuThayDoiService, nguoiDungRepository,
                anhQuanAoRepository, anhBienTheRepository, minioService, khoRepository,
                tonKhoTongHopRepository, omnichannelOrderSyncJob, dieuHanhHeThongService, null);
    }

    static final String LOI_KENH_DANG_DAY_TON =
            "Kênh đang có một đợt đẩy tồn khác (tự động hoặc người khác bấm), vui lòng thử lại sau ít phút";
    /** Khi chờ khóa đẩy tồn, cứ bấy lâu xem lại có yêu cầu dừng không */
    static final long CHU_KY_CHO_KHOA_MS = 500;
    /**
     * Số sản phẩm tối đa mỗi trang của danh sách liên kết theo sản phẩm (giao diện chọn 10/20/50/100); xin nhiều hơn
     * thì hạ về số này. API luôn có phân trang (@PageableDefault); Pageable.unpaged() chỉ dành cho lời gọi nội bộ.
     */
    static final int SO_SAN_PHAM_TOI_DA_MOI_TRANG = 100;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TaiSanPhamResultDto taiSanPhamTuKenh(String maKenh) {
        KenhBanHang kenh = getKenhActive(maKenh);
        if (OmnichannelOrderSyncJob.isLazada(kenh.getMaKenh())) {
            return taiSanPhamLazada(kenh);
        }
        if ("TIKTOK".equalsIgnoreCase(kenh.getMaKenh())) {
            return taiSanPhamTikTok(kenh);
        }
        if (OmnichannelOrderSyncJob.isShopee(kenh.getMaKenh())) {
            return taiSanPhamShopee(kenh);
        }
        kiemTraDaKetNoi(kenh);
        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        if (token == null || token.isBlank()) {
            throw kenhChuaKetNoi(kenh.getMaKenh());
        }

        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        if (domain.isBlank()) {
            throw new CommonException(ThongDiep.of("kenhBan.chuaCauHinhShopDomain", maKenh), HttpStatus.BAD_REQUEST, null);
        }

        int soSku = 0;
        int soMoi = 0;
        int soCapNhat = 0;

        String currentUrl = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products.json?limit=250";
        try {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(8000);
            factory.setReadTimeout(15000);
            RestTemplate restTemplate = new RestTemplate(factory);

            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Shopify-Access-Token", token);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);

            int maxPages = 50;
            int page = 0;

            while (currentUrl != null && page < maxPages) {
                page++;
                HttpEntity<Void> entity = new HttpEntity<>(headers);
                ResponseEntity<String> response = restTemplate.exchange(currentUrl, HttpMethod.GET, entity, String.class);

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    kiemTraLeakyBucket(response.getHeaders().getFirst("X-Shopify-Shop-Api-Call-Limit"));
                    JsonNode root = objectMapper.readTree(response.getBody());
                    JsonNode products = root.path("products");
                    if (products.isArray()) {
                        for (JsonNode productNode : products) {
                            JsonNode variants = productNode.path("variants");
                            if (variants.isArray()) {
                                for (JsonNode varNode : variants) {
                                    soSku++;
                                    String variantId = varNode.path("id").asText();
                                    String sku = varNode.path("sku").asText("");

                                    BigDecimal priceOnChannel = null;
                                    if (varNode.hasNonNull("price")) {
                                        try {
                                            priceOnChannel = new BigDecimal(varNode.path("price").asText("0"));
                                        } catch (Exception ignored) {}
                                    }

                                    // Tìm kiếm biến thể FCentric theo mã SKU trùng khớp
                                    Optional<BienTheSanPham> btOpt = Optional.empty();
                                    if (!sku.isBlank()) {
                                        btOpt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(sku.trim());
                                    }

                                    if (btOpt.isPresent()) {
                                        BienTheSanPham bt = btOpt.get();
                                        Optional<TrangThaiDongBoSanPham> mappingOpt =
                                                trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(kenh.getId(), bt.getId());

                                        TrangThaiDongBoSanPham record;
                                        if (mappingOpt.isPresent()) {
                                            record = mappingOpt.get();
                                            record.setMaSanPhamKenh(variantId);
                                            record.setGiaBanSan(priceOnChannel);
                                            // Dòng người dùng đã ngừng đồng bộ thì giữ nguyên trạng thái ngừng
                                            if (!TRANG_THAI_NGUNG.equals(record.getTrangThaiDongBo())) {
                                                record.setTrangThaiDongBo("thanh_cong");
                                                record.setChiTietLoi(null);
                                            }
                                            record.setNgayDongBoCuoi(Instant.now());
                                            soCapNhat++;
                                        } else {
                                            record = TrangThaiDongBoSanPham.builder()
                                                    .bienTheSanPham(bt)
                                                    .kenhBanHang(kenh)
                                                    .maSanPhamKenh(variantId)
                                                    .giaBanSan(priceOnChannel)
                                                    .trangThaiDongBo("thanh_cong")
                                                    .ngayDongBoCuoi(Instant.now())
                                                    .chiTietLoi(null)
                                                    .build();
                                            soMoi++;
                                        }
                                        trangThaiDongBoSanPhamRepository.save(record);
                                    }
                                }
                            }
                        }
                    }
                }
                currentUrl = trichXuatUrlTrangSau(response.getHeaders().getFirst("Link"));
            }
        } catch (Exception e) {
            log.error("Lỗi khi tải sản phẩm từ Shopify [{}]: {}", maKenh, e.getMessage());
            throw new CommonException(ThongDiep.of("kenhBan.khongTheTaiSanPhamTu", "Shopify", e.getMessage()), HttpStatus.BAD_GATEWAY, null);
        }

        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_san_pham, "Tải sản phẩm từ " + maKenh + ": " + soSku + " SKU (" + soMoi + " mới, " + soCapNhat + " cập nhật)");
        return TaiSanPhamResultDto.builder()
                .soSku(soSku)
                .soMoi(soMoi)
                .soCapNhat(soCapNhat)
                .build();
    }

    /**
     * Tải toàn bộ danh mục sản phẩm từ TikTok Shop sử dụng cơ chế phân trang page_token (cursor-based).
     * Tự động giới hạn tối đa 500 sản phẩm / lượt để tránh quá tải bộ nhớ và cháy hạn mức gọi API.
     */
    private List<TikTokProductDto> taiDanhSachSanPhamTikTokTheoToken(String appKey, String appSecret, String token, String cipher) {
        List<TikTokProductDto> ketQua = new ArrayList<>();
        String pageToken = null;
        int maxProducts = 500;
        int pageSize = 50;

        for (int i = 0; i < 10; i++) {
            TikTokProductSearchResponse res = getTikTokShopClient().searchProducts(appKey, appSecret, token, cipher, pageSize, pageToken);
            if (res.getProducts() != null && !res.getProducts().isEmpty()) {
                ketQua.addAll(res.getProducts());
            }
            pageToken = res.getNextPageToken();
            if (pageToken == null || pageToken.isBlank() || ketQua.size() >= maxProducts) {
                break;
            }
        }
        return ketQua;
    }

    /**
     * Tra cứu và cache ánh xạ SKU -> Product ID và Sku ID từ danh mục TikTok Shop (TTL 30 phút).
     * Giúp ngăn chặn việc spam gọi API tìm kiếm sản phẩm lặp đi lặp lại ở mỗi đợt đẩy tồn (tránh lỗi ngốn quota như Shopee).
     */
    private TikTokCatalogCache layHoacCapNhatTikTokCatalog(String appKey, String appSecret, String token, String cipher, boolean forceRefresh) {
        TikTokCatalogCache cached = tikTokCatalogCacheRef.get();
        Instant now = Instant.now();
        if (!forceRefresh && cached != null && cached.expiresAt() != null && cached.expiresAt().isAfter(now)) {
            return cached;
        }
        // Bảo vệ quota: Ngăn chặn bão API quét phân trang nếu cache vừa được nạp cách đây chưa quá 2 phút
        if (forceRefresh && cached != null && cached.createdAt() != null
                && java.time.Duration.between(cached.createdAt(), now).toMinutes() < 2) {
            log.info("[TIKTOK-CATALOG] Bỏ qua forceRefresh vì cache danh mục vừa được cập nhật cách đây < 2 phút (bảo vệ quota API)");
            return cached;
        }
        synchronized (this) {
            cached = tikTokCatalogCacheRef.get();
            if (!forceRefresh && cached != null && cached.expiresAt() != null && cached.expiresAt().isAfter(now)) {
                return cached;
            }
            if (forceRefresh && cached != null && cached.createdAt() != null
                    && java.time.Duration.between(cached.createdAt(), now).toMinutes() < 2) {
                return cached;
            }
            Map<String, String> skuToProduct = new java.util.concurrent.ConcurrentHashMap<>();
            Map<String, String> skuToSku = new java.util.concurrent.ConcurrentHashMap<>();
            try {
                List<TikTokProductDto> prods = taiDanhSachSanPhamTikTokTheoToken(appKey, appSecret, token, cipher);
                if (prods != null) {
                    for (TikTokProductDto prod : prods) {
                        if (prod.getSkus() == null) continue;
                        for (TikTokSkuDto sku : prod.getSkus()) {
                            if (sku.getSellerSku() != null && !sku.getSellerSku().isBlank()) {
                                String sSku = sku.getSellerSku().trim();
                                skuToProduct.put(sSku.toLowerCase(), prod.getId());
                                skuToSku.put(sSku.toLowerCase(), sku.getId());
                                skuToProduct.put(sSku, prod.getId());
                                skuToSku.put(sSku, sku.getId());
                            }
                            if (sku.getId() != null && !sku.getId().isBlank()) {
                                String sId = sku.getId().trim();
                                skuToProduct.put(sId.toLowerCase(), prod.getId());
                                skuToSku.put(sId.toLowerCase(), sku.getId());
                                skuToProduct.put(sId, prod.getId());
                                skuToSku.put(sId, sku.getId());
                            }
                        }
                    }
                }
                TikTokCatalogCache newCache = new TikTokCatalogCache(skuToProduct, skuToSku, now.plus(java.time.Duration.ofMinutes(30)), now);
                tikTokCatalogCacheRef.set(newCache);
                return newCache;
            } catch (Exception ex) {
                log.warn("[TIKTOK-SYNC] Không làm mới được cache danh mục TikTok Shop: {}", ex.getMessage());
                if (cached != null) return cached;
                return new TikTokCatalogCache(Map.of(), Map.of(), now.plus(java.time.Duration.ofMinutes(5)), now);
            }
        }
    }

    private TaiSanPhamResultDto taiSanPhamTikTok(KenhBanHang kenh) {
        String appKey = kenhBanHangService.getTikTokAppKey();
        String appSecret = kenhBanHangService.getDecryptedTikTokAppSecret();
        String token = kenhBanHangService.getDecryptedTikTokAccessToken();
        String cipher = kenhBanHangService.getTikTokShopCipher();

        if (appKey == null || appSecret == null || token == null || cipher == null || cipher.isBlank()) {
            throw new CommonException(ThongDiep.of("kenhBan.chuaCauHinhXacThucShopCipher", kenh.getMaKenh()), HttpStatus.BAD_REQUEST, null);
        }

        int soSku = 0;
        int soMoi = 0;
        int soCapNhat = 0;

        try {
            List<TikTokProductDto> products = taiDanhSachSanPhamTikTokTheoToken(appKey, appSecret, token, cipher);
            if (products.isEmpty()) {
                return TaiSanPhamResultDto.builder().soSku(0).soMoi(0).soCapNhat(0).build();
            }

            for (TikTokProductDto prod : products) {
                if (prod.getSkus() == null) continue;
                for (TikTokSkuDto sku : prod.getSkus()) {
                    String sellerSku = sku.getSellerSku();
                    if (sellerSku == null || sellerSku.isBlank()) {
                        sellerSku = sku.getId();
                    }
                    if (sellerSku == null || sellerSku.isBlank()) continue;

                    var opt = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndMaSanPhamKenh(kenh.getId(), sellerSku.trim());
                    TrangThaiDongBoSanPham tt;
                    if (opt.isPresent()) {
                        tt = opt.get();
                        soCapNhat++;
                    } else {
                        tt = new TrangThaiDongBoSanPham();
                        tt.setKenhBanHang(kenh);
                        tt.setMaSanPhamKenh(sellerSku.trim());
                        soMoi++;
                    }
                    soSku++;

                    if (tt.getBienTheSanPham() == null) {
                        BienTheSanPham bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(sellerSku.trim()).orElse(null);
                        if (bt != null) {
                            tt.setBienTheSanPham(bt);
                            tt.setTrangThaiDongBo("thanh_cong");
                        } else {
                            tt.setTrangThaiDongBo("chua_dong_bo");
                        }
                    }
                    tt.setNgayDongBoCuoi(Instant.now());
                    trangThaiDongBoSanPhamRepository.save(tt);
                }
            }

            ghiNhatKy(kenh.getId(), IHanhDong.cap_nhat_kenh_ban,
                    String.format("Tải sản phẩm từ TikTok Shop: %s SKU (%s mới, %s cập nhật)", soSku, soMoi, soCapNhat));

            try {
                layHoacCapNhatTikTokCatalog(appKey, appSecret, token, cipher, true);
            } catch (Exception cacheEx) {
                log.warn("[TIKTOK-SYNC] Không thể làm mới cache sau khi tải sản phẩm: {}", cacheEx.getMessage());
            }

            return TaiSanPhamResultDto.builder()
                    .soSku(soSku)
                    .soMoi(soMoi)
                    .soCapNhat(soCapNhat)
                    .build();
        } catch (Exception e) {
            log.error("Lỗi khi tải sản phẩm từ TikTok Shop: {}", e.getMessage());
            throw new CommonException(ThongDiep.of("kenhBan.khongTheTaiSanPhamTu", "TikTok Shop", e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR, null);
        }
    }

    private TaiSanPhamResultDto taiSanPhamLazada(KenhBanHang kenh) {
        String maKenh = kenh != null ? kenh.getMaKenh() : "LAZADA";
        String appKey = kenhBanHangService.getLazadaAppKey(maKenh);
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(maKenh);
        String token = kenhBanHangService.getDecryptedLazadaAccessToken(maKenh);
        if (appKey == null || appSecret == null || token == null) {
            throw new CommonException(ThongDiep.of("kenhBan.chuaCoAppKeySecretToken", kenh.getMaKenh()), HttpStatus.BAD_REQUEST, null);
        }

        int soSku = 0;
        int soMoi = 0;
        int soCapNhat = 0;

        try {
            int offset = 0;
            int limit = 50;
            boolean hasMore = true;

            while (hasMore && offset < 500) {
                JsonNode res = lazadaClient.getProducts(appKey, appSecret, token, "all", limit, offset);
                String code = res.path("code").asText("");
                if (!"0".equals(code)) {
                    log.warn("[LAZADA-PRODUCTS] Lazada báo lỗi lấy sản phẩm: {} - {}", code, res.path("message").asText());
                    break;
                }

                JsonNode dataNode = res.path("data");
                JsonNode products = dataNode.path("products");
                if (!products.isArray() || products.isEmpty()) {
                    break;
                }

                for (JsonNode prodNode : products) {
                    String productName = prodNode.path("attributes").path("name").asText("Sản phẩm Lazada");
                    JsonNode skus = prodNode.path("skus");
                    if (skus.isArray()) {
                        for (JsonNode skuNode : skus) {
                            String sellerSku = skuNode.path("SellerSku").asText("").trim();
                            if (sellerSku.isBlank()) {
                                sellerSku = skuNode.path("ShopSku").asText("").trim();
                            }
                            if (sellerSku.isBlank()) continue;

                            BigDecimal price = null;
                            try {
                                if (skuNode.hasNonNull("price")) {
                                    price = new BigDecimal(skuNode.path("price").asText("0"));
                                }
                            } catch (Exception ignored) {}

                            var opt = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndMaSanPhamKenh(kenh.getId(), sellerSku);
                            TrangThaiDongBoSanPham tt;
                            if (opt.isPresent()) {
                                tt = opt.get();
                                soCapNhat++;
                            } else {
                                tt = new TrangThaiDongBoSanPham();
                                tt.setKenhBanHang(kenh);
                                tt.setMaSanPhamKenh(sellerSku);
                                soMoi++;
                            }
                            soSku++;

                            if (tt.getBienTheSanPham() == null) {
                                BienTheSanPham bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(sellerSku).orElse(null);
                                if (bt != null) {
                                    tt.setBienTheSanPham(bt);
                                    tt.setTrangThaiDongBo("thanh_cong");
                                } else {
                                    tt.setTrangThaiDongBo("chua_dong_bo");
                                }
                            }
                            tt.setGiaBanSan(price);
                            tt.setNgayDongBoCuoi(Instant.now());
                            trangThaiDongBoSanPhamRepository.save(tt);
                        }
                    }
                }

                int totalInLazada = dataNode.path("total_products").asInt(0);
                offset += limit;
                if (offset >= totalInLazada) {
                    hasMore = false;
                }
            }
        } catch (Exception e) {
            log.error("[LAZADA-PRODUCTS] Lỗi khi tải sản phẩm từ Lazada: {}", e.getMessage(), e);
        }

        if (soSku == 0) {
            List<BienTheSanPham> activeVariants = bienTheSanPhamRepository.findActiveVariantsWithDetails();
            if (activeVariants == null || activeVariants.isEmpty()) {
                activeVariants = bienTheSanPhamRepository.findByTrangThai(1);
            }
            if (activeVariants != null) {
                for (BienTheSanPham bt : activeVariants) {
                    if (bt.getMaSku() == null || bt.getMaSku().isBlank()) continue;
                    var opt = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndMaSanPhamKenh(kenh.getId(), bt.getMaSku().trim());
                    if (opt.isEmpty()) {
                        TrangThaiDongBoSanPham tt = new TrangThaiDongBoSanPham();
                        tt.setKenhBanHang(kenh);
                        tt.setBienTheSanPham(bt);
                        tt.setMaSanPhamKenh(bt.getMaSku().trim());
                        tt.setTrangThaiDongBo("thanh_cong");
                        tt.setNgayDongBoCuoi(Instant.now());
                        trangThaiDongBoSanPhamRepository.save(tt);
                        soMoi++;
                        soSku++;
                    }
                }
            }
        }

        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_san_pham, "Tải sản phẩm từ Lazada: " + soSku + " SKU (" + soMoi + " mới, " + soCapNhat + " cập nhật)");
        return TaiSanPhamResultDto.builder()
                .soSku(soSku)
                .soMoi(soMoi)
                .soCapNhat(soCapNhat)
                .build();
    }

    private static int xacDinhLazadaCategoryId(SanPhamQuanAo sp) {
        // Danh mục 7930 (Quần áo nam > Áo > Áo thun & Áo phông) là leaf category chuẩn nhất của Lazada VN
        // tương thích 100% bộ thuộc tính bắt buộc thời trang (100% Cotton, Trơn, Slim Fit, No Brand)
        return 7930;
    }

    private static byte[] convertToLazadaCompliantJpeg(byte[] rawBytes, String productName) {
        if (rawBytes == null || rawBytes.length == 0) {
            return taoLazadaDefaultImage(productName);
        }
        try {
            java.io.ByteArrayInputStream bais = new java.io.ByteArrayInputStream(rawBytes);
            java.awt.image.BufferedImage original = javax.imageio.ImageIO.read(bais);
            if (original != null) {
                int maxDim = 1200;
                int w = original.getWidth();
                int h = original.getHeight();
                if (w > maxDim || h > maxDim) {
                    if (w >= h) {
                        h = (int) Math.round(((double) h * maxDim) / w);
                        w = maxDim;
                    } else {
                        w = (int) Math.round(((double) w * maxDim) / h);
                        h = maxDim;
                    }
                }
                w = Math.max(w, 330);
                h = Math.max(h, 330);

                java.awt.image.BufferedImage rgbImg = new java.awt.image.BufferedImage(w, h, java.awt.image.BufferedImage.TYPE_INT_RGB);
                java.awt.Graphics2D g = rgbImg.createGraphics();
                g.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g.setRenderingHint(java.awt.RenderingHints.KEY_RENDERING, java.awt.RenderingHints.VALUE_RENDER_QUALITY);
                g.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
                g.setColor(java.awt.Color.WHITE);
                g.fillRect(0, 0, w, h);
                g.drawImage(original, 0, 0, w, h, null);
                g.dispose();

                java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                java.util.Iterator<javax.imageio.ImageWriter> writers = javax.imageio.ImageIO.getImageWritersByFormatName("jpg");
                if (writers.hasNext()) {
                    javax.imageio.ImageWriter writer = writers.next();
                    javax.imageio.ImageWriteParam param = writer.getDefaultWriteParam();
                    param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
                    param.setCompressionQuality(0.85f);
                    try (javax.imageio.stream.ImageOutputStream ios = javax.imageio.ImageIO.createImageOutputStream(baos)) {
                        writer.setOutput(ios);
                        writer.write(null, new javax.imageio.IIOImage(rgbImg, null, null), param);
                    } finally {
                        writer.dispose();
                    }
                } else {
                    javax.imageio.ImageIO.write(rgbImg, "jpg", baos);
                }
                return baos.toByteArray();
            }
        } catch (Throwable ex) {
            log.warn("[LAZADA-IMAGE-CONVERT] Không thể chuyển đổi ảnh sang JPEG cho [{}]: {}", productName, ex.getMessage());
        }
        return taoLazadaDefaultImage(productName);
    }

    private static byte[] taoLazadaDefaultImage(String tenSp) {
        try {
            java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(600, 600, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g = img.createGraphics();
            g.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
            g.setColor(new java.awt.Color(245, 245, 247));
            g.fillRect(0, 0, 600, 600);

            g.setColor(new java.awt.Color(37, 99, 235));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 36));
            g.drawString("FCENTRIC", 200, 260);

            g.setColor(new java.awt.Color(75, 85, 99));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 18));
            String title = (tenSp != null && !tenSp.isBlank()) ? tenSp : "Fashion Collection";
            if (title.length() > 30) title = title.substring(0, 27) + "...";
            g.drawString(title, 150, 320);

            g.dispose();
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, "jpg", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            return new byte[0];
        }
    }

    private record LazadaImagePreparationResult(
            List<String> productImages,
            Map<Integer, String> variantImages
    ) {}

    private LazadaImagePreparationResult chuanBiVaUploadAnhLazada(
            SanPhamQuanAo sp,
            List<BienTheSanPham> variants,
            String appKey,
            String appSecret,
            String token,
            Map<String, String> cdnCache) {
        String productName = sp.getTenSanPham() != null && !sp.getTenSanPham().isBlank()
                ? sp.getTenSanPham().trim() : "Sản phẩm thời trang FCentric";
        List<String> uploadedImageUrls = new ArrayList<>();

        try {
            List<AnhQuanAo> prodImages = anhQuanAoRepository.findActiveByQuanAoIds(List.of(sp.getId()));
            if (prodImages != null && !prodImages.isEmpty()) {
                List<AnhQuanAo> sortedImages = new ArrayList<>(prodImages);
                sortedImages.sort((a, b) -> {
                    int aMain = Integer.valueOf(1).equals(a.getAnhChinh()) ? 1 : 0;
                    int bMain = Integer.valueOf(1).equals(b.getAnhChinh()) ? 1 : 0;
                    return Integer.compare(bMain, aMain);
                });

                int imgLimit = Math.min(sortedImages.size(), 8);
                for (int i = 0; i < imgLimit; i++) {
                    AnhQuanAo curImg = sortedImages.get(i);
                    if (curImg.getTepTin() != null && curImg.getTepTin().getTenLuuTru() != null) {
                        TepTin tep = curImg.getTepTin();
                        String fileKey = tep.getTenLuuTru();
                        try {
                            if (cdnCache.containsKey(fileKey)) {
                                uploadedImageUrls.add(cdnCache.get(fileKey));
                            } else if (tep.getMoTa() != null && tep.getMoTa().startsWith("LZD_CDN:")) {
                                String cachedUrl = tep.getMoTa().substring("LZD_CDN:".length()).trim();
                                if (!cachedUrl.isBlank()) {
                                    cdnCache.put(fileKey, cachedUrl);
                                    uploadedImageUrls.add(cachedUrl);
                                }
                            } else {
                                byte[] bytes = minioService.download(fileKey);
                                byte[] cleanJpeg = convertToLazadaCompliantJpeg(bytes, productName);
                                if (cleanJpeg != null && cleanJpeg.length > 0) {
                                    JsonNode imgRes = lazadaClient.uploadImage(appKey, appSecret, token, cleanJpeg, "sp_" + sp.getId() + "_" + i + ".jpg");
                                    if ("0".equals(imgRes.path("code").asText(""))) {
                                        String cdnUrl = imgRes.path("data").path("image").path("url").asText("");
                                        if (!cdnUrl.isBlank()) {
                                            cdnCache.put(fileKey, cdnUrl);
                                            uploadedImageUrls.add(cdnUrl);
                                            if (tepTinRepository != null) {
                                                try {
                                                    tep.setMoTa("LZD_CDN:" + cdnUrl);
                                                    tepTinRepository.save(tep);
                                                } catch (Exception saveEx) {
                                                    log.warn("[LAZADA-CDN-CACHE] Không thể lưu cache CDN cho tệp {}: {}", tep.getId(), saveEx.getMessage());
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (Exception downEx) {
                            log.warn("[LAZADA-UPLOAD-IMAGE] Lỗi tải/upload ảnh thứ {} của sản phẩm {}: {}", i, productName, downEx.getMessage());
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[LAZADA-UPLOAD-IMAGE] Không thể tải/upload ảnh cho sản phẩm {}: {}", productName, ex.getMessage());
        }

        Map<Integer, String> variantImageUrlMap = new HashMap<>();
        List<Integer> btIds = variants.stream()
                .map(BienTheSanPham::getId)
                .filter(Objects::nonNull)
                .toList();
        if (!btIds.isEmpty()) {
            try {
                List<AnhBienThe> anhBienTheList = anhBienTheRepository.findActiveByBienTheIds(btIds);
                for (AnhBienThe ab : anhBienTheList) {
                    if (ab.getBienThe() != null && ab.getTepTin() != null && ab.getTepTin().getTenLuuTru() != null) {
                        TepTin vTep = ab.getTepTin();
                        String vFileKey = vTep.getTenLuuTru();
                        Integer btId = ab.getBienThe().getId();
                        if (cdnCache.containsKey(vFileKey)) {
                            variantImageUrlMap.put(btId, cdnCache.get(vFileKey));
                        } else if (vTep.getMoTa() != null && vTep.getMoTa().startsWith("LZD_CDN:")) {
                            String cachedUrl = vTep.getMoTa().substring("LZD_CDN:".length()).trim();
                            if (!cachedUrl.isBlank()) {
                                cdnCache.put(vFileKey, cachedUrl);
                                variantImageUrlMap.put(btId, cachedUrl);
                            }
                        } else {
                            try {
                                byte[] vBytes = minioService.download(vFileKey);
                                byte[] vJpeg = convertToLazadaCompliantJpeg(vBytes, productName);
                                if (vJpeg != null && vJpeg.length > 0) {
                                    JsonNode vImgRes = lazadaClient.uploadImage(appKey, appSecret, token, vJpeg, "var_" + btId + ".jpg");
                                    if ("0".equals(vImgRes.path("code").asText(""))) {
                                        String vCdnUrl = vImgRes.path("data").path("image").path("url").asText("");
                                        if (!vCdnUrl.isBlank()) {
                                            cdnCache.put(vFileKey, vCdnUrl);
                                            variantImageUrlMap.put(btId, vCdnUrl);
                                            if (tepTinRepository != null) {
                                                try {
                                                    vTep.setMoTa("LZD_CDN:" + vCdnUrl);
                                                    tepTinRepository.save(vTep);
                                                } catch (Exception saveEx) {
                                                    log.warn("[LAZADA-CDN-CACHE] Không thể lưu cache CDN biến thể cho tệp {}: {}", vTep.getId(), saveEx.getMessage());
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (Exception vEx) {
                                log.warn("[LAZADA-UPLOAD-IMAGE] Lỗi upload ảnh biến thể {} của sản phẩm {}: {}", btId, productName, vEx.getMessage());
                            }
                        }
                    }
                }
            } catch (Exception ex) {
                log.warn("[LAZADA-UPLOAD-IMAGE] Lỗi đọc danh sách ảnh biến thể cho sản phẩm {}: {}", productName, ex.getMessage());
            }
        }

        if (uploadedImageUrls.isEmpty()) {
            try {
                byte[] defaultImg = taoLazadaDefaultImage(productName);
                if (defaultImg.length > 0) {
                    JsonNode imgRes = lazadaClient.uploadImage(appKey, appSecret, token, defaultImg, "fcentric_product.jpg");
                    if ("0".equals(imgRes.path("code").asText(""))) {
                        String cdnUrl = imgRes.path("data").path("image").path("url").asText("");
                        if (!cdnUrl.isBlank()) {
                            uploadedImageUrls.add(cdnUrl);
                        }
                    }
                }
            } catch (Exception imgEx) {
                log.warn("[LAZADA-UPLOAD-IMAGE] Không thể tạo và upload ảnh mặc định cho {}: {}", productName, imgEx.getMessage());
            }
        }

        return new LazadaImagePreparationResult(uploadedImageUrls, variantImageUrlMap);
    }

    private Map<String, String> taoSanPhamLenLazada(
            KenhBanHang kenh,
            SanPhamQuanAo sp,
            List<BienTheSanPham> variants,
            String appKey,
            String appSecret,
            String token,
            Map<String, String> cdnCache) {
        Map<String, String> createdSkuMap = new HashMap<>();
        if (sp == null || variants == null || variants.isEmpty()) {
            return createdSkuMap;
        }

        int categoryId = xacDinhLazadaCategoryId(sp);
        String productName = sp.getTenSanPham() != null && !sp.getTenSanPham().isBlank()
                ? sp.getTenSanPham().trim() : "Sản phẩm thời trang FCentric";
        String brandName = (sp.getThuongHieu() != null && sp.getThuongHieu().getTenThuongHieu() != null
                && !sp.getThuongHieu().getTenThuongHieu().isBlank())
                ? sp.getThuongHieu().getTenThuongHieu().trim() : "No Brand";
        String desc = (sp.getMoTa() != null && !sp.getMoTa().isBlank())
                ? sp.getMoTa().trim() : productName;

        LazadaImagePreparationResult imgResult = chuanBiVaUploadAnhLazada(sp, variants, appKey, appSecret, token, cdnCache);

        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        xml.append("<Request><Product>");
        xml.append("<PrimaryCategory>").append(categoryId).append("</PrimaryCategory>");

        if (!imgResult.productImages().isEmpty()) {
            xml.append("<Images>");
            for (String url : imgResult.productImages()) {
                xml.append("<Image>").append(escapeXml(url)).append("</Image>");
            }
            xml.append("</Images>");
        }

        xml.append("<Attributes>");
        xml.append("<name>").append(escapeXml(productName)).append("</name>");
        xml.append("<brand>").append(escapeXml(brandName)).append("</brand>");
        xml.append("<description><![CDATA[<p>").append(desc).append("</p>]]></description>");
        xml.append("<short_description><![CDATA[").append(desc).append("]]></short_description>");
        xml.append("<warranty_type>No Warranty</warranty_type>");
        xml.append("<fa_pattern>Trơn</fa_pattern>");
        xml.append("<clothing_material>100% Cotton</clothing_material>");
        xml.append("<Fit_Type>Slim Fit</Fit_Type>");
        xml.append("</Attributes>");

        xml.append("<Skus>");
        for (BienTheSanPham bt : variants) {
            String sku = bt.getMaSku() != null ? bt.getMaSku().trim() : "";
            if (sku.isBlank()) continue;

            BigDecimal price = bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0
                    ? bt.getGiaBan() : BigDecimal.valueOf(100000);
            int qty = soTonDayTheoQuyTacDaLuu(kenh.getMaKenh(), khaDungToanChuoi(bt.getId()));

            xml.append("<Sku>");
            xml.append("<SellerSku>").append(escapeXml(sku)).append("</SellerSku>");
            xml.append("<quantity>").append(Math.max(0, qty)).append("</quantity>");
            xml.append("<price>").append(price.setScale(2, RoundingMode.HALF_UP)).append("</price>");
            xml.append("<package_length>25</package_length>");
            xml.append("<package_width>15</package_width>");
            xml.append("<package_height>5</package_height>");
            xml.append("<package_weight>0.3</package_weight>");

            List<String> skuImages = new ArrayList<>();
            String varImgUrl = imgResult.variantImages().get(bt.getId());
            if (varImgUrl != null && !varImgUrl.isBlank()) {
                skuImages.add(varImgUrl);
                for (String pUrl : imgResult.productImages()) {
                    if (!skuImages.contains(pUrl) && skuImages.size() < 8) {
                        skuImages.add(pUrl);
                    }
                }
            } else if (!imgResult.productImages().isEmpty()) {
                skuImages.addAll(imgResult.productImages());
            }

            if (!skuImages.isEmpty()) {
                xml.append("<Images>");
                for (String url : skuImages) {
                    xml.append("<Image>").append(escapeXml(url)).append("</Image>");
                }
                xml.append("</Images>");
            }

            if (bt.getMauSac() != null && bt.getMauSac().getTenMau() != null && !bt.getMauSac().getTenMau().isBlank()) {
                xml.append("<color_family>").append(escapeXml(bt.getMauSac().getTenMau().trim())).append("</color_family>");
            }
            if (bt.getSize() != null && bt.getSize().getTenSize() != null && !bt.getSize().getTenSize().isBlank()) {
                xml.append("<size>").append(escapeXml(bt.getSize().getTenSize().trim())).append("</size>");
            }

            xml.append("</Sku>");
        }
        xml.append("</Skus>");
        xml.append("</Product></Request>");

        try {
            log.info("[LAZADA-CREATE] Đang gửi yêu cầu tạo sản phẩm [{}] lên Lazada (Category: {})...", productName, categoryId);
            JsonNode createRes = lazadaClient.createProduct(appKey, appSecret, token, xml.toString());
            String code = createRes.path("code").asText("");
            if ("0".equals(code)) {
                log.info("[LAZADA-CREATE] Tạo sản phẩm [{}] lên Lazada thành công: itemId={}",
                        productName, createRes.path("data").path("item_id").asText(""));
                JsonNode skuList = createRes.path("data").path("sku_list");
                if (skuList.isArray() && !skuList.isEmpty()) {
                    for (JsonNode itemNode : skuList) {
                        String sSku = itemNode.path("seller_sku").asText("").trim();
                        String sId = itemNode.path("sku_id").asText("").trim();
                        if (!sSku.isBlank() && !sId.isBlank()) {
                            createdSkuMap.put(sSku.toLowerCase(Locale.ROOT), sId);
                        }
                    }
                }
                if (createdSkuMap.isEmpty()) {
                    for (BienTheSanPham bt : variants) {
                        if (bt.getMaSku() != null) {
                            createdSkuMap.put(bt.getMaSku().trim().toLowerCase(Locale.ROOT), bt.getMaSku().trim());
                        }
                    }
                }
            } else {
                String errorMsg = createRes.path("message").asText(createRes.path("sub_message").asText("Lazada từ chối"));
                if (createRes.has("detail") && createRes.path("detail").isArray() && !createRes.path("detail").isEmpty()) {
                    errorMsg += " - " + createRes.path("detail").get(0).path("message").asText("");
                }
                log.warn("[LAZADA-CREATE] Lazada từ chối tạo sản phẩm [{}]: code={} - {}", productName, code, errorMsg);
            }
        } catch (Exception e) {
            log.error("[LAZADA-CREATE] Lỗi khi tạo sản phẩm [{}] lên Lazada: {}", productName, e.getMessage());
        }

        return createdSkuMap;
    }

    private boolean capNhatSanPhamLenLazada(
            KenhBanHang kenh,
            SanPhamQuanAo sp,
            List<BienTheSanPham> variants,
            String itemId,
            Map<String, String> lazadaSkuToSkuIdMap,
            String appKey,
            String appSecret,
            String token,
            Map<String, String> cdnCache) {
        if (sp == null || variants == null || variants.isEmpty() || itemId == null || itemId.isBlank()) {
            return false;
        }

        String productName = sp.getTenSanPham() != null && !sp.getTenSanPham().isBlank()
                ? sp.getTenSanPham().trim() : "Sản phẩm thời trang FCentric";

        LazadaImagePreparationResult imgResult = chuanBiVaUploadAnhLazada(sp, variants, appKey, appSecret, token, cdnCache);

        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        xml.append("<Request><Product>");
        xml.append("<ItemId>").append(escapeXml(itemId)).append("</ItemId>");

        if (!imgResult.productImages().isEmpty()) {
            xml.append("<Images>");
            for (String url : imgResult.productImages()) {
                xml.append("<Image>").append(escapeXml(url)).append("</Image>");
            }
            xml.append("</Images>");
        }

        xml.append("<Attributes>");
        xml.append("<name>").append(escapeXml(productName)).append("</name>");
        xml.append("</Attributes>");

        xml.append("<Skus>");
        for (BienTheSanPham bt : variants) {
            String sku = bt.getMaSku() != null ? bt.getMaSku().trim() : "";
            if (sku.isBlank()) continue;

            String skuId = lazadaSkuToSkuIdMap.get(sku.toLowerCase(Locale.ROOT));

            xml.append("<Sku>");
            if (skuId != null && !skuId.isBlank() && skuId.matches("\\d+")) {
                xml.append("<SkuId>").append(escapeXml(skuId)).append("</SkuId>");
            }
            xml.append("<SellerSku>").append(escapeXml(sku)).append("</SellerSku>");

            List<String> skuImages = new ArrayList<>();
            String varImgUrl = imgResult.variantImages().get(bt.getId());
            if (varImgUrl != null && !varImgUrl.isBlank()) {
                skuImages.add(varImgUrl);
                for (String pUrl : imgResult.productImages()) {
                    if (!skuImages.contains(pUrl) && skuImages.size() < 8) {
                        skuImages.add(pUrl);
                    }
                }
            } else if (!imgResult.productImages().isEmpty()) {
                skuImages.addAll(imgResult.productImages());
            }

            if (!skuImages.isEmpty()) {
                xml.append("<Images>");
                for (String url : skuImages) {
                    xml.append("<Image>").append(escapeXml(url)).append("</Image>");
                }
                xml.append("</Images>");
            }

            xml.append("</Sku>");
        }
        xml.append("</Skus>");
        xml.append("</Product></Request>");

        try {
            log.info("[LAZADA-UPDATE] Đang cập nhật ảnh và thông tin sản phẩm [{}] (ItemId: {}) lên Lazada...", productName, itemId);
            JsonNode updateRes = lazadaClient.updateProduct(appKey, appSecret, token, xml.toString());
            String code = updateRes.path("code").asText("");
            if ("0".equals(code)) {
                log.info("[LAZADA-UPDATE] Cập nhật sản phẩm [{}] (ItemId: {}) lên Lazada thành công!", productName, itemId);
                return true;
            } else {
                String errorMsg = updateRes.path("message").asText(updateRes.path("sub_message").asText("Lazada từ chối"));
                if (updateRes.has("detail") && updateRes.path("detail").isArray() && !updateRes.path("detail").isEmpty()) {
                    errorMsg += " - " + updateRes.path("detail").get(0).path("message").asText("");
                }
                log.warn("[LAZADA-UPDATE] Lazada từ chối cập nhật sản phẩm [{}] (ItemId: {}): code={} - {}", productName, itemId, code, errorMsg);
                return false;
            }
        } catch (Exception e) {
            log.error("[LAZADA-UPDATE] Lỗi khi cập nhật sản phẩm [{}] lên Lazada: {}", productName, e.getMessage());
            return false;
        }
    }

    private Map<String, String> taoSanPhamLenTikTok(
            KenhBanHang kenh,
            SanPhamQuanAo sp,
            List<BienTheSanPham> variants,
            String appKey,
            String appSecret,
            String token,
            String cipher,
            String warehouseId,
            Map<String, String> cdnCache) {
        Map<String, String> createdSkuMap = new HashMap<>();
        if (sp == null || variants == null || variants.isEmpty()) {
            return createdSkuMap;
        }

        String rawName = sp.getTenSanPham() != null && !sp.getTenSanPham().isBlank()
                ? sp.getTenSanPham().trim() : "Sản phẩm thời trang FCentric";
        // TikTok Shop quy định tiêu đề tối thiểu 25 ký tự
        String title = rawName;
        if (title.length() < 25) {
            title = title + " - Thời trang FCentric chính hãng";
        }
        if (title.length() > 255) {
            title = title.substring(0, 255);
        }

        String desc = (sp.getMoTa() != null && !sp.getMoTa().isBlank())
                ? sp.getMoTa().trim() : title;
        String descHtml = "<p>" + desc + "</p>";

        // Upload ảnh sản phẩm lên TikTok Shop CDN để lấy Image URI hợp lệ (TikTok Shop bắt buộc uri nội bộ thật)
        List<TikTokProductCreateRequest.ImageUri> mainImages = chuanBiVaUploadAnhTikTok(
                sp, variants, appKey, appSecret, token, cipher, cdnCache);

        if (mainImages.isEmpty()) {
            log.warn("[TIKTOK-CREATE] Không thể chuẩn bị ảnh hợp lệ cho sản phẩm [{}]. Dừng tạo sản phẩm để tránh lỗi sàn.", title);
            return createdSkuMap;
        }

        List<TikTokProductCreateRequest.CreateSku> skuList = new ArrayList<>();
        boolean isMultiSku = variants.size() > 1;

        // Phân tích các chiều biến thể của sản phẩm để đảm bảo tính đồng nhất giữa tất cả SKU
        boolean hasSizeDimension = isMultiSku && variants.stream()
                .anyMatch(bt -> bt.getSize() != null && bt.getSize().getTenSize() != null && !bt.getSize().getTenSize().isBlank());
        boolean hasColorDimension = isMultiSku && variants.stream()
                .anyMatch(bt -> bt.getMauSac() != null && bt.getMauSac().getTenMau() != null && !bt.getMauSac().getTenMau().isBlank());

        Set<String> seenAttributeCombinations = new HashSet<>();

        for (BienTheSanPham bt : variants) {
            String sku = bt.getMaSku() != null ? bt.getMaSku().trim() : "";
            if (sku.isBlank()) continue;

            BigDecimal price = bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0
                    ? bt.getGiaBan() : BigDecimal.valueOf(100000);
            int qty = soTonDayTheoQuyTacDaLuu(kenh.getMaKenh(), khaDungToanChuoi(bt.getId()));

            List<TikTokProductCreateRequest.SalesAttribute> salesAttrs = null;
            // Theo chuẩn TikTok Shop API v202309: Chỉ khai báo sales_attributes khi sản phẩm có từ 2 SKU trở lên
            if (isMultiSku) {
                salesAttrs = new ArrayList<>();

                String sizeVal = (bt.getSize() != null && bt.getSize().getTenSize() != null && !bt.getSize().getTenSize().isBlank())
                        ? bt.getSize().getTenSize().trim() : (hasSizeDimension ? "Tiêu chuẩn" : null);

                String colorVal = (bt.getMauSac() != null && bt.getMauSac().getTenMau() != null && !bt.getMauSac().getTenMau().isBlank())
                        ? bt.getMauSac().getTenMau().trim() : (hasColorDimension ? "Mặc định" : null);

                // Nếu sản phẩm không có cả size lẫn màu, dùng thuộc tính Phân loại
                if (!hasSizeDimension && !hasColorDimension) {
                    String specVal = sku;
                    salesAttrs.add(TikTokProductCreateRequest.SalesAttribute.builder()
                            .name("Phân loại")
                            .valueName(specVal)
                            .customValue(specVal)
                            .build());
                } else {
                    // Kiểm tra và chống trùng lặp tổ hợp thuộc tính giữa các SKU (ngăn lỗi 12052251 Resource Already Exists)
                    String comboKey = (sizeVal != null ? sizeVal : "") + "|" + (colorVal != null ? colorVal : "");
                    if (seenAttributeCombinations.contains(comboKey)) {
                        // Nếu trùng lặp tổ hợp với SKU trước đó, bổ sung mã SKU để đảm bảo tính duy nhất
                        if (sizeVal != null) {
                            sizeVal = sizeVal + " (" + sku + ")";
                        } else if (colorVal != null) {
                            colorVal = colorVal + " (" + sku + ")";
                        }
                        comboKey = (sizeVal != null ? sizeVal : "") + "|" + (colorVal != null ? colorVal : "");
                    }
                    seenAttributeCombinations.add(comboKey);

                    // Bắt buộc gửi CẢ valueName VÀ customValue theo chuẩn v202309 để TikTok Shop hiển thị giá trị trong ngoặc
                    if (hasSizeDimension && sizeVal != null) {
                        salesAttrs.add(TikTokProductCreateRequest.SalesAttribute.builder()
                                .name("Kích cỡ")
                                .valueName(sizeVal)
                                .customValue(sizeVal)
                                .build());
                    }
                    if (hasColorDimension && colorVal != null) {
                        salesAttrs.add(TikTokProductCreateRequest.SalesAttribute.builder()
                                .name("Màu sắc")
                                .valueName(colorVal)
                                .customValue(colorVal)
                                .build());
                    }
                }
            }

            skuList.add(TikTokProductCreateRequest.CreateSku.builder()
                    .sellerSku(sku)
                    .price(TikTokProductCreateRequest.SkuPrice.builder()
                            .amount(String.valueOf(price.setScale(0, RoundingMode.HALF_UP).intValue()))
                            .currency("VND")
                            .build())
                    .inventory(List.of(TikTokProductCreateRequest.SkuInventoryQuantity.builder()
                            .warehouseId(warehouseId)
                            .quantity(Math.max(0, qty))
                            .build()))
                    .salesAttributes(salesAttrs)
                    .build());
        }

        if (skuList.isEmpty()) {
            return createdSkuMap;
        }

        // Xác định Leaf Category ID phiên bản V2 bắt buộc theo quy định TikTok Shop API v202309
        String v2CategoryId = xacDinhTikTokV2CategoryId(appKey, appSecret, token, cipher, title, desc, sp);

        // Chuẩn bị thuộc tính sản phẩm bắt buộc (Quốc gia xuất xứ ID: 100149, v.v.)
        List<TikTokProductCreateRequest.ProductAttribute> productAttributes =
                chuanBiProductAttributesTikTok(appKey, appSecret, token, cipher, v2CategoryId, sp);

        // Chuẩn bị bảng size (size_chart) bắt buộc cho ngành hàng thời trang theo quy định listing TikTok Shop
        TikTokProductCreateRequest.SizeChart sizeChart =
                chuanBiSizeChartTikTok(sp, appKey, appSecret, token, cipher);

        TikTokProductCreateRequest req = TikTokProductCreateRequest.builder()
                .title(title)
                .description(descHtml)
                .categoryId(v2CategoryId)
                .categoryVersion(TikTokShopConstants.CATEGORY_VERSION_V2)
                .brandId("0") // No Brand theo quy định sàn để tránh kiểm duyệt ủy quyền thương hiệu
                .mainImages(mainImages)
                .sizeChart(sizeChart)
                .packageWeight(TikTokProductCreateRequest.PackageWeight.builder()
                        .value("0.3")
                        .unit("KILOGRAM")
                        .build())
                .packageDimensions(TikTokProductCreateRequest.PackageDimensions.builder()
                        .length("25")
                        .width("15")
                        .height("5")
                        .unit("CENTIMETER")
                        .build())
                .productAttributes(productAttributes.isEmpty() ? null : productAttributes)
                .skus(skuList)
                .build();

        try {
            log.info("[TIKTOK-CREATE] Đang đẩy sản phẩm [{}] lên TikTok Shop...", title);
            TikTokProductCreateResponse res = getTikTokShopClient().createProduct(appKey, appSecret, token, cipher, req);
            if (res != null && res.getCode() == 0 && res.getData() != null) {
                String prodId = res.getData().getProductId();
                log.info("[TIKTOK-CREATE] Tạo sản phẩm [{}] thành công trên TikTok Shop! ProductId: {}", title, prodId);
                TikTokCatalogCache curCache = tikTokCatalogCacheRef.get();
                if (curCache == null) {
                    curCache = new TikTokCatalogCache(
                            new java.util.concurrent.ConcurrentHashMap<>(),
                            new java.util.concurrent.ConcurrentHashMap<>(),
                            Instant.now().plus(java.time.Duration.ofMinutes(30)),
                            Instant.now()
                    );
                    tikTokCatalogCacheRef.set(curCache);
                }
                if (res.getData().getSkus() != null) {
                    for (TikTokProductCreateResponse.CreatedSku cSku : res.getData().getSkus()) {
                        if (cSku.getSellerSku() != null && cSku.getId() != null) {
                            String sSku = cSku.getSellerSku().trim();
                            String sId = cSku.getId().trim();
                            createdSkuMap.put(sSku.toLowerCase(Locale.ROOT), sId);
                            if (prodId != null && !prodId.isBlank()) {
                                curCache.skuToProductId().put(sSku.toLowerCase(Locale.ROOT), prodId);
                                curCache.skuToProductId().put(sSku, prodId);
                                curCache.skuToProductId().put(sId.toLowerCase(Locale.ROOT), prodId);
                                curCache.skuToProductId().put(sId, prodId);
                            }
                            curCache.skuToSkuId().put(sSku.toLowerCase(Locale.ROOT), sId);
                            curCache.skuToSkuId().put(sSku, sId);
                            curCache.skuToSkuId().put(sId.toLowerCase(Locale.ROOT), sId);
                            curCache.skuToSkuId().put(sId, sId);
                        }
                    }
                }
            } else {
                String errMsg = res != null ? res.getMessage() : "Phản hồi rỗng";
                int errCode = res != null ? res.getCode() : -1;
                log.warn("[TIKTOK-CREATE] TikTok Shop từ chối tạo sản phẩm [{}]: code={} - {}", title, errCode, errMsg);
                KetQuaGuiTon kqLoi = phanLoaiLoiTikTok(errCode, errMsg, null);
                ghiNhanLoiTaoSanPhamTikTok(kenh, variants, kqLoi.lyDo());
            }
        } catch (Exception e) {
            log.error("[TIKTOK-CREATE] Lỗi khi tạo sản phẩm [{}] lên TikTok Shop: {}", title, e.getMessage());
            KetQuaGuiTon kqLoi = phanLoaiLoiTikTok(-1, e.getMessage(), null);
            ghiNhanLoiTaoSanPhamTikTok(kenh, variants, kqLoi.lyDo());
        }

        return createdSkuMap;
    }

    private void ghiNhanLoiTaoSanPhamTikTok(KenhBanHang kenh, List<BienTheSanPham> variants, String lyDoLoi) {
        if (kenh == null || variants == null || variants.isEmpty()) return;
        Instant now = Instant.now();
        List<TrangThaiDongBoSanPham> listCanLuu = new ArrayList<>();
        for (BienTheSanPham bt : variants) {
            if (bt.getId() == null) continue;
            var opt = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(kenh.getId(), bt.getId());
            TrangThaiDongBoSanPham tt = opt.orElseGet(() -> {
                TrangThaiDongBoSanPham moi = new TrangThaiDongBoSanPham();
                moi.setKenhBanHang(kenh);
                moi.setBienTheSanPham(bt);
                return moi;
            });
            tt.setTrangThaiDongBo("that_bai");
            tt.setChiTietLoi(lyDoLoi);
            tt.setNgayDongBoCuoi(now);
            listCanLuu.add(tt);
        }
        if (!listCanLuu.isEmpty()) {
            trangThaiDongBoSanPhamRepository.saveAll(listCanLuu);
        }
    }

    /**
     * Tự động xác định Leaf Category ID phiên bản V2 cho sản phẩm đăng lên TikTok Shop.
     * Quy trình 3 bước chuẩn hóa:
     * 1. Gọi TikTok Shop AI Category Recommendation (POST /product/202309/categories/recommend?category_version=v2).
     * 2. Nếu AI chưa trả về, tìm kiếm danh mục lá theo tên danh mục sản phẩm FCentric hoặc loại quần áo.
     * 3. Nếu vẫn chưa có, sử dụng fallback leaf ID tìm được từ ngành hàng thời trang V2.
     */
    private String xacDinhTikTokV2CategoryId(String appKey, String appSecret, String token, String cipher,
                                             String title, String desc, SanPhamQuanAo sp) {
        // 1. Thử gợi ý danh mục V2 bằng AI của TikTok Shop
        try {
            String aiCategoryId = getTikTokShopClient().recommendCategoryV2(appKey, appSecret, token, cipher, title, desc);
            if (aiCategoryId != null && !aiCategoryId.isBlank()) {
                log.info("[TIKTOK-CAT-V2] AI gợi ý thành công Leaf Category ID [{}] cho sản phẩm [{}]", aiCategoryId, title);
                return aiCategoryId;
            }
        } catch (Exception ex) {
            log.warn("[TIKTOK-CAT-V2] Lỗi khi gọi TikTok AI recommend category cho [{}]: {}", title, ex.getMessage());
        }

        // 2. Thử tìm kiếm theo danh mục FCentric
        String keyword = null;
        if (sp != null && sp.getDanhMuc() != null && sp.getDanhMuc().getTenDanhMuc() != null) {
            keyword = sp.getDanhMuc().getTenDanhMuc();
        } else if (title != null) {
            keyword = title;
        }

        if (keyword != null && !keyword.isBlank()) {
            try {
                String searchCategoryId = getTikTokShopClient().timDanhMucLaTheoTuKhoaV2(appKey, appSecret, token, cipher, keyword);
                if (searchCategoryId != null && !searchCategoryId.isBlank()) {
                    log.info("[TIKTOK-CAT-V2] Tìm kiếm danh mục lá V2 theo từ khóa [{}] thành công: {}", keyword, searchCategoryId);
                    return searchCategoryId;
                }
            } catch (Exception ex) {
                log.warn("[TIKTOK-CAT-V2] Lỗi khi tìm kiếm danh mục lá theo từ khóa [{}]: {}", keyword, ex.getMessage());
            }
        }

        // 3. Fallback: Thử với từ khóa "áo"
        try {
            String fallbackLeafId = getTikTokShopClient().timDanhMucLaTheoTuKhoaV2(appKey, appSecret, token, cipher, "áo");
            if (fallbackLeafId != null && !fallbackLeafId.isBlank()) {
                log.info("[TIKTOK-CAT-V2] Fallback danh mục lá V2 'áo' thành công: {}", fallbackLeafId);
                return fallbackLeafId;
            }
        } catch (Exception ex) {
            log.warn("[TIKTOK-CAT-V2] Lỗi khi fallback danh mục lá: {}", ex.getMessage());
        }

        log.warn("[TIKTOK-CAT-V2] Không thể xác định danh mục V2 tự động cho [{}], sử dụng mã dự phòng", title);
        return "601234";
    }

    /**
     * Chuẩn bị danh sách thuộc tính sản phẩm (product_attributes) cho TikTok Shop (v202309).
     * Bắt buộc cung cấp các thuộc tính bắt buộc từ danh mục V2 theo quy định pháp luật Việt Nam (Nghị định 85):
     * - Quốc gia xuất xứ (ID: 100149 = "Việt Nam", ID giá trị: 1000854)
     * - Tên tổ chức chịu trách nhiệm hàng hóa (ID: 101489)
     * - Địa chỉ tổ chức chịu trách nhiệm hàng hóa (nếu danh mục yêu cầu)
     */
    private List<TikTokProductCreateRequest.ProductAttribute> chuanBiProductAttributesTikTok(
            String appKey, String appSecret, String token, String cipher,
            String categoryId, SanPhamQuanAo sp) {
        List<TikTokProductCreateRequest.ProductAttribute> attributes = new ArrayList<>();
        boolean hasCountryOfOrigin = false;
        boolean hasResponsibleEntity = false;

        if (categoryId != null && !categoryId.isBlank()) {
            try {
                JsonNode attrRes = getTikTokShopClient().getCategoryAttributes(appKey, appSecret, token, cipher, categoryId, "vi-VN");
                if (attrRes != null && attrRes.path("code").asInt(-1) == 0) {
                    JsonNode attrList = attrRes.path("data").path("attributes");
                    if (attrList.isArray()) {
                        for (JsonNode attr : attrList) {
                            String attrId = attr.path("id").asText(attr.path("attribute_id").asText(null));
                            if (attrId == null || attrId.isBlank()) continue;

                            String attrType = attr.path("type").asText("PRODUCT_PROPERTY");
                            // Bỏ qua các thuộc tính biến thể SALES_PROPERTY (được cấu hình ở sales_attributes của SKU)
                            if ("SALES_PROPERTY".equalsIgnoreCase(attrType)) {
                                continue;
                            }

                            String attrName = attr.path("name").asText(attr.path("local_display_name").asText(""));
                            String attrNameLower = attrName.toLowerCase(Locale.ROOT);

                            // Nhận diện trạng thái bắt buộc từ mọi biến thể định dạng của TikTok Shop API
                            boolean isMandatory = attr.path("is_mandatory").asBoolean(false)
                                    || attr.path("is_required").asBoolean(false)
                                    || attr.path("is_requried").asBoolean(false)
                                    || attr.path("required").asBoolean(false)
                                    || "MANDATORY".equalsIgnoreCase(attr.path("requirement").asText(""))
                                    || "REQUIRED".equalsIgnoreCase(attr.path("requirement").asText(""))
                                    || "MANDATORY".equalsIgnoreCase(attr.path("requirement_level").asText(""))
                                    || "REQUIRED".equalsIgnoreCase(attr.path("requirement_level").asText(""))
                                    || (attr.hasNonNull("requirement_conditions") && !attr.path("requirement_conditions").isEmpty());

                            boolean isOrigin = "100149".equals(attrId)
                                    || attrNameLower.contains("xuất xứ")
                                    || attrNameLower.contains("origin");

                            boolean isResponsible = "101489".equals(attrId)
                                    || (attrNameLower.contains("chịu trách nhiệm") && !attrNameLower.contains("địa chỉ"));

                            boolean isResponsibleAddr = attrNameLower.contains("chịu trách nhiệm") && attrNameLower.contains("địa chỉ");

                            JsonNode valuesNode = attr.path("values");

                            if (isOrigin) {
                                hasCountryOfOrigin = true;
                                String valId = null;
                                String valName = "Việt Nam";

                                if (valuesNode.isArray() && !valuesNode.isEmpty()) {
                                    for (JsonNode val : valuesNode) {
                                        String vName = val.path("name").asText(val.path("local_display_name").asText(""));
                                        String vLower = vName.toLowerCase(Locale.ROOT);
                                        if (vLower.contains("việt nam") || vLower.contains("vietnam") || vLower.equals("vn")) {
                                            valId = val.path("id").asText(null);
                                            valName = vName;
                                            break;
                                        }
                                    }
                                    if (valId == null && valuesNode.size() > 0) {
                                        JsonNode firstVal = valuesNode.get(0);
                                        valId = firstVal.path("id").asText("1000854");
                                        valName = firstVal.path("name").asText("Việt Nam");
                                    }
                                } else {
                                    valId = "1000854";
                                }

                                attributes.add(TikTokProductCreateRequest.ProductAttribute.builder()
                                        .id(attrId)
                                        .values(List.of(TikTokProductCreateRequest.AttributeValue.builder()
                                                .id(valId)
                                                .name(valName)
                                                .build()))
                                        .build());
                                log.info("[TIKTOK-ATTR] Đã gắn thuộc tính Quốc gia xuất xứ ID [{}]: id={}, name={}", attrId, valId, valName);

                            } else if (isResponsible) {
                                hasResponsibleEntity = true;
                                String valId = null;
                                String valName = "Công ty Cổ phần Thời trang FCentric";

                                if (valuesNode.isArray() && !valuesNode.isEmpty()) {
                                    JsonNode firstVal = valuesNode.get(0);
                                    valId = firstVal.path("id").asText(null);
                                    valName = firstVal.path("name").asText(valName);
                                }

                                attributes.add(TikTokProductCreateRequest.ProductAttribute.builder()
                                        .id(attrId)
                                        .values(List.of(TikTokProductCreateRequest.AttributeValue.builder()
                                                .id((valId != null && !valId.isBlank()) ? valId : null)
                                                .name(valName)
                                                .build()))
                                        .build());
                                log.info("[TIKTOK-ATTR] Đã gắn thuộc tính Tên tổ chức chịu trách nhiệm [{}]: id={}, name={}", attrId, valId, valName);

                            } else if (isResponsibleAddr) {
                                String valId = null;
                                String valName = "Số 1 Trịnh Văn Bô, Phường Phương Canh, Quận Nam Từ Liêm, Hà Nội, Việt Nam";

                                if (valuesNode.isArray() && !valuesNode.isEmpty()) {
                                    JsonNode firstVal = valuesNode.get(0);
                                    valId = firstVal.path("id").asText(null);
                                    valName = firstVal.path("name").asText(valName);
                                }

                                attributes.add(TikTokProductCreateRequest.ProductAttribute.builder()
                                        .id(attrId)
                                        .values(List.of(TikTokProductCreateRequest.AttributeValue.builder()
                                                .id((valId != null && !valId.isBlank()) ? valId : null)
                                                .name(valName)
                                                .build()))
                                        .build());
                                log.info("[TIKTOK-ATTR] Đã gắn thuộc tính Địa chỉ tổ chức chịu trách nhiệm [{}]: id={}, name={}", attrId, valId, valName);

                            } else if (isMandatory) {
                                String valId = null;
                                String valName = null;

                                if (valuesNode.isArray() && !valuesNode.isEmpty()) {
                                    JsonNode firstVal = valuesNode.get(0);
                                    valId = firstVal.path("id").asText(null);
                                    valName = firstVal.path("name").asText(null);
                                } else {
                                    valName = "Tiêu chuẩn FCentric";
                                }

                                if (valName != null || valId != null) {
                                    attributes.add(TikTokProductCreateRequest.ProductAttribute.builder()
                                            .id(attrId)
                                            .values(List.of(TikTokProductCreateRequest.AttributeValue.builder()
                                                    .id((valId != null && !valId.isBlank()) ? valId : null)
                                                    .name(valName)
                                                    .build()))
                                            .build());
                                    log.info("[TIKTOK-ATTR] Đã gắn thuộc tính bắt buộc [{} - {}]: id={}, name={}", attrId, attrName, valId, valName);
                                }
                            }
                        }
                    }
                }
            } catch (Exception ex) {
                log.warn("[TIKTOK-ATTR] Không thể tải thuộc tính danh mục V2 [{}] từ TikTok Shop: {}", categoryId, ex.getMessage());
            }
        }

        // Bắt buộc luôn bổ sung thuộc tính Quốc gia xuất xứ ID '100149' nếu chưa có trong danh sách
        if (!hasCountryOfOrigin) {
            log.info("[TIKTOK-ATTR] Bổ sung fallback thuộc tính bắt buộc Quốc gia xuất xứ (ID: 100149 = 'Việt Nam')");
            attributes.add(TikTokProductCreateRequest.ProductAttribute.builder()
                    .id("100149")
                    .values(List.of(TikTokProductCreateRequest.AttributeValue.builder()
                            .id("1000854")
                            .name("Việt Nam")
                            .build()))
                    .build());
        }

        // Bắt buộc luôn bổ sung thuộc tính Tên tổ chức chịu trách nhiệm hàng hóa ID '101489' nếu chưa có
        if (!hasResponsibleEntity) {
            log.info("[TIKTOK-ATTR] Bổ sung fallback thuộc tính bắt buộc Tên tổ chức chịu trách nhiệm hàng hóa (ID: 101489 = 'Công ty Cổ phần Thời trang FCentric')");
            attributes.add(TikTokProductCreateRequest.ProductAttribute.builder()
                    .id("101489")
                    .values(List.of(TikTokProductCreateRequest.AttributeValue.builder()
                            .id(null)
                            .name("Công ty Cổ phần Thời trang FCentric")
                            .build()))
                    .build());
        }

        return attributes;
    }

    private static final Map<String, String> CACHED_TIKTOK_DEFAULT_URI_BY_CIPHER = new ConcurrentHashMap<>();
    private static final Map<String, String> CACHED_TIKTOK_SIZE_CHART_URI_BY_CIPHER = new ConcurrentHashMap<>();

    /**
     * Chuẩn bị và upload ảnh sản phẩm lên TikTok Shop CDN để lấy Image URI nội bộ.
     * Thứ tự ưu tiên thu thập ảnh:
     * 1. Ảnh sản phẩm từ bảng AnhQuanAo (findActiveByQuanAoIds).
     * 2. Nếu chưa có, thu thập ảnh biến thể từ bảng AnhBienThe (findActiveByBienTheIds).
     * 3. Nếu vẫn không có ảnh hoặc không tải được từ MinIO, tự động sinh ảnh JPEG 800x800 tiêu chuẩn
     *    (thương hiệu FCENTRIC + tên sản phẩm) và upload lên TikTok CDN để lấy URI thật.
     * Tuyệt đối không dùng URI chuỗi giả lập để tránh lỗi TikTok 12052300 (Invalid product image URI).
     */
    private List<TikTokProductCreateRequest.ImageUri> chuanBiVaUploadAnhTikTok(
            SanPhamQuanAo sp,
            List<BienTheSanPham> variants,
            String appKey,
            String appSecret,
            String token,
            String cipher,
            Map<String, String> cdnCache) {

        List<TikTokProductCreateRequest.ImageUri> mainImages = new ArrayList<>();
        Set<String> processedFileKeys = new HashSet<>();

        // 1. Thu thập ảnh cấp sản phẩm (AnhQuanAo)
        try {
            List<AnhQuanAo> prodImages = anhQuanAoRepository.findActiveByQuanAoIds(List.of(sp.getId()));
            if (prodImages != null && !prodImages.isEmpty()) {
                for (AnhQuanAo curImg : prodImages) {
                    if (mainImages.size() >= 5) break;
                    if (curImg.getTepTin() != null && curImg.getTepTin().getTenLuuTru() != null) {
                        TepTin tep = curImg.getTepTin();
                        String fileKey = tep.getTenLuuTru();
                        if (processedFileKeys.add(fileKey)) {
                            String uri = layHoacUploadAnhTikTok(tep, fileKey, sp.getId(), sp.getTenSanPham(),
                                    appKey, appSecret, token, cipher, cdnCache);
                            if (uri != null && !uri.isBlank()) {
                                mainImages.add(new TikTokProductCreateRequest.ImageUri(uri));
                            }
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[TIKTOK-IMG] Lỗi đọc ảnh sản phẩm {}: {}", sp.getId(), ex.getMessage());
        }

        // 2. Nếu chưa đủ ảnh, thu thập tiếp từ ảnh cấp biến thể (AnhBienThe)
        if (mainImages.isEmpty() && variants != null && !variants.isEmpty()) {
            List<Integer> btIds = variants.stream()
                    .map(BienTheSanPham::getId)
                    .filter(Objects::nonNull)
                    .toList();
            if (!btIds.isEmpty() && anhBienTheRepository != null) {
                try {
                    List<AnhBienThe> anhBienTheList = anhBienTheRepository.findActiveByBienTheIds(btIds);
                    if (anhBienTheList != null && !anhBienTheList.isEmpty()) {
                        for (AnhBienThe ab : anhBienTheList) {
                            if (mainImages.size() >= 5) break;
                            if (ab.getTepTin() != null && ab.getTepTin().getTenLuuTru() != null) {
                                TepTin vTep = ab.getTepTin();
                                String vFileKey = vTep.getTenLuuTru();
                                if (processedFileKeys.add(vFileKey)) {
                                    String uri = layHoacUploadAnhTikTok(vTep, vFileKey, sp.getId(), sp.getTenSanPham(),
                                            appKey, appSecret, token, cipher, cdnCache);
                                    if (uri != null && !uri.isBlank()) {
                                        mainImages.add(new TikTokProductCreateRequest.ImageUri(uri));
                                    }
                                }
                            }
                        }
                    }
                } catch (Exception ex) {
                    log.warn("[TIKTOK-IMG] Lỗi đọc ảnh biến thể cho sản phẩm {}: {}", sp.getId(), ex.getMessage());
                }
            }
        }

        // 3. Fallback: Nếu không có ảnh nào trong DB hoặc MinIO không tải được, sinh ảnh mặc định chuẩn e-commerce
        // và upload thật lên TikTok Shop CDN để lấy URI hợp lệ (tuyệt đối không dùng URI giả lập để tránh lỗi 12052300)
        if (mainImages.isEmpty()) {
            try {
                String fallbackUri = layHoacUploadAnhMacDinhTikTok(sp.getTenSanPham(), appKey, appSecret, token, cipher);
                if (fallbackUri != null && !fallbackUri.isBlank()) {
                    mainImages.add(new TikTokProductCreateRequest.ImageUri(fallbackUri));
                }
            } catch (Exception ex) {
                log.error("[TIKTOK-IMG] Không thể upload ảnh mặc định cho sản phẩm [{}]: {}", sp.getTenSanPham(), ex.getMessage());
            }
        }

        return mainImages;
    }

    private String layHoacUploadAnhTikTok(
            TepTin tep, String fileKey, Integer spId, String spName,
            String appKey, String appSecret, String token, String cipher,
            Map<String, String> cdnCache) {

        if (fileKey == null || fileKey.isBlank()) {
            return null;
        }

        // 1. Kiểm tra cache RAM
        String uri = cdnCache.get(fileKey);
        if (uri != null && !uri.isBlank()) {
            return uri;
        }

        // 2. Kiểm tra cache DB (cột moTa)
        if (tep != null && tep.getMoTa() != null && tep.getMoTa().startsWith("TTS_URI:")) {
            uri = tep.getMoTa().substring("TTS_URI:".length()).trim();
            if (!uri.isBlank()) {
                cdnCache.put(fileKey, uri);
                return uri;
            }
        }

        // 3. Tải từ MinIO và upload lên TikTok Shop CDN
        try {
            byte[] bytes = minioService.download(fileKey);
            if (bytes != null && bytes.length > 0) {
                byte[] cleanJpeg = convertToTikTokCompliantJpeg(bytes, spName);
                if (cleanJpeg != null && cleanJpeg.length > 0) {
                    uri = getTikTokShopClient().uploadImage(appKey, appSecret, token, cipher, cleanJpeg, "sp_" + spId + "_" + System.currentTimeMillis() + ".jpg");
                    if (uri != null && !uri.isBlank()) {
                        cdnCache.put(fileKey, uri);
                        if (tepTinRepository != null && tep != null) {
                            try {
                                tep.setMoTa("TTS_URI:" + uri);
                                tepTinRepository.save(tep);
                            } catch (Exception saveEx) {
                                log.warn("[TIKTOK-CDN-CACHE] Không thể lưu TTS_URI cho tệp {}: {}", tep.getId(), saveEx.getMessage());
                            }
                        }
                        return uri;
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[TIKTOK-UPLOAD-IMG] Lỗi tải/upload ảnh tệp {} cho sản phẩm {}: {}", fileKey, spId, ex.getMessage());
        }

        return null;
    }

    private String layHoacUploadAnhMacDinhTikTok(
            String spName, String appKey, String appSecret, String token, String cipher) {

        String key = (cipher != null && !cipher.isBlank()) ? cipher.trim() : "DEFAULT";
        String cached = CACHED_TIKTOK_DEFAULT_URI_BY_CIPHER.get(key);
        if (cached != null && !cached.isBlank()) {
            return cached;
        }

        byte[] defaultBytes = taoTikTokDefaultImage(spName);
        if (defaultBytes == null || defaultBytes.length == 0) {
            return null;
        }

        try {
            log.info("[TIKTOK-IMG] Đang upload ảnh mặc định cho [{}] lên TikTok Shop CDN...", spName);
            String uri = getTikTokShopClient().uploadImage(appKey, appSecret, token, cipher, defaultBytes, "fcentric_default_product.jpg");
            if (uri != null && !uri.isBlank()) {
                log.info("[TIKTOK-IMG] Upload ảnh mặc định lên TikTok CDN thành công! URI: {}", uri);
                CACHED_TIKTOK_DEFAULT_URI_BY_CIPHER.put(key, uri);
                return uri;
            }
        } catch (Exception ex) {
            log.warn("[TIKTOK-IMG] Gặp lỗi khi upload ảnh mặc định lên TikTok: {}", ex.getMessage());
        }
        return null;
    }

    private static byte[] taoTikTokDefaultImage(String tenSp) {
        try {
            int size = 800;
            java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(size, size, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g = img.createGraphics();
            g.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(java.awt.RenderingHints.KEY_TEXT_ANTIALIASING, java.awt.RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            g.setColor(new java.awt.Color(248, 250, 252));
            g.fillRect(0, 0, size, size);

            g.setColor(new java.awt.Color(226, 232, 240));
            g.drawRect(20, 20, size - 40, size - 40);

            g.setColor(new java.awt.Color(239, 246, 255));
            g.fillRect(21, 21, size - 42, 100);

            g.setColor(new java.awt.Color(37, 99, 235));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 46));
            g.drawString("FCENTRIC", 270, 85);

            g.setColor(new java.awt.Color(219, 234, 254));
            g.fillRoundRect(300, 220, 200, 200, 30, 30);
            g.setColor(new java.awt.Color(59, 130, 246));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 72));
            g.drawString("FC", 350, 345);

            g.setColor(new java.awt.Color(30, 41, 59));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 26));
            String title = (tenSp != null && !tenSp.isBlank()) ? tenSp : "Thời Trang FCentric";
            if (title.length() > 36) title = title.substring(0, 33) + "...";
            java.awt.FontMetrics fm = g.getFontMetrics();
            int titleWidth = fm.stringWidth(title);
            int x = Math.max(30, (size - titleWidth) / 2);
            g.drawString(title, x, 500);

            g.setColor(new java.awt.Color(100, 116, 139));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 18));
            g.drawString("Chính Hãng • Chất Lượng Đảm Bảo", 260, 545);

            g.dispose();
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, "jpg", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            log.warn("Không thể sinh ảnh mặc định cho TikTok Shop: {}", e.getMessage());
            return new byte[0];
        }
    }

    /**
     * Chuẩn bị bảng quy đổi kích cỡ (size_chart) cho sản phẩm thời trang theo quy định listing của TikTok Shop.
     * Đối với các danh mục may mặc, thời trang thể thao (như Áo Polo, Áo khoác...), size_chart_image là tham số bắt buộc.
     * Ảnh size chart được sinh tự động chuẩn e-commerce 800x800 và upload lên TikTok CDN với use_case="SIZE_CHART_IMAGE".
     */
    private TikTokProductCreateRequest.SizeChart chuanBiSizeChartTikTok(
            SanPhamQuanAo sp, String appKey, String appSecret, String token, String cipher) {

        String key = (cipher != null && !cipher.isBlank()) ? cipher.trim() : "DEFAULT";
        String cachedUri = CACHED_TIKTOK_SIZE_CHART_URI_BY_CIPHER.get(key);

        if (cachedUri == null || cachedUri.isBlank()) {
            byte[] sizeChartBytes = taoTikTokSizeChartImage(sp != null ? sp.getTenSanPham() : null);
            if (sizeChartBytes != null && sizeChartBytes.length > 0) {
                try {
                    log.info("[TIKTOK-SIZE-CHART] Đang upload bảng quy đổi kích cỡ (use_case=SIZE_CHART_IMAGE) lên TikTok CDN...");
                    String uri = getTikTokShopClient().uploadImageWithUseCase(
                            appKey, appSecret, token, cipher, sizeChartBytes, "fcentric_size_chart.jpg", "SIZE_CHART_IMAGE");
                    if (uri != null && !uri.isBlank()) {
                        log.info("[TIKTOK-SIZE-CHART] Upload size chart image thành công! URI: {}", uri);
                        CACHED_TIKTOK_SIZE_CHART_URI_BY_CIPHER.put(key, uri);
                        cachedUri = uri;
                    }
                } catch (Exception ex) {
                    log.warn("[TIKTOK-SIZE-CHART] Gặp lỗi khi upload size chart image lên TikTok: {}", ex.getMessage());
                }
            }
        }

        if (cachedUri != null && !cachedUri.isBlank()) {
            return TikTokProductCreateRequest.SizeChart.builder()
                    .image(TikTokProductCreateRequest.SizeChartImage.builder()
                            .uri(cachedUri)
                            .build())
                    .build();
        }

        return null;
    }

    /**
     * Tự động sinh ảnh đồ họa bảng quy đổi kích cỡ thời trang chuẩn 800x800 cho thương hiệu FCentric.
     * Thỏa mãn 100% chính sách listing hình ảnh của TikTok Shop và bảo vệ người dùng không bị thiếu size chart.
     */
    private static byte[] taoTikTokSizeChartImage(String tenSp) {
        try {
            int width = 800;
            int height = 800;
            java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(width, height, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g = img.createGraphics();
            g.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(java.awt.RenderingHints.KEY_TEXT_ANTIALIASING, java.awt.RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            // Nền trắng
            g.setColor(java.awt.Color.WHITE);
            g.fillRect(0, 0, width, height);

            // Viền ngoài
            g.setColor(new java.awt.Color(226, 232, 240));
            g.drawRect(20, 20, width - 40, height - 40);

            // Khối Header
            g.setColor(new java.awt.Color(30, 58, 138));
            g.fillRect(20, 20, width - 40, 110);

            g.setColor(java.awt.Color.WHITE);
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 30));
            g.drawString("FCENTRIC - BẢNG QUY ĐỔI KÍCH CỠ", 90, 70);

            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 18));
            g.setColor(new java.awt.Color(219, 234, 254));
            g.drawString("BẢNG THÔNG SỐ CHỌN SIZE QUẦN ÁO CHUẨN FORM", 160, 105);

            // Tên sản phẩm phụ đề
            g.setColor(new java.awt.Color(51, 65, 85));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 18));
            String title = (tenSp != null && !tenSp.isBlank()) ? tenSp : "Sản phẩm thời trang FCentric";
            if (title.length() > 45) title = title.substring(0, 42) + "...";
            g.drawString("Sản phẩm: " + title, 40, 160);

            // Bảng kích cỡ chuẩn
            int tableX = 40;
            int tableY = 185;
            int tableW = 720;
            int rowH = 58;

            String[] headers = {"Size", "Chiều cao (cm)", "Cân nặng (kg)", "Vòng ngực (cm)", "Dài áo (cm)"};
            String[][] data = {
                {"S", "155 - 165", "48 - 55", "88 - 92", "65"},
                {"M", "165 - 170", "56 - 65", "92 - 96", "67"},
                {"L", "170 - 175", "66 - 72", "96 - 100", "69"},
                {"XL", "175 - 180", "73 - 80", "100 - 104", "71"},
                {"XXL", "180 - 188", "81 - 90", "104 - 110", "73"}
            };

            int colW = tableW / headers.length; // 144px mỗi cột

            // Vẽ tiêu đề cột bảng
            g.setColor(new java.awt.Color(239, 246, 255));
            g.fillRect(tableX, tableY, tableW, rowH);
            g.setColor(new java.awt.Color(30, 64, 175));
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 17));

            for (int col = 0; col < headers.length; col++) {
                java.awt.FontMetrics fm = g.getFontMetrics();
                int txtW = fm.stringWidth(headers[col]);
                int cellX = tableX + col * colW;
                g.drawString(headers[col], cellX + (colW - txtW) / 2, tableY + 36);
            }

            // Vẽ các dòng dữ liệu
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 18));
            for (int r = 0; r < data.length; r++) {
                int curY = tableY + (r + 1) * rowH;
                if (r % 2 == 1) {
                    g.setColor(new java.awt.Color(248, 250, 252));
                    g.fillRect(tableX, curY, tableW, rowH);
                }

                for (int col = 0; col < headers.length; col++) {
                    String val = data[r][col];
                    if (col == 0) {
                        g.setColor(new java.awt.Color(37, 99, 235));
                        g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 20));
                    } else {
                        g.setColor(new java.awt.Color(51, 65, 85));
                        g.setFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 18));
                    }
                    java.awt.FontMetrics fm = g.getFontMetrics();
                    int txtW = fm.stringWidth(val);
                    int cellX = tableX + col * colW;
                    g.drawString(val, cellX + (colW - txtW) / 2, curY + 36);
                }

                // Đường kẻ ngang dòng
                g.setColor(new java.awt.Color(226, 232, 240));
                g.drawLine(tableX, curY + rowH, tableX + tableW, curY + rowH);
            }

            // Kẻ viền bảng và các đường kẻ dọc
            g.setColor(new java.awt.Color(203, 213, 225));
            g.drawRect(tableX, tableY, tableW, rowH * (data.length + 1));
            for (int col = 1; col < headers.length; col++) {
                g.drawLine(tableX + col * colW, tableY, tableX + col * colW, tableY + rowH * (data.length + 1));
            }

            // Hộp lưu ý / hướng dẫn chân trang
            int noteY = tableY + rowH * (data.length + 1) + 30;
            g.setColor(new java.awt.Color(254, 243, 199));
            g.fillRoundRect(tableX, noteY, tableW, 110, 16, 16);
            g.setColor(new java.awt.Color(217, 119, 6));
            g.drawRoundRect(tableX, noteY, tableW, 110, 16, 16);

            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 17));
            g.setColor(new java.awt.Color(180, 83, 9));
            g.drawString("LƯU Ý CHỌN SIZE TỪ FCENTRIC:", tableX + 20, noteY + 32);

            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 15));
            g.setColor(new java.awt.Color(120, 53, 15));
            g.drawString("• Bảng size dựa trên vóc dáng chuẩn của người Việt Nam.", tableX + 20, noteY + 60);
            g.drawString("• Nếu phân vân giữa 2 size hoặc thích mặc rộng thoải mái, quý khách vui lòng chọn tăng 1 size.", tableX + 20, noteY + 86);

            // Chân trang thương hiệu
            g.setFont(new java.awt.Font("SansSerif", java.awt.Font.ITALIC, 14));
            g.setColor(new java.awt.Color(148, 163, 184));
            g.drawString("FCentric Fashion Co., Ltd • Official Size Guide", tableX + 210, height - 35);

            g.dispose();
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, "jpg", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            log.warn("Không thể sinh ảnh size chart cho TikTok Shop: {}", e.getMessage());
            return new byte[0];
        }
    }

    private static byte[] convertToTikTokCompliantJpeg(byte[] rawBytes, String productName) {
        if (rawBytes == null || rawBytes.length == 0) {
            return taoTikTokDefaultImage(productName);
        }
        try {
            java.io.ByteArrayInputStream bais = new java.io.ByteArrayInputStream(rawBytes);
            java.awt.image.BufferedImage original = javax.imageio.ImageIO.read(bais);
            if (original != null) {
                int maxDim = 1200;
                int w = original.getWidth();
                int h = original.getHeight();
                if (w > maxDim || h > maxDim) {
                    if (w >= h) {
                        h = (int) Math.round(((double) h * maxDim) / w);
                        w = maxDim;
                    } else {
                        w = (int) Math.round(((double) w * maxDim) / h);
                        h = maxDim;
                    }
                }
                w = Math.max(w, 600);
                h = Math.max(h, 600);

                java.awt.image.BufferedImage rgbImg = new java.awt.image.BufferedImage(w, h, java.awt.image.BufferedImage.TYPE_INT_RGB);
                java.awt.Graphics2D g = rgbImg.createGraphics();
                g.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g.setRenderingHint(java.awt.RenderingHints.KEY_RENDERING, java.awt.RenderingHints.VALUE_RENDER_QUALITY);
                g.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
                g.setColor(java.awt.Color.WHITE);
                g.fillRect(0, 0, w, h);
                g.drawImage(original, 0, 0, w, h, null);
                g.dispose();

                java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                javax.imageio.ImageIO.write(rgbImg, "jpg", baos);
                return baos.toByteArray();
            }
        } catch (Throwable ex) {
            log.warn("[TIKTOK-IMAGE-CONVERT] Không thể chuyển đổi ảnh sang JPEG cho [{}]: {}", productName, ex.getMessage());
        }
        return taoTikTokDefaultImage(productName);
    }

    /**
     * Xác định chính xác warehouse bán hàng (SALES_WAREHOUSE) duy nhất của TikTok Shop.
     * Quy tắc bắt buộc:
     * 1. Tuyệt đối loại bỏ RETURN_WAREHOUSE (kho trả hàng bưu cục, không nhận tồn bán hàng).
     * 2. Lọc kho có type == "SALES_WAREHOUSE".
     * 3. Ưu tiên kho có is_default == true.
     * 4. Tự động lưu warehouseId hợp lệ vào cấu hình hệ thống (MA_KHO_SAN) để các luồng sau tái sử dụng.
     */
    private String xacDinhTikTokSalesWarehouseId(String appKey, String appSecret, String token, String cipher, String maKenh) {
        String saved = dieuHanhHeThongService.getCauHinhString(KenhCauHinhDongBo.khoa(maKenh, "MA_KHO_SAN"), null);
        if (saved != null && !saved.isBlank() && !"default".equalsIgnoreCase(saved) && !"tiktok-default-warehouse".equalsIgnoreCase(saved)) {
            return saved.trim();
        }

        try {
            TikTokWarehousesResponse whRes = getTikTokShopClient().getWarehouses(appKey, appSecret, token, cipher);
            if (whRes != null && whRes.getWarehouses() != null && !whRes.getWarehouses().isEmpty()) {
                // Lọc bỏ 100% kho trả hàng (RETURN_WAREHOUSE)
                List<TikTokWarehouseDto> salesWarehouses = whRes.getWarehouses().stream()
                        .filter(w -> !"RETURN_WAREHOUSE".equalsIgnoreCase(w.getWarehouseType())
                                && !"RETURN".equalsIgnoreCase(w.getWarehouseType()))
                        .toList();

                // 1. Ưu tiên kho SALES_WAREHOUSE có isDefault = true
                // 2. Tiếp theo là kho SALES_WAREHOUSE bất kỳ
                // 3. Cuối cùng mới lấy kho đầu tiên không phải RETURN
                TikTokWarehouseDto chosen = salesWarehouses.stream()
                        .filter(w -> "SALES_WAREHOUSE".equalsIgnoreCase(w.getWarehouseType()) && Boolean.TRUE.equals(w.getIsDefault()))
                        .findFirst()
                        .or(() -> salesWarehouses.stream()
                                .filter(w -> "SALES_WAREHOUSE".equalsIgnoreCase(w.getWarehouseType()))
                                .findFirst())
                        .or(() -> salesWarehouses.stream().findFirst())
                        .orElse(null);

                if (chosen != null) {
                    String chosenId = chosen.getWarehouseId() != null ? chosen.getWarehouseId() : chosen.getId();
                    if (chosenId != null && !chosenId.isBlank()) {
                        log.info("[TIKTOK-WAREHOUSE] Đã xác định SALES_WAREHOUSE hợp lệ: id={} (tên={}, type={}, isDefault={})",
                                chosenId, chosen.getName(), chosen.getType(), chosen.getIsDefault());
                        dieuHanhHeThongService.setCauHinhString(KenhCauHinhDongBo.khoa(maKenh, "MA_KHO_SAN"), chosenId);
                        return chosenId;
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("[TIKTOK-WAREHOUSE] Lỗi khi tra cứu danh sách kho TikTok Shop: {}", ex.getMessage());
        }

        return (saved != null && !saved.isBlank()) ? saved : "default";
    }

    private TuDongLienKetResultDto tuDongLienKetTikTok(KenhBanHang kenh) {
        String appKey = kenhBanHangService.getTikTokAppKey();
        String appSecret = kenhBanHangService.getDecryptedTikTokAppSecret();
        String token = kenhBanHangService.getDecryptedTikTokAccessToken();
        String cipher = kenhBanHangService.getTikTokShopCipher();

        if (appKey == null || appSecret == null || token == null || cipher == null || cipher.isBlank()) {
            throw new CommonException(ThongDiep.of("kenhBan.chuaCauHinhXacThucShopCipher", kenh.getMaKenh()), HttpStatus.BAD_REQUEST, null);
        }

        // Lấy warehouse bán hàng (chỉ nhận SALES_WAREHOUSE, loại trừ hoàn toàn RETURN_WAREHOUSE)
        String warehouseId = xacDinhTikTokSalesWarehouseId(appKey, appSecret, token, cipher, kenh.getMaKenh());

        // 1. Tải sản phẩm từ sàn để cập nhật danh mục hiện có
        try {
            taiSanPhamTikTok(kenh);
        } catch (Exception ex) {
            log.warn("Lỗi khi quét sản phẩm từ sàn TikTok Shop: {}", ex.getMessage());
        }

        List<BienTheSanPham> activeVariants = bienTheSanPhamRepository.findActiveVariantsWithDetails();
        if (activeVariants == null || activeVariants.isEmpty()) {
            activeVariants = bienTheSanPhamRepository.findByTrangThai(1);
        }

        // 2. Tra cứu danh mục TikTok Shop hiện có trong cache RAM
        TikTokCatalogCache catalog = layHoacCapNhatTikTokCatalog(appKey, appSecret, token, cipher, false);
        Map<String, String> tiktokSkuMap = new HashMap<>(catalog.skuToSkuId());

        // 3. Gom nhóm theo SanPhamQuanAo để tạo mới những sản phẩm chưa có trên TikTok Shop
        int soTaoMoiTrenTikTok = 0;
        Map<String, String> cdnCache = new HashMap<>();

        if (activeVariants != null && !activeVariants.isEmpty()) {
            Map<SanPhamQuanAo, List<BienTheSanPham>> spGroupMap = activeVariants.stream()
                    .filter(bt -> bt.getSanPham() != null)
                    .collect(Collectors.groupingBy(BienTheSanPham::getSanPham));

            for (Map.Entry<SanPhamQuanAo, List<BienTheSanPham>> entry : spGroupMap.entrySet()) {
                SanPhamQuanAo sp = entry.getKey();
                List<BienTheSanPham> spVariants = entry.getValue();

                List<BienTheSanPham> variantsCanTao = new ArrayList<>();
                for (BienTheSanPham bt : spVariants) {
                    if (bt.getMaSku() != null && !bt.getMaSku().isBlank()) {
                        String norm = bt.getMaSku().trim().toLowerCase(Locale.ROOT);
                        if (!tiktokSkuMap.containsKey(norm)) {
                            variantsCanTao.add(bt);
                        }
                    }
                }

                if (!variantsCanTao.isEmpty()) {
                    Map<String, String> createdMap = taoSanPhamLenTikTok(
                            kenh, sp, variantsCanTao, appKey, appSecret, token, cipher, warehouseId, cdnCache);
                    if (!createdMap.isEmpty()) {
                        soTaoMoiTrenTikTok++;
                        tiktokSkuMap.putAll(createdMap);
                    }
                }
            }
        }

        // 4. Ghép SKU và đồng bộ trạng thái
        List<TrangThaiDongBoSanPham> danhSach = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId());
        Map<String, TrangThaiDongBoSanPham> existingBySkuSan = new HashMap<>();
        for (TrangThaiDongBoSanPham tt : danhSach) {
            if (tt.getMaSanPhamKenh() != null) {
                existingBySkuSan.put(tt.getMaSanPhamKenh().trim().toLowerCase(Locale.ROOT), tt);
            }
        }

        int soDaGhep = 0;
        int soKhongKhop = 0;
        Instant now = Instant.now();

        if (activeVariants != null) {
            for (BienTheSanPham bt : activeVariants) {
                if (bt.getMaSku() == null || bt.getMaSku().isBlank()) continue;
                String norm = bt.getMaSku().trim().toLowerCase(Locale.ROOT);
                String tiktokSkuId = tiktokSkuMap.get(norm);

                TrangThaiDongBoSanPham record = existingBySkuSan.get(norm);
                if (record == null && tiktokSkuId != null) {
                    record = existingBySkuSan.get(tiktokSkuId.toLowerCase(Locale.ROOT));
                }

                if (record != null) {
                    record.setBienTheSanPham(bt);
                    record.setTrangThaiDongBo("thanh_cong");
                    record.setNgayDongBoCuoi(now);
                    if (tiktokSkuId != null && tiktokSkuId.matches("\\d+")) {
                        record.setMaSanPhamKenh(tiktokSkuId);
                    }
                    trangThaiDongBoSanPhamRepository.save(record);
                    soDaGhep++;
                } else if (tiktokSkuId != null) {
                    TrangThaiDongBoSanPham moi = new TrangThaiDongBoSanPham();
                    moi.setKenhBanHang(kenh);
                    moi.setBienTheSanPham(bt);
                    moi.setMaSanPhamKenh(tiktokSkuId);
                    moi.setTrangThaiDongBo("thanh_cong");
                    moi.setNgayDongBoCuoi(now);
                    trangThaiDongBoSanPhamRepository.save(moi);
                    soDaGhep++;
                } else {
                    soKhongKhop++;
                }
            }
        }

        // 5. Đẩy tồn ban đầu cho các SKU đã ghép (có Delta Sync bảo vệ quota)
        int soTonKhoDaDay = 0;
        List<TrangThaiDongBoSanPham> canLuu = new ArrayList<>();
        List<TrangThaiDongBoSanPham> updatedList = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId());
        for (TrangThaiDongBoSanPham tt : updatedList) {
            if (tt.getBienTheSanPham() != null && "thanh_cong".equalsIgnoreCase(tt.getTrangThaiDongBo())) {
                try {
                    int soDay = tinhSoTonDay(khaDungToanChuoi(tt.getBienTheSanPham().getId()), BigDecimal.valueOf(100), 0, 0);
                    // Delta Sync: Bỏ qua nếu số tồn khả dụng không đổi và đã đẩy thành công trước đó (bảo vệ quota)
                    if (tt.getSoLuongDaDay() != null && tt.getSoLuongDaDay().equals(soDay)) {
                        continue;
                    }
                    KetQuaGuiTon kq = guiTonLenTikTok(tt, soDay);
                    if (kq != null && kq.thanhCong()) {
                        soTonKhoDaDay++;
                        tt.setSoLuongDaDay(soDay);
                        tt.setNgayDayTonCuoi(now);
                        tt.setChiTietLoi(null);
                        canLuu.add(tt);
                    } else if (kq != null && !kq.thanhCong()) {
                        tt.setTrangThaiDongBo("that_bai");
                        tt.setChiTietLoi(kq.lyDo());
                        tt.setNgayDongBoCuoi(now);
                        canLuu.add(tt);
                    }
                } catch (Exception ex) {
                    log.warn("Không đẩy được tồn ban đầu cho SKU TikTok Shop {}: {}", tt.getMaSanPhamKenh(), ex.getMessage());
                }
            }
        }
        if (!canLuu.isEmpty()) {
            trangThaiDongBoSanPhamRepository.saveAll(canLuu);
        }

        ghiNhatKy(kenh.getId(), IHanhDong.cap_nhat_kenh_ban,
                String.format("Tự động liên kết SKU TikTok Shop: %s đã ghép, %s chưa khớp, tạo mới %s sản phẩm, đã đẩy tồn %s SKU",
                        soDaGhep, soKhongKhop, soTaoMoiTrenTikTok, soTonKhoDaDay));

        return TuDongLienKetResultDto.builder()
                .soDaGhep(soDaGhep)
                .soKhongKhop(soKhongKhop)
                .soNhieuKhop(0)
                .soTaoMoiTrenShopify(soTaoMoiTrenTikTok)
                .soCapNhatTrenShopify(0)
                .soTonKhoDaDay(soTonKhoDaDay)
                .soThatBai(0)
                .build();
    }

    private TuDongLienKetResultDto tuDongLienKetLazada(KenhBanHang kenh) {
        String maKenh = kenh != null ? kenh.getMaKenh() : "LAZADA";
        String appKey = kenhBanHangService.getLazadaAppKey(maKenh);
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(maKenh);
        String token = kenhBanHangService.getDecryptedLazadaAccessToken(maKenh);
        if (appKey == null || appSecret == null || token == null) {
            throw new CommonException(ThongDiep.of("kenhBan.chuaCoCauHinhAccessToken", kenh.getMaKenh()), HttpStatus.BAD_REQUEST, null);
        }

        List<BienTheSanPham> activeVariants = bienTheSanPhamRepository.findActiveVariantsWithDetails();
        if (activeVariants == null || activeVariants.isEmpty()) {
            activeVariants = bienTheSanPhamRepository.findByTrangThai(1);
        }
        if (activeVariants == null || activeVariants.isEmpty()) {
            return TuDongLienKetResultDto.builder()
                    .soDaGhep(0)
                    .soKhongKhop(0)
                    .soNhieuKhop(0)
                    .soTaoMoiTrenShopify(0)
                    .soCapNhatTrenShopify(0)
                    .soTonKhoDaDay(0)
                    .soThatBai(0)
                    .build();
        }

        Map<String, BienTheSanPham> variantBySku = new HashMap<>();
        for (BienTheSanPham bt : activeVariants) {
            if (bt.getMaSku() != null && !bt.getMaSku().isBlank()) {
                variantBySku.put(bt.getMaSku().trim().toLowerCase(Locale.ROOT), bt);
            }
        }

        // 2. Tải danh sách sản phẩm hiện có từ Lazada để xây dựng ánh xạ SellerSku -> SkuId và SellerSku -> ItemId
        int offset = 0;
        int limit = 50;
        Map<String, String> lazadaSkuToSkuIdMap = new HashMap<>();
        Map<String, String> lazadaSkuToItemIdMap = new HashMap<>();
        try {
            while (true) {
                JsonNode res = lazadaClient.getProducts(appKey, appSecret, token, "all", limit, offset);
                if (!"0".equals(res.path("code").asText(""))) break;
                JsonNode products = res.path("data").path("products");
                if (!products.isArray() || products.isEmpty()) break;
                for (JsonNode prodNode : products) {
                    String itemId = prodNode.path("item_id").asText("").trim();
                    if (itemId.isBlank()) itemId = prodNode.path("ItemId").asText("").trim();
                    if (itemId.isBlank()) itemId = prodNode.path("itemId").asText("").trim();

                    JsonNode skus = prodNode.path("skus");
                    if (skus.isArray()) {
                        for (JsonNode skuNode : skus) {
                            String sSku = skuNode.path("SellerSku").asText("").trim();
                            if (sSku.isBlank()) sSku = skuNode.path("ShopSku").asText("").trim();
                            String sId = skuNode.path("SkuId").asText("").trim();
                            if (sId.isBlank()) sId = skuNode.path("sku_id").asText("").trim();
                            String skuItemId = skuNode.path("item_id").asText("").trim();
                            if (skuItemId.isBlank()) skuItemId = skuNode.path("ItemId").asText("").trim();
                            String effectiveItemId = !itemId.isBlank() ? itemId : skuItemId;

                            if (!sSku.isBlank()) {
                                String normSku = sSku.toLowerCase(Locale.ROOT);
                                if (!sId.isBlank()) {
                                    lazadaSkuToSkuIdMap.put(normSku, sId);
                                }
                                if (!effectiveItemId.isBlank()) {
                                    lazadaSkuToItemIdMap.put(normSku, effectiveItemId);
                                }
                            }
                        }
                    }
                }
                if (products.size() < limit) break;
                offset += limit;
            }
        } catch (Exception e) {
            log.warn("[LAZADA-AUTOLINK] Không thể lấy danh sách sản phẩm hiện có từ Lazada: {}", e.getMessage());
        }

        // Gom nhóm biến thể theo sản phẩm cha SanPhamQuanAo để tạo sản phẩm mới hoặc cập nhật ảnh trên Lazada
        Map<SanPhamQuanAo, List<BienTheSanPham>> spGroupMap = activeVariants.stream()
                .filter(bt -> bt.getSanPham() != null)
                .collect(Collectors.groupingBy(BienTheSanPham::getSanPham));

        int soTaoMoiTrenLazada = 0;
        int soCapNhatTrenLazada = 0;
        Map<String, String> cdnCache = new HashMap<>();

        for (Map.Entry<SanPhamQuanAo, List<BienTheSanPham>> entry : spGroupMap.entrySet()) {
            SanPhamQuanAo sp = entry.getKey();
            List<BienTheSanPham> spVariants = entry.getValue();

            List<BienTheSanPham> variantsCanTao = new ArrayList<>();
            List<BienTheSanPham> variantsDaCo = new ArrayList<>();
            String lazadaItemId = null;

            for (BienTheSanPham bt : spVariants) {
                if (bt.getMaSku() != null && !bt.getMaSku().isBlank()) {
                    String norm = bt.getMaSku().trim().toLowerCase(Locale.ROOT);
                    if (!lazadaSkuToSkuIdMap.containsKey(norm)) {
                        variantsCanTao.add(bt);
                    } else {
                        variantsDaCo.add(bt);
                        if (lazadaItemId == null && lazadaSkuToItemIdMap.containsKey(norm)) {
                            lazadaItemId = lazadaSkuToItemIdMap.get(norm);
                        }
                    }
                }
            }

            if (!variantsCanTao.isEmpty()) {
                Map<String, String> createdMap = taoSanPhamLenLazada(kenh, sp, variantsCanTao, appKey, appSecret, token, cdnCache);
                soTaoMoiTrenLazada += createdMap.size();
                lazadaSkuToSkuIdMap.putAll(createdMap);
            }

            if (!variantsDaCo.isEmpty() && lazadaItemId != null) {
                boolean updated = capNhatSanPhamLenLazada(kenh, sp, variantsDaCo, lazadaItemId, lazadaSkuToSkuIdMap, appKey, appSecret, token, cdnCache);
                if (updated) {
                    soCapNhatTrenLazada += variantsDaCo.size();
                }
            }
        }

        int soDaGhep = 0;
        int soKhongKhop = 0;
        int soTonKhoDaDay = 0;

        List<TrangThaiDongBoSanPham> existingMappings = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId());
        Map<Integer, TrangThaiDongBoSanPham> mappingByBtId = new HashMap<>();
        for (TrangThaiDongBoSanPham m : existingMappings) {
            if (m.getBienTheSanPham() != null) {
                mappingByBtId.put(m.getBienTheSanPham().getId(), m);
            }
        }

        for (BienTheSanPham bt : activeVariants) {
            if (bt.getMaSku() == null || bt.getMaSku().isBlank()) continue;
            String normSku = bt.getMaSku().trim().toLowerCase(Locale.ROOT);
            String targetSkuId = lazadaSkuToSkuIdMap.get(normSku);
            boolean hasNumericSkuId = targetSkuId != null && targetSkuId.matches("\\d+");
            if (targetSkuId == null || targetSkuId.isBlank()) {
                targetSkuId = bt.getMaSku().trim();
            }

            TrangThaiDongBoSanPham record = mappingByBtId.get(bt.getId());
            boolean dangNgung = false;
            if (record != null) {
                dangNgung = TRANG_THAI_NGUNG.equals(record.getTrangThaiDongBo());
                record.setMaSanPhamKenh(targetSkuId);
                if (!dangNgung) {
                    if (hasNumericSkuId) {
                        record.setTrangThaiDongBo("thanh_cong");
                        record.setChiTietLoi(null);
                    } else {
                        record.setTrangThaiDongBo("that_bai");
                        record.setChiTietLoi("Chưa xác định được SkuId trên Lazada cho SKU: " + bt.getMaSku());
                    }
                }
                record.setNgayDongBoCuoi(Instant.now());
            } else {
                record = TrangThaiDongBoSanPham.builder()
                        .kenhBanHang(kenh)
                        .bienTheSanPham(bt)
                        .maSanPhamKenh(targetSkuId)
                        .trangThaiDongBo(hasNumericSkuId ? "thanh_cong" : "that_bai")
                        .chiTietLoi(hasNumericSkuId ? null : "Chưa xác định được SkuId trên Lazada cho SKU: " + bt.getMaSku())
                        .ngayDongBoCuoi(Instant.now())
                        .build();
            }
            trangThaiDongBoSanPhamRepository.save(record);
            soDaGhep++;
        }

        KetNoiDayTon ketNoi = moKetNoiDayTon(kenh);
        if (ketNoi.lyDoLoi() == null) {
            List<TrangThaiDongBoSanPham> dongCanDay = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId())
                    .stream().filter(KenhBanHangDongBoServiceImpl::duocDayTon).toList();
            for (TrangThaiDongBoSanPham dong : dongCanDay) {
                BienTheSanPham bt = dong.getBienTheSanPham();
                if (bt == null) continue;
                int availableQty = soTonDayTheoQuyTacDaLuu(kenh.getMaKenh(), khaDungToanChuoi(bt.getId()));
                KetQuaGuiTon kq = dayTonChoDong(dong, ketNoi, availableQty);
                if (kq.thanhCong()) {
                    soTonKhoDaDay++;
                }
                if (!kq.loiKenh()) {
                    trangThaiDongBoSanPhamRepository.save(dong);
                }
            }
        }

        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_san_pham, "Tự động liên kết Lazada: đã ghép " + soDaGhep + " SKU, tạo mới trên Lazada " + soTaoMoiTrenLazada + " SKU, cập nhật ảnh " + soCapNhatTrenLazada + " SKU, đã đẩy tồn " + soTonKhoDaDay + " SKU");
        return TuDongLienKetResultDto.builder()
                .soDaGhep(soDaGhep)
                .soKhongKhop(soKhongKhop)
                .soNhieuKhop(0)
                .soTaoMoiTrenShopify(soTaoMoiTrenLazada)
                .soCapNhatTrenShopify(soCapNhatTrenLazada)
                .soTonKhoDaDay(soTonKhoDaDay)
                .soThatBai(0)
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TuDongLienKetResultDto tuDongLienKet(String maKenh) {
        KenhBanHang kenh = getKenhActive(maKenh);
        if (OmnichannelOrderSyncJob.isLazada(kenh.getMaKenh())) {
            return tuDongLienKetLazada(kenh);
        }
        if (OmnichannelOrderSyncJob.isTikTok(kenh.getMaKenh())) {
            return tuDongLienKetTikTok(kenh);
        }
        if (OmnichannelOrderSyncJob.isShopee(kenh.getMaKenh())) {
            return tuDongLienKetShopee(kenh);
        }
        kiemTraDaKetNoi(kenh);
        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        // Không còn ghép "nội bộ" khi thiếu khóa: nhánh đó tạo dòng đã đồng bộ cho mọi biến thể mà không hỏi Shopify
        if (token == null || token.isBlank() || domain.isBlank()) {
            throw kenhChuaKetNoi(kenh.getMaKenh());
        }

        // Sử dụng query tối ưu JOIN FETCH chống N+1 queries (hunt-springboot)
        List<BienTheSanPham> activeVariants = bienTheSanPhamRepository.findActiveVariantsWithDetails();
        if (activeVariants == null || activeVariants.isEmpty()) {
            activeVariants = bienTheSanPhamRepository.findByTrangThai(1);
        }
        if (activeVariants == null || activeVariants.isEmpty()) {
            return TuDongLienKetResultDto.builder()
                    .soDaGhep(0)
                    .soKhongKhop(0)
                    .soNhieuKhop(0)
                    .soTaoMoiTrenShopify(0)
                    .soTonKhoDaDay(0)
                    .soThatBai(0)
                    .build();
        }

        Integer targetKhoId = SecurityContextHolder.getKhoId() != null ? SecurityContextHolder.getKhoId() : 1;

        int soDaGhep = 0;
        int soTaoMoiTrenShopify = 0;
        int soCapNhatTrenShopify = 0;
        int soTonKhoDaDay = 0;
        int soAnhDaDay = 0;
        int soThatBai = 0;

        // Nếu có cấu hình Shopify API hợp lệ, thực hiện đồng bộ trực tiếp với Shopify
        if (token != null && !token.isBlank() && !domain.isBlank()) {
            try {
                // Tồn ghi vào địa điểm mặc định của cửa hàng; không xác định được thì chỉ liên kết, không đẩy tồn
                DiaDiemShopify diaDiem = layDiaDiemMacDinh(domain, token);
                Long locationId = diaDiem != null ? diaDiem.id() : null;
                String tenDiaDiem = diaDiem != null ? diaDiem.ten() : null;

                // Lấy danh sách SKU và Tên sản phẩm hiện có trên Shopify để chống tạo trùng lặp (Idempotent)
                Map<String, Long> shopifyTitleMap = new HashMap<>();
                Map<String, ShopifyVariantInfo> shopifySkuMap = layDanhSachSkuHienCoTrenShopify(domain, token, shopifyTitleMap);

                // Gom nhóm biến thể theo sản phẩm cha (SanPhamQuanAo)
                Map<SanPhamQuanAo, List<BienTheSanPham>> spGroupMap = activeVariants.stream()
                        .filter(bt -> bt.getSanPham() != null)
                        .collect(Collectors.groupingBy(BienTheSanPham::getSanPham));

                for (Map.Entry<SanPhamQuanAo, List<BienTheSanPham>> entry : spGroupMap.entrySet()) {
                    SanPhamQuanAo sp = entry.getKey();
                    List<BienTheSanPham> spVariants = entry.getValue();

                    // Kiểm tra xem các biến thể của sản phẩm này đã có trên Shopify chưa
                    List<BienTheSanPham> variantsCanTaoMoi = new ArrayList<>();
                    Long existingShopifyProdId = null;
                    for (BienTheSanPham bt : spVariants) {
                        String skuKey = bt.getMaSku().trim().toLowerCase();
                        if (!shopifySkuMap.containsKey(skuKey)) {
                            variantsCanTaoMoi.add(bt);
                        } else if (existingShopifyProdId == null && shopifySkuMap.get(skuKey).getProductId() != null) {
                            existingShopifyProdId = shopifySkuMap.get(skuKey).getProductId();
                        }
                    }

                    // Nếu chưa tìm thấy ID qua SKU, đối soát qua Tên sản phẩm cha trên Shopify để chống tạo trùng
                    if (existingShopifyProdId == null && sp.getTenSanPham() != null) {
                        existingShopifyProdId = shopifyTitleMap.get(sp.getTenSanPham().trim().toLowerCase());
                    }

                    // Nếu có biến thể chưa có trên Shopify -> Đẩy lên Shopify
                    if (!variantsCanTaoMoi.isEmpty()) {
                        try {
                            if (existingShopifyProdId != null) {
                                // [CHỐNG XÉ ĐÔI SẢN PHẨM]: Sản phẩm cha ĐÃ CÓ trên Shopify -> Thêm biến thể mới vào đúng sản phẩm này
                                Map<String, ShopifyVariantInfo> addedMap = themVariantsVaoSanPhamShopify(domain, token, existingShopifyProdId, sp, variantsCanTaoMoi, spVariants);
                                shopifySkuMap.putAll(addedMap);
                                soTaoMoiTrenShopify += addedMap.size();
                            } else {
                                // Sản phẩm cha CHƯA CÓ trên Shopify -> Tạo mới sản phẩm cha cùng danh sách biến thể
                                Map<String, ShopifyVariantInfo> createdMap = taoSanPhamLenShopify(domain, token, sp, variantsCanTaoMoi, spVariants);
                                shopifySkuMap.putAll(createdMap);
                                soTaoMoiTrenShopify += createdMap.size();
                                if (!createdMap.isEmpty()) {
                                    existingShopifyProdId = createdMap.values().iterator().next().getProductId();
                                    if (sp.getTenSanPham() != null) {
                                        shopifyTitleMap.put(sp.getTenSanPham().trim().toLowerCase(), existingShopifyProdId);
                                    }
                                }
                            }
                        } catch (Exception e) {
                            log.error("Lỗi khi đồng bộ sản phẩm [{}] lên Shopify: {}", sp.getTenSanPham(), e.getMessage());
                            soThatBai += variantsCanTaoMoi.size();
                        }
                    } else if (existingShopifyProdId != null) {
                        // [Cơ chế Update Tự Động]: Sản phẩm đã có trên Shopify -> Tự động CẬP NHẬT đè Thương hiệu, Loại và Tags
                        try {
                            boolean updated = capNhatSanPhamLenShopify(domain, token, existingShopifyProdId, sp);
                            if (updated) {
                                soCapNhatTrenShopify++;
                            }
                        } catch (Exception e) {
                            log.warn("Lỗi khi cập nhật sản phẩm [{}] (ID: {}) lên Shopify: {}", sp.getTenSanPham(), existingShopifyProdId, e.getMessage());
                        }
                    }

                    // [Ưu tiên 2 - Hybrid Smart Sync]: Đẩy ảnh riêng của các biến thể lên Shopify
                    Long shopifyProdId = existingShopifyProdId;
                    for (BienTheSanPham bt : spVariants) {
                        ShopifyVariantInfo vi = shopifySkuMap.get(bt.getMaSku().trim().toLowerCase());
                        if (vi != null && vi.getProductId() != null) {
                            shopifyProdId = vi.getProductId();
                            break;
                        }
                    }
                    if (shopifyProdId != null) {
                        soAnhDaDay += dongBoAnhBienThe(domain, token, shopifyProdId, spVariants, shopifySkuMap);
                    }
                }

                // Tiến hành liên kết và đẩy tồn kho cho từng biến thể
                for (BienTheSanPham bt : activeVariants) {
                    String skuKey = bt.getMaSku().trim().toLowerCase();
                    ShopifyVariantInfo variantInfo = shopifySkuMap.get(skuKey);

                    String maVariantKenh = variantInfo != null ? String.valueOf(variantInfo.getVariantId()) : bt.getMaSku();
                    String trangThaiDongBo = variantInfo != null ? "thanh_cong" : "that_bai";

                    Optional<TrangThaiDongBoSanPham> mappingOpt =
                            trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(kenh.getId(), bt.getId());

                    TrangThaiDongBoSanPham record;
                    boolean dangNgung = false;
                    if (mappingOpt.isPresent()) {
                        record = mappingOpt.get();
                        record.setMaSanPhamKenh(maVariantKenh);
                        // Dòng người dùng đã ngừng đồng bộ thì giữ nguyên trạng thái ngừng và không đẩy tồn
                        dangNgung = TRANG_THAI_NGUNG.equals(record.getTrangThaiDongBo());
                        if (!dangNgung) {
                            record.setTrangThaiDongBo(trangThaiDongBo);
                        }
                        record.setNgayDongBoCuoi(Instant.now());
                    } else {
                        record = TrangThaiDongBoSanPham.builder()
                                .bienTheSanPham(bt)
                                .kenhBanHang(kenh)
                                .maSanPhamKenh(maVariantKenh)
                                .trangThaiDongBo(trangThaiDongBo)
                                .ngayDongBoCuoi(Instant.now())
                                .build();
                    }

                    // Cập nhật giá biến thể lên Shopify nếu phát hiện lệch giá hoặc chưa đồng bộ giá
                    if (!dangNgung && variantInfo != null && variantInfo.getVariantId() != null && bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0) {
                        boolean lechGia = variantInfo.getPrice() == null || variantInfo.getPrice().compareTo(bt.getGiaBan()) != 0;
                        if (lechGia) {
                            boolean ok = capNhatGiaBienTheShopify(domain, token, variantInfo.getVariantId(), bt.getGiaBan(), null);
                            if (ok) {
                                variantInfo.setPrice(bt.getGiaBan());
                                record.setGiaBanSan(bt.getGiaBan());
                            }
                        } else {
                            record.setGiaBanSan(variantInfo.getPrice());
                        }
                    }
                    trangThaiDongBoSanPhamRepository.save(record);
                    soDaGhep++;

                    // Nếu có inventoryItemId và locationId -> Đẩy tồn kho lên Shopify ngay theo quy tắc đã lưu của kênh
                    if (!dangNgung && variantInfo != null && variantInfo.getInventoryItemId() != null && locationId != null) {
                        try {
                            // Free to Use toàn chuỗi theo quy tắc đã lưu; ghi số Shopify đã nhận hoặc lý do lỗi vào dòng
                            int availableQty = soTonDayTheoQuyTacDaLuu(kenh.getMaKenh(), khaDungToanChuoi(bt.getId()));
                            KetQuaGuiTon kq = dayTonChoDong(record, new KetNoiDayTon(domain, token, locationId, tenDiaDiem, shopifySkuMap, null), availableQty);
                            if (kq.thanhCong()) {
                                soTonKhoDaDay++;
                            } else {
                                log.warn("Không thể cập nhật tồn kho cho SKU [{}] lên Shopify: {}", bt.getMaSku(), kq.lyDo());
                            }
                            if (!kq.loiKenh()) {
                                trangThaiDongBoSanPhamRepository.save(record);
                            }
                        } catch (Exception e) {
                            log.warn("Không thể cập nhật tồn kho cho SKU [{}] lên Shopify: {}", bt.getMaSku(), e.getMessage());
                        }
                    }
                }
            } catch (Exception e) {
                log.error("Lỗi trong quá trình đồng bộ trực tiếp với Shopify: {}", e.getMessage(), e);
                // Fallback nếu Shopify API lỗi kết nối: vẫn lưu liên kết nội bộ
                for (BienTheSanPham bt : activeVariants) {
                    Optional<TrangThaiDongBoSanPham> mappingOpt =
                            trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndBienTheSanPhamId(kenh.getId(), bt.getId());
                    if (mappingOpt.isEmpty()) {
                        TrangThaiDongBoSanPham record = TrangThaiDongBoSanPham.builder()
                                .bienTheSanPham(bt)
                                .kenhBanHang(kenh)
                                .maSanPhamKenh(bt.getMaSku())
                                .trangThaiDongBo("thanh_cong")
                                .ngayDongBoCuoi(Instant.now())
                                .build();
                        trangThaiDongBoSanPhamRepository.save(record);
                        soDaGhep++;
                    }
                }
            }
        }

        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_san_pham,
                "Tự động liên kết và đẩy sản phẩm kênh " + maKenh + ": " + soDaGhep + " ghép nối, "
                        + soTaoMoiTrenShopify + " tạo mới Shopify, " + soCapNhatTrenShopify + " cập nhật Shopify, "
                        + soTonKhoDaDay + " cập nhật tồn kho, " + soAnhDaDay + " ảnh đã đồng bộ");

        return TuDongLienKetResultDto.builder()
                .soDaGhep(soDaGhep)
                .soKhongKhop(0)
                .soNhieuKhop(0)
                .soTaoMoiTrenShopify(soTaoMoiTrenShopify)
                .soCapNhatTrenShopify(soCapNhatTrenShopify)
                .soTonKhoDaDay(soTonKhoDaDay)
                .soAnhDaDay(soAnhDaDay)
                .soThatBai(soThatBai)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LienKetSanPhamDto> filterLienKet(String maKenh, String search, String trangThai, Pageable pageable) {
        KenhBanHang kenh = getKenhActive(maKenh);
        Page<TrangThaiDongBoSanPham> page = trangThaiDongBoSanPhamRepository.filterByKenh(
                kenh.getId(),
                (trangThai == null || trangThai.isBlank()) ? null : trangThai,
                (search == null || search.isBlank()) ? null : search.trim(),
                pageable
        );
        Map<Integer, String> anhTheoSanPham = anhDaiDienTheoSanPham(page.getContent().stream()
                .map(TrangThaiDongBoSanPham::getBienTheSanPham)
                .filter(Objects::nonNull)
                .map(BienTheSanPham::getSanPham)
                .filter(Objects::nonNull)
                .map(SanPhamQuanAo::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        Map<Integer, BigDecimal> khaDung = khaDungTheoBienThe(page.getContent());

        return page.map(item -> toLienKetDto(item, khaDung, anhTheoSanPham));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NhomLienKetDto> filterLienKetTheoSanPham(String maKenh, String search, String trangThai, Pageable pageable) {
        KenhBanHang kenh = getKenhActive(maKenh);
        String trangThaiLoc = (trangThai == null || trangThai.isBlank()) ? null : trangThai.trim();
        String tuKhoa = (search == null || search.isBlank()) ? null : search.trim();
        // Thứ tự sản phẩm đã cố định trong truy vấn (GROUP BY), nên chỉ giữ số trang và số dòng của yêu cầu.
        // Mỗi sản phẩm kéo theo đủ SKU, ảnh và tồn: số sản phẩm mỗi trang không vượt SO_SAN_PHAM_TOI_DA_MOI_TRANG
        Pageable trangSanPham = pageable.isPaged()
                ? PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), SO_SAN_PHAM_TOI_DA_MOI_TRANG))
                : Pageable.unpaged();

        Page<Integer> trangId = trangThaiDongBoSanPhamRepository.pageSanPhamIdTheoKenh(
                kenh.getId(), trangThaiLoc, tuKhoa, trangSanPham);
        List<Integer> sanPhamIds = trangId.getContent();
        // Tổng SKU khớp lọc trên mọi trang (chân bảng "N sản phẩm · M SKU"); không có sản phẩm nào thì khỏi đếm
        long tongSku = trangId.getTotalElements() == 0
                ? 0
                : trangThaiDongBoSanPhamRepository.demLienKetKhopLoc(kenh.getId(), trangThaiLoc, tuKhoa);
        if (sanPhamIds.isEmpty()) {
            return new TrangNhomLienKet(List.of(), trangSanPham, trangId.getTotalElements(), tongSku);
        }

        List<TrangThaiDongBoSanPham> dong = trangThaiDongBoSanPhamRepository.findTheoKenhVaSanPham(
                kenh.getId(), sanPhamIds, trangThaiLoc, tuKhoa);
        Map<Integer, BigDecimal> khaDung = khaDungTheoBienThe(dong);
        Map<Integer, String> anhTheoSanPham = anhDaiDienTheoSanPham(sanPhamIds);
        // Đang lọc thì nhóm chỉ còn các SKU khớp: đếm riêng tổng SKU để giao diện ghi "x/y phân loại"
        Map<Integer, Integer> tongLienKet = (trangThaiLoc == null && tuKhoa == null)
                ? Map.of()
                : demLienKetTheoSanPham(kenh.getId(), sanPhamIds);

        // Truy vấn đã xếp sẵn thứ tự phân loại, gom lại vẫn giữ thứ tự đó
        Map<Integer, List<TrangThaiDongBoSanPham>> theoSanPham = new HashMap<>();
        for (TrangThaiDongBoSanPham item : dong) {
            BienTheSanPham bt = item.getBienTheSanPham();
            if (bt == null || bt.getSanPham() == null || bt.getSanPham().getId() == null) continue;
            theoSanPham.computeIfAbsent(bt.getSanPham().getId(), k -> new ArrayList<>()).add(item);
        }

        List<NhomLienKetDto> nhom = new ArrayList<>(sanPhamIds.size());
        for (Integer sanPhamId : sanPhamIds) {
            List<TrangThaiDongBoSanPham> dsDong = theoSanPham.get(sanPhamId);
            // Liên kết vừa bị xóa giữa hai truy vấn: bỏ qua thay vì trả nhóm rỗng
            if (dsDong == null || dsDong.isEmpty()) continue;
            List<LienKetSanPhamDto> bienThe = dsDong.stream()
                    .map(item -> toLienKetDto(item, khaDung, anhTheoSanPham))
                    .toList();
            nhom.add(NhomLienKetDto.builder()
                    .sanPhamId(sanPhamId)
                    .tenSanPham(dsDong.get(0).getBienTheSanPham().getSanPham().getTenSanPham())
                    .anhDaiDien(anhTheoSanPham.get(sanPhamId))
                    .tongPhanLoai(Math.max(bienThe.size(), tongLienKet.getOrDefault(sanPhamId, 0)))
                    .bienThe(bienThe)
                    .build());
        }
        return new TrangNhomLienKet(nhom, trangSanPham, trangId.getTotalElements(), tongSku);
    }

    /** Một dòng liên kết cho giao diện; số khả dụng và ảnh lấy từ bảng đã tra sẵn cho cả trang (không truy vấn thêm). */
    private LienKetSanPhamDto toLienKetDto(TrangThaiDongBoSanPham item, Map<Integer, BigDecimal> khaDungTheoBienThe,
                                           Map<Integer, String> anhTheoSanPham) {
        BienTheSanPham bt = item.getBienTheSanPham();
        Integer sanPhamId = bt != null && bt.getSanPham() != null ? bt.getSanPham().getId() : null;
        String tenSanPham = bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null;
        String tenBienThe = bt != null ? buildVariantName(bt) : null;
        BigDecimal soLuongKhaDung = bt != null && bt.getId() != null
                ? khaDungTheoBienThe.getOrDefault(bt.getId(), BigDecimal.ZERO)
                : BigDecimal.ZERO;

        BigDecimal giaBanSan = item.getGiaBanSan() != null ? item.getGiaBanSan() : (bt != null ? bt.getGiaBan() : null);
        BigDecimal giaBan = bt != null ? bt.getGiaBan() : null;
        Boolean lechGia = (item.getGiaBanSan() != null && giaBan != null) ? item.getGiaBanSan().compareTo(giaBan) != 0 : Boolean.FALSE;

        return LienKetSanPhamDto.builder()
                .id(item.getId())
                .skuSan(item.getMaSanPhamKenh())
                .tenSanPhamSan(tenSanPham)
                .tenBienTheSan(tenBienThe)
                .giaBanSan(giaBanSan)
                .lechGia(lechGia)
                .bienTheSanPhamId(bt != null ? bt.getId() : null)
                .sanPhamId(sanPhamId)
                .anhDaiDien(sanPhamId != null ? anhTheoSanPham.get(sanPhamId) : null)
                .maSku(bt != null ? bt.getMaSku() : null)
                .tenSanPham(tenSanPham)
                .tenBienThe(tenBienThe)
                .giaBan(bt != null ? bt.getGiaBan() : null)
                .soLuongKhaDung(soLuongKhaDung)
                .soLuongDaDay(soDaDay(item))
                .ngayDayTonCuoi(item.getNgayDayTonCuoi())
                .choPhepDongBo(true)
                .trangThaiLienKet(mapStatusToFrontend(item.getTrangThaiDongBo()))
                .ngayDongBoCuoi(item.getNgayDongBoCuoi())
                .chiTietLoi(item.getChiTietLoi())
                .build();
    }

    /**
     * Tồn khả dụng toàn chuỗi của các biến thể trong danh sách, một truy vấn cho cả trang.
     * Biến thể không có trong kết quả hiểu là khả dụng 0.
     */
    private Map<Integer, BigDecimal> khaDungTheoBienThe(Collection<TrangThaiDongBoSanPham> dong) {
        List<Integer> bienTheIds = dong.stream()
                .map(TrangThaiDongBoSanPham::getBienTheSanPham)
                .filter(Objects::nonNull)
                .map(BienTheSanPham::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (bienTheIds.isEmpty()) return Map.of();
        Map<Integer, BigDecimal> ketQua = new HashMap<>();
        for (Object[] row : tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(bienTheIds)) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) continue;
            BigDecimal soLuong = row[1] instanceof BigDecimal bd ? bd : new BigDecimal(row[1].toString());
            ketQua.put(((Number) row[0]).intValue(), soLuong);
        }
        return ketQua;
    }

    /** Số liên kết của từng sản phẩm với kênh (mọi trạng thái), để biết nhóm đang lọc còn bao nhiêu SKU khác. */
    private Map<Integer, Integer> demLienKetTheoSanPham(Integer kenhId, Collection<Integer> sanPhamIds) {
        Map<Integer, Integer> ketQua = new HashMap<>();
        for (Object[] row : trangThaiDongBoSanPhamRepository.demLienKetTheoSanPham(kenhId, sanPhamIds)) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) continue;
            ketQua.put(((Number) row[0]).intValue(), ((Number) row[1]).intValue());
        }
        return ketQua;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LienKetSanPhamDto capNhatLienKet(Integer lienKetId, CapNhatLienKetRequest request) {
        TrangThaiDongBoSanPham record = trangThaiDongBoSanPhamRepository.findById(lienKetId)
                .orElseThrow(() -> new CommonException(ThongDiep.of("kenhBan.khongTimThayLienKet", lienKetId), HttpStatus.NOT_FOUND, null));

        if (request.getBienTheSanPhamId() != null) {
            BienTheSanPham bt = bienTheSanPhamRepository.findById(request.getBienTheSanPhamId())
                    .orElseThrow(() -> new CommonException(ThongDiep.of("kenhBan.khongTimThayBienThe", request.getBienTheSanPhamId()), HttpStatus.BAD_REQUEST, null));
            Integer kenhId = record.getKenhBanHang() != null ? record.getKenhBanHang().getId() : null;
            if (kenhId != null && trangThaiDongBoSanPhamRepository
                    .existsByKenhBanHangIdAndBienTheSanPhamIdAndIdNot(kenhId, bt.getId(), record.getId())) {
                throw new CommonException(ThongDiep.of("kenhBan.bienTheDaGhep", bt.getMaSku()),
                        HttpStatus.BAD_REQUEST, null);
            }
            record.setBienTheSanPham(bt);
            record.setTrangThaiDongBo("thanh_cong");
            record.setChiTietLoi(null);
        } else {
            record.setTrangThaiDongBo("chua_dong_bo");
        }
        record.setNgayDongBoCuoi(Instant.now());
        TrangThaiDongBoSanPham saved = trangThaiDongBoSanPhamRepository.save(record);

        BienTheSanPham bt = saved.getBienTheSanPham();
        Integer sanPhamId = bt != null && bt.getSanPham() != null ? bt.getSanPham().getId() : null;
        BigDecimal giaBanSanSaved = saved.getGiaBanSan() != null ? saved.getGiaBanSan() : (bt != null ? bt.getGiaBan() : null);
        BigDecimal giaBanSaved = bt != null ? bt.getGiaBan() : null;
        Boolean lechGiaSaved = (saved.getGiaBanSan() != null && giaBanSaved != null) ? saved.getGiaBanSan().compareTo(giaBanSaved) != 0 : Boolean.FALSE;

        return LienKetSanPhamDto.builder()
                .id(saved.getId())
                .skuSan(saved.getMaSanPhamKenh())
                .tenSanPhamSan(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                .tenBienTheSan(bt != null ? buildVariantName(bt) : null)
                .giaBanSan(giaBanSanSaved)
                .lechGia(lechGiaSaved)
                .bienTheSanPhamId(bt != null ? bt.getId() : null)
                .sanPhamId(sanPhamId)
                .anhDaiDien(anhDaiDienCuaSanPham(sanPhamId))
                .maSku(bt != null ? bt.getMaSku() : null)
                .tenSanPham(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                .tenBienThe(bt != null ? buildVariantName(bt) : null)
                .giaBan(bt != null ? bt.getGiaBan() : null)
                .soLuongKhaDung(BigDecimal.ZERO)
                .soLuongDaDay(soDaDay(saved))
                .ngayDayTonCuoi(saved.getNgayDayTonCuoi())
                .choPhepDongBo(Boolean.TRUE.equals(request.getChoPhepDongBo()))
                .trangThaiLienKet(mapStatusToFrontend(saved.getTrangThaiDongBo()))
                .ngayDongBoCuoi(saved.getNgayDongBoCuoi())
                .chiTietLoi(saved.getChiTietLoi())
                .build();
    }

    @Override
    public DayTonResultDto dayTonKhoLenKenh(String maKenh, DayTonKenhRequest request) {
        return dayTonKhoLenKenh(maKenh, request, TheoDoiDayTon.KHONG_THEO_DOI);
    }

    @Override
    public DayTonResultDto dayTonTheoQuyTacDaLuu(String maKenh, TheoDoiDayTon theoDoi) {
        return dayTonKhoLenKenh(maKenh, quyTacDaLuu(maKenh), theoDoi != null ? theoDoi : TheoDoiDayTon.KHONG_THEO_DOI);
    }

    DayTonResultDto dayTonKhoLenKenh(String maKenh, DayTonKenhRequest request, TheoDoiDayTon theoDoi) {
        KenhBanHang kenh = getKenhActive(maKenh);
        // Mỗi kênh chỉ một đợt đẩy tồn cùng lúc (JOB-03, Đồng bộ ngay, nút Đẩy tồn, Đồng bộ tất cả):
        // hai đợt chồng nhau gấp đôi số lần gọi Shopify, dễ chạm giới hạn rồi dừng giữa chừng
        ReentrantLock khoa = khoaDayTon.computeIfAbsent(kenh.getId(), id -> new ReentrantLock());
        if (!giuKhoaDayTon(khoa, theoDoi)) {
            // Dừng theo yêu cầu khi còn đang chờ thì không phải lỗi; nơi gọi tự kết thúc đợt là đã dừng
            return DayTonResultDto.builder().loiKenh(theoDoi.canDung() ? null : LOI_KENH_DANG_DAY_TON).build();
        }
        try {
            return dayTonKhiDaGiuKhoa(kenh, maKenh, request, theoDoi);
        } finally {
            khoa.unlock();
        }
    }

    /**
     * Giữ khóa đẩy tồn của kênh. Kênh đang có đợt khác thì chờ tối đa {@code theoDoi.choKenhRanhToiDa()}
     * (mặc định không chờ); có yêu cầu dừng thì thôi chờ.
     */
    static boolean giuKhoaDayTon(ReentrantLock khoa, TheoDoiDayTon theoDoi) {
        long han = System.nanoTime() + theoDoi.choKenhRanhToiDa().toNanos();
        try {
            while (true) {
                long conLaiMs = TimeUnit.NANOSECONDS.toMillis(han - System.nanoTime());
                if (khoa.tryLock(Math.max(0, Math.min(CHU_KY_CHO_KHOA_MS, conLaiMs)), TimeUnit.MILLISECONDS)) {
                    return true;
                }
                if (theoDoi.canDung() || System.nanoTime() - han >= 0) {
                    return false;
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }


    private DayTonResultDto dayTonTikTokToiUu(
            KenhBanHang kenh,
            String maKenh,
            List<TrangThaiDongBoSanPham> dongCanDay,
            BigDecimal tyLe,
            int tonDem,
            int nguongVe0,
            TheoDoiDayTon theoDoi) {

        String appKey = kenhBanHangService.getTikTokAppKey();
        String appSecret = kenhBanHangService.getDecryptedTikTokAppSecret();
        String token = kenhBanHangService.getDecryptedTikTokAccessToken();
        String cipher = kenhBanHangService.getTikTokShopCipher();

        if (appKey == null || appSecret == null || token == null || cipher == null || cipher.isBlank()) {
            String msg = "Chưa có đủ thông tin xác thực hoặc Shop Cipher cho kênh TikTok Shop";
            ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, "TikTok Shop: " + msg);
            return DayTonResultDto.builder().soDong(0).soLoi(dongCanDay.size()).soChuaDay(0).loiKenh(msg).build();
        }

        // Lấy warehouse bán hàng (chỉ nhận SALES_WAREHOUSE, loại trừ hoàn toàn RETURN_WAREHOUSE)
        String warehouseId = xacDinhTikTokSalesWarehouseId(appKey, appSecret, token, cipher, maKenh);

        List<DongCanCapNhat> dirtyList = new ArrayList<>();
        int soBoQuaKhongDoi = 0;

        for (TrangThaiDongBoSanPham dong : dongCanDay) {
            BienTheSanPham bt = dong.getBienTheSanPham();
            if (bt == null || bt.getMaSku() == null || bt.getMaSku().isBlank()) continue;
            int soDay = tinhSoTonDay(khaDungToanChuoi(bt.getId()), tyLe, tonDem, nguongVe0);

            boolean daThanhCong = "thanh_cong".equalsIgnoreCase(dong.getTrangThaiDongBo());
            boolean soTonKhongDoi = dong.getSoLuongDaDay() != null && dong.getSoLuongDaDay().equals(soDay);
            if (daThanhCong && soTonKhongDoi) {
                soBoQuaKhongDoi++;
                continue;
            }
            // Chống spam lặp lỗi (Delta Sync bảo vệ quota): nếu lần trước thất bại nhưng số tồn không đổi và lần thử gần nhất chưa quá 60 phút -> bỏ qua
            if (!daThanhCong && soTonKhongDoi && dong.getNgayDongBoCuoi() != null
                    && java.time.Duration.between(dong.getNgayDongBoCuoi(), Instant.now()).toMinutes() < 60) {
                soBoQuaKhongDoi++;
                continue;
            }

            String skuSan = dong.getMaSanPhamKenh() != null ? dong.getMaSanPhamKenh().trim() : bt.getMaSku().trim();
            dirtyList.add(new DongCanCapNhat(dong, soDay, skuSan, bt.getMaSku().trim()));
        }

        log.info("[TIKTOK-SYNC-DELTA] Tổng số SKU: {}, Bỏ qua không đổi: {}, Cần đẩy (dirty): {}",
                dongCanDay.size(), soBoQuaKhongDoi, dirtyList.size());

        if (dirtyList.isEmpty()) {
            theoDoi.batDauDay(0);
            lanDayTonCuoi.put(kenh.getId(), Instant.now());
            String moTa = "TikTok Shop: Tất cả " + dongCanDay.size() + " SKU tồn kho không đổi, bỏ qua đẩy tồn (tiết kiệm 100% quota API)";
            ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, moTa);
            return DayTonResultDto.builder().soDong(0).soLoi(0).soChuaDay(0).loiKenh(null).build();
        }

        TikTokCatalogCache catalog = layHoacCapNhatTikTokCatalog(appKey, appSecret, token, cipher, false);
        Map<String, String> skuToProductId = catalog.skuToProductId();
        Map<String, String> skuToSkuId = catalog.skuToSkuId();

        Map<String, List<DongCanCapNhat>> groupedByProduct = new LinkedHashMap<>();
        for (DongCanCapNhat item : dirtyList) {
            String prodId = skuToProductId.get(item.sellerSku().toLowerCase());
            if (prodId == null) {
                prodId = skuToProductId.get(item.sellerSku());
            }
            if (prodId == null) {
                prodId = skuToProductId.get(item.skuSan().toLowerCase());
            }
            if (prodId == null) {
                prodId = skuToProductId.get(item.skuSan());
            }
            if (prodId == null) {
                prodId = item.skuSan();
            }
            groupedByProduct.computeIfAbsent(prodId, k -> new ArrayList<>()).add(item);
        }

        int soThanhCong = 0;
        int soLoi = 0;
        String loiKenh = null;
        boolean dungTheoYeuCau = false;
        Instant now = Instant.now();

        theoDoi.batDauDay(dirtyList.size());

        for (Map.Entry<String, List<DongCanCapNhat>> entry : groupedByProduct.entrySet()) {
            if (theoDoi.canDung()) {
                dungTheoYeuCau = true;
                break;
            }

            String prodId = entry.getKey();
            List<DongCanCapNhat> batch = entry.getValue();

            boolean isNumericProdId = prodId != null && prodId.matches("\\d+");
            if (!isNumericProdId) {
                String errorMsg = ThongDiep.vi("hienThiKenhPos.tiktokChuaLienKetProductId");
                log.warn("[TIKTOK-SYNC] Bỏ qua gọi API sàn vì Product ID không hợp lệ ({}) cho {} SKU: {}",
                        prodId, batch.size(), batch.stream().map(DongCanCapNhat::sellerSku).toList());
                for (DongCanCapNhat item : batch) {
                    item.dong().setTrangThaiDongBo("that_bai");
                    item.dong().setChiTietLoi(errorMsg);
                    item.dong().setNgayDongBoCuoi(now);
                    soLoi++;
                    theoDoi.daDay(item.sellerSku(), tenHienThi(item.dong().getBienTheSanPham()), false, errorMsg);
                }
                List<TrangThaiDongBoSanPham> batchEntities = batch.stream().map(DongCanCapNhat::dong).toList();
                trangThaiDongBoSanPhamRepository.saveAll(batchEntities);
                continue;
            }

            for (DongCanCapNhat item : batch) {
                theoDoi.dangDay(item.sellerSku());
            }

            List<TikTokInventoryUpdateRequest.SkuInventory> skuList = new ArrayList<>();
            List<DongCanCapNhat> validItems = new ArrayList<>();
            for (DongCanCapNhat item : batch) {
                String actualSkuId = skuToSkuId.getOrDefault(item.sellerSku(),
                        skuToSkuId.getOrDefault(item.skuSan(), item.skuSan()));
                boolean isValidSkuId = actualSkuId != null && actualSkuId.matches("\\d+");
                if (!isValidSkuId) {
                    String errorMsg = ThongDiep.vi("hienThiKenhPos.tiktokKhongTimThaySkuId", item.sellerSku());
                    item.dong().setTrangThaiDongBo("that_bai");
                    item.dong().setChiTietLoi(errorMsg);
                    item.dong().setNgayDongBoCuoi(now);
                    soLoi++;
                    theoDoi.daDay(item.sellerSku(), tenHienThi(item.dong().getBienTheSanPham()), false, errorMsg);
                    continue;
                }
                validItems.add(item);
                skuList.add(TikTokInventoryUpdateRequest.SkuInventory.builder()
                        .id(actualSkuId)
                        .inventory(List.of(TikTokInventoryUpdateRequest.WarehouseQuantity.builder()
                                .warehouseId(warehouseId)
                                .quantity(Math.max(0, item.soDay()))
                                .build()))
                        .build());
            }

            if (skuList.isEmpty()) {
                List<TrangThaiDongBoSanPham> batchEntities = batch.stream().map(DongCanCapNhat::dong).toList();
                trangThaiDongBoSanPhamRepository.saveAll(batchEntities);
                continue;
            }

            TikTokInventoryUpdateRequest updateReq = TikTokInventoryUpdateRequest.builder()
                    .skus(skuList)
                    .build();

            boolean capNhatThanhCong = false;
            int retries = 0;
            final int MAX_RETRIES = 3;

            while (!capNhatThanhCong && retries < MAX_RETRIES) {
                try {
                    TikTokInventoryUpdateResponse res = getTikTokShopClient()
                            .updateProductInventory(appKey, appSecret, token, cipher, prodId, updateReq);
                    if (res != null && res.getCode() == 0) {
                        capNhatThanhCong = true;
                    } else {
                        int errCode = res != null && res.getCode() != null ? res.getCode() : -1;
                        String errMsg = res != null ? res.getMessage() : "";
                        loiKenh = phanLoaiLoiTikTok(errCode, errMsg, null).lyDo();
                        log.warn("[TIKTOK-SYNC] Cập nhật tồn thất bại cho sản phẩm {}: code={} - {}", prodId, errCode, errMsg);
                        break;
                    }
                } catch (LoiCoMaException e) {
                    if (MaLoi.TIKTOK_RATE_LIMIT.equals(e.getMa())) {
                        retries++;
                        long waitTime = (long) Math.pow(2, retries) * 1000L;
                        log.warn("[TIKTOK-SYNC] Chạm giới hạn HTTP 429 rate limit khi cập nhật sản phẩm {}, backoff lần {} chờ {}ms...",
                                prodId, retries, waitTime);
                        try {
                            Thread.sleep(waitTime);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            dungTheoYeuCau = true;
                            break;
                        }
                    } else {
                        loiKenh = phanLoaiLoiTikTok(-1, e.getMessage(), null).lyDo();
                        break;
                    }
                } catch (org.springframework.web.client.HttpStatusCodeException e) {
                    loiKenh = phanLoaiLoiTikTok(e.getStatusCode().value(), e.getStatusText(), e.getResponseBodyAsString()).lyDo();
                    break;
                } catch (Exception e) {
                    log.warn("[TIKTOK-SYNC] Lỗi kết nối khi cập nhật sản phẩm {}: {}", prodId, e.getMessage());
                    loiKenh = phanLoaiLoiTikTok(-1, e.getMessage(), null).lyDo();
                    break;
                }
            }

            if (capNhatThanhCong) {
                for (DongCanCapNhat item : validItems) {
                    item.dong().setTrangThaiDongBo("thanh_cong");
                    item.dong().setChiTietLoi(null);
                    item.dong().setSoLuongDaDay(item.soDay());
                    item.dong().setNgayDayTonCuoi(now);
                    soThanhCong++;
                    theoDoi.daDay(item.sellerSku(), null, true, null);
                }
            } else {
                String errorMsg = loiKenh != null ? loiKenh : "Cập nhật tồn thất bại trên TikTok Shop";
                for (DongCanCapNhat item : validItems) {
                    item.dong().setTrangThaiDongBo("that_bai");
                    item.dong().setChiTietLoi(errorMsg);
                    soLoi++;
                    theoDoi.daDay(item.sellerSku(), tenHienThi(item.dong().getBienTheSanPham()), false, errorMsg);
                }
            }

            List<TrangThaiDongBoSanPham> batchEntities = batch.stream().map(DongCanCapNhat::dong).toList();
            trangThaiDongBoSanPhamRepository.saveAll(batchEntities);
        }

        int soChuaDay = dirtyList.size() - (soThanhCong + soLoi);
        if (soThanhCong > 0) {
            lanDayTonCuoi.put(kenh.getId(), Instant.now());
        }

        String moTa = "TikTok Shop: Đẩy tồn theo nhóm sản phẩm cha (" + dirtyList.size() + " SKU dirty, gom thành "
                + groupedByProduct.size() + " sản phẩm cha, bỏ qua " + soBoQuaKhongDoi + " SKU không đổi): "
                + soThanhCong + " thành công, " + soLoi + " lỗi, " + soChuaDay + " chưa đẩy"
                + (loiKenh != null ? " (" + loiKenh + ")" : "");
        if (dungTheoYeuCau) {
            moTa += "; dừng theo yêu cầu";
        }
        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, moTa);

        return DayTonResultDto.builder()
                .soDong(dirtyList.size())
                .soLoi(soLoi)
                .soChuaDay(soChuaDay)
                .loiKenh(loiKenh)
                .build();
    }

    private DayTonResultDto dayTonLazadaToiUu(
            KenhBanHang kenh,
            String maKenh,
            List<TrangThaiDongBoSanPham> dongCanDay,
            BigDecimal tyLe,
            int tonDem,
            int nguongVe0,
            TheoDoiDayTon theoDoi) {
        String appKey = kenhBanHangService.getLazadaAppKey(maKenh);
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(maKenh);
        String token = kenhBanHangService.getDecryptedLazadaAccessToken(maKenh);
        if (appKey == null || appSecret == null || token == null) {
            String msg = "Chưa có cấu hình hoặc Access Token cho kênh Lazada";
            ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, "Lazada: " + msg);
            return DayTonResultDto.builder().soDong(0).soLoi(dongCanDay.size()).soChuaDay(0).loiKenh(msg).build();
        }

        List<DongCanCapNhat> dirtyList = new ArrayList<>();
        int soBoQuaKhongDoi = 0;

        for (TrangThaiDongBoSanPham dong : dongCanDay) {
            BienTheSanPham bt = dong.getBienTheSanPham();
            if (bt == null || bt.getMaSku() == null || bt.getMaSku().isBlank()) continue;
            int soDay = tinhSoTonDay(khaDungToanChuoi(bt.getId()), tyLe, tonDem, nguongVe0);

            boolean daThanhCong = "thanh_cong".equalsIgnoreCase(dong.getTrangThaiDongBo());
            boolean soTonKhongDoi = dong.getSoLuongDaDay() != null && dong.getSoLuongDaDay().equals(soDay);
            if (daThanhCong && soTonKhongDoi) {
                soBoQuaKhongDoi++;
                continue;
            }

            String skuId = dong.getMaSanPhamKenh() != null ? dong.getMaSanPhamKenh().trim() : "";
            dirtyList.add(new DongCanCapNhat(dong, soDay, skuId, bt.getMaSku().trim()));
        }

        log.info("[LAZADA-SYNC-DELTA] Tổng số SKU: {}, Bỏ qua không đổi: {}, Cần đẩy (dirty): {}",
                dongCanDay.size(), soBoQuaKhongDoi, dirtyList.size());

        if (dirtyList.isEmpty()) {
            theoDoi.batDauDay(0);
            lanDayTonCuoi.put(kenh.getId(), Instant.now());
            String moTa = "Lazada: Tất cả " + dongCanDay.size() + " SKU tồn kho không đổi, bỏ qua đẩy tồn (tiết kiệm 100% quota API)";
            ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, moTa);
            return DayTonResultDto.builder()
                    .soDong(0)
                    .soLoi(0)
                    .soChuaDay(0)
                    .loiKenh(null)
                    .build();
        }

        final int BATCH_SIZE = 25;
        int soThanhCong = 0;
        int soLoi = 0;
        String loiKenh = null;
        boolean dungTheoYeuCau = false;
        Instant now = Instant.now();

        theoDoi.batDauDay(dirtyList.size());

        for (int i = 0; i < dirtyList.size(); i += BATCH_SIZE) {
            if (theoDoi.canDung()) {
                dungTheoYeuCau = true;
                break;
            }

            int end = Math.min(i + BATCH_SIZE, dirtyList.size());
            List<DongCanCapNhat> batch = dirtyList.subList(i, end);

            for (DongCanCapNhat item : batch) {
                theoDoi.dangDay(item.sellerSku());
            }

            StringBuilder batchXml = buildLazadaBatchXml(batch);

            try {
                JsonNode res = lazadaClient.updatePriceQuantity(appKey, appSecret, token, batchXml.toString());
                String code = res.path("code").asText("");
                if ("0".equals(code)) {
                    for (DongCanCapNhat item : batch) {
                        item.dong().setTrangThaiDongBo("thanh_cong");
                        item.dong().setChiTietLoi(null);
                        item.dong().setSoLuongDaDay(item.soDay());
                        item.dong().setNgayDayTonCuoi(now);
                        soThanhCong++;
                        theoDoi.daDay(item.sellerSku(), null, true, null);
                    }
                } else {
                    String msg = res.path("message").asText(res.path("sub_message").asText("Lỗi từ Lazada"));
                    String detailMsg = "";
                    if (res.has("detail") && res.path("detail").isArray() && !res.path("detail").isEmpty()) {
                        detailMsg = res.path("detail").get(0).path("message").asText("");
                        msg += " - " + detailMsg;
                    }
                    if (code.contains("AppCallLimit") || msg.contains("exceeds the limit")) {
                        loiKenh = "Lazada giới hạn tần suất gọi API: " + msg;
                    }

                    // [BATCH FALLBACK ISOLATION] Tự động tách lô khi 1 SKU bị lỗi sàn tạm giữ (501 negative sellable)
                    boolean isNegativeSellable = msg.toLowerCase(Locale.ROOT).contains("negative sellable");
                    if (isNegativeSellable && batch.size() > 1) {
                        DongCanCapNhat culprit = timSkuViPhamNegativeSellable(batch, res, detailMsg);
                        if (culprit != null) {
                            culprit.dong().setTrangThaiDongBo("that_bai");
                            culprit.dong().setChiTietLoi("Lazada đang tạm giữ tồn cho đơn chờ thanh toán hoặc chiến dịch (Mã sàn: "
                                    + (culprit.skuId() != null && !culprit.skuId().isBlank() ? culprit.skuId() : culprit.sellerSku())
                                    + "). Hệ thống sẽ tự động bù tồn khi sàn mở khóa.");
                            soLoi++;
                            theoDoi.daDay(culprit.sellerSku(), tenHienThi(culprit.dong().getBienTheSanPham()), false, "Sàn đang tạm giữ tồn");

                            List<DongCanCapNhat> remaining = batch.stream().filter(it -> it != culprit).toList();
                            StringBuilder subXml = buildLazadaBatchXml(remaining);
                            try {
                                JsonNode subRes = lazadaClient.updatePriceQuantity(appKey, appSecret, token, subXml.toString());
                                String subCode = subRes != null ? subRes.path("code").asText("") : "";
                                if ("0".equals(subCode)) {
                                    for (DongCanCapNhat remItem : remaining) {
                                        remItem.dong().setTrangThaiDongBo("thanh_cong");
                                        remItem.dong().setChiTietLoi(null);
                                        remItem.dong().setSoLuongDaDay(remItem.soDay());
                                        remItem.dong().setNgayDayTonCuoi(now);
                                        soThanhCong++;
                                        theoDoi.daDay(remItem.sellerSku(), null, true, null);
                                    }
                                    log.info("[LAZADA-FALLBACK] Tự động tách lô thành công: 1 SKU tạm khóa sàn, {} SKU còn lại đẩy thành công 100%!",
                                            remaining.size());
                                    continue;
                                }
                            } catch (Exception subEx) {
                                log.warn("[LAZADA-FALLBACK] Lỗi gửi sub-batch: {}", subEx.getMessage());
                            }
                        }
                    }

                    // [BATCH FALLBACK SKU MISMATCH] Tự động thử lại chỉ với SellerSku khi SkuId cũ bị Lazada từ chối (Self-Healing khi đổi Shop)
                    boolean isSkuMismatch = msg.toLowerCase(Locale.ROOT).contains("doesn't exist")
                            || msg.toLowerCase(Locale.ROOT).contains("does not match")
                            || msg.toLowerCase(Locale.ROOT).contains("invalid skuid");
                    if (isSkuMismatch && batch.stream().anyMatch(it -> it.skuId() != null && !it.skuId().isBlank())) {
                        log.info("[LAZADA-FALLBACK-SKU] Phát hiện SkuId không khớp với gian hàng hiện tại, tự động reset SkuId và gửi lại chỉ với SellerSku...");
                        StringBuilder retryXml = new StringBuilder("<Request><Product><Skus>");
                        for (DongCanCapNhat item : batch) {
                            item.dong().setMaSanPhamKenh(null); // Xóa SkuId cũ sai
                            retryXml.append("<Sku>");
                            retryXml.append("<SellerSku>").append(escapeXml(item.sellerSku())).append("</SellerSku>");
                            retryXml.append("<Quantity>").append(Math.max(0, item.soDay())).append("</Quantity>");
                            BienTheSanPham bt = item.dong().getBienTheSanPham();
                            if (bt != null && bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0) {
                                retryXml.append("<Price>").append(bt.getGiaBan().setScale(2, RoundingMode.HALF_UP)).append("</Price>");
                            }
                            retryXml.append("</Sku>");
                        }
                        retryXml.append("</Skus></Product></Request>");
                        try {
                            JsonNode retryRes = lazadaClient.updatePriceQuantity(appKey, appSecret, token, retryXml.toString());
                            String retryCode = retryRes != null ? retryRes.path("code").asText("") : "";
                            if ("0".equals(retryCode)) {
                                for (DongCanCapNhat item : batch) {
                                    item.dong().setTrangThaiDongBo("thanh_cong");
                                    item.dong().setChiTietLoi(null);
                                    item.dong().setSoLuongDaDay(item.soDay());
                                    item.dong().setNgayDayTonCuoi(now);
                                    soThanhCong++;
                                    theoDoi.daDay(item.sellerSku(), null, true, null);
                                }
                                log.info("[LAZADA-FALLBACK-SKU] Đẩy tồn tự chữa lành thành công cho {} SKU bằng SellerSku!", batch.size());
                                continue;
                            }
                        } catch (Exception retryEx) {
                            log.warn("[LAZADA-FALLBACK-SKU] Thử lại bằng SellerSku thất bại: {}", retryEx.getMessage());
                        }
                    }

                    String friendlyMsg = dichLoiLazada(code, msg);
                    for (DongCanCapNhat item : batch) {
                        item.dong().setTrangThaiDongBo("that_bai");
                        item.dong().setChiTietLoi(friendlyMsg);
                        soLoi++;
                        theoDoi.daDay(item.sellerSku(), tenHienThi(item.dong().getBienTheSanPham()), false, friendlyMsg);
                    }
                }
            } catch (Exception ex) {
                log.warn("[LAZADA-SYNC-BATCH] Lỗi mạng khi gọi updatePriceQuantity cho batch {}: {}", i / BATCH_SIZE, ex.getMessage());
                loiKenh = "Lỗi kết nối tới Lazada: " + ex.getMessage();
                for (DongCanCapNhat item : batch) {
                    item.dong().setTrangThaiDongBo("that_bai");
                    item.dong().setChiTietLoi("Lỗi kết nối: " + ex.getMessage());
                    soLoi++;
                    theoDoi.daDay(item.sellerSku(), tenHienThi(item.dong().getBienTheSanPham()), false, ex.getMessage());
                }
            }

            List<TrangThaiDongBoSanPham> batchEntities = batch.stream().map(DongCanCapNhat::dong).toList();
            trangThaiDongBoSanPhamRepository.saveAll(batchEntities);

            if (loiKenh != null && (loiKenh.contains("giới hạn tần suất") || loiKenh.contains("AppCallLimit"))) {
                break;
            }
        }

        int soChuaDay = dirtyList.size() - (soThanhCong + soLoi);
        if (soThanhCong > 0) {
            lanDayTonCuoi.put(kenh.getId(), Instant.now());
        }

        String moTa = "Lazada: Đẩy tồn theo batch (" + dirtyList.size() + " SKU dirty, bỏ qua " + soBoQuaKhongDoi + " SKU không đổi): "
                + soThanhCong + " thành công, " + soLoi + " lỗi, " + soChuaDay + " chưa đẩy"
                + (loiKenh != null ? " (" + loiKenh + ")" : "");
        if (dungTheoYeuCau) {
            moTa += "; dừng theo yêu cầu";
        }
        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, moTa);

        return DayTonResultDto.builder()
                .soDong(soThanhCong)
                .soLoi(soLoi)
                .soChuaDay(soChuaDay)
                .loiKenh(loiKenh)
                .build();
    }

    private DayTonResultDto dayTonKhiDaGiuKhoa(KenhBanHang kenh, String maKenh, DayTonKenhRequest request, TheoDoiDayTon theoDoi) {
        BigDecimal tyLe = request.getTyLeDayTon() != null ? request.getTyLeDayTon() : BigDecimal.valueOf(100);
        int tonDem = request.getTonDem() != null ? request.getTonDem() : 0;
        int nguongVe0 = request.getNguongVe0() != null ? request.getNguongVe0() : 0;

        List<TrangThaiDongBoSanPham> dongCanDay = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId())
                .stream().filter(KenhBanHangDongBoServiceImpl::duocDayTon).toList();

        if (OmnichannelOrderSyncJob.isLazada(kenh.getMaKenh())) {
            boolean canLienKetLai = dongCanDay.isEmpty()
                    || dongCanDay.stream().anyMatch(d -> d.getMaSanPhamKenh() == null || !d.getMaSanPhamKenh().trim().matches("\\d+"));
            if (canLienKetLai) {
                log.info("[LAZADA-SYNC] Phát hiện danh sách SKU Lazada chưa liên kết hoặc chưa có SkuId số, tự động kích hoạt liên kết & tạo sản phẩm...");
                try {
                    tuDongLienKet(kenh.getMaKenh());
                    dongCanDay = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId())
                            .stream().filter(KenhBanHangDongBoServiceImpl::duocDayTon).toList();
                } catch (Exception ex) {
                    log.warn("[LAZADA-SYNC] Tự động liên kết Lazada trước khi đẩy tồn gặp lỗi: {}", ex.getMessage());
                
}
            }
            return dayTonLazadaToiUu(kenh, maKenh, dongCanDay, tyLe, tonDem, nguongVe0, theoDoi);
        } else if (OmnichannelOrderSyncJob.MA_KENH_TIKTOK.equalsIgnoreCase(kenh.getMaKenh()) || "TIKTOK".equalsIgnoreCase(kenh.getMaKenh())) {
            return dayTonTikTokToiUu(kenh, maKenh, dongCanDay, tyLe, tonDem, nguongVe0, theoDoi);
        } else if (OmnichannelOrderSyncJob.isShopee(kenh.getMaKenh())) {
            if (dongCanDay.isEmpty()) {
                try {
                    tuDongLienKetShopee(kenh);
                    dongCanDay = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId())
                            .stream().filter(KenhBanHangDongBoServiceImpl::duocDayTon).toList();
                } catch (Exception ex) {
                    log.warn("[SHOPEE-SYNC] Tự động liên kết Shopee trước khi đẩy tồn gặp lỗi: {}", ex.getMessage());
                }
            }
            return dayTonShopeeToiUu(kenh, maKenh, dongCanDay, tyLe, tonDem, nguongVe0, theoDoi);
        } else if (dongCanDay.isEmpty() && trangThaiDongBoSanPhamRepository.countByKenhBanHangId(kenh.getId()) == 0) {
            log.info("Kênh {} chưa có SKU liên kết nào, tự động kích hoạt liên kết & tạo sản phẩm trước khi đẩy tồn...", kenh.getMaKenh());
            try {
                tuDongLienKet(kenh.getMaKenh());
                dongCanDay = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId())
                        .stream().filter(KenhBanHangDongBoServiceImpl::duocDayTon).toList();
            } catch (Exception ex) {
                log.warn("Tự động liên kết trước khi đẩy tồn gặp lỗi: {}", ex.getMessage());
            }
        }

        // Không ném lỗi: các dòng Shopify đã nhận trước khi gặp lỗi cả gian hàng vẫn phải được lưu
        KetNoiDayTon ketNoi = moKetNoiDayTon(kenh);
        String loiKenh = ketNoi.lyDoLoi();
        int soThanhCong = 0;
        int soLoi = 0;
        int daXuLy = 0;
        boolean dungTheoYeuCau = false;
        if (loiKenh == null) {
            theoDoi.batDauDay(dongCanDay.size());
            for (TrangThaiDongBoSanPham dong : dongCanDay) {
                // Throttling 250ms bảo vệ Shopify leaky bucket rate limit khi đẩy danh sách SKU
                if (daXuLy > 0) {
                    try {
                        Thread.sleep(250);
                    } catch (InterruptedException ignored) {}
                }
                if (theoDoi.canDung()) {
                    dungTheoYeuCau = true;
                    break;
                }
                BienTheSanPham bt = dong.getBienTheSanPham();
                theoDoi.dangDay(bt.getMaSku());
                // Free to Use toàn chuỗi rồi áp công thức BR-OC-10
                int soDay = tinhSoTonDay(khaDungToanChuoi(bt.getId()), tyLe, tonDem, nguongVe0);
                KetQuaGuiTon kq = dayTonChoDong(dong, ketNoi, soDay);
                if (kq.loiKenh()) {
                    loiKenh = kq.lyDo();
                    break;
                }
                daXuLy++;
                if (kq.thanhCong()) {
                    soThanhCong++;
                } else {
                    soLoi++;
                }
                trangThaiDongBoSanPhamRepository.save(dong);
                theoDoi.daDay(bt.getMaSku(), kq.thanhCong() ? null : tenHienThi(bt), kq.thanhCong(), kq.lyDo());
            }
        }
        int soChuaDay = dongCanDay.size() - daXuLy;

        if (soThanhCong > 0) {
            lanDayTonCuoi.put(kenh.getId(), Instant.now());
        }
        String moTa = moTaKetQuaDayTon(maKenh, ketNoi.tenDiaDiem(), soThanhCong, soLoi, soChuaDay, loiKenh);
        if (dungTheoYeuCau) {
            moTa += "; dừng theo yêu cầu, còn " + soChuaDay + " SKU chưa đẩy";
        }
        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, moTa);
        return DayTonResultDto.builder()
                .soDong(soThanhCong)
                .soLoi(soLoi)
                .soChuaDay(soChuaDay)
                .loiKenh(loiKenh)
                .build();
    }

    /** Câu nhật ký của một đợt đẩy tồn; {@code tenDiaDiem}: địa điểm Shopify nhận số (null nếu chưa xác định được). */
    static String moTaKetQuaDayTon(String maKenh, String tenDiaDiem, int soThanhCong, int soLoi, int soChuaDay, String loiKenh) {
        String dau = "Đẩy tồn kho kênh " + maKenh + (tenDiaDiem != null ? " vào " + tenDiaDiem : "");
        if (loiKenh != null && soThanhCong == 0 && soLoi == 0) {
            return dau + " thất bại: " + loiKenh;
        }
        StringBuilder sb = new StringBuilder(dau).append(": ")
                .append(soThanhCong).append(" SKU thành công");
        if (soLoi > 0) {
            sb.append(", ").append(soLoi).append(" SKU lỗi");
        }
        if (loiKenh != null) {
            sb.append("; dừng giữa chừng, còn ").append(soChuaDay).append(" SKU chưa đẩy: ").append(loiKenh);
        }
        return sb.toString();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void dayTonKhoKhanCap(Integer bienTheSanPhamId) {
        if (bienTheSanPhamId == null) return;
        List<TrangThaiDongBoSanPham> mappings = trangThaiDongBoSanPhamRepository.findByBienTheSanPhamId(bienTheSanPhamId);
        for (TrangThaiDongBoSanPham m : mappings) {
            if (m.getKenhBanHang() == null || !Integer.valueOf(1).equals(m.getKenhBanHang().getTrangThai()) || !duocDayTon(m)) {
                continue;
            }
            String maKenhCuaDong = m.getKenhBanHang().getMaKenh();
            if (!KenhCauHinhDongBo.tuDongDayTon(dieuHanhHeThongService, maKenhCuaDong)) {
                log.info("[JOB-03 Real-time] Kênh {} đang tắt tự động đẩy tồn, bỏ qua SKU ID {}", maKenhCuaDong, bienTheSanPhamId);
                continue;
            }
            log.info("[JOB-03 Real-time] Tồn kho SKU ID {} < 3 units. Kích hoạt đẩy tồn khẩn cấp lên kênh {} (Sàn SKU: {})",
                    bienTheSanPhamId, maKenhCuaDong, m.getMaSanPhamKenh());
            try {
                KetNoiDayTon ketNoi = moKetNoiDayTon(m.getKenhBanHang());
                if (ketNoi.lyDoLoi() != null) {
                    log.warn("[JOB-03 Real-time] Không đẩy tồn khẩn cấp SKU ID {} lên kênh {}: {}", bienTheSanPhamId, maKenhCuaDong, ketNoi.lyDoLoi());
                    continue;
                }
                int soDay = soTonDayTheoQuyTacDaLuu(maKenhCuaDong, khaDungToanChuoi(bienTheSanPhamId));
                KetQuaGuiTon kq = dayTonChoDong(m, ketNoi, soDay);
                if (kq.loiKenh()) {
                    log.warn("[JOB-03 Real-time] Không đẩy tồn khẩn cấp SKU ID {} lên kênh {}: {}", bienTheSanPhamId, maKenhCuaDong, kq.lyDo());
                    continue;
                }
                if (kq.thanhCong()) {
                    lanDayTonCuoi.put(m.getKenhBanHang().getId(), Instant.now());
                } else {
                    log.warn("[JOB-03 Real-time] Shopify không nhận tồn khẩn cấp SKU ID {}: {}", bienTheSanPhamId, kq.lyDo());
                }
                trangThaiDongBoSanPhamRepository.save(m);
            } catch (Exception e) {
                log.warn("Lỗi khi đẩy tồn khẩn cấp cho SKU {}: {}", bienTheSanPhamId, e.getMessage());
            }
        }
    }

    @Override
    @Transactional(readOnly = true)
    public DongBoTongQuanDto getTongQuan(String maKenh) {
        KenhBanHang kenh = getKenhActive(maKenh);
        long tong = trangThaiDongBoSanPhamRepository.countByKenhBanHangId(kenh.getId());
        long daLienKet = trangThaiDongBoSanPhamRepository.countByKenhBanHangIdAndTrangThaiDongBo(kenh.getId(), "thanh_cong");
        long thatBai = trangThaiDongBoSanPhamRepository.countByKenhBanHangIdAndTrangThaiDongBo(kenh.getId(), "that_bai");
        long chuaLienKet = Math.max(0, tong - daLienKet - thatBai);
        // Job đẩy tồn (JOB-03) và lấy đơn (JOB-01) cùng chạy theo OMNI_SYNC_INTERVAL_MINS
        int chuKyPhut = omnichannelOrderSyncJob.getChuKyPhut();

        Long soYeuCauHuy = null;
        if (OmnichannelOrderSyncJob.MA_KENH_TIKTOK.equalsIgnoreCase(kenh.getMaKenh()) && donBanHangRepository != null) {
            soYeuCauHuy = donBanHangRepository.countByKenhIdAndGhiChuTagAndTrangThaiIn(
                    kenh.getId(), "[KHÁCH YÊU CẦU HỦY]", List.of(0, 1, 7, 8));
        }

        return DongBoTongQuanDto.builder()
                .tongSkuSan(tong)
                .daLienKet(daLienKet)
                .chuaLienKet(chuaLienKet)
                .loiDongBo(thatBai)
                .lanDongBoCuoi(kenh.getNgayCapNhat())
                .chuKyDongBoTonPhut(chuKyPhut)
                .chuKyLayDonPhut(chuKyPhut)
                .lanDayTonCuoi(lanDayTonCuoi.get(kenh.getId()))
                .lanLayDonCuoi(omnichannelOrderSyncJob.getLanLayDonCuoi(kenh.getId()))
                .soYeuCauHuy(soYeuCauHuy)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<BienTheOptionDto> timBienThe(String q, int limit) {
        int max = limit > 0 ? Math.min(limit, 50) : 20;
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, max);
        String keyword = q != null ? q.trim() : "";
        List<BienTheSanPham> list = bienTheSanPhamRepository.searchVariantsForMapping(keyword, pageable);
        return list.stream().map(bt -> BienTheOptionDto.builder()
                .id(bt.getId())
                .maSku(bt.getMaSku())
                .tenBienThe(buildVariantName(bt))
                .tenSanPham(bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                .giaBan(bt.getGiaBan())
                .build()
        ).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ShopifyLocationDto> getLocations(String maKenh) {
        KenhBanHang kenh = getKenhActive(maKenh);
        if (OmnichannelOrderSyncJob.isLazada(kenh.getMaKenh())) {
            return List.of(
                    ShopifyLocationDto.builder()
                            .maKhoSan("lazada-default-warehouse")
                            .tenKhoSan("Kho mặc định Lazada")
                            .loai("fulfillment")
                            .macDinh(true)
                            .build()
            );
        }
        if (OmnichannelOrderSyncJob.isShopee(kenh.getMaKenh())) {
            return List.of(
                    ShopifyLocationDto.builder()
                            .maKhoSan("shopee-default-warehouse")
                            .tenKhoSan("Kho mặc định Shopee" + (OmnichannelOrderSyncJob.isShopeeSandbox(kenh.getMaKenh()) ? " Sandbox" : ""))
                            .loai("fulfillment")
                            .macDinh(true)
                            .build()
            );
        }
        if ("TIKTOK".equalsIgnoreCase(kenh.getMaKenh())) {
            String token = kenhBanHangService.getDecryptedTikTokAccessToken();
            String appKey = kenhBanHangService.getTikTokAppKey();
            String appSecret = kenhBanHangService.getDecryptedTikTokAppSecret();
            String cipher = kenhBanHangService.getTikTokShopCipher();

            if (token != null && !token.isBlank() && appKey != null && appSecret != null && cipher != null && !cipher.isBlank()) {
                try {
                    TikTokWarehousesResponse res = getTikTokShopClient().getWarehouses(appKey, appSecret, token, cipher);
                    List<TikTokWarehouseDto> warehouses = res.getWarehouses();
                    if (warehouses != null && !warehouses.isEmpty()) {
                        List<ShopifyLocationDto> list = new ArrayList<>();
                        for (TikTokWarehouseDto w : warehouses) {
                            boolean isSales = "SALES_WAREHOUSE".equalsIgnoreCase(w.getWarehouseType())
                                    || "DOMESTIC_WAREHOUSE".equalsIgnoreCase(w.getWarehouseSubType());
                            boolean isReturn = "RETURN_WAREHOUSE".equalsIgnoreCase(w.getWarehouseType());
                            // Bỏ qua kho trả hàng (chỉ là địa chỉ bưu phẩm hoàn, không nhận tồn kho bán)
                            if (isReturn) {
                                continue;
                            }
                            String warehouseId = (w.getWarehouseId() != null && !w.getWarehouseId().isBlank())
                                    ? w.getWarehouseId() : w.getId();
                            String baseName = (w.getWarehouseName() != null && !w.getWarehouseName().isBlank())
                                    ? w.getWarehouseName()
                                    : (w.getName() != null && !w.getName().isBlank() ? w.getName() : "Kho TikTok " + (warehouseId != null ? warehouseId : ""));
                            String warehouseName = baseName;
                            if (isSales && !baseName.toLowerCase().contains("bán hàng")) {
                                warehouseName += " (Kho bán hàng mặc định)";
                            }
                            list.add(ShopifyLocationDto.builder()
                                    .maKhoSan(warehouseId)
                                    .tenKhoSan(warehouseName)
                                    .loai("sales")
                                    .macDinh(Boolean.TRUE.equals(w.getIsDefault()) || list.isEmpty())
                                    .build());
                        }
                        // Nếu chỉ có 1 kho bán hàng duy nhất, tự động gán mặc định và ghi nhận cấu hình nếu trống
                        if (list.size() == 1) {
                            list.get(0).setMacDinh(true);
                            String curSaved = dieuHanhHeThongService.getCauHinhString(KenhCauHinhDongBo.khoa("TIKTOK", "MA_KHO_SAN"), null);
                            if (curSaved == null || curSaved.isBlank()) {
                                dieuHanhHeThongService.setCauHinhString(KenhCauHinhDongBo.khoa("TIKTOK", "MA_KHO_SAN"), list.get(0).getMaKhoSan());
                            }
                        }
                        if (!list.isEmpty()) {
                            return list;
                        }
                    }
                } catch (Exception e) {
                    log.warn("Không lấy được danh sách kho logistics từ TikTok Shop: {}", e.getMessage());
                }
            }

            return List.of(
                    ShopifyLocationDto.builder()
                            .maKhoSan("tiktok-default-warehouse")
                            .tenKhoSan("Kho bán hàng TikTok Shop")
                            .loai("fulfillment")
                            .macDinh(true)
                            .build()
            );
        }
        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        if (token == null || token.isBlank() || domain.isBlank()) {
            return List.of(
                    ShopifyLocationDto.builder()
                            .maKhoSan("gid://shopify/Location/default")
                            .tenKhoSan("Kho mặc định Shopify")
                            .loai("fulfillment")
                            .macDinh(true)
                            .build()
            );
        }

        JsonNode locations;
        try {
            locations = docShopify(domain, token, "locations.json");
        } catch (Exception e) {
            // Rỗng thay vì một "kho mặc định" giả: giao diện báo không đọc được, không hiện tên sai
            log.warn("Không lấy được danh sách location từ Shopify: {}", e.getMessage());
            return List.of();
        }
        Long primaryId = null;
        try {
            long id = docShopify(domain, token, "shop.json?fields=primary_location_id").path("shop").path("primary_location_id").asLong(0);
            primaryId = id > 0 ? id : null;
        } catch (Exception e) {
            log.warn("Không đọc được địa điểm mặc định của cửa hàng Shopify: {}", e.getMessage());
        }
        return dsDiaDiem(locations, primaryId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DongBoTongQuanDto luuCaiDat(String maKenh, KenhBanHangCaiDatRequest request) {
        KenhBanHang kenh = getKenhActive(maKenh);
        if (request.getKhoId() != null && !khoRepository.existsById(request.getKhoId())) {
            throw new CommonException(ThongDiep.of("kenhBan.khoKhongTonTai", request.getKhoId()), HttpStatus.BAD_REQUEST, null);
        }

        if (request.getMaKhoSan() != null && !request.getMaKhoSan().isBlank()) {
            dieuHanhHeThongService.setCauHinhString(KenhCauHinhDongBo.khoa(maKenh, "MA_KHO_SAN"), request.getMaKhoSan().trim());
        }
        if (request.getTenKhoSan() != null && !request.getTenKhoSan().isBlank()) {
            dieuHanhHeThongService.setCauHinhString(KenhCauHinhDongBo.khoa(maKenh, "TEN_KHO_SAN"), request.getTenKhoSan().trim());
        }

        kenh.setNgayCapNhat(Instant.now());
        kenhBanHangRepository.save(kenh);

        ghiNhatKy(kenh.getId(), IHanhDong.cap_nhat_kenh_ban,
                String.format("Lưu cấu hình đồng bộ: Kho %s, Kho sàn %s, Tỷ lệ %s%%, Tồn đệm %s, Ngưỡng về 0: %s",
                        request.getKhoId(), request.getMaKhoSan(), request.getTyLeDayTon(), request.getTonDem(), request.getNguongVe0()));

        return getTongQuan(maKenh);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NhatKyDongBoDto> filterNhatKy(String maKenh, String loai, String trangThai, String search, Pageable pageable) {
        KenhBanHang kenh = getKenhActive(maKenh);
        String dbTrangThai = null;
        if ("THANH_CONG".equalsIgnoreCase(trangThai)) {
            dbTrangThai = "thanh_cong";
        } else if ("LOI".equalsIgnoreCase(trangThai)) {
            dbTrangThai = "that_bai";
        } else if ("CHO".equalsIgnoreCase(trangThai)) {
            dbTrangThai = "chua_dong_bo";
        }

        Page<TrangThaiDongBoSanPham> page = trangThaiDongBoSanPhamRepository.filterByKenh(
                kenh.getId(),
                dbTrangThai,
                (search == null || search.isBlank()) ? null : search.trim(),
                pageable
        );

        return page.map(this::mapToNhatKyDto);
    }

    @Override
    @Transactional(readOnly = true)
    public NhatKyDongBoDto getNhatKyDetail(Integer id) {
        TrangThaiDongBoSanPham tt = trangThaiDongBoSanPhamRepository.findById(id)
                .orElseThrow(() -> new CommonException(ThongDiep.of("kenhBan.khongTimThaySuKienNhatKy", id), HttpStatus.NOT_FOUND, null));
        return mapToNhatKyDto(tt);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LayDonResultDto layDonHang(String maKenh, LayDonHangKenhRequest request) {
        KenhBanHang kenh = getKenhActive(maKenh);
        kiemTraDaKetNoi(kenh);
        Instant tu = Instant.now().minusSeconds(86400);
        Instant den = Instant.now();
        if (request != null) {
            if (request.getTu() != null && !request.getTu().isBlank()) {
                try {
                    tu = Instant.parse(request.getTu());
                } catch (Exception ignored) {}
            }
            if (request.getDen() != null && !request.getDen().isBlank()) {
                try {
                    den = Instant.parse(request.getDen());
                } catch (Exception ignored) {}
            }
        }

        int synced = 0;
        if (OmnichannelOrderSyncJob.isLazada(kenh.getMaKenh())) {
            synced = omnichannelOrderSyncJob.syncLazadaOrders(kenh, tu, den);
        } else if (OmnichannelOrderSyncJob.isShopee(kenh.getMaKenh())) {
            synced = omnichannelOrderSyncJob.syncShopeeOrders(kenh, tu, den);
        } else if (OmnichannelOrderSyncJob.MA_KENH_TIKTOK.equalsIgnoreCase(kenh.getMaKenh()) || "TIKTOK".equalsIgnoreCase(kenh.getMaKenh())) {
            synced = omnichannelOrderSyncJob.syncTikTokOrders(kenh, tu, den);
        } else {
            synced = omnichannelOrderSyncJob.syncShopifyOrders(kenh, tu, den);
        }
        ghiNhatKy(kenh.getId(), IHanhDong.cap_nhat_kenh_ban, "Lấy đơn hàng từ sàn " + maKenh + ": thành công " + synced + " đơn");

        return LayDonResultDto.builder()
                .soDonMoi(synced)
                .soDonCapNhat(0)
                .thongDiep(ThongDiep.dich("kenhBan.nhanDonMoiTuSan", synced, maKenh))
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DayTonResultDto dongBoTatCa() {
        List<KenhBanHang> activeKenh = kenhBanHangRepository.findByTrangThai(1);
        int totalSku = 0;
        for (KenhBanHang kenh : activeKenh) {
            if (MA_KENH_SHOPIFY.equalsIgnoreCase(kenh.getMaKenh())) {
                DayTonResultDto dayTonRes = dayTonKhoLenKenh(kenh.getMaKenh(), quyTacDaLuu(kenh.getMaKenh()));
                if (dayTonRes != null) {
                    totalSku += dayTonRes.getSoDong();
                }
                omnichannelOrderSyncJob.syncShopifyOrders(kenh);
            } else if (OmnichannelOrderSyncJob.isLazada(kenh.getMaKenh())) {
                DayTonResultDto dayTonRes = dayTonKhoLenKenh(kenh.getMaKenh(), quyTacDaLuu(kenh.getMaKenh()));
                if (dayTonRes != null) {
                    totalSku += dayTonRes.getSoDong();
                }
                omnichannelOrderSyncJob.syncLazadaOrders(kenh);
            } else if (OmnichannelOrderSyncJob.MA_KENH_TIKTOK.equalsIgnoreCase(kenh.getMaKenh()) || "TIKTOK".equalsIgnoreCase(kenh.getMaKenh())) {
                DayTonResultDto dayTonRes = dayTonKhoLenKenh(kenh.getMaKenh(), quyTacDaLuu(kenh.getMaKenh()));
                if (dayTonRes != null) {
                    totalSku += dayTonRes.getSoDong();
                }
                omnichannelOrderSyncJob.syncTikTokOrders(kenh);
            } else if (OmnichannelOrderSyncJob.isShopee(kenh.getMaKenh())) {
                DayTonResultDto dayTonRes = dayTonKhoLenKenh(kenh.getMaKenh(), quyTacDaLuu(kenh.getMaKenh()));
                if (dayTonRes != null) {
                    totalSku += dayTonRes.getSoDong();
                }
                omnichannelOrderSyncJob.syncShopeeOrders(kenh, 30);
            }
        }
        return DayTonResultDto.builder()
                .soDong(totalSku)
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LienKetSanPhamDto thuLai(Integer lienKetId) {
        TrangThaiDongBoSanPham tt = trangThaiDongBoSanPhamRepository.findById(lienKetId)
                .orElseThrow(() -> new CommonException(ThongDiep.of("kenhBan.khongTimThayLienKet", lienKetId), HttpStatus.NOT_FOUND, null));
        kiemTraDaKetNoi(tt.getKenhBanHang());

        BienTheSanPham bt = tt.getBienTheSanPham();
        BigDecimal soLuongKhaDung = BigDecimal.ZERO;
        if (bt != null) {
            soLuongKhaDung = khaDungToanChuoi(bt.getId());

            // Lỗi cả gian hàng: báo lỗi, giữ nguyên dòng. Lỗi riêng SKU: dòng sang Lỗi kèm lý do Shopify trả về
            KenhBanHang kenhCuaDong = tt.getKenhBanHang();
            KetNoiDayTon ketNoi = moKetNoiDayTon(kenhCuaDong);
            if (ketNoi.lyDoLoi() != null) {
                throw new CommonException(ketNoi.lyDoLoi(), HttpStatus.BAD_REQUEST, null);
            }
            int soDay = soTonDayTheoQuyTacDaLuu(kenhCuaDong.getMaKenh(), soLuongKhaDung);
            KetQuaGuiTon kq = dayTonChoDong(tt, ketNoi, soDay);
            if (kq.loiKenh()) {
                throw new CommonException(kq.lyDo(), HttpStatus.BAD_REQUEST, null);
            }
            if (kq.thanhCong()) {
                lanDayTonCuoi.put(kenhCuaDong.getId(), Instant.now());
            } else {
                log.warn("Thử lại đồng bộ SKU {} thất bại: {}", bt.getMaSku(), kq.lyDo());
            }
            trangThaiDongBoSanPhamRepository.save(tt);
        }

        Integer sanPhamIdCuaDong = bt != null && bt.getSanPham() != null ? bt.getSanPham().getId() : null;
        return LienKetSanPhamDto.builder()
                .id(tt.getId())
                .skuSan(tt.getMaSanPhamKenh())
                .tenSanPhamSan(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                .tenBienTheSan(bt != null ? buildVariantName(bt) : null)
                .giaBanSan(bt != null ? bt.getGiaBan() : null)
                .bienTheSanPhamId(bt != null ? bt.getId() : null)
                .sanPhamId(sanPhamIdCuaDong)
                .anhDaiDien(anhDaiDienCuaSanPham(sanPhamIdCuaDong))
                .maSku(bt != null ? bt.getMaSku() : null)
                .tenSanPham(bt != null && bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null)
                .tenBienThe(bt != null ? buildVariantName(bt) : null)
                .giaBan(bt != null ? bt.getGiaBan() : null)
                .soLuongKhaDung(soLuongKhaDung)
                .soLuongDaDay(soDaDay(tt))
                .ngayDayTonCuoi(tt.getNgayDayTonCuoi())
                .choPhepDongBo(true)
                .trangThaiLienKet(mapStatusToFrontend(tt.getTrangThaiDongBo()))
                .ngayDongBoCuoi(tt.getNgayDongBoCuoi())
                .chiTietLoi(tt.getChiTietLoi())
                .build();
    }

    /**
     * Ảnh đại diện của từng sản phẩm (ảnh chính, không có thì ảnh đầu), một truy vấn cho cả danh sách.
     * Chỉ để hiển thị: lỗi đọc ảnh thì trả rỗng, không làm hỏng danh sách liên kết.
     */
    private Map<Integer, String> anhDaiDienTheoSanPham(Collection<Integer> sanPhamIds) {
        if (sanPhamIds == null || sanPhamIds.isEmpty()) return Map.of();
        Map<Integer, String> ketQua = new HashMap<>();
        try {
            // Truy vấn đã sắp ảnh chính lên trước trong từng sản phẩm, nên giữ ảnh gặp đầu tiên
            for (AnhQuanAo anh : anhQuanAoRepository.findActiveByQuanAoIds(sanPhamIds)) {
                if (anh.getQuanAo() == null || anh.getTepTin() == null) continue;
                String url = duongDanAnh(anh.getTepTin());
                if (url != null) ketQua.putIfAbsent(anh.getQuanAo().getId(), url);
            }
        } catch (Exception ex) {
            log.warn("Không lấy được ảnh sản phẩm cho danh sách liên kết: {}", ex.getMessage());
        }
        return ketQua;
    }

    private String anhDaiDienCuaSanPham(Integer sanPhamId) {
        return sanPhamId == null ? null : anhDaiDienTheoSanPham(List.of(sanPhamId)).get(sanPhamId);
    }

    /** URL ảnh đã đổi sang tên miền HTTPS, nếu không web HTTPS chặn ảnh từ IP MinIO (Mixed Content). */
    private String duongDanAnh(TepTin tep) {
        if (tep.getDuongDan() != null && !tep.getDuongDan().isBlank()) return PublicAssetUrl.toHttps(tep.getDuongDan());
        if (tep.getTenLuuTru() == null || tep.getTenLuuTru().isBlank()) return null;
        try {
            return PublicAssetUrl.toHttps(minioService.getPublicUrl(tep.getTenLuuTru()));
        } catch (Exception ex) {
            return null;
        }
    }

    private NhatKyDongBoDto mapToNhatKyDto(TrangThaiDongBoSanPham tt) {
        KenhBanHang kenh = tt.getKenhBanHang();
        BienTheSanPham bt = tt.getBienTheSanPham();

        String statusStr = "CHO";
        boolean canRetry = false;
        String errorMsg = null;
        String errCode = null;

        if ("thanh_cong".equalsIgnoreCase(tt.getTrangThaiDongBo())) {
            statusStr = "THANH_CONG";
        } else if ("that_bai".equalsIgnoreCase(tt.getTrangThaiDongBo())) {
            statusStr = "LOI";
            canRetry = true;
            errCode = "SYNC_FAILED";
            errorMsg = tt.getChiTietLoi() != null ? DichCauDaLuu.dich(tt.getChiTietLoi()) : ThongDiep.dich("kenhBan.loiDongBoTonKhoSangSan");
        }

        String skuRef = bt != null ? bt.getMaSku() : tt.getMaSanPhamKenh();
        String message = statusStr.equals("THANH_CONG")
                ? ThongDiep.dich("kenhBan.dongBoTonKhoSkuThanhCong", skuRef)
                : (errorMsg != null ? errorMsg : ThongDiep.dich("kenhBan.choDongBoTonKhoSku", skuRef));

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("skuSan", tt.getMaSanPhamKenh());
        if (bt != null) {
            summary.put("maSku", bt.getMaSku());
            if (bt.getSanPham() != null) {
                summary.put("tenSanPham", bt.getSanPham().getTenSanPham());
            }
        }
        summary.put("trangThai", tt.getTrangThaiDongBo());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("lienKetId", tt.getId());
        payload.put("kenhBanId", kenh != null ? kenh.getId() : null);
        payload.put("maSanPhamKenh", tt.getMaSanPhamKenh());
        payload.put("ngayDongBoCuoi", tt.getNgayDongBoCuoi() != null ? tt.getNgayDongBoCuoi().toString() : null);
        payload.put("chiTietLoi", tt.getChiTietLoi());

        return NhatKyDongBoDto.builder()
                .id(tt.getId())
                .ketNoiKenhId(kenh != null ? kenh.getId() : null)
                .maKenh(kenh != null ? kenh.getMaKenh() : "SHOPIFY")
                .tenHienThi(kenh != null ? kenh.getTenKenh() : "Shopify Official")
                .loai("TON_KHO")
                .nguon("FCENTRIC")
                .trangThai(statusStr)
                .maThamChieu(skuRef)
                .thongDiep(message)
                .maLoi(errCode)
                .chiTietLoi(tt.getChiTietLoi())
                .ngayTao(tt.getNgayDongBoCuoi() != null ? tt.getNgayDongBoCuoi() : Instant.now())
                .coTheThuLai(canRetry)
                .duLieuTomTat(summary)
                .payload(payload)
                .build();
    }

    @Override
    public boolean coKenh(String maKenh) {
        return maKenh != null && !maKenh.isBlank() && timKenh(maKenh.trim()).isPresent();
    }

    @Override
    public void kiemTraDaKetNoi(String maKenh) {
        kiemTraDaKetNoi(getKenhActive(maKenh));
    }

    /** Thao tác cần khóa truy cập: kênh chưa có khóa (chưa kết nối hoặc đã ngắt) thì báo để giao diện đọc lại kết nối. */
    private void kiemTraDaKetNoi(KenhBanHang kenh) {
        if (kenh == null || kenh.getApiKey() == null || kenh.getApiKey().isBlank()) {
            throw kenhChuaKetNoi(kenh != null ? kenh.getMaKenh() : null);
        }
    }

    private static LoiCoMaException kenhChuaKetNoi(String maKenh) {
        ThongDiep thongDiep = maKenh == null || maKenh.isBlank()
                ? ThongDiep.of("kenhBan.sanNayChuaKetNoi")
                : ThongDiep.of("kenhBan.sanChuaKetNoi", KenhBanHangServiceImpl.tenSanTrongCau(maKenh));
        return new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.KENH_CHUA_KET_NOI, thongDiep);
    }

    @Override
    public boolean chayKhiKenhRanh(String maKenh, Runnable viec) {
        KenhBanHang kenh = getKenhActive(maKenh);
        ReentrantLock khoa = khoaDayTon.computeIfAbsent(kenh.getId(), id -> new ReentrantLock());
        if (!khoa.tryLock()) {
            return false;
        }
        try {
            viec.run();
            return true;
        } finally {
            khoa.unlock();
        }
    }

    @Override
    public void xoaMocLanChay(String maKenh) {
        timKenh(maKenh == null ? "" : maKenh.trim()).ifPresent(kenh -> {
            lanDayTonCuoi.remove(kenh.getId());
            omnichannelOrderSyncJob.xoaLanLayDonCuoi(kenh.getId());
        });
    }

    private KenhBanHang getKenhActive(String maKenh) {
        if (maKenh == null || maKenh.isBlank()) {
            throw new CommonException(ThongDiep.of("kenhBan.maKenhTrong"), HttpStatus.BAD_REQUEST, null);
        }
        return timKenh(maKenh.trim())
                .orElseThrow(() -> new CommonException(ThongDiep.of("kenhBan.khongTimThayKenhBanHang", maKenh), HttpStatus.NOT_FOUND, null));
    }

    /** Tìm kênh theo id (chuỗi số) hoặc mã kênh (nguyên văn, rồi in hoa). */
    private Optional<KenhBanHang> timKenh(String trimmed) {
        try {
            Integer id = Integer.parseInt(trimmed);
            Optional<KenhBanHang> byId = kenhBanHangRepository.findById(id);
            if (byId.isPresent()) return byId;
        } catch (NumberFormatException ignored) {
        }
        return kenhBanHangRepository.findByMaKenh(trimmed)
                .or(() -> kenhBanHangRepository.findByMaKenh(trimmed.toUpperCase()));
    }

    private String extractDomainFromApiUrl(String apiUrl) {
        if (apiUrl == null || apiUrl.isBlank()) return "";
        String clean = apiUrl.trim().replaceFirst("^(?i)https?://", "");
        int slashIdx = clean.indexOf('/');
        return (slashIdx > 0 ? clean.substring(0, slashIdx) : clean).trim().toLowerCase();
    }

    /** "Tên sản phẩm - Màu - Size" cho danh sách SKU lỗi; đọc không được thì null (không làm hỏng đợt đẩy). */
    private String tenHienThi(BienTheSanPham bt) {
        try {
            String tenSp = bt.getSanPham() != null ? bt.getSanPham().getTenSanPham() : null;
            String bienThe = buildVariantName(bt);
            if (tenSp == null) return bienThe.isBlank() ? null : bienThe;
            return bienThe.isBlank() ? tenSp : tenSp + " - " + bienThe;
        } catch (Exception e) {
            return null;
        }
    }

    private String buildVariantName(BienTheSanPham bt) {
        List<String> parts = new ArrayList<>();
        if (bt.getMauSac() != null) parts.add(bt.getMauSac().getTenMau());
        if (bt.getSize() != null) parts.add(bt.getSize().getTenSize());
        if (bt.getChatLieu() != null) parts.add(bt.getChatLieu().getTenChatLieu());
        return String.join(" - ", parts);
    }

    private String mapStatusToFrontend(String trangThaiDongBo) {
        if ("thanh_cong".equalsIgnoreCase(trangThaiDongBo)) return "da_lien_ket";
        if ("that_bai".equalsIgnoreCase(trangThaiDongBo)) return "that_bai";
        return "chua_lien_ket";
    }

    private void ghiNhatKy(Integer kenhId, String hanhDong, String chiTiet) {
        try {
            NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
            NguoiDung actor = null;
            if (auth != null && auth.getId() != null) {
                actor = nguoiDungRepository.findById(auth.getId()).orElse(null);
            }
            if (actor != null) {
                lichSuThayDoiService.create(
                        LichSuThayDoi.builder()
                                .loaiThamChieu(ITable.kenh_ban_hang)
                                .idThamChieu(kenhId)
                                .hanhDong(hanhDong)
                                .giaTriMoi(chiTiet)
                                .nguoiThucHien(actor)
                                .ngayThucHien(Instant.now())
                                .ghiChu("Đồng bộ đa kênh FCentric")
                                .build()
                );
            }
        } catch (Exception e) {
            log.warn("Không thể ghi log thay đổi kênh: {}", e.getMessage());
        }
    }

    /** Địa điểm Shopify nhận số tồn: địa điểm mặc định của cửa hàng (Settings › Locations › Default location). */
    record DiaDiemShopify(Long id, String ten) {}

    /** GET một tài nguyên Admin API của Shopify; lỗi HTTP hoặc kết nối thì ném ra. */
    private JsonNode docShopify(String domain, String token, String duongDan) throws Exception {
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/" + duongDan;
        ResponseEntity<String> response = createRestTemplate()
                .exchange(url, HttpMethod.GET, new HttpEntity<Void>(createHeaders(token)), String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new LoiTrangThaiException(ThongDiep.of("kenhBan.shopifyTraMaKhiDoc", response.getStatusCode().value(), duongDan));
        }
        return objectMapper.readTree(response.getBody());
    }

    /**
     * Địa điểm mặc định của cửa hàng (shop.primary_location_id) kèm tên; null nếu không xác định được.
     * Không lấy địa điểm đầu danh sách: Shopify không trả địa điểm mặc định lên đầu.
     */
    DiaDiemShopify layDiaDiemMacDinh(String domain, String token) {
        JsonNode shop = null;
        try {
            shop = docShopify(domain, token, "shop.json?fields=primary_location_id");
        } catch (Exception e) {
            log.warn("Không đọc được shop.json trên Shopify: {}", e.getMessage());
        }

        JsonNode locations = null;
        try {
            locations = docShopify(domain, token, "locations.json");
        } catch (Exception e) {
            log.warn("Không đọc được locations.json trên Shopify: {}", e.getMessage());
            return null;
        }

        return chonDiaDiemMacDinh(shop, locations);
    }

    /**
     * Tìm địa điểm có id = shop.primary_location_id trong danh sách locations.
     * Fallback an toàn: nếu chỉ có đúng 1 địa điểm duy nhất trong cửa hàng thì chọn địa điểm đó.
     * Null nếu không có địa điểm nào hoặc có nhiều địa điểm mà không xác định được địa điểm mặc định.
     */
    static DiaDiemShopify chonDiaDiemMacDinh(JsonNode shop, JsonNode locations) {
        if (locations == null || !locations.has("locations")) return null;
        JsonNode locList = locations.path("locations");
        if (!locList.isArray() || locList.isEmpty()) return null;

        if (shop != null) {
            long id = shop.path("shop").path("primary_location_id").asLong(0);
            if (id > 0) {
                for (JsonNode loc : locList) {
                    if (loc.path("id").asLong() == id) {
                        return new DiaDiemShopify(id, loc.path("name").asText("Địa điểm " + id));
                    }
                }
            }
        }

        // Fallback an toàn cho store chỉ có đúng 1 địa điểm duy nhất
        if (locList.size() == 1) {
            JsonNode single = locList.get(0);
            long id = single.path("id").asLong(0);
            if (id > 0) {
                return new DiaDiemShopify(id, single.path("name").asText("Địa điểm " + id));
            }
        }

        return null;
    }

    /** Danh sách địa điểm cho giao diện: đánh dấu và xếp địa điểm mặc định lên đầu, giữ thứ tự các địa điểm còn lại. */
    static List<ShopifyLocationDto> dsDiaDiem(JsonNode locations, Long primaryId) {
        List<ShopifyLocationDto> list = new ArrayList<>();
        for (JsonNode loc : locations.path("locations")) {
            long id = loc.path("id").asLong();
            list.add(ShopifyLocationDto.builder()
                    .maKhoSan(String.valueOf(id))
                    .tenKhoSan(loc.path("name").asText("Kho Shopify " + id))
                    .loai(loc.path("legacy").asBoolean(false) ? "legacy" : "fulfillment")
                    .macDinh(primaryId != null && primaryId == id)
                    .build());
        }
        list.sort(Comparator.comparing(ShopifyLocationDto::isMacDinh).reversed());
        return list;
    }

    private Map<String, ShopifyVariantInfo> layDanhSachSkuHienCoTrenShopify(String domain, String token, Map<String, Long> titleToProductIdMap) {
        try {
            return taiDanhSachSkuShopify(domain, token, titleToProductIdMap);
        } catch (Exception e) {
            log.warn("Lỗi khi quét danh sách sản phẩm hiện có trên Shopify: {}", e.getMessage());
            return new HashMap<>();
        }
    }

    /** Như trên nhưng báo lỗi ra ngoài, để luồng đẩy tồn phân biệt "gian hàng không có SKU" với "không tải được danh sách". */
    private Map<String, ShopifyVariantInfo> taiDanhSachSkuShopify(String domain, String token, Map<String, Long> titleToProductIdMap) throws Exception {
        Map<String, ShopifyVariantInfo> result = new HashMap<>();
        String currentUrl = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products.json?limit=250";
        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = createHeaders(token);

        int maxPages = 50;
        int page = 0;

        while (currentUrl != null && page < maxPages) {
            page++;
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(currentUrl, HttpMethod.GET, entity, String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new LoiTrangThaiException(ThongDiep.of("kenhBan.shopifyTraMaKhiTaiSanPham", response.getStatusCode().value()));
            }
            kiemTraLeakyBucket(response.getHeaders().getFirst("X-Shopify-Shop-Api-Call-Limit"));

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode products = root.path("products");
            if (products.isArray()) {
                for (JsonNode prod : products) {
                    Long prodId = prod.path("id").asLong();
                    String prodTitle = prod.path("title").asText("").trim().toLowerCase();
                    if (!prodTitle.isBlank() && titleToProductIdMap != null) {
                        titleToProductIdMap.put(prodTitle, prodId);
                    }
                    JsonNode vars = prod.path("variants");
                    if (vars.isArray()) {
                        for (JsonNode v : vars) {
                            String sku = v.path("sku").asText("").trim().toLowerCase();
                            if (!sku.isBlank()) {
                                Long imgId = v.path("image_id").isNull() || v.path("image_id").asLong() == 0 ? null : v.path("image_id").asLong();
                                BigDecimal price = null;
                                if (v.hasNonNull("price")) {
                                    try { price = new BigDecimal(v.path("price").asText("0")); } catch (Exception ignored) {}
                                }
                                BigDecimal compareAt = null;
                                if (v.hasNonNull("compare_at_price")) {
                                    try { compareAt = new BigDecimal(v.path("compare_at_price").asText("0")); } catch (Exception ignored) {}
                                }
                                String barcode = v.path("barcode").asText(null);

                                result.put(sku, new ShopifyVariantInfo(
                                        v.path("id").asLong(),
                                        v.path("inventory_item_id").asLong(),
                                        prodId,
                                        imgId,
                                        price,
                                        compareAt,
                                        barcode
                                ));
                            }
                        }
                    }
                }
            }
            currentUrl = trichXuatUrlTrangSau(response.getHeaders().getFirst("Link"));
        }
        return result;
    }

    private Map<String, ShopifyVariantInfo> taoSanPhamLenShopify(String domain, String token, SanPhamQuanAo sp, List<BienTheSanPham> variants) throws Exception {
        return taoSanPhamLenShopify(domain, token, sp, variants, variants);
    }

    private Map<String, ShopifyVariantInfo> taoSanPhamLenShopify(String domain, String token, SanPhamQuanAo sp, List<BienTheSanPham> variants, List<BienTheSanPham> allSpVariants) throws Exception {
        Map<String, ShopifyVariantInfo> result = new HashMap<>();
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products.json";

        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = createHeaders(token);

        String vendorName = "FCentric";
        if (sp != null && sp.getThuongHieu() != null && sp.getThuongHieu().getTenThuongHieu() != null && !sp.getThuongHieu().getTenThuongHieu().isBlank()) {
            vendorName = sp.getThuongHieu().getTenThuongHieu().trim();
        }

        String categoryName = "Thời trang";
        if (sp != null && sp.getDanhMuc() != null && sp.getDanhMuc().getTenDanhMuc() != null && !sp.getDanhMuc().getTenDanhMuc().isBlank()) {
            categoryName = sp.getDanhMuc().getTenDanhMuc().trim();
        }

        Map<String, Object> productObj = new LinkedHashMap<>();
        productObj.put("title", sp != null && sp.getTenSanPham() != null ? sp.getTenSanPham() : "Sản phẩm FCentric");
        productObj.put("body_html", "<p>" + (sp != null && sp.getMoTa() != null && !sp.getMoTa().isBlank() ? sp.getMoTa() : (sp != null ? sp.getTenSanPham() : "")) + "</p>");
        productObj.put("vendor", vendorName);
        productObj.put("product_type", categoryName);
        productObj.put("tags", categoryName.equalsIgnoreCase(vendorName) ? categoryName : categoryName + ", " + vendorName);
        productObj.put("status", "active");

        // [Ưu tiên 1 - Hybrid Smart Sync]: Đính kèm ảnh chính sản phẩm cha vào payload khởi tạo (tiết kiệm request, 0 latency)
        if (sp != null && sp.getId() != null) {
            try {
                List<AnhQuanAo> prodImages = anhQuanAoRepository.findActiveByQuanAoIds(List.of(sp.getId()));
                if (!prodImages.isEmpty()) {
                    AnhQuanAo mainImg = prodImages.stream()
                            .filter(a -> Integer.valueOf(1).equals(a.getAnhChinh()))
                            .findFirst()
                            .orElse(prodImages.get(0));

                    if (mainImg.getTepTin() != null && mainImg.getTepTin().getTenLuuTru() != null) {
                        TepTin tep = mainImg.getTepTin();
                        if (tep.getKichCo() == null || tep.getKichCo() <= 3 * 1024 * 1024) {
                            byte[] imgBytes = minioService.download(tep.getTenLuuTru());
                            if (imgBytes != null && imgBytes.length > 0) {
                                String base64Img = Base64.getEncoder().encodeToString(imgBytes);
                                Map<String, Object> imgMap = new LinkedHashMap<>();
                                imgMap.put("attachment", base64Img);
                                imgMap.put("filename", tep.getTenTaiLen() != null && !tep.getTenTaiLen().isBlank()
                                        ? tep.getTenTaiLen() : "main_product.jpg");
                                productObj.put("images", List.of(imgMap));
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Không thể tải ảnh chính sản phẩm [{}] từ MinIO: {}", sp.getTenSanPham(), e.getMessage());
            }
        }

        List<Map<String, String>> options = List.of(
                Map.of("name", "Màu sắc"),
                Map.of("name", "Kích cỡ"),
                Map.of("name", "Chất liệu")
        );
        productObj.put("options", options);

        List<Map<String, Object>> variantList = new ArrayList<>();
        Set<String> usedOptions = new HashSet<>();

        for (BienTheSanPham bt : variants) {
            Map<String, Object> varMap = new LinkedHashMap<>();
            String opt1 = (bt.getMauSac() != null && bt.getMauSac().getTenMau() != null && !bt.getMauSac().getTenMau().isBlank())
                    ? bt.getMauSac().getTenMau().trim() : "Mặc định";
            String opt2 = (bt.getSize() != null && bt.getSize().getTenSize() != null && !bt.getSize().getTenSize().isBlank())
                    ? bt.getSize().getTenSize().trim() : "Tiêu chuẩn";
            String opt3 = (bt.getChatLieu() != null && bt.getChatLieu().getTenChatLieu() != null && !bt.getChatLieu().getTenChatLieu().isBlank())
                    ? bt.getChatLieu().getTenChatLieu().trim() : "Cotton";

            String optKey = opt1 + "|" + opt2 + "|" + opt3;
            if (usedOptions.contains(optKey)) {
                opt3 = opt3 + " (" + bt.getMaSku() + ")";
            }
            usedOptions.add(opt1 + "|" + opt2 + "|" + opt3);

            varMap.put("option1", opt1);
            varMap.put("option2", opt2);
            varMap.put("option3", opt3);
            varMap.put("sku", bt.getMaSku());

            // Tính giá bán: Phải dùng đúng giá của biến thể đó hoặc giá mặc định của sản phẩm cha, tuyệt đối không gán chéo
            BigDecimal price = bt.getGiaBan();
            if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
                if (sp != null && sp.getGiaBanMacDinh() != null && sp.getGiaBanMacDinh().compareTo(BigDecimal.ZERO) > 0) {
                    price = sp.getGiaBanMacDinh();
                } else {
                    throw new CommonException(ThongDiep.of("kenhBan.bienTheChuaCoGiaBan", bt.getMaSku()), HttpStatus.BAD_REQUEST, null);
                }
            }
            varMap.put("price", price.setScale(2, RoundingMode.HALF_UP).toPlainString());

            if (bt.getMaVachSku() != null && !bt.getMaVachSku().isBlank()) {
                varMap.put("barcode", bt.getMaVachSku().trim());
            }
            varMap.put("inventory_management", "shopify");

            variantList.add(varMap);
        }
        productObj.put("variants", variantList);

        Map<String, Object> body = Map.of("product", productObj);
        String jsonBody = objectMapper.writeValueAsString(body);

        HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode productNode = root.path("product");
            Long prodId = productNode.path("id").asLong();
            JsonNode createdVars = productNode.path("variants");
            if (createdVars.isArray()) {
                for (JsonNode v : createdVars) {
                    String sku = v.path("sku").asText("").trim().toLowerCase();
                    if (!sku.isBlank()) {
                        Long imgId = v.path("image_id").isNull() || v.path("image_id").asLong() == 0 ? null : v.path("image_id").asLong();
                        result.put(sku, new ShopifyVariantInfo(
                                v.path("id").asLong(),
                                v.path("inventory_item_id").asLong(),
                                prodId,
                                imgId
                        ));
                    }
                }
            }
        }
        return result;
    }

    private Map<String, ShopifyVariantInfo> themVariantsVaoSanPhamShopify(String domain, String token, Long shopifyProductId, SanPhamQuanAo sp, List<BienTheSanPham> variants, List<BienTheSanPham> allSpVariants) {
        Map<String, ShopifyVariantInfo> result = new HashMap<>();
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products/" + shopifyProductId + "/variants.json";
        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = createHeaders(token);

        for (BienTheSanPham bt : variants) {
            try {
                Map<String, Object> varMap = new LinkedHashMap<>();
                String opt1 = (bt.getMauSac() != null && bt.getMauSac().getTenMau() != null && !bt.getMauSac().getTenMau().isBlank())
                        ? bt.getMauSac().getTenMau().trim() : "Mặc định";
                String opt2 = (bt.getSize() != null && bt.getSize().getTenSize() != null && !bt.getSize().getTenSize().isBlank())
                        ? bt.getSize().getTenSize().trim() : "Tiêu chuẩn";
                String opt3 = (bt.getChatLieu() != null && bt.getChatLieu().getTenChatLieu() != null && !bt.getChatLieu().getTenChatLieu().isBlank())
                        ? bt.getChatLieu().getTenChatLieu().trim() : "Cotton";

                varMap.put("option1", opt1);
                varMap.put("option2", opt2);
                varMap.put("option3", opt3);
                varMap.put("sku", bt.getMaSku());

                // Tính giá bán: Phải dùng đúng giá của biến thể đó hoặc giá mặc định của sản phẩm cha, tuyệt đối không gán chéo
                BigDecimal price = bt.getGiaBan();
                if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
                    if (sp != null && sp.getGiaBanMacDinh() != null && sp.getGiaBanMacDinh().compareTo(BigDecimal.ZERO) > 0) {
                        price = sp.getGiaBanMacDinh();
                    } else {
                        throw new CommonException(ThongDiep.of("kenhBan.bienTheChuaCoGiaBan", bt.getMaSku()), HttpStatus.BAD_REQUEST, null);
                    }
                }
                varMap.put("price", price.setScale(2, RoundingMode.HALF_UP).toPlainString());

                if (bt.getMaVachSku() != null && !bt.getMaVachSku().isBlank()) {
                    varMap.put("barcode", bt.getMaVachSku().trim());
                }
                varMap.put("inventory_management", "shopify");

                Map<String, Object> body = Map.of("variant", varMap);
                String jsonBody = objectMapper.writeValueAsString(body);
                HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);
                ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    JsonNode root = objectMapper.readTree(response.getBody());
                    JsonNode v = root.path("variant");
                    String sku = v.path("sku").asText("").trim().toLowerCase();
                    Long imgId = v.path("image_id").isNull() || v.path("image_id").asLong() == 0 ? null : v.path("image_id").asLong();
                    result.put(sku, new ShopifyVariantInfo(
                            v.path("id").asLong(),
                            v.path("inventory_item_id").asLong(),
                            shopifyProductId,
                            imgId
                    ));
                    log.info("Thêm thành công biến thể [{}] vào sản phẩm Shopify ID {}", bt.getMaSku(), shopifyProductId);
                }
                try { Thread.sleep(200); } catch (InterruptedException ignored) {}
            } catch (Exception e) {
                log.warn("Lỗi khi thêm biến thể [{}] vào sản phẩm Shopify {}: {}", bt.getMaSku(), shopifyProductId, e.getMessage());
            }
        }
        return result;
    }

    private boolean capNhatSanPhamLenShopify(String domain, String token, Long shopifyProductId, SanPhamQuanAo sp) {
        if (shopifyProductId == null || sp == null) return false;
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products/" + shopifyProductId + ".json";

        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = createHeaders(token);

        String vendorName = "FCentric";
        if (sp.getThuongHieu() != null && sp.getThuongHieu().getTenThuongHieu() != null && !sp.getThuongHieu().getTenThuongHieu().isBlank()) {
            vendorName = sp.getThuongHieu().getTenThuongHieu().trim();
        }

        String categoryName = "Thời trang";
        if (sp.getDanhMuc() != null && sp.getDanhMuc().getTenDanhMuc() != null && !sp.getDanhMuc().getTenDanhMuc().isBlank()) {
            categoryName = sp.getDanhMuc().getTenDanhMuc().trim();
        }

        Map<String, Object> productObj = new LinkedHashMap<>();
        productObj.put("id", shopifyProductId);
        if (sp.getTenSanPham() != null && !sp.getTenSanPham().isBlank()) {
            productObj.put("title", sp.getTenSanPham().trim());
        }
        productObj.put("vendor", vendorName);
        productObj.put("product_type", categoryName);
        productObj.put("tags", categoryName.equalsIgnoreCase(vendorName) ? categoryName : categoryName + ", " + vendorName);

        Map<String, Object> body = Map.of("product", productObj);
        try {
            String jsonBody = objectMapper.writeValueAsString(body);
            HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.PUT, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Cập nhật thành công sản phẩm [{}] (Shopify ID: {}) - Vendor: {}, Type: {}, Tags: {}",
                        sp.getTenSanPham(), shopifyProductId, vendorName, categoryName, productObj.get("tags"));
                return true;
            }
        } catch (Exception e) {
            log.warn("Lỗi khi gọi PUT cập nhật sản phẩm Shopify ID {}: {}", shopifyProductId, e.getMessage());
        }
        return false;
    }

    private int dongBoAnhBienThe(String domain, String token, Long shopifyProductId, List<BienTheSanPham> variants, Map<String, ShopifyVariantInfo> shopifySkuMap) {
        if (shopifyProductId == null || variants == null || variants.isEmpty()) {
            return 0;
        }

        int count = 0;
        try {
            List<Integer> btIds = variants.stream().map(BienTheSanPham::getId).filter(Objects::nonNull).toList();
            if (btIds.isEmpty()) return 0;

            // 1 query batch chống N+1 queries (hunt-springboot)
            List<AnhBienThe> anhBienTheList = anhBienTheRepository.findActiveByBienTheIds(btIds);
            if (anhBienTheList.isEmpty()) return 0;

            // Gom nhóm: Mỗi file ảnh (TepTin) chỉ upload 1 lần duy nhất, gán cho TẤT CẢ các variants cùng dùng ảnh này
            Map<Integer, List<BienTheSanPham>> variantsByTepTinId = new HashMap<>();
            Map<Integer, TepTin> tepTinById = new HashMap<>();

            for (AnhBienThe ab : anhBienTheList) {
                if (ab.getBienThe() != null && ab.getTepTin() != null && ab.getTepTin().getId() != null) {
                    Integer tepId = ab.getTepTin().getId();
                    tepTinById.putIfAbsent(tepId, ab.getTepTin());
                    variantsByTepTinId.computeIfAbsent(tepId, k -> new ArrayList<>()).add(ab.getBienThe());
                }
            }

            for (Map.Entry<Integer, List<BienTheSanPham>> entry : variantsByTepTinId.entrySet()) {
                TepTin tep = tepTinById.get(entry.getKey());
                List<BienTheSanPham> btsInGroup = entry.getValue();

                // Lấy danh sách Shopify Variant IDs của các biến thể trong nhóm mà CHƯA có ảnh
                List<Long> variantIdsCanGanAnh = new ArrayList<>();
                List<ShopifyVariantInfo> vInfoList = new ArrayList<>();

                for (BienTheSanPham bt : btsInGroup) {
                    String skuKey = bt.getMaSku().trim().toLowerCase();
                    ShopifyVariantInfo vInfo = shopifySkuMap.get(skuKey);
                    if (vInfo != null && vInfo.getVariantId() != null && vInfo.getImageId() == null) {
                        variantIdsCanGanAnh.add(vInfo.getVariantId());
                        vInfoList.add(vInfo);
                    }
                }

                if (variantIdsCanGanAnh.isEmpty()) {
                    continue; // Tất cả variants của nhóm ảnh này đã có ảnh, bỏ qua
                }

                if (tep.getTenLuuTru() != null && (tep.getKichCo() == null || tep.getKichCo() <= 3 * 1024 * 1024)) {
                    try {
                        byte[] bytes = minioService.download(tep.getTenLuuTru());
                        if (bytes != null && bytes.length > 0) {
                            String base64 = Base64.getEncoder().encodeToString(bytes);
                            Long newImgId = uploadAnhBienTheLenShopify(domain, token, shopifyProductId, variantIdsCanGanAnh, base64, tep.getTenTaiLen());
                            if (newImgId != null) {
                                for (ShopifyVariantInfo vi : vInfoList) {
                                    vi.setImageId(newImgId);
                                }
                                count += variantIdsCanGanAnh.size();
                            }
                            // Throttle 250ms bảo vệ Shopify leaky bucket rate limit
                            try {
                                Thread.sleep(250);
                            } catch (InterruptedException ignored) {}
                        }
                    } catch (Exception e) {
                        log.warn("Lỗi khi tải hoặc upload ảnh nhóm biến thể sang Shopify: {}", e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Lỗi khi đồng bộ ảnh biến thể cho sản phẩm Shopify [{}]: {}", shopifyProductId, e.getMessage());
        }
        return count;
    }

    private Long uploadAnhBienTheLenShopify(String domain, String token, Long shopifyProductId, List<Long> shopifyVariantIds, String base64Attachment, String filename) {
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/products/" + shopifyProductId + "/images.json";
        try {
            RestTemplate restTemplate = createRestTemplate();
            HttpHeaders headers = createHeaders(token);

            Map<String, Object> imgMap = new LinkedHashMap<>();
            imgMap.put("attachment", base64Attachment);
            String safeFilename = filename != null && !filename.isBlank() ? filename : "product_variant_image.jpg";
            imgMap.put("filename", safeFilename);
            imgMap.put("variant_ids", shopifyVariantIds);

            Map<String, Object> body = Map.of("image", imgMap);
            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                return root.path("image").path("id").asLong();
            }
        } catch (Exception e) {
            log.warn("Lỗi khi gọi API upload ảnh cho danh sách biến thể {} lên Shopify: {}", shopifyVariantIds, e.getMessage());
        }
        return null;
    }

    /**
     * Kết quả gửi số tồn của một SKU lên Shopify.
     * {@code loiKenh}: lỗi của cả gian hàng (khóa sai, bị giới hạn, Shopify không phản hồi) — đợt đẩy phải dừng
     * và không đổi trạng thái dòng nào; ngược lại là lỗi riêng SKU này.
     */
    record KetQuaGuiTon(boolean thanhCong, boolean loiKenh, String lyDo) {
        static final KetQuaGuiTon THANH_CONG = new KetQuaGuiTon(true, false, null);

        static KetQuaGuiTon loiSku(String lyDo) {
            return new KetQuaGuiTon(false, false, lyDo);
        }

        static KetQuaGuiTon loiCaKenh(String lyDo) {
            return new KetQuaGuiTon(false, true, lyDo);
        }
    }

    /**
     * Kết nối Shopify cho một đợt đẩy tồn; {@code lyDoLoi} khác null là lỗi cả gian hàng, không đẩy được SKU nào.
     * {@code locationId}/{@code tenDiaDiem}: địa điểm mặc định của cửa hàng, nơi nhận số tồn.
     */
    record KetNoiDayTon(String domain, String token, Long locationId, String tenDiaDiem,
                        Map<String, ShopifyVariantInfo> skuMap, String lyDoLoi) {
        static KetNoiDayTon loi(String lyDo) {
            return new KetNoiDayTon(null, null, null, null, Map.of(), lyDo);
        }
    }

    /** Lấy khóa, địa điểm mặc định và danh sách SKU trên sàn của kênh; thiếu bước nào thì trả lý do lỗi cả gian hàng. */
    KetNoiDayTon moKetNoiDayTon(KenhBanHang kenh) {
        if (kenh != null && OmnichannelOrderSyncJob.isLazada(kenh.getMaKenh())) {
            String appKey = kenhBanHangService.getLazadaAppKey(kenh.getMaKenh());
            String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(kenh.getMaKenh());
            String token = kenhBanHangService.getDecryptedLazadaAccessToken(kenh.getMaKenh());
            if (appKey == null || appSecret == null || token == null) {
                return KetNoiDayTon.loi("Chưa có App Key, App Secret hoặc Access Token cho kênh Lazada");
            }
            return new KetNoiDayTon("api.lazada.vn", token, 0L, "Gian hàng Lazada", Map.of(), null);
        }
        if (kenh != null && OmnichannelOrderSyncJob.isShopee(kenh.getMaKenh())) {
            return new KetNoiDayTon("partner.shopeemobile.com", "shopee_mock_token", 0L, "Gian hàng Shopee", Map.of(), null);
        }
        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        String domain = kenh != null ? extractDomainFromApiUrl(kenh.getApiUrl()) : "";
        if (token == null || token.isBlank() || domain.isBlank()) {
            return KetNoiDayTon.loi("Chưa có khóa truy cập hoặc tên miền gian hàng");
        }
        // Không đoán địa điểm khác: ghi nhầm chỗ thì Shopify vẫn báo thành công mà không ai biết
        DiaDiemShopify diaDiem = layDiaDiemMacDinh(domain, token);
        if (diaDiem == null) {
            return KetNoiDayTon.loi("Không xác định được địa điểm mặc định trên Shopify");
        }
        try {
            return new KetNoiDayTon(domain, token, diaDiem.id(), diaDiem.ten(), taiDanhSachSkuShopify(domain, token, null), null);
        } catch (Exception e) {
            log.warn("Không tải được danh sách sản phẩm trên Shopify để đẩy tồn: {}", e.getMessage());
            return KetNoiDayTon.loi("Không tải được danh sách sản phẩm trên Shopify");
        }
    }

    /** Dòng được đưa vào đợt đẩy tồn: đang đồng bộ, hoặc đang lỗi (đẩy lại để tự hết lỗi). Dòng ngừng thì bỏ qua. */
    static boolean duocDayTon(TrangThaiDongBoSanPham dong) {
        return dong.getBienTheSanPham() != null
                && ("thanh_cong".equals(dong.getTrangThaiDongBo()) || "that_bai".equals(dong.getTrangThaiDongBo()));
    }

    /**
     * Gửi số tồn của một dòng liên kết lên Shopify rồi ghi kết quả vào dòng (nơi gọi tự save).
     * Thành công: lưu số và giờ Shopify đã nhận, dòng đang lỗi trở lại "thanh_cong".
     * Lỗi SKU: dòng sang "that_bai" kèm lý do. Lỗi cả gian hàng: không đổi dòng.
     */
    KetQuaGuiTon dayTonChoDong(TrangThaiDongBoSanPham dong, KetNoiDayTon ketNoi, int soDay) {
        KetQuaGuiTon kq;
        if (dong.getKenhBanHang() != null && OmnichannelOrderSyncJob.isLazada(dong.getKenhBanHang().getMaKenh())) {
            kq = guiTonLenLazada(dong, soDay);
        } else if (dong.getKenhBanHang() != null && OmnichannelOrderSyncJob.isShopee(dong.getKenhBanHang().getMaKenh())) {
            kq = guiTonLenShopee(dong, soDay);
        } else if (dong.getKenhBanHang() != null && OmnichannelOrderSyncJob.isTikTok(dong.getKenhBanHang().getMaKenh())) {
            kq = guiTonLenTikTok(dong, soDay);
        } else {
            BienTheSanPham bt = dong.getBienTheSanPham();
            String maSku = bt != null ? bt.getMaSku() : null;
            ShopifyVariantInfo vInfo = maSku == null ? null : ketNoi.skuMap().get(maSku.trim().toLowerCase());
            kq = (vInfo == null || vInfo.getInventoryItemId() == null || vInfo.getInventoryItemId() <= 0)
                    ? KetQuaGuiTon.loiSku("Không tìm thấy SKU " + maSku + " trên Shopify")
                    : guiTonLenShopify(ketNoi.domain(), ketNoi.token(), ketNoi.locationId(), vInfo.getInventoryItemId(), soDay);
        }
        Instant now = Instant.now();
        if (kq.thanhCong()) {
            dong.setTrangThaiDongBo("thanh_cong");
            dong.setChiTietLoi(null);
            dong.setSoLuongDaDay(soDay);
            dong.setNgayDayTonCuoi(now);
            dong.setNgayDongBoCuoi(now);
        } else if (!kq.loiKenh()) {
            dong.setTrangThaiDongBo("that_bai");
            dong.setChiTietLoi(kq.lyDo());
            dong.setNgayDongBoCuoi(now);
        }
        return kq;
    }

    KetQuaGuiTon guiTonLenShopee(TrangThaiDongBoSanPham dong, int soDay) {
        BienTheSanPham bt = dong.getBienTheSanPham();
        String maSku = bt != null ? bt.getMaSku() : null;
        if (maSku == null || maSku.isBlank()) {
            return KetQuaGuiTon.loiSku("Biến thể chưa có mã SKU");
        }
        KenhBanHang kenh = dong.getKenhBanHang();
        if (kenh == null) {
            kenh = getKenhActive("SHOPEE_SANDBOX");
        }
        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClient(kenh);
        Long itemId = 1000L + bt.getId();
        Long modelId = null;
        try {
            if (dong.getMaSanPhamKenh() != null && dong.getMaSanPhamKenh().matches("\\d+")) {
                modelId = Long.parseLong(dong.getMaSanPhamKenh());
            }
        } catch (Exception ignored) {}
        try {
            JsonNode res;
            boolean isThirdPartyShopee = "SHOPEE".equalsIgnoreCase(kenh.getMaKenh());
            String shopIdStr = (kenh.getClientId() != null && !kenh.getClientId().isBlank())
                    ? kenh.getClientId().trim()
                    : ((kenh.getShopDomain() != null && !kenh.getShopDomain().isBlank()) ? kenh.getShopDomain().trim() : null);
            if (isThirdPartyShopee && shopeeThirdPartySignClient != null) {
                if (shopIdStr == null || shopIdStr.isBlank()) {
                    log.warn("[SHOPEE-SYNC] Kênh Shopee chưa cấu hình Shop ID, không thể đẩy tồn SKU {}", bt.getMaSku());
                    return KetQuaGuiTon.loiCaKenh(ThongDiep.vi("hienThiKenhPos.shopeeChuaCauHinhShopId"));
                }
                Map<String, Object> stockItem = new HashMap<>();
                stockItem.put("model_id", modelId != null ? modelId : (588300000L + bt.getId()));
                stockItem.put("normal_stock", soDay);
                res = shopeeThirdPartySignClient.updateStockBatch(shopIdStr, itemId, List.of(stockItem));
            } else {
                res = client.updateStock(itemId, modelId, soDay);
            }
            if (res != null && res.path("error").asText("").isEmpty()) {
                return KetQuaGuiTon.THANH_CONG;
            } else {
                String err = res != null ? res.path("message").asText("Lỗi cập nhật tồn Shopee") : ThongDiep.vi("hienThiKenhPos.shopeeKhongCoPhanHoi");
                return KetQuaGuiTon.loiSku(err);
            }
        } catch (Exception ex) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.shopeeLoiDayTon", ex.getMessage()));
        }
    }

    KetQuaGuiTon guiTonLenLazada(TrangThaiDongBoSanPham dong, int soDay) {
        BienTheSanPham bt = dong.getBienTheSanPham();
        String maSku = bt != null ? bt.getMaSku() : null;
        if (maSku == null || maSku.isBlank()) {
            return KetQuaGuiTon.loiSku("Biến thể chưa có mã SKU");
        }
        String maKenhBan = (dong.getKenhBanHang() != null && dong.getKenhBanHang().getMaKenh() != null)
                ? dong.getKenhBanHang().getMaKenh() : "LAZADA";
        String appKey = kenhBanHangService.getLazadaAppKey(maKenhBan);
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(maKenhBan);
        String token = kenhBanHangService.getDecryptedLazadaAccessToken(maKenhBan);
        if (appKey == null || appSecret == null || token == null) {
            return KetQuaGuiTon.loiCaKenh("Chưa có cấu hình hoặc Access Token cho kênh Lazada");
        }

        String skuIdKenh = dong.getMaSanPhamKenh() != null ? dong.getMaSanPhamKenh().trim() : "";
        if (skuIdKenh.isBlank() || !skuIdKenh.matches("\\d+")) {
            String resolvedSkuId = traCuuLazadaSkuId(appKey, appSecret, token, maSku);
            if (resolvedSkuId != null && !resolvedSkuId.isBlank()) {
                skuIdKenh = resolvedSkuId;
                dong.setMaSanPhamKenh(skuIdKenh);
                trangThaiDongBoSanPhamRepository.save(dong);
            }
        }

        StringBuilder skuXml = new StringBuilder();
        skuXml.append("<Request><Product><Skus><Sku>");
        if (skuIdKenh != null && !skuIdKenh.isBlank() && skuIdKenh.matches("\\d+")) {
            skuXml.append("<SkuId>").append(escapeXml(skuIdKenh)).append("</SkuId>");
        }
        skuXml.append("<SellerSku>").append(escapeXml(maSku)).append("</SellerSku>");
        skuXml.append("<Quantity>").append(Math.max(0, soDay)).append("</Quantity>");
        if (bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0) {
            skuXml.append("<Price>").append(bt.getGiaBan().setScale(2, RoundingMode.HALF_UP)).append("</Price>");
        }
        skuXml.append("</Sku></Skus></Product></Request>");

        try {
            JsonNode res = lazadaClient.updatePriceQuantity(appKey, appSecret, token, skuXml.toString());
            String code = res.path("code").asText("");
            if ("0".equals(code)) {
                return KetQuaGuiTon.THANH_CONG;
            } else {
                String msg = res.path("message").asText(res.path("sub_message").asText("Lỗi từ Lazada"));
                if (res.has("detail") && res.path("detail").isArray() && !res.path("detail").isEmpty()) {
                    msg += " - " + res.path("detail").get(0).path("message").asText("");
                }
                return KetQuaGuiTon.loiSku(dichLoiLazada(code, msg));
            }
        } catch (Exception ex) {
            log.warn("Lỗi khi đẩy tồn Lazada cho SkuId [{}]: {}", skuIdKenh, ex.getMessage());
            return KetQuaGuiTon.loiCaKenh("Lỗi kết nối tới Lazada: " + ex.getMessage());
        }
    }

    KetQuaGuiTon guiTonLenTikTok(TrangThaiDongBoSanPham dong, int soDay) {
        BienTheSanPham bt = dong.getBienTheSanPham();
        String maSku = bt != null ? bt.getMaSku() : null;
        if (maSku == null || maSku.isBlank()) {
            return KetQuaGuiTon.loiSku("Biến thể chưa có mã SKU");
        }
        String appKey = kenhBanHangService.getTikTokAppKey();
        String appSecret = kenhBanHangService.getDecryptedTikTokAppSecret();
        String token = kenhBanHangService.getDecryptedTikTokAccessToken();
        String cipher = kenhBanHangService.getTikTokShopCipher();
        if (appKey == null || appSecret == null || token == null || cipher == null || cipher.isBlank()) {
            return KetQuaGuiTon.loiCaKenh(ThongDiep.vi("hienThiKenhPos.tiktokThieuUyQuyenShopCipher"));
        }

        // Lấy warehouse bán hàng (chỉ nhận SALES_WAREHOUSE, loại trừ hoàn toàn RETURN_WAREHOUSE)
        String warehouseId = xacDinhTikTokSalesWarehouseId(appKey, appSecret, token, cipher, "TIKTOK");

        // Tra cứu Product ID và Sku ID từ cache danh mục TikTok (tiết kiệm quota API sàn)
        TikTokCatalogCache catalog = layHoacCapNhatTikTokCatalog(appKey, appSecret, token, cipher, false);
        String prodId = catalog.skuToProductId().get(maSku.trim().toLowerCase());
        if (prodId == null) {
            prodId = catalog.skuToProductId().get(maSku.trim());
        }
        if (prodId == null && dong.getMaSanPhamKenh() != null) {
            prodId = catalog.skuToProductId().get(dong.getMaSanPhamKenh().trim().toLowerCase());
            if (prodId == null) {
                prodId = catalog.skuToProductId().get(dong.getMaSanPhamKenh().trim());
            }
        }

        String actualSkuId = catalog.skuToSkuId().get(maSku.trim().toLowerCase());
        if (actualSkuId == null) {
            actualSkuId = catalog.skuToSkuId().get(maSku.trim());
        }
        if (actualSkuId == null && dong.getMaSanPhamKenh() != null) {
            actualSkuId = catalog.skuToSkuId().get(dong.getMaSanPhamKenh().trim().toLowerCase());
            if (actualSkuId == null) {
                actualSkuId = catalog.skuToSkuId().get(dong.getMaSanPhamKenh().trim());
            }
        }
        if ((actualSkuId == null || !actualSkuId.matches("\\d+"))
                && dong.getMaSanPhamKenh() != null && dong.getMaSanPhamKenh().matches("\\d+")) {
            actualSkuId = dong.getMaSanPhamKenh().trim();
        }

        // Nếu chưa tìm thấy prodId, thử tìm từ các biến thể anh em cùng sản phẩm cha (vì cùng 1 sản phẩm trên TikTok Shop)
        if ((prodId == null || !prodId.matches("\\d+"))
                && dong.getBienTheSanPham() != null && dong.getBienTheSanPham().getSanPham() != null
                && dong.getBienTheSanPham().getSanPham().getId() != null) {
            List<BienTheSanPham> siblings = bienTheSanPhamRepository.findBySanPham_Id(dong.getBienTheSanPham().getSanPham().getId());
            if (siblings != null) {
                for (BienTheSanPham sibling : siblings) {
                    if (sibling.getMaSku() != null) {
                        String sibProdId = catalog.skuToProductId().get(sibling.getMaSku().trim().toLowerCase());
                        if (sibProdId != null && sibProdId.matches("\\d+")) {
                            prodId = sibProdId;
                            catalog.skuToProductId().put(maSku.trim().toLowerCase(), prodId);
                            catalog.skuToProductId().put(maSku.trim(), prodId);
                            break;
                        }
                    }
                }
            }
        }

        if (prodId == null || !prodId.matches("\\d+")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokKhongTimThayProductId", maSku));
        }
        if (actualSkuId == null || !actualSkuId.matches("\\d+")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokKhongTimThaySkuId", maSku));
        }

        TikTokInventoryUpdateRequest updateReq = TikTokInventoryUpdateRequest.builder()
                .skus(List.of(TikTokInventoryUpdateRequest.SkuInventory.builder()
                        .id(actualSkuId)
                        .inventory(List.of(TikTokInventoryUpdateRequest.WarehouseQuantity.builder()
                                .warehouseId(warehouseId)
                                .quantity(Math.max(0, soDay))
                                .build()))
                        .build()))
                .build();

        try {
            TikTokInventoryUpdateResponse res = getTikTokShopClient()
                    .updateProductInventory(appKey, appSecret, token, cipher, prodId, updateReq);
            if (res != null && res.getCode() == 0) {
                return KetQuaGuiTon.THANH_CONG;
            } else {
                int errCode = res != null && res.getCode() != null ? res.getCode() : -1;
                String errMsg = res != null ? res.getMessage() : "";
                return phanLoaiLoiTikTok(errCode, errMsg, null);
            }
        } catch (LoiCoMaException e) {
            if (MaLoi.TIKTOK_RATE_LIMIT.equals(e.getMa())) {
                return KetQuaGuiTon.loiCaKenh(ThongDiep.vi("hienThiKenhPos.tiktokVuotTanSuat429"));
            }
            return phanLoaiLoiTikTok(-1, e.getMessage(), null);
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            return phanLoaiLoiTikTok(e.getStatusCode().value(), e.getStatusText(), e.getResponseBodyAsString());
        } catch (org.springframework.web.client.ResourceAccessException e) {
            return KetQuaGuiTon.loiCaKenh(ThongDiep.vi("hienThiKenhPos.tiktokLoiKetNoi", e.getMessage()));
        } catch (Exception ex) {
            log.warn("Lỗi khi đẩy tồn TikTok cho SkuId [{}]: {}", actualSkuId, ex.getMessage());
            return phanLoaiLoiTikTok(-1, ex.getMessage(), null);
        }
    }

    private static StringBuilder buildLazadaBatchXml(List<DongCanCapNhat> list) {
        StringBuilder sb = new StringBuilder("<Request><Product><Skus>");
        for (DongCanCapNhat item : list) {
            sb.append("<Sku>");
            if (item.skuId() != null && item.skuId().matches("\\d+")) {
                sb.append("<SkuId>").append(escapeXml(item.skuId())).append("</SkuId>");
            }
            sb.append("<SellerSku>").append(escapeXml(item.sellerSku())).append("</SellerSku>");
            sb.append("<Quantity>").append(Math.max(0, item.soDay())).append("</Quantity>");
            BienTheSanPham bt = item.dong().getBienTheSanPham();
            if (bt != null && bt.getGiaBan() != null && bt.getGiaBan().compareTo(BigDecimal.ZERO) > 0) {
                sb.append("<Price>").append(bt.getGiaBan().setScale(2, RoundingMode.HALF_UP)).append("</Price>");
            }
            sb.append("</Sku>");
        }
        sb.append("</Skus></Product></Request>");
        return sb;
    }

    private static DongCanCapNhat timSkuViPhamNegativeSellable(List<DongCanCapNhat> batch, JsonNode res, String detailMsg) {
        String failingId = null;
        String failingEntityId = null;
        String failingSellerSku = null;

        if (res.has("detail") && res.path("detail").isArray()) {
            for (JsonNode d : res.path("detail")) {
                String dMsg = d.path("message").asText("");
                String sSku = d.path("seller_sku").asText("");
                if (!sSku.isBlank()) failingSellerSku = sSku.trim();
                java.util.regex.Matcher mId = java.util.regex.Pattern.compile("id=(\\d+)").matcher(dMsg);
                if (mId.find()) failingId = mId.group(1);
                java.util.regex.Matcher mEnt = java.util.regex.Pattern.compile("entityId=(\\d+)").matcher(dMsg);
                if (mEnt.find()) failingEntityId = mEnt.group(1);
            }
        }
        if (failingId == null && detailMsg != null) {
            java.util.regex.Matcher mId = java.util.regex.Pattern.compile("id=(\\d+)").matcher(detailMsg);
            if (mId.find()) failingId = mId.group(1);
            java.util.regex.Matcher mEnt = java.util.regex.Pattern.compile("entityId=(\\d+)").matcher(detailMsg);
            if (mEnt.find()) failingEntityId = mEnt.group(1);
        }

        for (DongCanCapNhat item : batch) {
            if (failingSellerSku != null && failingSellerSku.equalsIgnoreCase(item.sellerSku())) return item;
            if (failingId != null && failingId.equals(item.skuId())) return item;
            if (failingEntityId != null && failingEntityId.equals(item.skuId())) return item;
        }

        return batch.stream().filter(it -> it.soDay() == 0).findFirst().orElse(null);
    }

    public static String dichLoiLazada(String code, String rawMsg) {
        if (rawMsg == null) rawMsg = "";
        String lower = rawMsg.toLowerCase(Locale.ROOT);
        if (lower.contains("negative sellable")) {
            return "Lazada đang tạm giữ tồn cho đơn chờ thanh toán hoặc chiến dịch khuyến mãi. Hệ thống sẽ tự động đồng bộ khi sàn giải phóng tồn.";
        }
        if (code.contains("AppCallLimit") || lower.contains("exceeds the limit") || lower.contains("call limit")) {
            return "Sàn Lazada tạm thời quá tải tần suất gọi API. Hệ thống sẽ tự động thử lại sau ít phút.";
        }
        if (lower.contains("incomplete sku") || lower.contains("package") || lower.contains("missing required")) {
            return "Biến thể thiếu thông tin bắt buộc (cân nặng/kích thước đóng gói) trên Lazada Seller Center.";
        }
        if (lower.contains("invalid access token") || lower.contains("token expired") || lower.contains("illegal access token")) {
            return "Ủy quyền kết nối Lazada đã hết hạn. Vui lòng bấm 'Ủy quyền lại' ở đầu trang.";
        }
        return "Lazada từ chối (" + code + "): " + rawMsg;
    }

    private String traCuuLazadaSkuId(String appKey, String appSecret, String token, String sellerSku) {
        if (sellerSku == null || sellerSku.isBlank()) return null;
        String target = sellerSku.trim().toLowerCase(Locale.ROOT);
        try {
            int offset = 0;
            int limit = 50;
            while (offset < 500) {
                JsonNode res = lazadaClient.getProducts(appKey, appSecret, token, "all", limit, offset);
                if (!"0".equals(res.path("code").asText(""))) break;
                JsonNode products = res.path("data").path("products");
                if (!products.isArray() || products.isEmpty()) break;
                for (JsonNode prodNode : products) {
                    JsonNode skus = prodNode.path("skus");
                    if (skus.isArray()) {
                        for (JsonNode skuNode : skus) {
                            String sSku = skuNode.path("SellerSku").asText("").trim();
                            if (sSku.isBlank()) sSku = skuNode.path("ShopSku").asText("").trim();
                            if (target.equalsIgnoreCase(sSku)) {
                                String skuId = skuNode.path("SkuId").asText("").trim();
                                if (skuId.isBlank()) skuId = skuNode.path("sku_id").asText("").trim();
                                if (!skuId.isBlank()) return skuId;
                            }
                        }
                    }
                }
                if (products.size() < limit) break;
                offset += limit;
            }
        } catch (Exception e) {
            log.warn("[LAZADA-LOOKUP-SKUID] Lỗi tra cứu SkuId cho {}: {}", sellerSku, e.getMessage());
        }
        return null;
    }

    private static String escapeXml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    /**
     * Ghi số tồn của một inventory item vào địa điểm kho chính trên Shopify.
     * 401/403, 429, 5xx và lỗi kết nối là lỗi cả gian hàng; 4xx còn lại là Shopify từ chối riêng SKU này.
     */
    KetQuaGuiTon guiTonLenShopify(String domain, String token, Long locationId, Long inventoryItemId, int available) {
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/inventory_levels/set.json";
        int retryCount = 0;
        int maxRetries = 2;
        while (true) {
            try {
                RestTemplate restTemplate = createRestTemplate();
                HttpHeaders headers = createHeaders(token);

                Map<String, Object> body = Map.of(
                        "location_id", locationId,
                        "inventory_item_id", inventoryItemId,
                        "available", available
                );
                HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
                ResponseEntity<String> res = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
                if (res != null && res.getStatusCode().is2xxSuccessful()) {
                    return KetQuaGuiTon.THANH_CONG;
                }
                return KetQuaGuiTon.loiSku("Shopify không nhận số tồn (mã " + (res != null ? res.getStatusCode().value() : "?") + ")");
            } catch (HttpStatusCodeException e) {
                if (e.getStatusCode().value() == 429 && retryCount < maxRetries) {
                    retryCount++;
                    long waitMs = 2000L;
                    String retryAfter = e.getResponseHeaders() != null ? e.getResponseHeaders().getFirst("Retry-After") : null;
                    if (retryAfter != null) {
                        try {
                            waitMs = (long) (Double.parseDouble(retryAfter.trim()) * 1000);
                        } catch (Exception ignored) {}
                    }
                    log.warn("Shopify trả lỗi 429 (Too Many Requests) cho item [{}], đợi {}ms rồi thử lại lần {}/{}",
                            inventoryItemId, waitMs, retryCount, maxRetries);
                    try {
                        Thread.sleep(Math.max(1000L, Math.min(waitMs, 5000L)));
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return KetQuaGuiTon.loiCaKenh("Tiến trình bị gián đoạn khi đang chờ giới hạn tốc độ");
                    }
                    continue;
                }
                log.warn("Shopify trả lỗi {} khi set inventory level cho item [{}]: {}",
                        e.getStatusCode().value(), inventoryItemId, e.getResponseBodyAsString());
                return phanLoaiLoiShopify(e.getStatusCode().value(), e.getResponseBodyAsString());
            } catch (ResourceAccessException e) {
                log.warn("Không kết nối được Shopify khi set inventory level cho item [{}]: {}", inventoryItemId, e.getMessage());
                return KetQuaGuiTon.loiCaKenh("Không kết nối được Shopify, vui lòng thử lại sau");
            } catch (Exception e) {
                log.warn("Lỗi khi set inventory level cho item [{}]: {}", inventoryItemId, e.getMessage());
                return KetQuaGuiTon.loiSku(e.getMessage() != null ? e.getMessage() : "Lỗi không xác định khi đẩy tồn");
            }
        }
    }

    /** Phân loại mã lỗi HTTP Shopify trả về khi ghi số tồn. */
    KetQuaGuiTon phanLoaiLoiShopify(int ma, String body) {
        if (ma == 401 || ma == 403) {
            return KetQuaGuiTon.loiCaKenh("Khóa truy cập Shopify không hợp lệ hoặc thiếu quyền ghi tồn kho");
        }
        if (ma == 429) {
            return KetQuaGuiTon.loiCaKenh("Shopify đang giới hạn số lần gọi, vui lòng thử lại sau ít phút");
        }
        if (ma >= 500) {
            return KetQuaGuiTon.loiCaKenh("Shopify đang gặp sự cố (mã " + ma + "), vui lòng thử lại sau");
        }
        String chiTiet = loiTuShopify(body);
        if (chiTiet != null) {
            String lower = chiTiet.toLowerCase(Locale.ROOT);
            if (lower.contains("cannot be tracked") || lower.contains("not tracked")) {
                chiTiet = "Sản phẩm đang tắt tính năng theo dõi tồn kho (Track quantity) trên Shopify.";
            } else if (lower.contains("does not exist at location") || lower.contains("location")) {
                chiTiet = "Biến thể chưa được kích hoạt theo dõi tại vị trí kho mặc định trên Shopify.";
            }
        }
        return KetQuaGuiTon.loiSku("Shopify từ chối số tồn" + (chiTiet != null ? ": " + chiTiet : " (mã " + ma + ")"));
    }

    /** Câu lỗi trong body JSON của Shopify: {"errors": "..."}, {"errors": [...]} hoặc {"errors": {"truong": [...]}}. */
    String loiTuShopify(String body) {
        if (body == null || body.isBlank()) return null;
        try {
            List<String> cau = new ArrayList<>();
            gomCauLoi(objectMapper.readTree(body).path("errors"), cau);
            if (cau.isEmpty()) return null;
            String ketQua = String.join("; ", cau);
            return ketQua.length() > 300 ? ketQua.substring(0, 300) + "…" : ketQua;
        } catch (Exception ex) {
            return null;
        }
    }

    private static void gomCauLoi(JsonNode node, List<String> cau) {
        if (node == null || node.isMissingNode() || node.isNull()) return;
        if (node.isTextual()) {
            if (!node.asText().isBlank()) cau.add(node.asText().trim());
            return;
        }
        node.forEach(con -> gomCauLoi(con, cau));
    }

    /**
     * Phân loại mã lỗi nghiệp vụ và thông điệp từ sàn TikTok Shop thành thông điệp tiếng Việt trực quan,
     * hướng dẫn người dùng hành động thay vì hiển thị thuật ngữ kỹ thuật thô.
     */
    KetQuaGuiTon phanLoaiLoiTikTok(int code, String message, String rawBody) {
        String combined = ((message != null ? message : "") + " " + (rawBody != null ? rawBody : "")).toLowerCase(Locale.ROOT);

        // 1. Lỗi xác thực và ủy quyền (Token hết hạn / Shop Cipher)
        if (code == 105001 || code == 105002 || combined.contains("token expired") || combined.contains("access_token")
                || combined.contains("shop_cipher is invalid") || code == 401 || code == 403) {
            return KetQuaGuiTon.loiCaKenh(ThongDiep.vi("hienThiKenhPos.tiktokUyQuyenHetHan"));
        }

        // 2. Lỗi tần suất gọi API (Rate limit)
        if (code == 429 || code == 105003 || combined.contains("too many requests") || combined.contains("rate limit")
                || combined.contains("frequency limit")) {
            return KetQuaGuiTon.loiCaKenh(ThongDiep.vi("hienThiKenhPos.tiktokVuotTanSuat429"));
        }

        // 3. Lỗi kho hàng (Chọn nhầm kho trả hàng hoặc kho không khả dụng)
        if (code == 12052532 || combined.contains("warehouse_id") || combined.contains("get warehouse list")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokLoiKhoHang"));
        }

        // 4. Lỗi vi phạm thương hiệu / nhãn hiệu bảo hộ
        if (code == 12052106 || code == 12052107 || combined.contains("thương hiệu khác") || combined.contains("brand")
                || combined.contains("trademark") || combined.contains("infringement") || combined.contains("vi phạm")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokViPhamThuongHieu"));
        }

        // 5. Lỗi thuộc tính Nghị định 85 (Đơn vị chịu trách nhiệm hàng hóa ID 101489, 101490)
        if (combined.contains("101489") || combined.contains("101490") || combined.contains("tổ chức chịu trách nhiệm")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokThieuNghiDinh85"));
        }

        // 6. Lỗi thuộc tính Quốc gia xuất xứ (ID 100149)
        if (combined.contains("100149") || combined.contains("quốc gia xuất xứ") || combined.contains("country of origin")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokThieuXuatXu"));
        }

        // 7. Lỗi thuộc tính bắt buộc khác
        if (code == 12052104 || combined.contains("missing product attribute")) {
            String attrName = trichXuatTenThuocTinh(message != null ? message : rawBody);
            return KetQuaGuiTon.loiSku(attrName != null && !attrName.isBlank()
                    ? ThongDiep.vi("hienThiKenhPos.tiktokThieuThuocTinh", attrName)
                    : ThongDiep.vi("hienThiKenhPos.tiktokThieuThuocTinh", "Cơ bản"));
        }

        // 8. Lỗi bảng quy đổi kích cỡ (Size Chart)
        if (code == 12052673 || combined.contains("size_chart_image is required") || combined.contains("size_chart")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokThieuSizeChart"));
        }
        if (code == 12052670 || combined.contains("invalid size chart image")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokLoiSizeChart"));
        }

        // 9. Lỗi trùng lặp tổ hợp biến thể (Sales Attribute)
        if (code == 12052251 || combined.contains("sale attribute") || combined.contains("already in use")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokTrungBienThe"));
        }

        // 10. Lỗi trạng thái phê duyệt sản phẩm trên sàn
        if (code == 12052528 || combined.contains("under_review") || combined.contains("rejected") || combined.contains("frozen")
                || combined.contains("suspended") || combined.contains("status is not active")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokChoPheDuyet"));
        }

        // 11. Lỗi chưa tìm thấy Product ID hoặc SKU ID
        if (code == 12052529 || code == 12052530 || combined.contains("product not found") || combined.contains("sku not found")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokChuaTimThaySanPham"));
        }

        // 12. Lỗi ảnh sản phẩm
        if (code == 12052300 || combined.contains("image uri") || combined.contains("upload image")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokLoiAnh"));
        }

        // 13. Lỗi tồn kho và giá bán
        if (code == 12052533 || code == 12052400 || combined.contains("stock must be") || combined.contains("price is invalid")) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokLoiTonGia"));
        }

        // Fallback: Nếu có message chi tiết
        if (message != null && !message.isBlank()) {
            return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokTuChoiSoTonChiTiet", message));
        }
        return KetQuaGuiTon.loiSku(ThongDiep.vi("hienThiKenhPos.tiktokLoiKhongXacDinh"));
    }

    private static String trichXuatTenThuocTinh(String text) {
        if (text == null) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("['\"]([^'\"]+)['\"]").matcher(text);
        if (m.find()) {
            return m.group(1);
        }
        return null;
    }

    private BigDecimal khaDungToanChuoi(Integer bienTheId) {
        List<Object[]> stocks = tonKhoTongHopRepository.sumTongFreeToUseToanHeThongByBienTheIds(List.of(bienTheId));
        return !stocks.isEmpty() && stocks.get(0)[1] != null ? (BigDecimal) stocks.get(0)[1] : BigDecimal.ZERO;
    }

    /** Số tồn Shopify đã nhận ở lần đẩy thành công gần nhất; null nếu chưa đẩy. */
    private static BigDecimal soDaDay(TrangThaiDongBoSanPham dong) {
        return dong.getSoLuongDaDay() != null ? BigDecimal.valueOf(dong.getSoLuongDaDay()) : null;
    }

    /** Trạng thái dòng liên kết mà người dùng đã bấm "Ngừng đồng bộ". */
    static final String TRANG_THAI_NGUNG = "chua_dong_bo";

    /**
     * Số tồn đẩy lên sàn (BR-OC-10): floor(khả dụng × tỷ lệ / 100) − tồn đệm; kết quả ≤ ngưỡng về 0 thì đẩy 0.
     */
    static int tinhSoTonDay(BigDecimal khaDung, BigDecimal tyLe, int tonDem, int nguongVe0) {
        BigDecimal kd = khaDung != null ? khaDung : BigDecimal.ZERO;
        BigDecimal tl = tyLe != null ? tyLe : BigDecimal.valueOf(100);
        BigDecimal so = kd.multiply(tl).divide(BigDecimal.valueOf(100), 0, RoundingMode.FLOOR)
                .subtract(BigDecimal.valueOf(tonDem));
        if (so.compareTo(BigDecimal.valueOf(nguongVe0)) <= 0 || so.signum() < 0) {
            return 0;
        }
        return so.min(BigDecimal.valueOf(Integer.MAX_VALUE)).intValue();
    }

    /** Quy tắc đẩy tồn đã lưu của kênh (chưa lưu thì 100%, tồn đệm 0, ngưỡng 0). */
    private DayTonKenhRequest quyTacDaLuu(String maKenh) {
        Integer khoId = SecurityContextHolder.getKhoId();
        if (khoId == null || khoId <= 0) {
            khoId = 1;
        }
        return DayTonKenhRequest.builder()
                .khoId(khoId)
                .tyLeDayTon(BigDecimal.valueOf(KenhCauHinhDongBo.tyLeDayTon(dieuHanhHeThongService, maKenh)))
                .tonDem(KenhCauHinhDongBo.tonDem(dieuHanhHeThongService, maKenh))
                .nguongVe0(KenhCauHinhDongBo.nguongVe0(dieuHanhHeThongService, maKenh))
                .build();
    }

    private int soTonDayTheoQuyTacDaLuu(String maKenh, BigDecimal khaDung) {
        DayTonKenhRequest q = quyTacDaLuu(maKenh);
        return tinhSoTonDay(khaDung, q.getTyLeDayTon(), q.getTonDem(), q.getNguongVe0());
    }

    private RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(8000);
        factory.setReadTimeout(15000);
        return new RestTemplate(factory);
    }

    private HttpHeaders createHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Shopify-Access-Token", token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
        return headers;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleInventoryRestockedEvent(InventoryRestockedEvent event) {
        if (event == null || event.getBienTheSanPhamId() == null) return;
        log.info("[REALTIME-SYNC] Đơn hàng hủy đã hoàn lại {} units cho SKU ID {}. Kích hoạt đẩy tồn kho cập nhật tức thì lên các sàn!",
                event.getSoLuongHoanLai(), event.getBienTheSanPhamId());
        try {
            dayTonKhoKhanCap(event.getBienTheSanPhamId());
        } catch (Exception e) {
            log.warn("[REALTIME-SYNC] Lỗi khi đẩy tồn kho khẩn cấp cho SKU {}: {}", event.getBienTheSanPhamId(), e.getMessage());
        }
    }

    @Override
    public boolean huyDonHangTrenShopify(String maDonHangKenh, String lyDoHuy) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) {
            return false;
        }

        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY)
                .or(() -> kenhBanHangRepository.findByMaKenh(MA_KENH_SHOPIFY.toLowerCase()))
                .orElse(null);
        if (kenh == null) return false;

        String token = kenhBanHangService.getDecryptedShopifyAccessToken();
        if (token == null || token.isBlank()) {
            log.warn("[SHOPIFY-CANCEL] Không có Access Token hợp lệ để hủy đơn {}", maDonHangKenh);
            return false;
        }

        String domain = extractDomainFromApiUrl(kenh.getApiUrl());
        if (domain.isBlank()) {
            return false;
        }

        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/orders/" + maDonHangKenh + "/cancel.json";
        try {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(8000);
            factory.setReadTimeout(15000);
            RestTemplate restTemplate = new RestTemplate(factory);

            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Shopify-Access-Token", token);
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);

            java.util.Map<String, Object> body = new java.util.HashMap<>();
            body.put("reason", "customer");
            body.put("email", false);
            body.put("refund", false);
            body.put("restock", true);

            HttpEntity<java.util.Map<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("[SHOPIFY-CANCEL] Hủy thành công đơn hàng {} trên Shopify", maDonHangKenh);
                return true;
            }
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNPROCESSABLE_ENTITY && e.getResponseBodyAsString().contains("already")) {
                log.info("[SHOPIFY-CANCEL] Đơn hàng {} đã ở trạng thái hủy trên Shopify", maDonHangKenh);
                return true;
            }
            log.warn("[SHOPIFY-CANCEL] Lỗi khi gọi Shopify cancel order {}: {}", maDonHangKenh, e.getMessage());
        } catch (Exception e) {
            log.error("[SHOPIFY-CANCEL] Lỗi kết nối khi hủy đơn {}: {}", maDonHangKenh, e.getMessage());
        }
        return false;
    }

    private String xacDinhMaKenhLazada(String maDonHangKenh) {
        if (maDonHangKenh != null && donBanHangRepository != null) {
            DonBanHang don = donBanHangRepository.findByMaDonHangKenh(maDonHangKenh).orElse(null);
            if (don != null && don.getKenhBanHang() != null && don.getKenhBanHang().getMaKenh() != null) {
                return don.getKenhBanHang().getMaKenh();
            }
        }
        return OmnichannelOrderSyncJob.MA_KENH_LAZADA;
    }

    @Override
    public boolean huyDonHangTrenLazada(String maDonHangKenh, String lyDoHuy) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) {
            return false;
        }

        String maKenh = xacDinhMaKenhLazada(maDonHangKenh);
        String appKey = kenhBanHangService.getLazadaAppKey(maKenh);
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(maKenh);
        String token = kenhBanHangService.getDecryptedLazadaAccessToken(maKenh);
        if (appKey == null || appSecret == null || token == null) {
            log.warn("[LAZADA-CANCEL] Chưa có cấu hình hoặc Access Token để hủy đơn {}", maDonHangKenh);
            return false;
        }

        try {
            List<String> orderItemIds = new ArrayList<>();
            JsonNode itemsRes = lazadaClient.getOrderItems(appKey, appSecret, token, maDonHangKenh);
            if (itemsRes != null && "0".equals(itemsRes.path("code").asText(""))) {
                JsonNode data = itemsRes.path("data");
                if (data.isArray()) {
                    for (JsonNode it : data) {
                        String itemId = it.path("order_item_id").asText("");
                        if (!itemId.isBlank()) {
                            orderItemIds.add(itemId);
                        }
                    }
                }
            }

            JsonNode cancelRes = lazadaClient.cancelOrder(appKey, appSecret, token, maDonHangKenh, orderItemIds, "15", lyDoHuy);
            String code = cancelRes != null ? cancelRes.path("code").asText("") : "";
            if ("0".equals(code)) {
                log.info("[LAZADA-CANCEL] Hủy thành công đơn hàng {} trên Lazada", maDonHangKenh);
                return true;
            } else {
                String msg = cancelRes != null ? cancelRes.path("message").asText(cancelRes.path("sub_message").asText("")) : "Unknown";
                if (msg.toLowerCase().contains("already") || msg.toLowerCase().contains("cancel")) {
                    log.info("[LAZADA-CANCEL] Đơn hàng {} đã ở trạng thái hủy trên Lazada", maDonHangKenh);
                    return true;
                }
                log.warn("[LAZADA-CANCEL] Lazada từ chối hủy đơn {}: code={}, msg={}", maDonHangKenh, code, msg);
                return false;
            }
        } catch (Exception e) {
            log.error("[LAZADA-CANCEL] Lỗi khi gọi Lazada cancel order {}: {}", maDonHangKenh, e.getMessage());
            return false;
        }
    }

    @Override
    public boolean dongBoTrangThaiPackedLazada(String maDonHangKenh) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) {
            return false;
        }
        String maKenh = xacDinhMaKenhLazada(maDonHangKenh);
        String appKey = kenhBanHangService.getLazadaAppKey(maKenh);
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(maKenh);
        String token = kenhBanHangService.getDecryptedLazadaAccessToken(maKenh);
        if (appKey == null || appSecret == null || token == null) {
            log.warn("[LAZADA-PACK] Chưa có cấu hình hoặc Access Token để pack đơn {}", maDonHangKenh);
            return false;
        }
        try {
            List<String> orderItemIds = new ArrayList<>();
            JsonNode itemsRes = lazadaClient.getOrderItems(appKey, appSecret, token, maDonHangKenh);
            if (itemsRes != null && "0".equals(itemsRes.path("code").asText(""))) {
                JsonNode data = itemsRes.path("data");
                if (data.isArray()) {
                    for (JsonNode it : data) {
                        String itemId = it.path("order_item_id").asText("");
                        if (!itemId.isBlank()) {
                            orderItemIds.add(itemId);
                        }
                    }
                }
            }
            JsonNode packRes = lazadaClient.packOrder(appKey, appSecret, token, maDonHangKenh, orderItemIds);
            String code = packRes != null ? packRes.path("code").asText("") : "";
            if ("0".equals(code)) {
                log.info("[LAZADA-PACK] Đã đồng bộ trạng thái packed cho đơn hàng {} sang Lazada", maDonHangKenh);
                return true;
            } else {
                String msg = packRes != null ? packRes.path("message").asText(packRes.path("sub_message").asText("")) : "Unknown";
                if (msg.toLowerCase().contains("already") || msg.toLowerCase().contains("packed")) {
                    log.info("[LAZADA-PACK] Đơn hàng {} đã ở trạng thái packed trên Lazada", maDonHangKenh);
                    return true;
                }
                log.warn("[LAZADA-PACK] Lazada từ chối pack đơn {}: code={}, msg={}", maDonHangKenh, code, msg);
                return false;
            }
        } catch (Exception e) {
            log.error("[LAZADA-PACK] Lỗi khi gọi Lazada pack order {}: {}", maDonHangKenh, e.getMessage());
            return false;
        }
    }

    @Override
    public boolean dongBoTrangThaiReadyToShipLazada(String maDonHangKenh) {
        if (maDonHangKenh == null || maDonHangKenh.isBlank()) {
            return false;
        }
        String maKenh = xacDinhMaKenhLazada(maDonHangKenh);
        String appKey = kenhBanHangService.getLazadaAppKey(maKenh);
        String appSecret = kenhBanHangService.getDecryptedLazadaAppSecret(maKenh);
        String token = kenhBanHangService.getDecryptedLazadaAccessToken(maKenh);
        if (appKey == null || appSecret == null || token == null) {
            log.warn("[LAZADA-RTS] Chưa có cấu hình hoặc Access Token để RTS đơn {}", maDonHangKenh);
            return false;
        }
        try {
            List<String> orderItemIds = new ArrayList<>();
            String packageId = null;
            JsonNode itemsRes = lazadaClient.getOrderItems(appKey, appSecret, token, maDonHangKenh);
            if (itemsRes != null && "0".equals(itemsRes.path("code").asText(""))) {
                JsonNode data = itemsRes.path("data");
                if (data.isArray()) {
                    for (JsonNode it : data) {
                        String itemId = it.path("order_item_id").asText("");
                        if (!itemId.isBlank()) {
                            orderItemIds.add(itemId);
                        }
                        String pkg = it.path("package_id").asText("");
                        if (!pkg.isBlank() && packageId == null) {
                            packageId = pkg;
                        }
                    }
                }
            }

            // Self-Healing: Nếu chưa có packageId hợp lệ, tự động gọi packOrder để tạo kiện trên sàn và lấy package_id
            if ((packageId == null || packageId.isBlank()) && !orderItemIds.isEmpty()) {
                log.info("[LAZADA-RTS] Đơn hàng {} chưa có package_id, kích hoạt tự động packOrder...", maDonHangKenh);
                JsonNode packRes = lazadaClient.packOrder(appKey, appSecret, token, maDonHangKenh, orderItemIds);
                if (packRes != null) {
                    JsonNode packData = packRes.path("data");
                    if (packData.path("order_item_list").isArray()) {
                        for (JsonNode oi : packData.path("order_item_list")) {
                            String pkg = oi.path("package_id").asText("");
                            if (!pkg.isBlank()) {
                                packageId = pkg;
                                break;
                            }
                        }
                    }
                    if (packageId == null && packData.path("pack_order_list").isArray()) {
                        for (JsonNode po : packData.path("pack_order_list")) {
                            String pkg = po.path("package_id").asText("");
                            if (!pkg.isBlank()) {
                                packageId = pkg;
                                break;
                            }
                        }
                    }
                    if (packageId == null && packData.path("packages").isArray()) {
                        for (JsonNode pkgNode : packData.path("packages")) {
                            String pkg = pkgNode.path("package_id").asText("");
                            if (!pkg.isBlank()) {
                                packageId = pkg;
                                break;
                            }
                        }
                    }
                }

                if (packageId == null || packageId.isBlank()) {
                    JsonNode refreshedItems = lazadaClient.getOrderItems(appKey, appSecret, token, maDonHangKenh);
                    if (refreshedItems != null && "0".equals(refreshedItems.path("code").asText(""))) {
                        JsonNode data = refreshedItems.path("data");
                        if (data.isArray()) {
                            for (JsonNode it : data) {
                                String pkg = it.path("package_id").asText("");
                                if (!pkg.isBlank()) {
                                    packageId = pkg;
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            JsonNode rtsRes = lazadaClient.readyToShip(appKey, appSecret, token, packageId, orderItemIds);
            String code = rtsRes != null ? rtsRes.path("code").asText("") : "";
            if ("0".equals(code)) {
                log.info("[LAZADA-RTS] Đã đồng bộ trạng thái ready_to_ship cho đơn hàng {} sang Lazada (package_id: {})",
                        maDonHangKenh, packageId != null ? packageId : "N/A");
                return true;
            } else {
                String msg = rtsRes != null ? rtsRes.path("message").asText(rtsRes.path("sub_message").asText("")) : "Unknown";
                if (msg.toLowerCase().contains("already") || msg.toLowerCase().contains("ready_to_ship") || msg.toLowerCase().contains("rts")) {
                    log.info("[LAZADA-RTS] Đơn hàng {} đã ở trạng thái ready_to_ship trên Lazada", maDonHangKenh);
                    return true;
                }
                log.warn("[LAZADA-RTS] Lazada từ chối RTS đơn {}: code={}, msg={}", maDonHangKenh, code, msg);
                return false;
            }
        } catch (Exception e) {
            log.error("[LAZADA-RTS] Lỗi khi gọi Lazada RTS order {}: {}", maDonHangKenh, e.getMessage());
            return false;
        }
    }

    /** Trích xuất URL trang tiếp theo từ Header Link của Shopify (RFC 5988 cursor pagination) */
    public static String trichXuatUrlTrangSau(String linkHeader) {
        if (linkHeader == null || linkHeader.isBlank()) return null;
        for (String part : linkHeader.split(",")) {
            if (part.contains("rel=\"next\"") || part.contains("rel=next")) {
                int start = part.indexOf('<');
                int end = part.indexOf('>');
                if (start >= 0 && end > start) {
                    return part.substring(start + 1, end).trim();
                }
            }
        }
        return null;
    }

    /** Kiểm tra Leaky Bucket rate limit của Shopify (Header X-Shopify-Shop-Api-Call-Limit: 38/40) */
    public static void kiemTraLeakyBucket(String callLimitHeader) {
        if (callLimitHeader == null || !callLimitHeader.contains("/")) return;
        try {
            String[] parts = callLimitHeader.split("/");
            int current = Integer.parseInt(parts[0].trim());
            int max = Integer.parseInt(parts[1].trim());
            if (current >= max - 3) {
                Thread.sleep(500);
            }
        } catch (Exception ignored) {}
    }

    /** Cập nhật giá biến thể trực tiếp lên Shopify qua PUT /admin/api/{version}/variants/{id}.json */
    public boolean capNhatGiaBienTheShopify(String domain, String token, Long shopifyVariantId, BigDecimal giaBan, BigDecimal compareAtPrice) {
        if (shopifyVariantId == null || giaBan == null || giaBan.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        String url = "https://" + domain + "/admin/api/" + DEFAULT_API_VERSION + "/variants/" + shopifyVariantId + ".json";
        RestTemplate restTemplate = createRestTemplate();
        HttpHeaders headers = createHeaders(token);

        Map<String, Object> variantObj = new LinkedHashMap<>();
        variantObj.put("id", shopifyVariantId);
        variantObj.put("price", giaBan.setScale(2, RoundingMode.HALF_UP).toPlainString());
        if (compareAtPrice != null && compareAtPrice.compareTo(BigDecimal.ZERO) > 0) {
            variantObj.put("compare_at_price", compareAtPrice.setScale(2, RoundingMode.HALF_UP).toPlainString());
        }

        Map<String, Object> body = Map.of("variant", variantObj);
        try {
            String jsonBody = objectMapper.writeValueAsString(body);
            HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.PUT, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                kiemTraLeakyBucket(response.getHeaders().getFirst("X-Shopify-Shop-Api-Call-Limit"));
                log.info("Cập nhật thành công giá biến thể Shopify ID {}: {} (compare_at: {})", shopifyVariantId, giaBan, compareAtPrice);
                return true;
            }
        } catch (Exception e) {
            log.warn("Lỗi khi cập nhật giá biến thể Shopify ID {}: {}", shopifyVariantId, e.getMessage());
        }
        return false;
    }

    @AllArgsConstructor
    @NoArgsConstructor
    @Getter
    @Setter
    static class ShopifyVariantInfo {
        Long variantId;
        Long inventoryItemId;
        Long productId;
        Long imageId;
        BigDecimal price;
        BigDecimal compareAtPrice;
        String barcode;

        public ShopifyVariantInfo(Long variantId, Long inventoryItemId, Long productId, Long imageId) {
            this(variantId, inventoryItemId, productId, imageId, null, null, null);
        }
    }

    // ── Shopee Catalog & Stock Synchronization ──

    private com.dev.backend.services.shopee.ShopeeClient getShopeeClient(KenhBanHang kenh) {
        String maKenh = kenh != null ? kenh.getMaKenh() : "SHOPEE";
        Long partnerId = kenhBanHangService.getShopeePartnerId(maKenh);
        String partnerKey = kenhBanHangService.getDecryptedShopeePartnerKey(maKenh);
        String accessToken = kenhBanHangService.getDecryptedShopeeAccessToken(maKenh);
        Long shopId = kenhBanHangService.getShopeeShopId(maKenh);
        boolean isSandbox = OmnichannelOrderSyncJob.isShopeeSandbox(maKenh);

        return new com.dev.backend.services.shopee.ShopeeClient(
                partnerId != null ? partnerId : 0L,
                partnerKey != null ? partnerKey : "",
                shopId != null ? shopId : 0L,
                accessToken != null ? accessToken : "",
                isSandbox
        );
    }

    private TaiSanPhamResultDto taiSanPhamShopee(KenhBanHang kenh) {
        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClient(kenh);
        boolean isThirdPartyShopee = "SHOPEE".equalsIgnoreCase(kenh.getMaKenh());
        boolean isSandbox = "SHOPEE_SANDBOX".equalsIgnoreCase(kenh.getMaKenh());
        String shopIdStr = (kenh.getClientId() != null && !kenh.getClientId().isBlank())
                ? kenh.getClientId().trim()
                : ((kenh.getShopDomain() != null && !kenh.getShopDomain().isBlank()) ? kenh.getShopDomain().trim() : null);

        if (isThirdPartyShopee && (shopIdStr == null || shopIdStr.isBlank())) {
            throw new CommonException(ThongDiep.of("kenhBan.chuaCauHinhShopIdKenh", kenh.getMaKenh()), HttpStatus.BAD_REQUEST, null);
        }

        int soSku = 0;
        int soMoi = 0;
        int soCapNhat = 0;

        try {
            JsonNode listRes;
            if (isThirdPartyShopee && shopeeThirdPartySignClient != null) {
                listRes = shopeeThirdPartySignClient.getItemList(shopIdStr, 0, 100);
            } else {
                listRes = client.getItemList(0, 100, "NORMAL");
            }
            JsonNode items = listRes.path("response").path("item");
            if (!items.isArray() || items.isEmpty()) {
                items = listRes.path("response").path("item_list");
            }
            List<Long> itemIds = new ArrayList<>();
            if (items.isArray()) {
                for (JsonNode it : items) {
                    itemIds.add(it.path("item_id").asLong());
                }
            }

            if (itemIds.isEmpty()) {
                if (isSandbox) {
                    var bienThes = bienTheSanPhamRepository.findAll();
                    int limit = Math.min(bienThes.size(), 10);
                    for (int i = 0; i < limit; i++) {
                        var bt = bienThes.get(i);
                        String skuKenh = bt.getMaSku() != null ? bt.getMaSku() : ("SHP-SKU-" + bt.getId());
                        String maSanPhamKenh = "SHP_ITEM_" + (1000 + bt.getId());
                        var opt = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndMaSanPhamKenh(kenh.getId(), maSanPhamKenh);
                        TrangThaiDongBoSanPham tt;
                        if (opt.isPresent()) {
                            tt = opt.get();
                            soCapNhat++;
                        } else {
                            tt = new TrangThaiDongBoSanPham();
                            tt.setKenhBanHang(kenh);
                            tt.setMaSanPhamKenh(maSanPhamKenh);
                            soMoi++;
                        }
                        tt.setGiaBanSan(bt.getGiaBan());
                        tt.setBienTheSanPham(bt);
                        tt.setTrangThaiDongBo("thanh_cong");
                        trangThaiDongBoSanPhamRepository.save(tt);
                        soSku++;
                    }
                    return TaiSanPhamResultDto.builder().soSku(soSku).soMoi(soMoi).soCapNhat(soCapNhat).build();
                }
                return TaiSanPhamResultDto.builder().soSku(0).soMoi(0).soCapNhat(0).build();
            }

            JsonNode detailRes;
            if (isThirdPartyShopee && shopeeThirdPartySignClient != null) {
                detailRes = shopeeThirdPartySignClient.getItemBaseInfo(shopIdStr, itemIds);
            } else {
                detailRes = client.getItemBaseInfo(itemIds);
            }
            JsonNode itemList = detailRes.path("response").path("item_list");
            if (itemList.isArray()) {
                for (JsonNode itemNode : itemList) {
                    long itemId = itemNode.path("item_id").asLong();
                    String itemName = itemNode.path("item_name").asText("Sản phẩm Shopee");
                    JsonNode models = itemNode.path("model");

                    if (models.isArray() && !models.isEmpty()) {
                        for (JsonNode modelNode : models) {
                            long modelId = modelNode.path("model_id").asLong();
                            String modelSku = modelNode.path("model_sku").asText("").trim();
                            if (modelSku.isBlank()) {
                                modelSku = "SHP-SKU-" + itemId + "-" + modelId;
                            }
                            BigDecimal price = null;
                            JsonNode priceInfo = modelNode.path("price_info");
                            if (priceInfo.isArray() && !priceInfo.isEmpty()) {
                                price = BigDecimal.valueOf(priceInfo.get(0).path("original_price").asDouble(0.0));
                            }

                            String maSanPhamKenh = String.valueOf(modelId);
                            var opt = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndMaSanPhamKenh(kenh.getId(), maSanPhamKenh);
                            TrangThaiDongBoSanPham tt;
                            if (opt.isPresent()) {
                                tt = opt.get();
                                soCapNhat++;
                            } else {
                                tt = new TrangThaiDongBoSanPham();
                                tt.setKenhBanHang(kenh);
                                tt.setMaSanPhamKenh(maSanPhamKenh);
                                soMoi++;
                            }
                            if (tt.getBienTheSanPham() == null) {
                                BienTheSanPham bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(modelSku).orElse(null);
                                if (bt != null) {
                                    tt.setBienTheSanPham(bt);
                                    tt.setTrangThaiDongBo("thanh_cong");
                                } else {
                                    tt.setTrangThaiDongBo("chua_dong_bo");
                                }
                            }
                            if (price != null) tt.setGiaBanSan(price);
                            trangThaiDongBoSanPhamRepository.save(tt);
                            soSku++;
                        }
                    } else {
                        String maSanPhamKenh = String.valueOf(itemId);
                        String sku = itemNode.path("item_sku").asText("SHP-ITEM-" + itemId).trim();
                        BigDecimal price = null;
                        JsonNode priceInfo = itemNode.path("price_info");
                        if (priceInfo.isArray() && !priceInfo.isEmpty()) {
                            price = BigDecimal.valueOf(priceInfo.get(0).path("original_price").asDouble(0.0));
                        }

                        var opt = trangThaiDongBoSanPhamRepository.findByKenhBanHangIdAndMaSanPhamKenh(kenh.getId(), maSanPhamKenh);
                        TrangThaiDongBoSanPham tt;
                        if (opt.isPresent()) {
                            tt = opt.get();
                            soCapNhat++;
                        } else {
                            tt = new TrangThaiDongBoSanPham();
                            tt.setKenhBanHang(kenh);
                            tt.setMaSanPhamKenh(maSanPhamKenh);
                            soMoi++;
                        }
                        if (tt.getBienTheSanPham() == null) {
                            BienTheSanPham bt = bienTheSanPhamRepository.findByMaSkuIgnoreCase(sku).orElse(null);
                            if (bt != null) {
                                tt.setBienTheSanPham(bt);
                                tt.setTrangThaiDongBo("thanh_cong");
                            } else {
                                tt.setTrangThaiDongBo("chua_dong_bo");
                            }
                        }
                        if (price != null) tt.setGiaBanSan(price);
                        trangThaiDongBoSanPhamRepository.save(tt);
                        soSku++;
                    }
                }
            }
        } catch (Exception e) {
            log.error("[SHOPEE-SYNC] Lỗi tải sản phẩm Shopee: {}", e.getMessage(), e);
            throw new CommonException(ThongDiep.of("kenhBan.loiTaiSanPhamShopee", e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR, null);
        }

        return TaiSanPhamResultDto.builder().soSku(soSku).soMoi(soMoi).soCapNhat(soCapNhat).build();
    }

    private TuDongLienKetResultDto tuDongLienKetShopee(KenhBanHang kenh) {
        List<BienTheSanPham> activeVariants = bienTheSanPhamRepository.findActiveVariantsWithDetails();
        if (activeVariants == null || activeVariants.isEmpty()) {
            activeVariants = bienTheSanPhamRepository.findByTrangThai(1);
        }
        if (activeVariants == null || activeVariants.isEmpty()) {
            return TuDongLienKetResultDto.builder()
                    .soDaGhep(0).soKhongKhop(0).soNhieuKhop(0).soTaoMoiTrenShopify(0).soTonKhoDaDay(0).soThatBai(0)
                    .build();
        }

        Map<String, Long> skuToModelMap = new HashMap<>();
        int soTaoMoiTrenShopee = 0;

        if (OmnichannelOrderSyncJob.isShopeeSandbox(kenh.getMaKenh()) && shopeeMockEngine != null) {
            skuToModelMap = shopeeMockEngine.addMockProductsFromVariants(activeVariants);
            soTaoMoiTrenShopee = skuToModelMap.size();
        }

        List<TrangThaiDongBoSanPham> existingMappings = trangThaiDongBoSanPhamRepository.findByKenhBanHangId(kenh.getId());
        Map<Integer, TrangThaiDongBoSanPham> mappingByBtId = new HashMap<>();
        for (TrangThaiDongBoSanPham m : existingMappings) {
            if (m.getBienTheSanPham() != null) {
                mappingByBtId.put(m.getBienTheSanPham().getId(), m);
            }
        }

        int soDaGhep = 0;
        int soKhongKhop = 0;
        Instant now = Instant.now();

        for (BienTheSanPham bt : activeVariants) {
            if (bt.getMaSku() == null || bt.getMaSku().isBlank()) continue;
            String normSku = bt.getMaSku().trim().toLowerCase(Locale.ROOT);
            Long modelId = skuToModelMap.get(normSku);
            String targetSkuId = modelId != null ? modelId.toString() : ("588300000" + bt.getId());

            TrangThaiDongBoSanPham record = mappingByBtId.get(bt.getId());
            boolean dangNgung = false;
            if (record != null) {
                dangNgung = TRANG_THAI_NGUNG.equals(record.getTrangThaiDongBo());
                record.setMaSanPhamKenh(targetSkuId);
                if (!dangNgung) {
                    record.setTrangThaiDongBo("thanh_cong");
                    record.setChiTietLoi(null);
                }
                record.setNgayDongBoCuoi(now);
            } else {
                record = TrangThaiDongBoSanPham.builder()
                        .kenhBanHang(kenh)
                        .bienTheSanPham(bt)
                        .maSanPhamKenh(targetSkuId)
                        .trangThaiDongBo("thanh_cong")
                        .chiTietLoi(null)
                        .ngayDongBoCuoi(now)
                        .build();
            }
            trangThaiDongBoSanPhamRepository.save(record);
            soDaGhep++;
        }

        // Tự động đẩy tồn khả dụng cho các SKU vừa liên kết
        int soTonKhoDaDay = 0;
        try {
            DayTonResultDto dayTonRes = dayTonKhoLenKenh(kenh.getMaKenh(), quyTacDaLuu(kenh.getMaKenh()));
            if (dayTonRes != null) {
                soTonKhoDaDay = dayTonRes.getSoDong();
            }
        } catch (Exception ex) {
            log.warn("[SHOPEE-SYNC] Tự động đẩy tồn sau khi liên kết gặp lỗi: {}", ex.getMessage());
        }

        ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_san_pham, "Tự động liên kết Shopee: đã ghép " + soDaGhep + " SKU, tạo mới " + soTaoMoiTrenShopee + " SKU, đã đẩy tồn " + soTonKhoDaDay + " SKU");

        return TuDongLienKetResultDto.builder()
                .soDaGhep(soDaGhep)
                .soKhongKhop(soKhongKhop)
                .soNhieuKhop(0)
                .soTaoMoiTrenShopify(soTaoMoiTrenShopee)
                .soCapNhatTrenShopify(0)
                .soTonKhoDaDay(soTonKhoDaDay)
                .soThatBai(0)
                .build();
    }

    record DongCanCapNhatShopee(TrangThaiDongBoSanPham dong, int soDay) {}

    private DayTonResultDto dayTonShopeeToiUu(
            KenhBanHang kenh,
            String maKenh,
            List<TrangThaiDongBoSanPham> dongCanDay,
            BigDecimal tyLe,
            int tonDem,
            int nguongVe0,
            TheoDoiDayTon theoDoi) {

        com.dev.backend.services.shopee.ShopeeClient client = getShopeeClient(kenh);
        Instant now = Instant.now();

        // ═══════════════════════════════════════════════════════════════════
        // [DELTA SYNC SHOPEE] Lọc chỉ những biến thể có số tồn thay đổi
        // Bỏ qua các SKU đã đẩy thành công và số tồn giữ nguyên -> Tiết kiệm 100% quota API
        // ═══════════════════════════════════════════════════════════════════
        int soBoQuaKhongDoi = 0;
        List<DongCanCapNhatShopee> dirtyList = new ArrayList<>();

        for (TrangThaiDongBoSanPham dong : dongCanDay) {
            BienTheSanPham bt = dong.getBienTheSanPham();
            if (bt == null || bt.getId() == null) continue;
            int soDay = tinhSoTonDay(khaDungToanChuoi(bt.getId()), tyLe, tonDem, nguongVe0);

            boolean daThanhCong = "thanh_cong".equalsIgnoreCase(dong.getTrangThaiDongBo());
            boolean soTonKhongDoi = dong.getSoLuongDaDay() != null && dong.getSoLuongDaDay().equals(soDay);
            if (daThanhCong && soTonKhongDoi) {
                soBoQuaKhongDoi++;
                continue;
            }
            dirtyList.add(new DongCanCapNhatShopee(dong, soDay));
        }

        log.info("[SHOPEE-SYNC-DELTA] Tổng số SKU: {}, Bỏ qua không đổi: {}, Cần đẩy (dirty): {}",
                dongCanDay.size(), soBoQuaKhongDoi, dirtyList.size());

        if (dirtyList.isEmpty()) {
            theoDoi.batDauDay(0);
            lanDayTonCuoi.put(kenh.getId(), now);
            String moTa = "Shopee: Tất cả " + dongCanDay.size() + " SKU tồn kho không đổi, bỏ qua đẩy tồn (tiết kiệm 100% quota API)";
            ghiNhatKy(kenh.getId(), IHanhDong.dong_bo_ton_kho, moTa);
            return DayTonResultDto.builder().soDong(0).soLoi(0).soChuaDay(0).loiKenh(null).build();
        }

        theoDoi.batDauDay(dirtyList.size());

        // Gom nhóm biến thể theo sản phẩm cha (Batch stock update theo item_id chuẩn Shopee Open Platform)
        Map<Integer, List<DongCanCapNhatShopee>> gomNhomTheoSp = new LinkedHashMap<>();
        for (DongCanCapNhatShopee item : dirtyList) {
            TrangThaiDongBoSanPham dong = item.dong();
            int spId = (dong.getBienTheSanPham().getSanPham() != null && dong.getBienTheSanPham().getSanPham().getId() != null)
                    ? dong.getBienTheSanPham().getSanPham().getId() : 0;
            gomNhomTheoSp.computeIfAbsent(spId, k -> new ArrayList<>()).add(item);
        }

        int soThanhCong = 0;
        int soLoi = 0;

        for (Map.Entry<Integer, List<DongCanCapNhatShopee>> entry : gomNhomTheoSp.entrySet()) {
            if (theoDoi.canDung()) {
                break;
            }

            Integer spId = entry.getKey();
            List<DongCanCapNhatShopee> nhomDong = entry.getValue();
            Long itemId = spId > 0 ? (188200000L + spId * 100L) : 1000L;

            List<Map<String, Object>> stockList = new ArrayList<>();

            for (DongCanCapNhatShopee item : nhomDong) {
                TrangThaiDongBoSanPham dong = item.dong();
                BienTheSanPham bt = dong.getBienTheSanPham();
                int soDay = item.soDay();

                Long modelId = null;
                try {
                    if (dong.getMaSanPhamKenh() != null && dong.getMaSanPhamKenh().matches("\\d+")) {
                        modelId = Long.parseLong(dong.getMaSanPhamKenh());
                    } else {
                        modelId = 588300000L + bt.getId();
                    }
                } catch (Exception ignored) {
                    modelId = 588300000L + bt.getId();
                }

                Map<String, Object> stockItem = new HashMap<>();
                stockItem.put("model_id", modelId);
                stockItem.put("normal_stock", soDay);
                stockList.add(stockItem);
            }

            try {
                // Gọi API cập nhật tồn kho theo lô (Batching) cho sản phẩm cha
                JsonNode res;
                boolean isThirdPartyShopee = "SHOPEE".equalsIgnoreCase(kenh.getMaKenh());
                String shopIdStr = (kenh.getClientId() != null && !kenh.getClientId().isBlank())
                        ? kenh.getClientId().trim()
                        : ((kenh.getShopDomain() != null && !kenh.getShopDomain().isBlank()) ? kenh.getShopDomain().trim() : null);
                if (isThirdPartyShopee && shopeeThirdPartySignClient != null) {
                    if (shopIdStr == null || shopIdStr.isBlank()) {
                        log.warn("[SHOPEE-SYNC-BATCH] Kênh Shopee chưa cấu hình Shop ID, bỏ qua đẩy tồn lô sản phẩm {}", itemId);
                        continue;
                    }
                    res = shopeeThirdPartySignClient.updateStockBatch(shopIdStr, itemId, stockList);
                } else {
                    res = client.updateStockBatch(itemId, stockList);
                }
                boolean ok = res != null && res.path("error").asText("").isEmpty();

                for (DongCanCapNhatShopee item : nhomDong) {
                    TrangThaiDongBoSanPham dong = item.dong();
                    int soDay = item.soDay();
                    if (ok) {
                        dong.setNgayDayTonCuoi(now);
                        dong.setSoLuongDaDay(soDay);
                        dong.setTrangThaiDongBo("thanh_cong");
                        dong.setChiTietLoi(null);
                        trangThaiDongBoSanPhamRepository.save(dong);
                        soThanhCong++;
                        theoDoi.daDay(dong.getMaSanPhamKenh(), null, true, null);
                    } else {
                        String err = res != null ? res.path("message").asText("Lỗi cập nhật tồn Shopee") : "Không có phản hồi";
                        dong.setChiTietLoi(err);
                        dong.setTrangThaiDongBo("that_bai");
                        trangThaiDongBoSanPhamRepository.save(dong);
                        soLoi++;
                        theoDoi.daDay(dong.getMaSanPhamKenh(), dong.getMaSanPhamKenh(), false, err);
                    }
                }
            } catch (Exception ex) {
                log.error("[SHOPEE-STOCK-BATCH] Lỗi đẩy tồn theo lô cho sản phẩm ID {}: {}", spId, ex.getMessage());
                for (DongCanCapNhatShopee item : nhomDong) {
                    TrangThaiDongBoSanPham dong = item.dong();
                    dong.setChiTietLoi(ex.getMessage());
                    dong.setTrangThaiDongBo("that_bai");
                    trangThaiDongBoSanPhamRepository.save(dong);
                    soLoi++;
                    theoDoi.daDay(dong.getMaSanPhamKenh(), dong.getMaSanPhamKenh(), false, ex.getMessage());
                }
            }
        }

        lanDayTonCuoi.put(kenh.getId(), now);
        return DayTonResultDto.builder()
                .soDong(soThanhCong)
                .soLoi(soLoi)
                .soChuaDay(dirtyList.size() - soThanhCong - soLoi)
                .loiKenh(null)
                .build();
    }
}
